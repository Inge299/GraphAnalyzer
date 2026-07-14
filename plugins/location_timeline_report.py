"""Plugin: sequential location timeline report for selected communication identifiers."""

from __future__ import annotations

from datetime import date, datetime, time
from typing import Any, Dict, List, Optional, Tuple

from sqlalchemy import bindparam, text
from sqlalchemy.exc import SQLAlchemyError

from app.database import AsyncSessionLocal
from plugins import PluginBase

MAX_SELECTED_IDENTIFIERS = 200


def _as_date(value: Any) -> Optional[date]:
    if isinstance(value, date) and not isinstance(value, datetime):
        return value
    if isinstance(value, datetime):
        return value.date()
    raw = str(value or "").strip()
    if not raw:
        return None
    try:
        return date.fromisoformat(raw)
    except Exception:
        return None


def _as_datetime(value: Any) -> Optional[datetime]:
    if isinstance(value, datetime):
        return value
    if isinstance(value, date):
        return datetime.combine(value, time.min)
    raw = str(value or "").strip().replace("T", " ")
    if not raw:
        return None
    for fmt in (None, "%Y-%m-%d %H:%M:%S", "%Y-%m-%d %H:%M", "%Y-%m-%d"):
        try:
            return datetime.fromisoformat(raw) if fmt is None else datetime.strptime(raw, fmt)
        except Exception:
            continue
    return None


def _format_dt(value: Any) -> str:
    dt = _as_datetime(value)
    if dt is None:
        return str(value or "").strip()
    if dt.hour == 0 and dt.minute == 0 and dt.second == 0:
        return dt.strftime("%d.%m.%Y")
    return dt.strftime("%d.%m.%Y %H:%M:%S")


def _format_date(value: Any) -> str:
    dt = _as_datetime(value)
    if dt is None:
        parsed = _as_date(value)
        return parsed.strftime("%d.%m.%Y") if parsed else str(value or "").strip()
    return dt.strftime("%d.%m.%Y")


def _format_period(start_value: Any, end_value: Any) -> str:
    start = _format_dt(start_value)
    end = _format_dt(end_value)
    if start and end:
        return f"с {start} по {end}"
    return start or end or "период не указан"


def _normalize_identifier(value: Any) -> str:
    return str(value or "").strip()


def _node_id(node: Dict[str, Any]) -> str:
    return str(node.get("id") or node.get("node_id") or "").strip()


def _node_label(node: Dict[str, Any]) -> str:
    attrs = node.get("attributes") if isinstance(node.get("attributes"), dict) else {}
    visual = attrs.get("visual") if isinstance(attrs.get("visual"), dict) else {}
    return str(
        node.get("label")
        or visual.get("label")
        or attrs.get("label")
        or attrs.get("name")
        or _node_id(node)
        or ""
    ).strip()


def _dedupe(values: List[str]) -> List[str]:
    seen = set()
    out: List[str] = []
    for value in values:
        item = value.strip()
        if not item or item in seen:
            continue
        seen.add(item)
        out.append(item)
    return out


def _classify_identifier(value: str) -> str:
    digits = "".join(ch for ch in value if ch.isdigit())
    if len(digits) == 15:
        return "imsi"
    if len(digits) == 14:
        return "imei"
    return "phone"


def _normalize_address(value: Any) -> str:
    addr = str(value or "").strip()
    if addr.upper() in {"NULL", "NONE", "N/A", "Н/А", ""}:
        return ""
    return addr


def _has_location_details(address: Any, lat: Any, lon: Any) -> bool:
    try:
        return lat is not None and lon is not None
    except Exception:
        return False


def _format_location(address: Any, mcc: Any, mnc: Any, lac: Any, bs: Any, lat: Any, lon: Any) -> Optional[str]:
    addr = _normalize_address(address)
    if not _has_location_details(addr, lat, lon):
        return None

    base = f"LAC/CID {str(lac or '?').strip()}/{str(bs or '?').strip()}; адрес БС: {addr or 'адрес не определён'}"
    if str(mcc or "").strip() or str(mnc or "").strip():
        base = f"MCC/MNC {str(mcc or '?').strip()}/{str(mnc or '?').strip()}; {base}"

    try:
        if lat is not None and lon is not None:
            base = f"{base} (коорд.: {float(lat):.5f}, {float(lon):.5f})"
    except Exception:
        pass
    return base


class LocationTimelineReportPlugin(PluginBase):
    id = "location_timeline_report"
    name = "Местоположение: последовательность локаций"
    version = "0.1.0"
    description = "Формирует отчёт по последовательности локаций выбранных средств связи за период"
    menu_path = "Аналитика"
    input_types = ["graph"]
    output_types = ["document"]
    applicable_to = ["graph"]
    inputs = {
        "artifact_types": ["graph"],
        "selection": {"nodes": "required", "edges": "optional", "rows": "optional", "text": "optional"},
    }
    params_schema = [
        {"key": "period_start", "label": "Дата начала", "type": "date", "required": True},
        {"key": "period_end", "label": "Дата окончания", "type": "date", "required": True},
    ]

    def is_applicable_with_context(self, input_artifacts: List[Dict[str, Any]], context: Optional[Dict[str, Any]] = None) -> bool:
        if not input_artifacts:
            return False
        graph = input_artifacts[0] if isinstance(input_artifacts[0], dict) else {}
        data = graph.get("data") if isinstance(graph.get("data"), dict) else {}
        nodes = list(data.get("nodes") or [])
        ctx = context if isinstance(context, dict) else {}
        selected_ids = [str(item) for item in (ctx.get("selected_nodes") or [])]
        selected = self._collect_selected_identifiers(nodes, selected_ids)
        return bool(selected)

    @staticmethod
    def _collect_selected_identifiers(nodes: List[Dict[str, Any]], selected_ids: List[str]) -> List[str]:
        selected_set = set(selected_ids)
        picked: List[str] = []
        for node in nodes:
            if _node_id(node) not in selected_set:
                continue
            label = _node_label(node)
            if label:
                picked.append(_normalize_identifier(label))
        return _dedupe(picked)

    async def _load_timeline(
        self,
        project_id: int,
        identifiers: List[Tuple[str, str]],
        period_start: date,
        period_end: date,
    ) -> List[Dict[str, Any]]:
        typed_values = [{"t": t, "v": v} for t, v in identifiers]
        if not typed_values:
            return []

        sql = text(
            """
            WITH base_events AS (
              SELECT
                e.identifier_type,
                e.identifier_value,
                e.event_time,
                NULLIF(BTRIM(e.address), '') AS source_address,
                NULLIF(BTRIM(e.mcc), '') AS mcc,
                NULLIF(BTRIM(e.mnc), '') AS mnc,
                NULLIF(BTRIM(e.lac), '') AS lac,
                NULLIF(BTRIM(e.bs), '') AS bs,
                (e.event_time)::date AS event_date
              FROM project_location_events_raw e
              WHERE e.project_id = :project_id
                AND (e.identifier_type, e.identifier_value) IN (
                  SELECT x.t, x.v
                  FROM jsonb_to_recordset(CAST(:typed_values AS jsonb)) AS x(t text, v text)
                )
                AND e.event_time >= :period_start
                AND e.event_time <= :period_end
            ),
            distinct_lookup_keys AS (
              SELECT DISTINCT mcc, mnc, lac, bs, event_date
              FROM base_events
              WHERE lac IS NOT NULL AND bs IS NOT NULL
            ),
            geocoded_keys AS (
              SELECT
                k.mcc,
                k.mnc,
                k.lac,
                k.bs,
                k.event_date,
                ctr.address AS ref_address,
                ctr.latitude,
                ctr.longitude
              FROM distinct_lookup_keys k
              LEFT JOIN LATERAL (
                SELECT
                  r.address,
                  r.latitude,
                  r.longitude,
                  r.id
                FROM cell_tower_reference r
                WHERE r.lac = k.lac
                  AND r.cid = k.bs
                ORDER BY
                  CASE WHEN r.mcc = k.mcc AND r.mnc = k.mnc THEN 0 ELSE 1 END ASC,
                  CASE
                    WHEN r.beg_date IS NULL THEN 0
                    WHEN r.beg_date <= k.event_date
                      AND (r.end_date IS NULL OR r.end_date >= k.event_date) THEN 0
                    ELSE 1
                  END ASC,
                  CASE WHEN r.latitude IS NOT NULL AND r.longitude IS NOT NULL THEN 0 ELSE 1 END ASC,
                  CASE
                    WHEN r.beg_date IS NULL THEN 0
                    WHEN r.beg_date <= k.event_date THEN 0
                    ELSE 1
                  END ASC,
                  CASE WHEN r.beg_date <= k.event_date THEN r.beg_date END DESC,
                  CASE WHEN r.beg_date > k.event_date THEN r.beg_date END ASC,
                  r.id DESC
                LIMIT 1
              ) ctr ON TRUE
            )
            SELECT DISTINCT
              b.identifier_type,
              b.identifier_value,
              COALESCE(NULLIF(BTRIM(g.ref_address), ''), b.source_address) AS address,
              b.mcc,
              b.mnc,
              b.lac,
              b.bs,
              g.latitude,
              g.longitude,
              b.event_time
            FROM base_events b
            LEFT JOIN geocoded_keys g
              ON g.mcc IS NOT DISTINCT FROM b.mcc
             AND g.mnc IS NOT DISTINCT FROM b.mnc
             AND g.lac IS NOT DISTINCT FROM b.lac
             AND g.bs IS NOT DISTINCT FROM b.bs
             AND g.event_date = b.event_date
            ORDER BY identifier_type ASC, identifier_value ASC, event_time ASC NULLS LAST
            """
        )

        async with AsyncSessionLocal() as session:
            result = await session.execute(
                sql,
                {
                    "project_id": project_id,
                    "typed_values": __import__("json").dumps(typed_values),
                    "period_start": datetime.combine(period_start, time.min),
                    "period_end": datetime.combine(period_end, time.max),
                },
            )
            return [dict(row) for row in result.mappings().all()]

    async def _load_coverage(self, project_id: int, identifiers: List[Tuple[str, str]]) -> Dict[Tuple[str, str], Dict[str, Any]]:
        typed_values = [{"t": t, "v": v} for t, v in identifiers]
        if not typed_values:
            return {}

        sql = text(
            """
            SELECT
              identifier_type,
              identifier_value,
              MIN(period_start) AS period_start,
              MAX(period_end) AS period_end,
              SUM(rows_count) AS rows_count
            FROM project_data_load_coverage
            WHERE project_id = :project_id
              AND (identifier_type, identifier_value) IN (
                SELECT x.t, x.v
                FROM jsonb_to_recordset(CAST(:typed_values AS jsonb)) AS x(t text, v text)
              )
            GROUP BY identifier_type, identifier_value
            """
        )

        try:
            async with AsyncSessionLocal() as session:
                result = await session.execute(
                    sql,
                    {"project_id": project_id, "typed_values": __import__("json").dumps(typed_values)},
                )
                rows = [dict(row) for row in result.mappings().all()]
        except SQLAlchemyError:
            rows = []

        out: Dict[Tuple[str, str], Dict[str, Any]] = {}
        for row in rows:
            key = (str(row.get("identifier_type") or "").strip(), str(row.get("identifier_value") or "").strip())
            if key[0] and key[1]:
                out[key] = row
        return out

    async def execute(self, input_artifacts: List[Dict[str, Any]], params: Optional[Dict[str, Any]] = None) -> List[Dict[str, Any]]:
        if not input_artifacts:
            return []

        params = params or {}
        context = params.get("_context") if isinstance(params.get("_context"), dict) else {}
        selected_ids = [str(item) for item in (context.get("selected_nodes") or [])]

        period_start = _as_date(params.get("period_start"))
        period_end = _as_date(params.get("period_end"))
        if period_start is None:
            raise ValueError("Param 'period_start' must be valid date YYYY-MM-DD")
        if period_end is None:
            raise ValueError("Param 'period_end' must be valid date YYYY-MM-DD")
        if period_end < period_start:
            raise ValueError("Param 'period_end' must be greater or equal to 'period_start'")

        graph = input_artifacts[0]
        data = graph.get("data") if isinstance(graph.get("data"), dict) else {}
        nodes = list(data.get("nodes") or [])
        selected_values = self._collect_selected_identifiers(nodes, selected_ids)
        if not selected_values:
            raise ValueError("Выберите на графе хотя бы одно средство связи")
        if len(selected_values) > MAX_SELECTED_IDENTIFIERS:
            raise ValueError(f"Выбрано слишком много средств связи ({len(selected_values)}). Лимит: {MAX_SELECTED_IDENTIFIERS}")

        typed_identifiers = [(_classify_identifier(value), value) for value in selected_values]

        project_id = int(graph.get("project_id") or params.get("project_id") or 0)
        if project_id <= 0:
            raise ValueError("project_id is required")

        timeline_rows = await self._load_timeline(project_id, typed_identifiers, period_start, period_end)
        coverage = await self._load_coverage(project_id, typed_identifiers)

        by_identifier: Dict[Tuple[str, str], List[Dict[str, Any]]] = {(t, v): [] for t, v in typed_identifiers}
        for row in timeline_rows:
            key = (str(row.get("identifier_type") or "").strip(), str(row.get("identifier_value") or "").strip())
            if key in by_identifier:
                by_identifier[key].append(row)

        req_start = datetime.combine(period_start, time.min)
        req_end = datetime.combine(period_end, time.max)

        lines: List[str] = [
            f"# Отчёт по последовательности локаций за период {_format_date(period_start)} — {_format_date(period_end)}",
            "",
            f"Выбрано средств связи: {len(typed_identifiers)}",
            "",
        ]
        export_rows: List[Dict[str, Any]] = []

        for idx, (id_type, identifier) in enumerate(typed_identifiers, start=1):
            rows = by_identifier.get((id_type, identifier), [])

            # Enrich missing coordinates by strongest known point for the same BS or address.
            bs_geo_map: Dict[Tuple[str, str, str, str], Tuple[float, float]] = {}
            bs_geo_count: Dict[Tuple[str, str, str, str], Dict[Tuple[float, float], int]] = {}
            addr_geo_map: Dict[str, Tuple[float, float]] = {}
            addr_geo_count: Dict[str, Dict[Tuple[float, float], int]] = {}

            for row in rows:
                try:
                    lat = float(row.get("latitude")) if row.get("latitude") is not None else None
                    lon = float(row.get("longitude")) if row.get("longitude") is not None else None
                except Exception:
                    lat, lon = None, None
                if lat is None or lon is None:
                    continue

                bs_key = (
                    str(row.get("mcc") or "").strip(),
                    str(row.get("mnc") or "").strip(),
                    str(row.get("lac") or "").strip(),
                    str(row.get("bs") or "").strip(),
                )
                point = (lat, lon)
                if bs_key[2] and bs_key[3]:
                    by_point = bs_geo_count.get(bs_key)
                    if by_point is None:
                        by_point = {}
                        bs_geo_count[bs_key] = by_point
                    by_point[point] = by_point.get(point, 0) + 1

                addr_key = _normalize_address(row.get("address")).lower()
                if addr_key:
                    by_point = addr_geo_count.get(addr_key)
                    if by_point is None:
                        by_point = {}
                        addr_geo_count[addr_key] = by_point
                    by_point[point] = by_point.get(point, 0) + 1

            for key, points in bs_geo_count.items():
                bs_geo_map[key] = max(points.items(), key=lambda item: item[1])[0]
            for key, points in addr_geo_count.items():
                addr_geo_map[key] = max(points.items(), key=lambda item: item[1])[0]

            informative_rows: List[Dict[str, Any]] = []
            for row in rows:
                row_copy = dict(row)
                if row_copy.get("latitude") is None or row_copy.get("longitude") is None:
                    bs_key = (
                        str(row_copy.get("mcc") or "").strip(),
                        str(row_copy.get("mnc") or "").strip(),
                        str(row_copy.get("lac") or "").strip(),
                        str(row_copy.get("bs") or "").strip(),
                    )
                    geo = bs_geo_map.get(bs_key)
                    if geo is None:
                        geo = addr_geo_map.get(_normalize_address(row_copy.get("address")).lower())
                    if geo is not None:
                        row_copy["latitude"] = geo[0]
                        row_copy["longitude"] = geo[1]

                if _has_location_details(row_copy.get("address"), row_copy.get("latitude"), row_copy.get("longitude")):
                    informative_rows.append(row_copy)

            dedupe_keys: set[Tuple[Any, ...]] = set()
            deduped_rows: List[Dict[str, Any]] = []
            for row in informative_rows:
                row_key = (
                    _as_datetime(row.get("event_time")),
                    str(row.get("mcc") or "").strip(),
                    str(row.get("mnc") or "").strip(),
                    str(row.get("lac") or "").strip(),
                    str(row.get("bs") or "").strip(),
                    _normalize_address(row.get("address")),
                    row.get("latitude"),
                    row.get("longitude"),
                )
                if row_key in dedupe_keys:
                    continue
                dedupe_keys.add(row_key)
                deduped_rows.append(row)
            lines.append(f"## {idx}. {identifier} ({id_type})")
            cov = coverage.get((id_type, identifier))
            cov_start = _as_datetime((cov or {}).get("period_start")) if isinstance(cov, dict) else None
            cov_end = _as_datetime((cov or {}).get("period_end")) if isinstance(cov, dict) else None

            if cov_start is None and cov_end is None:
                lines.append("- ⚠ По идентификатору отсутствует информация о покрытии загруженных данных.")
            elif cov_start is not None and cov_end is not None and (cov_start > req_start or cov_end < req_end):
                lines.append(
                    f"- ⚠ Период запроса покрыт не полностью: доступно {_format_period(cov_start, cov_end)}, запрошено {_format_period(req_start, req_end)}."
                )
            else:
                lines.append("- Покрытие данных по периоду запроса: полное.")

            if not deduped_rows:
                lines.append("- Локации с координатами за выбранный период не выявлены.")
                lines.append("")
                lines.append("---")
                lines.append("")
                continue

            lines.append("- Последовательность локаций:")
            for row in deduped_rows:
                location_text = _format_location(
                    row.get("address"),
                    row.get("mcc"),
                    row.get("mnc"),
                    row.get("lac"),
                    row.get("bs"),
                    row.get("latitude"),
                    row.get("longitude"),
                )
                if not location_text:
                    continue
                event_dt = _as_datetime(row.get("event_time"))
                lines.append(
                    f"  - {_format_dt(row.get('event_time'))}: {location_text}"
                )
                export_rows.append({
                    "identifier_type": id_type,
                    "identifier_value": identifier,
                    "event_time": event_dt.isoformat(sep=" ") if event_dt else _format_dt(row.get("event_time")),
                    "mcc": str(row.get("mcc") or "").strip() or None,
                    "mnc": str(row.get("mnc") or "").strip() or None,
                    "lac": str(row.get("lac") or "").strip() or None,
                    "cid": str(row.get("bs") or "").strip() or None,
                    "address": _normalize_address(row.get("address")) or None,
                    "latitude": float(row.get("latitude")) if row.get("latitude") is not None else None,
                    "longitude": float(row.get("longitude")) if row.get("longitude") is not None else None,
                })

            lines.append("")
            lines.append("---")
            lines.append("")

        return [
            {
                "type": "document",
                "name": f"Локации средств связи ({_format_date(period_start)} — {_format_date(period_end)})",
                "description": "Отчёт по последовательности локаций выбранных средств связи",
                "data": {
                    "content": "\n".join(lines).strip(),
                    "tables": [
                        {
                            "name": "location_events",
                            "columns": [
                                "identifier_type",
                                "identifier_value",
                                "event_time",
                                "mcc",
                                "mnc",
                                "lac",
                                "cid",
                                "address",
                                "latitude",
                                "longitude",
                            ],
                            "rows": export_rows,
                        }
                    ],
                },
                "metadata": {
                    "source_plugin": self.id,
                    "period_start": period_start.isoformat(),
                    "period_end": period_end.isoformat(),
                    "selected_identifiers": [v for _, v in typed_identifiers],
                    "selected_count": len(typed_identifiers),
                    "timeline_rows": len(timeline_rows),
                    "timeline_rows_with_coordinates": len(export_rows),
                },
            }
        ]















