# app/config.py
from typing import List
from pydantic_settings import BaseSettings
from pydantic import validator
import json


class Settings(BaseSettings):
    """Application settings loaded from environment variables."""

    # Database
    DATABASE_URL: str
    POSTGRES_USER: str
    POSTGRES_PASSWORD: str
    POSTGRES_DB: str

    # Redis
    REDIS_URL: str

    # Application
    SECRET_KEY: str
    ENVIRONMENT: str = "development"
    LOG_LEVEL: str = "INFO"
    API_V1_PREFIX: str = "/api/v1"

    # CORS
    BACKEND_CORS_ORIGINS: List[str] = [
        "http://localhost:3000",
        "http://localhost:5173",
        "http://127.0.0.1:3000",
        "http://127.0.0.1:5173",
    ]

    @validator("BACKEND_CORS_ORIGINS", pre=True)
    def assemble_cors_origins(cls, value):
        """Parse CORS origins from string or list."""
        if isinstance(value, str):
            if value.startswith("["):
                try:
                    return json.loads(value)
                except Exception:
                    return [item.strip() for item in value.strip("[]").split(",")]
            return [item.strip() for item in value.split(",")]
        return value

    # Celery
    CELERY_BROKER_URL: str = "redis://redis:6379/1"
    CELERY_RESULT_BACKEND: str = "redis://redis:6379/2"

    # File upload
    MAX_UPLOAD_SIZE: int = 10 * 1024 * 1024
    ALLOWED_UPLOAD_EXTENSIONS: List[str] = [".json", ".csv", ".graphml"]

    # Graph settings
    MAX_NODES_PER_GRAPH: int = 5000
    MAX_EDGES_PER_GRAPH: int = 50000

    # LLM service (OpenAI-compatible, e.g. LM Studio)
    LLM_BASE_URL: str = "http://host.docker.internal:1234/v1"
    LLM_ENABLED: bool = True
    LLM_API_KEY: str = "lm-studio"
    LLM_TIMEOUT_SECONDS: int = 120
    LLM_MAX_CONTEXT_CHARS: int = 24000
    LLM_MODEL_ANALYZE: str = "google/gemma-3-4b"
    LLM_MODEL_DRAFT: str = "qwen2.5-7b-instruct"
    LLM_MODEL_EDIT: str = "saiga_gemma2_9b"
    LLM_RUNTIME_LABEL: str = ""
    LLM_TEMPERATURE_ANALYZE: float = 0.1
    LLM_TEMPERATURE_DRAFT: float = 0.3
    LLM_TEMPERATURE_EDIT: float = 0.2

    # Geocoding. The public endpoint is suitable only for explicit, low-volume
    # lookups; point this setting to the internal Nominatim instance in production.
    GEOCODER_ENABLED: bool = False
    GEOCODER_BASE_URL: str = "https://nominatim.openstreetmap.org"
    GEOCODER_USER_AGENT: str = "Nodex/0.1"
    GEOCODER_TIMEOUT_SECONDS: int = 10
    GEOCODER_MIN_INTERVAL_SECONDS: float = 1.0
    GEOCODER_MAX_CONCURRENCY: int = 1

    # External reference-provider. The cell-tower catalogue is intentionally
    # stored outside the project database and queried by analysis plugins.
    CELL_TOWER_REFERENCE_DSN: str = ""
    CELL_TOWER_REFERENCE_TABLE: str = "cell_tower_reference"
    CELL_TOWER_REFERENCE_TIMEOUT_SECONDS: int = 20

    class Config:
        env_file = ".env"
        case_sensitive = True
        extra = "ignore"


settings = Settings()

if (
    settings.ENVIRONMENT == "production"
    and settings.SECRET_KEY == "your-secret-key-here-change-in-production"
):
    raise ValueError("SECRET_KEY must be changed in production!")
