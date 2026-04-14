"""LLM plugin for rewriting existing document artifacts in-place."""

from __future__ import annotations

from typing import Any, Dict, List, Optional

from app.services.llm_client import LLMClientError, get_llm_client
from plugins import PluginBase


class DocumentLLMRewritePlugin(PluginBase):
    id = "document_llm_rewrite"
    name = "LLM: Правка документа"
    version = "0.1.1"
    description = "Редактирует текущий документ через LLM с сохранением в тот же артефакт"
    menu_path = "AI/Document"
    input_types = ["document"]
    output_types = ["document"]
    applicable_to = ["document"]
    inputs = {
        "artifact_types": ["document"],
        "selection": {"text": "optional"},
    }
    params_schema = [
        {"key": "instruction", "label": "Что изменить в тексте", "type": "string", "required": False, "default": "Улучши структуру и читаемость, сохранив факты и смысл."},
        {"key": "style", "label": "Стиль", "type": "string", "required": False, "default": "нейтральный деловой"},
        {"key": "language", "label": "Язык", "type": "string", "required": False, "default": "ru"},
        {"key": "model", "label": "Модель (override)", "type": "string", "required": False, "default": ""},
        {"key": "temperature", "label": "Температура", "type": "number", "required": False},
        {"key": "max_tokens", "label": "Макс. токенов", "type": "integer", "required": False, "default": 1800},
    ]
    output_strategy = {
        "mode": "update_current",
        "history_action": "plugin_execute",
    }

    async def execute(self, input_artifacts: List[dict], params: Optional[Dict[str, Any]] = None) -> List[dict]:
        if not input_artifacts:
            return []

        params = params or {}
        artifact = input_artifacts[0]
        data = artifact.get("data") if isinstance(artifact.get("data"), dict) else {}
        content = str(data.get("content") or "").strip()
        if not content:
            raise ValueError("Document content is empty")

        instruction = str(params.get("instruction") or "").strip()
        if not instruction:
            instruction = "Улучши структуру и читаемость, сохранив факты и смысл."

        style = str(params.get("style") or "сохраняй факты, улучшай читаемость")
        language = str(params.get("language") or "ru")
        model = str(params.get("model") or "").strip() or None
        temperature = params.get("temperature")
        max_tokens = int(params.get("max_tokens") or 1800)

        try:
            llm = get_llm_client()
            llm_result = await llm.generate_text(
                task_mode="edit",
                instruction=instruction,
                source_context=content,
                style=style,
                language=language,
                model=model,
                temperature=float(temperature) if temperature is not None else None,
                max_tokens=max_tokens,
            )
        except LLMClientError as exc:
            raise ValueError(str(exc)) from exc

        next_data = {
            **data,
            "content": llm_result.text,
        }

        return [
            {
                "type": "document",
                "name": artifact.get("name") or "Document",
                "description": artifact.get("description"),
                "data": next_data,
                "metadata": {
                    "source_plugin": self.id,
                    "llm_model": llm_result.model,
                    "llm_usage": llm_result.usage,
                    "llm_latency_ms": llm_result.latency_ms,
                    "llm_runtime": llm_result.runtime_label or "unknown",
                },
            }
        ]
