"""Plugin: analyze SNI traffic CSV/ZIP via external SNI service."""

from __future__ import annotations

import os
from typing import Any, Dict, List, Optional

import httpx

from plugins import PluginBase


class SNITrafficReportPlugin(PluginBase):
    id = "sni_traffic_report"
    name = "SNI: отчет по трафику"
    version = "0.1.0"
    description = "Анализирует CSV/ZIP трафика и создает документ + консоль"
    menu_path = "Analysis/SNI"
    plugin_scope = "global"
    input_types = ["graph", "document", "table", "console"]
    output_types = ["document", "console"]
    applicable_to = ["graph", "document", "table", "console"]
    inputs = {
        "artifact_types": ["graph", "document", "table", "console"],
        "selection": {"nodes": "optional", "edges": "optional", "rows": "optional", "text": "optional"},
    }
    params_schema = [
        {
            "key": "input_path",
            "label": "Файл CSV/ZIP",
            "type": "string",
            "required": True,
        },
        {
            "key": "device_id",
            "label": "Идентификатор устройства (опционально)",
            "type": "string",
            "required": False,
            "default": "",
        },
        {
            "key": "top_n",
            "label": "Топ записей в сводках",
            "type": "integer",
            "required": False,
            "default": 25,
        },
        {
            "key": "gap_minutes",
            "label": "Порог паузы без трафика (мин)",
            "type": "integer",
            "required": False,
            "default": 180,
        },
        {
            "key": "document_title",
            "label": "Название документа (опционально)",
            "type": "string",
            "required": False,
            "default": "",
        },
        {
            "key": "console_title",
            "label": "Название консоли (опционально)",
            "type": "string",
            "required": False,
            "default": "",
        },
    ]

    async def execute(self, input_artifacts: List[dict], params: Optional[Dict[str, Any]] = None) -> List[dict]:
        params = params or {}
        input_path = str(params.get("input_path") or "").strip()
        if not input_path:
            raise ValueError("Param 'input_path' is required")

        payload: Dict[str, Any] = {
            "input_path": input_path,
            "top_n": int(params.get("top_n") or 25),
            "gap_minutes": int(params.get("gap_minutes") or 180),
        }
        device_id = str(params.get("device_id") or "").strip()
        if device_id:
            payload["device_id"] = device_id

        base_url = str(os.getenv("SNI_SERVICE_URL", "http://sni:8012")).rstrip("/")
        timeout_seconds = int(os.getenv("SNI_TIMEOUT_SECONDS", "900"))
        url = f"{base_url}/analyze"

        try:
            async with httpx.AsyncClient(timeout=timeout_seconds) as client:
                response = await client.post(url, json=payload)
        except Exception as exc:
            raise ValueError(f"SNI service request failed: {exc}") from exc

        if response.status_code >= 400:
            detail = ""
            try:
                data = response.json()
                detail = str(data.get("detail") or data)
            except Exception:
                detail = response.text
            raise ValueError(f"SNI service error {response.status_code}: {detail[:600]}")

        try:
            result = response.json()
        except Exception as exc:
            raise ValueError("SNI service returned invalid JSON") from exc

        source_ids = [artifact.get("id") for artifact in input_artifacts if artifact.get("id") is not None]
        doc_title = str(params.get("document_title") or "").strip() or str(result.get("document_title") or "SNI traffic report")
        console_title = str(params.get("console_title") or "").strip() or f"{doc_title} · console"
        stats = result.get("stats") if isinstance(result.get("stats"), dict) else {}

        return [
            {
                "type": "document",
                "name": doc_title,
                "description": "Сводный отчет по SNI-трафику",
                "data": {"content": str(result.get("document_markdown") or "")},
                "metadata": {
                    "source_plugin": self.id,
                    "source_input_path": input_path,
                    "sni_stats": stats,
                    "derived_from": source_ids,
                },
            },
            {
                "type": "console",
                "name": console_title,
                "description": "Табличные результаты анализа SNI",
                "data": result.get("console_data") if isinstance(result.get("console_data"), dict) else {"tabs": []},
                "metadata": {
                    "source_plugin": self.id,
                    "source_input_path": input_path,
                    "sni_stats": stats,
                    "derived_from": source_ids,
                },
            },
        ]
