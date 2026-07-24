"""Small, swappable adapter for Nominatim-compatible geocoders.

The adapter intentionally does not perform any background or bulk requests.
Callers must opt in for a single address lookup and persist their own result.
"""

from __future__ import annotations

import asyncio
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
                response = await client.get(
                    f"{self.base_url}/search",
                    params={"q": query, "format": "jsonv2", "limit": 1},
                    headers={"User-Agent": settings.GEOCODER_USER_AGENT},
                )
                response.raise_for_status()

        payload: Any = response.json()
        if not isinstance(payload, list) or not payload or not isinstance(payload[0], dict):
            return None
        item = payload[0]
        try:
            return GeocodedAddress(
                latitude=float(item["lat"]),
                longitude=float(item["lon"]),
                display_name=str(item.get("display_name") or query),
                provider=self.base_url,
            )
        except (KeyError, TypeError, ValueError):
            return None
