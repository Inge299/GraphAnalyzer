from __future__ import annotations

import csv
import re
from datetime import datetime
from pathlib import Path
from typing import Any, Iterator


DATASETS = (
    "subscriber_msisdn_imsi",
    "subscriber_subject_passport",
    "subscriber_passport_addresses",
    "subscriber_msisdn_passport",
)

_NULL_VALUES = {"", "-", "null", "none", "n/a", "na"}
_ENCODINGS = ("utf-8-sig", "utf-8", "cp1251", "cp866")

H_NAME = "\u041d\u0430\u0438\u043c\u0435\u043d\u043e\u0432\u0430\u043d\u0438\u0435"
H_SUBSCRIBER = "\u0410\u0431\u043e\u043d\u0435\u043d\u0442"
H_PHONE = "\u0422\u0435\u043b\u0435\u0444\u043e\u043d\u043d\u044b\u0439 \u043d\u043e\u043c\u0435\u0440"
H_IMSI = "IMSI \u0430\u0431\u043e\u043d\u0435\u043d\u0442\u0430"
H_SERVICE_STARTED = "\u041f\u043e\u0434\u043a\u043b\u044e\u0447\u0435\u043d\u0438\u0435 \u043e\u0441\u043d\u043e\u0432\u043d\u043e\u0439 \u0443\u0441\u043b\u0443\u0433\u0438"
H_SERVICE_ENDED = "\u041e\u0442\u043a\u043b\u044e\u0447\u0435\u043d\u0438\u0435 \u043e\u0441\u043d\u043e\u0432\u043d\u043e\u0439 \u0443\u0441\u043b\u0443\u0433\u0438"
H_ADDRESS = "\u0410\u0434\u0440\u0435\u0441 \u0430\u0431\u043e\u043d\u0435\u043d\u0442\u0430"
H_ADDRESSES = "\u0410\u0434\u0440\u0435\u0441\u0430 \u0430\u0431\u043e\u043d\u0435\u043d\u0442\u0430"

_REQUIRED_HEADERS = {
    H_PHONE.casefold(),
    H_SUBSCRIBER.casefold(),
    H_IMSI.casefold(),
    H_SERVICE_STARTED.casefold(),
}


def _text(value: object) -> str:
    result = str(value or "").strip()
    return "" if result.casefold() in _NULL_VALUES else result


def _digits(value: object) -> str:
    return re.sub(r"\D+", "", _text(value))


def _header_key(value: object) -> str:
    return _text(value).replace('"', "").casefold()


def _normalized_key(value: str) -> str:
    return re.sub(r"\s+", " ", value).strip().casefold()


def _parse_datetime(value: object) -> str | None:
    raw = _text(value)
    if not raw:
        return None
    for pattern in (
        "%d.%m.%Y %H:%M:%S",
        "%d.%m.%Y %H:%M",
        "%Y-%m-%d %H:%M:%S",
        "%Y-%m-%dT%H:%M:%S",
        "%d.%m.%Y",
    ):
        try:
            return datetime.strptime(raw, pattern).isoformat(sep=" ")
        except ValueError:
            continue
    return raw


def _parse_subscriber(value: object) -> dict[str, str]:
    cleaned = re.sub(r"\s*,?\s*\{\*?\d*\}\s*$", "", _text(value)).strip(" ,")
    birth_match = re.match(r"^(\d{2}\.\d{2}\.\d{4})\s*,?\s*(.*)$", cleaned)
    birth_date = ""
    passport = cleaned
    if birth_match:
        birth_date = _parse_datetime(birth_match.group(1)) or ""
        passport = birth_match.group(2).strip(" ,")

    passport_key_match = re.search(r"\b(\d{4}\s*\d{6})\b", passport)
    passport_key = re.sub(r"\s+", " ", passport_key_match.group(1)) if passport_key_match else _normalized_key(passport)
    return {
        "birth_date": birth_date,
        "passport": passport,
        "passport_key": passport_key,
    }


def _clean_address(value: object) -> str:
    address = _text(value)
    if not address:
        return ""
    primary = address.split(";", 1)[0].strip()
    primary = re.split(
        r"\s*/\s*(?:\u0440\u0435\u0433\u0438\u0441\u0442\u0440\u0430\u0446\u0438\u0438|\u0434\u043e\u0441\u0442\u0430\u0432\u043a\u0438\s+\u0441\u0447\u0435\u0442\u0430)\b",
        primary,
        maxsplit=1,
        flags=re.IGNORECASE,
    )[0]
    primary = re.sub(r",?\s*\u0438\u043d\u0434\u0435\u043a\u0441\s*:\s*\d{5,6}\s*", "", primary, flags=re.IGNORECASE)
    return re.sub(r"\s+", " ", primary).strip(" ,")


def _open_csv(path: Path) -> tuple[Any, csv.DictReader[str]]:
    last_error: Exception | None = None
    for encoding in _ENCODINGS:
        handle = path.open("r", encoding=encoding, newline="")
        try:
            sample = handle.read(32_768)
            handle.seek(0)
            dialect = csv.Sniffer().sniff(sample, delimiters=";,\t")
            reader = csv.DictReader(handle, dialect=dialect)
            if reader.fieldnames:
                return handle, reader
        except (csv.Error, UnicodeError) as exc:
            last_error = exc
        handle.close()
    raise ValueError(f"Cannot read subscriber ownership source {path}: {last_error}")


def _value(row: dict[str, Any], *headers: str) -> str:
    for header in headers:
        result = _text(row.get(_header_key(header)))
        if result:
            return result
    return ""


def _iter_rows(path: Path) -> Iterator[dict[str, Any]]:
    handle, reader = _open_csv(path)
    try:
        for raw_row in reader:
            row = {_header_key(key): value for key, value in raw_row.items() if key is not None}
            msisdn = _digits(_value(row, H_PHONE))
            if not msisdn:
                continue

            imsi = _digits(_value(row, H_IMSI))
            full_name = _value(row, H_NAME)
            subscriber = _parse_subscriber(_value(row, H_SUBSCRIBER))
            address = _clean_address(_value(row, H_ADDRESS, H_ADDRESSES))
            started_at = _parse_datetime(_value(row, H_SERVICE_STARTED))
            ended_at = _parse_datetime(_value(row, H_SERVICE_ENDED))
            passport = subscriber["passport"]
            passport_key = subscriber["passport_key"] if passport else ""
            subject_key = _normalized_key(f"{full_name}|{subscriber['birth_date']}") if full_name else ""

            common = {
                "msisdn": msisdn,
                "imsi": imsi,
                "full_name": full_name,
                "birth_date": subscriber["birth_date"],
                "passport": passport,
                "passport_key": passport_key,
                "address": address,
                "address_key": _normalized_key(address),
                "service_started_at": started_at,
                "service_ended_at": ended_at,
                "subject_key": subject_key,
                "source_file": path.name,
            }
            if imsi:
                yield {"dataset": "subscriber_msisdn_imsi", **common, "dedup_key": f"{msisdn}|{imsi}|{started_at or ''}"}
            if subject_key and passport_key:
                yield {"dataset": "subscriber_subject_passport", **common, "dedup_key": f"{subject_key}|{passport_key}|{started_at or ''}"}
            if passport_key and address:
                yield {"dataset": "subscriber_passport_addresses", **common, "dedup_key": f"{passport_key}|{common['address_key']}|{started_at or ''}"}
            if passport_key:
                yield {"dataset": "subscriber_msisdn_passport", **common, "dedup_key": f"{msisdn}|{passport_key}|{started_at or ''}|{ended_at or ''}"}
    finally:
        handle.close()


def _iter_source_files(source_dir: Path) -> Iterator[Path]:
    for path in sorted(source_dir.rglob("*")):
        if path.is_file() and path.suffix.lower() in {".csv", ".txt"}:
            yield path


def iter_normalized_subscriber_ownership(source_dir: Path, batch_size: int = 2_000) -> Iterator[dict[str, list[dict[str, Any]]]]:
    batch = {dataset: [] for dataset in DATASETS}
    seen: set[str] = set()
    emitted = 0
    for path in _iter_source_files(source_dir):
        for row in _iter_rows(path):
            dedup_key = row.pop("dedup_key")
            dataset = row["dataset"]
            cache_key = f"{dataset}|{dedup_key}"
            if cache_key in seen:
                continue
            seen.add(cache_key)
            batch[dataset].append(row)
            emitted += 1
            if emitted >= batch_size:
                yield {name: values for name, values in batch.items() if values}
                batch = {dataset_name: [] for dataset_name in DATASETS}
                emitted = 0
    if emitted:
        yield {name: values for name, values in batch.items() if values}


def normalize_subscriber_ownership(source_dir: Path) -> dict[str, list[dict[str, Any]]]:
    result = {dataset: [] for dataset in DATASETS}
    for batch in iter_normalized_subscriber_ownership(source_dir, batch_size=10_000):
        for dataset, rows in batch.items():
            result[dataset].extend(rows)
    return result