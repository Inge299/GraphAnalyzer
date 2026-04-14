from __future__ import annotations

import csv
import json
import subprocess
import sys
from dataclasses import dataclass
from datetime import datetime
from pathlib import Path
from typing import Any

from fastapi import HTTPException
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

DATA_ROOT = Path("/app/data")
SCRIPT_PATH = Path("/app/scripts/nodex_converter.py")


@dataclass
class LoadResult:
    source_path: str
    output_dir: str
    communications_rows: int
    device_history_rows: int
    inserted_communications: int
    inserted_device_history: int
    load_log: dict[str, Any]


@dataclass
class ConverterResult:
    communications_path: Path
    device_history_path: Path
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


def _parse_iso_datetime(value: str) -> datetime | None:
    text_value = (value or "").strip()
    if not text_value:
        return None
    for fmt in ("%Y-%m-%d %H:%M:%S", "%Y-%m-%d"):
        try:
            return datetime.strptime(text_value, fmt)
        except ValueError:
            continue
    return None


def _collect_input_files(source_dir: Path) -> list[dict[str, Any]]:
    files: list[dict[str, Any]] = []
    for path in sorted(source_dir.rglob("*")):
        if not path.is_file():
            continue
        files.append(
            {
                "path": str(path.relative_to(source_dir)).replace("\\", "/"),
                "size_bytes": path.stat().st_size,
            }
        )
    return files


def _read_manifest(manifest_path: Path) -> dict[str, Any]:
    if not manifest_path.exists():
        return {}
    try:
        return json.loads(manifest_path.read_text(encoding="utf-8"))
    except Exception:
        return {}


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


def _run_converter(source_dir: Path, output_dir: Path) -> ConverterResult:
    if not SCRIPT_PATH.exists():
        raise HTTPException(status_code=500, detail=f"Nodex converter not found: {SCRIPT_PATH}")

    output_dir.mkdir(parents=True, exist_ok=True)
    communications_path = output_dir / "communications.csv"
    device_history_path = output_dir / "device_history.csv"
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
        "--out-manifest",
        str(manifest_path),
        "--postgres-friendly",
    ]
    completed = subprocess.run(command, capture_output=True, text=True, timeout=300)
    if completed.returncode != 0:
        stderr = (completed.stderr or completed.stdout or "").strip()
        raise HTTPException(status_code=400, detail=f"Nodex conversion failed: {stderr[:1200]}")

    if not communications_path.exists() or not device_history_path.exists():
        raise HTTPException(status_code=500, detail="Conversion finished without output CSV files")

    return ConverterResult(
        communications_path=communications_path,
        device_history_path=device_history_path,
        manifest_path=manifest_path,
        stdout=(completed.stdout or "").strip(),
        stderr=(completed.stderr or "").strip(),
    )


def _first_present(row: dict[str, Any], candidates: list[str]) -> Any:
    for key in candidates:
        if key in row and row.get(key) is not None:
            return row.get(key)
    return None


def _read_communications_rows(path: Path, project_id: int) -> list[dict[str, Any]]:
    rows: list[dict[str, Any]] = []

    key_abon1 = ["Абон1", "abon1", "Abon1"]
    key_abon2 = ["Абон2", "abon2", "Abon2"]
    key_operator1 = ["оператор1", "operator1"]
    key_operator2 = ["оператор2", "operator2"]
    key_address1 = ["Адрес1", "address1"]
    key_address2 = ["Адрес2", "address2"]
    key_time_start = ["время_начала", "time_start"]
    key_time_end = ["время_конца", "time_end"]
    key_calls = ["количество_связей", "calls_count"]
    key_duration = ["общая_продолжительность", "total_duration"]

    with path.open("r", encoding="utf-8") as fh:
        reader = csv.DictReader(fh, delimiter=";")
        for row in reader:
            abon1 = _first_present(row, key_abon1)
            abon2 = _first_present(row, key_abon2)
            operator1 = _first_present(row, key_operator1)
            operator2 = _first_present(row, key_operator2)
            address1 = _first_present(row, key_address1)
            address2 = _first_present(row, key_address2)
            time_start = _first_present(row, key_time_start)
            time_end = _first_present(row, key_time_end)
            calls_count = _first_present(row, key_calls)
            total_duration = _first_present(row, key_duration)

            rows.append(
                {
                    "project_id": project_id,
                    "abon1": (str(abon1 or "").strip()),
                    "abon2": (str(abon2 or "").strip()),
                    "operator1": (str(operator1 or "").strip()) or None,
                    "operator2": (str(operator2 or "").strip()) or None,
                    "address1": (str(address1 or "").strip()) or None,
                    "address2": (str(address2 or "").strip()) or None,
                    "time_start": _parse_iso_datetime(str(time_start or "")),
                    "time_end": _parse_iso_datetime(str(time_end or "")),
                    "calls_count": int((str(calls_count or "0").strip()) or "0"),
                    "total_duration": int((str(total_duration or "0").strip()) or "0"),
                }
            )
    return rows


def _read_device_history_rows(path: Path, project_id: int) -> list[dict[str, Any]]:
    rows: list[dict[str, Any]] = []

    key_abon = ["абон", "abon"]
    key_imsi = ["imsi"]
    key_imei = ["imei"]
    key_period_start = ["начало_периода", "period_start"]
    key_period_end = ["окончание_периода", "period_end"]

    with path.open("r", encoding="utf-8") as fh:
        reader = csv.DictReader(fh, delimiter=";")
        for row in reader:
            abon = _first_present(row, key_abon)
            imsi = _first_present(row, key_imsi)
            imei = _first_present(row, key_imei)
            period_start = _first_present(row, key_period_start)
            period_end = _first_present(row, key_period_end)

            rows.append(
                {
                    "project_id": project_id,
                    "abon": (str(abon or "").strip()),
                    "imsi": (str(imsi or "").strip()) or None,
                    "imei": (str(imei or "").strip()) or None,
                    "period_start": _parse_iso_datetime(str(period_start or "")),
                    "period_end": _parse_iso_datetime(str(period_end or "")),
                }
            )
    return rows



async def _insert_converted_rows(
    db: AsyncSession,
    project_id: int,
    communications_path: Path,
    device_history_path: Path,
) -> tuple[int, int, int, int]:
    communications_rows = _read_communications_rows(communications_path, project_id)
    device_rows = _read_device_history_rows(device_history_path, project_id)

    existing_comm_result = await db.execute(
        text(
            """
            SELECT abon1, abon2, operator1, operator2, address1, address2,
                   time_start, time_end, calls_count, total_duration, calls_count_approx
            FROM project_communications
            WHERE project_id = :project_id
            """
        ),
        {"project_id": project_id},
    )
    existing_device_result = await db.execute(
        text(
            """
            SELECT abon, imsi, imei, period_start, period_end
            FROM project_device_history
            WHERE project_id = :project_id
            """
        ),
        {"project_id": project_id},
    )

    existing_comm_rows = [dict(row._mapping) for row in existing_comm_result]
    existing_device_rows = [dict(row._mapping) for row in existing_device_result]

    def _to_float_seconds(start: datetime | None, end: datetime | None) -> float:
        if start is None or end is None:
            return 0.0
        seconds = (end - start).total_seconds()
        return seconds if seconds > 0 else 0.0

    def _canon_pair(a: str, b: str) -> tuple[str, str]:
        left = str(a or "").strip()
        right = str(b or "").strip()
        return (left, right) if left <= right else (right, left)

    def _merge_comm(base: dict[str, Any], incoming: dict[str, Any]) -> dict[str, Any]:
        base_start = base.get("time_start")
        base_end = base.get("time_end")
        inc_start = incoming.get("time_start")
        inc_end = incoming.get("time_end")

        base_calls = int(base.get("calls_count") or 0)
        inc_calls = int(incoming.get("calls_count") or 0)

        base_duration = _to_float_seconds(base_start, base_end)
        inc_duration = _to_float_seconds(inc_start, inc_end)

        union_start_candidates = [v for v in (base_start, inc_start) if v is not None]
        union_end_candidates = [v for v in (base_end, inc_end) if v is not None]
        union_start = min(union_start_candidates) if union_start_candidates else None
        union_end = max(union_end_candidates) if union_end_candidates else None
        union_duration = _to_float_seconds(union_start, union_end)

        if base_duration >= inc_duration:
            larger_calls, larger_duration = base_calls, base_duration
            smaller_calls, smaller_duration = inc_calls, inc_duration
        else:
            larger_calls, larger_duration = inc_calls, inc_duration
            smaller_calls, smaller_duration = base_calls, base_duration

        if larger_duration > 0 and smaller_duration > 0 and union_duration >= larger_duration:
            added_duration = max(0.0, union_duration - larger_duration)
            density = smaller_calls / smaller_duration
            approx_calls = int(round(larger_calls + density * added_duration))
            approx_flag = True
        else:
            approx_calls = base_calls + inc_calls
            approx_flag = bool(base.get("calls_count_approx") or incoming.get("calls_count_approx"))

        merged = {
            "project_id": project_id,
            "abon1": base["abon1"],
            "abon2": base["abon2"],
            "operator1": base.get("operator1") or incoming.get("operator1"),
            "operator2": base.get("operator2") or incoming.get("operator2"),
            "address1": base.get("address1") or incoming.get("address1"),
            "address2": base.get("address2") or incoming.get("address2"),
            "time_start": union_start,
            "time_end": union_end,
            "calls_count": max(0, approx_calls),
            "total_duration": int(max(base.get("total_duration") or 0, incoming.get("total_duration") or 0)),
            "calls_count_approx": approx_flag,
        }
        return merged

    def _normalize_comm(row: dict[str, Any]) -> dict[str, Any] | None:
        abon1 = str(row.get("abon1") or "").strip()
        abon2 = str(row.get("abon2") or "").strip()
        if not abon1 or not abon2:
            return None
        c1, c2 = _canon_pair(abon1, abon2)

        operator1 = row.get("operator1") if c1 == abon1 else row.get("operator2")
        operator2 = row.get("operator2") if c2 == abon2 else row.get("operator1")
        address1 = row.get("address1") if c1 == abon1 else row.get("address2")
        address2 = row.get("address2") if c2 == abon2 else row.get("address1")

        return {
            "project_id": project_id,
            "abon1": c1,
            "abon2": c2,
            "operator1": (operator1 or "").strip() or None,
            "operator2": (operator2 or "").strip() or None,
            "address1": (address1 or "").strip() or None,
            "address2": (address2 or "").strip() or None,
            "time_start": row.get("time_start"),
            "time_end": row.get("time_end"),
            "calls_count": int(row.get("calls_count") or 0),
            "total_duration": int(row.get("total_duration") or 0),
            "calls_count_approx": bool(row.get("calls_count_approx") or False),
        }

    def _comm_key(row: dict[str, Any]) -> tuple[str, str]:
        return (row["abon1"], row["abon2"])

    comm_by_key: dict[tuple[str, str], dict[str, Any]] = {}
    for raw in existing_comm_rows:
        normalized = _normalize_comm(raw)
        if not normalized:
            continue
        key = _comm_key(normalized)
        if key in comm_by_key:
            comm_by_key[key] = _merge_comm(comm_by_key[key], normalized)
        else:
            comm_by_key[key] = normalized

    for raw in communications_rows:
        normalized = _normalize_comm(raw)
        if not normalized:
            continue
        key = _comm_key(normalized)
        if key in comm_by_key:
            comm_by_key[key] = _merge_comm(comm_by_key[key], normalized)
        else:
            comm_by_key[key] = normalized

    def _normalize_device(row: dict[str, Any]) -> dict[str, Any] | None:
        abon = str(row.get("abon") or "").strip()
        imsi = str(row.get("imsi") or "").strip()
        imei = str(row.get("imei") or "").strip()
        if not abon:
            return None
        return {
            "project_id": project_id,
            "abon": abon,
            "imsi": imsi or None,
            "imei": imei or None,
            "period_start": row.get("period_start"),
            "period_end": row.get("period_end"),
        }

    def _device_key(row: dict[str, Any]) -> tuple[str, str, str]:
        return (
            str(row.get("abon") or "").strip(),
            str(row.get("imsi") or "").strip(),
            str(row.get("imei") or "").strip(),
        )

    def _merge_device(base: dict[str, Any], incoming: dict[str, Any]) -> dict[str, Any]:
        starts = [v for v in (base.get("period_start"), incoming.get("period_start")) if v is not None]
        ends = [v for v in (base.get("period_end"), incoming.get("period_end")) if v is not None]
        base["period_start"] = min(starts) if starts else None
        base["period_end"] = max(ends) if ends else None
        return base

    device_by_key: dict[tuple[str, str, str], dict[str, Any]] = {}
    for raw in existing_device_rows:
        normalized = _normalize_device(raw)
        if not normalized:
            continue
        key = _device_key(normalized)
        if key in device_by_key:
            device_by_key[key] = _merge_device(device_by_key[key], normalized)
        else:
            device_by_key[key] = normalized

    for raw in device_rows:
        normalized = _normalize_device(raw)
        if not normalized:
            continue
        key = _device_key(normalized)
        if key in device_by_key:
            device_by_key[key] = _merge_device(device_by_key[key], normalized)
        else:
            device_by_key[key] = normalized

    before_comm_count = len(existing_comm_rows)
    before_device_count = len(existing_device_rows)

    await db.execute(text("DELETE FROM project_communications WHERE project_id = :project_id"), {"project_id": project_id})
    await db.execute(text("DELETE FROM project_device_history WHERE project_id = :project_id"), {"project_id": project_id})

    final_comm_rows = list(comm_by_key.values())
    final_device_rows = list(device_by_key.values())

    batch_marker = datetime.utcnow()
    for row in final_comm_rows:
        row["created_at"] = batch_marker
    for row in final_device_rows:
        row["created_at"] = batch_marker

    if final_comm_rows:
        await db.execute(
            text(
                """
                INSERT INTO project_communications (
                    project_id, abon1, abon2, operator1, operator2, address1, address2,
                    time_start, time_end, calls_count, total_duration, calls_count_approx, created_at
                ) VALUES (
                    :project_id, :abon1, :abon2, :operator1, :operator2, :address1, :address2,
                    :time_start, :time_end, :calls_count, :total_duration, :calls_count_approx, :created_at
                )
                """
            ),
            final_comm_rows,
        )

    if final_device_rows:
        await db.execute(
            text(
                """
                INSERT INTO project_device_history (
                    project_id, abon, imsi, imei, period_start, period_end, created_at
                ) VALUES (
                    :project_id, :abon, :imsi, :imei, :period_start, :period_end, :created_at
                )
                """
            ),
            final_device_rows,
        )

    after_comm_count = len(final_comm_rows)
    after_device_count = len(final_device_rows)

    inserted_comm = max(0, after_comm_count - before_comm_count)
    inserted_device = max(0, after_device_count - before_device_count)

    return len(communications_rows), len(device_rows), inserted_comm, inserted_device


def _normalize_upload_relative_path(raw_name: str) -> Path:
    normalized = (raw_name or "").replace("\\", "/").strip().lstrip("/")
    if not normalized:
        raise HTTPException(status_code=400, detail="Uploaded file has no name")
    parts = [part for part in Path(normalized).parts if part not in ("", ".", "..")]
    if not parts:
        raise HTTPException(status_code=400, detail="Invalid file name")
    return Path(*parts)


async def _save_uploaded_files(upload_dir: Path, files: list[Any]) -> list[dict[str, Any]]:
    upload_dir.mkdir(parents=True, exist_ok=True)
    saved: list[dict[str, Any]] = []
    root = upload_dir.resolve()
    for file_obj in files:
        filename = str(getattr(file_obj, "filename", "") or "").strip()
        if not filename:
            continue
        rel_path = _normalize_upload_relative_path(filename)
        target = (upload_dir / rel_path).resolve()
        if root not in target.parents and target != root:
            raise HTTPException(status_code=400, detail="Invalid uploaded file path")
        target.parent.mkdir(parents=True, exist_ok=True)
        content = await file_obj.read()
        if not content:
            continue
        target.write_bytes(content)
        saved.append({"path": str(rel_path).replace("\\", "/"), "size_bytes": len(content)})

    if not saved:
        raise HTTPException(status_code=400, detail="No files received for upload")

    return saved


async def load_project_data(db: AsyncSession, project_id: int, source_path: str) -> LoadResult:
    source_dir = _resolve_source_path(source_path)
    timestamp = datetime.utcnow().strftime("%Y%m%d_%H%M%S")
    output_dir = DATA_ROOT / "imports" / f"project_{project_id}" / timestamp
    input_files = _collect_input_files(source_dir)
    converter_result = _run_converter(source_dir, output_dir)

    await ensure_project_data_tables(db)
    comm_rows, device_rows, inserted_comm, inserted_device = await _insert_converted_rows(
        db, project_id, converter_result.communications_path, converter_result.device_history_path
    )

    load_log = {
        "mode": "source_path",
        "source_dir": str(source_dir),
        "input_files": input_files,
        "converter_stdout": converter_result.stdout,
        "converter_stderr": converter_result.stderr,
        "manifest": _read_manifest(converter_result.manifest_path),
    }

    return LoadResult(
        source_path=str(source_dir),
        output_dir=str(output_dir),
        communications_rows=comm_rows,
        device_history_rows=device_rows,
        inserted_communications=inserted_comm,
        inserted_device_history=inserted_device,
        load_log=load_log,
    )


async def load_project_data_from_upload(db: AsyncSession, project_id: int, files: list[Any]) -> LoadResult:
    timestamp = datetime.utcnow().strftime("%Y%m%d_%H%M%S")
    source_dir = DATA_ROOT / "uploads" / f"project_{project_id}" / timestamp
    uploaded_files = await _save_uploaded_files(source_dir, files)
    output_dir = DATA_ROOT / "imports" / f"project_{project_id}" / timestamp
    converter_result = _run_converter(source_dir, output_dir)

    await ensure_project_data_tables(db)
    comm_rows, device_rows, inserted_comm, inserted_device = await _insert_converted_rows(
        db, project_id, converter_result.communications_path, converter_result.device_history_path
    )

    load_log = {
        "mode": "upload",
        "source_dir": str(source_dir),
        "uploaded_files": uploaded_files,
        "converter_stdout": converter_result.stdout,
        "converter_stderr": converter_result.stderr,
        "manifest": _read_manifest(converter_result.manifest_path),
    }

    return LoadResult(
        source_path=str(source_dir),
        output_dir=str(output_dir),
        communications_rows=comm_rows,
        device_history_rows=device_rows,
        inserted_communications=inserted_comm,
        inserted_device_history=inserted_device,
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

    return {
        "communications_count": int(communications_result.scalar() or 0),
        "device_history_count": int(device_history_result.scalar() or 0),
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
    return {
        "communications_deleted": communications_result.rowcount or 0,
        "device_history_deleted": device_history_result.rowcount or 0,
    }



