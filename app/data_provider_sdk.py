"""SDK for executable data-provider plugins."""
from __future__ import annotations

from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from typing import Any

SDK_VERSION = "1.0"


class DataProviderContractError(ValueError):
    pass


@dataclass(frozen=True)
class DataProviderManifest:
    id: str
    name: str
    description: str
    kind: str
    capabilities: list[str] = field(default_factory=list)
    version: str = "1.0"
    sdk_version: str = SDK_VERSION
    default_config: dict[str, Any] = field(default_factory=dict)
    editable_fields: list[str] = field(default_factory=lambda: ["name", "description", "enabled"])


class DataProvider(ABC):
    @abstractmethod
    def manifest(self) -> DataProviderManifest:
        raise NotImplementedError

    async def list_resources(self, db: Any) -> list[dict[str, Any]]:
        return []

    async def execute(self, db: Any, resource_id: str, params: dict[str, Any]) -> dict[str, Any]:
        raise DataProviderContractError(f"Provider {self.manifest().id} does not support execution")


def validate_provider_manifest(manifest: DataProviderManifest) -> None:
    if not manifest.id or not manifest.name or not manifest.kind:
        raise DataProviderContractError("Provider manifest requires id, name and kind")
    if manifest.sdk_version != SDK_VERSION:
        raise DataProviderContractError(f"Unsupported provider SDK {manifest.sdk_version}; expected {SDK_VERSION}")
