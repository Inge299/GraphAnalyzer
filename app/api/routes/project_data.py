from __future__ import annotations

import json

from fastapi import APIRouter, BackgroundTasks, Depends, File, Form, HTTPException, UploadFile
from pydantic import BaseModel, Field
from sqlalchemy import select, text
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import AsyncSessionLocal, get_db
from app.models.project import Project
from app.services.cell_tower_reference_service import (
    enrich_cell_tower_reference_from_project_addresses,
    get_cell_tower_reference_stats,
    load_cell_tower_reference,
)
from app.services.project_data_graph_service import sync_project_data_graph_artifact
from app.services.project_data_service import (
    acquire_project_data_lock,
    clear_project_data,
    ensure_project_data_tables,
    get_project_data_stats,
    load_project_data,
    load_project_data_from_upload,
)
from app.services.project_data_import_plugins import (
    list_project_data_import_plugins,
    update_project_data_import_plugin,
)

router = APIRouter(prefix="/projects", tags=["project-data"])


async def _sync_project_data_graph_artifact_in_background(project_id: int) -> None:
    async with AsyncSessionLocal() as db:
        try:
            await sync_project_data_graph_artifact(db=db, project_id=project_id)
            await db.commit()
        except Exception:
            await db.rollback()
            raise


class ProjectDataLoadRequest(BaseModel):
    source_path: str = Field(..., description="Path to source folder with CSV/ZIP files")


class CellTowerReferenceLoadRequest(BaseModel):
    source_path: str = Field(..., description="Path to cell tower reference CSV file")


class ProjectDataStatsResponse(BaseModel):
    project_id: int
    communications_count: int
    device_history_count: int
    location_events_count: int
    ip_bindings_count: int
    user_msisdn_facts_count: int
    ip_msisdn_facts_count: int
    msisdn_device_facts_count: int
    msisdn_text_facts_count: int


class ProjectDataLoadResponse(BaseModel):
    message: str
    project_id: int
    source_path: str
    output_dir: str
    import_plugin_id: str
    import_plugin_name: str
    communications_rows: int
    device_history_rows: int
    location_events_rows: int
    ip_bindings_rows: int
    user_msisdn_facts_rows: int
    ip_msisdn_facts_rows: int
    msisdn_device_facts_rows: int
    msisdn_text_facts_rows: int
    inserted_communications: int
    inserted_device_history: int
    inserted_location_events: int
    inserted_ip_bindings: int
    inserted_user_msisdn_facts: int
    inserted_ip_msisdn_facts: int
    inserted_msisdn_device_facts: int
    inserted_msisdn_text_facts: int
    load_batch_id: str
    load_log: dict
    graph_artifact: dict | None = None


class ProjectDataClearResponse(BaseModel):
    message: str
    project_id: int
    communications_deleted: int
    device_history_deleted: int
    location_events_deleted: int
    ip_bindings_deleted: int
    user_msisdn_facts_deleted: int
    ip_msisdn_facts_deleted: int
    msisdn_device_facts_deleted: int
    msisdn_text_facts_deleted: int


class CellTowerReferenceLoadResponse(BaseModel):
    message: str
    source_path: str
    inserted_rows: int
    loaded_at: str


class CellTowerReferenceEnrichResponse(BaseModel):
    message: str
    project_id: int
    raw_candidates: int
    matched_by_address: int
    inserted_rows: int


class CellTowerReferenceStatsResponse(BaseModel):
    cell_tower_reference_count: int
    last_loaded_at: str | None = None


class ProjectDataImportPluginResponse(BaseModel):
    id: str
    name: str
    description: str
    priority: int
    enabled: bool
    extensions: list[str]
    recognition_hint: str


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
        communications_rows=result.communications_rows,
        device_history_rows=result.device_history_rows,
        location_events_rows=result.location_events_rows,
        ip_bindings_rows=result.ip_bindings_rows,
        user_msisdn_facts_rows=result.user_msisdn_facts_rows,
        ip_msisdn_facts_rows=result.ip_msisdn_facts_rows,
        msisdn_device_facts_rows=result.msisdn_device_facts_rows,
        msisdn_text_facts_rows=result.msisdn_text_facts_rows,
        inserted_communications=result.inserted_communications,
        inserted_device_history=result.inserted_device_history,
        inserted_location_events=result.inserted_location_events,
        inserted_ip_bindings=result.inserted_ip_bindings,
        inserted_user_msisdn_facts=result.inserted_user_msisdn_facts,
        inserted_ip_msisdn_facts=result.inserted_ip_msisdn_facts,
        inserted_msisdn_device_facts=result.inserted_msisdn_device_facts,
        inserted_msisdn_text_facts=result.inserted_msisdn_text_facts,
        load_batch_id=result.load_batch_id,
        load_log=result.load_log,
        graph_artifact=graph_artifact,
    )


@router.post("/{project_id}/data/load", response_model=ProjectDataLoadResponse)
async def load_data_for_project(
    project_id: int,
    payload: ProjectDataLoadRequest,
    background_tasks: BackgroundTasks,
    db: AsyncSession = Depends(get_db),
):
    project = (await db.execute(select(Project).where(Project.id == project_id))).scalar_one_or_none()
    if not project:
        raise HTTPException(status_code=404, detail=f"Project {project_id} not found")

    await acquire_project_data_lock(db=db, project_id=project_id)
    result = await load_project_data(db=db, project_id=project_id, source_path=payload.source_path)
    await db.commit()
    background_tasks.add_task(_sync_project_data_graph_artifact_in_background, project_id)

    return _build_project_data_load_response(
        project_id=project_id,
        result=result,
        graph_artifact=None,
    )


@router.post("/{project_id}/data/load-upload", response_model=ProjectDataLoadResponse)
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
        plugin_overrides = {}
        for item in raw_payload:
            if not isinstance(item, dict):
                continue
            path = str(item.get("path") or "").strip()
            plugin_id = str(item.get("plugin_id") or "").strip()
            if path and plugin_id:
                plugin_overrides[path] = plugin_id

    await acquire_project_data_lock(db=db, project_id=project_id)
    result = await load_project_data_from_upload(
        db=db,
        project_id=project_id,
        files=files,
        plugin_overrides=plugin_overrides,
    )
    await db.commit()
    background_tasks.add_task(_sync_project_data_graph_artifact_in_background, project_id)

    return _build_project_data_load_response(
        project_id=project_id,
        result=result,
        graph_artifact=None,
    )


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


@router.get("/data/import-plugins", response_model=list[ProjectDataImportPluginResponse])
async def list_data_import_plugins():
    return [ProjectDataImportPluginResponse(**plugin.__dict__) for plugin in list_project_data_import_plugins()]


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

    await acquire_project_data_lock(db=db, project_id=project_id)
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
    await ensure_project_data_tables(db)
    await db.execute(text("SELECT pg_advisory_xact_lock(910009999)"))
    result = await load_cell_tower_reference(db=db, source_path=payload.source_path)
    await db.commit()
    return CellTowerReferenceLoadResponse(
        message="Cell tower reference loaded",
        **result,
    )


@router.post("/{project_id}/data/cell-towers/enrich-by-address", response_model=CellTowerReferenceEnrichResponse)
async def enrich_cell_tower_reference_by_project_addresses(
    project_id: int,
    db: AsyncSession = Depends(get_db),
):
    await ensure_project_data_tables(db)
    project = (await db.execute(select(Project).where(Project.id == project_id))).scalar_one_or_none()
    if not project:
        raise HTTPException(status_code=404, detail=f"Project {project_id} not found")

    await db.execute(text("SELECT pg_advisory_xact_lock(910009999)"))
    result = await enrich_cell_tower_reference_from_project_addresses(db=db, project_id=project_id)
    await db.commit()
    return CellTowerReferenceEnrichResponse(
        message="Cell tower reference enriched from project addresses",
        **result,
    )


@router.get("/data/cell-towers/stats", response_model=CellTowerReferenceStatsResponse)
async def get_cell_tower_reference_data_stats(
    db: AsyncSession = Depends(get_db),
):
    await ensure_project_data_tables(db)
    stats = await get_cell_tower_reference_stats(db=db)
    return CellTowerReferenceStatsResponse(**stats)





