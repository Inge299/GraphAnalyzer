from __future__ import annotations

from typing import Any, Dict, Iterable, Optional

from app.services.domain_model_service import get_domain_model


def get_graph_rules() -> Dict[str, Any]:
    model = get_domain_model()
    rules = model.get("rules") if isinstance(model, dict) else {}
    if not isinstance(rules, dict):
        rules = {}
    return {
        "merge_nodes_with_same_label": bool(rules.get("merge_nodes_with_same_label", False)),
        "allow_parallel_edges": bool(rules.get("allow_parallel_edges", True)),
    }


def get_node_type_definition(node_type_id: str) -> Optional[Dict[str, Any]]:
    model = get_domain_model()
    node_types = model.get("node_types") if isinstance(model, dict) else []
    if not isinstance(node_types, list):
        return None
    normalized = str(node_type_id or "").strip().lower()
    if not normalized:
        return None
    for node_type in node_types:
        if not isinstance(node_type, dict):
            continue
        if str(node_type.get("id") or "").strip().lower() == normalized:
            return node_type
    return None


def get_edge_type_definition(edge_type_id: str) -> Optional[Dict[str, Any]]:
    model = get_domain_model()
    edge_types = model.get("edge_types") if isinstance(model, dict) else []
    if not isinstance(edge_types, list):
        return None
    normalized = str(edge_type_id or "").strip().lower()
    if not normalized:
        return None
    for edge_type in edge_types:
        if not isinstance(edge_type, dict):
            continue
        if str(edge_type.get("id") or "").strip().lower() == normalized:
            return edge_type
    return None


def resolve_edge_type(from_type: str, to_type: str) -> str:
    model = get_domain_model()
    edge_types = model.get("edge_types") if isinstance(model, dict) else []
    if not isinstance(edge_types, list):
        return "connected_to"

    for edge_type in edge_types:
        if not isinstance(edge_type, dict):
            continue
        allowed_from = edge_type.get("allowed_from") or []
        allowed_to = edge_type.get("allowed_to") or []
        if _matches(allowed_from, from_type) and _matches(allowed_to, to_type):
            return str(edge_type.get("id") or "connected_to")

    return "connected_to"


def resolve_edge_label(edge_type_id: str, fallback_label: str = "") -> str:
    definition = get_edge_type_definition(edge_type_id)
    if isinstance(definition, dict):
        label = str(definition.get("label") or "").strip()
        if label:
            return label
    return fallback_label


def get_node_visual_defaults(node_type_id: str) -> Dict[str, Any]:
    definition = get_node_type_definition(node_type_id)
    visual = definition.get("default_visual") if isinstance(definition, dict) and isinstance(definition.get("default_visual"), dict) else {}
    return {
        "icon": str(definition.get("icon") or "circle") if isinstance(definition, dict) else "circle",
        "color": str(visual.get("color") or "#475569"),
        "iconScale": float(visual.get("iconScale") or 1.9),
        "ringWidth": float(visual.get("ringWidth") or 1.5),
        "ringEnabled": bool(visual.get("ringEnabled", False)),
    }


def find_node_by_label(nodes: Iterable[Dict[str, Any]], label: str) -> Optional[Dict[str, Any]]:
    normalized = label.strip().lower()
    if not normalized:
        return None

    for node in nodes:
        node_label = str(_get_node_label(node)).strip().lower()
        if node_label and node_label == normalized:
            return node
    return None


def edge_exists(edges: Iterable[Dict[str, Any]], from_id: str, to_id: str, edge_type: str) -> bool:
    for edge in edges:
        src = str(edge.get("from") or edge.get("source_node") or "")
        dst = str(edge.get("to") or edge.get("target_node") or "")
        current_type = str(edge.get("type") or "")
        if src == from_id and dst == to_id and current_type == edge_type:
            return True
    return False


def _matches(values: Any, item_type: str) -> bool:
    if not isinstance(values, list):
        return False
    return "*" in values or item_type in values


def _get_node_label(node: Dict[str, Any]) -> str:
    attributes = node.get("attributes") or {}
    visual = attributes.get("visual") or {}
    return (
        str(node.get("label") or "")
        or str(visual.get("label") or "")
        or str(attributes.get("label") or "")
        or str(attributes.get("name") or "")
    )
