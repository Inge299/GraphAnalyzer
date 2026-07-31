from typing import Any, Dict, List, Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db

from app.services.domain_model_service import (
    delete_edge_type, delete_node_type, get_domain_model, list_edge_types, list_node_types,
    reload_domain_model, save_domain_model, upsert_edge_type, upsert_node_type,
)
from app.services.metadata_bundle_service import export_metadata_bundle, import_metadata_bundle
from app.services.data_provider_registry import get_data_provider, list_data_provider_manifests
from app.data_provider_sdk import DataProviderContractError
from app.services.reference_provider_registry import (
    get_reference_provider, list_reference_providers, reload_reference_providers, save_reference_provider,
)

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
    identity_attribute: str = ""
    default_visual: Dict[str, Any] = Field(default_factory=dict)
    attributes: List[AttributeDefinitionPayload] = Field(default_factory=list)

class EdgeTypePayload(BaseModel):
    id: str
    label: str
    from_type: str = ""
    to_type: str = ""
    supports_reverse: bool = False
    attributes: List[AttributeDefinitionPayload] = Field(default_factory=list)
    directed: bool = False

class MetadataBundlePayload(BaseModel):
    payload: Dict[str, Any]

class ReferenceProviderPayload(BaseModel):
    name: str
    description: str = ""
    enabled: bool = True
    config: Dict[str, Any] = Field(default_factory=dict)

@router.get("/domain-model", response_model=Dict[str, Any])
async def get_domain_model_config() -> Dict[str, Any]:
    return get_domain_model()

@router.put("/domain-model", response_model=Dict[str, Any])
async def save_domain_model_config(payload: Dict[str, Any]) -> Dict[str, Any]:
    try:
        return save_domain_model(payload)
    except (TypeError, ValueError) as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

@router.post("/domain-model/reload", response_model=Dict[str, Any])
async def reload_domain_model_config() -> Dict[str, Any]:
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

@router.get("/data-providers", response_model=List[Dict[str, Any]])
async def get_data_providers() -> List[Dict[str, Any]]:
    return list_data_provider_manifests()

@router.get("/data-providers/{provider_id}/resources", response_model=List[Dict[str, Any]])
async def get_data_provider_resources(provider_id: str, db: AsyncSession = Depends(get_db)) -> List[Dict[str, Any]]:
    try:
        return await get_data_provider(provider_id).list_resources(db)
    except DataProviderContractError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

@router.post("/data-providers/{provider_id}/resources/{resource_id}/execute", response_model=Dict[str, Any])
async def execute_data_provider_resource(provider_id: str, resource_id: str, params: Dict[str, Any], db: AsyncSession = Depends(get_db)) -> Dict[str, Any]:
    try:
        return await get_data_provider(provider_id).execute(db, resource_id, params)
    except DataProviderContractError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
@router.get("/reference-providers", response_model=List[Dict[str, Any]])
async def get_reference_providers() -> List[Dict[str, Any]]:
    return list_reference_providers()

@router.post("/reference-providers/reload", response_model=List[Dict[str, Any]])
async def reload_reference_provider_config() -> List[Dict[str, Any]]:
    return reload_reference_providers()

@router.put("/reference-providers/{provider_id}", response_model=Dict[str, Any])
async def update_reference_provider(provider_id: str, payload: ReferenceProviderPayload) -> Dict[str, Any]:
    try:
        return save_reference_provider(provider_id, payload.model_dump())
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

@router.get("/domain-model/node-types", response_model=List[Dict[str, Any]])
async def get_domain_model_node_types() -> List[Dict[str, Any]]:
    return list_node_types()

@router.post("/domain-model/node-types", response_model=Dict[str, Any])
async def save_domain_model_node_type(payload: NodeTypePayload) -> Dict[str, Any]:
    try:
        return upsert_node_type(payload.model_dump())
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

@router.delete("/domain-model/node-types/{node_type_id}", response_model=Dict[str, Any])
async def remove_domain_model_node_type(node_type_id: str) -> Dict[str, Any]:
    try:
        return delete_node_type(node_type_id)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

@router.get("/domain-model/edge-types", response_model=List[Dict[str, Any]])
async def get_domain_model_edge_types() -> List[Dict[str, Any]]:
    return list_edge_types()

@router.post("/domain-model/edge-types", response_model=Dict[str, Any])
async def save_domain_model_edge_type(payload: EdgeTypePayload) -> Dict[str, Any]:
    try:
        return upsert_edge_type(payload.model_dump())
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

@router.delete("/domain-model/edge-types/{edge_type_id}", response_model=Dict[str, Any])
async def remove_domain_model_edge_type(edge_type_id: str) -> Dict[str, Any]:
    try:
        return delete_edge_type(edge_type_id)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
