from __future__ import annotations

from datetime import datetime, timedelta
import re
from typing import Any, Dict, Optional

from sqlalchemy import text

from app.console_plugins import ConsoleExecutorPlugin
from app.console_plugins._graph_analysis_utils import column, graph_payload, node_id, node_label, selected_node_ids, tab
from app.database import AsyncSessionLocal
from app.services.project_domain_store import ensure_project_domain_store
from app.services.cell_tower_reference_provider import get_cell_tower_reference_provider_status, resolve_cell_towers


def _digits(value: object) -> str:
    return re.sub(r"\D", "", str(value or ""))


def _display_value(value: object, fallback: str = "-") -> str:
    text_value = str(value or "").strip()
    return fallback if text_value.casefold() in {"", "null", "none", "n/a", "na", "-"} else text_value

def _requested_msisdns(value: object) -> list[str]:
    result = [_digits(part) for part in re.split(r"[\s,;]+", str(value or ""))]
    return [item for item in dict.fromkeys(result) if item]


def _node_msisdn(node: Dict[str, Any]) -> str:
    """Extract a phone number from current and legacy graph node shapes."""

    node_type = str(node.get("type") or "").strip().casefold()
    attributes = node.get("attributes") if isinstance(node.get("attributes"), dict) else {}
    candidates = [
        attributes.get("msisdn"),
        attributes.get("phone"),
        attributes.get("number"),
        node.get("msisdn"),
        node.get("phone"),
        node_label(node),
    ]
    for candidate in candidates:
        digits = _digits(candidate)
        if 10 <= len(digits) <= 15:
            return digits

    # "person" and "phone" are legacy keys for the MSISDN domain type.
    return "" if node_type not in {"msisdn", "person", "phone"} else _digits(node_label(node))


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
        msisdn = _node_msisdn(node)
        if msisdn:
            values.append(msisdn)
    return list(dict.fromkeys(values))


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
        filters = [
            "location.project_id = :project_id",
            "location.fact_type = 'location_event'",
            "regexp_replace(COALESCE(location.payload ->> 'identifier_value', ''), '\\D', '', 'g') IN (" + ", ".join(placeholders) + ")",
            "NULLIF(BTRIM(location.payload ->> 'lac'), '') IS NOT NULL",
            "NULLIF(BTRIM(location.payload ->> 'bs'), '') IS NOT NULL",
            "lower(BTRIM(location.payload ->> 'bs')) NOT IN ('0', 'null', 'none', 'n/a', 'na', '-')",
        ]
        if date_from:
            filters.append("location.occurred_at >= :date_from")
            bind["date_from"] = date_from
        if date_to:
            filters.append("location.occurred_at < :date_to_exclusive")
            bind["date_to_exclusive"] = date_to + timedelta(days=1)
        if limit:
            bind["limit"] = limit
        sql = """
            SELECT DISTINCT ON (
                regexp_replace(COALESCE(location.payload ->> 'identifier_value', ''), '\\D', '', 'g'),
                location.occurred_at,
                COALESCE(location.payload ->> 'address', ''),
                COALESCE(location.payload ->> 'lac', ''),
                COALESCE(location.payload ->> 'bs', '')
            )
                regexp_replace(COALESCE(location.payload ->> 'identifier_value', ''), '\\D', '', 'g') AS msisdn,
                location.occurred_at AS event_time,
                location.payload ->> 'address' AS address,
                location.payload ->> 'mcc' AS mcc,
                location.payload ->> 'mnc' AS mnc,
                location.payload ->> 'lac' AS lac,
                location.payload ->> 'bs' AS bs
            FROM project_domain_facts location
            WHERE """ + " AND ".join(filters) + """
            ORDER BY
                regexp_replace(COALESCE(location.payload ->> 'identifier_value', ''), '\\D', '', 'g'),
                location.occurred_at,
                COALESCE(location.payload ->> 'address', ''),
                COALESCE(location.payload ->> 'lac', ''),
                COALESCE(location.payload ->> 'bs', '')
        """
        async with AsyncSessionLocal() as db:
            await ensure_project_domain_store(db)
            result = await db.execute(text(sql), bind)
            source_rows = [dict(row._mapping) for row in result.fetchall()]
        provider_status = get_cell_tower_reference_provider_status()
        tower_by_cell = await resolve_cell_towers(source_rows) if provider_status.enabled else {}
        for item in source_rows:
            tower = tower_by_cell.get((_display_value(item.get("mcc"), ""), _display_value(item.get("mnc"), "").lstrip("0"), _display_value(item.get("lac"), ""), _display_value(item.get("bs"), "")))
            if tower:
                item.update(tower)
                item["resolved_address"] = tower.get("address") or item.get("address")
            else:
                item["latitude"] = None
                item["longitude"] = None
                item["resolved_address"] = item.get("address")
        rows: list[dict[str, Any]] = []
        points: list[dict[str, Any]] = []
        mapped_events_total = 0
        for index, row in enumerate(source_rows, start=1):
            latitude, longitude = row.get("latitude"), row.get("longitude")
            has_coordinates = latitude is not None and longitude is not None
            if has_coordinates:
                mapped_events_total += 1
            event_time = row.get("event_time")
            event_time_value = event_time.isoformat() if hasattr(event_time, "isoformat") else event_time
            rows.append({
                "sequence": index, "msisdn": row.get("msisdn"), "event_time": event_time_value,
                "address": _display_value(row.get("resolved_address") or row.get("address")), "mcc": _display_value(row.get("mcc")),
                "mnc": _display_value(row.get("mnc")), "lac": _display_value(row.get("lac")), "bs": _display_value(row.get("bs")),
                "coordinates": f"{float(latitude):.6f}, {float(longitude):.6f}" if has_coordinates else "Нет координат в справочнике БС",
            })
            if has_coordinates and (not limit or len(points) < limit):
                points.append({
                    "id": f"{row.get('msisdn')}-{index}", "sequence": index, "msisdn": row.get("msisdn"),
                    "event_time": event_time_value,
                    "latitude": float(latitude), "longitude": float(longitude),
                    "address": _display_value(row.get("resolved_address") or row.get("address")), "lac": _display_value(row.get("lac")), "bs": _display_value(row.get("bs")),
                })
        map_data = {"provider": "external_cell_tower_reference", "points": points, "route": [point["id"] for point in points], "source": {"plugin_id": self.id, "msisdns": msisdns, "provider_id": provider_status.provider_id, "provider_label": provider_status.label, "provider_detail": provider_status.detail}}
        return {
            "profile_id": self.id, "profile_name": self.name,
            "tabs": [
                tab("summary", "Итог", [column("requested_msisdns", "Запрашиваемые MSISDN", "string", 260), column("events_total", "Событий", "integer", 120), column("mapped_events", "С координатами", "integer", 150), column("map_points", "На карте", "integer", 120), column("unmapped_events", "Без координат", "integer", 150)], [{"requested_msisdns": ", ".join(msisdns), "events_total": len(rows), "mapped_events": mapped_events_total, "map_points": len(points), "unmapped_events": len(rows) - mapped_events_total}]),
                tab("locations", "События локаций", [column("sequence", "№", "integer", 70), column("msisdn", "MSISDN", "string", 150), column("event_time", "Время", "datetime", 180), column("address", "Адрес", "string", 440), column("mcc", "MCC", "string", 80), column("mnc", "MNC", "string", 80), column("lac", "LAC", "string", 110), column("bs", "БС", "string", 110), column("coordinates", "Координаты", "string", 220)], rows),
                {"id": "map", "name": "Карта", "view": "map", "columns": [], "rows": [], "row_count": len(points), "map_data": map_data},
            ],
            "active_tab_id": "summary",
        }

    def _empty(self, status: str) -> Dict[str, Any]:
        return {"profile_id": self.id, "profile_name": self.name, "tabs": [tab("summary", "Итог", [column("status", "Статус", "string", 520)], [{"status": status}])], "active_tab_id": "summary"}
