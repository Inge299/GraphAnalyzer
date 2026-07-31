from __future__ import annotations

import asyncio
import shutil
from dataclasses import dataclass
from datetime import datetime
from pathlib import Path
from typing import Any

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
from app.services.project_data_import_pipeline import insert_normalized_source_rows
from app.services.project_domain_store import clear_project_domain_store, ensure_project_domain_store
from app.services.project_data_stats_service import get_project_domain_stats

DATA_ROOT = Path("/app/data")
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

async def load_project_data(db: AsyncSession, project_id: int, source_path: str) -> LoadResult:
    source_dir = _resolve_source_path(source_path)
    timestamp = datetime.utcnow().strftime("%Y%m%d_%H%M%S")
    load_batch_id = timestamp
    output_dir = DATA_ROOT / "imports" / f"project_{project_id}" / timestamp
    input_files = expand_import_containers(source_dir, collect_input_files(source_dir))
    return await _load_project_data_from_collected_files(
        db=db,
        project_id=project_id,
        source_dir=source_dir,
        input_files=input_files,
        output_dir=output_dir,
        load_batch_id=load_batch_id,
        mode="source_path",
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
    uploaded_files = expand_import_containers(source_dir, uploaded_files)
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


def _copy_input_group(source_dir: Path, target_dir: Path, files: list[dict[str, Any]]) -> None:
    for item in files:
        relative_path = Path(str(item.get("path") or ""))
        if not relative_path.parts:
            continue
        source_path = source_dir / relative_path
        target_path = target_dir / relative_path
        target_path.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy2(source_path, target_path)


async def preview_project_data_from_upload(
    project_id: int,
    files: list[Any],
    plugin_overrides: dict[str, str] | None = None,
    sample_limit: int = 10,
) -> dict[str, Any]:
    timestamp = datetime.utcnow().strftime("%Y%m%d_%H%M%S_%f")
    preview_root = DATA_ROOT / "previews" / f"project_{project_id}" / timestamp
    source_dir = preview_root / "source"
    output_dir = preview_root / "output"
    errors: list[dict[str, Any]] = []
    warnings: list[str] = []

    try:
        uploaded_files = await save_uploaded_files(source_dir, files)
        virtual_files = expand_import_containers(source_dir, uploaded_files)
        matches = []
        for input_file in virtual_files:
            input_path = str(input_file.get("path") or "")
            override = plugin_overrides if plugin_overrides else None
            try:
                matches.extend(classify_project_data_import_files(source_dir, [input_file], plugin_overrides=override))
            except HTTPException as exc:
                errors.append({"path": input_path, "stage": "recognition", "message": str(exc.detail)})

        groups: dict[str, list[dict[str, Any]]] = {}
        for match in matches:
            source_file = next((item for item in virtual_files if str(item.get("path") or "") == match.path), None)
            if source_file is not None:
                groups.setdefault(match.plugin_id, []).append(source_file)

        runs: list[dict[str, Any]] = []
        from app.services.project_data_import_plugins import IMPORT_PLUGIN_BY_ID

        for plugin_id, grouped_files in groups.items():
            match = next(item for item in matches if item.plugin_id == plugin_id)
            plugin_source_dir = source_dir / "_plugin_groups" / plugin_id
            plugin_output_dir = output_dir / plugin_id
            _copy_input_group(source_dir, plugin_source_dir, grouped_files)
            try:
                result = execute_project_data_import_plugin(
                    IMPORT_PLUGIN_BY_ID[plugin_id],
                    plugin_source_dir,
                    plugin_output_dir,
                    dry_run=True,
                )
                datasets = []
                for dataset in IMPORT_PLUGIN_BY_ID[plugin_id].dataset_contracts():
                    rows = list(result.normalized_sources.get(dataset.id, []))
                    columns = sorted({str(key) for row in rows for key in row})
                    datasets.append({
                        "id": dataset.id,
                        "label": dataset.label,
                        "row_count": len(rows),
                        "columns": columns,
                        "sample_rows": rows[:max(1, min(sample_limit, 50))],
                    })
                if not any(dataset["row_count"] > 0 for dataset in datasets):
                    warnings.append(f"{result.plugin_name}: преобразование не сформировало ни одной строки")
                runs.append(
                    {
                        "plugin": {"id": result.plugin_id, "name": result.plugin_name, "description": result.plugin_description},
                        "recognized_files": [str(next((matched.display_path for matched in matches if matched.path == item.get("path")), item.get("path") or "")) for item in grouped_files],
                        "source_files": sorted({str(item.get("container_path") or item.get("display_path") or item.get("path") or "") for item in grouped_files}),
                        "score": match.score,
                        "datasets": datasets,
                        "manifest": read_manifest(result.manifest_path),
                        "converter_stdout": result.stdout,
                        "converter_stderr": result.stderr,
                    }
                )
            except Exception as exc:
                detail = exc.detail if isinstance(exc, HTTPException) else str(exc)
                errors.append({"plugin_id": plugin_id, "stage": "conversion", "message": str(detail)})

        return {
            "project_id": project_id,
            "dry_run": True,
            "write_performed": False,
            "files": [
                {
                    "path": item.get("path"),
                    "size_bytes": item.get("size_bytes"),
                    "members": [
                        {
                            "path": match.display_path,
                            "plugin_id": match.plugin_id,
                            "plugin_name": match.plugin_name,
                            "score": match.score,
                        }
                        for match in matches
                        if str(next((entry.get("container_path") or entry.get("path") for entry in virtual_files if entry.get("path") == match.path), "")) == str(item.get("path") or "")
                    ],
                }
                for item in uploaded_files
            ],
            "runs": runs,
            "warnings": warnings,
            "errors": errors,
        }
    finally:
        shutil.rmtree(preview_root, ignore_errors=True)

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
) -> LoadResult:
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
    for plugin_id, grouped_files in groups.items():
        match = next(item for item in matches if item.plugin_id == plugin_id)
        plugin_source_dir = source_dir / "_plugin_groups" / plugin_id
        plugin_output_dir = output_dir / plugin_id
        _copy_input_group(source_dir, plugin_source_dir, grouped_files)
        plugin = IMPORT_PLUGIN_BY_ID[plugin_id]
        result = execute_project_data_import_plugin(plugin, plugin_source_dir, plugin_output_dir)
        insert_result = await insert_normalized_source_rows(db, project_id, result.normalized_sources, load_batch_id)
        total_entities += insert_result.entities
        total_facts += insert_result.facts
        total_relations += insert_result.relations
        for name, count in insert_result.source_counts.items():
            total_sources[name] = total_sources.get(name, 0) + count
        for name, count in insert_result.fact_counts.items():
            total_fact_types[name] = total_fact_types.get(name, 0) + count
        import_runs.append({
            "plugin": {"id": result.plugin_id, "name": result.plugin_name, "description": result.plugin_description},
            "recognized_files": [str(item["path"]) for item in grouped_files],
            "output": {
                "sources": insert_result.source_counts,
                "entities": insert_result.entities,
                "facts": insert_result.facts,
                "relations": insert_result.relations,
                "fact_types": insert_result.fact_counts,
            },
            "manifest": read_manifest(result.manifest_path),
            "score": match.score,
            "warnings": result.warnings,
        })

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

async def get_project_data_stats(db: AsyncSession, project_id: int) -> dict[str, Any]:
    return await get_project_domain_stats(db, project_id)

async def clear_project_data(db: AsyncSession, project_id: int) -> dict[str, int]:
    """Clear the metadata-driven store and return generic deletion counters."""

    stats = await get_project_domain_stats(db, project_id)
    domain_cleanup = await clear_project_domain_store(db, project_id)
    return {
        "entities_deleted": stats["entities_count"],
        "facts_deleted": stats["facts_count"],
        "relations_deleted": stats["relations_count"],
        **domain_cleanup,
    }