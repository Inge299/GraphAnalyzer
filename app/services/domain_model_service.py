"""Domain model configuration loader and editor for node/edge types and graph rules."""

from __future__ import annotations

import json
from functools import lru_cache
from pathlib import Path
from typing import Any, Dict, List, Optional


_DEFAULT_CONFIG = {
    "version": 2,
    "node_types": [],
    "edge_types": [],
    "fact_types": [],
    "ingestion_mappings": [],
    "rules": {
        "merge_nodes_with_same_label": False,
        "allow_parallel_edges": True,
        "edge_direction_values": ["from", "to", "both"],
        "edge_style_values": ["solid", "dashed"],
    },
}


@lru_cache(maxsize=1)
def _config_path() -> Path:
    return Path(__file__).resolve().parent.parent / "configuration" / "domain_model.json"


@lru_cache(maxsize=1)
def get_domain_model() -> Dict[str, Any]:
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

    if not isinstance(merged.get("node_types"), list):
        merged["node_types"] = []
    if not isinstance(merged.get("edge_types"), list):
        merged["edge_types"] = []
    if not isinstance(merged.get("fact_types"), list):
        merged["fact_types"] = []
    if not isinstance(merged.get("ingestion_mappings"), list):
        merged["ingestion_mappings"] = []
    if not isinstance(merged.get("rules"), dict):
        merged["rules"] = dict(_DEFAULT_CONFIG["rules"])

    return _normalize_domain_model(merged)


def save_domain_model(model: Dict[str, Any]) -> Dict[str, Any]:
    normalized = _normalize_domain_model(model)
    path = _config_path()
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(normalized, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    get_domain_model.cache_clear()
    # The database registry is a cache of this file, not a separate source of truth.
    from app.services.project_domain_store import invalidate_project_domain_store_schema
    invalidate_project_domain_store_schema()
    return get_domain_model()


def list_node_types() -> List[Dict[str, Any]]:
    model = get_domain_model()
    node_types = model.get("node_types") if isinstance(model, dict) else []
    return [item for item in node_types if isinstance(item, dict)]


def list_edge_types() -> List[Dict[str, Any]]:
    model = get_domain_model()
    edge_types = model.get("edge_types") if isinstance(model, dict) else []
    return [item for item in edge_types if isinstance(item, dict)]


def upsert_node_type(node_type: Dict[str, Any]) -> Dict[str, Any]:
    prepared = _normalize_node_type(node_type)
    if not prepared["id"]:
        raise ValueError("Node type id is required")

    model = get_domain_model()
    node_types = list_node_types()
    replaced = False
    for index, current in enumerate(node_types):
        if str(current.get("id") or "").strip().lower() == prepared["id"].lower():
            node_types[index] = prepared
            replaced = True
            break
    if not replaced:
        node_types.append(prepared)

    updated = dict(model)
    updated["node_types"] = sorted(node_types, key=lambda item: str(item.get("label") or item.get("id") or "").lower())
    return save_domain_model(updated)


def delete_node_type(node_type_id: str) -> Dict[str, Any]:
    normalized = str(node_type_id or "").strip().lower()
    if not normalized:
        raise ValueError("Node type id is required")

    model = get_domain_model()
    node_types = [
        item
        for item in list_node_types()
        if str(item.get("id") or "").strip().lower() != normalized
    ]
    edge_types = [
        item
        for item in list_edge_types()
        if normalized not in {
            str(item.get("from_type") or "").strip().lower(),
            str(item.get("to_type") or "").strip().lower(),
        }
    ]

    updated = dict(model)
    updated["node_types"] = node_types
    updated["edge_types"] = edge_types
    return save_domain_model(updated)


def upsert_edge_type(edge_type: Dict[str, Any]) -> Dict[str, Any]:
    prepared = _normalize_edge_type(edge_type)
    if not prepared["id"]:
        raise ValueError("Edge type id is required")

    model = get_domain_model()
    edge_types = list_edge_types()
    replaced = False
    for index, current in enumerate(edge_types):
        if str(current.get("id") or "").strip().lower() == prepared["id"].lower():
            edge_types[index] = prepared
            replaced = True
            break
    if not replaced:
        edge_types.append(prepared)

    updated = dict(model)
    updated["edge_types"] = sorted(edge_types, key=lambda item: str(item.get("label") or item.get("id") or "").lower())
    return save_domain_model(updated)


def delete_edge_type(edge_type_id: str) -> Dict[str, Any]:
    normalized = str(edge_type_id or "").strip().lower()
    if not normalized:
        raise ValueError("Edge type id is required")

    model = get_domain_model()
    edge_types = [
        item
        for item in list_edge_types()
        if str(item.get("id") or "").strip().lower() != normalized
    ]
    updated = dict(model)
    updated["edge_types"] = edge_types
    return save_domain_model(updated)


def reload_domain_model() -> Dict[str, Any]:
    _config_path.cache_clear()
    get_domain_model.cache_clear()
    # The database registry is a cache of this file, not a separate source of truth.
    from app.services.project_domain_store import invalidate_project_domain_store_schema
    invalidate_project_domain_store_schema()
    return get_domain_model()


def _normalize_domain_model(model: Dict[str, Any]) -> Dict[str, Any]:
    merged: Dict[str, Any] = dict(_DEFAULT_CONFIG)
    if isinstance(model, dict):
        merged.update(model)

    merged["version"] = 2
    node_types = merged.get("node_types")
    edge_types = merged.get("edge_types")
    fact_types = merged.get("fact_types")
    ingestion_mappings = merged.get("ingestion_mappings")
    rules = merged.get("rules")

    merged["node_types"] = [_normalize_node_type(item) for item in node_types or [] if isinstance(item, dict)]
    merged["edge_types"] = [_normalize_edge_type(item) for item in edge_types or [] if isinstance(item, dict)]
    merged["fact_types"] = [_normalize_fact_type(item) for item in fact_types or [] if isinstance(item, dict)]
    merged["ingestion_mappings"] = [_normalize_ingestion_mapping(item) for item in ingestion_mappings or [] if isinstance(item, dict)]
    merged["rules"] = dict(_DEFAULT_CONFIG["rules"])
    if isinstance(rules, dict):
        merged["rules"].update(rules)

    return merged


def _normalize_node_type(node_type: Dict[str, Any]) -> Dict[str, Any]:
    node_type_id = str(node_type.get("id") or "").strip()
    label = str(node_type.get("label") or node_type_id).strip()
    icon = str(node_type.get("icon") or node_type_id or "circle").strip() or node_type_id or "circle"

    raw_visual = node_type.get("default_visual")
    visual = raw_visual if isinstance(raw_visual, dict) else {}
    raw_attributes = node_type.get("attributes")
    attributes = raw_attributes if isinstance(raw_attributes, list) else []

    normalized_attributes = [
        normalized
        for item in attributes
        if isinstance(item, dict)
        for normalized in [_normalize_attribute_definition(item)]
        if normalized
    ]
    attribute_keys = {str(item.get("key") or "").strip() for item in normalized_attributes}
    requested_identity = str(node_type.get("identity_attribute") or "").strip()
    identity_attribute = requested_identity if requested_identity in attribute_keys else ""

    return {
        "id": node_type_id,
        "label": label,
        "icon": icon,
        "identity_attribute": identity_attribute,
        "default_visual": {
            "color": str(visual.get("color") or "#475569"),
            "iconScale": float(visual.get("iconScale") or 1.9),
            "ringEnabled": bool(visual.get("ringEnabled", False)),
            "ringWidth": float(visual.get("ringWidth") or 1.5),
        },
        "attributes": normalized_attributes,
    }


def _normalize_edge_type(edge_type: Dict[str, Any]) -> Dict[str, Any]:
    edge_type_id = str(edge_type.get("id") or "").strip()
    label = str(edge_type.get("label") or edge_type_id).strip()
    legacy_from = _normalize_type_list(edge_type.get("allowed_from"))
    legacy_to = _normalize_type_list(edge_type.get("allowed_to"))
    from_type = str(edge_type.get("from_type") or (legacy_from[0] if legacy_from else "")).strip()
    to_type = str(edge_type.get("to_type") or (legacy_to[0] if legacy_to else "")).strip()
    attributes = edge_type.get("attributes") if isinstance(edge_type.get("attributes"), list) else []
    visual = edge_type.get("default_visual") if isinstance(edge_type.get("default_visual"), dict) else {}
    plugin_id = str(edge_type.get("plugin_id") or "").strip()
    context_menu_section = str(edge_type.get("context_menu_section") or "").strip()
    context_menu_label = str(edge_type.get("context_menu_label") or "").strip()
    try:
        menu_order = int(edge_type.get("menu_order")) if edge_type.get("menu_order") not in (None, "") else 0
    except (TypeError, ValueError):
        menu_order = 0
    directed = bool(edge_type.get("directed", False))
    system = bool(edge_type.get("system", False))
    direction = str(visual.get("direction") or ("to" if directed else "both")).strip() or "both"
    if direction == "from":
        direction = "to"
    directed = direction != "both"
    return {
        "id": edge_type_id, "label": label, "from_type": from_type, "to_type": to_type, "system": system,
        "supports_reverse": bool(edge_type.get("supports_reverse", direction == "both" or not directed)),
        "allowed_from": [from_type] if from_type else [], "allowed_to": [to_type] if to_type else [],
        "default_visual": {"color": str(visual.get("color") or "#475569"), "width": float(visual.get("width") or 2), "direction": direction, "dashed": bool(visual.get("dashed", False))},
        "attributes": [normalized for item in attributes if isinstance(item, dict) for normalized in [_normalize_attribute_definition(item)] if normalized],
        "directed": directed, "plugin_id": plugin_id or None, "show_in_context_menu": bool(edge_type.get("show_in_context_menu", False)),
        "context_menu_section": context_menu_section or None, "context_menu_label": context_menu_label or None, "menu_order": menu_order,
    }

def _normalize_attribute_definition(attribute: Dict[str, Any]) -> Dict[str, Any]:
    key = str(attribute.get("key") or "").strip()
    if not key:
        return {}
    normalized: Dict[str, Any] = {
        "key": key,
        "type": str(attribute.get("type") or "string").strip() or "string",
        "label": str(attribute.get("label") or key).strip(),
    }
    if "required" in attribute:
        normalized["required"] = bool(attribute.get("required"))
    if "multiline" in attribute:
        normalized["multiline"] = bool(attribute.get("multiline"))
    return normalized


def _normalize_type_list(value: Any) -> List[str]:
    if not isinstance(value, list):
        return []
    result: List[str] = []
    seen = set()
    for item in value:
        normalized = str(item or "").strip()
        if not normalized:
            continue
        lowered = normalized.lower()
        if lowered in seen:
            continue
        seen.add(lowered)
        result.append(normalized)
    return result


def _normalize_fact_type(fact_type: Dict[str, Any]) -> Dict[str, Any]:
    fact_type_id = str(fact_type.get("id") or "").strip()
    return {
        "id": fact_type_id,
        "label": str(fact_type.get("label") or fact_type_id).strip(),
        "attributes": [
            normalized
            for item in (fact_type.get("attributes") or [])
            if isinstance(item, dict)
            for normalized in [_normalize_attribute_definition(item)]
            if normalized
        ],
    }


def _normalize_ingestion_mapping(mapping: Dict[str, Any]) -> Dict[str, Any]:
    mapping_id = str(mapping.get("id") or "").strip()
    source = str(mapping.get("source") or "").strip()
    fact = mapping.get("fact") if isinstance(mapping.get("fact"), dict) else {}
    entities = mapping.get("entities") if isinstance(mapping.get("entities"), list) else []
    relations = mapping.get("relations") if isinstance(mapping.get("relations"), list) else []
    return {
        "id": mapping_id,
        "label": str(mapping.get("label") or mapping_id or source).strip(),
        "source": source,
        "fact": dict(fact),
        "entities": [dict(item) for item in entities if isinstance(item, dict)],
        "relations": [dict(item) for item in relations if isinstance(item, dict)],
    }