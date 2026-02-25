"""
Node model for graph data.
"""

from sqlalchemy import Column, Integer, String, JSON, DateTime, ForeignKey, Float, Index
from sqlalchemy.orm import relationship
from datetime import datetime
from app.database import Base

class Node(Base):
    """Node in the graph with dynamic attributes."""

    __tablename__ = "nodes"

    id = Column(Integer, primary_key=True)
    graph_id = Column(Integer, ForeignKey("graphs.id", ondelete="CASCADE"), nullable=False)
    node_id = Column(String(100), nullable=False)
    type = Column(String(100), nullable=False)
    attributes = Column(JSON, nullable=False, default={})

    # Position on canvas
    position_x = Column(Float)
    position_y = Column(Float)

    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    graph = relationship("Graph", back_populates="nodes")
    outgoing_edges = relationship(
        "Edge", 
        foreign_keys="[Edge.source_node]", 
        back_populates="source_node_obj",
        primaryjoin="and_(Edge.graph_id==Node.graph_id, Edge.source_node==Node.node_id)"
    )
    incoming_edges = relationship(
        "Edge", 
        foreign_keys="[Edge.target_node]", 
        back_populates="target_node_obj",
        primaryjoin="and_(Edge.graph_id==Node.graph_id, Edge.target_node==Node.node_id)"
    )

    __table_args__ = (
        Index("ix_nodes_graph_id", "graph_id"),
        Index("ix_nodes_type", "type"),
        Index("ix_nodes_graph_node", "graph_id", "node_id", unique=True),
        Index("ix_nodes_position", "graph_id", "position_x", "position_y"),
    )
