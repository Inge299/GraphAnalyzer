from __future__ import annotations

import json
import logging
from pathlib import Path
from typing import Any, Dict, List

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.console_plugins import AVAILABLE_CONSOLE_EXECUTORS
from app.models.console_registry import ConsolePythonPluginSetting
from app.services.console_registry_service import serialize_console_profile
from app.services.console_registry_service import list_console_profiles as list_registered_console_profiles

logger = logging.getLogger(__name__)

CONFIG_PATH = Path(__file__).resolve().parents[1] / "configuration" / "console_profiles.json"


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


def serialize_legacy_console_executor(profile: Dict[str, Any]) -> Dict[str, Any]:
    profile_id = str(profile.get("id") or "").strip()
    return {
        "id": profile_id,
        "key": profile_id,
        "name": str(profile.get("name") or "").strip(),
        "description": str(profile.get("description") or "").strip(),
        "kind": "legacy_query",
        "executor_type": "sql_function",
        "origin": "legacy_config",
        "menu_path": str(profile.get("menu_path") or "Старое/SQL-консоль").strip(),
        "menu_order": int(profile.get("menu_order") or 0),
        "hidden_from_menu": bool(profile.get("hidden_from_menu", False)),
        "params": profile.get("params") if isinstance(profile.get("params"), list) else [],
        "default_limit": int(profile.get("default_limit") or 200),
        "supports_graph_selection": False,
        "result_sets": [],
        "timeout_seconds": None,
        "source_key": None,
        "source_name": None,
        "is_active": True,
        "is_editable": False,
    }


def serialize_registered_console_executor(profile: Any) -> Dict[str, Any]:
    payload = serialize_console_profile(profile)
    payload["kind"] = "stored_procedure"
    payload["executor_type"] = "sql_function"
    payload["origin"] = "registry"
    payload["menu_path"] = "Console"
    payload["is_editable"] = True
    return payload


def _apply_python_plugin_setting(
    descriptor: Dict[str, Any],
    setting: ConsolePythonPluginSetting | None,
) -> Dict[str, Any]:
    result = dict(descriptor)
    result["is_active"] = bool(setting.is_active) if setting is not None else True
    result["hidden_from_menu"] = not bool(setting.is_visible) if setting is not None else False
    if setting is not None:
        result["menu_path"] = str(setting.menu_path or result.get("menu_path") or "Console").strip()
        result["menu_order"] = int(setting.menu_order or 0)
        result["settings_updated_at"] = setting.updated_at.isoformat() if setting.updated_at else None
    else:
        result["menu_order"] = int(result.get("menu_order") or 0)
        result["settings_updated_at"] = None
    return result


async def _python_plugin_settings_by_id(db: AsyncSession) -> Dict[str, ConsolePythonPluginSetting]:
    result = await db.execute(select(ConsolePythonPluginSetting))
    return {str(item.plugin_id): item for item in result.scalars().all()}


def list_python_console_executors(
    settings: Dict[str, ConsolePythonPluginSetting] | None = None,
    *,
    include_inactive: bool = True,
) -> List[Dict[str, Any]]:
    items: List[Dict[str, Any]] = []
    for executor_id, cls in AVAILABLE_CONSOLE_EXECUTORS.items():
        try:
            instance = cls()
            descriptor = instance.to_descriptor()
            descriptor.setdefault("id", executor_id)
            descriptor.setdefault("key", executor_id)
            descriptor = _apply_python_plugin_setting(descriptor, (settings or {}).get(executor_id))
            if include_inactive or descriptor.get("is_active") is not False:
                items.append(descriptor)
        except Exception as exc:
            logger.error("Failed to initialize console executor %s: %s", executor_id, exc)
    items.sort(
        key=lambda item: (
            str(item.get("menu_path") or ""),
            int(item.get("menu_order") or 0),
            str(item.get("name") or ""),
            str(item.get("id") or ""),
        )
    )
    return items


async def list_console_executor_descriptors(db: AsyncSession) -> List[Dict[str, Any]]:
    items: List[Dict[str, Any]] = []
    registered = await list_registered_console_profiles(db, active_only=True)
    items.extend(serialize_registered_console_executor(item) for item in registered)
    items.extend(serialize_legacy_console_executor(item) for item in _load_legacy_profiles())
    settings = await _python_plugin_settings_by_id(db)
    items.extend(list_python_console_executors(settings, include_inactive=False))
    items.sort(
        key=lambda item: (
            str(item.get("menu_path") or ""),
            int(item.get("menu_order") or 0),
            str(item.get("name") or ""),
            str(item.get("id") or ""),
        )
    )
    return items


async def list_python_console_executor_settings(db: AsyncSession) -> List[Dict[str, Any]]:
    settings = await _python_plugin_settings_by_id(db)
    return list_python_console_executors(settings, include_inactive=True)


async def is_python_console_executor_enabled(db: AsyncSession, executor_id: str) -> bool:
    result = await db.execute(
        select(ConsolePythonPluginSetting.is_active).where(ConsolePythonPluginSetting.plugin_id == executor_id)
    )
    value = result.scalar_one_or_none()
    return value is not False

def get_python_console_executor(executor_id: str):
    key = str(executor_id or "").strip()
    if not key:
        return None
    cls = AVAILABLE_CONSOLE_EXECUTORS.get(key)
    if cls is None:
        return None
    try:
        return cls()
    except Exception as exc:
        logger.error("Failed to initialize console executor %s: %s", key, exc)
        return None
