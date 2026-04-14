"""OpenAI-compatible LLM client used by plugins."""

from __future__ import annotations

from dataclasses import dataclass
from time import perf_counter
from typing import Any, Dict, List, Optional

import httpx

from app.config import settings


class LLMClientError(RuntimeError):
    """Base class for LLM client errors."""


class LLMConfigurationError(LLMClientError):
    """Raised when LLM configuration is invalid."""


class LLMProviderError(LLMClientError):
    """Raised when provider call failed."""


@dataclass
class LLMTextResult:
    text: str
    model: str
    usage: Dict[str, Any]
    latency_ms: int
    runtime_label: str


class LLMClient:
    """Thin client over OpenAI-compatible chat completions API."""

    def __init__(self) -> None:
        base_url = str(settings.LLM_BASE_URL or "").strip()
        if not base_url:
            raise LLMConfigurationError("LLM_BASE_URL is not configured")
        self.base_url = base_url.rstrip("/")
        self.api_key = str(settings.LLM_API_KEY or "").strip() or "lm-studio"
        self.timeout_seconds = int(settings.LLM_TIMEOUT_SECONDS)
        self.max_context_chars = int(settings.LLM_MAX_CONTEXT_CHARS)
        self.runtime_label = str(getattr(settings, "LLM_RUNTIME_LABEL", "") or "").strip()

        self.default_models = {
            "analyze": str(settings.LLM_MODEL_ANALYZE or "").strip(),
            "draft": str(settings.LLM_MODEL_DRAFT or "").strip(),
            "edit": str(settings.LLM_MODEL_EDIT or "").strip(),
        }
        self.default_temperatures = {
            "analyze": float(settings.LLM_TEMPERATURE_ANALYZE),
            "draft": float(settings.LLM_TEMPERATURE_DRAFT),
            "edit": float(settings.LLM_TEMPERATURE_EDIT),
        }

    def _resolve_mode(self, task_mode: str) -> str:
        normalized = str(task_mode or "draft").strip().lower()
        if normalized not in {"analyze", "draft", "edit"}:
            return "draft"
        return normalized

    def _resolve_model(self, task_mode: str, model: Optional[str]) -> str:
        override_model = str(model or "").strip()
        if override_model:
            return override_model
        mode = self._resolve_mode(task_mode)
        configured = str(self.default_models.get(mode) or "").strip()
        if configured:
            return configured
        fallback = str(self.default_models.get("draft") or "").strip()
        if fallback:
            return fallback
        raise LLMConfigurationError("LLM model is not configured")

    def _resolve_temperature(self, task_mode: str, temperature: Optional[float]) -> float:
        if temperature is not None:
            return float(temperature)
        mode = self._resolve_mode(task_mode)
        return float(self.default_temperatures.get(mode, 0.2))

    def _headers(self) -> Dict[str, str]:
        return {
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json",
        }

    def _build_messages(
        self,
        task_mode: str,
        instruction: str,
        source_context: str,
        style: str,
        language: str,
        system_prompt: Optional[str],
    ) -> List[Dict[str, str]]:
        mode = self._resolve_mode(task_mode)

        system = (system_prompt or "").strip()
        if not system:
            if mode == "analyze":
                system = "Ты аналитик данных. Возвращай точные и проверяемые формулировки без домыслов."
            elif mode == "edit":
                system = "Ты редактор. Улучшай структуру и ясность текста, не искажая факты."
            else:
                system = "Ты помощник по подготовке документов. Пиши структурированно и по делу."

        user_payload = (
            f"Задача:\n{instruction.strip() or 'Подготовь документ по данным.'}\n\n"
            f"Язык: {language or 'ru'}\n"
            f"Стиль: {style or 'нейтральный деловой'}\n\n"
            "Исходные данные:\n"
            f"{source_context}"
        )

        return [
            {"role": "system", "content": system},
            {"role": "user", "content": user_payload[: self.max_context_chars]},
        ]

    @staticmethod
    def _extract_text(response_json: Dict[str, Any]) -> str:
        choices = response_json.get("choices")
        if not isinstance(choices, list) or not choices:
            return ""

        message = choices[0].get("message") if isinstance(choices[0], dict) else None
        if not isinstance(message, dict):
            return ""

        content = message.get("content")
        if isinstance(content, str):
            return content.strip()

        if isinstance(content, list):
            parts: List[str] = []
            for item in content:
                if isinstance(item, dict) and isinstance(item.get("text"), str):
                    parts.append(item["text"])
            return "\n".join(parts).strip()

        return ""

    async def generate_text(
        self,
        *,
        task_mode: str,
        instruction: str,
        source_context: str,
        style: str = "",
        language: str = "ru",
        model: Optional[str] = None,
        temperature: Optional[float] = None,
        top_p: float = 0.95,
        max_tokens: int = 1600,
        system_prompt: Optional[str] = None,
    ) -> LLMTextResult:
        resolved_model = self._resolve_model(task_mode, model)
        resolved_temperature = self._resolve_temperature(task_mode, temperature)
        messages = self._build_messages(task_mode, instruction, source_context, style, language, system_prompt)

        payload = {
            "model": resolved_model,
            "messages": messages,
            "temperature": resolved_temperature,
            "top_p": float(top_p),
            "max_tokens": int(max_tokens),
            "stream": False,
        }

        url = f"{self.base_url}/chat/completions"
        started = perf_counter()
        async with httpx.AsyncClient(timeout=self.timeout_seconds) as client:
            try:
                response = await client.post(url, headers=self._headers(), json=payload)
            except Exception as exc:
                raise LLMProviderError(f"LLM request failed: {exc}") from exc
        latency_ms = int((perf_counter() - started) * 1000)

        if response.status_code >= 400:
            details = response.text.strip()
            raise LLMProviderError(f"LLM provider error {response.status_code}: {details[:500]}")

        try:
            data = response.json()
        except Exception as exc:
            raise LLMProviderError("LLM provider returned invalid JSON") from exc

        text = self._extract_text(data)
        if not text:
            raise LLMProviderError("LLM provider returned empty response")

        usage = data.get("usage") if isinstance(data.get("usage"), dict) else {}
        model_name = str(data.get("model") or resolved_model)
        return LLMTextResult(
            text=text,
            model=model_name,
            usage=usage,
            latency_ms=latency_ms,
            runtime_label=self.runtime_label,
        )


_client: Optional[LLMClient] = None


def get_llm_client() -> LLMClient:
    global _client
    if _client is None:
        _client = LLMClient()
    return _client
