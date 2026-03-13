# app/models/action.py
"""
Action model for undo/redo functionality.
Stores all user and plugin actions for graph artifacts.
"""
from sqlalchemy import Column, Integer, String, JSON, DateTime, ForeignKey, Index
from sqlalchemy.dialects.postgresql import UUID
from datetime import datetime
import uuid

from app.database import Base

class GraphAction(Base):
    __tablename__ = "graph_actions"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    artifact_id = Column(Integer, ForeignKey("artifacts.id", ondelete="CASCADE"), nullable=False)
    
    # Тип действия
    action_type = Column(String(50), nullable=False)  # 'add_node', 'delete_edge', 'move_node', etc.
    
    # Состояния (полное состояние графа ДО и ПОСЛЕ)
    before_state = Column(JSON, nullable=False)
    after_state = Column(JSON, nullable=False)
    
    # Метаданные
    timestamp = Column(DateTime, default=datetime.utcnow, nullable=False)
    user_type = Column(String(20), default='user')  # 'user' или 'plugin'
    description = Column(String(200))
    plugin_id = Column(String(100), nullable=True)
    
    # Для группировки последовательных действий
    group_id = Column(UUID(as_uuid=True), nullable=True)
    
    # Индексы для быстрого поиска
    __table_args__ = (
        Index("ix_graph_actions_artifact_timestamp", "artifact_id", "timestamp"),
        Index("ix_graph_actions_group", "group_id"),
        Index("ix_graph_actions_artifact_id", "artifact_id"),
    )
    
    def __repr__(self):
        return f"<GraphAction id={self.id} type={self.action_type} artifact={self.artifact_id}>"
    
    def to_dict(self):
        """Convert action to dictionary for API responses."""
        return {
            "id": str(self.id),
            "artifact_id": self.artifact_id,
            "action_type": self.action_type,
            "before_state": self.before_state,
            "after_state": self.after_state,
            "timestamp": self.timestamp.isoformat() if self.timestamp else None,
            "user_type": self.user_type,
            "description": self.description,
            "plugin_id": self.plugin_id,
            "group_id": str(self.group_id) if self.group_id else None
        }