from __future__ import annotations

from typing import Any, Dict, Optional

from sqlalchemy import func, select

from app.console_plugins import ConsoleExecutorPlugin
from app.database import AsyncSessionLocal
from app.models.artifact import Artifact, ArtifactVersion


class ProjectArtifactsInventoryExecutor(ConsoleExecutorPlugin):
    id = "project_artifacts_inventory"
    name = "\u0410\u0440\u0442\u0435\u0444\u0430\u043a\u0442\u044b \u043f\u0440\u043e\u0435\u043a\u0442\u0430"
    description = "\u041f\u043e\u043a\u0430\u0437\u044b\u0432\u0430\u0435\u0442 \u0441\u043f\u0438\u0441\u043e\u043a \u0430\u0440\u0442\u0435\u0444\u0430\u043a\u0442\u043e\u0432 \u0442\u0435\u043a\u0443\u0449\u0435\u0433\u043e \u043f\u0440\u043e\u0435\u043a\u0442\u0430: \u0433\u0440\u0430\u0444\u044b, \u043a\u043e\u043d\u0441\u043e\u043b\u0438 \u0438 \u0434\u0440\u0443\u0433\u0438\u0435 \u0440\u0435\u0437\u0443\u043b\u044c\u0442\u0430\u0442\u044b."
    supports_graph_selection = False
    result_sets = [
        {
            "id": "artifacts",
            "result_index": 0,
            "result_key": "artifacts",
            "name": "\u0410\u0440\u0442\u0435\u0444\u0430\u043a\u0442\u044b \u043f\u0440\u043e\u0435\u043a\u0442\u0430",
            "visible": True,
            "columns": [
                {"key": "artifact_id", "label": "ID", "type": "integer", "visible": True},
                {"key": "type", "label": "\u0422\u0438\u043f", "type": "string", "visible": True},
                {"key": "name", "label": "\u041d\u0430\u0437\u0432\u0430\u043d\u0438\u0435", "type": "string", "visible": True},
                {"key": "description", "label": "\u041e\u043f\u0438\u0441\u0430\u043d\u0438\u0435", "type": "string", "visible": True},
                {"key": "current_version", "label": "\u0412\u0435\u0440\u0441\u0438\u044f", "type": "integer", "visible": True},
                {"key": "updated_at", "label": "\u041e\u0431\u043d\u043e\u0432\u043b\u0435\u043d\u043e", "type": "datetime", "visible": True},
            ],
        }
    ]

    async def execute(
        self,
        *,
        project_id: int,
        artifact: Optional[Dict[str, Any]] = None,
        params: Optional[Dict[str, Any]] = None,
        context: Optional[Dict[str, Any]] = None,
    ) -> Dict[str, Any]:
        del artifact, params, context

        latest_version_subquery = (
            select(
                ArtifactVersion.artifact_id.label("artifact_id"),
                func.max(ArtifactVersion.version).label("latest_version"),
            )
            .group_by(ArtifactVersion.artifact_id)
            .subquery()
        )

        async with AsyncSessionLocal() as session:
            result = await session.execute(
                select(
                    Artifact.id,
                    Artifact.type,
                    Artifact.name,
                    Artifact.description,
                    Artifact.updated_at,
                    func.coalesce(latest_version_subquery.c.latest_version, 1).label("latest_version"),
                )
                .outerjoin(latest_version_subquery, latest_version_subquery.c.artifact_id == Artifact.id)
                .where(Artifact.project_id == project_id)
                .order_by(Artifact.updated_at.desc(), Artifact.id.desc())
            )
            rows = result.all()

        normalized_rows = [
            {
                "artifact_id": row.id,
                "type": row.type,
                "name": row.name,
                "description": row.description,
                "current_version": int(row.latest_version or 1),
                "updated_at": row.updated_at.isoformat() if row.updated_at else None,
            }
            for row in rows
        ]

        columns = [
            {"key": "artifact_id", "original_name": "artifact_id", "label": "ID", "type": "integer", "width": 90, "visible": True},
            {"key": "type", "original_name": "type", "label": "\u0422\u0438\u043f", "type": "string", "width": 120, "visible": True},
            {"key": "name", "original_name": "name", "label": "\u041d\u0430\u0437\u0432\u0430\u043d\u0438\u0435", "type": "string", "width": 260, "visible": True},
            {"key": "description", "original_name": "description", "label": "\u041e\u043f\u0438\u0441\u0430\u043d\u0438\u0435", "type": "string", "width": 320, "visible": True},
            {"key": "current_version", "original_name": "current_version", "label": "\u0412\u0435\u0440\u0441\u0438\u044f", "type": "integer", "width": 100, "visible": True},
            {"key": "updated_at", "original_name": "updated_at", "label": "\u041e\u0431\u043d\u043e\u0432\u043b\u0435\u043d\u043e", "type": "datetime", "width": 180, "visible": True},
        ]

        return {
            "profile_id": self.id,
            "profile_name": self.name,
            "tabs": [
                {
                    "id": "artifacts",
                    "name": "\u0410\u0440\u0442\u0435\u0444\u0430\u043a\u0442\u044b \u043f\u0440\u043e\u0435\u043a\u0442\u0430",
                    "columns": columns,
                    "rows": normalized_rows,
                    "row_count": len(normalized_rows),
                }
            ],
            "result_sets": [
                {
                    "id": "artifacts",
                    "result_index": 0,
                    "result_key": "artifacts",
                    "name": "\u0410\u0440\u0442\u0435\u0444\u0430\u043a\u0442\u044b \u043f\u0440\u043e\u0435\u043a\u0442\u0430",
                    "visible": True,
                    "columns": columns,
                }
            ],
            "active_tab_id": "artifacts",
        }
