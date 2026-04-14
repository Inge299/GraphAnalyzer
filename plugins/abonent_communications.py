"""Plugin: expand selected abonent nodes with communications from SQL source."""

from __future__ import annotations

from datetime import date, datetime
import math
import random
from typing import Any, Dict, List, Optional, Tuple

from sqlalchemy import bindparam, text

from app.database import AsyncSessionLocal
from app.services.domain_model_service import get_domain_model
from app.services.plugins_config_service import get_plugin_config
from plugins import PluginBase
from plugins.graph_domain import resolve_edge_type

MAX_SELECTED_ABONENTS = 150



def _node_id(node: Dict[str, Any]) -> str:
    return str(node.get("id") or node.get("node_id") or "")


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


def _normalize_phone(value: Any) -> str:
    return str(value or "").strip()


def _normalize_text(value: Any) -> str:
    return str(value or "").strip()


def _dedupe_preserve_order(items: List[str]) -> List[str]:
    seen = set()
    result: List[str] = []
    for item in items:
        value = item.strip()
        if not value:
            continue
        if value in seen:
            continue
        seen.add(value)
        result.append(value)
    return result


def _safe_duration(start: Optional[datetime], end: Optional[datetime]) -> float:
    if start is None or end is None:
        return float("-inf")
    return (end - start).total_seconds()


def _as_datetime(value: Any) -> Optional[datetime]:
    if isinstance(value, datetime):
        return value
    if isinstance(value, date):
        return datetime.combine(value, datetime.min.time())
    if isinstance(value, str):
        raw = value.strip()
        if not raw:
            return None
        normalized = raw.replace("T", " ")
        try:
            return datetime.fromisoformat(normalized)
        except Exception:
            pass
        for pattern in ("%Y-%m-%d %H:%M:%S", "%Y-%m-%d %H:%M", "%Y-%m-%d"):
            try:
                return datetime.strptime(normalized, pattern)
            except Exception:
                continue
    return None


def _format_dt(value: Any) -> str:
    dt = _as_datetime(value)
    if dt is None:
        return _normalize_text(value)
    # If time is empty (00:00:00), show only date.
    if dt.hour == 0 and dt.minute == 0 and dt.second == 0:
        return dt.strftime("%d.%m.%Y")
    return dt.strftime("%d.%m.%Y %H:%M")

def _build_mssql_url(db_cfg: Dict[str, Any]) -> str:
    driver = str(db_cfg.get("driver") or "").strip() or "mssql+pymssql"
    host = str(db_cfg.get("host") or "").strip() or "localhost"
    port = int(db_cfg.get("port") or 1433)
    instance = str(db_cfg.get("instance") or "").strip()
    database = str(db_cfg.get("database") or "").strip() or "TestData"
    auth_type = str(db_cfg.get("auth_type") or "sql").strip().lower()

    server = host
    if instance:
        server = f"{host}\\{instance}"

    if auth_type == "trusted":
        return f"{driver}://@{server}:{port}/{database}?trusted_connection=yes"

    username = str(db_cfg.get("username") or "").strip()
    password = str(db_cfg.get("password") or "").strip()
    return f"{driver}://{username}:{password}@{server}:{port}/{database}"


class AbonentCommunicationsPlugin(PluginBase):
    id = "abonent_communications"
    name = "\u0421\u0432\u044f\u0437\u0438 \u0430\u0431\u043e\u043d\u0435\u043d\u0442\u0430"
    version = "0.1.0"
    description = "Builds abonent communications from SQL for selected abonent nodes"
    menu_path = "\u0421\u043e\u0437\u0434\u0430\u0442\u044c \u043e\u0431\u044a\u0435\u043a\u0442"
    input_types = ["graph"]
    output_types = ["graph"]
    applicable_to = ["graph"]
    inputs = {
        "artifact_types": ["graph"],
        "selection": {
            "nodes": "required",
            "edges": "optional",
            "rows": "optional",
            "text": "optional",
            "geo": "optional",
        },
    }
    output_strategy = {
        "mode": "update_current",
        "history_action": "plugin_execute",
    }

    def __init__(self) -> None:
        # Sequence for deterministic initial placement of newly created nodes.
        self._new_node_sequence = 0
        self._rng = random.Random()

    def is_applicable_with_context(self, input_artifacts: List[Dict[str, Any]], context: Optional[Dict[str, Any]] = None) -> bool:
        if not input_artifacts:
            return False
        graph = input_artifacts[0] if isinstance(input_artifacts[0], dict) else {}
        data = graph.get("data") if isinstance(graph.get("data"), dict) else {}
        nodes = list(data.get("nodes") or [])
        ctx = context if isinstance(context, dict) else {}
        selected_ids = [str(item) for item in (ctx.get("selected_nodes") or [])]
        selected_abonents = self._collect_selected_abonents(nodes, selected_ids)
        if not selected_abonents:
            return False
        return True

    async def execute(
        self,
        input_artifacts: List[Dict[str, Any]],
        params: Optional[Dict[str, Any]] = None,
    ) -> List[Dict[str, Any]]:
        if not input_artifacts:
            return []

        params = params or {}
        context = params.get("_context") if isinstance(params.get("_context"), dict) else {}
        selected_ids = [str(item) for item in (context.get("selected_nodes") or [])]

        graph = input_artifacts[0]
        data = dict(graph.get("data") or {})
        nodes = list(data.get("nodes") or [])
        edges = list(data.get("edges") or [])

        selected_abonents = self._collect_selected_abonents(nodes, selected_ids)
        selected_total = len(selected_abonents)
        if selected_total > MAX_SELECTED_ABONENTS:
            return [
                {
                    "type": "graph",
                    "name": graph.get("name", "Graph"),
                    "description": graph.get("description"),
                    "data": {**data, "nodes": nodes, "edges": edges},
                    "metadata": {
                        **(graph.get("metadata") or {}),
                        "source_plugin": self.id,
                        "communications_status": "selection_too_large",
                        "communications_selection_exceeded": True,
                        "communications_selection_limit": MAX_SELECTED_ABONENTS,
                        "communications_selected_total": selected_total,
                    },
                }
            ]
        selection_limited = False
        if not selected_abonents:
            return [
                {
                    "type": "graph",
                    "name": graph.get("name", "Graph"),
                    "description": graph.get("description"),
                    "data": {**data, "nodes": nodes, "edges": edges},
                    "metadata": {
                        **(graph.get("metadata") or {}),
                        "source_plugin": self.id,
                        "communications_status": "no_selected_abonent_nodes",
                    },
                }
            ]

        project_id = int(graph.get("project_id") or params.get("project_id") or 0)
        rows = await self._load_rows(selected_abonents, project_id)
        if not rows:
            return [
                {
                    "type": "graph",
                    "name": graph.get("name", "Graph"),
                    "description": graph.get("description"),
                    "data": {**data, "nodes": nodes, "edges": edges},
                    "metadata": {
                        **(graph.get("metadata") or {}),
                        "source_plugin": self.id,
                        "communications_status": "no_rows",
                        "communications_selection_limited": selection_limited,
                        "communications_selection_limit": MAX_SELECTED_ABONENTS,
                    },
                }
            ]

        for row in rows:
            abon1 = _normalize_phone(row.get("abon1"))
            abon2 = _normalize_phone(row.get("abon2"))
            if not abon1 or not abon2:
                continue

            if abon1 not in selected_abonents and abon2 not in selected_abonents:
                continue

            left_node = self._find_or_create_abonent_node(nodes, abon1)
            right_node = self._find_or_create_abonent_node(nodes, abon2, anchor_node=left_node)
            if _node_id(left_node) == _node_id(right_node):
                continue

            edge_type = resolve_edge_type("person", "person")
            start_raw = row.get("time_start")
            end_raw = row.get("time_end")
            calls_count = int(row.get("calls_count") or 0)
            calls_count_approx = bool(row.get("calls_count_approx") or False)

            existing = self._find_existing_edge(edges, _node_id(left_node), _node_id(right_node), edge_type)
            if existing is None:
                edges.append(
                    self._build_edge(
                        edges=edges,
                        from_id=_node_id(left_node),
                        to_id=_node_id(right_node),
                        edge_type=edge_type,
                        start_raw=start_raw,
                        end_raw=end_raw,
                        calls_count=calls_count,
                        calls_count_approx=calls_count_approx,
                    )
                )
                continue

            self._merge_edge_interval(existing, start_raw, end_raw, calls_count, calls_count_approx)

        updated_data = {**data, "nodes": nodes, "edges": edges}

        return [
            {
                "type": "graph",
                "name": graph.get("name", "Graph"),
                "description": graph.get("description"),
                "data": updated_data,
                "metadata": {
                    **(graph.get("metadata") or {}),
                    "source_plugin": self.id,
                    "communications_rows": len(rows),
                    "communications_selection_limited": selection_limited,
                    "communications_selection_limit": MAX_SELECTED_ABONENTS,
                    "communications_selected_processed": len(selected_abonents),
                },
            }
        ]

    def _resolve_plugin_sql_config(self) -> Dict[str, Any]:
        cfg = get_plugin_config(self.id)
        return cfg if isinstance(cfg, dict) else {}

    async def _load_rows(self, selected_phones: List[str], project_id: int) -> List[Dict[str, Any]]:
        if not selected_phones or project_id <= 0:
            return []

        sql = text(
            """
            SELECT
              abon1,
              abon2,
              time_start,
              time_end,
              calls_count,
              calls_count_approx
            FROM project_communications
            WHERE project_id = :project_id
              AND (abon1 IN :phones OR abon2 IN :phones)
            ORDER BY time_start ASC
            """
        ).bindparams(bindparam("phones", expanding=True))

        phones = _dedupe_preserve_order([_normalize_phone(item) for item in selected_phones])
        if not phones:
            return []

        rows: List[Dict[str, Any]] = []
        seen: set[tuple] = set()

        try:
            async with AsyncSessionLocal() as session:
                result = await session.execute(sql, {"project_id": project_id, "phones": phones})
                for row in result.mappings().all():
                    payload = dict(row)
                    key = (
                        _normalize_phone(payload.get("abon1")),
                        _normalize_phone(payload.get("abon2")),
                        _normalize_text(payload.get("time_start")),
                        _normalize_text(payload.get("time_end")),
                        _normalize_text(payload.get("calls_count")),
                        bool(payload.get("calls_count_approx") or False),
                    )
                    if key in seen:
                        continue
                    seen.add(key)
                    rows.append(payload)
        except Exception:
            return []

        rows.sort(key=lambda item: (
            _as_datetime(item.get("time_start")) or datetime.min,
            _normalize_phone(item.get("abon1")),
            _normalize_phone(item.get("abon2"))
        ))
        return rows

    @staticmethod
    def _collect_selected_abonents(nodes: List[Dict[str, Any]], selected_ids: List[str]) -> List[str]:
        selected_id_set = set(selected_ids)
        phones: List[str] = []
        for node in nodes:
            node_id = _node_id(node)
            if node_id not in selected_id_set:
                continue
            node_type = str(node.get("type") or "").strip().lower()
            if node_type and node_type not in {"person", "abonent", "subscriber"}:
                continue
            label = _node_label(node)
            if label:
                phones.append(label)
        return _dedupe_preserve_order(phones)

    @staticmethod
    def _format_ownership(fio: str, address: str) -> str:
        return ", ".join([part for part in [fio, address] if part])

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
                    "iconScale": float(visual.get("iconScale") or 2),
                    "ringEnabled": bool(visual.get("ringEnabled", False)),
                    "ringWidth": float(visual.get("ringWidth") or 1.5),
                }

        return {
            "icon": "person_phone",
            "color": "#2563eb",
            "iconScale": 2.0,
            "ringEnabled": False,
            "ringWidth": 1.5,
        }

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
        radius_base = 240.0
        radius_step = 80.0
        min_distance = 150.0

        for attempt in range(48):
            ring = (self._new_node_sequence + attempt) // 10
            angle = self._rng.uniform(0.0, 2.0 * math.pi)
            radius = self._rng.uniform(140.0, 320.0) + ring * radius_step
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
        return (ax + radius_base, ay)

    def _find_or_create_abonent_node(
        self,
        nodes: List[Dict[str, Any]],
        phone: str,
        anchor_node: Optional[Dict[str, Any]] = None,
    ) -> Dict[str, Any]:
        normalized = phone.strip().lower()
        for node in nodes:
            if str(node.get("type") or "").strip().lower() != "person":
                continue
            if _node_label(node).strip().lower() == normalized:
                return node

        visual_defaults = self._person_visual_defaults()
        node_id = self._next_node_id(nodes)
        x, y = self._pick_new_node_position(nodes, anchor_node=anchor_node)
        node = {
            "id": node_id,
            "type": "person",
            "label": phone,
            "position_x": x,
            "position_y": y,
            "attributes": {
                "label": phone,
                "visual": {
                    "label": phone,
                    "icon": visual_defaults["icon"],
                    "color": visual_defaults["color"],
                    "iconScale": visual_defaults["iconScale"],
                    "ringEnabled": False,
                    "ringWidth": visual_defaults["ringWidth"],
                    "fontColor": "#0f172a",
                },
            },
        }
        nodes.append(node)
        return node

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
    def _merge_node_attributes(node: Dict[str, Any], operator: str, ownership: str) -> None:
        attributes = node.get("attributes")
        if not isinstance(attributes, dict):
            attributes = {}
            node["attributes"] = attributes

        visual = attributes.get("visual")
        if not isinstance(visual, dict):
            visual = {}
            attributes["visual"] = visual

        label = _node_label(node)
        node["label"] = label
        attributes["label"] = label
        visual["label"] = label

        existing_operator = attributes.get("operator") if isinstance(attributes.get("operator"), list) else []
        existing_ownership = attributes.get("ownership") if isinstance(attributes.get("ownership"), list) else []

        next_operator = _dedupe_preserve_order([*existing_operator, operator])
        next_ownership = _dedupe_preserve_order([*existing_ownership, ownership])

        if next_operator:
            attributes["operator"] = next_operator
        if next_ownership:
            attributes["ownership"] = next_ownership

    @staticmethod
    def _find_existing_edge(
        edges: List[Dict[str, Any]],
        left_id: str,
        right_id: str,
        edge_type: str,
    ) -> Optional[Dict[str, Any]]:
        for edge in edges:
            current_type = str(edge.get("type") or "")
            if current_type != edge_type:
                continue

            src = str(edge.get("from") or edge.get("source_node") or "")
            dst = str(edge.get("to") or edge.get("target_node") or "")
            if (src == left_id and dst == right_id) or (src == right_id and dst == left_id):
                return edge

        return None

    def _build_edge(
        self,
        edges: List[Dict[str, Any]],
        from_id: str,
        to_id: str,
        edge_type: str,
        start_raw: Any,
        end_raw: Any,
        calls_count: int,
        calls_count_approx: bool = False,
    ) -> Dict[str, Any]:
        edge_id = self._next_edge_id(edges)
        start_str = _format_dt(start_raw)
        end_str = _format_dt(end_raw)
        interval_label = self._interval_label(start_str, end_str)
        contacts_label = f"\u043a\u043e\u043d\u0442\u0430\u043a\u0442\u043e\u0432: {calls_count}" if calls_count > 0 else "\u043a\u043e\u043d\u0442\u0430\u043a\u0442\u043e\u0432: 0"
        edge_label = f"{contacts_label}\n{interval_label}" if interval_label else contacts_label

        return {
            "id": edge_id,
            "type": edge_type,
            "from": from_id,
            "to": to_id,
            "label": edge_label,
            "attributes": {
                "period": interval_label,
                "contacts": contacts_label,
                "period_start": start_str,
                "period_end": end_str,
                "calls_count": calls_count,
                "calls_count_approx": bool(calls_count_approx),
                "visual": {
                    "label": edge_label,
                    "direction": "both",
                },
            },
        }

    def _merge_edge_interval(self, edge: Dict[str, Any], start_raw: Any, end_raw: Any, calls_count: int, calls_count_approx: bool = False) -> None:
        attributes = edge.get("attributes")
        if not isinstance(attributes, dict):
            attributes = {}
            edge["attributes"] = attributes

        visual = attributes.get("visual")
        if not isinstance(visual, dict):
            visual = {}
            attributes["visual"] = visual

        existing_start_raw = attributes.get("period_start")
        existing_end_raw = attributes.get("period_end")

        new_start_dt = _as_datetime(start_raw)
        new_end_dt = _as_datetime(end_raw)
        old_start_dt = _as_datetime(existing_start_raw)
        old_end_dt = _as_datetime(existing_end_raw)

        new_duration = _safe_duration(new_start_dt, new_end_dt)
        old_duration = _safe_duration(old_start_dt, old_end_dt)

        if new_duration >= old_duration:
            chosen_start = _format_dt(start_raw)
            chosen_end = _format_dt(end_raw)
            chosen_calls = max(0, int(calls_count or 0))
            chosen_calls_approx = bool(calls_count_approx)
        else:
            chosen_start = _format_dt(existing_start_raw)
            chosen_end = _format_dt(existing_end_raw)
            chosen_calls = max(0, int(attributes.get("calls_count") or 0))
            chosen_calls_approx = bool(attributes.get("calls_count_approx") or False)

        interval_label = self._interval_label(chosen_start, chosen_end)
        contacts_label = f"\u043a\u043e\u043d\u0442\u0430\u043a\u0442\u043e\u0432: {chosen_calls}"
        edge_label = f"{contacts_label}\n{interval_label}" if interval_label else contacts_label

        attributes["period_start"] = chosen_start
        attributes["period_end"] = chosen_end
        attributes["calls_count"] = chosen_calls
        attributes["calls_count_approx"] = chosen_calls_approx
        attributes["period"] = interval_label
        attributes["contacts"] = contacts_label

        edge["label"] = edge_label
        visual["label"] = edge_label
        visual["direction"] = "both"
        attributes["direction"] = "both"

    @staticmethod
    def _interval_label(start_value: str, end_value: str) -> str:
        if start_value and end_value:
            return f"\u0441 {start_value} \u043f\u043e {end_value}"
        return start_value or end_value
