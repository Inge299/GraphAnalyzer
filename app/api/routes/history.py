# app/api/routes/history.py
"""
History management endpoints for undo/redo functionality.
"""
from fastapi import APIRouter, HTTPException, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, desc, and_
from typing import List, Optional
import uuid
import logging

from app.database import get_db
from app.models.action import GraphAction
from app.models.artifact import Artifact
from app.schemas.action import GraphActionCreate, GraphActionResponse, UndoResponse, RedoResponse
from app.api.deps import get_artifact
from app.services.history_cache import HistoryCache, get_redis_client

router = APIRouter(prefix="/api/v2/artifacts/{artifact_id}/history", tags=["history"])
logger = logging.getLogger(__name__)

# ============================================================================
# Получение истории
# ============================================================================

@router.get("", response_model=List[GraphActionResponse])
async def get_history(
    artifact_id: int,
    limit: int = Query(50, ge=1, le=200, description="Number of actions to return"),
    offset: int = Query(0, ge=0, description="Offset for pagination"),
    db: AsyncSession = Depends(get_db),
    artifact: Artifact = Depends(get_artifact),
    redis_client = Depends(get_redis_client)
):
    """
    Get action history for a graph artifact.
    """
    try:
        # Пытаемся получить из кэша Redis
        cache = HistoryCache(redis_client)
        
        if offset == 0 and limit <= 100:
            cached_actions = await cache.get_recent(artifact_id, limit)
            if cached_actions:
                logger.debug(f"Returning {len(cached_actions)} actions from cache for artifact {artifact_id}")
                return cached_actions
        
        # Если нет в кэше или нужна пагинация - идем в БД
        result = await db.execute(
            select(GraphAction)
            .where(GraphAction.artifact_id == artifact_id)
            .order_by(desc(GraphAction.timestamp))
            .limit(limit)
            .offset(offset)
        )
        actions = result.scalars().all()
        
        # Кэшируем результат
        if offset == 0 and actions:
            await cache.push_many(artifact_id, [a.to_dict() for a in actions])
        
        return [action.to_dict() for action in actions]
    except Exception as e:
        logger.error(f"Error getting history for artifact {artifact_id}: {e}")
        raise HTTPException(status_code=500, detail="Failed to get history")

# ============================================================================
# Запись действий
# ============================================================================

@router.post("/actions", response_model=GraphActionResponse, status_code=201)
async def record_action(
    artifact_id: int,
    action_data: GraphActionCreate,
    db: AsyncSession = Depends(get_db),
    artifact: Artifact = Depends(get_artifact),
    redis_client = Depends(get_redis_client)
):
    """
    Record a new action in history.
    """
    try:
        # Создаем запись в БД
        db_action = GraphAction(
            artifact_id=artifact_id,
            action_type=action_data.action_type,
            before_state=action_data.before_state,
            after_state=action_data.after_state,
            description=action_data.description,
            user_type=action_data.user_type,
            plugin_id=action_data.plugin_id,
            group_id=action_data.group_id or uuid.uuid4()
        )
        
        db.add(db_action)
        await db.commit()
        await db.refresh(db_action)
        
        # Обновляем кэш
        cache = HistoryCache(redis_client)
        await cache.push_action(artifact_id, db_action.to_dict())
        
        logger.info(f"Recorded action {db_action.id} for artifact {artifact_id}: {db_action.description}")
        return db_action.to_dict()
    except Exception as e:
        logger.error(f"Error recording action for artifact {artifact_id}: {e}")
        await db.rollback()
        raise HTTPException(status_code=500, detail="Failed to record action")

# ============================================================================
# Undo / Redo операции
# ============================================================================

@router.post("/undo", response_model=UndoResponse)
async def undo_action(
    artifact_id: int,
    db: AsyncSession = Depends(get_db),
    artifact: Artifact = Depends(get_artifact),
    redis_client = Depends(get_redis_client)
):
    """
    Undo the last action.
    """
    try:
        result = await db.execute(
            select(GraphAction)
            .where(GraphAction.artifact_id == artifact_id)
            .order_by(desc(GraphAction.timestamp))
            .limit(1)
        )
        action = result.scalar_one_or_none()
        
        if not action:
            raise HTTPException(status_code=404, detail="No actions to undo")
        
        logger.info(f"Undo action {action.id} for artifact {artifact_id}: {action.description}")
        
        return {
            "action_id": action.id,
            "artifact_id": artifact_id,
            "state": action.before_state,
            "description": f"Undo: {action.description}",
            "timestamp": action.timestamp
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error undoing action for artifact {artifact_id}: {e}")
        raise HTTPException(status_code=500, detail="Failed to undo action")

@router.post("/redo", response_model=RedoResponse)
async def redo_action(
    artifact_id: int,
    db: AsyncSession = Depends(get_db),
    artifact: Artifact = Depends(get_artifact),
    redis_client = Depends(get_redis_client)
):
    """
    Redo the last undone action.
    """
    try:
        result = await db.execute(
            select(GraphAction)
            .where(GraphAction.artifact_id == artifact_id)
            .order_by(desc(GraphAction.timestamp))
            .limit(1)
        )
        action = result.scalar_one_or_none()
        
        if not action:
            raise HTTPException(status_code=404, detail="No actions to redo")
        
        logger.info(f"Redo action {action.id} for artifact {artifact_id}: {action.description}")
        
        return {
            "action_id": action.id,
            "artifact_id": artifact_id,
            "state": action.after_state,
            "description": f"Redo: {action.description}",
            "timestamp": action.timestamp
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error redoing action for artifact {artifact_id}: {e}")
        raise HTTPException(status_code=500, detail="Failed to redo action")

# ============================================================================
# Получение конкретного действия
# ============================================================================

@router.get("/actions/{action_id}", response_model=GraphActionResponse)
async def get_action(
    artifact_id: int,
    action_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    artifact: Artifact = Depends(get_artifact)
):
    """
    Get a specific action by ID.
    """
    result = await db.execute(
        select(GraphAction)
        .where(
            and_(
                GraphAction.artifact_id == artifact_id,
                GraphAction.id == action_id
            )
        )
    )
    action = result.scalar_one_or_none()
    
    if not action:
        raise HTTPException(status_code=404, detail="Action not found")
    
    return action.to_dict()