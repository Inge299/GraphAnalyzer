"""
Edge management endpoints.
"""

from fastapi import APIRouter, HTTPException, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, delete
from typing import List, Dict, Any, Optional
import logging
import uuid

from app.database import get_db
from app.models.edge import Edge
from app.models.node import Node
from app.models.graph import Graph
from app.services.schema_service import SchemaService
from app.api.deps import get_graph
from app.core.exceptions import SchemaValidationError

router = APIRouter(prefix="/graphs/{graph_id}/edges", tags=["edges"])
logger = logging.getLogger(__name__)

@router.post("")
async def create_edge(
    graph_id: int,
    edge_data: Dict[str, Any],
    db: AsyncSession = Depends(get_db),
    graph: Graph = Depends(get_graph)
):
    """Create a new edge."""
    try:
        # Get source and target node types
        nodes_result = await db.execute(
            select(Node).where(
                Node.graph_id == graph_id,
                Node.node_id.in_([edge_data["source_node"], edge_data["target_node"]])
            )
        )
        nodes = nodes_result.scalars().all()
        node_types = {node.node_id: node.type for node in nodes}
        
        if edge_data["source_node"] not in node_types:
            raise HTTPException(status_code=400, detail=f"Source node {edge_data['source_node']} not found")
        if edge_data["target_node"] not in node_types:
            raise HTTPException(status_code=400, detail=f"Target node {edge_data['target_node']} not found")
        
        # Validate against schema
        schema_service = SchemaService(db)
        await schema_service.validate_edge(
            graph.project_id,
            edge_data["type"],
            node_types[edge_data["source_node"]],
            node_types[edge_data["target_node"]],
            edge_data.get("attributes", {})
        )
        
        # Generate edge_id if not provided
        if "edge_id" not in edge_data:
            edge_data["edge_id"] = str(uuid.uuid4())[:8]
        
        # Create edge
        edge = Edge(
            graph_id=graph_id,
            edge_id=edge_data["edge_id"],
            source_node=edge_data["source_node"],
            target_node=edge_data["target_node"],
            type=edge_data["type"],
            attributes=edge_data.get("attributes", {})
        )
        
        db.add(edge)
        await db.commit()
        await db.refresh(edge)
        return edge
    except SchemaValidationError as e:
        raise HTTPException(status_code=400, detail=str(e))

@router.post("/batch")
async def batch_create_edges(
    graph_id: int,
    edges_data: List[Dict[str, Any]],
    db: AsyncSession = Depends(get_db),
    graph: Graph = Depends(get_graph)
):
    """Batch create multiple edges."""
    try:
        # Get all nodes in graph
        nodes_result = await db.execute(
            select(Node).where(Node.graph_id == graph_id)
        )
        nodes = nodes_result.scalars().all()
        node_types = {node.node_id: node.type for node in nodes}
        
        schema_service = SchemaService(db)
        edges = []
        
        for edge_data in edges_data:
            # Check nodes exist
            if edge_data["source_node"] not in node_types:
                raise HTTPException(status_code=400, detail=f"Source node {edge_data['source_node']} not found")
            if edge_data["target_node"] not in node_types:
                raise HTTPException(status_code=400, detail=f"Target node {edge_data['target_node']} not found")
            
            # Validate against schema
            await schema_service.validate_edge(
                graph.project_id,
                edge_data["type"],
                node_types[edge_data["source_node"]],
                node_types[edge_data["target_node"]],
                edge_data.get("attributes", {})
            )
            
            # Generate edge_id if not provided
            if "edge_id" not in edge_data:
                edge_data["edge_id"] = str(uuid.uuid4())[:8]
            
            edge = Edge(
                graph_id=graph_id,
                edge_id=edge_data["edge_id"],
                source_node=edge_data["source_node"],
                target_node=edge_data["target_node"],
                type=edge_data["type"],
                attributes=edge_data.get("attributes", {})
            )
            edges.append(edge)
        
        db.add_all(edges)
        await db.commit()
        return {"status": "success", "count": len(edges)}
    except SchemaValidationError as e:
        raise HTTPException(status_code=400, detail=str(e))

@router.get("")
async def get_edges(
    graph_id: int,
    type: Optional[str] = None,
    source_node: Optional[str] = None,
    target_node: Optional[str] = None,
    limit: int = 1000,
    offset: int = 0,
    db: AsyncSession = Depends(get_db),
    graph: Graph = Depends(get_graph)
):
    """Get edges with optional filtering."""
    query = select(Edge).where(Edge.graph_id == graph_id)
    
    if type:
        query = query.where(Edge.type == type)
    if source_node:
        query = query.where(Edge.source_node == source_node)
    if target_node:
        query = query.where(Edge.target_node == target_node)
    
    query = query.limit(limit).offset(offset)
    result = await db.execute(query)
    return result.scalars().all()

@router.get("/{edge_id}")
async def get_edge(
    graph_id: int,
    edge_id: str,
    db: AsyncSession = Depends(get_db),
    graph: Graph = Depends(get_graph)
):
    """Get specific edge."""
    result = await db.execute(
        select(Edge).where(
            Edge.graph_id == graph_id,
            Edge.edge_id == edge_id
        )
    )
    edge = result.scalar_one_or_none()
    if not edge:
        raise HTTPException(status_code=404, detail="Edge not found")
    return edge

@router.patch("/{edge_id}")
async def update_edge(
    graph_id: int,
    edge_id: str,
    updates: Dict[str, Any],
    db: AsyncSession = Depends(get_db),
    graph: Graph = Depends(get_graph)
):
    """Update edge attributes."""
    result = await db.execute(
        select(Edge).where(
            Edge.graph_id == graph_id,
            Edge.edge_id == edge_id
        )
    )
    edge = result.scalar_one_or_none()
    if not edge:
        raise HTTPException(status_code=404, detail="Edge not found")
    
    if "attributes" in updates:
        edge.attributes = {**edge.attributes, **updates["attributes"]}
    
    await db.commit()
    await db.refresh(edge)
    return edge

@router.delete("/{edge_id}")
async def delete_edge(
    graph_id: int,
    edge_id: str,
    db: AsyncSession = Depends(get_db),
    graph: Graph = Depends(get_graph)
):
    """Delete an edge."""
    await db.execute(
        delete(Edge).where(
            Edge.graph_id == graph_id,
            Edge.edge_id == edge_id
        )
    )
    await db.commit()
    return {"status": "success", "message": "Edge deleted"}
