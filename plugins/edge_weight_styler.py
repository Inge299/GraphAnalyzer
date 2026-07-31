"""Plugin that scales graph edge thickness by the number of connections."""

from __future__ import annotations

import math
from typing import Any, Dict, List, Optional

from app.services.domain_model_service import list_edge_types
from plugins import PluginBase


MIN_WIDTH = 1.5
MAX_WIDTH = 10.0
UNIFORM_WIDTH = 5.0
COUNT_KEYS = ("events_count", "facts_count", "connections_count", "calls_count", "contacts_count")


def _connection_count(edge: Dict[str, Any]) -> Optional[int]:
    attributes = edge.get("attributes") if isinstance(edge.get("attributes"), dict) else {}
    fallback: Optional[int] = None
    for key in COUNT_KEYS:
        raw_value = attributes.get(key)
        if raw_value is None:
            continue
        try:
            value = max(0, int(float(raw_value)))
        except (TypeError, ValueError):
            continue
        if key in {"calls_count", "facts_count", "connections_count", "events_count"} and value > 0:
            return value
        fallback = value if fallback is None else max(fallback, value)
    return fallback


class EdgeWeightStylerPlugin(PluginBase):
    id = "edge_weights"
    name = "\u0412\u0435\u0441 \u0441\u0432\u044f\u0437\u0435\u0439"
    version = "1.0.0"
    description = "\u041c\u0435\u043d\u044f\u0435\u0442 \u0442\u043e\u043b\u0449\u0438\u043d\u0443 \u0441\u0432\u044f\u0437\u0435\u0439 \u0433\u0440\u0430\u0444\u0430 \u043f\u043e \u043a\u043e\u043b\u0438\u0447\u0435\u0441\u0442\u0432\u0443 \u0441\u043e\u0435\u0434\u0438\u043d\u0435\u043d\u0438\u0439: \u043e\u0442 \u043c\u0438\u043d\u0438\u043c\u0430\u043b\u044c\u043d\u043e\u0439 \u0442\u043e\u043b\u0449\u0438\u043d\u044b \u0434\u043b\u044f \u043e\u0434\u043d\u043e\u0433\u043e \u0441\u043e\u0435\u0434\u0438\u043d\u0435\u043d\u0438\u044f \u0434\u043e 10 \u0434\u043b\u044f \u043c\u0430\u043a\u0441\u0438\u043c\u0443\u043c\u0430."
    menu_path = "\u0410\u043d\u0430\u043b\u0438\u0437/\u0412\u0438\u0437\u0443\u0430\u043b\u0438\u0437\u0430\u0446\u0438\u044f"
    input_types = ["graph"]
    output_types = ["graph"]
    applicable_to = ["graph"]
    inputs = {"artifact_types": ["graph"], "selection": {}}
    output_strategy = {"mode": "update_current", "history_action": "plugin_execute"}
    plugin_scope = "context"
    params_schema = [
        {
            "key": "relation_type",
            "label": "\u0422\u0438\u043f \u0441\u0432\u044f\u0437\u0435\u0439 \u0433\u0440\u0430\u0444\u0430",
            "type": "string",
            "required": True,
            "options": [],
        },
    ]

    def to_metadata(self) -> Dict[str, Any]:
        metadata = super().to_metadata()
        metadata["params_schema"] = [{
            **self.params_schema[0],
            "options": [
                {
                    "value": str(item.get("id") or "").strip(),
                    "label": str(item.get("label") or item.get("id") or "").strip(),
                }
                for item in list_edge_types()
                if str(item.get("id") or "").strip()
            ],
        }]
        return metadata

    async def execute(self, input_artifacts: List[Dict[str, Any]], params: Optional[Dict[str, Any]] = None) -> List[Dict[str, Any]]:
        if not input_artifacts:
            return []

        graph = input_artifacts[0]
        data = dict(graph.get("data") or {})
        edges = list(data.get("edges") or [])
        relation_type = str((params or {}).get("relation_type") or "").strip()
        if not relation_type:
            raise ValueError("\u0412\u044b\u0431\u0435\u0440\u0438\u0442\u0435 \u0442\u0438\u043f \u0441\u0432\u044f\u0437\u0435\u0439 \u0433\u0440\u0430\u0444\u0430")

        weighted = [
            (edge, _connection_count(edge))
            for edge in edges
            if isinstance(edge, dict) and str(edge.get("type") or "").strip() == relation_type
        ]
        if not weighted:
            raise ValueError("\u041d\u0430 \u0433\u0440\u0430\u0444\u0435 \u043d\u0435\u0442 \u0441\u0432\u044f\u0437\u0435\u0439 \u0432\u044b\u0431\u0440\u0430\u043d\u043d\u043e\u0433\u043e \u0442\u0438\u043f\u0430")
        counts = [count for _, count in weighted if count is not None and count > 0]
        if not counts:
            raise ValueError("\u0423 \u0441\u0432\u044f\u0437\u0435\u0439 \u0432\u044b\u0431\u0440\u0430\u043d\u043d\u043e\u0433\u043e \u0442\u0438\u043f\u0430 \u043d\u0435\u0442 \u0447\u0438\u0441\u043b\u043e\u0432\u043e\u0433\u043e \u0430\u0442\u0440\u0438\u0431\u0443\u0442\u0430 \u0434\u043b\u044f \u0432\u0435\u0441\u0430")
        min_count = min(counts)
        max_count = max(counts, default=1)

        for edge, count in weighted:
            if count is None or count <= 0:
                continue
            width = self._width_for(count, min_count, max_count)
            attributes = edge.get("attributes") if isinstance(edge.get("attributes"), dict) else {}
            edge["attributes"] = attributes
            visual = attributes.get("visual") if isinstance(attributes.get("visual"), dict) else {}
            attributes["visual"] = visual
            visual["width"] = width
            attributes["width"] = width
            attributes["weight_value"] = count
            attributes["weight_scale"] = "logarithmic"

        return [
            {
                "type": "graph",
                "name": graph.get("name", "Graph"),
                "description": graph.get("description"),
                "data": {**data, "edges": edges},
                "metadata": {
                    **(graph.get("metadata") or {}),
                    "source_plugin": self.id,
                    "weighted_relation_type": relation_type,
                    "weighted_edges": len(counts),
                    "weight_min": MIN_WIDTH,
                    "weight_max": MAX_WIDTH,
                    "weight_min_connections": min_count,
                    "weight_max_connections": max_count,
                    "weight_uniform": min_count == max_count,
                },
            }
        ]

    @staticmethod
    def _width_for(count: int, min_count: int, max_count: int) -> float:
        if count <= 0:
            return MIN_WIDTH
        if min_count >= max_count:
            return UNIFORM_WIDTH
        ratio = (math.log(count) - math.log(min_count)) / (math.log(max_count) - math.log(min_count))
        ratio = max(0.0, min(1.0, ratio))
        return round(MIN_WIDTH + (MAX_WIDTH - MIN_WIDTH) * ratio, 2)
