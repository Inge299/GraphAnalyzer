"""Read-only API for the metadata-driven project domain store."""

from __future__ import annotations

from typing import Any

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select, text
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models.project import Project
from app.services.project_domain_store import ensure_project_domain_store

router = APIRouter(prefix="/projects", tags=["project-domain"])


async def _require_project(db: AsyncSession, project_id: int) -> None:
    project = (await db.execute(select(Project.id).where(Project.id == project_id))).scalar_one_or_none()
    if project is None:
        raise HTTPException(status_code=404, detail=f"Project {project_id} not found")


@router.get("/{project_id}/domain/stats")
async def get_project_domain_stats(project_id: int, db: AsyncSession = Depends(get_db)) -> dict[str, Any]:
    await _require_project(db, project_id)
    await ensure_project_domain_store(db)

    entities = (await db.execute(text("""
        SELECT type_id, COUNT(*)::integer AS count
        FROM project_domain_entities
        WHERE project_id = :project_id
        GROUP BY type_id
        ORDER BY type_id
    """), {"project_id": project_id})).mappings().all()
    relations = (await db.execute(text("""
        SELECT relation_type, COUNT(*)::integer AS count
        FROM project_domain_relations
        WHERE project_id = :project_id
        GROUP BY relation_type
        ORDER BY relation_type
    """), {"project_id": project_id})).mappings().all()
    facts = (await db.execute(text("""
        SELECT fact_type, COUNT(*)::integer AS count
        FROM project_domain_facts
        WHERE project_id = :project_id
        GROUP BY fact_type
        ORDER BY fact_type
    """), {"project_id": project_id})).mappings().all()

    return {
        "project_id": project_id,
        "entities": [dict(row) for row in entities],
        "relations": [dict(row) for row in relations],
        "facts": [dict(row) for row in facts],
    }


@router.get("/{project_id}/domain/entities")
async def list_project_domain_entities(
    project_id: int,
    type_id: str | None = None,
    query: str | None = None,
    limit: int = Query(default=100, ge=1, le=1000),
    db: AsyncSession = Depends(get_db),
) -> dict[str, Any]:
    await _require_project(db, project_id)
    await ensure_project_domain_store(db)
    conditions = ["project_id = :project_id"]
    bind: dict[str, Any] = {"project_id": project_id, "limit": limit}
    if type_id and type_id.strip():
        conditions.append("type_id = :type_id")
        bind["type_id"] = type_id.strip()
    if query and query.strip():
        conditions.append("(external_key ILIKE :pattern OR label ILIKE :pattern)")
        bind["pattern"] = f"%{query.strip()}%"
    rows = (await db.execute(text("""
        SELECT type_id, external_key, label, attributes, first_seen_at, last_seen_at
        FROM project_domain_entities
        WHERE """ + " AND ".join(conditions) + """
        ORDER BY type_id, label, external_key
        LIMIT :limit
    """), bind)).mappings().all()
    return {"project_id": project_id, "items": [dict(row) for row in rows]}


@router.get("/{project_id}/domain/relations")
async def list_project_domain_relations(
    project_id: int,
    relation_type: str | None = None,
    entity_type: str | None = None,
    entity_key: str | None = None,
    limit: int = Query(default=100, ge=1, le=1000),
    db: AsyncSession = Depends(get_db),
) -> dict[str, Any]:
    await _require_project(db, project_id)
    await ensure_project_domain_store(db)
    rows = (await db.execute(text("""
        SELECT relation_type, from_type, from_key, to_type, to_key, occurred_at, directed, attributes
        FROM project_domain_relations
        WHERE project_id = :project_id
          AND (:relation_type IS NULL OR relation_type = :relation_type)
          AND (
              :entity_type IS NULL OR :entity_key IS NULL
              OR (from_type = :entity_type AND from_key = :entity_key)
              OR (to_type = :entity_type AND to_key = :entity_key)
          )
        ORDER BY occurred_at DESC NULLS LAST, id DESC
        LIMIT :limit
    """), {
        "project_id": project_id,
        "relation_type": relation_type.strip() if relation_type else None,
        "entity_type": entity_type.strip() if entity_type else None,
        "entity_key": entity_key.strip() if entity_key else None,
        "limit": limit,
    })).mappings().all()
    return {"project_id": project_id, "items": [dict(row) for row in rows]}