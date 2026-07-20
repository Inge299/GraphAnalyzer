"""Plugins: build graph links from project data fact tables."""

from __future__ import annotations

import math
import random
from datetime import datetime
from typing import Any, Dict, Iterable, List, Optional, Sequence, Tuple

from sqlalchemy import bindparam, text

from app.database import AsyncSessionLocal
from app.services.domain_model_service import get_domain_model
from plugins import PluginBase


def _node_id(node: Dict[str, Any]) -> str:
    return str(node.get("id") or node.get("node_id") or "").strip()


def _node_label(node: Dict[str, Any]) -> str:
    attributes = node.get("attributes") or {}
    visual = attributes.get("visual") or {}
    return str(
        node.get("label")
        or visual.get("label")
        or attributes.get("label")
        or attributes.get("name")
        or _node_id(node)
        or ""
    ).strip()


def _normalize_text(value: Any) -> str:
    return str(value or "").strip()


def _normalize_phone(value: Any) -> str:
    digits = "".join(ch for ch in str(value or "") if ch.isdigit())
    if len(digits) == 11 and digits.startswith("8"):
        return "7" + digits[1:]
    if len(digits) == 10:
        return "7" + digits
    return digits or str(value or "").strip()


def _as_datetime(value: Any) -> Optional[datetime]:
    if isinstance(value, datetime):
        return value
    raw = str(value or "").strip().replace("T", " ")
    if not raw:
        return None
    for pattern in ("%Y-%m-%d %H:%M:%S", "%Y-%m-%d %H:%M", "%Y-%m-%d", "%d.%m.%Y %H:%M:%S", "%d.%m.%Y %H:%M"):
        try:
            return datetime.strptime(raw, pattern)
        except Exception:
            continue
    try:
        return datetime.fromisoformat(raw)
    except Exception:
        return None


def _format_dt(value: Any) -> str:
    dt = _as_datetime(value)
    if dt is None:
        return _normalize_text(value)
    if dt.hour == 0 and dt.minute == 0 and dt.second == 0:
        return dt.strftime("%d.%m.%Y")
    return dt.strftime("%d.%m.%Y %H:%M")


def _dedupe_preserve_order(items: Iterable[str]) -> List[str]:
    seen: set[str] = set()
    result: List[str] = []
    for item in items:
        value = item.strip()
        if not value or value in seen:
            continue
        seen.add(value)
        result.append(value)
    return result


class _ProjectDataLinkPluginBase(PluginBase):
    input_types = ["graph"]
    output_types = ["graph"]
    applicable_to = ["graph"]
    output_strategy = {
        "mode": "update_current",
        "history_action": "plugin_execute",
    }
    plugin_scope = "context"
    menu_path = "Связи"

    def __init__(self) -> None:
        self._new_node_sequence = 0
        self._rng = random.Random()

    @staticmethod
    def _node_xy(node: Optional[Dict[str, Any]]) -> Tuple[float, float]:
        if not isinstance(node, dict):
            return (0.0, 0.0)
        return (float(node.get("position_x") or 0.0), float(node.get("position_y") or 0.0))

    def _pick_new_node_position(
        self,
        nodes: List[Dict[str, Any]],
        anchor_node: Optional[Dict[str, Any]] = None,
    ) -> Tuple[float, float]:
        ax, ay = self._node_xy(anchor_node)
        min_distance = 140.0
        radius_step = 90.0

        for attempt in range(48):
            ring = (self._new_node_sequence + attempt) // 10
            angle = self._rng.uniform(0.0, 2.0 * math.pi)
            radius = self._rng.uniform(130.0, 280.0) + ring * radius_step
            x = ax + radius * math.cos(angle)
            y = ay + radius * math.sin(angle)
            collision = False
            for existing in nodes:
                ex, ey = self._node_xy(existing)
                if math.hypot(x - ex, y - ey) < min_distance:
                    collision = True
                    break
            if not collision:
                self._new_node_sequence = self._new_node_sequence + attempt + 1
                return (round(x, 1), round(y, 1))
        self._new_node_sequence += 1
        return (ax + 240.0, ay)

    @staticmethod
    def _next_node_id(nodes: List[Dict[str, Any]], prefix: str = "auto_node_") -> str:
        existing = {_node_id(node) for node in nodes}
        index = 1
        while True:
            candidate = f"{prefix}{index}"
            if candidate not in existing:
                return candidate
            index += 1

    @staticmethod
    def _next_edge_id(edges: List[Dict[str, Any]], prefix: str = "auto_edge_") -> str:
        existing = {str(edge.get("id") or "") for edge in edges}
        index = 1
        while True:
            candidate = f"{prefix}{index}"
            if candidate not in existing:
                return candidate
            index += 1

    @staticmethod
    def _person_visual_defaults() -> Dict[str, Any]:
        model = get_domain_model()
        node_types = model.get("node_types") if isinstance(model, dict) else []
        if isinstance(node_types, list):
            for node_type in node_types:
                if not isinstance(node_type, dict):
                    continue
                if str(node_type.get("id") or "") != "person":
                    continue
                visual = node_type.get("default_visual") if isinstance(node_type.get("default_visual"), dict) else {}
                return {
                    "icon": str(node_type.get("icon") or "person_phone"),
                    "color": str(visual.get("color") or "#2563eb"),
                    "iconScale": float(visual.get("iconScale") or 2.0),
                    "ringWidth": float(visual.get("ringWidth") or 1.5),
                }
        return {
            "icon": "person_phone",
            "color": "#2563eb",
            "iconScale": 2.0,
            "ringWidth": 1.5,
        }

    @classmethod
    def _visual_defaults_for_type(cls, node_type: str) -> Dict[str, Any]:
        if node_type == "person":
            return cls._person_visual_defaults()
        palette = {
            "user_id": {"icon": "badge", "color": "#7c3aed"},
            "ip": {"icon": "globe", "color": "#0f766e"},
            "device_profile": {"icon": "smartphone", "color": "#ea580c"},
            "text_bundle": {"icon": "file_text", "color": "#334155"},
        }
        defaults = palette.get(node_type, {"icon": "circle", "color": "#475569"})
        return {
            "icon": defaults["icon"],
            "color": defaults["color"],
            "iconScale": 1.9,
            "ringWidth": 1.5,
        }

    @classmethod
    def _canonical_label(cls, node_type: str, label: str) -> str:
        if node_type == "person":
            return _normalize_phone(label)
        return _normalize_text(label)

    def _find_or_create_node(
        self,
        nodes: List[Dict[str, Any]],
        node_type: str,
        label: str,
        anchor_node: Optional[Dict[str, Any]] = None,
        extra_attributes: Optional[Dict[str, Any]] = None,
    ) -> Dict[str, Any]:
        canonical = self._canonical_label(node_type, label).lower()
        for node in nodes:
            if str(node.get("type") or "").strip().lower() != node_type.lower():
                continue
            if self._canonical_label(node_type, _node_label(node)).lower() == canonical:
                if extra_attributes:
                    self._merge_node_attributes(node, extra_attributes)
                return node

        visual_defaults = self._visual_defaults_for_type(node_type)
        node_id = self._next_node_id(nodes)
        x, y = self._pick_new_node_position(nodes, anchor_node=anchor_node)
        attributes: Dict[str, Any] = {
            "label": label,
            "visual": {
                "label": label,
                "icon": visual_defaults["icon"],
                "color": visual_defaults["color"],
                "iconScale": visual_defaults["iconScale"],
                "ringEnabled": False,
                "ringWidth": visual_defaults["ringWidth"],
                "fontColor": "#0f172a",
            },
        }
        if extra_attributes:
            attributes.update(extra_attributes)
        node = {
            "id": node_id,
            "type": node_type,
            "label": label,
            "position_x": x,
            "position_y": y,
            "attributes": attributes,
        }
        nodes.append(node)
        return node

    @staticmethod
    def _merge_node_attributes(node: Dict[str, Any], extra_attributes: Dict[str, Any]) -> None:
        attributes = node.get("attributes")
        if not isinstance(attributes, dict):
            attributes = {}
            node["attributes"] = attributes
        visual = attributes.get("visual")
        if not isinstance(visual, dict):
            visual = {}
            attributes["visual"] = visual
        for key, value in extra_attributes.items():
            if key == "visual" and isinstance(value, dict):
                visual.update(value)
                continue
            if isinstance(value, list):
                existing = attributes.get(key)
                base = existing if isinstance(existing, list) else []
                attributes[key] = _dedupe_preserve_order([*(str(item) for item in base), *(str(item) for item in value)])
                continue
            if isinstance(value, str):
                current = _normalize_text(attributes.get(key))
                if current:
                    if current != value:
                        attributes[key] = "\n".join(_dedupe_preserve_order([current, value]))
                else:
                    attributes[key] = value
                continue
            attributes[key] = value

    @staticmethod
    def _find_existing_edge(edges: List[Dict[str, Any]], left_id: str, right_id: str, edge_type: str) -> Optional[Dict[str, Any]]:
        for edge in edges:
            if str(edge.get("type") or "") != edge_type:
                continue
            src = str(edge.get("from") or edge.get("source_node") or "")
            dst = str(edge.get("to") or edge.get("target_node") or "")
            if (src == left_id and dst == right_id) or (src == right_id and dst == left_id):
                return edge
        return None

    @staticmethod
    def _build_edge_label(event_times: Sequence[str]) -> str:
        cleaned = [value for value in event_times if value]
        if not cleaned:
            return ""
        if len(cleaned) == 1:
            return cleaned[0]
        return f"событий: {len(cleaned)}\nпоследнее: {cleaned[-1]}"

    def _build_edge(
        self,
        edges: List[Dict[str, Any]],
        from_id: str,
        to_id: str,
        edge_type: str,
        event_time: Optional[str],
        relation_label: str,
    ) -> Dict[str, Any]:
        edge_id = self._next_edge_id(edges)
        event_times = [event_time] if event_time else []
        edge_label = self._build_edge_label(event_times)
        return {
            "id": edge_id,
            "type": edge_type,
            "from": from_id,
            "to": to_id,
            "label": edge_label,
            "attributes": {
                "relation": relation_label,
                "event_time": event_times[-1] if event_times else "",
                "event_times": event_times,
                "events_count": len(event_times),
                "visual": {
                    "label": edge_label,
                    "direction": "both",
                },
            },
        }

    def _merge_edge_event(self, edge: Dict[str, Any], event_time: Optional[str]) -> None:
        attributes = edge.get("attributes")
        if not isinstance(attributes, dict):
            attributes = {}
            edge["attributes"] = attributes
        visual = attributes.get("visual")
        if not isinstance(visual, dict):
            visual = {}
            attributes["visual"] = visual
        current_times = attributes.get("event_times") if isinstance(attributes.get("event_times"), list) else []
        next_times = _dedupe_preserve_order([*(str(item) for item in current_times), str(event_time or "")])
        attributes["event_times"] = next_times
        attributes["events_count"] = len(next_times)
        attributes["event_time"] = next_times[-1] if next_times else ""
        edge_label = self._build_edge_label(next_times)
        edge["label"] = edge_label
        visual["label"] = edge_label
        visual["direction"] = "both"

    @staticmethod
    def _selected_nodes(nodes: List[Dict[str, Any]], context: Optional[Dict[str, Any]]) -> List[Dict[str, Any]]:
        ctx = context if isinstance(context, dict) else {}
        selected_ids = {str(item) for item in (ctx.get("selected_nodes") or [])}
        return [node for node in nodes if _node_id(node) in selected_ids]


class UserMsisdnLinksPlugin(_ProjectDataLinkPluginBase):
    id = "project_user_msisdn_links"
    name = "Пользователь <-> MSISDN"
    version = "0.1.0"
    description = "Строит связи между идентификатором пользователя и номером телефона из данных проекта"

    def is_applicable_with_context(self, input_artifacts: List[Dict[str, Any]], context: Optional[Dict[str, Any]] = None) -> bool:
        if not input_artifacts:
            return False
        graph = input_artifacts[0] if isinstance(input_artifacts[0], dict) else {}
        data = graph.get("data") if isinstance(graph.get("data"), dict) else {}
        selected_nodes = self._selected_nodes(list(data.get("nodes") or []), context)
        return any(str(node.get("type") or "").strip().lower() in {"person", "abonent", "subscriber", "msisdn", "user_id"} for node in selected_nodes)

    async def execute(self, input_artifacts: List[Dict[str, Any]], params: Optional[Dict[str, Any]] = None) -> List[Dict[str, Any]]:
        return await self._execute_links(input_artifacts, params)

    async def _execute_links(self, input_artifacts: List[Dict[str, Any]], params: Optional[Dict[str, Any]]) -> List[Dict[str, Any]]:
        graph = input_artifacts[0]
        data = dict(graph.get("data") or {})
        nodes = list(data.get("nodes") or [])
        edges = list(data.get("edges") or [])
        params_dict = params if isinstance(params, dict) else {}
        context = params_dict.get("_context") if isinstance(params_dict.get("_context"), dict) else {}
        selected_nodes = self._selected_nodes(nodes, context)

        selected_msisdns = _dedupe_preserve_order(
            _normalize_phone(_node_label(node))
            for node in selected_nodes
            if str(node.get("type") or "").strip().lower() in {"person", "abonent", "subscriber", "msisdn"}
        )
        selected_user_ids = _dedupe_preserve_order(
            _normalize_text(_node_label(node))
            for node in selected_nodes
            if str(node.get("type") or "").strip().lower() in {"user_id"}
        )

        rows = await self._load_rows(int(graph.get("project_id") or params_dict.get("project_id") or 0), selected_msisdns, selected_user_ids)
        if not rows:
            return [self._wrap_graph(graph, data, nodes, edges, {"source_plugin": self.id, "rows_count": 0})]

        for row in rows:
            user_id = _normalize_text(row.get("user_id"))
            msisdn = _normalize_phone(row.get("user_msisdn"))
            if not user_id or not msisdn:
                continue
            anchor = next((node for node in selected_nodes if _normalize_phone(_node_label(node)) == msisdn or _normalize_text(_node_label(node)) == user_id), None)
            user_node = self._find_or_create_node(nodes, "user_id", user_id, anchor_node=anchor)
            msisdn_node = self._find_or_create_node(nodes, "person", msisdn, anchor_node=user_node)
            event_time = _format_dt(row.get("event_time"))
            edge = self._find_existing_edge(edges, _node_id(user_node), _node_id(msisdn_node), "user_msisdn_link")
            if edge is None:
                edges.append(self._build_edge(edges, _node_id(user_node), _node_id(msisdn_node), "user_msisdn_link", event_time, self.name))
            else:
                self._merge_edge_event(edge, event_time)

        return [self._wrap_graph(graph, data, nodes, edges, {"source_plugin": self.id, "rows_count": len(rows)})]

    async def _load_rows(self, project_id: int, msisdns: List[str], user_ids: List[str]) -> List[Dict[str, Any]]:
        if project_id <= 0 or (not msisdns and not user_ids):
            return []
        clauses: List[str] = []
        params: Dict[str, Any] = {"project_id": project_id}
        if msisdns:
            clauses.append("user_msisdn IN :msisdns")
            params["msisdns"] = msisdns
        if user_ids:
            clauses.append("user_id IN :user_ids")
            params["user_ids"] = user_ids
        sql = text(
            f"""
            SELECT event_time, user_id, user_msisdn
            FROM project_user_msisdn_facts
            WHERE project_id = :project_id
              AND ({' OR '.join(clauses)})
            ORDER BY event_time ASC
            """
        )
        if msisdns:
            sql = sql.bindparams(bindparam("msisdns", expanding=True))
        if user_ids:
            sql = sql.bindparams(bindparam("user_ids", expanding=True))
        async with AsyncSessionLocal() as session:
            result = await session.execute(sql, params)
            return [dict(row) for row in result.mappings().all()]

    @staticmethod
    def _wrap_graph(graph: Dict[str, Any], data: Dict[str, Any], nodes: List[Dict[str, Any]], edges: List[Dict[str, Any]], metadata_extra: Dict[str, Any]) -> Dict[str, Any]:
        return {
            "type": "graph",
            "name": graph.get("name", "Graph"),
            "description": graph.get("description"),
            "data": {**data, "nodes": nodes, "edges": edges},
            "metadata": {**(graph.get("metadata") or {}), **metadata_extra},
        }


class IpMsisdnLinksPlugin(_ProjectDataLinkPluginBase):
    id = "project_ip_msisdn_links"
    name = "IP <-> MSISDN"
    version = "0.1.0"
    description = "Строит связи между IP и номером телефона из данных проекта"

    def is_applicable_with_context(self, input_artifacts: List[Dict[str, Any]], context: Optional[Dict[str, Any]] = None) -> bool:
        if not input_artifacts:
            return False
        graph = input_artifacts[0] if isinstance(input_artifacts[0], dict) else {}
        data = graph.get("data") if isinstance(graph.get("data"), dict) else {}
        selected_nodes = self._selected_nodes(list(data.get("nodes") or []), context)
        return any(str(node.get("type") or "").strip().lower() in {"person", "abonent", "subscriber", "msisdn", "ip"} for node in selected_nodes)

    async def execute(self, input_artifacts: List[Dict[str, Any]], params: Optional[Dict[str, Any]] = None) -> List[Dict[str, Any]]:
        graph = input_artifacts[0]
        data = dict(graph.get("data") or {})
        nodes = list(data.get("nodes") or [])
        edges = list(data.get("edges") or [])
        params_dict = params if isinstance(params, dict) else {}
        context = params_dict.get("_context") if isinstance(params_dict.get("_context"), dict) else {}
        selected_nodes = self._selected_nodes(nodes, context)

        selected_msisdns = _dedupe_preserve_order(
            _normalize_phone(_node_label(node))
            for node in selected_nodes
            if str(node.get("type") or "").strip().lower() in {"person", "abonent", "subscriber", "msisdn"}
        )
        selected_ips = _dedupe_preserve_order(
            _normalize_text(_node_label(node))
            for node in selected_nodes
            if str(node.get("type") or "").strip().lower() == "ip"
        )
        rows = await self._load_rows(int(graph.get("project_id") or params_dict.get("project_id") or 0), selected_msisdns, selected_ips)
        if not rows:
            return [UserMsisdnLinksPlugin._wrap_graph(graph, data, nodes, edges, {"source_plugin": self.id, "rows_count": 0})]

        for row in rows:
            ip_address = _normalize_text(row.get("ip_address"))
            msisdn = _normalize_phone(row.get("user_msisdn"))
            if not ip_address or not msisdn:
                continue
            anchor = next((node for node in selected_nodes if _normalize_phone(_node_label(node)) == msisdn or _normalize_text(_node_label(node)) == ip_address), None)
            ip_node = self._find_or_create_node(nodes, "ip", ip_address, anchor_node=anchor)
            msisdn_node = self._find_or_create_node(nodes, "person", msisdn, anchor_node=ip_node)
            event_time = _format_dt(row.get("event_time"))
            edge = self._find_existing_edge(edges, _node_id(ip_node), _node_id(msisdn_node), "ip_msisdn_link")
            if edge is None:
                edges.append(self._build_edge(edges, _node_id(ip_node), _node_id(msisdn_node), "ip_msisdn_link", event_time, self.name))
            else:
                self._merge_edge_event(edge, event_time)

        return [UserMsisdnLinksPlugin._wrap_graph(graph, data, nodes, edges, {"source_plugin": self.id, "rows_count": len(rows)})]

    async def _load_rows(self, project_id: int, msisdns: List[str], ips: List[str]) -> List[Dict[str, Any]]:
        if project_id <= 0 or (not msisdns and not ips):
            return []
        clauses: List[str] = []
        params: Dict[str, Any] = {"project_id": project_id}
        if msisdns:
            clauses.append("user_msisdn IN :msisdns")
            params["msisdns"] = msisdns
        if ips:
            clauses.append("ip_address IN :ips")
            params["ips"] = ips
        sql = text(
            f"""
            SELECT event_time, ip_address, user_msisdn
            FROM project_ip_msisdn_facts
            WHERE project_id = :project_id
              AND ({' OR '.join(clauses)})
            ORDER BY event_time ASC
            """
        )
        if msisdns:
            sql = sql.bindparams(bindparam("msisdns", expanding=True))
        if ips:
            sql = sql.bindparams(bindparam("ips", expanding=True))
        async with AsyncSessionLocal() as session:
            result = await session.execute(sql, params)
            return [dict(row) for row in result.mappings().all()]


class MsisdnDeviceLinksPlugin(_ProjectDataLinkPluginBase):
    id = "project_msisdn_device_links"
    name = "MSISDN <-> Устройство"
    version = "0.1.0"
    description = "Строит связи между номером телефона и профилем устройства из данных проекта"

    def is_applicable_with_context(self, input_artifacts: List[Dict[str, Any]], context: Optional[Dict[str, Any]] = None) -> bool:
        if not input_artifacts:
            return False
        graph = input_artifacts[0] if isinstance(input_artifacts[0], dict) else {}
        data = graph.get("data") if isinstance(graph.get("data"), dict) else {}
        selected_nodes = self._selected_nodes(list(data.get("nodes") or []), context)
        return any(str(node.get("type") or "").strip().lower() in {"person", "abonent", "subscriber", "msisdn", "device_profile"} for node in selected_nodes)

    async def execute(self, input_artifacts: List[Dict[str, Any]], params: Optional[Dict[str, Any]] = None) -> List[Dict[str, Any]]:
        graph = input_artifacts[0]
        data = dict(graph.get("data") or {})
        nodes = list(data.get("nodes") or [])
        edges = list(data.get("edges") or [])
        params_dict = params if isinstance(params, dict) else {}
        context = params_dict.get("_context") if isinstance(params_dict.get("_context"), dict) else {}
        selected_nodes = self._selected_nodes(nodes, context)

        selected_msisdns = _dedupe_preserve_order(
            _normalize_phone(_node_label(node))
            for node in selected_nodes
            if str(node.get("type") or "").strip().lower() in {"person", "abonent", "subscriber", "msisdn"}
        )
        selected_devices = _dedupe_preserve_order(
            _normalize_text(_node_label(node))
            for node in selected_nodes
            if str(node.get("type") or "").strip().lower() == "device_profile"
        )
        rows = await self._load_rows(int(graph.get("project_id") or params_dict.get("project_id") or 0), selected_msisdns, selected_devices)
        if not rows:
            return [UserMsisdnLinksPlugin._wrap_graph(graph, data, nodes, edges, {"source_plugin": self.id, "rows_count": 0})]

        for row in rows:
            device_info = _normalize_text(row.get("device_info"))
            msisdn = _normalize_phone(row.get("user_msisdn"))
            if not device_info or not msisdn:
                continue
            anchor = next((node for node in selected_nodes if _normalize_phone(_node_label(node)) == msisdn or _normalize_text(_node_label(node)) == device_info), None)
            msisdn_node = self._find_or_create_node(nodes, "person", msisdn, anchor_node=anchor)
            device_node = self._find_or_create_node(nodes, "device_profile", device_info, anchor_node=msisdn_node)
            event_time = _format_dt(row.get("event_time"))
            edge = self._find_existing_edge(edges, _node_id(msisdn_node), _node_id(device_node), "msisdn_device_link")
            if edge is None:
                edges.append(self._build_edge(edges, _node_id(msisdn_node), _node_id(device_node), "msisdn_device_link", event_time, self.name))
            else:
                self._merge_edge_event(edge, event_time)

        return [UserMsisdnLinksPlugin._wrap_graph(graph, data, nodes, edges, {"source_plugin": self.id, "rows_count": len(rows)})]

    async def _load_rows(self, project_id: int, msisdns: List[str], devices: List[str]) -> List[Dict[str, Any]]:
        if project_id <= 0 or (not msisdns and not devices):
            return []
        clauses: List[str] = []
        params: Dict[str, Any] = {"project_id": project_id}
        if msisdns:
            clauses.append("user_msisdn IN :msisdns")
            params["msisdns"] = msisdns
        if devices:
            clauses.append("device_info IN :devices")
            params["devices"] = devices
        sql = text(
            f"""
            SELECT event_time, user_msisdn, device_info
            FROM project_msisdn_device_facts
            WHERE project_id = :project_id
              AND ({' OR '.join(clauses)})
            ORDER BY event_time ASC
            """
        )
        if msisdns:
            sql = sql.bindparams(bindparam("msisdns", expanding=True))
        if devices:
            sql = sql.bindparams(bindparam("devices", expanding=True))
        async with AsyncSessionLocal() as session:
            result = await session.execute(sql, params)
            return [dict(row) for row in result.mappings().all()]


class MsisdnTextLinksPlugin(_ProjectDataLinkPluginBase):
    id = "project_msisdn_text_links"
    name = "MSISDN <-> Текст"
    version = "0.1.0"
    description = "Строит текстовый узел по сообщениям, сгруппированным по номеру из имени файла"

    def is_applicable_with_context(self, input_artifacts: List[Dict[str, Any]], context: Optional[Dict[str, Any]] = None) -> bool:
        if not input_artifacts:
            return False
        graph = input_artifacts[0] if isinstance(input_artifacts[0], dict) else {}
        data = graph.get("data") if isinstance(graph.get("data"), dict) else {}
        selected_nodes = self._selected_nodes(list(data.get("nodes") or []), context)
        return any(str(node.get("type") or "").strip().lower() in {"person", "abonent", "subscriber", "msisdn", "text_bundle"} for node in selected_nodes)

    async def execute(self, input_artifacts: List[Dict[str, Any]], params: Optional[Dict[str, Any]] = None) -> List[Dict[str, Any]]:
        graph = input_artifacts[0]
        data = dict(graph.get("data") or {})
        nodes = list(data.get("nodes") or [])
        edges = list(data.get("edges") or [])
        params_dict = params if isinstance(params, dict) else {}
        context = params_dict.get("_context") if isinstance(params_dict.get("_context"), dict) else {}
        selected_nodes = self._selected_nodes(nodes, context)

        selected_msisdns = _dedupe_preserve_order(
            _normalize_phone(_node_label(node))
            for node in selected_nodes
            if str(node.get("type") or "").strip().lower() in {"person", "abonent", "subscriber", "msisdn"}
        )
        selected_bundles = _dedupe_preserve_order(
            _normalize_phone((_node_label(node) or "").replace("Текст ", ""))
            for node in selected_nodes
            if str(node.get("type") or "").strip().lower() == "text_bundle"
        )
        rows = await self._load_rows(int(graph.get("project_id") or params_dict.get("project_id") or 0), selected_msisdns, selected_bundles)
        if not rows:
            return [UserMsisdnLinksPlugin._wrap_graph(graph, data, nodes, edges, {"source_plugin": self.id, "rows_count": 0})]

        grouped: Dict[str, List[Dict[str, Any]]] = {}
        for row in rows:
            file_msisdn = _normalize_phone(row.get("file_msisdn"))
            if not file_msisdn:
                continue
            grouped.setdefault(file_msisdn, []).append(row)

        for file_msisdn, group_rows in grouped.items():
            phone_node = self._find_or_create_node(nodes, "person", file_msisdn)
            lines = _dedupe_preserve_order(
                f"{_normalize_phone(row.get('user_msisdn'))} {_normalize_text(row.get('message_text'))}".strip()
                for row in group_rows
                if _normalize_phone(row.get("user_msisdn")) and _normalize_text(row.get("message_text"))
            )
            text_label = f"Текст {file_msisdn}"
            text_node = self._find_or_create_node(
                nodes,
                "text_bundle",
                text_label,
                anchor_node=phone_node,
                extra_attributes={
                    "file_msisdn": file_msisdn,
                    "text": "\n".join(lines),
                    "rows_count": len(lines),
                },
            )
            edge = self._find_existing_edge(edges, _node_id(phone_node), _node_id(text_node), "msisdn_text_link")
            event_times = [_format_dt(row.get("event_time")) for row in group_rows if _format_dt(row.get("event_time"))]
            if edge is None:
                first_time = event_times[-1] if event_times else ""
                edges.append(self._build_edge(edges, _node_id(phone_node), _node_id(text_node), "msisdn_text_link", first_time, self.name))
                edge = edges[-1]
                for extra_time in event_times[:-1]:
                    self._merge_edge_event(edge, extra_time)
            else:
                for event_time in event_times:
                    self._merge_edge_event(edge, event_time)

        return [UserMsisdnLinksPlugin._wrap_graph(graph, data, nodes, edges, {"source_plugin": self.id, "rows_count": len(rows)})]

    async def _load_rows(self, project_id: int, msisdns: List[str], file_msisdns: List[str]) -> List[Dict[str, Any]]:
        if project_id <= 0 or (not msisdns and not file_msisdns):
            return []
        clauses: List[str] = []
        params: Dict[str, Any] = {"project_id": project_id}
        if msisdns:
            clauses.append("user_msisdn IN :msisdns")
            params["msisdns"] = msisdns
        if file_msisdns:
            clauses.append("file_msisdn IN :file_msisdns")
            params["file_msisdns"] = file_msisdns
        sql = text(
            f"""
            SELECT event_time, user_msisdn, file_msisdn, message_text
            FROM project_msisdn_text_facts
            WHERE project_id = :project_id
              AND ({' OR '.join(clauses)})
            ORDER BY event_time ASC
            """
        )
        if msisdns:
            sql = sql.bindparams(bindparam("msisdns", expanding=True))
        if file_msisdns:
            sql = sql.bindparams(bindparam("file_msisdns", expanding=True))
        async with AsyncSessionLocal() as session:
            result = await session.execute(sql, params)
            return [dict(row) for row in result.mappings().all()]
