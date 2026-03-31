"""Domain model configuration loader for node/edge types and graph rules."""

from __future__ import annotations

import json
from functools import lru_cache
from pathlib import Path
from typing import Any, Dict


_DEFAULT_CONFIG = {
    "version": 1,
    "node_types": [],
    "edge_types": [],
    "rules": {
        "merge_nodes_with_same_label": False,
        "allow_parallel_edges": True,
        "edge_direction_values": ["from", "to", "both"],
        "edge_style_values": ["solid", "dashed"],
    },
}


@lru_cache(maxsize=1)
def _config_path() -> Path:
    return Path(__file__).resolve().parent.parent / "configuration" / "domain_model.json"


@lru_cache(maxsize=1)
def get_domain_model() -> Dict[str, Any]:
    path = _config_path()
    if not path.exists():
        return dict(_DEFAULT_CONFIG)

    try:
        raw = json.loads(path.read_text(encoding="utf-8-sig"))
    except Exception:
        return dict(_DEFAULT_CONFIG)

    if not isinstance(raw, dict):
        return dict(_DEFAULT_CONFIG)

    merged: Dict[str, Any] = dict(_DEFAULT_CONFIG)
    merged.update(raw)

    if not isinstance(merged.get("node_types"), list):
        merged["node_types"] = []
    if not isinstance(merged.get("edge_types"), list):
        merged["edge_types"] = []
    if not isinstance(merged.get("rules"), dict):
        merged["rules"] = dict(_DEFAULT_CONFIG["rules"])

    return merged


def reload_domain_model() -> Dict[str, Any]:
    _config_path.cache_clear()
    get_domain_model.cache_clear()
    return get_domain_model()