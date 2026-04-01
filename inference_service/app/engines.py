from __future__ import annotations

from dataclasses import dataclass
from threading import Lock
from typing import List

from sentence_transformers import CrossEncoder, SentenceTransformer

from app.config import settings


@dataclass
class EngineState:
    embedder_loaded: bool = False
    reranker_loaded: bool = False


class InferenceEngines:
    """Lazy loading wrapper for embedding and reranker models."""

    def __init__(self) -> None:
        self._embedder: SentenceTransformer | None = None
        self._reranker: CrossEncoder | None = None
        self._lock = Lock()
        self.state = EngineState()

    def load_embedder(self) -> SentenceTransformer:
        if self._embedder is None:
            with self._lock:
                if self._embedder is None:
                    self._embedder = SentenceTransformer(
                        settings.EMBEDDING_MODEL,
                        device=settings.DEVICE,
                    )
                    self.state.embedder_loaded = True
        return self._embedder

    def load_reranker(self) -> CrossEncoder:
        if self._reranker is None:
            with self._lock:
                if self._reranker is None:
                    self._reranker = CrossEncoder(
                        settings.RERANK_MODEL,
                        max_length=512,
                        device=settings.DEVICE,
                    )
                    self.state.reranker_loaded = True
        return self._reranker

    def embed(self, texts: List[str], normalize_embeddings: bool) -> List[List[float]]:
        embedder = self.load_embedder()
        vectors = embedder.encode(
            texts,
            batch_size=settings.BATCH_SIZE,
            normalize_embeddings=normalize_embeddings,
            show_progress_bar=False,
            convert_to_numpy=True,
        )
        return vectors.tolist()

    def rerank(self, query: str, documents: List[str]) -> List[float]:
        reranker = self.load_reranker()
        pairs = [[query, doc] for doc in documents]
        scores = reranker.predict(pairs)
        return [float(score) for score in scores]


engines = InferenceEngines()
