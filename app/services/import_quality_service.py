"""Read-only import quality report derived from preserved manifests."""

from __future__ import annotations

from typing import Any

from app.services.project_data_import_utils import read_manifest
from app.services.project_data_service import DATA_ROOT


def _value(payload: dict[str, Any], section: str, key: str) -> int:
    value = payload.get(section)
    if not isinstance(value, dict):
        return 0
    try:
        return int(value.get(key) or 0)
    except (TypeError, ValueError):
        return 0


def get_import_quality_report(project_id: int) -> dict[str, Any]:
    root = DATA_ROOT / "imports" / f"project_{project_id}"
    runs: list[dict[str, Any]] = []
    if root.exists():
        for manifest_path in root.rglob("nodex_manifest.json"):
            manifest = read_manifest(manifest_path)
            if not manifest:
                continue
            output = manifest.get("output") if isinstance(manifest.get("output"), dict) else {}
            output_rows = sum(
                int(value or 0)
                for key, value in output.items()
                if str(key).endswith("_rows")
            )
            relative_parts = manifest_path.relative_to(root).parts
            runs.append({
                "batch_id": relative_parts[0] if relative_parts else "",
                "generated_at": str(manifest.get("generated_at_utc") or ""),
                "source_dir": str(manifest.get("input_dir") or ""),
                "manifest_path": str(manifest_path),
                "read_total": _value(manifest, "rows", "read_total"),
                "technical_rows": _value(manifest, "rows", "non_phone_contact_rows"),
                "events_after_dedup": _value(manifest, "rows", "events_after_dedup"),
                "communications_rows": int(output.get("communications_rows") or 0),
                "device_rows": int(output.get("device_history_rows") or 0),
                "location_rows": int(output.get("location_events_rows") or 0),
                "output_rows": output_rows,
            })

    runs.sort(key=lambda item: (item["generated_at"], item["batch_id"], item["manifest_path"]), reverse=True)
    latest_batch = runs[0]["batch_id"] if runs else ""
    latest_runs = [item for item in runs if item["batch_id"] == latest_batch]
    warnings: list[dict[str, Any]] = []
    for item in runs:
        if item["technical_rows"]:
            warnings.append({
                "batch_id": item["batch_id"],
                "generated_at": item["generated_at"],
                "code": "technical_contact",
                "message": "Технические IMS/SIP-значения исключены из связей абонент-абонент.",
                "rows": item["technical_rows"],
            })
        if item["read_total"] and not item["output_rows"]:
            warnings.append({
                "batch_id": item["batch_id"],
                "generated_at": item["generated_at"],
                "code": "no_output",
                "message": "Импортёр прочитал исходные строки, но не сформировал данные проекта.",
                "rows": item["read_total"],
            })

    return {
        "project_id": project_id,
        "summary": {
            "latest_batch": latest_batch or "-",
            "import_runs": len(runs),
            "latest_sources": len(latest_runs),
            "read_total": sum(item["read_total"] for item in latest_runs),
            "communications_rows": sum(item["communications_rows"] for item in latest_runs),
            "technical_rows": sum(item["technical_rows"] for item in latest_runs),
            "events_after_dedup": sum(item["events_after_dedup"] for item in latest_runs),
        },
        "runs": runs,
        "warnings": warnings,
    }
