from __future__ import annotations

from copy import deepcopy
from datetime import datetime
from typing import Any, Dict, List, Optional


def _normalize_console_columns(columns: Any, rows: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    normalized: List[Dict[str, Any]] = []
    source_columns = columns if isinstance(columns, list) else []

    if not source_columns and rows:
        source_columns = list(rows[0].keys())

    for item in source_columns:
        if isinstance(item, str):
            key = str(item).strip()
            if not key:
                continue
            normalized.append(
                {
                    "key": key,
                    "original_name": key,
                    "label": key,
                    "type": "string",
                    "width": None,
                    "visible": True,
                }
            )
            continue

        if not isinstance(item, dict):
            continue

        key = str(item.get("key") or item.get("original_name") or "").strip()
        if not key:
            continue

        normalized.append(
            {
                "key": key,
                "original_name": str(item.get("original_name") or key).strip() or key,
                "label": str(item.get("label") or item.get("original_name") or key).strip() or key,
                "type": str(item.get("type") or "string").strip() or "string",
                "width": item.get("width") if isinstance(item.get("width"), int) else None,
                "visible": bool(item.get("visible", True)),
            }
        )

    return normalized


def _normalize_console_rows(rows: Any) -> List[Dict[str, Any]]:
    if not isinstance(rows, list):
        return []
    return [dict(item) for item in rows if isinstance(item, dict)]


def _normalize_console_tab(
    item: Dict[str, Any],
    *,
    index: int,
) -> Dict[str, Any]:
    rows = _normalize_console_rows(item.get("rows"))
    columns = _normalize_console_columns(item.get("columns"), rows)
    tab_id = str(item.get("id") or item.get("key") or f"result_{index}").strip() or f"result_{index}"
    tab_name = str(item.get("name") or item.get("label") or f"Result {index}").strip() or f"Result {index}"
    row_count = item.get("row_count")
    if not isinstance(row_count, int):
        row_count = len(rows)

    result = {
        "id": tab_id,
        "key": tab_id,
        "name": tab_name,
        "result_index": int(item.get("result_index") or index),
        "columns": columns,
        "rows": rows,
        "row_count": row_count,
    }
    if item.get("view") == "map" and isinstance(item.get("map_data"), dict):
        result["view"] = "map"
        result["map_data"] = deepcopy(item["map_data"])
    return result


def normalize_console_artifact_data(
    payload: Optional[Dict[str, Any]],
    *,
    executor_type: Optional[str] = None,
    executor_id: Optional[str] = None,
    executor_name: Optional[str] = None,
    source_plugin_id: Optional[str] = None,
) -> Dict[str, Any]:
    data = deepcopy(payload) if isinstance(payload, dict) else {}
    tabs_input = data.get("tabs")
    result_sets_input = data.get("result_sets")
    rows_input = data.get("rows")
    columns_input = data.get("columns")

    tabs: List[Dict[str, Any]] = []
    if isinstance(tabs_input, list) and tabs_input:
        tabs = [
            _normalize_console_tab(item, index=index)
            for index, item in enumerate(tabs_input, start=1)
            if isinstance(item, dict)
        ]
    elif isinstance(result_sets_input, list) and result_sets_input:
        tabs = [
            _normalize_console_tab(item, index=index)
            for index, item in enumerate(result_sets_input, start=1)
            if isinstance(item, dict)
        ]
    else:
        rows = _normalize_console_rows(rows_input)
        columns = _normalize_console_columns(columns_input, rows)
        tabs = [
            {
                "id": "result_1",
                "key": "result_1",
                "name": str(data.get("name") or "Result").strip() or "Result",
                "result_index": 1,
                "columns": columns,
                "rows": rows,
                "row_count": len(rows),
            }
        ]

    primary_tab = tabs[0] if tabs else {
        "id": "result_1",
        "key": "result_1",
        "name": "Result",
        "result_index": 1,
        "columns": [],
        "rows": [],
        "row_count": 0,
    }

    active_tab_id = str(data.get("active_tab_id") or "").strip()
    if not active_tab_id or not any(str(item.get("id") or "") == active_tab_id for item in tabs):
        active_tab_id = str(primary_tab.get("id") or "result_1")

    executor = data.get("executor") if isinstance(data.get("executor"), dict) else {}
    if executor_type and not executor.get("type"):
        executor["type"] = executor_type
    if executor_id and not executor.get("id"):
        executor["id"] = executor_id
    if executor_name and not executor.get("name"):
        executor["name"] = executor_name
    if source_plugin_id and not executor.get("plugin_id"):
        executor["plugin_id"] = source_plugin_id

    result_sets = [
        {
            "key": item["key"],
            "name": item["name"],
            "result_index": item["result_index"],
            "columns": item["columns"],
            "rows": item["rows"],
            "row_count": item["row_count"],
            **({"view": "map", "map_data": item["map_data"]} if item.get("view") == "map" and isinstance(item.get("map_data"), dict) else {}),
        }
        for item in tabs
    ]

    data.update(
        {
            "artifact_kind": "console",
            "executor": executor,
            "tabs": tabs,
            "result_sets": result_sets,
            "active_tab_id": active_tab_id,
            "columns": primary_tab["columns"],
            "rows": primary_tab["rows"],
            "updated_at": str(data.get("updated_at") or datetime.utcnow().isoformat()),
        }
    )
    return data


def build_console_artifact_metadata(
    *,
    base_metadata: Optional[Dict[str, Any]] = None,
    profile_kind: Optional[str] = None,
    profile_id: Optional[str] = None,
    profile_name: Optional[str] = None,
    source_key: Optional[str] = None,
    source_name: Optional[str] = None,
    context_artifact_id: Optional[int] = None,
    raw_params: Optional[Dict[str, Any]] = None,
    resolved_params: Optional[Dict[str, Any]] = None,
    tabs: Optional[List[Dict[str, Any]]] = None,
    source_plugin_id: Optional[str] = None,
) -> Dict[str, Any]:
    metadata = dict(base_metadata or {})
    normalized_tabs = tabs if isinstance(tabs, list) else []
    metadata.update(
        {
            "console_profile_id": profile_id,
            "console_profile_name": profile_name,
            "console_profile_kind": profile_kind,
            "console_source_key": source_key,
            "console_source_name": source_name,
            "console_context_artifact_id": context_artifact_id,
            "console_last_params": raw_params or {},
            "console_last_resolved_params": resolved_params or {},
            "console_tabs_count": len(normalized_tabs),
            "console_rows_count": sum(int(item.get("row_count") or 0) for item in normalized_tabs),
            "console_refreshed_at": datetime.utcnow().isoformat(),
            "source_plugin": source_plugin_id or metadata.get("source_plugin"),
        }
    )
    return metadata
