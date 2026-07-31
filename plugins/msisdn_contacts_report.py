"""Build a contact analysis document for selected MSISDN entities."""

from __future__ import annotations

from datetime import datetime
from typing import Any, Dict, List, Optional

from plugins import PluginBase
from plugins.msisdn_analysis_common import activity_events, contacts, format_datetime, selected_msisdns


class MsisdnContactsReportPlugin(PluginBase):
    id = "msisdn_contacts_analysis"
    name = "\u0410\u043d\u0430\u043b\u0438\u0437 \u043a\u043e\u043d\u0442\u0430\u043a\u0442\u043e\u0432"
    version = "1.0.0"
    description = "\u0412\u044b\u0432\u043e\u0434\u0438\u0442 \u043a\u043e\u043d\u0442\u0430\u043a\u0442\u044b \u0432\u044b\u0431\u0440\u0430\u043d\u043d\u044b\u0445 MSISDN \u0441 \u043f\u0435\u0440\u0438\u043e\u0434\u043e\u043c \u043e\u0431\u0449\u0435\u043d\u0438\u044f \u0438 \u043a\u043e\u043b\u0438\u0447\u0435\u0441\u0442\u0432\u043e\u043c \u0441\u043e\u0435\u0434\u0438\u043d\u0435\u043d\u0438\u0439."
    menu_path = "\u0422\u0435\u043b\u0435\u0444\u043e\u043d\u0438\u044f/\u0410\u043d\u0430\u043b\u0438\u0437"
    input_types = ["graph"]
    output_types = ["document"]
    applicable_to = ["graph"]
    inputs = {"artifact_types": ["graph"], "selection": {"node_types": ["msisdn"], "min": 1}}
    applicable_when = {"node_types": ["msisdn"], "min_selection": 1}
    plugin_scope = "context"

    @staticmethod
    def _period_share(contact: Dict[str, Any], event_times: List[datetime]) -> str:
        if not event_times:
            return "-"
        first = contact.get("first_connection_at")
        last = contact.get("last_connection_at")
        if not isinstance(first, datetime) or not isinstance(last, datetime):
            return "-"
        total_seconds = (event_times[-1] - event_times[0]).total_seconds()
        contact_seconds = max(0, (last - first).total_seconds())
        if total_seconds <= 0:
            return "100.0%" if contact_seconds <= 0 else "-"
        return f"{contact_seconds * 100 / total_seconds:.1f}%"

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

        report: List[str] = ["# \u0410\u043d\u0430\u043b\u0438\u0437 \u043a\u043e\u043d\u0442\u0430\u043a\u0442\u043e\u0432"]
        metadata_rows: List[Dict[str, Any]] = []
        for msisdn in msisdns:
            events = await activity_events(project_id, msisdn)
            rows = await contacts(project_id, msisdn)
            report.extend(["", f"## MSISDN {msisdn}"])
            if events:
                report.append(f"\u041f\u0435\u0440\u0438\u043e\u0434 \u0440\u0430\u0431\u043e\u0442\u044b: **{format_datetime(events[0])} - {format_datetime(events[-1])}**.")
            else:
                report.append("\u041f\u0435\u0440\u0438\u043e\u0434 \u0440\u0430\u0431\u043e\u0442\u044b \u043f\u043e \u0444\u0430\u043a\u0442\u0430\u043c \u0440\u0435\u0433\u0438\u0441\u0442\u0440\u0430\u0446\u0438\u0438 \u0441 \u0411\u0421 \u043d\u0435 \u043e\u043f\u0440\u0435\u0434\u0435\u043b\u0451\u043d.")
            report.extend(["", f"### \u041a\u043e\u043d\u0442\u0430\u043a\u0442\u044b ({len(rows)})"])
            if rows:
                report.extend(["", "| \u041d\u043e\u043c\u0435\u0440 | \u041f\u0435\u0440\u0432\u0430\u044f \u0441\u0432\u044f\u0437\u044c | \u041f\u043e\u0441\u043b\u0435\u0434\u043d\u044f\u044f \u0441\u0432\u044f\u0437\u044c | \u0421\u043e\u0435\u0434\u0438\u043d\u0435\u043d\u0438\u0439 | \u041f\u0435\u0440\u0438\u043e\u0434 \u043e\u0431\u0449\u0435\u043d\u0438\u044f, % |", "| --- | --- | --- | ---: | ---: |"])
                for contact in rows:
                    report.append("| {contact} | {first} | {last} | {count} | {share} |".format(
                        contact=contact["contact_msisdn"],
                        first=format_datetime(contact.get("first_connection_at")),
                        last=format_datetime(contact.get("last_connection_at")),
                        count=int(contact.get("connections_count") or 0),
                        share=self._period_share(contact, events),
                    ))
            else:
                report.append("\u041a\u043e\u043d\u0442\u0430\u043a\u0442\u044b \u043d\u0435 \u043d\u0430\u0439\u0434\u0435\u043d\u044b.")
            metadata_rows.append({"msisdn": msisdn, "contacts": len(rows), "registration_events": len(events)})

        stamp = datetime.now().strftime("%d.%m.%Y %H:%M:%S")
        return [{
            "type": "document",
            "name": f"\u0410\u043d\u0430\u043b\u0438\u0437 \u043a\u043e\u043d\u0442\u0430\u043a\u0442\u043e\u0432 {stamp}",
            "description": "\u041a\u043e\u043d\u0442\u0430\u043a\u0442\u044b \u0432\u044b\u0431\u0440\u0430\u043d\u043d\u044b\u0445 MSISDN.",
            "data": {"content": "\n".join(report)},
            "metadata": {"source_plugin": self.id, "msisdns": metadata_rows},
        }]
