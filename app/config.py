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

    # Inference service
    INFERENCE_URL: str = "http://inference:8001"
    INFERENCE_TIMEOUT_SECONDS: int = 60
    INFERENCE_EMBEDDING_MODEL: str = "BAAI/bge-m3"
    INFERENCE_RERANK_MODEL: str = "BAAI/bge-reranker-v2-m3"

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
