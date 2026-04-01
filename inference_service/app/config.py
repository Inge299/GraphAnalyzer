from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    """Runtime settings for local embedding and reranking service."""

    EMBEDDING_MODEL: str = "BAAI/bge-m3"
    RERANK_MODEL: str = "BAAI/bge-reranker-v2-m3"
    DEVICE: str = "cuda"
    BATCH_SIZE: int = 16
    PRELOAD_MODELS: bool = True
    TOP_K_DEFAULT: int = 10

    class Config:
        env_file = ".env"
        case_sensitive = True


settings = Settings()
