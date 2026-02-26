# app/models/artifact.py
"""
Artifact models for OSINT Graph Analyzer.
Supports multiple artifact types: graph, table, map, chart, document.
"""
from sqlalchemy import Column, Integer, String, Text, ForeignKey, UniqueConstraint, DateTime
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from datetime import datetime

from app.database import Base

class Artifact(Base):
    """Unified artifact model for all data types."""
    
    __tablename__ = "artifacts"
    
    id = Column(Integer, primary_key=True, index=True)
    project_id = Column(Integer, ForeignKey("projects.id", ondelete="CASCADE"), nullable=False)
    type = Column(String(50), nullable=False)  # 'graph', 'table', 'map', 'chart', 'document'
    name = Column(String(200), nullable=False)
    description = Column(Text, nullable=True)
    
    # JSONB fields for flexible data storage
    data = Column(JSONB, nullable=False)  # Full artifact data
    artifact_metadata = Column(JSONB, nullable=True)  # Переименовано с metadata на artifact_metadata
    
    # Timestamps
    created_at = Column(DateTime, server_default=func.now(), nullable=False)
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now(), nullable=False)
    
    # Relationships
    project = relationship("Project", back_populates="artifacts")
    source_relations = relationship(
        "ArtifactRelation",
        foreign_keys="ArtifactRelation.source_id",
        back_populates="source",
        cascade="all, delete-orphan"
    )
    target_relations = relationship(
        "ArtifactRelation",
        foreign_keys="ArtifactRelation.target_id",
        back_populates="target",
        cascade="all, delete-orphan"
    )
    versions = relationship(
        "ArtifactVersion",
        back_populates="artifact",
        cascade="all, delete-orphan",
        order_by="ArtifactVersion.version.desc()"
    )
    
    def __repr__(self):
        return f"<Artifact id={self.id} type={self.type} name={self.name}>"


class ArtifactRelation(Base):
    """Relationships between artifacts."""
    
    __tablename__ = "artifact_relations"
    
    source_id = Column(Integer, ForeignKey("artifacts.id", ondelete="CASCADE"), primary_key=True)
    target_id = Column(Integer, ForeignKey("artifacts.id", ondelete="CASCADE"), primary_key=True)
    relation_type = Column(String(50), primary_key=True)  # 'derived_from', 'attached_to', 'references'
    created_at = Column(DateTime, server_default=func.now(), nullable=False)
    
    # Relationships
    source = relationship("Artifact", foreign_keys=[source_id], back_populates="source_relations")
    target = relationship("Artifact", foreign_keys=[target_id], back_populates="target_relations")
    
    def __repr__(self):
        return f"<ArtifactRelation {self.source_id} {self.relation_type} {self.target_id}>"


class ArtifactVersion(Base):
    """Version history for artifacts."""
    
    __tablename__ = "artifact_versions"
    
    id = Column(Integer, primary_key=True, index=True)
    artifact_id = Column(Integer, ForeignKey("artifacts.id", ondelete="CASCADE"), nullable=False)
    version = Column(Integer, nullable=False)
    data = Column(JSONB, nullable=False)  # Snapshot of artifact data
    changed_at = Column(DateTime, server_default=func.now(), nullable=False)
    changed_by = Column(String(50), nullable=True)  # 'user' or plugin name
    
    # Relationships
    artifact = relationship("Artifact", back_populates="versions")
    
    __table_args__ = (
        UniqueConstraint('artifact_id', 'version', name='uq_artifact_version'),
    )
    
    def __repr__(self):
        return f"<ArtifactVersion artifact={self.artifact_id} version={self.version}>"