"""Shared data access for MSISDN analysis plugins."""

from __future__ import annotations

from datetime import datetime, timedelta
from typing import Any, Dict, Iterable, List

from sqlalchemy import text

from app.database import AsyncSessionLocal
from app.services.project_domain_store import ensure_project_domain_fact_participants
from plugins.graph_toolkit import GraphPluginToolkit, node_label, normalize_phone, normalize_text


def normalize_msisdn(value: Any) -> str:
    return normalize_phone(normalize_text(value))


def selected_msisdns(graph: Dict[str, Any], context: Dict[str, Any]) -> List[str]:
    data = graph.get("data") if isinstance(graph.get("data"), dict) else {}
    nodes = data.get("nodes") if isinstance(data.get("nodes"), list) else []
    selected = GraphPluginToolkit().selected_nodes(nodes, context)
    values: List[str] = []
    for node in selected:
        if normalize_text(node.get("type")).lower() != "msisdn":
            continue
        value = normalize_msisdn(node_label(node))
        if value and value not in values:
            values.append(value)
    return values


def build_periods(event_times: Iterable[datetime], pause_hours: float) -> List[List[datetime]]:
    threshold = timedelta(hours=pause_hours)
    periods: List[List[datetime]] = []
    for moment in sorted({item for item in event_times if isinstance(item, datetime)}):
        if not periods or moment - periods[-1][-1] >= threshold:
            periods.append([moment])
        else:
            periods[-1].append(moment)
    return periods


def format_datetime(value: Any) -> str:
    if isinstance(value, datetime):
        return value.strftime("%d.%m.%Y %H:%M:%S")
    return normalize_text(value) or "-"


def format_duration(value: timedelta | None) -> str:
    if value is None:
        return "-"
    total_hours = max(0, round(value.total_seconds() / 3600))
    months, rest_hours = divmod(total_hours, 30 * 24)
    days, hours = divmod(rest_hours, 24)
    parts: List[str] = []
    if months:
        parts.append(f"{months} \u043c\u0435\u0441.")
    if days:
        parts.append(f"{days} \u0441\u0443\u0442.")
    if hours or not parts:
        parts.append(f"{hours} \u0447.")
    return " ".join(parts)


async def activity_events(project_id: int, msisdn: str) -> List[datetime]:
    query = text("""
        SELECT fact.occurred_at AS event_time
        FROM project_domain_fact_participants AS participant
        JOIN project_domain_facts AS fact ON fact.id = participant.fact_id
        WHERE participant.project_id = :project_id
          AND participant.entity_type = 'msisdn'
          AND participant.entity_key = :msisdn
          AND participant.fact_type IN ('location_event', 'telecom_base_station_observation')
          AND fact.occurred_at IS NOT NULL
          AND (
              (fact.fact_type = 'location_event'
               AND NULLIF(BTRIM(fact.payload ->> 'lac'), '') IS NOT NULL
               AND NULLIF(BTRIM(fact.payload ->> 'bs'), '') IS NOT NULL
               AND lower(BTRIM(fact.payload ->> 'bs')) NOT IN ('0', 'null', 'none', 'n/a', 'na', '-'))
              OR
              (fact.fact_type = 'telecom_base_station_observation'
               AND NULLIF(BTRIM(fact.payload ->> 'base_station'), '') IS NOT NULL)
          )
        ORDER BY fact.occurred_at ASC
    """)
    async with AsyncSessionLocal() as db:
        await ensure_project_domain_fact_participants(db, project_id)
        result = await db.execute(query, {"project_id": project_id, "msisdn": msisdn})
        rows = [row.event_time for row in result if isinstance(row.event_time, datetime)]
        await db.commit()
        return rows


async def contacts(project_id: int, msisdn: str) -> List[Dict[str, Any]]:
    query = text("""
        WITH related AS (
            SELECT relation.to_key AS contact_msisdn, relation.occurred_at
            FROM project_domain_relations AS relation
            WHERE relation.project_id = :project_id
              AND relation.relation_type = 'msisdn_communication'
              AND relation.from_type = 'msisdn'
              AND relation.from_key = :msisdn

            UNION ALL

            SELECT relation.from_key AS contact_msisdn, relation.occurred_at
            FROM project_domain_relations AS relation
            WHERE relation.project_id = :project_id
              AND relation.relation_type = 'msisdn_communication'
              AND relation.to_type = 'msisdn'
              AND relation.to_key = :msisdn
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

async def location_events(project_id: int, msisdn: str) -> List[Dict[str, Any]]:
    """Return known MSISDN registrations grouped neither by source nor import format."""

    query = text("""
        WITH location_rows AS (
            SELECT
                fact.occurred_at AS event_time,
                COALESCE(
                    NULLIF(BTRIM(fact.payload ->> 'address'), ''),
                    NULLIF(CONCAT_WS('/',
                        NULLIF(BTRIM(fact.payload ->> 'mcc'), ''),
                        NULLIF(BTRIM(fact.payload ->> 'mnc'), ''),
                        NULLIF(BTRIM(fact.payload ->> 'lac'), ''),
                        NULLIF(BTRIM(fact.payload ->> 'bs'), '')
                    ), ''),
                    'Unknown base station'
                ) AS location
            FROM project_domain_fact_participants AS participant
            JOIN project_domain_facts AS fact ON fact.id = participant.fact_id
            WHERE participant.project_id = :project_id
              AND participant.entity_type = 'msisdn'
              AND participant.entity_key = :msisdn
              AND participant.fact_type = 'location_event'
              AND fact.occurred_at IS NOT NULL
              AND NULLIF(BTRIM(fact.payload ->> 'lac'), '') IS NOT NULL
              AND NULLIF(BTRIM(fact.payload ->> 'bs'), '') IS NOT NULL
              AND lower(BTRIM(fact.payload ->> 'bs')) NOT IN ('0', 'null', 'none', 'n/a', 'na', '-')

            UNION ALL

            SELECT
                fact.occurred_at AS event_time,
                COALESCE(NULLIF(BTRIM(location_link.to_key), ''), NULLIF(BTRIM(fact.payload ->> 'base_station'), ''), 'Unknown base station') AS location
            FROM project_domain_fact_participants AS participant
            JOIN project_domain_facts AS fact ON fact.id = participant.fact_id
            LEFT JOIN project_domain_relations AS location_link
              ON location_link.project_id = fact.project_id
             AND location_link.relation_type = 'base_station_location'
             AND location_link.from_type = 'base_station'
             AND location_link.from_key = BTRIM(fact.payload ->> 'base_station')
            WHERE participant.project_id = :project_id
              AND participant.entity_type = 'msisdn'
              AND participant.entity_key = :msisdn
              AND participant.fact_type = 'telecom_base_station_observation'
              AND fact.occurred_at IS NOT NULL
              AND NULLIF(BTRIM(fact.payload ->> 'base_station'), '') IS NOT NULL
        )
        SELECT event_time, location
        FROM location_rows
        WHERE location <> ''
        ORDER BY event_time ASC
    """)
    async with AsyncSessionLocal() as db:
        await ensure_project_domain_fact_participants(db, project_id)
        result = await db.execute(query, {"project_id": project_id, "msisdn": msisdn})
        rows = [dict(row) for row in result.mappings().all()]
        await db.commit()
        return rows


def period_share(first: Any, last: Any, overall_events: List[datetime]) -> str:
    if not overall_events or not isinstance(first, datetime) or not isinstance(last, datetime):
        return "-"
    total_seconds = (overall_events[-1] - overall_events[0]).total_seconds()
    item_seconds = max(0, (last - first).total_seconds())
    if total_seconds <= 0:
        return "100.0%" if item_seconds <= 0 else "-"
    return f"{item_seconds * 100 / total_seconds:.1f}%"