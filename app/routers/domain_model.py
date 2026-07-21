from typing import Any, Dict, List, Optional

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

from app.services.domain_model_service import (
    delete_edge_type,
    delete_node_type,
    get_domain_model,
    list_edge_types,
    list_node_types,
    reload_domain_model,
    upsert_edge_type,
    upsert_node_type,
)
from app.services.metadata_bundle_service import export_metadata_bundle, import_metadata_bundle

router = APIRouter()


class AttributeDefinitionPayload(BaseModel):
    key: str
    type: str = "string"
    label: Optional[str] = None
    required: bool = False
    multiline: bool = False


class NodeTypePayload(BaseModel):
    id: str
    label: str
    icon: str = "circle"
    default_visual: Dict[str, Any] = Field(default_factory=dict)
    attributes: List[AttributeDefinitionPayload] = Field(default_factory=list)


class EdgeTypePayload(BaseModel):
    id: str
    label: str
    allowed_from: List[str] = Field(default_factory=list)
    allowed_to: List[str] = Field(default_factory=list)
    attributes: List[AttributeDefinitionPayload] = Field(default_factory=list)
    directed: bool = False


class MetadataBundlePayload(BaseModel):
    payload: Dict[str, Any]


@router.get("/domain-model", response_model=Dict[str, Any])
async def get_domain_model_config() -> Dict[str, Any]:
    """Return domain model configuration for node/edge types and rules."""
    return get_domain_model()


@router.post("/domain-model/reload", response_model=Dict[str, Any])
async def reload_domain_model_config() -> Dict[str, Any]:
    """Reload domain model config from disk (for admin/dev use)."""
    return reload_domain_model()


@router.get("/metadata-bundle", response_model=Dict[str, Any])
async def get_metadata_bundle() -> Dict[str, Any]:
    return export_metadata_bundle()


@router.post("/metadata-bundle", response_model=Dict[str, Any])
async def save_metadata_bundle(payload: MetadataBundlePayload) -> Dict[str, Any]:
    try:
        return import_metadata_bundle(payload.payload)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@router.get("/domain-model/node-types", response_model=List[Dict[str, Any]])
async def get_domain_model_node_types() -> List[Dict[str, Any]]:
    """Return configured node types."""
    return list_node_types()


@router.post("/domain-model/node-types", response_model=Dict[str, Any])
async def save_domain_model_node_type(payload: NodeTypePayload) -> Dict[str, Any]:
    """Create or update a node type in the domain model."""
    try:
        return upsert_node_type(payload.model_dump())
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@router.delete("/domain-model/node-types/{node_type_id}", response_model=Dict[str, Any])
async def remove_domain_model_node_type(node_type_id: str) -> Dict[str, Any]:
    """Delete a node type and dependent edge-type bindings from the domain model."""
    try:
        return delete_node_type(node_type_id)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@router.get("/domain-model/edge-types", response_model=List[Dict[str, Any]])
async def get_domain_model_edge_types() -> List[Dict[str, Any]]:
    """Return configured edge types."""
    return list_edge_types()


@router.post("/domain-model/edge-types", response_model=Dict[str, Any])
async def save_domain_model_edge_type(payload: EdgeTypePayload) -> Dict[str, Any]:
    """Create or update an edge type in the domain model."""
    try:
        return upsert_edge_type(payload.model_dump())
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@router.delete("/domain-model/edge-types/{edge_type_id}", response_model=Dict[str, Any])
async def remove_domain_model_edge_type(edge_type_id: str) -> Dict[str, Any]:
    """Delete an edge type from the domain model."""
    try:
        return delete_edge_type(edge_type_id)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
