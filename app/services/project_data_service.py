from __future__ import annotations

import subprocess
import sys
from dataclasses import dataclass
from datetime import datetime
from pathlib import Path
from typing import Any

from fastapi import HTTPException
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.services.project_data_import_utils import (
    collect_input_files,
    read_manifest,
    save_uploaded_files,
)
from app.services.project_data_import_pipeline import insert_converted_rows

DATA_ROOT = Path("/app/data")
SCRIPT_PATH = Path("/app/scripts/nodex_converter.py")
@dataclass
class LoadResult:
    source_path: str
    output_dir: str
    load_batch_id: str
    communications_rows: int
    device_history_rows: int
    location_events_rows: int
    ip_bindings_rows: int
    inserted_communications: int
    inserted_device_history: int
    inserted_location_events: int
    inserted_ip_bindings: int
    load_log: dict[str, Any]


@dataclass
class ConverterResult:
    communications_path: Path
    device_history_path: Path
    location_events_path: Path
    ip_bindings_path: Path
    manifest_path: Path
    stdout: str
    stderr: str


def _resolve_source_path(source_path: str) -> Path:
    candidate_raw = (source_path or "").strip()
    if not candidate_raw:
        raise HTTPException(status_code=400, detail="Source path is required")

    candidate = Path(candidate_raw)
    if not candidate.is_absolute():
        candidate = (DATA_ROOT / candidate).resolve()
    else:
        candidate = candidate.resolve()

    root = DATA_ROOT.resolve()
    if root not in candidate.parents and candidate != root:
        raise HTTPException(status_code=400, detail=f"Path must be inside {root}")

    if not candidate.exists() or not candidate.is_dir():
        raise HTTPException(status_code=400, detail=f"Directory not found: {candidate}")

    return candidate


async def ensure_project_data_tables(db: AsyncSession) -> None:
    await db.execute(
        text(
            """
            CREATE TABLE IF NOT EXISTS project_communications (
                id BIGSERIAL PRIMARY KEY,
                project_id INTEGER NOT NULL,
                abon1 TEXT NOT NULL,
                abon2 TEXT NOT NULL,
                operator1 TEXT,
                operator2 TEXT,
                address1 TEXT,
                address2 TEXT,
                time_start TIMESTAMP NULL,
                time_end TIMESTAMP NULL,
                calls_count INTEGER NOT NULL DEFAULT 0,
                contacts_count INTEGER NOT NULL DEFAULT 1,
                total_duration INTEGER NOT NULL DEFAULT 0,
                calls_count_approx BOOLEAN NOT NULL DEFAULT FALSE,
                created_at TIMESTAMP NOT NULL DEFAULT NOW()
            );
            """
        )
    )
    await db.execute(
        text(
            """
            CREATE UNIQUE INDEX IF NOT EXISTS uq_project_communications_dedup
            ON project_communications (project_id, abon1, abon2, time_start, time_end, calls_count, total_duration);
            """
        )
    )
    await db.execute(text("ALTER TABLE project_communications ADD COLUMN IF NOT EXISTS calls_count_approx BOOLEAN NOT NULL DEFAULT FALSE"))
    await db.execute(text("ALTER TABLE project_communications ADD COLUMN IF NOT EXISTS contacts_count INTEGER NOT NULL DEFAULT 1"))
    await db.execute(text("CREATE INDEX IF NOT EXISTS ix_project_communications_project_id ON project_communications (project_id);"))

    await db.execute(
        text(
            """
            CREATE TABLE IF NOT EXISTS project_device_history (
                id BIGSERIAL PRIMARY KEY,
                project_id INTEGER NOT NULL,
                abon TEXT NOT NULL,
                imsi TEXT,
                imei TEXT,
                period_start TIMESTAMP NULL,
                period_end TIMESTAMP NULL,
                created_at TIMESTAMP NOT NULL DEFAULT NOW()
            );
            """
        )
    )
    await db.execute(
        text(
            """
            CREATE UNIQUE INDEX IF NOT EXISTS uq_project_device_history_dedup
            ON project_device_history (project_id, abon, imsi, imei, period_start, period_end);
            """
        )
    )
    await db.execute(text("CREATE INDEX IF NOT EXISTS ix_project_device_history_project_id ON project_device_history (project_id);"))

    await db.execute(
        text(
            """
            CREATE TABLE IF NOT EXISTS project_location_events_raw (
                id BIGSERIAL PRIMARY KEY,
                project_id INTEGER NOT NULL,
                load_batch_id TEXT NOT NULL,
                identifier_type TEXT NOT NULL,
                identifier_value TEXT NOT NULL,
                event_time TIMESTAMP NOT NULL,
                address TEXT,
                mcc TEXT,
                mnc TEXT,
                lac TEXT,
                bs TEXT,
                created_at TIMESTAMP NOT NULL DEFAULT NOW()
            );
            """
        )
    )
    await db.execute(text("CREATE INDEX IF NOT EXISTS ix_project_location_events_raw_project_id ON project_location_events_raw (project_id);"))
    await db.execute(text("CREATE INDEX IF NOT EXISTS ix_project_location_events_raw_lookup ON project_location_events_raw (project_id, identifier_type, identifier_value, event_time);"))
    await db.execute(text("CREATE INDEX IF NOT EXISTS ix_project_location_events_raw_lac_bs ON project_location_events_raw (lac, bs);"))

    await db.execute(
        text(
            """
            CREATE TABLE IF NOT EXISTS project_identifier_ip_bindings (
                id BIGSERIAL PRIMARY KEY,
                project_id INTEGER NOT NULL,
                load_batch_id TEXT NOT NULL,
                identifier_type TEXT NOT NULL,
                identifier_value TEXT NOT NULL,
                ip_address TEXT NOT NULL,
                event_time TIMESTAMP NOT NULL,
                address TEXT,
                mcc TEXT,
                mnc TEXT,
                lac TEXT,
                bs TEXT,
                created_at TIMESTAMP NOT NULL DEFAULT NOW()
            );
            """
        )
    )
    await db.execute(text("CREATE INDEX IF NOT EXISTS ix_project_identifier_ip_bindings_project_id ON project_identifier_ip_bindings (project_id);"))
    await db.execute(text("CREATE INDEX IF NOT EXISTS ix_project_identifier_ip_bindings_lookup ON project_identifier_ip_bindings (project_id, identifier_type, identifier_value, event_time);"))

    await db.execute(
        text(
            """
            CREATE TABLE IF NOT EXISTS cell_tower_reference (
                id BIGINT PRIMARY KEY,
                mcc TEXT,
                mnc TEXT,
                lac TEXT,
                cid TEXT,
                g TEXT,
                latitude DOUBLE PRECISION,
                longitude DOUBLE PRECISION,
                azimuth DOUBLE PRECISION,
                height DOUBLE PRECISION,
                address TEXT,
                beg_date DATE,
                end_date DATE,
                region_id TEXT,
                ref_source TEXT,
                loaded_at TIMESTAMP NOT NULL DEFAULT NOW()
            );
            """
        )
    )
    await db.execute(text("CREATE INDEX IF NOT EXISTS ix_cell_tower_reference_lac_cid ON cell_tower_reference (lac, cid);"))
    await db.execute(text("CREATE INDEX IF NOT EXISTS ix_cell_tower_reference_lac_cid_mcc_mnc ON cell_tower_reference (lac, cid, mcc, mnc);"))
    await db.execute(text("CREATE INDEX IF NOT EXISTS ix_cell_tower_reference_beg_end ON cell_tower_reference (beg_date, end_date);"))
    await db.execute(text("CREATE INDEX IF NOT EXISTS ix_cell_tower_reference_address_norm ON cell_tower_reference ((regexp_replace(lower(coalesce(address, '')), '[^[:alnum:]]', '', 'g')));"))
    await db.execute(text("CREATE INDEX IF NOT EXISTS ix_project_location_events_raw_address_norm ON project_location_events_raw (project_id, (regexp_replace(lower(coalesce(address, '')), '[^[:alnum:]]', '', 'g')));"))


def _run_converter(source_dir: Path, output_dir: Path) -> ConverterResult:
    if not SCRIPT_PATH.exists():
        raise HTTPException(status_code=500, detail=f"Nodex converter not found: {SCRIPT_PATH}")

    output_dir.mkdir(parents=True, exist_ok=True)
    communications_path = output_dir / "communications.csv"
    device_history_path = output_dir / "device_history.csv"
    location_events_path = output_dir / "location_events.csv"
    ip_bindings_path = output_dir / "ip_bindings.csv"
    manifest_path = output_dir / "nodex_manifest.json"

    command = [
        sys.executable,
        str(SCRIPT_PATH),
        "--input-dir",
        str(source_dir),
        "--out-communications",
        str(communications_path),
        "--out-device-history",
        str(device_history_path),
        "--out-location-events",
        str(location_events_path),
        "--out-ip-bindings",
        str(ip_bindings_path),
        "--out-manifest",
        str(manifest_path),
        "--postgres-friendly",
    ]
    completed = subprocess.run(command, capture_output=True, text=True, timeout=300)
    if completed.returncode != 0:
        stderr = (completed.stderr or completed.stdout or "").strip()
        raise HTTPException(status_code=400, detail=f"Nodex conversion failed: {stderr[:1200]}")

    if (
        not communications_path.exists()
        or not device_history_path.exists()
        or not location_events_path.exists()
        or not ip_bindings_path.exists()
    ):
        raise HTTPException(status_code=500, detail="Conversion finished without output CSV files")

    return ConverterResult(
        communications_path=communications_path,
        device_history_path=device_history_path,
        location_events_path=location_events_path,
        ip_bindings_path=ip_bindings_path,
        manifest_path=manifest_path,
        stdout=(completed.stdout or "").strip(),
        stderr=(completed.stderr or "").strip(),
    )


async def load_project_data(db: AsyncSession, project_id: int, source_path: str) -> LoadResult:
    source_dir = _resolve_source_path(source_path)
    timestamp = datetime.utcnow().strftime("%Y%m%d_%H%M%S")
    load_batch_id = timestamp
    output_dir = DATA_ROOT / "imports" / f"project_{project_id}" / timestamp
    input_files = collect_input_files(source_dir)
    converter_result = _run_converter(source_dir, output_dir)

    await ensure_project_data_tables(db)
    insert_result = await insert_converted_rows(
        db,
        project_id,
        converter_result.communications_path,
        converter_result.device_history_path,
        converter_result.location_events_path,
        converter_result.ip_bindings_path,
        load_batch_id,
    )

    load_log = {
        "mode": "source_path",
        "source_dir": str(source_dir),
        "input_files": input_files,
        "converter_stdout": converter_result.stdout,
        "converter_stderr": converter_result.stderr,
        "manifest": read_manifest(converter_result.manifest_path),
    }

    return LoadResult(
        source_path=str(source_dir),
        output_dir=str(output_dir),
        load_batch_id=load_batch_id,
        communications_rows=insert_result.communications_rows,
        device_history_rows=insert_result.device_history_rows,
        location_events_rows=insert_result.location_events_rows,
        ip_bindings_rows=insert_result.ip_bindings_rows,
        inserted_communications=insert_result.inserted_communications,
        inserted_device_history=insert_result.inserted_device_history,
        inserted_location_events=insert_result.inserted_location_events,
        inserted_ip_bindings=insert_result.inserted_ip_bindings,
        load_log=load_log,
    )


async def load_project_data_from_upload(db: AsyncSession, project_id: int, files: list[Any]) -> LoadResult:
    timestamp = datetime.utcnow().strftime("%Y%m%d_%H%M%S")
    load_batch_id = timestamp
    source_dir = DATA_ROOT / "uploads" / f"project_{project_id}" / timestamp
    uploaded_files = await save_uploaded_files(source_dir, files)
    output_dir = DATA_ROOT / "imports" / f"project_{project_id}" / timestamp
    converter_result = _run_converter(source_dir, output_dir)

    await ensure_project_data_tables(db)
    insert_result = await insert_converted_rows(
        db,
        project_id,
        converter_result.communications_path,
        converter_result.device_history_path,
        converter_result.location_events_path,
        converter_result.ip_bindings_path,
        load_batch_id,
    )

    load_log = {
        "mode": "upload",
        "source_dir": str(source_dir),
        "uploaded_files": uploaded_files,
        "converter_stdout": converter_result.stdout,
        "converter_stderr": converter_result.stderr,
        "manifest": read_manifest(converter_result.manifest_path),
    }

    return LoadResult(
        source_path=str(source_dir),
        output_dir=str(output_dir),
        load_batch_id=load_batch_id,
        communications_rows=insert_result.communications_rows,
        device_history_rows=insert_result.device_history_rows,
        location_events_rows=insert_result.location_events_rows,
        ip_bindings_rows=insert_result.ip_bindings_rows,
        inserted_communications=insert_result.inserted_communications,
        inserted_device_history=insert_result.inserted_device_history,
        inserted_location_events=insert_result.inserted_location_events,
        inserted_ip_bindings=insert_result.inserted_ip_bindings,
        load_log=load_log,
    )


async def acquire_project_data_lock(db: AsyncSession, project_id: int) -> None:
    # Transaction-scoped lock: serializes load/clear operations for one project.
    lock_key = 910000000 + int(project_id)
    await db.execute(text("SELECT pg_advisory_xact_lock(:lock_key)"), {"lock_key": lock_key})


async def get_project_data_stats(db: AsyncSession, project_id: int) -> dict[str, int]:
    await ensure_project_data_tables(db)

    communications_result = await db.execute(
        text("SELECT COUNT(*) FROM project_communications WHERE project_id = :project_id"),
        {"project_id": project_id},
    )
    device_history_result = await db.execute(
        text("SELECT COUNT(*) FROM project_device_history WHERE project_id = :project_id"),
        {"project_id": project_id},
    )
    location_events_result = await db.execute(
        text("SELECT COUNT(*) FROM project_location_events_raw WHERE project_id = :project_id"),
        {"project_id": project_id},
    )
    ip_bindings_result = await db.execute(
        text("SELECT COUNT(*) FROM project_identifier_ip_bindings WHERE project_id = :project_id"),
        {"project_id": project_id},
    )

    return {
        "communications_count": int(communications_result.scalar() or 0),
        "device_history_count": int(device_history_result.scalar() or 0),
        "location_events_count": int(location_events_result.scalar() or 0),
        "ip_bindings_count": int(ip_bindings_result.scalar() or 0),
    }


async def clear_project_data(db: AsyncSession, project_id: int) -> dict[str, int]:
    await ensure_project_data_tables(db)
    communications_result = await db.execute(
        text("DELETE FROM project_communications WHERE project_id = :project_id"),
        {"project_id": project_id},
    )
    device_history_result = await db.execute(
        text("DELETE FROM project_device_history WHERE project_id = :project_id"),
        {"project_id": project_id},
    )
    location_events_result = await db.execute(
        text("DELETE FROM project_location_events_raw WHERE project_id = :project_id"),
        {"project_id": project_id},
    )
    ip_bindings_result = await db.execute(
        text("DELETE FROM project_identifier_ip_bindings WHERE project_id = :project_id"),
        {"project_id": project_id},
    )
    return {
        "communications_deleted": communications_result.rowcount or 0,
        "device_history_deleted": device_history_result.rowcount or 0,
        "location_events_deleted": location_events_result.rowcount or 0,
        "ip_bindings_deleted": ip_bindings_result.rowcount or 0,
    }


