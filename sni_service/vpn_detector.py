from __future__ import annotations

import argparse
import csv
import ipaddress
import json
import logging
import os
import re
import signal
import sys
import time
from bisect import bisect_right
from collections import Counter, deque
from dataclasses import dataclass
from datetime import datetime, timedelta
from pathlib import Path
from typing import Any, Deque, Dict, Iterable, Iterator, List, Optional, Set, Tuple
from urllib.parse import urlparse

try:
    import tldextract  # type: ignore
except Exception:  # pragma: no cover - optional in tests
    tldextract = None


LOGGER = logging.getLogger("vpn_detector")
VPN_KEYWORDS = (
    "vpn",
    "proxy",
    "tunnel",
    "shadowsocks",
    "v2ray",
    "xray",
    "outline",
    "wireguard",
    "openvpn",
    "cloak",
)
TIME_FORMATS = (
    "%Y-%m-%dT%H:%M:%S",
    "%Y-%m-%d %H:%M:%S",
    "%d.%m.%Y %H:%M:%S",
    "%Y-%m-%dT%H:%M:%S.%f",
    "%Y-%m-%d %H:%M:%S.%f",
)
HARD_METHODS = {"JA3_VPN_SIGNATURE", "VPN_INFRA_IP_MATCH", "SNI_ASN_MISMATCH", "SELF_SIGNED_CERTIFICATE", "CUSTOM_PAIR_MATCH"}
DEFAULT_CUSTOM_VPN_PAIRS = (
    {
        "sni": "www.amd.com",
        "ip": "109.206.236.170",
        "provider": "Known private VPN pattern",
        "type": "custom_pair",
        "score": 100,
    },
)
DEFAULT_ALT_DNS_IPS = (
    {
        "ip": "176.99.11.77",
        "label": "XBox DNS gateway",
        "score": 35,
    },
)


def _memory_mb() -> float:
    try:
        import psutil  # type: ignore

        proc = psutil.Process(os.getpid())
        return proc.memory_info().rss / (1024 * 1024)
    except Exception:
        return 0.0


def _parse_time(value: Any) -> Optional[datetime]:
    if value is None:
        return None
    if isinstance(value, datetime):
        return value
    raw = str(value).strip()
    if not raw:
        return None
    if raw.endswith("Z"):
        raw = raw[:-1]
    for fmt in TIME_FORMATS:
        try:
            return datetime.strptime(raw, fmt)
        except ValueError:
            continue
    try:
        return datetime.fromisoformat(raw)
    except ValueError:
        return None


def _to_ip(value: Any) -> Optional[ipaddress._BaseAddress]:
    raw = str(value or "").strip()
    if not raw:
        return None
    if "/" in raw and raw.count("/") == 1:
        raw = raw.split("/", 1)[0].strip()
    if ":" in raw and raw.count(":") == 1 and "." in raw:
        # host:port
        left, right = raw.rsplit(":", 1)
        if right.isdigit():
            raw = left
    try:
        return ipaddress.ip_address(raw)
    except ValueError:
        return None


def _norm_asn(value: Any) -> Optional[str]:
    if value is None:
        return None
    raw = str(value).strip().upper()
    if not raw:
        return None
    raw = raw.replace("AS", "")
    digits = re.sub(r"[^\d]", "", raw)
    return digits or None


def _extract_host(value: Any) -> str:
    raw = str(value or "").strip().lower()
    if not raw:
        return ""
    if "://" in raw:
        parsed = urlparse(raw)
        if parsed.hostname:
            return parsed.hostname.lower()
    host = raw.split("/", 1)[0].strip()
    if ":" in host and host.count(":") == 1:
        left, right = host.rsplit(":", 1)
        if right.isdigit():
            host = left
    return host.strip(".")


def _safe_int(value: Any, default: int = 0) -> int:
    try:
        return int(value)
    except (TypeError, ValueError):
        return default


def _shannon_entropy_from_hex(payload_hex: str) -> Optional[float]:
    raw = str(payload_hex or "").strip()
    if not raw:
        return None
    try:
        data = bytes.fromhex(raw)
    except ValueError:
        return None
    if not data:
        return None
    freq: Dict[int, int] = {}
    for b in data:
        freq[b] = freq.get(b, 0) + 1
    length = float(len(data))
    import math

    entropy = 0.0
    for count in freq.values():
        p = count / length
        entropy -= p * math.log2(p)
    return entropy


def _normalize_domain(value: Any) -> str:
    host = _extract_host(value)
    return host.strip().lower().strip(".")


@dataclass(frozen=True)
class ASNRecord:
    start: int
    end: int
    asn: str
    asn_name: str
    country: str


@dataclass
class DetectionHit:
    method: str
    score: int
    evidence: str
    provider: str = ""
    mismatch_domain: str = ""


class PrefixMatcher:
    def __init__(self) -> None:
        self._index: Dict[Tuple[int, int, int], List[Dict[str, Any]]] = {}
        self._prefix_lengths: Dict[int, List[int]] = {4: [], 6: []}

    def add(self, cidr_or_ip: str, metadata: Optional[Dict[str, Any]] = None) -> None:
        raw = str(cidr_or_ip or "").strip()
        if not raw:
            return
        try:
            if "/" in raw:
                net = ipaddress.ip_network(raw, strict=False)
            else:
                ip_obj = ipaddress.ip_address(raw)
                suffix = 32 if ip_obj.version == 4 else 128
                net = ipaddress.ip_network(f"{ip_obj}/{suffix}", strict=False)
        except ValueError:
            return

        family = net.version
        prefix = int(net.prefixlen)
        base = int(net.network_address)
        key = (family, prefix, base)
        self._index.setdefault(key, []).append(metadata or {})
        if prefix not in self._prefix_lengths[family]:
            self._prefix_lengths[family].append(prefix)
            self._prefix_lengths[family].sort(reverse=True)

    def find(self, ip_value: Any) -> List[Dict[str, Any]]:
        ip_obj = _to_ip(ip_value)
        if ip_obj is None:
            return []
        family = ip_obj.version
        ip_int = int(ip_obj)
        for prefix in self._prefix_lengths[family]:
            bits = 32 if family == 4 else 128
            mask = ((1 << bits) - 1) ^ ((1 << (bits - prefix)) - 1)
            base = ip_int & mask
            key = (family, prefix, base)
            if key in self._index:
                return self._index[key]
        return []

    def contains(self, ip_value: Any) -> bool:
        return len(self.find(ip_value)) > 0

    def size(self) -> int:
        return len(self._index)


class ASNRangeIndex:
    def __init__(self) -> None:
        self._rows: List[ASNRecord] = []
        self._starts: List[int] = []

    def add(self, start: Any, end: Any, asn: Any, asn_name: Any = "", country: Any = "") -> None:
        start_ip = _to_ip(start)
        end_ip = _to_ip(end)
        if start_ip is None or end_ip is None:
            return
        if start_ip.version != end_ip.version:
            return
        start_int = int(start_ip)
        end_int = int(end_ip)
        if end_int < start_int:
            start_int, end_int = end_int, start_int
        norm_asn = _norm_asn(asn)
        if not norm_asn:
            return
        self._rows.append(
            ASNRecord(
                start=start_int,
                end=end_int,
                asn=norm_asn,
                asn_name=str(asn_name or "").strip(),
                country=str(country or "").strip().upper(),
            )
        )

    def finalize(self) -> None:
        self._rows.sort(key=lambda r: r.start)
        self._starts = [r.start for r in self._rows]

    def lookup(self, ip_value: Any) -> Optional[ASNRecord]:
        if not self._rows:
            return None
        ip_obj = _to_ip(ip_value)
        if ip_obj is None:
            return None
        ip_int = int(ip_obj)
        idx = bisect_right(self._starts, ip_int) - 1
        while idx >= 0:
            row = self._rows[idx]
            if row.start > ip_int:
                idx -= 1
                continue
            if row.start <= ip_int <= row.end:
                return row
            if row.end < ip_int:
                break
            idx -= 1
        return None

    def size(self) -> int:
        return len(self._rows)


class ReferenceData:
    """Loads and indexes all reference data files required by VPN detection."""

    def __init__(self, config: Dict[str, Any], logger: Optional[logging.Logger] = None) -> None:
        self.config = config
        self.logger = logger or LOGGER
        self.audit: Dict[str, Dict[str, Any]] = {}

        self.vpn_ja3: Dict[str, Dict[str, Any]] = {}
        self.ja3_app_db: Dict[str, Dict[str, Any]] = {}
        self.vpn_infra = PrefixMatcher()
        self.cloud_prefixes = PrefixMatcher()
        self.expected_asn: Dict[str, Set[str]] = {}
        self.asn_index = ASNRangeIndex()
        self.top1m_rank: Dict[str, int] = {}
        self.top1m_category: Dict[str, str] = {}
        self.messaging_domains: Set[str] = set()
        self.custom_vpn_pairs: Dict[Tuple[str, str], Dict[str, Any]] = {}
        self.alt_dns_ips: Dict[str, Dict[str, Any]] = {}
        self._extractor = None

    def _path(self, key: str) -> Optional[Path]:
        value = self.config.get(key)
        if not value:
            return None
        return Path(str(value))

    def _audit_csv(self, path: Path, name: str) -> None:
        info = {"rows": 0, "columns": [], "samples": [], "issues": []}
        if not path.exists():
            info["issues"].append("missing_file")
            self.audit[name] = info
            return
        for encoding in ("utf-8-sig", "cp1251", "latin-1"):
            try:
                with path.open("r", encoding=encoding, newline="") as fh:
                    reader = csv.DictReader(fh)
                    info["columns"] = list(reader.fieldnames or [])
                    for row in reader:
                        info["rows"] += 1
                        if len(info["samples"]) < 5:
                            info["samples"].append({k: row.get(k) for k in list(row.keys())[:8]})
                break
            except UnicodeDecodeError:
                continue
        if not info["columns"]:
            info["issues"].append("unreadable_or_empty")
        self.audit[name] = info
        self.logger.info("[audit] %s rows=%s cols=%s", name, info["rows"], info["columns"][:12])

    def _audit_json(self, path: Path, name: str) -> None:
        info = {"rows": 0, "columns": [], "samples": [], "issues": []}
        if not path.exists():
            info["issues"].append("missing_file")
            self.audit[name] = info
            return
        try:
            data = json.loads(path.read_text(encoding="utf-8"))
        except UnicodeDecodeError:
            data = json.loads(path.read_text(encoding="cp1251", errors="ignore"))
        except Exception as exc:
            info["issues"].append(f"json_error:{exc}")
            self.audit[name] = info
            return
        if isinstance(data, dict):
            info["rows"] = len(data)
            info["columns"] = list(data.keys())[:20]
            sample_items = list(data.items())[:5]
            info["samples"] = [{str(k): v} for k, v in sample_items]
        elif isinstance(data, list):
            info["rows"] = len(data)
            if data and isinstance(data[0], dict):
                info["columns"] = list(data[0].keys())
            info["samples"] = data[:5]
        else:
            info["rows"] = 1
            info["samples"] = [str(data)[:300]]
        self.audit[name] = info
        self.logger.info("[audit] %s rows=%s cols=%s", name, info["rows"], info["columns"][:12])

    def _iter_csv(self, path: Path) -> Iterator[Dict[str, str]]:
        for encoding in ("utf-8-sig", "cp1251", "latin-1"):
            try:
                with path.open("r", encoding=encoding, newline="") as fh:
                    reader = csv.DictReader(fh)
                    for row in reader:
                        yield {str(k): str(v or "") for k, v in row.items()}
                return
            except UnicodeDecodeError:
                continue
        raise ValueError(f"unable to decode csv: {path}")

    @staticmethod
    def _guess(row: Dict[str, str], keys: Iterable[str]) -> str:
        normalized = {re.sub(r"[^a-z0-9_]", "", k.lower()): k for k in row.keys()}
        for key in keys:
            if key in normalized:
                return row.get(normalized[key], "")
        for src_key, value in row.items():
            joined = re.sub(r"[^a-z0-9_]", "", src_key.lower())
            if any(k in joined for k in keys):
                return value
        return ""

    def _load_psl(self) -> None:
        psl = self._path("public_suffix_list")
        if tldextract is None:
            self._extractor = None
            self.logger.warning("tldextract not available, eTLD+1 fallback is active")
            return
        try:
            if psl and psl.exists():
                self._extractor = tldextract.TLDExtract(suffix_list_urls=[f"file://{psl.resolve()}"])
            else:
                self._extractor = tldextract.TLDExtract(suffix_list_urls=None)
        except Exception:
            self._extractor = None

    def etld_plus_one(self, host: str) -> str:
        value = _normalize_domain(host)
        if not value:
            return ""
        if self._extractor is not None:
            result = self._extractor(value)
            if result.domain and result.suffix:
                return f"{result.domain}.{result.suffix}".lower()
        parts = value.split(".")
        if len(parts) >= 2:
            return f"{parts[-2]}.{parts[-1]}".lower()
        return value

    def _load_vpn_ja3(self) -> None:
        path = self._path("vpn_ja3_signatures")
        if not path or not path.exists():
            return
        for row in self._iter_csv(path):
            ja3 = self._guess(row, ("ja3", "ja3_hash", "hash")).strip().lower()
            if not ja3:
                continue
            self.vpn_ja3[ja3] = {
                "family": self._guess(row, ("family", "provider", "tool", "name")) or "vpn",
                "confidence": self._guess(row, ("confidence", "score")) or "1.0",
                "source": str(path.name),
            }

    def _load_ja3_app_db(self) -> None:
        path = self._path("ja3_app_db_full")
        if not path or not path.exists():
            return
        for row in self._iter_csv(path):
            ja3 = self._guess(row, ("ja3", "ja3_hash", "hash")).strip().lower()
            if not ja3:
                continue
            self.ja3_app_db[ja3] = {
                "app_name": self._guess(row, ("app_name", "application", "name")),
                "notes": self._guess(row, ("notes", "description", "comment")),
                "confidence": self._guess(row, ("confidence", "score")) or "",
                "source": str(path.name),
            }

    def _load_vpn_ioc(self) -> None:
        for key in ("vpn_infra_ioc", "vpn_infra_ioc_full"):
            path = self._path(key)
            if not path or not path.exists():
                continue
            for row in self._iter_csv(path):
                cidr = self._guess(row, ("cidr", "prefix", "network", "ip", "address"))
                provider = self._guess(row, ("provider", "name", "org", "company"))
                ioc_type = self._guess(row, ("type", "category", "label"))
                self.vpn_infra.add(
                    cidr,
                    {
                        "provider": provider or "unknown",
                        "type": ioc_type or "vpn_infra",
                        "source": path.name,
                    },
                )

    def _load_cloud_prefixes(self) -> None:
        for key in ("cloud_prefixes", "cloud_prefixes_full"):
            path = self._path(key)
            if not path or not path.exists():
                continue
            raw = json.loads(path.read_text(encoding="utf-8", errors="ignore"))
            prefixes: List[str] = []
            if isinstance(raw, list):
                for item in raw:
                    if isinstance(item, str):
                        prefixes.append(item)
                    elif isinstance(item, dict):
                        prefixes.extend([str(item.get("cidr") or ""), str(item.get("prefix") or ""), str(item.get("ip_prefix") or "")])
            elif isinstance(raw, dict):
                for value in raw.values():
                    if isinstance(value, list):
                        for item in value:
                            if isinstance(item, str):
                                prefixes.append(item)
                            elif isinstance(item, dict):
                                prefixes.extend([str(item.get("cidr") or ""), str(item.get("prefix") or ""), str(item.get("ip_prefix") or "")])
            for prefix in prefixes:
                self.cloud_prefixes.add(prefix, {"source": path.name})

    def _load_expected_asn(self) -> None:
        json_path = self._path("expected_asn_map")
        if json_path and json_path.exists():
            raw = json.loads(json_path.read_text(encoding="utf-8", errors="ignore"))
            if isinstance(raw, dict):
                for domain, value in raw.items():
                    key = self.etld_plus_one(domain)
                    if not key:
                        continue
                    asns: Set[str] = set()
                    if isinstance(value, list):
                        for item in value:
                            norm = _norm_asn(item)
                            if norm:
                                asns.add(norm)
                    elif isinstance(value, dict):
                        for item in value.get("expected_asn", []) or value.get("asns", []):
                            norm = _norm_asn(item)
                            if norm:
                                asns.add(norm)
                    else:
                        norm = _norm_asn(value)
                        if norm:
                            asns.add(norm)
                    if asns:
                        self.expected_asn.setdefault(key, set()).update(asns)

        csv_path = self._path("expected_asn_map_full")
        if csv_path and csv_path.exists():
            for row in self._iter_csv(csv_path):
                domain = self.etld_plus_one(self._guess(row, ("domain", "host", "sni")))
                if not domain:
                    continue
                raw_asn = self._guess(row, ("expected_asn", "asns", "asn"))
                parts = [p.strip() for p in re.split(r"[;,| ]+", raw_asn) if p.strip()]
                for part in parts:
                    norm = _norm_asn(part)
                    if norm:
                        self.expected_asn.setdefault(domain, set()).add(norm)

    def _load_asn_db(self) -> None:
        path = self._path("asn_db")
        if not path or not path.exists():
            return
        for row in self._iter_csv(path):
            start = self._guess(row, ("start_ip", "start", "range_start", "ip_from"))
            end = self._guess(row, ("end_ip", "end", "range_end", "ip_to"))
            asn = self._guess(row, ("asn", "autonomous_system_number", "as_number"))
            asn_name = self._guess(row, ("asn_name", "org", "organization", "name"))
            country = self._guess(row, ("country", "country_code", "cc"))
            self.asn_index.add(start, end, asn, asn_name, country)
        self.asn_index.finalize()

    def _load_top1m(self) -> None:
        path = self._path("top_1m")
        if not path or not path.exists():
            return
        rank = 0
        for row in self._iter_csv(path):
            rank += 1
            domain = self._guess(row, ("domain", "host", "site", "sni"))
            if not domain and len(row) >= 2:
                values = list(row.values())
                domain = values[1]
            etld1 = self.etld_plus_one(domain)
            if not etld1:
                continue
            if etld1 not in self.top1m_rank:
                self.top1m_rank[etld1] = rank
                category = self._guess(row, ("category", "type", "class"))
                self.top1m_category[etld1] = category

    def _load_messaging_domains(self) -> None:
        path = self._path("known_messaging_domains")
        if not path or not path.exists():
            return
        for row in self._iter_csv(path):
            value = self._guess(row, ("domain", "pattern", "host", "sni"))
            dom = self.etld_plus_one(value)
            if dom:
                self.messaging_domains.add(dom)

    def _load_custom_vpn_pairs(self) -> None:
        for rule in DEFAULT_CUSTOM_VPN_PAIRS:
            sni = self.etld_plus_one(rule.get("sni", "")) or _normalize_domain(rule.get("sni", ""))
            ip = str(_to_ip(rule.get("ip")) or "").strip()
            if sni and ip:
                self.custom_vpn_pairs[(sni, ip)] = {
                    "provider": str(rule.get("provider") or "custom"),
                    "type": str(rule.get("type") or "custom_pair"),
                    "score": int(rule.get("score") or 100),
                }
        path = self._path("vpn_custom_pairs")
        if not path or not path.exists():
            return
        for row in self._iter_csv(path):
            sni_raw = self._guess(row, ("sni", "domain", "host"))
            ip_raw = self._guess(row, ("ip", "dst_ip", "address"))
            score = _safe_int(self._guess(row, ("score", "weight", "confidence")), 100)
            provider = self._guess(row, ("provider", "name", "label")) or "custom"
            pair_type = self._guess(row, ("type", "category")) or "custom_pair"
            sni = self.etld_plus_one(sni_raw) or _normalize_domain(sni_raw)
            ip_obj = _to_ip(ip_raw)
            if not sni or ip_obj is None:
                continue
            self.custom_vpn_pairs[(sni, str(ip_obj))] = {
                "provider": provider,
                "type": pair_type,
                "score": max(0, min(100, score)),
            }

    def _load_alt_dns_ioc(self) -> None:
        for rule in DEFAULT_ALT_DNS_IPS:
            ip_obj = _to_ip(rule.get("ip"))
            if ip_obj is None:
                continue
            self.alt_dns_ips[str(ip_obj)] = {
                "label": str(rule.get("label") or "alt_dns"),
                "score": int(rule.get("score") or 35),
            }
        path = self._path("alt_dns_ioc")
        if not path or not path.exists():
            return
        for row in self._iter_csv(path):
            ip_obj = _to_ip(self._guess(row, ("ip", "dst_ip", "address")))
            if ip_obj is None:
                continue
            label = self._guess(row, ("label", "name", "type")) or "alt_dns"
            score = _safe_int(self._guess(row, ("score", "weight", "confidence")), 35)
            self.alt_dns_ips[str(ip_obj)] = {
                "label": label,
                "score": max(0, min(100, score)),
            }

    def _run_integrity_checks(self) -> None:
        dup_ja3 = sorted(set(self.vpn_ja3.keys()) & set(self.ja3_app_db.keys()))
        if dup_ja3:
            self.logger.warning("[integrity] JA3 overlaps vpn/app db: %s", len(dup_ja3))
        overlap_count = 0
        for key in list(self.vpn_infra._index.keys())[:20000]:
            _, prefix, base = key
            family = key[0]
            bits = 32 if family == 4 else 128
            size = 1 << (bits - prefix)
            ip_start = ipaddress.ip_address(base)
            ip_end = ipaddress.ip_address(base + size - 1)
            if self.cloud_prefixes.contains(ip_start) or self.cloud_prefixes.contains(ip_end):
                overlap_count += 1
        if overlap_count:
            self.logger.warning("[integrity] vpn/cloud prefix overlaps: %s", overlap_count)

        if self.expected_asn and self.top1m_rank:
            covered = sum(1 for domain in self.expected_asn if domain in self.top1m_rank)
            total = len(self.expected_asn)
            pct = round((covered / total) * 100, 2) if total else 0.0
            self.logger.info("[integrity] expected_asn coverage in top1m: %s/%s (%s%%)", covered, total, pct)

    def load(self) -> None:
        started = time.perf_counter()
        load_plan = [
            ("vpn_ja3_signatures", "csv"),
            ("ja3_app_db_full", "csv"),
            ("vpn_infra_ioc", "csv"),
            ("vpn_infra_ioc_full", "csv"),
            ("expected_asn_map", "json"),
            ("expected_asn_map_full", "csv"),
            ("cloud_prefixes", "json"),
            ("cloud_prefixes_full", "json"),
            ("asn_db", "csv"),
            ("public_suffix_list", "csv"),
            ("known_messaging_domains", "csv"),
            ("top_1m", "csv"),
            ("vpn_custom_pairs", "csv"),
            ("alt_dns_ioc", "csv"),
        ]
        for key, fmt in load_plan:
            path = self._path(key)
            if not path:
                continue
            if fmt == "json":
                self._audit_json(path, key)
            else:
                self._audit_csv(path, key)

        self._load_psl()
        self._load_vpn_ja3()
        self._load_ja3_app_db()
        self._load_vpn_ioc()
        self._load_cloud_prefixes()
        self._load_expected_asn()
        self._load_asn_db()
        self._load_top1m()
        self._load_messaging_domains()
        self._load_custom_vpn_pairs()
        self._load_alt_dns_ioc()
        self._run_integrity_checks()

        elapsed = round(time.perf_counter() - started, 3)
        self.logger.info(
            "[refs] loaded in %.3fs | vpn_ja3=%s app_ja3=%s vpn_prefix=%s cloud_prefix=%s expected_asn=%s asn_rows=%s mem=%.1fMB",
            elapsed,
            len(self.vpn_ja3),
            len(self.ja3_app_db),
            self.vpn_infra.size(),
            self.cloud_prefixes.size(),
            len(self.expected_asn),
            self.asn_index.size(),
            _memory_mb(),
        )


class VPNDetector:
    def __init__(self, refs: ReferenceData, debug: bool = False) -> None:
        self.refs = refs
        self.debug = debug
        self.dns_cache: Deque[Tuple[datetime, str]] = deque()
        self.stats_total = 0
        self.verdict_counter = Counter()
        self.provider_counter = Counter()
        self.mismatch_domain_counter = Counter()
        self.method_counter = Counter()
        self.started = time.perf_counter()

    def _event_time(self, event: Dict[str, Any]) -> Optional[datetime]:
        return _parse_time(event.get("ts") or event.get("timestamp") or event.get("time") or event.get("event_time"))

    def _dst_ip(self, event: Dict[str, Any]) -> str:
        candidates = (
            event.get("dst_ip"),
            event.get("server_ip"),
            event.get("ip"),
            event.get("remote_ip"),
            event.get("destination_ip"),
        )
        for value in candidates:
            ip_obj = _to_ip(value)
            if ip_obj is not None:
                return str(ip_obj)
        return ""

    def _sni(self, event: Dict[str, Any]) -> str:
        return _extract_host(
            event.get("sni")
            or event.get("tls_sni")
            or event.get("host")
            or event.get("server_name")
            or event.get("domain")
        )

    def _ja3(self, event: Dict[str, Any]) -> str:
        return str(event.get("ja3") or event.get("ja3_hash") or event.get("tls_ja3") or "").strip().lower()

    def _is_tls_event(self, event: Dict[str, Any]) -> bool:
        proto = str(event.get("protocol") or event.get("app_protocol") or "").lower()
        if "tls" in proto or "ssl" in proto:
            return True
        return bool(self._sni(event) or self._ja3(event))

    def _prune_dns_cache(self, now: datetime) -> None:
        border = now - timedelta(seconds=120)
        while self.dns_cache and self.dns_cache[0][0] < border:
            self.dns_cache.popleft()

    def _register_dns_answers(self, event: Dict[str, Any], ts: Optional[datetime]) -> None:
        if ts is None:
            return
        answers: List[str] = []
        if isinstance(event.get("dns_answers"), list):
            answers.extend([str(item) for item in event.get("dns_answers", [])])
        if event.get("dns_answer_ip"):
            answers.append(str(event.get("dns_answer_ip")))
        if event.get("resolved_ip"):
            answers.append(str(event.get("resolved_ip")))
        if str(event.get("event_type") or "").lower() in {"dns_response", "dns"} and event.get("dst_ip"):
            answers.append(str(event.get("dst_ip")))
        for answer in answers:
            ip_obj = _to_ip(answer)
            if ip_obj is not None:
                self.dns_cache.append((ts, str(ip_obj)))

    def method_ja3_vpn_signature(self, event: Dict[str, Any]) -> DetectionHit:
        ja3 = self._ja3(event)
        if not ja3:
            return DetectionHit("JA3_VPN_SIGNATURE", 0, "no_ja3")

        vpn_hit = self.refs.vpn_ja3.get(ja3)
        app_hit = self.refs.ja3_app_db.get(ja3)

        app_text = ""
        if app_hit:
            app_text = f"{app_hit.get('app_name', '')} {app_hit.get('notes', '')}".lower()

        app_marked_as_vpn = any(keyword in app_text for keyword in VPN_KEYWORDS)
        if vpn_hit:
            vpn_conf = float(vpn_hit.get("confidence") or 1.0)
            if app_hit and not app_marked_as_vpn:
                app_conf = float(app_hit.get("confidence") or 1.0)
                if app_conf >= vpn_conf:
                    return DetectionHit(
                        "JA3_VPN_SIGNATURE",
                        0,
                        f"ja3_collision_suppressed app={app_hit.get('app_name', 'unknown')} app_conf={app_conf:.2f} vpn_conf={vpn_conf:.2f}",
                    )
            return DetectionHit(
                "JA3_VPN_SIGNATURE",
                100,
                f"JA3 matches {vpn_hit.get('family', 'vpn')} confidence={vpn_hit.get('confidence', '1.0')}",
            )

        if app_hit and app_marked_as_vpn:
            return DetectionHit(
                "JA3_VPN_SIGNATURE",
                100,
                f"JA3 app_db indicates vpn-like fingerprint app={app_hit.get('app_name', 'unknown')}",
            )

        return DetectionHit("JA3_VPN_SIGNATURE", 0, "no_ja3_vpn_match")

    def method_vpn_infra_ip_match(self, event: Dict[str, Any]) -> DetectionHit:
        dst_ip = self._dst_ip(event)
        if not dst_ip:
            return DetectionHit("VPN_INFRA_IP_MATCH", 0, "no_dst_ip")
        matches = self.refs.vpn_infra.find(dst_ip)
        if not matches:
            return DetectionHit("VPN_INFRA_IP_MATCH", 0, "no_ioc_ip_match")
        best = matches[0]
        provider = str(best.get("provider") or "unknown")
        ioc_type = str(best.get("type") or "vpn_infra")
        return DetectionHit(
            "VPN_INFRA_IP_MATCH",
            100,
            f"IP {dst_ip} matches VPN infra: {provider} type={ioc_type}",
            provider=provider,
        )

    def method_sni_asn_mismatch(self, event: Dict[str, Any]) -> DetectionHit:
        sni = self._sni(event)
        dst_ip = self._dst_ip(event)
        if not sni or not dst_ip:
            return DetectionHit("SNI_ASN_MISMATCH", 0, "missing_sni_or_ip")

        etld1 = self.refs.etld_plus_one(sni)
        expected = self.refs.expected_asn.get(etld1)
        if not expected:
            return DetectionHit("SNI_ASN_MISMATCH", 0, "no_expected_asn_data")

        asn_row = self.refs.asn_index.lookup(dst_ip)
        if asn_row is None:
            return DetectionHit("SNI_ASN_MISMATCH", 0, "asn_not_found")
        if asn_row.asn in expected:
            return DetectionHit("SNI_ASN_MISMATCH", 0, "asn_matches_expected")
        if self.refs.cloud_prefixes.contains(dst_ip):
            return DetectionHit("SNI_ASN_MISMATCH", 0, "CDN_exempted")

        expected_text = ",".join(sorted(expected))
        return DetectionHit(
            "SNI_ASN_MISMATCH",
            100,
            f"SNI {etld1} (expected ASN {expected_text}) but dst_ip ASN is {asn_row.asn} ({asn_row.asn_name})",
            mismatch_domain=etld1,
        )

    def method_custom_pair_match(self, event: Dict[str, Any]) -> DetectionHit:
        sni = self._sni(event)
        dst_ip = self._dst_ip(event)
        if not sni or not dst_ip:
            return DetectionHit("CUSTOM_PAIR_MATCH", 0, "missing_sni_or_ip")
        etld1 = self.refs.etld_plus_one(sni) or _normalize_domain(sni)
        key = (etld1, dst_ip)
        rule = self.refs.custom_vpn_pairs.get(key)
        if not rule:
            return DetectionHit("CUSTOM_PAIR_MATCH", 0, "no_custom_pair_match")
        score = int(rule.get("score") or 100)
        provider = str(rule.get("provider") or "custom")
        pair_type = str(rule.get("type") or "custom_pair")
        return DetectionHit(
            "CUSTOM_PAIR_MATCH",
            max(0, min(100, score)),
            f"Custom pair match: {etld1} -> {dst_ip} ({pair_type})",
            provider=provider,
        )

    def method_missing_dns_query(self, event: Dict[str, Any], ts: Optional[datetime]) -> DetectionHit:
        if ts is None or not self._is_tls_event(event):
            return DetectionHit("MISSING_DNS_QUERY", 0, "not_tls_or_no_time")
        has_dns_fields = any(
            key in event
            for key in ("dns_answers", "dns_answer_ip", "resolved_ip", "query_name", "dns_query", "event_type")
        )
        if not has_dns_fields and not self.dns_cache:
            return DetectionHit("MISSING_DNS_QUERY", 0, "dns_telemetry_not_available")
        dst_ip = self._dst_ip(event)
        if not dst_ip:
            return DetectionHit("MISSING_DNS_QUERY", 0, "no_dst_ip")
        if self.refs.cloud_prefixes.contains(dst_ip):
            return DetectionHit("MISSING_DNS_QUERY", 0, "cloud_ip_exempted")
        window_start = ts - timedelta(seconds=60)
        dns_ok = any((window_start <= dns_ts <= ts and dns_ip == dst_ip) for dns_ts, dns_ip in self.dns_cache)
        if dns_ok:
            return DetectionHit("MISSING_DNS_QUERY", 0, "DNS_resolved_normally")
        return DetectionHit("MISSING_DNS_QUERY", 30, "No DNS query observed for dst_ip in preceding 60s window")

    def method_alt_dns_gateway(self, event: Dict[str, Any]) -> DetectionHit:
        dst_ip = self._dst_ip(event)
        if not dst_ip:
            return DetectionHit("ALT_DNS_GATEWAY", 0, "no_dst_ip")
        row = self.refs.alt_dns_ips.get(dst_ip)
        if not row:
            return DetectionHit("ALT_DNS_GATEWAY", 0, "no_alt_dns_match")
        score = int(row.get("score") or 35)
        label = str(row.get("label") or "alt_dns")
        return DetectionHit("ALT_DNS_GATEWAY", max(0, min(60, score)), f"Known alternative DNS endpoint: {label}")

    def method_rtt_geo_anomaly(self, event: Dict[str, Any]) -> DetectionHit:
        dst_ip = self._dst_ip(event)
        rtt_ms = _safe_int(event.get("rtt_ms"), 0)
        if not dst_ip or rtt_ms <= 0:
            return DetectionHit("RTT_GEO_ANOMALY", 0, "no_rtt_or_dst")
        dst_asn = self.refs.asn_index.lookup(dst_ip)
        user_asn_value = _norm_asn(event.get("src_asn") or event.get("user_asn"))
        if not dst_asn or not user_asn_value:
            return DetectionHit("RTT_GEO_ANOMALY", 0, "no_geo_data_available")
        src_country = str(event.get("src_country") or event.get("user_country") or "").upper()
        if not src_country and user_asn_value == dst_asn.asn:
            src_country = dst_asn.country
        if not src_country or not dst_asn.country:
            return DetectionHit("RTT_GEO_ANOMALY", 0, "no_geo_data_available")
        expected = 40 if src_country == dst_asn.country else 120
        if rtt_ms > expected * 3:
            return DetectionHit("RTT_GEO_ANOMALY", 25, f"RTT anomaly: observed={rtt_ms}ms expected~{expected}ms")
        return DetectionHit("RTT_GEO_ANOMALY", 0, "rtt_within_expected")

    def method_long_keepalive(self, event: Dict[str, Any]) -> DetectionHit:
        duration = _safe_int(event.get("duration_sec"), 0)
        pkt_count = _safe_int(event.get("packet_count"), 0)
        avg_size = _safe_int(event.get("avg_packet_size"), 0)
        if duration > 3600 and pkt_count > 100 and avg_size < 300:
            return DetectionHit(
                "LONG_KEEPALIVE",
                20,
                f"Long keepalive flow: duration={duration}s, avg_pkt_size={avg_size}B",
            )
        return DetectionHit("LONG_KEEPALIVE", 0, "no_long_keepalive_pattern")

    def method_high_entropy(self, event: Dict[str, Any]) -> DetectionHit:
        if event.get("payload_entropy") is not None:
            entropy = float(event.get("payload_entropy"))
        elif event.get("payload_hex"):
            parsed = _shannon_entropy_from_hex(str(event.get("payload_hex")))
            if parsed is None:
                return DetectionHit("HIGH_ENTROPY", 0, "payload_not_accessible_in_passive_mode")
            entropy = parsed
        else:
            return DetectionHit("HIGH_ENTROPY", 0, "payload_not_accessible_in_passive_mode")
        if entropy > 7.5:
            return DetectionHit("HIGH_ENTROPY", 25, f"Payload entropy {entropy:.2f} bits/byte exceeds threshold")
        return DetectionHit("HIGH_ENTROPY", 0, f"entropy_normal:{entropy:.2f}")

    def method_self_signed_certificate(self, event: Dict[str, Any]) -> DetectionHit:
        cert = event.get("certificate") or {}
        if not isinstance(cert, dict):
            return DetectionHit("SELF_SIGNED_CERTIFICATE", 0, "certificate_not_available")
        issuer = str(cert.get("issuer") or event.get("tls_cert_issuer") or "").strip().lower()
        subject = str(cert.get("subject") or event.get("tls_cert_subject") or "").strip().lower()
        if not issuer or not subject:
            return DetectionHit("SELF_SIGNED_CERTIFICATE", 0, "certificate_not_available")
        if issuer != subject:
            return DetectionHit("SELF_SIGNED_CERTIFICATE", 0, "certificate_not_self_signed")
        etld1 = self.refs.etld_plus_one(self._sni(event))
        rank = self.refs.top1m_rank.get(etld1, 1_000_001)
        if rank > 10_000:
            return DetectionHit("SELF_SIGNED_CERTIFICATE", 100, "Self-signed certificate on non-major domain")
        return DetectionHit("SELF_SIGNED_CERTIFICATE", 0, "major_domain_self_signed_exempted")

    def _apply_post_filters(self, event: Dict[str, Any], hits: List[DetectionHit]) -> List[DetectionHit]:
        sni = self._sni(event)
        etld1 = self.refs.etld_plus_one(sni)

        if etld1 and etld1 in self.refs.messaging_domains:
            for hit in hits:
                if hit.method == "SNI_ASN_MISMATCH" and hit.score > 0:
                    hit.score = 0
                    hit.evidence = f"suppressed_for_messaging_domain:{etld1}"

        rank = self.refs.top1m_rank.get(etld1, 1_000_001)
        category = (self.refs.top1m_category.get(etld1, "") or "").strip().lower()
        if rank <= 500 and category not in {"proxy/anonymizer", "proxy", "anonymizer"}:
            for hit in hits:
                if hit.score > 0 and hit.method not in {"JA3_VPN_SIGNATURE", "VPN_INFRA_IP_MATCH"}:
                    hit.score = max(0, int(hit.score * 0.5))
                    hit.evidence = f"{hit.evidence} | top500_whitelist_reduction"

        return hits

    def score_event(self, event: Dict[str, Any]) -> Dict[str, Any]:
        ts = self._event_time(event)
        if ts:
            self._prune_dns_cache(ts)

        hits = [
            self.method_ja3_vpn_signature(event),
            self.method_vpn_infra_ip_match(event),
            self.method_sni_asn_mismatch(event),
            self.method_custom_pair_match(event),
            self.method_missing_dns_query(event, ts),
            self.method_alt_dns_gateway(event),
            self.method_rtt_geo_anomaly(event),
            self.method_long_keepalive(event),
            self.method_high_entropy(event),
            self.method_self_signed_certificate(event),
        ]
        hits = self._apply_post_filters(event, hits)

        hard_hits = [hit for hit in hits if hit.method in HARD_METHODS and hit.score >= 100]
        soft_score = sum(hit.score for hit in hits if hit.method not in HARD_METHODS)
        hard_score = 100 if hard_hits else 0
        total_score = hard_score if hard_hits else min(100, soft_score)

        if hard_hits:
            verdict = "VPN_DETECTED"
            confidence = 1.0
        elif total_score >= 60:
            verdict = "VPN_LIKELY"
            confidence = round(total_score / 100.0, 4)
        elif total_score > 0:
            verdict = "VPN_SUSPICIOUS"
            confidence = round(total_score / 100.0, 4)
        else:
            verdict = "CLEAN"
            confidence = 0.0

        evidence = [f"{hit.method}: {hit.evidence}" for hit in hits if hit.score > 0]
        if not evidence:
            evidence = [f"{hit.method}: {hit.evidence}" for hit in hits if hit.evidence][:3]

        for hit in hits:
            if hit.score > 0:
                self.method_counter[hit.method] += 1
                if hit.provider:
                    self.provider_counter[hit.provider] += 1
                if hit.mismatch_domain:
                    self.mismatch_domain_counter[hit.mismatch_domain] += 1

        self.stats_total += 1
        self.verdict_counter[verdict] += 1
        if self.debug:
            LOGGER.debug("event_score verdict=%s total=%s hits=%s", verdict, total_score, evidence)

        enriched = dict(event)
        enriched["vpn_score"] = int(total_score)
        enriched["vpn_verdict"] = verdict
        enriched["vpn_confidence"] = confidence
        enriched["vpn_evidence"] = evidence

        self._register_dns_answers(event, ts)
        return enriched

    def summary(self) -> Dict[str, Any]:
        elapsed = max(0.001, time.perf_counter() - self.started)
        eps = self.stats_total / elapsed
        vpn_detected = self.verdict_counter.get("VPN_DETECTED", 0)
        vpn_likely = self.verdict_counter.get("VPN_LIKELY", 0)
        summary_payload = {
            "events_total": self.stats_total,
            "vpn_detected": vpn_detected,
            "vpn_detected_pct": round((vpn_detected / self.stats_total * 100), 2) if self.stats_total else 0.0,
            "vpn_likely": vpn_likely,
            "vpn_likely_pct": round((vpn_likely / self.stats_total * 100), 2) if self.stats_total else 0.0,
            "events_per_sec": round(eps, 2),
            "memory_mb": round(_memory_mb(), 2),
            "top_vpn_providers": self.provider_counter.most_common(10),
            "top_asn_mismatch_domains": self.mismatch_domain_counter.most_common(10),
            "method_effectiveness": self.method_counter.most_common(),
        }
        return summary_payload


def _default_config() -> Dict[str, Any]:
    refs_dir = Path(os.getenv("SNI_REFS_DIR", "./current"))
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


def _load_config(path: Optional[str]) -> Dict[str, Any]:
    cfg = _default_config()
    if not path:
        return cfg
    custom = json.loads(Path(path).read_text(encoding="utf-8"))
    if isinstance(custom, dict):
        cfg.update(custom)
    return cfg


def _iter_json_lines(input_path: str) -> Iterator[Dict[str, Any]]:
    handle = sys.stdin if input_path == "-" else open(input_path, "r", encoding="utf-8")
    try:
        for line in handle:
            text = line.strip()
            if not text:
                continue
            try:
                payload = json.loads(text)
            except json.JSONDecodeError:
                LOGGER.warning("skip corrupt json line: %s", text[:160])
                continue
            if isinstance(payload, dict):
                yield payload
    finally:
        if handle is not sys.stdin:
            handle.close()


def _write_json_line(handle: Any, payload: Dict[str, Any]) -> None:
    handle.write(json.dumps(payload, ensure_ascii=False) + "\n")


def main() -> int:
    parser = argparse.ArgumentParser(description="Passive VPN detector over JSONL traffic stream")
    parser.add_argument("--config", help="Path to JSON config with reference file paths", default=None)
    parser.add_argument("--input", help="Input JSONL file, or '-' for stdin", default="-")
    parser.add_argument("--output", help="Output JSONL file, or '-' for stdout", default="-")
    parser.add_argument("--debug", action="store_true", help="Enable verbose per-event scoring logs")
    args = parser.parse_args()

    logging.basicConfig(
        level=logging.DEBUG if args.debug else logging.INFO,
        format="%(asctime)s %(levelname)s %(name)s: %(message)s",
        stream=sys.stderr,
    )

    config = _load_config(args.config)
    refs = ReferenceData(config, LOGGER)
    refs.load()
    detector = VPNDetector(refs, debug=args.debug)

    stop_requested = {"value": False}

    def _on_signal(signum: int, _frame: Any) -> None:
        LOGGER.info("signal %s received, finishing stream...", signum)
        stop_requested["value"] = True

    signal.signal(signal.SIGINT, _on_signal)
    signal.signal(signal.SIGTERM, _on_signal)

    out_handle = sys.stdout if args.output == "-" else open(args.output, "w", encoding="utf-8")
    processed = 0
    started = time.perf_counter()
    try:
        for event in _iter_json_lines(args.input):
            if stop_requested["value"]:
                break
            enriched = detector.score_event(event)
            _write_json_line(out_handle, enriched)
            processed += 1
            if processed % 5000 == 0:
                elapsed = max(0.001, time.perf_counter() - started)
                LOGGER.info(
                    "processed=%s rate=%.2f ev/s mem=%.1fMB",
                    processed,
                    processed / elapsed,
                    _memory_mb(),
                )
    finally:
        if out_handle is not sys.stdout:
            out_handle.close()

    summary = detector.summary()
    LOGGER.info("summary: %s", json.dumps(summary, ensure_ascii=False))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
