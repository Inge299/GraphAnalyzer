from __future__ import annotations

import csv
import json
import subprocess
import sys
import zipfile
from dataclasses import dataclass
from pathlib import Path
from typing import Any

from fastapi import HTTPException

SCRIPT_PATH = Path("/app/scripts/nodex_converter.py")
CONFIG_PATH = Path(__file__).resolve().parents[1] / "configuration" / "project_data_import_plugins.json"
SUPPORTED_IMPORT_EXTENSIONS = {".csv", ".zip"}


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
    stdout: str
    stderr: str


@dataclass
class ProjectDataImportPluginInfo:
    id: str
    name: str
    description: str
    priority: int
    enabled: bool
    extensions: list[str]
    recognition_hint: str


@dataclass
class ProjectDataImportFileMatch:
    path: str
    plugin_id: str
    plugin_name: str
    plugin_description: str
    score: int


class ProjectDataImportPlugin:
    id = "base_import_plugin"
    name = "Импорт данных проекта"
    description = "Базовый импорт исходных данных проекта."
    priority = 0
    enabled = True
    extensions: list[str] = [".csv"]
    recognition_hint = ""

    def info(self) -> ProjectDataImportPluginInfo:
        merged = get_project_data_import_plugin_info(self.id)
        return ProjectDataImportPluginInfo(
            id=self.id,
            name=merged["name"],
            description=merged["description"],
            priority=int(merged["priority"]),
            enabled=bool(merged["enabled"]),
            extensions=list(self.extensions),
            recognition_hint=self.recognition_hint,
        )

    def recognize_file(self, source_dir: Path, input_file: dict[str, Any]) -> int:
        raise NotImplementedError

    def run(self, source_dir: Path, output_dir: Path) -> ProjectDataImportExecutionResult:
        raise NotImplementedError


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


def _read_csv_headers(path: Path) -> list[str]:
    try:
        raw = path.read_bytes()
    except OSError:
        return []

    text_data = _decode_text(raw)
    reader = csv.reader(text_data.splitlines(), delimiter=";")
    return next(reader, [])


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
                        raw_bytes = raw_stream.read(65536)
                except OSError:
                    continue
                text_data = _decode_text(raw_bytes)
                reader = csv.reader(text_data.splitlines(), delimiter=";")
                headers = next(reader, [])
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


class NodexBaseImportPlugin(ProjectDataImportPlugin):
    extensions = [".csv", ".zip"]

    def _run_nodex(self, source_dir: Path, output_dir: Path) -> ProjectDataImportExecutionResult:
        if not SCRIPT_PATH.exists():
            raise HTTPException(status_code=500, detail=f"Nodex converter not found: {SCRIPT_PATH}")

        output_dir.mkdir(parents=True, exist_ok=True)
        communications_path = output_dir / "communications.csv"
        device_history_path = output_dir / "device_history.csv"
        location_events_path = output_dir / "location_events.csv"
        ip_bindings_path = output_dir / "ip_bindings.csv"
        user_msisdn_facts_path = output_dir / "user_msisdn_facts.csv"
        ip_msisdn_facts_path = output_dir / "ip_msisdn_facts.csv"
        msisdn_device_facts_path = output_dir / "msisdn_device_facts.csv"
        msisdn_text_facts_path = output_dir / "msisdn_text_facts.csv"
        manifest_path = output_dir / "nodex_manifest.json"

        command = [
            sys.executable,
            str(SCRIPT_PATH),
            "--input-dir",
            str(source_dir),
            "--out-communications",
            str(communications_path),
            "--out-device-history",
            str(device_history_path),
            "--out-location-events",
            str(location_events_path),
            "--out-ip-bindings",
            str(ip_bindings_path),
            "--out-user-msisdn-facts",
            str(user_msisdn_facts_path),
            "--out-ip-msisdn-facts",
            str(ip_msisdn_facts_path),
            "--out-msisdn-device-facts",
            str(msisdn_device_facts_path),
            "--out-msisdn-text-facts",
            str(msisdn_text_facts_path),
            "--out-manifest",
            str(manifest_path),
            "--postgres-friendly",
        ]
        completed = subprocess.run(command, capture_output=True, text=True, timeout=300)
        if completed.returncode != 0:
            stderr = (completed.stderr or completed.stdout or "").strip()
            raise HTTPException(status_code=400, detail=f"Nodex conversion failed: {stderr[:1200]}")

        expected_outputs = [
            communications_path,
            device_history_path,
            location_events_path,
            ip_bindings_path,
            user_msisdn_facts_path,
            ip_msisdn_facts_path,
            msisdn_device_facts_path,
            msisdn_text_facts_path,
            manifest_path,
        ]
        if any(not path.exists() for path in expected_outputs):
            raise HTTPException(status_code=500, detail="Nodex converter completed without expected output files")

        info = self.info()
        return ProjectDataImportExecutionResult(
            plugin_id=info.id,
            plugin_name=info.name,
            plugin_description=info.description,
            communications_path=communications_path,
            device_history_path=device_history_path,
            location_events_path=location_events_path,
            ip_bindings_path=ip_bindings_path,
            user_msisdn_facts_path=user_msisdn_facts_path,
            ip_msisdn_facts_path=ip_msisdn_facts_path,
            msisdn_device_facts_path=msisdn_device_facts_path,
            msisdn_text_facts_path=msisdn_text_facts_path,
            manifest_path=manifest_path,
            stdout=(completed.stdout or "").strip(),
            stderr=(completed.stderr or "").strip(),
        )

    def run(self, source_dir: Path, output_dir: Path) -> ProjectDataImportExecutionResult:
        return self._run_nodex(source_dir, output_dir)


class NodexArchiveBundleImportPlugin(NodexBaseImportPlugin):
    id = "nodex_archive_bundle"
    name = "Nodex: архивы и пакетные выгрузки"
    description = "Распознаёт ZIP-архивы и пакетные выгрузки, которые конвертируются штатным конвертером Nodex."
    priority = 120
    recognition_hint = "Любой ZIP-файл проекта"

    def recognize_file(self, source_dir: Path, input_file: dict[str, Any]) -> int:
        rel_path = str(input_file.get("path") or "")
        path = source_dir / rel_path
        lowered = rel_path.lower()
        if lowered.endswith(".zip"):
            zip_entries = [entry.lower() for entry in _list_zip_entries(path)]
            if zip_entries:
                if any(
                    token in entry
                    for entry in zip_entries
                    for token in ("communications", "device_history", "location_events", "ip_bindings", "traffic", "geo")
                ):
                    return 25
                if any(
                    token in entry
                    for entry in zip_entries
                    for token in ("взаимодейств", "техданные", "address_book", "identity")
                ):
                    return 25
            return 15
        return -1


class NodexIdentityFactsImportPlugin(NodexBaseImportPlugin):
    id = "nodex_identity_facts"
    name = "Nodex: адресная книга и идентификаторы"
    description = "Распознаёт файлы адресной книги и факты, где есть техданные пользователя, MSISDN, IP и устройство."
    priority = 110
    recognition_hint = "CSV или ZIP с полем «Техданные, идент. пользователя»"

    def recognize_file(self, source_dir: Path, input_file: dict[str, Any]) -> int:
        rel_path = str(input_file.get("path") or "")
        lowered = rel_path.lower()
        if any(token in lowered for token in ("взаимодейств", "техданные", "address_book", "identity")):
            return 95

        path = source_dir / rel_path
        if path.suffix.lower() == ".zip":
            best_score = -1
            for internal_name, headers_list in _read_zip_csv_headers(path):
                headers = _normalize_header_values(headers_list)
                if "техданные, идент. пользователя" in headers:
                    return 100
                if "ид. пользователя" in headers and "текст сообщения" in headers:
                    best_score = max(best_score, 90)
                lowered_internal = internal_name.lower()
                if any(token in lowered_internal for token in ("взаимодейств", "техданные", "address_book", "identity")):
                    best_score = max(best_score, 88)
            return best_score

        if path.suffix.lower() != ".csv":
            return -1

        headers = _normalize_header_values(_read_csv_headers(path))
        if "техданные, идент. пользователя" in headers:
            return 100
        if "ид. пользователя" in headers and "текст сообщения" in headers:
            return 85
        return -1


class NodexTrafficGeoImportPlugin(NodexBaseImportPlugin):
    id = "nodex_traffic_geo"
    name = "Nodex: связи, устройства и локации"
    description = "Распознаёт файлы со связями, историей устройств, локациями и IP-привязками."
    priority = 100
    recognition_hint = "CSV или ZIP по traffic/geo-выгрузкам"

    def recognize_file(self, source_dir: Path, input_file: dict[str, Any]) -> int:
        rel_path = str(input_file.get("path") or "")
        lowered = rel_path.lower()
        if any(token in lowered for token in ("communications", "device_history", "location_events", "ip_bindings", "traffic", "geo")):
            return 90

        path = source_dir / rel_path
        if path.suffix.lower() == ".zip":
            best_score = -1
            for internal_name, headers_list in _read_zip_csv_headers(path):
                headers = _normalize_header_values(headers_list)
                if headers & {"abon1", "identifier_type", "identifier_value"}:
                    return 100
                lowered_internal = internal_name.lower()
                if any(token in lowered_internal for token in ("communications", "device_history", "location_events", "ip_bindings", "traffic", "geo")):
                    best_score = max(best_score, 88)
            return best_score

        if path.suffix.lower() != ".csv":
            return -1

        headers = _normalize_header_values(_read_csv_headers(path))
        if headers & {"abon1", "identifier_type", "identifier_value"}:
            return 100
        return -1


IMPORT_PLUGINS: list[ProjectDataImportPlugin] = [
    NodexArchiveBundleImportPlugin(),
    NodexIdentityFactsImportPlugin(),
    NodexTrafficGeoImportPlugin(),
]
IMPORT_PLUGIN_BY_ID = {plugin.id: plugin for plugin in IMPORT_PLUGINS}


def list_project_data_import_plugins() -> list[ProjectDataImportPluginInfo]:
    return [
        plugin.info()
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
    return IMPORT_PLUGIN_BY_ID[plugin_id].info()


def classify_project_data_import_files(
    source_dir: Path,
    input_files: list[dict[str, Any]],
    plugin_overrides: dict[str, str] | None = None,
) -> list[ProjectDataImportFileMatch]:
    matches: list[ProjectDataImportFileMatch] = []
    enabled_plugins = [plugin for plugin in IMPORT_PLUGINS if plugin.info().enabled]
    enabled_plugin_ids = {plugin.id for plugin in enabled_plugins}
    overrides = plugin_overrides or {}

    for input_file in input_files:
        input_path = str(input_file.get("path") or "")
        override_plugin_id = overrides.get(input_path)
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
            info = override_plugin.info()
            matches.append(
                ProjectDataImportFileMatch(
                    path=input_path,
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
            score = plugin.recognize_file(source_dir, input_file)
            if score > best_score:
                best_score = score
                best_plugin = plugin
        if best_plugin is None or best_score < 0:
            raise HTTPException(
                status_code=400,
                detail=f"Не удалось распознать формат файла для импорта проекта: {input_path or '<unknown>'}",
            )
        info = best_plugin.info()
        matches.append(
            ProjectDataImportFileMatch(
                path=input_path,
                plugin_id=info.id,
                plugin_name=info.name,
                plugin_description=info.description,
                score=best_score,
            )
        )
    return matches
