"""Metadata-driven project domain storage.

The store keeps entities, relations and source facts in generic tables. Domain
types remain editable in domain_model.json; no schema migration is needed when
an analyst adds a type or an attribute.
"""

from __future__ import annotations

import asyncio
from datetime import datetime
import hashlib
import json
import os
import re
from typing import Any, Iterable

from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.services.domain_model_service import get_domain_model


_domain_store_ready = False
_domain_store_lock = asyncio.Lock()


def invalidate_project_domain_store_schema() -> None:
    """Request a registry refresh after domain metadata was edited."""

    global _domain_store_ready
    _domain_store_ready = False

def _as_datetime(value: Any) -> datetime | None:
    if isinstance(value, datetime):
        return value
    text_value = _clean(value)
    if not text_value:
        return None
    try:
        return datetime.fromisoformat(text_value.replace("Z", "+00:00"))
    except ValueError:
        return None

def _clean(value: Any) -> str:
    return str(value or "").strip()


def _canonical_entity_key(type_id: str, value: Any) -> str:
    """Return a stable natural key for identifiers used in indexed lookups."""

    key = _clean(value)
    if _clean(type_id).casefold() in {"msisdn", "imei", "imsi"}:
        digits = re.sub(r"\D", "", key)
        return digits or key
    return key


DOMAIN_WRITE_BATCH_SIZE = max(1_000, int(os.getenv("DOMAIN_WRITE_BATCH_SIZE", "10000")))


def _batches(items: list[Any], size: int = DOMAIN_WRITE_BATCH_SIZE) -> Iterable[list[Any]]:
    for offset in range(0, len(items), size):
        yield items[offset:offset + size]


def _fact_key(kind: str, payload: dict[str, Any]) -> str:
    encoded = json.dumps(payload, ensure_ascii=True, default=str, sort_keys=True, separators=(",", ":"))
    return hashlib.sha256((kind + "|" + encoded).encode("utf-8")).hexdigest()


def _entity(type_id: str, key: Any, label: Any | None = None, attributes: dict[str, Any] | None = None) -> dict[str, Any] | None:
    external_key = _canonical_entity_key(type_id, key)
    if not external_key:
        return None
    return {
        "type_id": type_id,
        "external_key": external_key,
        "label": _clean(label) or external_key,
        "attributes": json.dumps(attributes or {}, ensure_ascii=False, default=str),
    }


def _relation(
    relation_type: str,
    from_type: str,
    from_key: Any,
    to_type: str,
    to_key: Any,
    occurred_at: Any,
    attributes: dict[str, Any],
    directed: bool,
) -> dict[str, Any] | None:
    source_key = _canonical_entity_key(from_type, from_key)
    target_key = _canonical_entity_key(to_type, to_key)
    if not source_key or not target_key:
        return None
    payload = {
        "from_type": from_type,
        "from_key": source_key,
        "to_type": to_type,
        "to_key": target_key,
        "occurred_at": _as_datetime(occurred_at),
        "attributes": attributes,
    }
    return {
        "relation_type": relation_type,
        "from_type": from_type,
        "from_key": source_key,
        "to_type": to_type,
        "to_key": target_key,
        "occurred_at": _as_datetime(occurred_at),
        "directed": directed,
        "attributes": json.dumps(attributes, ensure_ascii=False, default=str),
        "fact_key": _fact_key(relation_type, payload),
    }


async def ensure_project_domain_store(db: AsyncSession) -> None:
    """Create generic schema once per process and refresh it after metadata changes."""

    global _domain_store_ready
    if _domain_store_ready:
        return
    async with _domain_store_lock:
        if _domain_store_ready:
            return
        await db.execute(text("""
            CREATE TABLE IF NOT EXISTS domain_type_registry (
                kind TEXT NOT NULL,
                type_id TEXT NOT NULL,
                label TEXT NOT NULL,
                definition JSONB NOT NULL DEFAULT '{}'::jsonb,
                updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
                PRIMARY KEY (kind, type_id)
            );
        """))
        await db.execute(text("""
            CREATE TABLE IF NOT EXISTS project_domain_entities (
                id BIGSERIAL PRIMARY KEY,
                project_id INTEGER NOT NULL,
                type_id TEXT NOT NULL,
                external_key TEXT NOT NULL,
                label TEXT NOT NULL,
                attributes JSONB NOT NULL DEFAULT '{}'::jsonb,
                first_seen_at TIMESTAMP,
                last_seen_at TIMESTAMP,
                created_at TIMESTAMP NOT NULL DEFAULT NOW(),
                updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
                UNIQUE (project_id, type_id, external_key)
            );
        """))
        await db.execute(text("""
            CREATE TABLE IF NOT EXISTS project_domain_relations (
                id BIGSERIAL PRIMARY KEY,
                project_id INTEGER NOT NULL,
                load_batch_id TEXT NOT NULL,
                relation_type TEXT NOT NULL,
                from_type TEXT NOT NULL,
                from_key TEXT NOT NULL,
                to_type TEXT NOT NULL,
                to_key TEXT NOT NULL,
                occurred_at TIMESTAMP,
                directed BOOLEAN NOT NULL DEFAULT FALSE,
                attributes JSONB NOT NULL DEFAULT '{}'::jsonb,
                fact_key TEXT NOT NULL,
                created_at TIMESTAMP NOT NULL DEFAULT NOW(),
                UNIQUE (project_id, relation_type, fact_key)
            );
        """))
        await db.execute(text("""
            CREATE TABLE IF NOT EXISTS project_domain_facts (
                id BIGSERIAL PRIMARY KEY,
                project_id INTEGER NOT NULL,
                load_batch_id TEXT NOT NULL,
                fact_type TEXT NOT NULL,
                occurred_at TIMESTAMP,
                payload JSONB NOT NULL,
                fact_key TEXT NOT NULL,
                created_at TIMESTAMP NOT NULL DEFAULT NOW(),
                UNIQUE (project_id, fact_type, fact_key)
            );
        """))
        await db.execute(text("""
            CREATE TABLE IF NOT EXISTS project_domain_fact_participants (
                fact_id BIGINT NOT NULL REFERENCES project_domain_facts(id) ON DELETE CASCADE,
                project_id INTEGER NOT NULL,
                fact_type TEXT NOT NULL,
                entity_type TEXT NOT NULL,
                entity_key TEXT NOT NULL,
                role TEXT NOT NULL DEFAULT '',
                occurred_at TIMESTAMP,
                created_at TIMESTAMP NOT NULL DEFAULT NOW(),
                PRIMARY KEY (fact_id, entity_type, entity_key, role)
            );
        """))
        await db.execute(text("CREATE INDEX IF NOT EXISTS ix_project_domain_entities_lookup ON project_domain_entities (project_id, type_id, external_key)"))
        await db.execute(text("CREATE INDEX IF NOT EXISTS ix_project_domain_relations_lookup ON project_domain_relations (project_id, relation_type, from_type, from_key)"))
        await db.execute(text("CREATE INDEX IF NOT EXISTS ix_project_domain_relations_target ON project_domain_relations (project_id, relation_type, to_type, to_key)"))
        await db.execute(text("CREATE INDEX IF NOT EXISTS ix_project_domain_facts_lookup ON project_domain_facts (project_id, fact_type, occurred_at)"))
        await db.execute(text("""
            CREATE INDEX IF NOT EXISTS ix_project_domain_facts_location_event_address
            ON project_domain_facts (project_id)
            WHERE fact_type = 'location_event'
              AND NULLIF(BTRIM(payload ->> 'address'), '') IS NOT NULL
        """))
        await db.execute(text("""
            CREATE INDEX IF NOT EXISTS ix_project_domain_facts_observation_station
            ON project_domain_facts (project_id, BTRIM(payload ->> 'base_station'))
            WHERE fact_type = 'telecom_base_station_observation'
              AND NULLIF(BTRIM(payload ->> 'base_station'), '') IS NOT NULL
        """))
        await db.execute(text("CREATE INDEX IF NOT EXISTS ix_project_domain_relations_source_time ON project_domain_relations (project_id, relation_type, from_type, from_key, occurred_at)"))
        await db.execute(text("CREATE INDEX IF NOT EXISTS ix_project_domain_relations_target_time ON project_domain_relations (project_id, relation_type, to_type, to_key, occurred_at)"))
        await db.execute(text("CREATE INDEX IF NOT EXISTS ix_project_domain_fact_participants_lookup ON project_domain_fact_participants (project_id, entity_type, entity_key, fact_type, occurred_at, fact_id)"))
        await db.execute(text("""
            CREATE TABLE IF NOT EXISTS project_domain_store_state (
                project_id INTEGER NOT NULL,
                state_key TEXT NOT NULL,
                applied_at TIMESTAMP NOT NULL DEFAULT NOW(),
                PRIMARY KEY (project_id, state_key)
            );
        """))

        model = get_domain_model()
        registry_rows: list[dict[str, Any]] = []
        for kind, key in (("node", "node_types"), ("edge", "edge_types"), ("fact", "fact_types")):
            for definition in model.get(key, []):
                if not isinstance(definition, dict) or not _clean(definition.get("id")):
                    continue
                registry_rows.append({
                    "kind": kind,
                    "type_id": _clean(definition["id"]),
                    "label": _clean(definition.get("label")) or _clean(definition["id"]),
                    "definition": json.dumps(definition, ensure_ascii=False, default=str),
                })
        if registry_rows:
            await db.execute(text("""
                INSERT INTO domain_type_registry (kind, type_id, label, definition, updated_at)
                VALUES (:kind, :type_id, :label, CAST(:definition AS jsonb), NOW())
                ON CONFLICT (kind, type_id) DO UPDATE
                SET label = EXCLUDED.label, definition = EXCLUDED.definition, updated_at = NOW()
            """), registry_rows)
        _domain_store_ready = True

async def clear_project_domain_store(db: AsyncSession, project_id: int) -> dict[str, int]:
    result_relations = await db.execute(text("DELETE FROM project_domain_relations WHERE project_id = :project_id"), {"project_id": project_id})
    result_participants = await db.execute(text("DELETE FROM project_domain_fact_participants WHERE project_id = :project_id"), {"project_id": project_id})
    result_facts = await db.execute(text("DELETE FROM project_domain_facts WHERE project_id = :project_id"), {"project_id": project_id})
    result_entities = await db.execute(text("DELETE FROM project_domain_entities WHERE project_id = :project_id"), {"project_id": project_id})
    return {
        "domain_relations_deleted": result_relations.rowcount or 0,
        "domain_fact_participants_deleted": result_participants.rowcount or 0,
        "domain_facts_deleted": result_facts.rowcount or 0,
        "domain_entities_deleted": result_entities.rowcount or 0,
    }


async def ensure_project_domain_fact_participants(db: AsyncSession, project_id: int) -> None:
    """Backfill participants for legacy facts once per project.

    New imports write participants directly. The migration exists only so existing
    projects become fast without requiring users to reimport their data.
    """

    await ensure_project_domain_store(db)
    state_key = "fact_participants_v1"
    marker = await db.execute(text("""
        SELECT 1
        FROM project_domain_store_state
        WHERE project_id = :project_id AND state_key = :state_key
    """), {"project_id": project_id, "state_key": state_key})
    if marker.scalar_one_or_none() is not None:
        return

    await db.execute(text(r"""
        WITH legacy_participants AS (
            SELECT
                fact.id AS fact_id,
                fact.project_id,
                fact.fact_type,
                LOWER(BTRIM(fact.payload ->> 'identifier_type')) AS entity_type,
                CASE
                    WHEN LOWER(BTRIM(fact.payload ->> 'identifier_type')) IN ('msisdn', 'imei', 'imsi')
                        THEN regexp_replace(COALESCE(fact.payload ->> 'identifier_value', ''), '\D', '', 'g')
                    ELSE BTRIM(COALESCE(fact.payload ->> 'identifier_value', ''))
                END AS entity_key,
                'entity_0' AS role,
                fact.occurred_at
            FROM project_domain_facts AS fact
            WHERE fact.project_id = :project_id
              AND fact.fact_type = 'location_event'

            UNION ALL

            SELECT
                fact.id AS fact_id,
                fact.project_id,
                fact.fact_type,
                'msisdn' AS entity_type,
                regexp_replace(COALESCE(fact.payload ->> 'msisdn', ''), '\D', '', 'g') AS entity_key,
                'entity_0' AS role,
                fact.occurred_at
            FROM project_domain_facts AS fact
            WHERE fact.project_id = :project_id
              AND fact.fact_type = 'telecom_base_station_observation'
        )
        INSERT INTO project_domain_fact_participants (
            fact_id, project_id, fact_type, entity_type, entity_key, role, occurred_at
        )
        SELECT fact_id, project_id, fact_type, entity_type, entity_key, role, occurred_at
        FROM legacy_participants
        WHERE entity_type <> '' AND entity_key <> ''
        ON CONFLICT DO NOTHING
    """), {"project_id": project_id})
    await db.execute(text("""
        INSERT INTO project_domain_store_state (project_id, state_key)
        VALUES (:project_id, :state_key)
        ON CONFLICT DO NOTHING
    """), {"project_id": project_id, "state_key": state_key})


async def upsert_manual_domain_entities(
    db: AsyncSession,
    project_id: int,
    entities: Iterable[dict[str, Any]],
) -> dict[str, int]:
    """Create or update analyst-entered entities in the generic domain store."""

    await ensure_project_domain_store(db)
    prepared: dict[tuple[str, str], dict[str, Any]] = {}
    for item in entities:
        if not isinstance(item, dict):
            continue
        entity = _entity(
            _clean(item.get("type_id")),
            item.get("external_key"),
            item.get("label"),
            item.get("attributes") if isinstance(item.get("attributes"), dict) else {},
        )
        if entity and entity["type_id"]:
            prepared[(entity["type_id"], entity["external_key"])] = entity

    if not prepared:
        return {"requested": 0, "created": 0, "existing": 0}

    rows = list(prepared.values())
    type_ids = sorted({row["type_id"] for row in rows})
    keys = sorted({row["external_key"] for row in rows})
    existing_rows = await db.execute(text("""
        SELECT type_id, external_key
        FROM project_domain_entities
        WHERE project_id = :project_id
          AND type_id = ANY(:type_ids)
          AND external_key = ANY(:keys)
    """), {"project_id": project_id, "type_ids": type_ids, "keys": keys})
    existing = {(str(row[0]), str(row[1])) for row in existing_rows}
    now = datetime.utcnow()
    await db.execute(text("""
        INSERT INTO project_domain_entities (
            project_id, type_id, external_key, label, attributes, first_seen_at, last_seen_at
        ) VALUES (
            :project_id, :type_id, :external_key, :label, CAST(:attributes AS jsonb), :first_seen_at, :last_seen_at
        )
        ON CONFLICT (project_id, type_id, external_key) DO UPDATE
        SET label = EXCLUDED.label,
            attributes = project_domain_entities.attributes || EXCLUDED.attributes,
            last_seen_at = EXCLUDED.last_seen_at,
            updated_at = NOW()
    """), [{**row, "project_id": project_id, "first_seen_at": now, "last_seen_at": now} for row in rows])
    created = sum((row["type_id"], row["external_key"]) not in existing for row in rows)
    return {"requested": len(rows), "created": created, "existing": len(rows) - created}


async def find_project_domain_relations(
    db: AsyncSession,
    project_id: int,
    relation_type: str,
    *,
    endpoints: Iterable[tuple[str, Iterable[str]]] = (),
) -> list[dict[str, Any]]:
    """Return typed relations that touch any supplied natural entity key."""

    await ensure_project_domain_store(db)
    conditions: list[str] = []
    bind: dict[str, Any] = {"project_id": project_id, "relation_type": relation_type}
    for index, (type_id, keys) in enumerate(endpoints):
        cleaned = sorted({_clean(key) for key in keys if _clean(key)})
        if not cleaned:
            continue
        type_key = f"type_{index}"
        keys_key = f"keys_{index}"
        bind[type_key] = _clean(type_id)
        bind[keys_key] = cleaned
        conditions.append(
            f"(from_type = :{type_key} AND from_key = ANY(:{keys_key}))"
            f" OR (to_type = :{type_key} AND to_key = ANY(:{keys_key}))"
        )
    if not conditions:
        return []

    result = await db.execute(text("""
        SELECT relation_type, from_type, from_key, to_type, to_key, occurred_at, directed, attributes
        FROM project_domain_relations
        WHERE project_id = :project_id
          AND relation_type = :relation_type
          AND (""" + " OR ".join(conditions) + """)
        ORDER BY occurred_at ASC NULLS LAST, id ASC
    """), bind)
    return [dict(row) for row in result.mappings().all()]


async def find_project_domain_relation_summaries(
    db: AsyncSession,
    project_id: int,
    relation_type: str,
    *,
    endpoints: Iterable[tuple[str, Iterable[str]]] = (),
    limit: int | None = None,
) -> list[dict[str, Any]]:
    """Aggregate relations by endpoint pair for compact graph rendering."""

    await ensure_project_domain_store(db)
    conditions: list[str] = []
    bind: dict[str, Any] = {"project_id": project_id, "relation_type": relation_type}
    for index, (type_id, keys) in enumerate(endpoints):
        cleaned = sorted({_clean(key) for key in keys if _clean(key)})
        if not cleaned:
            continue
        type_key = f"type_{index}"
        keys_key = f"keys_{index}"
        bind[type_key] = _clean(type_id)
        bind[keys_key] = cleaned
        conditions.append(
            f"(from_type = :{type_key} AND from_key = ANY(:{keys_key}))"
            f" OR (to_type = :{type_key} AND to_key = ANY(:{keys_key}))"
        )
    if not conditions:
        return []

    result = await db.execute(text("""
        SELECT
            relation.relation_type,
            relation.from_type,
            relation.from_key,
            relation.to_type,
            relation.to_key,
            relation.directed,
            COALESCE(from_entity.attributes, '{}'::jsonb) AS from_attributes,
            COALESCE(to_entity.attributes, '{}'::jsonb) AS to_attributes,
            COUNT(*)::integer AS facts_count,
            MIN(relation.occurred_at) AS first_occurred_at,
            MAX(relation.occurred_at) AS last_occurred_at,
            COALESCE(
                string_agg(DISTINCT NULLIF(relation.attributes ->> 'connection_type', ''), ', '),
                ''
            ) AS connection_types
        FROM project_domain_relations AS relation
        LEFT JOIN project_domain_entities AS from_entity
          ON from_entity.project_id = relation.project_id
         AND from_entity.type_id = relation.from_type
         AND from_entity.external_key = relation.from_key
        LEFT JOIN project_domain_entities AS to_entity
          ON to_entity.project_id = relation.project_id
         AND to_entity.type_id = relation.to_type
         AND to_entity.external_key = relation.to_key
        WHERE relation.project_id = :project_id
          AND relation.relation_type = :relation_type
          AND (""" + " OR ".join(conditions) + """)
        GROUP BY
            relation.relation_type,
            relation.from_type,
            relation.from_key,
            relation.to_type,
            relation.to_key,
            relation.directed,
            from_entity.attributes,
            to_entity.attributes
        ORDER BY first_occurred_at ASC NULLS LAST, from_key, to_key
        LIMIT COALESCE(:limit, 2147483647)
    """), {**bind, "limit": max(1, int(limit)) if limit is not None else None})
    return [dict(row) for row in result.mappings().all()]

def _mapping_value(row: dict[str, Any], spec: Any) -> Any:
    if isinstance(spec, str):
        return row.get(spec[1:]) if spec.startswith("$") else spec
    if not isinstance(spec, dict):
        return spec
    if "field" in spec:
        return row.get(_clean(spec.get("field")))
    if "literal" in spec:
        return spec.get("literal")
    if "template" in spec:
        template = _clean(spec.get("template"))
        return __import__("re").sub(r"\{([^{}]+)\}", lambda match: _clean(row.get(match.group(1))), template)
    return None


def _mapping_attributes(row: dict[str, Any], definition: Any) -> dict[str, Any]:
    if definition == "$row":
        return {key: value for key, value in row.items() if key not in {"project_id", "load_batch_id", "created_at"}}
    if not isinstance(definition, dict):
        return {}
    return {key: _mapping_value(row, value) for key, value in definition.items()}

async def mirror_source_rows(
    db: AsyncSession,
    project_id: int,
    load_batch_id: str,
    source_rows: Mapping[str, Iterable[dict[str, Any]]],
) -> dict[str, Any]:
    """Persist normalized source rows and their typed, indexed fact participants."""

    await ensure_project_domain_store(db)
    entities: dict[tuple[str, str], dict[str, Any]] = {}
    facts: dict[tuple[str, str], dict[str, Any]] = {}
    relations: list[dict[str, Any]] = []

    def add_entity(item: dict[str, Any] | None) -> None:
        if item:
            entities[(item["type_id"], item["external_key"])] = item

    def add_fact(
        fact_type: str,
        row: dict[str, Any],
        occurred_at: Any,
        participants: list[dict[str, str]],
    ) -> None:
        payload = {key: value for key, value in row.items() if key not in {"project_id", "load_batch_id", "created_at"}}
        fact_key = _fact_key(fact_type, payload)
        fact = facts.setdefault((fact_type, fact_key), {
            "project_id": project_id,
            "load_batch_id": load_batch_id,
            "fact_type": fact_type,
            "occurred_at": _as_datetime(occurred_at),
            "payload": json.dumps(payload, ensure_ascii=False, default=str),
            "fact_key": fact_key,
            "participants": {},
        })
        for participant in participants:
            key = (participant["entity_type"], participant["entity_key"], participant["role"])
            fact["participants"][key] = participant

    def add_relation(item: dict[str, Any] | None) -> None:
        if item:
            relations.append({"project_id": project_id, "load_batch_id": load_batch_id, **item})

    source_rows = {_clean(key): rows for key, rows in source_rows.items()}
    model = get_domain_model()
    for mapping in model.get("ingestion_mappings", []):
        if not isinstance(mapping, dict):
            continue
        rows = source_rows.get(_clean(mapping.get("source")))
        if rows is None:
            continue
        fact_definition = mapping.get("fact") if isinstance(mapping.get("fact"), dict) else {}
        entities_definition = mapping.get("entities") if isinstance(mapping.get("entities"), list) else []
        relations_definition = mapping.get("relations") if isinstance(mapping.get("relations"), list) else []
        for row_index, row in enumerate(rows, start=1):
            # Keep the API responsive while a large normalized source is prepared.
            if row_index % 1_000 == 0:
                await asyncio.sleep(0)
            if not isinstance(row, dict):
                continue
            fact_participants: list[dict[str, str]] = []
            for entity_index, definition in enumerate(entities_definition):
                if not isinstance(definition, dict):
                    continue
                type_id = _clean(_mapping_value(row, definition.get("type")))
                entity = _entity(
                    type_id,
                    _mapping_value(row, definition.get("key")),
                    _mapping_value(row, definition.get("label")),
                    _mapping_attributes(row, definition.get("attributes")),
                )
                add_entity(entity)
                if entity:
                    fact_participants.append({
                        "entity_type": entity["type_id"],
                        "entity_key": entity["external_key"],
                        "role": _clean(definition.get("role")) or f"entity_{entity_index}",
                    })
            fact_type = _clean(fact_definition.get("type"))
            if fact_type:
                add_fact(
                    fact_type,
                    row,
                    _mapping_value(row, fact_definition.get("occurred_at")),
                    fact_participants,
                )
            for definition in relations_definition:
                if not isinstance(definition, dict):
                    continue
                source = definition.get("from") if isinstance(definition.get("from"), dict) else {}
                target = definition.get("to") if isinstance(definition.get("to"), dict) else {}
                relation_type = _clean(definition.get("type"))
                source_type = _clean(_mapping_value(row, source.get("type")))
                target_type = _clean(_mapping_value(row, target.get("type")))
                if relation_type == "@pair":
                    relation_type = _resolve_relation_type(model, source_type, target_type)
                if not relation_type or not source or not target:
                    continue
                add_relation(_relation(
                    relation_type,
                    source_type,
                    _mapping_value(row, source.get("key")),
                    target_type,
                    _mapping_value(row, target.get("key")),
                    _mapping_value(row, definition.get("occurred_at")),
                    _mapping_attributes(row, definition.get("attributes")),
                    bool(definition.get("directed", False)),
                ))

    now = datetime.utcnow()
    entity_rows = [{**item, "project_id": project_id, "first_seen_at": now, "last_seen_at": now} for item in entities.values()]
    entity_insert = text("""
        WITH source_rows AS (
          SELECT * FROM json_to_recordset(CAST(:rows AS json)) AS r(
            project_id INTEGER, type_id TEXT, external_key TEXT, label TEXT,
            attributes TEXT, first_seen_at TIMESTAMP, last_seen_at TIMESTAMP
          )
        ) INSERT INTO project_domain_entities (
            project_id, type_id, external_key, label, attributes, first_seen_at, last_seen_at
        ) SELECT project_id, type_id, external_key, label, CAST(attributes AS jsonb), first_seen_at, last_seen_at
          FROM source_rows
        ON CONFLICT (project_id, type_id, external_key) DO UPDATE
        SET label = EXCLUDED.label,
            attributes = project_domain_entities.attributes || EXCLUDED.attributes,
            last_seen_at = EXCLUDED.last_seen_at,
            updated_at = NOW()
    """)
    for batch in _batches(entity_rows):
        await db.execute(entity_insert, {"rows": json.dumps(batch, ensure_ascii=False, default=str)})

    fact_rows = list(facts.values())
    fact_insert_rows = [{key: value for key, value in fact.items() if key != "participants"} for fact in fact_rows]
    fact_insert = text("""
        WITH source_rows AS (
          SELECT * FROM json_to_recordset(CAST(:rows AS json)) AS r(
            project_id INTEGER, load_batch_id TEXT, fact_type TEXT, occurred_at TIMESTAMP,
            payload TEXT, fact_key TEXT
          )
        ) INSERT INTO project_domain_facts (project_id, load_batch_id, fact_type, occurred_at, payload, fact_key)
        SELECT project_id, load_batch_id, fact_type, occurred_at, CAST(payload AS jsonb), fact_key
          FROM source_rows
        ON CONFLICT (project_id, fact_type, fact_key) DO NOTHING
    """)
    for batch in _batches(fact_insert_rows):
        await db.execute(fact_insert, {"rows": json.dumps(batch, ensure_ascii=False, default=str)})

    fact_ids: dict[tuple[str, str], int] = {}
    facts_by_type: dict[str, list[dict[str, Any]]] = {}
    for fact in fact_rows:
        facts_by_type.setdefault(fact["fact_type"], []).append(fact)
    fact_lookup = text("""
        SELECT id, fact_key
        FROM project_domain_facts
        WHERE project_id = :project_id
          AND fact_type = :fact_type
          AND fact_key = ANY(:fact_keys)
    """)
    for fact_type, type_facts in facts_by_type.items():
        for batch in _batches(type_facts):
            result = await db.execute(fact_lookup, {
                "project_id": project_id,
                "fact_type": fact_type,
                "fact_keys": [fact["fact_key"] for fact in batch],
            })
            fact_ids.update({(fact_type, str(row.fact_key)): int(row.id) for row in result})

    participant_rows: list[dict[str, Any]] = []
    for fact in fact_rows:
        fact_id = fact_ids.get((fact["fact_type"], fact["fact_key"]))
        if fact_id is None:
            continue
        for participant in fact["participants"].values():
            participant_rows.append({
                "fact_id": fact_id,
                "project_id": project_id,
                "fact_type": fact["fact_type"],
                "entity_type": participant["entity_type"],
                "entity_key": participant["entity_key"],
                "role": participant["role"],
                "occurred_at": fact["occurred_at"],
            })
    participant_insert = text("""
        WITH source_rows AS (
          SELECT * FROM json_to_recordset(CAST(:rows AS json)) AS r(
            fact_id BIGINT, project_id INTEGER, fact_type TEXT, entity_type TEXT,
            entity_key TEXT, role TEXT, occurred_at TIMESTAMP
          )
        ) INSERT INTO project_domain_fact_participants (
            fact_id, project_id, fact_type, entity_type, entity_key, role, occurred_at
        ) SELECT fact_id, project_id, fact_type, entity_type, entity_key, role, occurred_at
          FROM source_rows
        ON CONFLICT DO NOTHING
    """)
    for batch in _batches(participant_rows):
        await db.execute(participant_insert, {"rows": json.dumps(batch, ensure_ascii=False, default=str)})

    relation_insert = text("""
        WITH source_rows AS (
          SELECT * FROM json_to_recordset(CAST(:rows AS json)) AS r(
            project_id INTEGER, load_batch_id TEXT, relation_type TEXT, from_type TEXT,
            from_key TEXT, to_type TEXT, to_key TEXT, occurred_at TIMESTAMP,
            directed BOOLEAN, attributes TEXT, fact_key TEXT
          )
        ) INSERT INTO project_domain_relations (
            project_id, load_batch_id, relation_type, from_type, from_key, to_type, to_key,
            occurred_at, directed, attributes, fact_key
        ) SELECT project_id, load_batch_id, relation_type, from_type, from_key, to_type, to_key,
                 occurred_at, directed, CAST(attributes AS jsonb), fact_key
          FROM source_rows
        ON CONFLICT (project_id, relation_type, fact_key) DO NOTHING
    """)
    for batch in _batches(relations):
        await db.execute(relation_insert, {"rows": json.dumps(batch, ensure_ascii=False, default=str)})

    # Report this write batch only. Querying the whole load batch here turns a
    # multi-part import into an increasingly expensive repeated aggregation.
    fact_counts: dict[str, int] = {}
    for fact in fact_rows:
        fact_type = str(fact["fact_type"])
        fact_counts[fact_type] = fact_counts.get(fact_type, 0) + 1
    return {
        "entities": len(entity_rows),
        "facts": len(fact_rows),
        "relations": len(relations),
        "fact_counts": fact_counts,
    }

def _resolve_relation_type(model: dict[str, Any], from_type: str, to_type: str) -> str:
    """Resolve a declarative relation by its concrete endpoint pair."""
    for edge_type in model.get("edge_types", []):
        if not isinstance(edge_type, dict) or bool(edge_type.get("system", False)):
            continue
        source_type = _clean(edge_type.get("from_type"))
        target_type = _clean(edge_type.get("to_type"))
        if source_type == from_type and target_type == to_type:
            return _clean(edge_type.get("id"))
        if bool(edge_type.get("supports_reverse", False)) and source_type == to_type and target_type == from_type:
            return _clean(edge_type.get("id"))
    return "connected_to"
