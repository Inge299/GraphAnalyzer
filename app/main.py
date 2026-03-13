"""
Main FastAPI application module for OSINT Graph Analyzer.
"""
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
import logging
from typing import Dict

from app.config import settings
from app.database import engine, Base

# Import all routers
from app.api.routes import projects, schema, nodes, edges, graphs
from app.routers import plugins, analytics
from app.api.routes import artifacts
from app.api.routes import history

# Configure logging
logging.basicConfig(
    level=getattr(logging, settings.LOG_LEVEL),
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# Create FastAPI app
app = FastAPI(
    title="OSINT Graph Analyzer",
    description="Web application for analyzing OSINT data through graph visualization",
    version="0.1.0",
    docs_url="/api/docs" if settings.ENVIRONMENT == "development" else None,
    redoc_url="/api/redoc" if settings.ENVIRONMENT == "development" else None,
)

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "http://localhost:5173",
        "http://localhost:5000",
        "http://127.0.0.1:3000",
        "http://127.0.0.1:5000"
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.on_event("startup")
async def startup_event():
    """Initialize application on startup."""
    logger.info("Starting up OSINT Graph Analyzer...")
    # Create database tables (in production use Alembic migrations)
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

@app.on_event("shutdown")
async def shutdown_event():
    """Cleanup on application shutdown."""
    logger.info("Shutting down OSINT Graph Analyzer...")
    await engine.dispose()

@app.get("/")
async def root():
    """Root endpoint with API information."""
    return {
        "name": "OSINT Graph Analyzer API",
        "version": "0.1.0",
        "status": "operational",
        "documentation": "/api/docs",
        "endpoints": {
            "health": "/health",
            "api_status": "/api/v1/status",
            "projects": "/api/v1/projects",
            "project_detail": "/api/v1/projects/{project_id}",
            "project_graphs": "/api/v1/projects/{project_id}/graphs",
            "schema": "/api/v1/projects/{project_id}/schema",
            "nodes": "/api/v1/graphs/{graph_id}/nodes",
            "edges": "/api/v1/graphs/{graph_id}/edges",
            "graphs": "/api/v1/graphs",
            "plugins": "/api/v1/plugins",
            "analytics": "/api/v1/analytics"
        }
    }

@app.get("/health", response_model=Dict[str, str])
async def health_check() -> Dict[str, str]:
    """
    Health check endpoint for monitoring.

    Returns:
        Dict[str, str]: Health status information
    """
    return {
        "status": "healthy",
        "environment": settings.ENVIRONMENT,
        "version": "0.1.0"
    }

@app.get("/api/v1/status")
async def api_status() -> Dict[str, str]:
    """
    API status endpoint.

    Returns:
        Dict[str, str]: API status information
    """
    return {"status": "operational", "message": "API is ready"}

# Include all routers
app.include_router(projects.router, prefix="/api/v1", tags=["projects"])
app.include_router(schema.router, prefix="/api/v1", tags=["schema"])
app.include_router(nodes.router, prefix="/api/v1", tags=["nodes"])
app.include_router(edges.router, prefix="/api/v1", tags=["edges"])
app.include_router(graphs.router, prefix="/api/v1", tags=["graphs"])
app.include_router(plugins.router, prefix="/api/v1/plugins", tags=["plugins"])
app.include_router(analytics.router, prefix="/api/v1/analytics", tags=["analytics"])
app.include_router(artifacts.router, prefix="/api/v2", tags=["artifacts"])
app.include_router(history.router, prefix="/api/v2", tags=["history"])

@app.exception_handler(404)
async def custom_404_handler(request, exc):
    """Custom 404 error handler."""
    return JSONResponse(
        status_code=404,
        content={"message": "Endpoint not found", "detail": str(exc)}
    )

@app.exception_handler(500)
async def custom_500_handler(request, exc):
    """Custom 500 error handler."""
    logger.error(f"Internal server error: {exc}", exc_info=True)
    return JSONResponse(
        status_code=500,
        content={"message": "Internal server error", "detail": "An unexpected error occurred"}
    )
