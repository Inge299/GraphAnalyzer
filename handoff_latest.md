=============================================================================
🎯 ПРОЕКТ: OSINT Graph Analyzer
📅 Дата: 2026-02-24T22:21:39.563001
📌 Версия: v1.0
=============================================================================

📊 СТАТИСТИКА
--------------------------------------------------
- Всего файлов: 55
- Строк кода: 17355
- Python файлов: 30
- TypeScript/JS: 14

🏗 АРХИТЕКТУРА
--------------------------------------------------
- backend: 
- frontend: 
- database: 
- infrastructure: Docker

🔑 КЛЮЧЕВЫЕ АРХИТЕКТУРНЫЕ РЕШЕНИЯ
--------------------------------------------------
📌 Гибкая мета-модель через JSONB
   └── Причина: Пользователь должен определять типы узлов без изменения кода
   └── Где: app/models/schema.py, app/services/schema_service.py
📌 JSONB для атрибутов узлов и ребер
   └── Причина: Разные типы имеют разные атрибуты
   └── Где: app/models/node.py, app/models/edge.py
📌 Batch операции для производительности
   └── Причина: Вставка 1000 узлов должна быть <2 секунд
   └── Где: app/api/routes/nodes.py (/batch)
📌 Кэширование типов в отдельных таблицах
   └── Причина: Быстрый доступ без парсинга JSON
   └── Где: app/models/schema.py (NodeType, EdgeType)

✅ ТЕКУЩИЙ СТАТУС
--------------------------------------------------
- backend_models: 100% - полностью функционально
- api_endpoints: 100% - все CRUD операции
- validation: 100% - проверка типов, обязательных полей
- docker: 100% - работает docker-compose up
- frontend_layout: 100% - вкладки, сайдбар, инспектор
- visualization: 100% - vis-network, перетаскивание
- redux: 100% - все слайсы работают

🚀 СЛЕДУЮЩИЕ ШАГИ (Phase 2)
--------------------------------------------------
📌 Этап 2.1: Модель артефактов
   └── Создать таблицы artifacts, relations, history
   └── Статус: 0%
📌 Этап 2.2: API артефактов
   └── Универсальные CRUD для артефактов
   └── Статус: 0%
📌 Этап 2.3: Рефакторинг фронтенда
   └── artifactsSlice вместо graphSlice
   └── Статус: 0%
📌 Этап 2.4: Новые типы
   └── Таблицы, карты, диаграммы
   └── Статус: 0%
📌 Этап 2.5: Интеграция плагинов
   └── Плагины создают артефакты
   └── Статус: 0%

❓ ОТКРЫТЫЕ ВОПРОСЫ
--------------------------------------------------
- Как организовать версионирование артефактов? Полное копирование или дельты?
- Нужен ли Celery для плагинов >10 секунд?
- Нужен ли полнотекстовый поиск по JSONB?
- Как визуализировать историю изменений?

📁 СТРУКТУРА ПРОЕКТА
--------------------------------------------------
```
{
  "Dockerfile": "[BINARY] 1266 bytes",
  "alembic": {
    "env.py": "[FILE] 96 lines",
    "versions": {
      "001_initial_models.py": "[FILE] 128 lines"
    }
  },
  "alembic.ini": "[BINARY] 1735 bytes",
  "app": {
    "api": {
      "deps.py": "[FILE] 45 lines",
      "routes": {
        "__init__.py": "[FILE] 8 lines",
        "edges.py": "[FILE] 219 lines",
        "graphs.py": "[FILE] 59 lines",
        "nodes.py": "[FILE] 249 lines",
        "projects.py": "[FILE] 138 lines",
        "schema.py": "[FILE] 93 lines"
      }
    },
    "config.py": "[FILE] 64 lines",
    "core": {
      "exceptions.py": "[FILE] 20 lines"
    },
    "database.py": "[FILE] 71 lines",
    "main.py": "[FILE] 127 lines",
    "models": {
      "__init__.py": "[FILE] 20 lines",
      "edge.py": "[FILE] 48 lines",
      "graph.py": "[FILE] 37 lines",
      "node.py": "[FILE] 49 lines",
      "project.py": "[FILE] 26 lines",
      "schema.py": "[FILE] 66 lines"
    },
    "routers": {
      "__init__.py": "[FILE] 6 lines",
      "analytics.py": "[FILE] 38 lines",
      "graphs.py": "[FILE] 29 lines",
      "plugins.py": "[FILE] 29 lines"
    },
    "services": {
      "schema_service.py": "[FILE] 232 lines"
    }
  },
  "backup.sh": "[BINARY] 2331 bytes",
  "backups": {
    "checksums_20260224_214935.txt": "[BINARY] 879 bytes",
    "data_20260224_214935.tar.gz": "[BINARY] 421 bytes",
    "db_20260224_214935.sql.gz": "[BINARY] 2805 bytes",
    "docker-compose_20260224_214935.yml": "[FILE] 73 lines",
    "env_20260224_214935.backup": "[BINARY] 663 bytes",
    "npm-deps_20260224_214935.txt": "[BINARY] 53 bytes",
    "requirements_20260224_214935.txt": "[BINARY] 0 bytes",
    "system_info_20260224_214935.txt": "[BINARY] 381 bytes",
    "volume_postgres_20260224_214935.tar.gz": "[BINARY] 85 bytes",
    "volume_redis_20260224_214935.tar.gz": "[BINARY] 87 bytes"
  },
  "data": {
    "sample_schema.json": "[FILE] 25 lines"
  },
  "docker-compose.override.yml": "[FILE] 39 lines",
  "docker-compose.yml": "[FILE] 73 lines",
  "frontend": {
    "index.html": "[BINARY] 369 bytes",
    "package-lock.json": "[FILE] 4788 lines",
    "package.json": "[FILE] 47 lines",
    "src": {
      "App.css": "[FILE] 240 lines",
      "App.tsx": "[FILE] 91 lines",
      "components": {
        "layout": {
          "InspectorPanel.tsx": "[FILE] 348 lines",
          "Sidebar.tsx": "[FILE] 966 lines",
          "TabBar.tsx": "[FILE] 94 lines"
        },
        "views": {
          "GraphView.tsx": "[FILE] 632 lines"
        }
      },
      "index.css": "[FILE] 14 lines",
      "main.tsx": "[FILE] 11 lines",
      "services": {
        "api.ts": "[FILE] 101 lines"
      },
      "store": {
        "index.ts": "[FILE] 29 lines",
        "slices": {
          "graphSlice.ts": "[FILE] 100 lines",
          "projectsSlice.ts": "[FILE] 116 lines",
          "uiSlice.ts": "[FILE] 69 lines"
        }
      },
      "types": {
        "api.ts": "[FILE] 35 lines"
      },
      "vite-env.d.ts": "[FILE] 12 lines"
    },
    "step3.py": "[FILE] 1950 lines",
    "tsconfig.json": "[FILE] 32 lines",
    "tsconfig.node.json": "[FILE] 12 lines",
    "vite.config.ts": "[FILE] 33 lines"
  },
  "get-docker.sh": "[BINARY] 22405 bytes",
  "get_structure.py": "[FILE] 493 lines",
  "plugins": {
    "__init__.py": "[FILE] 56 lines",
    "examples": {
      "__init__.py": "[FILE] 9 lines",
      "community_detector.py": "[FILE] 112 lines",
      "degree_analyzer.py": "[FILE] 81 lines"
    }
  },
  "project_context.json": "[FILE] 4777 lines",
  "requirements.txt": "[BINARY] 409 bytes"
}
```

🔧 КЛЮЧЕВЫЕ ФАЙЛЫ (с содержимым)
--------------------------------------------------

--- app/api/routes/__init__.py (hash: 862724a2) ---
// размер: 8 строк
"""
API routes package initialization.
"""

from app.api.routes import projects, schema, nodes, edges, graphs

__all__ = ["projects", "schema", "nodes", "edges", "graphs"]


--- app/api/routes/edges.py (hash: 1c0bcab4) ---
// размер: 219 строк
"""
Edge management endpoints.
"""

from fastapi import APIRouter, HTTPException, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, delete
from typing import List, Dict, Any, Optional
import logging
import uuid

from app.database import get_db
from app.models.edge import Edge
from app.models.node import Node
from app.models.graph import Graph
from app.services.schema_service import SchemaService
from app.api.deps import get_graph
from app.core.exceptions import SchemaValidationError

router = APIRouter(prefix="/graphs/{graph_id}/edges", tags=["edges"])
logger = logging.getLogger(__name__)

@router.post("")
async def create_edge(
    graph_id: int,
    edge_data: Dict[str, Any],
    db: AsyncSession = Depends(get_db),
    graph: Graph = Depends(get_graph)
):
    """Create a new edge."""
    try:
        # Get source and target node types
        nodes_result = await db.execute(
            select(Node).where(
                Node.graph_id == graph_id,
                Node.node_id.in_([edge_data["source_node"], edge_data["target_node"]])
            )
        )
        nodes = nodes_result.scalars().all()
        node_types = {node.node_id: node.type for node in nodes}
        
        if edge_data["source_node"] not in node_types:
            raise HTTPException(status_code=400, detail=f"Source node {edge_data['source_node']} not found")
        if edge_data["target_node"] not in node_types:
            raise HTTPException(status_code=400, detail=f"Target node {edge_data['target_node']} not found")
        
        # Validate against schema
        schema_service = SchemaService(db)
        await schema_service.validate_edge(
            graph.project_id,
            edge_data["type"],
            node_types[edge_data["source_node"]],
            node_types[edge_data["target_node"]],
            edge_data.get("attributes", {})
        )
        
        # Generate edge_id if not provided
        if "edge_id" not in edge_data:
            edge_data["edge_id"] = str(uuid.uuid4())[:8]
        
        # Create edge
        edge = Edge(
            graph_id=graph_id,
            edge_id=edge_data["edge_id"],
            source_node=edge_data["source_node"],
            target_node=edge_data["target_node"],
            type=edge_data["type"],
            attributes=edge_data.get("attributes", {})
        )
        
        db.add(edge)
        await db.commit()
        await db.refresh(edge)
        return edge
    except SchemaValidationError as e:
        raise HTTPException(status_code=400, detail=str(e))

@router.post("/batch")
async def batch_create_edges(
    graph_id: int,
    edges_data: List[Dict[str, Any]],
    db: AsyncSession = Depends(get_db),
    graph: Graph = Depends(get_graph)
):
    """Batch create multiple edges."""
    try:
        # Get all nodes in graph
        nodes_result = await db.execute(
            select(Node).where(Node.graph_id == graph_id)
        )
        nodes = nodes_result.scalars().all()
        node_types = {node.node_id: node.type for node in nodes}
        
        schema_service = SchemaService(db)
        edges = []
        
        for edge_data in edges_data:
            # Check nodes exist
            if edge_data["source_node"] not in node_types:
                raise HTTPException(status_code=400, detail=f"Source node {edge_data['source_node']} not found")
            if edge_data["target_node"] not in node_types:
                raise HTTPException(status_code=400, detail=f"Target node {edge_data['target_node']} not found")
            
            # Validate against schema
            await schema_service.validate_edge(
                graph.project_id,
                edge_data["type"],
                node_types[edge_data["source_node"]],
                node_types[edge_data["target_node"]],
                edge_data.get("attributes", {})
            )
            
            # Generate edge_id if not provided
            if "edge_id" not in edge_data:
                edge_data["edge_id"] = str(uuid.uuid4())[:8]
            
            edge = Edge(
                graph_id=graph_id,
                edge_id=edge_data["edge_id"],
                source_node=edge_data["source_node"],
                target_node=edge_data["target_node"],
                type=edge_data["type"],
                attributes=edge_data.get("attributes", {})
            )
            edges.append(edge)
        
        db.add_all(edges)
        await db.commit()
        return {"status": "success", "count": len(edges)}
    except SchemaValidationError as e:
        raise HTTPException(status_code=400, detail=str(e))

@router.get("")
async def get_edges(
    graph_id: int,
    type: Optional[str] = None,
    source_node: Optional[str] = None,
    target_node: Optional[str] = None,
    limit: int = 1000,
    offset: int = 0,
    db: AsyncSession = Depends(get_db),
    graph: Graph = Depends(get_graph)
):
    """Get edges with optional filtering."""
    query = select(Edge).where(Edge.graph_id == graph_id)
    
    if type:
        query = query.where(Edge.type == type)
    if source_node:
        query = query.where(Edge.source_node == source_node)
    if target_node:
        query = query.where(Edge.target_node == target_node)
    
    query = query.limit(limit).offset(offset)
    result = await db.execute(query)
    return result.scalars().all()

@router.get("/{edge_id}")
async def get_edge(
    graph_id: int,
    edge_id: str,
    db: AsyncSession = Depends(get_db),
    graph: Graph = Depends(get_graph)
):
    """Get specific edge."""
    result = await db.execute(
        select(Edge).where(
            Edge.graph_id == graph_id,
            Edge.edge_id == edge_id
        )
    )
    edge = result.scalar_one_or_none()
    if not edge:
        raise HTTPException(status_code=404, detail="Edge not found")
    return edge

@router.patch("/{edge_id}")
async def update_edge(
    graph_id: int,
    edge_id: str,
    updates: Dict[str, Any],
    db: AsyncSession = Depends(get_db),
    graph: Graph = Depends(get_graph)
):
    """Update edge attributes."""
    result = await db.execute(
        select(Edge).where(
            Edge.graph_id == graph_id,
            Edge.edge_id == edge_id
        )
    )
    edge = result.scalar_one_or_none()
    if not edge:
        raise HTTPException(status_code=404, detail="Edge not found")
    
    if "attributes" in updates:
        edge.attributes = {**edge.attributes, **updates["attributes"]}
    
    await db.commit()
    await db.refresh(edge)
    return edge

@router.delete("/{edge_id}")
async def delete_edge(
    graph_id: int,
    edge_id: str,
    db: AsyncSession = Depends(get_db),
    graph: Graph = Depends(get_graph)
):
    """Delete an edge."""
    await db.execute(
        delete(Edge).where(
            Edge.graph_id == graph_id,
            Edge.edge_id == edge_id
        )
    )
    await db.commit()
    return {"status": "success", "message": "Edge deleted"}


--- app/api/routes/graphs.py (hash: 3c34fc47) ---
// размер: 59 строк
"""
Graph management endpoints (legacy, use projects/{id}/graphs instead).
"""

from fastapi import APIRouter, HTTPException, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from typing import Optional
import logging

from app.database import get_db
from app.models.graph import Graph

router = APIRouter(prefix="/graphs", tags=["graphs"])
logger = logging.getLogger(__name__)

@router.get("")
async def get_all_graphs(
    skip: int = 0,
    limit: int = 100,
    db: AsyncSession = Depends(get_db)
):
    """Get all graphs."""
    result = await db.execute(
        select(Graph).offset(skip).limit(limit)
    )
    return result.scalars().all()

@router.get("/{graph_id}")
async def get_graph(
    graph_id: int,
    db: AsyncSession = Depends(get_db)
):
    """Get a specific graph."""
    result = await db.execute(
        select(Graph).where(Graph.id == graph_id)
    )
    graph = result.scalar_one_or_none()
    if not graph:
        raise HTTPException(status_code=404, detail=f"Graph {graph_id} not found")
    return graph

@router.delete("/{graph_id}")
async def delete_graph(
    graph_id: int,
    db: AsyncSession = Depends(get_db)
):
    """Delete a graph."""
    result = await db.execute(
        select(Graph).where(Graph.id == graph_id)
    )
    graph = result.scalar_one_or_none()
    if not graph:
        raise HTTPException(status_code=404, detail=f"Graph {graph_id} not found")
    
    await db.delete(graph)
    await db.commit()
    return {"message": f"Graph {graph_id} deleted"}


--- app/api/routes/nodes.py (hash: 4a2846de) ---
// размер: 249 строк
"""
Node management endpoints.
"""

from fastapi import APIRouter, HTTPException, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, delete
from typing import List, Dict, Any, Optional
import logging
from datetime import datetime
import uuid

from app.database import get_db
from app.models.node import Node
from app.models.edge import Edge
from app.models.graph import Graph
from app.services.schema_service import SchemaService
from app.api.deps import get_graph
from app.core.exceptions import SchemaValidationError

router = APIRouter(prefix="/graphs/{graph_id}/nodes", tags=["nodes"])
logger = logging.getLogger(__name__)

@router.post("")
async def create_node(
    graph_id: int,
    node_data: Dict[str, Any],
    db: AsyncSession = Depends(get_db),
    graph: Graph = Depends(get_graph)
):
    """Create a new node."""
    try:
        # Validate against schema
        schema_service = SchemaService(db)
        await schema_service.validate_node(
            graph.project_id,
            node_data["type"],
            node_data.get("attributes", {})
        )
        
        # Generate node_id if not provided
        if "node_id" not in node_data:
            node_data["node_id"] = str(uuid.uuid4())[:8]
        
        # Check if node_id already exists
        existing = await db.execute(
            select(Node).where(
                Node.graph_id == graph_id,
                Node.node_id == node_data["node_id"]
            )
        )
        if existing.scalar_one_or_none():
            raise HTTPException(status_code=400, detail=f"Node with ID {node_data['node_id']} already exists")
        
        # Create node
        node = Node(
            graph_id=graph_id,
            node_id=node_data["node_id"],
            type=node_data["type"],
            attributes=node_data.get("attributes", {}),
            position_x=node_data.get("position_x"),
            position_y=node_data.get("position_y")
        )
        
        db.add(node)
        await db.commit()
        await db.refresh(node)
        
        return node
    except SchemaValidationError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error(f"Error creating node: {e}")
        await db.rollback()
        raise HTTPException(status_code=500, detail="Internal server error")

@router.post("/batch")
async def batch_create_nodes(
    graph_id: int,
    nodes_data: List[Dict[str, Any]],
    db: AsyncSession = Depends(get_db),
    graph: Graph = Depends(get_graph)
):
    """Batch create multiple nodes (optimized for large imports)."""
    try:
        schema_service = SchemaService(db)
        nodes = []
        node_ids = set()
        
        for node_data in nodes_data:
            # Validate each node
            await schema_service.validate_node(
                graph.project_id,
                node_data["type"],
                node_data.get("attributes", {})
            )
            
            # Generate node_id if not provided
            if "node_id" not in node_data:
                node_data["node_id"] = str(uuid.uuid4())[:8]
            
            # Check for duplicate IDs in batch
            if node_data["node_id"] in node_ids:
                raise HTTPException(
                    status_code=400, 
                    detail=f"Duplicate node_id '{node_data['node_id']}' in batch"
                )
            node_ids.add(node_data["node_id"])
            
            node = Node(
                graph_id=graph_id,
                node_id=node_data["node_id"],
                type=node_data["type"],
                attributes=node_data.get("attributes", {}),
                position_x=node_data.get("position_x"),
                position_y=node_data.get("position_y")
            )
            nodes.append(node)
        
        db.add_all(nodes)
        await db.commit()
        
        return {"status": "success", "count": len(nodes), "nodes": nodes}
    except SchemaValidationError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error(f"Error batch creating nodes: {e}")
        await db.rollback()
        raise HTTPException(status_code=500, detail="Internal server error")

@router.get("")
async def get_nodes(
    graph_id: int,
    type: Optional[str] = None,
    limit: int = 1000,
    offset: int = 0,
    db: AsyncSession = Depends(get_db),
    graph: Graph = Depends(get_graph)
):
    """Get nodes with optional filtering."""
    query = select(Node).where(Node.graph_id == graph_id)
    
    if type:
        query = query.where(Node.type == type)
    
    query = query.limit(limit).offset(offset)
    result = await db.execute(query)
    nodes = result.scalars().all()
    return nodes

@router.get("/{node_id}")
async def get_node(
    graph_id: int,
    node_id: str,
    db: AsyncSession = Depends(get_db),
    graph: Graph = Depends(get_graph)
):
    """Get specific node."""
    result = await db.execute(
        select(Node).where(
            Node.graph_id == graph_id,
            Node.node_id == node_id
        )
    )
    node = result.scalar_one_or_none()
    if not node:
        raise HTTPException(status_code=404, detail="Node not found")
    return node

@router.patch("/{node_id}")
async def update_node(
    graph_id: int,
    node_id: str,
    updates: Dict[str, Any],
    db: AsyncSession = Depends(get_db),
    graph: Graph = Depends(get_graph)
):
    """Update node attributes or position."""
    try:
        # Get current node
        result = await db.execute(
            select(Node).where(
                Node.graph_id == graph_id,
                Node.node_id == node_id
            )
        )
        node = result.scalar_one_or_none()
        if not node:
            raise HTTPException(status_code=404, detail="Node not found")
        
        # Update fields
        if "attributes" in updates:
            # Validate updated attributes against schema
            schema_service = SchemaService(db)
            await schema_service.validate_node(
                graph.project_id,
                node.type,
                {**node.attributes, **updates["attributes"]}
            )
            node.attributes = {**node.attributes, **updates["attributes"]}
        
        if "position_x" in updates:
            node.position_x = updates["position_x"]
        if "position_y" in updates:
            node.position_y = updates["position_y"]
        
        node.updated_at = datetime.utcnow()
        
        await db.commit()
        await db.refresh(node)
        return node
    except SchemaValidationError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error(f"Error updating node: {e}")
        await db.rollback()
        raise HTTPException(status_code=500, detail="Internal server error")

@router.delete("/{node_id}")
async def delete_node(
    graph_id: int,
    node_id: str,
    db: AsyncSession = Depends(get_db),
    graph: Graph = Depends(get_graph)
):
    """Delete node and all its edges."""
    try:
        # Delete edges connected to this node
        await db.execute(
            delete(Edge).where(
                Edge.graph_id == graph_id,
                (Edge.source_node == node_id) | (Edge.target_node == node_id)
            )
        )
        
        # Delete node
        await db.execute(
            delete(Node).where(
                Node.graph_id == graph_id,
                Node.node_id == node_id
            )
        )
        
        await db.commit()
        return {"status": "success", "message": "Node deleted"}
    except Exception as e:
        logger.error(f"Error deleting node: {e}")
        await db.rollback()
        raise HTTPException(status_code=500, detail="Internal server error")

--- app/api/routes/projects.py (hash: 9c424f9e) ---
// размер: 138 строк
"""
Project management endpoints.
"""

from fastapi import APIRouter, HTTPException, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from typing import Optional, List
import logging

from app.database import get_db
from app.models.project import Project
from app.models.graph import Graph

router = APIRouter(prefix="/projects", tags=["projects"])
logger = logging.getLogger(__name__)

@router.post("")
async def create_project(
    name: str,
    description: Optional[str] = None,
    db: AsyncSession = Depends(get_db)
):
    """Create a new project."""
    project = Project(name=name, description=description)
    db.add(project)
    await db.commit()
    await db.refresh(project)
    return project

@router.get("")
async def list_projects(
    skip: int = 0,
    limit: int = 100,
    db: AsyncSession = Depends(get_db)
):
    """List all projects."""
    result = await db.execute(
        select(Project).offset(skip).limit(limit)
    )
    return result.scalars().all()

@router.get("/{project_id}")
async def get_project(
    project_id: int,
    db: AsyncSession = Depends(get_db)
):
    """Get project by ID."""
    result = await db.execute(
        select(Project).where(Project.id == project_id)
    )
    project = result.scalar_one_or_none()
    if not project:
        raise HTTPException(status_code=404, detail=f"Project {project_id} not found")
    return project

@router.post("/{project_id}/graphs")
async def create_graph(
    project_id: int,
    name: str,
    description: Optional[str] = None,
    db: AsyncSession = Depends(get_db)
):
    """Create a new graph in project."""
    # Check if project exists
    result = await db.execute(
        select(Project).where(Project.id == project_id)
    )
    project = result.scalar_one_or_none()
    if not project:
        raise HTTPException(status_code=404, detail=f"Project {project_id} not found")
    
    graph = Graph(project_id=project_id, name=name, description=description)
    db.add(graph)
    await db.commit()
    await db.refresh(graph)
    return graph

@router.get("/{project_id}/graphs")
async def list_project_graphs(
    project_id: int,
    db: AsyncSession = Depends(get_db)
):
    """List all graphs in a project."""
    # Check if project exists
    result = await db.execute(
        select(Project).where(Project.id == project_id)
    )
    project = result.scalar_one_or_none()
    if not project:
        raise HTTPException(status_code=404, detail=f"Project {project_id} not found")
    
    graphs_result = await db.execute(
        select(Graph).where(Graph.project_id == project_id)
    )
    return graphs_result.scalars().all()

@router.put("/{project_id}")
async def update_project(
    project_id: int,
    name: Optional[str] = None,
    description: Optional[str] = None,
    db: AsyncSession = Depends(get_db)
):
    """Update a project."""
    result = await db.execute(
        select(Project).where(Project.id == project_id)
    )
    project = result.scalar_one_or_none()
    if not project:
        raise HTTPException(status_code=404, detail=f"Project {project_id} not found")
    
    if name:
        project.name = name
    if description:
        project.description = description
    
    await db.commit()
    await db.refresh(project)
    return project

@router.delete("/{project_id}")
async def delete_project(
    project_id: int,
    db: AsyncSession = Depends(get_db)
):
    """Delete a project."""
    result = await db.execute(
        select(Project).where(Project.id == project_id)
    )
    project = result.scalar_one_or_none()
    if not project:
        raise HTTPException(status_code=404, detail=f"Project {project_id} not found")
    
    await db.delete(project)
    await db.commit()
    return {"message": f"Project {project_id} deleted"}


--- app/api/routes/schema.py (hash: 53c4ba43) ---
// размер: 93 строк
"""
Schema management endpoints.
"""

from fastapi import APIRouter, HTTPException, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from typing import Dict, Any
import logging

from app.database import get_db
from app.services.schema_service import SchemaService
from app.models.project import Project
from app.models.schema import NodeType, EdgeType
from app.api.deps import get_project
from app.core.exceptions import SchemaValidationError

router = APIRouter(prefix="/projects/{project_id}/schema", tags=["schema"])
logger = logging.getLogger(__name__)

@router.put("")
async def update_schema(
    project_id: int,
    schema_data: Dict[str, Any],
    db: AsyncSession = Depends(get_db),
    project: Project = Depends(get_project)
):
    """Update project schema."""
    try:
        service = SchemaService(db)
        schema = await service.create_or_update_schema(project_id, schema_data)
        return {
            "status": "success",
            "message": "Schema updated",
            "version": schema.version
        }
    except SchemaValidationError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error(f"Error updating schema: {e}")
        await db.rollback()
        raise HTTPException(status_code=500, detail="Internal server error")

@router.get("")
async def get_schema(
    project_id: int,
    db: AsyncSession = Depends(get_db),
    project: Project = Depends(get_project)
):
    """Get project schema."""
    try:
        service = SchemaService(db)
        schema = await service.get_schema(project_id)
        if not schema:
            raise HTTPException(status_code=404, detail="Schema not found")
        return schema
    except Exception as e:
        logger.error(f"Error getting schema: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")

@router.get("/node-types")
async def get_node_types(
    project_id: int,
    db: AsyncSession = Depends(get_db),
    project: Project = Depends(get_project)
):
    """Get all node types for project."""
    try:
        result = await db.execute(
            select(NodeType).where(NodeType.project_id == project_id)
        )
        types = result.scalars().all()
        return types
    except Exception as e:
        logger.error(f"Error getting node types: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")

@router.get("/edge-types")
async def get_edge_types(
    project_id: int,
    db: AsyncSession = Depends(get_db),
    project: Project = Depends(get_project)
):
    """Get all edge types for project."""
    try:
        result = await db.execute(
            select(EdgeType).where(EdgeType.project_id == project_id)
        )
        types = result.scalars().all()
        return types
    except Exception as e:
        logger.error(f"Error getting edge types: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")

--- app/config.py (hash: 820d42a5) ---
// размер: 64 строк
""""
Configuration management using Pydantic settings.
"""
from typing import List, Optional
from pydantic_settings import BaseSettings
from pydantic import AnyHttpUrl, validator
import json
import os

class Settings(BaseSettings):
    """
    Application settings loaded from environment variables.
    """
    # Database
    DATABASE_URL: str
    POSTGRES_USER: str
    POSTGRES_PASSWORD: str
    POSTGRES_DB: str

    # Redis
    REDIS_URL: str

    # Application
    SECRET_KEY: str
    ENVIRONMENT: str = "development"
    LOG_LEVEL: str = "INFO"
    API_V1_PREFIX: str = "/api/v1"

    # CORS
    BACKEND_CORS_ORIGINS: List[AnyHttpUrl] = []

    @validator("BACKEND_CORS_ORIGINS", pre=True)
    def assemble_cors_origins(cls, v: str | List[str]) -> List[str] | str:
        """Parse CORS origins from string or list."""
        if isinstance(v, str) and not v.startswith("["):
            return [i.strip() for i in v.split(",")]
        elif isinstance(v, (list, str)):
            return v
        raise ValueError(v)

    # Celery
    CELERY_BROKER_URL: str = "redis://redis:6379/1"
    CELERY_RESULT_BACKEND: str = "redis://redis:6379/2"

    # File upload
    MAX_UPLOAD_SIZE: int = 10 * 1024 * 1024  # 10MB
    ALLOWED_UPLOAD_EXTENSIONS: List[str] = [".json", ".csv", ".graphml"]

    # Graph settings
    MAX_NODES_PER_GRAPH: int = 5000
    MAX_EDGES_PER_GRAPH: int = 50000

    class Config:
        env_file = ".env"
        case_sensitive = True
        extra = "ignore"  # Игнорировать лишние поля

# Create global settings instance
settings = Settings()

# Validate critical settings
if settings.ENVIRONMENT == "production" and settings.SECRET_KEY == "your-secret-key-here-change-in-production":
    raise ValueError("SECRET_KEY must be changed in production!")


--- app/database.py (hash: 5ef709dd) ---
// размер: 71 строк
"""
Database configuration and session management.
"""
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker
from sqlalchemy.orm import declarative_base, declared_attr
from typing import AsyncGenerator
import logging

from app.config import settings

# Configure logging
logger = logging.getLogger(__name__)

# Create async engine
engine = create_async_engine(
    settings.DATABASE_URL,
    echo=settings.ENVIRONMENT == "development",
    pool_size=20,
    max_overflow=10,
    pool_pre_ping=True,
)

# Create async session factory
AsyncSessionLocal = async_sessionmaker(
    engine,
    class_=AsyncSession,
    expire_on_commit=False,
    autocommit=False,
    autoflush=False,
)

class Base:
    """Base class for SQLAlchemy models with common attributes."""

    @declared_attr
    def __tablename__(cls):
        """Generate table name automatically."""
        return cls.__name__.lower()

    # Common columns can be added here
    # id = Column(Integer, primary_key=True, index=True)
    # created_at = Column(DateTime, default=datetime.utcnow)
    # updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

# Create declarative base
Base = declarative_base(cls=Base)

async def get_db() -> AsyncGenerator[AsyncSession, None]:
    """
    Dependency for getting database sessions.

    Yields:
        AsyncSession: Database session
    """
    session = AsyncSessionLocal()
    try:
        yield session
    except Exception as e:
        logger.error(f"Database session error: {e}")
        await session.rollback()
        raise
    finally:
        await session.close()

async def init_db() -> None:
    """Initialize database (for development only)."""
    if settings.ENVIRONMENT == "development":
        async with engine.begin() as conn:
            await conn.run_sync(Base.metadata.create_all)
        logger.info("Database tables created/verified")


--- app/main.py (hash: 8814184c) ---
// размер: 127 строк
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
    allow_origins=settings.BACKEND_CORS_ORIGINS,
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

--- app/models/__init__.py (hash: 27c8cfcf) ---
// размер: 20 строк
"""
Database models for OSINT Graph Analyzer.
"""

from app.models.project import Project
from app.models.graph import Graph
from app.models.node import Node
from app.models.edge import Edge
from app.models.schema import ProjectSchema, NodeType, EdgeType

__all__ = [
    "Project",
    "Graph",
    "Node",
    "Edge",
    "ProjectSchema",
    "NodeType",
    "EdgeType",
]
