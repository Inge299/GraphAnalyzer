from __future__ import annotations

from pathlib import Path
from typing import Any, Dict, Optional

from app.console_plugins import ConsoleExecutorPlugin
from app.console_plugins._graph_analysis_utils import column, tab
from app.services.project_data_import_utils import read_manifest
from app.services.project_data_service import DATA_ROOT


class ImportQualityExecutor(ConsoleExecutorPlugin):
    """Audits preserved import manifests without changing project data."""

    id = "import_quality"
    name = "\u041a\u043e\u043d\u0442\u0440\u043e\u043b\u044c \u043a\u0430\u0447\u0435\u0441\u0442\u0432\u0430 \u0438\u043c\u043f\u043e\u0440\u0442\u0430"
    description = "\u041f\u043e\u043a\u0430\u0437\u044b\u0432\u0430\u0435\u0442 \u043f\u0440\u043e\u0438\u0441\u0445\u043e\u0436\u0434\u0435\u043d\u0438\u0435 \u0434\u0430\u043d\u043d\u044b\u0445, \u0440\u0435\u0437\u0443\u043b\u044c\u0442\u0430\u0442\u044b \u0437\u0430\u043f\u0443\u0441\u043a\u043e\u0432 \u0438 \u043f\u0440\u0435\u0434\u0443\u043f\u0440\u0435\u0436\u0434\u0435\u043d\u0438\u044f \u043a\u0430\u0447\u0435\u0441\u0442\u0432\u0430 \u0438\u043c\u043f\u043e\u0440\u0442\u0430."
    menu_path = "\u0410\u043d\u0430\u043b\u0438\u0437/\u041a\u043e\u043d\u0442\u0440\u043e\u043b\u044c \u0434\u0430\u043d\u043d\u044b\u0445"
    menu_order = 10
    supports_graph_selection = False

    @staticmethod
    def _value(payload: Dict[str, Any], section: str, key: str) -> int:
        section_value = payload.get(section)
        if not isinstance(section_value, dict):
            return 0
        try:
            return int(section_value.get(key) or 0)
        except (TypeError, ValueError):
            return 0

    def _load_runs(self, project_id: int) -> list[dict[str, Any]]:
        root = DATA_ROOT / "imports" / f"project_{project_id}"
        if not root.exists():
            return []

        runs: list[dict[str, Any]] = []
        for manifest_path in sorted(root.rglob("nodex_manifest.json"), reverse=True):
            manifest = read_manifest(manifest_path)
            if not manifest:
                continue
            rows = manifest.get("rows") if isinstance(manifest.get("rows"), dict) else {}
            output = manifest.get("output") if isinstance(manifest.get("output"), dict) else {}
            batch_id = manifest_path.relative_to(root).parts[0] if manifest_path.relative_to(root).parts else ""
            runs.append({
                "batch_id": batch_id,
                "generated_at": str(manifest.get("generated_at_utc") or ""),
                "source_dir": str(manifest.get("input_dir") or ""),
                "manifest_path": str(manifest_path),
                "read_total": self._value(manifest, "rows", "read_total"),
                "valid_start": self._value(manifest, "rows", "with_valid_start"),
                "two_abonents": self._value(manifest, "rows", "with_two_abonents"),
                "technical_rows": self._value(manifest, "rows", "non_phone_contact_rows"),
                "location_only": self._value(manifest, "rows", "location_only_rows"),
                "events_kept": self._value(manifest, "rows", "events_kept"),
                "events_after_dedup": self._value(manifest, "rows", "events_after_dedup"),
                "communications_rows": int(output.get("communications_rows") or 0),
                "device_rows": int(output.get("device_history_rows") or 0),
                "location_rows": int(output.get("location_events_rows") or 0),
            })
        return sorted(runs, key=lambda item: (item["generated_at"], item["batch_id"], item["manifest_path"]), reverse=True)

    async def execute(
        self,
        *,
        project_id: int,
        artifact: Optional[Dict[str, Any]] = None,
        params: Optional[Dict[str, Any]] = None,
        context: Optional[Dict[str, Any]] = None,
    ) -> Dict[str, Any]:
        del artifact, params, context
        runs = self._load_runs(project_id)
        latest_batch = runs[0]["batch_id"] if runs else ""
        latest_runs = [item for item in runs if item["batch_id"] == latest_batch]

        summary_rows = [{
            "latest_batch": latest_batch or "-",
            "import_runs": len(runs),
            "latest_sources": len(latest_runs),
            "read_total": sum(item["read_total"] for item in latest_runs),
            "communications_rows": sum(item["communications_rows"] for item in latest_runs),
            "technical_rows": sum(item["technical_rows"] for item in latest_runs),
            "events_after_dedup": sum(item["events_after_dedup"] for item in latest_runs),
        }]

        warning_rows: list[dict[str, Any]] = []
        for item in runs:
            if item["technical_rows"]:
                warning_rows.append({
                    "batch_id": item["batch_id"],
                    "generated_at": item["generated_at"],
                    "severity": "warning",
                    "code": "technical_contact",
                    "message": "\u0422\u0435\u0445\u043d\u0438\u0447\u0435\u0441\u043a\u0438\u0435 IMS/SIP-\u0437\u043d\u0430\u0447\u0435\u043d\u0438\u044f \u0438\u0441\u043a\u043b\u044e\u0447\u0435\u043d\u044b \u0438\u0437 \u0441\u0432\u044f\u0437\u0435\u0439 \u0430\u0431\u043e\u043d\u0435\u043d\u0442-\u0430\u0431\u043e\u043d\u0435\u043d\u0442.",
                    "rows": item["technical_rows"],
                    "source_dir": item["source_dir"],
                })
            if item["read_total"] and not item["communications_rows"] and not item["location_rows"]:
                warning_rows.append({
                    "batch_id": item["batch_id"],
                    "generated_at": item["generated_at"],
                    "severity": "warning",
                    "code": "no_output",
                    "message": "\u0418\u043c\u043f\u043e\u0440\u0442\u0451\u0440 \u043f\u0440\u043e\u0447\u0438\u0442\u0430\u043b \u0438\u0441\u0445\u043e\u0434\u043d\u044b\u0435 \u0441\u0442\u0440\u043e\u043a\u0438, \u043d\u043e \u043d\u0435 \u0441\u0444\u043e\u0440\u043c\u0438\u0440\u043e\u0432\u0430\u043b \u0434\u0430\u043d\u043d\u044b\u0435 \u043f\u0440\u043e\u0435\u043a\u0442\u0430.",
                    "rows": item["read_total"],
                    "source_dir": item["source_dir"],
                })

        return {
            "profile_id": self.id,
            "profile_name": self.name,
            "tabs": [
                tab("summary", "\u0418\u0442\u043e\u0433", [
                    column("latest_batch", "\u041f\u043e\u0441\u043b\u0435\u0434\u043d\u044f\u044f \u0437\u0430\u0433\u0440\u0443\u0437\u043a\u0430", "string", 180),
                    column("import_runs", "\u0417\u0430\u043f\u0443\u0441\u043a\u043e\u0432 \u0438\u043c\u043f\u043e\u0440\u0442\u0430", "integer", 140),
                    column("latest_sources", "\u0418\u0441\u0442\u043e\u0447\u043d\u0438\u043a\u043e\u0432 \u0432 \u043f\u0430\u043a\u0435\u0442\u0435", "integer", 170),
                    column("read_total", "\u041f\u0440\u043e\u0447\u0438\u0442\u0430\u043d\u043e \u0441\u0442\u0440\u043e\u043a", "integer", 150),
                    column("communications_rows", "\u0421\u0442\u0440\u043e\u043a \u0441\u0432\u044f\u0437\u0435\u0439", "integer", 140),
                    column("technical_rows", "\u0422\u0435\u0445\u043d\u0438\u0447\u0435\u0441\u043a\u0438\u0445 \u0441\u043e\u0431\u044b\u0442\u0438\u0439", "integer", 170),
                    column("events_after_dedup", "\u041f\u043e\u0441\u043b\u0435 \u0434\u0435\u0434\u0443\u043f\u043b\u0438\u043a\u0430\u0446\u0438\u0438", "integer", 160),
                ], summary_rows),
                tab("runs", "\u0417\u0430\u043f\u0443\u0441\u043a\u0438 \u0438 \u043f\u0440\u043e\u0438\u0441\u0445\u043e\u0436\u0434\u0435\u043d\u0438\u0435", [
                    column("generated_at", "\u0412\u0440\u0435\u043c\u044f", "datetime", 180),
                    column("batch_id", "\u041f\u0430\u043a\u0435\u0442", "string", 170),
                    column("source_dir", "\u0418\u0441\u0445\u043e\u0434\u043d\u044b\u0435 \u0444\u0430\u0439\u043b\u044b", "string", 390),
                    column("read_total", "\u041f\u0440\u043e\u0447\u0438\u0442\u0430\u043d\u043e", "integer", 120),
                    column("communications_rows", "\u0421\u0432\u044f\u0437\u0435\u0439", "integer", 110),
                    column("device_rows", "\u0423\u0441\u0442\u0440\u043e\u0439\u0441\u0442\u0432", "integer", 110),
                    column("location_rows", "\u041b\u043e\u043a\u0430\u0446\u0438\u0439", "integer", 110),
                    column("technical_rows", "\u0422\u0435\u0445\u043d\u0438\u0447\u0435\u0441\u043a\u0438\u0445", "integer", 130),
                    column("manifest_path", "\u041c\u0430\u043d\u0438\u0444\u0435\u0441\u0442", "string", 390),
                ], runs),
                tab("warnings", "\u041f\u0440\u0435\u0434\u0443\u043f\u0440\u0435\u0436\u0434\u0435\u043d\u0438\u044f", [
                    column("generated_at", "\u0412\u0440\u0435\u043c\u044f", "datetime", 180),
                    column("batch_id", "\u041f\u0430\u043a\u0435\u0442", "string", 170),
                    column("severity", "\u0423\u0440\u043e\u0432\u0435\u043d\u044c", "string", 110),
                    column("code", "\u041a\u043e\u0434", "string", 160),
                    column("message", "\u0421\u043e\u043e\u0431\u0449\u0435\u043d\u0438\u0435", "string", 430),
                    column("rows", "\u0421\u0442\u0440\u043e\u043a", "integer", 110),
                    column("source_dir", "\u0418\u0441\u0442\u043e\u0447\u043d\u0438\u043a", "string", 390),
                ], warning_rows),
            ],
            "active_tab_id": "summary",
        }