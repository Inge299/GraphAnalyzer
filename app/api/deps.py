"""
Dependencies for API endpoints.
"""

from fastapi import Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.database import get_db
from app.models.project import Project
from app.models.graph import Graph

async def get_project(
    project_id: int,
    db: AsyncSession = Depends(get_db)
) -> Project:
    """Get project by ID or raise 404."""
    result = await db.execute(
        select(Project).where(Project.id == project_id)
    )
    project = result.scalar_one_or_none()

    if not project:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Project {project_id} not found"
        )
    return project

async def get_graph(
    graph_id: int,
    db: AsyncSession = Depends(get_db)
) -> Graph:
    """Get graph by ID or raise 404."""
    result = await db.execute(
        select(Graph).where(Graph.id == graph_id)
    )
    graph = result.scalar_one_or_none()

    if not graph:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Graph {graph_id} not found"
        )
    return graph
