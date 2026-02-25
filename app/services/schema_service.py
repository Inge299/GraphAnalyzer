"""
Service for managing dynamic schema (node types, edge types, attributes).
"""

from typing import Dict, List, Optional, Any
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, update, delete
import logging
from datetime import datetime
import json

from app.models.schema import ProjectSchema, NodeType, EdgeType
from app.models.project import Project
from app.core.exceptions import SchemaValidationError

logger = logging.getLogger(__name__)

class SchemaService:
    """Service for managing dynamic schema definitions."""
    
    def __init__(self, db: AsyncSession):
        self.db = db
    
    async def create_or_update_schema(self, project_id: int, schema_data: Dict[str, Any]) -> ProjectSchema:
        """
        Create or update project schema from JSON definition.
        """
        # Validate schema structure
        self._validate_schema_structure(schema_data)
        
        # Check if schema exists
        stmt = select(ProjectSchema).where(ProjectSchema.project_id == project_id)
        result = await self.db.execute(stmt)
        schema = result.scalar_one_or_none()
        
        if schema:
            # Update existing schema
            schema.schema_data = schema_data
            schema.version += 1
            schema.updated_at = datetime.utcnow()
        else:
            # Create new schema
            schema = ProjectSchema(
                project_id=project_id,
                schema_data=schema_data,
                version=1
            )
            self.db.add(schema)
        
        # Update cache tables
        await self._update_node_types_cache(project_id, schema_data.get("node_types", []))
        await self._update_edge_types_cache(project_id, schema_data.get("edge_types", []))
        
        await self.db.commit()
        await self.db.refresh(schema)
        
        logger.info(f"Schema updated for project {project_id}, version {schema.version}")
        return schema
    
    async def get_schema(self, project_id: int) -> Optional[Dict[str, Any]]:
        """Get schema for project."""
        try:
            stmt = select(ProjectSchema).where(ProjectSchema.project_id == project_id)
            result = await self.db.execute(stmt)
            schema = result.scalar_one_or_none()
            return schema.schema_data if schema else None
        except Exception as e:
            logger.error(f"Error getting schema: {e}")
            return None
    
    async def validate_node(self, project_id: int, node_type: str, attributes: Dict[str, Any]) -> bool:
        """Validate node attributes against schema."""
        stmt = select(NodeType).where(
            NodeType.project_id == project_id,
            NodeType.type_key == node_type
        )
        result = await self.db.execute(stmt)
        node_type_def = result.scalar_one_or_none()
        
        if not node_type_def:
            raise SchemaValidationError(f"Unknown node type: {node_type}")
        
        return self._validate_attributes(
            node_type_def.attribute_definitions,
            attributes
        )
    
    async def validate_edge(self, project_id: int, edge_type: str, 
                           source_type: str, target_type: str,
                           attributes: Dict[str, Any]) -> bool:
        """Validate edge attributes and type compatibility against schema."""
        stmt = select(EdgeType).where(
            EdgeType.project_id == project_id,
            EdgeType.type_key == edge_type
        )
        result = await self.db.execute(stmt)
        edge_type_def = result.scalar_one_or_none()
        
        if not edge_type_def:
            raise SchemaValidationError(f"Unknown edge type: {edge_type}")
        
        # Check type compatibility
        if source_type not in edge_type_def.from_types:
            raise SchemaValidationError(
                f"Edge type {edge_type} cannot have source of type {source_type}. "
                f"Allowed source types: {edge_type_def.from_types}"
            )
        
        if target_type not in edge_type_def.to_types:
            raise SchemaValidationError(
                f"Edge type {edge_type} cannot have target of type {target_type}. "
                f"Allowed target types: {edge_type_def.to_types}"
            )
        
        # Validate attributes
        return self._validate_attributes(
            edge_type_def.attribute_definitions,
            attributes
        )
    
    def _validate_schema_structure(self, schema_data: Dict[str, Any]):
        """Validate schema JSON structure."""
        if "node_types" not in schema_data:
            raise SchemaValidationError("Missing 'node_types' in schema")
        
        if "edge_types" not in schema_data:
            raise SchemaValidationError("Missing 'edge_types' in schema")
        
        # Validate each node type
        for node_type in schema_data["node_types"]:
            required_fields = ["type", "name", "attributes"]
            for field in required_fields:
                if field not in node_type:
                    raise SchemaValidationError(f"Node type missing '{field}' field")
        
        # Validate each edge type
        for edge_type in schema_data["edge_types"]:
            required_fields = ["type", "name", "from_types", "to_types", "attributes"]
            for field in required_fields:
                if field not in edge_type:
                    raise SchemaValidationError(f"Edge type missing '{field}' field")
    
    async def _update_node_types_cache(self, project_id: int, node_types: List[Dict]):
        """Update node types cache table."""
        # Delete old types
        await self.db.execute(
            delete(NodeType).where(NodeType.project_id == project_id)
        )
        
        # Insert new types
        for nt in node_types:
            node_type = NodeType(
                project_id=project_id,
                type_key=nt["type"],
                display_name=nt.get("name", nt["type"]),
                color=nt.get("color", "#cccccc"),
                icon=nt.get("icon", "fa-circle"),
                attribute_definitions=nt.get("attributes", [])
            )
            self.db.add(node_type)
        
        # Flush to get IDs
        await self.db.flush()
    
    async def _update_edge_types_cache(self, project_id: int, edge_types: List[Dict]):
        """Update edge types cache table."""
        # Delete old types
        await self.db.execute(
            delete(EdgeType).where(EdgeType.project_id == project_id)
        )
        
        # Insert new types
        for et in edge_types:
            edge_type = EdgeType(
                project_id=project_id,
                type_key=et["type"],
                display_name=et.get("name", et["type"]),
                from_types=et.get("from_types", []),
                to_types=et.get("to_types", []),
                attribute_definitions=et.get("attributes", [])
            )
            self.db.add(edge_type)
        
        # Flush to get IDs
        await self.db.flush()
    
    def _validate_attributes(self, definitions: List[Dict], attributes: Dict[str, Any]) -> bool:
        """Validate attributes against their definitions."""
        for attr_def in definitions:
            attr_name = attr_def["name"]
            attr_type = attr_def["type"]
            
            # Check required fields
            if attr_def.get("required", False) and attr_name not in attributes:
                raise SchemaValidationError(f"Required attribute '{attr_name}' is missing")
            
            # Validate type if present
            if attr_name in attributes:
                value = attributes[attr_name]
                if not self._validate_type(value, attr_type):
                    raise SchemaValidationError(
                        f"Attribute '{attr_name}' should be of type {attr_type}, got {type(value).__name__}"
                    )
        
        # Check for unknown attributes (optional strict mode)
        known_attrs = {attr_def["name"] for attr_def in definitions}
        for attr_name in attributes:
            if attr_name not in known_attrs:
                logger.warning(f"Unknown attribute '{attr_name}' found, but it will be stored anyway")
        
        return True
    
    def _validate_type(self, value: Any, expected_type: str) -> bool:
        """Validate value against expected type."""
        if value is None:
            return True
        
        type_validators = {
            "string": lambda v: isinstance(v, str),
            "integer": lambda v: isinstance(v, int),
            "number": lambda v: isinstance(v, (int, float)),
            "boolean": lambda v: isinstance(v, bool),
            "date": lambda v: isinstance(v, str) and len(v) == 10,  # YYYY-MM-DD
            "datetime": lambda v: isinstance(v, str) and len(v) >= 19,  # ISO format
            "json": lambda v: isinstance(v, (dict, list, str, int, float, bool, type(None)))
        }
        
        validator = type_validators.get(expected_type)
        if not validator:
            return True  # Unknown type, skip validation
        
        return validator(value)