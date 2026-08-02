from __future__ import annotations

import re
from collections import defaultdict
from datetime import datetime, timezone
from typing import Any, Awaitable, Callable, Iterable

from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import AsyncSessionLocal
from app.services.cell_tower_reference_provider import resolve_cell_towers
from app.services.geocoding_service import NominatimGeocoder
from app.services.project_domain_store import ensure_project_domain_store


ProgressCallback = Callable[[int, str], Awaitable[None]]


def _value(value: object) -> str:
    result = str(value or "").strip()
    return "" if result.casefold() in {"", "null", "none", "n/a", "na", "-"} else result


def normalize_address(value: object) -> str:
    return re.sub(r"\s+", " ", _value(value).casefold()).strip(" ,;.")


def normalize_cell(mcc: object, mnc: object, lac: object, cid: object) -> tuple[str, str, str, str] | None:
    lac_value, cid_value = _value(lac), _value(cid)
    if not lac_value or not cid_value:
        return None
    return (_value(mcc), _value(mnc).lstrip("0") or "0", lac_value, cid_value)


def parse_cell_key(value: object) -> tuple[str, str, str, str] | None:
    parts = [_value(item) for item in str(value or "").split("/")]
    return normalize_cell(*parts) if len(parts) == 4 else None


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
        SELECT payload ->> 'mcc' AS mcc, payload ->> 'mnc' AS mnc,
               payload ->> 'lac' AS lac, payload ->> 'bs' AS cid,
               payload ->> 'address' AS address
        FROM project_domain_facts
        WHERE project_id = :project_id AND fact_type = 'location_event'
          AND NULLIF(BTRIM(payload ->> 'address'), '') IS NOT NULL
        UNION ALL
        SELECT split_part(from_key, '/', 1), split_part(from_key, '/', 2),
               split_part(from_key, '/', 3), split_part(from_key, '/', 4), to_key
        FROM project_domain_relations
        WHERE project_id = :project_id AND relation_type = 'base_station_location'
          AND NULLIF(BTRIM(to_key), '') IS NOT NULL
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


async def _enrich_project_cell_towers(db: AsyncSession, project_id: int, progress: ProgressCallback | None = None) -> dict[str, int]:
    await ensure_project_cell_tower_geocoding_tables(db)
    candidates = await _collect_candidates(db, project_id)
    if progress:
        await progress(8, "\u0410\u0433\u0440\u0435\u0433\u0430\u0446\u0438\u044f \u0430\u0434\u0440\u0435\u0441\u043e\u0432 \u0411\u0421")
    by_cell: dict[tuple[str, str, str, str], list[dict[str, str]]] = defaultdict(list)
    for item in candidates:
        by_cell[(item["mcc"], item["mnc"], item["lac"], item["cid"])].append(item)
    conflicts = {cell for cell, values in by_cell.items() if len({item["address_norm"] for item in values}) > 1}
    external = await _external_keys(candidates)
    active = [item for item in candidates if (item["mcc"], item["mnc"], item["lac"], item["cid"]) not in conflicts | external]
    cache = await _cached_addresses(db, {item["address_norm"] for item in active})
    pending = {item["address_norm"]: item["address"] for item in active if item["address_norm"] not in cache}
    geocoder = NominatimGeocoder()
    resolved, not_found, failed = 0, 0, 0
    total = max(1, len(pending))
    for index, (address_norm, address) in enumerate(pending.items(), start=1):
        try:
            found = await geocoder.search(address)
            status = "resolved" if found else "not_found"
            await _upsert_cache(db, address_norm, address, found, status)
            cache[address_norm] = {"status": status, "latitude": getattr(found, "latitude", None), "longitude": getattr(found, "longitude", None), "display_name": getattr(found, "display_name", None)}
            resolved += int(found is not None)
            not_found += int(found is None)
        except Exception:
            failed += 1
        if progress:
            await progress(12 + int(78 * index / total), f"\u0413\u0435\u043e\u043a\u043e\u0434\u0438\u0440\u043e\u0432\u0430\u043d\u0438\u0435 \u0430\u0434\u0440\u0435\u0441\u043e\u0432: {index} / {len(pending)}")
    written = 0
    for item in active:
        cached = cache.get(item["address_norm"])
        if cached:
            item["project_id"] = project_id
            await _write_supplement(db, item, cached)
            written += 1
    return {"candidates": len(candidates), "unique_addresses": len({item["address_norm"] for item in active}),
            "external_reference_matches": len(external), "conflicting_cells": len(conflicts), "written": written,
            "resolved_addresses": resolved, "not_found_addresses": not_found, "failed_addresses": failed,
            "cached_addresses": max(0, len(cache) - resolved - not_found)}


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
                rows[(row["mcc"], row["mnc"], row["lac"], row["cid"])] = dict(row)
        await db.commit()
    return rows
