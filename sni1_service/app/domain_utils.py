from __future__ import annotations

import ipaddress
import re
from dataclasses import dataclass, field
from pathlib import Path
from urllib.parse import urlsplit

from .utils import clean_text, parse_int


@dataclass
class DomainPattern:
    raw: str
    pattern_type: str
    value: str | None = None
    regex: re.Pattern[str] | None = None
    meta: dict = field(default_factory=dict)

    def matches(self, domain: str) -> bool:
        normalized = normalize_domain(domain)
        if not normalized:
            return False

        if self.pattern_type == "exact":
            return normalized == self.value

        if self.pattern_type == "wildcard":
            if not self.value:
                return False
            return normalized.endswith(f".{self.value}")

        if self.pattern_type == "regex" and self.regex is not None:
            return bool(self.regex.search(normalized))

        return False


def parse_endpoint(value: str) -> tuple[str | None, int | None]:
    text = clean_text(value, treat_zero_as_null=True)
    if text is None:
        return (None, None)

    compact = re.sub(r"\s+", "", text)
    ip_part: str
    port_part: str | None

    if "/" in compact:
        ip_part, port_part = compact.split("/", 1)
    elif ":" in compact:
        ip_part, port_part = compact.rsplit(":", 1)
    else:
        ip_part, port_part = compact, None

    try:
        parsed_ip = str(ipaddress.ip_address(ip_part))
    except ValueError:
        return (None, None)

    if port_part is None:
        return (parsed_ip, None)

    port = parse_int(port_part)
    if port is None or not (1 <= port <= 65535):
        return (parsed_ip, None)

    return (parsed_ip, port)


def normalize_domain(value: str | None) -> str | None:
    text = clean_text(value, treat_zero_as_null=True)
    if text is None:
        return None

    text = text.strip().lower()

    if "://" in text:
        parsed = urlsplit(text)
        text = parsed.netloc or parsed.path

    text = text.split("/", 1)[0].split("?", 1)[0].split("#", 1)[0]

    if ":" in text and text.count(":") == 1:
        host_part, port_part = text.rsplit(":", 1)
        if port_part.isdigit():
            text = host_part

    text = text.strip(".").strip()
    if not text:
        return None

    lowered = text.lower()
    if lowered in {"0", "-", "null", "none"}:
        return None

    return lowered


def parse_sni_list(value: str) -> list[str]:
    text = clean_text(value, treat_zero_as_null=True)
    if text is None:
        return []

    results: list[str] = []
    for raw_part in text.split(","):
        part = normalize_domain(raw_part)
        if not part or part == "localhost":
            continue
        if "." not in part:
            continue
        if re.fullmatch(r"[a-z0-9._-]+", part) is None:
            continue
        results.append(part)

    unique: list[str] = []
    seen: set[str] = set()
    for item in results:
        if item not in seen:
            unique.append(item)
            seen.add(item)

    return unique


def compile_domain_pattern(pattern: str) -> DomainPattern:
    raw = (pattern or "").strip()
    if raw.startswith("re:"):
        regex_text = raw[3:].strip()
        return DomainPattern(raw=raw, pattern_type="regex", regex=re.compile(regex_text, flags=re.IGNORECASE))

    normalized = normalize_domain(raw)
    if not normalized:
        return DomainPattern(raw=raw, pattern_type="exact", value="")

    if normalized.startswith("*."):
        return DomainPattern(raw=raw, pattern_type="wildcard", value=normalized[2:])

    return DomainPattern(raw=raw, pattern_type="exact", value=normalized)


def domain_matches_pattern(domain: str, pattern: str) -> bool:
    compiled = compile_domain_pattern(pattern)
    return compiled.matches(domain)


def _extract_with_local_psl(domain: str, suffixes: set[str]) -> str | None:
    labels = [label for label in domain.split(".") if label]
    if len(labels) < 2:
        return None

    longest_suffix_len = 0
    for i in range(len(labels)):
        suffix = ".".join(labels[i:])
        if suffix in suffixes:
            longest_suffix_len = max(longest_suffix_len, len(labels) - i)

    if longest_suffix_len == 0:
        return ".".join(labels[-2:])

    if len(labels) <= longest_suffix_len:
        return domain

    registrable = labels[-(longest_suffix_len + 1):]
    return ".".join(registrable)


def extract_etld1(domain: str | None, refs: object | None = None) -> str | None:
    normalized = normalize_domain(domain)
    if not normalized:
        return None

    psl_suffixes = getattr(refs, "psl_suffixes", None) if refs is not None else None
    if isinstance(psl_suffixes, set) and psl_suffixes:
        return _extract_with_local_psl(normalized, psl_suffixes)

    psl_path = getattr(refs, "psl_path", None) if refs is not None else None
    if psl_path:
        try:
            import tldextract  # type: ignore

            extractor = tldextract.TLDExtract(
                suffix_list_urls=(Path(psl_path).resolve().as_uri(),),
                cache_dir=None,
                fallback_to_snapshot=False,
            )
            parsed = extractor(normalized)
            if parsed.domain and parsed.suffix:
                return f"{parsed.domain}.{parsed.suffix}"
        except Exception:
            pass

    labels = [label for label in normalized.split(".") if label]
    if len(labels) < 2:
        return None

    # Fallback without PSL/tldextract.
    return ".".join(labels[-2:])


def extract_device_id_from_filename(path: str) -> str | None:
    filename = Path(path).name
    match = re.search(r"(\d{10,16})", filename)
    return match.group(1) if match else None
