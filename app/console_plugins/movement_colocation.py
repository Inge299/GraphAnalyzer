from __future__ import annotations

from collections import defaultdict, deque
from datetime import datetime, timedelta
from itertools import combinations
from typing import Any, Dict, Optional

from app.console_plugins import ConsoleExecutorPlugin
from app.console_plugins._graph_analysis_utils import column, tab
from app.console_plugins.movement_analysis import _cell_key, _requested_msisdns, _selected_msisdns, fetch_movement_source_rows
from app.console_plugins.movement_narrative import _format_datetime


def _station_name(row: Dict[str, Any]) -> str:
    return str(row.get("base_station") or "/".join(str(row.get(key) or "") for key in ("mcc", "mnc", "lac", "bs"))).strip("/")


class MovementColocationExecutor(ConsoleExecutorPlugin):
    id = "movement_colocation"
    name = "\u0421\u043e\u0432\u043c\u0435\u0441\u0442\u043d\u043e\u0435 \u043d\u0430\u0445\u043e\u0436\u0434\u0435\u043d\u0438\u0435"
    description = "\u0418\u0449\u0435\u0442 \u0441\u043e\u0432\u043f\u0430\u0434\u0435\u043d\u0438\u044f \u0440\u0435\u0433\u0438\u0441\u0442\u0440\u0430\u0446\u0438\u0439 \u0432\u044b\u0431\u0440\u0430\u043d\u043d\u044b\u0445 MSISDN \u043d\u0430 \u043e\u0434\u043d\u043e\u0439 \u0411\u0421 \u0432 \u0437\u0430\u0434\u0430\u043d\u043d\u043e\u043c \u0432\u0440\u0435\u043c\u0435\u043d\u043d\u043e\u043c \u043e\u043a\u043d\u0435."
    menu_path = "\u0410\u043d\u0430\u043b\u0438\u0437/\u0413\u0435\u043e"
    menu_order = 50
    supports_graph_selection = True
    default_limit = 2000
    timeout_seconds = 120
    params_schema = [
        {"name": "msisdn", "label": "MSISDN (\u043d\u0435 \u043c\u0435\u043d\u0435\u0435 \u0434\u0432\u0443\u0445, \u0447\u0435\u0440\u0435\u0437 \u0437\u0430\u043f\u044f\u0442\u0443\u044e)", "type": "string", "default": "", "required": False},
        {"name": "date_from", "label": "\u041d\u0430\u0447\u0430\u043b\u043e \u043f\u0435\u0440\u0438\u043e\u0434\u0430", "type": "date", "default": "", "required": False},
        {"name": "date_to", "label": "\u041a\u043e\u043d\u0435\u0446 \u043f\u0435\u0440\u0438\u043e\u0434\u0430", "type": "date", "default": "", "required": False},
        {"name": "window_minutes", "label": "\u041e\u043a\u043d\u043e \u0441\u043e\u0432\u043f\u0430\u0434\u0435\u043d\u0438\u044f, \u043c\u0438\u043d", "type": "integer", "default": 60, "required": False},
        {"name": "limit", "label": "\u041b\u0438\u043c\u0438\u0442 \u0441\u043e\u0431\u044b\u0442\u0438\u0439 (\u043d\u0435 \u0431\u043e\u043b\u0435\u0435 2500)", "type": "integer", "default": 2000, "required": False},
    ]

    async def execute(self, *, project_id: int, artifact: Optional[Dict[str, Any]] = None, params: Optional[Dict[str, Any]] = None, context: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
        values = params or {}
        msisdns = _requested_msisdns(values.get("msisdn")) or _selected_msisdns(artifact, context)
        if len(msisdns) < 2:
            return self._empty("\u0412\u044b\u0431\u0435\u0440\u0438\u0442\u0435 \u043d\u0430 \u0433\u0440\u0430\u0444\u0435 \u043a\u0430\u043a \u043c\u0438\u043d\u0438\u043c\u0443\u043c \u0434\u0432\u0430 MSISDN \u0438\u043b\u0438 \u0443\u043a\u0430\u0436\u0438\u0442\u0435 \u0438\u0445 \u0432 \u043f\u0430\u0440\u0430\u043c\u0435\u0442\u0440\u0435.")
        try:
            limit = min(2500, max(1, int(values.get("limit") or self.default_limit)))
            window = timedelta(minutes=max(1, int(values.get("window_minutes") or 60)))
            date_from = datetime.fromisoformat(str(values["date_from"]).strip()) if values.get("date_from") else None
            date_to = datetime.fromisoformat(str(values["date_to"]).strip()) if values.get("date_to") else None
        except ValueError:
            return self._empty("\u041f\u0440\u043e\u0432\u0435\u0440\u044c\u0442\u0435 \u0434\u0430\u0442\u044b \u0438 \u0447\u0438\u0441\u043b\u043e\u0432\u044b\u0435 \u043f\u0430\u0440\u0430\u043c\u0435\u0442\u0440\u044b.")
        rows = await fetch_movement_source_rows(project_id=project_id, msisdns=msisdns, date_from=date_from, date_to=date_to, limit=limit)
        recent: dict[tuple[str, str, str, str], deque[Dict[str, Any]]] = defaultdict(deque)
        matches: dict[tuple[str, str, tuple[str, str, str, str]], Dict[str, Any]] = {}
        for row in sorted(rows, key=lambda item: item.get("event_time") or datetime.min):
            stamp = row.get("event_time")
            if not isinstance(stamp, datetime):
                continue
            cell = _cell_key(row)
            bucket = recent[cell]
            while bucket and stamp - bucket[0]["event_time"] > window:
                bucket.popleft()
            for earlier in bucket:
                if earlier.get("msisdn") == row.get("msisdn"):
                    continue
                left, right = sorted((str(earlier["msisdn"]), str(row["msisdn"])))
                key = (left, right, cell)
                record = matches.setdefault(key, {"msisdn_a": left, "msisdn_b": right, "base_station": _station_name(row), "address": row.get("address") or earlier.get("address") or "-", "matches": 0, "first": stamp, "last": stamp})
                record["matches"] += 1
                record["first"] = min(record["first"], earlier["event_time"])
                record["last"] = max(record["last"], stamp)
            bucket.append(row)
        result_rows = [{**item, "first_match": _format_datetime(item.pop("first")), "last_match": _format_datetime(item.pop("last"))} for item in sorted(matches.values(), key=lambda item: (-item["matches"], item["msisdn_a"], item["msisdn_b"]))]
        report = ["# \u0421\u043e\u0432\u043c\u0435\u0441\u0442\u043d\u043e\u0435 \u043d\u0430\u0445\u043e\u0436\u0434\u0435\u043d\u0438\u0435", "", f"\u041e\u043a\u043d\u043e \u0441\u043e\u0432\u043f\u0430\u0434\u0435\u043d\u0438\u044f: **{int(window.total_seconds() // 60)} \u043c\u0438\u043d**.", "", "| MSISDN A | MSISDN B | \u0411\u0421 | \u0421\u043e\u0432\u043f\u0430\u0434\u0435\u043d\u0438\u0439 | \u041f\u0435\u0440\u0432\u043e\u0435 | \u041f\u043e\u0441\u043b\u0435\u0434\u043d\u0435\u0435 |", "| --- | --- | --- | ---: | --- | --- |"]
        report.extend(f"| {item['msisdn_a']} | {item['msisdn_b']} | {item['base_station']} | {item['matches']} | {item['first_match']} | {item['last_match']} |" for item in result_rows)
        report.extend(["", "_\u0421\u043e\u0432\u043f\u0430\u0434\u0435\u043d\u0438\u0435 \u0440\u0435\u0433\u0438\u0441\u0442\u0440\u0430\u0446\u0438\u0439 \u043d\u0430 \u0411\u0421 \u043d\u0435 \u044f\u0432\u043b\u044f\u0435\u0442\u0441\u044f \u0434\u043e\u043a\u0430\u0437\u0430\u0442\u0435\u043b\u044c\u0441\u0442\u0432\u043e\u043c \u043d\u0435\u043f\u043e\u0441\u0440\u0435\u0434\u0441\u0442\u0432\u0435\u043d\u043d\u043e\u0433\u043e \u043a\u043e\u043d\u0442\u0430\u043a\u0442\u0430._"])
        return {"profile_id": self.id, "profile_name": self.name, "tabs": [tab("matches", "\u0421\u043e\u0432\u043f\u0430\u0434\u0435\u043d\u0438\u044f", [column("msisdn_a", "MSISDN A", "string", 150), column("msisdn_b", "MSISDN B", "string", 150), column("base_station", "\u0411\u0421", "string", 180), column("address", "\u0410\u0434\u0440\u0435\u0441", "string", 350), column("matches", "\u0421\u043e\u0432\u043f\u0430\u0434\u0435\u043d\u0438\u0439", "integer", 120), column("first_match", "\u041f\u0435\u0440\u0432\u043e\u0435", "datetime", 170), column("last_match", "\u041f\u043e\u0441\u043b\u0435\u0434\u043d\u0435\u0435", "datetime", 170)], result_rows)], "active_tab_id": "matches", "derived_artifacts": [{"type": "document", "name": "\u0421\u043e\u0432\u043c\u0435\u0441\u0442\u043d\u043e\u0435 \u043d\u0430\u0445\u043e\u0436\u0434\u0435\u043d\u0438\u0435", "description": self.description, "source_plugin_id": self.id, "data": {"content": "\n".join(report)}}]}

    def _empty(self, status: str) -> Dict[str, Any]:
        return {"profile_id": self.id, "profile_name": self.name, "tabs": [tab("summary", "\u0418\u0442\u043e\u0433", [column("status", "\u0421\u0442\u0430\u0442\u0443\u0441", "string", 520)], [{"status": status}])], "active_tab_id": "summary"}
