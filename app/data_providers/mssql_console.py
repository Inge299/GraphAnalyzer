from __future__ import annotations

from typing import Any

from app.data_provider_sdk import DataProvider, DataProviderContractError, DataProviderManifest
from app.services.console_execution_service import execute_console_procedure
from app.services.console_registry_service import get_console_profile_by_key, list_console_profiles


class MssqlConsoleDataProvider(DataProvider):
    def manifest(self) -> DataProviderManifest:
        return DataProviderManifest(
            id="console_mssql",
            name="SQL Server / процедуры",
            description="Доступ к зарегистрированным процедурам MSSQL через источники консоли Nodex.",
            kind="mssql_procedures",
            capabilities=["list_resources", "execute_procedure"],
        )

    async def list_resources(self, db: Any) -> list[dict[str, Any]]:
        profiles = await list_console_profiles(db, active_only=True)
        result: list[dict[str, Any]] = []
        for profile in profiles:
            source = profile.data_source
            if not source or not source.is_active:
                continue
            result.append({
                "id": profile.key,
                "name": profile.display_name,
                "description": profile.description or "",
                "source_key": source.key,
                "source_name": source.name,
                "kind": "stored_procedure",
                "params": [
                    {"name": item.param_name, "type": item.data_type, "required": bool(item.is_required)}
                    for item in profile.params
                    if not item.is_hidden
                ],
            })
        return result

    async def execute(self, db: Any, resource_id: str, params: dict[str, Any]) -> dict[str, Any]:
        profile = await get_console_profile_by_key(db, resource_id)
        if not profile or not profile.is_active:
            raise DataProviderContractError(f"Active procedure not found: {resource_id}")
        if not profile.data_source or not profile.data_source.is_active:
            raise DataProviderContractError(f"Data source is inactive for procedure: {resource_id}")
        return await execute_console_procedure(profile.data_source, profile, params)
