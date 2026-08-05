from __future__ import annotations

from datetime import datetime, timedelta
import math
import re
from typing import Any, Dict, Optional

from sqlalchemy import text

from app.console_plugins import ConsoleExecutorPlugin
from app.console_plugins._graph_analysis_utils import column, graph_payload, node_id, node_label, selected_node_ids, tab
from app.database import AsyncSessionLocal
from app.services.cell_tower_reference_provider import get_cell_tower_reference_provider_status, resolve_cell_towers
from app.services.cell_tower_reference_service import resolve_local_cell_towers
from app.services.project_cell_tower_geocoding_service import resolve_project_cell_towers
from app.services.project_domain_store import ensure_project_domain_fact_participants


def _digits(value: object) -> str:
    return re.sub(r"\D", "", str(value or ""))


def _display(value: object, fallback: str = "-") -> str:
    result = str(value or "").strip()
    return fallback if result.casefold() in {"", "null", "none", "n/a", "na", "-"} else result


def _requested_msisdns(value: object) -> list[str]:
    values = [_digits(item) for item in re.split(r"[\s,;]+", str(value or ""))]
    return [item for item in dict.fromkeys(values) if item]


def _node_msisdn(node: Dict[str, Any]) -> str:
    attributes = node.get("attributes") if isinstance(node.get("attributes"), dict) else {}
    for value in (attributes.get("msisdn"), attributes.get("phone"), attributes.get("number"), node.get("msisdn"), node.get("phone"), node_label(node)):
        candidate = _digits(value)
        if 10 <= len(candidate) <= 15:
            return candidate
    return ""


def _selected_msisdns(artifact: Optional[Dict[str, Any]], context: Optional[Dict[str, Any]]) -> list[str]:
    context_nodes = context.get("selected_nodes") if isinstance(context, dict) and isinstance(context.get("selected_nodes"), list) else []
    if context_nodes:
        nodes, selected = [item for item in context_nodes if isinstance(item, dict)], None
    else:
        nodes, _ = graph_payload(artifact)
        selected = selected_node_ids(context)
    result: list[str] = []
    for node in nodes:
        if selected is not None and node_id(node) not in selected:
            continue
        msisdn = _node_msisdn(node)
        if msisdn:
            result.append(msisdn)
    return list(dict.fromkeys(result))


def _cell_key(row: Dict[str, Any]) -> tuple[str, str, str, str]:
    return (
        _display(row.get("mcc"), ""),
        _display(row.get("mnc"), "").lstrip("0") or "0",
        _display(row.get("lac"), ""),
        _display(row.get("bs"), ""),
    )


def _format_delta(value: timedelta | None) -> str:
    if not value:
        return "0 min"
    minutes = max(0, int(value.total_seconds() // 60))
    days, minutes = divmod(minutes, 24 * 60)
    hours, minutes = divmod(minutes, 60)
    parts: list[str] = []
    if days:
        parts.append(f"{days} d")
    if hours:
        parts.append(f"{hours} h")
    if minutes or not parts:
        parts.append(f"{minutes} min")
    return " ".join(parts)


def _distance_km(left: Dict[str, Any], right: Dict[str, Any]) -> float | None:
    if left.get("latitude") is None or left.get("longitude") is None or right.get("latitude") is None or right.get("longitude") is None:
        return None
    latitude_1, longitude_1 = math.radians(float(left["latitude"])), math.radians(float(left["longitude"]))
    latitude_2, longitude_2 = math.radians(float(right["latitude"])), math.radians(float(right["longitude"]))
    a = math.sin((latitude_2 - latitude_1) / 2) ** 2 + math.cos(latitude_1) * math.cos(latitude_2) * math.sin((longitude_2 - longitude_1) / 2) ** 2
    return round(6371.0088 * 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a)), 2)


async def fetch_movement_source_rows(
    *,
    project_id: int,
    msisdns: list[str],
    date_from: datetime | None,
    date_to: datetime | None,
    limit: int,
) -> list[Dict[str, Any]]:
    bind: dict[str, Any] = {"project_id": project_id, "msisdns": msisdns, "limit": limit}
    filters = [
        "participant.project_id = :project_id",
        "participant.entity_type = 'msisdn'",
        "participant.entity_key = ANY(:msisdns)",
        "participant.fact_type IN ('location_event', 'telecom_base_station_observation')",
        """(
            (participant.fact_type = 'location_event'
             AND NULLIF(BTRIM(location.payload ->> 'lac'), '') IS NOT NULL
             AND NULLIF(BTRIM(location.payload ->> 'bs'), '') IS NOT NULL
             AND lower(BTRIM(location.payload ->> 'bs')) NOT IN ('0', 'null', 'none', 'n/a', 'na', '-'))
            OR
            (participant.fact_type = 'telecom_base_station_observation'
             AND NULLIF(BTRIM(location.payload ->> 'base_station'), '') IS NOT NULL
             AND NULLIF(BTRIM(split_part(location.payload ->> 'base_station', '/', 3)), '') IS NOT NULL
             AND NULLIF(BTRIM(split_part(location.payload ->> 'base_station', '/', 4)), '') IS NOT NULL)
        )""",
    ]
    if date_from:
        filters.append("location.occurred_at >= :date_from")
        bind["date_from"] = date_from
    if date_to:
        filters.append("location.occurred_at < :date_to_exclusive")
        bind["date_to_exclusive"] = date_to + timedelta(days=1)
    sql = """
        SELECT DISTINCT ON (
            participant.entity_key,
            location.occurred_at,
            COALESCE(location.payload ->> 'base_station', location.payload ->> 'lac', ''),
            COALESCE(location.payload ->> 'bs', '')
        )
            participant.entity_key AS msisdn,
            location.occurred_at AS event_time,
            NULLIF(BTRIM(location.payload ->> 'address'), '') AS address,
            COALESCE(
                NULLIF(BTRIM(location.payload ->> 'base_station'), ''),
                CONCAT_WS('/',
                    NULLIF(BTRIM(location.payload ->> 'mcc'), ''),
                    NULLIF(BTRIM(location.payload ->> 'mnc'), ''),
                    NULLIF(BTRIM(location.payload ->> 'lac'), ''),
                    NULLIF(BTRIM(location.payload ->> 'bs'), '')
                )
            ) AS base_station,
            COALESCE(location.payload ->> 'mcc', split_part(location.payload ->> 'base_station', '/', 1)) AS mcc,
            COALESCE(location.payload ->> 'mnc', split_part(location.payload ->> 'base_station', '/', 2)) AS mnc,
            COALESCE(location.payload ->> 'lac', split_part(location.payload ->> 'base_station', '/', 3)) AS lac,
            COALESCE(location.payload ->> 'bs', split_part(location.payload ->> 'base_station', '/', 4)) AS bs
        FROM project_domain_fact_participants AS participant
        JOIN project_domain_facts AS location ON location.id = participant.fact_id
        WHERE """ + " AND ".join(filters) + """
        ORDER BY
            participant.entity_key,
            location.occurred_at,
            COALESCE(location.payload ->> 'base_station', location.payload ->> 'lac', ''),
            COALESCE(location.payload ->> 'bs', '')
        LIMIT :limit
    """
    async with AsyncSessionLocal() as db:
        await ensure_project_domain_fact_participants(db, project_id)
        result = await db.execute(text(sql), bind)
        rows = [dict(row._mapping) for row in result.fetchall()]
        station_keys = list({str(row.get("base_station") or "").strip() for row in rows if str(row.get("base_station") or "").strip()})
        if station_keys:
            location_result = await db.execute(
                text("""
                    SELECT from_key, MIN(to_key) AS address
                    FROM project_domain_relations
                    WHERE project_id = :project_id
                      AND relation_type = 'base_station_location'
                      AND from_type = 'base_station'
                      AND from_key = ANY(:station_keys)
                    GROUP BY from_key
                """),
                {"project_id": project_id, "station_keys": station_keys},
            )
            addresses = {str(row.from_key): row.address for row in location_result.fetchall()}
            for row in rows:
                if not row.get("address"):
                    row["address"] = addresses.get(str(row.get("base_station") or "").strip())
        await db.commit()
    return rows


class MovementAnalysisExecutor(ConsoleExecutorPlugin):
    id = "movement_analysis"
    name = "\u0410\u043d\u0430\u043b\u0438\u0437 \u043f\u0435\u0440\u0435\u043c\u0435\u0449\u0435\u043d\u0438\u0439"
    description = "\u0410\u0433\u0440\u0435\u0433\u0438\u0440\u0443\u0435\u0442 \u0440\u0435\u0433\u0438\u0441\u0442\u0440\u0430\u0446\u0438\u0438 \u0432 \u0441\u043e\u0442\u043e\u0432\u043e\u0439 \u0441\u0435\u0442\u0438 \u0432 \u0441\u0442\u043e\u044f\u043d\u043a\u0438 \u0438 \u043f\u0435\u0440\u0435\u0445\u043e\u0434\u044b \u043c\u0435\u0436\u0434\u0443 \u0411\u0421, \u043f\u043e\u043a\u0430\u0437\u044b\u0432\u0430\u0435\u0442 \u043c\u0430\u0440\u0448\u0440\u0443\u0442 \u0438 \u0442\u0430\u0431\u043b\u0438\u0446\u044b."
    menu_path = "\u0410\u043d\u0430\u043b\u0438\u0437/\u0413\u0435\u043e"
    menu_order = 20
    supports_graph_selection = True
    default_limit = 2000
    timeout_seconds = 120
    params_schema = [
        {"name": "msisdn", "label": "MSISDN (\u0447\u0435\u0440\u0435\u0437 \u0437\u0430\u043f\u044f\u0442\u0443\u044e, \u0435\u0441\u043b\u0438 \u043d\u0435 \u0432\u044b\u0431\u0440\u0430\u043d \u043d\u0430 \u0433\u0440\u0430\u0444\u0435)", "type": "string", "default": "", "required": False},
        {"name": "date_from", "label": "\u041d\u0430\u0447\u0430\u043b\u043e \u043f\u0435\u0440\u0438\u043e\u0434\u0430", "type": "date", "default": "", "required": False},
        {"name": "date_to", "label": "\u041a\u043e\u043d\u0435\u0446 \u043f\u0435\u0440\u0438\u043e\u0434\u0430", "type": "date", "default": "", "required": False},
        {"name": "stay_gap_minutes", "label": "\u041f\u0430\u0443\u0437\u0430 \u0434\u043b\u044f \u0440\u0430\u0437\u0434\u0435\u043b\u0435\u043d\u0438\u044f \u0441\u0442\u043e\u044f\u043d\u043e\u043a, \u043c\u0438\u043d", "type": "integer", "default": 60, "required": False},
        {"name": "limit", "label": "\u041b\u0438\u043c\u0438\u0442 \u0441\u043e\u0431\u044b\u0442\u0438\u0439 (\u043d\u0435 \u0431\u043e\u043b\u0435\u0435 2500)", "type": "integer", "default": 2000, "required": False},
    ]

    async def execute(self, *, project_id: int, artifact: Optional[Dict[str, Any]] = None, params: Optional[Dict[str, Any]] = None, context: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
        values = params or {}
        msisdns = _requested_msisdns(values.get("msisdn")) or _selected_msisdns(artifact, context)
        if not msisdns:
            return self._empty("\u0412\u044b\u0431\u0435\u0440\u0438\u0442\u0435 \u043d\u0430 \u0433\u0440\u0430\u0444\u0435 MSISDN \u0438\u043b\u0438 \u0443\u043a\u0430\u0436\u0438\u0442\u0435 \u043d\u043e\u043c\u0435\u0440 \u0432 \u043f\u0430\u0440\u0430\u043c\u0435\u0442\u0440\u0435.")
        try:
            limit = min(2500, max(1, int(values.get("limit") or self.default_limit)))
            stay_gap_minutes = max(0, int(values.get("stay_gap_minutes") or 0))
            date_from = datetime.fromisoformat(str(values["date_from"]).strip()) if values.get("date_from") else None
            date_to = datetime.fromisoformat(str(values["date_to"]).strip()) if values.get("date_to") else None
        except ValueError:
            return self._empty("\u041f\u0440\u043e\u0432\u0435\u0440\u044c\u0442\u0435 \u0434\u0430\u0442\u044b \u0438 \u0447\u0438\u0441\u043b\u043e\u0432\u044b\u0435 \u043f\u0430\u0440\u0430\u043c\u0435\u0442\u0440\u044b.")

        source_rows = await fetch_movement_source_rows(
            project_id=project_id,
            msisdns=msisdns,
            date_from=date_from,
            date_to=date_to,
            limit=limit,
        )
        if not source_rows:
            return self._empty("\u041f\u043e \u0432\u044b\u0431\u0440\u0430\u043d\u043d\u044b\u043c \u0443\u0441\u043b\u043e\u0432\u0438\u044f\u043c \u0441\u043e\u0431\u044b\u0442\u0438\u0439 \u043b\u043e\u043a\u0430\u0446\u0438\u0439 \u043d\u0435 \u043d\u0430\u0439\u0434\u0435\u043d\u043e.")

        provider = get_cell_tower_reference_provider_status()
        external_towers = await resolve_cell_towers(source_rows) if provider.enabled else {}
        local_towers = await resolve_local_cell_towers(source_rows)
        project_towers = await resolve_project_cell_towers(project_id, source_rows)
        external_count = 0
        local_count = 0
        project_count = 0
        for row in source_rows:
            tower = external_towers.get(_cell_key(row))
            if tower:
                row.update(tower)
                row["resolved_address"] = tower.get("address") or row.get("address")
                external_count += 1
                continue
            tower = local_towers.get(_cell_key(row))
            if tower:
                row.update(tower)
                row["resolved_address"] = tower.get("address") or row.get("address")
                local_count += 1
                continue
            tower = project_towers.get(_cell_key(row))
            if tower:
                row.update(tower)
                row["resolved_address"] = tower.get("address") or row.get("address")
                project_count += 1
            else:
                row["latitude"] = None
                row["longitude"] = None
                row["resolved_address"] = row.get("address")

        stays = self._build_stays(source_rows, timedelta(minutes=stay_gap_minutes))
        moves = self._build_moves(stays)
        mapped_stays = [item for item in stays if item.get("latitude") is not None and item.get("longitude") is not None]
        points = [
            {
                "id": f"stay-{index}", "sequence": index, "msisdn": item["msisdn"],
                "event_time": item["started_at"].isoformat(), "latitude": float(item["latitude"]), "longitude": float(item["longitude"]),
                "address": _display(item.get("address")), "lac": _display(item.get("lac")), "bs": _display(item.get("bs")),
            }
            for index, item in enumerate(mapped_stays, start=1)
        ]
        source_label = (
            "external_cell_tower_reference" if external_count
            else ("local_cell_tower_reference" if local_count else ("project_cell_tower_geocoding" if project_count else "local_cell_tower_reference"))
        )
        summary_rows = []
        for msisdn in msisdns:
            events = [row for row in source_rows if row.get("msisdn") == msisdn]
            msisdn_stays = [row for row in stays if row.get("msisdn") == msisdn]
            summary_rows.append({
                "msisdn": msisdn, "events": len(events), "mapped_events": sum(1 for row in events if row.get("latitude") is not None),
                "stays": len(msisdn_stays), "moves": sum(1 for row in moves if row.get("msisdn") == msisdn),
                "first_event": events[0]["event_time"].isoformat() if events else None,
                "last_event": events[-1]["event_time"].isoformat() if events else None,
            })
        stay_rows = [
            {
                "msisdn": item["msisdn"], "started_at": item["started_at"].isoformat(), "ended_at": item["ended_at"].isoformat(),
                "duration": _format_delta(item["ended_at"] - item["started_at"]), "events": item["events"],
                "address": _display(item.get("address")), "mcc": _display(item.get("mcc")), "mnc": _display(item.get("mnc")),
                "lac": _display(item.get("lac")), "bs": _display(item.get("bs")),
                "coordinates": f"{float(item['latitude']):.6f}, {float(item['longitude']):.6f}" if item.get("latitude") is not None else "\u041d\u0435\u0442 \u043a\u043e\u043e\u0440\u0434\u0438\u043d\u0430\u0442",
            }
            for item in stays
        ]
        move_rows = [
            {
                "msisdn": item["msisdn"], "from_time": item["from_time"].isoformat(), "to_time": item["to_time"].isoformat(),
                "travel_time": _format_delta(item["to_time"] - item["from_time"]), "from_cell": item["from_cell"], "to_cell": item["to_cell"],
                "from_address": _display(item.get("from_address")), "to_address": _display(item.get("to_address")),
                "distance_km": item["distance_km"] if item["distance_km"] is not None else "-",
            }
            for item in moves
        ]
        return {
            "profile_id": self.id,
            "profile_name": self.name,
            "tabs": [
                tab("summary", "\u0418\u0442\u043e\u0433", [
                    column("msisdn", "MSISDN", "string", 150), column("events", "\u0421\u043e\u0431\u044b\u0442\u0438\u0439", "integer", 110), column("mapped_events", "\u0421 \u043a\u043e\u043e\u0440\u0434\u0438\u043d\u0430\u0442\u0430\u043c\u0438", "integer", 140),
                    column("stays", "\u0421\u0442\u043e\u044f\u043d\u043e\u043a", "integer", 110), column("moves", "\u041f\u0435\u0440\u0435\u043c\u0435\u0449\u0435\u043d\u0438\u0439", "integer", 130), column("first_event", "\u041f\u0435\u0440\u0432\u043e\u0435 \u0441\u043e\u0431\u044b\u0442\u0438\u0435", "datetime", 180), column("last_event", "\u041f\u043e\u0441\u043b\u0435\u0434\u043d\u0435\u0435 \u0441\u043e\u0431\u044b\u0442\u0438\u0435", "datetime", 180),
                ], summary_rows),
                tab("stays", "\u0421\u0442\u043e\u044f\u043d\u043a\u0438", [
                    column("msisdn", "MSISDN", "string", 150), column("started_at", "\u041d\u0430\u0447\u0430\u043b\u043e", "datetime", 180), column("ended_at", "\u041e\u043a\u043e\u043d\u0447\u0430\u043d\u0438\u0435", "datetime", 180), column("duration", "\u0414\u043b\u0438\u0442\u0435\u043b\u044c\u043d\u043e\u0441\u0442\u044c", "string", 130), column("events", "\u0424\u0430\u043a\u0442\u043e\u0432", "integer", 90), column("address", "\u0410\u0434\u0440\u0435\u0441", "string", 380), column("mcc", "MCC", "string", 70), column("mnc", "MNC", "string", 70), column("lac", "LAC", "string", 100), column("bs", "\u0411\u0421", "string", 100), column("coordinates", "\u041a\u043e\u043e\u0440\u0434\u0438\u043d\u0430\u0442\u044b", "string", 180),
                ], stay_rows),
                tab("moves", "\u041f\u0435\u0440\u0435\u043c\u0435\u0449\u0435\u043d\u0438\u044f", [
                    column("msisdn", "MSISDN", "string", 150), column("from_time", "\u0412\u044b\u0431\u044b\u043b", "datetime", 180), column("to_time", "\u041f\u0440\u0438\u0431\u044b\u043b", "datetime", 180), column("travel_time", "\u041f\u0430\u0443\u0437\u0430", "string", 120), column("from_cell", "\u041e\u0442\u043a\u0443\u0434\u0430 (\u0411\u0421)", "string", 150), column("to_cell", "\u041a\u0443\u0434\u0430 (\u0411\u0421)", "string", 150), column("distance_km", "\u0420\u0430\u0441\u0441\u0442\u043e\u044f\u043d\u0438\u0435, \u043a\u043c", "number", 130), column("from_address", "\u0410\u0434\u0440\u0435\u0441 \u043e\u0442\u043a\u0443\u0434\u0430", "string", 300), column("to_address", "\u0410\u0434\u0440\u0435\u0441 \u043a\u0443\u0434\u0430", "string", 300),
                ], move_rows),
                {"id": "map", "name": "\u041a\u0430\u0440\u0442\u0430", "view": "map", "columns": [], "rows": [], "row_count": len(points), "map_data": {"provider": source_label, "points": points, "source": {"plugin_id": self.id, "provider_id": provider.provider_id, "provider_label": provider.label, "provider_detail": provider.detail, "external_coordinates_used": external_count, "local_coordinates_used": local_count, "project_coordinates_used": project_count}}},
            ],
            "active_tab_id": "summary",
        }

    @staticmethod
    def _build_stays(rows: list[Dict[str, Any]], gap: timedelta) -> list[Dict[str, Any]]:
        result: list[Dict[str, Any]] = []
        current: Dict[str, Any] | None = None
        for row in sorted(rows, key=lambda item: (str(item.get("msisdn") or ""), item.get("event_time") or datetime.min)):
            event_time = row.get("event_time")
            if not isinstance(event_time, datetime):
                continue
            same_cell = current is not None and current["msisdn"] == row.get("msisdn") and current["cell_key"] == _cell_key(row)
            within_gap = same_cell and event_time - current["ended_at"] <= gap
            if not within_gap:
                current = {**row, "cell_key": _cell_key(row), "started_at": event_time, "ended_at": event_time, "events": 1}
                result.append(current)
            else:
                current["ended_at"] = event_time
                current["events"] += 1
                if current.get("latitude") is None and row.get("latitude") is not None:
                    current.update({key: row.get(key) for key in ("latitude", "longitude", "resolved_address", "address")})
        return result

    @staticmethod
    def _build_moves(stays: list[Dict[str, Any]]) -> list[Dict[str, Any]]:
        previous: Dict[str, Any] | None = None
        result: list[Dict[str, Any]] = []
        for stay in stays:
            if previous is not None and previous["msisdn"] == stay["msisdn"] and previous["cell_key"] != stay["cell_key"]:
                result.append({
                    "msisdn": stay["msisdn"], "from_time": previous["ended_at"], "to_time": stay["started_at"],
                    "from_cell": "/".join(part for part in previous["cell_key"] if part), "to_cell": "/".join(part for part in stay["cell_key"] if part),
                    "from_address": previous.get("resolved_address") or previous.get("address"), "to_address": stay.get("resolved_address") or stay.get("address"),
                    "distance_km": _distance_km(previous, stay),
                })
            previous = stay
        return result

    def _empty(self, status: str) -> Dict[str, Any]:
        return {"profile_id": self.id, "profile_name": self.name, "tabs": [tab("summary", "\u0418\u0442\u043e\u0433", [column("status", "\u0421\u0442\u0430\u0442\u0443\u0441", "string", 520)], [{"status": status}])], "active_tab_id": "summary"}
