# app/models/undone_action.py
"""
UndoneAction model for redo functionality.
Stores actions that were undone to allow redo.
"""
from sqlalchemy import Column, Integer, String, JSON, DateTime, ForeignKey, Index
from sqlalchemy.dialects.postgresql import UUID
from datetime import datetime
import uuid

from app.database import Base

class UndoneAction(Base):
    __tablename__ = "undone_actions"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    artifact_id = Column(Integer, ForeignKey("artifacts.id", ondelete="CASCADE"), nullable=False)

    action_type = Column(String(50), nullable=False)
    before_state = Column(JSON, nullable=False)
    after_state = Column(JSON, nullable=False)
    
    timestamp = Column(DateTime, default=datetime.utcnow, nullable=False)
    description = Column(String(200))
    user_type = Column(String(20), default='user', nullable=False)
    plugin_id = Column(String(100), nullable=True)
    group_id = Column(UUID(as_uuid=True), nullable=True)
    order_index = Column(Integer, nullable=False)

    __table_args__ = (
        Index("ix_undone_actions_artifact_timestamp", "artifact_id", "timestamp"),
        Index("ix_undone_actions_artifact_order", "artifact_id", "order_index"),
    )

    def to_dict(self):
        return {
            "id": str(self.id),
            "artifact_id": self.artifact_id,
            "action_type": self.action_type,
            "before_state": self.before_state,
            "after_state": self.after_state,
            "timestamp": self.timestamp.isoformat() if self.timestamp else None,
            "description": self.description,
            "user_type": self.user_type,
            "plugin_id": self.plugin_id,
            "group_id": str(self.group_id) if self.group_id else None,
            "order_index": self.order_index
        }