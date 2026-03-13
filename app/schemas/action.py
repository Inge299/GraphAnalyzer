# app/schemas/action.py
from pydantic import BaseModel, Field
from typing import Optional, Dict, Any
from uuid import UUID
from datetime import datetime

class GraphActionBase(BaseModel):
    """Base schema for graph actions."""
    action_type: str = Field(..., description="Type of action (add_node, delete_edge, etc.)")
    before_state: Dict[str, Any] = Field(..., description="Complete graph state BEFORE action")
    after_state: Dict[str, Any] = Field(..., description="Complete graph state AFTER action")
    description: str = Field(..., max_length=200, description="Human-readable description")
    user_type: str = Field('user', description="Source of action: 'user' or 'plugin'")
    plugin_id: Optional[str] = Field(None, description="Plugin ID if action came from plugin")
    group_id: Optional[UUID] = Field(None, description="Group ID for batched actions")

class GraphActionCreate(GraphActionBase):
    """Schema for creating a new action."""
    pass

class GraphActionResponse(GraphActionBase):
    """Schema for action response."""
    id: UUID
    artifact_id: int
    timestamp: datetime
    
    class Config:
        from_attributes = True

class UndoResponse(BaseModel):
    """Response for undo operation."""
    action_id: UUID
    artifact_id: int
    state: Dict[str, Any]
    description: str
    timestamp: datetime

class RedoResponse(BaseModel):
    """Response for redo operation."""
    action_id: UUID
    artifact_id: int
    state: Dict[str, Any]
    description: str
    timestamp: datetime