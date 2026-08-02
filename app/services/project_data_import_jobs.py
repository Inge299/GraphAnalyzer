from __future__ import annotations

import asyncio
from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import Any
from uuid import uuid4

from app.database import AsyncSessionLocal
from app.services.project_data_graph_service import sync_project_data_graph_artifact
from app.services.project_data_service import LoadResult, acquire_project_data_lock, load_project_data


@dataclass
class ProjectDataImportJob:
    id: str
    project_id: int
    source_path: str
    plugin_overrides: dict[str, str] | None = None
    status: str = "queued"
    progress: int = 0
    message: str = "\u0418\u043c\u043f\u043e\u0440\u0442 \u043e\u0436\u0438\u0434\u0430\u0435\u0442 \u0437\u0430\u043f\u0443\u0441\u043a\u0430"
    result: dict[str, Any] | None = None
    error: str | None = None
    created_at: str = field(default_factory=lambda: datetime.now(timezone.utc).isoformat())
    started_at: str | None = None
    finished_at: str | None = None

    def snapshot(self) -> dict[str, Any]:
        return self.__dict__.copy()


_jobs: dict[str, ProjectDataImportJob] = {}
_jobs_lock = asyncio.Lock()


def _serialize_result(project_id: int, result: LoadResult) -> dict[str, Any]:
    return {
        "message": "Project data loaded successfully", "project_id": project_id,
        "source_path": result.source_path, "output_dir": result.output_dir,
        "import_plugin_id": result.import_plugin_id, "import_plugin_name": result.import_plugin_name,
        "entities": result.entities, "facts": result.facts, "relations": result.relations,
        "source_counts": result.source_counts, "fact_counts": result.fact_counts,
        "load_batch_id": result.load_batch_id, "load_log": result.load_log, "graph_artifact": None,
    }


async def create_project_data_import_job(project_id: int, source_path: str, plugin_overrides: dict[str, str] | None = None) -> dict[str, Any]:
    job = ProjectDataImportJob(id=uuid4().hex, project_id=project_id, source_path=source_path, plugin_overrides=plugin_overrides)
    async with _jobs_lock:
        _jobs[job.id] = job
    return job.snapshot()


async def get_project_data_import_job(project_id: int, job_id: str) -> dict[str, Any] | None:
    async with _jobs_lock:
        job = _jobs.get(job_id)
        return None if job is None or job.project_id != project_id else job.snapshot()


async def _update(job: ProjectDataImportJob, progress: int, message: str) -> None:
    async with _jobs_lock:
        job.progress = max(0, min(100, int(progress)))
        job.message = message


async def run_project_data_import_job(job_id: str) -> None:
    async with _jobs_lock:
        job = _jobs.get(job_id)
        if job is None:
            return
        job.status, job.progress, job.message = "running", 1, "\u041f\u043e\u0434\u0433\u043e\u0442\u043e\u0432\u043a\u0430 \u0438\u043c\u043f\u043e\u0440\u0442\u0430"
        job.started_at = datetime.now(timezone.utc).isoformat()
    try:
        async with AsyncSessionLocal() as db:
            await acquire_project_data_lock(db=db, project_id=job.project_id)
            result = await load_project_data(
                db, job.project_id, job.source_path, job.plugin_overrides,
                lambda progress, message: _update(job, progress, message),
            )
            await db.commit()
        await _update(job, 94, "\u041e\u0431\u043d\u043e\u0432\u043b\u0435\u043d\u0438\u0435 \u0433\u0440\u0430\u0444\u0430 \u043f\u0440\u043e\u0435\u043a\u0442\u0430")
        try:
            async with AsyncSessionLocal() as db:
                await sync_project_data_graph_artifact(db=db, project_id=job.project_id)
                await db.commit()
        except Exception:
            pass
        async with _jobs_lock:
            job.status, job.progress, job.message = "completed", 100, "\u0418\u043c\u043f\u043e\u0440\u0442 \u0437\u0430\u0432\u0435\u0440\u0448\u0451\u043d"
            job.result = _serialize_result(job.project_id, result)
            job.finished_at = datetime.now(timezone.utc).isoformat()
    except Exception as exc:
        async with _jobs_lock:
            job.status, job.message = "failed", "\u0418\u043c\u043f\u043e\u0440\u0442 \u0437\u0430\u0432\u0435\u0440\u0448\u0438\u043b\u0441\u044f \u0441 \u043e\u0448\u0438\u0431\u043a\u043e\u0439"
            job.error = str(getattr(exc, "detail", exc))
            job.finished_at = datetime.now(timezone.utc).isoformat()