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
    read_ip_msisdn_fact_rows,
    read_ip_binding_rows,
    read_location_event_rows,
    read_msisdn_device_fact_rows,
    read_msisdn_text_fact_rows,
    read_user_msisdn_fact_rows,
)


@dataclass
class ImportInsertResult:
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




def _merge_comm(project_id: int, base: dict[str, Any], incoming: dict[str, Any]) -> dict[str, Any]:
    """Keep the most complete representation of one connection; do not add duplicate metrics."""
    base_start = base.get("time_start")
    base_end = base.get("time_end")
    inc_start = incoming.get("time_start")
    inc_end = incoming.get("time_end")

    start_candidates = [value for value in (base_start, inc_start) if value is not None]
    end_candidates = [value for value in (base_end, inc_end) if value is not None]

    return {
        "project_id": project_id,
        "abon1": base["abon1"],
        "abon2": base["abon2"],
        "operator1": base.get("operator1") or incoming.get("operator1"),
        "operator2": base.get("operator2") or incoming.get("operator2"),
        "address1": base.get("address1") or incoming.get("address1"),
        "address2": base.get("address2") or incoming.get("address2"),
        "time_start": min(start_candidates) if start_candidates else None,
        "time_end": max(end_candidates) if end_candidates else None,
        "calls_count": max(0, int(base.get("calls_count") or 0), int(incoming.get("calls_count") or 0)),
        "contacts_count": max(1, int(base.get("contacts_count") or 1), int(incoming.get("contacts_count") or 1)),
        "total_duration": max(0, int(base.get("total_duration") or 0), int(incoming.get("total_duration") or 0)),
        "calls_count_approx": bool(base.get("calls_count_approx") or incoming.get("calls_count_approx")),
    }


def _normalize_comm(project_id: int, row: dict[str, Any]) -> dict[str, Any] | None:
    abon1 = str(row.get("abon1") or "").strip()
    abon2 = str(row.get("abon2") or "").strip()
    if not abon1 or not abon2:
        return None

    # Keep source order: abon1 is the originating side and abon2 is the receiving side.
    return {
        "project_id": project_id,
        "abon1": abon1,
        "abon2": abon2,
        "operator1": (row.get("operator1") or "").strip() or None,
        "operator2": (row.get("operator2") or "").strip() or None,
        "address1": (row.get("address1") or "").strip() or None,
        "address2": (row.get("address2") or "").strip() or None,
        "time_start": row.get("time_start"),
        "time_end": row.get("time_end"),
        "calls_count": int(row.get("calls_count") or 0),
        "contacts_count": max(1, int(row.get("contacts_count") or 1)),
        "total_duration": int(row.get("total_duration") or 0),
        "calls_count_approx": bool(row.get("calls_count_approx") or False),
    }


def _comm_key(row: dict[str, Any]) -> tuple[Any, ...]:
    # Duplicates may arrive from several files; retain source direction in the stored fact.
    time_start = row.get("time_start")
    return (
        row["abon1"],
        row["abon2"],
        time_start,
        row.get("time_end") if time_start is None else None,
    )


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


def _location_key(row: dict[str, Any]) -> tuple[Any, ...]:
    return (
        str(row.get("identifier_type") or "").strip().lower(),
        str(row.get("identifier_value") or "").strip(),
        row.get("event_time"),
        str(row.get("address") or "").strip(),
        str(row.get("address_norm") or "").strip(),
        str(row.get("mcc") or "").strip(),
        str(row.get("mnc") or "").strip(),
        str(row.get("lac") or "").strip(),
        str(row.get("bs") or "").strip(),
    )


def _ip_key(row: dict[str, Any]) -> tuple[Any, ...]:
    return (
        str(row.get("identifier_type") or "").strip().lower(),
        str(row.get("identifier_value") or "").strip(),
        str(row.get("ip_address") or "").strip(),
        row.get("event_time"),
        str(row.get("address") or "").strip(),
        str(row.get("address_norm") or "").strip(),
        str(row.get("mcc") or "").strip(),
        str(row.get("mnc") or "").strip(),
        str(row.get("lac") or "").strip(),
        str(row.get("bs") or "").strip(),
        str(row.get("user_id") or "").strip(),
        str(row.get("device_info") or "").strip(),
        str(row.get("message_text") or "").strip(),
    )


def _user_msisdn_fact_key(row: dict[str, Any]) -> tuple[Any, ...]:
    return (
        row.get("event_time"),
        str(row.get("user_id") or "").strip(),
        str(row.get("user_msisdn") or "").strip(),
    )


def _ip_msisdn_fact_key(row: dict[str, Any]) -> tuple[Any, ...]:
    return (
        row.get("event_time"),
        str(row.get("ip_address") or "").strip(),
        str(row.get("user_msisdn") or "").strip(),
    )


def _msisdn_device_fact_key(row: dict[str, Any]) -> tuple[Any, ...]:
    return (
        row.get("event_time"),
        str(row.get("user_msisdn") or "").strip(),
        str(row.get("device_info") or "").strip(),
    )


def _msisdn_text_fact_key(row: dict[str, Any]) -> tuple[Any, ...]:
    return (
        row.get("event_time"),
        str(row.get("user_msisdn") or "").strip(),
        str(row.get("file_msisdn") or "").strip(),
        str(row.get("message_text") or "").strip(),
    )


async def _get_project_data_stats_cache(db: AsyncSession, project_id: int) -> dict[str, int] | None:
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


async def _set_project_data_stats_cache(
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


async def insert_converted_rows(
    db: AsyncSession,
    project_id: int,
    communications_path: Path,
    device_history_path: Path,
    location_events_path: Path,
    ip_bindings_path: Path,
    user_msisdn_facts_path: Path,
    ip_msisdn_facts_path: Path,
    msisdn_device_facts_path: Path,
    msisdn_text_facts_path: Path,
    load_batch_id: str,
) -> ImportInsertResult:
    communications_rows = read_communications_rows(communications_path, project_id)
    device_rows = read_device_history_rows(device_history_path, project_id)
    batch_marker = datetime.utcnow()
    location_rows = read_location_event_rows(location_events_path, project_id, load_batch_id, batch_marker)
    ip_rows = read_ip_binding_rows(ip_bindings_path, project_id, load_batch_id, batch_marker)
    user_msisdn_fact_rows = read_user_msisdn_fact_rows(user_msisdn_facts_path, project_id, load_batch_id, batch_marker)
    ip_msisdn_fact_rows = read_ip_msisdn_fact_rows(ip_msisdn_facts_path, project_id, load_batch_id, batch_marker)
    msisdn_device_fact_rows = read_msisdn_device_fact_rows(msisdn_device_facts_path, project_id, load_batch_id, batch_marker)
    msisdn_text_fact_rows = read_msisdn_text_fact_rows(msisdn_text_facts_path, project_id, load_batch_id, batch_marker)

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
    cached_stats = await _get_project_data_stats_cache(db, project_id)
    before_loc_count = int((cached_stats or {}).get("location_events_count", 0))
    before_ip_count = int((cached_stats or {}).get("ip_bindings_count", 0))
    before_user_msisdn_fact_count = int((cached_stats or {}).get("user_msisdn_facts_count", 0))
    before_ip_msisdn_fact_count = int((cached_stats or {}).get("ip_msisdn_facts_count", 0))
    before_msisdn_device_fact_count = int((cached_stats or {}).get("msisdn_device_facts_count", 0))
    before_msisdn_text_fact_count = int((cached_stats or {}).get("msisdn_text_facts_count", 0))

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
    final_location_rows: list[dict[str, Any]] = []
    seen_location_keys: set[tuple[Any, ...]] = set()
    for row in location_rows:
        key = _location_key(row)
        if key in seen_location_keys:
            continue
        seen_location_keys.add(key)
        final_location_rows.append(row)

    final_ip_rows: list[dict[str, Any]] = []
    seen_ip_keys: set[tuple[Any, ...]] = set()
    for row in ip_rows:
        key = _ip_key(row)
        if key in seen_ip_keys:
            continue
        seen_ip_keys.add(key)
        final_ip_rows.append(row)

    final_user_msisdn_fact_rows: list[dict[str, Any]] = []
    seen_user_msisdn_fact_keys: set[tuple[Any, ...]] = set()
    for row in user_msisdn_fact_rows:
        key = _user_msisdn_fact_key(row)
        if key in seen_user_msisdn_fact_keys:
            continue
        seen_user_msisdn_fact_keys.add(key)
        final_user_msisdn_fact_rows.append(row)

    final_ip_msisdn_fact_rows: list[dict[str, Any]] = []
    seen_ip_msisdn_fact_keys: set[tuple[Any, ...]] = set()
    for row in ip_msisdn_fact_rows:
        key = _ip_msisdn_fact_key(row)
        if key in seen_ip_msisdn_fact_keys:
            continue
        seen_ip_msisdn_fact_keys.add(key)
        final_ip_msisdn_fact_rows.append(row)

    final_msisdn_device_fact_rows: list[dict[str, Any]] = []
    seen_msisdn_device_fact_keys: set[tuple[Any, ...]] = set()
    for row in msisdn_device_fact_rows:
        key = _msisdn_device_fact_key(row)
        if key in seen_msisdn_device_fact_keys:
            continue
        seen_msisdn_device_fact_keys.add(key)
        final_msisdn_device_fact_rows.append(row)

    final_msisdn_text_fact_rows: list[dict[str, Any]] = []
    seen_msisdn_text_fact_keys: set[tuple[Any, ...]] = set()
    for row in msisdn_text_fact_rows:
        key = _msisdn_text_fact_key(row)
        if key in seen_msisdn_text_fact_keys:
            continue
        seen_msisdn_text_fact_keys.add(key)
        final_msisdn_text_fact_rows.append(row)

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

    if final_location_rows:
        await db.execute(
            text(
                """
                INSERT INTO project_location_events_raw (
                    project_id, load_batch_id, identifier_type, identifier_value,
                    event_time, address, address_norm, mcc, mnc, lac, bs, created_at
                ) VALUES (
                    :project_id, :load_batch_id, :identifier_type, :identifier_value,
                    :event_time, :address, :address_norm, :mcc, :mnc, :lac, :bs, :created_at
                )
                ON CONFLICT DO NOTHING
                """
            ),
            final_location_rows,
        )

    if final_ip_rows:
        await db.execute(
            text(
                """
                INSERT INTO project_identifier_ip_bindings (
                    project_id, load_batch_id, identifier_type, identifier_value,
                    ip_address, event_time, address, address_norm, mcc, mnc, lac, bs,
                    user_id, device_info, message_text, created_at
                ) VALUES (
                    :project_id, :load_batch_id, :identifier_type, :identifier_value,
                    :ip_address, :event_time, :address, :address_norm, :mcc, :mnc, :lac, :bs,
                    :user_id, :device_info, :message_text, :created_at
                )
                ON CONFLICT DO NOTHING
                """
            ),
            final_ip_rows,
        )

    if final_user_msisdn_fact_rows:
        await db.execute(
            text(
                """
                INSERT INTO project_user_msisdn_facts (
                    project_id, load_batch_id, event_time, user_id, user_msisdn, created_at
                ) VALUES (
                    :project_id, :load_batch_id, :event_time, :user_id, :user_msisdn, :created_at
                )
                ON CONFLICT DO NOTHING
                """
            ),
            final_user_msisdn_fact_rows,
        )

    if final_ip_msisdn_fact_rows:
        await db.execute(
            text(
                """
                INSERT INTO project_ip_msisdn_facts (
                    project_id, load_batch_id, event_time, ip_address, user_msisdn, created_at
                ) VALUES (
                    :project_id, :load_batch_id, :event_time, :ip_address, :user_msisdn, :created_at
                )
                ON CONFLICT DO NOTHING
                """
            ),
            final_ip_msisdn_fact_rows,
        )

    if final_msisdn_device_fact_rows:
        await db.execute(
            text(
                """
                INSERT INTO project_msisdn_device_facts (
                    project_id, load_batch_id, event_time, user_msisdn, device_info, created_at
                ) VALUES (
                    :project_id, :load_batch_id, :event_time, :user_msisdn, :device_info, :created_at
                )
                ON CONFLICT DO NOTHING
                """
            ),
            final_msisdn_device_fact_rows,
        )

    if final_msisdn_text_fact_rows:
        await db.execute(
            text(
                """
                INSERT INTO project_msisdn_text_facts (
                    project_id, load_batch_id, event_time, user_msisdn, file_msisdn, message_text, created_at
                ) VALUES (
                    :project_id, :load_batch_id, :event_time, :user_msisdn, :file_msisdn, :message_text, :created_at
                )
                ON CONFLICT DO NOTHING
                """
            ),
            final_msisdn_text_fact_rows,
        )

    after_comm_count = len(final_comm_rows)
    after_device_count = len(final_device_rows)
    inserted_loc = int(
        (
            await db.execute(
                text(
                    """
                    SELECT COUNT(*)
                    FROM project_location_events_raw
                    WHERE project_id = :project_id
                      AND load_batch_id = :load_batch_id
                    """
                ),
                {"project_id": project_id, "load_batch_id": load_batch_id},
            )
        ).scalar()
        or 0
    )
    inserted_ip = int(
        (
            await db.execute(
                text(
                    """
                    SELECT COUNT(*)
                    FROM project_identifier_ip_bindings
                    WHERE project_id = :project_id
                      AND load_batch_id = :load_batch_id
                    """
                ),
                {"project_id": project_id, "load_batch_id": load_batch_id},
            )
        ).scalar()
        or 0
    )
    inserted_user_msisdn_facts = int(
        (
            await db.execute(
                text(
                    """
                    SELECT COUNT(*)
                    FROM project_user_msisdn_facts
                    WHERE project_id = :project_id
                      AND load_batch_id = :load_batch_id
                    """
                ),
                {"project_id": project_id, "load_batch_id": load_batch_id},
            )
        ).scalar()
        or 0
    )
    inserted_ip_msisdn_facts = int(
        (
            await db.execute(
                text(
                    """
                    SELECT COUNT(*)
                    FROM project_ip_msisdn_facts
                    WHERE project_id = :project_id
                      AND load_batch_id = :load_batch_id
                    """
                ),
                {"project_id": project_id, "load_batch_id": load_batch_id},
            )
        ).scalar()
        or 0
    )
    inserted_msisdn_device_facts = int(
        (
            await db.execute(
                text(
                    """
                    SELECT COUNT(*)
                    FROM project_msisdn_device_facts
                    WHERE project_id = :project_id
                      AND load_batch_id = :load_batch_id
                    """
                ),
                {"project_id": project_id, "load_batch_id": load_batch_id},
            )
        ).scalar()
        or 0
    )
    inserted_msisdn_text_facts = int(
        (
            await db.execute(
                text(
                    """
                    SELECT COUNT(*)
                    FROM project_msisdn_text_facts
                    WHERE project_id = :project_id
                      AND load_batch_id = :load_batch_id
                    """
                ),
                {"project_id": project_id, "load_batch_id": load_batch_id},
            )
        ).scalar()
        or 0
    )
    after_loc_count = before_loc_count + inserted_loc
    after_ip_count = before_ip_count + inserted_ip
    after_user_msisdn_fact_count = before_user_msisdn_fact_count + inserted_user_msisdn_facts
    after_ip_msisdn_fact_count = before_ip_msisdn_fact_count + inserted_ip_msisdn_facts
    after_msisdn_device_fact_count = before_msisdn_device_fact_count + inserted_msisdn_device_facts
    after_msisdn_text_fact_count = before_msisdn_text_fact_count + inserted_msisdn_text_facts

    inserted_comm = max(0, after_comm_count - before_comm_count)
    inserted_device = max(0, after_device_count - before_device_count)
    inserted_loc = max(0, inserted_loc)
    inserted_ip = max(0, inserted_ip)
    inserted_user_msisdn_facts = max(0, inserted_user_msisdn_facts)
    inserted_ip_msisdn_facts = max(0, inserted_ip_msisdn_facts)
    inserted_msisdn_device_facts = max(0, inserted_msisdn_device_facts)
    inserted_msisdn_text_facts = max(0, inserted_msisdn_text_facts)

    await _set_project_data_stats_cache(
        db=db,
        project_id=project_id,
        communications_count=after_comm_count,
        device_history_count=after_device_count,
        location_events_count=after_loc_count,
        ip_bindings_count=after_ip_count,
        user_msisdn_facts_count=after_user_msisdn_fact_count,
        ip_msisdn_facts_count=after_ip_msisdn_fact_count,
        msisdn_device_facts_count=after_msisdn_device_fact_count,
        msisdn_text_facts_count=after_msisdn_text_fact_count,
    )

    return ImportInsertResult(
        communications_rows=len(communications_rows),
        device_history_rows=len(device_rows),
        location_events_rows=len(location_rows),
        ip_bindings_rows=len(ip_rows),
        user_msisdn_facts_rows=len(user_msisdn_fact_rows),
        ip_msisdn_facts_rows=len(ip_msisdn_fact_rows),
        msisdn_device_facts_rows=len(msisdn_device_fact_rows),
        msisdn_text_facts_rows=len(msisdn_text_fact_rows),
        inserted_communications=inserted_comm,
        inserted_device_history=inserted_device,
        inserted_location_events=inserted_loc,
        inserted_ip_bindings=inserted_ip,
        inserted_user_msisdn_facts=inserted_user_msisdn_facts,
        inserted_ip_msisdn_facts=inserted_ip_msisdn_facts,
        inserted_msisdn_device_facts=inserted_msisdn_device_facts,
        inserted_msisdn_text_facts=inserted_msisdn_text_facts,
    )
