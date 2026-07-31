"""Build a text report for selected MSISDN entities."""

from __future__ import annotations

from datetime import datetime, timedelta
from typing import Any, Dict, Iterable, List, Optional

from sqlalchemy import text

from app.database import AsyncSessionLocal
from plugins import PluginBase
from plugins.graph_toolkit import GraphPluginToolkit, node_label, normalize_phone, normalize_text


class MsisdnActivityReportPlugin(PluginBase):
    """Summarize cellular activity and communications for selected MSISDN nodes."""

    id = "msisdn_activity_report"
    name = "\u0421\u0432\u043e\u0434\u043a\u0430 \u043f\u043e MSISDN"
    version = "1.0.0"
    description = (
        "\u0424\u043e\u0440\u043c\u0438\u0440\u0443\u0435\u0442 \u0442\u0435\u043a\u0441\u0442\u043e\u0432\u044b\u0439 \u043e\u0442\u0447\u0451\u0442 \u043f\u043e \u043f\u0435\u0440\u0438\u043e\u0434\u0430\u043c "
        "\u0440\u0430\u0431\u043e\u0442\u044b \u0432 \u0441\u043e\u0442\u043e\u0432\u043e\u0439 \u0441\u0435\u0442\u0438 \u0438 \u043a\u043e\u043d\u0442\u0430\u043a\u0442\u0430\u043c \u0432\u044b\u0431\u0440\u0430\u043d\u043d\u044b\u0445 MSISDN."
    )
    menu_path = "\u0422\u0435\u043b\u0435\u0444\u043e\u043d\u0438\u044f/\u0410\u043d\u0430\u043b\u0438\u0437"
    input_types = ["graph"]
    output_types = ["document"]
    applicable_to = ["graph"]
    inputs = {"artifact_types": ["graph"], "selection": {"node_types": ["msisdn"], "min": 1}}
    applicable_when = {"node_types": ["msisdn"], "min_selection": 1}
    plugin_scope = "context"
    params_schema = [
        {
            "key": "pause_hours",
            "label": "\u041f\u0430\u0443\u0437\u0430 \u043c\u0435\u0436\u0434\u0443 \u043f\u0435\u0440\u0438\u043e\u0434\u0430\u043c\u0438, \u0447\u0430\u0441\u043e\u0432",
            "type": "number",
            "default": 6,
            "required": False,
            "min": 0.1,
            "max": 168,
        }
    ]

    def __init__(self) -> None:
        self.graph = GraphPluginToolkit()

    @staticmethod
    def _format_datetime(value: Any) -> str:
        if isinstance(value, datetime):
            return value.strftime("%d.%m.%Y %H:%M:%S")
        return normalize_text(value) or "\u2014"

    @staticmethod
    def _normalize_msisdn(value: Any) -> str:
        return normalize_phone(normalize_text(value))

    def _selected_msisdns(self, graph: Dict[str, Any], context: Dict[str, Any]) -> List[str]:
        data = graph.get("data") if isinstance(graph.get("data"), dict) else {}
        nodes = data.get("nodes") if isinstance(data.get("nodes"), list) else []
        selected = self.graph.selected_nodes(nodes, context)
        values: List[str] = []
        for node in selected:
            if normalize_text(node.get("type")).lower() != "msisdn":
                continue
            msisdn = self._normalize_msisdn(node_label(node))
            if msisdn and msisdn not in values:
                values.append(msisdn)
        return values

    @staticmethod
    def _build_periods(event_times: Iterable[datetime], pause_hours: float) -> List[List[datetime]]:
        threshold = timedelta(hours=pause_hours)
        periods: List[List[datetime]] = []
        for moment in sorted({item for item in event_times if isinstance(item, datetime)}):
            if not periods or moment - periods[-1][-1] >= threshold:
                periods.append([moment])
            else:
                periods[-1].append(moment)
        return periods

    async def _activity_events(self, project_id: int, msisdn: str) -> List[datetime]:
        query = text(r"""
            WITH events AS (
                SELECT fact.occurred_at AS event_time
                FROM project_domain_facts AS fact
                WHERE fact.project_id = :project_id
                  AND fact.fact_type = 'location_event'
                  AND regexp_replace(COALESCE(fact.payload ->> 'identifier_value', ''), '\D', '', 'g') = :msisdn
                  AND NULLIF(BTRIM(fact.payload ->> 'lac'), '') IS NOT NULL
                  AND NULLIF(BTRIM(fact.payload ->> 'bs'), '') IS NOT NULL
                  AND lower(BTRIM(fact.payload ->> 'bs')) NOT IN ('0', 'null', 'none', 'n/a', 'na', '-')

                UNION ALL

                SELECT fact.occurred_at AS event_time
                FROM project_domain_facts AS fact
                WHERE fact.project_id = :project_id
                  AND fact.fact_type = 'telecom_base_station_observation'
                  AND regexp_replace(COALESCE(fact.payload ->> 'msisdn', ''), '\D', '', 'g') = :msisdn
                  AND NULLIF(BTRIM(fact.payload ->> 'base_station'), '') IS NOT NULL
            )
            SELECT event_time
            FROM events
            WHERE event_time IS NOT NULL
            ORDER BY event_time ASC
        """)
        async with AsyncSessionLocal() as db:
            result = await db.execute(query, {"project_id": project_id, "msisdn": msisdn})
            return [row.event_time for row in result if isinstance(row.event_time, datetime)]

    async def _contacts(self, project_id: int, msisdn: str) -> List[Dict[str, Any]]:
        query = text(r"""
            WITH related AS (
                SELECT
                    CASE
                        WHEN regexp_replace(COALESCE(relation.from_key, ''), '\D', '', 'g') = :msisdn
                            THEN regexp_replace(COALESCE(relation.to_key, ''), '\D', '', 'g')
                        ELSE regexp_replace(COALESCE(relation.from_key, ''), '\D', '', 'g')
                    END AS contact_msisdn,
                    relation.occurred_at
                FROM project_domain_relations AS relation
                WHERE relation.project_id = :project_id
                  AND relation.relation_type = 'msisdn_communication'
                  AND (
                    regexp_replace(COALESCE(relation.from_key, ''), '\D', '', 'g') = :msisdn
                    OR regexp_replace(COALESCE(relation.to_key, ''), '\D', '', 'g') = :msisdn
                  )
            )
            SELECT
                contact_msisdn,
                COUNT(*)::integer AS connections_count,
                MIN(occurred_at) AS first_connection_at,
                MAX(occurred_at) AS last_connection_at
            FROM related
            WHERE contact_msisdn <> ''
              AND contact_msisdn <> :msisdn
            GROUP BY contact_msisdn
            ORDER BY connections_count DESC, contact_msisdn ASC
        """)
        async with AsyncSessionLocal() as db:
            result = await db.execute(query, {"project_id": project_id, "msisdn": msisdn})
            return [dict(row) for row in result.mappings().all()]

    async def execute(self, input_artifacts: List[dict], params: Optional[dict] = None) -> List[dict]:
        if not input_artifacts:
            raise ValueError("\u041d\u0443\u0436\u0435\u043d \u0430\u043a\u0442\u0438\u0432\u043d\u044b\u0439 \u0433\u0440\u0430\u0444 \u0441 \u0432\u044b\u0431\u0440\u0430\u043d\u043d\u044b\u043c\u0438 MSISDN")
        graph = input_artifacts[0]
        project_id = int(graph.get("project_id") or 0)
        if project_id <= 0:
            raise ValueError("\u0414\u043b\u044f \u043e\u0442\u0447\u0451\u0442\u0430 \u043d\u0435 \u043e\u043f\u0440\u0435\u0434\u0435\u043b\u0451\u043d \u043f\u0440\u043e\u0435\u043a\u0442")

        params_dict = params if isinstance(params, dict) else {}
        context = params_dict.get("_context") if isinstance(params_dict.get("_context"), dict) else {}
        msisdns = self._selected_msisdns(graph, context)
        if not msisdns:
            raise ValueError("\u0412\u044b\u0434\u0435\u043b\u0438\u0442\u0435 \u043d\u0430 \u0433\u0440\u0430\u0444\u0435 \u043e\u0434\u0438\u043d \u0438\u043b\u0438 \u043d\u0435\u0441\u043a\u043e\u043b\u044c\u043a\u043e \u043e\u0431\u044a\u0435\u043a\u0442\u043e\u0432 \u0442\u0438\u043f\u0430 MSISDN")
        try:
            pause_hours = float(params_dict.get("pause_hours") or 6)
        except (TypeError, ValueError) as exc:
            raise ValueError("\u0417\u0430\u0434\u0430\u0439\u0442\u0435 \u043a\u043e\u0440\u0440\u0435\u043a\u0442\u043d\u0443\u044e \u0434\u043b\u0438\u0442\u0435\u043b\u044c\u043d\u043e\u0441\u0442\u044c \u043f\u0430\u0443\u0437\u044b") from exc
        if pause_hours <= 0:
            raise ValueError("\u041f\u0430\u0443\u0437\u0430 \u043c\u0435\u0436\u0434\u0443 \u043f\u0435\u0440\u0438\u043e\u0434\u0430\u043c\u0438 \u0434\u043e\u043b\u0436\u043d\u0430 \u0431\u044b\u0442\u044c \u0431\u043e\u043b\u044c\u0448\u0435 \u043d\u0443\u043b\u044f")

        report: List[str] = [
            "# \u0421\u0432\u043e\u0434\u043a\u0430 \u043f\u043e \u0430\u0431\u043e\u043d\u0435\u043d\u0442\u0441\u043a\u0438\u043c \u043d\u043e\u043c\u0435\u0440\u0430\u043c",
            "",
            f"\u041f\u0430\u0443\u0437\u0430 \u0434\u043b\u044f \u0440\u0430\u0437\u0434\u0435\u043b\u0435\u043d\u0438\u044f \u043f\u0435\u0440\u0438\u043e\u0434\u043e\u0432: **{pause_hours:g} \u0447.**",
        ]
        metadata_rows: List[Dict[str, Any]] = []

        for msisdn in msisdns:
            events = await self._activity_events(project_id, msisdn)
            contacts = await self._contacts(project_id, msisdn)
            periods = self._build_periods(events, pause_hours)
            report.extend(["", f"## MSISDN {msisdn}"])
            if events:
                report.append(
                    f"\u041f\u0435\u0440\u0438\u043e\u0434 \u0440\u0430\u0431\u043e\u0442\u044b: **{self._format_datetime(events[0])} \u2014 {self._format_datetime(events[-1])}**."
                )
                report.append(f"\u0424\u0430\u043a\u0442\u043e\u0432 \u0440\u0435\u0433\u0438\u0441\u0442\u0440\u0430\u0446\u0438\u0438 \u0441 \u0411\u0421: **{len(events)}**.")
                report.extend(["", "### \u041d\u0435\u043f\u0440\u0435\u0440\u044b\u0432\u043d\u044b\u0435 \u043f\u0435\u0440\u0438\u043e\u0434\u044b", "", "| # | \u041d\u0430\u0447\u0430\u043b\u043e | \u041e\u043a\u043e\u043d\u0447\u0430\u043d\u0438\u0435 | \u0424\u0430\u043a\u0442\u043e\u0432 |", "| --- | --- | --- | ---: |"])
                for index, period in enumerate(periods, start=1):
                    report.append(
                        f"| {index} | {self._format_datetime(period[0])} | {self._format_datetime(period[-1])} | {len(period)} |"
                    )
            else:
                report.append("\u0424\u0430\u043a\u0442\u043e\u0432 \u0440\u0435\u0433\u0438\u0441\u0442\u0440\u0430\u0446\u0438\u0438 \u0432 \u0441\u043e\u0442\u043e\u0432\u043e\u0439 \u0441\u0435\u0442\u0438 \u0441 \u0437\u0430\u043f\u043e\u043b\u043d\u0435\u043d\u043d\u043e\u0439 \u0411\u0421 \u043d\u0435 \u043d\u0430\u0439\u0434\u0435\u043d\u043e.")

            report.extend(["", f"### \u041a\u043e\u043d\u0442\u0430\u043a\u0442\u044b ({len(contacts)})"])
            if contacts:
                report.extend(["", "| \u041d\u043e\u043c\u0435\u0440 | \u041f\u0435\u0440\u0432\u0430\u044f \u0441\u0432\u044f\u0437\u044c | \u041f\u043e\u0441\u043b\u0435\u0434\u043d\u044f\u044f \u0441\u0432\u044f\u0437\u044c | \u0421\u043e\u0435\u0434\u0438\u043d\u0435\u043d\u0438\u0439 |", "| --- | --- | --- | ---: |"])
                for contact in contacts:
                    report.append(
                        "| {contact} | {first} | {last} | {count} |".format(
                            contact=contact["contact_msisdn"],
                            first=self._format_datetime(contact.get("first_connection_at")),
                            last=self._format_datetime(contact.get("last_connection_at")),
                            count=int(contact.get("connections_count") or 0),
                        )
                    )
            else:
                report.append("\u041a\u043e\u043d\u0442\u0430\u043a\u0442\u044b \u043d\u0435 \u043d\u0430\u0439\u0434\u0435\u043d\u044b.")
            metadata_rows.append({
                "msisdn": msisdn,
                "registration_events": len(events),
                "continuous_periods": len(periods),
                "contacts": len(contacts),
            })

        stamp = datetime.now().strftime("%d.%m.%Y %H:%M:%S")
        return [{
            "type": "document",
            "name": f"\u0421\u0432\u043e\u0434\u043a\u0430 \u043f\u043e MSISDN {stamp}",
            "description": "\u041f\u0435\u0440\u0438\u043e\u0434\u044b \u0440\u0435\u0433\u0438\u0441\u0442\u0440\u0430\u0446\u0438\u0438 \u0432 \u0441\u043e\u0442\u043e\u0432\u043e\u0439 \u0441\u0435\u0442\u0438 \u0438 \u043a\u043e\u043d\u0442\u0430\u043a\u0442\u044b \u0432\u044b\u0431\u0440\u0430\u043d\u043d\u044b\u0445 MSISDN.",
            "data": {"content": "\n".join(report)},
            "metadata": {
                "source_plugin": self.id,
                "pause_hours": pause_hours,
                "msisdns": metadata_rows,
            },
        }]