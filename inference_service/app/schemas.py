from typing import List, Optional

from pydantic import BaseModel, Field


class EmbedRequest(BaseModel):
    texts: List[str] = Field(..., min_length=1)
    normalize_embeddings: bool = True


class EmbedResponse(BaseModel):
    model: str
    dimensions: int
    embeddings: List[List[float]]


class RerankRequest(BaseModel):
    query: str = Field(..., min_length=1)
    documents: List[str] = Field(..., min_length=1)
    top_k: Optional[int] = None


class RerankItem(BaseModel):
    rank: int
    score: float
    document: str


class RerankResponse(BaseModel):
    model: str
    items: List[RerankItem]


class HealthResponse(BaseModel):
    status: str
    device: str
    embedding_model: str
    rerank_model: str
    embedding_loaded: bool
    rerank_loaded: bool
