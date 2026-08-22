"""Serve vector tiles from an internal PMTiles archive.

The closed contour stores the base map as one remote PMTiles file.  Reading
that archive in the application keeps the browser on the standard MVT HTTP
path and avoids relying on a custom WebWorker protocol.
"""

from __future__ import annotations

import gzip
import logging
import os
import struct
from collections import OrderedDict
from dataclasses import dataclass
from typing import Dict, Optional

import httpx
from fastapi import APIRouter, HTTPException, Response


router = APIRouter()
logger = logging.getLogger(__name__)


def _read_varint(data: bytes, offset: int) -> tuple[int, int]:
    value = 0
    shift = 0
    while offset < len(data):
        byte = data[offset]
        offset += 1
        value |= (byte & 0x7F) << shift
        if not byte & 0x80:
            return value, offset
        shift += 7
    raise ValueError("truncated PMTiles directory")


def _rotate(n: int, x: int, y: int, rx: int, ry: int) -> tuple[int, int]:
    if ry == 0:
        if rx == 1:
            x = n - 1 - x
            y = n - 1 - y
        x, y = y, x
    return x, y


def _zxy_to_tile_id(z: int, x: int, y: int) -> int:
    """Convert XYZ coordinates to the PMTiles v3 Hilbert tile identifier."""
    if z < 0 or z > 31 or x < 0 or y < 0 or x >= 1 << z or y >= 1 << z:
        raise ValueError("invalid tile coordinates")
    d = 0
    n = 1 << z
    scale = n >> 1
    current_x, current_y = x, y
    while scale:
        rx = 1 if current_x & scale else 0
        ry = 1 if current_y & scale else 0
        d += scale * scale * ((3 * rx) ^ ry)
        current_x, current_y = _rotate(scale, current_x, current_y, rx, ry)
        scale >>= 1
    return ((1 << (2 * z)) - 1) // 3 + d


@dataclass(frozen=True)
class _DirectoryEntry:
    tile_id: int
    run_length: int
    length: int
    offset: int


def _deserialize_directory(data: bytes) -> list[_DirectoryEntry]:
    count, cursor = _read_varint(data, 0)
    tile_ids: list[int] = []
    previous_id = 0
    for _ in range(count):
        delta, cursor = _read_varint(data, cursor)
        previous_id += delta
        tile_ids.append(previous_id)
    runs: list[int] = []
    for _ in range(count):
        value, cursor = _read_varint(data, cursor)
        runs.append(value)
    lengths: list[int] = []
    for _ in range(count):
        value, cursor = _read_varint(data, cursor)
        lengths.append(value)
    offsets: list[int] = []
    previous_offset = 0
    previous_length = 0
    for _ in range(count):
        value, cursor = _read_varint(data, cursor)
        offset = previous_offset + previous_length if value == 0 else value - 1
        offsets.append(offset)
        previous_offset, previous_length = offset, lengths[len(offsets) - 1]
    return [
        _DirectoryEntry(tile_ids[index], runs[index], lengths[index], offsets[index])
        for index in range(count)
    ]


class PMTilesHttpReader:
    """Cached PMTiles v3 reader backed by a pooled HTTP Range client."""

    def __init__(self, url: str) -> None:
        self.url = url
        self._header: Optional[dict[str, int]] = None
        self._directories: Dict[tuple[int, int], list[_DirectoryEntry]] = {}
        self._tiles: OrderedDict[tuple[int, int, int], tuple[bytes, int]] = OrderedDict()
        self._client = httpx.AsyncClient(
            timeout=httpx.Timeout(30.0, connect=5.0),
            limits=httpx.Limits(max_connections=24, max_keepalive_connections=12, keepalive_expiry=90.0),
        )

    async def _read_range(self, start: int, length: int) -> bytes:
        response = await self._client.get(
            self.url,
            headers={"Range": f"bytes={start}-{start + length - 1}"},
        )
        response.raise_for_status()
        return response.content

    async def _get_header(self) -> dict[str, int]:
        if self._header is not None:
            return self._header
        header = await self._read_range(0, 127)
        if header[:7] != b"PMTiles" or header[7] != 3:
            raise RuntimeError("the configured map is not a PMTiles v3 archive")
        self._header = {
            "root_offset": struct.unpack_from("<Q", header, 8)[0],
            "root_length": struct.unpack_from("<Q", header, 16)[0],
            "leaf_offset": struct.unpack_from("<Q", header, 40)[0],
            "tile_offset": struct.unpack_from("<Q", header, 56)[0],
            "internal_compression": header[97],
            "tile_compression": header[98],
        }
        return self._header

    async def _directory(self, offset: int, length: int, compression: int) -> list[_DirectoryEntry]:
        cache_key = (offset, length)
        if cache_key not in self._directories:
            payload = await self._read_range(offset, length)
            if compression == 2:
                payload = gzip.decompress(payload)
            self._directories[cache_key] = _deserialize_directory(payload)
        return self._directories[cache_key]

    async def get_tile(self, z: int, x: int, y: int) -> tuple[Optional[bytes], int]:
        cache_key = (z, x, y)
        cached = self._tiles.get(cache_key)
        if cached is not None:
            self._tiles.move_to_end(cache_key)
            return cached
        header = await self._get_header()
        tile_id = _zxy_to_tile_id(z, x, y)
        directory_offset = header["root_offset"]
        directory_length = header["root_length"]
        for _ in range(4):
            entries = await self._directory(directory_offset, directory_length, header["internal_compression"])
            candidate = next((entry for entry in reversed(entries) if entry.tile_id <= tile_id), None)
            if candidate is None:
                return None, header["tile_compression"]
            if candidate.run_length == 0:
                directory_offset = header["leaf_offset"] + candidate.offset
                directory_length = candidate.length
                continue
            if tile_id >= candidate.tile_id + candidate.run_length:
                return None, header["tile_compression"]
            tile = await self._read_range(header["tile_offset"] + candidate.offset, candidate.length)
            # Keep the viewport warm while putting a hard ceiling on memory.  The
            # browser also caches responses, so this chiefly helps repeated pans
            # and concurrent maps inside one Nodex session.
            if len(tile) <= 2 * 1024 * 1024:
                self._tiles[cache_key] = (tile, header["tile_compression"])
                self._tiles.move_to_end(cache_key)
                while len(self._tiles) > 192:
                    self._tiles.popitem(last=False)
            return tile, header["tile_compression"]
        raise RuntimeError("PMTiles directory nesting is too deep")

    async def close(self) -> None:
        await self._client.aclose()


_reader: Optional[PMTilesHttpReader] = None


def _get_reader() -> PMTilesHttpReader:
    global _reader
    # This module is also served by the dedicated map sidecar, which does not
    # initialise the database/application settings.  Keep it dependent only
    # on the one environment value it actually needs.
    url = os.getenv("MAP_PMTILES_URL", "").strip()
    if not url:
        raise HTTPException(status_code=503, detail="Local map archive is not configured")
    if _reader is None or _reader.url != url:
        _reader = PMTilesHttpReader(url)
    return _reader


async def close_reader() -> None:
    global _reader
    if _reader is not None:
        await _reader.close()
        _reader = None


@router.get("/tiles/{z}/{x}/{y}.pbf", include_in_schema=False)
async def vector_tile(z: int, x: int, y: int) -> Response:
    """Return one standard vector tile from the configured PMTiles archive."""
    try:
        tile, compression = await _get_reader().get_tile(z, x, y)
    except HTTPException:
        raise
    except Exception as exc:
        logger.warning("Unable to read PMTiles tile %s/%s/%s: %s", z, x, y, exc)
        raise HTTPException(status_code=502, detail="The local map archive is unavailable") from exc
    if tile is None:
        return Response(status_code=204, headers={"Cache-Control": "public, max-age=86400"})
    headers = {"Cache-Control": "public, max-age=86400"}
    if compression == 2:
        headers["Content-Encoding"] = "gzip"
    return Response(content=tile, media_type="application/vnd.mapbox-vector-tile", headers=headers)
