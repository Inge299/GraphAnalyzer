from __future__ import annotations

import asyncio
import csv
import shutil
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
from app.services.project_data_import_plugins import (
    ProjectDataImportExecutionResult,
    classify_project_data_import_files,
    execute_project_data_import_plugin,
)
from app.services.project_data_import_pipeline import insert_converted_rows

DATA_ROOT = Path("/app/data")
SCRIPT_PATH = Path("/app/scripts/nodex_converter.py")
_project_data_schema_ready = False
_project_data_schema_lock = asyncio.Lock()
@dataclass
class LoadResult:
    source_path: str
    output_dir: str
    load_batch_id: str
    import_plugin_id: str
    import_plugin_name: str
    communications_rows: int
    device_history_rows: int
    location_events_rows: int
    ip_bindings_rows: int
    user_msisdn_facts_rows: int
    ip_msisdn_facts_rows: int
    msisdn_device_facts_rows: int
    msisdn_text_facts_rows: int
    inserted_communications: int
    inserted_device_history: int
    inserted_location_events: int
    inserted_ip_bindings: int
    inserted_user_msisdn_facts: int
    inserted_ip_msisdn_facts: int
    inserted_msisdn_device_facts: int
    inserted_msisdn_text_facts: int
    load_log: dict[str, Any]


@dataclass
class ConverterResult:
    communications_path: Path
    device_history_path: Path
    location_events_path: Path
    ip_bindings_path: Path
    user_msisdn_facts_path: Path
    ip_msisdn_facts_path: Path
    msisdn_device_facts_path: Path
    msisdn_text_facts_path: Path
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
    global _project_data_schema_ready

    if _project_data_schema_ready:
        return

    async with _project_data_schema_lock:
        if _project_data_schema_ready:
            return
        await _ensure_project_data_tables_impl(db)
        await db.commit()
        _project_data_schema_ready = True


async def _ensure_project_data_tables_impl(db: AsyncSession) -> None:
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
    await db.execute(text("DROP INDEX IF EXISTS uq_project_communications_dedup"))
    await db.execute(
        text(
            """
            CREATE UNIQUE INDEX IF NOT EXISTS uq_project_communications_dedup
            ON project_communications (project_id, abon1, abon2, time_start);
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
                address_norm TEXT,
                mcc TEXT,
                mnc TEXT,
                lac TEXT,
                bs TEXT,
                created_at TIMESTAMP NOT NULL DEFAULT NOW()
            );
            """
        )
    )
    await db.execute(text("ALTER TABLE project_location_events_raw ADD COLUMN IF NOT EXISTS address_norm TEXT"))
    await db.execute(text("CREATE INDEX IF NOT EXISTS ix_project_location_events_raw_project_id ON project_location_events_raw (project_id);"))
    await db.execute(text("CREATE INDEX IF NOT EXISTS ix_project_location_events_raw_lookup ON project_location_events_raw (project_id, identifier_type, identifier_value, event_time);"))
    await db.execute(text("CREATE INDEX IF NOT EXISTS ix_project_location_events_raw_lac_bs ON project_location_events_raw (lac, bs);"))
    await db.execute(text("CREATE INDEX IF NOT EXISTS ix_project_location_events_raw_project_address_norm ON project_location_events_raw (project_id, address_norm);"))
    await db.execute(text("CREATE INDEX IF NOT EXISTS ix_project_location_events_raw_project_batch ON project_location_events_raw (project_id, load_batch_id);"))
    await db.execute(
        text(
            """
            WITH ranked AS (
                SELECT
                    id,
                    ROW_NUMBER() OVER (
                        PARTITION BY
                            project_id,
                            identifier_type,
                            identifier_value,
                            event_time,
                            COALESCE(address, ''),
                            COALESCE(address_norm, ''),
                            COALESCE(mcc, ''),
                            COALESCE(mnc, ''),
                            COALESCE(lac, ''),
                            COALESCE(bs, '')
                        ORDER BY id
                    ) AS rn
                FROM project_location_events_raw
            )
            DELETE FROM project_location_events_raw
            WHERE id IN (
                SELECT id FROM ranked WHERE rn > 1
            );
            """
        )
    )
    await db.execute(
        text(
            """
            CREATE UNIQUE INDEX IF NOT EXISTS uq_project_location_events_raw_dedup
            ON project_location_events_raw (
                project_id,
                identifier_type,
                identifier_value,
                event_time,
                COALESCE(address, ''),
                COALESCE(address_norm, ''),
                COALESCE(mcc, ''),
                COALESCE(mnc, ''),
                COALESCE(lac, ''),
                COALESCE(bs, '')
            );
            """
        )
    )

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
                address_norm TEXT,
                mcc TEXT,
                mnc TEXT,
                lac TEXT,
                bs TEXT,
                user_id TEXT,
                device_info TEXT,
                message_text TEXT,
                created_at TIMESTAMP NOT NULL DEFAULT NOW()
            );
            """
        )
    )
    await db.execute(text("ALTER TABLE project_identifier_ip_bindings ADD COLUMN IF NOT EXISTS address_norm TEXT"))
    await db.execute(text("ALTER TABLE project_identifier_ip_bindings ADD COLUMN IF NOT EXISTS user_id TEXT"))
    await db.execute(text("ALTER TABLE project_identifier_ip_bindings ADD COLUMN IF NOT EXISTS device_info TEXT"))
    await db.execute(text("ALTER TABLE project_identifier_ip_bindings ADD COLUMN IF NOT EXISTS message_text TEXT"))
    await db.execute(text("CREATE INDEX IF NOT EXISTS ix_project_identifier_ip_bindings_project_id ON project_identifier_ip_bindings (project_id);"))
    await db.execute(text("CREATE INDEX IF NOT EXISTS ix_project_identifier_ip_bindings_lookup ON project_identifier_ip_bindings (project_id, identifier_type, identifier_value, event_time);"))
    await db.execute(text("CREATE INDEX IF NOT EXISTS ix_project_identifier_ip_bindings_project_batch ON project_identifier_ip_bindings (project_id, load_batch_id);"))
    await db.execute(
        text(
            """
            WITH ranked AS (
                SELECT
                    id,
                    ROW_NUMBER() OVER (
                        PARTITION BY
                            project_id,
                            identifier_type,
                            identifier_value,
                            ip_address,
                            event_time,
                            COALESCE(address, ''),
                            COALESCE(address_norm, ''),
                            COALESCE(mcc, ''),
                            COALESCE(mnc, ''),
                            COALESCE(lac, ''),
                            COALESCE(bs, ''),
                            COALESCE(user_id, ''),
                            COALESCE(device_info, ''),
                            COALESCE(message_text, '')
                ORDER BY id
                    ) AS rn
                FROM project_identifier_ip_bindings
            )
            DELETE FROM project_identifier_ip_bindings
            WHERE id IN (
                SELECT id FROM ranked WHERE rn > 1
            );
            """
        )
    )
    await db.execute(
        text(
            """
            DROP INDEX IF EXISTS uq_project_identifier_ip_bindings_dedup;
            """
        )
    )
    await db.execute(
        text(
            """
            CREATE UNIQUE INDEX IF NOT EXISTS uq_project_identifier_ip_bindings_dedup
            ON project_identifier_ip_bindings (
                project_id,
                identifier_type,
                identifier_value,
                ip_address,
                event_time,
                COALESCE(address, ''),
                COALESCE(address_norm, ''),
                COALESCE(mcc, ''),
                COALESCE(mnc, ''),
                COALESCE(lac, ''),
                COALESCE(bs, ''),
                COALESCE(user_id, ''),
                COALESCE(device_info, ''),
                COALESCE(message_text, '')
            );
            """
        )
    )

    await db.execute(
        text(
            """
            CREATE TABLE IF NOT EXISTS project_user_msisdn_facts (
                id BIGSERIAL PRIMARY KEY,
                project_id INTEGER NOT NULL,
                load_batch_id TEXT NOT NULL,
                event_time TIMESTAMP NOT NULL,
                user_id TEXT NOT NULL,
                user_msisdn TEXT NOT NULL,
                created_at TIMESTAMP NOT NULL DEFAULT NOW()
            );
            """
        )
    )
    await db.execute(text("CREATE INDEX IF NOT EXISTS ix_project_user_msisdn_facts_project_id ON project_user_msisdn_facts (project_id);"))
    await db.execute(text("CREATE INDEX IF NOT EXISTS ix_project_user_msisdn_facts_project_batch ON project_user_msisdn_facts (project_id, load_batch_id);"))
    await db.execute(
        text(
            """
            WITH ranked AS (
                SELECT
                    id,
                    ROW_NUMBER() OVER (
                        PARTITION BY project_id, event_time, COALESCE(user_id, ''), COALESCE(user_msisdn, '')
                        ORDER BY id
                    ) AS rn
                FROM project_user_msisdn_facts
            )
            DELETE FROM project_user_msisdn_facts
            WHERE id IN (SELECT id FROM ranked WHERE rn > 1);
            """
        )
    )
    await db.execute(
        text(
            """
            CREATE UNIQUE INDEX IF NOT EXISTS uq_project_user_msisdn_facts_dedup
            ON project_user_msisdn_facts (
                project_id,
                event_time,
                COALESCE(user_id, ''),
                COALESCE(user_msisdn, '')
            );
            """
        )
    )

    await db.execute(
        text(
            """
            CREATE TABLE IF NOT EXISTS project_ip_msisdn_facts (
                id BIGSERIAL PRIMARY KEY,
                project_id INTEGER NOT NULL,
                load_batch_id TEXT NOT NULL,
                event_time TIMESTAMP NOT NULL,
                ip_address TEXT NOT NULL,
                user_msisdn TEXT NOT NULL,
                created_at TIMESTAMP NOT NULL DEFAULT NOW()
            );
            """
        )
    )
    await db.execute(text("CREATE INDEX IF NOT EXISTS ix_project_ip_msisdn_facts_project_id ON project_ip_msisdn_facts (project_id);"))
    await db.execute(text("CREATE INDEX IF NOT EXISTS ix_project_ip_msisdn_facts_project_batch ON project_ip_msisdn_facts (project_id, load_batch_id);"))
    await db.execute(
        text(
            """
            WITH ranked AS (
                SELECT
                    id,
                    ROW_NUMBER() OVER (
                        PARTITION BY project_id, event_time, COALESCE(ip_address, ''), COALESCE(user_msisdn, '')
                        ORDER BY id
                    ) AS rn
                FROM project_ip_msisdn_facts
            )
            DELETE FROM project_ip_msisdn_facts
            WHERE id IN (SELECT id FROM ranked WHERE rn > 1);
            """
        )
    )
    await db.execute(
        text(
            """
            CREATE UNIQUE INDEX IF NOT EXISTS uq_project_ip_msisdn_facts_dedup
            ON project_ip_msisdn_facts (
                project_id,
                event_time,
                COALESCE(ip_address, ''),
                COALESCE(user_msisdn, '')
            );
            """
        )
    )

    await db.execute(
        text(
            """
            CREATE TABLE IF NOT EXISTS project_msisdn_device_facts (
                id BIGSERIAL PRIMARY KEY,
                project_id INTEGER NOT NULL,
                load_batch_id TEXT NOT NULL,
                event_time TIMESTAMP NOT NULL,
                user_msisdn TEXT NOT NULL,
                device_info TEXT NOT NULL,
                created_at TIMESTAMP NOT NULL DEFAULT NOW()
            );
            """
        )
    )
    await db.execute(text("CREATE INDEX IF NOT EXISTS ix_project_msisdn_device_facts_project_id ON project_msisdn_device_facts (project_id);"))
    await db.execute(text("CREATE INDEX IF NOT EXISTS ix_project_msisdn_device_facts_project_batch ON project_msisdn_device_facts (project_id, load_batch_id);"))
    await db.execute(
        text(
            """
            WITH ranked AS (
                SELECT
                    id,
                    ROW_NUMBER() OVER (
                        PARTITION BY project_id, event_time, COALESCE(user_msisdn, ''), COALESCE(device_info, '')
                        ORDER BY id
                    ) AS rn
                FROM project_msisdn_device_facts
            )
            DELETE FROM project_msisdn_device_facts
            WHERE id IN (SELECT id FROM ranked WHERE rn > 1);
            """
        )
    )
    await db.execute(
        text(
            """
            CREATE UNIQUE INDEX IF NOT EXISTS uq_project_msisdn_device_facts_dedup
            ON project_msisdn_device_facts (
                project_id,
                event_time,
                COALESCE(user_msisdn, ''),
                COALESCE(device_info, '')
            );
            """
        )
    )

    await db.execute(
        text(
            """
            CREATE TABLE IF NOT EXISTS project_msisdn_text_facts (
                id BIGSERIAL PRIMARY KEY,
                project_id INTEGER NOT NULL,
                load_batch_id TEXT NOT NULL,
                event_time TIMESTAMP NOT NULL,
                user_msisdn TEXT NOT NULL,
                file_msisdn TEXT NOT NULL,
                message_text TEXT NOT NULL,
                created_at TIMESTAMP NOT NULL DEFAULT NOW()
            );
            """
        )
    )
    await db.execute(text("CREATE INDEX IF NOT EXISTS ix_project_msisdn_text_facts_project_id ON project_msisdn_text_facts (project_id);"))
    await db.execute(text("CREATE INDEX IF NOT EXISTS ix_project_msisdn_text_facts_project_batch ON project_msisdn_text_facts (project_id, load_batch_id);"))
    await db.execute(
        text(
            """
            WITH ranked AS (
                SELECT
                    id,
                    ROW_NUMBER() OVER (
                        PARTITION BY project_id, event_time, COALESCE(user_msisdn, ''), COALESCE(file_msisdn, ''), COALESCE(message_text, '')
                        ORDER BY id
                    ) AS rn
                FROM project_msisdn_text_facts
            )
            DELETE FROM project_msisdn_text_facts
            WHERE id IN (SELECT id FROM ranked WHERE rn > 1);
            """
        )
    )
    await db.execute(
        text(
            """
            CREATE UNIQUE INDEX IF NOT EXISTS uq_project_msisdn_text_facts_dedup
            ON project_msisdn_text_facts (
                project_id,
                event_time,
                COALESCE(user_msisdn, ''),
                COALESCE(file_msisdn, ''),
                COALESCE(message_text, '')
            );
            """
        )
    )

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
                address_norm TEXT,
                beg_date DATE,
                end_date DATE,
                region_id TEXT,
                ref_source TEXT,
                loaded_at TIMESTAMP NOT NULL DEFAULT NOW()
            );
            """
        )
    )
    await db.execute(text("ALTER TABLE cell_tower_reference ADD COLUMN IF NOT EXISTS address_norm TEXT"))
    await db.execute(text("CREATE INDEX IF NOT EXISTS ix_cell_tower_reference_lac_cid ON cell_tower_reference (lac, cid);"))
    await db.execute(text("CREATE INDEX IF NOT EXISTS ix_cell_tower_reference_lac_cid_mcc_mnc ON cell_tower_reference (lac, cid, mcc, mnc);"))
    await db.execute(text("CREATE INDEX IF NOT EXISTS ix_cell_tower_reference_beg_end ON cell_tower_reference (beg_date, end_date);"))
    await db.execute(text("CREATE INDEX IF NOT EXISTS ix_cell_tower_reference_address_norm_col ON cell_tower_reference (address_norm);"))
    await db.execute(text("DROP INDEX IF EXISTS ix_cell_tower_reference_address_norm;"))
    await db.execute(text("DROP INDEX IF EXISTS ix_project_location_events_raw_address_norm;"))
    await db.execute(
        text(
            """
            CREATE TABLE IF NOT EXISTS project_data_stats_cache (
                project_id INTEGER PRIMARY KEY,
                communications_count INTEGER NOT NULL DEFAULT 0,
                device_history_count INTEGER NOT NULL DEFAULT 0,
                location_events_count INTEGER NOT NULL DEFAULT 0,
                ip_bindings_count INTEGER NOT NULL DEFAULT 0,
                user_msisdn_facts_count INTEGER NOT NULL DEFAULT 0,
                ip_msisdn_facts_count INTEGER NOT NULL DEFAULT 0,
                msisdn_device_facts_count INTEGER NOT NULL DEFAULT 0,
                msisdn_text_facts_count INTEGER NOT NULL DEFAULT 0,
                updated_at TIMESTAMP NOT NULL DEFAULT NOW()
            );
            """
        )
    )
    await db.execute(text("ALTER TABLE project_data_stats_cache ADD COLUMN IF NOT EXISTS user_msisdn_facts_count INTEGER NOT NULL DEFAULT 0"))
    await db.execute(text("ALTER TABLE project_data_stats_cache ADD COLUMN IF NOT EXISTS ip_msisdn_facts_count INTEGER NOT NULL DEFAULT 0"))
    await db.execute(text("ALTER TABLE project_data_stats_cache ADD COLUMN IF NOT EXISTS msisdn_device_facts_count INTEGER NOT NULL DEFAULT 0"))
    await db.execute(text("ALTER TABLE project_data_stats_cache ADD COLUMN IF NOT EXISTS msisdn_text_facts_count INTEGER NOT NULL DEFAULT 0"))


async def get_project_data_stats_cache(db: AsyncSession, project_id: int) -> dict[str, int] | None:
    result = await db.execute(
        text(
            """
            SELECT
                communications_count,
                device_history_count,
                location_events_count,
                ip_bindings_count,
                user_msisdn_facts_count,
                ip_msisdn_facts_count,
                msisdn_device_facts_count,
                msisdn_text_facts_count
            FROM project_data_stats_cache
            WHERE project_id = :project_id
            """
        ),
        {"project_id": project_id},
    )
    row = result.mappings().first()
    if row is None:
        return None
    return {
        "communications_count": int(row["communications_count"] or 0),
        "device_history_count": int(row["device_history_count"] or 0),
        "location_events_count": int(row["location_events_count"] or 0),
        "ip_bindings_count": int(row["ip_bindings_count"] or 0),
        "user_msisdn_facts_count": int(row["user_msisdn_facts_count"] or 0),
        "ip_msisdn_facts_count": int(row["ip_msisdn_facts_count"] or 0),
        "msisdn_device_facts_count": int(row["msisdn_device_facts_count"] or 0),
        "msisdn_text_facts_count": int(row["msisdn_text_facts_count"] or 0),
    }


async def set_project_data_stats_cache(
    db: AsyncSession,
    project_id: int,
    communications_count: int,
    device_history_count: int,
    location_events_count: int,
    ip_bindings_count: int,
    user_msisdn_facts_count: int,
    ip_msisdn_facts_count: int,
    msisdn_device_facts_count: int,
    msisdn_text_facts_count: int,
) -> None:
    await db.execute(
        text(
            """
            INSERT INTO project_data_stats_cache (
                project_id,
                communications_count,
                device_history_count,
                location_events_count,
                ip_bindings_count,
                user_msisdn_facts_count,
                ip_msisdn_facts_count,
                msisdn_device_facts_count,
                msisdn_text_facts_count,
                updated_at
            ) VALUES (
                :project_id,
                :communications_count,
                :device_history_count,
                :location_events_count,
                :ip_bindings_count,
                :user_msisdn_facts_count,
                :ip_msisdn_facts_count,
                :msisdn_device_facts_count,
                :msisdn_text_facts_count,
                NOW()
            )
            ON CONFLICT (project_id) DO UPDATE SET
                communications_count = EXCLUDED.communications_count,
                device_history_count = EXCLUDED.device_history_count,
                location_events_count = EXCLUDED.location_events_count,
                ip_bindings_count = EXCLUDED.ip_bindings_count,
                user_msisdn_facts_count = EXCLUDED.user_msisdn_facts_count,
                ip_msisdn_facts_count = EXCLUDED.ip_msisdn_facts_count,
                msisdn_device_facts_count = EXCLUDED.msisdn_device_facts_count,
                msisdn_text_facts_count = EXCLUDED.msisdn_text_facts_count,
                updated_at = NOW()
            """
        ),
        {
            "project_id": project_id,
            "communications_count": int(communications_count),
            "device_history_count": int(device_history_count),
            "location_events_count": int(location_events_count),
            "ip_bindings_count": int(ip_bindings_count),
            "user_msisdn_facts_count": int(user_msisdn_facts_count),
            "ip_msisdn_facts_count": int(ip_msisdn_facts_count),
            "msisdn_device_facts_count": int(msisdn_device_facts_count),
            "msisdn_text_facts_count": int(msisdn_text_facts_count),
        },
    )


def _run_converter(source_dir: Path, output_dir: Path) -> ConverterResult:
    if not SCRIPT_PATH.exists():
        raise HTTPException(status_code=500, detail=f"Nodex converter not found: {SCRIPT_PATH}")

    output_dir.mkdir(parents=True, exist_ok=True)
    communications_path = output_dir / "communications.csv"
    device_history_path = output_dir / "device_history.csv"
    location_events_path = output_dir / "location_events.csv"
    ip_bindings_path = output_dir / "ip_bindings.csv"
    user_msisdn_facts_path = output_dir / "user_msisdn_facts.csv"
    ip_msisdn_facts_path = output_dir / "ip_msisdn_facts.csv"
    msisdn_device_facts_path = output_dir / "msisdn_device_facts.csv"
    msisdn_text_facts_path = output_dir / "msisdn_text_facts.csv"
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
        "--out-user-msisdn-facts",
        str(user_msisdn_facts_path),
        "--out-ip-msisdn-facts",
        str(ip_msisdn_facts_path),
        "--out-msisdn-device-facts",
        str(msisdn_device_facts_path),
        "--out-msisdn-text-facts",
        str(msisdn_text_facts_path),
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
        or not user_msisdn_facts_path.exists()
        or not ip_msisdn_facts_path.exists()
        or not msisdn_device_facts_path.exists()
        or not msisdn_text_facts_path.exists()
    ):
        raise HTTPException(status_code=500, detail="Conversion finished without output CSV files")

    return ConverterResult(
        communications_path=communications_path,
        device_history_path=device_history_path,
        location_events_path=location_events_path,
        ip_bindings_path=ip_bindings_path,
        user_msisdn_facts_path=user_msisdn_facts_path,
        ip_msisdn_facts_path=ip_msisdn_facts_path,
        msisdn_device_facts_path=msisdn_device_facts_path,
        msisdn_text_facts_path=msisdn_text_facts_path,
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
    return await _load_project_data_from_collected_files(
        db=db,
        project_id=project_id,
        source_dir=source_dir,
        input_files=input_files,
        output_dir=output_dir,
        load_batch_id=load_batch_id,
        mode="source_path",
    )


async def load_project_data_from_upload(
    db: AsyncSession,
    project_id: int,
    files: list[Any],
    plugin_overrides: dict[str, str] | None = None,
) -> LoadResult:
    timestamp = datetime.utcnow().strftime("%Y%m%d_%H%M%S")
    load_batch_id = timestamp
    source_dir = DATA_ROOT / "uploads" / f"project_{project_id}" / timestamp
    uploaded_files = await save_uploaded_files(source_dir, files)
    output_dir = DATA_ROOT / "imports" / f"project_{project_id}" / timestamp
    return await _load_project_data_from_collected_files(
        db=db,
        project_id=project_id,
        source_dir=source_dir,
        input_files=uploaded_files,
        output_dir=output_dir,
        load_batch_id=load_batch_id,
        mode="upload",
        plugin_overrides=plugin_overrides,
    )


def _copy_input_group(source_dir: Path, target_dir: Path, files: list[dict[str, Any]]) -> None:
    for item in files:
        relative_path = Path(str(item.get("path") or ""))
        if not relative_path.parts:
            continue
        source_path = source_dir / relative_path
        target_path = target_dir / relative_path
        target_path.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy2(source_path, target_path)


def _preview_converted_csv(path: Path, limit: int = 10) -> dict[str, Any]:
    if not path.exists():
        return {"row_count": 0, "columns": [], "sample_rows": []}

    row_count = 0
    sample_rows: list[dict[str, Any]] = []
    with path.open("r", encoding="utf-8-sig", newline="") as stream:
        sample = stream.read(8192)
        stream.seek(0)
        try:
            dialect = csv.Sniffer().sniff(sample, delimiters=",;\t")
        except csv.Error:
            dialect = csv.excel
        reader = csv.DictReader(stream, dialect=dialect)
        columns = [str(item or "") for item in (reader.fieldnames or [])]
        for row in reader:
            row_count += 1
            if len(sample_rows) < limit:
                sample_rows.append({str(key): value for key, value in row.items()})
    return {"row_count": row_count, "columns": columns, "sample_rows": sample_rows}


async def preview_project_data_from_upload(
    project_id: int,
    files: list[Any],
    plugin_overrides: dict[str, str] | None = None,
    sample_limit: int = 10,
) -> dict[str, Any]:
    timestamp = datetime.utcnow().strftime("%Y%m%d_%H%M%S_%f")
    preview_root = DATA_ROOT / "previews" / f"project_{project_id}" / timestamp
    source_dir = preview_root / "source"
    output_dir = preview_root / "output"
    errors: list[dict[str, Any]] = []
    warnings: list[str] = []

    try:
        uploaded_files = await save_uploaded_files(source_dir, files)
        matches = []
        for input_file in uploaded_files:
            input_path = str(input_file.get("path") or "")
            override = {input_path: plugin_overrides[input_path]} if plugin_overrides and input_path in plugin_overrides else None
            try:
                matches.extend(classify_project_data_import_files(source_dir, [input_file], plugin_overrides=override))
            except HTTPException as exc:
                errors.append({"path": input_path, "stage": "recognition", "message": str(exc.detail)})

        groups: dict[str, list[dict[str, Any]]] = {}
        for match in matches:
            source_file = next((item for item in uploaded_files if str(item.get("path") or "") == match.path), None)
            if source_file is not None:
                groups.setdefault(match.plugin_id, []).append(source_file)

        runs: list[dict[str, Any]] = []
        dataset_paths = (
            ("communications", "Связи", "communications_path"),
            ("device_history", "Устройства", "device_history_path"),
            ("location_events", "Локации", "location_events_path"),
            ("ip_bindings", "IP-привязки", "ip_bindings_path"),
            ("user_msisdn_facts", "Пользователь <-> MSISDN", "user_msisdn_facts_path"),
            ("ip_msisdn_facts", "IP <-> MSISDN", "ip_msisdn_facts_path"),
            ("msisdn_device_facts", "MSISDN <-> Устройство", "msisdn_device_facts_path"),
            ("msisdn_text_facts", "MSISDN и текст", "msisdn_text_facts_path"),
        )

        from app.services.project_data_import_plugins import IMPORT_PLUGIN_BY_ID

        for plugin_id, grouped_files in groups.items():
            match = next(item for item in matches if item.plugin_id == plugin_id)
            plugin_source_dir = source_dir / "_plugin_groups" / plugin_id
            plugin_output_dir = output_dir / plugin_id
            _copy_input_group(source_dir, plugin_source_dir, grouped_files)
            try:
                result = execute_project_data_import_plugin(
                    IMPORT_PLUGIN_BY_ID[plugin_id],
                    plugin_source_dir,
                    plugin_output_dir,
                    dry_run=True,
                )
                datasets = []
                for dataset_id, label, attr_name in dataset_paths:
                    preview = _preview_converted_csv(getattr(result, attr_name), limit=max(1, min(sample_limit, 50)))
                    datasets.append({"id": dataset_id, "label": label, **preview})
                if not any(dataset["row_count"] > 0 for dataset in datasets):
                    warnings.append(f"{result.plugin_name}: преобразование не сформировало ни одной строки")
                runs.append(
                    {
                        "plugin": {"id": result.plugin_id, "name": result.plugin_name, "description": result.plugin_description},
                        "recognized_files": [str(item.get("path") or "") for item in grouped_files],
                        "score": match.score,
                        "datasets": datasets,
                        "manifest": read_manifest(result.manifest_path),
                        "converter_stdout": result.stdout,
                        "converter_stderr": result.stderr,
                    }
                )
            except Exception as exc:
                detail = exc.detail if isinstance(exc, HTTPException) else str(exc)
                errors.append({"plugin_id": plugin_id, "stage": "conversion", "message": str(detail)})

        return {
            "project_id": project_id,
            "dry_run": True,
            "write_performed": False,
            "files": [
                {
                    "path": item.get("path"),
                    "size_bytes": item.get("size_bytes"),
                    "plugin_id": next((match.plugin_id for match in matches if match.path == item.get("path")), None),
                    "plugin_name": next((match.plugin_name for match in matches if match.path == item.get("path")), None),
                    "score": next((match.score for match in matches if match.path == item.get("path")), None),
                }
                for item in uploaded_files
            ],
            "runs": runs,
            "warnings": warnings,
            "errors": errors,
        }
    finally:
        shutil.rmtree(preview_root, ignore_errors=True)

async def _load_project_data_from_collected_files(
    *,
    db: AsyncSession,
    project_id: int,
    source_dir: Path,
    input_files: list[dict[str, Any]],
    output_dir: Path,
    load_batch_id: str,
    mode: str,
    plugin_overrides: dict[str, str] | None = None,
) -> LoadResult:
    matches = classify_project_data_import_files(source_dir, input_files, plugin_overrides=plugin_overrides)
    groups: dict[str, list[dict[str, Any]]] = {}
    for input_file, match in zip(input_files, matches, strict=False):
        groups.setdefault(match.plugin_id, []).append(input_file)

    await ensure_project_data_tables(db)

    total_rows = {
        "communications_rows": 0,
        "device_history_rows": 0,
        "location_events_rows": 0,
        "ip_bindings_rows": 0,
        "user_msisdn_facts_rows": 0,
        "ip_msisdn_facts_rows": 0,
        "msisdn_device_facts_rows": 0,
        "msisdn_text_facts_rows": 0,
        "inserted_communications": 0,
        "inserted_device_history": 0,
        "inserted_location_events": 0,
        "inserted_ip_bindings": 0,
        "inserted_user_msisdn_facts": 0,
        "inserted_ip_msisdn_facts": 0,
        "inserted_msisdn_device_facts": 0,
        "inserted_msisdn_text_facts": 0,
    }
    import_runs: list[dict[str, Any]] = []

    for plugin_id, grouped_files in groups.items():
        match = next(item for item in matches if item.plugin_id == plugin_id)
        plugin_source_dir = source_dir / "_plugin_groups" / plugin_id
        plugin_output_dir = output_dir / plugin_id
        _copy_input_group(source_dir, plugin_source_dir, grouped_files)

        from app.services.project_data_import_plugins import IMPORT_PLUGIN_BY_ID
        import_plugin = IMPORT_PLUGIN_BY_ID[plugin_id]
        converter_result: ProjectDataImportExecutionResult = execute_project_data_import_plugin(
            import_plugin,
            plugin_source_dir,
            plugin_output_dir,
        )
        insert_result = await insert_converted_rows(
            db,
            project_id,
            converter_result.communications_path,
            converter_result.device_history_path,
            converter_result.location_events_path,
            converter_result.ip_bindings_path,
            converter_result.user_msisdn_facts_path,
            converter_result.ip_msisdn_facts_path,
            converter_result.msisdn_device_facts_path,
            converter_result.msisdn_text_facts_path,
            load_batch_id,
        )

        for key in total_rows:
            total_rows[key] += int(getattr(insert_result, key, 0))

        import_runs.append(
            {
                "plugin": {
                    "id": converter_result.plugin_id,
                    "name": converter_result.plugin_name,
                    "description": converter_result.plugin_description,
                },
                "recognized_files": [item["path"] for item in grouped_files],
                "converter_stdout": converter_result.stdout,
                "converter_stderr": converter_result.stderr,
                "manifest": read_manifest(converter_result.manifest_path),
                "score": match.score,
            }
        )

    load_log = {
        "mode": mode,
        "source_dir": str(source_dir),
        "input_files": input_files,
        "recognized_files": [
            {
                "path": match.path,
                "plugin_id": match.plugin_id,
                "plugin_name": match.plugin_name,
                "score": match.score,
            }
            for match in matches
        ],
        "import_runs": import_runs,
    }
    primary_plugin_id = matches[0].plugin_id if len(groups) == 1 and matches else "mixed_batch"
    primary_plugin_name = matches[0].plugin_name if len(groups) == 1 and matches else "Несколько import-плагинов"

    return LoadResult(
        source_path=str(source_dir),
        output_dir=str(output_dir),
        load_batch_id=load_batch_id,
        import_plugin_id=primary_plugin_id,
        import_plugin_name=primary_plugin_name,
        load_log=load_log,
        **total_rows,
    )


async def acquire_project_data_lock(db: AsyncSession, project_id: int) -> None:
    # Transaction-scoped lock: serializes load/clear operations for one project.
    lock_key = 910000000 + int(project_id)
    await db.execute(text("SELECT pg_advisory_xact_lock(:lock_key)"), {"lock_key": lock_key})


async def get_project_data_stats(db: AsyncSession, project_id: int) -> dict[str, int]:
    await ensure_project_data_tables(db)

    cached = await get_project_data_stats_cache(db, project_id)
    if cached is not None:
        return cached

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
    user_msisdn_facts_result = await db.execute(
        text("SELECT COUNT(*) FROM project_user_msisdn_facts WHERE project_id = :project_id"),
        {"project_id": project_id},
    )
    ip_msisdn_facts_result = await db.execute(
        text("SELECT COUNT(*) FROM project_ip_msisdn_facts WHERE project_id = :project_id"),
        {"project_id": project_id},
    )
    msisdn_device_facts_result = await db.execute(
        text("SELECT COUNT(*) FROM project_msisdn_device_facts WHERE project_id = :project_id"),
        {"project_id": project_id},
    )
    msisdn_text_facts_result = await db.execute(
        text("SELECT COUNT(*) FROM project_msisdn_text_facts WHERE project_id = :project_id"),
        {"project_id": project_id},
    )

    stats = {
        "communications_count": int(communications_result.scalar() or 0),
        "device_history_count": int(device_history_result.scalar() or 0),
        "location_events_count": int(location_events_result.scalar() or 0),
        "ip_bindings_count": int(ip_bindings_result.scalar() or 0),
        "user_msisdn_facts_count": int(user_msisdn_facts_result.scalar() or 0),
        "ip_msisdn_facts_count": int(ip_msisdn_facts_result.scalar() or 0),
        "msisdn_device_facts_count": int(msisdn_device_facts_result.scalar() or 0),
        "msisdn_text_facts_count": int(msisdn_text_facts_result.scalar() or 0),
    }
    await set_project_data_stats_cache(db=db, project_id=project_id, **stats)
    return stats


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
    user_msisdn_facts_result = await db.execute(
        text("DELETE FROM project_user_msisdn_facts WHERE project_id = :project_id"),
        {"project_id": project_id},
    )
    ip_msisdn_facts_result = await db.execute(
        text("DELETE FROM project_ip_msisdn_facts WHERE project_id = :project_id"),
        {"project_id": project_id},
    )
    msisdn_device_facts_result = await db.execute(
        text("DELETE FROM project_msisdn_device_facts WHERE project_id = :project_id"),
        {"project_id": project_id},
    )
    msisdn_text_facts_result = await db.execute(
        text("DELETE FROM project_msisdn_text_facts WHERE project_id = :project_id"),
        {"project_id": project_id},
    )
    await set_project_data_stats_cache(
        db=db,
        project_id=project_id,
        communications_count=0,
        device_history_count=0,
        location_events_count=0,
        ip_bindings_count=0,
        user_msisdn_facts_count=0,
        ip_msisdn_facts_count=0,
        msisdn_device_facts_count=0,
        msisdn_text_facts_count=0,
    )
    return {
        "communications_deleted": communications_result.rowcount or 0,
        "device_history_deleted": device_history_result.rowcount or 0,
        "location_events_deleted": location_events_result.rowcount or 0,
        "ip_bindings_deleted": ip_bindings_result.rowcount or 0,
        "user_msisdn_facts_deleted": user_msisdn_facts_result.rowcount or 0,
        "ip_msisdn_facts_deleted": ip_msisdn_facts_result.rowcount or 0,
        "msisdn_device_facts_deleted": msisdn_device_facts_result.rowcount or 0,
        "msisdn_text_facts_deleted": msisdn_text_facts_result.rowcount or 0,
    }


