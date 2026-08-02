"""Build a night location statistics document for selected MSISDN entities."""

from __future__ import annotations

from datetime import date, datetime, timedelta
from typing import Any, Dict, List, Optional

from plugins import PluginBase
from plugins.msisdn_analysis_common import activity_events, format_datetime, location_events, period_share, selected_msisdns


def _night_anchor(moment: datetime, night_start: int, night_end: int) -> date:
    return moment.date() - timedelta(days=1) if moment.hour < night_end else moment.date()


def _is_night(moment: datetime, night_start: int, night_end: int) -> bool:
    return moment.hour >= night_start or moment.hour < night_end


class MsisdnNightLocationStatisticsReportPlugin(PluginBase):
    id = "msisdn_night_location_statistics"
    name = "Статистика ночных локаций"
    version = "1.0.0"
    description = "Показывает ночные регистрации выбранных MSISDN по локациям и долю ночей с регистрацией."
    menu_path = "Телефония/БС и локации"
    input_types = ["graph"]
    output_types = ["document"]
    applicable_to = ["graph"]
    inputs = {"artifact_types": ["graph"], "selection": {"node_types": ["msisdn"], "min": 1}}
    applicable_when = {"node_types": ["msisdn"], "min_selection": 1}
    plugin_scope = "context"
    params_schema = [
        {"key": "night_start_hour", "label": "Начало ночного периода, часов", "type": "number", "default": 23, "required": False, "min": 0, "max": 23},
        {"key": "night_end_hour", "label": "Окончание ночного периода, часов", "type": "number", "default": 6, "required": False, "min": 0, "max": 23},
    ]

    async def execute(self, input_artifacts: List[dict], params: Optional[dict] = None) -> List[dict]:
        if not input_artifacts:
            raise ValueError("Нужен активный граф с выбранными MSISDN")
        graph = input_artifacts[0]
        project_id = int(graph.get("project_id") or 0)
        if project_id <= 0:
            raise ValueError("Для отчёта не определён проект")
        params_dict = params if isinstance(params, dict) else {}
        context = params_dict.get("_context") if isinstance(params_dict.get("_context"), dict) else {}
        msisdns = selected_msisdns(graph, context)
        if not msisdns:
            raise ValueError("Выделите на графе один или несколько объектов типа MSISDN")
        try:
            night_start = int(params_dict.get("night_start_hour") if params_dict.get("night_start_hour") is not None else 23)
            night_end = int(params_dict.get("night_end_hour") if params_dict.get("night_end_hour") is not None else 6)
        except (TypeError, ValueError) as exc:
            raise ValueError("Укажите часы ночного периода целыми числами") from exc
        if not 0 <= night_start <= 23 or not 0 <= night_end <= 23 or night_start <= night_end:
            raise ValueError("Ночной период должен пересекать полночь: начало позже окончания")

        report: List[str] = ["# Статистика ночных локаций", "", f"Ночной период: **{night_start:02d}:00 - {night_end:02d}:00**."]
        metadata_rows: List[Dict[str, Any]] = []
        for msisdn in msisdns:
            events = await activity_events(project_id, msisdn)
            rows = await location_events(project_id, msisdn)
            grouped: Dict[str, List[datetime]] = {}
            for row in rows:
                moment = row.get("event_time")
                location = str(row.get("location") or "").strip()
                if location and isinstance(moment, datetime) and _is_night(moment, night_start, night_end):
                    grouped.setdefault(location, []).append(moment)

            total_nights = 0
            if events:
                first_night = _night_anchor(events[0], night_start, night_end)
                last_night = _night_anchor(events[-1], night_start, night_end)
                total_nights = max(1, (last_night - first_night).days + 1)

            report.extend(["", f"## MSISDN {msisdn}"])
            if events:
                report.append(f"Период работы: **{format_datetime(events[0])} - {format_datetime(events[-1])}**. Ночей в периоде: **{total_nights}**.")
            else:
                report.append("Период работы по регистрациям с заполненной БС не определён.")
            report.extend(["", f"### Ночные локации ({len(grouped)})"])
            if grouped:
                report.extend(["", "| Локация | Фактов | Первая дата | Последняя дата | Период, % | Ночей с регистрацией | Ночей, % |", "| --- | ---: | --- | --- | ---: | ---: | ---: |"])
                for location, moments in sorted(grouped.items(), key=lambda item: (-len(item[1]), item[0])):
                    first, last = min(moments), max(moments)
                    nights = {_night_anchor(moment, night_start, night_end) for moment in moments}
                    night_share = f"{len(nights) * 100 / total_nights:.1f}%" if total_nights else "-"
                    report.append(f"| {location} | {len(moments)} | {format_datetime(first)} | {format_datetime(last)} | {period_share(first, last, events)} | {len(nights)} | {night_share} |")
            else:
                report.append("Ночных регистраций с заполненными базовыми станциями не найдено.")
            metadata_rows.append({"msisdn": msisdn, "night_locations": len(grouped), "nights_total": total_nights})

        stamp = datetime.now().strftime("%d.%m.%Y %H:%M:%S")
        return [{
            "type": "document",
            "name": f"Статистика ночных локаций {stamp}",
            "description": "Ночные локации выбранных MSISDN.",
            "data": {"content": "\n".join(report)},
            "metadata": {"source_plugin": self.id, "night_start_hour": night_start, "night_end_hour": night_end, "msisdns": metadata_rows},
        }]