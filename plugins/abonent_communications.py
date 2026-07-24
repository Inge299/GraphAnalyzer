"""Plugin: expand selected abonent nodes with communications from SQL source."""

from __future__ import annotations

from datetime import date, datetime
import math
import random
from typing import Any, Dict, List, Optional, Tuple

from sqlalchemy import bindparam, text

from app.database import AsyncSessionLocal
from app.services.plugins_config_service import get_plugin_config
from plugins import PluginBase
from plugins.graph_toolkit import GraphPluginToolkit, dedupe_preserve_order, format_datetime, is_phone_value, node_id, node_label, normalize_phone, normalize_text

MAX_SELECTED_ABONENTS = 150
EDGE_TYPE = "msisdn_communication"

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
    return format_datetime(value)

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
    name = "\u0421\u0432\u044f\u0437\u0438"
    version = "1.0.0"
    description = "\u0414\u043e\u0431\u0430\u0432\u043b\u044f\u0435\u0442 \u0430\u0431\u043e\u043d\u0435\u043d\u0442\u0441\u043a\u0438\u0435 \u043d\u043e\u043c\u0435\u0440\u0430 \u0438 \u0430\u0433\u0440\u0435\u0433\u0438\u0440\u043e\u0432\u0430\u043d\u043d\u044b\u0435 \u0441\u0432\u044f\u0437\u0438 \u0430\u0431\u043e\u043d\u0435\u043d\u0442-\u0430\u0431\u043e\u043d\u0435\u043d\u0442 \u0434\u043b\u044f \u0432\u044b\u0434\u0435\u043b\u0435\u043d\u043d\u044b\u0445 MSISDN."
    menu_path = "\u0421\u0432\u044f\u0437\u0438"
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
        self.graph = GraphPluginToolkit()

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
            if not is_phone_value(row.get("abon1")) or not is_phone_value(row.get("abon2")):
                continue
            abon1 = normalize_phone(row.get("abon1"))
            abon2 = normalize_phone(row.get("abon2"))
            if not abon1 or not abon2:
                continue

            if abon1 not in selected_abonents and abon2 not in selected_abonents:
                continue

            left_node = self._find_or_create_abonent_node(nodes, abon1)
            right_node = self._find_or_create_abonent_node(nodes, abon2, anchor_node=left_node)
            if node_id(left_node) == node_id(right_node):
                continue

            edge_type = EDGE_TYPE
            start_raw = row.get("time_start")
            end_raw = row.get("time_end")
            calls_count = int(row.get("calls_count") or 0)
            contacts_count = max(1, int(row.get("contacts_count") or 1))
            calls_count_approx = bool(row.get("calls_count_approx") or False)

            existing = self._find_existing_edge(edges, node_id(left_node), node_id(right_node), edge_type)
            if existing is None:
                edges.append(
                    self._build_edge(
                        edges=edges,
                        from_id=node_id(left_node),
                        to_id=node_id(right_node),
                        edge_type=edge_type,
                        start_raw=start_raw,
                        end_raw=end_raw,
                        calls_count=calls_count,
                        contacts_count=contacts_count,
                        calls_count_approx=calls_count_approx,
                    )
                )
                continue

            self._merge_edge_interval(existing, start_raw, end_raw, calls_count, contacts_count, calls_count_approx)

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

        phones = dedupe_preserve_order([normalize_phone(item) for item in selected_phones])
        if not phones:
            return []

        sql = text(
            """
            SELECT
                LEAST(abon1, abon2) AS abon1,
                GREATEST(abon1, abon2) AS abon2,
                MIN(time_start) AS time_start,
                MAX(COALESCE(time_end, time_start)) AS time_end,
                SUM(GREATEST(COALESCE(calls_count, 0), COALESCE(contacts_count, 1), 1))::INTEGER AS calls_count,
                SUM(GREATEST(COALESCE(contacts_count, 1), 1))::INTEGER AS contacts_count,
                BOOL_OR(calls_count_approx) AS calls_count_approx
            FROM project_communications
            WHERE project_id = :project_id
              AND NULLIF(BTRIM(abon1), '') IS NOT NULL
              AND NULLIF(BTRIM(abon2), '') IS NOT NULL
              AND (abon1 IN :phones OR abon2 IN :phones)
            GROUP BY LEAST(abon1, abon2), GREATEST(abon1, abon2)
            ORDER BY MIN(time_start) ASC NULLS LAST, LEAST(abon1, abon2), GREATEST(abon1, abon2)
            """
        ).bindparams(bindparam("phones", expanding=True))

        try:
            async with AsyncSessionLocal() as session:
                result = await session.execute(sql, {"project_id": project_id, "phones": phones})
                return [dict(row) for row in result.mappings().all()]
        except Exception:
            return []
    @staticmethod
    def _collect_selected_abonents(nodes: List[Dict[str, Any]], selected_ids: List[str]) -> List[str]:
        selected_id_set = set(selected_ids)
        phones: List[str] = []
        for node in nodes:
            currentnode_id = node_id(node)
            if currentnode_id not in selected_id_set:
                continue
            node_type = str(node.get("type") or "").strip().lower()
            if node_type and node_type not in {"msisdn", "person", "abonent", "subscriber"}:
                continue
            label = node_label(node)
            if label:
                phones.append(label)
        return dedupe_preserve_order(phones)

    @staticmethod
    def _format_ownership(fio: str, address: str) -> str:
        return ", ".join([part for part in [fio, address] if part])

    def _find_or_create_abonent_node(
        self,
        nodes: List[Dict[str, Any]],
        phone: str,
        anchor_node: Optional[Dict[str, Any]] = None,
    ) -> Dict[str, Any]:
        normalized = phone.strip().lower()
        for node in nodes:
            if str(node.get("type") or "").strip().lower() not in {"msisdn", "person", "abonent", "subscriber"}:
                continue
            if node_label(node).strip().lower() == normalized:
                return node
        return self.graph.find_or_create_node(nodes, "msisdn", phone, anchor_node=anchor_node)

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

        label = node_label(node)
        node["label"] = label
        attributes["label"] = label
        visual["label"] = label

        existing_operator = attributes.get("operator") if isinstance(attributes.get("operator"), list) else []
        existing_ownership = attributes.get("ownership") if isinstance(attributes.get("ownership"), list) else []

        next_operator = dedupe_preserve_order([*existing_operator, operator])
        next_ownership = dedupe_preserve_order([*existing_ownership, ownership])

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
        return GraphPluginToolkit.find_existing_edge(edges, left_id, right_id, edge_type)

    def _build_edge(
        self,
        edges: List[Dict[str, Any]],
        from_id: str,
        to_id: str,
        edge_type: str,
        start_raw: Any,
        end_raw: Any,
        calls_count: int,
        contacts_count: int = 1,
        calls_count_approx: bool = False,
    ) -> Dict[str, Any]:
        edge_id = self.graph.next_edge_id(edges)
        start_str = _format_dt(start_raw)
        end_str = _format_dt(end_raw)
        interval_label = self._interval_label(start_str, end_str)
        contacts_value = max(1, int(contacts_count or 1))
        connections_value = max(0, int(calls_count or 0))
        contacts_label = f"\u0421\u043e\u0435\u0434\u0438\u043d\u0435\u043d\u0438\u0439: {connections_value}"
        connections_label = contacts_label
        label_parts = [connections_label]
        if interval_label:
            label_parts.append(interval_label)
        edge_label = "\n".join(label_parts)

        return {
            "id": edge_id,
            "type": edge_type,
            "from": from_id,
            "to": to_id,
            "label": edge_label,
            "attributes": {
                "period": interval_label,
                "contacts": contacts_label,
                "contacts_count": contacts_value,
                "connections": connections_label,
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

    def _merge_edge_interval(self, edge: Dict[str, Any], start_raw: Any, end_raw: Any, calls_count: int, contacts_count: int = 1, calls_count_approx: bool = False) -> None:
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

        starts = [value for value in (old_start_dt, new_start_dt) if value is not None]
        ends = [value for value in (old_end_dt, new_end_dt) if value is not None]
        chosen_start = _format_dt(min(starts)) if starts else ""
        chosen_end = _format_dt(max(ends)) if ends else ""
        chosen_calls = max(
            max(0, int(attributes.get("calls_count") or 0)),
            max(0, int(calls_count or 0)),
        )
        chosen_contacts = max(
            1,
            int(attributes.get("contacts_count") or 1),
            int(contacts_count or 1),
        )
        chosen_calls_approx = bool(attributes.get("calls_count_approx") or False) or bool(calls_count_approx)

        interval_label = self._interval_label(chosen_start, chosen_end)
        contacts_label = f"\u0421\u043e\u0435\u0434\u0438\u043d\u0435\u043d\u0438\u0439: {chosen_calls}"
        connections_label = contacts_label
        label_parts = [connections_label]
        if interval_label:
            label_parts.append(interval_label)
        edge_label = "\n".join(label_parts)

        attributes["period_start"] = chosen_start
        attributes["period_end"] = chosen_end
        attributes["calls_count"] = chosen_calls
        attributes["contacts_count"] = chosen_contacts
        attributes["calls_count_approx"] = chosen_calls_approx
        attributes["period"] = interval_label
        attributes["contacts"] = contacts_label
        attributes["connections"] = connections_label

        edge["label"] = edge_label
        visual["label"] = edge_label
        visual["direction"] = "both"
        attributes["direction"] = "both"

    @staticmethod
    def _interval_label(start_value: str, end_value: str) -> str:
        if start_value and end_value:
            return f"\u0441 {start_value} \u043f\u043e {end_value}"
        return start_value or end_value
