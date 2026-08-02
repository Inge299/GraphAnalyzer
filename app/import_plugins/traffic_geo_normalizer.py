from __future__ import annotations

import csv
import re
from collections import defaultdict
from datetime import datetime, timedelta
from pathlib import Path
from typing import Any, Iterator


# Input aliases are deliberately kept here, next to the parser. The domain
# mapping itself stays in domain_model.json and knows nothing about CSV headers.
HEADERS = {
    "abon": ("\u041d\u043e\u043c\u0435\u0440 \u0430\u0431\u043e\u043d\u0435\u043d\u0442\u0430", "abon", "abon1"),
    "contact": ("\u041d\u043e\u043c\u0435\u0440 \u043a\u043e\u043d\u0442\u0430\u043a\u0442\u0430", "abon2"),
    "start": ("\u0412\u0440\u0435\u043c\u044f \u043d\u0430\u0447\u0430\u043b\u0430 \u0441\u043e\u0435\u0434\u0438\u043d\u0435\u043d\u0438\u044f", "\u0432\u0440\u0435\u043c\u044f_\u043d\u0430\u0447\u0430\u043b\u0430", "time_start"),
    "end": ("\u0412\u0440\u0435\u043c\u044f \u043e\u043a\u043e\u043d\u0447\u0430\u043d\u0438\u044f \u0441\u043e\u0435\u0434\u0438\u043d\u0435\u043d\u0438\u044f", "\u0432\u0440\u0435\u043c\u044f_\u043a\u043e\u043d\u0446\u0430", "time_end"),
    "duration": ("\u0414\u043b\u0438\u0442\u0435\u043b\u044c\u043d\u043e\u0441\u0442\u044c, \u0441\u0435\u043a", "duration_sec", "\u0434\u043b\u0438\u0442\u0435\u043b\u044c\u043d\u043e\u0441\u0442\u044c"),
    "kind": ("\u0422\u0438\u043f \u0441\u043e\u0435\u0434\u0438\u043d\u0435\u043d\u0438\u044f", "conn_type"),
    "event_time": ("\u0412\u0440\u0435\u043c\u044f \u043e\u043f\u0440\u0435\u0434\u0435\u043b\u0435\u043d\u0438\u044f \u043c\u0435\u0441\u0442\u043e\u043f\u043e\u043b\u043e\u0436\u0435\u043d\u0438\u044f", "event_time"),
    "imsi_abon": ("IMSI \u0430\u0431\u043e\u043d\u0435\u043d\u0442\u0430", "imsi"),
    "imsi_contact": ("IMSI \u043a\u043e\u043d\u0442\u0430\u043a\u0442\u0430",),
    "imei_abon": ("IMEI \u0430\u0431\u043e\u043d\u0435\u043d\u0442\u0430", "imei"),
    "imei_contact": ("IMEI \u043a\u043e\u043d\u0442\u0430\u043a\u0442\u0430",),
    "ip": ("IP-\u0430\u0434\u0440\u0435\u0441 \u0430\u0431\u043e\u043d\u0435\u043d\u0442\u0430", "ip_address"),
    "address": ("\u0410\u0434\u0440\u0435\u0441 \u0411\u0421 \u0430\u0431\u043e\u043d\u0435\u043d\u0442\u0430", "address"),
    "address_start": ("\u0410\u0434\u0440\u0435\u0441 \u0411\u0421 \u0430\u0431\u043e\u043d\u0435\u043d\u0442\u0430 \u043d\u0430 \u043d\u0430\u0447\u0430\u043b\u043e",),
    "address_end": ("\u0410\u0434\u0440\u0435\u0441 \u0411\u0421 \u0430\u0431\u043e\u043d\u0435\u043d\u0442\u0430 \u043d\u0430 \u0437\u0430\u0432\u0435\u0440\u0448\u0435\u043d\u0438\u0435",),
    "address_contact_start": ("\u0410\u0434\u0440\u0435\u0441 \u0411\u0421 \u043a\u043e\u043d\u0442\u0430\u043a\u0442\u0430 \u043d\u0430 \u043d\u0430\u0447\u0430\u043b\u043e",),
    "address_contact_end": ("\u0410\u0434\u0440\u0435\u0441 \u0411\u0421 \u043a\u043e\u043d\u0442\u0430\u043a\u0442\u0430 \u043d\u0430 \u0437\u0430\u0432\u0435\u0440\u0448\u0435\u043d\u0438\u0435",),
    "cell": ("\u041c/\u041f \u0430\u0431\u043e\u043d\u0435\u043d\u0442\u0430", "lac_bs"),
    "cell_start": ("\u041c/\u041f \u0430\u0431\u043e\u043d\u0435\u043d\u0442\u0430 \u043d\u0430 \u043d\u0430\u0447\u0430\u043b\u043e",),
    "cell_end": ("\u041c/\u041f \u0430\u0431\u043e\u043d\u0435\u043d\u0442\u0430 \u043d\u0430 \u043a\u043e\u043d\u0435\u0446",),
    "cell_contact_start": ("\u041c/\u041f \u043a\u043e\u043d\u0442\u0430\u043a\u0442\u0430 \u043d\u0430 \u043d\u0430\u0447\u0430\u043b\u043e",),
    "cell_contact_end": ("\u041c/\u041f \u043a\u043e\u043d\u0442\u0430\u043a\u0442\u0430 \u043d\u0430 \u043a\u043e\u043d\u0435\u0446",),
}


def _text(value: Any) -> str:
    return re.sub(r"\s+", " ", str(value or "").strip())


def _phone(value: Any) -> str:
    raw = _text(value)
    if not raw or not re.fullmatch(r"[0-9+().\s-]+", raw):
        return ""
    digits = re.sub(r"\D", "", raw)
    if len(digits) == 11 and digits.startswith("8"):
        digits = "7" + digits[1:]
    if len(digits) == 10:
        digits = "7" + digits
    return digits if 8 <= len(digits) <= 13 else ""


def _imsi(value: Any) -> str:
    digits = re.sub(r"\D", "", _text(value))
    return digits if len(digits) == 15 else ""


def _imei(value: Any) -> str:
    digits = re.sub(r"\D", "", _text(value))
    return digits[:14] if len(digits) >= 14 else ""


def _time(value: Any) -> str | None:
    raw = _text(value)
    for fmt in ("%d.%m.%Y %H:%M:%S", "%d.%m.%Y %H:%M", "%Y-%m-%d %H:%M:%S", "%Y-%m-%dT%H:%M:%S"):
        try:
            return datetime.strptime(raw, fmt).strftime("%Y-%m-%d %H:%M:%S")
        except ValueError:
            pass
    return None


def _duration(value: Any) -> int:
    try:
        return max(0, int(float(_text(value).replace(",", "."))))
    except ValueError:
        return 0


def _cell(value: Any) -> tuple[str, str]:
    digits = re.findall(r"\d+", _text(value))
    return (digits[0], digits[1]) if len(digits) >= 2 else ("", "")


def _mcc_mnc(imsi: str) -> tuple[str, str]:
    return (imsi[:3], imsi[3:5].lstrip("0") or "0") if imsi else ("", "")


def _read_rows(path: Path) -> Iterator[dict[str, str]]:
    """Yield CSV rows without loading a potentially multi-gigabyte file into memory."""
    try:
        with path.open("rb") as raw_stream:
            sample = raw_stream.read(64 * 1024)
    except OSError:
        return

    encoding = ""
    for candidate in ("utf-8-sig", "utf-8", "cp1251", "cp866"):
        try:
            sample.decode(candidate)
            encoding = candidate
            break
        except UnicodeDecodeError:
            continue
    if not encoding:
        return

    try:
        with path.open("r", encoding=encoding, newline="") as source:
            header = source.readline()
            if not header:
                return
            delimiter = max((";", ",", "\t"), key=header.count)
            source.seek(0)
            reader = csv.DictReader(source, delimiter=delimiter)
            for row in reader:
                yield {_text(key): _text(value) for key, value in row.items() if key}
    except (OSError, UnicodeError, csv.Error):
        return


def _value(row: dict[str, str], field: str) -> str:
    lookup = {key.casefold(): value for key, value in row.items()}
    for header in HEADERS[field]:
        value = lookup.get(header.casefold())
        if value:
            return value
    return ""


def _append_location(target: list[dict[str, Any]], seen: set[tuple[Any, ...]], *, identifier_type: str, identifier_value: str, event_time: str | None, address: str, imsi: str, cell: str) -> None:
    if not identifier_value or not event_time:
        return
    lac, bs = _cell(cell)
    if not (address or lac or bs):
        return
    mcc, mnc = _mcc_mnc(imsi)
    row = {"identifier_type": identifier_type, "identifier_value": identifier_value, "event_time": event_time, "address": address, "mcc": mcc, "mnc": mnc, "lac": lac, "bs": bs}
    key = tuple(row.values())
    if key not in seen:
        seen.add(key)
        target.append(row)


SOURCE_NAMES = ("communications", "device_history", "location_events", "ip_bindings")


def _empty_sources() -> dict[str, list[dict[str, Any]]]:
    return {name: [] for name in SOURCE_NAMES}


def _has_rows(sources: dict[str, list[dict[str, Any]]]) -> bool:
    return any(sources.values())


def iter_normalized_traffic_geo(source_dir: Path, batch_size: int = 2_000) -> Iterator[dict[str, list[dict[str, Any]]]]:
    """Normalize traffic exports in bounded batches for multi-gigabyte sources."""
    sources = _empty_sources()
    devices: dict[tuple[str, str, str], list[str]] = {}
    location_seen: set[tuple[Any, ...]] = set()

    for path in sorted(source_dir.rglob("*")):
        if not path.is_file() or path.suffix.lower() not in {".csv", ".txt"}:
            continue
        for row in _read_rows(path):
            abon = _phone(_value(row, "abon"))
            contact = _phone(_value(row, "contact"))
            start = _time(_value(row, "start"))
            end = _time(_value(row, "end"))
            duration = _duration(_value(row, "duration"))
            event_time = _time(_value(row, "event_time"))
            abon_imsi, contact_imsi = _imsi(_value(row, "imsi_abon")), _imsi(_value(row, "imsi_contact"))
            abon_imei, contact_imei = _imei(_value(row, "imei_abon")), _imei(_value(row, "imei_contact"))

            if abon and contact and start:
                if not end:
                    end = (datetime.strptime(start, "%Y-%m-%d %H:%M:%S") + timedelta(seconds=duration)).strftime("%Y-%m-%d %H:%M:%S")
                sources["communications"].append({"abon1": abon, "abon2": contact, "time_start": start, "time_end": end, "duration_sec": duration, "connection_type": _value(row, "kind")})
                for phone, imsi, imei, at, cell, address in (
                    (abon, abon_imsi, abon_imei, start, _value(row, "cell_start"), _value(row, "address_start")),
                    (abon, abon_imsi, abon_imei, end, _value(row, "cell_end"), _value(row, "address_end")),
                    (contact, contact_imsi, contact_imei, start, _value(row, "cell_contact_start"), _value(row, "address_contact_start")),
                    (contact, contact_imsi, contact_imei, end, _value(row, "cell_contact_end"), _value(row, "address_contact_end")),
                ):
                    for identifier_type, identifier_value in (("msisdn", phone), ("imsi", imsi), ("imei", imei)):
                        _append_location(sources["location_events"], location_seen, identifier_type=identifier_type, identifier_value=identifier_value, event_time=at, address=address, imsi=imsi, cell=cell)
                for phone, imsi, imei in ((abon, abon_imsi, abon_imei), (contact, contact_imsi, contact_imei)):
                    if imsi or imei:
                        key = (phone, imsi, imei)
                        devices[key] = [min(devices.get(key, [start, end])[0], start), max(devices.get(key, [start, end])[1], end)]
            elif abon and event_time:
                cell, address, ip_address = _value(row, "cell"), _value(row, "address"), _text(_value(row, "ip"))
                identifiers = (("msisdn", abon), ("imsi", abon_imsi), ("imei", abon_imei))
                for identifier_type, identifier_value in identifiers:
                    _append_location(sources["location_events"], location_seen, identifier_type=identifier_type, identifier_value=identifier_value, event_time=event_time, address=address, imsi=abon_imsi, cell=cell)
                    if ip_address and identifier_value:
                        lac, bs = _cell(cell)
                        mcc, mnc = _mcc_mnc(abon_imsi)
                        sources["ip_bindings"].append({"identifier_type": identifier_type, "identifier_value": identifier_value, "ip_address": ip_address, "event_time": event_time, "address": address, "mcc": mcc, "mnc": mnc, "lac": lac, "bs": bs})
                if abon_imsi or abon_imei:
                    key = (abon, abon_imsi, abon_imei)
                    devices[key] = [min(devices.get(key, [event_time, event_time])[0], event_time), max(devices.get(key, [event_time, event_time])[1], event_time)]

            if sum(len(rows) for rows in sources.values()) >= batch_size:
                yield sources
                sources = _empty_sources()
                location_seen.clear()

    if _has_rows(sources):
        yield sources

    device_batch: list[dict[str, Any]] = []
    for (phone, imsi, imei), period in devices.items():
        device_batch.append({"abon": phone, "imsi": imsi, "imei": imei, "period_start": period[0], "period_end": period[1]})
        if len(device_batch) >= batch_size:
            yield {"device_history": device_batch}
            device_batch = []
    if device_batch:
        yield {"device_history": device_batch}


def normalize_traffic_geo(source_dir: Path) -> dict[str, list[dict[str, Any]]]:
    """Compatibility adapter for external callers of the original list-based API."""
    merged = _empty_sources()
    for batch in iter_normalized_traffic_geo(source_dir):
        for name, rows in batch.items():
            merged.setdefault(name, []).extend(rows)
    return merged
