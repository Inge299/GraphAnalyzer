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
from app.services.plugins_config_service import get_plugin_config

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


def _resolve_value(key: str, values: Dict[str, Any], profile: Dict[str, Any], project_id: int) -> Any:
    if key == "project_id":
        return project_id
    if key in values:
        return values[key]
    defaults = profile.get("defaults") if isinstance(profile.get("defaults"), dict) else {}
    if key in defaults:
        return defaults[key]
    return None


async def _run_postgres_query(db: AsyncSession, profile: Dict[str, Any], values: Dict[str, Any], project_id: int) -> List[Dict[str, Any]]:
    query = str(profile.get("query") or "").strip()
    if not query:
        raise RuntimeError("Console profile query is empty")

    params = {
        key: _resolve_value(key, values, profile, project_id)
        for key in set(list(values.keys()) + ["project_id", "limit", "phone"])  # safe superset
    }
    result = await db.execute(text(query), params)
    return [dict(row._mapping) for row in result.fetchall()]


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

    profile_id = str(payload.get("profile_id") or artifact.artifact_metadata.get("console_profile_id") or "").strip() if isinstance(artifact.artifact_metadata, dict) else str(payload.get("profile_id") or "").strip()
    if not profile_id:
        raise HTTPException(status_code=400, detail="profile_id is required")

    profile = _get_profile(profile_id)
    if not profile:
        raise HTTPException(status_code=404, detail=f"Console profile '{profile_id}' not found")

    params = payload.get("params") if isinstance(payload.get("params"), dict) else {}

    try:
        rows = await _run_postgres_query(db, profile, params, project_id)
    except Exception as exc:
        logger.error("Console refresh failed: %s", exc)
        raise HTTPException(status_code=500, detail=f"Console refresh failed: {exc}") from exc

    columns: List[str] = []
    for row in rows:
        for key in row.keys():
            if key not in columns:
                columns.append(str(key))

    normalized_rows: List[Dict[str, Any]] = []
    for row in rows:
        normalized_rows.append({
            key: (value.isoformat() if hasattr(value, "isoformat") else value)
            for key, value in row.items()
        })

    next_data = {
        "profile_id": profile_id,
        "profile_name": str(profile.get("name") or profile_id),
        "columns": columns,
        "rows": normalized_rows,
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
        "console_rows_count": len(normalized_rows),
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
