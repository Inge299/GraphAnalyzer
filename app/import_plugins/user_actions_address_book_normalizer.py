from __future__ import annotations

import ast
import csv
import re
from collections import defaultdict
from datetime import datetime
from pathlib import Path
from typing import Any


HEADERS = {
    "event_time": "\u0414\u0430\u0442\u0430 \u0438 \u0432\u0440\u0435\u043c\u044f",
    "technical_data": "\u0422\u0435\u0445\u0434\u0430\u043d\u043d\u044b\u0435, \u0438\u0434\u0435\u043d\u0442. \u043f\u043e\u043b\u044c\u0437\u043e\u0432\u0430\u0442\u0435\u043b\u044f",
    "message_text": "\u0422\u0435\u043a\u0441\u0442 \u0441\u043e\u043e\u0431\u0449\u0435\u043d\u0438\u044f",
}
NULL_VALUES = {"", "null", "none", "n/a", "na", "-"}


def _text(value: Any) -> str:
    return re.sub(r"\s+", " ", str(value or "").strip())


def _msisdn(value: Any) -> str:
    raw = _text(value)
    if raw.casefold() in NULL_VALUES:
        return ""
    digits = re.sub(r"\D", "", raw)
    if len(digits) == 11 and digits.startswith("8"):
        return "7" + digits[1:]
    return "7" + digits if len(digits) == 10 else digits if 8 <= len(digits) <= 15 else ""


def _event_time(value: Any) -> str:
    raw = _text(value)
    for fmt in ("%d.%m.%Y %H:%M:%S", "%d.%m.%Y %H:%M", "%Y-%m-%d %H:%M:%S", "%Y-%m-%dT%H:%M:%S"):
        try:
            return datetime.strptime(raw, fmt).strftime("%Y-%m-%d %H:%M:%S")
        except ValueError:
            continue
    return ""


def _read_rows(path: Path) -> list[dict[str, str]]:
    raw = path.read_bytes()
    for encoding in ("utf-8-sig", "utf-8", "cp1251", "cp866"):
        try:
            content = raw.decode(encoding)
            break
        except UnicodeDecodeError:
            continue
    else:
        return []
    lines = content.splitlines()
    if not lines:
        return []
    delimiter = max((";", ",", "\t"), key=lines[0].count)
    return [
        {_text(key): _text(value) for key, value in row.items() if key}
        for row in csv.DictReader(lines, delimiter=delimiter)
    ]


def _extract_technical_data(value: Any) -> tuple[str, str]:
    raw = _text(value)
    number_match = re.search(r"\u041d\u043e\u043c\u0435\u0440\s*:\s*([^;]+)", raw, re.IGNORECASE)
    device_match = re.search(r"\u041f\u0440\u043e\u0433\u0440\u0430\u043c\u043c\u0430\s*:\s*(.+?)(?:\s*;\s*|$)", raw, re.IGNORECASE)
    return (
        _msisdn(number_match.group(1)) if number_match else "",
        _text(device_match.group(1)) if device_match else "",
    )


def _message_fields(value: Any) -> dict[str, str]:
    raw = _text(value)
    if not raw or raw.casefold() in NULL_VALUES:
        return {}
    normalized = raw.replace("''", "'")
    try:
        parsed = ast.literal_eval(normalized)
    except (SyntaxError, ValueError):
        parsed = {}
    if isinstance(parsed, dict) and parsed:
        return {str(key): _text(item) for key, item in parsed.items()}

    fields: dict[str, str] = {}
    for key in ("phone", "firstName", "lastName"):
        match = re.search(rf"['\"]{key}['\"]\s*:\s*['\"]([^'\"]*)['\"]", normalized)
        if match:
            fields[key] = _text(match.group(1))
    return fields


def _append(
    source_rows: dict[str, list[dict[str, Any]]],
    seen: dict[str, set[tuple[Any, ...]]],
    source: str,
    row: dict[str, Any],
    unique_by: tuple[str, ...],
) -> None:
    marker = tuple(row.get(key) for key in unique_by)
    if marker not in seen[source]:
        seen[source].add(marker)
        source_rows[source].append(row)


def normalize_user_actions_address_book(source_dir: Path) -> dict[str, list[dict[str, Any]]]:
    """Normalize user-action exports into universal address-book source rows."""

    sources: dict[str, list[dict[str, Any]]] = {
        "address_book_entries": [],
        "recorded_as_entries": [],
        "user_device_observations": [],
    }
    seen: dict[str, set[tuple[Any, ...]]] = defaultdict(set)
    aliases_by_contact: dict[str, set[str]] = defaultdict(set)

    for path in sorted(source_dir.rglob("*")):
        if not path.is_file() or path.suffix.lower() not in {".csv", ".txt"}:
            continue
        for raw_row in _read_rows(path):
            event_time = _event_time(raw_row.get(HEADERS["event_time"]))
            owner_msisdn, device = _extract_technical_data(raw_row.get(HEADERS["technical_data"]))
            fields = _message_fields(raw_row.get(HEADERS["message_text"]))
            contact_msisdn = _msisdn(fields.get("phone"))
            if not event_time or not owner_msisdn or not contact_msisdn:
                continue

            common = {
                "event_time": event_time,
                "owner_msisdn": owner_msisdn,
                "contact_msisdn": contact_msisdn,
                "source_file": path.name,
            }
            _append(sources, seen, "address_book_entries", common, ("owner_msisdn", "contact_msisdn", "event_time"))

            alias = _text(" ".join(part for part in (fields.get("firstName"), fields.get("lastName")) if part))
            if alias:
                aliases_by_contact[contact_msisdn].add(f"{alias} \u0437\u0430\u043f\u0438\u0441\u0430\u043d \u0443 {owner_msisdn}")
                _append(
                    sources,
                    seen,
                    "recorded_as_entries",
                    {
                        **common,
                        "text_key": f"recorded-as:{contact_msisdn}",
                        "text_label": f"\u041a\u0430\u043a \u0437\u0430\u043f\u0438\u0441\u0430\u043d {contact_msisdn}",
                        "alias": alias,
                        "source_msisdn": owner_msisdn,
                    },
                    ("owner_msisdn", "contact_msisdn", "alias", "event_time"),
                )

            if device:
                _append(
                    sources,
                    seen,
                    "user_device_observations",
                    {"event_time": event_time, "owner_msisdn": owner_msisdn, "device": device, "source_file": path.name},
                    ("owner_msisdn", "device"),
                )

    for row in sources["recorded_as_entries"]:
        row["text"] = "\n".join(sorted(aliases_by_contact[row["contact_msisdn"]], key=str.casefold))

    return sources