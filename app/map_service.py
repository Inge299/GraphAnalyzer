"""Dedicated, database-free vector-tile service for closed deployments."""

from contextlib import asynccontextmanager

from fastapi import FastAPI

from app.routers import map_tiles


@asynccontextmanager
async def lifespan(_: FastAPI):
    yield
    await map_tiles.close_reader()


app = FastAPI(title="Nodex map tiles", docs_url=None, redoc_url=None, lifespan=lifespan)
app.include_router(map_tiles.router, prefix="/api/v1/map", tags=["map"])


@app.get("/health")
async def health() -> dict[str, str]:
    return {"status": "healthy", "service": "map"}
