from pathlib import Path

from app.import_plugin_sdk import (
    ProjectDataImportExecutionResult,
    ProjectDataImportPlugin,
)


class ExampleImportPlugin(ProjectDataImportPlugin):
    id = "example_import_plugin"
    name = "Example Import Plugin"
    version = "1.0.0"
    description = "Template for external project-data import plugins."
    extensions = [".csv"]
    recognition_hint = "Rename this file without leading underscore to enable discovery."
    config_schema = {
        "type": "object",
        "properties": {
            "delimiter": {"type": "string", "default": ";"},
        },
        "additionalProperties": False,
    }

    def recognize_file(self, source_dir: Path, input_file: dict[str, object]) -> int:
        return -1

    def run(self, source_dir: Path, output_dir: Path) -> ProjectDataImportExecutionResult:
        raise NotImplementedError("Example plugin template is not executable")
