"""LLM plugin for composing document artifacts from project artifacts."""

from __future__ import annotations

import json
from typing import Any, Dict, List, Optional

from app.services.llm_client import LLMClientError, get_llm_client
from plugins import PluginBase


def _truncate(value: str, limit: int = 6000) -> str:
    text = str(value or "")
    if len(text) <= limit:
        return text
    return f"{text[:limit]}\n... [truncated {len(text) - limit} chars]"


def _node_display(node: Dict[str, Any]) -> str:
    attributes = node.get("attributes") if isinstance(node.get("attributes"), dict) else {}
    visual = attributes.get("visual") if isinstance(attributes.get("visual"), dict) else {}
    label = node.get("label") or visual.get("label") or attributes.get("label") or "Без подписи"
    node_type = node.get("type") or "unknown"
    return f"{label} ({node_type})"


def _preview_graph(data: Dict[str, Any]) -> str:
    nodes = data.get("nodes") if isinstance(data.get("nodes"), list) else []
    edges = data.get("edges") if isinstance(data.get("edges"), list) else []
    lines = [f"nodes={len(nodes)}, edges={len(edges)}"]

    id_to_display: Dict[str, str] = {}
    for node in nodes:
        node_id = str(node.get("id") or "").strip()
        if node_id:
            id_to_display[node_id] = _node_display(node)

    if nodes:
        lines.append("Node sample:")
        for node in nodes[:30]:
            lines.append(f"- {_node_display(node)}")

    if edges:
        lines.append("Edge sample:")
        for edge in edges[:40]:
            label = edge.get("label") or edge.get("type") or "edge"
            from_display = id_to_display.get(str(edge.get("from") or ""), "Неизвестный узел")
            to_display = id_to_display.get(str(edge.get("to") or ""), "Неизвестный узел")
            lines.append(f"- {from_display} -> {to_display} ({label})")

    return "\n".join(lines)


def _preview_table(data: Dict[str, Any]) -> str:
    columns = data.get("columns") if isinstance(data.get("columns"), list) else []
    rows = data.get("rows") if isinstance(data.get("rows"), list) else []
    payload = {
        "columns": columns,
        "rows_count": len(rows),
        "rows_sample": rows[:20],
    }
    return json.dumps(payload, ensure_ascii=False, indent=2)


def _preview_document(data: Dict[str, Any]) -> str:
    content = data.get("content")
    if isinstance(content, str):
        return content
    return json.dumps(data, ensure_ascii=False, indent=2)


def _artifact_preview(artifact: Dict[str, Any]) -> str:
    artifact_type = str(artifact.get("type") or "")
    artifact_name = str(artifact.get("name") or artifact_type)
    data = artifact.get("data") if isinstance(artifact.get("data"), dict) else {}

    if artifact_type == "graph":
        body = _preview_graph(data)
    elif artifact_type == "table":
        body = _preview_table(data)
    elif artifact_type == "document":
        body = _preview_document(data)
    else:
        body = json.dumps(data, ensure_ascii=False, indent=2)

    return f"Artifact: {artifact_name} [{artifact_type}]\n{_truncate(body)}"


class DocumentLLMComposePlugin(PluginBase):
    id = "document_llm_compose"
    name = "LLM: Сформировать документ"
    version = "0.1.2"
    description = "Создает артефакт документа по входным данным с помощью LLM"
    menu_path = "AI/Document"
    input_types = ["graph", "table", "document", "map", "chart"]
    output_types = ["document"]
    applicable_to = ["graph", "table", "document", "map", "chart"]
    inputs = {
        "artifact_types": ["graph", "table", "document", "map", "chart"],
        "selection": {"text": "optional", "rows": "optional", "nodes": "optional", "edges": "optional"},
    }
    params_schema = [
        {"key": "instruction", "label": "Задача для LLM", "type": "string", "required": False, "default": "Подготовь структурированный аналитический документ на основе данных."},
        {"key": "task_mode", "label": "Режим (analyze|draft|edit)", "type": "string", "required": False, "default": "draft"},
        {"key": "title", "label": "Название документа", "type": "string", "required": False, "default": ""},
        {"key": "style", "label": "Стиль", "type": "string", "required": False, "default": "деловой и конкретный"},
        {"key": "language", "label": "Язык", "type": "string", "required": False, "default": "ru"},
        {"key": "model", "label": "Модель (override)", "type": "string", "required": False, "default": ""},
        {"key": "temperature", "label": "Температура", "type": "number", "required": False},
        {"key": "max_tokens", "label": "Макс. токенов", "type": "integer", "required": False, "default": 1600},
    ]

    async def execute(self, input_artifacts: List[dict], params: Optional[Dict[str, Any]] = None) -> List[dict]:
        if not input_artifacts:
            return []

        params = params or {}
        task_mode = str(params.get("task_mode") or "draft")
        instruction = str(
            params.get("instruction")
            or "Подготовь структурированный аналитический документ на основе предоставленных данных."
        ).strip()
        style = str(params.get("style") or "деловой и конкретный")
        language = str(params.get("language") or "ru")
        model = str(params.get("model") or "").strip() or None
        temperature = params.get("temperature")
        max_tokens = int(params.get("max_tokens") or 1600)

        context_parts = [_artifact_preview(artifact) for artifact in input_artifacts]
        source_context = "\n\n".join(context_parts)

        try:
            llm = get_llm_client()
            llm_result = await llm.generate_text(
                task_mode=task_mode,
                instruction=instruction,
                source_context=source_context,
                style=style,
                language=language,
                model=model,
                temperature=float(temperature) if temperature is not None else None,
                max_tokens=max_tokens,
            )
        except LLMClientError as exc:
            raise ValueError(str(exc)) from exc

        first = input_artifacts[0]
        title = str(params.get("title") or "").strip() or f"{first.get('name', 'Artifact')} · LLM document"

        return [
            {
                "type": "document",
                "name": title,
                "description": "Документ сформирован с помощью LLM",
                "data": {"content": llm_result.text},
                "metadata": {
                    "source_plugin": self.id,
                    "llm_model": llm_result.model,
                    "llm_usage": llm_result.usage,
                    "llm_task_mode": task_mode,
                    "llm_latency_ms": llm_result.latency_ms,
                    "llm_runtime": llm_result.runtime_label or "unknown",
                    "derived_from": [artifact.get("id") for artifact in input_artifacts if artifact.get("id") is not None],
                },
            }
        ]
