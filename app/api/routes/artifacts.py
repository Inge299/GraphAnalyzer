# app/api/routes/artifacts.py
"""
Artifact management endpoints (API v2).
"""
from fastapi import APIRouter, HTTPException, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, delete, and_, or_, func
from typing import List, Dict, Any, Optional
import logging
from datetime import datetime

from app.database import get_db
from app.models.artifact import Artifact, ArtifactRelation, ArtifactVersion
from app.models.project import Project
from app.api.deps import get_project
from app.core.exceptions import ValidationError, ArtifactNotFoundError, RelationNotFoundError, VersionNotFoundError

router = APIRouter(prefix="/projects/{project_id}/artifacts", tags=["artifacts"])
logger = logging.getLogger(__name__)

# ============================================================================
# Базовые CRUD операции
# ============================================================================

@router.post("", response_model=Dict[str, Any])
async def create_artifact(
    project_id: int,
    artifact_data: Dict[str, Any],
    db: AsyncSession = Depends(get_db),
    project: Project = Depends(get_project)
):
    """
    Create a new artifact.
    
    Args:
        project_id: Project ID
        artifact_data: {
            "type": "graph|table|map|chart|document",
            "name": "Artifact name",
            "description": "Optional description",
            "data": {...},  # Artifact-specific data
            "metadata": {...}  # Optional metadata
        }
    
    Returns:
        Created artifact
    """
    try:
        # Валидация обязательных полей
        if "type" not in artifact_data:
            raise HTTPException(status_code=400, detail="Field 'type' is required")
        if "name" not in artifact_data:
            raise HTTPException(status_code=400, detail="Field 'name' is required")
        if "data" not in artifact_data:
            raise HTTPException(status_code=400, detail="Field 'data' is required")
        
        # Валидация типа
        valid_types = ["graph", "table", "map", "chart", "document"]
        if artifact_data["type"] not in valid_types:
            raise HTTPException(
                status_code=400, 
                detail=f"Invalid type. Must be one of: {valid_types}"
            )

        normalized_name = str(artifact_data["name"] or "").strip()
        if not normalized_name:
            raise HTTPException(status_code=400, detail="Field 'name' must not be empty")

        duplicate_result = await db.execute(
            select(Artifact.id).where(
                Artifact.project_id == project_id,
                Artifact.type == artifact_data["type"],
                func.lower(Artifact.name) == normalized_name.lower()
            ).limit(1)
        )
        if duplicate_result.scalar_one_or_none() is not None:
            raise HTTPException(status_code=409, detail="Artifact with this type and name already exists in this project")

        artifact_data["name"] = normalized_name
        
        # Создаем артефакт
        artifact = Artifact(
            project_id=project_id,
            type=artifact_data["type"],
            name=artifact_data["name"],
            description=artifact_data.get("description"),
            data=artifact_data["data"],
            artifact_metadata=artifact_data.get("metadata", {})
        )
        
        db.add(artifact)
        await db.commit()
        await db.refresh(artifact)
        
        # Создаем первую версию
        version = ArtifactVersion(
            artifact_id=artifact.id,
            version=1,
            data=artifact.data,
            changed_by="user"
        )
        db.add(version)
        await db.commit()
        
        return {
            "id": artifact.id,
            "project_id": artifact.project_id,
            "type": artifact.type,
            "name": artifact.name,
            "description": artifact.description,
            "data": artifact.data,
            "metadata": artifact.artifact_metadata,
            "created_at": artifact.created_at.isoformat() if artifact.created_at else None,
            "updated_at": artifact.updated_at.isoformat() if artifact.updated_at else None,
            "version": 1
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error creating artifact: {e}")
        await db.rollback()
        raise HTTPException(status_code=500, detail="Internal server error")


@router.get("", response_model=List[Dict[str, Any]])
async def list_artifacts(
    project_id: int,
    type: Optional[str] = Query(None, description="Filter by artifact type"),
    search: Optional[str] = Query(None, description="Search in name and description"),
    limit: int = Query(100, ge=1, le=1000),
    offset: int = Query(0, ge=0),
    db: AsyncSession = Depends(get_db),
    project: Project = Depends(get_project)
):
    """
    List all artifacts in a project with optional filtering.
    """
    try:
        query = select(Artifact).where(Artifact.project_id == project_id)
        
        # Фильтр по типу
        if type:
            query = query.where(Artifact.type == type)
        
        # Поиск по имени и описанию
        if search:
            query = query.where(
                or_(
                    Artifact.name.ilike(f"%{search}%"),
                    Artifact.description.ilike(f"%{search}%")
                )
            )
        
        # Пагинация
        query = query.order_by(Artifact.updated_at.desc()).limit(limit).offset(offset)
        
        result = await db.execute(query)
        artifacts = result.scalars().all()
        
        # Получаем последнюю версию для каждого артефакта
        response = []
        for artifact in artifacts:
            latest_version = await db.execute(
                select(ArtifactVersion)
                .where(ArtifactVersion.artifact_id == artifact.id)
                .order_by(ArtifactVersion.version.desc())
                .limit(1)
            )
            version = latest_version.scalar_one_or_none()
            
            response.append({
                "id": artifact.id,
                "project_id": artifact.project_id,
                "type": artifact.type,
                "name": artifact.name,
                "description": artifact.description,
                "data": artifact.data,
                "metadata": artifact.artifact_metadata,
                "created_at": artifact.created_at.isoformat() if artifact.created_at else None,
                "updated_at": artifact.updated_at.isoformat() if artifact.updated_at else None,
                "version": version.version if version else 1
            })
        
        return response
    except Exception as e:
        logger.error(f"Error listing artifacts: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")


@router.get("/{artifact_id}", response_model=Dict[str, Any])
async def get_artifact(
    project_id: int,
    artifact_id: int,
    version: Optional[int] = Query(None, description="Specific version to retrieve"),
    db: AsyncSession = Depends(get_db),
    project: Project = Depends(get_project)
):
    """
    Get a specific artifact, optionally at a specific version.
    """
    try:
        # Проверяем существование артефакта
        result = await db.execute(
            select(Artifact).where(
                Artifact.id == artifact_id,
                Artifact.project_id == project_id
            )
        )
        artifact = result.scalar_one_or_none()
        
        if not artifact:
            raise HTTPException(status_code=404, detail="Artifact not found")
        
        # Если запрошена конкретная версия
        if version:
            version_result = await db.execute(
                select(ArtifactVersion)
                .where(
                    ArtifactVersion.artifact_id == artifact_id,
                    ArtifactVersion.version == version
                )
            )
            artifact_version = version_result.scalar_one_or_none()
            
            if not artifact_version:
                raise HTTPException(
                    status_code=404, 
                    detail=f"Version {version} not found"
                )
            
            data = artifact_version.data
            current_version = version
        else:
            data = artifact.data
            # Получаем последнюю версию
            version_result = await db.execute(
                select(ArtifactVersion)
                .where(ArtifactVersion.artifact_id == artifact_id)
                .order_by(ArtifactVersion.version.desc())
                .limit(1)
            )
            latest_version = version_result.scalar_one_or_none()
            current_version = latest_version.version if latest_version else 1
        
        return {
            "id": artifact.id,
            "project_id": artifact.project_id,
            "type": artifact.type,
            "name": artifact.name,
            "description": artifact.description,
            "data": data,
            "metadata": artifact.artifact_metadata,
            "created_at": artifact.created_at.isoformat() if artifact.created_at else None,
            "updated_at": artifact.updated_at.isoformat() if artifact.updated_at else None,
            "version": current_version
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting artifact: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")


@router.put("/{artifact_id}", response_model=Dict[str, Any])
async def update_artifact(
    project_id: int,
    artifact_id: int,
    update_data: Dict[str, Any],
    db: AsyncSession = Depends(get_db),
    project: Project = Depends(get_project)
):
    """
    Update an artifact (creates a new version).
    """
    try:
        # Проверяем существование артефакта
        result = await db.execute(
            select(Artifact).where(
                Artifact.id == artifact_id,
                Artifact.project_id == project_id
            )
        )
        artifact = result.scalar_one_or_none()
        
        if not artifact:
            raise HTTPException(status_code=404, detail="Artifact not found")
        
        # Получаем текущую версию
        version_result = await db.execute(
            select(ArtifactVersion)
            .where(ArtifactVersion.artifact_id == artifact_id)
            .order_by(ArtifactVersion.version.desc())
            .limit(1)
        )
        latest_version = version_result.scalar_one_or_none()
        current_version = latest_version.version if latest_version else 1
        
        # Обновляем поля
        if "name" in update_data:
            normalized_name = str(update_data["name"] or "").strip()
            if not normalized_name:
                raise HTTPException(status_code=400, detail="Field 'name' must not be empty")

            duplicate_result = await db.execute(
                select(Artifact.id).where(
                    Artifact.project_id == project_id,
                    Artifact.type == artifact.type,
                    func.lower(Artifact.name) == normalized_name.lower(),
                    Artifact.id != artifact_id,
                ).limit(1)
            )
            if duplicate_result.scalar_one_or_none() is not None:
                raise HTTPException(status_code=409, detail="Artifact with this type and name already exists in this project")

            artifact.name = normalized_name
        if "description" in update_data:
            artifact.description = update_data["description"]
        if "metadata" in update_data:
            artifact.artifact_metadata = {
                **(artifact.artifact_metadata or {}),
                **update_data["metadata"]
            }
        
        # Если обновляются данные, создаем новую версию
        if "data" in update_data:
            # Создаем новую версию
            new_version = ArtifactVersion(
                artifact_id=artifact_id,
                version=current_version + 1,
                data=update_data["data"],
                changed_by="user"
            )
            db.add(new_version)
            
            # Обновляем основные данные артефакта
            artifact.data = update_data["data"]
            artifact.updated_at = datetime.utcnow()
        
        await db.commit()
        await db.refresh(artifact)
        
        # Получаем обновленную версию
        final_version = current_version + 1 if "data" in update_data else current_version
        
        return {
            "id": artifact.id,
            "project_id": artifact.project_id,
            "type": artifact.type,
            "name": artifact.name,
            "description": artifact.description,
            "data": artifact.data,
            "metadata": artifact.artifact_metadata,
            "created_at": artifact.created_at.isoformat() if artifact.created_at else None,
            "updated_at": artifact.updated_at.isoformat() if artifact.updated_at else None,
            "version": final_version
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error updating artifact: {e}")
        await db.rollback()
        raise HTTPException(status_code=500, detail="Internal server error")


@router.delete("/{artifact_id}")
async def delete_artifact(
    project_id: int,
    artifact_id: int,
    db: AsyncSession = Depends(get_db),
    project: Project = Depends(get_project)
):
    """
    Delete an artifact and all its versions and relations.
    """
    try:
        # Проверяем существование артефакта
        result = await db.execute(
            select(Artifact).where(
                Artifact.id == artifact_id,
                Artifact.project_id == project_id
            )
        )
        artifact = result.scalar_one_or_none()
        
        if not artifact:
            raise HTTPException(status_code=404, detail="Artifact not found")
        
        # Удаляем (каскадно удалятся все версии и связи благодаря ondelete=CASCADE)
        await db.delete(artifact)
        await db.commit()
        
        return {"status": "success", "message": f"Artifact {artifact_id} deleted"}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error deleting artifact: {e}")
        await db.rollback()
        raise HTTPException(status_code=500, detail="Internal server error")


# ============================================================================
# Операции с версиями
# ============================================================================

@router.get("/{artifact_id}/versions", response_model=List[Dict[str, Any]])
async def get_artifact_versions(
    project_id: int,
    artifact_id: int,
    limit: int = Query(100, ge=1, le=1000),
    offset: int = Query(0, ge=0),
    db: AsyncSession = Depends(get_db),
    project: Project = Depends(get_project)
):
    """
    Get all versions of an artifact.
    """
    try:
        # Проверяем существование артефакта
        result = await db.execute(
            select(Artifact).where(
                Artifact.id == artifact_id,
                Artifact.project_id == project_id
            )
        )
        artifact = result.scalar_one_or_none()
        
        if not artifact:
            raise HTTPException(status_code=404, detail="Artifact not found")
        
        # Получаем версии
        versions_result = await db.execute(
            select(ArtifactVersion)
            .where(ArtifactVersion.artifact_id == artifact_id)
            .order_by(ArtifactVersion.version.desc())
            .limit(limit)
            .offset(offset)
        )
        versions = versions_result.scalars().all()
        
        return [
            {
                "version": v.version,
                "data": v.data,
                "changed_at": v.changed_at.isoformat() if v.changed_at else None,
                "changed_by": v.changed_by
            }
            for v in versions
        ]
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting artifact versions: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")


@router.post("/{artifact_id}/restore")
async def restore_artifact_version(
    project_id: int,
    artifact_id: int,
    version: int,
    db: AsyncSession = Depends(get_db),
    project: Project = Depends(get_project)
):
    """
    Restore an artifact to a previous version.
    """
    try:
        # Проверяем существование артефакта
        result = await db.execute(
            select(Artifact).where(
                Artifact.id == artifact_id,
                Artifact.project_id == project_id
            )
        )
        artifact = result.scalar_one_or_none()
        
        if not artifact:
            raise HTTPException(status_code=404, detail="Artifact not found")
        
        # Получаем версию для восстановления
        version_result = await db.execute(
            select(ArtifactVersion)
            .where(
                ArtifactVersion.artifact_id == artifact_id,
                ArtifactVersion.version == version
            )
        )
        old_version = version_result.scalar_one_or_none()
        
        if not old_version:
            raise HTTPException(status_code=404, detail=f"Version {version} not found")
        
        # Получаем текущую версию
        latest_result = await db.execute(
            select(ArtifactVersion)
            .where(ArtifactVersion.artifact_id == artifact_id)
            .order_by(ArtifactVersion.version.desc())
            .limit(1)
        )
        latest_version = latest_result.scalar_one_or_none()
        current_version = latest_version.version if latest_version else 1
        
        # Создаем новую версию с данными из старой
        new_version = ArtifactVersion(
            artifact_id=artifact_id,
            version=current_version + 1,
            data=old_version.data,
            changed_by="user (restore)"
        )
        db.add(new_version)
        
        # Обновляем основные данные артефакта
        artifact.data = old_version.data
        artifact.updated_at = datetime.utcnow()
        
        await db.commit()
        
        return {
            "status": "success",
            "message": f"Restored to version {version}",
            "new_version": current_version + 1
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error restoring artifact version: {e}")
        await db.rollback()
        raise HTTPException(status_code=500, detail="Internal server error")


# ============================================================================
# Операции со связями
# ============================================================================

@router.post("/{artifact_id}/relations")
async def create_artifact_relation(
    project_id: int,
    artifact_id: int,
    relation_data: Dict[str, Any],
    db: AsyncSession = Depends(get_db),
    project: Project = Depends(get_project)
):
    """
    Create a relation between artifacts.
    
    Args:
        relation_data: {
            "target_id": int,
            "relation_type": "derived_from|attached_to|references"
        }
    """
    try:
        # Проверяем существование исходного артефакта
        source_result = await db.execute(
            select(Artifact).where(
                Artifact.id == artifact_id,
                Artifact.project_id == project_id
            )
        )
        source = source_result.scalar_one_or_none()
        
        if not source:
            raise HTTPException(status_code=404, detail="Source artifact not found")
        
        # Проверяем обязательные поля
        if "target_id" not in relation_data:
            raise HTTPException(status_code=400, detail="Field 'target_id' is required")
        if "relation_type" not in relation_data:
            raise HTTPException(status_code=400, detail="Field 'relation_type' is required")
        
        # Проверяем существование целевого артефакта
        target_result = await db.execute(
            select(Artifact).where(
                Artifact.id == relation_data["target_id"],
                Artifact.project_id == project_id
            )
        )
        target = target_result.scalar_one_or_none()
        
        if not target:
            raise HTTPException(status_code=404, detail="Target artifact not found")
        
        # Проверяем валидность типа связи
        valid_relation_types = ["derived_from", "attached_to", "references"]
        if relation_data["relation_type"] not in valid_relation_types:
            raise HTTPException(
                status_code=400,
                detail=f"Invalid relation_type. Must be one of: {valid_relation_types}"
            )
        
        # Проверяем, не существует ли уже такая связь
        existing = await db.execute(
            select(ArtifactRelation).where(
                ArtifactRelation.source_id == artifact_id,
                ArtifactRelation.target_id == relation_data["target_id"],
                ArtifactRelation.relation_type == relation_data["relation_type"]
            )
        )
        if existing.scalar_one_or_none():
            raise HTTPException(
                status_code=400,
                detail="Relation already exists"
            )
        
        # Создаем связь
        relation = ArtifactRelation(
            source_id=artifact_id,
            target_id=relation_data["target_id"],
            relation_type=relation_data["relation_type"]
        )
        
        db.add(relation)
        await db.commit()
        
        return {
            "status": "success",
            "source_id": artifact_id,
            "target_id": relation_data["target_id"],
            "relation_type": relation_data["relation_type"]
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error creating artifact relation: {e}")
        await db.rollback()
        raise HTTPException(status_code=500, detail="Internal server error")


@router.get("/{artifact_id}/relations")
async def get_artifact_relations(
    project_id: int,
    artifact_id: int,
    direction: str = Query("both", regex="^(in|out|both)$"),
    relation_type: Optional[str] = None,
    db: AsyncSession = Depends(get_db),
    project: Project = Depends(get_project)
):
    """
    Get all relations for an artifact.
    
    Args:
        direction: 'in' (incoming), 'out' (outgoing), or 'both'
        relation_type: Optional filter by relation type
    """
    try:
        # Проверяем существование артефакта
        result = await db.execute(
            select(Artifact).where(
                Artifact.id == artifact_id,
                Artifact.project_id == project_id
            )
        )
        artifact = result.scalar_one_or_none()
        
        if not artifact:
            raise HTTPException(status_code=404, detail="Artifact not found")
        
        relations = []
        
        # Исходящие связи
        if direction in ["out", "both"]:
            out_query = select(ArtifactRelation).where(
                ArtifactRelation.source_id == artifact_id
            )
            if relation_type:
                out_query = out_query.where(ArtifactRelation.relation_type == relation_type)
            
            out_result = await db.execute(out_query)
            for rel in out_result.scalars().all():
                # Получаем информацию о целевом артефакте
                target_result = await db.execute(
                    select(Artifact).where(Artifact.id == rel.target_id)
                )
                target = target_result.scalar_one_or_none()
                
                relations.append({
                    "direction": "out",
                    "source_id": rel.source_id,
                    "target_id": rel.target_id,
                    "target_name": target.name if target else "Unknown",
                    "target_type": target.type if target else "unknown",
                    "relation_type": rel.relation_type,
                    "created_at": rel.created_at.isoformat() if rel.created_at else None
                })
        
        # Входящие связи
        if direction in ["in", "both"]:
            in_query = select(ArtifactRelation).where(
                ArtifactRelation.target_id == artifact_id
            )
            if relation_type:
                in_query = in_query.where(ArtifactRelation.relation_type == relation_type)
            
            in_result = await db.execute(in_query)
            for rel in in_result.scalars().all():
                # Получаем информацию об исходном артефакте
                source_result = await db.execute(
                    select(Artifact).where(Artifact.id == rel.source_id)
                )
                source = source_result.scalar_one_or_none()
                
                relations.append({
                    "direction": "in",
                    "source_id": rel.source_id,
                    "source_name": source.name if source else "Unknown",
                    "source_type": source.type if source else "unknown",
                    "target_id": rel.target_id,
                    "relation_type": rel.relation_type,
                    "created_at": rel.created_at.isoformat() if rel.created_at else None
                })
        
        return relations
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting artifact relations: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")


@router.delete("/{artifact_id}/relations/{target_id}")
async def delete_artifact_relation(
    project_id: int,
    artifact_id: int,
    target_id: int,
    relation_type: str,
    db: AsyncSession = Depends(get_db),
    project: Project = Depends(get_project)
):
    """
    Delete a relation between artifacts.
    """
    try:
        # Проверяем существование связи
        result = await db.execute(
            select(ArtifactRelation).where(
                ArtifactRelation.source_id == artifact_id,
                ArtifactRelation.target_id == target_id,
                ArtifactRelation.relation_type == relation_type
            )
        )
        relation = result.scalar_one_or_none()
        
        if not relation:
            raise HTTPException(status_code=404, detail="Relation not found")
        
        await db.delete(relation)
        await db.commit()
        
        return {
            "status": "success",
            "message": f"Relation deleted: {artifact_id} -> {target_id} ({relation_type})"
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error deleting artifact relation: {e}")
        await db.rollback()
        raise HTTPException(status_code=500, detail="Internal server error")

