from fastapi import APIRouter, HTTPException, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from typing import Optional, List
import logging

from app.database import get_db
from app.models.project import Project

# 👇 Важно: префикс только "/projects", без "/api/v1"
router = APIRouter(prefix="/projects", tags=["projects"])
logger = logging.getLogger(__name__)

# GET /projects (полный путь: /api/v1/projects)
@router.get("")  # 👈 пустая строка после префикса
async def list_projects(
    skip: int = 0,
    limit: int = 100,
    db: AsyncSession = Depends(get_db)
):
    """List all projects."""
    logger.info("GET /api/v1/projects called")
    result = await db.execute(
        select(Project).offset(skip).limit(limit)
    )
    projects = result.scalars().all()
    return projects

# POST /projects (полный путь: /api/v1/projects)
@router.post("")  # 👈 тоже пустая строка
async def create_project(
    name: str,
    description: Optional[str] = None,
    db: AsyncSession = Depends(get_db)
):
    """Create a new project."""
    project = Project(name=name, description=description)
    db.add(project)
    await db.commit()
    await db.refresh(project)
    return project

# GET /projects/{project_id} (полный путь: /api/v1/projects/{id})
@router.get("/{project_id}")
async def get_project(
    project_id: int,
    db: AsyncSession = Depends(get_db)
):
    """Get project by ID."""
    result = await db.execute(
        select(Project).where(Project.id == project_id)
    )
    project = result.scalar_one_or_none()
    if not project:
        raise HTTPException(status_code=404, detail=f"Project {project_id} not found")
    return project

# POST /projects/{project_id}/graphs (полный путь: /api/v1/projects/{id}/graphs)
@router.post("/{project_id}/graphs")
async def create_graph(
    project_id: int,
    name: str,
    description: Optional[str] = None,
    db: AsyncSession = Depends(get_db)
):
    """Create a new graph in project."""
    # Check if project exists
    result = await db.execute(
        select(Project).where(Project.id == project_id)
    )
    project = result.scalar_one_or_none()
    if not project:
        raise HTTPException(status_code=404, detail=f"Project {project_id} not found")
    
    graph = Graph(project_id=project_id, name=name, description=description)
    db.add(graph)
    await db.commit()
    await db.refresh(graph)
    return graph

# GET /projects/{project_id}/graphs (полный путь: /api/v1/projects/{id}/graphs)
@router.get("/{project_id}/graphs")
async def list_project_graphs(
    project_id: int,
    db: AsyncSession = Depends(get_db)
):
    """List all graphs in a project."""
    # Check if project exists
    result = await db.execute(
        select(Project).where(Project.id == project_id)
    )
    project = result.scalar_one_or_none()
    if not project:
        raise HTTPException(status_code=404, detail=f"Project {project_id} not found")
    
    graphs_result = await db.execute(
        select(Graph).where(Graph.project_id == project_id)
    )
    return graphs_result.scalars().all()

# PUT /projects/{project_id} (полный путь: /api/v1/projects/{id})
@router.put("/{project_id}")
async def update_project(
    project_id: int,
    name: Optional[str] = None,
    description: Optional[str] = None,
    db: AsyncSession = Depends(get_db)
):
    """Update a project."""
    result = await db.execute(
        select(Project).where(Project.id == project_id)
    )
    project = result.scalar_one_or_none()
    if not project:
        raise HTTPException(status_code=404, detail=f"Project {project_id} not found")
    
    if name:
        project.name = name
    if description:
        project.description = description
    
    await db.commit()
    await db.refresh(project)
    return project

# DELETE /projects/{project_id} (полный путь: /api/v1/projects/{id})
@router.delete("/{project_id}")
async def delete_project(
    project_id: int,
    db: AsyncSession = Depends(get_db)
):
    """Delete a project."""
    result = await db.execute(
        select(Project).where(Project.id == project_id)
    )
    project = result.scalar_one_or_none()
    if not project:
        raise HTTPException(status_code=404, detail=f"Project {project_id} not found")
    
    await db.delete(project)
    await db.commit()
    return {"message": f"Project {project_id} deleted"}