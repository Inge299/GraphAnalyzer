# app/api/routes/__init__.py
"""
API routes package initialization.
"""

from app.api.routes import projects, schema, nodes, edges, graphs, artifacts

__all__ = ["projects", "schema", "nodes", "edges", "graphs", "artifacts"]