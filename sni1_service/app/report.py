from __future__ import annotations

from collections import Counter, defaultdict
from datetime import datetime
from typing import Any


def build_markdown_report(analytics: dict, title: str | None = None) -> str:
    overview = analytics.get("overview", {}) or {}
    topics = analytics.get("topics", []) or []
    messengers = analytics.get("messengers", []) or []
    gaps = analytics.get("gaps", []) or []
    alt_access = analytics.get("alt_access", []) or []
    vpn_hits = analytics.get("vpn_detector_hits", []) or []

    events_total = int(overview.get("events_total", 0) or 0)
    vpn_detected = int(overview.get("vpn_detected_count", 0) or 0)
    vpn_likely = int(overview.get("vpn_likely_count", 0) or 0)
    vpn_suspicious = int(overview.get("vpn_suspicious_count", 0) or 0)
    alt_dns_events = _count_alt_dns_events(alt_access)

    lines: list[str] = [f"# {title or 'Отчет по SNI-трафику'}", ""]

    lines.append("## 1. Параметры данных")
    lines.append(f"- Устройство: `{overview.get('device_id') or '-'}`")
    lines.append(f"- Период: {_fmt_ts(overview.get('period_start'))} — {_fmt_ts(overview.get('period_end'))}")
    lines.append(f"- Общий объем: {_fmt_bytes(overview.get('bytes_total', 0))}")
    lines.append("")

    lines.append("## 2. Основные выводы")
    lines.append(
        f"- VPN: {'использовался' if (vpn_detected + vpn_likely + vpn_suspicious) > 0 else 'не выявлен'} "
        f"(VPN_DETECTED: {vpn_detected} событий; вероятностные признаки: {vpn_likely + vpn_suspicious} событий)."
    )
    vpn_ips, vpn_sni = _top_vpn_indicators(vpn_hits)
    if vpn_ips or vpn_sni:
        lines.append(
            f"  - Основные индикаторы VPN: IP={vpn_ips[0] if vpn_ips else '-'}; SNI={vpn_sni[0] if vpn_sni else '-'}."
        )
    lines.append(
        f"- Альтернативные DNS: {'использовались' if alt_dns_events > 0 else 'не выявлены'} "
        f"({alt_dns_events} событий)."
    )
    alt_ips, alt_sni = _top_alt_dns_indicators(alt_access)
    if alt_ips or alt_sni:
        lines.append(
            f"  - Основные индикаторы альтернативного DNS: IP={alt_ips[0] if alt_ips else '-'}; SNI={alt_sni[0] if alt_sni else '-'}."
        )
    lines.append(
        f"- Мессенджеры: {'выявлены' if len(messengers) > 0 else 'не выявлены'} "
        f"({sum(int(m.get('events', 0) or 0) for m in messengers)} событий)."
    )
    lines.append("")

    lines.append("## 3. Сферы интереса по ресурсам")
    filtered_topics = _filter_interest_topics(topics)
    if filtered_topics:
        for row in filtered_topics[:10]:
            lines.append(f"- {row.get('topic')}: {_pct(row.get('events', 0), events_total)}% фактов")
    else:
        lines.append("- Недостаточно данных для выделения тематик без служебных/неопределенных категорий.")
    lines.append("")

    lines.append("## 4. Мессенджеры")
    if messengers:
        for row in messengers:
            lines.append(f"- {row.get('app_name')}: уверенность — {row.get('status')}")
    else:
        lines.append("- Мессенджеры не выявлены.")
    lines.append("")

    lines.append("## 5. Паузы в трафике")
    regular, irregular = _aggregate_gaps(gaps)
    nightly = _night_pause_summary(gaps)
    if nightly:
        lines.append(f"- Регулярные ночные периоды в районе БС: {nightly}")
    elif regular:
        top = regular[0]
        lines.append(
            f"- Регулярные периоды: {top['period']} ({top['count']} пауз); "
            f"частые БС до: {top['prev_bs']}; после: {top['next_bs']}"
        )
    else:
        lines.append("- Регулярные периоды пауз не выявлены.")

    if irregular:
        lines.append("- Значительные паузы вне регулярных периодов:")
        for row in irregular:
            prev_loc = row.get("previous_cell_address")
            next_loc = row.get("next_cell_address")
            if not prev_loc or not next_loc:
                continue
            movement = _movement_note(str(prev_loc), str(next_loc))
            lines.append(
                f"  - {_fmt_ts(row.get('gap_start'))} — {_fmt_ts(row.get('gap_end'))} "
                f"({row.get('duration_minutes')} мин); "
                f"до: {prev_loc}; после: {next_loc}; {movement}"
            )
    else:
        lines.append("- Значительные нерегулярные паузы не выявлены.")

    return "\n".join(lines).strip() + "\n"


def _filter_interest_topics(topics: list[dict[str, Any]]) -> list[dict[str, Any]]:
    deny = {
        "unknown",
        "неизвестно",
        "прочее",
        "служебный фоновый трафик",
        "альтернативный доступ/vpn",
        "vpn",
    }
    rows = []
    for row in topics:
        topic = str(row.get("topic") or "").strip().lower()
        if topic in deny:
            continue
        rows.append(row)
    rows.sort(key=lambda r: int(r.get("events", 0) or 0), reverse=True)
    return rows


def _aggregate_gaps(gaps: list[dict[str, Any]]) -> tuple[list[dict[str, Any]], list[dict[str, Any]]]:
    if not gaps:
        return [], []

    groups: dict[tuple[int, int], list[dict[str, Any]]] = defaultdict(list)
    for row in gaps:
        start = _to_dt(row.get("gap_start"))
        end = _to_dt(row.get("gap_end"))
        if start is None or end is None:
            continue
        groups[(start.hour, end.hour)].append(row)

    regular: list[dict[str, Any]] = []
    regular_keys: set[tuple[int, int]] = set()
    for key, rows in groups.items():
        if len(rows) < 2:
            continue
        regular_keys.add(key)
        prev_counter = Counter(
            str(r.get("previous_cell_address") or r.get("previous_domain") or "-")
            for r in rows
        )
        next_counter = Counter(
            str(r.get("next_cell_address") or r.get("next_domain") or "-")
            for r in rows
        )
        regular.append(
            {
                "period": f"{key[0]:02d}:00–{key[1]:02d}:00",
                "count": len(rows),
                "prev_bs": ", ".join(v for v, _ in prev_counter.most_common(3)),
                "next_bs": ", ".join(v for v, _ in next_counter.most_common(3)),
            }
        )
    regular.sort(key=lambda x: x["count"], reverse=True)

    irregular = []
    for row in gaps:
        start = _to_dt(row.get("gap_start"))
        end = _to_dt(row.get("gap_end"))
        if start is None or end is None:
            continue
        if (start.hour, end.hour) in regular_keys:
            continue
        irregular.append(row)
    irregular.sort(key=lambda r: float(r.get("duration_minutes", 0) or 0), reverse=True)
    return regular, irregular[:15]


def _top_vpn_indicators(vpn_hits: list[dict[str, Any]]) -> tuple[list[str], list[str]]:
    ip_counts: Counter[str] = Counter()
    sni_counts: Counter[str] = Counter()
    for row in vpn_hits:
        verdict = str(row.get("vpn_verdict") or "")
        if verdict not in {"VPN_DETECTED", "VPN_SUSPICIOUS", "VPN_LIKELY"}:
            continue
        ip = str(row.get("dst_ip") or "").strip()
        sni = str(row.get("sni") or "").strip()
        if ip:
            ip_counts[ip] += 1
        if sni:
            sni_counts[sni] += 1
    return [k for k, _ in ip_counts.most_common(5)], [k for k, _ in sni_counts.most_common(5)]


def _top_alt_dns_indicators(alt_access: list[dict[str, Any]]) -> tuple[list[str], list[str]]:
    ip_counts: Counter[str] = Counter()
    sni_counts: Counter[str] = Counter()
    for row in alt_access:
        ip = str(row.get("dst_ip") or "").strip()
        sni = str(row.get("sni") or "").strip()
        if ip:
            ip_counts[ip] += 1
        if sni:
            sni_counts[sni] += 1
    return [k for k, _ in ip_counts.most_common(5)], [k for k, _ in sni_counts.most_common(5)]


def _extract_city(address: str) -> str:
    parts = [p.strip() for p in address.split(",")]
    for p in parts:
        if p.startswith("г "):
            return p
    return ""


def _movement_note(prev_addr: str, next_addr: str) -> str:
    prev_city = _extract_city(prev_addr)
    next_city = _extract_city(next_addr)
    if prev_city and next_city:
        if prev_city == next_city:
            return "локация без смены города"
        return f"смена города: {prev_city} -> {next_city}"
    if prev_addr == next_addr:
        return "локация стабильна"
    return "локация изменена"


def _night_pause_summary(gaps: list[dict[str, Any]]) -> str:
    night_rows = []
    for row in gaps:
        start = _to_dt(row.get("gap_start"))
        end = _to_dt(row.get("gap_end"))
        if start is None or end is None:
            continue
        if start.hour >= 20 and end.hour <= 10:
            night_rows.append(row)
    if len(night_rows) < 2:
        return ""
    loc_counter: Counter[str] = Counter()
    for row in night_rows:
        for k in ("previous_cell_address", "next_cell_address"):
            val = str(row.get(k) or "").strip()
            if val:
                loc_counter[val] += 1
    top_loc = loc_counter.most_common(1)
    if not top_loc:
        return f"повторяются в {len(night_rows)} случаях."
    return f"{top_loc[0][0]} (повторяется в {len(night_rows)} случаях)."


def _fmt_ts(value: Any) -> str:
    raw = str(value or "").strip()
    if not raw:
        return "-"
    for fmt in ("%Y-%m-%dT%H:%M:%S", "%Y-%m-%d %H:%M:%S"):
        try:
            return datetime.strptime(raw[:19], fmt).strftime("%d.%m.%Y %H:%M:%S")
        except ValueError:
            continue
    return raw


def _to_dt(value: Any) -> datetime | None:
    raw = str(value or "").strip()
    if not raw:
        return None
    for fmt in ("%Y-%m-%dT%H:%M:%S", "%Y-%m-%d %H:%M:%S"):
        try:
            return datetime.strptime(raw[:19], fmt)
        except ValueError:
            continue
    return None


def _fmt_bytes(value: Any) -> str:
    try:
        num = float(value or 0)
    except (TypeError, ValueError):
        num = 0.0
    if num >= 1024**3:
        return f"{num / (1024**3):.2f} GB"
    return f"{num / (1024**2):.2f} MB"


def _pct(part: Any, total: Any) -> str:
    try:
        p = float(part or 0)
        t = float(total or 0)
        if t <= 0:
            return "0.00"
        return f"{(p * 100.0 / t):.2f}"
    except (TypeError, ValueError):
        return "0.00"


def _count_alt_dns_events(rows: list[dict[str, Any]]) -> int:
    total = 0
    for row in rows:
        methods = row.get("methods", [])
        if isinstance(methods, list) and (
            "ALT_DNS_GATEWAY_PATTERN" in methods or "ALT_DNS_GATEWAY" in methods
        ):
            total += 1
    return total
