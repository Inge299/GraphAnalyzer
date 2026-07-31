import unittest

from plugins.graph_toolkit import GraphPluginToolkit


class GraphRelationAggregationTests(unittest.TestCase):
    def test_summary_replaces_per_event_payload(self):
        toolkit = GraphPluginToolkit()
        edge = toolkit.build_edge([], "a", "b", "msisdn_imei_usage", "01.01.2026 10:00", "Использует аппарат")

        toolkit.apply_edge_summary(edge, 27, "01.01.2026 10:00", "04.02.2026 12:45")

        self.assertEqual(edge["attributes"]["events_count"], 27)
        self.assertEqual(edge["attributes"]["first_event_at"], "01.01.2026 10:00")
        self.assertEqual(edge["attributes"]["last_event_at"], "04.02.2026 12:45")
        self.assertNotIn("event_times", edge["attributes"])
        self.assertIn("Событий: 27", edge["label"])
        self.assertIn("01.01.2026 10:00 - 04.02.2026 12:45", edge["label"])


if __name__ == "__main__":
    unittest.main()