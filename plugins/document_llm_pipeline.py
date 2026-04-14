"""LLM pipeline plugin for multi-step document generation."""

from __future__ import annotations

import json
import re
from dataclasses import dataclass
from typing import Any, Dict, List, Optional, Tuple

from app.services.llm_client import LLMClientError, LLMTextResult, get_llm_client
from plugins import PluginBase


PLAN_SOURCE_LIMIT = 7000
SECTION_SOURCE_LIMIT = 4500
PRIOR_BLOCKS_LIMIT = 2500
POLISH_DRAFT_LIMIT = 7000
RETRY_SOURCE_LIMIT = 2800


def _truncate(value: str, limit: int = 6000) -> str:
    text = str(value or "")
    if len(text) <= limit:
        return text
    return f"{text[:limit]}\n... [truncated {len(text) - limit} chars]"


def _compact(value: str, limit: int) -> str:
    text = str(value or "").strip()
    if len(text) <= limit:
        return text
    if limit < 300:
        return text[:limit]
    head = int(limit * 0.75)
    tail = limit - head - 18
    return f"{text[:head]}\n... [truncated] ...\n{text[-max(tail, 0):]}"


def _is_context_overflow_error(exc: Exception) -> bool:
    message = str(exc).lower()
    markers = ("context length", "n_keep", "n_ctx", "too many tokens", "maximum context")
    return any(marker in message for marker in markers)


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
        for node in nodes[:50]:
            lines.append(f"- {_node_display(node)}")

    if edges:
        lines.append("Edge sample:")
        for edge in edges[:80]:
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
        "rows_sample": rows[:40],
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


def _extract_json_object(raw: str) -> Optional[Dict[str, Any]]:
    text = str(raw or "").strip()
    if not text:
        return None

    try:
        parsed = json.loads(text)
        return parsed if isinstance(parsed, dict) else None
    except Exception:
        pass

    fence_match = re.search(r"```(?:json)?\s*(\{[\s\S]*?\})\s*```", text, re.IGNORECASE)
    if fence_match:
        try:
            parsed = json.loads(fence_match.group(1))
            return parsed if isinstance(parsed, dict) else None
        except Exception:
            pass

    start = text.find("{")
    end = text.rfind("}")
    if start != -1 and end > start:
        candidate = text[start : end + 1]
        try:
            parsed = json.loads(candidate)
            return parsed if isinstance(parsed, dict) else None
        except Exception:
            return None

    return None


def _to_int(value: Any, default: int) -> int:
    try:
        return int(value)
    except Exception:
        return default


@dataclass
class PipelineSection:
    section_id: str
    title: str
    goal: str


class DocumentLLMPipelinePlugin(PluginBase):
    id = "document_llm_pipeline"
    name = "LLM: Документ (многошаговый)"
    version = "0.1.1"
    description = "Формирует документ серией LLM-шагов (план, блоки, полировка)"
    menu_path = "AI/Document"
    input_types = ["graph", "table", "document", "map", "chart"]
    output_types = ["document"]
    applicable_to = ["graph", "table", "document", "map", "chart"]
    inputs = {
        "artifact_types": ["graph", "table", "document", "map", "chart"],
        "selection": {"text": "optional", "rows": "optional", "nodes": "optional", "edges": "optional"},
    }
    params_schema = [
        {
            "key": "instruction",
            "label": "Цель документа",
            "type": "string",
            "required": False,
            "default": "Подготовь аналитический документ по данным графа/артефактов.",
        },
        {
            "key": "title",
            "label": "Название документа",
            "type": "string",
            "required": False,
            "default": "",
        },
        {
            "key": "language",
            "label": "Язык",
            "type": "string",
            "required": False,
            "default": "ru",
        },
        {
            "key": "style",
            "label": "Стиль",
            "type": "string",
            "required": False,
            "default": "деловой и конкретный",
        },
        {
            "key": "max_sections",
            "label": "Макс. блоков",
            "type": "integer",
            "required": False,
            "default": 6,
        },
        {
            "key": "polish_pass",
            "label": "Финальная полировка (1/0)",
            "type": "integer",
            "required": False,
            "default": 1,
        },
        {
            "key": "model",
            "label": "Модель (override)",
            "type": "string",
            "required": False,
            "default": "",
        },
        {
            "key": "max_tokens_section",
            "label": "Токены на блок",
            "type": "integer",
            "required": False,
            "default": 900,
        },
        {
            "key": "max_tokens_polish",
            "label": "Токены на полировку",
            "type": "integer",
            "required": False,
            "default": 1400,
        },
    ]

    async def _call_llm(
        self,
        *,
        task_mode: str,
        instruction: str,
        source_context: str,
        style: str,
        language: str,
        model: Optional[str],
        max_tokens: int,
    ) -> LLMTextResult:
        llm = get_llm_client()
        try:
            return await llm.generate_text(
                task_mode=task_mode,
                instruction=instruction,
                source_context=source_context,
                style=style,
                language=language,
                model=model,
                max_tokens=max_tokens,
            )
        except LLMClientError as exc:
            if _is_context_overflow_error(exc):
                return await llm.generate_text(
                    task_mode=task_mode,
                    instruction=f"{instruction}\n\nПиши коротко и только по ключевым фактам.",
                    source_context=_compact(source_context, RETRY_SOURCE_LIMIT),
                    style=style,
                    language=language,
                    model=model,
                    max_tokens=max(500, min(max_tokens, 800)),
                )
            raise

    async def _build_plan(
        self,
        *,
        instruction: str,
        source_context: str,
        style: str,
        language: str,
        model: Optional[str],
        max_sections: int,
    ) -> Tuple[List[PipelineSection], Optional[LLMTextResult]]:
        plan_instruction = (
            "Составь план аналитического документа по данным. "
            "Верни строго JSON-объект без markdown и комментариев в формате: "
            '{"sections":[{"id":"section_1","title":"...","goal":"..."}]}. '
            f"Количество секций: от 3 до {max_sections}."
        )
        plan_result = await self._call_llm(
            task_mode="analyze",
            instruction=plan_instruction,
            source_context=f"Задача пользователя:\n{instruction}\n\nДанные:\n{_compact(source_context, PLAN_SOURCE_LIMIT)}",
            style=style,
            language=language,
            model=model,
            max_tokens=600,
        )

        parsed = _extract_json_object(plan_result.text)
        sections_raw = parsed.get("sections") if isinstance(parsed, dict) else None

        sections: List[PipelineSection] = []
        if isinstance(sections_raw, list):
            for index, item in enumerate(sections_raw[:max_sections]):
                if not isinstance(item, dict):
                    continue
                title = str(item.get("title") or "").strip()
                goal = str(item.get("goal") or "").strip()
                section_id = str(item.get("id") or f"section_{index + 1}").strip() or f"section_{index + 1}"
                if not title:
                    continue
                sections.append(PipelineSection(section_id=section_id, title=title, goal=goal or title))

        if sections:
            return sections, plan_result

        fallback = [
            PipelineSection("section_1", "Краткое резюме", "Ключевые выводы по данным"),
            PipelineSection("section_2", "Структура данных", "Какие сущности и связи представлены"),
            PipelineSection("section_3", "Наблюдения и риски", "Практические выводы и ограничения"),
        ]
        return fallback[:max_sections], plan_result

    async def execute(self, input_artifacts: List[dict], params: Optional[Dict[str, Any]] = None) -> List[dict]:
        if not input_artifacts:
            return []

        params = params or {}
        instruction = str(
            params.get("instruction") or "Подготовь аналитический документ по данным графа/артефактов."
        ).strip()
        language = str(params.get("language") or "ru")
        style = str(params.get("style") or "деловой и конкретный")
        model = str(params.get("model") or "").strip() or None

        max_sections = max(3, min(_to_int(params.get("max_sections"), 6), 8))
        max_tokens_section = max(400, min(_to_int(params.get("max_tokens_section"), 900), 1600))
        max_tokens_polish = max(600, min(_to_int(params.get("max_tokens_polish"), 1400), 2200))
        polish_enabled = _to_int(params.get("polish_pass"), 1) != 0

        source_context = "\n\n".join(_artifact_preview(artifact) for artifact in input_artifacts)
        source_context_compact = _compact(source_context, SECTION_SOURCE_LIMIT)

        try:
            sections, plan_result = await self._build_plan(
                instruction=instruction,
                source_context=source_context_compact,
                style=style,
                language=language,
                model=model,
                max_sections=max_sections,
            )
        except LLMClientError as exc:
            raise ValueError(str(exc)) from exc

        blocks: List[Dict[str, str]] = []
        warnings: List[str] = []
        runtime_label = "unknown"
        model_name = model or ""
        total_latency_ms = plan_result.latency_ms if plan_result else 0
        steps_done = 1 if plan_result else 0

        cumulative_usage: Dict[str, int] = {
            "prompt_tokens": 0,
            "completion_tokens": 0,
            "total_tokens": 0,
        }

        def _add_usage(usage: Dict[str, Any]) -> None:
            for key in cumulative_usage:
                value = usage.get(key) if isinstance(usage, dict) else 0
                try:
                    cumulative_usage[key] += int(value or 0)
                except Exception:
                    pass

        if plan_result:
            runtime_label = plan_result.runtime_label or runtime_label
            model_name = plan_result.model or model_name
            _add_usage(plan_result.usage)

        for section in sections:
            prior_sections = "\n\n".join(f"### {item['title']}\n{item['markdown']}" for item in blocks)
            section_context = (
                f"Задача пользователя:\n{instruction}\n\n"
                f"Сжатые исходные данные:\n{source_context_compact}\n\n"
                f"Уже сформированные блоки:\n{_compact(prior_sections or 'Пока нет сформированных блоков.', PRIOR_BLOCKS_LIMIT)}\n\n"
                f"Текущий блок: {section.title}\n"
                f"Цель блока: {section.goal}\n"
            )

            section_instruction = (
                "Сформируй только один аналитический блок в Markdown. "
                f"Название блока: {section.title}. "
                "Используй только подтверждаемые факты из входных данных и не добавляй домыслов."
            )

            try:
                section_result = await self._call_llm(
                    task_mode="draft",
                    instruction=section_instruction,
                    source_context=section_context,
                    style=style,
                    language=language,
                    model=model,
                    max_tokens=max_tokens_section,
                )
            except LLMClientError as exc:
                warnings.append(f"Блок '{section.title}' не сгенерирован: {exc}")
                continue

            steps_done += 1
            total_latency_ms += section_result.latency_ms
            runtime_label = section_result.runtime_label or runtime_label
            model_name = section_result.model or model_name
            _add_usage(section_result.usage)

            blocks.append(
                {
                    "section_id": section.section_id,
                    "title": section.title,
                    "markdown": section_result.text.strip(),
                }
            )

        if not blocks:
            raise ValueError("Не удалось сформировать ни одного блока документа")

        assembled = "\n\n".join(f"## {item['title']}\n\n{item['markdown']}" for item in blocks)
        final_content = assembled

        if polish_enabled:
            try:
                polish_context = (
                    f"Задача пользователя:\n{instruction}\n\n"
                    f"Сжатые исходные данные:\n{source_context_compact}\n\n"
                    f"Черновик документа:\n{_compact(assembled, POLISH_DRAFT_LIMIT)}"
                )
                polish_result = await self._call_llm(
                    task_mode="edit",
                    instruction="Выполни финальную полировку документа: улучшай связность и стиль, не меняя факты.",
                    source_context=polish_context,
                    style=style,
                    language=language,
                    model=model,
                    max_tokens=max_tokens_polish,
                )
                steps_done += 1
                total_latency_ms += polish_result.latency_ms
                runtime_label = polish_result.runtime_label or runtime_label
                model_name = polish_result.model or model_name
                _add_usage(polish_result.usage)
                final_content = polish_result.text.strip() or assembled
            except LLMClientError as exc:
                warnings.append(f"Финальная полировка не выполнена: {exc}")

        first = input_artifacts[0]
        title = str(params.get("title") or "").strip() or f"{first.get('name', 'Artifact')} · LLM pipeline document"

        return [
            {
                "type": "document",
                "name": title,
                "description": "Документ сформирован многошаговым LLM-пайплайном",
                "data": {"content": final_content},
                "metadata": {
                    "source_plugin": self.id,
                    "llm_model": model_name or "unknown",
                    "llm_runtime": runtime_label or "unknown",
                    "llm_latency_ms": total_latency_ms,
                    "llm_task_mode": "pipeline",
                    "llm_usage": cumulative_usage,
                    "llm_pipeline_steps": steps_done,
                    "llm_pipeline_sections": [item["title"] for item in blocks],
                    "llm_pipeline_warnings": warnings,
                    "derived_from": [artifact.get("id") for artifact in input_artifacts if artifact.get("id") is not None],
                },
            }
        ]
