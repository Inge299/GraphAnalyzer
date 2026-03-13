# app/api/deps.py
from fastapi import Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from typing import Optional

from app.database import get_db
from app.models.project import Project
from app.models.graph import Graph  # 👈 Добавляем этот импорт
from app.models.artifact import Artifact

async def get_project(
    project_id: int,
    db: AsyncSession = Depends(get_db)
) -> Optional[Project]:
    """Get project by ID or raise 404."""
    result = await db.execute(
        select(Project).where(Project.id == project_id)
    )
    project = result.scalar_one_or_none()
    if not project:
        raise HTTPException(status_code=404, detail=f"Project {project_id} not found")
    return project

async def get_graph(
    graph_id: int,
    db: AsyncSession = Depends(get_db)
) -> Optional[Graph]:
    """Get graph by ID or raise 404."""
    result = await db.execute(
        select(Graph).where(Graph.id == graph_id)
    )
    graph = result.scalar_one_or_none()
    if not graph:
        raise HTTPException(status_code=404, detail=f"Graph {graph_id} not found")
    return graph

async def get_artifact(
    artifact_id: int,
    db: AsyncSession = Depends(get_db)
) -> Optional[Artifact]:
    """Get artifact by ID or raise 404."""
    result = await db.execute(
        select(Artifact).where(Artifact.id == artifact_id)
    )
    artifact = result.scalar_one_or_none()
    if not artifact:
        raise HTTPException(status_code=404, detail=f"Artifact {artifact_id} not found")
    return artifact
