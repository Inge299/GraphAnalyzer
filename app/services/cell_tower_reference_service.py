from __future__ import annotations

import csv
from contextlib import contextmanager
from datetime import datetime
from pathlib import Path
from typing import Any, Iterator

from fastapi import HTTPException
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import AsyncSessionLocal
from app.services.project_data_import_utils import KNOWN_ENCODINGS, normalize_address

DATA_ROOT = Path("/app/data")


@contextmanager
def _open_streaming_csv_reader(path: Path, delimiter: str = ",") -> Iterator[csv.DictReader]:
    for encoding in KNOWN_ENCODINGS:
        try:
            with path.open("r", encoding=encoding, newline="") as fh:
                reader = csv.DictReader(fh, delimiter=delimiter)
                if reader.fieldnames:
                    yield reader
                    return
        except UnicodeDecodeError:
            continue

    with path.open("r", encoding="latin-1", errors="replace", newline="") as fh:
        yield csv.DictReader(fh, delimiter=delimiter)


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


def _cell_value(value: object) -> str:
    return str(value or "").strip()


async def resolve_local_cell_towers(cells: list[dict[str, Any]]) -> dict[tuple[str, str, str, str], dict[str, Any]]:
    """Resolve cells from the locally loaded reference without an external DSN."""
    requested = {
        (
            _cell_value(item.get("mcc")),
            _cell_value(item.get("mnc")).lstrip("0") or "0",
            _cell_value(item.get("lac")),
            _cell_value(item.get("bs") or item.get("cid")),
        )
        for item in cells
    }
    requested = {item for item in requested if item[2] and item[3]}
    if not requested:
        return {}

    resolved: dict[tuple[str, str, str, str], dict[str, Any]] = {}
    async with AsyncSessionLocal() as db:
        for offset in range(0, len(requested), 500):
            chunk = list(requested)[offset:offset + 500]
            values_sql = ", ".join(f"(:mcc{i}, :mnc{i}, :lac{i}, :cid{i})" for i in range(len(chunk)))
            params: dict[str, Any] = {}
            for i, (mcc, mnc, lac, cid) in enumerate(chunk):
                params.update({f"mcc{i}": mcc, f"mnc{i}": mnc, f"lac{i}": lac, f"cid{i}": cid})
            result = await db.execute(text(f"""
                WITH requested(mcc, mnc, lac, cid) AS (VALUES {values_sql}),
                candidates AS (
                    SELECT
                        r.mcc AS request_mcc, r.mnc AS request_mnc, r.lac AS request_lac, r.cid AS request_cid,
                        tower.latitude, tower.longitude, tower.address,
                        row_number() OVER (
                            PARTITION BY r.mcc, r.mnc, r.lac, r.cid
                            ORDER BY CASE WHEN r.mcc <> '' AND COALESCE(tower.mcc, '') = r.mcc THEN 0 ELSE 1 END,
                                     CASE WHEN r.mnc <> '' AND LTRIM(COALESCE(tower.mnc, ''), '0') = r.mnc THEN 0 ELSE 1 END,
                                     tower.id
                        ) AS rank
                    FROM requested r
                    JOIN cell_tower_reference tower
                      ON tower.lac = r.lac
                     AND tower.cid = r.cid
                     AND (r.mcc = '' OR COALESCE(tower.mcc, '') = r.mcc)
                     AND (r.mnc = '' OR LTRIM(COALESCE(tower.mnc, ''), '0') = r.mnc)
                    WHERE tower.latitude IS NOT NULL AND tower.longitude IS NOT NULL
                )
                SELECT request_mcc, request_mnc, request_lac, request_cid, latitude, longitude, address
                FROM candidates
                WHERE rank = 1
            """), params)
            for row in result.mappings():
                key = (row["request_mcc"], row["request_mnc"], row["request_lac"], row["request_cid"])
                resolved[key] = {
                    "latitude": float(row["latitude"]),
                    "longitude": float(row["longitude"]),
                    "address": _cell_value(row["address"]) or None,
                }
    return resolved


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

    loaded_at = datetime.utcnow()

    def _build_row_payload(row: dict[str, Any]) -> dict[str, Any] | None:
        raw_id = (row.get("id") or "").strip()
        if not raw_id:
            return None
        try:
            row_id = int(raw_id)
        except ValueError:
            return None

        address = (row.get("Address") or "").strip()
        return {
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
            "address": address or None,
            "address_norm": normalize_address(address),
            "beg_date": _parse_date(row.get("BegDate") or ""),
            "end_date": _parse_date(row.get("EndDate") or ""),
            "region_id": (row.get("RegionID") or "").strip() or None,
            "ref_source": (row.get("ref_source") or "").strip() or None,
            "loaded_at": loaded_at,
        }

    insert_sql = text(
        """
        INSERT INTO cell_tower_reference (
            id, mcc, mnc, lac, cid, g, latitude, longitude, azimuth, height,
            address, address_norm, beg_date, end_date, region_id, ref_source, loaded_at
        ) VALUES (
            :id, :mcc, :mnc, :lac, :cid, :g, :latitude, :longitude, :azimuth, :height,
            :address, :address_norm, :beg_date, :end_date, :region_id, :ref_source, :loaded_at
        )
        """
    )

    await db.execute(text("SET LOCAL synchronous_commit = OFF"))
    await db.execute(text("TRUNCATE TABLE cell_tower_reference"))

    inserted_rows = 0
    batch_size = 20000
    chunk: list[dict[str, Any]] = []

    with _open_streaming_csv_reader(csv_path, ",") as reader:
        for row in reader:
            payload = _build_row_payload(row)
            if payload is None:
                continue
            chunk.append(payload)
            if len(chunk) < batch_size:
                continue
            await db.execute(insert_sql, chunk)
            inserted_rows += len(chunk)
            chunk.clear()

    if chunk:
        await db.execute(insert_sql, chunk)
        inserted_rows += len(chunk)

    await db.execute(text("ANALYZE cell_tower_reference"))

    return {
        "source_path": str(csv_path),
        "inserted_rows": inserted_rows,
        "loaded_at": loaded_at.isoformat(),
    }


async def enrich_cell_tower_reference_from_project_addresses(db: AsyncSession, project_id: int) -> dict[str, Any]:
    cleanup_result = await db.execute(
        text(
            """
            DELETE FROM cell_tower_reference
            WHERE ref_source LIKE '%' || :source_marker || '%'
              AND (
                lower(BTRIM(coalesce(address, ''))) IN ('', 'null', 'none', 'n/a', 'na', '-')
                OR lower(BTRIM(coalesce(cid, ''))) IN ('', '0', 'null', 'none', 'n/a', 'na', '-')
              )
            """
        ),
        {"source_marker": f"[project_{project_id}_addr_enrich]"},
    )
    removed_invalid_rows = int(cleanup_result.rowcount or 0)
    await db.execute(text("DROP TABLE IF EXISTS tmp_project_address_keys"))
    await db.execute(text("DROP TABLE IF EXISTS tmp_unresolved_address_keys"))
    await db.execute(text("DROP TABLE IF EXISTS tmp_ref_by_address"))
    await db.execute(text("DROP TABLE IF EXISTS tmp_matched_address_keys"))

    await db.execute(
        text(
            """
            CREATE TEMP TABLE tmp_project_address_keys ON COMMIT DROP AS
            SELECT DISTINCT ON (
              coalesce(NULLIF(BTRIM(e.payload ->> 'mcc'), ''), ''),
              coalesce(NULLIF(BTRIM(e.payload ->> 'mnc'), ''), ''),
              NULLIF(BTRIM(e.payload ->> 'lac'), ''),
              NULLIF(BTRIM(e.payload ->> 'bs'), ''),
              coalesce(NULLIF(BTRIM(e.payload ->> 'address_norm'), ''), regexp_replace(lower(coalesce(NULLIF(BTRIM(e.payload ->> 'address'), ''), '')), '[^[:alnum:]]', '', 'g'))
            )
              NULLIF(BTRIM(e.payload ->> 'mcc'), '') AS mcc,
              NULLIF(BTRIM(e.payload ->> 'mnc'), '') AS mnc,
              NULLIF(BTRIM(e.payload ->> 'lac'), '') AS lac,
              NULLIF(BTRIM(e.payload ->> 'bs'), '') AS cid,
              NULLIF(BTRIM(e.payload ->> 'address'), '') AS address,
              coalesce(NULLIF(BTRIM(e.payload ->> 'address_norm'), ''), regexp_replace(lower(coalesce(NULLIF(BTRIM(e.payload ->> 'address'), ''), '')), '[^[:alnum:]]', '', 'g')) AS address_norm,
              e.occurred_at AS event_time
            FROM project_domain_facts e
            WHERE e.project_id = :project_id
              AND e.fact_type = 'location_event'
              AND NULLIF(BTRIM(e.payload ->> 'address'), '') IS NOT NULL
              AND lower(BTRIM(e.payload ->> 'address')) NOT IN ('null', 'none', 'n/a', 'na', '-')
              AND NULLIF(BTRIM(e.payload ->> 'lac'), '') IS NOT NULL
              AND NULLIF(BTRIM(e.payload ->> 'bs'), '') IS NOT NULL
              AND lower(BTRIM(e.payload ->> 'bs')) NOT IN ('0', 'null', 'none', 'n/a', 'na', '-')
            ORDER BY
              coalesce(NULLIF(BTRIM(e.payload ->> 'mcc'), ''), ''),
              coalesce(NULLIF(BTRIM(e.payload ->> 'mnc'), ''), ''),
              NULLIF(BTRIM(e.payload ->> 'lac'), ''),
              NULLIF(BTRIM(e.payload ->> 'bs'), ''),
              coalesce(NULLIF(BTRIM(e.payload ->> 'address_norm'), ''), regexp_replace(lower(coalesce(NULLIF(BTRIM(e.payload ->> 'address'), ''), '')), '[^[:alnum:]]', '', 'g')),
              e.occurred_at DESC
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
        "removed_invalid_rows": removed_invalid_rows,
    }


async def get_cell_tower_reference_stats(db: AsyncSession) -> dict[str, Any]:
    count_result = await db.execute(text("SELECT COUNT(*) FROM cell_tower_reference"))
    max_result = await db.execute(text("SELECT MAX(loaded_at) FROM cell_tower_reference"))
    last_loaded_at = max_result.scalar()
    return {
        "cell_tower_reference_count": int(count_result.scalar() or 0),
        "last_loaded_at": last_loaded_at.isoformat() if last_loaded_at else None,
    }
