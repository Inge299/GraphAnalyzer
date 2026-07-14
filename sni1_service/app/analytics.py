from __future__ import annotations

import os
import cProfile
import pstats
import io
import time
from bisect import bisect_left, bisect_right
from collections import Counter, defaultdict
import ipaddress
from pathlib import Path
from typing import Any

from .enrich import enrich_events
from .models import AnalysisResult, DataQualityReport, EnrichedEvent, ParseResult
from .parser import parse_input
from .references import ReferenceLoader
from .report import build_markdown_report
from .tables import build_console_tables
from .utils import get_logger, get_settings, log_event
from .vpn_detector import detect_vpn_for_events

CATEGORY_TO_TOPIC = {
    "messenger": "мессенджеры и коммуникации",
    "social": "социальные сети",
    "video": "медиа и видео",
    "search": "поиск и браузинг",
    "news": "новости",
    "shopping": "покупки и маркетплейсы",
    "finance": "финансы и банки",
    "maps": "карты и геосервисы",
    "health": "здоровье и спорт",
    "dev": "разработка и IT",
    "gaming": "игры",
    "ads_analytics": "аналитика и реклама",
    "system_update": "системные обновления",
    "cloud_storage": "облачные сервисы",
    "cdn": "облачные/CDN сервисы",
    "vpn": "альтернативный доступ/VPN",
    "mobile_oem": "системные сервисы устройства",
    "apple_service": "системные сервисы устройства",
    "apple_push": "мессенджеры и коммуникации",
    "security": "безопасность и антифрод",
    "travel": "путешествия и транспорт",
    "dns": "сетевые сервисы и DNS",
    "software_update": "системные обновления",
    "webrtc_stun": "сетевые сервисы и DNS",
    "background_service": "служебный фоновый трафик",
    "unknown": "прочее",
    "other": "прочее",
}

VERDICT_ORDER = {"CLEAN": 0, "VPN_SUSPICIOUS": 1, "VPN_LIKELY": 2, "VPN_DETECTED": 3}
_REFS_CACHE: dict[str, tuple[tuple[tuple[str, int, int], ...], Any]] = {}
METHOD_BASE_SCORES = {
    "JA3_VPN_SIGNATURE": 100,
    "VPN_INFRA_IP_MATCH": 100,
    "SNI_ASN_MISMATCH": 100,
    "SELF_SIGNED_CERTIFICATE": 100,
    "SNI_IP_BEHAVIOR_PATTERN": 40,
    "MISSING_DNS_QUERY": 30,
    "ALT_DNS_GATEWAY_PATTERN": 25,
    "ALT_DNS_STABLE_PATTERN": 20,
    "MONODOMAIN_TUNNEL_PATTERN": 30,
    "LONG_KEEPALIVE": 25,
    "HIGH_ENTROPY": 25,
}


def analyze_input(
    input_path: str | Path,
    device_id: str | None = None,
    top_n: int | None = None,
    gap_minutes: int | None = None,
    document_title: str | None = None,
    console_title: str | None = None,
    refs_dir: str | Path | None = None,
) -> AnalysisResult:
    """Run the full parse -> enrich -> detect -> analytics -> report pipeline."""
    del console_title
    logger = get_logger(__name__)
    settings = get_settings()
    profiler = cProfile.Profile() if settings.profile_enabled else None
    stage_timings: dict[str, float] = {}
    t0 = time.perf_counter()

    effective_top_n = settings.default_top_n if top_n is None else top_n
    effective_gap = settings.default_gap_minutes if gap_minutes is None else gap_minutes
    if effective_top_n <= 0 or effective_gap <= 0:
        raise ValueError("top_n and gap_minutes must be > 0")
    log_event(
        logger,
        "analyze_input.start",
        input_path=str(input_path),
        device_id=device_id,
        top_n=effective_top_n,
        gap_minutes=effective_gap,
    )

    if profiler is not None:
        profiler.enable()
    t = time.perf_counter()
    parse_result: ParseResult = parse_input(input_path, device_id=device_id)
    stage_timings["parse_input_sec"] = round(time.perf_counter() - t, 4)

    refs_path = refs_dir
    if refs_path is None:
        refs_path = settings.refs_dir

    t = time.perf_counter()
    refs = _load_refs_cached(refs_path, logger)
    stage_timings["load_refs_sec"] = round(time.perf_counter() - t, 4)

    t = time.perf_counter()
    enriched = enrich_events(parse_result.events, refs)
    stage_timings["enrich_sec"] = round(time.perf_counter() - t, 4)

    t = time.perf_counter()
    detected = detect_vpn_for_events(enriched, refs)
    stage_timings["vpn_detect_sec"] = round(time.perf_counter() - t, 4)
    vpn_hits = sum(1 for e in detected if e.vpn_verdict != "CLEAN")
    log_event(logger, "analyze_input.vpn_done", events_total=len(detected), vpn_hits=vpn_hits)

    t = time.perf_counter()
    analytics = build_analytics(
        detected,
        parse_result.data_quality,
        refs.status,
        top_n=effective_top_n,
        gap_minutes=effective_gap,
    )
    stage_timings["build_analytics_sec"] = round(time.perf_counter() - t, 4)
    t = time.perf_counter()
    tables = build_console_tables(analytics)
    stage_timings["build_tables_sec"] = round(time.perf_counter() - t, 4)
    t = time.perf_counter()
    markdown = build_markdown_report(analytics, document_title)
    stage_timings["build_markdown_sec"] = round(time.perf_counter() - t, 4)
    stage_timings["total_sec"] = round(time.perf_counter() - t0, 4)
    if profiler is not None:
        profiler.disable()
        profile_stream = io.StringIO()
        stats = pstats.Stats(profiler, stream=profile_stream).sort_stats("cumulative")
        stats.print_stats(40)
        profile_text = profile_stream.getvalue()
        out_path = settings.profile_output
        if out_path:
            try:
                Path(out_path).write_text(profile_text, encoding="utf-8")
            except OSError as exc:
                log_event(logger, "profile.write.failed", error=str(exc), output=out_path)
        top_lines = [ln for ln in profile_text.splitlines() if ln.strip()][:20]
        log_event(logger, "profile.top", lines=top_lines)
    log_event(logger, "pipeline.timings", **stage_timings)

    meta = {
        "device_id": analytics.get("overview", {}).get("device_id"),
        "period_start": analytics.get("overview", {}).get("period_start"),
        "period_end": analytics.get("overview", {}).get("period_end"),
        "events_total": analytics.get("overview", {}).get("events_total", 0),
        "warnings": analytics.get("warnings", []),
        "references_status": analytics.get("references_status", {}),
        "timings": stage_timings,
    }

    return AnalysisResult(
        document_markdown=markdown,
        tables=tables,
        meta=meta,
        analytics=analytics,
    )


def warm_references_cache(refs_path: str | Path | None = None) -> bool:
    """Preload references into in-process cache to reduce first-request latency."""
    logger = get_logger(__name__)
    settings = get_settings()
    effective_refs = refs_path if refs_path is not None else settings.refs_dir
    try:
        _load_refs_cached(effective_refs, logger)
        return True
    except Exception as exc:
        log_event(logger, "references.warmup.failed", error=str(exc), refs_path=str(effective_refs))
        return False


def _load_refs_cached(refs_path: str | Path | None, logger) -> Any:
    loader = ReferenceLoader(refs_path)
    refs_dir = Path(refs_path) if refs_path is not None else None
    if refs_dir is None or not refs_dir.exists():
        log_event(logger, "references.cache.skip", reason="missing_refs_dir")
        return loader.load_all()

    signature_items: list[tuple[str, int, int]] = []
    for filename in loader.SUPPORTED_FILES:
        full_path = refs_dir / filename
        if not full_path.exists():
            continue
        try:
            stat = full_path.stat()
            signature_items.append((filename, int(stat.st_mtime_ns), int(stat.st_size)))
        except OSError:
            continue
    signature = tuple(sorted(signature_items))
    cache_key = str(refs_dir.resolve())
    cached = _REFS_CACHE.get(cache_key)
    if cached is not None and cached[0] == signature:
        log_event(logger, "references.cache.hit", refs_dir=cache_key, files=len(signature))
        return cached[1]

    refs = loader.load_all()
    _REFS_CACHE[cache_key] = (signature, refs)
    log_event(logger, "references.cache.miss", refs_dir=cache_key, files=len(signature))
    return refs


def build_analytics(
    events: list[EnrichedEvent],
    data_quality: DataQualityReport,
    references_status,
    top_n: int = 25,
    gap_minutes: int = 180,
) -> dict:
    """Build all analytics sections from enriched+detected events."""
    events_sorted = sorted(events, key=lambda e: e.ts)
    warnings = list(data_quality.warnings)
    if hasattr(references_status, "warnings"):
        warnings.extend(getattr(references_status, "warnings"))
    settings = get_settings()

    overview = _build_overview(events_sorted, data_quality)
    top_domains = _build_top_domains(events_sorted, top_n)
    unknown_domains = _build_unknown_domains(events_sorted)
    top_ips = _build_top_ips(events_sorted, top_n)
    categories = _build_categories(events_sorted)
    topics = _build_topics(events_sorted)
    interest_profile = _build_interest_profile(events_sorted)
    protocols = _build_protocols(events_sorted)
    messengers = _build_messengers(events_sorted)
    max_table_rows = max(200, int(settings.max_table_rows))
    vpn, vpn_detector, vpn_hits = _build_vpn_sections(events_sorted, hits_limit=max_table_rows)
    alt_access = _build_alt_access(events_sorted, limit=max_table_rows)
    gaps = _build_gaps(events_sorted, gap_minutes, limit=max_table_rows)
    behavior_profile = _build_behavior_profile(overview, topics, top_domains, top_ips, gaps)
    chronology = _build_chronology(events_sorted, limit=max_table_rows)
    chronology_markdown = chronology[: settings.max_chronology_rows]
    hours = _build_hours(events_sorted)
    days = _build_days(events_sorted)
    data_quality_table = _build_data_quality_table(data_quality)
    references_table, references_status_view = _build_references_table(references_status)
    detected_facts = _build_detected_facts(overview, topics, vpn_detector, alt_access, gaps, messengers)

    if categories:
        overview["top_category"] = categories[0]["category"]
    if topics:
        overview["top_topic"] = topics[0]["topic"]

    return {
        "overview": overview,
        "data_quality": data_quality_table,
        "top_domains": top_domains,
        "unknown_domains": unknown_domains,
        "top_ips": top_ips,
        "categories": categories,
        "topics": topics,
        "interest_profile": interest_profile,
        "protocols": protocols,
        "messengers": messengers,
        "vpn": vpn,
        "vpn_detector": vpn_detector,
        "vpn_detector_hits": vpn_hits,
        "alt_access": alt_access,
        "gaps": gaps,
        "behavior_profile": behavior_profile,
        "chronology": chronology,
        "chronology_markdown": chronology_markdown,
        "hours": hours,
        "days": days,
        "references": references_table,
        "references_status": references_status_view,
        "detected_facts": detected_facts,
        "warnings": warnings,
    }


def _build_interest_profile(events: list[EnrichedEvent]) -> list[dict[str, Any]]:
    total_events = len(events) or 1
    total_bytes = sum(int(e.bytes_total or 0) for e in events) or 1
    by_topic: dict[str, dict[str, Any]] = defaultdict(
        lambda: {
            "events": 0,
            "bytes_total": 0,
            "domains": Counter(),
            "hours": Counter(),
            "days": set(),
            "background_like": 0,
        }
    )
    for e in events:
        if _is_vpn_cover_domain_event(e):
            continue
        topic = _topic_for_event(e)
        row = by_topic[topic]
        row["events"] += 1
        row["bytes_total"] += int(e.bytes_total or 0)
        if e.sni:
            row["domains"][e.sni] += 1
        row["hours"][e.ts.hour] += 1
        row["days"].add(e.ts.date().isoformat())
        if (e.domain_category or "").lower() in {"ads_analytics", "system_update", "background_service", "dns"}:
            row["background_like"] += 1

    rows: list[dict[str, Any]] = []
    for topic, val in by_topic.items():
        if topic in {"прочее", "служебный фоновый трафик"}:
            continue
        events_cnt = int(val["events"])
        bytes_cnt = int(val["bytes_total"])
        bg_share = (val["background_like"] / max(events_cnt, 1)) * 100.0
        top_hours = [f"{h:02d}:00" for h, _ in val["hours"].most_common(3)]
        rows.append(
            {
                "topic": topic,
                "events": events_cnt,
                "events_share_pct": round((events_cnt / total_events) * 100.0, 2),
                "bytes_total": bytes_cnt,
                "bytes_share_pct": round((bytes_cnt / total_bytes) * 100.0, 2),
                "unique_domains": len(val["domains"]),
                "top_domains": [d for d, _ in val["domains"].most_common(12)],
                "active_days": len(val["days"]),
                "top_hours": top_hours,
                "user_signal_strength": "high" if bg_share < 30 else ("medium" if bg_share < 60 else "low"),
                "background_share_pct": round(bg_share, 2),
            }
        )
    rows.sort(key=lambda r: (-r["events"], -r["bytes_total"], r["topic"]))
    return rows[:10]


def _build_behavior_profile(
    overview: dict[str, Any],
    topics: list[dict[str, Any]],
    top_domains: list[dict[str, Any]],
    top_ips: list[dict[str, Any]],
    gaps: list[dict[str, Any]],
) -> list[dict]:
    rows: list[dict[str, Any]] = []
    events_total = int(overview.get("events_total", 0) or 0)
    bytes_total = float(overview.get("bytes_total", 0) or 0)
    bytes_rx = float(overview.get("bytes_rx", 0) or 0)
    bytes_tx = float(overview.get("bytes_tx", 0) or 0)

    if bytes_total > 0:
        rx_pct = round((bytes_rx * 100.0) / bytes_total, 2)
        tx_pct = round((bytes_tx * 100.0) / bytes_total, 2)
        rows.append(
            {
                "metric": "traffic_balance",
                "value": f"RX {rx_pct}% / TX {tx_pct}%",
                "details": "Преобладание входящего/исходящего трафика",
            }
        )

    if topics and events_total > 0:
        lead = topics[0]
        lead_events = int(lead.get("events", 0) or 0)
        rows.append(
            {
                "metric": "dominant_topic",
                "value": str(lead.get("topic") or "-"),
                "details": f"{round((lead_events / events_total) * 100.0, 2)}% событий",
            }
        )

    eco = _build_ecosystem_profile(top_domains, events_total)
    if eco:
        rows.append({"metric": "ecosystems", "value": eco, "details": "Топ экосистем сервисов по событиям"})

    private_heavy = [r for r in top_ips if str(r.get("asn", "")).strip().upper() in {"0", "AS0"}]
    if private_heavy and events_total > 0:
        top_private = private_heavy[0]
        private_events = int(top_private.get("events", 0) or 0)
        rows.append(
            {
                "metric": "private_infra_share",
                "value": str(top_private.get("ip") or "-"),
                "details": f"{round((private_events / events_total) * 100.0, 2)}% событий",
            }
        )

    if gaps:
        max_gap = max(float(g.get("duration_minutes", 0) or 0) for g in gaps)
        rows.append(
            {
                "metric": "max_traffic_gap",
                "value": f"{int(max_gap)} мин",
                "details": "Возможна смена канала доступа/офлайн-период",
            }
        )
    return rows


def _build_ecosystem_profile(top_domains: list[dict[str, Any]], events_total: int) -> str:
    if not top_domains or events_total <= 0:
        return ""
    buckets: dict[str, int] = {}
    for row in top_domains[:40]:
        etld1 = str(row.get("etld1") or row.get("domain") or "").lower()
        events = int(row.get("events", 0) or 0)
        label = "прочие"
        if "yandex" in etld1:
            label = "Yandex"
        elif "mail.ru" in etld1 or "vk.com" in etld1 or "vk-analytics.ru" in etld1:
            label = "VK/Mail"
        elif "google" in etld1 or "gstatic" in etld1:
            label = "Google"
        elif "apple" in etld1 or "icloud" in etld1:
            label = "Apple"
        elif "wildberries" in etld1 or "wb.ru" in etld1 or "rustore" in etld1:
            label = "Маркетплейсы"
        elif "vtb" in etld1 or "tinkoff" in etld1 or "t-bank" in etld1:
            label = "Финтех"
        buckets[label] = buckets.get(label, 0) + events
    ranked = sorted(buckets.items(), key=lambda kv: kv[1], reverse=True)[:3]
    parts = []
    for name, cnt in ranked:
        if cnt <= 0 or name == "прочие":
            continue
        pct = round((cnt / events_total) * 100.0, 2)
        parts.append(f"{name} ({pct}%)")
    return ", ".join(parts)


def _build_overview(events: list[EnrichedEvent], dq: DataQualityReport) -> dict:
    if events:
        period_start = events[0].ts
        period_end = events[-1].ts
        duration_hours = max((period_end - period_start).total_seconds() / 3600.0, 0.0)
        device_id = next((e.device_id for e in events if e.device_id), None)
    else:
        period_start = None
        period_end = None
        duration_hours = None
        device_id = None

    bytes_rx = sum(e.bytes_rx for e in events)
    bytes_tx = sum(e.bytes_tx for e in events)
    parsed = dq.parsed_rows or 0
    sni_ratio = (dq.rows_with_sni / parsed) if parsed else 0.0
    ip_ratio = (dq.rows_with_dst_ip / parsed) if parsed else 0.0

    if parsed and sni_ratio >= 0.6 and ip_ratio >= 0.8:
        confidence = "high"
    elif parsed and ip_ratio >= 0.5:
        confidence = "medium"
    else:
        confidence = "low"

    return {
        "device_id": device_id,
        "period_start": period_start.isoformat() if period_start else None,
        "period_end": period_end.isoformat() if period_end else None,
        "duration_hours": round(duration_hours, 2) if duration_hours is not None else None,
        "events_total": len(events),
        "unique_domains": len({e.sni for e in events if e.sni}),
        "unique_ips": len({e.dst_ip for e in events if e.dst_ip}),
        "bytes_total": bytes_rx + bytes_tx,
        "bytes_rx": bytes_rx,
        "bytes_tx": bytes_tx,
        "vpn_detected_count": sum(1 for e in events if e.vpn_verdict == "VPN_DETECTED"),
        "vpn_likely_count": sum(1 for e in events if e.vpn_verdict == "VPN_LIKELY"),
        "vpn_suspicious_count": sum(1 for e in events if e.vpn_verdict == "VPN_SUSPICIOUS"),
        "messengers_detected": sum(1 for e in events if e.is_messenger),
        "top_category": None,
        "top_topic": None,
        "data_confidence": confidence,
    }


def _build_top_domains(events: list[EnrichedEvent], top_n: int) -> list[dict]:
    agg: dict[str, dict[str, Any]] = {}
    for e in events:
        if not e.sni:
            continue
        row = agg.setdefault(
            e.sni,
            {
                "domain": e.sni,
                "etld1": e.etld1,
                "events": 0,
                "bytes_total": 0,
                "bytes_rx": 0,
                "bytes_tx": 0,
                "first_seen": e.ts,
                "last_seen": e.ts,
                "category": e.domain_category or "unknown",
                "topic": _topic_for_event(e),
                "rank": e.top_rank,
                "is_messenger": e.is_messenger,
                "messenger_app": e.messenger_app,
                "vpn_max_verdict": e.vpn_verdict,
                "related_ips": set(),
            },
        )
        row["events"] += 1
        row["bytes_total"] += e.bytes_total
        row["bytes_rx"] += e.bytes_rx
        row["bytes_tx"] += e.bytes_tx
        row["first_seen"] = min(row["first_seen"], e.ts)
        row["last_seen"] = max(row["last_seen"], e.ts)
        if e.dst_ip:
            row["related_ips"].add(e.dst_ip)
        if e.top_rank is not None and (row["rank"] is None or e.top_rank < row["rank"]):
            row["rank"] = e.top_rank
        if VERDICT_ORDER.get(e.vpn_verdict, 0) > VERDICT_ORDER.get(row["vpn_max_verdict"], 0):
            row["vpn_max_verdict"] = e.vpn_verdict

    rows = []
    for row in agg.values():
        category = str(row["category"] or "unknown").lower()
        if row["is_messenger"]:
            comment = f"Коммуникационный сервис: {row['messenger_app'] or 'unknown'}"
        elif row["vpn_max_verdict"] != "CLEAN":
            comment = "Есть VPN-признаки"
        elif category == "health":
            comment = "Сервис здоровья/устройства"
        elif category == "ads_analytics":
            comment = "Аналитика/рекламная инфраструктура приложения"
        elif category == "cdn":
            comment = "CDN/облачная инфраструктура"
        elif category == "unknown":
            comment = "Категория не определена"
        else:
            comment = ""

        rows.append(
            {
                "domain": row["domain"],
                "etld1": row["etld1"],
                "events": row["events"],
                "bytes_total": row["bytes_total"],
                "bytes_rx": row["bytes_rx"],
                "bytes_tx": row["bytes_tx"],
                "first_seen": row["first_seen"].isoformat(),
                "last_seen": row["last_seen"].isoformat(),
                "category": row["category"],
                "topic": row["topic"],
                "rank": row["rank"],
                "is_messenger": row["is_messenger"],
                "messenger_app": row["messenger_app"],
                "vpn_max_verdict": row["vpn_max_verdict"],
                "related_ips": sorted(row["related_ips"]),
                "comment": comment,
            }
        )

    rows.sort(key=lambda r: (-r["events"], -r["bytes_total"], r["domain"]))
    return rows[:top_n]


def _build_top_ips(events: list[EnrichedEvent], top_n: int) -> list[dict]:
    # Build local IP->SNI timeline for probabilistic mapping of IP-only events
    ip_sni_timeline: dict[str, list[tuple[float, str]]] = defaultdict(list)
    for e in events:
        if e.dst_ip and e.sni:
            ip_sni_timeline[e.dst_ip].append((e.ts.timestamp(), e.sni))
    for ip in ip_sni_timeline:
        ip_sni_timeline[ip].sort(key=lambda x: x[0])

    agg: dict[str, dict[str, Any]] = {}
    for e in events:
        if not e.dst_ip:
            continue
        row = agg.setdefault(
            e.dst_ip,
            {
                "ip": e.dst_ip,
                "events": 0,
                "bytes_total": 0,
                "ports": set(),
                "asn": e.asn,
                "as_name": e.as_name,
                "cloud_provider": e.cloud_provider,
                "vpn_ioc_match": False,
                "related_domains": set(),
                "inferred_domain_votes": Counter(),
                "ip_only_events": 0,
                "verdict_rank": 0,
            },
        )
        row["events"] += 1
        row["bytes_total"] += e.bytes_total
        if e.dst_port is not None:
            row["ports"].add(e.dst_port)
        if e.sni:
            row["related_domains"].add(e.sni)
        else:
            row["ip_only_events"] += 1
            timeline = ip_sni_timeline.get(e.dst_ip, [])
            if timeline:
                ts = e.ts.timestamp()
                # small local interval: +/- 5 minutes
                left = bisect_left(timeline, (ts - 300.0, ""))
                right = bisect_right(timeline, (ts + 300.0, chr(0x10FFFF)))
                for _, d in timeline[left:right]:
                    row["inferred_domain_votes"][d] += 1
        row["vpn_ioc_match"] = row["vpn_ioc_match"] or e.is_vpn_infra_ip
        row["verdict_rank"] = max(row["verdict_rank"], VERDICT_ORDER.get(e.vpn_verdict, 0))

    rows = []
    for row in agg.values():
        is_private_or_not_routed = _is_private_or_not_routed_ip(row["ip"], row["asn"])
        if row["vpn_ioc_match"] or row["verdict_rank"] >= VERDICT_ORDER["VPN_DETECTED"]:
            risk = "high"
        elif is_private_or_not_routed:
            risk = "low"
        elif row["verdict_rank"] >= VERDICT_ORDER["VPN_SUSPICIOUS"]:
            risk = "medium"
        else:
            risk = "low"

        inferred_domains = [d for d, _ in row["inferred_domain_votes"].most_common(3)]
        votes_total = sum(row["inferred_domain_votes"].values())
        best_votes = row["inferred_domain_votes"].most_common(1)[0][1] if row["inferred_domain_votes"] else 0
        inferred_confidence = round((best_votes / votes_total), 3) if votes_total > 0 else 0.0
        rows.append(
            {
                "ip": row["ip"],
                "events": row["events"],
                "bytes_total": row["bytes_total"],
                "ports": sorted(row["ports"]),
                "asn": row["asn"],
                "as_name": row["as_name"],
                "cloud_provider": row["cloud_provider"],
                "vpn_ioc_match": row["vpn_ioc_match"],
                "related_domains": sorted(row["related_domains"]),
                "inferred_domains": inferred_domains,
                "inferred_confidence": inferred_confidence,
                "ip_only_events": row["ip_only_events"],
                "risk_level": risk,
            }
        )

    rows.sort(key=lambda r: (-r["events"], -r["bytes_total"], r["ip"]))
    return rows[:top_n]


def _build_categories(events: list[EnrichedEvent]) -> list[dict]:
    total_events = len(events) or 1
    total_bytes = sum(e.bytes_total for e in events) or 1
    agg: dict[str, dict[str, Any]] = defaultdict(lambda: {"events": 0, "bytes_total": 0, "domains": Counter()})

    for e in events:
        if _is_vpn_cover_domain_event(e):
            continue
        category = e.domain_category or ("cdn" if e.is_cloud else "unknown")
        agg[category]["events"] += 1
        agg[category]["bytes_total"] += e.bytes_total
        if e.sni:
            agg[category]["domains"][e.sni] += 1

    rows = []
    for category, value in agg.items():
        comment = {
            "unknown": "Недостаточно данных для уверенной категоризации.",
            "cdn": "Заметна инфраструктурная облачная активность.",
            "messenger": "Наблюдаются коммуникационные сервисы.",
            "background_service": "Служебный сетевой фон устройства/приложений.",
            "dns": "DNS-резолвинг и связанные сетевые сервисы.",
        }.get(category, f"Наблюдается активность к сервисам категории {category}.")
        rows.append(
            {
                "category": category,
                "events": value["events"],
                "events_share": round(value["events"] / total_events, 4),
                "bytes_total": value["bytes_total"],
                "bytes_share": round(value["bytes_total"] / total_bytes, 4),
                "top_domains": [d for d, _ in value["domains"].most_common(3)],
                "comment": comment,
            }
        )

    rows.sort(key=lambda r: (-r["events"], -r["bytes_total"], r["category"]))
    return rows


def _build_unknown_domains(events: list[EnrichedEvent]) -> list[dict[str, Any]]:
    agg: dict[str, dict[str, Any]] = {}
    for e in events:
        if _is_vpn_cover_domain_event(e):
            continue
        domain = str(e.sni or "").strip().lower()
        if not domain:
            continue
        topic = _topic_for_event(e)
        if topic != "прочее":
            continue
        row = agg.setdefault(
            domain,
            {
                "domain": domain,
                "events": 0,
                "bytes_total": 0,
                "topic": "прочее",
                "related_ips": set(),
                "suggested_action": "add_to_domain_category_seed_extended",
            },
        )
        row["events"] += 1
        row["bytes_total"] += int(e.bytes_total or 0)
        if e.dst_ip:
            row["related_ips"].add(e.dst_ip)

    rows: list[dict[str, Any]] = []
    for row in agg.values():
        rows.append(
            {
                "domain": row["domain"],
                "events": row["events"],
                "bytes_total": row["bytes_total"],
                "topic": row["topic"],
                "related_ips": sorted(row["related_ips"]),
                "suggested_action": row["suggested_action"],
            }
        )
    rows.sort(key=lambda r: (-int(r.get("events", 0)), -int(r.get("bytes_total", 0)), str(r.get("domain") or "")))
    return rows[:500]


def _build_topics(events: list[EnrichedEvent]) -> list[dict]:
    agg: dict[str, dict[str, Any]] = defaultdict(lambda: {"events": 0, "bytes_total": 0, "domains": Counter()})
    for e in events:
        if _is_vpn_cover_domain_event(e):
            continue
        topic = _topic_for_event(e)
        agg[topic]["events"] += 1
        agg[topic]["bytes_total"] += e.bytes_total
        if e.sni:
            agg[topic]["domains"][e.sni] += 1

    rows = []
    for topic, value in agg.items():
        interpretation = _topic_interpretation(topic, value["events"], value["bytes_total"], value["domains"])
        rows.append(
            {
                "topic": topic,
                "confidence": 0.7 if topic != "прочее" else 0.4,
                "events": value["events"],
                "bytes_total": value["bytes_total"],
                "evidence_domains": [d for d, _ in value["domains"].most_common(8)],
                "interpretation": interpretation,
            }
        )

    rows.sort(key=lambda r: (-r["events"], -r["bytes_total"], r["topic"]))
    return rows


def _is_vpn_cover_domain_event(event: EnrichedEvent) -> bool:
    if not event.sni:
        return False
    methods = set(event.vpn_methods_triggered or [])
    if "SNI_IP_BEHAVIOR_PATTERN" in methods:
        return True
    return False


def _build_protocols(events: list[EnrichedEvent]) -> list[dict]:
    agg: dict[str, dict[str, Any]] = defaultdict(lambda: {"events": 0, "bytes_total": 0, "ports": Counter()})

    for e in events:
        labels = set()
        if e.transport_protocol:
            labels.add(e.transport_protocol.upper())
        if e.app_protocol:
            labels.add(e.app_protocol.upper())
        if e.protocol_hint:
            hint = e.protocol_hint.lower()
            if "domain name server" in hint:
                labels.add("DNS")
            if "tls/ssl" in hint:
                labels.add("HTTPS/TLS")

        if e.dst_port == 53:
            labels.add("DNS")
        if e.dst_port == 443 or (e.app_protocol and e.app_protocol.upper() == "HTTPS"):
            labels.add("HTTPS/TLS")
        if e.transport_protocol and e.transport_protocol.upper() == "UDP" and e.dst_port == 443:
            labels.add("UDP/443")

        if not labels:
            labels = {"UNKNOWN"}

        for label in labels:
            agg[label]["events"] += 1
            agg[label]["bytes_total"] += e.bytes_total
            if e.dst_port is not None:
                agg[label]["ports"][e.dst_port] += 1

    rows = []
    for protocol, value in agg.items():
        comment = ""
        if protocol == "UDP/443":
            comment = "possible QUIC/HTTP3"
        elif protocol == "DNS":
            comment = "DNS-трафик"
        elif protocol == "HTTPS/TLS":
            comment = "Шифрованный веб-трафик"

        rows.append(
            {
                "protocol": protocol,
                "events": value["events"],
                "bytes_total": value["bytes_total"],
                "top_ports": [p for p, _ in value["ports"].most_common(5)],
                "comment": comment,
            }
        )

    rows.sort(key=lambda r: (-r["events"], -r["bytes_total"], r["protocol"]))
    return rows


def _build_messengers(events: list[EnrichedEvent]) -> list[dict]:
    agg: dict[str, dict[str, Any]] = {}
    for e in events:
        is_topic_messenger = _topic_for_event(e) == "мессенджеры и коммуникации"
        if not e.is_messenger and not is_topic_messenger:
            continue
        app = e.messenger_app or _guess_messenger_app(e.sni or e.etld1 or "") or e.etld1 or e.sni or "unknown"
        row = agg.setdefault(
            app,
            {
                "app_name": app,
                "matched_domains": Counter(),
                "ips": Counter(),
                "events": 0,
                "bytes_total": 0,
                "first_seen": e.ts,
                "last_seen": e.ts,
                "active_hours": set(),
                "confidence": e.messenger_confidence,
                "vpn_overlap_events": 0,
            },
        )
        row["events"] += 1
        row["bytes_total"] += e.bytes_total
        if e.sni:
            row["matched_domains"][e.sni] += 1
        if e.dst_ip:
            row["ips"][e.dst_ip] += 1
        row["first_seen"] = min(row["first_seen"], e.ts)
        row["last_seen"] = max(row["last_seen"], e.ts)
        row["active_hours"].add(e.ts.strftime("%Y-%m-%d %H:00"))
        if e.vpn_verdict != "CLEAN":
            row["vpn_overlap_events"] += 1

    rows = []
    for row in agg.values():
        conf = row["confidence"] or 0.0
        events_count = int(row["events"] or 0)
        bytes_count = int(row["bytes_total"] or 0)
        domain_count = len(row["matched_domains"])
        # Combine detector confidence with observed stability/volume to avoid over-flagging everything as weak.
        if events_count >= 500 and domain_count >= 2:
            status = "подтверждено"
        elif conf >= 0.8 and events_count >= 20 and domain_count >= 2 and bytes_count > 0:
            status = "подтверждено"
        elif events_count >= 50 and domain_count >= 1:
            status = "вероятно"
        elif conf >= 0.6 and events_count >= 5 and domain_count >= 1:
            status = "вероятно"
        else:
            status = "слабо выражено"

        rows.append(
            {
                "app_name": row["app_name"],
                "matched_domains": [d for d, _ in row["matched_domains"].most_common(5)],
                "top_ips": [ip for ip, _ in row["ips"].most_common(3)],
                "events": row["events"],
                "bytes_total": row["bytes_total"],
                "first_seen": row["first_seen"].isoformat(),
                "last_seen": row["last_seen"].isoformat(),
                "active_hours": sorted(row["active_hours"]),
                "confidence": row["confidence"],
                "vpn_overlap_events": row["vpn_overlap_events"],
                "status": status,
                "comment": "Наблюдается активность коммуникационного сервиса.",
            }
        )

    rows.sort(key=lambda r: (-r["events"], -r["bytes_total"], r["app_name"]))
    return rows


def _guess_messenger_app(domain: str) -> str | None:
    d = str(domain or "").lower()
    if not d:
        return None
    if "whatsapp" in d:
        return "WhatsApp"
    if "telegram" in d or ".tg" in d:
        return "Telegram"
    if "oneme" in d or "max" in d:
        return "MAX/OneMe"
    if "vk.com" in d or "vkuser" in d:
        return "VK"
    if "mail.ru" in d:
        return "Mail"
    if "messenger.yandex" in d:
        return "Yandex Messenger"
    if "push.apple.com" in d or "push-apple.com" in d or "courier" in d and "apple" in d:
        return "Apple Push/iMessage"
    if "signal" in d:
        return "Signal"
    if "blackberry" in d and "voip" in d:
        return "BlackBerry VoIP"
    return None


def _is_private_or_not_routed_ip(ip_raw: Any, asn_raw: Any) -> bool:
    ip_s = str(ip_raw or "").strip()
    if not ip_s:
        return False
    try:
        ip_obj = ipaddress.ip_address(ip_s)
        if ip_obj.is_private or ip_obj.is_loopback or ip_obj.is_link_local or ip_obj.is_reserved:
            return True
    except ValueError:
        return False
    asn_s = str(asn_raw or "").strip().lower()
    return asn_s in {"0", "as0", "none", "not routed", "not_routed"}


def _build_vpn_sections(
    events: list[EnrichedEvent], *, hits_limit: int | None = None
) -> tuple[list[dict], list[dict], list[dict]]:
    verdict_agg: dict[str, dict[str, Any]] = defaultdict(
        lambda: {
            "count": 0,
            "max_confidence": 0.0,
            "methods": Counter(),
            "domains": Counter(),
            "ips": Counter(),
        }
    )
    method_agg: dict[str, dict[str, Any]] = defaultdict(lambda: {"count": 0, "max_score": 0, "example": ""})
    hits: list[dict] = []

    for e in events:
        has_hit = e.vpn_verdict != "CLEAN" or bool(e.vpn_methods_triggered) or bool(e.alternative_access_methods)
        if has_hit and (hits_limit is None or len(hits) < hits_limit):
            hits.append(
                {
                    "ts": e.ts.isoformat(),
                    "src_ip": e.src_ip,
                    "dst_ip": e.dst_ip,
                    "dst_port": e.dst_port,
                    "sni": e.sni,
                    "etld1": e.etld1,
                    "asn": e.asn,
                    "as_name": e.as_name,
                    "cloud_provider": e.cloud_provider,
                    "vpn_verdict": e.vpn_verdict,
                    "vpn_confidence": e.vpn_confidence,
                    "vpn_total_score": e.vpn_total_score,
                    "methods": list(e.vpn_methods_triggered),
                    "evidence": list(e.vpn_evidence),
                    "suppression_applied": list(e.suppression_applied),
                }
            )

        v = verdict_agg[e.vpn_verdict]
        v["count"] += 1
        v["max_confidence"] = max(v["max_confidence"], e.vpn_confidence)
        for method in e.vpn_methods_triggered:
            v["methods"][method] += 1
            m = method_agg[method]
            m["count"] += 1
            m["max_score"] = max(m["max_score"], METHOD_BASE_SCORES.get(method, 0))
            if not m["example"] and e.vpn_evidence:
                m["example"] = e.vpn_evidence[0]
        if e.sni:
            v["domains"][e.sni] += 1
        if e.dst_ip:
            v["ips"][e.dst_ip] += 1

    vpn = []
    for verdict, value in verdict_agg.items():
        summary = {
            "VPN_DETECTED": "Обнаружены подтвержденные индикаторы VPN/proxy/tunnel.",
            "VPN_LIKELY": "Набор признаков указывает на вероятный VPN/туннелирование.",
            "VPN_SUSPICIOUS": "Есть подозрительные признаки, но подтверждения недостаточно.",
            "CLEAN": "Подтвержденных признаков VPN не выявлено.",
        }.get(verdict, "")
        vpn.append(
            {
                "verdict": verdict,
                "count": value["count"],
                "max_confidence": round(value["max_confidence"], 3),
                "top_methods": [m for m, _ in value["methods"].most_common(5)],
                "top_domains": [d for d, _ in value["domains"].most_common(3)],
                "top_ips": [ip for ip, _ in value["ips"].most_common(3)],
                "summary": summary,
            }
        )

    vpn.sort(key=lambda r: (-VERDICT_ORDER.get(r["verdict"], 0), -r["count"]))

    vpn_detector = [
        {
            "method": method,
            "count": value["count"],
            "max_score": value["max_score"],
            "example_evidence": value["example"],
        }
        for method, value in method_agg.items()
    ]
    vpn_detector.sort(key=lambda r: (-r["count"], -r["max_score"], r["method"]))
    hits.sort(key=lambda r: r["ts"])
    return vpn, vpn_detector, hits


def _build_alt_access(events: list[EnrichedEvent], *, limit: int | None = None) -> list[dict]:
    rows = []
    for e in events:
        if not e.alternative_access_methods:
            continue
        comment = ""
        if (
            "ALT_DNS_GATEWAY_PATTERN" in e.alternative_access_methods
            or "ALT_DNS_GATEWAY" in e.alternative_access_methods
        ):
            comment = (
                "Обнаружено обращение к альтернативному DNS. "
                "Это не доказывает VPN, но может указывать на альтернативный канал разрешения доменов."
            )

        if limit is not None and len(rows) >= limit:
            continue
        rows.append(
            {
                "ts": e.ts.isoformat(),
                "src_ip": e.src_ip,
                "dst_ip": e.dst_ip,
                "dst_port": e.dst_port,
                "sni": e.sni,
                "methods": list(e.alternative_access_methods),
                "score": e.alternative_access_score,
                "evidence": list(e.alternative_access_evidence),
                "comment": comment,
            }
        )
    return rows


def _build_gaps(events: list[EnrichedEvent], gap_minutes: int, *, limit: int | None = None) -> list[dict]:
    rows = []
    if len(events) < 2:
        return rows

    threshold = gap_minutes * 60
    for prev, cur in zip(events, events[1:]):
        gap_sec = (cur.ts - prev.ts).total_seconds()
        if gap_sec <= threshold:
            continue
        if limit is not None and len(rows) >= limit:
            continue
        rows.append(
            {
                "gap_start": prev.ts.isoformat(),
                "gap_end": cur.ts.isoformat(),
                "duration_minutes": round(gap_sec / 60.0, 2),
                "previous_domain": prev.sni or prev.dst_ip,
                "next_domain": cur.sni or cur.dst_ip,
                "previous_cell_address": prev.cell_address,
                "next_cell_address": cur.cell_address,
                "comment": "Длительный разрыв активности по телеметрии.",
            }
        )
    return rows


def _build_chronology(events: list[EnrichedEvent], *, limit: int | None = None) -> list[dict]:
    rows = []
    for e in events:
        if limit is not None and len(rows) >= limit:
            break
        protocol = e.transport_protocol or e.app_protocol or e.protocol_hint
        rows.append(
            {
                "ts": e.ts.isoformat(),
                "end_ts": e.end_ts.isoformat() if e.end_ts else None,
                "duration_sec": e.duration_sec,
                "domain": e.sni,
                "dst_ip": e.dst_ip,
                "dst_port": e.dst_port,
                "protocol": protocol,
                "bytes_total": e.bytes_total,
                "category": e.domain_category or ("cdn" if e.is_cloud else "unknown"),
                "topic": _topic_for_event(e),
                "vpn_verdict": e.vpn_verdict,
                "comment": "Сетевое событие в хронологии.",
            }
        )
    return rows


def _build_hours(events: list[EnrichedEvent]) -> list[dict]:
    agg: dict[str, dict[str, Any]] = defaultdict(lambda: {"events": 0, "bytes_total": 0, "cats": Counter(), "vpn": 0, "msg": 0})
    for e in events:
        hour = e.ts.strftime("%Y-%m-%d %H:00")
        category = e.domain_category or ("cdn" if e.is_cloud else "unknown")
        agg[hour]["events"] += 1
        agg[hour]["bytes_total"] += e.bytes_total
        agg[hour]["cats"][category] += 1
        if e.vpn_verdict != "CLEAN":
            agg[hour]["vpn"] += 1
        if e.is_messenger:
            agg[hour]["msg"] += 1

    rows = []
    for hour, value in sorted(agg.items()):
        rows.append(
            {
                "hour": hour,
                "events": value["events"],
                "bytes_total": value["bytes_total"],
                "top_category": value["cats"].most_common(1)[0][0] if value["cats"] else "unknown",
                "vpn_events": value["vpn"],
                "messenger_events": value["msg"],
            }
        )
    return rows


def _build_days(events: list[EnrichedEvent]) -> list[dict]:
    agg: dict[str, dict[str, Any]] = defaultdict(
        lambda: {"events": 0, "bytes_total": 0, "domains": set(), "cats": Counter(), "vpn": 0, "msg": 0}
    )
    for e in events:
        day = e.ts.strftime("%Y-%m-%d")
        category = e.domain_category or ("cdn" if e.is_cloud else "unknown")
        agg[day]["events"] += 1
        agg[day]["bytes_total"] += e.bytes_total
        if e.sni:
            agg[day]["domains"].add(e.sni)
        agg[day]["cats"][category] += 1
        if e.vpn_verdict != "CLEAN":
            agg[day]["vpn"] += 1
        if e.is_messenger:
            agg[day]["msg"] += 1

    rows = []
    for day, value in sorted(agg.items()):
        rows.append(
            {
                "day": day,
                "events": value["events"],
                "bytes_total": value["bytes_total"],
                "unique_domains": len(value["domains"]),
                "top_category": value["cats"].most_common(1)[0][0] if value["cats"] else "unknown",
                "vpn_events": value["vpn"],
                "messenger_events": value["msg"],
            }
        )
    return rows


def _build_data_quality_table(dq: DataQualityReport) -> list[dict]:
    rows = [
        {"metric": "total_rows", "value": dq.total_rows},
        {"metric": "parsed_rows", "value": dq.parsed_rows},
        {"metric": "skipped_rows", "value": dq.skipped_rows},
        {"metric": "skip_reason_no_timestamp", "value": dq.skip_reason_no_timestamp},
        {"metric": "skip_reason_no_signal", "value": dq.skip_reason_no_signal},
        {"metric": "skip_reason_parse_error", "value": dq.skip_reason_parse_error},
        {"metric": "rows_with_sni", "value": dq.rows_with_sni},
        {"metric": "rows_with_dst_ip", "value": dq.rows_with_dst_ip},
        {"metric": "rows_with_bytes", "value": dq.rows_with_bytes},
        {"metric": "rows_with_protocol", "value": dq.rows_with_protocol},
        {"metric": "rows_with_end_ts", "value": dq.rows_with_end_ts},
        {"metric": "csv_files_processed", "value": dq.csv_files_processed},
        {"metric": "csv_files_failed", "value": dq.csv_files_failed},
        {"metric": "encodings_used", "value": dict(dq.encodings_used)},
    ]
    return rows


def _build_references_table(references_status) -> tuple[list[dict], dict]:
    rows = []
    status_view = {"loaded_files": {}, "missing_files": [], "failed_files": {}, "warnings": []}
    if references_status is None:
        rows.append({"reference": "all", "status": "unknown", "records": 0, "message": "No status"})
        return rows, status_view

    loaded_files = dict(getattr(references_status, "loaded_files", {}))
    missing_files = list(getattr(references_status, "missing_files", []))
    failed_files = dict(getattr(references_status, "failed_files", {}))
    warnings = list(getattr(references_status, "warnings", []))

    status_view = {
        "loaded_files": loaded_files,
        "missing_files": missing_files,
        "failed_files": failed_files,
        "warnings": warnings,
    }

    for name, records in sorted(loaded_files.items()):
        rows.append({"reference": name, "status": "loaded", "records": records, "message": ""})
    for name in sorted(missing_files):
        rows.append({"reference": name, "status": "missing", "records": 0, "message": "File not found"})
    for name, msg in sorted(failed_files.items()):
        rows.append({"reference": name, "status": "failed", "records": 0, "message": msg})
    for msg in warnings:
        rows.append({"reference": "warning", "status": "warning", "records": 0, "message": msg})

    return rows, status_view


def _build_detected_facts(
    overview: dict[str, Any],
    topics: list[dict[str, Any]],
    vpn_detector: list[dict[str, Any]],
    alt_access: list[dict[str, Any]],
    gaps: list[dict[str, Any]],
    messengers: list[dict[str, Any]],
) -> list[dict[str, Any]]:
    facts: list[dict[str, Any]] = []

    if topics:
        facts.append(
            {
                "fact_type": "traffic_topics",
                "severity": "info",
                "summary": "Ключевые тематики трафика",
                "details": ", ".join(f"{t.get('topic')} ({t.get('events')})" for t in topics[:5]),
            }
        )

    detected = int(overview.get("vpn_detected_count", 0) or 0)
    likely = int(overview.get("vpn_likely_count", 0) or 0)
    suspicious = int(overview.get("vpn_suspicious_count", 0) or 0)
    if detected or likely or suspicious:
        facts.append(
            {
                "fact_type": "vpn_summary",
                "severity": "warning" if (detected or likely) else "info",
                "summary": "Признаки VPN/обходного доступа",
                "details": f"detected={detected}, likely={likely}, suspicious={suspicious}",
            }
        )

    for signal in vpn_detector[:5]:
        facts.append(
            {
                "fact_type": "detector_signal",
                "severity": "info",
                "summary": f"Сигнал: {signal.get('method')}",
                "details": f"count={signal.get('count')}, max_score={signal.get('max_score')}",
            }
        )

    if alt_access:
        facts.append(
            {
                "fact_type": "alt_dns",
                "severity": "warning",
                "summary": "События альтернативного DNS/доступа",
                "details": f"events={len(alt_access)}",
            }
        )

    if gaps:
        top_gap = gaps[0]
        facts.append(
            {
                "fact_type": "traffic_gaps",
                "severity": "info",
                "summary": "Длительные паузы в трафике",
                "details": (
                    f"count={len(gaps)}, longest={top_gap.get('duration_minutes')} min; "
                    "возможен WiFi или выключение устройства"
                ),
            }
        )

    if messengers:
        facts.append(
            {
                "fact_type": "messengers",
                "severity": "info",
                "summary": "Активность мессенджеров",
                "details": ", ".join(f"{m.get('app_name')} ({m.get('events')})" for m in messengers[:5]),
            }
        )

    return facts


def _topic_interpretation(topic: str, events: int, bytes_total: int, domains_counter: Counter) -> str:
    top_domains = [d for d, _ in domains_counter.most_common(3)]
    domain_text = ", ".join(top_domains) if top_domains else "нет выраженных доменов"
    if topic == "прочее":
        return (
            f"Смешанная техническая/служебная активность: {events} событий, "
            f"{_fmt_bytes(bytes_total)}. Требуется доразметка доменов (примеры: {domain_text})."
        )
    if topic == "аналитика и реклама":
        return f"Преобладает телеметрия и рекламные SDK; ключевые домены: {domain_text}."
    if topic == "поиск и браузинг":
        return f"Фоновая и пользовательская веб-активность; ключевые домены: {domain_text}."
    if topic == "социальные сети":
        return f"Социальные платформы и связанный контент; ключевые домены: {domain_text}."
    if topic == "мессенджеры и коммуникации":
        return f"Коммуникационные сервисы; ключевые домены: {domain_text}."
    if topic == "альтернативный доступ/VPN":
        return f"Есть признаки обходного канала/туннелирования; ключевые домены: {domain_text}."
    return f"Профиль активности по теме '{topic}'; ключевые домены: {domain_text}."


def _topic_for_event(event: EnrichedEvent) -> str:
    category = (event.domain_category or ("cdn" if event.is_cloud else "unknown")).lower()
    return CATEGORY_TO_TOPIC.get(category, CATEGORY_TO_TOPIC.get("other", "прочее"))


def _fmt_bytes(value: Any) -> str:
    try:
        num = float(value or 0)
    except (TypeError, ValueError):
        num = 0.0
    units = ["B", "KB", "MB", "GB", "TB"]
    idx = 0
    while num >= 1024 and idx < len(units) - 1:
        num /= 1024.0
        idx += 1
    if idx == 0:
        return f"{int(num)} {units[idx]}"
    return f"{num:.2f} {units[idx]}"
