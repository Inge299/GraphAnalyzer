from __future__ import annotations

from dataclasses import dataclass
from typing import Any, Mapping

from sqlalchemy.ext.asyncio import AsyncSession

from app.services.project_domain_store import mirror_source_rows


@dataclass(frozen=True)
class ImportInsertResult:
    entities: int
    facts: int
    relations: int
    fact_counts: dict[str, int]
    source_counts: dict[str, int]


async def insert_normalized_source_rows(
    db: AsyncSession,
    project_id: int,
    source_rows: Mapping[str, list[dict[str, Any]]],
    load_batch_id: str,
) -> ImportInsertResult:
    """Persist direct output of an import plugin in the universal domain store."""
    normalized = {str(source): list(rows) for source, rows in source_rows.items()}
    domain_result = await mirror_source_rows(db, project_id, load_batch_id, normalized)
    return ImportInsertResult(
        entities=int(domain_result.get("entities", 0)),
        facts=int(domain_result.get("facts", 0)),
        relations=int(domain_result.get("relations", 0)),
        fact_counts={str(name): int(count) for name, count in dict(domain_result.get("fact_counts") or {}).items()},
        source_counts={name: len(rows) for name, rows in normalized.items()},
    )