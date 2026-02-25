from fastapi import APIRouter

router = APIRouter()

@router.get("/")
async def get_analytics():
    """Get analytics overview."""
    return {
        "message": "Analytics endpoint",
        "stats": {
            "total_nodes": 0,
            "total_edges": 0,
            "total_projects": 0,
            "total_graphs": 0
        }
    }

@router.get("/graphs/{graph_id}")
async def get_graph_analytics(graph_id: int):
    """Get analytics for a specific graph."""
    return {
        "message": f"Analytics for graph {graph_id}",
        "graph_id": graph_id,
        "node_types": {},
        "edge_types": {}
    }

@router.get("/projects/{project_id}")
async def get_project_analytics(project_id: int):
    """Get analytics for a specific project."""
    return {
        "message": f"Analytics for project {project_id}",
        "project_id": project_id,
        "total_graphs": 0,
        "total_nodes": 0,
        "total_edges": 0
    }
