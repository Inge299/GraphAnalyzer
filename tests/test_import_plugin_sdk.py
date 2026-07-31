import json

import pytest

from app.import_plugin_sdk import (
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
    version = "2.0.0"
    description = "Contract test plugin."
    extensions = [".csv"]
    output_dataset_ids = ("sample_facts",)
    output_dataset_labels = {"sample_facts": "Sample facts"}

    def recognize_file(self, source_dir, input_file):
        return 100

    def normalize_sources(self, source_dir):
        return {"sample_facts": [{"value": "one"}]}


def _valid_result(tmp_path, plugin: ProjectDataImportPlugin) -> ProjectDataImportExecutionResult:
    manifest_path = tmp_path / "normalized_import_manifest.json"
    manifest_path.write_text(json.dumps({"plugin_id": plugin.id, "mode": "normalized_sources"}), encoding="utf-8")
    return ProjectDataImportExecutionResult(
        plugin_id=plugin.id,
        plugin_name=plugin.name,
        plugin_description=plugin.description,
        manifest_path=manifest_path,
        normalized_sources={"sample_facts": [{"value": "one"}]},
    )


def test_manifest_accepts_stable_plugin_metadata():
    validate_plugin_manifest(ValidImportPlugin().manifest())


def test_manifest_rejects_invalid_plugin_id():
    class InvalidPlugin(ValidImportPlugin):
        id = "Invalid plugin id"

    with pytest.raises(ImportPluginContractError, match="id must match"):
        validate_plugin_manifest(InvalidPlugin().manifest())


def test_execution_result_accepts_normalized_sources(tmp_path):
    plugin = ValidImportPlugin()
    context = ImportExecutionContext(source_dir=tmp_path / "source", output_dir=tmp_path)

    validate_execution_result(plugin, context, _valid_result(tmp_path, plugin))


def test_execution_result_rejects_missing_declared_source(tmp_path):
    plugin = ValidImportPlugin()
    result = _valid_result(tmp_path, plugin)
    result.normalized_sources = {}
    context = ImportExecutionContext(source_dir=tmp_path / "source", output_dir=tmp_path)

    with pytest.raises(ImportPluginContractError, match="missing datasets"):
        validate_execution_result(plugin, context, result)


def test_execution_result_rejects_non_object_source_rows(tmp_path):
    plugin = ValidImportPlugin()
    result = _valid_result(tmp_path, plugin)
    result.normalized_sources = {"sample_facts": ["invalid"]}
    context = ImportExecutionContext(source_dir=tmp_path / "source", output_dir=tmp_path)

    with pytest.raises(ImportPluginContractError, match="lists of objects"):
        validate_execution_result(plugin, context, result)


def test_execution_result_rejects_manifest_outside_plugin_directory(tmp_path):
    plugin = ValidImportPlugin()
    output_dir = tmp_path / "output"
    output_dir.mkdir()
    result = _valid_result(output_dir, plugin)
    escaped_path = tmp_path / "manifest.json"
    escaped_path.write_text("{}", encoding="utf-8")
    result.manifest_path = escaped_path
    context = ImportExecutionContext(source_dir=tmp_path / "source", output_dir=output_dir)

    with pytest.raises(ImportPluginContractError, match="manifest must stay inside"):
        validate_execution_result(plugin, context, result)