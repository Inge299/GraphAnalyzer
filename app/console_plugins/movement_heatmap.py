from __future__ import annotations

from datetime import datetime
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


def _is_night(row: Dict[str, Any]) -> bool:
    value = row.get("event_time")
    return isinstance(value, datetime) and (value.hour >= 23 or value.hour < 6)


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
            "msisdns": set(),
            "first_event": None,
            "last_event": None,
            "address": "",
            "lac": "",
            "bs": "",
        })
        bucket["weight"] += 1
        bucket["msisdns"].add(str(row.get("msisdn") or ""))
        occurred_at = row.get("event_time")
        if isinstance(occurred_at, datetime):
            bucket["first_event"] = min(bucket["first_event"], occurred_at) if bucket["first_event"] else occurred_at
            bucket["last_event"] = max(bucket["last_event"], occurred_at) if bucket["last_event"] else occurred_at
        if not bucket["address"]:
            bucket["address"] = _display(row.get("resolved_address") or row.get("address"), "")
            bucket["lac"] = _display(row.get("lac"), "")
            bucket["bs"] = _display(row.get("bs"), "")
    max_weight = max((int(bucket["weight"]) for bucket in buckets.values()), default=1)
    weight_scale = log1p(max_weight)
    points: list[Dict[str, Any]] = []
    for bucket in buckets.values():
        msisdns = sorted(item for item in bucket.pop("msisdns") if item)
        bucket["msisdn"] = ", ".join(msisdns[:3]) + (" +" if len(msisdns) > 3 else "")
        bucket["heat_weight"] = round(log1p(int(bucket["weight"])) / weight_scale, 6) if weight_scale else 1.0
        bucket["event_time"] = bucket["last_event"].isoformat() if bucket["last_event"] else None
        bucket["first_event"] = bucket["first_event"].isoformat() if bucket["first_event"] else None
        bucket["last_event"] = bucket["last_event"].isoformat() if bucket["last_event"] else None
        points.append(bucket)
    return sorted(points, key=lambda item: (-int(item["weight"]), str(item.get("address") or "")))


def _map_tab(tab_id: str, name: str, rows: list[Dict[str, Any]], source: Dict[str, Any]) -> Dict[str, Any]:
    points = _heat_points(rows)
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
            "provider": source["provider"],
            "source": source,
        },
    }


class MovementHeatmapExecutor(ConsoleExecutorPlugin):
    id = "movement_heatmap"
    name = "\u0422\u0435\u043f\u043b\u043e\u0432\u044b\u0435 \u043a\u0430\u0440\u0442\u044b \u043b\u043e\u043a\u0430\u0446\u0438\u0439"
    description = "\u0410\u0433\u0440\u0435\u0433\u0438\u0440\u0443\u0435\u0442 \u0440\u0435\u0433\u0438\u0441\u0442\u0440\u0430\u0446\u0438\u0438 \u0432 \u0442\u043e\u0447\u043a\u0438 \u0438 \u043f\u043e\u043a\u0430\u0437\u044b\u0432\u0430\u0435\u0442 \u0438\u043d\u0442\u0435\u043d\u0441\u0438\u0432\u043d\u043e\u0441\u0442\u044c \u043e\u0431\u0449\u0443\u044e, \u0434\u043d\u0435\u0432\u043d\u0443\u044e, \u043d\u043e\u0447\u043d\u0443\u044e \u0438 \u043f\u043e \u0434\u043d\u044f\u043c \u043d\u0435\u0434\u0435\u043b\u0438."
    menu_path = "\u0410\u043d\u0430\u043b\u0438\u0437/\u0413\u0435\u043e"
    menu_order = 25
    supports_graph_selection = True
    default_limit = 50000
    timeout_seconds = 120
    params_schema = [
        {"name": "msisdn", "label": "MSISDN (\u0447\u0435\u0440\u0435\u0437 \u0437\u0430\u043f\u044f\u0442\u0443\u044e, \u0435\u0441\u043b\u0438 \u043d\u0435 \u0432\u044b\u0431\u0440\u0430\u043d \u043d\u0430 \u0433\u0440\u0430\u0444\u0435)", "type": "string", "default": "", "required": False},
        {"name": "date_from", "label": "\u041d\u0430\u0447\u0430\u043b\u043e \u043f\u0435\u0440\u0438\u043e\u0434\u0430", "type": "date", "default": "", "required": False},
        {"name": "date_to", "label": "\u041a\u043e\u043d\u0435\u0446 \u043f\u0435\u0440\u0438\u043e\u0434\u0430", "type": "date", "default": "", "required": False},
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
        }
        if not mapped_rows:
            return self._empty("\u0414\u043b\u044f \u0432\u044b\u0431\u0440\u0430\u043d\u043d\u044b\u0445 \u0441\u043e\u0431\u044b\u0442\u0438\u0439 \u043d\u0435\u0442 \u043a\u043e\u043e\u0440\u0434\u0438\u043d\u0430\u0442. \u0421\u043d\u0430\u0447\u0430\u043b\u0430 \u043e\u0431\u043e\u0433\u0430\u0442\u044c\u0442\u0435 \u0411\u0421 \u043f\u043e \u0430\u0434\u0440\u0435\u0441\u0430\u043c.")

        summary_rows = []
        for msisdn in msisdns:
            msisdn_rows = [row for row in rows if row.get("msisdn") == msisdn]
            msisdn_mapped = [row for row in mapped_rows if row.get("msisdn") == msisdn]
            summary_rows.append({"msisdn": msisdn, "events": len(msisdn_rows), "with_coordinates": len(msisdn_mapped), "unique_places": len(_heat_points(msisdn_mapped))})
        tabs = [
            tab("summary", "\u0418\u0442\u043e\u0433", [column("msisdn", "MSISDN", "string", 160), column("events", "\u0421\u043e\u0431\u044b\u0442\u0438\u0439", "integer", 120), column("with_coordinates", "\u0421 \u043a\u043e\u043e\u0440\u0434\u0438\u043d\u0430\u0442\u0430\u043c\u0438", "integer", 140), column("unique_places", "\u0422\u043e\u0447\u0435\u043a \u0442\u0435\u043f\u043b\u0430", "integer", 140)], summary_rows),
            _map_tab("heat_all", "\u0412\u0441\u0435 \u0441\u043e\u0431\u044b\u0442\u0438\u044f", mapped_rows, source),
            _map_tab("heat_night", "\u041d\u043e\u0447\u044c (23:00\u201306:00)", [row for row in mapped_rows if _is_night(row)], source),
            _map_tab("heat_day", "\u0414\u0435\u043d\u044c (06:00\u201323:00)", [row for row in mapped_rows if not _is_night(row)], source),
        ]
        for weekday, title in _WEEKDAYS:
            tabs.append(_map_tab(f"heat_weekday_{weekday}", title, [row for row in mapped_rows if isinstance(row.get("event_time"), datetime) and row["event_time"].weekday() == weekday], source))
        return {"profile_id": self.id, "profile_name": self.name, "tabs": tabs, "active_tab_id": "heat_all"}

    def _empty(self, status: str) -> Dict[str, Any]:
        return {"profile_id": self.id, "profile_name": self.name, "tabs": [tab("summary", "\u0418\u0442\u043e\u0433", [column("status", "\u0421\u0442\u0430\u0442\u0443\u0441", "string", 620)], [{"status": status}])], "active_tab_id": "summary"}
