from __future__ import annotations

import csv
import io
import os
import re
import zipfile
from collections import Counter, defaultdict
from dataclasses import dataclass
from datetime import datetime
from pathlib import Path
from typing import Dict, Iterable, Iterator, List, Optional, Tuple
from urllib.parse import urlparse

from fastapi import FastAPI, HTTPException
from pydantic import BaseModel, Field

try:
    from vpn_detector import ReferenceData, VPNDetector  # type: ignore
except Exception:
    ReferenceData = None  # type: ignore
    VPNDetector = None  # type: ignore


TIMESTAMP_FORMATS = (
    "%d.%m.%Y %H:%M:%S",
    "%d.%m.%Y %H:%M",
    "%Y-%m-%d %H:%M:%S",
    "%Y-%m-%d %H:%M",
    "%d/%m/%Y %H:%M:%S",
    "%d/%m/%Y %H:%M",
)

MAX_CHRONOLOGY_ROWS = int(os.getenv("SNI_MAX_CHRONOLOGY_ROWS", "20000"))
DEFAULT_TOP_N = int(os.getenv("SNI_DEFAULT_TOP_N", "25"))
MAX_INPUT_ROWS = int(os.getenv("SNI_MAX_INPUT_ROWS", "2500000"))
SNI_REFS_DIR = os.getenv("SNI_REFS_DIR", "/app/data/sni/current")

_VPN_REFS_CACHE = None


def _normalize_header(value: str) -> str:
    return re.sub(r"[^0-9a-zа-я]+", "", (value or "").strip().lower())


def _extract_host(value: str) -> str:
    raw = (value or "").strip()
    if not raw:
        return ""
    if "://" in raw:
        parsed = urlparse(raw)
        if parsed.hostname:
            return parsed.hostname.lower()
    # raw domain or host:port
    host = raw.split("/")[0].split(":")[0].strip().lower()
    return host


def _parse_datetime(value: str) -> Optional[datetime]:
    raw = (value or "").strip()
    if not raw:
        return None
    for fmt in TIMESTAMP_FORMATS:
        try:
            return datetime.strptime(raw, fmt)
        except ValueError:
            continue
    return None


def _coerce_int(value: str) -> Optional[int]:
    if value is None:
        return None
    digits = re.sub(r"[^\d]", "", str(value))
    if not digits:
        return None
    try:
        return int(digits)
    except ValueError:
        return None


def _parse_size(value: str) -> int:
    if value is None:
        return 0
    text = str(value).strip().lower().replace(",", ".")
    if not text:
        return 0
    mult = 1
    if "kb" in text or "кб" in text:
        mult = 1024
    elif "mb" in text or "мб" in text:
        mult = 1024 * 1024
    elif "gb" in text or "гб" in text:
        mult = 1024 * 1024 * 1024
    num_match = re.search(r"[-+]?\d*\.?\d+", text)
    if not num_match:
        return 0
    try:
        return int(float(num_match.group(0)) * mult)
    except ValueError:
        return 0


def _category_for(host: str, ip: str, port: Optional[int], app_hint: str) -> str:
    hay = " ".join([host or "", ip or "", app_hint or ""]).lower()
    if any(k in hay for k in ("telegram", "t.me", "whatsapp", "viber", "signal", "discord", "skype", "imo", "wechat")):
        return "messenger"
    if any(k in hay for k in ("vpn", "wireguard", "openvpn", "nordvpn", "protonvpn", "surfshark", "outline", "ipsec")):
        return "vpn"
    if port in {500, 4500, 1194, 1701, 1723, 51820}:
        return "vpn"
    if any(k in hay for k in ("youtube", "rutube", "netflix", "ivi", "twitch", "vkvideo", "kinopoisk")):
        return "video"
    if any(k in hay for k in ("googlevideo", "cdn", "akamai", "cloudfront", "fastly", "cdn77")):
        return "cdn"
    if any(k in hay for k in ("yandex", "google", "bing", "duckduckgo", "mail.ru")):
        return "search"
    if any(k in hay for k in ("github", "gitlab", "bitbucket", "stackoverflow", "docker", "pypi", "npm")):
        return "dev"
    if any(k in hay for k in ("bank", "tinkoff", "sber", "vtb", "alfabank", "qiwi", "yoomoney")):
        return "finance"
    if any(k in hay for k in ("avito", "ozon", "wildberries", "aliexpress", "market", "shop")):
        return "shopping"
    if any(k in hay for k in ("vk.com", "ok.ru", "facebook", "instagram", "twitter", "x.com")):
        return "social"
    return "other"


@dataclass
class TrafficEvent:
    ts: datetime
    end_ts: Optional[datetime]
    host: str
    host_candidates: List[str]
    ip: str
    port: Optional[int]
    protocol: str
    app_hint: str
    bytes_total: int
    duration_sec: int
    category: str


def _header_aliases() -> Dict[str, Tuple[str, ...]]:
    return {
        "ts": (
            "время",
            "времяначаласоединения",
            "времясессии",
            "времяопределенияместоположения",
            "датаивремя",
            "datetime",
            "timestamp",
        ),
        "end_ts": (
            "времязавершениясоединения",
            "времяокончаниясоединения",
            "sessionend",
            "endtime",
        ),
        "host": (
            "sni",
            "sslsni",
            "ssl sni",
            "ssl_sni",
            "домен",
            "host",
            "хост",
            "url",
            "сайт",
            "адресресурса",
            "fqdn",
        ),
        "ip": (
            "ip",
            "ipадрес",
            "ipадресабонента",
            "ipaddress",
            "remoteip",
            "dstip",
            "serverip",
            "ipадреспортсервера",
        ),
        "port": ("порт", "port", "dstport", "serverport"),
        "server_endpoint": ("ipадреспортсервера", "serverendpoint", "ipадрес/портсервера"),
        "client_endpoint": ("ipадреспортклиента", "clientendpoint", "ipадрес/портклиента"),
        "protocol": ("протокол", "protocol", "transport"),
        "app_protocol": ("прикладнойпротокол", "rfc1700"),
        "app_hint": ("сервис", "приложение", "application", "app", "категория"),
        "bytes": ("байт", "bytes", "объем", "трафик", "size"),
        "bytes_rx": ("принятоданныхбайт", "rxbytes", "bytesreceived"),
        "bytes_tx": ("переданоданныхбайт", "txbytes", "bytessent"),
    }


def _resolve_column_map(fieldnames: List[str]) -> Dict[str, str]:
    normalized = {_normalize_header(name): name for name in fieldnames}
    mapping: Dict[str, str] = {}
    for target, aliases in _header_aliases().items():
        for alias in aliases:
            if alias in normalized:
                mapping[target] = normalized[alias]
                break
    return mapping


def _iter_csv_rows_from_file(path: Path) -> Iterator[Dict[str, str]]:
    for encoding in ("utf-8-sig", "cp1251", "latin-1"):
        try:
            with path.open("r", encoding=encoding, newline="") as fh:
                reader = csv.DictReader(fh, delimiter=";", quotechar='"')
                for row in reader:
                    yield row
            return
        except UnicodeDecodeError:
            continue
    raise ValueError(f"Unable to decode CSV file: {path}")


def _iter_csv_rows_from_zip(path: Path) -> Iterator[Dict[str, str]]:
    with zipfile.ZipFile(path, "r") as zf:
        entries = [name for name in zf.namelist() if name.lower().endswith(".csv")]
        if not entries:
            raise ValueError("ZIP archive does not contain CSV files")
        for entry in entries:
            with zf.open(entry, "r") as raw:
                data = raw.read()
                decoded = None
                for encoding in ("utf-8-sig", "cp1251", "latin-1"):
                    try:
                        decoded = data.decode(encoding)
                        break
                    except UnicodeDecodeError:
                        continue
                if decoded is None:
                    raise ValueError(f"Unable to decode CSV entry in ZIP: {entry}")
                text_io = io.StringIO(decoded)
                reader = csv.DictReader(text_io, delimiter=";", quotechar='"')
                for row in reader:
                    yield row


def _parse_endpoint(endpoint: str) -> Tuple[str, Optional[int]]:
    raw = (endpoint or "").strip()
    if not raw:
        return "", None
    if "/" in raw:
        left, right = raw.split("/", 1)
        left = left.strip()
        right = right.strip()
        if right.isdigit():
            return left, int(right)
        raw = left
    parts = raw.rsplit(":", 1)
    if len(parts) == 2 and parts[1].isdigit():
        return parts[0].strip(), int(parts[1])
    return raw.strip(), None


def _extract_sni_hosts(value: str) -> List[str]:
    raw = (value or "").strip()
    if not raw:
        return []
    items = [item.strip() for item in raw.split(",") if item.strip()]
    hosts: List[str] = []
    for item in items:
        host = _extract_host(item)
        if host:
            hosts.append(host)
    unique_hosts = list(dict.fromkeys(hosts))
    return unique_hosts


def _collect_events(input_path: Path) -> Tuple[List[TrafficEvent], Dict[str, int], Dict[str, str]]:
    if not input_path.exists():
        raise ValueError(f"Input file does not exist: {input_path}")
    if input_path.suffix.lower() not in {".csv", ".zip"}:
        raise ValueError("Supported input types: .csv, .zip")

    row_iter = _iter_csv_rows_from_file(input_path) if input_path.suffix.lower() == ".csv" else _iter_csv_rows_from_zip(input_path)

    events: List[TrafficEvent] = []
    stats = {
        "rows_total": 0,
        "rows_parsed": 0,
        "rows_skipped_no_time": 0,
        "rows_skipped_empty": 0,
        "rows_limited": 0,
    }
    resolved_columns: Dict[str, str] = {}
    column_map: Optional[Dict[str, str]] = None

    for row in row_iter:
        stats["rows_total"] += 1
        if stats["rows_total"] > MAX_INPUT_ROWS:
            stats["rows_limited"] += 1
            continue
        if column_map is None:
            fieldnames = list(row.keys())
            column_map = _resolve_column_map(fieldnames)
            resolved_columns = dict(column_map)

        def _val(key: str) -> str:
            if not column_map:
                return ""
            source = column_map.get(key)
            if not source:
                return ""
            return str(row.get(source) or "").strip()

        ts = _parse_datetime(_val("ts"))
        if ts is None:
            stats["rows_skipped_no_time"] += 1
            continue

        end_ts = _parse_datetime(_val("end_ts"))
        host_candidates = _extract_sni_hosts(_val("host"))

        server_ip = _val("ip")
        server_port = _coerce_int(_val("port"))
        endpoint_ip, endpoint_port = _parse_endpoint(_val("server_endpoint"))
        if not server_ip and endpoint_ip:
            server_ip = endpoint_ip
        if server_port is None and endpoint_port is not None:
            server_port = endpoint_port

        host = host_candidates[0] if host_candidates else _extract_host(server_ip)
        app_protocol = _val("app_protocol")
        protocol = _val("protocol") or app_protocol
        app_hint = " ".join(part for part in (app_protocol, _val("app_hint")) if part).strip()
        bytes_total = _parse_size(_val("bytes"))
        if bytes_total <= 0:
            bytes_total = _parse_size(_val("bytes_rx")) + _parse_size(_val("bytes_tx"))
        duration_sec = max(0, int((end_ts - ts).total_seconds())) if end_ts and end_ts >= ts else 0

        if not any((host, server_ip, protocol, app_hint, bytes_total)):
            stats["rows_skipped_empty"] += 1
            continue

        events.append(
            TrafficEvent(
                ts=ts,
                end_ts=end_ts,
                host=host,
                host_candidates=host_candidates,
                ip=server_ip,
                port=server_port,
                protocol=protocol,
                app_hint=app_hint,
                bytes_total=bytes_total,
                duration_sec=duration_sec,
                category=_category_for(host, server_ip, server_port, app_hint),
            )
        )
        stats["rows_parsed"] += 1

    events.sort(key=lambda x: x.ts)
    return events, stats, resolved_columns


def _parse_device_id_from_filename(name: str) -> str:
    tokens = [token.strip() for token in re.split(r"[,;]", name) if token.strip()]
    for token in tokens:
        digits = re.sub(r"[^\d]", "", token)
        if 10 <= len(digits) <= 16:
            return digits
    fallback = re.findall(r"\d{10,16}", name)
    return fallback[0] if fallback else "unknown"


def _format_bytes(size: int) -> str:
    value = float(max(0, int(size or 0)))
    units = ["B", "KB", "MB", "GB", "TB"]
    idx = 0
    while value >= 1024 and idx < len(units) - 1:
        value /= 1024.0
        idx += 1
    if idx == 0:
        return f"{int(value)} {units[idx]}"
    return f"{value:.2f} {units[idx]}"


def _median(values: List[int]) -> float:
    if not values:
        return 0.0
    ordered = sorted(values)
    mid = len(ordered) // 2
    if len(ordered) % 2:
        return float(ordered[mid])
    return (ordered[mid - 1] + ordered[mid]) / 2.0


def _event_host(event: TrafficEvent) -> str:
    if event.host_candidates:
        return event.host_candidates[0]
    if event.host:
        return event.host
    if event.ip:
        return event.ip
    return "-"


def _build_vpn_config_from_env() -> Dict[str, str]:
    refs_dir = Path(SNI_REFS_DIR)
    return {
        "vpn_ja3_signatures": str(refs_dir / "vpn_ja3_signatures.csv"),
        "ja3_app_db_full": str(refs_dir / "ja3_app_db_full.csv"),
        "vpn_infra_ioc": str(refs_dir / "vpn_infra_ioc.csv"),
        "vpn_infra_ioc_full": str(refs_dir / "vpn_infra_ioc_full.csv"),
        "expected_asn_map": str(refs_dir / "expected_asn_map.json"),
        "expected_asn_map_full": str(refs_dir / "expected_asn_map_full.csv"),
        "cloud_prefixes": str(refs_dir / "cloud_prefixes.json"),
        "cloud_prefixes_full": str(refs_dir / "cloud_prefixes_full.json"),
        "asn_db": str(refs_dir / "asn_db.csv"),
        "public_suffix_list": str(refs_dir / "public_suffix_list.dat"),
        "known_messaging_domains": str(refs_dir / "known_messaging_domains.csv"),
        "top_1m": str(refs_dir / "top-1m.csv"),
        "vpn_custom_pairs": str(refs_dir / "vpn_custom_pairs.csv"),
        "alt_dns_ioc": str(refs_dir / "alt_dns_ioc.csv"),
    }


def _get_vpn_refs() -> Optional["ReferenceData"]:
    global _VPN_REFS_CACHE
    if ReferenceData is None:
        return None
    if _VPN_REFS_CACHE is not None:
        return _VPN_REFS_CACHE
    try:
        cfg = _build_vpn_config_from_env()
        refs = ReferenceData(cfg)
        refs.load()
        _VPN_REFS_CACHE = refs
    except Exception:
        _VPN_REFS_CACHE = None
    return _VPN_REFS_CACHE


class AnalyzeRequest(BaseModel):
    input_path: str = Field(..., description="Absolute path to CSV or ZIP file")
    device_id: Optional[str] = None
    top_n: int = Field(default=DEFAULT_TOP_N, ge=5, le=200)
    gap_minutes: int = Field(default=180, ge=10, le=1440)


class AnalyzeResponse(BaseModel):
    document_title: str
    document_markdown: str
    console_data: Dict[str, object]
    stats: Dict[str, object]


app = FastAPI(title="Nodex SNI service", version="0.1.0")


@app.get("/health")
def health() -> Dict[str, str]:
    return {"status": "ok"}


@app.post("/analyze", response_model=AnalyzeResponse)
def analyze(payload: AnalyzeRequest) -> AnalyzeResponse:
    input_path = Path(payload.input_path)
    try:
        events, parse_stats, resolved_columns = _collect_events(input_path)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Failed to process file: {exc}") from exc

    if not events:
        raise HTTPException(status_code=400, detail="No valid traffic events were parsed from input data")

    device_id = (payload.device_id or "").strip() or _parse_device_id_from_filename(input_path.name)
    period_start = events[0].ts
    period_end = events[-1].ts

    domain_counter = Counter()
    for event in events:
        if event.host_candidates:
            for host in event.host_candidates:
                domain_counter[host] += 1
        elif event.host:
            domain_counter[event.host] += 1
    ip_counter = Counter(event.ip for event in events if event.ip)
    category_counter = Counter(event.category for event in events)
    hourly_counter = Counter(event.ts.strftime("%H:00") for event in events)
    daily_counter = Counter(event.ts.strftime("%Y-%m-%d") for event in events)
    protocol_counter = Counter((event.protocol or "-").upper() for event in events)
    topic_counter = Counter()
    for event in events:
        topic = "прочее"
        host_text = " ".join(event.host_candidates or ([event.host] if event.host else []))
        combined = f"{host_text} {event.app_hint}".lower()
        if any(x in combined for x in ("news", "ria", "tass", "lenta", "meduza")):
            topic = "новости"
        elif any(x in combined for x in ("shop", "market", "avito", "ozon", "wildberries")):
            topic = "покупки"
        elif any(x in combined for x in ("bank", "финанс", "tinkoff", "sber", "vtb")):
            topic = "финансы"
        elif any(x in combined for x in ("telegram", "whatsapp", "signal", "viber", "discord")):
            topic = "мессенджеры"
        elif any(x in combined for x in ("youtube", "rutube", "kinopoisk", "netflix", "twitch")):
            topic = "медиа"
        elif any(x in combined for x in ("github", "gitlab", "stackoverflow", "docker")):
            topic = "разработка"
        topic_counter[topic] += 1

    vpn_verdict_counter = Counter()
    vpn_evidence_counter = Counter()
    detector_summary: Dict[str, object] = {}
    detector_event_meta: List[Dict[str, object]] = []
    refs = _get_vpn_refs()
    if refs is not None and VPNDetector is not None:
        try:
            detector = VPNDetector(refs, debug=False)
            for event in events:
                scored = detector.score_event(
                    {
                        "timestamp": event.ts.strftime("%Y-%m-%d %H:%M:%S"),
                        "dst_ip": event.ip,
                        "sni": _event_host(event),
                        "protocol": event.protocol,
                        "duration_sec": event.duration_sec,
                    }
                )
                verdict = str(scored.get("vpn_verdict") or "CLEAN")
                score = int(scored.get("vpn_score") or 0)
                vpn_verdict_counter[verdict] += 1
                detector_event_meta.append(
                    {
                        "verdict": verdict,
                        "score": score,
                        "evidence": list(scored.get("vpn_evidence", []) or []),
                    }
                )
                for item in scored.get("vpn_evidence", []) or []:
                    if isinstance(item, str) and ":" in item:
                        method = item.split(":", 1)[0].strip()
                        if method:
                            vpn_evidence_counter[method] += 1
            detector_summary = detector.summary()
        except Exception:
            vpn_verdict_counter = Counter()
            vpn_evidence_counter = Counter()
            detector_summary = {}
            detector_event_meta = []

    gaps: List[Dict[str, object]] = []
    for prev, nxt in zip(events, events[1:]):
        gap_minutes = (nxt.ts - prev.ts).total_seconds() / 60.0
        if gap_minutes >= payload.gap_minutes:
            gaps.append(
                {
                    "from": prev.ts.strftime("%d.%m.%Y %H:%M:%S"),
                    "to": nxt.ts.strftime("%d.%m.%Y %H:%M:%S"),
                    "duration_min": int(gap_minutes),
                }
            )

    messenger_rows = []
    vpn_rows = []
    vpn_detector_hits_rows = []
    chronology_rows = []
    for idx, event in enumerate(events[:MAX_CHRONOLOGY_ROWS]):
        meta = detector_event_meta[idx] if idx < len(detector_event_meta) else {}
        row = {
            "time": event.ts.strftime("%d.%m.%Y %H:%M:%S"),
            "time_end": event.end_ts.strftime("%d.%m.%Y %H:%M:%S") if event.end_ts else "",
            "host": event.host or "",
            "sni_hosts": ", ".join(event.host_candidates) if event.host_candidates else "",
            "ip": event.ip or "",
            "port": event.port if event.port is not None else "",
            "protocol": event.protocol or "",
            "category": event.category,
            "bytes": event.bytes_total,
            "duration_sec": event.duration_sec,
            "app_hint": event.app_hint,
            "vpn_verdict": str(meta.get("verdict") or "CLEAN"),
            "vpn_score": int(meta.get("score") or 0),
            "vpn_evidence": "; ".join(str(x) for x in (meta.get("evidence") or [])),
        }
        chronology_rows.append(row)
        if event.category == "messenger":
            messenger_rows.append(row)
        if row["vpn_verdict"] in {"VPN_DETECTED", "VPN_LIKELY", "VPN_SUSPICIOUS"}:
            vpn_rows.append(row)
            vpn_detector_hits_rows.append(
                {
                    "time": row["time"],
                    "host": row["host"] or row["sni_hosts"] or "-",
                    "ip": row["ip"],
                    "verdict": row["vpn_verdict"],
                    "score": row["vpn_score"],
                    "evidence": row["vpn_evidence"],
                }
            )

    top_domains_rows = [
        {"domain": domain, "events": count}
        for domain, count in domain_counter.most_common(payload.top_n)
    ]
    top_ips_rows = [
        {"ip": ip, "events": count}
        for ip, count in ip_counter.most_common(payload.top_n)
    ]
    category_rows = [
        {"category": category, "events": count}
        for category, count in category_counter.most_common()
    ]
    protocol_rows = [
        {"protocol": protocol, "events": count}
        for protocol, count in protocol_counter.most_common()
    ]
    topic_rows = [
        {"topic": topic, "events": count}
        for topic, count in topic_counter.most_common()
    ]
    hour_rows = [
        {"hour": hour, "events": count}
        for hour, count in hourly_counter.most_common(24)
    ]
    day_rows = [
        {"day": day, "events": count}
        for day, count in daily_counter.most_common(payload.top_n)
    ]

    busiest_hour = hour_rows[0]["hour"] if hour_rows else "-"
    busiest_day = day_rows[0]["day"] if day_rows else "-"
    vpn_detected = vpn_verdict_counter.get("VPN_DETECTED", 0)
    vpn_likely = vpn_verdict_counter.get("VPN_LIKELY", 0)
    vpn_suspicious = vpn_verdict_counter.get("VPN_SUSPICIOUS", 0)
    vpn_total_flagged = vpn_detected + vpn_likely + vpn_suspicious
    dominant_vpn_signal = vpn_evidence_counter.most_common(1)[0][0] if vpn_evidence_counter else "-"
    alt_dns_hits = vpn_evidence_counter.get("ALT_DNS_GATEWAY", 0)
    top_vpn_providers = detector_summary.get("top_vpn_providers", []) if isinstance(detector_summary, dict) else []
    top_mismatch_domains = detector_summary.get("top_asn_mismatch_domains", []) if isinstance(detector_summary, dict) else []
    top_detector_methods = detector_summary.get("method_effectiveness", []) if isinstance(detector_summary, dict) else []

    report_title = f"SNI traffic report: {device_id}"
    markdown = "\n".join(
        [
            f"# {report_title}",
            "",
            f"- Период анализа: {period_start.strftime('%d.%m.%Y %H:%M:%S')} — {period_end.strftime('%d.%m.%Y %H:%M:%S')}",
            f"- Источник: `{input_path.name}`",
            f"- Обработано событий: {len(events)}",
            f"- Уникальных доменов: {len(domain_counter)}",
            f"- Уникальных IP: {len(ip_counter)}",
            "",
            "## Ключевые выводы",
            f"- Наиболее активный час: {busiest_hour}",
            f"- Наиболее активный день: {busiest_day}",
            f"- События мессенджеров: {category_counter.get('messenger', 0)}",
            f"- Признаки VPN (детектор): detected={vpn_detected}, likely={vpn_likely}, suspicious={vpn_suspicious}, всего={vpn_total_flagged}",
            f"- Доминирующий VPN-сигнал: {dominant_vpn_signal}",
            f"- Сигналы альтернативного DNS: {alt_dns_hits}",
            f"- Доминирующий протокол: {(protocol_rows[0]['protocol'] if protocol_rows else '-')}",
            f"- Периоды без трафика (>{payload.gap_minutes} мин): {len(gaps)}",
            "",
            "## Топ доменов",
            *[f"- {item['domain']}: {item['events']}" for item in top_domains_rows[:10]],
            "",
            "## Тематические направления",
            *[f"- {item['topic']}: {item['events']}" for item in topic_rows[:8]],
            "",
            "## VPN-детектор (подробно)",
            *(
                [f"- Провайдер: {name} — событий: {count}" for name, count in list(top_vpn_providers)[:10]]
                if top_vpn_providers
                else ["- Совпадений по VPN-infra не выявлено."]
            ),
            *(
                [f"- ASN mismatch: {name} — событий: {count}" for name, count in list(top_mismatch_domains)[:10]]
                if top_mismatch_domains
                else ["- ASN-mismatch срабатываний не выявлено."]
            ),
            *(
                [f"- Метод: {name} — вклад: {count}" for name, count in list(top_detector_methods)[:10]]
                if top_detector_methods
                else ["- Срабатываний детектора не выявлено."]
            ),
            "",
            "## Возможные признаки использования альтернативного доступа",
            *(
                [f"- {gap['from']} -> {gap['to']} ({gap['duration_min']} мин)" for gap in gaps[:20]]
                if gaps
                else ["- Длительных перерывов не выявлено."]
            ),
        ]
    )

    overview_rows = [
        {"metric": "device_id", "value": device_id},
        {"metric": "source_file", "value": input_path.name},
        {"metric": "period_start", "value": period_start.strftime("%d.%m.%Y %H:%M:%S")},
        {"metric": "period_end", "value": period_end.strftime("%d.%m.%Y %H:%M:%S")},
        {"metric": "events_total", "value": len(events)},
        {"metric": "domains_unique", "value": len(domain_counter)},
        {"metric": "ips_unique", "value": len(ip_counter)},
        {"metric": "messenger_events", "value": category_counter.get("messenger", 0)},
        {"metric": "vpn_detected", "value": vpn_detected},
        {"metric": "vpn_likely", "value": vpn_likely},
        {"metric": "vpn_suspicious", "value": vpn_suspicious},
        {"metric": "alt_dns_hits", "value": alt_dns_hits},
        {"metric": "protocol_top", "value": protocol_rows[0]["protocol"] if protocol_rows else "-"},
    ]

    tabs = [
        {"id": "overview", "name": "Сводка", "columns": ["metric", "value"], "rows": overview_rows, "row_count": len(overview_rows)},
        {"id": "top_domains", "name": "Топ домены", "columns": ["domain", "events"], "rows": top_domains_rows, "row_count": len(top_domains_rows)},
        {"id": "top_ips", "name": "Топ IP", "columns": ["ip", "events"], "rows": top_ips_rows, "row_count": len(top_ips_rows)},
        {"id": "categories", "name": "Категории", "columns": ["category", "events"], "rows": category_rows, "row_count": len(category_rows)},
        {"id": "topics", "name": "Темы", "columns": ["topic", "events"], "rows": topic_rows, "row_count": len(topic_rows)},
        {"id": "protocols", "name": "Протоколы", "columns": ["protocol", "events"], "rows": protocol_rows, "row_count": len(protocol_rows)},
        {"id": "messengers", "name": "Мессенджеры", "columns": ["time", "host", "ip", "port", "protocol", "category", "bytes"], "rows": messenger_rows, "row_count": len(messenger_rows)},
        {"id": "vpn", "name": "VPN", "columns": ["time", "host", "ip", "port", "protocol", "category", "bytes", "vpn_verdict", "vpn_score", "vpn_evidence"], "rows": vpn_rows, "row_count": len(vpn_rows)},
        {"id": "vpn_detector", "name": "VPN detector", "columns": ["verdict", "count"], "rows": [{"verdict": key, "count": value} for key, value in vpn_verdict_counter.items()], "row_count": len(vpn_verdict_counter)},
        {"id": "vpn_detector_hits", "name": "VPN hits", "columns": ["time", "host", "ip", "verdict", "score", "evidence"], "rows": vpn_detector_hits_rows, "row_count": len(vpn_detector_hits_rows)},
        {"id": "gaps", "name": "Паузы", "columns": ["from", "to", "duration_min"], "rows": gaps, "row_count": len(gaps)},
        {"id": "chronology", "name": "Хронология", "columns": ["time", "time_end", "host", "sni_hosts", "ip", "port", "protocol", "category", "bytes", "duration_sec", "app_hint", "vpn_verdict", "vpn_score", "vpn_evidence"], "rows": chronology_rows, "row_count": len(chronology_rows)},
        {"id": "hours", "name": "Активность по часам", "columns": ["hour", "events"], "rows": hour_rows, "row_count": len(hour_rows)},
        {"id": "days", "name": "Активность по дням", "columns": ["day", "events"], "rows": day_rows, "row_count": len(day_rows)},
    ]

    stats: Dict[str, object] = {
        "device_id": device_id,
        "input_file": input_path.name,
        "period_start": period_start.isoformat(),
        "period_end": period_end.isoformat(),
        "events_total": len(events),
        "domains_unique": len(domain_counter),
        "ips_unique": len(ip_counter),
        "gaps_count": len(gaps),
        "vpn_detected": vpn_detected,
        "vpn_likely": vpn_likely,
        "vpn_suspicious": vpn_suspicious,
        "vpn_signal_top": dominant_vpn_signal,
        "alt_dns_hits": alt_dns_hits,
        "vpn_top_providers": top_vpn_providers,
        "vpn_top_mismatch_domains": top_mismatch_domains,
        "vpn_method_effectiveness": top_detector_methods,
        "busiest_hour": busiest_hour,
        "busiest_day": busiest_day,
        "columns_detected": resolved_columns,
        **parse_stats,
    }
    if len(events) > MAX_CHRONOLOGY_ROWS:
        stats["chronology_truncated"] = True
        stats["chronology_kept"] = MAX_CHRONOLOGY_ROWS

    return AnalyzeResponse(
        document_title=report_title,
        document_markdown=markdown,
        console_data={
            "profile_id": "sni_traffic",
            "profile_name": f"SNI traffic ({device_id})",
            "active_tab_id": "overview",
            "tabs": tabs,
        },
        stats=stats,
    )
