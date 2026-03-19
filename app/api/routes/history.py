# app/api/routes/history.py
"""
History management endpoints for undo/redo functionality.
"""
from fastapi import APIRouter, HTTPException, Depends, Query, Request
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, desc, and_, func
from typing import List, Optional
import uuid
import logging
import json
import traceback
from pydantic import ValidationError

from app.database import get_db
from app.models.action import GraphAction
from app.models.artifact import Artifact
from app.schemas.action import GraphActionCreate, GraphActionResponse, UndoResponse, RedoResponse
from app.api.deps import get_artifact
from app.services.history_cache import HistoryCache, get_redis_client

# Исправленный префикс - без /api/v2, так как в main.py добавляется /api/v2
router = APIRouter(prefix="/artifacts/{artifact_id}/history", tags=["history"])
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
    Returns actions sorted by timestamp (newest first).
    """
    try:
        # Сначала пробуем получить из кэша Redis
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

        # Кэшируем результат для будущих запросов
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
    request: Request,
    db: AsyncSession = Depends(get_db),
    artifact: Artifact = Depends(get_artifact),
    redis_client = Depends(get_redis_client)
):
    """
    Record a new action in history.
    All actions are stored permanently for undo/redo functionality.
    """
    try:
        # Логируем полученные данные
        print("\n" + "="*80)
        print("🔵 RECEIVED ACTION REQUEST")
        print("="*80)
        print(f"Artifact ID: {artifact_id}")
        print(f"Action type: {action_data.action_type}")
        print(f"Description: {action_data.description}")
        print(f"User type: {action_data.user_type}")
        print(f"Plugin ID: {action_data.plugin_id}")
        print(f"Group ID: {action_data.group_id}")
        print("\n📦 BEFORE STATE:")
        print(f"  Type: {type(action_data.before_state)}")
        print(f"  Has nodes: {'nodes' in action_data.before_state if action_data.before_state else False}")
        print(f"  Has edges: {'edges' in action_data.before_state if action_data.before_state else False}")
        if action_data.before_state and 'nodes' in action_data.before_state:
            print(f"  Nodes count: {len(action_data.before_state['nodes'])}")
        if action_data.before_state and 'edges' in action_data.before_state:
            print(f"  Edges count: {len(action_data.before_state['edges'])}")
        
        print("\n📦 AFTER STATE:")
        print(f"  Type: {type(action_data.after_state)}")
        print(f"  Has nodes: {'nodes' in action_data.after_state if action_data.after_state else False}")
        print(f"  Has edges: {'edges' in action_data.after_state if action_data.after_state else False}")
        if action_data.after_state and 'nodes' in action_data.after_state:
            print(f"  Nodes count: {len(action_data.after_state['nodes'])}")
        if action_data.after_state and 'edges' in action_data.after_state:
            print(f"  Edges count: {len(action_data.after_state['edges'])}")
        print("="*80 + "\n")

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

        logger.info(f"✅ Recorded action {db_action.id} for artifact {artifact_id}: {db_action.description}")
        return db_action.to_dict()
        
    except ValidationError as e:
        # Детальное логирование ошибки валидации
        print("\n" + "!"*80)
        print("❌ VALIDATION ERROR")
        print("!"*80)
        print("Error details:")
        print(json.dumps(e.errors(), indent=2, ensure_ascii=False))
        
        # Логируем сырые данные запроса
        try:
            body = await request.body()
            print("\nRaw request body:")
            print(body.decode('utf-8')[:1000])  # Первые 1000 символов
        except:
            print("Could not read request body")
        
        print("!"*80 + "\n")
        raise HTTPException(status_code=422, detail=e.errors())
        
    except Exception as e:
        print("\n" + "!"*80)
        print("❌ UNEXPECTED ERROR")
        print("!"*80)
        traceback.print_exc()
        print("!"*80 + "\n")
        logger.error(f"❌ Error recording action for artifact {artifact_id}: {e}")
        await db.rollback()
        raise HTTPException(status_code=500, detail=f"Failed to record action: {str(e)}")

# ============================================================================
# Undo операция
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
    Returns the state to revert to (before_state of the action that would bring us back one step).
    Does NOT delete the action - keeps full history.
    """
    try:
        print(f"\n🔄 UNDO requested for artifact {artifact_id}")
        
        # Получаем ВСЕ действия для этого артефакта, отсортированные по времени (старые первые)
        result = await db.execute(
            select(GraphAction)
            .where(GraphAction.artifact_id == artifact_id)
            .order_by(GraphAction.timestamp)  # По возрастанию (старые первые)
        )
        all_actions = result.scalars().all()
        
        if not all_actions:
            print(f"❌ No actions to undo for artifact {artifact_id}")
            raise HTTPException(status_code=404, detail="No actions to undo")
        
        print(f"Found {len(all_actions)} actions")
        
        # Если есть только одно действие - отменяем его до начального состояния
        if len(all_actions) == 1:
            action = all_actions[0]
            print(f"Single action undo: {action.id}")
            return {
                "action_id": action.id,
                "artifact_id": artifact_id,
                "state": action.before_state,
                "description": f"Undo: {action.description}",
                "timestamp": action.timestamp
            }
        
        # Если действий больше одного - отменяем последнее действие
        second_last_action = all_actions[-2]  # Предпоследнее действие
        last_action = all_actions[-1]  # Последнее действие
        
        print(f"Undo last action {last_action.id}, returning to state after action {second_last_action.id}")
        
        return {
            "action_id": last_action.id,
            "artifact_id": artifact_id,
            "state": second_last_action.after_state,  # Важно! after_state предпоследнего действия
            "description": f"Undo: {last_action.description}",
            "timestamp": last_action.timestamp
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error undoing action for artifact {artifact_id}: {e}")
        raise HTTPException(status_code=500, detail="Failed to undo action")

# ============================================================================
# Redo операция
# ============================================================================

@router.post("/redo", response_model=RedoResponse)
async def redo_action(
    artifact_id: int,
    db: AsyncSession = Depends(get_db),
    artifact: Artifact = Depends(get_artifact),
    redis_client = Depends(get_redis_client)
):
    """
    Redo the last undone action.
    Returns the state to reapply (after_state of the last action).
    """
    try:
        print(f"\n🔴 REDO requested for artifact {artifact_id}")
        
        # Получаем ВСЕ действия для этого артефакта
        result = await db.execute(
            select(GraphAction)
            .where(GraphAction.artifact_id == artifact_id)
            .order_by(GraphAction.timestamp)
        )
        all_actions = result.scalars().all()
        
        if not all_actions:
            print(f"❌ No actions to redo for artifact {artifact_id}")
            raise HTTPException(status_code=404, detail="No actions to redo")
        
        # Для redo возвращаем after_state последнего действия
        last_action = all_actions[-1]
        
        print(f"Redo last action: {last_action.id}")
        
        return {
            "action_id": last_action.id,
            "artifact_id": artifact_id,
            "state": last_action.after_state,
            "description": f"Redo: {last_action.description}",
            "timestamp": last_action.timestamp
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

# ============================================================================
# Получение количества действий
# ============================================================================

@router.get("/count")
async def get_actions_count(
    artifact_id: int,
    db: AsyncSession = Depends(get_db),
    artifact: Artifact = Depends(get_artifact)
):
    """
    Get total number of actions for an artifact.
    """
    result = await db.execute(
        select(func.count())
        .where(GraphAction.artifact_id == artifact_id)
    )
    count = result.scalar()
    
    return {"artifact_id": artifact_id, "total_actions": count}