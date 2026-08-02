from __future__ import annotations

import csv
import json
import shutil
import zipfile
from datetime import datetime
from pathlib import Path
from typing import Any

from fastapi import HTTPException

KNOWN_ENCODINGS = ("utf-8-sig", "cp1251", "cp866", "utf-8")
MISSING_TEXT_MARKERS = {"null", "none", "n/a", "na", "-"}
MAX_ARCHIVE_MEMBERS = 10_000
MAX_ARCHIVE_UNCOMPRESSED_BYTES = 10 * 1024 * 1024 * 1024
UPLOAD_CHUNK_SIZE = 8 * 1024 * 1024


def parse_iso_datetime(value: str) -> datetime | None:
    text_value = (value or "").strip()
    if not text_value:
        return None
    for fmt in ("%Y-%m-%d %H:%M:%S", "%Y-%m-%d"):
        try:
            return datetime.strptime(text_value, fmt)
        except ValueError:
            continue
    return None


def collect_input_files(source_dir: Path) -> list[dict[str, Any]]:
    files: list[dict[str, Any]] = []
    for path in sorted(source_dir.rglob("*")):
        if not path.is_file() or ".nodex-expanded" in path.parts:
            continue
        files.append(
            {
                "path": str(path.relative_to(source_dir)).replace("\\", "/"),
                "size_bytes": path.stat().st_size,
            }
        )
    return files


def _safe_archive_member_path(raw_name: str) -> Path | None:
    normalized = str(raw_name or "").replace("\\", "/").strip().lstrip("/")
    if not normalized:
        return None
    path = Path(normalized)
    if path.is_absolute() or any(part in {"", ".", ".."} for part in path.parts):
        return None
    return path


def expand_import_containers(source_dir: Path, input_files: list[dict[str, Any]]) -> list[dict[str, Any]]:
    """Expose archive members as regular virtual inputs for semantic import plugins."""

    root = source_dir.resolve()
    expanded_root = source_dir / ".nodex-expanded"
    expanded: list[dict[str, Any]] = []

    for index, input_file in enumerate(input_files, start=1):
        relative_path = Path(str(input_file.get("path") or ""))
        source_path = (source_dir / relative_path).resolve()
        if root not in source_path.parents or not source_path.is_file():
            continue

        if source_path.suffix.lower() != ".zip":
            expanded.append({**input_file, "display_path": str(relative_path).replace("\\", "/")})
            continue

        try:
            with zipfile.ZipFile(source_path) as archive:
                members = [info for info in archive.infolist() if not info.is_dir()]
                if len(members) > MAX_ARCHIVE_MEMBERS:
                    raise HTTPException(status_code=400, detail="Archive contains too many files")
                uncompressed_total = sum(max(0, int(info.file_size)) for info in members)
                if uncompressed_total > MAX_ARCHIVE_UNCOMPRESSED_BYTES:
                    raise HTTPException(status_code=400, detail="Archive is too large after extraction")

                for info in members:
                    member_path = _safe_archive_member_path(info.filename)
                    if member_path is None:
                        continue
                    target_path = expanded_root / f"{index:04d}" / member_path
                    target_path.parent.mkdir(parents=True, exist_ok=True)
                    with archive.open(info, "r") as source_stream, target_path.open("wb") as target_stream:
                        shutil.copyfileobj(source_stream, target_stream, length=1024 * 1024)

                    virtual_path = target_path.relative_to(source_dir)
                    expanded.append(
                        {
                            "path": str(virtual_path).replace("\\", "/"),
                            "display_path": f"{relative_path.as_posix()} :: {member_path.as_posix()}",
                            "container_path": relative_path.as_posix(),
                            "member_path": member_path.as_posix(),
                            "size_bytes": int(info.file_size),
                        }
                    )
        except zipfile.BadZipFile as exc:
            raise HTTPException(status_code=400, detail=f"Invalid ZIP archive: {relative_path.name}") from exc
        except OSError as exc:
            raise HTTPException(status_code=400, detail=f"Cannot read archive: {relative_path.name}") from exc

    if not expanded:
        raise HTTPException(status_code=400, detail="No importable files found")
    return expanded

def read_manifest(manifest_path: Path) -> dict[str, Any]:
    if not manifest_path.exists():
        return {}
    try:
        return json.loads(manifest_path.read_text(encoding="utf-8"))
    except Exception:
        return {}


def normalize_address(value: str | None) -> str | None:
    clean = str(value or "").strip().lower()
    if not clean or clean.casefold() in MISSING_TEXT_MARKERS:
        return None
    normalized = "".join(char for char in clean if char.isalnum())
    return normalized or None

def normalize_upload_relative_path(raw_name: str) -> Path:
    normalized = (raw_name or "").replace("\\", "/").strip().lstrip("/")
    if not normalized:
        raise HTTPException(status_code=400, detail="Uploaded file has no name")
    parts = [part for part in Path(normalized).parts if part not in ("", ".", "..")]
    if not parts:
        raise HTTPException(status_code=400, detail="Invalid file name")
    return Path(*parts)


async def save_uploaded_files(upload_dir: Path, files: list[Any]) -> list[dict[str, Any]]:
    upload_dir.mkdir(parents=True, exist_ok=True)
    saved: list[dict[str, Any]] = []
    root = upload_dir.resolve()
    for file_obj in files:
        filename = str(getattr(file_obj, "filename", "") or "").strip()
        if not filename:
            continue
        rel_path = normalize_upload_relative_path(filename)
        target = (upload_dir / rel_path).resolve()
        if root not in target.parents and target != root:
            raise HTTPException(status_code=400, detail="Invalid uploaded file path")
        target.parent.mkdir(parents=True, exist_ok=True)
        size_bytes = 0
        try:
            with target.open("wb") as target_stream:
                while chunk := await file_obj.read(UPLOAD_CHUNK_SIZE):
                    target_stream.write(chunk)
                    size_bytes += len(chunk)
        except Exception:
            target.unlink(missing_ok=True)
            raise
        if not size_bytes:
            target.unlink(missing_ok=True)
            continue
        saved.append({"path": str(rel_path).replace("\\", "/"), "size_bytes": size_bytes})

    if not saved:
        raise HTTPException(status_code=400, detail="No files received for upload")

    return saved
