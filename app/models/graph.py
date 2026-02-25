"""
Graph model - container for nodes and edges.
"""

from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, Index
from sqlalchemy.orm import relationship
from datetime import datetime
from app.database import Base

class Graph(Base):
    """Graph model - container for nodes and edges."""

    __tablename__ = "graphs"

    id = Column(Integer, primary_key=True)
    project_id = Column(Integer, ForeignKey("projects.id", ondelete="CASCADE"), nullable=False)
    name = Column(String(200), nullable=False)
    description = Column(String(500))
    version = Column(Integer, default=1)

    # Locks for concurrent access
    locked_by = Column(Integer, nullable=True)
    locked_at = Column(DateTime)
    lock_expires = Column(DateTime)

    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    project = relationship("Project", back_populates="graphs")
    nodes = relationship("Node", back_populates="graph", cascade="all, delete-orphan")
    edges = relationship("Edge", back_populates="graph", cascade="all, delete-orphan")

    __table_args__ = (
        Index("ix_graphs_project", "project_id"),
    )
