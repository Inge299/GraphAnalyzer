from __future__ import annotations

from datetime import datetime, timezone
from typing import Any

from app.services.domain_model_service import get_domain_model, save_domain_model
from app.services.project_data_import_plugins import (
    get_project_data_import_plugins_config,
    replace_project_data_import_plugins_config,
)
from app.services.plugins_config_service import get_plugins_config, replace_plugins_config
from app.services.reference_provider_registry import (
    get_reference_providers_config,
    replace_reference_providers_config,
)


def export_metadata_bundle() -> dict[str, Any]:
    return {
        "version": 2,
        "exported_at_utc": datetime.now(timezone.utc).isoformat(),
        "domain_model": get_domain_model(),
        "project_data_import_plugins": get_project_data_import_plugins_config(),
        "reference_providers": get_reference_providers_config(),
        "graph_plugins": get_plugins_config(),
    }


def import_metadata_bundle(bundle: dict[str, Any]) -> dict[str, Any]:
    if not isinstance(bundle, dict):
        raise ValueError("Metadata bundle must be an object")
    if "domain_model" in bundle:
        domain_model = bundle["domain_model"]
        if not isinstance(domain_model, dict):
            raise ValueError("domain_model must be an object")
        save_domain_model(domain_model)
    if "project_data_import_plugins" in bundle:
        plugins_config = bundle["project_data_import_plugins"]
        if not isinstance(plugins_config, dict):
            raise ValueError("project_data_import_plugins must be an object")
        replace_project_data_import_plugins_config(plugins_config)
    if "graph_plugins" in bundle:
        graph_plugins = bundle["graph_plugins"]
        if not isinstance(graph_plugins, dict):
            raise ValueError("graph_plugins must be an object")
        replace_plugins_config(graph_plugins)
    if "reference_providers" in bundle:
        providers_config = bundle["reference_providers"]
        if not isinstance(providers_config, dict):
            raise ValueError("reference_providers must be an object")
        replace_reference_providers_config(providers_config)
    return export_metadata_bundle()
