# Inference Service

Local GPU service for embeddings and reranking.

## Endpoints

- `GET /health`
- `POST /embed`
- `POST /rerank`

## Run

```bash
docker compose up -d inference
```

## Example requests

```bash
curl -X POST http://localhost:8001/embed \
  -H "Content-Type: application/json" \
  -d '{"texts": ["example text"]}'
```

```bash
curl -X POST http://localhost:8001/rerank \
  -H "Content-Type: application/json" \
  -d '{"query": "incident INC-2024-001", "documents": ["doc 1", "doc 2"], "top_k": 2}'
```
