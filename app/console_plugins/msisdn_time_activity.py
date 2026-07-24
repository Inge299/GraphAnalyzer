from __future__ import annotations

from collections import defaultdict
from datetime import datetime
import re
from typing import Any, Dict, Optional

from sqlalchemy import text

from app.console_plugins import ConsoleExecutorPlugin
from app.console_plugins._graph_analysis_utils import column, graph_payload, node_id, node_label, selected_node_ids, tab
from app.database import AsyncSessionLocal
from app.services.project_data_service import ensure_project_data_tables


WEEKDAY_NAMES = {
    0: "\u0412\u043e\u0441\u043a\u0440\u0435\u0441\u0435\u043d\u044c\u0435",
    1: "\u041f\u043e\u043d\u0435\u0434\u0435\u043b\u044c\u043d\u0438\u043a",
    2: "\u0412\u0442\u043e\u0440\u043d\u0438\u043a",
    3: "\u0421\u0440\u0435\u0434\u0430",
    4: "\u0427\u0435\u0442\u0432\u0435\u0440\u0433",
    5: "\u041f\u044f\u0442\u043d\u0438\u0446\u0430",
    6: "\u0421\u0443\u0431\u0431\u043e\u0442\u0430",
}


def _normalize_msisdn(value: object) -> str:
    return re.sub(r"\D", "", str(value or ""))



def _is_phone_value(value: object) -> bool:
    raw = str(value or "").strip()
    digits = _normalize_msisdn(raw)
    return bool(re.fullmatch(r"[0-9+().\s-]+", raw)) and 8 <= len(digits) <= 13


def _parse_msisdns(value: object) -> list[str]:
    values = re.split(r"[\s,;]+", str(value or "").strip())
    return [item for item in dict.fromkeys(_normalize_msisdn(candidate) for candidate in values) if item]


def _selected_msisdns(artifact: Optional[Dict[str, Any]], context: Optional[Dict[str, Any]]) -> list[str]:
    ctx = context if isinstance(context, dict) else {}
    context_nodes = ctx.get("selected_nodes") if isinstance(ctx.get("selected_nodes"), list) else []
    if context_nodes:
        nodes = [item for item in context_nodes if isinstance(item, dict)]
        selected_ids: set[str] | None = None
    else:
        nodes, _ = graph_payload(artifact)
        selected_ids = selected_node_ids(context)

    result: list[str] = []
    for node in nodes:
        if selected_ids is not None and node_id(node) not in selected_ids:
            continue
        if str(node.get("type") or "").casefold() != "msisdn":
            continue
        result.append(_normalize_msisdn(node_label(node)))
    return [item for item in dict.fromkeys(result) if item]


def _parse_weekdays(value: object) -> list[int]:
    weekdays: list[int] = []
    for item in re.split(r"[\s,;]+", str(value or "").strip()):
        try:
            weekday = int(item)
        except ValueError:
            continue
        if 0 <= weekday <= 6 and weekday not in weekdays:
            weekdays.append(weekday)
    return weekdays


def _as_datetime(value: object) -> datetime | None:
    return value if isinstance(value, datetime) else None


class MsisdnTimeActivityExecutor(ConsoleExecutorPlugin):
    id = "msisdn_time_activity"
    name = "\u0410\u043a\u0442\u0438\u0432\u043d\u043e\u0441\u0442\u044c MSISDN \u043f\u043e \u0432\u0440\u0435\u043c\u0435\u043d\u0438"
    description = "\u041f\u043e\u043a\u0430\u0437\u044b\u0432\u0430\u0435\u0442 \u0440\u0430\u0441\u043f\u0440\u0435\u0434\u0435\u043b\u0435\u043d\u0438\u0435 \u0441\u043e\u0435\u0434\u0438\u043d\u0435\u043d\u0438\u0439 \u0432\u044b\u0431\u0440\u0430\u043d\u043d\u044b\u0445 MSISDN \u043f\u043e \u0447\u0430\u0441\u0430\u043c, \u0434\u043d\u044f\u043c \u043d\u0435\u0434\u0435\u043b\u0438 \u0438 \u0434\u0430\u0442\u0430\u043c."
    menu_path = "\u0410\u043d\u0430\u043b\u0438\u0437/\u0412\u0440\u0435\u043c\u044f"
    menu_order = 10
    supports_graph_selection = True
    params_schema = [
        {"name": "msisdn", "label": "MSISDN (\u0447\u0435\u0440\u0435\u0437 \u0437\u0430\u043f\u044f\u0442\u0443\u044e, \u0435\u0441\u043b\u0438 \u043d\u0435 \u0432\u044b\u0431\u0440\u0430\u043d \u043d\u0430 \u0433\u0440\u0430\u0444\u0435)", "type": "string", "default": "", "required": False},
        {"name": "date_from", "label": "\u041d\u0430\u0447\u0430\u043b\u043e \u043f\u0435\u0440\u0438\u043e\u0434\u0430", "type": "date", "default": "", "required": False},
        {"name": "date_to", "label": "\u041a\u043e\u043d\u0435\u0446 \u043f\u0435\u0440\u0438\u043e\u0434\u0430", "type": "date", "default": "", "required": False},
        {"name": "hour_from", "label": "\u0427\u0430\u0441 \u043d\u0430\u0447\u0430\u043b\u0430 (0-23)", "type": "integer", "default": "", "required": False},
        {"name": "hour_to", "label": "\u0427\u0430\u0441 \u043e\u043a\u043e\u043d\u0447\u0430\u043d\u0438\u044f (0-23)", "type": "integer", "default": "", "required": False},
        {"name": "weekdays", "label": "\u0414\u043d\u0438 \u043d\u0435\u0434\u0435\u043b\u0438: 0=\u0432\u0441 ... 6=\u0441\u0431, \u0447\u0435\u0440\u0435\u0437 \u0437\u0430\u043f\u044f\u0442\u0443\u044e", "type": "string", "default": "", "required": False},
    ]

    async def execute(self, *, project_id: int, artifact: Optional[Dict[str, Any]] = None, params: Optional[Dict[str, Any]] = None, context: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
        values = params or {}
        msisdns = _parse_msisdns(values.get("msisdn")) or _selected_msisdns(artifact, context)
        if not msisdns:
            return self._empty_result("\u0412\u044b\u0431\u0435\u0440\u0438\u0442\u0435 \u043d\u0430 \u0433\u0440\u0430\u0444\u0435 \u0443\u0437\u0435\u043b \u0442\u0438\u043f\u0430 MSISDN \u0438\u043b\u0438 \u0443\u043a\u0430\u0436\u0438\u0442\u0435 \u043d\u043e\u043c\u0435\u0440 \u0432 \u043f\u0430\u0440\u0430\u043c\u0435\u0442\u0440\u0435.")

        try:
            hour_from = int(values["hour_from"]) if str(values.get("hour_from") or "").strip() else None
            hour_to = int(values["hour_to"]) if str(values.get("hour_to") or "").strip() else None
        except (TypeError, ValueError):
            return self._empty_result("\u0427\u0430\u0441\u044b \u0434\u043e\u043b\u0436\u043d\u044b \u0431\u044b\u0442\u044c \u0446\u0435\u043b\u044b\u043c\u0438 \u0447\u0438\u0441\u043b\u0430\u043c\u0438 \u043e\u0442 0 \u0434\u043e 23.")
        if (hour_from is None) != (hour_to is None):
            return self._empty_result("\u0423\u043a\u0430\u0436\u0438\u0442\u0435 \u043e\u0431\u0435 \u0433\u0440\u0430\u043d\u0438\u0446\u044b \u0432\u0440\u0435\u043c\u0435\u043d\u0438 \u0441\u0443\u0442\u043e\u043a.")
        if (hour_from is not None and not 0 <= hour_from <= 23) or (hour_to is not None and not 0 <= hour_to <= 23):
            return self._empty_result("\u0427\u0430\u0441\u044b \u0434\u043e\u043b\u0436\u043d\u044b \u0431\u044b\u0442\u044c \u0432 \u0434\u0438\u0430\u043f\u0430\u0437\u043e\u043d\u0435 \u043e\u0442 0 \u0434\u043e 23.")

        where_parts = ["project_id = :project_id"]
        bind_values: dict[str, Any] = {"project_id": project_id}
        try:
            if values.get("date_from"):
                where_parts.append("time_start >= CAST(:date_from AS TIMESTAMP)")
                bind_values["date_from"] = datetime.fromisoformat(str(values["date_from"]).strip())
            if values.get("date_to"):
                where_parts.append("time_start < CAST(:date_to AS TIMESTAMP) + INTERVAL '1 day'")
                bind_values["date_to"] = datetime.fromisoformat(str(values["date_to"]).strip())
        except ValueError:
            return self._empty_result("\u0414\u0430\u0442\u044b \u0434\u043e\u043b\u0436\u043d\u044b \u0431\u044b\u0442\u044c \u0432 \u0444\u043e\u0440\u043c\u0430\u0442\u0435 \u0413\u0413\u0413\u0413-\u041c\u041c-\u0414\u0414.")
        if hour_from is not None and hour_to is not None:
            if hour_from <= hour_to:
                where_parts.append("EXTRACT(HOUR FROM time_start) BETWEEN :hour_from AND :hour_to")
            else:
                where_parts.append("(EXTRACT(HOUR FROM time_start) >= :hour_from OR EXTRACT(HOUR FROM time_start) <= :hour_to)")
            bind_values.update({"hour_from": hour_from, "hour_to": hour_to})
        weekdays = _parse_weekdays(values.get("weekdays"))
        if weekdays:
            where_parts.append("EXTRACT(DOW FROM time_start)::INTEGER IN (" + ", ".join(str(day) for day in weekdays) + ")")

        placeholders = []
        for index, msisdn in enumerate(msisdns):
            key = f"msisdn_{index}"
            placeholders.append(f":{key}")
            bind_values[key] = msisdn
        selected_filter = "(" + ", ".join(placeholders) + ")"
        where_parts.append("(regexp_replace(abon1, '\\D', '', 'g') IN " + selected_filter + " OR regexp_replace(abon2, '\\D', '', 'g') IN " + selected_filter + ")")

        source_sql = (
            "SELECT DISTINCT ON (LEAST(regexp_replace(abon1, '\\D', '', 'g'), regexp_replace(abon2, '\\D', '', 'g')), GREATEST(regexp_replace(abon1, '\\D', '', 'g'), regexp_replace(abon2, '\\D', '', 'g')), time_start) time_start, total_duration, abon1 AS subscriber_a_raw, abon2 AS subscriber_b_raw, "
            "regexp_replace(abon1, '\\D', '', 'g') AS subscriber_a, "
            "regexp_replace(abon2, '\\D', '', 'g') AS subscriber_b "
            "FROM project_communications WHERE " + " AND ".join(where_parts)
            + " ORDER BY LEAST(regexp_replace(abon1, '\\D', '', 'g'), regexp_replace(abon2, '\\D', '', 'g')), GREATEST(regexp_replace(abon1, '\\D', '', 'g'), regexp_replace(abon2, '\\D', '', 'g')), time_start, total_duration DESC, time_end DESC"
        )
        async with AsyncSessionLocal() as db:
            await ensure_project_data_tables(db)
            result = await db.execute(text(source_sql), bind_values)
            source_rows = [dict(item._mapping) for item in result.fetchall()]

        selected_set = set(msisdns)
        by_hour: dict[tuple[str, int], dict[str, Any]] = defaultdict(lambda: {"connections_count": 0, "total_duration": 0})
        by_weekday: dict[tuple[str, int], dict[str, Any]] = defaultdict(lambda: {"connections_count": 0, "total_duration": 0})
        by_date: dict[tuple[str, str], dict[str, Any]] = defaultdict(lambda: {"connections_count": 0, "total_duration": 0})
        valid_source_rows = []
        for row in source_rows:
            if not _is_phone_value(row.get("subscriber_a_raw")) or not _is_phone_value(row.get("subscriber_b_raw")):
                continue
            valid_source_rows.append(row)
            event_time = _as_datetime(row.get("time_start"))
            if event_time is None:
                continue
            duration = int(row.get("total_duration") or 0)
            subscribers = {str(row.get("subscriber_a") or ""), str(row.get("subscriber_b") or "")}
            for requested_msisdn in sorted(subscribers & selected_set):
                for bucket in (by_hour[(requested_msisdn, event_time.hour)], by_weekday[(requested_msisdn, event_time.isoweekday() % 7)], by_date[(requested_msisdn, event_time.date().isoformat())]):
                    bucket["connections_count"] += 1
                    bucket["total_duration"] += duration

        hour_rows = [
            {"requested_msisdn": msisdn, "hour": hour, "time_range": f"{hour:02d}:00-{hour:02d}:59", **metrics}
            for (msisdn, hour), metrics in by_hour.items()
        ]
        weekday_rows = [
            {"requested_msisdn": msisdn, "weekday": weekday, "weekday_name": WEEKDAY_NAMES[weekday], **metrics}
            for (msisdn, weekday), metrics in by_weekday.items()
        ]
        date_rows = [
            {"requested_msisdn": msisdn, "date": date_value, **metrics}
            for (msisdn, date_value), metrics in by_date.items()
        ]
        hour_rows.sort(key=lambda row: (row["requested_msisdn"], row["hour"]))
        weekday_rows.sort(key=lambda row: (row["requested_msisdn"], row["weekday"]))
        date_rows.sort(key=lambda row: (row["requested_msisdn"], row["date"]))
        summary = [{
            "requested_msisdn": ", ".join(msisdns),
            "unique_connections": len(valid_source_rows),
            "hours_filter": f"{hour_from:02d}:00-{hour_to:02d}:59" if hour_from is not None and hour_to is not None else "\u0412\u0441\u0435",
            "weekdays_filter": ", ".join(WEEKDAY_NAMES[day] for day in weekdays) if weekdays else "\u0412\u0441\u0435",
        }]
        return {
            "profile_id": self.id,
            "profile_name": self.name,
            "tabs": [
                tab("summary", "\u0418\u0442\u043e\u0433", [column("requested_msisdn", "\u0417\u0430\u043f\u0440\u0430\u0448\u0438\u0432\u0430\u0435\u043c\u044b\u0435 MSISDN", "string", 260), column("unique_connections", "\u0423\u043d\u0438\u043a\u0430\u043b\u044c\u043d\u044b\u0445 \u0441\u043e\u0435\u0434\u0438\u043d\u0435\u043d\u0438\u0439", "integer", 180), column("hours_filter", "\u0424\u0438\u043b\u044c\u0442\u0440 \u043f\u043e \u0432\u0440\u0435\u043c\u0435\u043d\u0438", "string", 190), column("weekdays_filter", "\u0424\u0438\u043b\u044c\u0442\u0440 \u043f\u043e \u0434\u043d\u044f\u043c", "string", 240)], summary),
                tab("hours", "\u041f\u043e \u0447\u0430\u0441\u0430\u043c", [column("requested_msisdn", "\u0417\u0430\u043f\u0440\u0430\u0448\u0438\u0432\u0430\u0435\u043c\u044b\u0439 MSISDN", "string", 190), column("time_range", "\u0412\u0440\u0435\u043c\u044f", "string", 130), column("connections_count", "\u0421\u043e\u0435\u0434\u0438\u043d\u0435\u043d\u0438\u0439", "integer", 130), column("total_duration", "\u0421\u0443\u043c\u043c\u0430\u0440\u043d\u0430\u044f \u0434\u043b\u0438\u0442\u0435\u043b\u044c\u043d\u043e\u0441\u0442\u044c, \u0441\u0435\u043a.", "integer", 220)], hour_rows),
                tab("weekdays", "\u041f\u043e \u0434\u043d\u044f\u043c \u043d\u0435\u0434\u0435\u043b\u0438", [column("requested_msisdn", "\u0417\u0430\u043f\u0440\u0430\u0448\u0438\u0432\u0430\u0435\u043c\u044b\u0439 MSISDN", "string", 190), column("weekday_name", "\u0414\u0435\u043d\u044c \u043d\u0435\u0434\u0435\u043b\u0438", "string", 150), column("connections_count", "\u0421\u043e\u0435\u0434\u0438\u043d\u0435\u043d\u0438\u0439", "integer", 130), column("total_duration", "\u0421\u0443\u043c\u043c\u0430\u0440\u043d\u0430\u044f \u0434\u043b\u0438\u0442\u0435\u043b\u044c\u043d\u043e\u0441\u0442\u044c, \u0441\u0435\u043a.", "integer", 220)], weekday_rows),
                tab("dates", "\u041f\u043e \u0434\u0430\u0442\u0430\u043c", [column("requested_msisdn", "\u0417\u0430\u043f\u0440\u0430\u0448\u0438\u0432\u0430\u0435\u043c\u044b\u0439 MSISDN", "string", 190), column("date", "\u0414\u0430\u0442\u0430", "date", 130), column("connections_count", "\u0421\u043e\u0435\u0434\u0438\u043d\u0435\u043d\u0438\u0439", "integer", 130), column("total_duration", "\u0421\u0443\u043c\u043c\u0430\u0440\u043d\u0430\u044f \u0434\u043b\u0438\u0442\u0435\u043b\u044c\u043d\u043e\u0441\u0442\u044c, \u0441\u0435\u043a.", "integer", 220)], date_rows),
            ],
            "active_tab_id": "summary",
        }

    def _empty_result(self, status: str) -> Dict[str, Any]:
        return {
            "profile_id": self.id,
            "profile_name": self.name,
            "tabs": [tab("summary", "\u0418\u0442\u043e\u0433", [column("status", "\u0421\u0442\u0430\u0442\u0443\u0441", "string", 480)], [{"status": status}])],
            "active_tab_id": "summary",
        }
