"""
Example plugin that detects communities in the graph.
"""
import logging
from collections import defaultdict
from typing import List, Dict, Any
from plugins import PluginBase

logger = logging.getLogger(__name__)


class CommunityDetectorPlugin(PluginBase):
    """Plugin to detect communities using simple connectivity analysis."""

    id = "community_detector"
    name = "Community Detector"
    version = "1.1.0"
    description = "Detects communities using connectivity analysis"
    menu_path = "Analysis/Graph"
    input_types = ["graph"]
    output_types = ["document"]
    applicable_to = ["graph"]

    async def analyze(self, graph_data: dict) -> dict:
        """Detect communities in the graph and return a results dict."""
        try:
            nodes = graph_data.get("nodes", [])
            edges = graph_data.get("edges", [])

            adj_list = defaultdict(set)
            for edge in edges:
                source = edge.get("from") or edge.get("source") or edge.get("source_node")
                target = edge.get("to") or edge.get("target") or edge.get("target_node")

                if source and target:
                    adj_list[source].add(target)
                    adj_list[target].add(source)

            visited = set()
            communities = []

            for node in adj_list:
                if node not in visited:
                    community = []
                    queue = [node]
                    visited.add(node)

                    while queue:
                        current = queue.pop(0)
                        community.append(current)

                        for neighbor in adj_list[current]:
                            if neighbor not in visited:
                                visited.add(neighbor)
                                queue.append(neighbor)

                    if len(community) > 1:
                        communities.append(community)

            communities.sort(key=len, reverse=True)

            node_labels = {}
            for node in nodes:
                node_id = node.get("id") or node.get("node_id")
                label = node.get("label") or node.get("name") or str(node_id)
                if node_id:
                    node_labels[node_id] = label

            community_details = []
            for i, comm in enumerate(communities[:10]):
                community_details.append({
                    "id": i + 1,
                    "size": len(comm),
                    "nodes": [
                        {
                            "id": node_id,
                            "label": node_labels.get(node_id, str(node_id))
                        }
                        for node_id in comm[:10]
                    ]
                })

            return {
                "total_communities": len(communities),
                "communities": community_details,
                "largest_community_size": len(communities[0]) if communities else 0,
                "modularity_score": 0.0
            }

        except Exception as e:
            logger.error(f"Error in community detection: {e}")
            return {"error": str(e)}

    async def execute(self, input_artifacts: List[dict], params: Dict[str, Any] | None = None) -> List[dict]:
        if not input_artifacts:
            return []

        graph = input_artifacts[0]
        result = await self.analyze(graph.get("data", {}))

        title = f"Community report: {graph.get('name', 'Graph')}"
        content_lines = [
            f"# {title}",
            "",
            f"Total communities: {result.get('total_communities', 0)}",
            f"Largest community size: {result.get('largest_community_size', 0)}",
            "",
            "## Top communities",
        ]

        for comm in result.get("communities", []):
            content_lines.append(f"- Community {comm['id']} (size {comm['size']})")

        return [
            {
                "type": "document",
                "name": title,
                "description": "Auto-generated community analysis",
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
