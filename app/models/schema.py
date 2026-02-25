"""
Schema models for dynamic meta-model system.
"""

from sqlalchemy import Column, Integer, String, JSON, DateTime, ForeignKey, Index
from sqlalchemy.orm import relationship
from datetime import datetime
from app.database import Base

class ProjectSchema(Base):
    """Stores meta-schema for project (node types and edge types)."""

    __tablename__ = "project_schemas"

    id = Column(Integer, primary_key=True)
    project_id = Column(Integer, ForeignKey("projects.id", ondelete="CASCADE"), unique=True)
    schema_data = Column(JSON, nullable=False)
    version = Column(Integer, default=1)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    project = relationship("Project", back_populates="schema")

class NodeType(Base):
    """Cache table for node types."""

    __tablename__ = "node_types"

    id = Column(Integer, primary_key=True)
    project_id = Column(Integer, ForeignKey("projects.id", ondelete="CASCADE"))
    type_key = Column(String(100), nullable=False)
    display_name = Column(String(200))
    color = Column(String(50))
    icon = Column(String(100))
    attribute_definitions = Column(JSON, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)

    # Relationships
    project = relationship("Project", back_populates="node_types")

    __table_args__ = (
        Index("ix_node_types_project_type", "project_id", "type_key", unique=True),
    )

class EdgeType(Base):
    """Cache table for edge types."""

    __tablename__ = "edge_types"

    id = Column(Integer, primary_key=True)
    project_id = Column(Integer, ForeignKey("projects.id", ondelete="CASCADE"))
    type_key = Column(String(100), nullable=False)
    display_name = Column(String(200))
    from_types = Column(JSON, nullable=False)
    to_types = Column(JSON, nullable=False)
    attribute_definitions = Column(JSON, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)

    # Relationships
    project = relationship("Project", back_populates="edge_types")

    __table_args__ = (
        Index("ix_edge_types_project_type", "project_id", "type_key", unique=True),
    )
