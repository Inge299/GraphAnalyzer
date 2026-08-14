from __future__ import annotations

from collections import Counter
from datetime import datetime, timedelta
import re
from typing import Any, Dict, Optional

from app.console_plugins import ConsoleExecutorPlugin
from app.console_plugins._graph_analysis_utils import column, tab
from app.console_plugins.movement_analysis import (
    _requested_msisdns,
    _selected_msisdns,
    fetch_movement_source_rows,
)


UNKNOWN_LOCALITY = "\u041d\u0435 \u043e\u043f\u0440\u0435\u0434\u0435\u043b\u0451\u043d"
TECHNICAL_LOCATION_MARKERS = (
    "\u0442\u0435\u0445\u043d\u043e\u043b\u043e\u0433\u0438\u0447\u0435\u0441\u043a\u043e\u0435 \u0438\u0441\u043f\u043e\u043b\u044c\u0437\u043e\u0432\u0430\u043d\u0438\u0435",
    "\u0442\u0435\u0445\u043d\u043e\u043b\u043e\u0433\u0438\u0447\u0435\u0441\u043a\u043e\u0435 \u0441\u043e\u0431\u044b\u0442\u0438\u0435",
    "\u0445\u044d\u043d\u0434\u043e\u0432\u0435\u0440",
)


def _format_datetime(value: datetime | None) -> str:
    return value.strftime("%d.%m.%Y %H:%M") if isinstance(value, datetime) else "-"


def _format_duration(value: timedelta | None) -> str:
    if value is None:
        return "-"
    minutes = max(0, int(value.total_seconds() // 60))
    days, minutes = divmod(minutes, 24 * 60)
    hours, minutes = divmod(minutes, 60)
    parts: list[str] = []
    if days:
        parts.append(f"{days} \u0441\u0443\u0442")
    if hours:
        parts.append(f"{hours} \u0447")
    if minutes or not parts:
        parts.append(f"{minutes} \u043c\u0438\u043d")
    return " ".join(parts)


def _locality(value: object) -> str:
    address = str(value or "").strip()
    if not address:
        return UNKNOWN_LOCALITY
    normalized = re.sub(r"\s+", " ", address)
    patterns = (
        r"(?:^|,\s*)(?:\u0433\.?|\u0433\u043e\u0440\u043e\u0434)\s+([^,]+)",
        r"(?:^|,\s*)(?:\u043f\u0433\u0442\.?|\u043f\u043e\u0441(?:\u0451\u043b\u043e\u043a)?\.?)\s+([^,]+)",
        r"(?:^|,\s*)(?:\u0441\.?|\u0441\u0435\u043b\u043e)\s+([^,]+)",
        r"(?:^|,\s*)\u0441\u0442\.?\s+([^,]+)",
    )
    for pattern in patterns:
        match = re.search(pattern, normalized, flags=re.IGNORECASE)
        if match:
            result = match.group(1).strip(" .")
            if result:
                return result
    return UNKNOWN_LOCALITY


def _display_address(value: object) -> str:
    address = str(value or "").strip()
    return address if address else "\u0410\u0434\u0440\u0435\u0441 \u043d\u0435 \u0443\u043a\u0430\u0437\u0430\u043d"


def _usable_location_address(value: object) -> str:
    address = str(value or "").strip()
    normalized = re.sub(r"\s+", " ", address).casefold()
    if not address or any(marker in normalized for marker in TECHNICAL_LOCATION_MARKERS):
        return ""
    return address

def _is_night(value: object) -> bool:
    return isinstance(value, datetime) and (value.hour >= 23 or value.hour < 6)


def _escape_cell(value: object) -> str:
    return str(value or "-").replace("|", "\\|").replace("\\n", " ")


def _build_locality_periods(rows: list[Dict[str, Any]], gap: timedelta) -> list[Dict[str, Any]]:
    periods: list[Dict[str, Any]] = []
    current: Dict[str, Any] | None = None
    for row in sorted(rows, key=lambda item: item.get("event_time") or datetime.min):
        event_time = row.get("event_time")
        if not isinstance(event_time, datetime):
            continue
        address = _usable_location_address(row.get("resolved_address") or row.get("address"))
        if not address:
            continue
        locality = _locality(address)
        if locality == UNKNOWN_LOCALITY:
            continue
        if current and current["locality"] == locality and event_time - current["ended_at"] <= gap:
            current["ended_at"] = event_time
            current["events"] += 1
            current["addresses"][_display_address(address)] += 1
            continue
        current = {
            "locality": locality,
            "started_at": event_time,
            "ended_at": event_time,
            "events": 1,
            "addresses": Counter({_display_address(address): 1}),
        }
        periods.append(current)
    changed = True
    while changed and len(periods) >= 3:
        changed = False
        for index in range(1, len(periods) - 1):
            previous, current, following = periods[index - 1], periods[index], periods[index + 1]
            duration = current["ended_at"] - current["started_at"]
            if previous["locality"] == following["locality"] and (current["events"] < 2 or duration < timedelta(minutes=10)):
                previous["ended_at"] = following["ended_at"]
                previous["events"] += current["events"] + following["events"]
                previous["addresses"].update(current["addresses"])
                previous["addresses"].update(following["addresses"])
                del periods[index:index + 2]
                changed = True
                break
    return periods

def _main_location(rows: list[Dict[str, Any]]) -> Dict[str, Any] | None:
    nightly = []
    for row in rows:
        address = _usable_location_address(row.get("resolved_address") or row.get("address"))
        if _is_night(row.get("event_time")) and _locality(address) != UNKNOWN_LOCALITY:
            nightly.append({**row, "_location_address": address})
    if not nightly:
        return None
    by_locality: dict[str, list[Dict[str, Any]]] = {}
    for row in nightly:
        by_locality.setdefault(_locality(row["_location_address"]), []).append(row)
    locality, samples = max(by_locality.items(), key=lambda item: (len(item[1]), item[0]))
    addresses = Counter(_display_address(row["_location_address"]) for row in samples)
    return {
        "locality": locality,
        "events": len(samples),
        "total_night_events": len(nightly),
        "share": round(len(samples) * 100 / len(nightly), 1),
        "first": min(row["event_time"] for row in samples),
        "last": max(row["event_time"] for row in samples),
        "address": addresses.most_common(1)[0][0],
    }

def _markdown_for_number(msisdn: str, rows: list[Dict[str, Any]], gap: timedelta) -> str:
    if not rows:
        return f"## {msisdn}\n\n\u041d\u0435\u0442 \u043f\u043e\u0434\u0445\u043e\u0434\u044f\u0449\u0438\u0445 \u0440\u0435\u0433\u0438\u0441\u0442\u0440\u0430\u0446\u0438\u0439 \u0432 \u0441\u043e\u0442\u043e\u0432\u043e\u0439 \u0441\u0435\u0442\u0438."
    ordered = sorted(rows, key=lambda item: item["event_time"])
    periods = _build_locality_periods(ordered, gap)
    main = _main_location(ordered)
    lines = [
        f"## MSISDN {msisdn}",
        "",
        f"\u041f\u0435\u0440\u0438\u043e\u0434 \u043f\u0440\u043e\u0430\u043d\u0430\u043b\u0438\u0437\u0438\u0440\u043e\u0432\u0430\u043d\u043d\u044b\u0445 \u0440\u0435\u0433\u0438\u0441\u0442\u0440\u0430\u0446\u0438\u0439: **{_format_datetime(ordered[0]['event_time'])} - {_format_datetime(ordered[-1]['event_time'])}**. \u0412\u0441\u0435\u0433\u043e \u0441\u043e\u0431\u044b\u0442\u0438\u0439: **{len(ordered)}**.",
        "",
        "### \u0412\u0435\u0440\u043e\u044f\u0442\u043d\u043e\u0435 \u043e\u0441\u043d\u043e\u0432\u043d\u043e\u0435 \u043c\u0435\u0441\u0442\u043e \u043f\u0440\u0435\u0431\u044b\u0432\u0430\u043d\u0438\u044f",
    ]
    if main and main["events"] >= 2:
        lines.extend([
            f"**{main['locality']}** - \u0432\u0435\u0440\u043e\u044f\u0442\u043d\u043e\u0435 \u043c\u0435\u0441\u0442\u043e \u043f\u0440\u043e\u0436\u0438\u0432\u0430\u043d\u0438\u044f / \u043e\u0441\u043d\u043e\u0432\u043d\u043e\u0433\u043e \u043f\u0440\u0435\u0431\u044b\u0432\u0430\u043d\u0438\u044f.",
            f"\u041d\u043e\u0447\u043d\u044b\u0445 \u0440\u0435\u0433\u0438\u0441\u0442\u0440\u0430\u0446\u0438\u0439 (23:00-06:00): **{main['events']}** \u0438\u0437 **{main['total_night_events']}** ({main['share']}%). \u041f\u0435\u0440\u0438\u043e\u0434: {_format_datetime(main['first'])} - {_format_datetime(main['last'])}.",
            f"\u041d\u0430\u0438\u0431\u043e\u043b\u0435\u0435 \u0447\u0430\u0441\u0442\u044b\u0439 \u0430\u0434\u0440\u0435\u0441 \u0411\u0421: {_escape_cell(main['address'])}.",
        ])
    else:
        lines.append("\u041d\u0435\u0434\u043e\u0441\u0442\u0430\u0442\u043e\u0447\u043d\u043e \u043d\u043e\u0447\u043d\u044b\u0445 \u0440\u0435\u0433\u0438\u0441\u0442\u0440\u0430\u0446\u0438\u0439, \u0447\u0442\u043e\u0431\u044b \u043e\u0446\u0435\u043d\u0438\u0442\u044c \u0432\u0435\u0440\u043e\u044f\u0442\u043d\u043e\u0435 \u043c\u0435\u0441\u0442\u043e \u043f\u0440\u043e\u0436\u0438\u0432\u0430\u043d\u0438\u044f.")
    lines.extend(["", "### \u041f\u043e\u0441\u043b\u0435\u0434\u043e\u0432\u0430\u0442\u0435\u043b\u044c\u043d\u043e\u0441\u0442\u044c \u043f\u0435\u0440\u0438\u043e\u0434\u043e\u0432 \u043f\u043e \u043d\u0430\u0441\u0435\u043b\u0451\u043d\u043d\u044b\u043c \u043f\u0443\u043d\u043a\u0442\u0430\u043c", "", "| # | \u041d\u0430\u0441\u0435\u043b\u0451\u043d\u043d\u044b\u0439 \u043f\u0443\u043d\u043a\u0442 | \u041f\u0435\u0440\u0438\u043e\u0434 | \u0414\u043b\u0438\u0442\u0435\u043b\u044c\u043d\u043e\u0441\u0442\u044c | \u0420\u0435\u0433\u0438\u0441\u0442\u0440\u0430\u0446\u0438\u0439 | \u041d\u0430\u0438\u0431\u043e\u043b\u0435\u0435 \u0447\u0430\u0441\u0442\u044b\u0439 \u0430\u0434\u0440\u0435\u0441 |", "| --- | --- | --- | --- | ---: | --- |"])
    for index, item in enumerate(periods, start=1):
        address = item["addresses"].most_common(1)[0][0]
        lines.append(
            f"| {index} | {_escape_cell(item['locality'])} | {_format_datetime(item['started_at'])} - {_format_datetime(item['ended_at'])} | {_format_duration(item['ended_at'] - item['started_at'])} | {item['events']} | {_escape_cell(address)} |"
        )
    lines.extend(["", "_\u0412\u044b\u0432\u043e\u0434\u044b \u043f\u043e\u0441\u0442\u0440\u043e\u0435\u043d\u044b \u043f\u043e \u0440\u0435\u0433\u0438\u0441\u0442\u0440\u0430\u0446\u0438\u044f\u043c \u0432 \u0441\u043e\u0442\u043e\u0432\u043e\u0439 \u0441\u0435\u0442\u0438 \u0438 \u043d\u0435 \u043f\u043e\u0434\u0442\u0432\u0435\u0440\u0436\u0434\u0430\u044e\u0442 \u0444\u0430\u043a\u0442 \u043f\u0440\u043e\u0436\u0438\u0432\u0430\u043d\u0438\u044f \u0438\u043b\u0438 \u043f\u0435\u0440\u0435\u043c\u0435\u0449\u0435\u043d\u0438\u044f._"])
    return "\n".join(lines)


class MovementNarrativeExecutor(ConsoleExecutorPlugin):
    id = "movement_narrative"
    name = "\u0422\u0435\u043a\u0441\u0442\u043e\u0432\u043e\u0435 \u043e\u043f\u0438\u0441\u0430\u043d\u0438\u0435 \u043f\u0435\u0440\u0435\u043c\u0435\u0449\u0435\u043d\u0438\u0439"
    description = "\u0421\u043e\u0437\u0434\u0430\u0451\u0442 \u0442\u0435\u043a\u0441\u0442\u043e\u0432\u044b\u0439 \u043e\u0442\u0447\u0451\u0442 \u043e \u043f\u0435\u0440\u0438\u043e\u0434\u0430\u0445 \u043f\u0440\u0435\u0431\u044b\u0432\u0430\u043d\u0438\u044f \u043f\u043e \u043d\u0430\u0441\u0435\u043b\u0451\u043d\u043d\u044b\u043c \u043f\u0443\u043d\u043a\u0442\u0430\u043c \u0438 \u0432\u0435\u0440\u043e\u044f\u0442\u043d\u043e\u043c \u043e\u0441\u043d\u043e\u0432\u043d\u043e\u043c \u043c\u0435\u0441\u0442\u0435 \u043f\u0440\u0435\u0431\u044b\u0432\u0430\u043d\u0438\u044f."
    menu_path = "\u0410\u043d\u0430\u043b\u0438\u0437/\u0413\u0435\u043e"
    menu_order = 30
    supports_graph_selection = True
    default_limit = 50000
    timeout_seconds = 120
    params_schema = [
        {"name": "msisdn", "label": "MSISDN (\u0447\u0435\u0440\u0435\u0437 \u0437\u0430\u043f\u044f\u0442\u0443\u044e, \u0435\u0441\u043b\u0438 \u043d\u0435 \u0432\u044b\u0431\u0440\u0430\u043d \u043d\u0430 \u0433\u0440\u0430\u0444\u0435)", "type": "string", "default": "", "required": False},
        {"name": "date_from", "label": "\u041d\u0430\u0447\u0430\u043b\u043e \u043f\u0435\u0440\u0438\u043e\u0434\u0430", "type": "date", "default": "", "required": False},
        {"name": "date_to", "label": "\u041a\u043e\u043d\u0435\u0446 \u043f\u0435\u0440\u0438\u043e\u0434\u0430", "type": "date", "default": "", "required": False},
        {"name": "settlement_gap_hours", "label": "\u041f\u0430\u0443\u0437\u0430 \u0434\u043b\u044f \u0440\u0430\u0437\u0434\u0435\u043b\u0435\u043d\u0438\u044f \u043f\u0435\u0440\u0438\u043e\u0434\u043e\u0432, \u0447", "type": "integer", "default": 6, "required": False},
        {"name": "limit", "label": "\u041b\u0438\u043c\u0438\u0442 \u0441\u043e\u0431\u044b\u0442\u0438\u0439 (\u043d\u0435 \u0431\u043e\u043b\u0435\u0435 50000)", "type": "integer", "default": 50000, "required": False},
    ]

    async def execute(self, *, project_id: int, artifact: Optional[Dict[str, Any]] = None, params: Optional[Dict[str, Any]] = None, context: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
        values = params or {}
        msisdns = _requested_msisdns(values.get("msisdn")) or _selected_msisdns(artifact, context)
        if not msisdns:
            return self._empty("\u0412\u044b\u0431\u0435\u0440\u0438\u0442\u0435 \u043d\u0430 \u0433\u0440\u0430\u0444\u0435 MSISDN \u0438\u043b\u0438 \u0443\u043a\u0430\u0436\u0438\u0442\u0435 \u043d\u043e\u043c\u0435\u0440 \u0432 \u043f\u0430\u0440\u0430\u043c\u0435\u0442\u0440\u0435.")
        try:
            limit = min(50000, max(1, int(values.get("limit") or self.default_limit)))
            gap_hours = max(0, int(values.get("settlement_gap_hours") or 0))
            date_from = datetime.fromisoformat(str(values["date_from"]).strip()) if values.get("date_from") else None
            date_to = datetime.fromisoformat(str(values["date_to"]).strip()) if values.get("date_to") else None
        except ValueError:
            return self._empty("\u041f\u0440\u043e\u0432\u0435\u0440\u044c\u0442\u0435 \u0434\u0430\u0442\u044b \u0438 \u0447\u0438\u0441\u043b\u043e\u0432\u044b\u0435 \u043f\u0430\u0440\u0430\u043c\u0435\u0442\u0440\u044b.")
        rows = await fetch_movement_source_rows(project_id=project_id, msisdns=msisdns, date_from=date_from, date_to=date_to, limit=limit)
        if not rows:
            return self._empty("\u041f\u043e \u0432\u044b\u0431\u0440\u0430\u043d\u043d\u044b\u043c \u0443\u0441\u043b\u043e\u0432\u0438\u044f\u043c \u0441\u043e\u0431\u044b\u0442\u0438\u0439 \u043b\u043e\u043a\u0430\u0446\u0438\u0439 \u043d\u0435 \u043d\u0430\u0439\u0434\u0435\u043d\u043e.")
        gap = timedelta(hours=gap_hours)
        report_sections = ["# \u0422\u0435\u043a\u0441\u0442\u043e\u0432\u043e\u0435 \u043e\u043f\u0438\u0441\u0430\u043d\u0438\u0435 \u043f\u0435\u0440\u0435\u043c\u0435\u0449\u0435\u043d\u0438\u0439", "", f"\u041f\u0435\u0440\u0438\u043e\u0434\u044b \u043f\u043e \u043d\u0430\u0441\u0435\u043b\u0451\u043d\u043d\u044b\u043c \u043f\u0443\u043d\u043a\u0442\u0430\u043c \u043e\u0431\u044a\u0435\u0434\u0438\u043d\u0435\u043d\u044b \u043f\u0440\u0438 \u043f\u0430\u0443\u0437\u0435 \u043d\u0435 \u0431\u043e\u043b\u0435\u0435 **{gap_hours} \u0447**."]
        summary_rows: list[Dict[str, Any]] = []
        period_rows: list[Dict[str, Any]] = []
        for msisdn in msisdns:
            own_rows = [row for row in rows if row.get("msisdn") == msisdn]
            periods = _build_locality_periods(own_rows, gap)
            main = _main_location(own_rows)
            summary_rows.append({
                "msisdn": msisdn,
                "events": len(own_rows),
                "first_event": _format_datetime(min((row.get("event_time") for row in own_rows), default=None)),
                "last_event": _format_datetime(max((row.get("event_time") for row in own_rows), default=None)),
                "main_location": main["locality"] if main else "\u041d\u0435\u0434\u043e\u0441\u0442\u0430\u0442\u043e\u0447\u043d\u043e \u0434\u0430\u043d\u043d\u044b\u0445",
                "night_events": main["events"] if main else 0,
            })
            for sequence, period in enumerate(periods, start=1):
                period_rows.append({
                    "msisdn": msisdn,
                    "sequence": sequence,
                    "locality": period["locality"],
                    "started_at": _format_datetime(period["started_at"]),
                    "ended_at": _format_datetime(period["ended_at"]),
                    "duration": _format_duration(period["ended_at"] - period["started_at"]),
                    "events": period["events"],
                    "address": period["addresses"].most_common(1)[0][0],
                })
            report_sections.extend(["", _markdown_for_number(msisdn, own_rows, gap)])
        content = "\n".join(report_sections).strip()
        return {
            "profile_id": self.id,
            "profile_name": self.name,
            "tabs": [
                tab("summary", "\u0418\u0442\u043e\u0433", [column("msisdn", "MSISDN", "string", 160), column("events", "\u0420\u0435\u0433\u0438\u0441\u0442\u0440\u0430\u0446\u0438\u0439", "integer", 120), column("first_event", "\u041f\u0435\u0440\u0432\u043e\u0435 \u0441\u043e\u0431\u044b\u0442\u0438\u0435", "datetime", 180), column("last_event", "\u041f\u043e\u0441\u043b\u0435\u0434\u043d\u0435\u0435 \u0441\u043e\u0431\u044b\u0442\u0438\u0435", "datetime", 180), column("main_location", "\u041e\u0441\u043d\u043e\u0432\u043d\u043e\u0435 \u043c\u0435\u0441\u0442\u043e", "string", 240), column("night_events", "\u041d\u043e\u0447\u043d\u044b\u0445 \u0440\u0435\u0433\u0438\u0441\u0442\u0440\u0430\u0446\u0438\u0439", "integer", 150)], summary_rows),
                tab("periods", "\u041f\u0435\u0440\u0438\u043e\u0434\u044b \u043f\u043e \u043d\u0430\u0441\u0435\u043b\u0451\u043d\u043d\u044b\u043c \u043f\u0443\u043d\u043a\u0442\u0430\u043c", [column("msisdn", "MSISDN", "string", 160), column("sequence", "#", "integer", 70), column("locality", "\u041d\u0430\u0441\u0435\u043b\u0451\u043d\u043d\u044b\u0439 \u043f\u0443\u043d\u043a\u0442", "string", 220), column("started_at", "\u041d\u0430\u0447\u0430\u043b\u043e", "datetime", 170), column("ended_at", "\u041e\u043a\u043e\u043d\u0447\u0430\u043d\u0438\u0435", "datetime", 170), column("duration", "\u0414\u043b\u0438\u0442\u0435\u043b\u044c\u043d\u043e\u0441\u0442\u044c", "string", 130), column("events", "\u0420\u0435\u0433\u0438\u0441\u0442\u0440\u0430\u0446\u0438\u0439", "integer", 110), column("address", "\u041d\u0430\u0438\u0431\u043e\u043b\u0435\u0435 \u0447\u0430\u0441\u0442\u044b\u0439 \u0430\u0434\u0440\u0435\u0441", "string", 420)], period_rows),
            ],
            "active_tab_id": "summary",
            "derived_artifacts": [{
                "type": "document",
                "name": "\u041e\u043f\u0438\u0441\u0430\u043d\u0438\u0435 \u043f\u0435\u0440\u0435\u043c\u0435\u0449\u0435\u043d\u0438\u0439",
                "description": "\u041f\u043e\u0441\u043b\u0435\u0434\u043e\u0432\u0430\u0442\u0435\u043b\u044c\u043d\u043e\u0441\u0442\u044c \u043f\u0435\u0440\u0438\u043e\u0434\u043e\u0432 \u043f\u043e \u043d\u0430\u0441\u0435\u043b\u0451\u043d\u043d\u044b\u043c \u043f\u0443\u043d\u043a\u0442\u0430\u043c \u0438 \u0432\u0435\u0440\u043e\u044f\u0442\u043d\u043e\u0435 \u043e\u0441\u043d\u043e\u0432\u043d\u043e\u0435 \u043c\u0435\u0441\u0442\u043e \u043f\u0440\u0435\u0431\u044b\u0432\u0430\u043d\u0438\u044f.",
                "source_plugin_id": self.id,
                "data": {"content": content},
            }],
        }

    def _empty(self, status: str) -> Dict[str, Any]:
        return {"profile_id": self.id, "profile_name": self.name, "tabs": [tab("summary", "\u0418\u0442\u043e\u0433", [column("status", "\u0421\u0442\u0430\u0442\u0443\u0441", "string", 520)], [{"status": status}])], "active_tab_id": "summary"}
