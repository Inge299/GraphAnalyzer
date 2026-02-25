from fastapi import APIRouter

router = APIRouter()

@router.get("/")
async def get_graphs():
    """Get all graphs."""
    return {"message": "Graphs endpoint"}

@router.get("/{graph_id}")
async def get_graph(graph_id: int):
    """Get a specific graph."""
    return {"message": f"Graph {graph_id}"}

@router.post("/")
async def create_graph():
    """Create a new graph."""
    return {"message": "Graph created"}

@router.put("/{graph_id}")
async def update_graph(graph_id: int):
    """Update a graph."""
    return {"message": f"Graph {graph_id} updated"}

@router.delete("/{graph_id}")
async def delete_graph(graph_id: int):
    """Delete a graph."""
    return {"message": f"Graph {graph_id} deleted"}
