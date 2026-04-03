from fastapi import APIRouter, HTTPException, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from typing import List, Dict, Any, Optional
from pydantic import BaseModel, Field
import logging

from app.database import get_db
from app.models.artifact import Artifact, ArtifactVersion, ArtifactRelation
from app.models.action import GraphAction
from app.services.plugin_service import PluginService
from app.services.plugin_contract import validate_plugin_execution
from app.services.history_cache import HistoryCache, get_redis_client

logger = logging.getLogger(__name__)
router = APIRouter()


class PluginExecuteRequest(BaseModel):
    project_id: int = Field(..., description="Project ID to store output artifacts")
    input_artifact_ids: List[int] = Field(..., description="Input artifact IDs")
    params: Optional[Dict[str, Any]] = Field(default=None)
    context: Optional[Dict[str, Any]] = Field(default=None, description="Selection/runtime context")


class ApplicablePluginsRequest(BaseModel):
    project_id: int = Field(..., description="Project ID")
    artifact_id: int = Field(..., description="Target artifact ID")
    context: Optional[Dict[str, Any]] = Field(default=None, description="Selection/runtime context")


@router.get("/")
async def list_plugins():
    """List all available plugins."""
    service = PluginService()
    return {"plugins": service.list_plugins()}


@router.post("/applicable")
async def list_applicable_plugins(
    request: ApplicablePluginsRequest,
    db: AsyncSession = Depends(get_db),
):
    """List plugins applicable to artifact + current UI selection context."""
    result = await db.execute(
        select(Artifact).where(
            Artifact.id == request.artifact_id,
            Artifact.project_id == request.project_id,
        )
    )
    artifact = result.scalar_one_or_none()
    if artifact is None:
        raise HTTPException(status_code=404, detail="Artifact not found in project")

    service = PluginService()
    all_plugins = service.list_plugins()

    payload = {
        "id": artifact.id,
        "project_id": artifact.project_id,
        "type": artifact.type,
        "name": artifact.name,
        "description": artifact.description,
        "data": artifact.data,
        "metadata": artifact.artifact_metadata,
    }

    applicable: List[Dict[str, Any]] = []
    context = request.context or {}

    for metadata in all_plugins:
        try:
            plugin = service.get_plugin(metadata["id"])
            validate_plugin_execution(
                plugin=plugin,
                input_artifacts=[payload],
                params={},
                context=context,
            )
            applicable.append(metadata)
        except Exception:
            continue

    return {"plugins": applicable}


@router.get("/{plugin_id}")
async def get_plugin(plugin_id: str):
    """Get plugin metadata by ID."""
    service = PluginService()
    try:
        plugin = service.get_plugin(plugin_id)
    except KeyError:
        raise HTTPException(status_code=404, detail="Plugin not found")
    return plugin.to_metadata()


@router.post("/{plugin_id}/execute")
async def execute_plugin(
    plugin_id: str,
    request: PluginExecuteRequest,
    db: AsyncSession = Depends(get_db),
    redis_client=Depends(get_redis_client)
):
    """Execute a plugin and store resulting artifacts."""
    if not request.input_artifact_ids:
        raise HTTPException(status_code=400, detail="input_artifact_ids is required")

    service = PluginService()
    try:
        plugin = service.get_plugin(plugin_id)
    except KeyError:
        raise HTTPException(status_code=404, detail="Plugin not found")

    result = await db.execute(
        select(Artifact).where(
            Artifact.id.in_(request.input_artifact_ids),
            Artifact.project_id == request.project_id
        )
    )
    artifacts = result.scalars().all()

    if len(artifacts) != len(request.input_artifact_ids):
        raise HTTPException(status_code=404, detail="One or more artifacts not found in project")

    if plugin.applicable_to:
        for artifact in artifacts:
            if artifact.type not in plugin.applicable_to:
                raise HTTPException(
                    status_code=400,
                    detail=f"Plugin not applicable to artifact type '{artifact.type}'"
                )

    input_payloads = [
        {
            "id": artifact.id,
            "project_id": artifact.project_id,
            "type": artifact.type,
            "name": artifact.name,
            "description": artifact.description,
            "data": artifact.data,
            "metadata": artifact.artifact_metadata
        }
        for artifact in artifacts
    ]

    try:
        validate_plugin_execution(
            plugin=plugin,
            input_artifacts=input_payloads,
            params=request.params,
            context=request.context,
        )
        execution_params = dict(request.params or {})
        if request.context is not None:
            execution_params["_context"] = request.context
        outputs = await service.execute(plugin_id, input_payloads, execution_params)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error(f"Plugin execution failed: {e}")
        raise HTTPException(status_code=500, detail="Plugin execution failed")

    if not isinstance(outputs, list):
        raise HTTPException(status_code=500, detail="Plugin returned invalid output")

    valid_types = {"graph", "table", "map", "chart", "document"}
    created = []
    updated = []
    cache = HistoryCache(redis_client)

    try:
        output_mode = str((getattr(plugin, "output_strategy", {}) or {}).get("mode", "create_new"))

        if output_mode in {"update_current", "replace_input", "merge_into_current"}:
            if len(outputs) != 1:
                raise HTTPException(status_code=400, detail="Update mode plugin must return exactly one artifact spec")

            spec = outputs[0]
            if not isinstance(spec, dict):
                raise HTTPException(status_code=500, detail="Plugin returned invalid artifact spec")
            if spec.get("type") not in valid_types:
                raise HTTPException(status_code=400, detail="Invalid artifact type from plugin")
            if spec.get("data") is None:
                raise HTTPException(status_code=400, detail="Artifact data is required")

            target = artifacts[0]
            if spec.get("type") != target.type:
                raise HTTPException(status_code=400, detail="Update mode requires matching artifact type")

            latest_version_result = await db.execute(
                select(ArtifactVersion)
                .where(ArtifactVersion.artifact_id == target.id)
                .order_by(ArtifactVersion.version.desc())
                .limit(1)
            )
            latest_version = latest_version_result.scalar_one_or_none()
            current_version = latest_version.version if latest_version else 1
            new_version_value = current_version + 1

            before_state = target.data
            target.data = spec["data"]
            target.name = spec.get("name") or target.name
            target.description = spec.get("description", target.description)
            target.artifact_metadata = {
                **(target.artifact_metadata or {}),
                **(spec.get("metadata") or {}),
                "source_plugin": plugin_id,
            }

            version = ArtifactVersion(
                artifact_id=target.id,
                version=new_version_value,
                data=target.data,
                changed_by=plugin_id
            )
            db.add(version)
            await db.flush()

            action_type = str((getattr(plugin, "output_strategy", {}) or {}).get("history_action", "plugin_execute"))
            action = GraphAction(
                artifact_id=target.id,
                action_type=action_type,
                before_state=before_state,
                after_state=target.data,
                description=f"Plugin {plugin_id} updated artifact",
                user_type="plugin",
                plugin_id=plugin_id
            )
            db.add(action)
            await db.flush()
            await cache.push_action(target.id, action.to_dict())

            updated.append({
                "id": target.id,
                "project_id": target.project_id,
                "type": target.type,
                "name": target.name,
                "description": target.description,
                "data": target.data,
                "metadata": target.artifact_metadata,
                "version": new_version_value
            })
        else:
            for spec in outputs:
                if not isinstance(spec, dict):
                    raise HTTPException(status_code=500, detail="Plugin returned invalid artifact spec")
                if spec.get("type") not in valid_types:
                    raise HTTPException(status_code=400, detail="Invalid artifact type from plugin")
                if not spec.get("name"):
                    raise HTTPException(status_code=400, detail="Artifact name is required")
                if spec.get("data") is None:
                    raise HTTPException(status_code=400, detail="Artifact data is required")

                artifact = Artifact(
                    project_id=request.project_id,
                    type=spec["type"],
                    name=spec["name"],
                    description=spec.get("description"),
                    data=spec["data"],
                    artifact_metadata=spec.get("metadata", {})
                )
                db.add(artifact)
                await db.flush()

                version = ArtifactVersion(
                    artifact_id=artifact.id,
                    version=1,
                    data=artifact.data,
                    changed_by=plugin_id
                )
                db.add(version)

                for src in artifacts:
                    db.add(ArtifactRelation(
                        source_id=src.id,
                        target_id=artifact.id,
                        relation_type="derived_from"
                    ))

                action = GraphAction(
                    artifact_id=artifact.id,
                    action_type="plugin_execute",
                    before_state={},
                    after_state=artifact.data,
                    description=f"Plugin {plugin_id} created artifact",
                    user_type="plugin",
                    plugin_id=plugin_id
                )
                db.add(action)
                await db.flush()

                await cache.push_action(artifact.id, action.to_dict())

                created.append({
                    "id": artifact.id,
                    "project_id": artifact.project_id,
                    "type": artifact.type,
                    "name": artifact.name,
                    "description": artifact.description,
                    "data": artifact.data,
                    "metadata": artifact.artifact_metadata,
                    "version": 1
                })

        await db.commit()
        return {"created": created, "updated": updated}

    except HTTPException:
        await db.rollback()
        raise
    except Exception as e:
        await db.rollback()
        logger.error(f"Failed to persist plugin artifacts: {e}")
        raise HTTPException(status_code=500, detail="Failed to store plugin results")
