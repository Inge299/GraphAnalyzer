from __future__ import annotations

import asyncio
import json
from datetime import date, datetime
from decimal import Decimal
from typing import Any, Dict, List, Optional, Sequence, Tuple

import pymssql

from app.models.console_registry import ConsoleDataSource, ConsoleProcedureProfile


def _normalize_scalar(value: Any) -> Any:
    if value is None:
        return None
    if isinstance(value, Decimal):
        return float(value)
    if isinstance(value, (datetime, date)):
        return value.isoformat()
    if isinstance(value, bytes):
        try:
            return value.decode("utf-8")
        except Exception:
            return value.hex()
    return value


def _normalize_rows(rows: Sequence[Dict[str, Any]]) -> List[Dict[str, Any]]:
    normalized: List[Dict[str, Any]] = []
    for row in rows:
        normalized.append({str(key): _normalize_scalar(value) for key, value in row.items()})
    return normalized


def _to_int(value: Any, default: int) -> int:
    try:
        parsed = int(value)
    except (TypeError, ValueError):
        return default
    return parsed


def _extract_selected_ids(items: Any, key_candidates: Sequence[str]) -> List[str]:
    result: List[str] = []
    if not isinstance(items, list):
        return result
    for item in items:
        if isinstance(item, dict):
            value = None
            for key in key_candidates:
                if item.get(key) not in (None, ""):
                    value = item.get(key)
                    break
            if value not in (None, ""):
                result.append(str(value))
        elif item not in (None, ""):
            result.append(str(item))
    return result


def _extract_selected_labels(items: Any) -> List[str]:
    result: List[str] = []
    if not isinstance(items, list):
        return result
    for item in items:
        if isinstance(item, dict):
            label = item.get("label")
            if label not in (None, ""):
                result.append(str(label))
        elif item not in (None, ""):
            result.append(str(item))
    return result


def _extract_selected_types(items: Any) -> List[str]:
    result: List[str] = []
    if not isinstance(items, list):
        return result
    for item in items:
        if isinstance(item, dict):
            value = item.get("type")
            if value not in (None, ""):
                result.append(str(value))
        elif item not in (None, ""):
            result.append(str(item))
    return result


def _map_selected_types(items: Sequence[str], type_mapping: Optional[Dict[str, str]]) -> List[str]:
    mapping = type_mapping or {}
    result: List[str] = []
    for item in items:
        raw_value = str(item or "").strip()
        if not raw_value:
            continue
        result.append(str(mapping.get(raw_value, raw_value)).strip() or raw_value)
    return result


def _extract_selected_attr(items: Any, attr_key: str) -> List[str]:
    result: List[str] = []
    if not isinstance(items, list) or not attr_key:
        return result
    for item in items:
        if not isinstance(item, dict):
            continue
        attributes = item.get("attributes") if isinstance(item.get("attributes"), dict) else {}
        value = attributes.get(attr_key)
        if value in (None, ""):
            value = item.get(attr_key)
        if isinstance(value, list):
          for nested in value:
              if nested not in (None, ""):
                  result.append(str(nested))
        elif value not in (None, ""):
            result.append(str(value))
    return result


def build_console_execution_context(
    *,
    project_id: int,
    artifact_id: Optional[int],
    context_artifact_id: Optional[int],
    payload_context: Optional[Dict[str, Any]],
    type_mapping: Optional[Dict[str, str]] = None,
) -> Dict[str, Any]:
    ctx = payload_context if isinstance(payload_context, dict) else {}
    selected_nodes = ctx.get("selected_nodes") if isinstance(ctx.get("selected_nodes"), list) else []
    selected_edges = ctx.get("selected_edges") if isinstance(ctx.get("selected_edges"), list) else []
    selected_node_graph_types = _extract_selected_types(selected_nodes)
    return {
        "project_id": project_id,
        "artifact_id": artifact_id,
        "context_artifact_id": context_artifact_id,
        "selected_nodes": selected_nodes,
        "selected_edges": selected_edges,
        "selected_rows": ctx.get("selected_rows") if isinstance(ctx.get("selected_rows"), list) else [],
        "selected_text": ctx.get("selected_text"),
        "selected_geo": ctx.get("selected_geo"),
        "selected_node_ids": _extract_selected_ids(selected_nodes, ("id", "node_id")),
        "selected_edge_ids": _extract_selected_ids(selected_edges, ("id", "edge_id")),
        "selected_node_labels": _extract_selected_labels(selected_nodes),
        "selected_node_graph_types": selected_node_graph_types,
        "selected_node_types": _map_selected_types(selected_node_graph_types, type_mapping),
    }


def _coerce_param_value(data_type: str, value: Any) -> Any:
    normalized_type = str(data_type or "string").strip().lower()
    if value in (None, ""):
        return None if normalized_type in {"number", "integer", "float", "date", "datetime", "json"} else ""
    if normalized_type in {"number", "float"}:
        try:
            return float(value)
        except (TypeError, ValueError):
            return value
    if normalized_type in {"integer", "int"}:
        try:
            return int(value)
        except (TypeError, ValueError):
            return value
    if normalized_type == "boolean":
        if isinstance(value, bool):
            return value
        text_value = str(value).strip().lower()
        return text_value in {"1", "true", "yes", "y", "да"}
    if normalized_type == "json":
        if isinstance(value, str):
            return value
        return json.dumps(value, ensure_ascii=False)
    if isinstance(value, (dict, list)):
        return json.dumps(value, ensure_ascii=False)
    return str(value)


def resolve_procedure_params(
    profile: ConsoleProcedureProfile,
    payload_params: Dict[str, Any],
    execution_context: Dict[str, Any],
) -> Dict[str, Any]:
    params: Dict[str, Any] = {}
    selected_nodes = execution_context.get("selected_nodes") or []
    selected_edges = execution_context.get("selected_edges") or []

    selection_json = json.dumps(
        {
            "project_id": execution_context.get("project_id"),
            "artifact_id": execution_context.get("artifact_id"),
            "context_artifact_id": execution_context.get("context_artifact_id"),
            "selected_nodes": selected_nodes,
            "selected_edges": selected_edges,
            "selected_rows": execution_context.get("selected_rows") or [],
            "selected_text": execution_context.get("selected_text"),
            "selected_geo": execution_context.get("selected_geo"),
            "selected_node_ids": execution_context.get("selected_node_ids") or [],
            "selected_edge_ids": execution_context.get("selected_edge_ids") or [],
            "selected_node_labels": execution_context.get("selected_node_labels") or [],
            "selected_node_graph_types": execution_context.get("selected_node_graph_types") or [],
            "selected_node_types": execution_context.get("selected_node_types") or [],
        },
        ensure_ascii=False,
    )

    for spec in profile.params:
        binding_mode = str(spec.binding_mode or "manual").strip().lower()
        binding_source = str(spec.binding_source or "").strip()
        binding_config = spec.binding_config or {}
        attr_key = str(binding_config.get("attr_key") or "").strip()
        value: Any

        if binding_mode == "manual":
            value = payload_params.get(spec.param_name, spec.default_value)
        elif binding_mode == "fixed":
            value = spec.default_value
        elif binding_mode == "project_context":
            if binding_source == "artifact_id":
                value = execution_context.get("artifact_id")
            elif binding_source == "context_artifact_id":
                value = execution_context.get("context_artifact_id")
            else:
                value = execution_context.get("project_id")
        elif binding_mode == "selection_json":
            value = selection_json
        elif binding_mode == "selected_node_ids_csv":
            value = ",".join(execution_context.get("selected_node_ids") or [])
        elif binding_mode == "selected_edge_ids_csv":
            value = ",".join(execution_context.get("selected_edge_ids") or [])
        elif binding_mode == "selected_node_labels_csv":
            value = ",".join(execution_context.get("selected_node_labels") or [])
        elif binding_mode == "selected_node_types_csv":
            value = ",".join(execution_context.get("selected_node_types") or [])
        elif binding_mode == "selected_node_attr_csv":
            value = ",".join(_extract_selected_attr(selected_nodes, attr_key))
        else:
            value = payload_params.get(spec.param_name, spec.default_value)

        coerced = _coerce_param_value(spec.data_type, value)
        if spec.is_required and coerced in (None, "", []):
            raise ValueError(f"Required procedure parameter '{spec.param_name}' is empty")
        params[spec.param_name] = coerced

    return params


def _open_mssql_connection(source: ConsoleDataSource, timeout_seconds: int) -> pymssql.Connection:
    options = source.options_json or {}
    return pymssql.connect(
        server=source.host,
        port=str(source.port or 1433),
        user=source.username or None,
        password=source.password or None,
        database=source.database_name,
        login_timeout=_to_int(options.get("login_timeout"), min(timeout_seconds, 30)),
        timeout=_to_int(options.get("timeout"), timeout_seconds),
        charset=str(options.get("charset") or "UTF-8"),
        as_dict=False,
        autocommit=True,
    )


def _infer_column_type(values: Sequence[Any]) -> str:
    for value in values:
        if value is None:
            continue
        if isinstance(value, bool):
            return "boolean"
        if isinstance(value, int):
            return "integer"
        if isinstance(value, float):
            return "number"
        if isinstance(value, (datetime, date)):
            return "datetime"
        return "string"
    return "string"


def _build_result_tabs(
    profile: ConsoleProcedureProfile,
    result_sets: List[Tuple[List[str], List[Dict[str, Any]]]],
) -> List[Dict[str, Any]]:
    result_set_by_index = {item.result_index: item for item in profile.result_sets}
    tabs: List[Dict[str, Any]] = []

    for index, (raw_columns, raw_rows) in enumerate(result_sets, start=1):
        mapping = result_set_by_index.get(index)
        column_mapping_by_name = {
            str(item.column_name): item
            for item in (mapping.columns if mapping else [])
        }

        normalized_rows = _normalize_rows(raw_rows)
        columns_meta: List[Dict[str, Any]] = []
        for column_name in raw_columns:
            values = [row.get(column_name) for row in normalized_rows]
            column_mapping = column_mapping_by_name.get(column_name)
            columns_meta.append(
                {
                    "key": column_name,
                    "original_name": column_name,
                    "label": column_mapping.display_name if column_mapping else column_name,
                    "type": column_mapping.data_type if column_mapping else _infer_column_type(values),
                    "width": column_mapping.width if column_mapping else None,
                    "visible": bool(column_mapping.is_visible) if column_mapping else True,
                }
            )

        tab_name = mapping.display_name if mapping else f"Результат {index}"
        tab_key = mapping.result_key if mapping and mapping.result_key else f"result_{index}"
        tabs.append(
            {
                "id": tab_key,
                "name": tab_name,
                "result_index": index,
                "columns": columns_meta,
                "rows": normalized_rows,
                "row_count": len(normalized_rows),
            }
        )

    return tabs


def _execute_stored_procedure_sync(
    source: ConsoleDataSource,
    profile: ConsoleProcedureProfile,
    resolved_params: Dict[str, Any],
) -> List[Tuple[List[str], List[Dict[str, Any]]]]:
    connection = _open_mssql_connection(source, _to_int(profile.timeout_seconds, 120))
    try:
        cursor = connection.cursor()
        param_items = list(resolved_params.items())
        assignments = ", ".join([f"@{name}=%s" for name, _ in param_items])
        statement = f"EXEC [{profile.schema_name}].[{profile.procedure_name}]"
        if assignments:
            statement = f"{statement} {assignments}"
        values = tuple(value for _, value in param_items)

        cursor.execute(statement, values)
        result_sets: List[Tuple[List[str], List[Dict[str, Any]]]] = []

        while True:
            if cursor.description:
                columns = [str(item[0]) for item in cursor.description]
                rows = [dict(zip(columns, row)) for row in cursor.fetchall()]
                result_sets.append((columns, rows))
            if not cursor.nextset():
                break

        cursor.close()
        return result_sets
    finally:
        connection.close()


def _test_console_data_source_connection_sync(
    source: ConsoleDataSource,
) -> Dict[str, Any]:
    connection = _open_mssql_connection(source, 15)
    try:
        cursor = connection.cursor()
        cursor.execute("SELECT @@SERVERNAME AS server_name, DB_NAME() AS database_name")
        row = cursor.fetchone()
        cursor.close()

        server_name = row[0] if row and len(row) > 0 else None
        database_name = row[1] if row and len(row) > 1 else source.database_name
        return {
            "ok": True,
            "server_name": _normalize_scalar(server_name),
            "database_name": _normalize_scalar(database_name),
        }
    finally:
        connection.close()


async def execute_console_procedure(
    source: ConsoleDataSource,
    profile: ConsoleProcedureProfile,
    resolved_params: Dict[str, Any],
) -> Dict[str, Any]:
    result_sets = await asyncio.to_thread(
        _execute_stored_procedure_sync,
        source,
        profile,
        resolved_params,
    )
    tabs = _build_result_tabs(profile, result_sets)
    primary_tab = tabs[0] if tabs else {"columns": [], "rows": []}
    return {
        "profile_key": profile.key,
        "profile_name": profile.display_name,
        "source_key": source.key,
        "source_name": source.name,
        "executed_at": datetime.utcnow().isoformat(),
        "tabs": tabs,
        "active_tab_id": tabs[0]["id"] if tabs else None,
        "columns": list(primary_tab.get("columns") or []),
        "rows": list(primary_tab.get("rows") or []),
    }


async def test_console_data_source_connection(
    source: ConsoleDataSource,
) -> Dict[str, Any]:
    return await asyncio.to_thread(
        _test_console_data_source_connection_sync,
        source,
    )
