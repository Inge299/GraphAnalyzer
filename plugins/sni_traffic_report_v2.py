"""Plugin: analyze SNI traffic via SNI-1 service (general plugin)."""

from __future__ import annotations

import os
from typing import Any, Dict, List, Optional

import httpx

from plugins import PluginBase


class SNITrafficReportV2Plugin(PluginBase):
    id = "sni_traffic_report_v2"
    name = "SNI-1: отчет по трафику"
    version = "1.0.0"
    description = "Интеграция SNI-1: CSV/ZIP анализ трафика в документ + консоль"
    menu_path = "Анализ/Трафик"
    plugin_scope = "global"
    input_types = ["graph", "document", "table", "console"]
    output_types = ["document", "console"]
    applicable_to = ["graph", "document", "table", "console"]
    inputs = {
        "artifact_types": ["graph", "document", "table", "console"],
        "selection": {"nodes": "optional", "edges": "optional", "rows": "optional", "text": "optional"},
    }
    params_schema = [
        {"key": "input_path", "label": "Файл CSV/ZIP", "type": "string", "required": True},
        {"key": "refs_dir", "label": "Папка справочников (опционально)", "type": "string", "required": False, "default": ""},
        {"key": "device_id", "label": "Идентификатор устройства (опционально)", "type": "string", "required": False, "default": ""},
        {"key": "top_n", "label": "Топ записей в сводках", "type": "integer", "required": False, "default": 25},
        {"key": "gap_minutes", "label": "Порог паузы без трафика (мин)", "type": "integer", "required": False, "default": 180},
        {"key": "document_title", "label": "Название документа (опционально)", "type": "string", "required": False, "default": ""},
        {"key": "console_title", "label": "Название консоли (опционально)", "type": "string", "required": False, "default": ""},
    ]

    @staticmethod
    def _tables_to_tabs(tables: Dict[str, Any]) -> List[Dict[str, Any]]:
        tabs: List[Dict[str, Any]] = []
        for table_id, rows_any in tables.items():
            rows = rows_any if isinstance(rows_any, list) else []
            columns: List[str] = list(rows[0].keys()) if rows and isinstance(rows[0], dict) else []
            tabs.append(
                {
                    "id": str(table_id),
                    "name": str(table_id).replace("_", " ").title(),
                    "columns": columns,
                    "rows": rows,
                    "row_count": len(rows),
                }
            )
        if not tabs:
            tabs.append({"id": "overview", "name": "Overview", "columns": [], "rows": [], "row_count": 0})
        return tabs

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
        for key in ("device_id", "document_title", "console_title", "refs_dir"):
            value = str(params.get(key) or "").strip()
            if value:
                payload[key] = value

        if "refs_dir" not in payload:
            default_refs = str(os.getenv("SNI1_REFS_DIR", os.getenv("SNI_REFS_DIR", ""))).strip()
            if default_refs:
                payload["refs_dir"] = default_refs

        base_url = str(os.getenv("SNI1_SERVICE_URL", "http://sni1:8013")).rstrip("/")
        timeout_seconds = int(os.getenv("SNI1_TIMEOUT_SECONDS", "900"))
        url = f"{base_url}/analyze"

        try:
            async with httpx.AsyncClient(timeout=timeout_seconds) as client:
                response = await client.post(url, json=payload)
        except Exception as exc:
            raise ValueError(f"SNI-1 service request failed: {exc}") from exc

        if response.status_code >= 400:
            detail = ""
            try:
                data = response.json()
                detail = str(data.get("detail") or data)
            except Exception:
                detail = response.text
            raise ValueError(f"SNI-1 service error {response.status_code}: {detail[:600]}")

        try:
            result = response.json()
        except Exception as exc:
            raise ValueError("SNI-1 service returned invalid JSON") from exc

        markdown = str(result.get("document_markdown") or "")
        tables = result.get("tables") if isinstance(result.get("tables"), dict) else {}
        meta = result.get("meta") if isinstance(result.get("meta"), dict) else {}

        source_ids = [artifact.get("id") for artifact in input_artifacts if artifact.get("id") is not None]
        doc_title = str(params.get("document_title") or "").strip() or "SNI-1 traffic report"
        console_title = str(params.get("console_title") or "").strip() or f"{doc_title} · console"

        tabs = self._tables_to_tabs(tables)
        preferred_tab = "overview" if any(tab.get("id") == "overview" for tab in tabs) else tabs[0].get("id")

        return [
            {
                "type": "document",
                "name": doc_title,
                "description": "Сводный отчет по SNI-трафику (SNI-1)",
                "data": {"content": markdown},
                "metadata": {
                    "source_plugin": self.id,
                    "source_input_path": input_path,
                    "sni1_meta": meta,
                    "derived_from": source_ids,
                },
            },
            {
                "type": "console",
                "name": console_title,
                "description": "Табличные результаты анализа SNI-1",
                "data": {
                    "profile_id": "sni_traffic_v2",
                    "profile_name": "SNI-1 traffic analysis",
                    "active_tab_id": preferred_tab,
                    "tabs": tabs,
                },
                "metadata": {
                    "source_plugin": self.id,
                    "source_input_path": input_path,
                    "sni1_meta": meta,
                    "derived_from": source_ids,
                },
            },
        ]
