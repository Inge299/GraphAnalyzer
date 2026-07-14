from __future__ import annotations

from dataclasses import dataclass

from .domain_utils import extract_etld1, normalize_domain
from .references import ReferenceData


@dataclass
class CategoryResult:
    category: str | None
    confidence: float | None
    source: str | None
    matched_pattern: str | None


@dataclass
class MessengerResult:
    is_messenger: bool
    app_name: str | None
    confidence: float | None
    matched_pattern: str | None


class DomainCategorizer:
    def __init__(self, refs: ReferenceData):
        self.refs = refs
        self._exact_patterns = {}
        self._wildcard_patterns = {}
        self._regex_patterns = []
        self._cache: dict[str, CategoryResult] = {}
        for record in self.refs.domain_categories:
            p = record.pattern
            if p.pattern_type == "exact" and p.value:
                self._exact_patterns[p.value] = record
            elif p.pattern_type == "wildcard" and p.value:
                self._wildcard_patterns[p.value] = record
            elif p.pattern_type == "regex":
                self._regex_patterns.append(record)

    def categorize(self, domain: str | None) -> CategoryResult:
        normalized = normalize_domain(domain)
        if not normalized:
            return CategoryResult(category=None, confidence=None, source=None, matched_pattern=None)
        cached = self._cache.get(normalized)
        if cached is not None:
            return cached

        etld1 = extract_etld1(normalized, self.refs)

        for candidate in (normalized, etld1):
            if not candidate:
                continue
            record = self._exact_patterns.get(candidate)
            if record is not None:
                result = CategoryResult(
                    category=_normalize_category(record.category),
                    confidence=record.confidence,
                    source=record.source or "domain_category_seed_extended.csv",
                    matched_pattern=record.pattern.raw,
                )
                self._cache[normalized] = result
                return result

        for candidate in (normalized, etld1):
            if not candidate:
                continue
            labels = [x for x in candidate.split(".") if x]
            for i in range(1, len(labels)):
                suffix = ".".join(labels[i:])
                record = self._wildcard_patterns.get(suffix)
                if record is not None:
                    result = CategoryResult(
                        category=_normalize_category(record.category),
                        confidence=record.confidence,
                        source=record.source or "domain_category_seed_extended.csv",
                        matched_pattern=record.pattern.raw,
                    )
                    self._cache[normalized] = result
                    return result

        for record in self._regex_patterns:
            if record.pattern.matches(normalized) or (etld1 and record.pattern.matches(etld1)):
                result = CategoryResult(
                    category=_normalize_category(record.category),
                    confidence=record.confidence,
                    source=record.source or "domain_category_seed_extended.csv",
                    matched_pattern=record.pattern.raw,
                )
                self._cache[normalized] = result
                return result

        top = self.refs.top_domains.get(normalized) or (self.refs.top_domains.get(etld1) if etld1 else None)
        if top is not None:
            category = _normalize_category(top.category or "unknown")
            result = CategoryResult(
                category=category,
                confidence=0.8,
                source="top-1m.csv",
                matched_pattern=etld1 or normalized,
            )
            self._cache[normalized] = result
            return result

        inferred = _heuristic_category(normalized)
        if inferred is not None:
            result = CategoryResult(category=inferred, confidence=0.6, source="heuristic", matched_pattern=None)
            self._cache[normalized] = result
            return result

        result = CategoryResult(category="unknown", confidence=0.2, source="fallback", matched_pattern=None)
        self._cache[normalized] = result
        return result


def _normalize_category(value: str | None) -> str:
    raw = str(value or "").strip().lower().replace("-", "_").replace(" ", "_")
    if not raw:
        return "unknown"
    mapping = {
        "search_engine": "search",
        "search": "search",
        "video_streaming": "video",
        "video": "video",
        "messaging": "messenger",
        "messenger": "messenger",
        "messengers": "messenger",
        "social_network": "social",
        "social": "social",
        "finance_and_banking": "finance",
        "finance": "finance",
        "shopping": "shopping",
        "ecommerce": "shopping",
        "media": "video",
        "cdn": "cdn",
        "cloud": "cdn",
        "cloud_services": "cloud_storage",
        "ads": "ads_analytics",
        "analytics": "ads_analytics",
        "ads_analytics": "ads_analytics",
        "mobile_oem": "mobile_oem",
        "apple_service": "apple_service",
        "apple_push": "apple_push",
        "security": "security",
        "travel": "travel",
        "dns": "dns",
        "software_update": "software_update",
        "webrtc_stun": "webrtc_stun",
        "background_service": "background_service",
        "unknown": "unknown",
        "other": "unknown",
    }
    return mapping.get(raw, raw)


class MessengerDetector:
    def __init__(self, refs: ReferenceData):
        self.refs = refs

    def detect(self, domain: str | None) -> MessengerResult:
        normalized = normalize_domain(domain)
        if not normalized:
            return MessengerResult(False, None, None, None)

        etld1 = extract_etld1(normalized, self.refs)
        for pattern in self.refs.messaging_patterns:
            if pattern.matches(normalized) or (etld1 is not None and pattern.matches(etld1)):
                return MessengerResult(
                    is_messenger=True,
                    app_name=pattern.meta.get("app_name"),
                    confidence=pattern.meta.get("confidence"),
                    matched_pattern=pattern.raw,
                )

        lowered = normalized.lower()
        if "telegram" in lowered:
            return MessengerResult(True, "Telegram", 0.7, "heuristic:telegram")
        if "whatsapp" in lowered:
            return MessengerResult(True, "WhatsApp", 0.7, "heuristic:whatsapp")
        if "viber" in lowered:
            return MessengerResult(True, "Viber", 0.7, "heuristic:viber")
        if "signal" in lowered:
            return MessengerResult(True, "Signal", 0.7, "heuristic:signal")
        if "discord" in lowered:
            return MessengerResult(True, "Discord", 0.7, "heuristic:discord")
        if "vk.com" in lowered or "vkuseraudio" in lowered or "vk-cdn" in lowered:
            return MessengerResult(True, "VK", 0.65, "heuristic:vk")

        return MessengerResult(False, None, None, None)


def _heuristic_category(domain: str) -> str | None:
    lowered = domain.lower()

    if any(k in lowered for k in ["google", "yandex", "bing"]):
        return "search"
    if any(k in lowered for k in ["youtube", "rutube", "video", "cdnvideo"]):
        return "video"
    if any(k in lowered for k in ["telegram", "whatsapp", "viber", "signal", "discord"]):
        return "messenger"
    if any(k in lowered for k in ["bank", "sber", "tinkoff", "vtb", "alfabank"]):
        return "finance"
    if any(k in lowered for k in ["market", "shop", "ozon", "wildberries", "aliexpress"]):
        return "shopping"
    if any(k in lowered for k in ["firebase", "crashlytics", "appsflyer", "appmetrica"]):
        return "ads_analytics"
    if any(k in lowered for k in ["garmin", "fitbit", "strava"]):
        return "health"
    if any(k in lowered for k in ["cloudflare", "akamai", "fastly", "cdn"]):
        return "cdn"

    return None
