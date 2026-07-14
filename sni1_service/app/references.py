from __future__ import annotations

import csv
import ipaddress
import json
import re
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any

from .asn import ASNDatabase
from .domain_utils import DomainPattern, compile_domain_pattern, normalize_domain
from .utils import get_logger, log_event


@dataclass
class NetworkRecord:
    network: ipaddress.IPv4Network | ipaddress.IPv6Network
    meta: dict[str, Any] = field(default_factory=dict)


@dataclass
class TopDomainRecord:
    rank: int
    category: str | None


@dataclass
class DomainCategoryPattern:
    pattern: DomainPattern
    category: str
    confidence: float | None
    source: str | None


@dataclass
class ReferenceStatus:
    loaded_files: dict[str, int] = field(default_factory=dict)
    missing_files: list[str] = field(default_factory=list)
    failed_files: dict[str, str] = field(default_factory=dict)
    warnings: list[str] = field(default_factory=list)


@dataclass
class ReferenceData:
    vpn_ja3: dict[str, dict[str, Any]] = field(default_factory=dict)
    app_ja3: dict[str, dict[str, Any]] = field(default_factory=dict)

    vpn_infra_networks: list[NetworkRecord] = field(default_factory=list)
    expected_asn: dict[str, set[int]] = field(default_factory=dict)
    asn_db: ASNDatabase = field(default_factory=lambda: ASNDatabase([]))

    cloud_networks: list[NetworkRecord] = field(default_factory=list)
    cloud_providers_by_network: list[NetworkRecord] = field(default_factory=list)

    messaging_patterns: list[DomainPattern] = field(default_factory=list)
    top_domains: dict[str, TopDomainRecord] = field(default_factory=dict)
    domain_categories: list[DomainCategoryPattern] = field(default_factory=list)

    custom_pairs: set[tuple[str, str]] = field(default_factory=set)
    alt_dns_networks: list[NetworkRecord] = field(default_factory=list)

    psl_path: Path | None = None
    psl_suffixes: set[str] = field(default_factory=set)

    status: ReferenceStatus = field(default_factory=ReferenceStatus)


def parse_network(value: str) -> ipaddress.IPv4Network | ipaddress.IPv6Network | None:
    raw = str(value or "").strip()
    if not raw:
        return None

    try:
        if "/" in raw:
            return ipaddress.ip_network(raw, strict=False)
        ip_obj = ipaddress.ip_address(raw)
        prefix = 32 if ip_obj.version == 4 else 128
        return ipaddress.ip_network(f"{raw}/{prefix}", strict=False)
    except ValueError:
        return None


def ip_in_network_records(ip: str, records: list[NetworkRecord]) -> NetworkRecord | None:
    try:
        ip_obj = ipaddress.ip_address(ip)
    except ValueError:
        return None

    for record in records:
        if ip_obj.version != record.network.version:
            continue
        if ip_obj in record.network:
            return record
    return None


class ReferenceLoader:
    SUPPORTED_FILES = [
        "vpn_ja3_signatures.csv",
        "ja3_app_db_full.csv",
        "vpn_infra_ioc.csv",
        "vpn_infra_ioc_full.csv",
        "expected_asn_map.json",
        "expected_asn_map_full.csv",
        "asn_db.csv",
        "cloud_prefixes.json",
        "cloud_prefixes_full.json",
        "public_suffix_list.dat",
        "known_messaging_domains.csv",
        "known_messaging_domains_full.csv",
        "top-1m.csv",
        "domain_category_seed_extended.csv",
        "vpn_custom_pairs.csv",
        "alt_dns_ioc.csv",
    ]

    def __init__(self, refs_dir: str | Path | None = None):
        self.refs_dir = Path(refs_dir) if refs_dir is not None else None
        self.logger = get_logger(__name__)

    def load_all(self) -> ReferenceData:
        """Load all known reference datasets with graceful degradation."""
        refs = ReferenceData()

        if self.refs_dir is None:
            refs.status.missing_files.extend(self.SUPPORTED_FILES)
            refs.status.warnings.append("refs_dir is not set; running without external references")
            log_event(self.logger, "references.load_all.no_refs_dir")
            return refs

        if not self.refs_dir.exists():
            refs.status.missing_files.extend(self.SUPPORTED_FILES)
            refs.status.warnings.append(f"refs_dir does not exist: {self.refs_dir}")
            log_event(self.logger, "references.load_all.refs_dir_missing", refs_dir=str(self.refs_dir))
            return refs

        log_event(self.logger, "references.load_all.start", refs_dir=str(self.refs_dir))
        for filename in self.SUPPORTED_FILES:
            path = self.refs_dir / filename
            if not path.exists():
                refs.status.missing_files.append(filename)
                continue

            try:
                self._load_file(filename, path, refs)
            except Exception as exc:
                refs.status.failed_files[filename] = str(exc)

        log_event(
            self.logger,
            "references.load_all.done",
            loaded_files=refs.status.loaded_files,
            missing_files=refs.status.missing_files,
            failed_files=refs.status.failed_files,
            warnings_count=len(refs.status.warnings),
        )
        return refs

    def _load_file(self, filename: str, path: Path, refs: ReferenceData) -> None:
        if filename == "vpn_ja3_signatures.csv":
            count = self._load_ja3(path, refs.vpn_ja3)
        elif filename == "ja3_app_db_full.csv":
            count = self._load_ja3(path, refs.app_ja3)
        elif filename == "vpn_infra_ioc.csv":
            count = self._load_network_csv(path, refs.vpn_infra_networks, ip_col="ip_or_cidr", refs=refs)
        elif filename == "vpn_infra_ioc_full.csv":
            count = self._load_network_csv(path, refs.vpn_infra_networks, ip_col="ip_or_cidr", refs=refs)
        elif filename == "expected_asn_map.json":
            count = self._load_expected_asn_json(path, refs)
        elif filename == "expected_asn_map_full.csv":
            count = self._load_expected_asn(path, refs)
        elif filename == "asn_db.csv":
            refs.asn_db = ASNDatabase.from_csv(path)
            count = len(refs.asn_db.ranges)
        elif filename == "cloud_prefixes.json":
            count = self._load_cloud_json(path, refs)
        elif filename == "cloud_prefixes_full.json":
            count = self._load_cloud_json(path, refs)
        elif filename == "public_suffix_list.dat":
            count = self._load_psl(path, refs)
        elif filename == "known_messaging_domains.csv":
            count = self._load_messaging_patterns(path, refs)
        elif filename == "known_messaging_domains_full.csv":
            count = self._load_messaging_patterns(path, refs)
        elif filename == "top-1m.csv":
            count = self._load_top_domains(path, refs)
        elif filename == "domain_category_seed_extended.csv":
            count = self._load_domain_categories(path, refs)
        elif filename == "vpn_custom_pairs.csv":
            count = self._load_custom_pairs(path, refs)
        elif filename == "alt_dns_ioc.csv":
            count = self._load_network_csv(path, refs.alt_dns_networks, ip_col="ip_or_cidr", refs=refs)
        else:
            count = 0

        refs.status.loaded_files[filename] = count

    def _read_csv_rows(self, path: Path) -> list[dict[str, str]]:
        for encoding in ("utf-8-sig", "cp1251", "latin-1"):
            try:
                with path.open("r", encoding=encoding, newline="") as f:
                    return list(csv.DictReader(f))
            except UnicodeDecodeError:
                continue
        raise UnicodeDecodeError("unknown", b"", 0, 1, f"Unable to decode CSV: {path}")

    def _load_ja3(self, path: Path, target: dict[str, dict[str, Any]]) -> int:
        count = 0
        for row in self._read_csv_rows(path):
            ja3 = str(row.get("ja3_hash") or "").strip().lower()
            if not ja3:
                continue
            target[ja3] = {k: v for k, v in row.items()}
            count += 1
        return count

    def _load_expected_asn(self, path: Path, refs: ReferenceData) -> int:
        count = 0
        for row in self._read_csv_rows(path):
            domain = normalize_domain(row.get("domain"))
            if not domain:
                continue

            expected_raw = str(row.get("expected_asn") or "")
            numbers = {int(m.group(1)) for m in re.finditer(r"(?:AS)?(\d+)", expected_raw, flags=re.IGNORECASE)}
            if not numbers:
                continue

            refs.expected_asn[domain] = numbers
            count += 1
        return count

    def _load_expected_asn_json(self, path: Path, refs: ReferenceData) -> int:
        data = json.loads(path.read_text(encoding="utf-8-sig"))
        if not isinstance(data, dict):
            return 0
        count = 0
        for raw_domain, payload in data.items():
            domain = normalize_domain(raw_domain)
            if not domain or not isinstance(payload, dict):
                continue
            values = payload.get("expected_asn") or []
            numbers: set[int] = set()
            if isinstance(values, list):
                for v in values:
                    try:
                        numbers.add(int(v))
                    except (TypeError, ValueError):
                        continue
            if numbers:
                refs.expected_asn[domain] = numbers
                count += 1
        return count

    def _load_network_csv(
        self,
        path: Path,
        target: list[NetworkRecord],
        *,
        ip_col: str,
        refs: ReferenceData,
    ) -> int:
        count = 0
        rows = self._read_csv_rows(path)
        for row in rows:
            raw_value = str(row.get(ip_col) or "")
            net = parse_network(raw_value)
            if net is None:
                refs.status.warnings.append(f"Invalid network '{raw_value}' in {path.name}")
                continue
            target.append(NetworkRecord(network=net, meta={k: v for k, v in row.items()}))
            count += 1
        return count

    def _load_cloud_json(self, path: Path, refs: ReferenceData) -> int:
        data = json.loads(path.read_text(encoding="utf-8-sig"))
        providers: dict[str, Any]
        if isinstance(data, dict) and "providers" in data and isinstance(data.get("providers"), dict):
            providers = data.get("providers") or {}
        elif isinstance(data, dict):
            providers = data
        else:
            providers = {}
        count = 0
        for provider, payload in providers.items():
            if isinstance(payload, dict):
                prefixes = payload.get("prefixes") or []
            else:
                prefixes = payload or []
            for prefix in prefixes:
                net = parse_network(str(prefix))
                if net is None:
                    refs.status.warnings.append(f"Invalid cloud prefix {prefix} in {path.name}")
                    continue
                record = NetworkRecord(network=net, meta={"provider": provider})
                refs.cloud_networks.append(record)
                refs.cloud_providers_by_network.append(record)
                count += 1
        return count

    def _load_psl(self, path: Path, refs: ReferenceData) -> int:
        refs.psl_path = path
        suffixes: set[str] = set()
        for line in path.read_text(encoding="utf-8-sig").splitlines():
            value = line.strip().lower()
            if not value or value.startswith("//"):
                continue
            if value.startswith("!"):
                value = value[1:]
            if value.startswith("*."):
                value = value[2:]
            suffixes.add(value)
        refs.psl_suffixes = suffixes
        return len(suffixes)

    def _load_messaging_patterns(self, path: Path, refs: ReferenceData) -> int:
        count = 0
        for row in self._read_csv_rows(path):
            raw_pattern = str(row.get("pattern") or "").strip()
            if not raw_pattern:
                continue
            pattern = compile_domain_pattern(raw_pattern)
            pattern.meta = {
                "app_name": str(row.get("app_name") or "").strip() or None,
                "confidence": self._parse_float(row.get("confidence")),
                "source": str(row.get("source") or "").strip() or None,
            }
            refs.messaging_patterns.append(pattern)
            count += 1
        return count

    def _load_top_domains(self, path: Path, refs: ReferenceData) -> int:
        count = 0
        for row in self._read_csv_rows(path):
            domain = normalize_domain(row.get("domain"))
            rank_raw = str(row.get("rank") or "").strip()
            if not domain or not rank_raw.isdigit():
                continue
            refs.top_domains[domain] = TopDomainRecord(
                rank=int(rank_raw),
                category=str(row.get("category") or "").strip() or None,
            )
            count += 1
        return count

    def _load_domain_categories(self, path: Path, refs: ReferenceData) -> int:
        count = 0
        for row in self._read_csv_rows(path):
            raw_pattern = str(row.get("domain_or_wildcard") or "").strip()
            category = str(row.get("category") or "").strip()
            if not raw_pattern or not category:
                continue

            refs.domain_categories.append(
                DomainCategoryPattern(
                    pattern=compile_domain_pattern(raw_pattern),
                    category=category,
                    confidence=self._parse_float(row.get("confidence")),
                    source=str(row.get("source") or "").strip() or None,
                )
            )
            count += 1
        return count

    def _load_custom_pairs(self, path: Path, refs: ReferenceData) -> int:
        count = 0
        for row in self._read_csv_rows(path):
            domain = normalize_domain(row.get("domain_or_etld1") or row.get("domain"))
            ip_raw = str(row.get("ip_or_cidr") or row.get("ip") or "").strip()
            net = parse_network(ip_raw)
            if not domain:
                continue
            if net is None:
                continue
            refs.custom_pairs.add((domain, str(net)))
            count += 1
        return count

    @staticmethod
    def _parse_float(value: Any) -> float | None:
        if value is None:
            return None
        text = str(value).strip()
        if not text:
            return None
        try:
            return float(text)
        except ValueError:
            return None
