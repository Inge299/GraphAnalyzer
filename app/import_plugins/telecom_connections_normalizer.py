from __future__ import annotations

import csv
import re
from collections import defaultdict
from datetime import datetime, timedelta
from pathlib import Path
from typing import Any, Iterator

HEADERS = {
    "time": ("\u0412\u0440\u0435\u043c\u044f \u043d\u0430\u0447\u0430\u043b\u0430 \u0441\u043e\u0435\u0434\u0438\u043d\u0435\u043d\u0438\u044f",),
    "connection_type": ("\u0422\u0438\u043f \u0441\u043e\u0435\u0434\u0438\u043d\u0435\u043d\u0438\u044f",),
    "duration": ("\u0414\u043b\u0438\u0442\u0435\u043b\u044c\u043d\u043e\u0441\u0442\u044c, \u0441\u0435\u043a",),
    "abon_msisdn": ("\u041d\u043e\u043c\u0435\u0440 \u0430\u0431\u043e\u043d\u0435\u043d\u0442\u0430",),
    "abon_imsi": ("IMSI \u0430\u0431\u043e\u043d\u0435\u043d\u0442\u0430",),
    "abon_imei": ("IMEI \u0430\u0431\u043e\u043d\u0435\u043d\u0442\u0430",),
    "contact_msisdn": ("\u041d\u043e\u043c\u0435\u0440 \u043a\u043e\u043d\u0442\u0430\u043a\u0442\u0430",),
    "contact_imsi": ("IMSI \u043a\u043e\u043d\u0442\u0430\u043a\u0442\u0430",),
    "contact_imei": ("IMEI \u043a\u043e\u043d\u0442\u0430\u043a\u0442\u0430",),
    "abon_cell_start": ("\u041c/\u041f \u0430\u0431\u043e\u043d\u0435\u043d\u0442\u0430 \u043d\u0430 \u043d\u0430\u0447\u0430\u043b\u043e",),
    "abon_azimuth_start": ("\u0410\u0437\u0438\u043c\u0443\u0442 \u0430\u043d\u0442\u0435\u043d\u043d\u044b \u0430\u0431\u043e\u043d\u0435\u043d\u0442\u0430 \u043d\u0430 \u043d\u0430\u0447\u0430\u043b\u043e",),
    "abon_address_start": ("\u0410\u0434\u0440\u0435\u0441 \u0411\u0421 \u0430\u0431\u043e\u043d\u0435\u043d\u0442\u0430 \u043d\u0430 \u043d\u0430\u0447\u0430\u043b\u043e",),
    "abon_cell_end": ("\u041c/\u041f \u0430\u0431\u043e\u043d\u0435\u043d\u0442\u0430 \u043d\u0430 \u043a\u043e\u043d\u0435\u0446",),
    "abon_azimuth_end": ("\u0410\u0437\u0438\u043c\u0443\u0442 \u0430\u043d\u0442\u0435\u043d\u043d\u044b \u0430\u0431\u043e\u043d\u0435\u043d\u0442\u0430 \u043d\u0430 \u0437\u0430\u0432\u0435\u0440\u0448\u0435\u043d\u0438\u0435",),
    "abon_address_end": ("\u0410\u0434\u0440\u0435\u0441 \u0411\u0421 \u0430\u0431\u043e\u043d\u0435\u043d\u0442\u0430 \u043d\u0430 \u0437\u0430\u0432\u0435\u0440\u0448\u0435\u043d\u0438\u0435",),
    "contact_cell_start": ("\u041c/\u041f \u043a\u043e\u043d\u0442\u0430\u043a\u0442\u0430 \u043d\u0430 \u043d\u0430\u0447\u0430\u043b\u043e",),
    "contact_azimuth_start": ("\u0410\u0437\u0438\u043c\u0443\u0442 \u0430\u043d\u0442\u0435\u043d\u043d\u044b \u043a\u043e\u043d\u0442\u0430\u043a\u0442\u0430 \u043d\u0430 \u043d\u0430\u0447\u0430\u043b\u043e",),
    "contact_address_start": ("\u0410\u0434\u0440\u0435\u0441 \u0411\u0421 \u043a\u043e\u043d\u0442\u0430\u043a\u0442\u0430 \u043d\u0430 \u043d\u0430\u0447\u0430\u043b\u043e",),
    "contact_cell_end": ("\u041c/\u041f \u043a\u043e\u043d\u0442\u0430\u043a\u0442\u0430 \u043d\u0430 \u043a\u043e\u043d\u0435\u0446",),
    "contact_azimuth_end": ("\u0410\u0437\u0438\u043c\u0443\u0442 \u0430\u043d\u0442\u0435\u043d\u043d\u044b \u043a\u043e\u043d\u0442\u0430\u043a\u0442\u0430 \u043d\u0430 \u0437\u0430\u0432\u0435\u0440\u0448\u0435\u043d\u0438\u0435",),
    "contact_address_end": ("\u0410\u0434\u0440\u0435\u0441 \u0411\u0421 \u043a\u043e\u043d\u0442\u0430\u043a\u0442\u0430 \u043d\u0430 \u0437\u0430\u0432\u0435\u0440\u0448\u0435\u043d\u0438\u0435",),
    "direction": ("\u041d\u0430\u043f\u0440\u0430\u0432\u043b\u0435\u043d\u0438\u0435 \u0441\u043e\u0435\u0434\u0438\u043d\u0435\u043d\u0438\u044f",),
}
NULL_VALUES = {"", "null", "none", "n/a", "na", "-"}


def _text(value: Any) -> str:
    return re.sub(r"\s+", " ", str(value or "").strip())


def _value(row: dict[str, str], field: str) -> str:
    values = {key.casefold(): value for key, value in row.items()}
    for header in HEADERS[field]:
        value = values.get(header.casefold(), "")
        if _text(value):
            return _text(value)
    return ""


def _digits(value: Any, minimum: int, maximum: int) -> str:
    raw = _text(value)
    if raw.casefold() in NULL_VALUES:
        return ""
    digits = re.sub(r"\D", "", raw)
    return digits if minimum <= len(digits) <= maximum else ""


def _msisdn(value: Any) -> str:
    digits = _digits(value, 8, 13)
    if len(digits) == 11 and digits.startswith("8"):
        return "7" + digits[1:]
    return "7" + digits if len(digits) == 10 else digits


def _imsi(value: Any) -> str:
    return _digits(value, 15, 15)


def _imei(value: Any) -> str:
    return _digits(value, 14, 16)


def _time(value: Any) -> datetime | None:
    raw = _text(value)
    for fmt in ("%d.%m.%Y %H:%M:%S", "%d.%m.%Y %H:%M", "%Y-%m-%d %H:%M:%S", "%Y-%m-%dT%H:%M:%S"):
        try:
            return datetime.strptime(raw, fmt)
        except ValueError:
            continue
    return None


def _duration(value: Any) -> int:
    try:
        return max(0, int(float(_text(value).replace(",", "."))))
    except ValueError:
        return 0


def _cell_key(value: Any, imsi: str) -> tuple[str, dict[str, str]] | None:
    parts = re.findall(r"\d+", _text(value))
    if len(parts) < 2 or not imsi:
        return None
    mcc, mnc = imsi[:3], imsi[3:5]
    lac, cid = parts[0], parts[1]
    return f"{mcc}/{mnc}/{lac}/{cid}", {"mcc": mcc, "mnc": mnc, "lac": lac, "cid": cid}


def _azimuth(value: Any) -> str:
    raw = _text(value).replace(",", ".")
    if raw.casefold() in NULL_VALUES:
        return ""
    try:
        return str(float(raw)).rstrip("0").rstrip(".")
    except ValueError:
        return ""


def _address(value: Any) -> str:
    raw = _text(value)
    return "" if raw.casefold() in NULL_VALUES else raw


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


def _append(rows: list[dict[str, Any]], seen: set[tuple[Any, ...]], row: dict[str, Any], keys: tuple[str, ...]) -> None:
    key = tuple(row.get(name) for name in keys)
    if key not in seen:
        seen.add(key)
        rows.append(row)


def normalize_telecom_connections(source_dir: Path) -> dict[str, list[dict[str, Any]]]:
    sources: dict[str, list[dict[str, Any]]] = {
        "telecom_msisdn_imsi": [],
        "telecom_msisdn_imei": [],
        "telecom_connections": [],
        "telecom_msisdn_base_stations": [],
        "telecom_base_stations": [],
        "telecom_base_station_locations": [],
    }
    seen: dict[str, set[tuple[Any, ...]]] = defaultdict(set)
    stations: dict[str, dict[str, str]] = {}

    def append_station(cell: str, imsi: str, azimuth: str) -> str:
        parsed = _cell_key(cell, imsi)
        if not parsed:
            return ""
        station, attrs = parsed
        existing = stations.get(station)
        if existing is None:
            stations[station] = {"base_station": station, **attrs, "azimuth_deg": azimuth}
        elif not existing.get("azimuth_deg") and azimuth:
            existing["azimuth_deg"] = azimuth
        return station

    for path in sorted(source_dir.rglob("*")):
        if not path.is_file() or path.suffix.lower() not in {".csv", ".txt"}:
            continue
        for row in _read_rows(path):
            occurred_at = _time(_value(row, "time"))
            abon = _msisdn(_value(row, "abon_msisdn"))
            contact = _msisdn(_value(row, "contact_msisdn"))
            if not occurred_at or not abon:
                continue
            duration = _duration(_value(row, "duration"))
            event_time = occurred_at.strftime("%Y-%m-%d %H:%M:%S")
            end_time = (occurred_at + timedelta(seconds=duration)).strftime("%Y-%m-%d %H:%M:%S")
            abon_imsi, contact_imsi = _imsi(_value(row, "abon_imsi")), _imsi(_value(row, "contact_imsi"))
            abon_imei, contact_imei = _imei(_value(row, "abon_imei")), _imei(_value(row, "contact_imei"))

            for msisdn, imsi, imei in ((abon, abon_imsi, abon_imei), (contact, contact_imsi, contact_imei)):
                if msisdn and imsi:
                    _append(sources["telecom_msisdn_imsi"], seen["telecom_msisdn_imsi"], {"msisdn": msisdn, "imsi": imsi, "event_time": event_time}, ("msisdn", "imsi", "event_time"))
                if msisdn and imei:
                    _append(sources["telecom_msisdn_imei"], seen["telecom_msisdn_imei"], {"msisdn": msisdn, "imei": imei, "event_time": event_time}, ("msisdn", "imei", "event_time"))

            if contact:
                direction = _value(row, "direction").casefold()
                from_msisdn, to_msisdn = (contact, abon) if "\u0432\u0445\u043e\u0434" in direction else (abon, contact)
                _append(
                    sources["telecom_connections"],
                    seen["telecom_connections"],
                    {
                        "from_msisdn": from_msisdn,
                        "to_msisdn": to_msisdn,
                        "event_time": event_time,
                        "duration_sec": duration,
                        "connection_type": _value(row, "connection_type"),
                    },
                    ("from_msisdn", "to_msisdn", "event_time"),
                )

            observations = (
                (abon, abon_imsi, _value(row, "abon_cell_start"), _azimuth(_value(row, "abon_azimuth_start")), _address(_value(row, "abon_address_start")), event_time),
                (abon, abon_imsi, _value(row, "abon_cell_end"), _azimuth(_value(row, "abon_azimuth_end")), _address(_value(row, "abon_address_end")), end_time),
                (contact, contact_imsi, _value(row, "contact_cell_start"), _azimuth(_value(row, "contact_azimuth_start")), _address(_value(row, "contact_address_start")), event_time),
                (contact, contact_imsi, _value(row, "contact_cell_end"), _azimuth(_value(row, "contact_azimuth_end")), _address(_value(row, "contact_address_end")), end_time),
            )
            for msisdn, imsi, cell, azimuth, address, at in observations:
                if not msisdn:
                    continue
                station = append_station(cell, imsi, azimuth)
                if not station:
                    continue
                _append(sources["telecom_msisdn_base_stations"], seen["telecom_msisdn_base_stations"], {"msisdn": msisdn, "base_station": station, "event_time": at}, ("msisdn", "base_station", "event_time"))
                if address:
                    _append(sources["telecom_base_station_locations"], seen["telecom_base_station_locations"], {"base_station": station, "location": address}, ("base_station", "location"))

    sources["telecom_base_stations"] = list(stations.values())
    return sources
