# app/api/routes/console.py
"""Console artifact endpoints and registry for external stored procedures."""

from __future__ import annotations

import json
import logging
from datetime import datetime
from pathlib import Path
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile
from sqlalchemy import select, text
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.api.deps import get_project
from app.database import get_db
from app.models.artifact import Artifact, ArtifactVersion
from app.models.console_registry import (
    ConsoleDataSource,
    ConsoleObjectTypeMapping,
    ConsolePythonPluginSetting,
    ConsoleProcedureProfile,
    ConsoleProcedureParam,
    ConsoleResultColumnMapping,
    ConsoleResultSetMapping,
)
from app.models.project import Project
from app.services.console_execution_service import (
    build_console_execution_context,
    execute_console_procedure,
    resolve_procedure_params,
    test_console_data_source_connection,
)
from app.services.console_artifact_service import (
    build_console_artifact_metadata,
    normalize_console_artifact_data,
)
from app.console_plugins import delete_console_plugin_file, install_console_plugin_file
from app.services.console_executor_registry import (
    get_python_console_executor,
    is_python_console_executor_enabled,
    list_console_executor_descriptors,
    list_python_console_executor_settings,
)
from app.services.console_registry_service import (
    get_console_object_type_mapping_dict,
    get_console_data_source_by_key,
    get_console_profile_by_key,
    list_console_data_sources,
    list_console_object_type_mappings,
    list_console_profiles as list_registered_console_profiles,
    serialize_console_data_source,
    serialize_console_profile,
)

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/projects/{project_id}/console", tags=["console"])
profiles_router = APIRouter(prefix="/console", tags=["console"])

CONFIG_PATH = Path(__file__).resolve().parents[2] / "configuration" / "console_profiles.json"


def _load_legacy_profiles() -> List[Dict[str, Any]]:
    if not CONFIG_PATH.exists():
        return []
    try:
        payload = json.loads(CONFIG_PATH.read_text(encoding="utf-8"))
    except Exception as exc:
        logger.error("Failed to read legacy console profiles: %s", exc)
        return []

    profiles = payload.get("profiles") if isinstance(payload, dict) else None
    if not isinstance(profiles, list):
        return []
    return [item for item in profiles if isinstance(item, dict) and str(item.get("id") or "").strip()]


def _legacy_profile_public(profile: Dict[str, Any]) -> Dict[str, Any]:
    return {
        "id": str(profile.get("id") or "").strip(),
        "key": str(profile.get("id") or "").strip(),
        "name": str(profile.get("name") or "").strip(),
        "description": str(profile.get("description") or "").strip(),
        "kind": "legacy_query",
        "params": profile.get("params") if isinstance(profile.get("params"), list) else [],
        "default_limit": int(profile.get("default_limit") or 200),
        "supports_graph_selection": False,
        "result_sets": [],
    }


def _get_legacy_profile(profile_id: str) -> Optional[Dict[str, Any]]:
    pid = str(profile_id or "").strip()
    if not pid:
        return None
    for profile in _load_legacy_profiles():
        if str(profile.get("id") or "").strip() == pid:
            return profile
    return None


async def _run_postgres_query(db: AsyncSession, query: str, values: Dict[str, Any]) -> List[Dict[str, Any]]:
    query = str(query or "").strip()
    if not query:
        raise RuntimeError("Console profile query is empty")

    result = await db.execute(text(query), values)
    return [dict(row._mapping) for row in result.fetchall()]


def _normalize_legacy_rows(rows: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    normalized_rows: List[Dict[str, Any]] = []
    for row in rows:
        normalized_rows.append(
            {
                key: (value.isoformat() if hasattr(value, "isoformat") else value)
                for key, value in row.items()
            }
        )
    return normalized_rows


def _extract_legacy_columns(rows: List[Dict[str, Any]]) -> List[str]:
    columns: List[str] = []
    for row in rows:
        for key in row.keys():
            key_str = str(key)
            if key_str not in columns:
                columns.append(key_str)
    return columns


def _build_legacy_base_values(profile: Dict[str, Any], payload_params: Dict[str, Any], project_id: int) -> Dict[str, Any]:
    defaults = profile.get("defaults") if isinstance(profile.get("defaults"), dict) else {}
    base_values = {**defaults, **payload_params}
    base_values["project_id"] = project_id
    return base_values


async def _build_legacy_console_tabs(
    db: AsyncSession,
    profile: Dict[str, Any],
    payload_params: Dict[str, Any],
    project_id: int,
) -> List[Dict[str, Any]]:
    base_values = _build_legacy_base_values(profile, payload_params, project_id)
    tabs_spec = profile.get("tabs") if isinstance(profile.get("tabs"), list) else []

    tabs: List[Dict[str, Any]] = []
    if tabs_spec:
        for index, item in enumerate(tabs_spec):
            if not isinstance(item, dict):
                continue
            query = str(item.get("query") or "").strip()
            if not query:
                continue

            tab_defaults = item.get("defaults") if isinstance(item.get("defaults"), dict) else {}
            tab_values = {**base_values, **tab_defaults}

            rows = await _run_postgres_query(db, query, tab_values)
            normalized_rows = _normalize_legacy_rows(rows)
            raw_columns = _extract_legacy_columns(rows)
            columns = [
                {"key": key, "original_name": key, "label": key, "type": "string", "width": None, "visible": True}
                for key in raw_columns
            ]
            tab_id = str(item.get("id") or f"tab_{index + 1}").strip() or f"tab_{index + 1}"
            tab_name = str(item.get("name") or tab_id).strip() or tab_id
            tabs.append(
                {
                    "id": tab_id,
                    "name": tab_name,
                    "columns": columns,
                    "rows": normalized_rows,
                    "row_count": len(normalized_rows),
                }
            )
        return tabs

    rows = await _run_postgres_query(db, str(profile.get("query") or ""), base_values)
    normalized_rows = _normalize_legacy_rows(rows)
    raw_columns = _extract_legacy_columns(rows)
    columns = [
        {"key": key, "original_name": key, "label": key, "type": "string", "width": None, "visible": True}
        for key in raw_columns
    ]
    tab_id = str(profile.get("id") or "main").strip() or "main"
    tab_name = str(profile.get("name") or tab_id).strip() or tab_id
    return [
        {
            "id": tab_id,
            "name": tab_name,
            "columns": columns,
            "rows": normalized_rows,
            "row_count": len(normalized_rows),
        }
    ]


def _parse_positive_int(value: Any, default: int) -> int:
    try:
        parsed = int(value)
    except (TypeError, ValueError):
        return default
    return parsed if parsed > 0 else default


def _apply_object_type_mapping_payload(
    mapping: ConsoleObjectTypeMapping,
    payload: Dict[str, Any],
    *,
    position: int,
) -> None:
    mapping.graph_type = str(payload.get("graph_type") or "").strip()
    mapping.procedure_type = str(payload.get("procedure_type") or "").strip()
    mapping.is_active = bool(payload.get("is_active", True))
    mapping.position = position
    if not mapping.graph_type:
        raise HTTPException(status_code=400, detail="graph_type is required")
    if not mapping.procedure_type:
        raise HTTPException(status_code=400, detail="procedure_type is required")


def _apply_data_source_payload(source: ConsoleDataSource, payload: Dict[str, Any]) -> None:
    source.key = str(payload.get("key") or source.key or "").strip()
    source.name = str(payload.get("name") or source.name or "").strip()
    source.description = payload.get("description")
    source.dbms = str(payload.get("dbms") or source.dbms or "mssql").strip() or "mssql"
    source.driver = str(payload.get("driver") or source.driver or "pymssql").strip() or "pymssql"
    source.host = str(payload.get("host") or source.host or "").strip()
    source.port = _parse_positive_int(payload.get("port"), source.port or 1433)
    source.database_name = str(payload.get("database_name") or source.database_name or "").strip()
    source.auth_type = str(payload.get("auth_type") or source.auth_type or "sql").strip() or "sql"
    source.username = str(payload.get("username") or source.username or "").strip() or None
    if "password" in payload:
        source.password = str(payload.get("password") or "").strip() or None
    source.options_json = payload.get("options") if isinstance(payload.get("options"), dict) else (source.options_json or {})
    source.is_active = bool(payload.get("is_active", source.is_active if source.is_active is not None else True))

    if not source.key:
        raise HTTPException(status_code=400, detail="Data source key is required")
    if not source.name:
        raise HTTPException(status_code=400, detail="Data source name is required")
    if not source.host:
        raise HTTPException(status_code=400, detail="Data source host is required")
    if not source.database_name:
        raise HTTPException(status_code=400, detail="Data source database_name is required")


def _replace_procedure_params(profile: ConsoleProcedureProfile, items: List[Dict[str, Any]]) -> None:
    profile.params.clear()
    for index, item in enumerate(items):
        if not isinstance(item, dict):
            continue
        param_name = str(item.get("name") or item.get("key") or "").strip()
        if not param_name:
            continue
        profile.params.append(
            ConsoleProcedureParam(
                param_name=param_name.lstrip("@"),
                display_name=str(item.get("label") or item.get("display_name") or param_name).strip() or param_name,
                data_type=str(item.get("type") or item.get("data_type") or "string").strip() or "string",
                is_required=bool(item.get("required", False)),
                default_value=None if item.get("default") is None else str(item.get("default")),
                binding_mode=str(item.get("binding_mode") or "manual").strip() or "manual",
                binding_source=str(item.get("binding_source") or "").strip() or None,
                binding_config=item.get("binding_config") if isinstance(item.get("binding_config"), dict) else {},
                position=int(item.get("position") or index),
                is_hidden=bool(item.get("hidden", False)),
            )
        )


def _replace_result_sets(profile: ConsoleProcedureProfile, items: List[Dict[str, Any]]) -> None:
    profile.result_sets.clear()
    for index, item in enumerate(items):
        if not isinstance(item, dict):
            continue
        result_index = int(item.get("result_index") or (index + 1))
        result_set = ConsoleResultSetMapping(
            result_index=result_index,
            result_key=str(item.get("result_key") or item.get("key") or f"result_{result_index}").strip() or f"result_{result_index}",
            display_name=str(item.get("name") or item.get("display_name") or f"Р В Р’В Р В Р’ВµР В Р’В·Р РЋРЎвЂњР В Р’В»Р РЋР Р‰Р РЋРІР‚С™Р В Р’В°Р РЋРІР‚С™ {result_index}").strip() or f"Р В Р’В Р В Р’ВµР В Р’В·Р РЋРЎвЂњР В Р’В»Р РЋР Р‰Р РЋРІР‚С™Р В Р’В°Р РЋРІР‚С™ {result_index}",
            is_visible=bool(item.get("visible", True)),
            position=int(item.get("position") or index),
        )

        columns = item.get("columns") if isinstance(item.get("columns"), list) else []
        for column_index, column_item in enumerate(columns):
            if not isinstance(column_item, dict):
                continue
            column_name = str(column_item.get("name") or column_item.get("key") or column_item.get("original_name") or "").strip()
            if not column_name:
                continue
            result_set.columns.append(
                ConsoleResultColumnMapping(
                    column_name=column_name,
                    display_name=str(column_item.get("label") or column_item.get("display_name") or column_name).strip() or column_name,
                    data_type=str(column_item.get("type") or column_item.get("data_type") or "string").strip() or "string",
                    width=int(column_item["width"]) if column_item.get("width") not in (None, "") else None,
                    is_visible=bool(column_item.get("visible", True)),
                    position=int(column_item.get("position") or column_index),
                )
            )
        profile.result_sets.append(result_set)


def _apply_procedure_payload(profile: ConsoleProcedureProfile, payload: Dict[str, Any], source_id: int) -> None:
    profile.key = str(payload.get("key") or profile.key or "").strip()
    profile.source_id = source_id
    profile.schema_name = str(payload.get("schema_name") or profile.schema_name or "dbo").strip() or "dbo"
    profile.procedure_name = str(payload.get("procedure_name") or profile.procedure_name or "").strip()
    profile.display_name = str(payload.get("name") or payload.get("display_name") or profile.display_name or "").strip()
    profile.description = payload.get("description")
    profile.timeout_seconds = _parse_positive_int(payload.get("timeout_seconds"), profile.timeout_seconds or 120)
    profile.default_row_limit = _parse_positive_int(payload.get("default_limit"), profile.default_row_limit or 200)
    profile.is_active = bool(payload.get("is_active", profile.is_active if profile.is_active is not None else True))
    profile.supports_graph_selection = bool(payload.get("supports_graph_selection", profile.supports_graph_selection if profile.supports_graph_selection is not None else False))
    profile.result_contract_version = _parse_positive_int(payload.get("result_contract_version"), profile.result_contract_version or 1)

    if not profile.key:
        raise HTTPException(status_code=400, detail="Procedure key is required")
    if not profile.procedure_name:
        raise HTTPException(status_code=400, detail="procedure_name is required")
    if not profile.display_name:
        raise HTTPException(status_code=400, detail="Procedure display name is required")

    if "params" in payload:
        _replace_procedure_params(profile, payload.get("params") if isinstance(payload.get("params"), list) else [])
    if "result_sets" in payload:
        _replace_result_sets(profile, payload.get("result_sets") if isinstance(payload.get("result_sets"), list) else [])


async def _get_current_artifact_version(db: AsyncSession, artifact_id: int) -> int:
    result = await db.execute(
        select(ArtifactVersion.version)
        .where(ArtifactVersion.artifact_id == artifact_id)
        .order_by(ArtifactVersion.version.desc())
        .limit(1)
    )
    return result.scalar_one_or_none() or 1


async def _load_console_artifact(db: AsyncSession, project_id: int, artifact_id: int) -> Artifact:
    result = await db.execute(
        select(Artifact).where(
            Artifact.id == artifact_id,
            Artifact.project_id == project_id,
        )
    )
    artifact = result.scalar_one_or_none()
    if not artifact:
        raise HTTPException(status_code=404, detail="Artifact not found")
    if str(artifact.type or "") != "console":
        raise HTTPException(status_code=400, detail="Artifact type must be 'console'")
    return artifact


async def _upsert_derived_artifacts(
    db: AsyncSession,
    *,
    project_id: int,
    source_artifact: Artifact,
    descriptors: Any,
) -> list[Dict[str, Any]]:
    """Persist derived artifacts returned by a console executor.

    The source console is the stable key, so rerunning the plugin updates its
    previous map instead of filling the project with duplicate maps.
    """
    if not isinstance(descriptors, list):
        return []
    created: list[Dict[str, Any]] = []
    for descriptor in descriptors:
        if not isinstance(descriptor, dict) or descriptor.get("type") != "map":
            continue
        name = str(descriptor.get("name") or "").strip()
        data = descriptor.get("data") if isinstance(descriptor.get("data"), dict) else {}
        if not name:
            continue
        result = await db.execute(
            select(Artifact).where(Artifact.project_id == project_id, Artifact.type == "map")
        )
        target = next(
            (
                item
                for item in result.scalars().all()
                if isinstance(item.artifact_metadata, dict)
                and item.artifact_metadata.get("source_console_artifact_id") == source_artifact.id
            ),
            None,
        )
        metadata = {
            "source_console_artifact_id": source_artifact.id,
            "source_plugin_id": descriptor.get("source_plugin_id"),
            "map_provider": data.get("provider"),
        }
        if target is None:
            target = Artifact(
                project_id=project_id,
                type="map",
                name=name,
                description=descriptor.get("description"),
                data=data,
                artifact_metadata=metadata,
            )
            db.add(target)
            await db.flush()
        else:
            target.name = name
            target.description = descriptor.get("description")
            target.data = data
            target.artifact_metadata = {**(target.artifact_metadata or {}), **metadata}
            target.updated_at = datetime.utcnow()
            version = await _get_current_artifact_version(db, target.id)
            db.add(ArtifactVersion(artifact_id=target.id, version=version + 1, data=target.data, changed_by="console_derived_artifact"))
        created.append({"id": target.id, "type": target.type, "name": target.name})
    return created


@profiles_router.get("/executors", response_model=Dict[str, Any])
async def list_console_executors_endpoint(
    db: AsyncSession = Depends(get_db),
) -> Dict[str, Any]:
    items = await list_console_executor_descriptors(db)
    return {"executors": items}


@profiles_router.get("/python-plugins", response_model=Dict[str, Any])
async def list_python_console_plugins_endpoint(
    db: AsyncSession = Depends(get_db),
) -> Dict[str, Any]:
    return {"plugins": await list_python_console_executor_settings(db)}


@profiles_router.post("/python-plugins/install", response_model=Dict[str, Any])
async def install_python_console_plugin_endpoint(
    file: UploadFile = File(...),
    overwrite: bool = Form(True),
    db: AsyncSession = Depends(get_db),
) -> Dict[str, Any]:
    filename = file.filename or ""
    try:
        content = await file.read(2 * 1024 * 1024 + 1)
    finally:
        await file.close()
    if len(content) > 2 * 1024 * 1024:
        raise HTTPException(status_code=400, detail="Python plugin file exceeds 2 MB")
    try:
        plugin_ids = install_console_plugin_file(filename, content, overwrite=overwrite)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    items = await list_python_console_executor_settings(db)
    return {
        "filename": filename,
        "plugins": [item for item in items if str(item.get("id")) in plugin_ids],
    }


@profiles_router.delete("/python-plugins/{plugin_id}", response_model=Dict[str, Any])
async def delete_python_console_plugin_endpoint(
    plugin_id: str,
    db: AsyncSession = Depends(get_db),
) -> Dict[str, Any]:
    try:
        filename, affected_ids = delete_console_plugin_file(plugin_id)
    except KeyError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    settings = await db.execute(
        select(ConsolePythonPluginSetting).where(ConsolePythonPluginSetting.plugin_id.in_(affected_ids))
    )
    for setting in settings.scalars().all():
        await db.delete(setting)
    await db.commit()
    return {"deleted": True, "plugin_id": plugin_id, "filename": filename, "affected_plugin_ids": affected_ids}

@profiles_router.put("/python-plugins/{plugin_id}", response_model=Dict[str, Any])
async def update_python_console_plugin_endpoint(
    plugin_id: str,
    payload: Dict[str, Any],
    db: AsyncSession = Depends(get_db),
) -> Dict[str, Any]:
    plugin_key = str(plugin_id or "").strip()
    executor = get_python_console_executor(plugin_key)
    if executor is None:
        raise HTTPException(status_code=404, detail=f"Python console plugin '{plugin_key}' not found")

    result = await db.execute(
        select(ConsolePythonPluginSetting).where(ConsolePythonPluginSetting.plugin_id == plugin_key)
    )
    setting = result.scalar_one_or_none()
    if setting is None:
        setting = ConsolePythonPluginSetting(plugin_id=plugin_key)

    setting.is_active = bool(payload.get("is_active", True))
    setting.is_visible = bool(payload.get("is_visible", True))
    setting.menu_path = str(payload.get("menu_path") or executor.menu_path or "Console").strip()
    try:
        setting.menu_order = int(payload.get("menu_order") or 0)
    except (TypeError, ValueError):
        raise HTTPException(status_code=400, detail="menu_order must be an integer")

    db.add(setting)
    await db.commit()
    await db.refresh(setting)

    items = await list_python_console_executor_settings(db)
    updated = next((item for item in items if str(item.get("id")) == plugin_key), None)
    if updated is None:
        raise HTTPException(status_code=500, detail="Failed to reload Python console plugin settings")
    return updated

@profiles_router.get("/profiles", response_model=Dict[str, Any])
async def list_console_profiles_endpoint(
    db: AsyncSession = Depends(get_db),
) -> Dict[str, Any]:
    registered = [serialize_console_profile(item) for item in await list_registered_console_profiles(db, active_only=True)]
    for item in registered:
        item["kind"] = "stored_procedure"
    legacy = [_legacy_profile_public(item) for item in _load_legacy_profiles()]
    return {"profiles": [*registered, *legacy]}


@profiles_router.get("/datasources", response_model=Dict[str, Any])
async def list_console_data_sources_endpoint(
    db: AsyncSession = Depends(get_db),
) -> Dict[str, Any]:
    items = [serialize_console_data_source(item) for item in await list_console_data_sources(db)]
    return {"data_sources": items}


@profiles_router.post("/datasources", response_model=Dict[str, Any])
async def create_console_data_source(
    payload: Dict[str, Any],
    db: AsyncSession = Depends(get_db),
) -> Dict[str, Any]:
    source = ConsoleDataSource()
    _apply_data_source_payload(source, payload)

    existing = await get_console_data_source_by_key(db, source.key)
    if existing:
        raise HTTPException(status_code=400, detail=f"Data source with key '{source.key}' already exists")

    db.add(source)
    await db.commit()
    await db.refresh(source)
    return serialize_console_data_source(source)


@profiles_router.put("/datasources/{source_key}", response_model=Dict[str, Any])
async def update_console_data_source(
    source_key: str,
    payload: Dict[str, Any],
    db: AsyncSession = Depends(get_db),
) -> Dict[str, Any]:
    source = await get_console_data_source_by_key(db, source_key)
    if not source:
        raise HTTPException(status_code=404, detail=f"Data source '{source_key}' not found")

    _apply_data_source_payload(source, payload)
    await db.commit()
    await db.refresh(source)
    return serialize_console_data_source(source)


@profiles_router.post("/datasources/{source_key}/test", response_model=Dict[str, Any])
async def test_console_data_source(
    source_key: str,
    db: AsyncSession = Depends(get_db),
) -> Dict[str, Any]:
    source = await get_console_data_source_by_key(db, source_key)
    if not source:
        raise HTTPException(status_code=404, detail=f"Data source '{source_key}' not found")
    if not source.is_active:
        raise HTTPException(status_code=400, detail=f"Data source '{source_key}' is inactive")

    try:
        probe = await test_console_data_source_connection(source)
    except Exception as exc:
        logger.error("Console datasource test failed for %s: %s", source_key, exc, exc_info=True)
        raise HTTPException(status_code=500, detail=f"Connection test failed: {exc}") from exc

    return {
        "ok": True,
        "source_key": source.key,
        "source_name": source.name,
        "server_name": probe.get("server_name"),
        "database_name": probe.get("database_name"),
        "message": f"Connection to '{source.name}' succeeded",
    }


@profiles_router.delete("/datasources/{source_key}", response_model=Dict[str, Any])
async def delete_console_data_source(
    source_key: str,
    db: AsyncSession = Depends(get_db),
) -> Dict[str, Any]:
    source = await get_console_data_source_by_key(db, source_key)
    if not source:
        raise HTTPException(status_code=404, detail=f"Data source '{source_key}' not found")

    linked_profiles_result = await db.execute(
        select(ConsoleProcedureProfile.id).where(ConsoleProcedureProfile.source_id == source.id).limit(1)
    )
    if linked_profiles_result.scalar_one_or_none() is not None:
        raise HTTPException(
            status_code=400,
            detail=f"Data source '{source.key}' is used by registered procedures. Delete procedures first.",
        )

    source_name = source.name
    await db.delete(source)
    await db.commit()
    return {
        "ok": True,
        "source_key": source_key,
        "message": f"Data source '{source_name}' deleted",
    }


@profiles_router.get("/procedures", response_model=Dict[str, Any])
async def list_console_procedures_endpoint(
    db: AsyncSession = Depends(get_db),
) -> Dict[str, Any]:
    items = [serialize_console_profile(item) for item in await list_registered_console_profiles(db)]
    return {"procedures": items}


@profiles_router.get("/object-type-mappings", response_model=Dict[str, Any])
async def list_console_object_type_mappings_endpoint(
    db: AsyncSession = Depends(get_db),
) -> Dict[str, Any]:
    return {"mappings": await list_console_object_type_mappings(db)}


@profiles_router.put("/object-type-mappings", response_model=Dict[str, Any])
async def replace_console_object_type_mappings(
    payload: Dict[str, Any],
    db: AsyncSession = Depends(get_db),
) -> Dict[str, Any]:
    items = payload.get("mappings") if isinstance(payload.get("mappings"), list) else []
    existing_result = await db.execute(select(ConsoleObjectTypeMapping))
    existing = list(existing_result.scalars().all())
    for item in existing:
        await db.delete(item)
    for index, item in enumerate(items):
        if not isinstance(item, dict):
            continue
        mapping = ConsoleObjectTypeMapping()
        _apply_object_type_mapping_payload(mapping, item, position=index)
        db.add(mapping)
    await db.commit()
    return {"mappings": await list_console_object_type_mappings(db)}


@profiles_router.get("/procedures/{profile_key}", response_model=Dict[str, Any])
async def get_console_procedure_endpoint(
    profile_key: str,
    db: AsyncSession = Depends(get_db),
) -> Dict[str, Any]:
    profile = await get_console_profile_by_key(db, profile_key)
    if not profile:
        raise HTTPException(status_code=404, detail=f"Procedure profile '{profile_key}' not found")
    return serialize_console_profile(profile)


@profiles_router.post("/procedures", response_model=Dict[str, Any])
async def create_console_procedure(
    payload: Dict[str, Any],
    db: AsyncSession = Depends(get_db),
) -> Dict[str, Any]:
    source_key = str(payload.get("source_key") or "").strip()
    if not source_key:
        raise HTTPException(status_code=400, detail="source_key is required")
    source = await get_console_data_source_by_key(db, source_key)
    if not source:
        raise HTTPException(status_code=404, detail=f"Data source '{source_key}' not found")

    profile = ConsoleProcedureProfile()
    _apply_procedure_payload(profile, payload, source.id)
    db.add(profile)
    await db.commit()
    reloaded = await get_console_profile_by_key(db, profile.key)
    if not reloaded:
        raise HTTPException(status_code=500, detail="Failed to reload created procedure profile")
    return serialize_console_profile(reloaded)


@profiles_router.put("/procedures/{profile_key}", response_model=Dict[str, Any])
async def update_console_procedure(
    profile_key: str,
    payload: Dict[str, Any],
    db: AsyncSession = Depends(get_db),
) -> Dict[str, Any]:
    result = await db.execute(
        select(ConsoleProcedureProfile)
        .options(
            selectinload(ConsoleProcedureProfile.params),
            selectinload(ConsoleProcedureProfile.result_sets).selectinload(ConsoleResultSetMapping.columns),
        )
        .where(ConsoleProcedureProfile.key == str(profile_key or "").strip())
    )
    profile = result.scalar_one_or_none()
    if not profile:
        raise HTTPException(status_code=404, detail=f"Procedure profile '{profile_key}' not found")

    source_key = str(payload.get("source_key") or "").strip() or (profile.data_source.key if profile.data_source else "")
    if not source_key:
        raise HTTPException(status_code=400, detail="source_key is required")
    source = await get_console_data_source_by_key(db, source_key)
    if not source:
        raise HTTPException(status_code=404, detail=f"Data source '{source_key}' not found")

    _apply_procedure_payload(profile, payload, source.id)
    db.add(profile)
    await db.commit()
    reloaded = await get_console_profile_by_key(db, profile.key)
    if not reloaded:
        raise HTTPException(status_code=500, detail="Failed to reload updated procedure profile")
    return serialize_console_profile(reloaded)


@profiles_router.delete("/procedures/{profile_key}", response_model=Dict[str, Any])
async def delete_console_procedure(
    profile_key: str,
    db: AsyncSession = Depends(get_db),
) -> Dict[str, Any]:
    result = await db.execute(
        select(ConsoleProcedureProfile).where(ConsoleProcedureProfile.key == str(profile_key or "").strip())
    )
    profile = result.scalar_one_or_none()
    if not profile:
        raise HTTPException(status_code=404, detail=f"Procedure profile '{profile_key}' not found")

    await db.delete(profile)
    await db.commit()
    return {
        "ok": True,
        "profile_key": profile_key,
        "message": f"Procedure profile '{profile_key}' deleted",
    }


@router.post("/refresh", response_model=Dict[str, Any])
async def refresh_console_artifact(
    project_id: int,
    payload: Dict[str, Any],
    db: AsyncSession = Depends(get_db),
    project: Project = Depends(get_project),
) -> Dict[str, Any]:
    del project
    artifact_id = int(payload.get("artifact_id") or 0)
    if artifact_id <= 0:
        raise HTTPException(status_code=400, detail="artifact_id is required")

    artifact = await _load_console_artifact(db, project_id, artifact_id)

    artifact_metadata = artifact.artifact_metadata if isinstance(artifact.artifact_metadata, dict) else {}
    profile_key = str(payload.get("profile_id") or payload.get("profile_key") or artifact_metadata.get("console_profile_id") or "").strip()
    if not profile_key:
        raise HTTPException(status_code=400, detail="profile_id is required")

    params = payload.get("params") if isinstance(payload.get("params"), dict) else {}
    active_tab_id = str(payload.get("active_tab_id") or "").strip()
    payload_context = payload.get("context") if isinstance(payload.get("context"), dict) else {}
    context_artifact_id = int(payload.get("context_artifact_id") or 0) or None

    profile = await get_console_profile_by_key(db, profile_key)
    python_executor = None if profile else get_python_console_executor(profile_key)
    if python_executor and not await is_python_console_executor_enabled(db, profile_key):
        raise HTTPException(status_code=400, detail=f"Python console plugin '{profile_key}' is inactive")
    current_version = await _get_current_artifact_version(db, artifact.id)

    if profile:
        if not profile.is_active:
            raise HTTPException(status_code=400, detail=f"Procedure profile '{profile_key}' is inactive")
        if not profile.data_source or not profile.data_source.is_active:
            raise HTTPException(status_code=400, detail=f"Data source for procedure '{profile_key}' is inactive")

        execution_context = build_console_execution_context(
            project_id=project_id,
            artifact_id=artifact.id,
            context_artifact_id=context_artifact_id,
            payload_context=payload_context,
            type_mapping=await get_console_object_type_mapping_dict(db),
        )

        try:
            resolved_params = resolve_procedure_params(profile, params, execution_context)
            execution_result = await execute_console_procedure(profile.data_source, profile, resolved_params)
        except Exception as exc:
            logger.error("Stored procedure console refresh failed: %s", exc, exc_info=True)
            raise HTTPException(status_code=500, detail=f"Console refresh failed: {exc}") from exc

        tabs = execution_result.get("tabs") if isinstance(execution_result.get("tabs"), list) else []
        if not active_tab_id and tabs:
            active_tab_id = str(tabs[0].get("id") or "").strip()
        if active_tab_id and not any(str(item.get("id") or "") == active_tab_id for item in tabs):
            active_tab_id = str(tabs[0].get("id") or "").strip() if tabs else ""

        next_data = normalize_console_artifact_data(
            {
                **execution_result,
                "active_tab_id": active_tab_id or execution_result.get("active_tab_id"),
                "input_snapshot": {
                    "params": resolved_params,
                    "context": execution_context,
                },
                "profile_kind": "stored_procedure",
                "updated_at": datetime.utcnow().isoformat(),
            },
            executor_type="sql_function",
            executor_id=profile.key,
            executor_name=profile.display_name,
        )
        tabs = next_data.get("tabs") if isinstance(next_data.get("tabs"), list) else []

        artifact.data = next_data
        artifact.artifact_metadata = build_console_artifact_metadata(
            base_metadata=artifact_metadata,
            profile_kind="stored_procedure",
            profile_id=profile.key,
            profile_name=profile.display_name,
            source_key=profile.data_source.key if profile.data_source else None,
            source_name=profile.data_source.name if profile.data_source else None,
            context_artifact_id=context_artifact_id,
            raw_params=params,
            resolved_params=resolved_params,
            tabs=tabs,
        )
    elif python_executor:
        execution_context = build_console_execution_context(
            project_id=project_id,
            artifact_id=artifact.id,
            context_artifact_id=context_artifact_id,
            payload_context=payload_context,
            type_mapping=await get_console_object_type_mapping_dict(db),
        )

        context_artifact_payload = None
        if context_artifact_id:
            context_result = await db.execute(
                select(Artifact).where(Artifact.id == context_artifact_id, Artifact.project_id == project_id)
            )
            context_artifact = context_result.scalar_one_or_none()
            if context_artifact is not None:
                context_artifact_payload = {
                    "id": context_artifact.id,
                    "project_id": context_artifact.project_id,
                    "type": context_artifact.type,
                    "name": context_artifact.name,
                    "description": context_artifact.description,
                    "data": context_artifact.data,
                    "metadata": context_artifact.artifact_metadata,
                }

        try:
            execution_result = await python_executor.execute(
                project_id=project_id,
                artifact=context_artifact_payload,
                params=params,
                context=execution_context,
            )
        except Exception as exc:
            logger.error("Python console executor refresh failed: %s", exc, exc_info=True)
            raise HTTPException(status_code=500, detail=f"Console refresh failed: {exc}") from exc

        if not isinstance(execution_result, dict):
            raise HTTPException(status_code=500, detail="Python console executor returned invalid result")

        tabs = execution_result.get("tabs") if isinstance(execution_result.get("tabs"), list) else []
        if not active_tab_id and tabs:
            active_tab_id = str(tabs[0].get("id") or "").strip()
        if active_tab_id and not any(str(item.get("id") or "") == active_tab_id for item in tabs):
            active_tab_id = str(tabs[0].get("id") or "").strip() if tabs else ""

        next_data = normalize_console_artifact_data(
            {
                **execution_result,
                "active_tab_id": active_tab_id or execution_result.get("active_tab_id"),
                "input_snapshot": {
                    "params": params,
                    "context": execution_context,
                },
                "profile_kind": "python_plugin",
                "updated_at": datetime.utcnow().isoformat(),
            },
            executor_type="python",
            executor_id=python_executor.id,
            executor_name=python_executor.name,
            source_plugin_id=python_executor.id,
        )
        tabs = next_data.get("tabs") if isinstance(next_data.get("tabs"), list) else []
        derived_artifacts = await _upsert_derived_artifacts(
            db,
            project_id=project_id,
            source_artifact=artifact,
            descriptors=execution_result.get("derived_artifacts"),
        )

        artifact.data = next_data
        artifact.artifact_metadata = build_console_artifact_metadata(
            base_metadata=artifact_metadata,
            profile_kind="python_plugin",
            profile_id=python_executor.id,
            profile_name=python_executor.name,
            context_artifact_id=context_artifact_id,
            raw_params=params,
            resolved_params=params,
            tabs=tabs,
            source_plugin_id=python_executor.id,
        )
        if derived_artifacts:
            artifact.artifact_metadata["derived_artifacts"] = derived_artifacts
    else:
        legacy_profile = _get_legacy_profile(profile_key)
        if not legacy_profile:
            raise HTTPException(status_code=404, detail=f"Console profile '{profile_key}' not found")

        try:
            tabs = await _build_legacy_console_tabs(db, legacy_profile, params, project_id)
        except Exception as exc:
            logger.error("Legacy console refresh failed: %s", exc)
            raise HTTPException(status_code=500, detail=f"Console refresh failed: {exc}") from exc

        if not active_tab_id and tabs:
            active_tab_id = str(tabs[0].get("id") or "").strip()
        if active_tab_id and not any(str(item.get("id") or "") == active_tab_id for item in tabs):
            active_tab_id = str(tabs[0].get("id") or "").strip() if tabs else ""

        next_data = normalize_console_artifact_data(
            {
                "profile_id": profile_key,
                "profile_name": str(legacy_profile.get("name") or profile_key),
                "tabs": tabs,
                "active_tab_id": active_tab_id or None,
                "profile_kind": "legacy_query",
                "updated_at": datetime.utcnow().isoformat(),
            },
            executor_type="sql_function",
            executor_id=profile_key,
            executor_name=str(legacy_profile.get("name") or profile_key),
        )
        tabs = next_data.get("tabs") if isinstance(next_data.get("tabs"), list) else []

        artifact.data = next_data
        artifact.artifact_metadata = build_console_artifact_metadata(
            base_metadata=artifact_metadata,
            profile_kind="legacy_query",
            profile_id=profile_key,
            profile_name=str(legacy_profile.get("name") or profile_key),
            context_artifact_id=context_artifact_id,
            raw_params=params,
            tabs=tabs,
        )

    artifact.updated_at = datetime.utcnow()
    db.add(
        ArtifactVersion(
            artifact_id=artifact.id,
            version=current_version + 1,
            data=artifact.data,
            changed_by="console_refresh",
        )
    )
    await db.commit()
    await db.refresh(artifact)

    final_version = await _get_current_artifact_version(db, artifact.id)
    return {
        "id": artifact.id,
        "project_id": artifact.project_id,
        "type": artifact.type,
        "name": artifact.name,
        "description": artifact.description,
        "data": artifact.data,
        "metadata": artifact.artifact_metadata,
        "created_at": artifact.created_at.isoformat() if artifact.created_at else None,
        "updated_at": artifact.updated_at.isoformat() if artifact.updated_at else None,
        "version": final_version,
    }

