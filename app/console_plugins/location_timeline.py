from __future__ import annotations

from datetime import datetime
import re
from typing import Any, Dict, Optional

from sqlalchemy import text

from app.console_plugins import ConsoleExecutorPlugin
from app.console_plugins._graph_analysis_utils import column, graph_payload, node_id, node_label, selected_node_ids, tab
from app.database import AsyncSessionLocal
from app.services.project_data_service import ensure_project_data_tables


def _digits(value: object) -> str:
    return re.sub(r"\D", "", str(value or ""))


def _requested_msisdns(value: object) -> list[str]:
    result = [_digits(part) for part in re.split(r"[\s,;]+", str(value or ""))]
    return [item for item in dict.fromkeys(result) if item]


def _selected_msisdns(artifact: Optional[Dict[str, Any]], context: Optional[Dict[str, Any]]) -> list[str]:
    context_nodes = context.get("selected_nodes") if isinstance(context, dict) and isinstance(context.get("selected_nodes"), list) else []
    if context_nodes:
        nodes, selected = [item for item in context_nodes if isinstance(item, dict)], None
    else:
        nodes, _ = graph_payload(artifact)
        selected = selected_node_ids(context)
    values: list[str] = []
    for node in nodes:
        if selected is not None and node_id(node) not in selected:
            continue
        if str(node.get("type") or "").casefold() == "msisdn":
            values.append(_digits(node_label(node)))
    return [item for item in dict.fromkeys(values) if item]


class LocationTimelineExecutor(ConsoleExecutorPlugin):
    id = "location_timeline"
    name = "Последовательность локаций"
    description = "Показывает события местоположения выбранных MSISDN и создаёт обновляемую карту маршрута по известным координатам базовых станций."
    menu_path = "Анализ/Гео"
    menu_order = 10
    supports_graph_selection = True
    params_schema = [
        {"name": "msisdn", "label": "MSISDN (через запятую, если не выбран на графе)", "type": "string", "default": "", "required": False},
        {"name": "date_from", "label": "Начало периода", "type": "date", "default": "", "required": False},
        {"name": "date_to", "label": "Конец периода", "type": "date", "default": "", "required": False},
        {"name": "limit", "label": "Лимит событий на карте (0 - все)", "type": "integer", "default": 1000, "required": False},
    ]

    async def execute(self, *, project_id: int, artifact: Optional[Dict[str, Any]] = None, params: Optional[Dict[str, Any]] = None, context: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
        values = params or {}
        msisdns = _requested_msisdns(values.get("msisdn")) or _selected_msisdns(artifact, context)
        if not msisdns:
            return self._empty("Выберите на графе узел типа MSISDN или укажите номер в параметре.")
        try:
            limit = int(values.get("limit") or 0)
            date_from = datetime.fromisoformat(str(values["date_from"]).strip()) if values.get("date_from") else None
            date_to = datetime.fromisoformat(str(values["date_to"]).strip()) if values.get("date_to") else None
            if limit < 0:
                raise ValueError
        except ValueError:
            return self._empty("Проверьте даты и лимит: лимит должен быть неотрицательным числом.")

        bind: dict[str, Any] = {"project_id": project_id}
        placeholders: list[str] = []
        for index, msisdn in enumerate(msisdns):
            key = f"msisdn_{index}"
            bind[key] = msisdn
            placeholders.append(f":{key}")
        filters = ["location.project_id = :project_id", "regexp_replace(location.identifier_value, '\\D', '', 'g') IN (" + ", ".join(placeholders) + ")"]
        if date_from:
            filters.append("location.event_time >= :date_from")
            bind["date_from"] = date_from
        if date_to:
            filters.append("location.event_time < :date_to + INTERVAL '1 day'")
            bind["date_to"] = date_to
        if limit:
            bind["limit"] = limit
        limit_sql = " LIMIT :limit" if limit else ""
        sql = """
            SELECT DISTINCT ON (
                regexp_replace(location.identifier_value, '\\D', '', 'g'), location.event_time,
                COALESCE(location.address_norm, location.address, ''), COALESCE(location.lac, ''), COALESCE(location.bs, '')
            )
                regexp_replace(location.identifier_value, '\\D', '', 'g') AS msisdn,
                location.event_time, location.address, location.mcc, location.mnc, location.lac, location.bs,
                tower.latitude, tower.longitude, COALESCE(tower.address, location.address) AS resolved_address
            FROM project_location_events_raw location
            LEFT JOIN LATERAL (
                SELECT latitude, longitude, address
                FROM cell_tower_reference tower
                WHERE tower.lac = location.lac AND tower.cid = location.bs
                  AND (location.mcc IS NULL OR location.mcc = '' OR tower.mcc = location.mcc)
                  AND (
                      location.mnc IS NULL OR location.mnc = ''
                      OR NULLIF(ltrim(tower.mnc, '0'), '') = NULLIF(ltrim(location.mnc, '0'), '')
                  )
                ORDER BY tower.loaded_at DESC
                LIMIT 1
            ) tower ON TRUE
            WHERE """ + " AND ".join(filters) + """
            ORDER BY regexp_replace(location.identifier_value, '\\D', '', 'g'), location.event_time,
                     COALESCE(location.address_norm, location.address, ''), COALESCE(location.lac, ''), COALESCE(location.bs, '')
        """ + limit_sql
        async with AsyncSessionLocal() as db:
            await ensure_project_data_tables(db)
            result = await db.execute(text(sql), bind)
            source_rows = [dict(row._mapping) for row in result.fetchall()]

        rows: list[dict[str, Any]] = []
        points: list[dict[str, Any]] = []
        for index, row in enumerate(source_rows, start=1):
            latitude, longitude = row.get("latitude"), row.get("longitude")
            has_coordinates = latitude is not None and longitude is not None
            event_time = row.get("event_time")
            event_time_value = event_time.isoformat() if hasattr(event_time, "isoformat") else event_time
            rows.append({
                "sequence": index, "msisdn": row.get("msisdn"), "event_time": event_time_value,
                "address": row.get("resolved_address") or row.get("address") or "-", "mcc": row.get("mcc") or "-",
                "mnc": row.get("mnc") or "-", "lac": row.get("lac") or "-", "bs": row.get("bs") or "-",
                "coordinates": f"{float(latitude):.6f}, {float(longitude):.6f}" if has_coordinates else "Нет координат в справочнике БС",
            })
            if has_coordinates:
                points.append({
                    "id": f"{row.get('msisdn')}-{index}", "sequence": index, "msisdn": row.get("msisdn"),
                    "event_time": event_time_value,
                    "latitude": float(latitude), "longitude": float(longitude),
                    "address": row.get("resolved_address") or row.get("address") or "-", "lac": row.get("lac"), "bs": row.get("bs"),
                })
        map_data = {"provider": "cell_tower_reference", "points": points, "route": [point["id"] for point in points], "source": {"plugin_id": self.id, "msisdns": msisdns}}
        return {
            "profile_id": self.id, "profile_name": self.name,
            "tabs": [
                tab("summary", "Итог", [column("requested_msisdns", "Запрашиваемые MSISDN", "string", 260), column("events_total", "Событий", "integer", 120), column("mapped_events", "С координатами", "integer", 150), column("unmapped_events", "Без координат", "integer", 150)], [{"requested_msisdns": ", ".join(msisdns), "events_total": len(rows), "mapped_events": len(points), "unmapped_events": len(rows) - len(points)}]),
                tab("locations", "События локаций", [column("sequence", "№", "integer", 70), column("msisdn", "MSISDN", "string", 150), column("event_time", "Время", "datetime", 180), column("address", "Адрес", "string", 440), column("mcc", "MCC", "string", 80), column("mnc", "MNC", "string", 80), column("lac", "LAC", "string", 110), column("bs", "БС", "string", 110), column("coordinates", "Координаты", "string", 220)], rows),
            ],
            "active_tab_id": "summary",
            "derived_artifacts": [{"type": "map", "name": "Карта локаций: " + ", ".join(msisdns), "description": "Маршрут по событиям локаций и координатам из справочника базовых станций.", "data": map_data}],
        }

    def _empty(self, status: str) -> Dict[str, Any]:
        return {"profile_id": self.id, "profile_name": self.name, "tabs": [tab("summary", "Итог", [column("status", "Статус", "string", 520)], [{"status": status}])], "active_tab_id": "summary"}
