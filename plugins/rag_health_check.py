"""Plugin: check availability of external Nodex RAG module."""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

from app.services.rag_integration_service import RagIntegrationService
from plugins import PluginBase


class RagHealthCheckPlugin(PluginBase):
    id = "rag_health_check"
    name = "RAG: Проверка подключения"
    version = "0.1.0"
    description = "Проверяет доступность внешнего Nodex RAG сервиса"
    menu_path = "RAG"
    input_types = ["graph"]
    output_types = ["graph"]
    applicable_to = ["graph"]

    inputs = {
        "artifact_types": ["graph"],
        "selection": {
            "nodes": "optional",
            "edges": "optional",
            "rows": "optional",
            "text": "optional",
            "geo": "optional",
        },
    }

    output_strategy = {
        "mode": "update_current",
        "history_action": "plugin_execute",
    }

    async def execute(
        self,
        input_artifacts: List[Dict[str, Any]],
        params: Optional[Dict[str, Any]] = None,
    ) -> List[Dict[str, Any]]:
        if not input_artifacts:
            return []

        graph = input_artifacts[0]
        data = dict(graph.get("data") or {})
        metadata = dict(graph.get("metadata") or {})

        rag = RagIntegrationService(plugin_id=self.id)
        health = await rag.check_health()
        checked_at = datetime.now(timezone.utc).isoformat()

        metadata.update(
            {
                "source_plugin": self.id,
                "rag_service_url": rag.base_url,
                "rag_health_checked_at": checked_at,
                "rag_health_ok": bool(health.get("ok")),
                "rag_health_status_code": health.get("status_code"),
                "rag_health_error": health.get("error"),
            }
        )

        body = health.get("body")
        if isinstance(body, dict):
            metadata["rag_health_body"] = body
        elif body is not None:
            metadata["rag_health_body"] = str(body)[:1000]

        return [
            {
                "type": "graph",
                "name": graph.get("name", "Graph"),
                "description": graph.get("description"),
                "data": data,
                "metadata": metadata,
            }
        ]
