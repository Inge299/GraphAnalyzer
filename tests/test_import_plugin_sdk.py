import json

import pytest

from app.import_plugin_sdk import (
    CANONICAL_DATASETS,
    ImportExecutionContext,
    ImportPluginContractError,
    ProjectDataImportExecutionResult,
    ProjectDataImportPlugin,
    validate_execution_result,
    validate_plugin_manifest,
)


class ValidImportPlugin(ProjectDataImportPlugin):
    id = "test_import_plugin"
    name = "Test import plugin"
    version = "1.2.0"
    description = "Contract test plugin."
    extensions = [".csv"]


def _valid_result(tmp_path, plugin: ProjectDataImportPlugin) -> ProjectDataImportExecutionResult:
    paths = {}
    for dataset in CANONICAL_DATASETS:
        path = tmp_path / dataset.filename
        path.write_text(";".join(dataset.required_columns) + "\n", encoding="utf-8")
        paths[dataset.result_attribute] = path

    manifest_path = tmp_path / "manifest.json"
    manifest_path.write_text(json.dumps({"plugin_id": plugin.id}), encoding="utf-8")
    return ProjectDataImportExecutionResult(
        plugin_id=plugin.id,
        plugin_name=plugin.name,
        plugin_description=plugin.description,
        manifest_path=manifest_path,
        **paths,
    )


def test_manifest_accepts_stable_plugin_metadata():
    validate_plugin_manifest(ValidImportPlugin().manifest())


def test_manifest_rejects_invalid_plugin_id():
    class InvalidPlugin(ValidImportPlugin):
        id = "Invalid plugin id"

    with pytest.raises(ImportPluginContractError, match="id must match"):
        validate_plugin_manifest(InvalidPlugin().manifest())


def test_execution_result_accepts_canonical_outputs(tmp_path):
    plugin = ValidImportPlugin()
    context = ImportExecutionContext(source_dir=tmp_path / "source", output_dir=tmp_path)

    validate_execution_result(plugin, context, _valid_result(tmp_path, plugin))


def test_execution_result_accepts_semicolon_csv_with_commas_in_message_body(tmp_path):
    plugin = ValidImportPlugin()
    result = _valid_result(tmp_path, plugin)
    result.msisdn_text_facts_path.write_text(
        "event_time;user_msisdn;file_msisdn;message_text\n"
        "2026-07-23 12:00:00;79000000000;79100000000;first, second, third\n",
        encoding="utf-8",
    )
    context = ImportExecutionContext(source_dir=tmp_path / "source", output_dir=tmp_path)

    validate_execution_result(plugin, context, result)


def test_execution_result_rejects_missing_columns(tmp_path):
    plugin = ValidImportPlugin()
    result = _valid_result(tmp_path, plugin)
    result.communications_path.write_text("Абон1;Абон2\n", encoding="utf-8")
    context = ImportExecutionContext(source_dir=tmp_path / "source", output_dir=tmp_path)

    with pytest.raises(ImportPluginContractError, match="communications: missing columns"):
        validate_execution_result(plugin, context, result)


def test_execution_result_rejects_output_outside_plugin_directory(tmp_path):
    plugin = ValidImportPlugin()
    output_dir = tmp_path / "output"
    output_dir.mkdir()
    result = _valid_result(output_dir, plugin)
    escaped_path = tmp_path / "escaped.csv"
    escaped_path.write_text("Абон1;Абон2;время_начала;время_конца\n", encoding="utf-8")
    result.communications_path = escaped_path
    context = ImportExecutionContext(source_dir=tmp_path / "source", output_dir=output_dir)

    with pytest.raises(ImportPluginContractError, match="output must stay inside"):
        validate_execution_result(plugin, context, result)

