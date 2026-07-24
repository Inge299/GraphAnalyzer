from __future__ import annotations

from typing import Any, Dict, Optional

from app.console_plugins._graph_analysis_utils import column
from app.console_plugins.msisdn_communications import MsisdnCommunicationsExecutor


class MostActiveLinksExecutor(MsisdnCommunicationsExecutor):
    """Ranks deduplicated communications and keeps the supporting facts in one console artifact."""

    id = "most_active_links"
    name = "\u041d\u0430\u0438\u0431\u043e\u043b\u0435\u0435 \u0430\u043a\u0442\u0438\u0432\u043d\u044b\u0435 \u0441\u0432\u044f\u0437\u0438"
    description = "\u0420\u0430\u043d\u0436\u0438\u0440\u0443\u0435\u0442 \u0441\u0432\u044f\u0437\u0438 \u0432\u044b\u0431\u0440\u0430\u043d\u043d\u044b\u0445 MSISDN \u043f\u043e \u0447\u0438\u0441\u043b\u0443 \u0443\u043d\u0438\u043a\u0430\u043b\u044c\u043d\u044b\u0445 \u0441\u043e\u0435\u0434\u0438\u043d\u0435\u043d\u0438\u0439 \u0438 \u0441\u0443\u043c\u043c\u0430\u0440\u043d\u043e\u0439 \u0434\u043b\u0438\u0442\u0435\u043b\u044c\u043d\u043e\u0441\u0442\u0438; \u043f\u043e\u043a\u0430\u0437\u044b\u0432\u0430\u0435\u0442 \u043f\u043e\u0434\u0442\u0432\u0435\u0440\u0436\u0434\u0430\u044e\u0449\u0438\u0435 \u0444\u0430\u043a\u0442\u044b."
    menu_path = "\u0410\u043d\u0430\u043b\u0438\u0437/\u0421\u0432\u044f\u0437\u0438"
    menu_order = 15

    async def execute(
        self,
        *,
        project_id: int,
        artifact: Optional[Dict[str, Any]] = None,
        params: Optional[Dict[str, Any]] = None,
        context: Optional[Dict[str, Any]] = None,
    ) -> Dict[str, Any]:
        result = await super().execute(
            project_id=project_id,
            artifact=artifact,
            params=params,
            context=context,
        )
        result["profile_id"] = self.id
        result["profile_name"] = self.name

        facts = next(
            (item.get("rows") for item in result.get("tabs", []) if item.get("id") == "facts"),
            [],
        )
        ranking_by_link: dict[tuple[str, str], dict[str, Any]] = {}
        for fact in facts if isinstance(facts, list) else []:
            requested = str(fact.get("requested_msisdn") or "")
            subscriber_a = str(fact.get("subscriber_a") or "")
            subscriber_b = str(fact.get("subscriber_b") or "")
            linked = subscriber_b if subscriber_a == requested else subscriber_a
            if not requested or not linked:
                continue
            key = (requested, linked)
            event_time = str(fact.get("time_start") or "")
            summary = ranking_by_link.setdefault(key, {
                "requested_msisdn": requested,
                "linked_msisdn": linked,
                "connections_count": 0,
                "total_duration": 0,
                "first_event": event_time,
                "last_event": event_time,
            })
            summary["connections_count"] += 1
            summary["total_duration"] += int(fact.get("total_duration") or 0)
            if event_time and (not summary["first_event"] or event_time < summary["first_event"]):
                summary["first_event"] = event_time
            if event_time and (not summary["last_event"] or event_time > summary["last_event"]):
                summary["last_event"] = event_time

        ranking_rows = sorted(
            ranking_by_link.values(),
            key=lambda row: (row["requested_msisdn"], -int(row["connections_count"]), -int(row["total_duration"]), row["linked_msisdn"]),
        )
        ranks: dict[str, int] = {}
        for row in ranking_rows:
            requested = str(row["requested_msisdn"])
            ranks[requested] = ranks.get(requested, 0) + 1
            row["rank"] = ranks[requested]

        ranking_available = False
        for item in result.get("tabs", []):
            if item.get("id") != "statistics":
                continue
            item["id"] = "ranking"
            item["name"] = "\u041d\u0430\u0438\u0431\u043e\u043b\u0435\u0435 \u0430\u043a\u0442\u0438\u0432\u043d\u044b\u0435 \u0441\u0432\u044f\u0437\u0438"
            item["columns"] = [
                column("rank", "\u0420\u0430\u043d\u0433", "integer", 80),
                column("requested_msisdn", "\u0417\u0430\u043f\u0440\u0430\u0448\u0438\u0432\u0430\u0435\u043c\u044b\u0439 MSISDN", "string", 190),
                column("linked_msisdn", "\u0421\u0432\u044f\u0437\u0430\u043d\u043d\u044b\u0439 MSISDN", "string", 190),
                column("connections_count", "\u0421\u043e\u0435\u0434\u0438\u043d\u0435\u043d\u0438\u0439", "integer", 120),
                column("total_duration", "\u0421\u0443\u043c\u043c\u0430\u0440\u043d\u0430\u044f \u0434\u043b\u0438\u0442\u0435\u043b\u044c\u043d\u043e\u0441\u0442\u044c, \u0441\u0435\u043a.", "integer", 190),
                column("first_event", "\u041f\u0435\u0440\u0432\u043e\u0435 \u0441\u043e\u0435\u0434\u0438\u043d\u0435\u043d\u0438\u0435", "datetime", 170),
                column("last_event", "\u041f\u043e\u0441\u043b\u0435\u0434\u043d\u0435\u0435 \u0441\u043e\u0435\u0434\u0438\u043d\u0435\u043d\u0438\u0435", "datetime", 170),
            ]
            item["rows"] = ranking_rows
            item["row_count"] = len(ranking_rows)
            ranking_available = True
            break

        for item in result.get("tabs", []):
            if item.get("id") == "summary":
                item["name"] = "\u0418\u0442\u043e\u0433 \u0440\u0430\u043d\u0436\u0438\u0440\u043e\u0432\u0430\u043d\u0438\u044f"
            elif item.get("id") == "facts":
                item["name"] = "\u0424\u0430\u043a\u0442\u044b \u0441\u043e\u0435\u0434\u0438\u043d\u0435\u043d\u0438\u0439"
        if ranking_available:
            result["active_tab_id"] = "ranking"
        return result