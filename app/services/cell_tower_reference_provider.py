"""External reference-provider contract for cell tower lookups."""
from __future__ import annotations

import asyncio
import re
from dataclasses import dataclass
from typing import Any, Iterable

import psycopg2
from psycopg2.extras import RealDictCursor

from app.config import settings
from app.services.reference_provider_registry import get_reference_provider

PROVIDER_ID = "external_postgres_cell_towers"
_IDENTIFIER = re.compile(r"^[A-Za-z_][A-Za-z0-9_]*(?:\.[A-Za-z_][A-Za-z0-9_]*)?$")


@dataclass(frozen=True)
class CellTowerReferenceProviderStatus:
    enabled: bool
    provider_id: str
    label: str
    detail: str


def _clean(value: object) -> str:
    return str(value or "").strip()


def _key(item: dict[str, Any]) -> tuple[str, str, str, str]:
    return (_clean(item.get("mcc")), _clean(item.get("mnc")).lstrip("0"), _clean(item.get("lac")), _clean(item.get("bs") or item.get("cid")))


def _provider() -> dict[str, Any]:
    return get_reference_provider(PROVIDER_ID)


def _table(provider: dict[str, Any]) -> str:
    config = provider.get("config") if isinstance(provider.get("config"), dict) else {}
    return _clean(config.get("table")) or _clean(settings.CELL_TOWER_REFERENCE_TABLE)


def get_cell_tower_reference_provider_status() -> CellTowerReferenceProviderStatus:
    provider = _provider()
    label = _clean(provider.get("name")) or "Внешний справочник БС"
    if not provider.get("enabled", True):
        return CellTowerReferenceProviderStatus(False, PROVIDER_ID, label, "Провайдер отключен в метаданных")
    dsn = _clean(settings.CELL_TOWER_REFERENCE_DSN)
    table = _table(provider)
    if not dsn:
        return CellTowerReferenceProviderStatus(False, PROVIDER_ID, label, "CELL_TOWER_REFERENCE_DSN не задан")
    if not _IDENTIFIER.fullmatch(table):
        return CellTowerReferenceProviderStatus(False, PROVIDER_ID, label, "Некорректное имя таблицы справочника")
    return CellTowerReferenceProviderStatus(True, PROVIDER_ID, label, f"PostgreSQL: {table}")


def _resolve_sync(cells: list[dict[str, Any]]) -> dict[tuple[str, str, str, str], dict[str, Any]]:
    status = get_cell_tower_reference_provider_status()
    if not status.enabled or not cells:
        return {}
    requested = list(dict.fromkeys(_key(item) for item in cells if _key(item)[2] and _key(item)[3]))
    if not requested:
        return {}
    values_sql = ", ".join(["(%s, %s, %s, %s)"] * len(requested))
    params: list[str] = [value for cell in requested for value in cell]
    table = _table(_provider())
    sql = f"""
        WITH requested(mcc, mnc, lac, cid) AS (VALUES {values_sql}),
        candidates AS (
            SELECT requested.mcc AS request_mcc, requested.mnc AS request_mnc, requested.lac AS request_lac, requested.cid AS request_cid,
                   tower.latitude, tower.longitude, tower.address,
                   row_number() OVER (
                     PARTITION BY requested.mcc, requested.mnc, requested.lac, requested.cid
                     ORDER BY CASE WHEN requested.mcc <> '' AND coalesce(tower.mcc, '') = requested.mcc THEN 0 ELSE 1 END,
                              CASE WHEN requested.mnc <> '' AND ltrim(coalesce(tower.mnc, ''), '0') = requested.mnc THEN 0 ELSE 1 END
                   ) AS rank
            FROM requested JOIN {table} tower
              ON tower.lac = requested.lac AND tower.cid = requested.cid
             AND (requested.mcc = '' OR coalesce(tower.mcc, '') = requested.mcc)
             AND (requested.mnc = '' OR ltrim(coalesce(tower.mnc, ''), '0') = requested.mnc)
            WHERE tower.latitude IS NOT NULL AND tower.longitude IS NOT NULL
        )
        SELECT request_mcc, request_mnc, request_lac, request_cid, latitude, longitude, address FROM candidates WHERE rank = 1
    """
    connection = psycopg2.connect(settings.CELL_TOWER_REFERENCE_DSN, connect_timeout=settings.CELL_TOWER_REFERENCE_TIMEOUT_SECONDS)
    try:
        with connection.cursor(cursor_factory=RealDictCursor) as cursor:
            cursor.execute(sql, params)
            result: dict[tuple[str, str, str, str], dict[str, Any]] = {}
            for row in cursor.fetchall():
                key = (_clean(row["request_mcc"]), _clean(row["request_mnc"]), _clean(row["request_lac"]), _clean(row["request_cid"]))
                result[key] = {"latitude": float(row["latitude"]), "longitude": float(row["longitude"]), "address": _clean(row.get("address")) or None}
            return result
    finally:
        connection.close()


async def resolve_cell_towers(cells: Iterable[dict[str, Any]]) -> dict[tuple[str, str, str, str], dict[str, Any]]:
    return await asyncio.to_thread(_resolve_sync, list(cells))
