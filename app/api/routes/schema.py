"""
Schema management endpoints.
"""

from fastapi import APIRouter, HTTPException, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from typing import Dict, Any
import logging

from app.database import get_db
from app.services.schema_service import SchemaService
from app.models.project import Project
from app.models.schema import NodeType, EdgeType
from app.api.deps import get_project
from app.core.exceptions import SchemaValidationError

router = APIRouter(prefix="/projects/{project_id}/schema", tags=["schema"])
logger = logging.getLogger(__name__)

@router.put("")
async def update_schema(
    project_id: int,
    schema_data: Dict[str, Any],
    db: AsyncSession = Depends(get_db),
    project: Project = Depends(get_project)
):
    """Update project schema."""
    try:
        service = SchemaService(db)
        schema = await service.create_or_update_schema(project_id, schema_data)
        return {
            "status": "success",
            "message": "Schema updated",
            "version": schema.version
        }
    except SchemaValidationError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error(f"Error updating schema: {e}")
        await db.rollback()
        raise HTTPException(status_code=500, detail="Internal server error")

@router.get("")
async def get_schema(
    project_id: int,
    db: AsyncSession = Depends(get_db),
    project: Project = Depends(get_project)
):
    """Get project schema."""
    try:
        service = SchemaService(db)
        schema = await service.get_schema(project_id)
        if not schema:
            raise HTTPException(status_code=404, detail="Schema not found")
        return schema
    except Exception as e:
        logger.error(f"Error getting schema: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")

@router.get("/node-types")
async def get_node_types(
    project_id: int,
    db: AsyncSession = Depends(get_db),
    project: Project = Depends(get_project)
):
    """Get all node types for project."""
    try:
        result = await db.execute(
            select(NodeType).where(NodeType.project_id == project_id)
        )
        types = result.scalars().all()
        return types
    except Exception as e:
        logger.error(f"Error getting node types: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")

@router.get("/edge-types")
async def get_edge_types(
    project_id: int,
    db: AsyncSession = Depends(get_db),
    project: Project = Depends(get_project)
):
    """Get all edge types for project."""
    try:
        result = await db.execute(
            select(EdgeType).where(EdgeType.project_id == project_id)
        )
        types = result.scalars().all()
        return types
    except Exception as e:
        logger.error(f"Error getting edge types: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")