"""
Example plugin that analyzes node degrees in the graph.
"""
import logging
from typing import List, Dict, Any
from plugins import PluginBase

logger = logging.getLogger(__name__)


class DegreeAnalyzerPlugin(PluginBase):
    """Plugin to analyze node degrees in the graph."""

    id = "degree_analyzer"
    name = "Degree Analyzer"
    version = "1.1.0"
    description = "Analyzes node degrees and identifies hubs"
    menu_path = "Analysis/Graph"
    input_types = ["graph"]
    output_types = ["document"]
    applicable_to = ["graph"]

    async def analyze(self, graph_data: dict) -> dict:
        """Analyze node degrees in the graph and return a results dict."""
        try:
            nodes = graph_data.get("nodes", [])
            edges = graph_data.get("edges", [])

            degree_count: Dict[str, int] = {}
            for edge in edges:
                source = edge.get("from") or edge.get("source") or edge.get("source_node")
                target = edge.get("to") or edge.get("target") or edge.get("target_node")

                if source:
                    degree_count[source] = degree_count.get(source, 0) + 1
                if target:
                    degree_count[target] = degree_count.get(target, 0) + 1

            if degree_count:
                avg_degree = sum(degree_count.values()) / len(degree_count)
                hubs = [
                    {"node_id": node_id, "degree": degree}
                    for node_id, degree in degree_count.items()
                    if degree > avg_degree * 1.5
                ]
                hubs.sort(key=lambda x: x["degree"], reverse=True)
            else:
                avg_degree = 0
                hubs = []

            return {
                "total_nodes": len(nodes),
                "total_edges": len(edges),
                "average_degree": avg_degree,
                "max_degree": max(degree_count.values()) if degree_count else 0,
                "hubs": hubs[:10],
                "degree_distribution": {
                    str(k): v for k, v in sorted(degree_count.items())[:20]
                }
            }

        except Exception as e:
            logger.error(f"Error in degree analysis: {e}")
            return {"error": str(e)}

    async def execute(self, input_artifacts: List[dict], params: Dict[str, Any] | None = None) -> List[dict]:
        if not input_artifacts:
            return []

        graph = input_artifacts[0]
        result = await self.analyze(graph.get("data", {}))

        title = f"Degree report: {graph.get('name', 'Graph')}"
        content_lines = [
            f"# {title}",
            "",
            f"Total nodes: {result.get('total_nodes', 0)}",
            f"Total edges: {result.get('total_edges', 0)}",
            f"Average degree: {result.get('average_degree', 0):.2f}",
            f"Max degree: {result.get('max_degree', 0)}",
            "",
            "## Top hubs"
        ]

        for hub in result.get("hubs", []):
            content_lines.append(f"- {hub['node_id']}: {hub['degree']}")

        return [
            {
                "type": "document",
                "name": title,
                "description": "Auto-generated degree analysis",
                "data": {
                    "content": "\n".join(content_lines)
                },
                "metadata": {
                    "source_plugin": self.id
                }
            }
        ]

    async def validate(self, input_artifacts: List[dict]) -> bool:
        return bool(input_artifacts)
