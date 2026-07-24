import asyncio

from app.console_plugins import AVAILABLE_CONSOLE_EXECUTORS


GRAPH = {
    "id": 10,
    "type": "graph",
    "data": {
        "nodes": [
            {"id": "a", "type": "msisdn", "label": "79000000001"},
            {"id": "b", "type": "msisdn", "label": "79000000002"},
            {"id": "c", "type": "imei", "label": "123456789012345"},
            {"id": "d", "type": "ip_address", "label": "192.0.2.1"},
        ],
        "edges": [
            {"id": "e1", "type": "msisdn_device_link", "from": "a", "to": "c"},
            {"id": "e2", "type": "msisdn_device_link", "from": "b", "to": "c"},
            {"id": "e3", "type": "ip_msisdn_link", "from": "a", "to": "d"},
            {"id": "e4", "type": "ip_msisdn_link", "from": "b", "to": "d"},
        ],
    },
}


def execute(executor_id, context=None):
    executor = AVAILABLE_CONSOLE_EXECUTORS[executor_id]()
    return asyncio.run(executor.execute(project_id=1, artifact=GRAPH, params={}, context=context or {}))


def test_graph_summary_is_discovered_and_uses_domain_labels():
    result = execute("graph_summary")
    assert result["active_tab_id"] == "summary"
    assert result["tabs"][0]["rows"][0]["nodes"] == 4
    assert any(row["type_name"] == "MSISDN" for row in result["tabs"][1]["rows"])


def test_common_neighbors_finds_shared_objects_for_selection():
    result = execute("common_neighbors", {"selected_node_ids": ["a", "b"]})
    common_rows = result["tabs"][1]["rows"]
    assert {row["node_id"] for row in common_rows} == {"c", "d"}
    assert result["tabs"][2]["rows"][0]["common_neighbors"] == 2


def test_common_neighbors_explains_missing_selection():
    result = execute("common_neighbors")
    assert result["tabs"][0]["rows"][0]["status"].startswith("Выберите")
