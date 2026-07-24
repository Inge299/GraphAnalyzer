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


def _normalize_msisdn(value: object) -> str:
    return re.sub(r"\D", "", str(value or ""))



def _is_phone_value(value: object) -> bool:
    """Accept phone-like values only; IMS/SIP service identifiers are not contacts."""
    raw = str(value or "").strip()
    digits = _normalize_msisdn(raw)
    return bool(re.fullmatch(r"[0-9+().\s-]+", raw)) and 8 <= len(digits) <= 13


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
    return [value for value in dict.fromkeys(result) if value]


def _parse_msisdns(value: object) -> list[str]:
    candidates = re.split(r"[\s,;]+", str(value or "").strip())
    return [item for item in dict.fromkeys(_normalize_msisdn(candidate) for candidate in candidates) if item]


def _parse_weekdays(value: object) -> list[int]:
    result: list[int] = []
    for item in re.split(r"[\s,;]+", str(value or "").strip()):
        if not item:
            continue
        try:
            weekday = int(item)
        except ValueError:
            continue
        if 0 <= weekday <= 6 and weekday not in result:
            result.append(weekday)
    return result


def _as_iso(value: object) -> str:
    return value.isoformat(sep=" ", timespec="seconds") if isinstance(value, datetime) else str(value or "")


class MsisdnCommunicationsExecutor(ConsoleExecutorPlugin):
    id = "msisdn_communications"
    name = "Связи MSISDN за период"
    description = "Показывает события и наиболее активные связи выбранных номеров с фильтрами по периоду, времени суток и дням недели."
    menu_path = "Анализ/Связи"
    menu_order = 20
    supports_graph_selection = True
    params_schema = [
        {"name": "msisdn", "label": "MSISDN (через запятую, если не выбран на графе)", "type": "string", "default": "", "required": False},
        {"name": "date_from", "label": "Начало периода", "type": "date", "default": "", "required": False},
        {"name": "date_to", "label": "Конец периода", "type": "date", "default": "", "required": False},
        {"name": "hour_from", "label": "Час начала (0-23)", "type": "integer", "default": "", "required": False},
        {"name": "hour_to", "label": "Час окончания (0-23)", "type": "integer", "default": "", "required": False},
        {"name": "weekdays", "label": "Дни недели: 0=вс ... 6=сб, через запятую", "type": "string", "default": "", "required": False},
        {"name": "limit", "label": "Лимит отображения фактов (0 - все)", "type": "integer", "default": 0, "required": False},
    ]

    async def execute(
        self,
        *,
        project_id: int,
        artifact: Optional[Dict[str, Any]] = None,
        params: Optional[Dict[str, Any]] = None,
        context: Optional[Dict[str, Any]] = None,
    ) -> Dict[str, Any]:
        values = params or {}
        msisdns = _parse_msisdns(values.get("msisdn")) or _selected_msisdns(artifact, context)
        if not msisdns:
            return self._empty_result("Выберите на графе узел типа MSISDN или укажите номер в параметре.")

        try:
            requested_limit = int(values.get("limit") or 0)
        except (TypeError, ValueError):
            return self._empty_result("Лимит должен быть целым числом: 0 для всех фактов или положительное значение.")
        limit = requested_limit if requested_limit > 0 else None
        try:
            hour_from = int(values["hour_from"]) if str(values.get("hour_from") or "").strip() else None
            hour_to = int(values["hour_to"]) if str(values.get("hour_to") or "").strip() else None
        except (TypeError, ValueError):
            return self._empty_result("Часы должны быть целыми числами от 0 до 23.")
        if (hour_from is not None and not 0 <= hour_from <= 23) or (hour_to is not None and not 0 <= hour_to <= 23):
            return self._empty_result("Часы должны быть в диапазоне от 0 до 23.")

        where_parts = ["project_id = :project_id"]
        bind_values: dict[str, Any] = {"project_id": project_id, "limit": limit}
        try:
            if values.get("date_from"):
                where_parts.append("time_start >= CAST(:date_from AS TIMESTAMP)")
                bind_values["date_from"] = datetime.fromisoformat(str(values["date_from"]).strip())
            if values.get("date_to"):
                where_parts.append("time_start < CAST(:date_to AS TIMESTAMP) + INTERVAL '1 day'")
                bind_values["date_to"] = datetime.fromisoformat(str(values["date_to"]).strip())
        except ValueError:
            return self._empty_result("Даты должны быть в формате ГГГГ-ММ-ДД.")
        if hour_from is not None and hour_to is not None:
            if hour_from <= hour_to:
                where_parts.append("EXTRACT(HOUR FROM time_start) BETWEEN :hour_from AND :hour_to")
            else:
                where_parts.append("(EXTRACT(HOUR FROM time_start) >= :hour_from OR EXTRACT(HOUR FROM time_start) <= :hour_to)")
            bind_values.update({"hour_from": hour_from, "hour_to": hour_to})
        weekdays = _parse_weekdays(values.get("weekdays"))
        if weekdays:
            where_parts.append("EXTRACT(DOW FROM time_start)::INTEGER IN (" + ", ".join(str(day) for day in weekdays) + ")")

        number_placeholders = []
        for index, number in enumerate(msisdns):
            key = f"msisdn_{index}"
            number_placeholders.append(f":{key}")
            bind_values[key] = number
        selected_filter = "(" + ", ".join(number_placeholders) + ")"
        where_parts.append(
            f"(regexp_replace(abon1, '\\D', '', 'g') IN {selected_filter} OR regexp_replace(abon2, '\\D', '', 'g') IN {selected_filter})"
        )

        first_normalized = "regexp_replace(abon1, '\\D', '', 'g')"
        second_normalized = "regexp_replace(abon2, '\\D', '', 'g')"
        deduplicated_source = (
            "SELECT DISTINCT ON (LEAST(regexp_replace(abon1, '\\D', '', 'g'), regexp_replace(abon2, '\\D', '', 'g')), GREATEST(regexp_replace(abon1, '\\D', '', 'g'), regexp_replace(abon2, '\\D', '', 'g')), time_start) * FROM project_communications WHERE "
            + " AND ".join(where_parts)
            + " ORDER BY LEAST(regexp_replace(abon1, '\\D', '', 'g'), regexp_replace(abon2, '\\D', '', 'g')), GREATEST(regexp_replace(abon1, '\\D', '', 'g'), regexp_replace(abon2, '\\D', '', 'g')), time_start, total_duration DESC, time_end DESC"
        )
        facts_query = text(
            "SELECT time_start, total_duration, abon1 AS subscriber_a_raw, abon2 AS subscriber_b_raw, "
            + first_normalized + " AS subscriber_a, "
            + second_normalized + " AS subscriber_b "
            + "FROM (" + deduplicated_source + ") AS communication "
            + "ORDER BY time_start DESC NULLS LAST"
        )
        async with AsyncSessionLocal() as db:
            await ensure_project_data_tables(db)
            facts_result = await db.execute(facts_query, bind_values)
            source_rows = [dict(item._mapping) for item in facts_result.fetchall()]

        selected_msisdns = set(msisdns)
        expanded_facts: list[dict[str, Any]] = []
        statistics_by_key: dict[tuple[str, str, str], dict[str, Any]] = {}
        for row in source_rows:
            if not _is_phone_value(row.get("subscriber_a_raw")) or not _is_phone_value(row.get("subscriber_b_raw")):
                continue
            subscriber_a = str(row.get("subscriber_a") or "")
            subscriber_b = str(row.get("subscriber_b") or "")
            event_time = _as_iso(row.get("time_start"))
            duration = int(row.get("total_duration") or 0)
            requested_values: list[str] = []
            if subscriber_a in selected_msisdns:
                requested_values.append(subscriber_a)
            if subscriber_b in selected_msisdns:
                requested_values.append(subscriber_b)

            for requested_msisdn in requested_values:
                expanded_facts.append({
                    "time_start": event_time,
                    "requested_msisdn": requested_msisdn,
                    "subscriber_a": subscriber_a,
                    "subscriber_b": subscriber_b,
                    "total_duration": duration,
                })
                key = (requested_msisdn, subscriber_a, subscriber_b)
                summary = statistics_by_key.get(key)
                if summary is None:
                    summary = {
                        "requested_msisdn": requested_msisdn,
                        "subscriber_a": subscriber_a,
                        "subscriber_b": subscriber_b,
                        "connections_count": 0,
                        "total_duration": 0,
                        "first_event": event_time,
                        "last_event": event_time,
                    }
                    statistics_by_key[key] = summary
                summary["connections_count"] += 1
                summary["total_duration"] += duration
                if event_time and (not summary["first_event"] or event_time < summary["first_event"]):
                    summary["first_event"] = event_time
                if event_time and (not summary["last_event"] or event_time > summary["last_event"]):
                    summary["last_event"] = event_time

        facts = expanded_facts if limit is None else expanded_facts[:limit]
        summary_rows = sorted(
            statistics_by_key.values(),
            key=lambda item: (-int(item["connections_count"]), -int(item["total_duration"]), item["subscriber_a"], item["subscriber_b"]),
        )
        total_connections = len(source_rows)
        connection_pairs = len({(str(item.get("subscriber_a") or ""), str(item.get("subscriber_b") or "")) for item in source_rows})
        filter_rows = [{
            "status": "Выполнено",
            "msisdn": ", ".join(msisdns),
            "connections_shown": len(facts),
            "connections_total": total_connections,
            "connection_pairs": connection_pairs,
            "facts_limit": "Все" if limit is None else str(limit),
            "weekdays": ", ".join(str(item) for item in weekdays) if weekdays else "Все",
            "hours": f"{hour_from:02d}:00-{hour_to:02d}:59" if hour_from is not None and hour_to is not None else "Все",
        }]
        return {
            "profile_id": self.id,
            "profile_name": self.name,
            "tabs": [
                tab("summary", "Итог", [column("status", "Статус", "string", 160), column("msisdn", "Выбранные MSISDN", "string", 220), column("connections_shown", "Показано фактов", "integer", 130), column("connections_total", "Всего соединений", "integer", 150), column("connection_pairs", "Пар связей", "integer", 120), column("facts_limit", "Лимит фактов", "string", 120), column("weekdays", "Дни недели", "string", 140), column("hours", "Время суток", "string", 150)], filter_rows),
                tab("statistics", "Статистика соединений", [column("requested_msisdn", "Запрашиваемый абонент", "string", 190), column("subscriber_a", "Абонент A", "string", 180), column("subscriber_b", "Абонент B", "string", 180), column("connections_count", "Соединений", "integer", 120), column("total_duration", "Суммарная длительность, сек.", "integer", 190), column("first_event", "Первое соединение", "datetime", 170), column("last_event", "Последнее соединение", "datetime", 170)], summary_rows),
                tab("facts", "Факты соединений", [column("time_start", "Начало", "datetime", 170), column("requested_msisdn", "Запрашиваемый абонент", "string", 190), column("subscriber_a", "Абонент A", "string", 160), column("subscriber_b", "Абонент B", "string", 160), column("total_duration", "Длительность, сек.", "integer", 150)], facts),
            ],
            "active_tab_id": "summary",
        }
    def _empty_result(self, status: str) -> Dict[str, Any]:
        return {
            "profile_id": self.id,
            "profile_name": self.name,
            "tabs": [tab("summary", "Итог", [column("status", "Статус", "string", 480)], [{"status": status}])],
            "active_tab_id": "summary",
        }
