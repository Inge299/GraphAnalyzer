from __future__ import annotations

import json
from datetime import datetime, timezone
import re
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any, Iterator, Mapping

IMPORT_PLUGIN_SDK_VERSION = "2.0"


class ImportPluginContractError(ValueError):
    """Raised when a plugin definition or normalized output violates the SDK contract."""


@dataclass(frozen=True)
class OutputDatasetContract:
    id: str
    label: str


@dataclass(frozen=True)
class ImportPluginManifest:
    id: str
    name: str
    version: str
    description: str
    extensions: tuple[str, ...]
    priority: int = 0
    recognition_hint: str = ""
    sdk_version: str = IMPORT_PLUGIN_SDK_VERSION
    config_schema: Mapping[str, Any] = field(default_factory=dict)
    input_contract: Mapping[str, Any] = field(default_factory=dict)
    domain_contract: Mapping[str, Any] = field(default_factory=dict)
    capabilities: tuple[str, ...] = ("recognize", "preview", "import", "normalize")
    output_dataset_ids: tuple[str, ...] = ()


@dataclass(frozen=True)
class ImportExecutionContext:
    source_dir: Path
    output_dir: Path
    options: Mapping[str, Any] = field(default_factory=dict)
    dry_run: bool = False


@dataclass
class ProjectDataImportExecutionResult:
    plugin_id: str
    plugin_name: str
    plugin_description: str
    manifest_path: Path
    normalized_sources: dict[str, list[dict[str, Any]]]
    stdout: str = ""
    stderr: str = ""
    metrics: dict[str, Any] = field(default_factory=dict)
    warnings: list[str] = field(default_factory=list)
    sdk_version: str = IMPORT_PLUGIN_SDK_VERSION


class ProjectDataImportPlugin:
    id = "base_import_plugin"
    name = "Import plugin"
    version = "1.0.0"
    description = "Normalizes source files into typed domain facts."
    priority = 0
    enabled = True
    extensions: list[str] = [".csv"]
    recognition_hint = ""
    config_schema: Mapping[str, Any] = {}
    input_contract: Mapping[str, Any] = {}
    domain_contract: Mapping[str, Any] = {}
    capabilities: tuple[str, ...] = ("recognize", "preview", "import", "normalize")
    output_dataset_ids: tuple[str, ...] = ()
    output_dataset_labels: Mapping[str, str] = {}

    def manifest(self) -> ImportPluginManifest:
        return ImportPluginManifest(
            id=str(self.id),
            name=str(self.name),
            version=str(self.version),
            description=str(self.description),
            extensions=tuple(str(item).lower() for item in self.extensions),
            priority=int(self.priority),
            recognition_hint=str(self.recognition_hint),
            config_schema=dict(self.config_schema),
            input_contract=dict(self.input_contract),
            domain_contract=dict(self.domain_contract),
            capabilities=tuple(self.capabilities),
            output_dataset_ids=tuple(self.output_dataset_ids),
        )

    def dataset_contracts(self) -> tuple[OutputDatasetContract, ...]:
        return tuple(OutputDatasetContract(dataset_id, str(self.output_dataset_labels.get(dataset_id) or dataset_id)) for dataset_id in self.output_dataset_ids)

    def normalize_sources(self, source_dir: Path) -> Mapping[str, list[dict[str, Any]]]:
        raise NotImplementedError

    def iter_normalized_source_batches(
        self,
        source_dir: Path,
        batch_size: int = 2_000,
    ) -> Iterator[Mapping[str, list[dict[str, Any]]]]:
        """Yield normalized rows in write-ready batches.

        Third-party plugins keep the original one-result behavior until they opt in.
        """

        del batch_size
        yield self.normalize_sources(source_dir)

    def recognize_file(self, source_dir: Path, input_file: dict[str, Any]) -> int:
        raise NotImplementedError

    def execute(self, context: ImportExecutionContext) -> ProjectDataImportExecutionResult:
        sources = {str(name): list(rows) for name, rows in self.normalize_sources(context.source_dir).items()}
        context.output_dir.mkdir(parents=True, exist_ok=True)
        manifest_path = context.output_dir / "normalized_import_manifest.json"
        manifest_path.write_text(json.dumps({
            "plugin_id": self.id,
            "sdk_version": IMPORT_PLUGIN_SDK_VERSION,
            "mode": "normalized_sources",
            "generated_at_utc": datetime.now(timezone.utc).isoformat(),
            "input_dir": str(context.source_dir),
            "sources": {name: len(rows) for name, rows in sources.items()},
        }, ensure_ascii=False, indent=2), encoding="utf-8")
        return ProjectDataImportExecutionResult(
            plugin_id=self.id,
            plugin_name=self.name,
            plugin_description=self.description,
            manifest_path=manifest_path,
            normalized_sources=sources,
            stdout="Normalization completed",
            metrics={f"{name}_rows": len(rows) for name, rows in sources.items()},
        )


def validate_plugin_manifest(manifest: ImportPluginManifest) -> None:
    errors: list[str] = []
    if not re.fullmatch(r"[a-z][a-z0-9_]{2,63}", manifest.id):
        errors.append("id must match [a-z][a-z0-9_]{2,63}")
    if not manifest.name.strip():
        errors.append("name is required")
    if not re.fullmatch(r"\d+\.\d+(?:\.\d+)?(?:[-+][A-Za-z0-9.-]+)?", manifest.version):
        errors.append("version must be a semantic version")
    if manifest.sdk_version != IMPORT_PLUGIN_SDK_VERSION:
        errors.append(f"unsupported sdk_version {manifest.sdk_version!r}; expected {IMPORT_PLUGIN_SDK_VERSION!r}")
    if not manifest.extensions:
        errors.append("at least one file extension is required")
    if any(not re.fullmatch(r"\.[a-z0-9]+", item) for item in manifest.extensions):
        errors.append("extensions must be lowercase file suffixes")
    if not isinstance(manifest.config_schema, Mapping) or not isinstance(manifest.input_contract, Mapping) or not isinstance(manifest.domain_contract, Mapping):
        errors.append("plugin contracts must be objects")
    if len(set(manifest.output_dataset_ids)) != len(manifest.output_dataset_ids):
        errors.append("output_dataset_ids must not contain duplicates")
    if errors:
        raise ImportPluginContractError(f"Plugin {manifest.id!r}: " + "; ".join(errors))


def validate_execution_result(plugin: ProjectDataImportPlugin, context: ImportExecutionContext, result: ProjectDataImportExecutionResult) -> None:
    if not isinstance(result, ProjectDataImportExecutionResult):
        raise ImportPluginContractError(f"Plugin {plugin.id!r} returned {type(result).__name__}; expected ProjectDataImportExecutionResult")
    errors: list[str] = []
    manifest = plugin.manifest()
    if result.plugin_id != manifest.id:
        errors.append("result plugin_id does not match manifest")
    if result.sdk_version != IMPORT_PLUGIN_SDK_VERSION:
        errors.append("result SDK version is not supported")
    if not isinstance(result.normalized_sources, dict):
        errors.append("normalized_sources must be an object")
    else:
        missing = [dataset.id for dataset in plugin.dataset_contracts() if dataset.id not in result.normalized_sources]
        invalid = [name for name, rows in result.normalized_sources.items() if not isinstance(name, str) or not isinstance(rows, list) or any(not isinstance(row, dict) for row in rows)]
        if missing:
            errors.append("normalized_sources missing datasets: " + ", ".join(missing))
        if invalid:
            errors.append("normalized_sources must contain lists of objects")
    manifest_path = Path(result.manifest_path).resolve()
    output_root = context.output_dir.resolve()
    if output_root != manifest_path and output_root not in manifest_path.parents:
        errors.append("manifest must stay inside plugin output directory")
    elif not manifest_path.is_file():
        errors.append("manifest file is missing")
    else:
        try:
            if not isinstance(json.loads(manifest_path.read_text(encoding="utf-8")), dict):
                errors.append("manifest root must be an object")
        except (OSError, UnicodeError, json.JSONDecodeError) as exc:
            errors.append(f"manifest is invalid: {exc}")
    if errors:
        raise ImportPluginContractError(f"Plugin {manifest.id!r} returned invalid output: " + "; ".join(errors))