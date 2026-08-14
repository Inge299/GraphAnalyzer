from __future__ import annotations

from datetime import datetime, time
from math import log1p
from typing import Any, Dict

from app.console_plugins import ConsoleExecutorPlugin
from app.console_plugins._graph_analysis_utils import column, tab
from app.console_plugins.movement_analysis import (
    _display,
    _requested_msisdns,
    _selected_msisdns,
    fetch_movement_source_rows,
    resolve_movement_coordinates,
)


_WEEKDAYS = [
    (0, "\u041f\u043e\u043d\u0435\u0434\u0435\u043b\u044c\u043d\u0438\u043a"),
    (1, "\u0412\u0442\u043e\u0440\u043d\u0438\u043a"),
    (2, "\u0421\u0440\u0435\u0434\u0430"),
    (3, "\u0427\u0435\u0442\u0432\u0435\u0440\u0433"),
    (4, "\u041f\u044f\u0442\u043d\u0438\u0446\u0430"),
    (5, "\u0421\u0443\u0431\u0431\u043e\u0442\u0430"),
    (6, "\u0412\u043e\u0441\u043a\u0440\u0435\u0441\u0435\u043d\u044c\u0435"),
]


def _parse_weekdays(value: object) -> set[int]:
    result: set[int] = set()
    for item in str(value or "").split(","):
        try:
            weekday = int(item.strip())
        except ValueError:
            continue
        if 0 <= weekday <= 6:
            result.add(weekday)
    return result


def _parse_time(value: object) -> time | None:
    source = str(value or "").strip()
    if not source:
        return None
    try:
        return time.fromisoformat(source)
    except ValueError:
        return None


def _matches_time_window(row: Dict[str, Any], time_from: time | None, time_to: time | None) -> bool:
    occurred_at = row.get("event_time")
    if not isinstance(occurred_at, datetime):
        return False
    if time_from is None and time_to is None:
        return True
    current = occurred_at.time()
    if time_from is None:
        return current <= time_to
    if time_to is None:
        return current >= time_from
    return time_from <= current <= time_to if time_from <= time_to else current >= time_from or current <= time_to


def _filter_description(
    date_from: datetime | None,
    date_to: datetime | None,
    weekdays: set[int],
    time_from: time | None,
    time_to: time | None,
) -> str:
    parts: list[str] = []
    if date_from or date_to:
        start = date_from.date().isoformat() if date_from else "\u043d\u0430\u0447\u0430\u043b\u043e \u0434\u0430\u043d\u043d\u044b\u0445"
        end = date_to.date().isoformat() if date_to else "\u043a\u043e\u043d\u0435\u0446 \u0434\u0430\u043d\u043d\u044b\u0445"
        parts.append(f"\u041f\u0435\u0440\u0438\u043e\u0434: {start} \u2014 {end}")
    if weekdays:
        titles = ", ".join(title for day, title in _WEEKDAYS if day in weekdays)
        parts.append(f"\u0414\u043d\u0438: {titles}")
    if time_from or time_to:
        start = time_from.strftime("%H:%M") if time_from else "00:00"
        end = time_to.strftime("%H:%M") if time_to else "23:59"
        parts.append(f"\u0412\u0440\u0435\u043c\u044f: {start} \u2014 {end}")
    return "; ".join(parts) or "\u0411\u0435\u0437 \u043e\u0433\u0440\u0430\u043d\u0438\u0447\u0435\u043d\u0438\u0439 \u043f\u043e \u0434\u0430\u0442\u0435 \u0438 \u0432\u0440\u0435\u043c\u0435\u043d\u0438"


def _heat_points(rows: list[Dict[str, Any]]) -> list[Dict[str, Any]]:
    buckets: dict[tuple[float, float], Dict[str, Any]] = {}
    for row in rows:
        try:
            latitude, longitude = float(row["latitude"]), float(row["longitude"])
        except (TypeError, ValueError, KeyError):
            continue
        key = (round(latitude, 6), round(longitude, 6))
        bucket = buckets.setdefault(key, {
            "id": f"heat-{len(buckets) + 1}",
            "latitude": latitude,
            "longitude": longitude,
            "weight": 0,
            "event_count": 0,
            "msisdns": set(),
            "first_event": None,
            "last_event": None,
            "address": "",
            "lac": "",
            "bs": "",
        })
        bucket["weight"] += float(row.get("location_probability") or 1.0)
        bucket["event_count"] += 1
        bucket["msisdns"].add(str(row.get("msisdn") or ""))
        occurred_at = row.get("event_time")
        if isinstance(occurred_at, datetime):
            bucket["first_event"] = min(bucket["first_event"], occurred_at) if bucket["first_event"] else occurred_at
            bucket["last_event"] = max(bucket["last_event"], occurred_at) if bucket["last_event"] else occurred_at
        if not bucket["address"]:
            bucket["address"] = _display(row.get("resolved_address") or row.get("address"), "")
            bucket["lac"] = _display(row.get("lac"), "")
            bucket["bs"] = _display(row.get("bs"), "")
    max_weight = max((float(bucket["weight"]) for bucket in buckets.values()), default=1.0)
    weight_scale = log1p(max_weight)
    points: list[Dict[str, Any]] = []
    for bucket in buckets.values():
        msisdns = sorted(item for item in bucket.pop("msisdns") if item)
        bucket["msisdn"] = ", ".join(msisdns[:3]) + (" +" if len(msisdns) > 3 else "")
        bucket["heat_weight"] = round(log1p(float(bucket["weight"])) / weight_scale, 6) if weight_scale else 1.0
        bucket["event_time"] = bucket["last_event"].isoformat() if bucket["last_event"] else None
        bucket["first_event"] = bucket["first_event"].isoformat() if bucket["first_event"] else None
        bucket["last_event"] = bucket["last_event"].isoformat() if bucket["last_event"] else None
        points.append(bucket)
    return sorted(points, key=lambda item: (-float(item["weight"]), str(item.get("address") or "")))


def _map_tab(tab_id: str, name: str, rows: list[Dict[str, Any]], source: Dict[str, Any]) -> Dict[str, Any]:
    points = _heat_points(rows)
    filter_points = [
        {
            "id": f"event-{index}",
            "latitude": row.get("latitude"),
            "longitude": row.get("longitude"),
            "event_time": row["event_time"].isoformat() if isinstance(row.get("event_time"), datetime) else None,
            "location_probability": row.get("location_probability") or 1.0,
            "msisdn": row.get("msisdn"),
            "address": row.get("resolved_address") or row.get("address"),
            "lac": row.get("lac"),
            "bs": row.get("bs"),
        }
        for index, row in enumerate(rows)
    ]
    return {
        "id": tab_id,
        "name": name,
        "view": "map",
        "columns": [],
        "rows": [],
        "row_count": len(points),
        "map_data": {
            "render_mode": "heatmap",
            "points": points,
            "filter_points": filter_points,
            "provider": source["provider"],
            "source": source,
        },
    }


class MovementHeatmapExecutor(ConsoleExecutorPlugin):
    id = "movement_heatmap"
    name = "\u0422\u0435\u043f\u043b\u043e\u0432\u044b\u0435 \u043a\u0430\u0440\u0442\u044b \u043b\u043e\u043a\u0430\u0446\u0438\u0439"
    description = "\u0421\u0442\u0440\u043e\u0438\u0442 \u0442\u0435\u043f\u043b\u043e\u0432\u0443\u044e \u043a\u0430\u0440\u0442\u0443 \u0440\u0435\u0433\u0438\u0441\u0442\u0440\u0430\u0446\u0438\u0439 \u0441 \u0444\u0438\u043b\u044c\u0442\u0440\u0430\u043c\u0438 \u043f\u043e \u043f\u0435\u0440\u0438\u043e\u0434\u0443, \u0434\u043d\u044f\u043c \u043d\u0435\u0434\u0435\u043b\u0438 \u0438 \u0432\u0440\u0435\u043c\u0435\u043d\u0438 \u0441\u0443\u0442\u043e\u043a."
    menu_path = "\u0410\u043d\u0430\u043b\u0438\u0437/\u0413\u0435\u043e"
    menu_order = 25
    supports_graph_selection = True
    default_limit = 50000
    timeout_seconds = 120
    params_schema = [
        {"name": "msisdn", "label": "MSISDN (\u0447\u0435\u0440\u0435\u0437 \u0437\u0430\u043f\u044f\u0442\u0443\u044e, \u0435\u0441\u043b\u0438 \u043d\u0435 \u0432\u044b\u0431\u0440\u0430\u043d \u043d\u0430 \u0433\u0440\u0430\u0444\u0435)", "type": "string", "default": "", "required": False},
        {"name": "date_from", "label": "\u041d\u0430\u0447\u0430\u043b\u043e \u043f\u0435\u0440\u0438\u043e\u0434\u0430", "type": "date", "default": "", "required": False},
        {"name": "date_to", "label": "\u041a\u043e\u043d\u0435\u0446 \u043f\u0435\u0440\u0438\u043e\u0434\u0430", "type": "date", "default": "", "required": False},
        {"name": "weekdays", "label": "\u0414\u043d\u0438 \u043d\u0435\u0434\u0435\u043b\u0438", "type": "weekday_set", "default": "", "required": False},
        {"name": "time_from", "label": "\u0412\u0440\u0435\u043c\u044f \u0441", "type": "time", "default": "", "required": False},
        {"name": "time_to", "label": "\u0412\u0440\u0435\u043c\u044f \u0434\u043e", "type": "time", "default": "", "required": False},
        {"name": "limit", "label": "\u041b\u0438\u043c\u0438\u0442 \u0441\u043e\u0431\u044b\u0442\u0438\u0439 (\u043d\u0435 \u0431\u043e\u043b\u0435\u0435 50000)", "type": "integer", "default": 50000, "required": False},
    ]

    async def execute(self, *, project_id: int, artifact: Dict[str, Any] | None = None, params: Dict[str, Any] | None = None, context: Dict[str, Any] | None = None) -> Dict[str, Any]:
        values = params or {}
        msisdns = _requested_msisdns(values.get("msisdn")) or _selected_msisdns(artifact, context)
        if not msisdns:
            return self._empty("\u0412\u044b\u0431\u0435\u0440\u0438\u0442\u0435 \u043d\u0430 \u0433\u0440\u0430\u0444\u0435 MSISDN \u0438\u043b\u0438 \u0443\u043a\u0430\u0436\u0438\u0442\u0435 \u043d\u043e\u043c\u0435\u0440 \u0432 \u043f\u0430\u0440\u0430\u043c\u0435\u0442\u0440\u0435.")
        try:
            limit = min(50000, max(1, int(values.get("limit") or self.default_limit)))
            date_from = datetime.fromisoformat(str(values["date_from"]).strip()) if values.get("date_from") else None
            date_to = datetime.fromisoformat(str(values["date_to"]).strip()) if values.get("date_to") else None
            time_from = _parse_time(values.get("time_from"))
            time_to = _parse_time(values.get("time_to"))
        except ValueError:
            return self._empty("\u041f\u0440\u043e\u0432\u0435\u0440\u044c\u0442\u0435 \u0434\u0430\u0442\u044b \u0438 \u043b\u0438\u043c\u0438\u0442 \u0441\u043e\u0431\u044b\u0442\u0438\u0439.")

        rows = await fetch_movement_source_rows(project_id=project_id, msisdns=msisdns, date_from=date_from, date_to=date_to, limit=limit)
        if not rows:
            return self._empty("\u041f\u043e \u0432\u044b\u0431\u0440\u0430\u043d\u043d\u044b\u043c \u0443\u0441\u043b\u043e\u0432\u0438\u044f\u043c \u0441\u043e\u0431\u044b\u0442\u0438\u0439 \u043b\u043e\u043a\u0430\u0446\u0438\u0439 \u043d\u0435 \u043d\u0430\u0439\u0434\u0435\u043d\u043e.")
        stats = await resolve_movement_coordinates(project_id, rows)
        mapped_rows = [row for row in rows if row.get("latitude") is not None and row.get("longitude") is not None]
        source = {
            "plugin_id": self.id,
            "provider": "external_cell_tower_reference" if stats["external_count"] else ("local_cell_tower_reference" if stats["local_count"] else ("project_cell_tower_geocoding" if stats["project_count"] or stats["address_count"] else "local_cell_tower_reference")),
            "provider_id": stats["provider"].provider_id,
            "provider_label": stats["provider"].label,
            "external_coordinates_used": stats["external_count"],
            "local_coordinates_used": stats["local_count"],
            "project_coordinates_used": stats["project_count"],
            "project_address_coordinates_used": stats["address_count"],
            "filter_description": _filter_description(date_from, date_to, set(), None, None),
        }
        if not mapped_rows:
            return self._empty("\u0414\u043b\u044f \u0432\u044b\u0431\u0440\u0430\u043d\u043d\u044b\u0445 \u0441\u043e\u0431\u044b\u0442\u0438\u0439 \u043d\u0435\u0442 \u043a\u043e\u043e\u0440\u0434\u0438\u043d\u0430\u0442. \u0421\u043d\u0430\u0447\u0430\u043b\u0430 \u043e\u0431\u043e\u0433\u0430\u0442\u044c\u0442\u0435 \u0411\u0421 \u043f\u043e \u0430\u0434\u0440\u0435\u0441\u0430\u043c.")

        summary_rows = []
        for msisdn in msisdns:
            msisdn_rows = [row for row in rows if row.get("msisdn") == msisdn]
            msisdn_mapped = [row for row in mapped_rows if row.get("msisdn") == msisdn]
            summary_rows.append({"msisdn": msisdn, "events": len(msisdn_rows), "with_coordinates": len(msisdn_mapped), "unique_places": len(_heat_points(msisdn_mapped)), "filters": source["filter_description"]})
        tabs = [
            tab("summary", "\u0418\u0442\u043e\u0433", [column("msisdn", "MSISDN", "string", 160), column("events", "\u0421\u043e\u0431\u044b\u0442\u0438\u0439", "integer", 120), column("with_coordinates", "\u0421 \u043a\u043e\u043e\u0440\u0434\u0438\u043d\u0430\u0442\u0430\u043c\u0438", "integer", 140), column("unique_places", "\u0422\u043e\u0447\u0435\u043a \u0442\u0435\u043f\u043b\u0430", "integer", 140), column("filters", "\u0412\u044b\u0431\u0440\u0430\u043d\u043d\u044b\u0439 \u0441\u0440\u0435\u0437", "string", 360)], summary_rows),
            _map_tab("heatmap", "\u0422\u0435\u043f\u043b\u043e\u0432\u0430\u044f \u043a\u0430\u0440\u0442\u0430", mapped_rows, source),
        ]
        return {"profile_id": self.id, "profile_name": self.name, "tabs": tabs, "active_tab_id": "heatmap"}

    def _empty(self, status: str) -> Dict[str, Any]:
        return {"profile_id": self.id, "profile_name": self.name, "tabs": [tab("summary", "\u0418\u0442\u043e\u0433", [column("status", "\u0421\u0442\u0430\u0442\u0443\u0441", "string", 620)], [{"status": status}])], "active_tab_id": "summary"}
