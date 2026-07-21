from __future__ import annotations

from datetime import datetime, timezone
from typing import Any

from app.services.domain_model_service import get_domain_model, save_domain_model
from app.services.project_data_import_plugins import (
    get_project_data_import_plugins_config,
    replace_project_data_import_plugins_config,
)


def export_metadata_bundle() -> dict[str, Any]:
    return {
        "version": 1,
        "exported_at_utc": datetime.now(timezone.utc).isoformat(),
        "domain_model": get_domain_model(),
        "project_data_import_plugins": get_project_data_import_plugins_config(),
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

    return export_metadata_bundle()
