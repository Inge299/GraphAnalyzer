"""
Graph management endpoints (legacy, use projects/{id}/graphs instead).
"""

from fastapi import APIRouter, HTTPException, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from typing import Optional
import logging

from app.database import get_db
from app.models.graph import Graph

router = APIRouter(prefix="/graphs", tags=["graphs"])
logger = logging.getLogger(__name__)

@router.get("")
async def get_all_graphs(
    skip: int = 0,
    limit: int = 100,
    db: AsyncSession = Depends(get_db)
):
    """Get all graphs."""
    result = await db.execute(
        select(Graph).offset(skip).limit(limit)
    )
    return result.scalars().all()

@router.get("/{graph_id}")
async def get_graph(
    graph_id: int,
    db: AsyncSession = Depends(get_db)
):
    """Get a specific graph."""
    result = await db.execute(
        select(Graph).where(Graph.id == graph_id)
    )
    graph = result.scalar_one_or_none()
    if not graph:
        raise HTTPException(status_code=404, detail=f"Graph {graph_id} not found")
    return graph

@router.delete("/{graph_id}")
async def delete_graph(
    graph_id: int,
    db: AsyncSession = Depends(get_db)
):
    """Delete a graph."""
    result = await db.execute(
        select(Graph).where(Graph.id == graph_id)
    )
    graph = result.scalar_one_or_none()
    if not graph:
        raise HTTPException(status_code=404, detail=f"Graph {graph_id} not found")
    
    await db.delete(graph)
    await db.commit()
    return {"message": f"Graph {graph_id} deleted"}
