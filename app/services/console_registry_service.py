from __future__ import annotations

from typing import Any, Dict, List, Optional

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.console_registry import (
    ConsoleDataSource,
    ConsoleObjectTypeMapping,
    ConsoleProcedureParam,
    ConsoleProcedureProfile,
    ConsoleResultColumnMapping,
    ConsoleResultSetMapping,
)

DEFAULT_CONSOLE_OBJECT_TYPE_MAPPINGS: List[Dict[str, Any]] = [
    {
        "id": None,
        "graph_type": "msisdn",
        "procedure_type": "MSISDN",
        "is_active": True,
        "position": 0,
        "is_default": True,
        "created_at": None,
        "updated_at": None,
    },
    {
        "id": None,
        "graph_type": "imei",
        "procedure_type": "IMEI",
        "is_active": True,
        "position": 1,
        "is_default": True,
        "created_at": None,
        "updated_at": None,
    },
    {
        "id": None,
        "graph_type": "imsi",
        "procedure_type": "IMSI",
        "is_active": True,
        "position": 2,
        "is_default": True,
        "created_at": None,
        "updated_at": None,
    },
]


def serialize_console_data_source(source: ConsoleDataSource) -> Dict[str, Any]:
    return {
        "id": source.id,
        "key": source.key,
        "name": source.name,
        "description": source.description,
        "dbms": source.dbms,
        "driver": source.driver,
        "host": source.host,
        "port": source.port,
        "database_name": source.database_name,
        "auth_type": source.auth_type,
        "username": source.username,
        "options": source.options_json or {},
        "is_active": bool(source.is_active),
        "has_password": bool(source.password),
        "created_at": source.created_at.isoformat() if source.created_at else None,
        "updated_at": source.updated_at.isoformat() if source.updated_at else None,
    }


def serialize_console_param(param: ConsoleProcedureParam) -> Dict[str, Any]:
    return {
        "id": param.id,
        "name": param.param_name,
        "key": param.param_name,
        "label": param.display_name,
        "type": param.data_type,
        "required": bool(param.is_required),
        "default": param.default_value,
        "binding_mode": param.binding_mode,
        "binding_source": param.binding_source,
        "binding_config": param.binding_config or {},
        "position": param.position,
        "hidden": bool(param.is_hidden),
    }


def serialize_console_column(column: ConsoleResultColumnMapping) -> Dict[str, Any]:
    return {
        "id": column.id,
        "key": column.column_name,
        "original_name": column.column_name,
        "label": column.display_name,
        "type": column.data_type,
        "width": column.width,
        "visible": bool(column.is_visible),
        "position": column.position,
    }


def serialize_console_result_set(result_set: ConsoleResultSetMapping) -> Dict[str, Any]:
    return {
        "id": result_set.id,
        "result_index": result_set.result_index,
        "result_key": result_set.result_key,
        "name": result_set.display_name,
        "visible": bool(result_set.is_visible),
        "position": result_set.position,
        "columns": [serialize_console_column(column) for column in result_set.columns],
    }


def serialize_console_profile(profile: ConsoleProcedureProfile) -> Dict[str, Any]:
    return {
        "id": profile.key,
        "db_id": profile.id,
        "key": profile.key,
        "name": profile.display_name,
        "description": profile.description,
        "schema_name": profile.schema_name,
        "procedure_name": profile.procedure_name,
        "source_id": profile.source_id,
        "source_key": profile.data_source.key if profile.data_source else None,
        "source_name": profile.data_source.name if profile.data_source else None,
        "timeout_seconds": profile.timeout_seconds,
        "default_limit": profile.default_row_limit,
        "supports_graph_selection": bool(profile.supports_graph_selection),
        "result_contract_version": profile.result_contract_version,
        "is_active": bool(profile.is_active),
        "params": [serialize_console_param(param) for param in profile.params],
        "result_sets": [serialize_console_result_set(result_set) for result_set in profile.result_sets],
        "created_at": profile.created_at.isoformat() if profile.created_at else None,
        "updated_at": profile.updated_at.isoformat() if profile.updated_at else None,
    }


def serialize_console_object_type_mapping(mapping: ConsoleObjectTypeMapping) -> Dict[str, Any]:
    return {
        "id": mapping.id,
        "graph_type": mapping.graph_type,
        "procedure_type": mapping.procedure_type,
        "is_active": bool(mapping.is_active),
        "position": mapping.position,
        "is_default": False,
        "created_at": mapping.created_at.isoformat() if mapping.created_at else None,
        "updated_at": mapping.updated_at.isoformat() if mapping.updated_at else None,
    }


async def get_console_data_source_by_key(db: AsyncSession, source_key: str) -> Optional[ConsoleDataSource]:
    result = await db.execute(
        select(ConsoleDataSource).where(ConsoleDataSource.key == str(source_key or "").strip())
    )
    return result.scalar_one_or_none()


async def list_console_data_sources(db: AsyncSession, active_only: bool = False) -> List[ConsoleDataSource]:
    query = select(ConsoleDataSource).order_by(ConsoleDataSource.name.asc(), ConsoleDataSource.id.asc())
    if active_only:
        query = query.where(ConsoleDataSource.is_active.is_(True))
    result = await db.execute(query)
    return list(result.scalars().all())


async def get_console_profile_by_key(db: AsyncSession, profile_key: str) -> Optional[ConsoleProcedureProfile]:
    query = (
        select(ConsoleProcedureProfile)
        .options(
            selectinload(ConsoleProcedureProfile.data_source),
            selectinload(ConsoleProcedureProfile.params),
            selectinload(ConsoleProcedureProfile.result_sets).selectinload(ConsoleResultSetMapping.columns),
        )
        .where(ConsoleProcedureProfile.key == str(profile_key or "").strip())
    )
    result = await db.execute(query)
    return result.scalar_one_or_none()


async def list_console_profiles(db: AsyncSession, active_only: bool = False) -> List[ConsoleProcedureProfile]:
    query = (
        select(ConsoleProcedureProfile)
        .options(
            selectinload(ConsoleProcedureProfile.data_source),
            selectinload(ConsoleProcedureProfile.params),
            selectinload(ConsoleProcedureProfile.result_sets).selectinload(ConsoleResultSetMapping.columns),
        )
        .order_by(ConsoleProcedureProfile.display_name.asc(), ConsoleProcedureProfile.id.asc())
    )
    if active_only:
        query = query.where(ConsoleProcedureProfile.is_active.is_(True))
    result = await db.execute(query)
    return list(result.scalars().all())


async def list_console_object_type_mappings(
    db: AsyncSession,
    active_only: bool = False,
) -> List[Dict[str, Any]]:
    query = select(ConsoleObjectTypeMapping).order_by(
        ConsoleObjectTypeMapping.position.asc(),
        ConsoleObjectTypeMapping.graph_type.asc(),
        ConsoleObjectTypeMapping.id.asc(),
    )
    if active_only:
        query = query.where(ConsoleObjectTypeMapping.is_active.is_(True))
    result = await db.execute(query)
    items = list(result.scalars().all())
    if not items:
        return [dict(item) for item in DEFAULT_CONSOLE_OBJECT_TYPE_MAPPINGS]
    return [serialize_console_object_type_mapping(item) for item in items]


async def get_console_object_type_mapping_dict(
    db: AsyncSession,
) -> Dict[str, str]:
    items = await list_console_object_type_mappings(db, active_only=True)
    result: Dict[str, str] = {}
    for item in items:
        graph_type = str(item.get("graph_type") or "").strip()
        procedure_type = str(item.get("procedure_type") or "").strip()
        if not graph_type or not procedure_type:
            continue
        result[graph_type] = procedure_type
    return result
