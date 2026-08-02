from __future__ import annotations

import json
from datetime import datetime

from fastapi import APIRouter, BackgroundTasks, Depends, File, Form, HTTPException, UploadFile
from pydantic import BaseModel, Field
from sqlalchemy import select, text
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models.project import Project
from app.import_plugin_sdk import ImportPluginContractError
from app.services.cell_tower_reference_provider import get_cell_tower_reference_provider_status
from app.services.project_data_import_utils import save_uploaded_files
from app.services.import_quality_service import get_import_quality_report
from app.services.project_data_service import (
    DATA_ROOT,
    acquire_project_data_lock,
    try_acquire_project_data_lock,
    clear_project_data,
    ensure_project_data_tables,
    get_project_data_stats,
    load_project_data,
    load_project_data_from_upload,
)
from app.services.project_data_import_plugins import (
    delete_project_data_import_plugin,
    install_project_data_import_plugin_file,
    list_project_data_import_plugins,
    update_project_data_import_plugin,
)

router = APIRouter(prefix="/projects", tags=["project-data"])


class ProjectDataLoadRequest(BaseModel):
    source_path: str = Field(..., description="Path to source folder with CSV/ZIP files")


class CellTowerReferenceLoadRequest(BaseModel):
    source_path: str = Field(..., description="Path to cell tower reference CSV file")


class ProjectDataStatsResponse(BaseModel):
    project_id: int
    entities_count: int
    facts_count: int
    relations_count: int
    entity_counts: dict[str, int]
    fact_counts: dict[str, int]
    relation_counts: dict[str, int]

class ProjectDataLoadResponse(BaseModel):
    message: str
    project_id: int
    source_path: str
    output_dir: str
    import_plugin_id: str
    import_plugin_name: str
    entities: int
    facts: int
    relations: int
    source_counts: dict[str, int]
    fact_counts: dict[str, int]
    load_batch_id: str
    load_log: dict
    graph_artifact: dict | None = None

class ProjectDataImportJobResponse(BaseModel):
    id: str
    project_id: int
    status: str
    progress: int
    message: str
    result: dict | None = None
    error: str | None = None
    created_at: str
    started_at: str | None = None
    finished_at: str | None = None

class ProjectDataClearResponse(BaseModel):
    message: str
    project_id: int
    entities_deleted: int
    facts_deleted: int
    relations_deleted: int

class CellTowerReferenceLoadResponse(BaseModel):
    message: str
    source_path: str
    inserted_rows: int
    loaded_at: str


class ProjectCellTowerGeocodingJobResponse(BaseModel):
    id: str
    project_id: int
    status: str
    progress: int
    message: str
    result: dict | None = None
    error: str | None = None
    created_at: str
    started_at: str | None = None
    finished_at: str | None = None


class CellTowerReferenceStatsResponse(BaseModel):
    cell_tower_reference_count: int = 0
    last_loaded_at: str | None = None
    provider_enabled: bool
    provider_id: str
    provider_label: str
    provider_detail: str


class ProjectDataImportPluginResponse(BaseModel):
    id: str
    name: str
    description: str
    priority: int
    enabled: bool
    extensions: list[str]
    recognition_hint: str
    version: str
    sdk_version: str
    config_schema: dict
    input_contract: dict
    domain_contract: dict
    capabilities: list[str]
    output_datasets: list[dict]
    source: str
    removable: bool


class ProjectDataImportPluginInstallResponse(BaseModel):
    filename: str
    plugins: list[ProjectDataImportPluginResponse]

class ProjectDataImportPluginUpdateRequest(BaseModel):
    name: str | None = None
    description: str | None = None
    priority: int | None = None
    enabled: bool | None = None


def _build_project_data_load_response(
    project_id: int,
    result,
    graph_artifact: dict | None,
) -> ProjectDataLoadResponse:
    return ProjectDataLoadResponse(
        message="Project data loaded successfully",
        project_id=project_id,
        source_path=result.source_path,
        output_dir=result.output_dir,
        import_plugin_id=result.import_plugin_id,
        import_plugin_name=result.import_plugin_name,
        entities=result.entities,
        facts=result.facts,
        relations=result.relations,
        source_counts=result.source_counts,
        fact_counts=result.fact_counts,
        load_batch_id=result.load_batch_id,
        load_log=result.load_log,
        graph_artifact=graph_artifact,
    )

@router.post("/{project_id}/data/load", response_model=ProjectDataLoadResponse)
async def load_data_for_project(
    project_id: int,
    payload: ProjectDataLoadRequest,
    db: AsyncSession = Depends(get_db),
):
    project = (await db.execute(select(Project).where(Project.id == project_id))).scalar_one_or_none()
    if not project:
        raise HTTPException(status_code=404, detail=f"Project {project_id} not found")

    await acquire_project_data_lock(db=db, project_id=project_id)
    result = await load_project_data(db=db, project_id=project_id, source_path=payload.source_path)
    await db.commit()

    return _build_project_data_load_response(
        project_id=project_id,
        result=result,
        graph_artifact=None,
    )


@router.post("/{project_id}/data/load-upload", response_model=ProjectDataImportJobResponse)
async def load_data_for_project_upload(
    project_id: int,
    background_tasks: BackgroundTasks,
    files: list[UploadFile] = File(...),
    plugin_overrides_json: str | None = Form(None),
    db: AsyncSession = Depends(get_db),
):
    project = (await db.execute(select(Project).where(Project.id == project_id))).scalar_one_or_none()
    if not project:
        raise HTTPException(status_code=404, detail=f"Project {project_id} not found")
    plugin_overrides: dict[str, str] | None = None
    if plugin_overrides_json:
        try:
            raw_payload = json.loads(plugin_overrides_json)
        except json.JSONDecodeError as exc:
            raise HTTPException(status_code=400, detail=f"Invalid plugin_overrides_json: {exc.msg}") from exc
        if not isinstance(raw_payload, list):
            raise HTTPException(status_code=400, detail="plugin_overrides_json must be a JSON array")
        plugin_overrides = {
            str(item.get("path") or "").strip(): str(item.get("plugin_id") or "").strip()
            for item in raw_payload
            if isinstance(item, dict) and str(item.get("path") or "").strip() and str(item.get("plugin_id") or "").strip()
        }
    timestamp = datetime.utcnow().strftime("%Y%m%d_%H%M%S_%f")
    source_dir = DATA_ROOT / "uploads" / f"project_{project_id}" / timestamp
    await save_uploaded_files(source_dir, files)
    from app.services.project_data_import_jobs import create_project_data_import_job, run_project_data_import_job
    job = await create_project_data_import_job(project_id, str(source_dir), plugin_overrides)
    background_tasks.add_task(run_project_data_import_job, job["id"])
    return job


@router.get("/{project_id}/data/import-jobs/{job_id}", response_model=ProjectDataImportJobResponse)
async def get_data_import_job(project_id: int, job_id: str, db: AsyncSession = Depends(get_db)):
    project = (await db.execute(select(Project).where(Project.id == project_id))).scalar_one_or_none()
    if not project:
        raise HTTPException(status_code=404, detail=f"Project {project_id} not found")
    from app.services.project_data_import_jobs import get_project_data_import_job
    job = await get_project_data_import_job(project_id, job_id)
    if job is None:
        raise HTTPException(status_code=404, detail="Import job not found")
    return job

@router.get("/{project_id}/data/stats", response_model=ProjectDataStatsResponse)
async def get_data_stats_for_project(
    project_id: int,
    db: AsyncSession = Depends(get_db),
):
    project = (await db.execute(select(Project).where(Project.id == project_id))).scalar_one_or_none()
    if not project:
        raise HTTPException(status_code=404, detail=f"Project {project_id} not found")

    stats = await get_project_data_stats(db=db, project_id=project_id)
    return ProjectDataStatsResponse(project_id=project_id, **stats)


@router.get("/{project_id}/data/import-quality", response_model=dict)
async def get_import_quality_for_project(
    project_id: int,
    db: AsyncSession = Depends(get_db),
):
    project = (await db.execute(select(Project).where(Project.id == project_id))).scalar_one_or_none()
    if not project:
        raise HTTPException(status_code=404, detail=f"Project {project_id} not found")
    return get_import_quality_report(project_id)


@router.get("/data/import-plugins", response_model=list[ProjectDataImportPluginResponse])
async def list_data_import_plugins():
    return [ProjectDataImportPluginResponse(**plugin.__dict__) for plugin in list_project_data_import_plugins()]


@router.post("/data/import-plugins/install", response_model=ProjectDataImportPluginInstallResponse)
async def install_data_import_plugin(
    file: UploadFile = File(...),
    overwrite: bool = Form(True),
):
    filename = file.filename or ""
    try:
        content = await file.read(2 * 1024 * 1024 + 1)
    finally:
        await file.close()
    if len(content) > 2 * 1024 * 1024:
        raise HTTPException(status_code=400, detail="Import plugin file exceeds 2 MB")
    try:
        installed = install_project_data_import_plugin_file(filename, content, overwrite=overwrite)
    except ImportPluginContractError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    return ProjectDataImportPluginInstallResponse(
        filename=filename,
        plugins=[ProjectDataImportPluginResponse(**plugin.__dict__) for plugin in installed],
    )


@router.delete("/data/import-plugins/{plugin_id}", response_model=dict)
async def delete_data_import_plugin(plugin_id: str):
    filename = delete_project_data_import_plugin(plugin_id)
    return {"deleted": True, "plugin_id": plugin_id, "filename": filename}

@router.put("/data/import-plugins/{plugin_id}", response_model=ProjectDataImportPluginResponse)
async def update_data_import_plugin(
    plugin_id: str,
    payload: ProjectDataImportPluginUpdateRequest,
):
    result = update_project_data_import_plugin(
        plugin_id,
        name=payload.name,
        description=payload.description,
        priority=payload.priority,
        enabled=payload.enabled,
    )
    return ProjectDataImportPluginResponse(**result.__dict__)


@router.post("/{project_id}/data/clear", response_model=ProjectDataClearResponse)
async def clear_data_for_project(
    project_id: int,
    db: AsyncSession = Depends(get_db),
):
    project = (await db.execute(select(Project).where(Project.id == project_id))).scalar_one_or_none()
    if not project:
        raise HTTPException(status_code=404, detail=f"Project {project_id} not found")

    if not await try_acquire_project_data_lock(db=db, project_id=project_id):
        raise HTTPException(
            status_code=409,
            detail="Project data are being imported or cleared. Wait for the current operation to finish.",
        )
    deleted = await clear_project_data(db=db, project_id=project_id)
    await db.commit()
    return ProjectDataClearResponse(
        message="Project data cleared",
        project_id=project_id,
        **deleted,
    )


@router.post("/data/cell-towers/load", response_model=CellTowerReferenceLoadResponse)
async def load_cell_tower_reference_data(
    payload: CellTowerReferenceLoadRequest,
    db: AsyncSession = Depends(get_db),
):
    raise HTTPException(status_code=410, detail="Cell tower CSV loading is retired. Configure the external cell-tower reference provider instead.")


@router.post("/{project_id}/data/cell-towers/enrich-by-address", response_model=ProjectCellTowerGeocodingJobResponse)
async def enrich_cell_tower_reference_by_project_addresses(
    project_id: int,
    background_tasks: BackgroundTasks,
    db: AsyncSession = Depends(get_db),
):
    project = (await db.execute(select(Project).where(Project.id == project_id))).scalar_one_or_none()
    if not project:
        raise HTTPException(status_code=404, detail=f"Project {project_id} not found")
    from app.services.project_cell_tower_geocoding_jobs import (
        create_project_cell_tower_geocoding_job,
        run_project_cell_tower_geocoding_job,
    )
    job = await create_project_cell_tower_geocoding_job(project_id)
    background_tasks.add_task(run_project_cell_tower_geocoding_job, job["id"])
    return job


@router.get("/{project_id}/data/cell-towers/enrichment-jobs/{job_id}", response_model=ProjectCellTowerGeocodingJobResponse)
async def get_cell_tower_enrichment_job(project_id: int, job_id: str, db: AsyncSession = Depends(get_db)):
    project = (await db.execute(select(Project).where(Project.id == project_id))).scalar_one_or_none()
    if not project:
        raise HTTPException(status_code=404, detail=f"Project {project_id} not found")
    from app.services.project_cell_tower_geocoding_jobs import get_project_cell_tower_geocoding_job
    job = await get_project_cell_tower_geocoding_job(project_id, job_id)
    if job is None:
        raise HTTPException(status_code=404, detail="Cell tower enrichment job not found")
    return job


@router.get("/data/cell-towers/stats", response_model=CellTowerReferenceStatsResponse)
async def get_cell_tower_reference_data_stats() -> CellTowerReferenceStatsResponse:
    status = get_cell_tower_reference_provider_status()
    return CellTowerReferenceStatsResponse(
        provider_enabled=status.enabled,
        provider_id=status.provider_id,
        provider_label=status.label,
        provider_detail=status.detail,
    )
