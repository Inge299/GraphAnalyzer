from __future__ import annotations

import re
from typing import Any, Dict, Optional

from app.console_plugins._graph_analysis_utils import column
from app.console_plugins.most_active_links import MostActiveLinksExecutor


def _is_foreign_contact(value: object) -> bool:
    number = re.sub(r"\D", "", str(value or ""))
    if not 8 <= len(number) <= 13:
        return False
    # Domestic numbers are 7x..., except the 77... prefix by the agreed rule.
    return re.fullmatch(r"7[0-68-9]\d*", number) is None


class ForeignContactsExecutor(MostActiveLinksExecutor):
    id = "foreign_contacts"
    name = "\u0417\u0430\u0440\u0443\u0431\u0435\u0436\u043d\u044b\u0435 \u043a\u043e\u043d\u0442\u0430\u043a\u0442\u044b"
    description = "\u0412\u044b\u0434\u0435\u043b\u044f\u0435\u0442 \u0438 \u0440\u0430\u043d\u0436\u0438\u0440\u0443\u0435\u0442 \u0437\u0430\u0440\u0443\u0431\u0435\u0436\u043d\u044b\u0435 \u043a\u043e\u043d\u0442\u0430\u043a\u0442\u044b \u0432\u044b\u0431\u0440\u0430\u043d\u043d\u044b\u0445 MSISDN \u043f\u043e \u0434\u043b\u0438\u043d\u0435 \u0438 \u043f\u0440\u0435\u0444\u0438\u043a\u0441\u0443 \u043d\u043e\u043c\u0435\u0440\u0430."
    menu_path = "\u0410\u043d\u0430\u043b\u0438\u0437/\u0421\u0432\u044f\u0437\u0438"
    menu_order = 16

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

        foreign_facts: list[dict[str, Any]] = []
        foreign_links = 0
        for item in result.get("tabs", []):
            rows = item.get("rows") if isinstance(item.get("rows"), list) else []
            if item.get("id") == "ranking":
                item["name"] = "\u0417\u0430\u0440\u0443\u0431\u0435\u0436\u043d\u044b\u0435 \u043a\u043e\u043d\u0442\u0430\u043a\u0442\u044b"
                item["rows"] = [row for row in rows if _is_foreign_contact(row.get("linked_msisdn"))]
                item["row_count"] = len(item["rows"])
                foreign_links = len(item["rows"])
            elif item.get("id") == "facts":
                for row in rows:
                    requested = str(row.get("requested_msisdn") or "")
                    subscriber_a = str(row.get("subscriber_a") or "")
                    subscriber_b = str(row.get("subscriber_b") or "")
                    linked = subscriber_b if subscriber_a == requested else subscriber_a
                    if _is_foreign_contact(linked):
                        foreign_facts.append(row)
                item["name"] = "\u0424\u0430\u043a\u0442\u044b \u0437\u0430\u0440\u0443\u0431\u0435\u0436\u043d\u044b\u0445 \u043a\u043e\u043d\u0442\u0430\u043a\u0442\u043e\u0432"
                item["rows"] = foreign_facts
                item["row_count"] = len(foreign_facts)
            elif item.get("id") == "summary":
                continue
        for item in result.get("tabs", []):
            if item.get("id") != "summary":
                continue
            rows = item.get("rows") if isinstance(item.get("rows"), list) else []
            if not rows:
                continue
            row = rows[0]
            row["connections_total"] = len(foreign_facts)
            row["connections_shown"] = len(foreign_facts)
            row["connection_pairs"] = foreign_links
            row["foreign_rule"] = "8-13 \u0446\u0438\u0444\u0440; \u043d\u0435 7x..., x \u2260 7"
            columns = item.get("columns") if isinstance(item.get("columns"), list) else []
            item["columns"] = [*columns, column("foreign_rule", "\u041f\u0440\u0430\u0432\u0438\u043b\u043e \u043e\u0442\u0431\u043e\u0440\u0430", "string", 260)]
            item["name"] = "\u0418\u0442\u043e\u0433 \u0437\u0430\u0440\u0443\u0431\u0435\u0436\u043d\u044b\u0445 \u043a\u043e\u043d\u0442\u0430\u043a\u0442\u043e\u0432"
            break
        return result
