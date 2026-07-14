from __future__ import annotations

REQUIRED_TABLES = [
    "overview",
    "behavior_profile",
    "data_quality",
    "top_domains",
    "unknown_domains",
    "top_ips",
    "categories",
    "topics",
    "interest_profile",
    "protocols",
    "messengers",
    "vpn",
    "vpn_detector",
    "vpn_detector_hits",
    "alt_access",
    "gaps",
    "chronology",
    "hours",
    "days",
    "references",
    "detected_facts",
]

TABLE_ROW_LIMITS = {
    "chronology": 5000,
    "vpn_detector_hits": 5000,
    "alt_access": 5000,
    "gaps": 2000,
}


def build_console_tables(analytics: dict) -> dict[str, list[dict]]:
    tables: dict[str, list[dict]] = {}
    for key in REQUIRED_TABLES:
        value = analytics.get(key)
        if value is None:
            tables[key] = []
        elif isinstance(value, list):
            limit = TABLE_ROW_LIMITS.get(key)
            if limit is not None and len(value) > limit:
                tables[key] = value[:limit]
            else:
                tables[key] = value
        elif isinstance(value, dict):
            tables[key] = [value]
        else:
            tables[key] = []
    return tables
