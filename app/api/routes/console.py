# app/api/routes/console.py
"""Console artifact data refresh and profile discovery endpoints."""

from __future__ import annotations

import json
import logging
from datetime import datetime
from pathlib import Path
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select, text
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_project
from app.database import get_db
from app.models.artifact import Artifact, ArtifactVersion
from app.models.project import Project

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/projects/{project_id}/console", tags=["console"])
profiles_router = APIRouter(prefix="/console", tags=["console"])

CONFIG_PATH = Path(__file__).resolve().parents[2] / "configuration" / "console_profiles.json"


def _load_profiles() -> List[Dict[str, Any]]:
    if not CONFIG_PATH.exists():
        return []
    try:
        payload = json.loads(CONFIG_PATH.read_text(encoding="utf-8"))
    except Exception as exc:
        logger.error("Failed to read console profiles: %s", exc)
        return []

    profiles = payload.get("profiles") if isinstance(payload, dict) else None
    if not isinstance(profiles, list):
        return []
    return [item for item in profiles if isinstance(item, dict) and str(item.get("id") or "").strip()]


def _profile_public(profile: Dict[str, Any]) -> Dict[str, Any]:
    return {
        "id": str(profile.get("id") or "").strip(),
        "name": str(profile.get("name") or "").strip(),
        "description": str(profile.get("description") or "").strip(),
        "params": profile.get("params") if isinstance(profile.get("params"), list) else [],
        "default_limit": int(profile.get("default_limit") or 200),
    }


def _get_profile(profile_id: str) -> Optional[Dict[str, Any]]:
    pid = str(profile_id or "").strip()
    if not pid:
        return None
    for profile in _load_profiles():
        if str(profile.get("id") or "").strip() == pid:
            return profile
    return None


async def _run_postgres_query(db: AsyncSession, query: str, values: Dict[str, Any]) -> List[Dict[str, Any]]:
    query = str(query or "").strip()
    if not query:
        raise RuntimeError("Console profile query is empty")

    result = await db.execute(text(query), values)
    return [dict(row._mapping) for row in result.fetchall()]


def _normalize_rows(rows: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    normalized_rows: List[Dict[str, Any]] = []
    for row in rows:
        normalized_rows.append({
            key: (value.isoformat() if hasattr(value, "isoformat") else value)
            for key, value in row.items()
        })
    return normalized_rows


def _extract_columns(rows: List[Dict[str, Any]]) -> List[str]:
    columns: List[str] = []
    for row in rows:
        for key in row.keys():
            key_str = str(key)
            if key_str not in columns:
                columns.append(key_str)
    return columns


def _build_base_values(profile: Dict[str, Any], payload_params: Dict[str, Any], project_id: int) -> Dict[str, Any]:
    defaults = profile.get("defaults") if isinstance(profile.get("defaults"), dict) else {}
    base_values = {**defaults, **payload_params}
    base_values["project_id"] = project_id
    return base_values


async def _build_console_tabs(
    db: AsyncSession,
    profile: Dict[str, Any],
    payload_params: Dict[str, Any],
    project_id: int,
) -> List[Dict[str, Any]]:
    base_values = _build_base_values(profile, payload_params, project_id)
    tabs_spec = profile.get("tabs") if isinstance(profile.get("tabs"), list) else []

    tabs: List[Dict[str, Any]] = []
    if tabs_spec:
        for index, item in enumerate(tabs_spec):
            if not isinstance(item, dict):
                continue
            query = str(item.get("query") or "").strip()
            if not query:
                continue

            tab_defaults = item.get("defaults") if isinstance(item.get("defaults"), dict) else {}
            tab_values = {**base_values, **tab_defaults}

            rows = await _run_postgres_query(db, query, tab_values)
            normalized_rows = _normalize_rows(rows)
            columns = _extract_columns(rows)
            tab_id = str(item.get("id") or f"tab_{index + 1}").strip() or f"tab_{index + 1}"
            tab_name = str(item.get("name") or tab_id).strip() or tab_id
            tabs.append(
                {
                    "id": tab_id,
                    "name": tab_name,
                    "columns": columns,
                    "rows": normalized_rows,
                    "row_count": len(normalized_rows),
                }
            )
        return tabs

    rows = await _run_postgres_query(db, str(profile.get("query") or ""), base_values)
    normalized_rows = _normalize_rows(rows)
    columns = _extract_columns(rows)
    tab_id = str(profile.get("id") or "main").strip() or "main"
    tab_name = str(profile.get("name") or tab_id).strip() or tab_id
    return [
        {
            "id": tab_id,
            "name": tab_name,
            "columns": columns,
            "rows": normalized_rows,
            "row_count": len(normalized_rows),
        }
    ]


@profiles_router.get("/profiles", response_model=Dict[str, Any])
async def list_console_profiles() -> Dict[str, Any]:
    profiles = [_profile_public(item) for item in _load_profiles()]
    return {"profiles": profiles}


@router.post("/refresh", response_model=Dict[str, Any])
async def refresh_console_artifact(
    project_id: int,
    payload: Dict[str, Any],
    db: AsyncSession = Depends(get_db),
    project: Project = Depends(get_project),
) -> Dict[str, Any]:
    artifact_id = int(payload.get("artifact_id") or 0)
    if artifact_id <= 0:
        raise HTTPException(status_code=400, detail="artifact_id is required")

    result = await db.execute(
        select(Artifact).where(
            Artifact.id == artifact_id,
            Artifact.project_id == project_id,
        )
    )
    artifact = result.scalar_one_or_none()
    if not artifact:
        raise HTTPException(status_code=404, detail="Artifact not found")
    if str(artifact.type or "") != "console":
        raise HTTPException(status_code=400, detail="Artifact type must be 'console'")

    if isinstance(artifact.artifact_metadata, dict):
        profile_id = str(payload.get("profile_id") or artifact.artifact_metadata.get("console_profile_id") or "").strip()
    else:
        profile_id = str(payload.get("profile_id") or "").strip()

    if not profile_id:
        raise HTTPException(status_code=400, detail="profile_id is required")

    profile = _get_profile(profile_id)
    if not profile:
        raise HTTPException(status_code=404, detail=f"Console profile '{profile_id}' not found")

    params = payload.get("params") if isinstance(payload.get("params"), dict) else {}

    try:
        tabs = await _build_console_tabs(db, profile, params, project_id)
    except Exception as exc:
        logger.error("Console refresh failed: %s", exc)
        raise HTTPException(status_code=500, detail=f"Console refresh failed: {exc}") from exc

    active_tab_id = str(payload.get("active_tab_id") or "").strip()
    if not active_tab_id and tabs:
        active_tab_id = str(tabs[0].get("id") or "").strip()
    if active_tab_id and not any(str(item.get("id") or "") == active_tab_id for item in tabs):
        active_tab_id = str(tabs[0].get("id") or "").strip() if tabs else ""

    primary_tab = tabs[0] if tabs else {"columns": [], "rows": []}

    next_data = {
        "profile_id": profile_id,
        "profile_name": str(profile.get("name") or profile_id),
        "tabs": tabs,
        "active_tab_id": active_tab_id or None,
        # Backward compatibility for consumers that still read a single table.
        "columns": list(primary_tab.get("columns") or []),
        "rows": list(primary_tab.get("rows") or []),
        "updated_at": datetime.utcnow().isoformat(),
    }

    current_version_result = await db.execute(
        select(ArtifactVersion.version)
        .where(ArtifactVersion.artifact_id == artifact.id)
        .order_by(ArtifactVersion.version.desc())
        .limit(1)
    )
    current_version = current_version_result.scalar_one_or_none() or 1

    artifact.data = next_data
    artifact.artifact_metadata = {
        **(artifact.artifact_metadata or {}),
        "console_profile_id": profile_id,
        "console_profile_name": str(profile.get("name") or profile_id),
        "console_last_params": params,
        "console_tabs_count": len(tabs),
        "console_rows_count": sum(int(item.get("row_count") or 0) for item in tabs),
        "console_refreshed_at": datetime.utcnow().isoformat(),
    }
    artifact.updated_at = datetime.utcnow()

    version = ArtifactVersion(
        artifact_id=artifact.id,
        version=current_version + 1,
        data=next_data,
        changed_by="console_refresh",
    )
    db.add(version)
    await db.commit()
    await db.refresh(artifact)

    return {
        "id": artifact.id,
        "project_id": artifact.project_id,
        "type": artifact.type,
        "name": artifact.name,
        "description": artifact.description,
        "data": artifact.data,
        "metadata": artifact.artifact_metadata,
        "created_at": artifact.created_at.isoformat() if artifact.created_at else None,
        "updated_at": artifact.updated_at.isoformat() if artifact.updated_at else None,
        "version": current_version + 1,
    }
