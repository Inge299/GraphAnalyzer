# app/models/project.py
"""
Project model for OSINT Graph Analyzer.
"""
from sqlalchemy import Column, Integer, String, DateTime, Text
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

from app.database import Base

class Project(Base):
    """Project model containing multiple artifacts."""
    
    __tablename__ = "projects"
    
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=False)
    description = Column(Text, nullable=True)
    created_at = Column(DateTime, server_default=func.now(), nullable=False)
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now(), nullable=False)
    
    # Relationships
    graphs = relationship("Graph", back_populates="project", cascade="all, delete-orphan")
    artifacts = relationship("Artifact", back_populates="project", cascade="all, delete-orphan")
    schemas = relationship("ProjectSchema", back_populates="project", cascade="all, delete-orphan")
    node_types = relationship("NodeType", back_populates="project", cascade="all, delete-orphan")
    edge_types = relationship("EdgeType", back_populates="project", cascade="all, delete-orphan")
    
    def __repr__(self):
        return f"<Project id={self.id} name={self.name}>"