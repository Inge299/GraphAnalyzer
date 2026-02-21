"""
Example plugin that analyzes node degrees in the graph.
"""
import logging
from typing import Dict, Any
from plugins import PluginBase

logger = logging.getLogger(__name__)

class DegreeAnalyzerPlugin(PluginBase):
    """Plugin to analyze node degrees in the graph."""

    name = "degree_analyzer"
    version = "1.0.0"
    description = "Analyzes node degrees and identifies hubs"

    async def analyze(self, graph_data: dict) -> dict:
        """
        Analyze node degrees in the graph.

        Args:
            graph_data: Dictionary containing nodes and edges

        Returns:
            Dictionary with analysis results
        """
        try:
            nodes = graph_data.get('nodes', [])
            edges = graph_data.get('edges', [])

            # Calculate degrees
            degree_count = {}
            for edge in edges:
                source = edge.get('from') or edge.get('source')
                target = edge.get('to') or edge.get('target')

                if source:
                    degree_count[source] = degree_count.get(source, 0) + 1
                if target:
                    degree_count[target] = degree_count.get(target, 0) + 1

            # Find hubs (nodes with high degree)
            if degree_count:
                avg_degree = sum(degree_count.values()) / len(degree_count)
                hubs = [
                    {'node_id': node_id, 'degree': degree}
                    for node_id, degree in degree_count.items()
                    if degree > avg_degree * 1.5
                ]
                hubs.sort(key=lambda x: x['degree'], reverse=True)
            else:
                avg_degree = 0
                hubs = []

            return {
                'plugin': self.name,
                'version': self.version,
                'results': {
                    'total_nodes': len(nodes),
                    'total_edges': len(edges),
                    'average_degree': avg_degree,
                    'max_degree': max(degree_count.values()) if degree_count else 0,
                    'hubs': hubs[:10],  # Top 10 hubs
                    'degree_distribution': {
                        str(k): v for k, v in sorted(degree_count.items())[:20]
                    }
                }
            }

        except Exception as e:
            logger.error(f"Error in degree analysis: {e}")
            return {
                'plugin': self.name,
                'version': self.version,
                'error': str(e)
            }

    async def validate(self, graph_data: dict) -> bool:
        """Validate that graph data has required fields."""
        return 'nodes' in graph_data and 'edges' in graph_data
