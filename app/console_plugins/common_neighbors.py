from __future__ import annotations

from itertools import combinations
from typing import Any, Dict, Optional

from app.console_plugins import ConsoleExecutorPlugin
from app.console_plugins._graph_analysis_utils import adjacency, column, domain_labels, graph_payload, node_id, node_label, selected_node_ids, tab


class CommonNeighborsExecutor(ConsoleExecutorPlugin):
    id = "common_neighbors"
    name = "Общие связи"
    description = "Находит общих соседей выбранных объектов и сравнивает пересечение их окружения."
    menu_path = "Анализ/Связи"
    supports_graph_selection = True
    params_schema = [
        {"name": "minimum_anchors", "label": "Минимум выбранных объектов", "type": "integer", "default": 2, "required": False},
    ]

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
        node_by_id = {node_id(node): node for node in nodes if node_id(node)}
        selected = sorted(identifier for identifier in selected_node_ids(context) if identifier in node_by_id)
        minimum = max(2, int((params or {}).get("minimum_anchors") or 2))
        graph_adjacency = adjacency(nodes, edges)
        node_labels, _ = domain_labels()

        common_rows = []
        if len(selected) >= minimum:
            candidate_ids = set.intersection(*(graph_adjacency.get(identifier, set()) for identifier in selected))
            for candidate_id in sorted(candidate_ids, key=lambda item: node_label(node_by_id.get(item, {"id": item})).lower()):
                node = node_by_id.get(candidate_id, {"id": candidate_id, "type": "unknown"})
                node_type = str(node.get("type") or "unknown")
                common_rows.append({
                    "node_id": candidate_id,
                    "name": node_label(node),
                    "type": node_labels.get(node_type, node_type),
                    "connected_to": len(selected),
                    "anchors": ", ".join(node_label(node_by_id[item]) for item in selected),
                })

        pair_rows = []
        for left_id, right_id in combinations(selected, 2):
            shared = graph_adjacency.get(left_id, set()) & graph_adjacency.get(right_id, set())
            union = graph_adjacency.get(left_id, set()) | graph_adjacency.get(right_id, set())
            pair_rows.append({
                "left": node_label(node_by_id[left_id]),
                "right": node_label(node_by_id[right_id]),
                "common_neighbors": len(shared),
                "jaccard": round(len(shared) / len(union), 4) if union else 0.0,
                "common_objects": ", ".join(node_label(node_by_id.get(item, {"id": item})) for item in sorted(shared)),
            })
        pair_rows.sort(key=lambda row: (-row["common_neighbors"], -row["jaccard"], row["left"], row["right"]))

        status = "Выполнено" if len(selected) >= minimum else f"Выберите не менее {minimum} объектов на графе"
        info_rows = [{"status": status, "selected": len(selected), "common_neighbors": len(common_rows), "pairs": len(pair_rows)}]
        tabs = [
            tab("summary", "Итог", [column("status", "Состояние", "string", 360), column("selected", "Выбрано", "integer", 100), column("common_neighbors", "Общих соседей", "integer", 140), column("pairs", "Пар", "integer", 90)], info_rows),
            tab("common_neighbors", "Общие соседи", [column("node_id", "ID"), column("name", "Объект", "string", 280), column("type", "Тип", "string", 190), column("connected_to", "Связан с выбранными", "integer", 160), column("anchors", "Выбранные объекты", "string", 380)], common_rows),
            tab("pairs", "Сравнение пар", [column("left", "Объект 1", "string", 240), column("right", "Объект 2", "string", 240), column("common_neighbors", "Общих соседей", "integer", 140), column("jaccard", "Сходство", "number", 110), column("common_objects", "Общие объекты", "string", 420)], pair_rows),
        ]
        return {"profile_id": self.id, "profile_name": self.name, "tabs": tabs, "active_tab_id": "summary"}
