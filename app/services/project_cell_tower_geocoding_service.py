from __future__ import annotations

import json
import re
from collections import defaultdict
from datetime import datetime, timezone
from math import asin, cos, radians, sin, sqrt
from typing import Any, Awaitable, Callable, Iterable

from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.database import AsyncSessionLocal
from app.services.cell_tower_reference_provider import resolve_cell_towers
from app.services.geocoding_service import NominatimGeocoder
from app.services.project_domain_store import ensure_project_domain_store


ProgressCallback = Callable[[int, str], Awaitable[None]]
CONFLICT_COORDINATE_RADIUS_M = 200.0


def _value(value: object) -> str:
    result = str(value or "").strip()
    return "" if result.casefold() in {"", "null", "none", "n/a", "na", "-"} else result


def normalize_address(value: object) -> str:
    return re.sub(r"\s+", " ", _value(value).casefold()).strip(" ,;.")


_CONCRETE_ADDRESS_RE = re.compile(
    "(?:^|[\\s,])(?:\u0443\u043b(?:\u0438\u0446\u0430)?\\.?|\u043f\u0440\u043e\u0441\u043f\u0435\u043a\u0442\u0430?|\u043f\u0440-?\u043a\u0442\\.?|\u043f\u0435\u0440\u0435\u0443\u043b\u043e\u043a\u0430?|\u043f\u0435\u0440\\.?|\u0431\u0443\u043b\u044c\u0432\u0430\u0440\u0430?|\u0431-\u0440\\.?|\u0448\u043e\u0441\u0441\u0435|\u0448\\.?|\u043f\u043b\u043e\u0449\u0430\u0434\u044c|\u043f\u043b\\.?|\u043f\u0440\u043e\u0435\u0437\u0434\u0430?|\u043d\u0430\u0431\u0435\u0440\u0435\u0436\u043d\u0430\u044f|\u0434\u043e\u043c\u0430?|\u0434\\.?|\u0437\u0434\u0430\u043d\u0438\u0435|\u0437\u0434\\.?|\u043a\u043e\u0440\u043f\u0443\u0441\u0430?|\u043e\u043f\u043e\u0440\u0430|\u0442\u0435\u0440\u0440\u0438\u0442\u043e\u0440\u0438\u044f|\u043c\u0438\u043a\u0440\u043e\u0440\u0430\u0439\u043e\u043d\u0430?|\u043c\u043a\u0440\\.?)(?:[\\s,]|$)",
    re.IGNORECASE,
)


def is_concrete_geocoded_address(value: object) -> bool:
    """A city or region centroid is not a usable base-station location."""
    return bool(_CONCRETE_ADDRESS_RE.search(_value(value)))


_HOUSE_LEVEL_ADDRESS_RE = re.compile(
    "(?:^|[\\s,])(?:\u0434(?:\u043e\u043c)?|\u0437\u0434(?:\u0430\u043d\u0438\u0435)?|\u043a\u043e\u0440\u043f(?:\u0443\u0441)?|\u0441\u0442\u0440(?:\u043e\u0435\u043d\u0438\u0435)?|\u0432\u043b\u0430\u0434\u0435\u043d\u0438\u0435|\u0443\u0447\u0430\u0441\u0442\u043e\u043a|\u0437/\u0443)\\.?\\s*(?:\u2116\\s*)?\\d+[\u0430-\u044fa-z]?(?:[\\s,]|$)",
    re.IGNORECASE,
)


def is_house_level_address(value: object) -> bool:
    """Only house-level results are precise enough for subscriber addresses."""
    address = _value(value)
    return is_concrete_geocoded_address(address) and bool(_HOUSE_LEVEL_ADDRESS_RE.search(address))

def normalize_cell(mcc: object, mnc: object, lac: object, cid: object) -> tuple[str, str, str, str] | None:
    lac_value, cid_value = _value(lac), _value(cid)
    if not lac_value or not cid_value:
        return None
    return (_value(mcc), _value(mnc).lstrip("0") or "0", lac_value, cid_value)


def parse_cell_key(value: object) -> tuple[str, str, str, str] | None:
    parts = [_value(item) for item in str(value or "").split("/")]
    return normalize_cell(*parts) if len(parts) == 4 else None


def _distance_meters(left: dict[str, Any], right: dict[str, Any]) -> float | None:
    try:
        lat1, lon1 = radians(float(left["latitude"])), radians(float(left["longitude"]))
        lat2, lon2 = radians(float(right["latitude"])), radians(float(right["longitude"]))
    except (KeyError, TypeError, ValueError):
        return None
    value = sin((lat2 - lat1) / 2) ** 2 + cos(lat1) * cos(lat2) * sin((lon2 - lon1) / 2) ** 2
    return 6_371_000.0 * 2 * asin(sqrt(value))


def _reconcile_conflict_coordinates(items: list[dict[str, str]], cache: dict[str, dict[str, Any]]) -> dict[str, Any] | None:
    resolved = [cache.get(item["address_norm"], {}) for item in items]
    if len(resolved) != len(items) or any(entry.get("status") != "resolved" or _distance_meters(entry, entry) is None for entry in resolved):
        return None
    if any(
        (_distance_meters(left, right) or float("inf")) > CONFLICT_COORDINATE_RADIUS_M
        for index, left in enumerate(resolved)
        for right in resolved[index + 1:]
    ):
        return None
    return {
        "status": "resolved",
        "latitude": sum(float(entry["latitude"]) for entry in resolved) / len(resolved),
        "longitude": sum(float(entry["longitude"]) for entry in resolved) / len(resolved),
        "display_name": str(resolved[0].get("display_name") or items[0]["address"]),
    }


async def ensure_project_cell_tower_geocoding_tables(db: AsyncSession) -> None:
    await ensure_project_domain_store(db)
    await db.execute(text("""
        CREATE TABLE IF NOT EXISTS geocoder_address_cache (
            address_norm TEXT PRIMARY KEY,
            address TEXT NOT NULL,
            latitude DOUBLE PRECISION,
            longitude DOUBLE PRECISION,
            display_name TEXT,
            status TEXT NOT NULL,
            provider TEXT NOT NULL DEFAULT 'nominatim',
            updated_at TIMESTAMP NOT NULL DEFAULT NOW()
        )
    """))
    await db.execute(text("""
        CREATE TABLE IF NOT EXISTS project_cell_tower_geocoding (
            id BIGSERIAL PRIMARY KEY,
            project_id INTEGER NOT NULL,
            mcc TEXT NOT NULL DEFAULT '',
            mnc TEXT NOT NULL DEFAULT '',
            lac TEXT NOT NULL,
            cid TEXT NOT NULL,
            address TEXT NOT NULL,
            address_norm TEXT NOT NULL,
            latitude DOUBLE PRECISION,
            longitude DOUBLE PRECISION,
            resolved_address TEXT,
            status TEXT NOT NULL,
            source TEXT NOT NULL DEFAULT 'nominatim',
            updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
            UNIQUE (project_id, mcc, mnc, lac, cid, address_norm)
        )
    """))
    await db.execute(text("CREATE INDEX IF NOT EXISTS ix_project_cell_tower_geocoding_cell ON project_cell_tower_geocoding (project_id, mcc, mnc, lac, cid, updated_at DESC)"))


async def clear_project_cell_tower_geocoding(db: AsyncSession, project_id: int) -> int:
    await ensure_project_cell_tower_geocoding_tables(db)
    result = await db.execute(text("DELETE FROM project_cell_tower_geocoding WHERE project_id = :project_id"), {"project_id": project_id})
    return int(result.rowcount or 0)


async def _collect_candidates(db: AsyncSession, project_id: int) -> list[dict[str, str]]:
    result = await db.execute(text("""
        WITH raw_candidates AS (
        SELECT payload ->> 'mcc' AS mcc, payload ->> 'mnc' AS mnc,
               payload ->> 'lac' AS lac, payload ->> 'bs' AS cid,
               payload ->> 'address' AS address
        FROM project_domain_facts
        WHERE project_id = :project_id AND fact_type = 'location_event'
          AND NULLIF(BTRIM(payload ->> 'address'), '') IS NOT NULL
        UNION ALL
        SELECT split_part(fact.payload ->> 'base_station', '/', 1),
               split_part(fact.payload ->> 'base_station', '/', 2),
               split_part(fact.payload ->> 'base_station', '/', 3),
               split_part(fact.payload ->> 'base_station', '/', 4),
               relation.to_key
        FROM project_domain_facts AS fact
        JOIN project_domain_relations AS relation
          ON relation.project_id = fact.project_id
         AND relation.relation_type = 'base_station_location'
         AND relation.from_type = 'base_station'
         AND relation.from_key = BTRIM(fact.payload ->> 'base_station')
        WHERE fact.project_id = :project_id
          AND fact.fact_type = 'telecom_base_station_observation'
          AND NULLIF(BTRIM(fact.payload ->> 'base_station'), '') IS NOT NULL
          AND NULLIF(BTRIM(relation.to_key), '') IS NOT NULL
        UNION ALL
        SELECT split_part(from_key, '/', 1), split_part(from_key, '/', 2),
               split_part(from_key, '/', 3), split_part(from_key, '/', 4), to_key
        FROM project_domain_relations
        WHERE project_id = :project_id AND relation_type = 'base_station_location'
          AND NULLIF(BTRIM(to_key), '') IS NOT NULL
        )
        SELECT DISTINCT mcc, mnc, lac, cid, address
        FROM raw_candidates
    """), {"project_id": project_id})
    unique: dict[tuple[str, str, str, str, str], dict[str, str]] = {}
    for row in result.mappings():
        cell = normalize_cell(row["mcc"], row["mnc"], row["lac"], row["cid"])
        address = _value(row["address"])
        address_norm = normalize_address(address)
        if not cell or not address_norm:
            continue
        key = (*cell, address_norm)
        unique[key] = {"mcc": cell[0], "mnc": cell[1], "lac": cell[2], "cid": cell[3], "address": address, "address_norm": address_norm}
    return list(unique.values())


async def _external_keys(candidates: list[dict[str, str]]) -> set[tuple[str, str, str, str]]:
    resolved: set[tuple[str, str, str, str]] = set()
    for offset in range(0, len(candidates), 500):
        chunk = candidates[offset:offset + 500]
        try:
            rows = await resolve_cell_towers(chunk)
        except Exception:
            continue
        resolved.update(rows.keys())
    return resolved


async def _cached_addresses(db: AsyncSession, address_norms: Iterable[str]) -> dict[str, dict[str, Any]]:
    values = list(address_norms)
    if not values:
        return {}
    result = await db.execute(text("""
        SELECT address_norm, address, latitude, longitude, display_name, status, provider
        FROM geocoder_address_cache WHERE address_norm = ANY(:values)
    """), {"values": values})
    return {row["address_norm"]: dict(row) for row in result.mappings()}


async def _upsert_cache(db: AsyncSession, address_norm: str, address: str, result: Any | None, status: str) -> None:
    await db.execute(text("""
        INSERT INTO geocoder_address_cache (address_norm, address, latitude, longitude, display_name, status, provider, updated_at)
        VALUES (:address_norm, :address, :latitude, :longitude, :display_name, :status, 'nominatim', NOW())
        ON CONFLICT (address_norm) DO UPDATE SET address = EXCLUDED.address, latitude = EXCLUDED.latitude,
            longitude = EXCLUDED.longitude, display_name = EXCLUDED.display_name, status = EXCLUDED.status,
            provider = EXCLUDED.provider, updated_at = NOW()
    """), {"address_norm": address_norm, "address": address,
           "latitude": getattr(result, "latitude", None), "longitude": getattr(result, "longitude", None),
           "display_name": getattr(result, "display_name", None), "status": status})


async def enrich_project_domain_addresses(
    db: AsyncSession,
    project_id: int,
    candidates: Iterable[dict[str, str]],
    progress: ProgressCallback | None = None,
) -> dict[str, int]:
    """Geocode house-level subscriber addresses and write coordinates into domain entities."""
    await ensure_project_cell_tower_geocoding_tables(db)
    unique: dict[str, dict[str, str]] = {}
    skipped = 0
    for candidate in candidates:
        address = _value(candidate.get("address"))
        address_key = _value(candidate.get("address_key")) or normalize_address(address)
        address_norm = normalize_address(address)
        if not address or not address_key or not is_house_level_address(address):
            skipped += 1
            continue
        unique.setdefault(address_norm, {"address": address, "address_key": address_key})

    cache = await _cached_addresses(db, unique)
    pending = {key: item for key, item in unique.items() if key not in cache}
    resolved = 0
    not_found = 0
    failed = 0
    geocoder = NominatimGeocoder() if settings.GEOCODER_ENABLED else None
    total = max(1, len(pending))
    for index, (address_norm, item) in enumerate(pending.items(), start=1):
        found = None
        status = "not_found"
        try:
            if geocoder is not None:
                found = await geocoder.search(item["address"])
            if found is not None and is_house_level_address(getattr(found, "display_name", None)):
                status = "resolved"
                resolved += 1
            elif found is not None:
                status = "not_precise"
                not_found += 1
            else:
                not_found += 1
        except Exception:
            status = "failed"
            failed += 1
        await _upsert_cache(db, address_norm, item["address"], found if status == "resolved" else None, status)
        cache[address_norm] = {
            "status": status,
            "latitude": getattr(found, "latitude", None) if status == "resolved" else None,
            "longitude": getattr(found, "longitude", None) if status == "resolved" else None,
            "display_name": getattr(found, "display_name", None) if status == "resolved" else None,
        }
        if progress:
            await progress(86 + int(3 * index / total), f"\u0413\u0435\u043e\u043a\u043e\u0434\u0438\u0440\u043e\u0432\u0430\u043d\u0438\u0435 \u0430\u0434\u0440\u0435\u0441\u043e\u0432 \u0430\u0431\u043e\u043d\u0435\u043d\u0442\u043e\u0432: {index} / {len(pending)}")

    updated = 0
    for address_norm, item in unique.items():
        cached = cache.get(address_norm) or {}
        if cached.get("status") != "resolved":
            continue
        attributes = json.dumps(
            {
                "address": item["address"],
                "latitude": cached.get("latitude"),
                "longitude": cached.get("longitude"),
                "resolved_address": cached.get("display_name"),
                "geocoder_provider": "nominatim",
            },
            ensure_ascii=False,
        )
        result = await db.execute(text("""
            UPDATE project_domain_entities
            SET attributes = COALESCE(attributes, '{}'::jsonb) || CAST(:attributes AS jsonb), updated_at = NOW()
            WHERE project_id = :project_id AND type_id = 'address' AND external_key = :address_key
        """), {"project_id": project_id, "address_key": item["address_key"], "attributes": attributes})
        updated += int(result.rowcount or 0)

    return {
        "candidates": len(unique),
        "cached": len(unique) - len(pending),
        "resolved": resolved,
        "not_found": not_found,
        "failed": failed,
        "skipped_not_house_level": skipped,
        "entities_updated": updated,
    }


async def _write_supplement(db: AsyncSession, candidate: dict[str, str], cached: dict[str, Any]) -> None:
    await db.execute(text("""
        INSERT INTO project_cell_tower_geocoding
          (project_id, mcc, mnc, lac, cid, address, address_norm, latitude, longitude, resolved_address, status, source, updated_at)
        VALUES (:project_id, :mcc, :mnc, :lac, :cid, :address, :address_norm, :latitude, :longitude, :resolved_address, :status, 'nominatim', NOW())
        ON CONFLICT (project_id, mcc, mnc, lac, cid, address_norm) DO UPDATE SET
          address = EXCLUDED.address, latitude = EXCLUDED.latitude, longitude = EXCLUDED.longitude,
          resolved_address = EXCLUDED.resolved_address, status = EXCLUDED.status, source = EXCLUDED.source, updated_at = NOW()
    """), {**candidate, "project_id": candidate["project_id"], "latitude": cached.get("latitude"),
           "longitude": cached.get("longitude"), "resolved_address": cached.get("display_name"), "status": cached["status"]})


async def _write_common_reference(db: AsyncSession, project_id: int, candidates: list[dict[str, Any]]) -> int:
    """Persist resolved address coordinates so later projects can use them too."""
    rows = [
        {
            "mcc": item["mcc"], "mnc": item["mnc"], "lac": item["lac"], "cid": item["cid"],
            "address": item["address"], "address_norm": item["address_norm"],
            "latitude": item["latitude"], "longitude": item["longitude"],
            "resolved_address": item.get("resolved_address") or item["address"],
        }
        for item in candidates
        if item.get("latitude") is not None and item.get("longitude") is not None
    ]
    if not rows:
        return 0

    insert_sql = text("""
        WITH source_rows AS (
          SELECT * FROM json_to_recordset(CAST(:rows AS json)) AS r(
            mcc TEXT, mnc TEXT, lac TEXT, cid TEXT, address TEXT, address_norm TEXT,
            latitude DOUBLE PRECISION, longitude DOUBLE PRECISION, resolved_address TEXT
          )
        ), missing_rows AS (
          SELECT DISTINCT ON (NULLIF(r.mcc, ''), NULLIF(r.mnc, ''), r.lac, r.cid, r.address_norm, r.latitude, r.longitude)
            r.*
          FROM source_rows r
          WHERE NOT EXISTS (
            SELECT 1 FROM cell_tower_reference c
            WHERE c.lac = r.lac AND c.cid = r.cid
              AND c.mcc IS NOT DISTINCT FROM NULLIF(r.mcc, '')
              AND c.mnc IS NOT DISTINCT FROM NULLIF(r.mnc, '')
              AND c.address_norm IS NOT DISTINCT FROM r.address_norm
              AND c.latitude IS NOT DISTINCT FROM r.latitude
              AND c.longitude IS NOT DISTINCT FROM r.longitude
          )
        ), numbered AS (
          SELECT m.*, row_number() OVER (ORDER BY m.lac, m.cid, m.address_norm) AS rn
          FROM missing_rows m
        ), max_id AS (
          SELECT coalesce(MAX(id), 0) AS base_id FROM cell_tower_reference
        )
        INSERT INTO cell_tower_reference (
          id, mcc, mnc, lac, cid, g, latitude, longitude, azimuth, height,
          address, address_norm, beg_date, end_date, region_id, ref_source, loaded_at
        )
        SELECT
          max_id.base_id + numbered.rn,
          NULLIF(numbered.mcc, ''), NULLIF(numbered.mnc, ''), numbered.lac, numbered.cid,
          NULL, numbered.latitude, numbered.longitude, NULL, NULL,
          numbered.resolved_address, numbered.address_norm, NULL, NULL, NULL,
          concat('nominatim [project_', CAST(:project_id AS text), '_addr_enrich]'), NOW()
        FROM numbered CROSS JOIN max_id
    """)
    inserted = 0
    # Large projects can contain thousands of resolved addresses. Keeping the
    # JSON payload bounded avoids a single oversized database statement.
    for offset in range(0, len(rows), 250):
        batch = rows[offset:offset + 250]
        result = await db.execute(
            insert_sql,
            {"rows": json.dumps(batch, ensure_ascii=False), "project_id": str(project_id)},
        )
        inserted += int(result.rowcount or 0)
    return inserted


async def _enrich_project_cell_towers(db: AsyncSession, project_id: int, progress: ProgressCallback | None = None) -> dict[str, int]:
    await ensure_project_cell_tower_geocoding_tables(db)
    if progress:
        await progress(2, "Сбор кандидатов БС")
    candidates = await _collect_candidates(db, project_id)
    if progress:
        await progress(8, "\u0410\u0433\u0440\u0435\u0433\u0430\u0446\u0438\u044f \u0430\u0434\u0440\u0435\u0441\u043e\u0432 \u0411\u0421")
    by_cell: dict[tuple[str, str, str, str], list[dict[str, str]]] = defaultdict(list)
    for item in candidates:
        by_cell[(item["mcc"], item["mnc"], item["lac"], item["cid"])].append(item)
    conflicts = {cell for cell, values in by_cell.items() if len({item["address_norm"] for item in values}) > 1}
    external = await _external_keys(candidates)
    active = [item for item in candidates if (item["mcc"], item["mnc"], item["lac"], item["cid"]) not in conflicts | external]
    conflict_items = [item for item in candidates if (item["mcc"], item["mnc"], item["lac"], item["cid"]) in conflicts - external]
    geocoding_candidates = active + conflict_items
    cache = await _cached_addresses(db, {item["address_norm"] for item in geocoding_candidates})
    pending = {item["address_norm"]: item["address"] for item in geocoding_candidates if item["address_norm"] not in cache}
    if not settings.GEOCODER_ENABLED:
        # A disabled service is not an address miss. Do not poison the cache with not_found.
        return {
            "candidates": len(candidates),
            "unique_addresses": len({item["address_norm"] for item in geocoding_candidates}),
            "external_reference_matches": len(external),
            "conflicting_cells": len(conflicts),
            "written": 0,
            "common_reference_added": 0,
            "resolved_addresses": 0,
            "not_found_addresses": 0,
            "failed_addresses": 0,
            "cached_addresses": len(cache),
            "skipped_geocoding": len(pending),
            "geocoder_enabled": False,
        }
    geocoder = NominatimGeocoder()
    resolved, not_found, failed = 0, 0, 0
    total = max(1, len(pending))
    concurrency = max(1, min(16, int(settings.GEOCODER_MAX_CONCURRENCY or 1)))

    async def resolve_address(address_norm: str, address: str) -> tuple[str, str, Any | None, str, bool]:
        try:
            found = await geocoder.search(address)
            if found is not None and not is_concrete_geocoded_address(getattr(found, "display_name", None)):
                found = None
                status = "not_precise"
            else:
                status = "resolved" if found else "not_found"
            return address_norm, address, found, status, False
        except Exception:
            return address_norm, address, None, "failed", True

    processed = 0
    pending_items = list(pending.items())
    for offset in range(0, len(pending_items), concurrency):
        chunk = pending_items[offset:offset + concurrency]
        outcomes = await asyncio.gather(*(resolve_address(address_norm, address) for address_norm, address in chunk))
        for address_norm, address, found, status, request_failed in outcomes:
            processed += 1
            if request_failed:
                failed += 1
            else:
                await _upsert_cache(db, address_norm, address, found, status)
                cache[address_norm] = {"status": status, "latitude": getattr(found, "latitude", None), "longitude": getattr(found, "longitude", None), "display_name": getattr(found, "display_name", None)}
                resolved += int(status == "resolved")
                not_found += int(status in {"not_found", "not_precise"})
            if progress:
                await progress(12 + int(78 * processed / total), f"\u0413\u0435\u043e\u043a\u043e\u0434\u0438\u0440\u043e\u0432\u0430\u043d\u0438\u0435 \u0430\u0434\u0440\u0435\u0441\u043e\u0432: {processed} / {len(pending)}")
    written = 0
    common_reference_candidates: list[dict[str, Any]] = []
    for item in active:
        cached = cache.get(item["address_norm"])
        if cached:
            item["project_id"] = project_id
            await _write_supplement(db, item, cached)
            written += 1
            if cached.get("status") == "resolved":
                common_reference_candidates.append({
                    **item,
                    "latitude": cached.get("latitude"),
                    "longitude": cached.get("longitude"),
                    "resolved_address": cached.get("display_name"),
                })
    reconciled_conflicts = 0
    unresolved_conflicts = 0
    for cell in conflicts - external:
        variants = by_cell[cell]
        reconciled = _reconcile_conflict_coordinates(variants, cache)
        if reconciled is None:
            unresolved_conflicts += 1
            continue
        reconciled_conflicts += 1
        for item in variants:
            item["project_id"] = project_id
            await _write_supplement(db, item, reconciled)
            written += 1
        common_reference_candidates.append({
            **variants[0],
            "latitude": reconciled["latitude"],
            "longitude": reconciled["longitude"],
            "resolved_address": reconciled["display_name"],
        })
    # Project mappings and the global reference have different purposes. A
    # failure while extending the shared reference must not discard already
    # resolved coordinates for the project that started this job.
    await db.commit()
    common_reference_error: str | None = None
    try:
        common_reference_added = await _write_common_reference(db, project_id, common_reference_candidates)
        await db.commit()
    except Exception as exc:
        await db.rollback()
        common_reference_added = 0
        common_reference_error = f"{type(exc).__name__}: {exc}".strip()
    result = {"candidates": len(candidates), "unique_addresses": len({item["address_norm"] for item in geocoding_candidates}),
               "external_reference_matches": len(external), "conflicting_cells": len(conflicts), "written": written,
               "reconciled_conflicts": reconciled_conflicts, "unresolved_conflicts": unresolved_conflicts,
              "common_reference_added": common_reference_added,
              "resolved_addresses": resolved, "not_found_addresses": not_found, "failed_addresses": failed,
              "cached_addresses": max(0, len(cache) - resolved - not_found)}
    if common_reference_error:
        result["common_reference_error"] = common_reference_error
    return result


async def enrich_project_cell_towers(project_id: int, progress: ProgressCallback | None = None, db: AsyncSession | None = None) -> dict[str, int]:
    if db is not None:
        return await _enrich_project_cell_towers(db, project_id, progress)
    async with AsyncSessionLocal() as own_db:
        result = await _enrich_project_cell_towers(own_db, project_id, progress)
        await own_db.commit()
        return result


async def resolve_project_cell_towers(project_id: int, cells: list[dict[str, Any]]) -> dict[tuple[str, str, str, str], dict[str, Any]]:
    requested = {normalize_cell(item.get("mcc"), item.get("mnc"), item.get("lac"), item.get("bs") or item.get("cid")) for item in cells}
    requested.discard(None)
    if not requested:
        return {}
    async with AsyncSessionLocal() as db:
        await ensure_project_cell_tower_geocoding_tables(db)
        rows: dict[tuple[str, str, str, str], dict[str, Any]] = {}
        for offset in range(0, len(requested), 500):
            chunk = list(requested)[offset:offset + 500]
            values_sql = ", ".join(f"(:mcc{i}, :mnc{i}, :lac{i}, :cid{i})" for i in range(len(chunk)))
            params: dict[str, Any] = {"project_id": project_id}
            for i, (mcc, mnc, lac, cid) in enumerate(chunk):
                params.update({f"mcc{i}": mcc, f"mnc{i}": mnc, f"lac{i}": lac, f"cid{i}": cid})
            result = await db.execute(text(f"""
                SELECT DISTINCT ON (g.mcc, g.mnc, g.lac, g.cid) g.mcc, g.mnc, g.lac, g.cid,
                    g.latitude, g.longitude, g.resolved_address AS address
                FROM project_cell_tower_geocoding g
                JOIN (VALUES {values_sql}) AS r(mcc,mnc,lac,cid)
                  ON (g.mcc,g.mnc,g.lac,g.cid) = (r.mcc,r.mnc,r.lac,r.cid)
                WHERE g.project_id = :project_id AND g.status = 'resolved'
                ORDER BY g.mcc, g.mnc, g.lac, g.cid, g.updated_at DESC
            """), params)
            for row in result.mappings():
                mapped = dict(row)
                if not is_concrete_geocoded_address(mapped.get("address")):
                    continue
                rows[(mapped["mcc"], mapped["mnc"], mapped["lac"], mapped["cid"])] = mapped
        await db.commit()
    return rows


async def resolve_project_address_coordinates(project_id: int, cells: list[dict[str, Any]]) -> dict[str, dict[str, Any]]:
    """Return cached project coordinates keyed by the source address.

    Cell identifiers in source files occasionally differ in MCC/MNC formatting while
    the address is identical. Address matching is a safe fallback after the exact
    cell match and lets route analysis reuse completed geocoding work.
    """
    requested = {normalize_address(item.get("address")) for item in cells}
    requested.discard("")
    if not requested:
        return {}

    async with AsyncSessionLocal() as db:
        await ensure_project_cell_tower_geocoding_tables(db)
        resolved: dict[str, dict[str, Any]] = {}
        for offset in range(0, len(requested), 500):
            chunk = list(requested)[offset:offset + 500]
            result = await db.execute(text("""
                SELECT DISTINCT ON (address_norm)
                    address_norm, latitude, longitude,
                    COALESCE(resolved_address, address) AS address
                FROM project_cell_tower_geocoding
                WHERE project_id = :project_id
                  AND status = 'resolved'
                  AND address_norm = ANY(:values)
                ORDER BY address_norm, updated_at DESC
            """), {"project_id": project_id, "values": chunk})
            for row in result.mappings():
                mapped = dict(row)
                if is_concrete_geocoded_address(mapped.get("address")):
                    resolved[mapped["address_norm"]] = mapped

        missing = [item for item in requested if item not in resolved]
        if missing:
            result = await db.execute(text("""
                SELECT address_norm, latitude, longitude,
                    COALESCE(display_name, address) AS address
                FROM geocoder_address_cache
                WHERE status = 'resolved' AND address_norm = ANY(:values)
            """), {"values": missing})
            for row in result.mappings():
                mapped = dict(row)
                if is_concrete_geocoded_address(mapped.get("address")):
                    resolved[mapped["address_norm"]] = mapped
        await db.commit()
    return resolved
