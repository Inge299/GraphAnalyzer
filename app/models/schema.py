# app/models/schema.py
"""
Schema models for dynamic node/edge types.
"""
from sqlalchemy import Column, Integer, String, ForeignKey, DateTime, Boolean, JSON
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from sqlalchemy.dialects.postgresql import JSONB

from app.database import Base

class ProjectSchema(Base):
    """Project schema definition."""
    
    __tablename__ = "project_schemas"
    
    id = Column(Integer, primary_key=True, index=True)
    project_id = Column(Integer, ForeignKey("projects.id", ondelete="CASCADE"), nullable=False)
    schema_data = Column(JSONB, nullable=False)  # Full schema definition
    version = Column(Integer, nullable=False, default=1)
    created_at = Column(DateTime, server_default=func.now(), nullable=False)
    
    # Relationships - исправлено: убираем back_populates="schema" так как его нет в Project
    project = relationship("Project", back_populates="schemas")
    node_types = relationship("NodeType", back_populates="schema", cascade="all, delete-orphan")
    edge_types = relationship("EdgeType", back_populates="schema", cascade="all, delete-orphan")


class NodeType(Base):
    """Cached node type definitions."""
    
    __tablename__ = "node_types"
    
    id = Column(Integer, primary_key=True, index=True)
    project_id = Column(Integer, ForeignKey("projects.id", ondelete="CASCADE"), nullable=False)
    schema_id = Column(Integer, ForeignKey("project_schemas.id", ondelete="CASCADE"), nullable=False)
    name = Column(String(100), nullable=False)
    attributes = Column(JSONB, nullable=False)  # List of attribute definitions
    color = Column(String(50), nullable=True)
    icon = Column(String(50), nullable=True)
    created_at = Column(DateTime, server_default=func.now(), nullable=False)
    
    # Relationships
    project = relationship("Project", back_populates="node_types")
    schema = relationship("ProjectSchema", back_populates="node_types")


class EdgeType(Base):
    """Cached edge type definitions."""
    
    __tablename__ = "edge_types"
    
    id = Column(Integer, primary_key=True, index=True)
    project_id = Column(Integer, ForeignKey("projects.id", ondelete="CASCADE"), nullable=False)
    schema_id = Column(Integer, ForeignKey("project_schemas.id", ondelete="CASCADE"), nullable=False)
    name = Column(String(100), nullable=False)
    source_types = Column(JSONB, nullable=False)  # List of allowed source node types
    target_types = Column(JSONB, nullable=False)  # List of allowed target node types
    attributes = Column(JSONB, nullable=False)  # List of attribute definitions
    color = Column(String(50), nullable=True)
    created_at = Column(DateTime, server_default=func.now(), nullable=False)
    
    # Relationships
    project = relationship("Project", back_populates="edge_types")
    schema = relationship("ProjectSchema", back_populates="edge_types")