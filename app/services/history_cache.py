# app/services/history_cache.py
"""
Redis cache for graph history to speed up undo/redo operations.
"""
import redis.asyncio as redis
import json
from typing import List, Optional, Dict, Any
import logging
from fastapi import Depends

from app.config import settings

logger = logging.getLogger(__name__)

# Глобальный клиент Redis (создается при старте)
redis_client = None

async def get_redis_client():
    """Dependency to get Redis client."""
    global redis_client
    if redis_client is None:
        redis_client = await redis.from_url(
            settings.REDIS_URL,
            encoding="utf-8",
            decode_responses=True
        )
    return redis_client

class HistoryCache:
    """
    Caches recent actions for fast undo/redo.
    Uses Redis list to store last N actions per graph.
    """
    
    def __init__(self, redis_client, max_actions: int = 100):
        """
        Initialize cache.
        
        Args:
            redis_client: Redis async client
            max_actions: Maximum number of actions to cache per graph
        """
        self.redis = redis_client
        self.max_actions = max_actions
    
    def _get_key(self, graph_id: int) -> str:
        """Get Redis key for graph."""
        return f"graph:{graph_id}:actions"
    
    async def push_action(self, graph_id: int, action: Dict[str, Any]):
        """
        Push a single action to cache.
        
        Args:
            graph_id: Graph ID
            action: Action dictionary
        """
        try:
            key = self._get_key(graph_id)
            await self.redis.lpush(key, json.dumps(action))
            await self.redis.ltrim(key, 0, self.max_actions - 1)
            logger.debug(f"Pushed action to cache for graph {graph_id}")
        except Exception as e:
            logger.error(f"Failed to push action to cache: {e}")
    
    async def push_many(self, graph_id: int, actions: List[Dict[str, Any]]):
        """
        Push multiple actions to cache (for initial load).
        
        Args:
            graph_id: Graph ID
            actions: List of action dictionaries
        """
        try:
            if not actions:
                return
            
            key = self._get_key(graph_id)
            
            # Очищаем старый кэш
            await self.redis.delete(key)
            
            # Добавляем новые действия (в обратном порядке для сохранения сортировки)
            for action in reversed(actions):
                await self.redis.lpush(key, json.dumps(action))
            
            # Обрезаем до лимита
            await self.redis.ltrim(key, 0, self.max_actions - 1)
            
            logger.debug(f"Pushed {len(actions)} actions to cache for graph {graph_id}")
        except Exception as e:
            logger.error(f"Failed to push many actions to cache: {e}")
    
    async def get_recent(self, graph_id: int, count: int = 50) -> List[Dict[str, Any]]:
        """
        Get recent actions from cache.
        
        Args:
            graph_id: Graph ID
            count: Number of actions to retrieve
            
        Returns:
            List of action dictionaries (most recent first)
        """
        try:
            key = self._get_key(graph_id)
            actions = await self.redis.lrange(key, 0, count - 1)
            return [json.loads(a) for a in actions]
        except Exception as e:
            logger.error(f"Failed to get recent actions from cache: {e}")
            return []
    
    async def get_last_action(self, graph_id: int) -> Optional[Dict[str, Any]]:
        """Get the most recent action."""
        actions = await self.get_recent(graph_id, 1)
        return actions[0] if actions else None
    
    async def clear(self, graph_id: int):
        """Clear cache for graph."""
        try:
            key = self._get_key(graph_id)
            await self.redis.delete(key)
            logger.debug(f"Cleared cache for graph {graph_id}")
        except Exception as e:
            logger.error(f"Failed to clear cache: {e}")
    
    async def get_stats(self, graph_id: int) -> Dict[str, Any]:
        """Get cache statistics."""
        try:
            key = self._get_key(graph_id)
            length = await self.redis.llen(key)
            return {
                "graph_id": graph_id,
                "cached_actions": length,
                "max_actions": self.max_actions
            }
        except Exception as e:
            logger.error(f"Failed to get cache stats: {e}")
            return {"error": str(e)}
