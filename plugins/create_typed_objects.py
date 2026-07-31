"""Create analyst-entered domain entities and place them on the current graph."""

from __future__ import annotations

import re
from typing import Any, Dict, List, Optional

from app.services.domain_model_service import list_node_types
from plugins import PluginBase
from plugins.graph_toolkit import GraphPluginToolkit, dedupe_preserve_order, node_id


class CreateTypedObjectsPlugin(PluginBase):
    """Create typed entities from identifiers supplied by an analyst."""

    id = "create_typed_objects"
    name = "Создать объекты"
    version = "1.0.0"
    description = "Создаёт введённые объекты выбранного типа на графе и в универсальном хранилище проекта."
    menu_path = "Объекты"
    input_types = ["graph"]
    output_types = ["graph"]
    applicable_to = ["graph"]
    inputs = {"artifact_types": ["graph"], "selection": {}}
    plugin_scope = "global"
    output_strategy = {"mode": "update_current", "history_action": "plugin_execute"}
    params_schema = [
        {"key": "type_id", "label": "Тип объектов", "type": "string", "required": True, "options": []},
        {"key": "identifiers", "label": "Идентификаторы", "type": "string", "required": True, "multiline": True, "placeholder": "По одному значению в строке"},
    ]

    def __init__(self) -> None:
        self.graph = GraphPluginToolkit()

    def to_metadata(self) -> dict:
        metadata = super().to_metadata()
        metadata["params_schema"] = [
            {
                **self.params_schema[0],
                "options": [
                    {"value": str(item.get("id") or "").strip(), "label": str(item.get("label") or item.get("id") or "").strip()}
                    for item in list_node_types()
                    if str(item.get("id") or "").strip()
                ],
            },
            dict(self.params_schema[1]),
        ]
        return metadata

    @staticmethod
    def _values(raw: Any) -> List[str]:
        return dedupe_preserve_order(value.strip() for value in re.split(r"[\r\n,;]+", str(raw or "")) if value.strip())

    @staticmethod
    def _node_type(type_id: str) -> Dict[str, Any]:
        normalized = str(type_id or "").strip().lower()
        for item in list_node_types():
            if str(item.get("id") or "").strip().lower() == normalized:
                return item
        raise ValueError("Выберите существующий тип объектов")

    async def execute(self, input_artifacts: List[dict], params: Optional[dict] = None) -> List[dict]:
        if not input_artifacts:
            raise ValueError("Для создания объектов нужен активный граф")
        graph = input_artifacts[0]
        params_dict = params if isinstance(params, dict) else {}
        node_type = self._node_type(str(params_dict.get("type_id") or ""))
        values = self._values(params_dict.get("identifiers"))
        if not values:
            raise ValueError("Введите хотя бы один идентификатор")

        data = dict(graph.get("data") or {})
        nodes = list(data.get("nodes") or [])
        edges = list(data.get("edges") or [])
        context = params_dict.get("_context") if isinstance(params_dict.get("_context"), dict) else None
        selected = self.graph.selected_nodes(nodes, context)
        anchor = selected[0] if selected else None
        identity_attribute = str(node_type.get("identity_attribute") or "").strip()
        created_nodes = 0
        commands: List[Dict[str, Any]] = []

        for value in values:
            before_ids = {node_id(node) for node in nodes}
            attributes = {identity_attribute: value} if identity_attribute else {}
            node = self.graph.find_or_create_node(nodes, str(node_type["id"]), value, anchor_node=anchor, extra_attributes=attributes)
            if node_id(node) not in before_ids:
                created_nodes += 1
            commands.append({"type_id": str(node_type["id"]), "external_key": value, "label": value, "attributes": attributes})
            anchor = node

        return [{
            "type": "graph",
            "name": graph.get("name") or "Граф",
            "description": graph.get("description"),
            "data": {**data, "nodes": nodes, "edges": edges},
            "metadata": {
                **(graph.get("metadata") or {}),
                "source_plugin": self.id,
                "created_nodes": created_nodes,
                "requested_entities": len(commands),
                "domain_entity_commands": commands,
            },
        }]