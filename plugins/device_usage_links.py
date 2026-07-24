"""Graph plugins that build MSISDN--IMEI usage links from project history."""

from __future__ import annotations

from datetime import datetime
from typing import Any, Dict, List, Optional

from sqlalchemy import bindparam, text

from app.database import AsyncSessionLocal
from plugins import PluginBase
from plugins.graph_toolkit import GraphPluginToolkit, dedupe_preserve_order, node_id, node_label, normalize_phone, normalize_text


MSISDN_TYPES = {"msisdn", "person", "abonent", "subscriber"}
IMEI_TYPE = "imei"
EDGE_TYPE = "msisdn_imei_usage"


def _format_timestamp(value: Any) -> str:
    if isinstance(value, datetime):
        return value.strftime("%d.%m.%Y %H:%M:%S")
    raw = normalize_text(value)
    if not raw:
        return ""
    try:
        return datetime.fromisoformat(raw.replace("Z", "+00:00")).strftime("%d.%m.%Y %H:%M:%S")
    except ValueError:
        return raw


def _usage_label(period_start: Any, period_end: Any, facts_count: Any) -> str:
    start = _format_timestamp(period_start)[:10]
    end = _format_timestamp(period_end)[:10]
    if start and end and start != end:
        period = f"{start} - {end}"
    elif start or end:
        period = start or end
    else:
        period = "\u0414\u0430\u0442\u0430 \u043d\u0435 \u0443\u043a\u0430\u0437\u0430\u043d\u0430"
    return f"{period}\n\u0424\u0430\u043a\u0442\u043e\u0432: {int(facts_count or 0)}"

class _DeviceUsageLinkPluginBase(PluginBase):
    abstract_plugin = True
    input_types = ["graph"]
    output_types = ["graph"]
    applicable_to = ["graph"]
    inputs = {"artifact_types": ["graph"], "selection": {"min_nodes": 1}}
    output_strategy = {"mode": "update_current", "history_action": "plugin_execute"}
    plugin_scope = "context"
    menu_path = "\u0421\u0432\u044f\u0437\u0438"

    def __init__(self) -> None:
        self.graph = GraphPluginToolkit()

    @staticmethod
    def _project_id(graph: Dict[str, Any], params: Dict[str, Any]) -> int:
        return int(graph.get("project_id") or params.get("project_id") or 0)

    def _wrap_graph(self, graph: Dict[str, Any], data: Dict[str, Any], nodes: List[Dict[str, Any]], edges: List[Dict[str, Any]], rows_count: int) -> Dict[str, Any]:
        return {
            "type": "graph",
            "name": graph.get("name", "Graph"),
            "description": graph.get("description"),
            "data": {**data, "nodes": nodes, "edges": edges},
            "metadata": {**(graph.get("metadata") or {}), "source_plugin": self.id, "rows_count": rows_count},
        }

    @staticmethod
    def _selected_nodes(nodes: List[Dict[str, Any]], params: Dict[str, Any], toolkit: GraphPluginToolkit) -> List[Dict[str, Any]]:
        context = params.get("_context") if isinstance(params.get("_context"), dict) else {}
        return toolkit.selected_nodes(nodes, context)

    async def _load_rows(self, project_id: int, column: str, values: List[str]) -> List[Dict[str, Any]]:
        if project_id <= 0 or not values:
            return []
        sql = text(
            f"""
            SELECT
                h.abon,
                BTRIM(h.imei) AS imei,
                MIN(h.period_start) AS period_start,
                MAX(COALESCE(h.period_end, h.period_start)) AS period_end,
                COUNT(DISTINCT c.id) AS facts_count,
                COUNT(DISTINCT h.id) AS history_rows_count,
                ARRAY_AGG(DISTINCT h.imsi) FILTER (WHERE NULLIF(BTRIM(h.imsi), '') IS NOT NULL) AS imsi_values
            FROM project_device_history h
            LEFT JOIN project_communications c
              ON c.project_id = h.project_id
             AND (c.abon1 = h.abon OR c.abon2 = h.abon)
             AND COALESCE(c.time_end, c.time_start) >= h.period_start
             AND c.time_start <= COALESCE(h.period_end, h.period_start)
            WHERE h.project_id = :project_id
              AND NULLIF(BTRIM(h.abon), '') IS NOT NULL
              AND LOWER(BTRIM(COALESCE(h.imei, ''))) NOT IN ('', 'null', 'none', 'n/a', '-')
              AND h.{column} IN :values
            GROUP BY h.abon, BTRIM(h.imei)
            ORDER BY h.abon, BTRIM(h.imei)
            """
        ).bindparams(bindparam("values", expanding=True))
        async with AsyncSessionLocal() as session:
            result = await session.execute(sql, {"project_id": project_id, "values": values})
            return [dict(row) for row in result.mappings().all()]

    def _upsert_usage_edge(self, edges: List[Dict[str, Any]], msisdn_node: Dict[str, Any], imei_node: Dict[str, Any], row: Dict[str, Any]) -> None:
        label = _usage_label(row.get("period_start"), row.get("period_end"), row.get("facts_count"))
        edge = self.graph.find_existing_edge(edges, node_id(msisdn_node), node_id(imei_node), EDGE_TYPE)
        if edge is None:
            edge = {
                "id": self.graph.next_edge_id(edges),
                "type": EDGE_TYPE,
                "from": node_id(msisdn_node),
                "to": node_id(imei_node),
                "label": label,
                "attributes": {},
            }
            edges.append(edge)
        attributes = edge.get("attributes") if isinstance(edge.get("attributes"), dict) else {}
        edge["attributes"] = attributes
        attributes.update(
            {
                "relation": "\u0418\u0441\u043f\u043e\u043b\u044c\u0437\u0443\u0435\u0442 \u0430\u043f\u043f\u0430\u0440\u0430\u0442",
                "period_start": _format_timestamp(row.get("period_start")),
                "period_end": _format_timestamp(row.get("period_end")),
                "facts_count": int(row.get("facts_count") or 0),
                "history_rows_count": int(row.get("history_rows_count") or 0),
                "imsi_values": dedupe_preserve_order(str(value) for value in (row.get("imsi_values") or []) if value),
                "visual": {"label": label, "direction": "both"},
            }
        )
        edge["label"] = label


class UsedDevicesPlugin(_DeviceUsageLinkPluginBase):
    abstract_plugin = False
    id = "used_devices"
    name = "\u0418\u0441\u043f\u043e\u043b\u044c\u0437\u0443\u0435\u043c\u044b\u0435 \u0430\u043f\u043f\u0430\u0440\u0430\u0442\u044b"
    version = "1.0.0"
    description = "\u0414\u043e\u0431\u0430\u0432\u043b\u044f\u0435\u0442 IMEI \u0438 \u0441\u0432\u044f\u0437\u0438 \u0438\u0441\u043f\u043e\u043b\u044c\u0437\u043e\u0432\u0430\u043d\u0438\u044f \u0434\u043b\u044f \u0432\u044b\u0434\u0435\u043b\u0435\u043d\u043d\u044b\u0445 \u0430\u0431\u043e\u043d\u0435\u043d\u0442\u0441\u043a\u0438\u0445 \u043d\u043e\u043c\u0435\u0440\u043e\u0432."

    def is_applicable_with_context(self, input_artifacts: List[Dict[str, Any]], context: Optional[Dict[str, Any]] = None) -> bool:
        if not input_artifacts:
            return False
        data = input_artifacts[0].get("data") if isinstance(input_artifacts[0], dict) else {}
        selected = self.graph.selected_nodes(list((data or {}).get("nodes") or []), context)
        return any(str(node.get("type") or "").strip().lower() in MSISDN_TYPES for node in selected)

    async def execute(self, input_artifacts: List[Dict[str, Any]], params: Optional[Dict[str, Any]] = None) -> List[Dict[str, Any]]:
        graph = input_artifacts[0]
        data = dict(graph.get("data") or {})
        nodes = list(data.get("nodes") or [])
        edges = list(data.get("edges") or [])
        params_dict = params if isinstance(params, dict) else {}
        selected = self._selected_nodes(nodes, params_dict, self.graph)
        msisdns = dedupe_preserve_order(normalize_phone(node_label(node)) for node in selected if str(node.get("type") or "").strip().lower() in MSISDN_TYPES)
        rows = await self._load_rows(self._project_id(graph, params_dict), "abon", msisdns)
        for row in rows:
            msisdn = normalize_phone(row.get("abon"))
            imei = normalize_text(row.get("imei"))
            if not msisdn or not imei:
                continue
            anchor = next((node for node in selected if normalize_phone(node_label(node)) == msisdn), None)
            msisdn_node = self.graph.find_or_create_node(nodes, "msisdn", msisdn, anchor_node=anchor)
            imei_node = self.graph.find_or_create_node(nodes, IMEI_TYPE, imei, anchor_node=msisdn_node, extra_attributes={"imei": imei})
            self._upsert_usage_edge(edges, msisdn_node, imei_node, row)
        return [self._wrap_graph(graph, data, nodes, edges, len(rows))]


class SimCardsInDevicesPlugin(_DeviceUsageLinkPluginBase):
    abstract_plugin = False
    id = "sim_cards_in_devices"
    name = "SIM-\u043a\u0430\u0440\u0442\u044b \u0432 \u0430\u043f\u043f\u0430\u0440\u0430\u0442\u0430\u0445"
    version = "1.0.0"
    description = "\u0414\u043e\u0431\u0430\u0432\u043b\u044f\u0435\u0442 \u0430\u0431\u043e\u043d\u0435\u043d\u0442\u0441\u043a\u0438\u0435 \u043d\u043e\u043c\u0435\u0440\u0430, \u0438\u0441\u043f\u043e\u043b\u044c\u0437\u043e\u0432\u0430\u0432\u0448\u0438\u0435 \u0432\u044b\u0434\u0435\u043b\u0435\u043d\u043d\u044b\u0435 IMEI, \u0438 \u0441\u0432\u044f\u0437\u0438 \u0441 \u043f\u0435\u0440\u0438\u043e\u0434\u043e\u043c \u0438 \u043a\u043e\u043b\u0438\u0447\u0435\u0441\u0442\u0432\u043e\u043c \u0444\u0430\u043a\u0442\u043e\u0432."

    def is_applicable_with_context(self, input_artifacts: List[Dict[str, Any]], context: Optional[Dict[str, Any]] = None) -> bool:
        if not input_artifacts:
            return False
        data = input_artifacts[0].get("data") if isinstance(input_artifacts[0], dict) else {}
        selected = self.graph.selected_nodes(list((data or {}).get("nodes") or []), context)
        return any(str(node.get("type") or "").strip().lower() == IMEI_TYPE for node in selected)

    async def execute(self, input_artifacts: List[Dict[str, Any]], params: Optional[Dict[str, Any]] = None) -> List[Dict[str, Any]]:
        graph = input_artifacts[0]
        data = dict(graph.get("data") or {})
        nodes = list(data.get("nodes") or [])
        edges = list(data.get("edges") or [])
        params_dict = params if isinstance(params, dict) else {}
        selected = self._selected_nodes(nodes, params_dict, self.graph)
        imeis = dedupe_preserve_order(normalize_text(node_label(node)) for node in selected if str(node.get("type") or "").strip().lower() == IMEI_TYPE)
        rows = await self._load_rows(self._project_id(graph, params_dict), "imei", imeis)
        for row in rows:
            msisdn = normalize_phone(row.get("abon"))
            imei = normalize_text(row.get("imei"))
            if not msisdn or not imei:
                continue
            anchor = next((node for node in selected if normalize_text(node_label(node)) == imei), None)
            imei_node = self.graph.find_or_create_node(nodes, IMEI_TYPE, imei, anchor_node=anchor, extra_attributes={"imei": imei})
            msisdn_node = self.graph.find_or_create_node(nodes, "msisdn", msisdn, anchor_node=imei_node)
            self._upsert_usage_edge(edges, msisdn_node, imei_node, row)
        return [self._wrap_graph(graph, data, nodes, edges, len(rows))]
