"""Configuration-backed presets for reusable graph analysis plugins."""

from __future__ import annotations

from dataclasses import dataclass
from typing import Any

from plugins import PluginBase
from app.services.plugins_config_service import get_analysis_plugin_presets


@dataclass(frozen=True)
class AnalysisPluginPreset:
    id: str
    base_plugin_id: str
    name: str
    description: str
    menu_path: str
    menu_order: int
    fixed_params: dict[str, Any]


def list_analysis_plugin_presets() -> list[AnalysisPluginPreset]:
    result: list[AnalysisPluginPreset] = []
    for item in get_analysis_plugin_presets():
        preset_id = str(item.get("id") or "").strip()
        base_plugin_id = str(item.get("base_plugin_id") or "").strip()
        if not preset_id or not base_plugin_id:
            continue
        fixed_params = item.get("fixed_params") if isinstance(item.get("fixed_params"), dict) else {}
        result.append(AnalysisPluginPreset(
            id=preset_id,
            base_plugin_id=base_plugin_id,
            name=str(item.get("name") or preset_id).strip() or preset_id,
            description=str(item.get("description") or "").strip(),
            menu_path=str(item.get("menu_path") or "\u0410\u043d\u0430\u043b\u0438\u0437").strip() or "\u0410\u043d\u0430\u043b\u0438\u0437",
            menu_order=int(item.get("menu_order") or 0),
            fixed_params=dict(fixed_params),
        ))
    return result


def get_analysis_plugin_preset(preset_id: str) -> AnalysisPluginPreset | None:
    normalized = str(preset_id or "").strip()
    return next((item for item in list_analysis_plugin_presets() if item.id == normalized), None)


class PresetPlugin(PluginBase):
    """A thin metadata wrapper that fixes selected parameters of a base plugin."""

    def __init__(self, preset: AnalysisPluginPreset, base_plugin: PluginBase) -> None:
        self.preset = preset
        self.base_plugin = base_plugin
        self.id = preset.id
        self.name = preset.name
        self.version = base_plugin.version
        self.description = preset.description or base_plugin.description
        self.menu_path = preset.menu_path
        self.input_types = list(base_plugin.input_types)
        self.output_types = list(base_plugin.output_types)
        self.applicable_to = list(base_plugin.applicable_to)
        self.inputs = dict(base_plugin.inputs)
        self.applicable_when = dict(base_plugin.applicable_when)
        self.output_strategy = dict(base_plugin.output_strategy)
        self.plugin_scope = base_plugin.plugin_scope
        self.domain_requirements = dict(base_plugin.domain_requirements)

    def to_metadata(self) -> dict:
        metadata = dict(self.base_plugin.to_metadata())
        fixed_keys = set(self.preset.fixed_params)
        metadata.update({
            "id": self.id,
            "name": self.name,
            "description": self.description,
            "menu_path": self.menu_path,
            "menu_order": self.preset.menu_order,
            "source": "preset",
            "removable": False,
            "preset_base_plugin_id": self.preset.base_plugin_id,
            "params_schema": [
                item for item in metadata.get("params_schema", [])
                if isinstance(item, dict) and str(item.get("key") or "") not in fixed_keys
            ],
        })
        return metadata

    async def validate(self, input_artifacts: list[dict]) -> bool:
        return await self.base_plugin.validate(input_artifacts)

    async def execute(self, input_artifacts: list[dict], params: dict | None = None) -> list[dict]:
        effective_params = dict(params or {})
        effective_params.update(self.preset.fixed_params)
        return await self.base_plugin.execute(input_artifacts, effective_params)
