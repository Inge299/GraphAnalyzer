from __future__ import annotations

from collections import Counter
from datetime import datetime, timedelta
from typing import Any, Dict, Optional

from app.console_plugins import ConsoleExecutorPlugin
from app.console_plugins._graph_analysis_utils import column, tab
from app.console_plugins.movement_analysis import _requested_msisdns, _selected_msisdns, fetch_movement_source_rows
from app.console_plugins.movement_narrative import (
    UNKNOWN_LOCALITY,
    _build_locality_periods,
    _format_datetime,
    _format_duration,
    _locality,
    _main_location,
    _usable_location_address,
)


def _parse_params(values: Dict[str, Any], default_limit: int) -> tuple[datetime | None, datetime | None, int, int]:
    limit = min(50000, max(1, int(values.get("limit") or default_limit)))
    gap_hours = max(0, int(values.get("settlement_gap_hours") or 6))
    date_from = datetime.fromisoformat(str(values["date_from"]).strip()) if values.get("date_from") else None
    date_to = datetime.fromisoformat(str(values["date_to"]).strip()) if values.get("date_to") else None
    return date_from, date_to, limit, gap_hours


def _routine_rows(msisdn: str, rows: list[Dict[str, Any]]) -> list[Dict[str, Any]]:
    grouped: dict[str, list[Dict[str, Any]]] = {}
    for row in rows:
        address = _usable_location_address(row.get("resolved_address") or row.get("address"))
        locality = _locality(address)
        if locality == UNKNOWN_LOCALITY:
            continue
        grouped.setdefault(locality, []).append(row)
    total = sum(len(items) for items in grouped.values())
    result: list[Dict[str, Any]] = []
    for locality, items in grouped.items():
        night = sum(1 for item in items if item["event_time"].hour >= 23 or item["event_time"].hour < 6)
        day = len(items) - night
        result.append({
            "msisdn": msisdn,
            "locality": locality,
            "events": len(items),
            "share_percent": round(len(items) * 100 / total, 1) if total else 0,
            "night_events": night,
            "day_events": day,
            "first_event": _format_datetime(min(item["event_time"] for item in items)),
            "last_event": _format_datetime(max(item["event_time"] for item in items)),
        })
    return sorted(result, key=lambda item: (-item["events"], item["locality"]))


def _corridor_rows(msisdn: str, periods: list[Dict[str, Any]]) -> list[Dict[str, Any]]:
    corridors: dict[tuple[str, str], Dict[str, Any]] = {}
    for left, right in zip(periods, periods[1:]):
        if left["locality"] == right["locality"]:
            continue
        key = (left["locality"], right["locality"])
        record = corridors.setdefault(key, {"msisdn": msisdn, "from_locality": key[0], "to_locality": key[1], "transitions": 0, "first": right["started_at"], "last": right["started_at"]})
        record["transitions"] += 1
        record["first"] = min(record["first"], right["started_at"])
        record["last"] = max(record["last"], right["started_at"])
    return [{**item, "first_transition": _format_datetime(item.pop("first")), "last_transition": _format_datetime(item.pop("last"))} for item in sorted(corridors.values(), key=lambda item: (-item["transitions"], item["from_locality"], item["to_locality"]))]


def _absence_rows(msisdn: str, periods: list[Dict[str, Any]], main_locality: str | None, minimum: timedelta) -> list[Dict[str, Any]]:
    if not main_locality:
        return []
    result: list[Dict[str, Any]] = []
    for item in periods:
        duration = item["ended_at"] - item["started_at"]
        if item["locality"] == main_locality or duration < minimum:
            continue
        result.append({
            "msisdn": msisdn,
            "locality": item["locality"],
            "started_at": _format_datetime(item["started_at"]),
            "ended_at": _format_datetime(item["ended_at"]),
            "duration": _format_duration(duration),
            "events": item["events"],
        })
    return result


class MovementPatternsExecutor(ConsoleExecutorPlugin):
    id = "movement_patterns"
    name = "\u0420\u0435\u0436\u0438\u043c \u0438 \u043c\u0430\u0440\u0448\u0440\u0443\u0442\u044b"
    description = "\u041f\u043e\u043a\u0430\u0437\u044b\u0432\u0430\u0435\u0442 \u0440\u0435\u0433\u0443\u043b\u044f\u0440\u043d\u044b\u0435 \u0434\u043d\u0435\u0432\u043d\u044b\u0435 \u0438 \u043d\u043e\u0447\u043d\u044b\u0435 \u043b\u043e\u043a\u0430\u0446\u0438\u0438, \u0432\u044b\u0435\u0437\u0434\u044b \u0438 \u0447\u0430\u0441\u0442\u044b\u0435 \u043c\u0430\u0440\u0448\u0440\u0443\u0442\u044b \u043c\u0435\u0436\u0434\u0443 \u043d\u0430\u0441\u0435\u043b\u0451\u043d\u043d\u044b\u043c\u0438 \u043f\u0443\u043d\u043a\u0442\u0430\u043c\u0438."
    menu_path = "\u0410\u043d\u0430\u043b\u0438\u0437/\u0413\u0435\u043e"
    menu_order = 40
    supports_graph_selection = True
    default_limit = 50000
    timeout_seconds = 120
    params_schema = [
        {"name": "msisdn", "label": "MSISDN (\u0447\u0435\u0440\u0435\u0437 \u0437\u0430\u043f\u044f\u0442\u0443\u044e, \u0435\u0441\u043b\u0438 \u043d\u0435 \u0432\u044b\u0431\u0440\u0430\u043d \u043d\u0430 \u0433\u0440\u0430\u0444\u0435)", "type": "string", "default": "", "required": False},
        {"name": "date_from", "label": "\u041d\u0430\u0447\u0430\u043b\u043e \u043f\u0435\u0440\u0438\u043e\u0434\u0430", "type": "date", "default": "", "required": False},
        {"name": "date_to", "label": "\u041a\u043e\u043d\u0435\u0446 \u043f\u0435\u0440\u0438\u043e\u0434\u0430", "type": "date", "default": "", "required": False},
        {"name": "settlement_gap_hours", "label": "\u041f\u0430\u0443\u0437\u0430 \u0434\u043b\u044f \u0440\u0430\u0437\u0434\u0435\u043b\u0435\u043d\u0438\u044f \u043f\u0435\u0440\u0438\u043e\u0434\u043e\u0432, \u0447", "type": "integer", "default": 6, "required": False},
        {"name": "absence_hours", "label": "\u041c\u0438\u043d\u0438\u043c\u0430\u043b\u044c\u043d\u0430\u044f \u0434\u043b\u0438\u0442\u0435\u043b\u044c\u043d\u043e\u0441\u0442\u044c \u0432\u044b\u0435\u0437\u0434\u0430, \u0447", "type": "integer", "default": 24, "required": False},
        {"name": "limit", "label": "\u041b\u0438\u043c\u0438\u0442 \u0441\u043e\u0431\u044b\u0442\u0438\u0439 (\u043d\u0435 \u0431\u043e\u043b\u0435\u0435 50000)", "type": "integer", "default": 50000, "required": False},
    ]

    async def execute(self, *, project_id: int, artifact: Optional[Dict[str, Any]] = None, params: Optional[Dict[str, Any]] = None, context: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
        values = params or {}
        msisdns = _requested_msisdns(values.get("msisdn")) or _selected_msisdns(artifact, context)
        if not msisdns:
            return self._empty("\u0412\u044b\u0431\u0435\u0440\u0438\u0442\u0435 \u043d\u0430 \u0433\u0440\u0430\u0444\u0435 MSISDN \u0438\u043b\u0438 \u0443\u043a\u0430\u0436\u0438\u0442\u0435 \u043d\u043e\u043c\u0435\u0440 \u0432 \u043f\u0430\u0440\u0430\u043c\u0435\u0442\u0440\u0435.")
        try:
            date_from, date_to, limit, gap_hours = _parse_params(values, self.default_limit)
            absence_hours = max(1, int(values.get("absence_hours") or 24))
        except ValueError:
            return self._empty("\u041f\u0440\u043e\u0432\u0435\u0440\u044c\u0442\u0435 \u0434\u0430\u0442\u044b \u0438 \u0447\u0438\u0441\u043b\u043e\u0432\u044b\u0435 \u043f\u0430\u0440\u0430\u043c\u0435\u0442\u0440\u044b.")
        rows = await fetch_movement_source_rows(project_id=project_id, msisdns=msisdns, date_from=date_from, date_to=date_to, limit=limit)
        if not rows:
            return self._empty("\u041f\u043e \u0432\u044b\u0431\u0440\u0430\u043d\u043d\u044b\u043c \u0443\u0441\u043b\u043e\u0432\u0438\u044f\u043c \u0441\u043e\u0431\u044b\u0442\u0438\u0439 \u043b\u043e\u043a\u0430\u0446\u0438\u0439 \u043d\u0435 \u043d\u0430\u0439\u0434\u0435\u043d\u043e.")
        routine: list[Dict[str, Any]] = []
        corridors: list[Dict[str, Any]] = []
        absences: list[Dict[str, Any]] = []
        document = ["# \u0420\u0435\u0436\u0438\u043c \u0438 \u043c\u0430\u0440\u0448\u0440\u0443\u0442\u044b"]
        for msisdn in msisdns:
            own = [item for item in rows if item.get("msisdn") == msisdn]
            periods = _build_locality_periods(own, timedelta(hours=gap_hours))
            main = _main_location(own)
            own_routine = _routine_rows(msisdn, own)
            own_corridors = _corridor_rows(msisdn, periods)
            own_absences = _absence_rows(msisdn, periods, main["locality"] if main else None, timedelta(hours=absence_hours))
            routine.extend(own_routine)
            corridors.extend(own_corridors)
            absences.extend(own_absences)
            document.extend(["", f"## MSISDN {msisdn}"])
            if main:
                document.append(f"\u041e\u0441\u043d\u043e\u0432\u043d\u043e\u0435 \u043d\u043e\u0447\u043d\u043e\u0435 \u043c\u0435\u0441\u0442\u043e: **{main['locality']}** ({main['events']} \u0440\u0435\u0433\u0438\u0441\u0442\u0440\u0430\u0446\u0438\u0439, {main['share']}%).")
            if own_corridors:
                document.append("\u0427\u0430\u0441\u0442\u044b\u0435 \u043c\u0430\u0440\u0448\u0440\u0443\u0442\u044b: " + "; ".join(f"{item['from_locality']} \u2192 {item['to_locality']} ({item['transitions']})" for item in own_corridors[:5]) + ".")
            if own_absences:
                document.append("\u0412\u044b\u044f\u0432\u043b\u0435\u043d\u044b \u0432\u044b\u0435\u0437\u0434\u044b \u0434\u043b\u0438\u0442\u0435\u043b\u044c\u043d\u043e\u0441\u0442\u044c\u044e \u043e\u0442 " + str(absence_hours) + " \u0447: " + "; ".join(f"{item['locality']} ({item['duration']})" for item in own_absences[:5]) + ".")
        document.extend(["", "_\u0412\u044b\u0432\u043e\u0434\u044b \u043e\u0441\u043d\u043e\u0432\u0430\u043d\u044b \u043d\u0430 \u0440\u0435\u0433\u0438\u0441\u0442\u0440\u0430\u0446\u0438\u044f\u0445 \u0432 \u0441\u043e\u0442\u043e\u0432\u043e\u0439 \u0441\u0435\u0442\u0438; \u043e\u043d\u0438 \u0442\u0440\u0435\u0431\u0443\u044e\u0442 \u043f\u0440\u043e\u0432\u0435\u0440\u043a\u0438 \u043f\u043e \u0438\u0441\u0445\u043e\u0434\u043d\u044b\u043c \u0434\u0430\u043d\u043d\u044b\u043c._"])
        return {
            "profile_id": self.id, "profile_name": self.name,
            "tabs": [
                tab("summary", "\u0418\u0442\u043e\u0433", [
                    column("status", "\u0421\u0442\u0430\u0442\u0443\u0441", "string", 520),
                    column("events", "\u0421\u043e\u0431\u044b\u0442\u0438\u0439 \u0441 \u0430\u0434\u0440\u0435\u0441\u043e\u043c \u0411\u0421", "integer", 180),
                    column("localities", "\u041d\u0430\u0441\u0435\u043b\u0451\u043d\u043d\u044b\u0445 \u043f\u0443\u043d\u043a\u0442\u043e\u0432", "integer", 180),
                ], [{
                    "status": "\u0420\u0435\u0433\u0443\u043b\u044f\u0440\u043d\u044b\u0445 \u043b\u043e\u043a\u0430\u0446\u0438\u0439: " + str(len(routine)) + ". \u041c\u0430\u0440\u0448\u0440\u0443\u0442\u043e\u0432: " + str(len(corridors)) + ". \u0412\u044b\u0435\u0437\u0434\u043e\u0432: " + str(len(absences)) + ".",
                    "events": sum(item["events"] for item in routine),
                    "localities": len(routine),
                }]),
                tab("routine", "\u0420\u0435\u0433\u0443\u043b\u044f\u0440\u043d\u044b\u0435 \u043b\u043e\u043a\u0430\u0446\u0438\u0438", [column("msisdn", "MSISDN", "string", 150), column("locality", "\u041d\u0430\u0441\u0435\u043b\u0451\u043d\u043d\u044b\u0439 \u043f\u0443\u043d\u043a\u0442", "string", 220), column("events", "\u0420\u0435\u0433\u0438\u0441\u0442\u0440\u0430\u0446\u0439", "integer", 120), column("share_percent", "\u0414\u043e\u043b\u044f, %", "number", 100), column("night_events", "\u041d\u043e\u0447\u043d\u044b\u0445", "integer", 110), column("day_events", "\u0414\u043d\u0435\u0432\u043d\u044b\u0445", "integer", 110), column("first_event", "\u041f\u0435\u0440\u0432\u043e\u0435", "datetime", 170), column("last_event", "\u041f\u043e\u0441\u043b\u0435\u0434\u043d\u0435\u0435", "datetime", 170)], routine),
                tab("corridors", "\u041c\u0430\u0440\u0448\u0440\u0443\u0442\u044b", [column("msisdn", "MSISDN", "string", 150), column("from_locality", "\u041e\u0442\u043a\u0443\u0434\u0430", "string", 220), column("to_locality", "\u041a\u0443\u0434\u0430", "string", 220), column("transitions", "\u041f\u0435\u0440\u0435\u0445\u043e\u0434\u043e\u0432", "integer", 110), column("first_transition", "\u041f\u0435\u0440\u0432\u044b\u0439", "datetime", 170), column("last_transition", "\u041f\u043e\u0441\u043b\u0435\u0434\u043d\u0438\u0439", "datetime", 170)], corridors),
                tab("absences", "\u0412\u044b\u0435\u0437\u0434\u044b", [column("msisdn", "MSISDN", "string", 150), column("locality", "\u041d\u0430\u0441\u0435\u043b\u0451\u043d\u043d\u044b\u0439 \u043f\u0443\u043d\u043a\u0442", "string", 220), column("started_at", "\u041d\u0430\u0447\u0430\u043b\u043e", "datetime", 170), column("ended_at", "\u041e\u043a\u043e\u043d\u0447\u0430\u043d\u0438\u0435", "datetime", 170), column("duration", "\u0414\u043b\u0438\u0442\u0435\u043b\u044c\u043d\u043e\u0441\u0442\u044c", "string", 130), column("events", "\u0420\u0435\u0433\u0438\u0441\u0442\u0440\u0430\u0446\u0438\u0439", "integer", 110)], absences),
            ], "active_tab_id": "summary",
            "derived_artifacts": [{"type": "document", "name": "\u0420\u0435\u0436\u0438\u043c \u0438 \u043c\u0430\u0440\u0448\u0440\u0443\u0442\u044b", "description": self.description, "source_plugin_id": self.id, "data": {"content": "\n".join(document)}}],
        }

    def _empty(self, status: str) -> Dict[str, Any]:
        return {"profile_id": self.id, "profile_name": self.name, "tabs": [tab("summary", "\u0418\u0442\u043e\u0433", [column("status", "\u0421\u0442\u0430\u0442\u0443\u0441", "string", 520)], [{"status": status}])], "active_tab_id": "summary"}
