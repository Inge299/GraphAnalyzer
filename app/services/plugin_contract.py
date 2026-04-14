"""
Plugin contract validation utilities.

This module validates runtime context and params for plugin execution
while preserving backward compatibility with legacy plugins.
"""

from __future__ import annotations

from datetime import date
from typing import Any, Dict, List, Optional


_ALLOWED_PARAM_TYPES = {"string", "number", "integer", "boolean", "date"}
_ALLOWED_SELECTION_RULES = {"required", "optional", "forbidden"}


def _as_list(value: Any) -> List[Any]:
    if value is None:
        return []
    if isinstance(value, list):
        return value
    return [value]


def _selection_rule(selection_cfg: Dict[str, Any], key: str) -> str:
    raw = str(selection_cfg.get(key, "optional")).lower()
    if raw not in _ALLOWED_SELECTION_RULES:
        return "optional"
    return raw


def _check_selection_rule(rule: str, items: List[Any], field_name: str) -> Optional[str]:
    if rule == "required" and len(items) == 0:
        return f"Selection field '{field_name}' is required"
    if rule == "forbidden" and len(items) > 0:
        return f"Selection field '{field_name}' is forbidden for this plugin"
    return None


def _validate_param_type(param_type: str, value: Any, key: str) -> Optional[str]:
    if param_type == "string":
        if not isinstance(value, str):
            return f"Param '{key}' must be string"
        return None

    if param_type == "number":
        if isinstance(value, bool) or not isinstance(value, (int, float)):
            return f"Param '{key}' must be number"
        return None

    if param_type == "integer":
        if isinstance(value, bool) or not isinstance(value, int):
            return f"Param '{key}' must be integer"
        return None

    if param_type == "boolean":
        if not isinstance(value, bool):
            return f"Param '{key}' must be boolean"
        return None

    if param_type == "date":
        if not isinstance(value, str):
            return f"Param '{key}' must be date string YYYY-MM-DD"
        try:
            date.fromisoformat(value)
        except Exception:
            return f"Param '{key}' must be valid date YYYY-MM-DD"
        return None

    return f"Unsupported param type '{param_type}' for '{key}'"


def _derive_allowed_artifact_types(plugin: Any) -> List[str]:
    # New contract: inputs.artifact_types
    inputs = getattr(plugin, "inputs", None) or {}
    if isinstance(inputs, dict):
        artifact_types = inputs.get("artifact_types")
        if isinstance(artifact_types, list) and artifact_types:
            return [str(x) for x in artifact_types]

    # Legacy fallback
    applicable_to = getattr(plugin, "applicable_to", None)
    if isinstance(applicable_to, list) and applicable_to:
        return [str(x) for x in applicable_to]

    input_types = getattr(plugin, "input_types", None)
    if isinstance(input_types, list) and input_types:
        return [str(x) for x in input_types]

    return []


def validate_plugin_execution(
    plugin: Any,
    input_artifacts: List[Dict[str, Any]],
    params: Optional[Dict[str, Any]],
    context: Optional[Dict[str, Any]],
    check_required_params: bool = True,
) -> None:
    """Raise ValueError on contract violations."""

    params = params or {}
    context = context or {}

    allowed_types = _derive_allowed_artifact_types(plugin)
    if allowed_types:
        for artifact in input_artifacts:
            artifact_type = str(artifact.get("type", ""))
            if artifact_type not in allowed_types:
                raise ValueError(
                    f"Plugin not applicable to artifact type '{artifact_type}'"
                )

    # Optional context-based selection checks
    inputs = getattr(plugin, "inputs", None) or {}
    selection_cfg = {}
    if isinstance(inputs, dict):
        selection_cfg = inputs.get("selection") or {}
        if not isinstance(selection_cfg, dict):
            selection_cfg = {}

    selected_nodes = _as_list(context.get("selected_nodes"))
    selected_edges = _as_list(context.get("selected_edges"))
    selected_rows = _as_list(context.get("selected_rows"))
    selected_text = context.get("selected_text")
    selected_geo = context.get("selected_geo")

    checks = [
        (_selection_rule(selection_cfg, "nodes"), selected_nodes, "selected_nodes"),
        (_selection_rule(selection_cfg, "edges"), selected_edges, "selected_edges"),
        (_selection_rule(selection_cfg, "rows"), selected_rows, "selected_rows"),
        (
            _selection_rule(selection_cfg, "text"),
            [] if selected_text in (None, "") else [selected_text],
            "selected_text",
        ),
        (
            _selection_rule(selection_cfg, "geo"),
            [] if selected_geo is None else [selected_geo],
            "selected_geo",
        ),
    ]

    for rule, items, field_name in checks:
        violation = _check_selection_rule(rule, items, field_name)
        if violation:
            raise ValueError(violation)

    applicable_when = getattr(plugin, "applicable_when", None) or {}
    if isinstance(applicable_when, dict):
        min_nodes = applicable_when.get("min_selected_nodes")
        if isinstance(min_nodes, int) and min_nodes > 0 and len(selected_nodes) < min_nodes:
            raise ValueError(
                f"Plugin requires at least {min_nodes} selected nodes"
            )

    # Params schema checks
    params_schema = getattr(plugin, "params_schema", None) or []
    if not isinstance(params_schema, list):
        params_schema = []

    for spec in params_schema:
        if not isinstance(spec, dict):
            continue
        key = str(spec.get("key") or spec.get("name") or "").strip()
        if not key:
            continue

        required = bool(spec.get("required", False))
        param_type = str(spec.get("type", "string")).lower()
        if param_type not in _ALLOWED_PARAM_TYPES:
            raise ValueError(f"Invalid params_schema type '{param_type}' for '{key}'")

        if key not in params:
            if required and check_required_params:
                raise ValueError(f"Param '{key}' is required")
            continue

        type_error = _validate_param_type(param_type, params[key], key)
        if type_error:
            raise ValueError(type_error)

