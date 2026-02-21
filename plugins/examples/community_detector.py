"""
Example plugin that detects communities in the graph.
"""
import logging
from typing import Dict, Any
from collections import defaultdict
from plugins import PluginBase

logger = logging.getLogger(__name__)

class CommunityDetectorPlugin(PluginBase):
    """Plugin to detect communities using simple connectivity analysis."""

    name = "community_detector"
    version = "1.0.0"
    description = "Detects communities using connectivity analysis"

    async def analyze(self, graph_data: dict) -> dict:
        """
        Detect communities in the graph.

        Args:
            graph_data: Dictionary containing nodes and edges

        Returns:
            Dictionary with community detection results
        """
        try:
            nodes = graph_data.get('nodes', [])
            edges = graph_data.get('edges', [])

            # Build adjacency list
            adj_list = defaultdict(set)
            for edge in edges:
                source = edge.get('from') or edge.get('source')
                target = edge.get('to') or edge.get('target')

                if source and target:
                    adj_list[source].add(target)
                    adj_list[target].add(source)

            # Simple community detection using connected components
            visited = set()
            communities = []

            for node in adj_list:
                if node not in visited:
                    # BFS to find connected component
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

                    if len(community) > 1:  # Only consider communities with >1 node
                        communities.append(community)

            # Sort communities by size
            communities.sort(key=len, reverse=True)

            # Get node labels for communities
            node_labels = {}
            for node in nodes:
                node_id = node.get('id')
                label = node.get('label') or node.get('name') or str(node_id)
                if node_id:
                    node_labels[node_id] = label

            community_details = []
            for i, comm in enumerate(communities[:10]):  # Top 10 communities
                community_details.append({
                    'id': i + 1,
                    'size': len(comm),
                    'nodes': [
                        {
                            'id': node_id,
                            'label': node_labels.get(node_id, str(node_id))
                        }
                        for node_id in comm[:10]  # Show first 10 nodes
                    ]
                })

            return {
                'plugin': self.name,
                'version': self.version,
                'results': {
                    'total_communities': len(communities),
                    'communities': community_details,
                    'largest_community_size': len(communities[0]) if communities else 0,
                    'modularity_score': 0.0,  # Placeholder for actual modularity calculation
                }
            }

        except Exception as e:
            logger.error(f"Error in community detection: {e}")
            return {
                'plugin': self.name,
                'version': self.version,
                'error': str(e)
            }

    async def validate(self, graph_data: dict) -> bool:
        """Validate that graph data has required fields."""
        return 'edges' in graph_data
