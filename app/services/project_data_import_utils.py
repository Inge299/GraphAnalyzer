from __future__ import annotations

import csv
import json
from datetime import datetime
from pathlib import Path
from typing import Any

from fastapi import HTTPException

KNOWN_ENCODINGS = ("utf-8-sig", "cp1251", "cp866", "utf-8")
MISSING_TEXT_MARKERS = {"null", "none", "n/a", "na", "-"}


def parse_iso_datetime(value: str) -> datetime | None:
    text_value = (value or "").strip()
    if not text_value:
        return None
    for fmt in ("%Y-%m-%d %H:%M:%S", "%Y-%m-%d"):
        try:
            return datetime.strptime(text_value, fmt)
        except ValueError:
            continue
    return None


def collect_input_files(source_dir: Path) -> list[dict[str, Any]]:
    files: list[dict[str, Any]] = []
    for path in sorted(source_dir.rglob("*")):
        if not path.is_file():
            continue
        files.append(
            {
                "path": str(path.relative_to(source_dir)).replace("\\", "/"),
                "size_bytes": path.stat().st_size,
            }
        )
    return files


def read_manifest(manifest_path: Path) -> dict[str, Any]:
    if not manifest_path.exists():
        return {}
    try:
        return json.loads(manifest_path.read_text(encoding="utf-8"))
    except Exception:
        return {}


def first_present(row: dict[str, Any], candidates: list[str]) -> Any:
    for key in candidates:
        if key in row and row.get(key) is not None:
            return row.get(key)
    return None


def optional_text(value: Any) -> str | None:
    text_value = str(value or "").strip()
    if not text_value or text_value.casefold() in MISSING_TEXT_MARKERS:
        return None
    return text_value


def read_communications_rows(path: Path, project_id: int) -> list[dict[str, Any]]:
    rows: list[dict[str, Any]] = []

    key_abon1 = ["Абон1", "abon1", "Abon1"]
    key_abon2 = ["Абон2", "abon2", "Abon2"]
    key_operator1 = ["оператор1", "operator1"]
    key_operator2 = ["оператор2", "operator2"]
    key_address1 = ["Адрес1", "address1"]
    key_address2 = ["Адрес2", "address2"]
    key_time_start = ["время_начала", "time_start"]
    key_time_end = ["время_конца", "time_end"]
    key_calls = ["количество_связей", "calls_count"]
    key_contacts = ["уникальных_контактов", "contacts_count", "unique_contacts_count"]
    key_duration = ["общая_продолжительность", "total_duration"]

    with path.open("r", encoding="utf-8") as fh:
        reader = csv.DictReader(fh, delimiter=";")
        for row in reader:
            abon1 = first_present(row, key_abon1)
            abon2 = first_present(row, key_abon2)
            operator1 = first_present(row, key_operator1)
            operator2 = first_present(row, key_operator2)
            address1 = first_present(row, key_address1)
            address2 = first_present(row, key_address2)
            time_start = first_present(row, key_time_start)
            time_end = first_present(row, key_time_end)
            calls_count = first_present(row, key_calls)
            contacts_count = first_present(row, key_contacts)
            total_duration = first_present(row, key_duration)

            rows.append(
                {
                    "project_id": project_id,
                    "abon1": (str(abon1 or "").strip()),
                    "abon2": (str(abon2 or "").strip()),
                    "operator1": (str(operator1 or "").strip()) or None,
                    "operator2": (str(operator2 or "").strip()) or None,
                    "address1": (str(address1 or "").strip()) or None,
                    "address2": (str(address2 or "").strip()) or None,
                    "time_start": parse_iso_datetime(str(time_start or "")),
                    "time_end": parse_iso_datetime(str(time_end or "")),
                    "calls_count": int((str(calls_count or "0").strip()) or "0"),
                    "contacts_count": max(1, int((str(contacts_count or "1").strip()) or "1")),
                    "total_duration": int((str(total_duration or "0").strip()) or "0"),
                }
            )
    return rows


def read_device_history_rows(path: Path, project_id: int) -> list[dict[str, Any]]:
    rows: list[dict[str, Any]] = []

    key_abon = ["абон", "abon"]
    key_imsi = ["imsi"]
    key_imei = ["imei"]
    key_period_start = ["начало_периода", "period_start"]
    key_period_end = ["окончание_периода", "period_end"]

    with path.open("r", encoding="utf-8") as fh:
        reader = csv.DictReader(fh, delimiter=";")
        for row in reader:
            abon = first_present(row, key_abon)
            imsi = first_present(row, key_imsi)
            imei = first_present(row, key_imei)
            period_start = first_present(row, key_period_start)
            period_end = first_present(row, key_period_end)

            rows.append(
                {
                    "project_id": project_id,
                    "abon": (str(abon or "").strip()),
                    "imsi": (str(imsi or "").strip()) or None,
                    "imei": (str(imei or "").strip()) or None,
                    "period_start": parse_iso_datetime(str(period_start or "")),
                    "period_end": parse_iso_datetime(str(period_end or "")),
                }
            )
    return rows


def open_csv_reader(path: Path, delimiter: str = ";") -> csv.DictReader:
    raw = path.read_bytes()
    for encoding in KNOWN_ENCODINGS:
        try:
            text_data = raw.decode(encoding)
            reader = csv.DictReader(text_data.splitlines(), delimiter=delimiter)
            if reader.fieldnames:
                return reader
        except UnicodeDecodeError:
            continue
    text_data = raw.decode("latin-1", errors="replace")
    return csv.DictReader(text_data.splitlines(), delimiter=delimiter)


def normalize_address(value: str | None) -> str | None:
    clean = (optional_text(value) or "").lower()
    if not clean:
        return None

    normalized = "".join(char for char in clean if char.isalnum())
    return normalized or None


def normalize_location_identifier_type(value: str | None) -> str:
    """Keep legacy location files compatible with the canonical MSISDN type."""
    identifier_type = str(value or "").strip().lower()
    return "msisdn" if identifier_type == "phone" else identifier_type

def read_location_event_rows(
    path: Path,
    project_id: int,
    load_batch_id: str,
    created_at: datetime,
) -> list[dict[str, Any]]:
    rows: list[dict[str, Any]] = []
    if not path.exists():
        return rows

    reader = open_csv_reader(path, ";")
    for row in reader:
        identifier_type = normalize_location_identifier_type(first_present(row, ["identifier_type"]))
        identifier_value = str(first_present(row, ["identifier_value"]) or "").strip()
        event_time = parse_iso_datetime(str(first_present(row, ["event_time"]) or ""))
        if identifier_type not in {"msisdn", "imsi", "imei"} or not identifier_value or event_time is None:
            continue
        address = optional_text(first_present(row, ["address"]))
        rows.append({
            "project_id": project_id,
            "load_batch_id": load_batch_id,
            "identifier_type": identifier_type,
            "identifier_value": identifier_value,
            "event_time": event_time,
            "address": address,
            "address_norm": normalize_address(address),
            "mcc": (str(first_present(row, ["mcc"]) or "").strip()) or None,
            "mnc": (str(first_present(row, ["mnc"]) or "").strip()) or None,
            "lac": (str(first_present(row, ["lac"]) or "").strip()) or None,
            "bs": (str(first_present(row, ["bs"]) or "").strip()) or None,
            "created_at": created_at,
        })
    return rows


def read_ip_binding_rows(
    path: Path,
    project_id: int,
    load_batch_id: str,
    created_at: datetime,
) -> list[dict[str, Any]]:
    rows: list[dict[str, Any]] = []
    if not path.exists():
        return rows

    reader = open_csv_reader(path, ";")
    for row in reader:
        identifier_type = normalize_location_identifier_type(first_present(row, ["identifier_type"]))
        identifier_value = str(first_present(row, ["identifier_value"]) or "").strip()
        ip_address = str(first_present(row, ["ip_address"]) or "").strip()
        event_time = parse_iso_datetime(str(first_present(row, ["event_time"]) or ""))
        if identifier_type not in {"msisdn", "imsi", "imei"} or not identifier_value or not ip_address or event_time is None:
            continue
        rows.append({
            "project_id": project_id,
            "load_batch_id": load_batch_id,
            "identifier_type": identifier_type,
            "identifier_value": identifier_value,
            "ip_address": ip_address,
            "event_time": event_time,
            "address": (str(first_present(row, ["address"]) or "").strip()) or None,
            "address_norm": normalize_address(first_present(row, ["address"])),
            "mcc": (str(first_present(row, ["mcc"]) or "").strip()) or None,
            "mnc": (str(first_present(row, ["mnc"]) or "").strip()) or None,
            "lac": (str(first_present(row, ["lac"]) or "").strip()) or None,
            "bs": (str(first_present(row, ["bs"]) or "").strip()) or None,
            "user_id": (str(first_present(row, ["user_id", "Ид. пользователя"]) or "").strip()) or None,
            "device_info": (str(first_present(row, ["device_info", "Устройство пользователя"]) or "").strip()) or None,
            "message_text": (str(first_present(row, ["message_text", "Текст"]) or "").strip()) or None,
            "created_at": created_at,
        })
    return rows


def read_user_msisdn_fact_rows(
    path: Path,
    project_id: int,
    load_batch_id: str,
    created_at: datetime,
) -> list[dict[str, Any]]:
    rows: list[dict[str, Any]] = []
    if not path.exists():
        return rows

    reader = open_csv_reader(path, ";")
    for row in reader:
        event_time = parse_iso_datetime(str(first_present(row, ["event_time"]) or ""))
        user_id = str(first_present(row, ["user_id"]) or "").strip()
        user_msisdn = str(first_present(row, ["user_msisdn"]) or "").strip()
        if event_time is None or not user_id or not user_msisdn:
            continue
        rows.append(
            {
                "project_id": project_id,
                "load_batch_id": load_batch_id,
                "event_time": event_time,
                "user_id": user_id,
                "user_msisdn": user_msisdn,
                "created_at": created_at,
            }
        )
    return rows


def read_ip_msisdn_fact_rows(
    path: Path,
    project_id: int,
    load_batch_id: str,
    created_at: datetime,
) -> list[dict[str, Any]]:
    rows: list[dict[str, Any]] = []
    if not path.exists():
        return rows

    reader = open_csv_reader(path, ";")
    for row in reader:
        event_time = parse_iso_datetime(str(first_present(row, ["event_time"]) or ""))
        ip_address = str(first_present(row, ["ip_address"]) or "").strip()
        user_msisdn = str(first_present(row, ["user_msisdn"]) or "").strip()
        if event_time is None or not ip_address or not user_msisdn:
            continue
        rows.append(
            {
                "project_id": project_id,
                "load_batch_id": load_batch_id,
                "event_time": event_time,
                "ip_address": ip_address,
                "user_msisdn": user_msisdn,
                "created_at": created_at,
            }
        )
    return rows


def read_msisdn_device_fact_rows(
    path: Path,
    project_id: int,
    load_batch_id: str,
    created_at: datetime,
) -> list[dict[str, Any]]:
    rows: list[dict[str, Any]] = []
    if not path.exists():
        return rows

    reader = open_csv_reader(path, ";")
    for row in reader:
        event_time = parse_iso_datetime(str(first_present(row, ["event_time"]) or ""))
        user_msisdn = str(first_present(row, ["user_msisdn"]) or "").strip()
        device_info = str(first_present(row, ["device_info"]) or "").strip()
        if event_time is None or not user_msisdn or not device_info:
            continue
        rows.append(
            {
                "project_id": project_id,
                "load_batch_id": load_batch_id,
                "event_time": event_time,
                "user_msisdn": user_msisdn,
                "device_info": device_info,
                "created_at": created_at,
            }
        )
    return rows


def read_msisdn_text_fact_rows(
    path: Path,
    project_id: int,
    load_batch_id: str,
    created_at: datetime,
) -> list[dict[str, Any]]:
    rows: list[dict[str, Any]] = []
    if not path.exists():
        return rows

    reader = open_csv_reader(path, ";")
    for row in reader:
        event_time = parse_iso_datetime(str(first_present(row, ["event_time"]) or ""))
        user_msisdn = str(first_present(row, ["user_msisdn"]) or "").strip()
        file_msisdn = str(first_present(row, ["file_msisdn"]) or "").strip()
        message_text = str(first_present(row, ["message_text"]) or "").strip()
        if event_time is None or not user_msisdn or not file_msisdn or not message_text:
            continue
        rows.append(
            {
                "project_id": project_id,
                "load_batch_id": load_batch_id,
                "event_time": event_time,
                "user_msisdn": user_msisdn,
                "file_msisdn": file_msisdn,
                "message_text": message_text,
                "created_at": created_at,
            }
        )
    return rows


def normalize_upload_relative_path(raw_name: str) -> Path:
    normalized = (raw_name or "").replace("\\", "/").strip().lstrip("/")
    if not normalized:
        raise HTTPException(status_code=400, detail="Uploaded file has no name")
    parts = [part for part in Path(normalized).parts if part not in ("", ".", "..")]
    if not parts:
        raise HTTPException(status_code=400, detail="Invalid file name")
    return Path(*parts)


async def save_uploaded_files(upload_dir: Path, files: list[Any]) -> list[dict[str, Any]]:
    upload_dir.mkdir(parents=True, exist_ok=True)
    saved: list[dict[str, Any]] = []
    root = upload_dir.resolve()
    for file_obj in files:
        filename = str(getattr(file_obj, "filename", "") or "").strip()
        if not filename:
            continue
        rel_path = normalize_upload_relative_path(filename)
        target = (upload_dir / rel_path).resolve()
        if root not in target.parents and target != root:
            raise HTTPException(status_code=400, detail="Invalid uploaded file path")
        target.parent.mkdir(parents=True, exist_ok=True)
        content = await file_obj.read()
        if not content:
            continue
        target.write_bytes(content)
        saved.append({"path": str(rel_path).replace("\\", "/"), "size_bytes": len(content)})

    if not saved:
        raise HTTPException(status_code=400, detail="No files received for upload")

    return saved
