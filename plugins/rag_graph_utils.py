"""Helpers for RAG plugins that enrich graph artifacts."""

from __future__ import annotations

from datetime import datetime
from typing import Any, Dict, Iterable, List, Optional

from app.services.domain_model_service import get_domain_model
from plugins.graph_domain import edge_exists, resolve_edge_type


def node_id(node: Dict[str, Any]) -> str:
    return str(node.get("id") or node.get("node_id") or "")


def node_label(node: Dict[str, Any]) -> str:
    attributes = node.get("attributes") or {}
    visual = attributes.get("visual") or {}
    return str(
        node.get("label")
        or visual.get("label")
        or attributes.get("label")
        or attributes.get("name")
        or node_id(node)
        or ""
    ).strip()


def build_nodes_index(nodes: Iterable[Dict[str, Any]]) -> Dict[str, Dict[str, Any]]:
    by_id: Dict[str, Dict[str, Any]] = {}
    for node in nodes:
        nid = node_id(node)
        if nid:
            by_id[nid] = node
    return by_id


def _max_numeric_suffix(items: Iterable[Dict[str, Any]], key: str, prefix: str) -> int:
    max_value = 0
    for item in items:
        raw = str(item.get(key) or "")
        if not raw.startswith(prefix):
            continue
        try:
            value = int(raw[len(prefix):])
            if value > max_value:
                max_value = value
        except Exception:
            continue
    return max_value


def next_node_id(nodes: List[Dict[str, Any]]) -> str:
    return f"auto_node_{_max_numeric_suffix(nodes, 'id', 'auto_node_') + 1}"


def next_edge_id(edges: List[Dict[str, Any]]) -> str:
    return f"auto_edge_{_max_numeric_suffix(edges, 'id', 'auto_edge_') + 1}"


def get_node_type_defaults(node_type: str) -> Dict[str, Any]:
    model = get_domain_model()
    for entry in model.get("node_types") or []:
        if str(entry.get("id")) == node_type:
            return dict(entry.get("default_visual") or {})
    return {}


def has_node_type(node_type: str) -> bool:
    model = get_domain_model()
    for entry in model.get("node_types") or []:
        if str(entry.get("id")) == node_type:
            return True
    return False


def resolve_object_document_edge_type(from_type: str) -> str:
    model = get_domain_model()
    edge_types = model.get("edge_types") or []
    for edge_type in edge_types:
        if not isinstance(edge_type, dict):
            continue
        if str(edge_type.get("id")) == "object_document":
            return "object_document"
    return resolve_edge_type(from_type, "document")


def find_node_by_type_and_label(nodes: Iterable[Dict[str, Any]], node_type: str, label: str) -> Optional[Dict[str, Any]]:
    target = label.strip().lower()
    if not target:
        return None
    for node in nodes:
        if str(node.get("type") or "") != node_type:
            continue
        if node_label(node).strip().lower() == target:
            return node
    return None


def normalize_document_key(document_id: str = "", source: str = "", title: str = "") -> str:
    src = str(source or "").strip()
    doc_id = str(document_id or "").strip()
    doc_title = str(title or "").strip()
    return (src or doc_id or doc_title).strip()


def find_document_node(nodes: Iterable[Dict[str, Any]], document_id: str, title: str, source: str = "") -> Optional[Dict[str, Any]]:
    normalized_key = normalize_document_key(document_id=document_id, source=source, title=title).lower()
    normalized_id = str(document_id or "").strip().lower()
    normalized_source = str(source or "").strip().lower()
    normalized_title = str(title or "").strip().lower()
    for node in nodes:
        if str(node.get("type") or "") != "document":
            continue
        attrs = node.get("attributes") or {}
        existing_doc_key = str(attrs.get("document_key") or "").strip().lower()
        existing_doc_id = str(attrs.get("document_id") or "").strip().lower()
        existing_source = str(attrs.get("source") or "").strip().lower()
        existing_title = node_label(node).strip().lower()

        if normalized_key and existing_doc_key and existing_doc_key == normalized_key:
            return node

        # Приоритет идентификации: source(полный путь) -> document_id -> title.
        if normalized_source and existing_source and existing_source == normalized_source:
            return node

        if normalized_id and existing_doc_id and existing_doc_id == normalized_id:
            return node

        # Сопоставление по title допускаем только когда нет source/id.
        if (not normalized_source) and (not normalized_id) and normalized_title and existing_title == normalized_title:
            return node
    return None


def ensure_document_node(nodes: List[Dict[str, Any]], document_id: str, title: str, source: str = "", excerpt: str = "") -> Dict[str, Any]:
    document_key = normalize_document_key(document_id=document_id, source=source, title=title)
    existing = find_document_node(nodes, document_id=document_id, title=title, source=source)
    if existing:
        attrs = existing.setdefault("attributes", {})
        if document_key:
            attrs["document_key"] = document_key
        if document_id and not attrs.get("document_id"):
            attrs["document_id"] = document_id
        if source:
            attrs["source"] = source
        if excerpt:
            attrs["excerpt"] = excerpt
        visual = attrs.setdefault("visual", {})
        visual.setdefault("icon", "file")
        visual.setdefault("ringEnabled", False)
        visual.setdefault("ringWidth", 0)
        return existing

    defaults = get_node_type_defaults("document")
    visual = {
        "color": defaults.get("color", "#64748b"),
        "iconScale": defaults.get("iconScale", 2),
        "ringEnabled": False,
        "ringWidth": 0,
        "icon": "file",
    }

    node = {
        "id": next_node_id(nodes),
        "type": "document",
        "label": title or source or document_id or "Документ",
        "position_x": 0,
        "position_y": 0,
        "attributes": {
            "label": title or source or document_id or "Документ",
            "document_key": document_key,
            "document_id": document_id,
            "source": source,
            "excerpt": excerpt,
            "visual": visual,
        },
    }
    nodes.append(node)
    return node


def ensure_object_node(nodes: List[Dict[str, Any]], object_type: str, label: str, attrs: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
    effective_type = object_type if has_node_type(object_type) else "person"
    attrs = attrs or {}
    incoming_visual = attrs.get("visual") if isinstance(attrs.get("visual"), dict) else {}

    existing = find_node_by_type_and_label(nodes, effective_type, label)
    if existing:
        existing_attrs = existing.setdefault("attributes", {})
        for key, value in attrs.items():
            if key == "visual":
                continue
            if key not in existing_attrs and value not in (None, ""):
                existing_attrs[key] = value

        visual = existing_attrs.setdefault("visual", {})
        for key, value in incoming_visual.items():
            if value not in (None, ""):
                visual[key] = value
        visual.setdefault("ringEnabled", False)
        visual.setdefault("ringWidth", 0)
        return existing

    defaults = get_node_type_defaults(effective_type)
    visual = {
        "color": defaults.get("color", "#2563eb"),
        "iconScale": defaults.get("iconScale", 2),
        "ringEnabled": False,
        "ringWidth": 0,
    }
    for key, value in incoming_visual.items():
        if value not in (None, ""):
            visual[key] = value

    plain_attrs = {k: v for k, v in attrs.items() if k != "visual"}

    node = {
        "id": next_node_id(nodes),
        "type": effective_type,
        "label": label,
        "position_x": 0,
        "position_y": 0,
        "attributes": {
            "label": label,
            **plain_attrs,
            "visual": visual,
        },
    }
    nodes.append(node)
    return node


def ensure_edge(
    edges: List[Dict[str, Any]],
    from_id: str,
    to_id: str,
    edge_type: str,
    attributes: Optional[Dict[str, Any]] = None,
) -> Dict[str, Any]:
    if edge_exists(edges, from_id, to_id, edge_type):
        for edge in edges:
            if str(edge.get("type") or "") == edge_type and str(edge.get("from") or edge.get("source_node") or "") == from_id and str(edge.get("to") or edge.get("target_node") or "") == to_id:
                return edge

    visual = {
        "color": "#22c55e" if edge_type == "object_document" else "#475569",
        "width": 2,
        "direction": "both",
        "dashed": False,
    }
    edge = {
        "id": next_edge_id(edges),
        "from": from_id,
        "to": to_id,
        "type": edge_type,
        "label": "содержится" if edge_type == "object_document" else edge_type,
        "attributes": {
            **(attributes or {}),
            "visual": {**visual, **((attributes or {}).get("visual") or {})},
        },
    }
    edges.append(edge)
    return edge


def normalize_relations_payload(payload: Any) -> List[Dict[str, Any]]:
    """Accept multiple response shapes from RAG and normalize to relation items."""
    if isinstance(payload, dict):
        for key in ("relations", "items", "results", "data"):
            value = payload.get(key)
            if isinstance(value, list):
                return [item for item in value if isinstance(item, dict)]
        if isinstance(payload.get("documents"), list):
            return [item for item in payload.get("documents") if isinstance(item, dict)]
    if isinstance(payload, list):
        return [item for item in payload if isinstance(item, dict)]
    return []


def fmt_dt(value: Any) -> str:
    if value in (None, ""):
        return ""
    if isinstance(value, datetime):
        return value.isoformat()
    return str(value)


def relation_object_payload(relation: Dict[str, Any]) -> Dict[str, Any]:
    nested = relation.get("object")
    if isinstance(nested, dict):
        return nested
    return relation


def relation_document_payload(relation: Dict[str, Any]) -> Dict[str, Any]:
    nested = relation.get("document")
    if isinstance(nested, dict):
        return nested
    return relation


def relation_object_node_id(relation: Dict[str, Any]) -> str:
    obj = relation_object_payload(relation)
    return str(
        relation.get("object_node_id")
        or relation.get("node_id")
        or obj.get("node_id")
        or obj.get("id")
        or relation.get("object_id")
        or ""
    ).strip()


def relation_object_type(relation: Dict[str, Any]) -> str:
    obj = relation_object_payload(relation)
    return str(
        relation.get("object_type")
        or obj.get("type")
        or relation.get("type")
        or ""
    ).strip()


def relation_object_label(relation: Dict[str, Any]) -> str:
    obj = relation_object_payload(relation)
    return str(
        relation.get("object_label")
        or obj.get("label")
        or relation.get("label")
        or relation.get("phone")
        or ""
    ).strip()


def relation_document_id(relation: Dict[str, Any]) -> str:
    doc = relation_document_payload(relation)
    return str(
        relation.get("file_path")
        or doc.get("file_path")
        or relation.get("document_id")
        or relation.get("doc_id")
        or doc.get("document_id")
        or doc.get("doc_id")
        or doc.get("id")
        or relation.get("id")
        or ""
    ).strip()


def relation_document_title(relation: Dict[str, Any]) -> str:
    doc = relation_document_payload(relation)
    return str(
        relation.get("document_title")
        or doc.get("title")
        or relation.get("title")
        or relation.get("document")
        or "Документ"
    ).strip()


def relation_document_source(relation: Dict[str, Any]) -> str:
    doc = relation_document_payload(relation)
    return str(
        relation.get("source")
        or relation.get("document_source")
        or relation.get("file_path")
        or doc.get("source")
        or doc.get("file_path")
        or ""
    ).strip()


def relation_document_excerpt(relation: Dict[str, Any]) -> str:
    doc = relation_document_payload(relation)
    return str(
        relation.get("excerpt")
        or relation.get("snippet")
        or relation.get("text")
        or doc.get("excerpt")
        or doc.get("snippet")
        or ""
    ).strip()














