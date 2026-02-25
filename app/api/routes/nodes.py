"""
Node management endpoints.
"""

from fastapi import APIRouter, HTTPException, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, delete
from typing import List, Dict, Any, Optional
import logging
from datetime import datetime
import uuid

from app.database import get_db
from app.models.node import Node
from app.models.edge import Edge
from app.models.graph import Graph
from app.services.schema_service import SchemaService
from app.api.deps import get_graph
from app.core.exceptions import SchemaValidationError

router = APIRouter(prefix="/graphs/{graph_id}/nodes", tags=["nodes"])
logger = logging.getLogger(__name__)

@router.post("")
async def create_node(
    graph_id: int,
    node_data: Dict[str, Any],
    db: AsyncSession = Depends(get_db),
    graph: Graph = Depends(get_graph)
):
    """Create a new node."""
    try:
        # Validate against schema
        schema_service = SchemaService(db)
        await schema_service.validate_node(
            graph.project_id,
            node_data["type"],
            node_data.get("attributes", {})
        )
        
        # Generate node_id if not provided
        if "node_id" not in node_data:
            node_data["node_id"] = str(uuid.uuid4())[:8]
        
        # Check if node_id already exists
        existing = await db.execute(
            select(Node).where(
                Node.graph_id == graph_id,
                Node.node_id == node_data["node_id"]
            )
        )
        if existing.scalar_one_or_none():
            raise HTTPException(status_code=400, detail=f"Node with ID {node_data['node_id']} already exists")
        
        # Create node
        node = Node(
            graph_id=graph_id,
            node_id=node_data["node_id"],
            type=node_data["type"],
            attributes=node_data.get("attributes", {}),
            position_x=node_data.get("position_x"),
            position_y=node_data.get("position_y")
        )
        
        db.add(node)
        await db.commit()
        await db.refresh(node)
        
        return node
    except SchemaValidationError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error(f"Error creating node: {e}")
        await db.rollback()
        raise HTTPException(status_code=500, detail="Internal server error")

@router.post("/batch")
async def batch_create_nodes(
    graph_id: int,
    nodes_data: List[Dict[str, Any]],
    db: AsyncSession = Depends(get_db),
    graph: Graph = Depends(get_graph)
):
    """Batch create multiple nodes (optimized for large imports)."""
    try:
        schema_service = SchemaService(db)
        nodes = []
        node_ids = set()
        
        for node_data in nodes_data:
            # Validate each node
            await schema_service.validate_node(
                graph.project_id,
                node_data["type"],
                node_data.get("attributes", {})
            )
            
            # Generate node_id if not provided
            if "node_id" not in node_data:
                node_data["node_id"] = str(uuid.uuid4())[:8]
            
            # Check for duplicate IDs in batch
            if node_data["node_id"] in node_ids:
                raise HTTPException(
                    status_code=400, 
                    detail=f"Duplicate node_id '{node_data['node_id']}' in batch"
                )
            node_ids.add(node_data["node_id"])
            
            node = Node(
                graph_id=graph_id,
                node_id=node_data["node_id"],
                type=node_data["type"],
                attributes=node_data.get("attributes", {}),
                position_x=node_data.get("position_x"),
                position_y=node_data.get("position_y")
            )
            nodes.append(node)
        
        db.add_all(nodes)
        await db.commit()
        
        return {"status": "success", "count": len(nodes), "nodes": nodes}
    except SchemaValidationError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error(f"Error batch creating nodes: {e}")
        await db.rollback()
        raise HTTPException(status_code=500, detail="Internal server error")

@router.get("")
async def get_nodes(
    graph_id: int,
    type: Optional[str] = None,
    limit: int = 1000,
    offset: int = 0,
    db: AsyncSession = Depends(get_db),
    graph: Graph = Depends(get_graph)
):
    """Get nodes with optional filtering."""
    query = select(Node).where(Node.graph_id == graph_id)
    
    if type:
        query = query.where(Node.type == type)
    
    query = query.limit(limit).offset(offset)
    result = await db.execute(query)
    nodes = result.scalars().all()
    return nodes

@router.get("/{node_id}")
async def get_node(
    graph_id: int,
    node_id: str,
    db: AsyncSession = Depends(get_db),
    graph: Graph = Depends(get_graph)
):
    """Get specific node."""
    result = await db.execute(
        select(Node).where(
            Node.graph_id == graph_id,
            Node.node_id == node_id
        )
    )
    node = result.scalar_one_or_none()
    if not node:
        raise HTTPException(status_code=404, detail="Node not found")
    return node

@router.patch("/{node_id}")
async def update_node(
    graph_id: int,
    node_id: str,
    updates: Dict[str, Any],
    db: AsyncSession = Depends(get_db),
    graph: Graph = Depends(get_graph)
):
    """Update node attributes or position."""
    try:
        # Get current node
        result = await db.execute(
            select(Node).where(
                Node.graph_id == graph_id,
                Node.node_id == node_id
            )
        )
        node = result.scalar_one_or_none()
        if not node:
            raise HTTPException(status_code=404, detail="Node not found")
        
        # Update fields
        if "attributes" in updates:
            # Validate updated attributes against schema
            schema_service = SchemaService(db)
            await schema_service.validate_node(
                graph.project_id,
                node.type,
                {**node.attributes, **updates["attributes"]}
            )
            node.attributes = {**node.attributes, **updates["attributes"]}
        
        if "position_x" in updates:
            node.position_x = updates["position_x"]
        if "position_y" in updates:
            node.position_y = updates["position_y"]
        
        node.updated_at = datetime.utcnow()
        
        await db.commit()
        await db.refresh(node)
        return node
    except SchemaValidationError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error(f"Error updating node: {e}")
        await db.rollback()
        raise HTTPException(status_code=500, detail="Internal server error")

@router.delete("/{node_id}")
async def delete_node(
    graph_id: int,
    node_id: str,
    db: AsyncSession = Depends(get_db),
    graph: Graph = Depends(get_graph)
):
    """Delete node and all its edges."""
    try:
        # Delete edges connected to this node
        await db.execute(
            delete(Edge).where(
                Edge.graph_id == graph_id,
                (Edge.source_node == node_id) | (Edge.target_node == node_id)
            )
        )
        
        # Delete node
        await db.execute(
            delete(Node).where(
                Node.graph_id == graph_id,
                Node.node_id == node_id
            )
        )
        
        await db.commit()
        return {"status": "success", "message": "Node deleted"}
    except Exception as e:
        logger.error(f"Error deleting node: {e}")
        await db.rollback()
        raise HTTPException(status_code=500, detail="Internal server error")