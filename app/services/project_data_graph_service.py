from __future__ import annotations

import hashlib
import math
from typing import Any

from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.artifact import Artifact, ArtifactVersion
from app.services.project_data_service import ensure_project_data_tables

PROJECT_DATA_GRAPH_NAME = "Project data graph"
PROJECT_DATA_GRAPH_EDGE_LIMIT = 1000


def _stable_id(prefix: str, value: str) -> str:
    digest = hashlib.sha1(value.encode("utf-8", errors="ignore")).hexdigest()[:16]
    return f"{prefix}_{digest}"


def _format_graph_datetime(value: Any) -> str:
    if value is None:
        return ""
    if hasattr(value, "isoformat"):
        return value.isoformat(sep=" ", timespec="seconds")
    return str(value)


async def sync_project_data_graph_artifact(db: AsyncSession, project_id: int) -> dict[str, Any] | None:
    """Create or update a graph artifact from loaded project communications."""
    await ensure_project_data_tables(db)

    result = await db.execute(
        text(
            """
            SELECT
                abon1,
                abon2,
                SUM(calls_count)::INTEGER AS calls_count,
                MAX(contacts_count)::INTEGER AS contacts_count,
                MIN(time_start) AS period_start,
                MAX(time_end) AS period_end,
                BOOL_OR(calls_count_approx) AS calls_count_approx
            FROM project_communications
            WHERE project_id = :project_id
              AND NULLIF(BTRIM(abon1), '') IS NOT NULL
              AND NULLIF(BTRIM(abon2), '') IS NOT NULL
            GROUP BY abon1, abon2
            ORDER BY SUM(calls_count) DESC, abon1, abon2
            LIMIT :limit
            """
        ),
        {"project_id": project_id, "limit": PROJECT_DATA_GRAPH_EDGE_LIMIT},
    )
    rows = [dict(row._mapping) for row in result]
    if not rows:
        return None

    phones: list[str] = []
    seen_phones: set[str] = set()
    for row in rows:
        for key in ("abon1", "abon2"):
            phone = str(row.get(key) or "").strip()
            if phone and phone not in seen_phones:
                seen_phones.add(phone)
                phones.append(phone)

    node_count = max(1, len(phones))
    radius = max(280.0, min(2200.0, node_count * 18.0))
    nodes = []
    phone_to_id: dict[str, str] = {}
    for index, phone in enumerate(phones):
        node_id = _stable_id("abon", phone)
        phone_to_id[phone] = node_id
        angle = (2.0 * math.pi * index) / node_count
        nodes.append(
            {
                "id": node_id,
                "type": "msisdn",
                "label": phone,
                "position_x": round(radius * math.cos(angle), 1),
                "position_y": round(radius * math.sin(angle), 1),
                "attributes": {
                    "label": phone,
                    "visual": {
                        "label": phone,
                        "icon": "person_phone",
                        "color": "#2563eb",
                        "iconScale": 2,
                        "ringEnabled": False,
                        "ringWidth": 1.5,
                    },
                },
            }
        )

    edges = []
    for row in rows:
        abon1 = str(row.get("abon1") or "").strip()
        abon2 = str(row.get("abon2") or "").strip()
        from_id = phone_to_id.get(abon1)
        to_id = phone_to_id.get(abon2)
        if not from_id or not to_id or from_id == to_id:
            continue
        calls_count = int(row.get("calls_count") or 0)
        contacts_count = max(1, int(row.get("contacts_count") or 1))
        period_start = _format_graph_datetime(row.get("period_start"))
        period_end = _format_graph_datetime(row.get("period_end"))
        period = " - ".join(part for part in (period_start, period_end) if part)
        contacts = f"contacts: {contacts_count}"
        connections = f"connections: {calls_count}"
        label_parts = [contacts]
        if calls_count != contacts_count:
            label_parts.append(connections)
        if period:
            label_parts.append(period)
        label = "\n".join(label_parts)
        edges.append(
            {
                "id": _stable_id("comm", f"{from_id}->{to_id}"),
                "type": "connected_to",
                "from": from_id,
                "to": to_id,
                "label": label,
                "attributes": {
                    "contacts": contacts,
                    "contacts_count": contacts_count,
                    "connections": connections,
                    "period": period,
                    "period_start": period_start,
                    "period_end": period_end,
                    "calls_count": calls_count,
                    "calls_count_approx": bool(row.get("calls_count_approx") or False),
                    "visual": {
                        "label": label,
                        "direction": "both",
                    },
                },
            }
        )

    graph_data = {"nodes": nodes, "edges": edges}
    metadata = {
        "source": "project_data_load",
        "communications_edge_limit": PROJECT_DATA_GRAPH_EDGE_LIMIT,
        "communications_edges": len(edges),
        "communications_nodes": len(nodes),
    }

    existing_result = await db.execute(
        text(
            """
            SELECT id
            FROM artifacts
            WHERE project_id = :project_id
              AND type = 'graph'
              AND name = :name
            LIMIT 1
            """
        ),
        {"project_id": project_id, "name": PROJECT_DATA_GRAPH_NAME},
    )
    existing_id = existing_result.scalar_one_or_none()

    if existing_id:
        artifact = await db.get(Artifact, int(existing_id))
        if artifact is None:
            return None
        latest_result = await db.execute(
            text("SELECT COALESCE(MAX(version), 0) FROM artifact_versions WHERE artifact_id = :artifact_id"),
            {"artifact_id": artifact.id},
        )
        next_version = int(latest_result.scalar() or 0) + 1
        artifact.data = graph_data
        artifact.artifact_metadata = {**(artifact.artifact_metadata or {}), **metadata}
        db.add(ArtifactVersion(artifact_id=artifact.id, version=next_version, data=graph_data, changed_by="project_data_load"))
    else:
        artifact = Artifact(
            project_id=project_id,
            type="graph",
            name=PROJECT_DATA_GRAPH_NAME,
            description="Graph generated from loaded project communications",
            data=graph_data,
            artifact_metadata=metadata,
        )
        db.add(artifact)
        await db.flush()
        next_version = 1
        db.add(ArtifactVersion(artifact_id=artifact.id, version=next_version, data=graph_data, changed_by="project_data_load"))

    await db.flush()
    return {
        "id": artifact.id,
        "project_id": artifact.project_id,
        "type": artifact.type,
        "name": artifact.name,
        "description": artifact.description,
        "data": graph_data,
        "metadata": artifact.artifact_metadata,
        "version": next_version,
    }
