from __future__ import annotations

import json
import logging
import os
import re
from dataclasses import dataclass
from datetime import datetime
from typing import Any

_NULLISH = {"", "-", "null", "none", "nan", "n/a"}
_DATETIME_FORMATS = (
    "%d.%m.%Y %H:%M",
    "%d.%m.%Y %H:%M:%S",
    "%Y-%m-%d %H:%M:%S",
    "%Y-%m-%dT%H:%M:%S",
)


@dataclass(frozen=True)
class Settings:
    refs_dir: str | None
    service_url: str | None
    max_chronology_rows: int
    default_top_n: int
    default_gap_minutes: int
    max_table_rows: int
    profile_enabled: bool
    profile_output: str | None
    log_level: str


def get_settings() -> Settings:
    """Read runtime settings from environment variables."""
    return Settings(
        refs_dir=os.getenv("SNI_REFS_DIR"),
        service_url=os.getenv("SNI_SERVICE_URL"),
        max_chronology_rows=_env_int("SNI_MAX_CHRONOLOGY_ROWS", 20, minimum=1),
        default_top_n=_env_int("SNI_DEFAULT_TOP_N", 25, minimum=1),
        default_gap_minutes=_env_int("SNI_DEFAULT_GAP_MINUTES", 180, minimum=1),
        max_table_rows=_env_int("SNI_MAX_TABLE_ROWS", 5000, minimum=200),
        profile_enabled=_env_bool("SNI_PROFILE_ENABLED", False),
        profile_output=os.getenv("SNI_PROFILE_OUTPUT"),
        log_level=os.getenv("SNI_LOG_LEVEL", "INFO").upper(),
    )


def get_logger(name: str = "sni_traffic_report") -> logging.Logger:
    """Create or reuse project logger with configured level."""
    logger = logging.getLogger(name)
    settings = get_settings()
    logger.setLevel(getattr(logging, settings.log_level, logging.INFO))
    if not logger.handlers:
        handler = logging.StreamHandler()
        handler.setFormatter(logging.Formatter("%(asctime)s %(levelname)s %(name)s %(message)s"))
        logger.addHandler(handler)
    return logger


def log_event(logger: logging.Logger, message: str, **fields: Any) -> None:
    """Emit lightweight structured log entry as JSON payload."""
    payload = json.dumps(fields, ensure_ascii=False, default=str)
    logger.info("%s | %s", message, payload)


def clean_text(value: object, *, treat_zero_as_null: bool = False) -> str | None:
    if value is None:
        return None
    text = str(value).replace("\ufeff", "").strip()
    if not text:
        return None

    lowered = text.lower()
    if lowered in _NULLISH or (treat_zero_as_null and lowered == "0"):
        return None

    return text


def normalize_header(value: object) -> str:
    text = clean_text(value) or ""
    text = re.sub(r"\s+", " ", text)
    return text.lower()


def parse_datetime(value: object) -> datetime | None:
    text = clean_text(value, treat_zero_as_null=True)
    if text is None:
        return None

    text = re.sub(r"\s+", " ", text)
    for fmt in _DATETIME_FORMATS:
        try:
            return datetime.strptime(text, fmt)
        except ValueError:
            continue
    return None


def parse_int(value: object) -> int | None:
    text = clean_text(value)
    if text is None:
        return None

    normalized = text.replace("\u00a0", " ").replace(" ", "")
    if not re.fullmatch(r"\d+", normalized):
        return None

    return int(normalized)


def _env_int(name: str, default: int, *, minimum: int = 1) -> int:
    raw = os.getenv(name)
    if raw is None:
        return default
    try:
        value = int(raw)
    except ValueError:
        return default
    if value < minimum:
        return default
    return value


def _env_bool(name: str, default: bool) -> bool:
    raw = os.getenv(name)
    if raw is None:
        return default
    return raw.strip().lower() in {"1", "true", "yes", "on"}
