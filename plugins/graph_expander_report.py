"""Plugin that adds new nodes/edges with visual attributes and produces a document report."""

from typing import Any, Dict, List, Optional

from plugins import PluginBase
from plugins.graph_domain import get_graph_rules, resolve_edge_type
from plugins.graph_toolkit import GraphPluginToolkit, node_id, node_label


class GraphExpanderReportPlugin(PluginBase):
    id = "graph_expander_report"
    name = "Graph Expander + Report"
    version = "1.3.0"
    description = "Adds annotated nodes/edges with visuals and generates a connections report"
    menu_path = "Transform/Graph"
    input_types = ["graph"]
    output_types = ["graph", "document"]
    applicable_to = ["graph"]
    params_schema = [
        {"key": "period_start", "label": "Дата начала", "type": "date", "required": False},
        {"key": "period_end", "label": "Дата окончания", "type": "date", "required": False},
    ]

    def __init__(self) -> None:
        self.graph = GraphPluginToolkit()

    async def execute(self, input_artifacts: List[dict], params: Optional[Dict[str, Any]] = None) -> List[dict]:
        if not input_artifacts:
            return []

        graph = input_artifacts[0]
        data = graph.get("data", {}) or {}
        nodes = list(data.get("nodes", []))
        edges = list(data.get("edges", []))
        rules = get_graph_rules()

        anchor_id = None
        anchor_type = "person"
        anchor_node: Optional[Dict[str, Any]] = None
        if nodes:
            anchor_node = nodes[0]
            anchor_id = node_id(anchor_node) or anchor_node.get("id")
            anchor_type = str(anchor_node.get("type") or "person")

        run_index = len(edges) + 1
        templates = (
            {"type": "phone", "color": "#60a5fa", "icon": "smartphone", "label": f"New entity A {run_index}"},
            {"type": "person", "color": "#34d399", "icon": "person_phone", "label": f"New entity B {run_index}"},
        )

        attached_nodes: List[Dict[str, Any]] = []
        for style in templates:
            node = self.graph.find_or_create_node(
                nodes,
                style["type"],
                style["label"],
                anchor_node=anchor_node,
                extra_attributes={
                    "visual": {
                        "color": style["color"],
                        "icon": style["icon"],
                        "label": style["label"],
                        "fontColor": "#0f172a",
                    }
                },
            )
            attached_nodes.append(node)

        new_edges: List[Dict[str, Any]] = []
        if anchor_id:
            for idx, node in enumerate(attached_nodes, start=1):
                from_id = node_id(node)
                if from_id == str(anchor_id):
                    continue

                edge_type = resolve_edge_type(str(node.get("type") or ""), anchor_type)
                if (not rules["allow_parallel_edges"]) and self.graph.find_existing_edge(edges + new_edges, from_id, str(anchor_id), edge_type):
                    continue

                label = f"auto-link-{idx}"
                new_edges.append(
                    {
                        "id": self.graph.next_edge_id(edges + new_edges),
                        "type": edge_type,
                        "from": from_id,
                        "to": anchor_id,
                        "label": label,
                        "attributes": {
                            "visual": {
                                "color": "#f59e0b",
                                "label": label,
                                "direction": "to",
                            }
                        },
                    }
                )
        elif len(attached_nodes) >= 2:
            left = attached_nodes[0]
            right = attached_nodes[1]
            edge_type = resolve_edge_type(str(left.get("type") or ""), str(right.get("type") or ""))

            if rules["allow_parallel_edges"] or not self.graph.find_existing_edge(edges, node_id(left), node_id(right), edge_type):
                new_edges.append(
                    {
                        "id": self.graph.next_edge_id(edges + new_edges),
                        "type": edge_type,
                        "from": node_id(left),
                        "to": node_id(right),
                        "label": "auto-link-1",
                        "attributes": {
                            "visual": {
                                "color": "#f59e0b",
                                "label": "auto-link-1",
                                "direction": "to",
                            }
                        },
                    }
                )

        edges.extend(new_edges)

        label_map = {node_id(node): node_label(node) for node in nodes}
        lines = ["# Connections report", "", f"Total nodes: {len(nodes)}", f"Total edges: {len(edges)}", "", "## Edges"]
        for edge in edges:
            src = str(edge.get("from") or edge.get("source_node") or "")
            dst = str(edge.get("to") or edge.get("target_node") or "")
            src_label = label_map.get(src, src or "?")
            dst_label = label_map.get(dst, dst or "?")
            label = edge.get("label") or edge.get("type") or "edge"
            lines.append(f"- {src_label} -> {dst_label} ({label})")

        report_content = "\n".join(lines)

        graph_output = {
            "type": "graph",
            "name": f"{graph.get('name', 'Graph')} (expanded)",
            "description": "Graph with new nodes/edges and visual attributes",
            "data": {**data, "nodes": nodes, "edges": edges},
            "metadata": {"source_plugin": self.id, "derived_from": graph.get("id")},
        }

        doc_output = {
            "type": "document",
            "name": f"{graph.get('name', 'Graph')} connections",
            "description": "Auto-generated connections list",
            "data": {"content": report_content},
            "metadata": {"source_plugin": self.id, "derived_from": graph.get("id")},
        }

        return [graph_output, doc_output]
