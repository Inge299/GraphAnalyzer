from __future__ import annotations

import asyncio
import json
import os
import shutil
from dataclasses import dataclass
from datetime import datetime
from pathlib import Path
from typing import Any, Awaitable, Callable

from fastapi import HTTPException
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.services.project_data_import_utils import (
    collect_input_files,
    expand_import_containers,
    read_manifest,
    save_uploaded_files,
)
from app.services.project_data_import_plugins import (
    ProjectDataImportExecutionResult,
    classify_project_data_import_files,
    execute_project_data_import_plugin,
)
from app.import_plugin_sdk import ProjectDataImportPlugin
from app.services.project_data_import_pipeline import insert_normalized_source_rows
from app.services.project_domain_store import clear_project_domain_store, ensure_project_domain_store
from app.services.project_cell_tower_geocoding_service import clear_project_cell_tower_geocoding
from app.services.project_data_stats_service import get_project_domain_stats

DATA_ROOT = Path("/app/data")
IMPORT_GROUP_MAX_BYTES = 256 * 1024 * 1024
IMPORT_GROUPED_PLUGIN_IDS = {"nodex_traffic_geo", "nodex_telecom_connections"}
STREAM_IMPORT_BATCH_SIZE = 2_000


def _next_normalized_batch(iterator):
    try:
        return next(iterator)
    except StopIteration:
        return None


def _write_stream_import_manifest(output_dir: Path, plugin: ProjectDataImportPlugin, source_counts: dict[str, int]) -> Path:
    output_dir.mkdir(parents=True, exist_ok=True)
    manifest_path = output_dir / "normalized_import_manifest.json"
    manifest_path.write_text(json.dumps({
        "plugin_id": plugin.id,
        "sdk_version": "2.0",
        "mode": "streamed_normalized_sources",
        "generated_at": datetime.utcnow().isoformat() + "Z",
        "input_dir": str(output_dir.parent),
        "sources": source_counts,
    }, ensure_ascii=False, indent=2), encoding="utf-8")
    return manifest_path

_project_data_schema_ready = False
_project_data_schema_lock = asyncio.Lock()
@dataclass
class LoadResult:
    source_path: str
    output_dir: str
    load_batch_id: str
    import_plugin_id: str
    import_plugin_name: str
    entities: int
    facts: int
    relations: int
    source_counts: dict[str, int]
    fact_counts: dict[str, int]
    load_log: dict[str, Any]

def _resolve_source_path(source_path: str) -> Path:
    candidate_raw = (source_path or "").strip()
    if not candidate_raw:
        raise HTTPException(status_code=400, detail="Source path is required")

    candidate = Path(candidate_raw)
    if not candidate.is_absolute():
        candidate = (DATA_ROOT / candidate).resolve()
    else:
        candidate = candidate.resolve()

    root = DATA_ROOT.resolve()
    if root not in candidate.parents and candidate != root:
        raise HTTPException(status_code=400, detail=f"Path must be inside {root}")

    if not candidate.exists() or not candidate.is_dir():
        raise HTTPException(status_code=400, detail=f"Directory not found: {candidate}")

    return candidate


async def ensure_project_data_tables(db: AsyncSession) -> None:
    """Compatibility name for the metadata-driven project store initializer."""

    await ensure_project_domain_store(db)

async def load_project_data(
    db: AsyncSession,
    project_id: int,
    source_path: str,
    plugin_overrides: dict[str, str] | None = None,
    progress_callback: Callable[[int, str], Awaitable[None]] | None = None,
) -> LoadResult:
    source_dir = _resolve_source_path(source_path)
    timestamp = datetime.utcnow().strftime("%Y%m%d_%H%M%S")
    load_batch_id = timestamp
    output_dir = DATA_ROOT / "imports" / f"project_{project_id}" / timestamp
    input_files = await asyncio.to_thread(collect_input_files, source_dir)
    input_files = await asyncio.to_thread(expand_import_containers, source_dir, input_files)
    return await _load_project_data_from_collected_files(
        db=db,
        project_id=project_id,
        source_dir=source_dir,
        input_files=input_files,
        output_dir=output_dir,
        load_batch_id=load_batch_id,
        mode="source_path",
        plugin_overrides=plugin_overrides,
        progress_callback=progress_callback,
    )


async def load_project_data_from_upload(
    db: AsyncSession,
    project_id: int,
    files: list[Any],
    plugin_overrides: dict[str, str] | None = None,
) -> LoadResult:
    timestamp = datetime.utcnow().strftime("%Y%m%d_%H%M%S")
    load_batch_id = timestamp
    source_dir = DATA_ROOT / "uploads" / f"project_{project_id}" / timestamp
    uploaded_files = await save_uploaded_files(source_dir, files)
    uploaded_files = await asyncio.to_thread(expand_import_containers, source_dir, uploaded_files)
    output_dir = DATA_ROOT / "imports" / f"project_{project_id}" / timestamp
    return await _load_project_data_from_collected_files(
        db=db,
        project_id=project_id,
        source_dir=source_dir,
        input_files=uploaded_files,
        output_dir=output_dir,
        load_batch_id=load_batch_id,
        mode="upload",
        plugin_overrides=plugin_overrides,
    )


def _split_import_file_groups(plugin_id: str, files: list[dict[str, Any]]) -> list[list[dict[str, Any]]]:
    """Keep memory bounded for high-volume plugins while preserving small-file batches."""
    if plugin_id not in IMPORT_GROUPED_PLUGIN_IDS or len(files) < 2:
        return [files]

    groups: list[list[dict[str, Any]]] = []
    current: list[dict[str, Any]] = []
    current_bytes = 0
    for item in files:
        size_bytes = max(0, int(item.get("size_bytes") or 0))
        if current and current_bytes + size_bytes > IMPORT_GROUP_MAX_BYTES:
            groups.append(current)
            current, current_bytes = [], 0
        current.append(item)
        current_bytes += size_bytes
    if current:
        groups.append(current)
    return groups


def _link_input_group(source_dir: Path, target_dir: Path, files: list[dict[str, Any]]) -> None:
    """Expose a plugin input group without duplicating multi-gigabyte source files."""
    for item in files:
        relative_path = Path(str(item.get("path") or ""))
        if not relative_path.parts:
            continue
        source_path = source_dir / relative_path
        target_path = target_dir / relative_path
        target_path.parent.mkdir(parents=True, exist_ok=True)
        try:
            os.link(source_path, target_path)
        except OSError:
            # A hard link is unavailable across filesystems; keep the portable fallback.
            shutil.copy2(source_path, target_path)



async def _load_project_data_from_collected_files(
    *,
    db: AsyncSession,
    project_id: int,
    source_dir: Path,
    input_files: list[dict[str, Any]],
    output_dir: Path,
    load_batch_id: str,
    mode: str,
    plugin_overrides: dict[str, str] | None = None,
    progress_callback: Callable[[int, str], Awaitable[None]] | None = None,
) -> LoadResult:
    if progress_callback:
        await progress_callback(5, "\u0420\u0430\u0441\u043f\u043e\u0437\u043d\u0430\u0432\u0430\u043d\u0438\u0435 \u0444\u043e\u0440\u043c\u0430\u0442\u043e\u0432 \u0444\u0430\u0439\u043b\u043e\u0432")
    matches = classify_project_data_import_files(source_dir, input_files, plugin_overrides=plugin_overrides)
    groups: dict[str, list[dict[str, Any]]] = {}
    for input_file, match in zip(input_files, matches, strict=False):
        groups.setdefault(match.plugin_id, []).append(input_file)

    await ensure_project_domain_store(db)
    total_entities = total_facts = total_relations = 0
    total_sources: dict[str, int] = {}
    total_fact_types: dict[str, int] = {}
    import_runs: list[dict[str, Any]] = []

    from app.services.project_data_import_plugins import IMPORT_PLUGIN_BY_ID
    grouped_batches = [
        (plugin_id, files_batch)
        for plugin_id, grouped_files in groups.items()
        for files_batch in _split_import_file_groups(plugin_id, grouped_files)
    ]
    group_count = max(1, len(grouped_batches))
    for group_index, (plugin_id, grouped_files) in enumerate(grouped_batches, start=1):
        match = next(item for item in matches if item.plugin_id == plugin_id)
        plugin_source_dir = source_dir / "_plugin_groups" / plugin_id / f"{group_index:04d}"
        plugin_output_dir = output_dir / plugin_id / f"{group_index:04d}"
        await asyncio.to_thread(_link_input_group, source_dir, plugin_source_dir, grouped_files)
        plugin = IMPORT_PLUGIN_BY_ID[plugin_id]
        if progress_callback:
            await progress_callback(10 + int((group_index - 1) * 70 / group_count), f"\u041f\u043e\u0434\u0433\u043e\u0442\u043e\u0432\u043a\u0430: {plugin.name}")
        supports_streaming = type(plugin).iter_normalized_source_batches is not ProjectDataImportPlugin.iter_normalized_source_batches
        batch_source_counts: dict[str, int] = {}
        batch_fact_counts: dict[str, int] = {}
        batch_entities = batch_facts = batch_relations = 0
        warnings: list[str] = []
        if supports_streaming:
            batches = plugin.iter_normalized_source_batches(plugin_source_dir, STREAM_IMPORT_BATCH_SIZE)
            batch_number = 0
            while True:
                normalized_sources = await asyncio.to_thread(_next_normalized_batch, batches)
                if normalized_sources is None:
                    break
                if not any(normalized_sources.values()):
                    continue
                batch_number += 1
                if progress_callback:
                    batch_progress = min(
                        85,
                        10 + int((group_index - 1) * 70 / group_count) + min(65, batch_number // 5),
                    )
                    await progress_callback(
                        batch_progress,
                        f"\u0421\u043e\u0445\u0440\u0430\u043d\u0435\u043d\u0438\u0435: {plugin.name}, \u043f\u043e\u0440\u0446\u0438\u044f {batch_number}",
                    )
                insert_result = await insert_normalized_source_rows(db, project_id, normalized_sources, load_batch_id)
                batch_entities += insert_result.entities
                batch_facts += insert_result.facts
                batch_relations += insert_result.relations
                for name, count in insert_result.source_counts.items():
                    batch_source_counts[name] = batch_source_counts.get(name, 0) + count
                for name, count in insert_result.fact_counts.items():
                    batch_fact_counts[name] = batch_fact_counts.get(name, 0) + count
            manifest_path = await asyncio.to_thread(_write_stream_import_manifest, plugin_output_dir, plugin, batch_source_counts)
            result = ProjectDataImportExecutionResult(
                plugin_id=plugin.id,
                plugin_name=plugin.name,
                plugin_description=plugin.description,
                manifest_path=manifest_path,
                normalized_sources={},
                stdout="Streamed normalization completed",
            )
        else:
            result = await asyncio.to_thread(execute_project_data_import_plugin, plugin, plugin_source_dir, plugin_output_dir)
            insert_result = await insert_normalized_source_rows(db, project_id, result.normalized_sources, load_batch_id)
            batch_entities = insert_result.entities
            batch_facts = insert_result.facts
            batch_relations = insert_result.relations
            batch_source_counts = dict(insert_result.source_counts)
            batch_fact_counts = dict(insert_result.fact_counts)
            warnings = list(result.warnings)
        if progress_callback:
            await progress_callback(15 + int(group_index * 70 / group_count), f"\u0421\u043e\u0445\u0440\u0430\u043d\u0435\u043d\u043e: {plugin.name}")
        total_entities += batch_entities
        total_facts += batch_facts
        total_relations += batch_relations
        for name, count in batch_source_counts.items():
            total_sources[name] = total_sources.get(name, 0) + count
        for name, count in batch_fact_counts.items():
            total_fact_types[name] = total_fact_types.get(name, 0) + count
        import_runs.append({
            "plugin": {"id": result.plugin_id, "name": result.plugin_name, "description": result.plugin_description},
            "recognized_files": [str(item["path"]) for item in grouped_files],
            "output": {
                "sources": batch_source_counts,
                "entities": batch_entities,
                "facts": batch_facts,
                "relations": batch_relations,
                "fact_types": batch_fact_counts,
            },
            "manifest": read_manifest(result.manifest_path),
            "score": match.score,
            "warnings": warnings,
        })

    if progress_callback:
        await progress_callback(90, "\u0417\u0430\u0432\u0435\u0440\u0448\u0435\u043d\u0438\u0435 \u0438\u043c\u043f\u043e\u0440\u0442\u0430")

    load_log = {
        "mode": mode,
        "source_dir": str(source_dir),
        "input_files": input_files,
        "recognized_files": [{"path": item.path, "plugin_id": item.plugin_id, "plugin_name": item.plugin_name, "score": item.score} for item in matches],
        "import_runs": import_runs,
    }
    primary_plugin_id = matches[0].plugin_id if len(groups) == 1 and matches else "mixed_batch"
    primary_plugin_name = matches[0].plugin_name if len(groups) == 1 and matches else "Several import plugins"
    return LoadResult(
        source_path=str(source_dir),
        output_dir=str(output_dir),
        load_batch_id=load_batch_id,
        import_plugin_id=primary_plugin_id,
        import_plugin_name=primary_plugin_name,
        entities=total_entities,
        facts=total_facts,
        relations=total_relations,
        source_counts=total_sources,
        fact_counts=total_fact_types,
        load_log=load_log,
    )

async def acquire_project_data_lock(db: AsyncSession, project_id: int) -> None:
    """Serialize import and cleanup operations for one project."""

    lock_key = 910000000 + int(project_id)
    await db.execute(text("SELECT pg_advisory_xact_lock(:lock_key)"), {"lock_key": lock_key})


async def try_acquire_project_data_lock(db: AsyncSession, project_id: int) -> bool:
    """Acquire a project lock immediately, without leaving an interactive request waiting."""

    lock_key = 910000000 + int(project_id)
    result = await db.execute(text("SELECT pg_try_advisory_xact_lock(:lock_key)"), {"lock_key": lock_key})
    return bool(result.scalar())

async def get_project_data_stats(db: AsyncSession, project_id: int) -> dict[str, Any]:
    return await get_project_domain_stats(db, project_id)

async def clear_project_data(db: AsyncSession, project_id: int) -> dict[str, int]:
    """Clear the metadata-driven store and return generic deletion counters."""

    stats = await get_project_domain_stats(db, project_id)
    domain_cleanup = await clear_project_domain_store(db, project_id)
    await clear_project_cell_tower_geocoding(db, project_id)
    return {
        "entities_deleted": stats["entities_count"],
        "facts_deleted": stats["facts_count"],
        "relations_deleted": stats["relations_count"],
        **domain_cleanup,
    }