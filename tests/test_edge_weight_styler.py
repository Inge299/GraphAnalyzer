import asyncio
import unittest

from plugins.edge_weight_styler import EdgeWeightStylerPlugin


class EdgeWeightStylerTests(unittest.TestCase):
    def test_normalizes_only_selected_relation_type(self):
        plugin = EdgeWeightStylerPlugin()
        graph = {
            "type": "graph",
            "data": {
                "edges": [
                    {"id": "one", "type": "calls", "attributes": {"events_count": 1}},
                    {"id": "two", "type": "calls", "attributes": {"events_count": 100}},
                    {"id": "other", "type": "uses", "attributes": {"events_count": 50}},
                ],
            },
        }

        result = asyncio.run(plugin.execute([graph], {"relation_type": "calls"}))[0]
        edges = {edge["id"]: edge for edge in result["data"]["edges"]}

        self.assertEqual(edges["one"]["attributes"]["width"], 1.5)
        self.assertEqual(edges["two"]["attributes"]["width"], 10.0)
        self.assertNotIn("width", edges["other"]["attributes"])
        self.assertEqual(result["metadata"]["weighted_relation_type"], "calls")


if __name__ == "__main__":
    unittest.main()