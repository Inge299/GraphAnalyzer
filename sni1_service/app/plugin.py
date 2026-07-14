from __future__ import annotations

import json
import os
from urllib import request

from .analytics import analyze_input

PLUGIN_NAME = "sni_traffic_report"
PLUGIN_CONTRACT_VERSION = "1.0.0"
DEFAULT_DOCUMENT_TITLE = "SNI traffic report"
DEFAULT_CONSOLE_TITLE = "SNI traffic analysis"


def run_plugin(params: dict) -> dict:
    """Nodex-compatible plugin entrypoint for local/remote analysis."""
    input_path = params.get("input_path")
    if not input_path:
        raise ValueError("input_path is required")

    payload = {
        "input_path": input_path,
        "device_id": params.get("device_id"),
        "top_n": int(params["top_n"]) if params.get("top_n") is not None else None,
        "gap_minutes": int(params["gap_minutes"]) if params.get("gap_minutes") is not None else None,
        "document_title": params.get("document_title"),
        "console_title": params.get("console_title"),
        "refs_dir": params.get("refs_dir"),
    }

    use_remote = bool(params.get("use_remote_service", False))
    service_url = os.getenv("SNI_SERVICE_URL")

    if use_remote and service_url:
        url = service_url.rstrip("/") + "/analyze"
        req = request.Request(
            url,
            data=json.dumps(payload).encode("utf-8"),
            headers={"Content-Type": "application/json"},
            method="POST",
        )
        with request.urlopen(req, timeout=30) as resp:
            result_json = json.loads(resp.read().decode("utf-8"))
        document_markdown = result_json.get("document_markdown", "")
        tables = result_json.get("tables", {})
        meta = result_json.get("meta", {})
        execution_mode = "remote"
    else:
        result = analyze_input(**payload)
        document_markdown = result.document_markdown
        tables = result.tables
        meta = result.meta
        execution_mode = "local"

    document_title = payload.get("document_title") or DEFAULT_DOCUMENT_TITLE
    console_title = payload.get("console_title") or DEFAULT_CONSOLE_TITLE

    merged_meta = dict(meta)
    merged_meta.update(
        {
            "plugin_name": PLUGIN_NAME,
            "plugin_contract_version": PLUGIN_CONTRACT_VERSION,
            "execution_mode": execution_mode,
        }
    )

    return {
        "artifacts": [
            {"type": "document", "title": document_title, "content": document_markdown},
            {"type": "console", "title": console_title, "tables": tables},
        ],
        "meta": merged_meta,
    }
