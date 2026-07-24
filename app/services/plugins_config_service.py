"""Plugin configuration loader (JSON-based)."""

from __future__ import annotations

import json
from functools import lru_cache
from pathlib import Path
from typing import Any, Dict


_DEFAULT_CONFIG: Dict[str, Any] = {
    "version": 1,
    "plugins": {},
}


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

    return merged


def get_plugin_config(plugin_id: str) -> Dict[str, Any]:
    cfg = get_plugins_config()
    plugins = cfg.get("plugins") if isinstance(cfg, dict) else {}
    if not isinstance(plugins, dict):
        return {}

    plugin_cfg = plugins.get(plugin_id)
    if not isinstance(plugin_cfg, dict):
        return {}

    return plugin_cfg


def reload_plugins_config() -> Dict[str, Any]:
    _config_path.cache_clear()
    get_plugins_config.cache_clear()
    return get_plugins_config()


def update_plugin_ui_settings(
    plugin_id: str,
    *,
    is_active: bool,
    is_visible: bool,
    menu_path: str,
    menu_order: int,
) -> Dict[str, Any]:
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
        "is_active": bool(is_active),
        "is_visible": bool(is_visible),
        "menu_path": str(menu_path or "\u0410\u043d\u0430\u043b\u0438\u0437").strip() or "\u0410\u043d\u0430\u043b\u0438\u0437",
        "menu_order": int(menu_order),
    }
    path = _config_path()
    path.write_text(json.dumps(config, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    return reload_plugins_config()

def delete_plugin_config(plugin_id: str) -> Dict[str, Any]:
    config = get_plugins_config()
    plugins = config.get("plugins")
    if isinstance(plugins, dict):
        plugins.pop(plugin_id, None)
    path = _config_path()
    path.write_text(json.dumps(config, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    return reload_plugins_config()