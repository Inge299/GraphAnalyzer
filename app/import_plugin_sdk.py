from __future__ import annotations

import csv
import json
import re
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any, Mapping

IMPORT_PLUGIN_SDK_VERSION = "1.0"


class ImportPluginContractError(ValueError):
    """Raised when a plugin definition or execution result violates the SDK contract."""


@dataclass(frozen=True)
class CanonicalDatasetContract:
    id: str
    filename: str
    result_attribute: str
    required_columns: tuple[str, ...]


CANONICAL_DATASETS: tuple[CanonicalDatasetContract, ...] = (
    CanonicalDatasetContract("communications", "communications.csv", "communications_path", ("Абон1", "Абон2", "время_начала", "время_конца")),
    CanonicalDatasetContract("device_history", "device_history.csv", "device_history_path", ("абон", "imsi", "imei", "начало_периода", "окончание_периода")),
    CanonicalDatasetContract("location_events", "location_events.csv", "location_events_path", ("identifier_type", "identifier_value", "event_time")),
    CanonicalDatasetContract("ip_bindings", "ip_bindings.csv", "ip_bindings_path", ("identifier_type", "identifier_value", "ip_address", "event_time")),
    CanonicalDatasetContract("user_msisdn_facts", "user_msisdn_facts.csv", "user_msisdn_facts_path", ("event_time", "user_id", "user_msisdn")),
    CanonicalDatasetContract("ip_msisdn_facts", "ip_msisdn_facts.csv", "ip_msisdn_facts_path", ("event_time", "ip_address", "user_msisdn")),
    CanonicalDatasetContract("msisdn_device_facts", "msisdn_device_facts.csv", "msisdn_device_facts_path", ("event_time", "user_msisdn", "device_info")),
    CanonicalDatasetContract("msisdn_text_facts", "msisdn_text_facts.csv", "msisdn_text_facts_path", ("event_time", "user_msisdn", "file_msisdn", "message_text")),
)


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
    capabilities: tuple[str, ...] = ("recognize", "preview", "import")


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
    communications_path: Path
    device_history_path: Path
    location_events_path: Path
    ip_bindings_path: Path
    user_msisdn_facts_path: Path
    ip_msisdn_facts_path: Path
    msisdn_device_facts_path: Path
    msisdn_text_facts_path: Path
    manifest_path: Path
    stdout: str = ""
    stderr: str = ""
    metrics: dict[str, Any] = field(default_factory=dict)
    warnings: list[str] = field(default_factory=list)
    sdk_version: str = IMPORT_PLUGIN_SDK_VERSION

    def dataset_paths(self) -> dict[str, Path]:
        return {
            dataset.id: Path(getattr(self, dataset.result_attribute))
            for dataset in CANONICAL_DATASETS
        }


class ProjectDataImportPlugin:
    id = "base_import_plugin"
    name = "Импорт данных проекта"
    version = "1.0.0"
    description = "Базовый импорт исходных данных проекта."
    priority = 0
    enabled = True
    extensions: list[str] = [".csv"]
    recognition_hint = ""
    config_schema: Mapping[str, Any] = {}
    capabilities: tuple[str, ...] = ("recognize", "preview", "import")

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
            capabilities=tuple(self.capabilities),
        )

    def recognize_file(self, source_dir: Path, input_file: dict[str, Any]) -> int:
        raise NotImplementedError

    def execute(self, context: ImportExecutionContext) -> ProjectDataImportExecutionResult:
        return self.run(context.source_dir, context.output_dir)

    def run(self, source_dir: Path, output_dir: Path) -> ProjectDataImportExecutionResult:
        raise NotImplementedError


def validate_plugin_manifest(manifest: ImportPluginManifest) -> None:
    errors: list[str] = []
    if not re.fullmatch(r"[a-z][a-z0-9_]{2,63}", manifest.id):
        errors.append("id must match [a-z][a-z0-9_]{2,63}")
    if not manifest.name.strip():
        errors.append("name is required")
    if not re.fullmatch(r"\d+\.\d+(?:\.\d+)?(?:[-+][A-Za-z0-9.-]+)?", manifest.version):
        errors.append("version must be a semantic version")
    if manifest.sdk_version != IMPORT_PLUGIN_SDK_VERSION:
        errors.append(
            f"unsupported sdk_version {manifest.sdk_version!r}; expected {IMPORT_PLUGIN_SDK_VERSION!r}"
        )
    if not manifest.extensions:
        errors.append("at least one file extension is required")
    invalid_extensions = [item for item in manifest.extensions if not re.fullmatch(r"\.[a-z0-9]+", item)]
    if invalid_extensions:
        errors.append(f"invalid extensions: {', '.join(invalid_extensions)}")
    if not isinstance(manifest.config_schema, Mapping):
        errors.append("config_schema must be an object")
    if errors:
        raise ImportPluginContractError(f"Plugin {manifest.id!r}: " + "; ".join(errors))


def _read_csv_columns(path: Path) -> list[str]:
    with path.open("r", encoding="utf-8-sig", newline="") as stream:
        header = stream.readline()
        if not header:
            return []

        # Determine the delimiter from the header only. Data fields such as a
        # message body often contain commas, which makes csv.Sniffer choose a
        # wrong dialect when it inspects the whole file.
        delimiter = max((";", ",", "\t"), key=header.count)
        return [str(item or "").strip() for item in next(csv.reader([header], delimiter=delimiter), [])]


def validate_execution_result(
    plugin: ProjectDataImportPlugin,
    context: ImportExecutionContext,
    result: ProjectDataImportExecutionResult,
) -> None:
    errors: list[str] = []
    manifest = plugin.manifest()
    output_root = context.output_dir.resolve()

    if not isinstance(result, ProjectDataImportExecutionResult):
        raise ImportPluginContractError(
            f"Plugin {manifest.id!r} returned {type(result).__name__}; expected ProjectDataImportExecutionResult"
        )
    if result.plugin_id != manifest.id:
        errors.append(f"result plugin_id {result.plugin_id!r} does not match manifest id {manifest.id!r}")
    if result.sdk_version != IMPORT_PLUGIN_SDK_VERSION:
        errors.append(f"result sdk_version {result.sdk_version!r} is not supported")

    for dataset in CANONICAL_DATASETS:
        path = Path(getattr(result, dataset.result_attribute))
        try:
            resolved = path.resolve()
        except OSError:
            errors.append(f"{dataset.id}: invalid output path")
            continue
        if output_root != resolved and output_root not in resolved.parents:
            errors.append(f"{dataset.id}: output must stay inside {output_root}")
            continue
        if not resolved.is_file():
            errors.append(f"{dataset.id}: output file is missing")
            continue
        try:
            columns = _read_csv_columns(resolved)
        except (OSError, UnicodeError, csv.Error) as exc:
            errors.append(f"{dataset.id}: cannot read CSV header ({exc})")
            continue
        missing = [column for column in dataset.required_columns if column not in columns]
        if missing:
            errors.append(f"{dataset.id}: missing columns {', '.join(missing)}")

    manifest_path = Path(result.manifest_path)
    try:
        resolved_manifest = manifest_path.resolve()
    except OSError:
        resolved_manifest = manifest_path
    if output_root != resolved_manifest and output_root not in resolved_manifest.parents:
        errors.append(f"manifest: output must stay inside {output_root}")
    elif not resolved_manifest.is_file():
        errors.append("manifest: file is missing")
    else:
        try:
            payload = json.loads(resolved_manifest.read_text(encoding="utf-8"))
            if not isinstance(payload, dict):
                errors.append("manifest: root value must be an object")
        except (OSError, UnicodeError, json.JSONDecodeError) as exc:
            errors.append(f"manifest: invalid JSON ({exc})")

    if errors:
        raise ImportPluginContractError(f"Plugin {manifest.id!r} returned invalid output: " + "; ".join(errors))

