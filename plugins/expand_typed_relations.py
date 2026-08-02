"""Build a graph subnetwork from selected typed domain entities."""

from __future__ import annotations

from typing import Any, Dict, Iterable, List, Optional

from app.database import AsyncSessionLocal
from app.services.domain_model_service import list_edge_types, list_node_types
from app.services.project_domain_store import find_project_domain_relation_summaries
from plugins import PluginBase
from plugins.graph_toolkit import (
    GraphPluginToolkit,
    dedupe_preserve_order,
    format_datetime,
    node_id,
    node_label,
    normalize_text,
)


class ExpandTypedRelationsPlugin(PluginBase):
    """Expand every selected endpoint through one selected relation type."""

    id = "expand_typed_relations"
    name = "\u0420\u0430\u0441\u043a\u0440\u044b\u0442\u044c \u0441\u0432\u044f\u0437\u0438"
    version = "1.0.0"
    description = (
        "\u041d\u0430\u0445\u043e\u0434\u0438\u0442 \u0441\u0432\u044f\u0437\u0438 \u043d\u0430\u0431\u043e\u0440\u0430 \u0432\u044b\u0431\u0440\u0430\u043d\u043d\u044b\u0445 "
        "\u043e\u0431\u044a\u0435\u043a\u0442\u043e\u0432 \u0432 \u0443\u043d\u0438\u0432\u0435\u0440\u0441\u0430\u043b\u044c\u043d\u043e\u043c \u0445\u0440\u0430\u043d\u0438\u043b\u0438\u0449\u0435 "
        "\u0438 \u0441\u0442\u0440\u043e\u0438\u0442 \u0438\u0445 \u0441\u0445\u0435\u043c\u0443 \u043d\u0430 \u0433\u0440\u0430\u0444\u0435."
    )
    menu_path = "\u0421\u0432\u044f\u0437\u0438/\u0420\u0430\u0441\u043a\u0440\u044b\u0442\u0438\u0435"
    input_types = ["graph", "table", "console", "map", "chart", "document"]
    output_types = ["graph"]
    applicable_to = input_types
    inputs = {"artifact_types": input_types, "selection": {}}
    plugin_scope = "context"
    output_strategy = {"mode": "dynamic", "history_action": "plugin_execute"}
    params_schema = [
        {
            "key": "relation_type",
            "label": "\u0422\u0438\u043f \u0441\u0432\u044f\u0437\u0438",
            "type": "string",
            "required": True,
            "options": [],
        },
        {
            "key": "max_relations",
            "label": "Maximum relations on graph",
            "type": "number",
            "required": False,
            "default": 2000,
            "min": 1,
            "max": 2500,
        },
    ]

    def __init__(self) -> None:
        self.graph = GraphPluginToolkit()

    def to_metadata(self) -> dict:
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
                and str(item.get("from_type") or "").strip()
                and str(item.get("to_type") or "").strip()
            ],
        }, self.params_schema[1]]
        return metadata

    @staticmethod
    def _edge_type(relation_type: str) -> Dict[str, Any]:
        normalized = normalize_text(relation_type).lower()
        for item in list_edge_types():
            if normalize_text(item.get("id")).lower() == normalized:
                return item
        raise ValueError("\u0412\u044b\u0431\u0435\u0440\u0438\u0442\u0435 \u0442\u0438\u043f \u0441\u0432\u044f\u0437\u0438 \u0438\u0437 \u043a\u0430\u0442\u0430\u043b\u043e\u0433\u0430")

    @staticmethod
    def _node_type(type_id: str) -> Dict[str, Any]:
        normalized = normalize_text(type_id).lower()
        for item in list_node_types():
            if normalize_text(item.get("id")).lower() == normalized:
                return item
        return {}

    def _entity_command(self, type_id: str, key: str) -> Dict[str, Any]:
        definition = self._node_type(type_id)
        identity_attribute = normalize_text(definition.get("identity_attribute"))
        attributes = {identity_attribute: key} if identity_attribute else {}
        return {
            "type_id": type_id,
            "external_key": key,
            "label": key,
            "attributes": attributes,
        }

    def _graph_entities(
        self,
        nodes: List[Dict[str, Any]],
        context: Dict[str, Any],
    ) -> List[Dict[str, str]]:
        selected = self.graph.selected_nodes(nodes, context)
        return [
            {
                "type_id": normalize_text(node.get("type")),
                "external_key": self.graph.canonical_label(
                    normalize_text(node.get("type")), node_label(node)
                ),
            }
            for node in selected
            if normalize_text(node.get("type")) and node_label(node)
        ]

    @staticmethod
    def _artifact_entities(context: Dict[str, Any]) -> List[Dict[str, str]]:
        result: List[Dict[str, str]] = []
        candidates: List[Any] = []
        for key in ("selected_entities", "selected_rows"):
            if isinstance(context.get(key), list):
                candidates.extend(context[key])

        for item in candidates:
            if not isinstance(item, dict):
                continue
            type_id = normalize_text(
                item.get("type_id") or item.get("type") or item.get("entity_type")
            )
            external_key = normalize_text(
                item.get("external_key")
                or item.get("key")
                or item.get("identifier")
                or item.get("value")
                or item.get("label")
            )
            if type_id and external_key:
                result.append({"type_id": type_id, "external_key": external_key})
        return result

    @staticmethod
    def _dedupe_entities(items: Iterable[Dict[str, str]]) -> List[Dict[str, str]]:
        seen: set[tuple[str, str]] = set()
        result: List[Dict[str, str]] = []
        for item in items:
            type_id = normalize_text(item.get("type_id"))
            key = normalize_text(item.get("external_key"))
            identity = (type_id.lower(), key.lower())
            if not type_id or not key or identity in seen:
                continue
            seen.add(identity)
            result.append({"type_id": type_id, "external_key": key})
        return result

    async def _load_relation_summaries(
        self,
        project_id: int,
        relation_type: str,
        entities: List[Dict[str, str]],
        limit: int,
    ) -> List[Dict[str, Any]]:
        endpoints: Dict[str, List[str]] = {}
        for entity in entities:
            endpoints.setdefault(entity["type_id"], []).append(entity["external_key"])
        if project_id <= 0 or not endpoints:
            return []
        async with AsyncSessionLocal() as session:
            return await find_project_domain_relation_summaries(
                session,
                project_id,
                relation_type,
                endpoints=[
                    (type_id, dedupe_preserve_order(keys))
                    for type_id, keys in endpoints.items()
                ],
                limit=limit,
            )

    @staticmethod
    def _edge_matches(
        edge: Dict[str, Any],
        from_id: str,
        to_id: str,
        relation_type: str,
        directed: bool,
    ) -> bool:
        if normalize_text(edge.get("type")) != relation_type:
            return False
        current_from = normalize_text(edge.get("from") or edge.get("source_node"))
        current_to = normalize_text(edge.get("to") or edge.get("target_node"))
        return (
            (current_from == from_id and current_to == to_id)
            or (not directed and current_from == to_id and current_to == from_id)
        )

    def _find_edge(
        self,
        edges: List[Dict[str, Any]],
        from_id: str,
        to_id: str,
        relation_type: str,
        directed: bool,
    ) -> Optional[Dict[str, Any]]:
        return next(
            (
                edge
                for edge in edges
                if self._edge_matches(edge, from_id, to_id, relation_type, directed)
            ),
            None,
        )

    @staticmethod
    def _new_graph(project_id: int, label: str) -> Dict[str, Any]:
        return {
            "type": "graph",
            "project_id": project_id,
            "name": "\u0421\u0432\u044f\u0437\u0438: " + label,
            "description": "\u0421\u0445\u0435\u043c\u0430 \u0441\u0432\u044f\u0437\u0435\u0439, \u043f\u043e\u043b\u0443\u0447\u0435\u043d\u043d\u0430\u044f \u043f\u043e \u0432\u044b\u0431\u0440\u0430\u043d\u043d\u044b\u043c \u043e\u0431\u044a\u0435\u043a\u0442\u0430\u043c.",
            "data": {"nodes": [], "edges": []},
            "metadata": {},
        }

    async def execute(
        self, input_artifacts: List[dict], params: Optional[dict] = None
    ) -> List[dict]:
        if not input_artifacts:
            raise ValueError("\u041d\u0443\u0436\u0435\u043d \u0438\u0441\u0445\u043e\u0434\u043d\u044b\u0439 \u0430\u0440\u0442\u0435\u0444\u0430\u043a\u0442")

        source = input_artifacts[0]
        params_dict = params if isinstance(params, dict) else {}
        context = (
            params_dict.get("_context")
            if isinstance(params_dict.get("_context"), dict)
            else {}
        )
        edge_type = self._edge_type(str(params_dict.get("relation_type") or ""))
        relation_type = normalize_text(edge_type.get("id"))
        from_type = normalize_text(edge_type.get("from_type"))
        to_type = normalize_text(edge_type.get("to_type"))
        if not from_type or not to_type:
            raise ValueError("\u0423 \u0442\u0438\u043f\u0430 \u0441\u0432\u044f\u0437\u0438 \u043d\u0435 \u0437\u0430\u0434\u0430\u043d\u044b \u0442\u0438\u043f\u044b \u043e\u0431\u044a\u0435\u043a\u0442\u043e\u0432")

        project_id = int(source.get("project_id") or params_dict.get("project_id") or 0)
        is_graph = normalize_text(source.get("type")) == "graph"
        if is_graph:
            data = dict(source.get("data") or {})
            nodes = list(data.get("nodes") or [])
            edges = list(data.get("edges") or [])
            selected = self._graph_entities(nodes, context)
            output_mode = "update_current"
        else:
            graph = self._new_graph(
                project_id, normalize_text(edge_type.get("label")) or relation_type
            )
            data = dict(graph["data"])
            nodes: List[Dict[str, Any]] = []
            edges: List[Dict[str, Any]] = []
            selected = self._artifact_entities(context)
            output_mode = "create_new"

        selected = self._dedupe_entities(selected)
        selected = [
            item
            for item in selected
            if item["type_id"].lower() in {from_type.lower(), to_type.lower()}
        ]
        if not selected:
            raise ValueError(
                "\u0412\u044b\u0434\u0435\u043b\u0438\u0442\u0435 \u043e\u0434\u0438\u043d \u0438\u043b\u0438 \u043d\u0435\u0441\u043a\u043e\u043b\u044c\u043a\u043e \u043e\u0431\u044a\u0435\u043a\u0442\u043e\u0432 \u0442\u0438\u043f\u0430 "
                f"\u00ab{from_type}\u00bb \u0438\u043b\u0438 \u00ab{to_type}\u00bb"
            )

        try:
            max_relations = max(1, min(2500, int(params_dict.get("max_relations") or 2000)))
        except (TypeError, ValueError):
            max_relations = 2000
        rows = await self._load_relation_summaries(project_id, relation_type, selected, max_relations + 1)
        truncated = len(rows) > max_relations
        rows = rows[:max_relations]
        commands = [self._entity_command(item["type_id"], item["external_key"]) for item in selected]
        created_nodes = 0
        created_edges = 0
        directed = bool(edge_type.get("directed"))
        visual = edge_type.get("default_visual")
        direction = normalize_text(visual.get("direction")) if isinstance(visual, dict) else ""
        direction = direction or ("to" if directed else "both")

        for row in rows:
            row_from_type = normalize_text(row.get("from_type"))
            row_from_key = normalize_text(row.get("from_key"))
            row_to_type = normalize_text(row.get("to_type"))
            row_to_key = normalize_text(row.get("to_key"))
            if not all((row_from_type, row_from_key, row_to_type, row_to_key)):
                continue

            anchor = next(
                (
                    node
                    for node in nodes
                    if normalize_text(node.get("type")).lower() == row_from_type.lower()
                    and self.graph.canonical_label(row_from_type, node_label(node)).lower()
                    == self.graph.canonical_label(row_from_type, row_from_key).lower()
                ),
                None,
            )
            prior_ids = {node_id(node) for node in nodes}
            from_attributes = row.get("from_attributes")
            if not isinstance(from_attributes, dict):
                from_attributes = {}
            to_attributes = row.get("to_attributes")
            if not isinstance(to_attributes, dict):
                to_attributes = {}
            from_node = self.graph.find_or_create_node(
                nodes,
                row_from_type,
                row_from_key,
                anchor_node=anchor,
                extra_attributes=from_attributes,
            )
            to_node = self.graph.find_or_create_node(
                nodes,
                row_to_type,
                row_to_key,
                anchor_node=from_node,
                extra_attributes=to_attributes,
            )
            created_nodes += int(node_id(from_node) not in prior_ids)
            created_nodes += int(node_id(to_node) not in prior_ids)

            first_event_at = format_datetime(row.get("first_occurred_at"))
            last_event_at = format_datetime(row.get("last_occurred_at"))
            facts_count = int(row.get("facts_count") or 0)
            edge = self._find_edge(
                edges,
                node_id(from_node),
                node_id(to_node),
                relation_type,
                directed,
            )
            if edge is None:
                edge = self.graph.build_edge(
                    edges,
                    node_id(from_node),
                    node_id(to_node),
                    relation_type,
                    None,
                    normalize_text(edge_type.get("label")),
                )
                edges.append(edge)
                created_edges += 1
            self.graph.apply_edge_summary(edge, facts_count, first_event_at, last_event_at)

            attributes = edge.setdefault("attributes", {})
            if isinstance(attributes, dict):
                edge_visual = attributes.setdefault("visual", {})
                if isinstance(edge_visual, dict):
                    edge_visual["direction"] = direction
                connection_types = normalize_text(row.get("connection_types"))
                if connection_types:
                    attributes["connection_types"] = connection_types

            commands.extend([
                self._entity_command(row_from_type, row_from_key),
                self._entity_command(row_to_type, row_to_key),
            ])

        return [{
            "type": "graph",
            "name": source.get("name") if is_graph else "\u0421\u0432\u044f\u0437\u0438: " + (normalize_text(edge_type.get("label")) or relation_type),
            "description": source.get("description") if is_graph else "\u041f\u043e\u043b\u0443\u0447\u0435\u043d\u043e \u0438\u0437 \u0432\u044b\u0431\u0440\u0430\u043d\u043d\u044b\u0445 \u043e\u0431\u044a\u0435\u043a\u0442\u043e\u0432.",
            "data": {**data, "nodes": nodes, "edges": edges},
            "metadata": {
                **((source.get("metadata") or {}) if is_graph else {}),
                "source_plugin": self.id,
                "relation_type": relation_type,
                "selected_entities": len(selected),
                "relations_found": len(rows),
                "relations_limit": max_relations,
                "relations_truncated": truncated,
                "created_nodes": created_nodes,
                "created_edges": created_edges,
                "domain_entity_commands": commands,
            },
            "output_mode": output_mode,
        }]
