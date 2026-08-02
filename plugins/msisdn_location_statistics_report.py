"""Build a location statistics document for selected MSISDN entities."""

from __future__ import annotations

from datetime import datetime
from typing import Any, Dict, List, Optional

from plugins import PluginBase
from plugins.msisdn_analysis_common import activity_events, format_datetime, location_events, period_share, selected_msisdns


class MsisdnLocationStatisticsReportPlugin(PluginBase):
    id = "msisdn_location_statistics"
    name = "Статистика локаций"
    version = "1.0.0"
    description = "Показывает используемые локации выбранных MSISDN: количество регистраций, период и долю периода работы."
    menu_path = "Телефония/БС и локации"
    input_types = ["graph"]
    output_types = ["document"]
    applicable_to = ["graph"]
    inputs = {"artifact_types": ["graph"], "selection": {"node_types": ["msisdn"], "min": 1}}
    applicable_when = {"node_types": ["msisdn"], "min_selection": 1}
    plugin_scope = "context"

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

        report: List[str] = ["# Статистика локаций"]
        metadata_rows: List[Dict[str, Any]] = []
        for msisdn in msisdns:
            events = await activity_events(project_id, msisdn)
            rows = await location_events(project_id, msisdn)
            grouped: Dict[str, List[datetime]] = {}
            for row in rows:
                moment = row.get("event_time")
                location = str(row.get("location") or "").strip()
                if location and isinstance(moment, datetime):
                    grouped.setdefault(location, []).append(moment)

            report.extend(["", f"## MSISDN {msisdn}"])
            if events:
                report.append(f"Период работы: **{format_datetime(events[0])} - {format_datetime(events[-1])}**.")
            else:
                report.append("Период работы по регистрациям с заполненной БС не определён.")
            report.extend(["", f"### Используемые локации ({len(grouped)})"])
            if grouped:
                report.extend(["", "| Локация | Фактов | Первая дата | Последняя дата | Период, % |", "| --- | ---: | --- | --- | ---: |"])
                for location, moments in sorted(grouped.items(), key=lambda item: (-len(item[1]), item[0])):
                    first, last = min(moments), max(moments)
                    report.append(f"| {location} | {len(moments)} | {format_datetime(first)} | {format_datetime(last)} | {period_share(first, last, events)} |")
            else:
                report.append("Локации с заполненными базовыми станциями не найдены.")
            metadata_rows.append({"msisdn": msisdn, "locations": len(grouped), "registration_events": len(events)})

        stamp = datetime.now().strftime("%d.%m.%Y %H:%M:%S")
        return [{
            "type": "document",
            "name": f"Статистика локаций {stamp}",
            "description": "Используемые локации выбранных MSISDN.",
            "data": {"content": "\n".join(report)},
            "metadata": {"source_plugin": self.id, "msisdns": metadata_rows},
        }]