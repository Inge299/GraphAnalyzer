from __future__ import annotations

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models.project import Project
from app.services.project_data_service import acquire_project_data_lock, clear_project_data, get_project_data_stats, load_project_data, load_project_data_from_upload

router = APIRouter(prefix="/projects", tags=["project-data"])


class ProjectDataLoadRequest(BaseModel):
    source_path: str = Field(..., description="Path to source folder with CSV/ZIP files")


@router.post("/{project_id}/data/load")
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

    return {
        "message": "Project data loaded successfully",
        "project_id": project_id,
        "source_path": result.source_path,
        "output_dir": result.output_dir,
        "communications_rows": result.communications_rows,
        "device_history_rows": result.device_history_rows,
        "inserted_communications": result.inserted_communications,
        "inserted_device_history": result.inserted_device_history,
        "load_log": result.load_log,
    }



@router.post("/{project_id}/data/load-upload")
async def load_data_for_project_upload(
    project_id: int,
    files: list[UploadFile] = File(...),
    db: AsyncSession = Depends(get_db),
):
    project = (await db.execute(select(Project).where(Project.id == project_id))).scalar_one_or_none()
    if not project:
        raise HTTPException(status_code=404, detail=f"Project {project_id} not found")

    await acquire_project_data_lock(db=db, project_id=project_id)
    result = await load_project_data_from_upload(db=db, project_id=project_id, files=files)
    await db.commit()

    return {
        "message": "Project data loaded successfully",
        "project_id": project_id,
        "source_path": result.source_path,
        "output_dir": result.output_dir,
        "communications_rows": result.communications_rows,
        "device_history_rows": result.device_history_rows,
        "inserted_communications": result.inserted_communications,
        "inserted_device_history": result.inserted_device_history,
        "load_log": result.load_log,
    }

@router.get("/{project_id}/data/stats")
async def get_data_stats_for_project(
    project_id: int,
    db: AsyncSession = Depends(get_db),
):
    project = (await db.execute(select(Project).where(Project.id == project_id))).scalar_one_or_none()
    if not project:
        raise HTTPException(status_code=404, detail=f"Project {project_id} not found")

    stats = await get_project_data_stats(db=db, project_id=project_id)
    return {
        "project_id": project_id,
        **stats,
    }
@router.post("/{project_id}/data/clear")
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
    return {
        "message": "Project data cleared",
        "project_id": project_id,
        **deleted,
    }








