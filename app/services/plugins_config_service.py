"""Plugin configuration loader (JSON-based)."""

from __future__ import annotations

import json
import re
from functools import lru_cache
from pathlib import Path
from typing import Any, Dict


DEFAULT_ANALYSIS_PLUGIN_PRESETS = [
    {
        "id": "telephony_connections",
        "base_plugin_id": "expand_typed_relations",
        "name": "Соединения",
        "description": "Раскрывает телефонные соединения выбранных MSISDN.",
        "menu_path": "Телефония",
        "menu_order": 10,
        "fixed_params": {"relation_type": "msisdn_communication"},
    },
    {
        "id": "telephony_msisdn_imsi",
        "base_plugin_id": "expand_typed_relations",
        "name": "MSISDN — IMSI",
        "description": "Раскрывает факты использования IMSI выбранными MSISDN.",
        "menu_path": "Телефония",
        "menu_order": 20,
        "fixed_params": {"relation_type": "msisdn_imsi_usage"},
    },
    {
        "id": "telephony_msisdn_imei",
        "base_plugin_id": "expand_typed_relations",
        "name": "MSISDN — IMEI",
        "description": "Раскрывает факты использования аппаратов выбранными MSISDN.",
        "menu_path": "Телефония",
        "menu_order": 30,
        "fixed_params": {"relation_type": "msisdn_imei_usage"},
    },
]

_DEFAULT_CONFIG: Dict[str, Any] = {"version": 2, "plugins": {}, "analysis_presets": DEFAULT_ANALYSIS_PLUGIN_PRESETS}


@lru_cache(maxsize=1)
def _config_path() -> Path:
    return Path(__file__).resolve().parent.parent / "configuration" / "plugins_config.json"


@lru_cache(maxsize=1)
def get_plugins_config() -> Dict[str, Any]:
    path = _config_path()
    if not path.exists():
        return dict(_DEFAULT_CONFIG)
    try:
        raw = json.loads(path.read_text(encoding="utf-8-sig"))
    except Exception:
        return dict(_DEFAULT_CONFIG)
    if not isinstance(raw, dict):
        return dict(_DEFAULT_CONFIG)
    merged: Dict[str, Any] = dict(_DEFAULT_CONFIG)
    merged.update(raw)
    if not isinstance(merged.get("plugins"), dict):
        merged["plugins"] = {}
    if not isinstance(merged.get("analysis_presets"), list):
        merged["analysis_presets"] = list(DEFAULT_ANALYSIS_PLUGIN_PRESETS)
    return merged


def replace_plugins_config(payload: Dict[str, Any]) -> Dict[str, Any]:
    if not isinstance(payload, dict):
        raise ValueError("plugins config must be an object")
    plugins = payload.get("plugins", {})
    presets = payload.get("analysis_presets", DEFAULT_ANALYSIS_PLUGIN_PRESETS)
    if not isinstance(plugins, dict):
        raise ValueError("plugins must be an object")
    if not isinstance(presets, list):
        raise ValueError("analysis_presets must be an array")
    return _save({
        "version": 2,
        "plugins": {str(key): value for key, value in plugins.items() if isinstance(value, dict)},
        "analysis_presets": [item for item in presets if isinstance(item, dict)],
    })

def get_analysis_plugin_presets() -> list[dict[str, Any]]:
    presets = get_plugins_config().get("analysis_presets")
    return [dict(item) for item in presets if isinstance(item, dict)] if isinstance(presets, list) else []


_PRESET_ID_RE = re.compile(r"^[a-z][a-z0-9_]{2,80}$")


def normalize_analysis_plugin_preset(payload: Dict[str, Any]) -> Dict[str, Any]:
    """Validate the user-editable part of a relation-expansion profile."""
    preset_id = str(payload.get("id") or "").strip()
    if not _PRESET_ID_RE.fullmatch(preset_id):
        raise ValueError("Profile key must contain lowercase Latin letters, digits, and underscores")

    name = str(payload.get("name") or "").strip()
    if not name:
        raise ValueError("Profile name is required")

    menu_path = str(payload.get("menu_path") or "Analysis").strip() or "Analysis"
    fixed_params = payload.get("fixed_params") or {}
    relation_type = str(fixed_params.get("relation_type") or "").strip() if isinstance(fixed_params, dict) else ""
    if not relation_type:
        raise ValueError("Relation type is required")

    try:
        menu_order = int(payload.get("menu_order") or 0)
    except (TypeError, ValueError) as exc:
        raise ValueError("Menu order must be an integer") from exc

    return {
        "id": preset_id,
        "base_plugin_id": "expand_typed_relations",
        "name": name,
        "description": str(payload.get("description") or "").strip(),
        "menu_path": menu_path,
        "menu_order": menu_order,
        "fixed_params": {"relation_type": relation_type},
    }


def upsert_analysis_plugin_preset(payload: Dict[str, Any]) -> Dict[str, Any]:
    preset = normalize_analysis_plugin_preset(payload)
    config = get_plugins_config()
    presets = [item for item in config.get("analysis_presets", []) if isinstance(item, dict)]
    preset_id = preset["id"]
    replaced = False
    updated: list[Dict[str, Any]] = []
    for item in presets:
        if str(item.get("id") or "") == preset_id:
            updated.append(preset)
            replaced = True
        else:
            updated.append(item)
    if not replaced:
        updated.append(preset)
    config["analysis_presets"] = updated
    _save(config)
    return preset


def delete_analysis_plugin_preset(preset_id: str) -> bool:
    normalized_id = str(preset_id or "").strip()
    config = get_plugins_config()
    presets = [item for item in config.get("analysis_presets", []) if isinstance(item, dict)]
    updated = [item for item in presets if str(item.get("id") or "") != normalized_id]
    if len(updated) == len(presets):
        return False
    config["analysis_presets"] = updated
    _save(config)
    return True

def get_plugin_config(plugin_id: str) -> Dict[str, Any]:
    cfg = get_plugins_config()
    plugins = cfg.get("plugins") if isinstance(cfg, dict) else {}
    return dict(plugins.get(plugin_id) or {}) if isinstance(plugins, dict) and isinstance(plugins.get(plugin_id), dict) else {}


def reload_plugins_config() -> Dict[str, Any]:
    _config_path.cache_clear()
    get_plugins_config.cache_clear()
    return get_plugins_config()


def _save(config: Dict[str, Any]) -> Dict[str, Any]:
    path = _config_path()
    path.write_text(json.dumps(config, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    return reload_plugins_config()


def update_plugin_ui_settings(plugin_id: str, *, is_active: bool, is_visible: bool, menu_path: str, menu_order: int) -> Dict[str, Any]:
    config = get_plugins_config()
    plugins = config.setdefault("plugins", {})
    if not isinstance(plugins, dict):
        plugins = {}
        config["plugins"] = plugins
    plugin_config = plugins.setdefault(plugin_id, {})
    if not isinstance(plugin_config, dict):
        plugin_config = {}
        plugins[plugin_id] = plugin_config
    plugin_config["ui"] = {
        "is_active": bool(is_active), "is_visible": bool(is_visible),
        "menu_path": str(menu_path or "Анализ").strip() or "Анализ",
        "menu_order": int(menu_order),
    }
    return _save(config)


def delete_plugin_config(plugin_id: str) -> Dict[str, Any]:
    config = get_plugins_config()
    plugins = config.get("plugins")
    if isinstance(plugins, dict):
        plugins.pop(plugin_id, None)
    return _save(config)
