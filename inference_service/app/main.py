from typing import List

import torch
from fastapi import FastAPI, HTTPException

from app.config import settings
from app.engines import engines
from app.schemas import (
    EmbedRequest,
    EmbedResponse,
    HealthResponse,
    RerankItem,
    RerankRequest,
    RerankResponse,
)

app = FastAPI(
    title="GraphAnalyzer Inference Service",
    version="0.1.0",
    docs_url="/docs",
    redoc_url="/redoc",
)


@app.on_event("startup")
def startup_event() -> None:
    if settings.PRELOAD_MODELS:
        engines.load_embedder()
        engines.load_reranker()


@app.get("/health", response_model=HealthResponse)
def health() -> HealthResponse:
    is_cuda_requested = settings.DEVICE.startswith("cuda")
    if is_cuda_requested and not torch.cuda.is_available():
        raise HTTPException(status_code=503, detail="CUDA is not available")

    return HealthResponse(
        status="ok",
        device=settings.DEVICE,
        embedding_model=settings.EMBEDDING_MODEL,
        rerank_model=settings.RERANK_MODEL,
        embedding_loaded=engines.state.embedder_loaded,
        rerank_loaded=engines.state.reranker_loaded,
    )


@app.post("/embed", response_model=EmbedResponse)
def embed(payload: EmbedRequest) -> EmbedResponse:
    texts = [text.strip() for text in payload.texts if text and text.strip()]
    if not texts:
        raise HTTPException(status_code=400, detail="No valid texts provided")

    vectors = engines.embed(
        texts=texts,
        normalize_embeddings=payload.normalize_embeddings,
    )

    return EmbedResponse(
        model=settings.EMBEDDING_MODEL,
        dimensions=len(vectors[0]),
        embeddings=vectors,
    )


@app.post("/rerank", response_model=RerankResponse)
def rerank(payload: RerankRequest) -> RerankResponse:
    documents = [doc for doc in payload.documents if doc and doc.strip()]
    if not documents:
        raise HTTPException(status_code=400, detail="No valid documents provided")

    scores = engines.rerank(payload.query, documents)
    ranked = sorted(
        enumerate(scores),
        key=lambda item: item[1],
        reverse=True,
    )

    top_k = payload.top_k or settings.TOP_K_DEFAULT
    top_k = max(1, min(top_k, len(documents)))

    items: List[RerankItem] = []
    for rank, (original_index, score) in enumerate(ranked[:top_k], start=1):
        items.append(
            RerankItem(
                rank=rank,
                score=score,
                document=documents[original_index],
            )
        )

    return RerankResponse(model=settings.RERANK_MODEL, items=items)
