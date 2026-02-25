"""
Project model - top level container for graphs and schemas.
"""

from sqlalchemy import Column, Integer, String, DateTime
from sqlalchemy.orm import relationship
from datetime import datetime
from app.database import Base

class Project(Base):
    """Project model - top level container for graphs and schemas."""

    __tablename__ = "projects"

    id = Column(Integer, primary_key=True)
    name = Column(String(200), nullable=False)
    description = Column(String(500))
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    graphs = relationship("Graph", back_populates="project", cascade="all, delete-orphan")
    schema = relationship("ProjectSchema", back_populates="project", uselist=False, cascade="all, delete-orphan")
    node_types = relationship("NodeType", back_populates="project", cascade="all, delete-orphan")
    edge_types = relationship("EdgeType", back_populates="project", cascade="all, delete-orphan")
