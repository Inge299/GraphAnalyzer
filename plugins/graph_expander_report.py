"""
Plugin that adds new nodes/edges with visual attributes and produces a document report.
"""
from typing import List, Dict, Any, Optional
from plugins import PluginBase


def _node_id(node: Dict[str, Any]) -> str:
    return str(node.get("id") or node.get("node_id") or "")


def _node_label(node: Dict[str, Any]) -> str:
    attributes = node.get("attributes") or {}
    visual = attributes.get("visual") or {}
    return (
        node.get("label")
        or visual.get("label")
        or attributes.get("label")
        or attributes.get("name")
        or _node_id(node)
        or ""
    )


class GraphExpanderReportPlugin(PluginBase):
    id = "graph_expander_report"
    name = "Graph Expander + Report"
    version = "1.0.0"
    description = "Adds annotated nodes/edges with visuals and generates a connections report"
    menu_path = "Transform/Graph"
    input_types = ["graph"]
    output_types = ["graph", "document"]
    applicable_to = ["graph"]

    async def execute(self, input_artifacts: List[dict], params: Optional[Dict[str, Any]] = None) -> List[dict]:
        if not input_artifacts:
            return []

        graph = input_artifacts[0]
        data = graph.get("data", {}) or {}
        nodes = list(data.get("nodes", []))
        edges = list(data.get("edges", []))

        existing_ids = {str(_node_id(n)) for n in nodes if _node_id(n)}
        existing_edge_ids = {str(edge.get("id")) for edge in edges if edge.get("id")}

        def next_id(prefix: str) -> str:
            index = 1
            while True:
                candidate = f"{prefix}{index}"
                if candidate not in existing_ids:
                    existing_ids.add(candidate)
                    return candidate
                index += 1

        def next_edge_id(prefix: str) -> str:
            index = 1
            while True:
                candidate = f"{prefix}{index}"
                if candidate not in existing_edge_ids:
                    existing_edge_ids.add(candidate)
                    return candidate
                index += 1

        # Resolve anchor position for new nodes
        anchor_x = 0
        anchor_y = 0
        anchor_id = None
        if nodes:
            anchor_id = _node_id(nodes[0]) or nodes[0].get("id")
            anchor_x = nodes[0].get("position_x") or nodes[0].get("x") or 0
            anchor_y = nodes[0].get("position_y") or nodes[0].get("y") or 0

        # Create two new nodes with visual attributes
        new_nodes = []
        for i, style in enumerate((
            {"color": "#60a5fa", "icon": "?", "label": "New entity A"},
            {"color": "#34d399", "icon": "?", "label": "New entity B"}
        )):
            node_id = next_id("auto_node_")
            offset = 120 * (i + 1)
            new_nodes.append({
                "id": node_id,
                "type": "annotation",
                "label": style["label"],
                "position_x": anchor_x + offset,
                "position_y": anchor_y + (offset / 2),
                "attributes": {
                    "visual": {
                        "color": style["color"],
                        "icon": style["icon"],
                        "label": style["label"],
                        "fontColor": "#ffffff"
                    }
                }
            })

        nodes.extend(new_nodes)

        # Connect new nodes to the first existing node (or between themselves if empty)
        new_edges = []
        if anchor_id:
            for idx, node in enumerate(new_nodes, start=1):
                edge_id = next_edge_id("auto_edge_")
                new_edges.append({
                    "id": edge_id,
                    "type": "annotation",
                    "from": node.get("id"),
                    "to": anchor_id,
                    "label": f"auto-link-{idx}",
                    "attributes": {
                        "visual": {
                            "color": "#f59e0b",
                            "label": f"auto-link-{idx}"
                        }
                    }
                })
        elif len(new_nodes) >= 2:
            new_edges.append({
                "id": next_edge_id("auto_edge_"),
                "type": "annotation",
                "from": new_nodes[0].get("id"),
                "to": new_nodes[1].get("id"),
                "label": "auto-link-1",
                "attributes": {
                    "visual": {
                        "color": "#f59e0b",
                        "label": "auto-link-1"
                    }
                }
            })

        edges.extend(new_edges)

        # Build document report of connections
        label_map = {str(_node_id(node)): _node_label(node) for node in nodes}
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
            "data": {
                **data,
                "nodes": nodes,
                "edges": edges
            },
            "metadata": {
                "source_plugin": self.id,
                "derived_from": graph.get("id")
            }
        }

        doc_output = {
            "type": "document",
            "name": f"{graph.get('name', 'Graph')} connections",
            "description": "Auto-generated connections list",
            "data": {
                "content": report_content
            },
            "metadata": {
                "source_plugin": self.id,
                "derived_from": graph.get("id")
            }
        }

        return [graph_output, doc_output]





