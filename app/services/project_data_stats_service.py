"""Dynamic statistics for metadata-driven project data."""

from __future__ import annotations

from typing import Any

from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.services.project_domain_store import ensure_project_domain_store


async def get_project_domain_stats(db: AsyncSession, project_id: int) -> dict[str, Any]:
    await ensure_project_domain_store(db)
    totals = (await db.execute(text("""
        SELECT
            (SELECT COUNT(*)::integer FROM project_domain_entities WHERE project_id = :project_id) AS entities_count,
            (SELECT COUNT(*)::integer FROM project_domain_facts WHERE project_id = :project_id) AS facts_count,
            (SELECT COUNT(*)::integer FROM project_domain_relations WHERE project_id = :project_id) AS relations_count
    """), {"project_id": project_id})).mappings().one()
    fact_rows = await db.execute(text("""
        SELECT fact_type, COUNT(*)::integer AS count
        FROM project_domain_facts
        WHERE project_id = :project_id
        GROUP BY fact_type
        ORDER BY fact_type
    """), {"project_id": project_id})
    relation_rows = await db.execute(text("""
        SELECT relation_type, COUNT(*)::integer AS count
        FROM project_domain_relations
        WHERE project_id = :project_id
        GROUP BY relation_type
        ORDER BY relation_type
    """), {"project_id": project_id})
    entity_rows = await db.execute(text("""
        SELECT type_id, COUNT(*)::integer AS count
        FROM project_domain_entities
        WHERE project_id = :project_id
        GROUP BY type_id
        ORDER BY type_id
    """), {"project_id": project_id})
    return {
        "entities_count": int(totals["entities_count"] or 0),
        "facts_count": int(totals["facts_count"] or 0),
        "relations_count": int(totals["relations_count"] or 0),
        "entity_counts": {str(row[0]): int(row[1]) for row in entity_rows},
        "fact_counts": {str(row[0]): int(row[1]) for row in fact_rows},
        "relation_counts": {str(row[0]): int(row[1]) for row in relation_rows},
    }