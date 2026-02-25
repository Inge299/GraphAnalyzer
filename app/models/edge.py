"""
Edge model for graph relationships.
"""

from sqlalchemy import Column, Integer, String, JSON, DateTime, ForeignKey, Index
from sqlalchemy.orm import relationship
from datetime import datetime
from app.database import Base

class Edge(Base):
    """Edge in the graph connecting nodes."""

    __tablename__ = "edges"

    id = Column(Integer, primary_key=True)
    graph_id = Column(Integer, ForeignKey("graphs.id", ondelete="CASCADE"), nullable=False)
    edge_id = Column(String(100), nullable=False)
    source_node = Column(String(100), nullable=False)
    target_node = Column(String(100), nullable=False)
    type = Column(String(100), nullable=False)
    attributes = Column(JSON, nullable=False, default={})

    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    graph = relationship("Graph", back_populates="edges")
    source_node_obj = relationship(
        "Node",
        foreign_keys=[source_node],
        primaryjoin="and_(Node.graph_id==Edge.graph_id, Node.node_id==Edge.source_node)",
        viewonly=True
    )
    target_node_obj = relationship(
        "Node",
        foreign_keys=[target_node],
        primaryjoin="and_(Node.graph_id==Edge.graph_id, Node.node_id==Edge.target_node)",
        viewonly=True
    )

    __table_args__ = (
        Index("ix_edges_graph_id", "graph_id"),
        Index("ix_edges_type", "type"),
        Index("ix_edges_source", "graph_id", "source_node"),
        Index("ix_edges_target", "graph_id", "target_node"),
        Index("ix_edges_graph_edge", "graph_id", "edge_id", unique=True),
    )
