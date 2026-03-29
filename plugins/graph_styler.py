"""
Plugin that applies visual attributes to graph nodes and edges.
"""
from typing import List, Dict, Any
from plugins import PluginBase


class GraphStylerPlugin(PluginBase):
    id = "graph_styler"
    name = "Graph Styler"
    version = "1.0.0"
    description = "Applies colors, icons, and labels based on node and edge types"
    menu_path = "Transform/Graph"
    input_types = ["graph"]
    output_types = ["graph"]
    applicable_to = ["graph"]

    async def execute(self, input_artifacts: List[dict], params: Dict[str, Any] | None = None) -> List[dict]:
        if not input_artifacts:
            return []

        graph = input_artifacts[0]
        data = graph.get("data", {})
        nodes = data.get("nodes", [])
        edges = data.get("edges", [])

        type_styles = {
            "person": {"color": "#64b5f6", "icon": "@", "label_prefix": "Person"},
            "company": {"color": "#81c784", "icon": "#", "label_prefix": "Company"},
            "phone": {"color": "#ffb74d", "icon": "P", "label_prefix": "Phone"},
            "location": {"color": "#ba68c8", "icon": "L", "label_prefix": "Location"},
            "document": {"color": "#90a4ae", "icon": "D", "label_prefix": "Doc"}
        }

        styled_nodes = []
        for node in nodes:
            node_type = node.get("type", "")
            style = type_styles.get(node_type, {"color": "#e0e0e0", "icon": "*", "label_prefix": ""})

            attributes = dict(node.get("attributes") or {})
            visual = dict(attributes.get("visual") or {})
            visual.setdefault("color", style["color"])
            visual.setdefault("icon", style["icon"])
            attributes["visual"] = visual

            label = node.get("label") or attributes.get("label") or attributes.get("name")
            if not label:
                prefix = style["label_prefix"]
                label = f"{prefix} {node.get('id') or node.get('node_id') or ''}".strip()

            styled_nodes.append({
                **node,
                "label": label,
                "attributes": attributes
            })

        styled_edges = []
        for edge in edges:
            attributes = dict(edge.get("attributes") or {})
            visual = dict(attributes.get("visual") or {})
            visual.setdefault("color", "#848484")
            attributes["visual"] = visual

            label = edge.get("label") or attributes.get("label") or edge.get("type")
            styled_edges.append({
                **edge,
                "label": label,
                "attributes": attributes
            })

        return [
            {
                "type": "graph",
                "name": f"{graph.get('name', 'Graph')} (styled)",
                "description": "Derived graph with visual attributes",
                "data": {
                    **data,
                    "nodes": styled_nodes,
                    "edges": styled_edges
                },
                "metadata": {
                    "source_plugin": self.id,
                    "derived_from": graph.get("id")
                }
            }
        ]
