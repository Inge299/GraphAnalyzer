from __future__ import annotations

import csv
import importlib
import json
import logging
import os
import pkgutil
import re
import zipfile
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Mapping, Type

from fastapi import HTTPException

from app.import_plugins.user_actions_address_book_normalizer import normalize_user_actions_address_book
from app.import_plugins.traffic_geo_normalizer import iter_normalized_traffic_geo, normalize_traffic_geo
from app.import_plugins.telecom_connections_normalizer import iter_normalized_telecom_connections, normalize_telecom_connections
from app.import_plugin_sdk import (
    ImportExecutionContext,
    ImportPluginContractError,
    ProjectDataImportExecutionResult,
    ProjectDataImportPlugin,
    validate_execution_result,
    validate_plugin_manifest,
)
CONFIG_PATH = Path(__file__).resolve().parents[1] / "configuration" / "project_data_import_plugins.json"
SUPPORTED_IMPORT_EXTENSIONS = {".csv", ".txt", ".zip"}
IMPORT_PLUGIN_PACKAGE = "app.import_plugins"
EXTERNAL_IMPORT_PLUGIN_DIR = Path(os.getenv("IMPORT_PLUGIN_DIR", "/app/data/import_plugins"))
RECOGNITION_SAMPLE_ROWS = 1_000
RECOGNITION_SAMPLE_BYTES = 4 * 1024 * 1024

logger = logging.getLogger(__name__)


@dataclass
class ProjectDataImportPluginInfo:
    id: str
    name: str
    description: str
    priority: int
    enabled: bool
    extensions: list[str]
    recognition_hint: str
    version: str
    sdk_version: str
    config_schema: dict[str, Any]
    input_contract: dict[str, Any]
    domain_contract: dict[str, Any]
    capabilities: list[str]
    output_datasets: list[dict[str, Any]]
    source: str
    removable: bool

@dataclass
class ProjectDataImportFileMatch:
    path: str
    display_path: str
    plugin_id: str
    plugin_name: str
    plugin_description: str
    score: int


def _decode_text(raw: bytes) -> str:
    for encoding in ("utf-8-sig", "cp1251", "cp866", "utf-8"):
        try:
            return raw.decode(encoding)
        except UnicodeDecodeError:
            continue
    return raw.decode("utf-8", errors="ignore")


def _normalize_header_values(values: list[str]) -> set[str]:
    return {
        str(value or "").strip().replace('"', "").lower()
        for value in values
        if str(value or "").strip()
    }


def _is_user_actions_headers(headers: set[str]) -> bool:
    return {
        "дата и время",
        "техданные, идент. пользователя",
        "текст сообщения",
    }.issubset(headers)

def _is_traffic_headers(headers: set[str]) -> bool:
    if headers & {"abon1", "identifier_type", "identifier_value"}:
        return True
    return "\u043d\u043e\u043c\u0435\u0440 \u0430\u0431\u043e\u043d\u0435\u043d\u0442\u0430" in headers and (
        "\u043d\u043e\u043c\u0435\u0440 \u043a\u043e\u043d\u0442\u0430\u043a\u0442\u0430" in headers
        or "\u0432\u0440\u0435\u043c\u044f \u043d\u0430\u0447\u0430\u043b\u0430 \u0441\u043e\u0435\u0434\u0438\u043d\u0435\u043d\u0438\u044f" in headers
        or "\u0432\u0440\u0435\u043c\u044f \u043e\u043f\u0440\u0435\u0434\u0435\u043b\u0435\u043d\u0438\u044f \u043c\u0435\u0441\u0442\u043e\u043f\u043e\u043b\u043e\u0436\u0435\u043d\u0438\u044f" in headers
    )

def _read_csv_headers_from_sample(raw: bytes) -> list[str]:
    """Read a header from a bounded recognition sample, never from a whole file."""
    text_data = _decode_text(raw)
    sample_lines = text_data.splitlines()[:RECOGNITION_SAMPLE_ROWS]
    reader = csv.reader(sample_lines, delimiter=";")
    return next(reader, [])


def _read_csv_headers(path: Path) -> list[str]:
    try:
        with path.open("rb") as source:
            raw = source.read(RECOGNITION_SAMPLE_BYTES)
    except OSError:
        return []

    return _read_csv_headers_from_sample(raw)


def _read_zip_csv_headers(path: Path) -> list[tuple[str, list[str]]]:
    results: list[tuple[str, list[str]]] = []
    try:
        with zipfile.ZipFile(path) as archive:
            for info in archive.infolist():
                if info.is_dir():
                    continue
                internal_name = info.filename
                if not internal_name.lower().endswith(".csv"):
                    continue
                try:
                    with archive.open(info, "r") as raw_stream:
                        raw_bytes = raw_stream.read(RECOGNITION_SAMPLE_BYTES)
                except OSError:
                    continue
                headers = _read_csv_headers_from_sample(raw_bytes)
                results.append((internal_name, headers))
    except (OSError, zipfile.BadZipFile):
        return []
    return results


def _list_zip_entries(path: Path) -> list[str]:
    try:
        with zipfile.ZipFile(path) as archive:
            return [info.filename for info in archive.infolist() if not info.is_dir()]
    except (OSError, zipfile.BadZipFile):
        return []


def _load_overrides() -> dict[str, dict[str, Any]]:
    if not CONFIG_PATH.exists():
        return {}

    try:
        payload = json.loads(CONFIG_PATH.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError):
        return {}

    plugins = payload.get("plugins")
    if not isinstance(plugins, list):
        return {}

    result: dict[str, dict[str, Any]] = {}
    for item in plugins:
        if not isinstance(item, dict):
            continue
        plugin_id = str(item.get("id") or "").strip()
        if plugin_id:
            result[plugin_id] = item
    return result


def _save_overrides(overrides: dict[str, dict[str, Any]]) -> None:
    CONFIG_PATH.parent.mkdir(parents=True, exist_ok=True)
    payload = {
        "version": 1,
        "plugins": sorted(overrides.values(), key=lambda item: str(item.get("id") or "")),
    }
    CONFIG_PATH.write_text(json.dumps(payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def _base_plugin_metadata() -> dict[str, dict[str, Any]]:
    return {
        plugin.id: {
            "id": plugin.id,
            "name": plugin.name,
            "description": plugin.description,
            "priority": plugin.priority,
            "enabled": plugin.enabled,
        }
        for plugin in IMPORT_PLUGINS
    }


def get_project_data_import_plugins_config() -> dict[str, Any]:
    if not CONFIG_PATH.exists():
        return {"version": 1, "plugins": []}
    try:
        payload = json.loads(CONFIG_PATH.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError):
        return {"version": 1, "plugins": []}
    if not isinstance(payload, dict):
        return {"version": 1, "plugins": []}
    plugins = payload.get("plugins")
    if not isinstance(plugins, list):
        payload["plugins"] = []
    payload["version"] = int(payload.get("version") or 1)
    return payload


def replace_project_data_import_plugins_config(payload: dict[str, Any]) -> dict[str, Any]:
    plugins = payload.get("plugins")
    if not isinstance(plugins, list):
        raise ValueError("Import plugins config must contain a plugins array")

    overrides: dict[str, dict[str, Any]] = {}
    known_ids = set(_base_plugin_metadata())
    for item in plugins:
        if not isinstance(item, dict):
            continue
        plugin_id = str(item.get("id") or "").strip()
        if not plugin_id or plugin_id not in known_ids:
            continue
        overrides[plugin_id] = {
            "id": plugin_id,
            "name": str(item.get("name") or _base_plugin_metadata()[plugin_id]["name"]).strip()
            or _base_plugin_metadata()[plugin_id]["name"],
            "description": str(item.get("description") or _base_plugin_metadata()[plugin_id]["description"]).strip()
            or _base_plugin_metadata()[plugin_id]["description"],
            "priority": int(item.get("priority") or _base_plugin_metadata()[plugin_id]["priority"]),
            "enabled": bool(item.get("enabled", _base_plugin_metadata()[plugin_id]["enabled"])),
        }
    _save_overrides(overrides)
    return get_project_data_import_plugins_config()


def get_project_data_import_plugin_info(plugin_id: str) -> dict[str, Any]:
    base = _base_plugin_metadata().get(plugin_id)
    if not base:
        raise HTTPException(status_code=404, detail=f"Import plugin {plugin_id} not found")

    override = _load_overrides().get(plugin_id, {})
    merged = dict(base)
    for field in ("name", "description", "priority", "enabled"):
        if field in override:
            merged[field] = override[field]
    return merged


def _plugin_info(plugin: ProjectDataImportPlugin) -> ProjectDataImportPluginInfo:
    manifest = plugin.manifest()
    merged = get_project_data_import_plugin_info(manifest.id)
    return ProjectDataImportPluginInfo(
        id=manifest.id,
        name=str(merged["name"]),
        description=str(merged["description"]),
        priority=int(merged["priority"]),
        enabled=bool(merged["enabled"]),
        extensions=list(manifest.extensions),
        recognition_hint=manifest.recognition_hint,
        version=manifest.version,
        sdk_version=manifest.sdk_version,
        config_schema=dict(manifest.config_schema),
        input_contract=dict(manifest.input_contract),
        domain_contract=dict(manifest.domain_contract),
        capabilities=list(manifest.capabilities),
        output_datasets=[
            {
                "id": dataset.id,
                "label": dataset.label,
                "filename": "",
                "required_columns": [],
            }
            for dataset in plugin.dataset_contracts()
        ],
        source=str(getattr(plugin, "_installed_file", "builtin")),
        removable=bool(getattr(plugin, "_installed_file", None)),
    )

def _load_import_plugin_file(path: Path) -> list[Type[ProjectDataImportPlugin]]:
    module_name = f"_nodex_import_plugin_{path.stem}_{path.stat().st_mtime_ns}"
    spec = importlib.util.spec_from_file_location(module_name, path)
    if spec is None or spec.loader is None:
        raise ImportPluginContractError(f"Cannot create module loader for {path.name}")
    module = importlib.util.module_from_spec(spec)
    sys.modules[module_name] = module
    try:
        spec.loader.exec_module(module)
    except Exception:
        sys.modules.pop(module_name, None)
        raise

    classes: list[Type[ProjectDataImportPlugin]] = []
    for attr_name in dir(module):
        attr = getattr(module, attr_name)
        if (
            isinstance(attr, type)
            and issubclass(attr, ProjectDataImportPlugin)
            and attr is not ProjectDataImportPlugin
            and attr.__module__ == module.__name__
            and not attr_name.startswith("_")
        ):
            setattr(attr, "_installed_file", str(path.resolve()))
            classes.append(attr)
    return classes

def _discover_external_import_plugin_classes() -> list[Type[ProjectDataImportPlugin]]:
    classes: list[Type[ProjectDataImportPlugin]] = []

    try:
        package = importlib.import_module(IMPORT_PLUGIN_PACKAGE)
    except ModuleNotFoundError:
        return classes
    except Exception as exc:
        logger.error("Failed to load import plugin package %s: %s", IMPORT_PLUGIN_PACKAGE, exc)
        return classes

    package_path = getattr(package, "__path__", None)
    if package_path is None:
        return classes

    for _, module_name, _ in pkgutil.walk_packages(package_path, f"{IMPORT_PLUGIN_PACKAGE}."):
        short_name = module_name.split(".")[-1]
        if short_name.startswith("_"):
            continue
        try:
            module = importlib.import_module(module_name)
        except Exception as exc:
            logger.error("Failed to load import plugin module %s: %s", module_name, exc)
            continue

        for attr_name in dir(module):
            attr = getattr(module, attr_name)
            if (
                isinstance(attr, type)
                and issubclass(attr, ProjectDataImportPlugin)
                and attr is not ProjectDataImportPlugin
                and not attr_name.startswith("_")
            ):
                classes.append(attr)

    EXTERNAL_IMPORT_PLUGIN_DIR.mkdir(parents=True, exist_ok=True)
    for plugin_path in sorted(EXTERNAL_IMPORT_PLUGIN_DIR.glob("*.py")):
        if plugin_path.name.startswith("_"):
            continue
        try:
            classes.extend(_load_import_plugin_file(plugin_path))
        except Exception as exc:
            logger.error("Failed to load installed import plugin %s: %s", plugin_path, exc)

    return classes


def _build_import_plugin_registry() -> tuple[list[ProjectDataImportPlugin], dict[str, ProjectDataImportPlugin]]:
    builtin_classes: list[Type[ProjectDataImportPlugin]] = [
        NodexUserActionsAddressBookImportPlugin,
        NodexTrafficGeoImportPlugin,
        NodexTelecomConnectionsImportPlugin,
    ]
    plugin_classes = builtin_classes + _discover_external_import_plugin_classes()

    plugins: list[ProjectDataImportPlugin] = []
    plugin_by_id: dict[str, ProjectDataImportPlugin] = {}

    for cls in plugin_classes:
        try:
            instance = cls()
        except Exception as exc:
            logger.error("Failed to initialize import plugin %s: %s", cls, exc)
            continue

        try:
            manifest = instance.manifest()
            validate_plugin_manifest(manifest)
        except (ImportPluginContractError, TypeError, ValueError) as exc:
            logger.error("Skipping invalid import plugin %s: %s", cls, exc)
            continue

        plugin_id = manifest.id
        if not plugin_id:
            logger.error("Skipping import plugin without id: %s", cls)
            continue
        if plugin_id in plugin_by_id:
            logger.error("Skipping duplicate import plugin id: %s", plugin_id)
            continue

        plugin_by_id[plugin_id] = instance
        plugins.append(instance)

    return plugins, plugin_by_id


def execute_project_data_import_plugin(
    plugin: ProjectDataImportPlugin,
    source_dir: Path,
    output_dir: Path,
    *,
    options: dict[str, Any] | None = None,
    dry_run: bool = False,
) -> ProjectDataImportExecutionResult:
    context = ImportExecutionContext(
        source_dir=source_dir,
        output_dir=output_dir,
        options=options or {},
        dry_run=dry_run,
    )
    try:
        result = plugin.execute(context)
        validate_execution_result(plugin, context, result)
        return result
    except ImportPluginContractError as exc:
        raise HTTPException(status_code=400, detail=f"Import plugin contract error: {exc}") from exc

class NodexUserActionsAddressBookImportPlugin(ProjectDataImportPlugin):
    id = "nodex_user_actions_address_book"
    name = "Nodex: действия пользователей и адресная книга"
    description = "Распознаёт выгрузки действий пользователей: владельца номера, контакты адресной книги и используемое устройство."
    priority = 160
    output_dataset_ids = ("address_book_entries", "recorded_as_entries", "user_device_observations")
    output_dataset_labels = {
        "address_book_entries": "Адресная книга",
        "recorded_as_entries": "Записан как",
        "user_device_observations": "Используемые устройства",
    }
    input_contract = {
        "container": {"zip_members": True},
        "file": {"extensions": [".csv", ".txt"], "encodings": ["utf-8-sig", "utf-8", "cp1251", "cp866"], "delimiters": [";"]},
        "headers": {
            "required": ["Дата и время", "Техданные, идент. пользователя", "Текст сообщения"],
            "optional": ["Ид. пользователя", "Тип события"],
        },
        "content": {"contact": "phone, firstName, lastName in field Текст сообщения", "technical_data": "Номер and Программа"},
    }
    recognition_hint = "CSV или ZIP с полями «Дата и время», «Техданные, идент. пользователя» и «Текст сообщения»"
    capabilities = ("recognize", "preview", "import", "normalize")

    def normalize_sources(self, source_dir: Path) -> Mapping[str, list[dict[str, Any]]]:
        return normalize_user_actions_address_book(source_dir)

    def recognize_file(self, source_dir: Path, input_file: dict[str, Any]) -> int:
        path = source_dir / str(input_file.get("path") or "")
        if path.suffix.lower() == ".zip":
            return 100 if any(_is_user_actions_headers(_normalize_header_values(headers)) for _, headers in _read_zip_csv_headers(path)) else -1
        return 100 if _is_user_actions_headers(_normalize_header_values(_read_csv_headers(path))) else -1
class NodexTelecomConnectionsImportPlugin(ProjectDataImportPlugin):
    id = "nodex_telecom_connections"
    name = "Nodex: \u0442\u0435\u043b\u0435\u0444\u043e\u043d\u043d\u044b\u0435 \u0441\u043e\u0435\u0434\u0438\u043d\u0435\u043d\u0438\u044f \u0438 \u0431\u0430\u0437\u043e\u0432\u044b\u0435 \u0441\u0442\u0430\u043d\u0446\u0438\u0438"
    description = "\u0420\u0430\u0437\u0431\u0438\u0440\u0430\u0435\u0442 \u0434\u0435\u0442\u0430\u043b\u0438\u0437\u0430\u0446\u0438\u044e \u0441\u043e\u0435\u0434\u0438\u043d\u0435\u043d\u0438\u0439: MSISDN, IMSI, IMEI, \u0431\u0430\u0437\u043e\u0432\u044b\u0435 \u0441\u0442\u0430\u043d\u0446\u0438\u0438 \u0438 \u0430\u0434\u0440\u0435\u0441\u0430 \u0411\u0421."
    priority = 140
    output_dataset_ids = (
        "telecom_msisdn_imsi", "telecom_msisdn_imei", "telecom_connections",
        "telecom_msisdn_base_stations", "telecom_base_stations", "telecom_base_station_locations",
    )
    output_dataset_labels = {
        "telecom_msisdn_imsi": "MSISDN \u0438 IMSI",
        "telecom_msisdn_imei": "MSISDN \u0438 IMEI",
        "telecom_connections": "\u0421\u043e\u0435\u0434\u0438\u043d\u0435\u043d\u0438\u044f \u0430\u0431\u043e\u043d\u0435\u043d\u0442\u043e\u0432",
        "telecom_msisdn_base_stations": "MSISDN \u0438 \u0431\u0430\u0437\u043e\u0432\u044b\u0435 \u0441\u0442\u0430\u043d\u0446\u0438\u0438",
        "telecom_base_stations": "\u0411\u0430\u0437\u043e\u0432\u044b\u0435 \u0441\u0442\u0430\u043d\u0446\u0438\u0438",
        "telecom_base_station_locations": "\u0411\u0421 \u0438 \u0430\u0434\u0440\u0435\u0441\u0430",
    }
    input_contract = {
        "container": {"zip_members": True},
        "file": {"extensions": [".csv", ".txt"], "encodings": ["utf-8-sig", "utf-8", "cp1251", "cp866"], "delimiters": [";"]},
        "headers": {"required": ["\u0412\u0440\u0435\u043c\u044f \u043d\u0430\u0447\u0430\u043b\u0430 \u0441\u043e\u0435\u0434\u0438\u043d\u0435\u043d\u0438\u044f", "\u041d\u043e\u043c\u0435\u0440 \u0430\u0431\u043e\u043d\u0435\u043d\u0442\u0430", "\u041c/\u041f \u0430\u0431\u043e\u043d\u0435\u043d\u0442\u0430 \u043d\u0430 \u043d\u0430\u0447\u0430\u043b\u043e"], "optional": ["IMSI \u0430\u0431\u043e\u043d\u0435\u043d\u0442\u0430", "IMEI \u0430\u0431\u043e\u043d\u0435\u043d\u0442\u0430"]},
        "base_station_key": "MCC/MNC/LAC/CID; MCC/MNC \u0431\u0435\u0440\u0443\u0442\u0441\u044f \u0438\u0437 IMSI (250/02 \u0434\u043b\u044f \u0442\u0435\u043a\u0443\u0449\u0435\u0433\u043e \u0444\u043e\u0440\u043c\u0430\u0442\u0430)",
    }
    recognition_hint = "CSV \u0438\u043b\u0438 ZIP \u0441 \u0434\u0435\u0442\u0430\u043b\u0438\u0437\u0430\u0446\u0438\u0435\u0439 \u0441\u043e\u0435\u0434\u0438\u043d\u0435\u043d\u0438\u0439, IMSI/IMEI \u0438 \u043f\u043e\u043b\u044f\u043c\u0438 \u041c/\u041f \u043d\u0430 \u043d\u0430\u0447\u0430\u043b\u043e/\u043a\u043e\u043d\u0435\u0446."
    capabilities = ("recognize", "preview", "import", "normalize")

    def normalize_sources(self, source_dir: Path) -> Mapping[str, list[dict[str, Any]]]:
        return normalize_telecom_connections(source_dir)

    def iter_normalized_source_batches(self, source_dir: Path, batch_size: int = 2_000):
        return iter_normalized_telecom_connections(source_dir, batch_size)

    def recognize_file(self, source_dir: Path, input_file: dict[str, Any]) -> int:
        required = {
            "\u0432\u0440\u0435\u043c\u044f \u043d\u0430\u0447\u0430\u043b\u0430 \u0441\u043e\u0435\u0434\u0438\u043d\u0435\u043d\u0438\u044f",
            "\u043d\u043e\u043c\u0435\u0440 \u0430\u0431\u043e\u043d\u0435\u043d\u0442\u0430",
            "\u043c/\u043f \u0430\u0431\u043e\u043d\u0435\u043d\u0442\u0430 \u043d\u0430 \u043d\u0430\u0447\u0430\u043b\u043e",
        }
        path = source_dir / str(input_file.get("path") or "")
        headers_sets = (_normalize_header_values(headers) for _, headers in _read_zip_csv_headers(path)) if path.suffix.lower() == ".zip" else (_normalize_header_values(_read_csv_headers(path)),)
        return 100 if any(required.issubset(headers) for headers in headers_sets) else -1

class NodexTrafficGeoImportPlugin(ProjectDataImportPlugin):
    id = "nodex_traffic_geo"
    name = "Nodex: \u0441\u0432\u044f\u0437\u0438, \u0443\u0441\u0442\u0440\u043e\u0439\u0441\u0442\u0432\u0430 \u0438 \u043b\u043e\u043a\u0430\u0446\u0438\u0438"
    description = "\u0420\u0430\u0441\u043f\u043e\u0437\u043d\u0430\u0451\u0442 CSV \u0438 \u0430\u0440\u0445\u0438\u0432\u044b \u0441\u043e \u0441\u0432\u044f\u0437\u044f\u043c\u0438, \u0438\u0441\u0442\u043e\u0440\u0438\u0435\u0439 \u0443\u0441\u0442\u0440\u043e\u0439\u0441\u0442\u0432, \u043b\u043e\u043a\u0430\u0446\u0438\u044f\u043c\u0438 \u0438 IP-\u043f\u0440\u0438\u0432\u044f\u0437\u043a\u0430\u043c\u0438."
    priority = 100
    output_dataset_ids = ("communications", "device_history", "location_events", "ip_bindings")
    output_dataset_labels = {"communications": "Соединения", "device_history": "Использование устройств", "location_events": "Локационные события", "ip_bindings": "IP-привязки"}
    input_contract = {
        "container": {"zip_members": True},
        "file": {"extensions": [".csv", ".txt"], "encodings": ["utf-8-sig", "utf-8", "cp1251"], "delimiters": [";", ",", "\t"]},
        "headers": {
            "signatures": [
                ["abon1", "identifier_type", "identifier_value"],
                ["\u041d\u043e\u043c\u0435\u0440 \u0430\u0431\u043e\u043d\u0435\u043d\u0442\u0430", "\u0412\u0440\u0435\u043c\u044f \u043d\u0430\u0447\u0430\u043b\u0430 \u0441\u043e\u0435\u0434\u0438\u043d\u0435\u043d\u0438\u044f"],
                ["\u041d\u043e\u043c\u0435\u0440 \u0430\u0431\u043e\u043d\u0435\u043d\u0442\u0430", "\u0412\u0440\u0435\u043c\u044f \u043e\u043f\u0440\u0435\u0434\u0435\u043b\u0435\u043d\u0438\u044f \u043c\u0435\u0441\u0442\u043e\u043f\u043e\u043b\u043e\u0436\u0435\u043d\u0438\u044f"],
            ],
        },
    }
    recognition_hint = "CSV \u0438\u043b\u0438 ZIP \u0441\u043e \u0441\u0432\u044f\u0437\u044f\u043c\u0438, \u043b\u043e\u043a\u0430\u0446\u0438\u044f\u043c\u0438 \u0438 \u0443\u0441\u0442\u0440\u043e\u0439\u0441\u0442\u0432\u0430\u043c\u0438"

    def recognize_file(self, source_dir: Path, input_file: dict[str, Any]) -> int:
        path = source_dir / str(input_file.get("path") or "")
        if path.suffix.lower() == ".zip":
            for _, headers_list in _read_zip_csv_headers(path):
                if _is_traffic_headers(_normalize_header_values(headers_list)):
                    return 100
            return -1
        return 100 if _is_traffic_headers(_normalize_header_values(_read_csv_headers(path))) else -1
    def normalize_sources(self, source_dir: Path) -> Mapping[str, list[dict[str, Any]]]:
        return normalize_traffic_geo(source_dir)

    def iter_normalized_source_batches(self, source_dir: Path, batch_size: int = 2_000):
        return iter_normalized_traffic_geo(source_dir, batch_size)

IMPORT_PLUGINS, IMPORT_PLUGIN_BY_ID = _build_import_plugin_registry()


def reload_project_data_import_plugins() -> list[ProjectDataImportPluginInfo]:
    plugins, plugin_by_id = _build_import_plugin_registry()
    IMPORT_PLUGINS[:] = plugins
    IMPORT_PLUGIN_BY_ID.clear()
    IMPORT_PLUGIN_BY_ID.update(plugin_by_id)
    return list_project_data_import_plugins()


def install_project_data_import_plugin_file(
    filename: str,
    content: bytes,
    *,
    overwrite: bool = True,
) -> list[ProjectDataImportPluginInfo]:
    safe_name = Path(filename or "").name
    if safe_name != filename or not safe_name.endswith(".py"):
        raise ImportPluginContractError("Plugin filename must be a plain .py filename")
    if safe_name.startswith("_") or not re.fullmatch(r"[A-Za-z0-9][A-Za-z0-9_-]{1,63}.py", safe_name):
        raise ImportPluginContractError("Plugin filename contains unsupported characters")
    if not content:
        raise ImportPluginContractError("Plugin file is empty")

    try:
        source = content.decode("utf-8-sig")
    except UnicodeDecodeError as exc:
        raise ImportPluginContractError("Plugin file must use UTF-8 encoding") from exc
    try:
        compile(source, safe_name, "exec")
    except SyntaxError as exc:
        raise ImportPluginContractError(f"Python syntax error at line {exc.lineno}: {exc.msg}") from exc

    EXTERNAL_IMPORT_PLUGIN_DIR.mkdir(parents=True, exist_ok=True)
    target = (EXTERNAL_IMPORT_PLUGIN_DIR / safe_name).resolve()
    root = EXTERNAL_IMPORT_PLUGIN_DIR.resolve()
    if root not in target.parents:
        raise ImportPluginContractError("Invalid plugin path")
    if target.exists() and not overwrite:
        raise ImportPluginContractError(f"Plugin file {safe_name} already exists")

    check_path = root / f"_upload_check_{safe_name}"
    try:
        check_path.write_bytes(content)
        classes = _load_import_plugin_file(check_path)
        if not classes:
            raise ImportPluginContractError("No ProjectDataImportPlugin class found in file")

        manifests = []
        seen_ids: set[str] = set()
        for plugin_class in classes:
            plugin = plugin_class()
            manifest = plugin.manifest()
            validate_plugin_manifest(manifest)
            if manifest.id in seen_ids:
                raise ImportPluginContractError(f"Duplicate plugin id {manifest.id!r} in uploaded file")
            seen_ids.add(manifest.id)
            existing = IMPORT_PLUGIN_BY_ID.get(manifest.id)
            existing_file = getattr(existing, "_installed_file", None) if existing else None
            if existing and (not existing_file or Path(existing_file).resolve() != target):
                raise ImportPluginContractError(f"Plugin id {manifest.id!r} is already registered")
            manifests.append(manifest)
    finally:
        check_path.unlink(missing_ok=True)

    staging_path = root / f"_{safe_name}.part"
    try:
        staging_path.write_bytes(content)
        staging_path.replace(target)
    finally:
        staging_path.unlink(missing_ok=True)

    reload_project_data_import_plugins()
    installed = []
    for manifest in manifests:
        plugin = IMPORT_PLUGIN_BY_ID.get(manifest.id)
        if plugin is None:
            raise ImportPluginContractError(f"Plugin {manifest.id!r} was not registered after installation")
        installed.append(_plugin_info(plugin))
    return installed


def delete_project_data_import_plugin(plugin_id: str) -> str:
    plugin = IMPORT_PLUGIN_BY_ID.get(plugin_id)
    if plugin is None:
        raise HTTPException(status_code=404, detail=f"Import plugin {plugin_id} not found")

    installed_file = getattr(plugin, "_installed_file", None)
    if not installed_file:
        raise HTTPException(status_code=400, detail="Built-in import plugins cannot be deleted")

    path = Path(installed_file).resolve()
    root = EXTERNAL_IMPORT_PLUGIN_DIR.resolve()
    if root not in path.parents:
        raise HTTPException(status_code=400, detail="Plugin file is outside the managed directory")

    path.unlink(missing_ok=True)
    overrides = _load_overrides()
    if plugin_id in overrides:
        overrides.pop(plugin_id, None)
        _save_overrides(overrides)
    reload_project_data_import_plugins()
    return path.name

def list_project_data_import_plugins() -> list[ProjectDataImportPluginInfo]:
    return [
        _plugin_info(plugin)
        for plugin in sorted(
            IMPORT_PLUGINS,
            key=lambda item: (-int(get_project_data_import_plugin_info(item.id)["priority"]), item.name),
        )
    ]


def update_project_data_import_plugin(
    plugin_id: str,
    *,
    name: str | None = None,
    description: str | None = None,
    priority: int | None = None,
    enabled: bool | None = None,
) -> ProjectDataImportPluginInfo:
    base = _base_plugin_metadata().get(plugin_id)
    if not base:
        raise HTTPException(status_code=404, detail=f"Import plugin {plugin_id} not found")

    overrides = _load_overrides()
    item = dict(overrides.get(plugin_id, {"id": plugin_id}))
    if name is not None:
        item["name"] = name.strip() or base["name"]
    if description is not None:
        item["description"] = description.strip() or base["description"]
    if priority is not None:
        item["priority"] = int(priority)
    if enabled is not None:
        item["enabled"] = bool(enabled)

    overrides[plugin_id] = item
    _save_overrides(overrides)
    return _plugin_info(IMPORT_PLUGIN_BY_ID[plugin_id])


def classify_project_data_import_files(
    source_dir: Path,
    input_files: list[dict[str, Any]],
    plugin_overrides: dict[str, str] | None = None,
) -> list[ProjectDataImportFileMatch]:
    matches: list[ProjectDataImportFileMatch] = []
    enabled_plugins = [plugin for plugin in IMPORT_PLUGINS if _plugin_info(plugin).enabled]
    enabled_plugin_ids = {plugin.id for plugin in enabled_plugins}
    overrides = plugin_overrides or {}

    for input_file in input_files:
        input_path = str(input_file.get("path") or "")
        override_plugin_id = overrides.get(input_path) or overrides.get(str(input_file.get("container_path") or ""))
        if override_plugin_id:
            override_plugin = IMPORT_PLUGIN_BY_ID.get(override_plugin_id)
            if override_plugin is None:
                raise HTTPException(
                    status_code=400,
                    detail=f"Import plugin override not found: {override_plugin_id}",
                )
            if override_plugin_id not in enabled_plugin_ids:
                raise HTTPException(
                    status_code=400,
                    detail=f"Import plugin override is disabled: {override_plugin_id}",
                )
            info = _plugin_info(override_plugin)
            matches.append(
                ProjectDataImportFileMatch(
                    path=input_path,
                    display_path=str(input_file.get("display_path") or input_path),
                    plugin_id=info.id,
                    plugin_name=info.name,
                    plugin_description=info.description,
                    score=1000,
                )
            )
            continue

        best_score = -1
        best_plugin: ProjectDataImportPlugin | None = None
        for plugin in enabled_plugins:
            try:
                score = plugin.recognize_file(source_dir, input_file)
            except Exception:
                logger.exception("Import plugin recognition failed: plugin=%s file=%s", plugin.id, input_path)
                continue
            if score > best_score or (score == best_score and best_plugin is not None and plugin.priority > best_plugin.priority):
                best_score = score
                best_plugin = plugin
        if best_plugin is None or best_score < 0:
            raise HTTPException(
                status_code=400,
                detail=f"РќРµ СѓРґР°Р»РѕСЃСЊ СЂР°СЃРїРѕР·РЅР°С‚СЊ С„РѕСЂРјР°С‚ С„Р°Р№Р»Р° РґР»СЏ РёРјРїРѕСЂС‚Р° РїСЂРѕРµРєС‚Р°: {input_path or '<unknown>'}",
            )
        info = _plugin_info(best_plugin)
        matches.append(
            ProjectDataImportFileMatch(
                path=input_path,
                display_path=str(input_file.get("display_path") or input_path),
                plugin_id=info.id,
                plugin_name=info.name,
                plugin_description=info.description,
                score=best_score,
            )
        )
    return matches
