from __future__ import annotations

import asyncio
from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import Any
from uuid import uuid4

from app.database import AsyncSessionLocal
from app.services.project_cell_tower_geocoding_service import enrich_project_cell_towers
from app.services.project_data_service import acquire_project_data_lock


@dataclass
class ProjectCellTowerGeocodingJob:
    id: str
    project_id: int
    status: str = "queued"
    progress: int = 0
    message: str = "\u041e\u0431\u043e\u0433\u0430\u0449\u0435\u043d\u0438\u0435 \u043e\u0436\u0438\u0434\u0430\u0435\u0442 \u0437\u0430\u043f\u0443\u0441\u043a\u0430"
    result: dict[str, Any] | None = None
    error: str | None = None
    created_at: str = field(default_factory=lambda: datetime.now(timezone.utc).isoformat())
    started_at: str | None = None
    finished_at: str | None = None

    def snapshot(self) -> dict[str, Any]:
        return self.__dict__.copy()


_jobs: dict[str, ProjectCellTowerGeocodingJob] = {}
_lock = asyncio.Lock()


async def create_project_cell_tower_geocoding_job(project_id: int) -> dict[str, Any]:
    job = ProjectCellTowerGeocodingJob(id=uuid4().hex, project_id=project_id)
    async with _lock:
        _jobs[job.id] = job
    return job.snapshot()


async def get_project_cell_tower_geocoding_job(project_id: int, job_id: str) -> dict[str, Any] | None:
    async with _lock:
        job = _jobs.get(job_id)
        return None if job is None or job.project_id != project_id else job.snapshot()


async def _progress(job: ProjectCellTowerGeocodingJob, progress: int, message: str) -> None:
    async with _lock:
        job.progress = max(0, min(100, int(progress)))
        job.message = message


async def run_project_cell_tower_geocoding_job(job_id: str) -> None:
    async with _lock:
        job = _jobs.get(job_id)
        if job is None:
            return
        job.status, job.progress = "running", 1
        job.message = "\u041f\u043e\u0434\u0433\u043e\u0442\u043e\u0432\u043a\u0430 \u043e\u0431\u043e\u0433\u0430\u0449\u0435\u043d\u0438\u044f \u0411\u0421"
        job.started_at = datetime.now(timezone.utc).isoformat()
    try:
        async with AsyncSessionLocal() as db:
            await acquire_project_data_lock(db, job.project_id)
            result = await enrich_project_cell_towers(
                job.project_id,
                lambda progress, message: _progress(job, progress, message),
                db=db,
            )
            await db.commit()
        async with _lock:
            job.status, job.progress, job.message = "completed", 100, "\u041e\u0431\u043e\u0433\u0430\u0449\u0435\u043d\u0438\u0435 \u0411\u0421 \u0437\u0430\u0432\u0435\u0440\u0448\u0435\u043d\u043e"
            job.result = result
            job.finished_at = datetime.now(timezone.utc).isoformat()
    except Exception as exc:
        async with _lock:
            job.status, job.message = "failed", "\u041e\u0431\u043e\u0433\u0430\u0449\u0435\u043d\u0438\u0435 \u0411\u0421 \u0437\u0430\u0432\u0435\u0440\u0448\u0438\u043b\u043e\u0441\u044c \u0441 \u043e\u0448\u0438\u0431\u043a\u043e\u0439"
            job.error = str(getattr(exc, "detail", exc))
            job.finished_at = datetime.now(timezone.utc).isoformat()
