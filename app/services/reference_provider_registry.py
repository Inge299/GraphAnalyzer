from __future__ import annotations

import json
import re
from pathlib import Path
from typing import Any

CONFIG_PATH = Path(__file__).resolve().parents[1] / "configuration" / "reference_providers.json"
PROVIDER_ID_PATTERN = re.compile(r"^[a-z][a-z0-9_]{2,63}$")

_BUILTIN_PROVIDERS: dict[str, dict[str, Any]] = {
    "external_postgres_cell_towers": {
        "id": "external_postgres_cell_towers", "kind": "postgres_cell_towers", "name": "Внешний справочник БС",
        "description": "Поиск координат и адресов базовых станций во внешней PostgreSQL базе данных.", "enabled": True,
        "capabilities": ["resolve_cell_towers"],
        "config": {"dsn_env": "CELL_TOWER_REFERENCE_DSN", "table_env": "CELL_TOWER_REFERENCE_TABLE", "timeout_env": "CELL_TOWER_REFERENCE_TIMEOUT_SECONDS", "table": "cell_tower_reference"},
        "editable_fields": ["name", "description", "enabled", "config.table"], "source": "builtin",
    },
    "console_mssql": {
        "id": "console_mssql", "kind": "mssql_procedures", "name": "SQL Server / процедуры",
        "description": "Доступ к зарегистрированным процедурам SQL Server через источники консоли Nodex.", "enabled": True,
        "capabilities": ["list_resources", "execute_procedure"], "config": {},
        "editable_fields": ["name", "description", "enabled"], "source": "builtin",
    },
}


def _copy(value: Any) -> Any:
    return json.loads(json.dumps(value, ensure_ascii=False))


def _read_config() -> dict[str, Any]:
    if not CONFIG_PATH.exists():
        return {"version": 1, "providers": []}
    try:
        payload = json.loads(CONFIG_PATH.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError):
        return {"version": 1, "providers": []}
    providers = payload.get("providers") if isinstance(payload, dict) else None
    return {"version": int(payload.get("version") or 1), "providers": providers if isinstance(providers, list) else []}


def _write_config(payload: dict[str, Any]) -> None:
    CONFIG_PATH.parent.mkdir(parents=True, exist_ok=True)
    CONFIG_PATH.write_text(json.dumps(payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def _stored() -> dict[str, dict[str, Any]]:
    return {
        str(item.get("id") or "").strip(): item
        for item in _read_config()["providers"]
        if isinstance(item, dict) and PROVIDER_ID_PATTERN.fullmatch(str(item.get("id") or "").strip())
    }


def _editable_config_fields(provider: dict[str, Any]) -> set[str]:
    return {field.split(".", 1)[1] for field in provider.get("editable_fields", []) if isinstance(field, str) and field.startswith("config.")}


def _merge_provider(base: dict[str, Any], override: dict[str, Any] | None = None) -> dict[str, Any]:
    provider = _copy(base)
    override = override or {}
    for field in ("name", "description", "enabled"):
        if field in override:
            provider[field] = override[field]
    if isinstance(override.get("config"), dict):
        allowed = _editable_config_fields(provider)
        provider.setdefault("config", {}).update({key: value for key, value in override["config"].items() if key in allowed})
    return provider


def list_reference_providers() -> list[dict[str, Any]]:
    stored = _stored()
    result = [_merge_provider(base, stored.pop(provider_id, None)) for provider_id, base in _BUILTIN_PROVIDERS.items()]
    result.extend(_copy(provider) for provider in stored.values())
    return sorted(result, key=lambda item: str(item.get("name") or item.get("id")))


def get_reference_provider(provider_id: str) -> dict[str, Any]:
    base = _BUILTIN_PROVIDERS.get(provider_id)
    stored = _stored().get(provider_id)
    if base:
        return _merge_provider(base, stored)
    if stored:
        return _copy(stored)
    raise ValueError(f"Reference provider not found: {provider_id}")


def get_reference_providers_config() -> dict[str, Any]:
    return {"version": 1, "providers": list_reference_providers()}


def ensure_reference_provider(metadata: dict[str, Any]) -> dict[str, Any]:
    provider_id = str(metadata.get("id") or "").strip()
    if provider_id in _BUILTIN_PROVIDERS:
        return get_reference_provider(provider_id)
    if not PROVIDER_ID_PATTERN.fullmatch(provider_id):
        raise ValueError("Provider id must use lowercase letters, digits and underscores")
    stored = _stored()
    if provider_id in stored:
        return _copy(stored[provider_id])
    provider = {
        "id": provider_id, "kind": str(metadata.get("kind") or "external"),
        "name": str(metadata.get("name") or provider_id), "description": str(metadata.get("description") or ""),
        "enabled": bool(metadata.get("enabled", True)), "capabilities": list(metadata.get("capabilities") or []),
        "config": dict(metadata.get("config") or {}), "editable_fields": list(metadata.get("editable_fields") or ["name", "description", "enabled"]),
        "source": str(metadata.get("source") or "external"),
    }
    stored[provider_id] = provider
    _write_config({"version": 1, "providers": [stored[key] for key in sorted(stored)]})
    return _copy(provider)


def _normalize_update(provider_id: str, payload: dict[str, Any]) -> dict[str, Any]:
    base = get_reference_provider(provider_id)
    name = str(payload.get("name") or base["name"]).strip()
    description = str(payload.get("description") or base.get("description") or "").strip()
    if not name:
        raise ValueError("Provider name is required")
    item = _copy(base)
    item.update({"name": name, "description": description, "enabled": bool(payload.get("enabled", base.get("enabled", True)))})
    config = payload.get("config") if isinstance(payload.get("config"), dict) else {}
    for key in _editable_config_fields(base):
        if key not in config:
            continue
        value = str(config[key] or "").strip()
        if key == "table" and not re.fullmatch(r"[A-Za-z_][A-Za-z0-9_]*(?:\.[A-Za-z_][A-Za-z0-9_]*)?", value):
            raise ValueError("Table name must contain only a schema and table identifier")
        item.setdefault("config", {})[key] = value
    return item


def save_reference_provider(provider_id: str, payload: dict[str, Any]) -> dict[str, Any]:
    item = _normalize_update(provider_id, payload)
    stored = _stored()
    stored[provider_id] = item
    _write_config({"version": 1, "providers": [stored[key] for key in sorted(stored)]})
    return get_reference_provider(provider_id)


def replace_reference_providers_config(payload: dict[str, Any]) -> dict[str, Any]:
    providers = payload.get("providers")
    if not isinstance(providers, list):
        raise ValueError("reference_providers must contain a providers array")
    stored: dict[str, dict[str, Any]] = {}
    for item in providers:
        if not isinstance(item, dict):
            continue
        provider_id = str(item.get("id") or "").strip()
        if provider_id in _BUILTIN_PROVIDERS:
            stored[provider_id] = _normalize_update(provider_id, item)
        elif PROVIDER_ID_PATTERN.fullmatch(provider_id):
            stored[provider_id] = {
                "id": provider_id, "kind": str(item.get("kind") or "external"), "name": str(item.get("name") or provider_id),
                "description": str(item.get("description") or ""), "enabled": bool(item.get("enabled", True)),
                "capabilities": list(item.get("capabilities") or []), "config": dict(item.get("config") or {}),
                "editable_fields": list(item.get("editable_fields") or ["name", "description", "enabled"]), "source": str(item.get("source") or "external"),
            }
    _write_config({"version": 1, "providers": [stored[key] for key in sorted(stored)]})
    return get_reference_providers_config()


def reload_reference_providers() -> list[dict[str, Any]]:
    return list_reference_providers()
