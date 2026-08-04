"""Small, swappable adapter for Nominatim-compatible geocoders.

The adapter intentionally does not perform any background or bulk requests.
Callers must opt in for a single address lookup and persist their own result.
"""

from __future__ import annotations

import asyncio
import re
from dataclasses import dataclass
from time import monotonic
from typing import Any

import httpx

from app.config import settings


@dataclass(frozen=True)
class GeocodedAddress:
    latitude: float
    longitude: float
    display_name: str
    provider: str


_ADDRESS_SUFFIX_TERMS = (
    "\u0432\u0431\u043b\u0438\u0437\u0438",
    "\u0432 \u043f\u0440\u0435\u0434\u0435\u043b\u0430\u0445",
    "\u0432 \u0440\u0430\u0439\u043e\u043d\u0435",
    "\u0440\u0430\u0439\u043e\u043d",
    "\u043e\u043f\u043e\u0440\u0430",
    "\u043c\u0430\u0447\u0442\u0430",
    "\u0431\u0430\u0448\u043d\u044f",
    "\u0442\u0435\u0445\u043d\u043e\u043b\u043e\u0433\u0438\u0447\u0435\u0441\u043a\u043e\u0435 \u0438\u0441\u043f\u043e\u043b\u044c\u0437\u043e\u0432\u0430\u043d\u0438\u0435",
)
_ADDRESS_SUFFIX_RE = re.compile(
    r"\s*,\s*(?:" + "|".join(re.escape(value) for value in _ADDRESS_SUFFIX_TERMS) + r")\b.*$",
    re.IGNORECASE,
)


def address_query_variants(address: str) -> list[str]:
    """Return practical postal-address variants from telecom station descriptions."""
    source = re.sub(r"\s+", " ", str(address or "")).strip(" ,;")
    if not source:
        return []

    variants: list[str] = []

    def add(value: str) -> None:
        value = re.sub(r"\s+", " ", value).strip(" ,;")
        if value and value not in variants:
            variants.append(value)

    city_match = re.search(r"(?:\b\u0433\.?\s+|\b\u0433\u043e\u0440\u043e\u0434\s+)([^,]+)", source, flags=re.IGNORECASE)
    city = city_match.group(1).strip() if city_match else ""
    cleaned = re.sub(r"^\d{6}\s*,\s*", "", source)
    cleaned = re.sub(r"\b\u0433\.?\s+", "", cleaned, flags=re.IGNORECASE)
    cleaned = re.sub(r"\b\u0443\u043b\.?\s+", "\u0443\u043b\u0438\u0446\u0430 ", cleaned, flags=re.IGNORECASE)
    cleaned = re.sub(r"\b\u0448\.?\s+", "\u0448\u043e\u0441\u0441\u0435 ", cleaned, flags=re.IGNORECASE)
    cleaned = re.sub(r"\b\u043f\u0440-?\u043a\u0442\.?\s+", "\u043f\u0440\u043e\u0441\u043f\u0435\u043a\u0442 ", cleaned, flags=re.IGNORECASE)
    cleaned = re.sub(r"\b\u0434\u043e\u043c\s+", "\u0434\u043e\u043c ", cleaned, flags=re.IGNORECASE)
    add(_ADDRESS_SUFFIX_RE.sub("", cleaned))
    add(cleaned)
    if city:
        add(f"{city}, \u0420\u043e\u0441\u0441\u0438\u044f")
    add(source)
    return variants


class NominatimGeocoder:
    """Nominatim-compatible geocoder with a process-local rate guard."""

    _last_request_at = 0.0
    _lock = asyncio.Lock()

    def __init__(self) -> None:
        self.base_url = settings.GEOCODER_BASE_URL.rstrip("/")

    async def search(self, address: str) -> GeocodedAddress | None:
        query = str(address or "").strip()
        if not settings.GEOCODER_ENABLED or not query:
            return None

        async with self._lock:
            elapsed = monotonic() - self._last_request_at
            wait_for = max(0.0, settings.GEOCODER_MIN_INTERVAL_SECONDS - elapsed)
            if wait_for:
                await asyncio.sleep(wait_for)
            self._last_request_at = monotonic()

            async with httpx.AsyncClient(timeout=settings.GEOCODER_TIMEOUT_SECONDS) as client:
                for candidate in address_query_variants(query):
                    response = await client.get(
                        f"{self.base_url}/search",
                        params={"q": candidate, "format": "jsonv2", "limit": 1, "countrycodes": "ru"},
                        headers={"User-Agent": settings.GEOCODER_USER_AGENT},
                    )
                    response.raise_for_status()
                    payload: Any = response.json()
                    if not isinstance(payload, list) or not payload or not isinstance(payload[0], dict):
                        continue
                    item = payload[0]
                    display_name = str(item.get("display_name") or candidate)
                    locality_match = re.search(r"(?:\b\u0433\.?\s+|\b\u0433\u043e\u0440\u043e\u0434\s+)([^,]+)", query, flags=re.IGNORECASE)
                    locality = locality_match.group(1).strip() if locality_match else ""
                    if locality and locality.casefold() not in display_name.casefold():
                        continue
                    try:
                        return GeocodedAddress(
                            latitude=float(item["lat"]),
                            longitude=float(item["lon"]),
                            display_name=display_name,
                            provider=self.base_url,
                        )
                    except (KeyError, TypeError, ValueError):
                        continue
        return None
