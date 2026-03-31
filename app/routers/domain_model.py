from fastapi import APIRouter
from typing import Any, Dict

from app.services.domain_model_service import get_domain_model, reload_domain_model

router = APIRouter()


@router.get("/domain-model", response_model=Dict[str, Any])
async def get_domain_model_config() -> Dict[str, Any]:
    """Return domain model configuration for node/edge types and rules."""
    return get_domain_model()


@router.post("/domain-model/reload", response_model=Dict[str, Any])
async def reload_domain_model_config() -> Dict[str, Any]:
    """Reload domain model config from disk (for admin/dev use)."""
    return reload_domain_model()
