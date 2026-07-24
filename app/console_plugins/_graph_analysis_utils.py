from __future__ import annotations

from collections import defaultdict
from typing import Any, Dict, Iterable, List, Optional, Set, Tuple

from app.services.domain_model_service import get_domain_model


def graph_payload(artifact: Optional[Dict[str, Any]]) -> Tuple[List[Dict[str, Any]], List[Dict[str, Any]]]:
    data = artifact.get("data") if isinstance(artifact, dict) else None
    if not isinstance(data, dict):
        return [], []
    nodes = data.get("nodes") if isinstance(data.get("nodes"), list) else []
    edges = data.get("edges") if isinstance(data.get("edges"), list) else []
    return [item for item in nodes if isinstance(item, dict)], [item for item in edges if isinstance(item, dict)]


def node_id(node: Dict[str, Any]) -> str:
    return str(node.get("id") or node.get("node_id") or "").strip()


def node_label(node: Dict[str, Any]) -> str:
    attrs = node.get("attributes") if isinstance(node.get("attributes"), dict) else {}
    visual = attrs.get("visual") if isinstance(attrs.get("visual"), dict) else {}
    return str(node.get("label") or visual.get("label") or attrs.get("label") or attrs.get("name") or node_id(node)).strip()


def edge_endpoints(edge: Dict[str, Any]) -> Tuple[str, str]:
    source = str(edge.get("from") or edge.get("source") or edge.get("source_node") or "").strip()
    target = str(edge.get("to") or edge.get("target") or edge.get("target_node") or "").strip()
    return source, target


def selected_node_ids(context: Optional[Dict[str, Any]]) -> Set[str]:
    ctx = context if isinstance(context, dict) else {}
    raw_items = ctx.get("selected_node_ids")
    if not isinstance(raw_items, list) or not raw_items:
        raw_items = ctx.get("selected_nodes") if isinstance(ctx.get("selected_nodes"), list) else []
    result: Set[str] = set()
    for item in raw_items:
        value = node_id(item) if isinstance(item, dict) else str(item or "").strip()
        if value:
            result.add(value)
    return result


def domain_labels() -> Tuple[Dict[str, str], Dict[str, str]]:
    model = get_domain_model()
    node_types = model.get("node_types") if isinstance(model, dict) else []
    edge_types = model.get("edge_types") if isinstance(model, dict) else []
    node_labels = {
        str(item.get("id") or ""): str(item.get("label") or item.get("id") or "")
        for item in node_types
        if isinstance(item, dict) and item.get("id")
    }
    edge_labels = {
        str(item.get("id") or ""): str(item.get("label") or item.get("id") or "")
        for item in edge_types
        if isinstance(item, dict) and item.get("id")
    }
    return node_labels, edge_labels


def adjacency(nodes: Iterable[Dict[str, Any]], edges: Iterable[Dict[str, Any]]) -> Dict[str, Set[str]]:
    result: Dict[str, Set[str]] = defaultdict(set)
    for node in nodes:
        identifier = node_id(node)
        if identifier:
            result[identifier]
    for edge in edges:
        source, target = edge_endpoints(edge)
        if source and target and source != target:
            result[source].add(target)
            result[target].add(source)
    return result


def column(key: str, label: str, data_type: str = "string", width: int = 180) -> Dict[str, Any]:
    return {
        "key": key,
        "original_name": key,
        "label": label,
        "type": data_type,
        "width": width,
        "visible": True,
    }


def tab(tab_id: str, name: str, columns: List[Dict[str, Any]], rows: List[Dict[str, Any]]) -> Dict[str, Any]:
    return {"id": tab_id, "name": name, "columns": columns, "rows": rows, "row_count": len(rows)}
