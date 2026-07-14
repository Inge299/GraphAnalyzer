from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime
from pathlib import Path
from typing import Any

from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.services.project_data_import_utils import (
    read_communications_rows,
    read_device_history_rows,
    read_ip_binding_rows,
    read_location_event_rows,
)


@dataclass
class ImportInsertResult:
    communications_rows: int
    device_history_rows: int
    location_events_rows: int
    ip_bindings_rows: int
    inserted_communications: int
    inserted_device_history: int
    inserted_location_events: int
    inserted_ip_bindings: int


def _canon_pair(a: str, b: str) -> tuple[str, str]:
    left = str(a or "").strip()
    right = str(b or "").strip()
    return (left, right) if left <= right else (right, left)


def _merge_comm(project_id: int, base: dict[str, Any], incoming: dict[str, Any]) -> dict[str, Any]:
    base_start = base.get("time_start")
    base_end = base.get("time_end")
    inc_start = incoming.get("time_start")
    inc_end = incoming.get("time_end")

    base_calls = int(base.get("calls_count") or 0)
    inc_calls = int(incoming.get("calls_count") or 0)

    union_start_candidates = [value for value in (base_start, inc_start) if value is not None]
    union_end_candidates = [value for value in (base_end, inc_end) if value is not None]
    union_start = min(union_start_candidates) if union_start_candidates else None
    union_end = max(union_end_candidates) if union_end_candidates else None

    return {
        "project_id": project_id,
        "abon1": base["abon1"],
        "abon2": base["abon2"],
        "operator1": base.get("operator1") or incoming.get("operator1"),
        "operator2": base.get("operator2") or incoming.get("operator2"),
        "address1": base.get("address1") or incoming.get("address1"),
        "address2": base.get("address2") or incoming.get("address2"),
        "time_start": union_start,
        "time_end": union_end,
        "calls_count": max(0, base_calls + inc_calls),
        "contacts_count": max(1, int(base.get("contacts_count") or 1), int(incoming.get("contacts_count") or 1)),
        "total_duration": int(max(0, int(base.get("total_duration") or 0) + int(incoming.get("total_duration") or 0))),
        "calls_count_approx": bool(base.get("calls_count_approx") or incoming.get("calls_count_approx")),
    }


def _normalize_comm(project_id: int, row: dict[str, Any]) -> dict[str, Any] | None:
    abon1 = str(row.get("abon1") or "").strip()
    abon2 = str(row.get("abon2") or "").strip()
    if not abon1 or not abon2:
        return None

    canon_abon1, canon_abon2 = _canon_pair(abon1, abon2)
    operator1 = row.get("operator1") if canon_abon1 == abon1 else row.get("operator2")
    operator2 = row.get("operator2") if canon_abon2 == abon2 else row.get("operator1")
    address1 = row.get("address1") if canon_abon1 == abon1 else row.get("address2")
    address2 = row.get("address2") if canon_abon2 == abon2 else row.get("address1")

    return {
        "project_id": project_id,
        "abon1": canon_abon1,
        "abon2": canon_abon2,
        "operator1": (operator1 or "").strip() or None,
        "operator2": (operator2 or "").strip() or None,
        "address1": (address1 or "").strip() or None,
        "address2": (address2 or "").strip() or None,
        "time_start": row.get("time_start"),
        "time_end": row.get("time_end"),
        "calls_count": int(row.get("calls_count") or 0),
        "contacts_count": max(1, int(row.get("contacts_count") or 1)),
        "total_duration": int(row.get("total_duration") or 0),
        "calls_count_approx": bool(row.get("calls_count_approx") or False),
    }


def _comm_key(row: dict[str, Any]) -> tuple[str, str]:
    return (row["abon1"], row["abon2"])


def _normalize_device(project_id: int, row: dict[str, Any]) -> dict[str, Any] | None:
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
    starts = [value for value in (base.get("period_start"), incoming.get("period_start")) if value is not None]
    ends = [value for value in (base.get("period_end"), incoming.get("period_end")) if value is not None]
    base["period_start"] = min(starts) if starts else None
    base["period_end"] = max(ends) if ends else None
    return base


async def insert_converted_rows(
    db: AsyncSession,
    project_id: int,
    communications_path: Path,
    device_history_path: Path,
    location_events_path: Path,
    ip_bindings_path: Path,
    load_batch_id: str,
) -> ImportInsertResult:
    communications_rows = read_communications_rows(communications_path, project_id)
    device_rows = read_device_history_rows(device_history_path, project_id)
    batch_marker = datetime.utcnow()
    location_rows = read_location_event_rows(location_events_path, project_id, load_batch_id, batch_marker)
    ip_rows = read_ip_binding_rows(ip_bindings_path, project_id, load_batch_id, batch_marker)

    existing_comm_result = await db.execute(
        text(
            """
            SELECT abon1, abon2, operator1, operator2, address1, address2,
                   time_start, time_end, calls_count, contacts_count, total_duration, calls_count_approx
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

    before_loc_count = int(
        (
            await db.execute(
                text("SELECT COUNT(*) FROM project_location_events_raw WHERE project_id = :project_id"),
                {"project_id": project_id},
            )
        ).scalar()
        or 0
    )
    before_ip_count = int(
        (
            await db.execute(
                text("SELECT COUNT(*) FROM project_identifier_ip_bindings WHERE project_id = :project_id"),
                {"project_id": project_id},
            )
        ).scalar()
        or 0
    )

    comm_by_key: dict[tuple[str, str], dict[str, Any]] = {}
    for raw in existing_comm_rows + communications_rows:
        normalized = _normalize_comm(project_id, raw)
        if not normalized:
            continue
        key = _comm_key(normalized)
        if key in comm_by_key:
            comm_by_key[key] = _merge_comm(project_id, comm_by_key[key], normalized)
        else:
            comm_by_key[key] = normalized

    device_by_key: dict[tuple[str, str, str], dict[str, Any]] = {}
    for raw in existing_device_rows + device_rows:
        normalized = _normalize_device(project_id, raw)
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
                    time_start, time_end, calls_count, contacts_count, total_duration, calls_count_approx, created_at
                ) VALUES (
                    :project_id, :abon1, :abon2, :operator1, :operator2, :address1, :address2,
                    :time_start, :time_end, :calls_count, :contacts_count, :total_duration, :calls_count_approx, :created_at
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

    if location_rows:
        await db.execute(
            text(
                """
                INSERT INTO project_location_events_raw (
                    project_id, load_batch_id, identifier_type, identifier_value,
                    event_time, address, mcc, mnc, lac, bs, created_at
                ) VALUES (
                    :project_id, :load_batch_id, :identifier_type, :identifier_value,
                    :event_time, :address, :mcc, :mnc, :lac, :bs, :created_at
                )
                """
            ),
            location_rows,
        )

    if ip_rows:
        await db.execute(
            text(
                """
                INSERT INTO project_identifier_ip_bindings (
                    project_id, load_batch_id, identifier_type, identifier_value,
                    ip_address, event_time, address, mcc, mnc, lac, bs, created_at
                ) VALUES (
                    :project_id, :load_batch_id, :identifier_type, :identifier_value,
                    :ip_address, :event_time, :address, :mcc, :mnc, :lac, :bs, :created_at
                )
                """
            ),
            ip_rows,
        )

    after_comm_count = len(final_comm_rows)
    after_device_count = len(final_device_rows)
    after_loc_count = int(
        (
            await db.execute(
                text("SELECT COUNT(*) FROM project_location_events_raw WHERE project_id = :project_id"),
                {"project_id": project_id},
            )
        ).scalar()
        or 0
    )
    after_ip_count = int(
        (
            await db.execute(
                text("SELECT COUNT(*) FROM project_identifier_ip_bindings WHERE project_id = :project_id"),
                {"project_id": project_id},
            )
        ).scalar()
        or 0
    )

    inserted_comm = max(0, after_comm_count - before_comm_count)
    inserted_device = max(0, after_device_count - before_device_count)
    inserted_loc = max(0, after_loc_count - before_loc_count)
    inserted_ip = max(0, after_ip_count - before_ip_count)

    return ImportInsertResult(
        communications_rows=len(communications_rows),
        device_history_rows=len(device_rows),
        location_events_rows=len(location_rows),
        ip_bindings_rows=len(ip_rows),
        inserted_communications=inserted_comm,
        inserted_device_history=inserted_device,
        inserted_location_events=inserted_loc,
        inserted_ip_bindings=inserted_ip,
    )
