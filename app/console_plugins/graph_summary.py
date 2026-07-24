from __future__ import annotations

from collections import Counter
from typing import Any, Dict, Optional

from app.console_plugins import ConsoleExecutorPlugin
from app.console_plugins._graph_analysis_utils import (
    adjacency,
    column,
    domain_labels,
    edge_endpoints,
    graph_payload,
    node_id,
    node_label,
    selected_node_ids,
    tab,
)


class GraphSummaryExecutor(ConsoleExecutorPlugin):
    id = "graph_summary"
    name = "Сводка графа"
    description = "Показывает состав графа или выделения: типы объектов, типы связей и наиболее связанные объекты."
    menu_path = "Анализ/Структура графа"
    supports_graph_selection = True

    async def execute(
        self,
        *,
        project_id: int,
        artifact: Optional[Dict[str, Any]] = None,
        params: Optional[Dict[str, Any]] = None,
        context: Optional[Dict[str, Any]] = None,
    ) -> Dict[str, Any]:
        del project_id
        nodes, edges = graph_payload(artifact)
        selected = selected_node_ids(context)
        scope_ids = selected or {node_id(node) for node in nodes if node_id(node)}
        scoped_nodes = [node for node in nodes if node_id(node) in scope_ids]
        scoped_edges = [edge for edge in edges if set(edge_endpoints(edge)).issubset(scope_ids)]
        node_labels, edge_labels = domain_labels()

        type_counts = Counter(str(node.get("type") or "unknown") for node in scoped_nodes)
        node_type_rows = [
            {"type": node_type, "type_name": node_labels.get(node_type, node_type), "count": count}
            for node_type, count in sorted(type_counts.items(), key=lambda item: (-item[1], item[0]))
        ]

        edge_counts = Counter(str(edge.get("type") or "unknown") for edge in scoped_edges)
        edge_type_rows = [
            {"type": edge_type, "type_name": edge_labels.get(edge_type, edge_type), "count": count}
            for edge_type, count in sorted(edge_counts.items(), key=lambda item: (-item[1], item[0]))
        ]

        graph_adjacency = adjacency(scoped_nodes, scoped_edges)
        limit = max(1, min(int((params or {}).get("limit") or 50), 500))
        ranked_nodes = sorted(
            scoped_nodes,
            key=lambda node: (-len(graph_adjacency.get(node_id(node), set())), node_label(node).lower()),
        )[:limit]
        degree_rows = [
            {
                "node_id": node_id(node),
                "name": node_label(node),
                "type": str(node.get("type") or "unknown"),
                "type_name": node_labels.get(str(node.get("type") or "unknown"), str(node.get("type") or "unknown")),
                "degree": len(graph_adjacency.get(node_id(node), set())),
            }
            for node in ranked_nodes
        ]

        summary_rows = [{
            "scope": "Выделение" if selected else "Весь граф",
            "nodes": len(scoped_nodes),
            "edges": len(scoped_edges),
            "node_types": len(type_counts),
            "edge_types": len(edge_counts),
        }]
        tabs = [
            tab("summary", "Итог", [column("scope", "Область"), column("nodes", "Узлов", "integer", 100), column("edges", "Связей", "integer", 100), column("node_types", "Типов узлов", "integer", 120), column("edge_types", "Типов связей", "integer", 120)], summary_rows),
            tab("node_types", "Типы объектов", [column("type", "Код типа"), column("type_name", "Тип объекта", "string", 240), column("count", "Количество", "integer", 120)], node_type_rows),
            tab("edge_types", "Типы связей", [column("type", "Код типа"), column("type_name", "Тип связи", "string", 240), column("count", "Количество", "integer", 120)], edge_type_rows),
            tab("degree", "Связность объектов", [column("node_id", "ID"), column("name", "Объект", "string", 280), column("type_name", "Тип", "string", 200), column("degree", "Соседей", "integer", 110)], degree_rows),
        ]
        return {"profile_id": self.id, "profile_name": self.name, "tabs": tabs, "active_tab_id": "summary"}
