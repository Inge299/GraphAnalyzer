"""Plugin that adds new nodes/edges with visual attributes and produces a document report."""

from typing import List, Dict, Any, Optional

from plugins import PluginBase
from plugins.graph_domain import get_graph_rules, resolve_edge_type, find_node_by_label, edge_exists


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
    version = "1.2.0"
    description = "Adds annotated nodes/edges with visuals and generates a connections report"
    menu_path = "Transform/Graph"
    input_types = ["graph"]
    output_types = ["graph", "document"]
    applicable_to = ["graph"]
    params_schema = [
        {"key": "period_start", "label": "Дата начала", "type": "date", "required": False},
        {"key": "period_end", "label": "Дата окончания", "type": "date", "required": False},
    ]

    async def execute(self, input_artifacts: List[dict], params: Optional[Dict[str, Any]] = None) -> List[dict]:
        if not input_artifacts:
            return []

        graph = input_artifacts[0]
        data = graph.get("data", {}) or {}
        nodes = list(data.get("nodes", []))
        edges = list(data.get("edges", []))
        rules = get_graph_rules()

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

        anchor_x = 0
        anchor_y = 0
        anchor_id = None
        anchor_type = "person"
        if nodes:
            anchor_id = _node_id(nodes[0]) or nodes[0].get("id")
            anchor_type = str(nodes[0].get("type") or "person")
            anchor_x = nodes[0].get("position_x") or nodes[0].get("x") or 0
            anchor_y = nodes[0].get("position_y") or nodes[0].get("y") or 0

        run_index = len(edges) + 1
        templates = (
            {"type": "phone", "color": "#60a5fa", "icon": "smartphone", "label": f"New entity A {run_index}"},
            {"type": "person", "color": "#34d399", "icon": "person_phone", "label": f"New entity B {run_index}"},
        )

        attached_nodes: List[Dict[str, Any]] = []

        for i, style in enumerate(templates):
            existing = None
            if rules["merge_nodes_with_same_label"]:
                existing = find_node_by_label(nodes, style["label"])

            if existing:
                attached_nodes.append(existing)
                continue

            node_id = next_id("auto_node_")
            offset = 120 * (i + 1)
            node = {
                "id": node_id,
                "type": style["type"],
                "label": style["label"],
                "position_x": anchor_x + offset,
                "position_y": anchor_y + (offset / 2),
                "attributes": {
                    "visual": {
                        "color": style["color"],
                        "icon": style["icon"],
                        "label": style["label"],
                        "fontColor": "#0f172a",
                    }
                },
            }
            nodes.append(node)
            attached_nodes.append(node)

        new_edges: List[Dict[str, Any]] = []
        if anchor_id:
            for idx, node in enumerate(attached_nodes, start=1):
                from_id = str(node.get("id"))
                if from_id == str(anchor_id):
                    continue

                from_type = str(node.get("type") or "")
                edge_type = resolve_edge_type(from_type, anchor_type)

                if (not rules["allow_parallel_edges"]) and edge_exists(edges + new_edges, from_id, str(anchor_id), edge_type):
                    continue

                edge_id = next_edge_id("auto_edge_")
                label = f"auto-link-{idx}"
                new_edges.append(
                    {
                        "id": edge_id,
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

            if rules["allow_parallel_edges"] or not edge_exists(edges, str(left.get("id")), str(right.get("id")), edge_type):
                new_edges.append(
                    {
                        "id": next_edge_id("auto_edge_"),
                        "type": edge_type,
                        "from": left.get("id"),
                        "to": right.get("id"),
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
