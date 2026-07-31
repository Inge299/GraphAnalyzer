from __future__ import annotations

from typing import Any

from app.services.project_data_import_utils import read_manifest
from app.services.project_data_service import DATA_ROOT


def _source_counts(manifest: dict[str, Any]) -> dict[str, int]:
    raw = manifest.get("sources") if isinstance(manifest.get("sources"), dict) else {}
    counts: dict[str, int] = {}
    for name, value in raw.items():
        try:
            counts[str(name)] = max(0, int(value or 0))
        except (TypeError, ValueError):
            continue
    return counts


def get_import_quality_report(project_id: int) -> dict[str, Any]:
    """Return import-run provenance using plugin-neutral normalized source counts."""

    root = DATA_ROOT / "imports" / f"project_{project_id}"
    runs: list[dict[str, Any]] = []
    if root.exists():
        for manifest_path in root.rglob("normalized_import_manifest.json"):
            manifest = read_manifest(manifest_path)
            if not manifest:
                continue
            counts = _source_counts(manifest)
            relative_parts = manifest_path.relative_to(root).parts
            runs.append({
                "batch_id": relative_parts[0] if relative_parts else "",
                "generated_at": str(manifest.get("generated_at_utc") or ""),
                "source_dir": str(manifest.get("input_dir") or ""),
                "manifest_path": str(manifest_path),
                "plugin_id": str(manifest.get("plugin_id") or ""),
                "source_counts": counts,
                "source_rows": sum(counts.values()),
            })

    runs.sort(key=lambda item: (item["generated_at"], item["batch_id"], item["manifest_path"]), reverse=True)
    latest_batch = runs[0]["batch_id"] if runs else ""
    latest_runs = [item for item in runs if item["batch_id"] == latest_batch]
    warnings = [{
        "batch_id": item["batch_id"],
        "generated_at": item["generated_at"],
        "code": "no_normalized_rows",
        "message": "Import plugin did not produce normalized source rows.",
    } for item in runs if not item["source_rows"]]

    return {
        "project_id": project_id,
        "summary": {
            "latest_batch": latest_batch or "-",
            "import_runs": len(runs),
            "latest_sources": len(latest_runs),
            "source_rows": sum(item["source_rows"] for item in latest_runs),
        },
        "runs": runs,
        "warnings": warnings,
    }