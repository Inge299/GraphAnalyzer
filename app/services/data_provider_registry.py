from __future__ import annotations

import importlib
import importlib.util
import logging
import os
import pkgutil
import sys
from pathlib import Path
from typing import Any, Type

from app.data_provider_sdk import DataProvider, DataProviderContractError, validate_provider_manifest
from app.services.reference_provider_registry import ensure_reference_provider, get_reference_provider

logger = logging.getLogger(__name__)
PACKAGE = "app.data_providers"
EXTERNAL_PROVIDER_DIR = Path(os.getenv("DATA_PROVIDER_DIR", "/app/data/data_providers"))


def _load_file(path: Path) -> list[Type[DataProvider]]:
    module_name = f"_nodex_data_provider_{path.stem}_{path.stat().st_mtime_ns}"
    spec = importlib.util.spec_from_file_location(module_name, path)
    if not spec or not spec.loader:
        raise DataProviderContractError(f"Cannot load provider package {path.name}")
    module = importlib.util.module_from_spec(spec)
    sys.modules[module_name] = module
    try:
        spec.loader.exec_module(module)
    except Exception:
        sys.modules.pop(module_name, None)
        raise
    return [
        value for value in vars(module).values()
        if isinstance(value, type) and issubclass(value, DataProvider) and value is not DataProvider
        and value.__module__ == module.__name__
    ]


def _discover_classes() -> list[Type[DataProvider]]:
    classes: list[Type[DataProvider]] = []
    package = importlib.import_module(PACKAGE)
    for _, module_name, _ in pkgutil.walk_packages(package.__path__, f"{PACKAGE}."):
        if module_name.rsplit(".", 1)[-1].startswith("_"):
            continue
        try:
            module = importlib.import_module(module_name)
        except Exception as exc:
            logger.error("Failed to load data provider module %s: %s", module_name, exc)
            continue
        classes.extend([
            value for value in vars(module).values()
            if isinstance(value, type) and issubclass(value, DataProvider) and value is not DataProvider
        ])
    EXTERNAL_PROVIDER_DIR.mkdir(parents=True, exist_ok=True)
    for path in sorted(EXTERNAL_PROVIDER_DIR.glob("*.py")):
        if path.name.startswith("_"):
            continue
        try:
            classes.extend(_load_file(path))
        except Exception as exc:
            logger.error("Failed to load installed data provider %s: %s", path, exc)
    return classes


def _registry() -> dict[str, DataProvider]:
    providers: dict[str, DataProvider] = {}
    for provider_class in _discover_classes():
        try:
            provider = provider_class()
            manifest = provider.manifest()
            validate_provider_manifest(manifest)
            ensure_reference_provider({
                'id': manifest.id, 'kind': manifest.kind, 'name': manifest.name, 'description': manifest.description,
                'capabilities': manifest.capabilities, 'config': manifest.default_config,
                'editable_fields': manifest.editable_fields,
                'source': 'external' if getattr(provider_class, '_installed_file', None) else 'builtin',
            })
            if manifest.id in providers:
                raise DataProviderContractError(f"Duplicate provider id: {manifest.id}")
            providers[manifest.id] = provider
        except Exception as exc:
            logger.error("Skipping data provider %s: %s", provider_class, exc)
    return providers


def list_data_provider_manifests() -> list[dict[str, Any]]:
    result: list[dict[str, Any]] = []
    for provider_id, provider in _registry().items():
        manifest = provider.manifest()
        try:
            config = get_reference_provider(provider_id)
        except ValueError:
            continue
        result.append({
            "id": manifest.id, "name": config["name"], "description": config["description"],
            "kind": manifest.kind, "enabled": bool(config["enabled"]),
            "capabilities": manifest.capabilities, "version": manifest.version,
            "source": config.get("source", "builtin"),
        })
    return sorted(result, key=lambda item: item["name"])


def get_data_provider(provider_id: str) -> DataProvider:
    provider = _registry().get(provider_id)
    if not provider:
        raise DataProviderContractError(f"Provider not installed: {provider_id}")
    config = get_reference_provider(provider_id)
    if not config.get("enabled", True):
        raise DataProviderContractError(f"Provider is disabled: {provider_id}")
    return provider
