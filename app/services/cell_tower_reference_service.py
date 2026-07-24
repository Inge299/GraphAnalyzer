from __future__ import annotations

from datetime import datetime
from pathlib import Path
from typing import Any

from fastapi import HTTPException
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.services.project_data_import_utils import normalize_address, open_csv_reader

DATA_ROOT = Path("/app/data")


def _parse_float(value: str) -> float | None:
    clean = (value or "").strip()
    if not clean:
        return None
    try:
        return float(clean.replace(",", "."))
    except ValueError:
        return None


def _parse_date(value: str):
    clean = (value or "").strip()
    if not clean:
        return None
    for fmt in ("%Y-%m-%d", "%d.%m.%Y"):
        try:
            return datetime.strptime(clean, fmt).date()
        except ValueError:
            continue
    return None


async def load_cell_tower_reference(db: AsyncSession, source_path: str) -> dict[str, Any]:
    csv_path = Path((source_path or "").strip())
    if not csv_path.is_absolute():
        csv_path = (DATA_ROOT / csv_path).resolve()
    else:
        csv_path = csv_path.resolve()

    root = DATA_ROOT.resolve()
    if root not in csv_path.parents and csv_path != root:
        raise HTTPException(status_code=400, detail=f"Path must be inside {root}")
    if not csv_path.exists() or not csv_path.is_file():
        raise HTTPException(status_code=400, detail=f"File not found: {csv_path}")

    reader = open_csv_reader(csv_path, ",")
    rows: list[dict[str, Any]] = []
    loaded_at = datetime.utcnow()

    for row in reader:
        raw_id = (row.get("id") or "").strip()
        if not raw_id:
            continue
        try:
            row_id = int(raw_id)
        except ValueError:
            continue
        rows.append(
            {
                "id": row_id,
                "mcc": (row.get("MCC") or "").strip() or None,
                "mnc": (row.get("MNC") or "").strip() or None,
                "lac": (row.get("LAC") or "").strip() or None,
                "cid": (row.get("CID") or "").strip() or None,
                "g": (row.get("G") or "").strip() or None,
                "latitude": _parse_float(row.get("Lat") or ""),
                "longitude": _parse_float(row.get("Lon") or ""),
                "azimuth": _parse_float(row.get("Azimuth") or ""),
                "height": _parse_float(row.get("Height") or ""),
                "address": (row.get("Address") or "").strip() or None,
                "address_norm": normalize_address((row.get("Address") or "").strip()),
                "beg_date": _parse_date(row.get("BegDate") or ""),
                "end_date": _parse_date(row.get("EndDate") or ""),
                "region_id": (row.get("RegionID") or "").strip() or None,
                "ref_source": (row.get("ref_source") or "").strip() or None,
                "loaded_at": loaded_at,
            }
        )

    await db.execute(text("TRUNCATE TABLE cell_tower_reference"))

    batch_size = 5000
    for i in range(0, len(rows), batch_size):
        chunk = rows[i:i + batch_size]
        if not chunk:
            continue
        await db.execute(
            text(
                """
                INSERT INTO cell_tower_reference (
                    id, mcc, mnc, lac, cid, g, latitude, longitude, azimuth, height,
                    address, address_norm, beg_date, end_date, region_id, ref_source, loaded_at
                ) VALUES (
                    :id, :mcc, :mnc, :lac, :cid, :g, :latitude, :longitude, :azimuth, :height,
                    :address, :address_norm, :beg_date, :end_date, :region_id, :ref_source, :loaded_at
                )
                """
            ),
            chunk,
        )

    return {
        "source_path": str(csv_path),
        "inserted_rows": len(rows),
        "loaded_at": loaded_at.isoformat(),
    }


async def enrich_cell_tower_reference_from_project_addresses(db: AsyncSession, project_id: int) -> dict[str, Any]:
    await db.execute(text("DROP TABLE IF EXISTS tmp_project_address_keys"))
    await db.execute(text("DROP TABLE IF EXISTS tmp_unresolved_address_keys"))
    await db.execute(text("DROP TABLE IF EXISTS tmp_ref_by_address"))
    await db.execute(text("DROP TABLE IF EXISTS tmp_matched_address_keys"))

    await db.execute(
        text(
            """
            CREATE TEMP TABLE tmp_project_address_keys ON COMMIT DROP AS
            SELECT DISTINCT ON (
              coalesce(NULLIF(BTRIM(e.mcc), ''), ''),
              coalesce(NULLIF(BTRIM(e.mnc), ''), ''),
              NULLIF(BTRIM(e.lac), ''),
              NULLIF(BTRIM(e.bs), ''),
              coalesce(NULLIF(BTRIM(e.address_norm), ''), regexp_replace(lower(coalesce(NULLIF(BTRIM(e.address), ''), '')), '[^[:alnum:]]', '', 'g'))
            )
              NULLIF(BTRIM(e.mcc), '') AS mcc,
              NULLIF(BTRIM(e.mnc), '') AS mnc,
              NULLIF(BTRIM(e.lac), '') AS lac,
              NULLIF(BTRIM(e.bs), '') AS cid,
              NULLIF(BTRIM(e.address), '') AS address,
              coalesce(NULLIF(BTRIM(e.address_norm), ''), regexp_replace(lower(coalesce(NULLIF(BTRIM(e.address), ''), '')), '[^[:alnum:]]', '', 'g')) AS address_norm,
              e.event_time
            FROM project_location_events_raw e
            WHERE e.project_id = :project_id
              AND NULLIF(BTRIM(e.address), '') IS NOT NULL
              AND NULLIF(BTRIM(e.lac), '') IS NOT NULL
              AND NULLIF(BTRIM(e.bs), '') IS NOT NULL
            ORDER BY
              coalesce(NULLIF(BTRIM(e.mcc), ''), ''),
              coalesce(NULLIF(BTRIM(e.mnc), ''), ''),
              NULLIF(BTRIM(e.lac), ''),
              NULLIF(BTRIM(e.bs), ''),
              coalesce(NULLIF(BTRIM(e.address_norm), ''), regexp_replace(lower(coalesce(NULLIF(BTRIM(e.address), ''), '')), '[^[:alnum:]]', '', 'g')),
              e.event_time DESC
            """
        ),
        {"project_id": project_id},
    )
    await db.execute(text("CREATE INDEX tmp_project_address_keys_address_norm_idx ON tmp_project_address_keys (address_norm)"))
    await db.execute(text("CREATE INDEX tmp_project_address_keys_lac_cid_idx ON tmp_project_address_keys (lac, cid, mcc, mnc)"))

    raw_candidates = int((await db.execute(text("SELECT COUNT(*) FROM tmp_project_address_keys"))).scalar() or 0)

    await db.execute(
        text(
            """
            CREATE TEMP TABLE tmp_unresolved_address_keys ON COMMIT DROP AS
            SELECT r.*
            FROM tmp_project_address_keys r
            WHERE r.address_norm IS NOT NULL
              AND r.address_norm <> ''
              AND NOT EXISTS (
                SELECT 1
                FROM cell_tower_reference c
                WHERE c.lac = r.lac
                  AND c.cid = r.cid
                  AND c.latitude IS NOT NULL
                  AND c.longitude IS NOT NULL
                  AND (
                    (r.mcc IS NOT NULL AND r.mnc IS NOT NULL AND c.mcc IS NOT DISTINCT FROM r.mcc AND c.mnc IS NOT DISTINCT FROM r.mnc)
                    OR (r.mcc IS NULL OR r.mnc IS NULL)
                  )
              )
            """
        )
    )
    await db.execute(text("CREATE INDEX tmp_unresolved_address_keys_address_norm_idx ON tmp_unresolved_address_keys (address_norm)"))

    await db.execute(
        text(
            """
            CREATE TEMP TABLE tmp_ref_by_address ON COMMIT DROP AS
            WITH relevant_norms AS (
              SELECT DISTINCT address_norm
              FROM tmp_unresolved_address_keys
            )
            SELECT DISTINCT ON (address_norm)
              address_norm,
              latitude,
              longitude,
              azimuth,
              height,
              beg_date,
              end_date,
              region_id,
              ref_source,
              id
            FROM (
              SELECT
                coalesce(NULLIF(BTRIM(c.address_norm), ''), regexp_replace(lower(coalesce(c.address, '')), '[^[:alnum:]]', '', 'g')) AS address_norm,
                c.latitude,
                c.longitude,
                c.azimuth,
                c.height,
                c.beg_date,
                c.end_date,
                c.region_id,
                c.ref_source,
                c.id
              FROM cell_tower_reference c
              JOIN relevant_norms r
                ON coalesce(NULLIF(BTRIM(c.address_norm), ''), regexp_replace(lower(coalesce(c.address, '')), '[^[:alnum:]]', '', 'g')) = r.address_norm
              WHERE c.latitude IS NOT NULL
                AND c.longitude IS NOT NULL
            ) refs
            ORDER BY address_norm, id DESC
            """
        )
    )
    await db.execute(text("CREATE INDEX tmp_ref_by_address_address_norm_idx ON tmp_ref_by_address (address_norm)"))

    await db.execute(
        text(
            """
            CREATE TEMP TABLE tmp_matched_address_keys ON COMMIT DROP AS
            SELECT
              u.mcc,
              u.mnc,
              u.lac,
              u.cid,
              u.address,
              u.address_norm,
              r.latitude,
              r.longitude,
              r.azimuth,
              r.height,
              r.beg_date,
              r.end_date,
              r.region_id,
              r.ref_source
            FROM tmp_unresolved_address_keys u
            JOIN tmp_ref_by_address r ON r.address_norm = u.address_norm
            """
        )
    )
    matched_candidates = int((await db.execute(text("SELECT COUNT(*) FROM tmp_matched_address_keys"))).scalar() or 0)

    inserted_result = await db.execute(
        text(
            """
            WITH to_insert AS (
              SELECT DISTINCT ON (
                coalesce(m.mcc, ''),
                coalesce(m.mnc, ''),
                m.lac,
                m.cid,
                coalesce(m.address, ''),
                m.latitude,
                m.longitude
              )
                m.*
              FROM tmp_matched_address_keys m
              WHERE NOT EXISTS (
                SELECT 1
                FROM cell_tower_reference c
                WHERE c.lac = m.lac
                  AND c.cid = m.cid
                  AND c.mcc IS NOT DISTINCT FROM m.mcc
                  AND c.mnc IS NOT DISTINCT FROM m.mnc
                  AND c.address IS NOT DISTINCT FROM m.address
                  AND c.latitude IS NOT DISTINCT FROM m.latitude
                  AND c.longitude IS NOT DISTINCT FROM m.longitude
              )
              ORDER BY
                coalesce(m.mcc, ''),
                coalesce(m.mnc, ''),
                m.lac,
                m.cid,
                coalesce(m.address, ''),
                m.latitude,
                m.longitude
            ),
            numbered AS (
              SELECT
                t.*,
                row_number() OVER (
                  ORDER BY coalesce(t.mcc, ''), coalesce(t.mnc, ''), t.lac, t.cid, coalesce(t.address, '')
                ) AS rn
              FROM to_insert t
            ),
            max_id AS (
              SELECT coalesce(MAX(id), 0) AS base_id FROM cell_tower_reference
            )
            INSERT INTO cell_tower_reference (
              id, mcc, mnc, lac, cid, g, latitude, longitude, azimuth, height,
              address, address_norm, beg_date, end_date, region_id, ref_source, loaded_at
            )
            SELECT
              max_id.base_id + n.rn,
              n.mcc,
              n.mnc,
              n.lac,
              n.cid,
              NULL,
              n.latitude,
              n.longitude,
              n.azimuth,
              n.height,
              n.address,
              n.address_norm,
              n.beg_date,
              n.end_date,
              n.region_id,
              concat(coalesce(n.ref_source, 'address_match'), ' [project_', CAST(:project_id AS text), '_addr_enrich]'),
              NOW()
            FROM numbered n
            CROSS JOIN max_id
            """
        ),
        {"project_id": str(project_id)},
    )
    inserted_rows = int(inserted_result.rowcount or 0)

    return {
        "project_id": project_id,
        "raw_candidates": raw_candidates,
        "matched_by_address": matched_candidates,
        "inserted_rows": int(inserted_rows),
    }


async def get_cell_tower_reference_stats(db: AsyncSession) -> dict[str, Any]:
    count_result = await db.execute(text("SELECT COUNT(*) FROM cell_tower_reference"))
    max_result = await db.execute(text("SELECT MAX(loaded_at) FROM cell_tower_reference"))
    last_loaded_at = max_result.scalar()
    return {
        "cell_tower_reference_count": int(count_result.scalar() or 0),
        "last_loaded_at": last_loaded_at.isoformat() if last_loaded_at else None,
    }
