""""
Configuration management using Pydantic settings.
"""
from typing import List, Optional
from pydantic_settings import BaseSettings
from pydantic import AnyHttpUrl, validator
import json
import os

class Settings(BaseSettings):
    """
    Application settings loaded from environment variables.
    """
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
    BACKEND_CORS_ORIGINS: List[AnyHttpUrl] = []

    @validator("BACKEND_CORS_ORIGINS", pre=True)
    def assemble_cors_origins(cls, v: str | List[str]) -> List[str] | str:
        """Parse CORS origins from string or list."""
        if isinstance(v, str) and not v.startswith("["):
            return [i.strip() for i in v.split(",")]
        elif isinstance(v, (list, str)):
            return v
        raise ValueError(v)

    # Celery
    CELERY_BROKER_URL: str = "redis://redis:6379/1"
    CELERY_RESULT_BACKEND: str = "redis://redis:6379/2"

    # File upload
    MAX_UPLOAD_SIZE: int = 10 * 1024 * 1024  # 10MB
    ALLOWED_UPLOAD_EXTENSIONS: List[str] = [".json", ".csv", ".graphml"]

    # Graph settings
    MAX_NODES_PER_GRAPH: int = 5000
    MAX_EDGES_PER_GRAPH: int = 50000

    class Config:
        env_file = ".env"
        case_sensitive = True
        extra = "ignore"  # Игнорировать лишние поля

# Create global settings instance
settings = Settings()

# Validate critical settings
if settings.ENVIRONMENT == "production" and settings.SECRET_KEY == "your-secret-key-here-change-in-production":
    raise ValueError("SECRET_KEY must be changed in production!")
