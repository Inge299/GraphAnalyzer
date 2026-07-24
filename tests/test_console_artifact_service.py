from app.services.console_artifact_service import (
    build_console_artifact_metadata,
    normalize_console_artifact_data,
)


def test_normalize_console_artifact_data_from_rows_and_columns():
    payload = {
        "rows": [{"msisdn": "123", "count": 4}],
        "columns": ["msisdn", "count"],
    }

    normalized = normalize_console_artifact_data(
        payload,
        executor_type="python",
        executor_id="demo_plugin",
        source_plugin_id="demo_plugin",
    )

    assert normalized["artifact_kind"] == "console"
    assert normalized["executor"]["type"] == "python"
    assert normalized["executor"]["id"] == "demo_plugin"
    assert normalized["active_tab_id"] == "result_1"
    assert len(normalized["tabs"]) == 1
    assert len(normalized["result_sets"]) == 1
    assert normalized["columns"][0]["key"] == "msisdn"
    assert normalized["rows"][0]["count"] == 4


def test_normalize_console_artifact_data_from_result_sets():
    payload = {
        "result_sets": [
            {
                "key": "main",
                "name": "Main",
                "columns": [{"key": "value", "label": "Value"}],
                "rows": [{"value": 1}],
            }
        ]
    }

    normalized = normalize_console_artifact_data(payload, executor_type="sql_function")

    assert normalized["executor"]["type"] == "sql_function"
    assert normalized["tabs"][0]["id"] == "main"
    assert normalized["columns"][0]["label"] == "Value"
    assert normalized["rows"][0]["value"] == 1


def test_build_console_artifact_metadata_counts_rows():
    tabs = [
        {"id": "a", "row_count": 2},
        {"id": "b", "row_count": 3},
    ]

    metadata = build_console_artifact_metadata(
        base_metadata={"keep": True},
        profile_kind="python_plugin",
        profile_id="plugin_x",
        profile_name="Plugin X",
        tabs=tabs,
        source_plugin_id="plugin_x",
    )

    assert metadata["keep"] is True
    assert metadata["console_profile_kind"] == "python_plugin"
    assert metadata["console_tabs_count"] == 2
    assert metadata["console_rows_count"] == 5
    assert metadata["source_plugin"] == "plugin_x"
