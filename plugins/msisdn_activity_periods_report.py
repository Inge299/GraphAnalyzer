"""Build an operation periods document for selected MSISDN entities."""

from __future__ import annotations

from datetime import datetime
from typing import Any, Dict, List, Optional

from plugins import PluginBase
from plugins.msisdn_analysis_common import activity_events, build_periods, format_datetime, format_duration, selected_msisdns


class MsisdnActivityPeriodsReportPlugin(PluginBase):
    id = "msisdn_activity_periods_analysis"
    name = "\u0410\u043d\u0430\u043b\u0438\u0437 \u043f\u0435\u0440\u0438\u043e\u0434\u043e\u0432 \u0440\u0430\u0431\u043e\u0442\u044b"
    version = "1.0.0"
    description = "\u0412\u044b\u0432\u043e\u0434\u0438\u0442 \u043f\u0435\u0440\u0438\u043e\u0434\u044b \u0440\u0435\u0433\u0438\u0441\u0442\u0440\u0430\u0446\u0438\u0438 MSISDN \u0432 \u0441\u043e\u0442\u043e\u0432\u043e\u0439 \u0441\u0435\u0442\u0438 \u0438 \u043f\u0430\u0443\u0437\u044b \u043c\u0435\u0436\u0434\u0443 \u043d\u0438\u043c\u0438."
    menu_path = "\u0422\u0435\u043b\u0435\u0444\u043e\u043d\u0438\u044f/\u0410\u043d\u0430\u043b\u0438\u0437"
    input_types = ["graph"]
    output_types = ["document"]
    applicable_to = ["graph"]
    inputs = {"artifact_types": ["graph"], "selection": {"node_types": ["msisdn"], "min": 1}}
    applicable_when = {"node_types": ["msisdn"], "min_selection": 1}
    plugin_scope = "context"
    params_schema = [{
        "key": "pause_hours",
        "label": "\u041f\u0430\u0443\u0437\u0430 \u043c\u0435\u0436\u0434\u0443 \u043f\u0435\u0440\u0438\u043e\u0434\u0430\u043c\u0438, \u0447\u0430\u0441\u043e\u0432",
        "type": "number",
        "default": 6,
        "required": False,
        "min": 0.1,
        "max": 168,
    }]

    async def execute(self, input_artifacts: List[dict], params: Optional[dict] = None) -> List[dict]:
        if not input_artifacts:
            raise ValueError("\u041d\u0443\u0436\u0435\u043d \u0430\u043a\u0442\u0438\u0432\u043d\u044b\u0439 \u0433\u0440\u0430\u0444 \u0441 \u0432\u044b\u0431\u0440\u0430\u043d\u043d\u044b\u043c\u0438 MSISDN")
        graph = input_artifacts[0]
        project_id = int(graph.get("project_id") or 0)
        if project_id <= 0:
            raise ValueError("\u0414\u043b\u044f \u043e\u0442\u0447\u0451\u0442\u0430 \u043d\u0435 \u043e\u043f\u0440\u0435\u0434\u0435\u043b\u0451\u043d \u043f\u0440\u043e\u0435\u043a\u0442")
        params_dict = params if isinstance(params, dict) else {}
        context = params_dict.get("_context") if isinstance(params_dict.get("_context"), dict) else {}
        msisdns = selected_msisdns(graph, context)
        if not msisdns:
            raise ValueError("\u0412\u044b\u0434\u0435\u043b\u0438\u0442\u0435 \u043d\u0430 \u0433\u0440\u0430\u0444\u0435 \u043e\u0434\u0438\u043d \u0438\u043b\u0438 \u043d\u0435\u0441\u043a\u043e\u043b\u044c\u043a\u043e \u043e\u0431\u044a\u0435\u043a\u0442\u043e\u0432 \u0442\u0438\u043f\u0430 MSISDN")
        try:
            pause_hours = float(params_dict.get("pause_hours") or 6)
        except (TypeError, ValueError) as exc:
            raise ValueError("\u0417\u0430\u0434\u0430\u0439\u0442\u0435 \u043a\u043e\u0440\u0440\u0435\u043a\u0442\u043d\u0443\u044e \u0434\u043b\u0438\u0442\u0435\u043b\u044c\u043d\u043e\u0441\u0442\u044c \u043f\u0430\u0443\u0437\u044b") from exc
        if pause_hours <= 0:
            raise ValueError("\u041f\u0430\u0443\u0437\u0430 \u043c\u0435\u0436\u0434\u0443 \u043f\u0435\u0440\u0438\u043e\u0434\u0430\u043c\u0438 \u0434\u043e\u043b\u0436\u043d\u0430 \u0431\u044b\u0442\u044c \u0431\u043e\u043b\u044c\u0448\u0435 \u043d\u0443\u043b\u044f")

        report: List[str] = ["# \u0410\u043d\u0430\u043b\u0438\u0437 \u043f\u0435\u0440\u0438\u043e\u0434\u043e\u0432 \u0440\u0430\u0431\u043e\u0442\u044b", "", f"\u041f\u0430\u0443\u0437\u0430 \u0434\u043b\u044f \u0440\u0430\u0437\u0434\u0435\u043b\u0435\u043d\u0438\u044f \u043f\u0435\u0440\u0438\u043e\u0434\u043e\u0432: **{pause_hours:g} \u0447.**"]
        metadata_rows: List[Dict[str, Any]] = []
        for msisdn in msisdns:
            events = await activity_events(project_id, msisdn)
            periods = build_periods(events, pause_hours)
            report.extend(["", f"## MSISDN {msisdn}"])
            if not events:
                report.append("\u0424\u0430\u043a\u0442\u043e\u0432 \u0440\u0435\u0433\u0438\u0441\u0442\u0440\u0430\u0446\u0438\u0438 \u0432 \u0441\u043e\u0442\u043e\u0432\u043e\u0439 \u0441\u0435\u0442\u0438 \u0441 \u0437\u0430\u043f\u043e\u043b\u043d\u0435\u043d\u043d\u043e\u0439 \u0411\u0421 \u043d\u0435 \u043d\u0430\u0439\u0434\u0435\u043d\u043e.")
                metadata_rows.append({"msisdn": msisdn, "registration_events": 0, "continuous_periods": 0})
                continue
            report.append(f"\u041f\u0435\u0440\u0438\u043e\u0434 \u0440\u0430\u0431\u043e\u0442\u044b: **{format_datetime(events[0])} - {format_datetime(events[-1])}**.")
            report.append(f"\u0424\u0430\u043a\u0442\u043e\u0432 \u0440\u0435\u0433\u0438\u0441\u0442\u0440\u0430\u0446\u0438\u0438 \u0441 \u0411\u0421: **{len(events)}**.")
            report.extend(["", "| # | \u041d\u0430\u0447\u0430\u043b\u043e | \u041e\u043a\u043e\u043d\u0447\u0430\u043d\u0438\u0435 | \u0424\u0430\u043a\u0442\u043e\u0432 | \u0414\u043b\u0438\u0442\u0435\u043b\u044c\u043d\u043e\u0441\u0442\u044c \u0440\u0430\u0431\u043e\u0442\u044b | \u041f\u043e\u0441\u043b\u0435\u0434\u0443\u044e\u0449\u0430\u044f \u043f\u0430\u0443\u0437\u0430 |", "| --- | --- | --- | ---: | --- | --- |"])
            for index, period in enumerate(periods, start=1):
                next_period = periods[index] if index < len(periods) else None
                pause = next_period[0] - period[-1] if next_period else None
                report.append(f"| {index} | {format_datetime(period[0])} | {format_datetime(period[-1])} | {len(period)} | {format_duration(period[-1] - period[0])} | {format_duration(pause)} |")
            metadata_rows.append({"msisdn": msisdn, "registration_events": len(events), "continuous_periods": len(periods)})

        stamp = datetime.now().strftime("%d.%m.%Y %H:%M:%S")
        return [{
            "type": "document",
            "name": f"\u0410\u043d\u0430\u043b\u0438\u0437 \u043f\u0435\u0440\u0438\u043e\u0434\u043e\u0432 \u0440\u0430\u0431\u043e\u0442\u044b {stamp}",
            "description": "\u041f\u0435\u0440\u0438\u043e\u0434\u044b \u0440\u0435\u0433\u0438\u0441\u0442\u0440\u0430\u0446\u0438\u0438 \u0432 \u0441\u043e\u0442\u043e\u0432\u043e\u0439 \u0441\u0435\u0442\u0438 \u0432\u044b\u0431\u0440\u0430\u043d\u043d\u044b\u0445 MSISDN.",
            "data": {"content": "\n".join(report)},
            "metadata": {"source_plugin": self.id, "pause_hours": pause_hours, "msisdns": metadata_rows},
        }]
