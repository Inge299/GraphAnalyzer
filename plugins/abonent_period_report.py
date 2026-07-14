
"""Plugin: period analysis for selected abonent nodes."""

from __future__ import annotations

from datetime import date, datetime, time, timedelta
from math import asin, cos, radians, sin, sqrt
from typing import Any, Dict, List, Optional, Set, Tuple

from sqlalchemy import bindparam, text
from sqlalchemy.exc import SQLAlchemyError

from app.database import AsyncSessionLocal
from plugins import PluginBase

MAX_SELECTED_ABONENTS = 120
TOP_STABLE_CONTACTS = 10
HOME_CLUSTER_RADIUS_M = 1000.0
TRIP_CLUSTER_RADIUS_M = 1500.0
DEFAULT_TRIP_RADIUS_KM = 7.0
TRIP_DEST_SHARE = 0.10
TRIP_STOP_MIN_SECONDS = 3600
LOCAL_TIME_OFFSET_HOURS = 0
MAX_EVENT_GAP_SECONDS = 600


def _norm(v: Any) -> str:
    return str(v or "").strip()


def _node_id(node: Dict[str, Any]) -> str:
    return _norm(node.get("id") or node.get("node_id"))


def _node_label(node: Dict[str, Any]) -> str:
    attrs = node.get("attributes") if isinstance(node.get("attributes"), dict) else {}
    visual = attrs.get("visual") if isinstance(attrs.get("visual"), dict) else {}
    return _norm(node.get("label") or visual.get("label") or attrs.get("label") or attrs.get("name") or _node_id(node))


def _as_date(v: Any) -> Optional[date]:
    if isinstance(v, date) and not isinstance(v, datetime):
        return v
    if isinstance(v, datetime):
        return v.date()
    raw = _norm(v)
    if not raw:
        return None
    try:
        return date.fromisoformat(raw)
    except Exception:
        return None


def _as_dt(v: Any) -> Optional[datetime]:
    if isinstance(v, datetime):
        return v
    if isinstance(v, date):
        return datetime.combine(v, time.min)
    raw = _norm(v).replace("T", " ")
    if not raw:
        return None
    for fmt in (None, "%Y-%m-%d %H:%M:%S", "%Y-%m-%d %H:%M", "%Y-%m-%d"):
        try:
            return datetime.fromisoformat(raw) if fmt is None else datetime.strptime(raw, fmt)
        except Exception:
            continue
    return None


def _fmt_dt(v: Any) -> str:
    dt = _as_dt(v)
    if dt is None:
        return _norm(v)
    return dt.strftime("%d.%m.%Y %H:%M:%S") if (dt.hour or dt.minute or dt.second) else dt.strftime("%d.%m.%Y")


def _fmt_date(v: Any) -> str:
    d = _as_date(v)
    return d.strftime("%d.%m.%Y") if d else _fmt_dt(v)


def _period(a: Any, b: Any) -> str:
    return f"с {_fmt_dt(a)} по {_fmt_dt(b)}"


def _to_float(v: Any) -> Optional[float]:
    try:
        return float(v)
    except Exception:
        return None


def _dist_m(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    r = 6371000.0
    d_lat = radians(lat2 - lat1)
    d_lon = radians(lon2 - lon1)
    a = sin(d_lat / 2) ** 2 + cos(radians(lat1)) * cos(radians(lat2)) * sin(d_lon / 2) ** 2
    return 2 * r * asin(sqrt(a))


def _loc_key(r: Dict[str, Any]) -> Tuple[str, str, str, str, str, Any, Any]:
    lat = _to_float(r.get("latitude"))
    lon = _to_float(r.get("longitude"))
    return (_norm(r.get("address")), _norm(r.get("mcc")), _norm(r.get("mnc")), _norm(r.get("lac")), _norm(r.get("bs")), lat, lon)


def _loc_str(key: Tuple[str, str, str, str, str, Any, Any]) -> str:
    addr, mcc, mnc, lac, bs, lat, lon = key
    base = f"LAC/CID {lac or '?'}/{bs or '?'}; адрес БС: {addr or 'адрес не определён'}"
    if mcc or mnc:
        base = f"MCC/MNC {mcc or '?'}/{mnc or '?'}; {base}"
    if lat is not None and lon is not None:
        try:
            base += f" (коорд.: {float(lat):.5f}, {float(lon):.5f})"
        except Exception:
            pass
    return base


def _bs_core(key: Tuple[str, str, str, str, str, Any, Any]) -> Tuple[str, str, str, str]:
    return (_norm(key[1]), _norm(key[2]), _norm(key[3]), _norm(key[4]))


def _key_score_for_display(key: Tuple[str, str, str, str, str, Any, Any]) -> Tuple[int, int]:
    has_geo = 1 if (key[5] is not None and key[6] is not None) else 0
    has_addr = 1 if _norm(key[0]) else 0
    return (has_geo, has_addr)


def _best_display_keys(events: List[Dict[str, Any]]) -> Dict[Tuple[str, str, str, str], Tuple[str, str, str, str, str, Any, Any]]:
    out: Dict[Tuple[str, str, str, str], Tuple[str, str, str, str, str, Any, Any]] = {}
    for e in events:
        k = e["key"]
        core = _bs_core(k)
        prev = out.get(core)
        if prev is None or _key_score_for_display(k) > _key_score_for_display(prev):
            out[core] = k
    return out


def _merge_key(base: Tuple[str, str, str, str, str, Any, Any], best: Optional[Tuple[str, str, str, str, str, Any, Any]]) -> Tuple[str, str, str, str, str, Any, Any]:
    if best is None:
        return base
    addr = best[0] or base[0]
    lat = best[5] if best[5] is not None else base[5]
    lon = best[6] if best[6] is not None else base[6]
    return (addr, base[1], base[2], base[3], base[4], lat, lon)


def _cluster_points(events: List[Dict[str, Any]], radius_m: float) -> List[Dict[str, Any]]:
    clusters: List[Dict[str, Any]] = []
    for e in events:
        lat, lon = e.get("lat"), e.get("lon")
        if lat is None or lon is None:
            continue
        hit = None
        for c in clusters:
            if _dist_m(lat, lon, c["lat"], c["lon"]) <= radius_m:
                hit = c
                break
        if hit is None:
            hit = {"lat": lat, "lon": lon, "events": []}
            clusters.append(hit)
        hit["events"].append(e)
    for c in clusters:
        c["events"].sort(key=lambda x: x["dt"])
    return clusters


def _pick_home_cluster(events: List[Dict[str, Any]]) -> Optional[Dict[str, Any]]:
    def _area_key(ev: Dict[str, Any]) -> Tuple[str, str, str, str]:
        key = ev["key"]
        mcc, mnc, lac, address = key[1], key[2], key[3], key[0]
        if lac:
            return ("lac", mcc, mnc, lac)
        return ("addr", (address or "").lower(), "", "")

    night_all = [
        e for e in events
        if 0 <= (e["dt"] + timedelta(hours=LOCAL_TIME_OFFSET_HOURS)).hour < 6
    ]
    if not night_all:
        return None

    buckets: Dict[Tuple[str, str, str, str], Dict[str, Any]] = {}
    for ev in night_all:
        k = _area_key(ev)
        bucket = buckets.get(k)
        if bucket is None:
            bucket = {"events": [], "night_days": set()}
            buckets[k] = bucket
        bucket["events"].append(ev)
        bucket["night_days"].add((ev["dt"] + timedelta(hours=LOCAL_TIME_OFFSET_HOURS)).date())

    best_key, best_bucket = max(
        buckets.items(),
        key=lambda item: (len(item[1]["night_days"]), len(item[1]["events"]))
    )

    bucket_events = best_bucket["events"]
    geocoded_bucket_events = [e for e in bucket_events if e.get("lat") is not None and e.get("lon") is not None]

    if not geocoded_bucket_events:
        if best_key[0] == "lac":
            _, kmcc, kmnc, klac = best_key
            geocoded_bucket_events = [
                e for e in events
                if e.get("lat") is not None and e.get("lon") is not None
                and e["key"][1] == kmcc and e["key"][2] == kmnc and e["key"][3] == klac
            ]
        else:
            kaddr = (bucket_events[0]["key"][0] or "").lower()
            geocoded_bucket_events = [
                e for e in events
                if e.get("lat") is not None and e.get("lon") is not None
                and (e["key"][0] or "").lower() == kaddr
            ]

    result: Dict[str, Any] = {
        "night_events": len(bucket_events),
        "night_days": best_bucket["night_days"],
        "sample_key": bucket_events[0]["key"] if bucket_events else ("", "", "", "", "", None, None),
        "events": bucket_events,
        "lat": None,
        "lon": None,
    }

    if geocoded_bucket_events:
        clusters = _cluster_points(geocoded_bucket_events, HOME_CLUSTER_RADIUS_M)
        if clusters:
            best_geo = max(clusters, key=lambda c: len(c["events"]))
            result["lat"] = best_geo["lat"]
            result["lon"] = best_geo["lon"]

    return result


def _calc_cluster_stay_seconds(clusters: List[Dict[str, Any]], ordered_events: List[Dict[str, Any]], radius_m: float) -> None:
    if not clusters:
        return
    for c in clusters:
        c["stay"] = 0.0
    if len(ordered_events) < 2:
        return

    for idx in range(len(ordered_events) - 1):
        current = ordered_events[idx]
        nxt = ordered_events[idx + 1]
        cur_lat, cur_lon = current.get("lat"), current.get("lon")
        if cur_lat is None or cur_lon is None:
            continue
        delta = max((nxt["dt"] - current["dt"]).total_seconds(), 0.0)
        if delta <= 0:
            continue
        best_idx = None
        best_dist = None
        for c_idx, cluster in enumerate(clusters):
            d = _dist_m(cur_lat, cur_lon, cluster["lat"], cluster["lon"])
            if d > radius_m:
                continue
            if best_idx is None or d < (best_dist or float("inf")):
                best_idx = c_idx
                best_dist = d
        if best_idx is not None:
            clusters[best_idx]["stay"] += delta


def _is_valid_contact(raw: str) -> bool:
    num = raw.replace("+", "").replace(" ", "")
    return 10 <= len(num) <= 14


class AbonentPeriodReportPlugin(PluginBase):
    id = "abonent_period_report"
    name = "Анализ средств связи (период)"
    version = "0.3.0"
    description = "Формирует документ анализа выбранных абонентских номеров за период"
    menu_path = "Аналитика"
    input_types = ["graph"]
    output_types = ["document"]
    applicable_to = ["graph"]
    inputs = {"artifact_types": ["graph"], "selection": {"nodes": "required", "edges": "optional", "rows": "optional", "text": "optional"}}
    params_schema = [
        {"key": "period_start", "label": "Дата начала", "type": "date", "required": True},
        {"key": "period_end", "label": "Дата окончания", "type": "date", "required": True},
        {"key": "analyze_imsi_changes", "label": "Анализ смены IMSI", "type": "boolean", "default": True},
        {"key": "analyze_imei_changes", "label": "Анализ смены IMEI", "type": "boolean", "default": True},
        {"key": "analyze_stable_contacts", "label": "Основные контакты", "type": "boolean", "default": True},
        {"key": "analyze_foreign_contacts", "label": "Зарубежные контакты", "type": "boolean", "default": True},
        {"key": "analyze_home_location", "label": "Место проживания", "type": "boolean", "default": True},
        {"key": "analyze_work_location", "label": "График и место работы", "type": "boolean", "default": True},
        {"key": "analyze_trips", "label": "Поездки вне ночной зоны", "type": "boolean", "default": True},
        {"key": "trip_radius_km", "label": "Радиус ночной зоны, км", "type": "number", "default": DEFAULT_TRIP_RADIUS_KM},
    ]

    def is_applicable_with_context(self, input_artifacts: List[Dict[str, Any]], context: Optional[Dict[str, Any]] = None) -> bool:
        if not input_artifacts:
            return False
        graph = input_artifacts[0] if isinstance(input_artifacts[0], dict) else {}
        data = graph.get("data") if isinstance(graph.get("data"), dict) else {}
        nodes = list(data.get("nodes") or [])
        selected = set(str(x) for x in ((context or {}).get("selected_nodes") or []))
        return any(_node_id(n) in selected for n in nodes)
    @staticmethod
    def _selected_phones(nodes: List[Dict[str, Any]], selected_ids: List[str]) -> List[str]:
        ids = set(selected_ids)
        out: List[str] = []
        for n in nodes:
            if _node_id(n) not in ids:
                continue
            t = _norm(n.get("type")).lower()
            if t not in {"person", "abonent", "subscriber"}:
                continue
            lbl = _node_label(n)
            if lbl:
                out.append(lbl)
        uniq: List[str] = []
        seen: Set[str] = set()
        for v in out:
            if v in seen:
                continue
            seen.add(v)
            uniq.append(v)
        return uniq

    async def _load_communications(self, project_id: int, phones: List[str], period_start: date, period_end: date) -> List[Dict[str, Any]]:
        sql = text("""
            SELECT abon1, abon2, time_start, time_end, calls_count
            FROM project_communications
            WHERE project_id = :project_id
              AND (abon1 IN :phones OR abon2 IN :phones)
              AND (COALESCE(time_end, time_start) >= :period_start AND COALESCE(time_start, time_end) <= :period_end)
            ORDER BY time_start ASC NULLS LAST
        """).bindparams(bindparam("phones", expanding=True))
        async with AsyncSessionLocal() as s:
            res = await s.execute(sql, {
                "project_id": project_id,
                "phones": phones,
                "period_start": datetime.combine(period_start, time.min),
                "period_end": datetime.combine(period_end, time.max),
            })
            return [dict(r) for r in res.mappings().all()]

    async def _load_device_history(self, project_id: int, phones: List[str], period_start: date, period_end: date) -> List[Dict[str, Any]]:
        sql = text("""
            SELECT abon, imsi, imei, period_start, period_end
            FROM project_device_history
            WHERE project_id = :project_id
              AND abon IN :phones
              AND (COALESCE(period_end, period_start) >= :period_start AND COALESCE(period_start, period_end) <= :period_end)
            ORDER BY abon ASC, period_start ASC NULLS LAST
        """).bindparams(bindparam("phones", expanding=True))
        async with AsyncSessionLocal() as s:
            res = await s.execute(sql, {
                "project_id": project_id,
                "phones": phones,
                "period_start": datetime.combine(period_start, time.min),
                "period_end": datetime.combine(period_end, time.max),
            })
            return [dict(r) for r in res.mappings().all()]

    async def _load_coverage(self, project_id: int, phones: List[str]) -> Dict[str, Dict[str, Any]]:
        sql = text("""
            SELECT identifier_value, MIN(period_start) period_start, MAX(period_end) period_end
            FROM project_data_load_coverage
            WHERE project_id = :project_id AND identifier_type = 'phone' AND identifier_value IN :phones
            GROUP BY identifier_value
        """).bindparams(bindparam("phones", expanding=True))
        out: Dict[str, Dict[str, Any]] = {p: {} for p in phones}
        try:
            async with AsyncSessionLocal() as s:
                res = await s.execute(sql, {"project_id": project_id, "phones": phones})
                for r in res.mappings().all():
                    out[_norm(r.get("identifier_value"))] = dict(r)
        except SQLAlchemyError:
            pass
        return out

    async def _load_locations(self, project_id: int, phones: List[str], period_start: date, period_end: date) -> List[Dict[str, Any]]:
        sql = text("""
            WITH base_events AS (
              SELECT e.identifier_value, e.event_time,
                     NULLIF(BTRIM(e.address), '') AS source_address,
                     NULLIF(BTRIM(e.mcc), '') AS mcc,
                     NULLIF(BTRIM(e.mnc), '') AS mnc,
                     NULLIF(BTRIM(e.lac), '') AS lac,
                     NULLIF(BTRIM(e.bs), '') AS bs,
                     (e.event_time)::date AS event_date
              FROM project_location_events_raw e
              WHERE e.project_id = :project_id
                AND e.identifier_type = 'phone'
                AND e.identifier_value IN :phones
                AND e.event_time >= :period_start
                AND e.event_time <= :period_end
            ),
            keyset AS (
              SELECT DISTINCT mcc, mnc, lac, bs, event_date
              FROM base_events
              WHERE lac IS NOT NULL AND bs IS NOT NULL
            ),
            geocoded AS (
              SELECT k.mcc, k.mnc, k.lac, k.bs, k.event_date,
                     ctr.address AS ref_address, ctr.latitude, ctr.longitude
              FROM keyset k
              LEFT JOIN LATERAL (
                SELECT r.address, r.latitude, r.longitude, r.id
                FROM cell_tower_reference r
                WHERE r.lac = k.lac AND r.cid = k.bs
                ORDER BY
                  CASE WHEN r.mcc = k.mcc AND r.mnc = k.mnc THEN 0 ELSE 1 END,
                  CASE WHEN r.beg_date IS NULL THEN 0
                       WHEN r.beg_date <= k.event_date AND (r.end_date IS NULL OR r.end_date >= k.event_date) THEN 0
                       ELSE 1 END,
                  CASE WHEN r.latitude IS NOT NULL AND r.longitude IS NOT NULL THEN 0 ELSE 1 END,
                  CASE WHEN r.beg_date <= k.event_date THEN r.beg_date END DESC,
                  CASE WHEN r.beg_date > k.event_date THEN r.beg_date END ASC,
                  r.id DESC
                LIMIT 1
              ) ctr ON TRUE
            )
            SELECT DISTINCT b.identifier_value,
                   COALESCE(NULLIF(BTRIM(g.ref_address), ''), b.source_address) AS address,
                   b.mcc, b.mnc, b.lac, b.bs, g.latitude, g.longitude, b.event_time
            FROM base_events b
            LEFT JOIN geocoded g
              ON g.mcc IS NOT DISTINCT FROM b.mcc
             AND g.mnc IS NOT DISTINCT FROM b.mnc
             AND g.lac IS NOT DISTINCT FROM b.lac
             AND g.bs IS NOT DISTINCT FROM b.bs
             AND g.event_date = b.event_date
            ORDER BY b.identifier_value ASC, b.event_time ASC NULLS LAST
        """).bindparams(bindparam("phones", expanding=True))

        try:
            async with AsyncSessionLocal() as s:
                res = await s.execute(sql, {
                    "project_id": project_id,
                    "phones": phones,
                    "period_start": datetime.combine(period_start, time.min),
                    "period_end": datetime.combine(period_end, time.max),
                })
                return [dict(r) for r in res.mappings().all()]
        except SQLAlchemyError:
            return []
    async def _load_fallback_cell_coords(self, rows: List[Dict[str, Any]]) -> Dict[Tuple[str, str], Dict[str, Any]]:
        keys: Dict[Tuple[str, str], bool] = {}
        for row in rows:
            lac = _norm(row.get("lac"))
            bs = _norm(row.get("bs"))
            if not lac or not bs:
                continue
            if _to_float(row.get("latitude")) is not None and _to_float(row.get("longitude")) is not None:
                continue
            keys[(lac, bs)] = True
        if not keys:
            return {}

        payload = [{"lac": lac, "cid": cid} for lac, cid in keys.keys()]
        sql = text("""
            WITH input_pairs AS (
              SELECT x.lac::text AS lac, x.cid::text AS cid
              FROM jsonb_to_recordset(CAST(:pairs AS jsonb)) AS x(lac text, cid text)
            )
            SELECT DISTINCT ON (r.lac, r.cid)
              r.lac,
              r.cid,
              r.address,
              r.latitude,
              r.longitude
            FROM cell_tower_reference r
            JOIN input_pairs p ON p.lac = r.lac AND p.cid = r.cid
            WHERE r.latitude IS NOT NULL AND r.longitude IS NOT NULL
            ORDER BY r.lac, r.cid, r.id DESC
        """)
        try:
            async with AsyncSessionLocal() as s:
                res = await s.execute(sql, {"pairs": __import__("json").dumps(payload)})
                out: Dict[Tuple[str, str], Dict[str, Any]] = {}
                for r in res.mappings().all():
                    out[(_norm(r.get("lac")), _norm(r.get("cid")))] = {
                        "address": _norm(r.get("address")),
                        "latitude": r.get("latitude"),
                        "longitude": r.get("longitude"),
                    }
                return out
        except SQLAlchemyError:
            return {}
    @staticmethod
    def _prepare_events(rows: List[Dict[str, Any]], period_start: date, period_end: date) -> List[Dict[str, Any]]:
        start = datetime.combine(period_start, time.min)
        end = datetime.combine(period_end, time.max)
        out: List[Dict[str, Any]] = []
        seen: Set[Tuple[Any, ...]] = set()
        for r in rows:
            dt = _as_dt(r.get("event_time"))
            if dt is None or dt < start or dt > end:
                continue
            key = _loc_key(r)
            lat = key[5]
            lon = key[6]
            if not key[0] and (lat is None or lon is None):
                continue
            sig = (dt, key[1], key[2], key[3], key[4], key[0], lat, lon)
            if sig in seen:
                continue
            seen.add(sig)
            out.append({"dt": dt, "key": key, "lat": lat, "lon": lon})
        out.sort(key=lambda x: x["dt"])
        return out

    async def execute(self, input_artifacts: List[Dict[str, Any]], params: Optional[Dict[str, Any]] = None) -> List[Dict[str, Any]]:
        params = params or {}
        if not input_artifacts:
            return []
        graph = input_artifacts[0]
        ctx = params.get("_context") if isinstance(params.get("_context"), dict) else {}
        selected_ids = [str(x) for x in (ctx.get("selected_nodes") or [])]

        period_start = _as_date(params.get("period_start"))
        period_end = _as_date(params.get("period_end"))
        if period_start is None or period_end is None or period_end < period_start:
            raise ValueError("Укажите корректный период анализа")

        include_imsi = _as_bool(params.get("analyze_imsi_changes"), True)
        include_imei = _as_bool(params.get("analyze_imei_changes"), True)
        include_stable = _as_bool(params.get("analyze_stable_contacts"), True)
        include_foreign = _as_bool(params.get("analyze_foreign_contacts"), True)
        include_home = _as_bool(params.get("analyze_home_location"), True)
        include_work = _as_bool(params.get("analyze_work_location"), True)
        include_trips = _as_bool(params.get("analyze_trips"), True)
        try:
            trip_radius_km = float(params.get("trip_radius_km") or DEFAULT_TRIP_RADIUS_KM)
        except Exception:
            trip_radius_km = DEFAULT_TRIP_RADIUS_KM
        if trip_radius_km <= 0:
            trip_radius_km = DEFAULT_TRIP_RADIUS_KM

        data = graph.get("data") if isinstance(graph.get("data"), dict) else {}
        nodes = list(data.get("nodes") or [])
        phones = self._selected_phones(nodes, selected_ids)
        if not phones:
            raise ValueError("Выберите хотя бы один абонентский номер")
        if len(phones) > MAX_SELECTED_ABONENTS:
            raise ValueError(f"Выбрано слишком много абонентов ({len(phones)}). Лимит: {MAX_SELECTED_ABONENTS}")

        project_id = int(graph.get("project_id") or params.get("project_id") or 0)
        if project_id <= 0:
            raise ValueError("project_id is required")

        comm = await self._load_communications(project_id, phones, period_start, period_end)
        hist = await self._load_device_history(project_id, phones, period_start, period_end)
        cov = await self._load_coverage(project_id, phones)
        loc = await self._load_locations(project_id, phones, period_start, period_end)
        fallback_coords = await self._load_fallback_cell_coords(loc)

        comm_by: Dict[str, List[Dict[str, Any]]] = {p: [] for p in phones}
        for r in comm:
            a1, a2 = _norm(r.get("abon1")), _norm(r.get("abon2"))
            if a1 in comm_by:
                comm_by[a1].append(r)
            if a2 in comm_by and a2 != a1:
                comm_by[a2].append(r)

        hist_by: Dict[str, List[Dict[str, Any]]] = {p: [] for p in phones}
        for r in hist:
            a = _norm(r.get("abon"))
            if a in hist_by:
                hist_by[a].append(r)

        loc_by: Dict[str, List[Dict[str, Any]]] = {p: [] for p in phones}
        for r in loc:
            a = _norm(r.get("identifier_value"))
            if a not in loc_by:
                continue
            lat = _to_float(r.get("latitude"))
            lon = _to_float(r.get("longitude"))
            if lat is None or lon is None:
                key = (_norm(r.get("lac")), _norm(r.get("bs")))
                fb = fallback_coords.get(key)
                if fb:
                    if not _norm(r.get("address")) and _norm(fb.get("address")):
                        r["address"] = fb.get("address")
                    r["latitude"] = fb.get("latitude")
                    r["longitude"] = fb.get("longitude")
            loc_by[a].append(r)

        lines = [f"# Анализ абонентских номеров за период {_fmt_date(period_start)} — {_fmt_date(period_end)}", "", f"Выбрано абонентов: {len(phones)}", ""]

        for i, phone in enumerate(phones, start=1):
            lines.extend([f"## {i}. Абонент {phone}", ""])
            c = cov.get(phone) or {}
            cov_start, cov_end = _as_dt(c.get("period_start")), _as_dt(c.get("period_end"))
            req_start, req_end = datetime.combine(period_start, time.min), datetime.combine(period_end, time.max)
            if cov_start and cov_end and (cov_start > req_start or cov_end < req_end):
                lines.append(f"- ⚠ Покрытие неполное: {_period(cov_start, cov_end)} при запросе {_period(req_start, req_end)}.")
                lines.append("")

            h = sorted(hist_by.get(phone, []), key=lambda x: _as_dt(x.get("period_start")) or datetime.min)
            last_imsi, last_imei = "", ""
            normalized = []
            for it in h:
                imsi, imei = _norm(it.get("imsi")), _norm(it.get("imei"))
                if imsi:
                    last_imsi = imsi
                if imei:
                    last_imei = imei
                normalized.append({**it, "imsi_effective": last_imsi, "imei_effective": last_imei})

            if include_imsi:
                lines.append("### 1. Период работы абонентского номера")
                if normalized:
                    lines.append(f"- Абонентский номер активен в период {_period(normalized[0].get('period_start'), normalized[-1].get('period_end'))}")
                    seg = _build_continuous_segments(normalized, "imsi_effective")
                    uniq = []
                    for s in seg:
                        v = _norm(s.get("value"))
                        if v and v not in uniq:
                            uniq.append(v)
                    if len(uniq) == 1:
                        lines.append(f"- Смена SIM-карты не выявлена, использовался IMSI {uniq[0]}.")
                    for s in seg:
                        if _norm(s.get("value")):
                            lines.append(f"- IMSI {s['value']} использовался {_period(s['start'], s['end'])}")
                else:
                    lines.append("- Данные об IMSI отсутствуют")
                lines.append("")

            if include_imei:
                lines.append("### 2. Хронология использования аппаратов")
                if normalized:
                    seg = _build_continuous_segments(normalized, "imei_effective")
                    uniq = []
                    for s in seg:
                        v = _norm(s.get("value"))
                        if v and v not in uniq:
                            uniq.append(v)
                    if len(uniq) == 1:
                        lines.append(f"- Смена аппарата не выявлена, использовался IMEI {uniq[0]}.")
                    for s in seg:
                        if _norm(s.get("value")):
                            lines.append(f"- IMEI {s['value']} использовался {_period(s['start'], s['end'])}")
                else:
                    lines.append("- Данные по IMEI отсутствуют")
                lines.append("")

            rows = comm_by.get(phone, [])
            if include_stable:
                lines.append("### 3. Устойчивые контакты")
                acc: Dict[str, int] = {}
                for r in rows:
                    a1, a2 = _norm(r.get("abon1")), _norm(r.get("abon2"))
                    other = a2 if a1 == phone else a1
                    if not other or not _is_valid_contact(other):
                        continue
                    acc[other] = acc.get(other, 0) + 1
                ranked = sorted(acc.items(), key=lambda p: (-p[1], p[0]))[:TOP_STABLE_CONTACTS]
                if ranked:
                    for n, (contact, cnt) in enumerate(ranked, start=1):
                        lines.append(f"- {n}. {contact} — соединений: {cnt}")
                else:
                    lines.append("- Устойчивые контакты не выявлены")
                lines.append("")

            if include_foreign:
                lines.append("### 4. Зарубежные контакты")
                acc: Dict[str, int] = {}
                for r in rows:
                    a1, a2 = _norm(r.get("abon1")), _norm(r.get("abon2"))
                    other = a2 if a1 == phone else a1
                    if not other or not _is_valid_contact(other) or other.replace("+", "").startswith("7"):
                        continue
                    acc[other] = acc.get(other, 0) + 1
                if acc:
                    for contact, cnt in sorted(acc.items(), key=lambda p: (-p[1], p[0])):
                        lines.append(f"- {contact} — соединений: {cnt}")
                else:
                    lines.append("- Зарубежные контакты в указанный период не выявлены.")
                lines.append("")

            events = self._prepare_events(loc_by.get(phone, []), period_start, period_end)
            display_by_bs = _best_display_keys(events)
            addr_geo_counts: Dict[str, Dict[Tuple[float, float], int]] = {}
            for e in events:
                addr = _norm(e['key'][0]).lower()
                lat = e.get('lat')
                lon = e.get('lon')
                if not addr or lat is None or lon is None:
                    continue
                by_point = addr_geo_counts.get(addr)
                if by_point is None:
                    by_point = {}
                    addr_geo_counts[addr] = by_point
                point = (float(lat), float(lon))
                by_point[point] = by_point.get(point, 0) + 1
            addr_best_geo: Dict[str, Tuple[float, float]] = {}
            for addr, points in addr_geo_counts.items():
                addr_best_geo[addr] = max(points.items(), key=lambda item: item[1])[0]

            def _resolve_display_key(k: Tuple[str, str, str, str, str, Any, Any]) -> Tuple[str, str, str, str, str, Any, Any]:
                out = _merge_key(k, display_by_bs.get(_bs_core(k)))
                if out[5] is None or out[6] is None:
                    addr_key = _norm(out[0]).lower()
                    geo = addr_best_geo.get(addr_key)
                    if geo is not None:
                        out = (out[0], out[1], out[2], out[3], out[4], geo[0], geo[1])
                return out

            home_cluster = _pick_home_cluster(events)

            night_events_local = [
                e for e in events
                if 0 <= (e['dt'] + timedelta(hours=LOCAL_TIME_OFFSET_HOURS)).hour < 6
            ]
            night_geo_events = [e for e in night_events_local if e.get('lat') is not None and e.get('lon') is not None]

            home_ref_lat = home_cluster.get('lat') if home_cluster else None
            home_ref_lon = home_cluster.get('lon') if home_cluster else None

            night_top_counts: Dict[Tuple[str, str, str, str, str, Any, Any], int] = {}
            night_source_events = home_cluster['events'] if home_cluster else night_events_local
            for e in night_source_events:
                k = e['key']
                night_top_counts[k] = night_top_counts.get(k, 0) + 1
            night_top = sorted(night_top_counts.items(), key=lambda item: (-item[1], item[0][3], item[0][4]))[:3]

            if (home_ref_lat is None or home_ref_lon is None) and night_geo_events:
                night_geo_clusters = _cluster_points(night_geo_events, HOME_CLUSTER_RADIUS_M)
                if night_geo_clusters:
                    best_night_geo = max(night_geo_clusters, key=lambda c: len(c['events']))
                    home_ref_lat = best_night_geo['lat']
                    home_ref_lon = best_night_geo['lon']

            if (home_ref_lat is None or home_ref_lon is None) and night_top:
                for bs_key, _ in night_top:
                    merged = _resolve_display_key(bs_key)
                    if merged[5] is not None and merged[6] is not None:
                        home_ref_lat = _to_float(merged[5])
                        home_ref_lon = _to_float(merged[6])
                        if home_ref_lat is not None and home_ref_lon is not None:
                            break

            if include_home:
                lines.append("### 5. Место проживания")
                if home_cluster is None:
                    lines.append("- Недостаточно ночных событий для определения зоны проживания.")
                else:
                    sample_key = home_cluster.get('sample_key')
                    merged_sample = _resolve_display_key(sample_key)
                    base_zone = _loc_str(merged_sample)
                    if (home_ref_lat is None or home_ref_lon is None) and merged_sample[5] is not None and merged_sample[6] is not None:
                        home_ref_lat = _to_float(merged_sample[5])
                        home_ref_lon = _to_float(merged_sample[6])
                    if home_ref_lat is not None and home_ref_lon is not None:
                        lines.append(f"- Основная ночная зона: {base_zone}; центр кластера: {home_ref_lat:.5f}, {home_ref_lon:.5f}; ночных событий: {home_cluster['night_events']}, ночей: {len(home_cluster['night_days'])}")
                    else:
                        lines.append(f"- Основная ночная зона: {base_zone}; ночных событий: {home_cluster['night_events']}, ночей: {len(home_cluster['night_days'])}")
                    if night_top:
                        lines.append("- Основные ночные БС:")
                        for bs_key, bs_count in night_top:
                            out_key = _resolve_display_key(bs_key)
                            lines.append(f"  - {_loc_str(out_key)} — событий: {bs_count}")
                lines.append("")

            if include_work:
                lines.append("### 6. График и место работы")
                work_events_all = [
                    e for e in events
                    if (e['dt'] + timedelta(hours=LOCAL_TIME_OFFSET_HOURS)).weekday() <= 4
                    and 9 <= (e['dt'] + timedelta(hours=LOCAL_TIME_OFFSET_HOURS)).hour < 18
                ]
                work_events = [e for e in work_events_all if e.get('lat') is not None and e.get('lon') is not None]
                work_clusters = _cluster_points(work_events, HOME_CLUSTER_RADIUS_M)
                wc = None
                if work_clusters:
                    if home_ref_lat is not None and home_ref_lon is not None:
                        distinct = [
                            c for c in work_clusters
                            if _dist_m(c['lat'], c['lon'], home_ref_lat, home_ref_lon) > HOME_CLUSTER_RADIUS_M
                        ]
                        wc = max(distinct, key=lambda c: len(c['events'])) if distinct else max(work_clusters, key=lambda c: len(c['events']))
                    else:
                        wc = max(work_clusters, key=lambda c: len(c['events']))

                if wc is not None:
                    lines.append(f"- Основная рабочая зона: центр {wc['lat']:.5f}, {wc['lon']:.5f}; событий: {len(wc['events'])}")
                    if home_ref_lat is not None and home_ref_lon is not None:
                        dist_hw = _dist_m(wc['lat'], wc['lon'], home_ref_lat, home_ref_lon)
                        if dist_hw <= HOME_CLUSTER_RADIUS_M:
                            lines.append("- Рабочая зона совпадает/пересекается с ночной зоной (по текущим данным явного отдельного места работы не выявлено).")
                    work_top_counts: Dict[Tuple[str, str, str, str, str, Any, Any], int] = {}
                    for e in work_events_all:
                        k = e['key']
                        if e.get('lat') is not None and e.get('lon') is not None:
                            if _dist_m(e['lat'], e['lon'], wc['lat'], wc['lon']) > HOME_CLUSTER_RADIUS_M:
                                continue
                        work_top_counts[k] = work_top_counts.get(k, 0) + 1
                    work_top = sorted(work_top_counts.items(), key=lambda item: (-item[1], item[0][3], item[0][4]))[:3]
                    if work_top:
                        lines.append("- Основные рабочие БС:")
                        for bs_key, bs_count in work_top:
                            out_key = _resolve_display_key(bs_key)
                            lines.append(f"  - {_loc_str(out_key)} — событий: {bs_count}")
                else:
                    lines.append("- Недостаточно локаций в рабочие часы для определения рабочей зоны.")
                lines.append("")

            if include_trips:
                lines.append("### 7. Поездки вне ночной зоны")
                if home_ref_lat is None or home_ref_lon is None:
                    lines.append("- Ночной кластер с координатами не определён, анализ поездок невозможен.")
                else:
                    radius_m = trip_radius_km * 1000.0
                    geocoded_events = [e for e in events if e.get('lat') is not None and e.get('lon') is not None]
                    outside: List[List[Dict[str, Any]]] = []
                    cur: List[Dict[str, Any]] = []
                    for e in geocoded_events:
                        d = _dist_m(e['lat'], e['lon'], home_ref_lat, home_ref_lon)
                        if d > radius_m:
                            cur.append(e)
                        elif cur:
                            outside.append(cur[:])
                            cur.clear()
                    if cur:
                        outside.append(cur[:])

                    if not outside:
                        lines.append(f"- Поездки за пределы радиуса {trip_radius_km:.1f} км от ночного кластера не выявлены.")
                    else:
                        lines.append(f"- Радиус ночной зоны для анализа поездок: {trip_radius_km:.1f} км")
                        for t_idx, t in enumerate(outside, start=1):
                            t_start, t_end = t[0]['dt'], t[-1]['dt']
                            trip_geocoded_events = [ev for ev in geocoded_events if t_start <= ev['dt'] <= t_end]

                            stay_by_bs: Dict[Tuple[str, str, str, str], float] = {}
                            bs_bounds: Dict[Tuple[str, str, str, str], Tuple[datetime, datetime]] = {}
                            bs_example: Dict[Tuple[str, str, str, str], Dict[str, Any]] = {}

                            if len(trip_geocoded_events) >= 2:
                                for idx_ev in range(len(trip_geocoded_events) - 1):
                                    cur_ev = trip_geocoded_events[idx_ev]
                                    nxt_ev = trip_geocoded_events[idx_ev + 1]
                                    delta = min(max((nxt_ev['dt'] - cur_ev['dt']).total_seconds(), 0.0), MAX_EVENT_GAP_SECONDS)
                                    bs_sig = (cur_ev['key'][1], cur_ev['key'][2], cur_ev['key'][3], cur_ev['key'][4])
                                    if not bs_sig[2] or not bs_sig[3]:
                                        continue
                                    stay_by_bs[bs_sig] = stay_by_bs.get(bs_sig, 0.0) + delta
                                    if bs_sig in bs_bounds:
                                        b_start, b_end = bs_bounds[bs_sig]
                                        bs_bounds[bs_sig] = (min(b_start, cur_ev['dt']), max(b_end, nxt_ev['dt']))
                                    else:
                                        bs_bounds[bs_sig] = (cur_ev['dt'], nxt_ev['dt'])
                                    bs_example[bs_sig] = cur_ev

                            lines.append(f"- Поездка {t_idx}: {_period(t_start, t_end)}")
                            if stay_by_bs:
                                total_stay = sum(stay_by_bs.values())
                                dest_threshold = max(total_stay * TRIP_DEST_SHARE, 600.0)
                                candidate_sigs = [sig for sig, st in stay_by_bs.items() if st >= dest_threshold]
                                if not candidate_sigs:
                                    candidate_sigs = list(stay_by_bs.keys())

                                if len(trip_geocoded_events) <= 4:
                                    dest_sig = max(candidate_sigs, key=lambda sig: _dist_m(bs_example[sig]['lat'], bs_example[sig]['lon'], home_ref_lat, home_ref_lon))
                                else:
                                    def _cand_key(sig: Tuple[str, str, str, str]) -> Tuple[float, float]:
                                        ev = bs_example[sig]
                                        dist = _dist_m(ev['lat'], ev['lon'], home_ref_lat, home_ref_lon)
                                        return (stay_by_bs[sig], dist)
                                    dest_sig = max(candidate_sigs, key=_cand_key)

                                dest_ev = bs_example[dest_sig]
                                dest_start, dest_end = bs_bounds[dest_sig]
                                dest_stay = stay_by_bs[dest_sig]
                                lines.append(
                                    f"  - Целевая точка маршрута: {_loc_str(dest_ev['key'])}; центр {dest_ev['lat']:.5f}, {dest_ev['lon']:.5f}; период: {_period(dest_start, dest_end)}; длительность: {_format_duration(dest_stay)}"
                                )
                            else:
                                lines.append("  - Целевая точка маршрута не определена (недостаточно последовательных геокодированных событий)")

                            lines.append("  - Остановки не выявлены")

                            lines.append("  - Список локаций за период поездки:")
                            seq = _compress_trip_locations(trip_geocoded_events)
                            for a, b, k in seq:
                                if k[5] is None or k[6] is None:
                                    continue
                                lines.append(f"    - {_period(a, b)}: {_loc_str(k)}")
                lines.append("")

            lines.extend(["---", ""])

        content = "\n".join(lines).strip()
        return [{
            "type": "document",
            "name": f"Анализ средств связи ({_fmt_date(period_start)} — {_fmt_date(period_end)})",
            "description": "Аналитический отчёт по выбранным абонентским номерам",
            "data": {"content": content},
            "metadata": {"source_plugin": self.id, "period_start": period_start.isoformat(), "period_end": period_end.isoformat(), "trip_radius_km": trip_radius_km},
        }]

def _as_bool(value: Any, default: bool) -> bool:
    if isinstance(value, bool):
        return value
    if value is None:
        return default
    normalized = str(value).strip().lower()
    if normalized in {"1", "true", "yes", "y", "да"}:
        return True
    if normalized in {"0", "false", "no", "n", "нет"}:
        return False
    return default


def _build_continuous_segments(history: List[Dict[str, Any]], value_key: str) -> List[Dict[str, Any]]:
    intervals: List[Dict[str, Any]] = []
    for item in history:
        value = _norm(item.get(value_key))
        if not value:
            continue
        start_dt = _as_dt(item.get("period_start"))
        end_dt = _as_dt(item.get("period_end"))
        if start_dt is None or end_dt is None:
            continue
        if end_dt < start_dt:
            start_dt, end_dt = end_dt, start_dt
        intervals.append({"value": value, "start": start_dt, "end": end_dt})

    if not intervals:
        return []

    boundaries = sorted({point for interval in intervals for point in (interval["start"], interval["end"])})
    if len(boundaries) < 2:
        return []

    raw_segments: List[Dict[str, Any]] = []
    for i in range(len(boundaries) - 1):
        left = boundaries[i]
        right = boundaries[i + 1]
        if right <= left:
            continue
        covering = [x for x in intervals if x["start"] <= left and x["end"] >= right]
        if not covering:
            continue
        chosen = max(covering, key=lambda x: x["start"])
        raw_segments.append({"value": chosen["value"], "start": left, "end": right})

    if not raw_segments:
        return []

    merged: List[Dict[str, Any]] = [raw_segments[0]]
    for segment in raw_segments[1:]:
        last = merged[-1]
        if segment["value"] == last["value"] and segment["start"] <= last["end"]:
            if segment["end"] > last["end"]:
                last["end"] = segment["end"]
        else:
            merged.append(segment)
    return merged


def _compress_trip_locations(events: List[Dict[str, Any]]) -> List[Tuple[datetime, datetime, Tuple[str, str, str, str, str, Any, Any]]]:
    if not events:
        return []
    out: List[Tuple[datetime, datetime, Tuple[str, str, str, str, str, Any, Any]]] = []
    start = events[0]["dt"]
    end = events[0]["dt"]
    current_key = events[0]["key"]
    for item in events[1:]:
        if item["key"] == current_key:
            end = item["dt"]
            continue
        out.append((start, end, current_key))
        start = item["dt"]
        end = item["dt"]
        current_key = item["key"]
    out.append((start, end, current_key))
    return out


def _format_duration(seconds: float) -> str:
    total = int(max(seconds, 0))
    h = total // 3600
    m = (total % 3600) // 60
    if h > 0 and m > 0:
        return f"{h} ч {m} мин"
    if h > 0:
        return f"{h} ч"
    return f"{m} мин"





































