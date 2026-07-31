"""Service for plugin discovery and execution."""

from typing import List, Dict, Any, Optional

from plugins import AVAILABLE_PLUGINS, PluginBase
from app.services.domain_model_service import list_edge_types
from app.services.plugins_config_service import get_plugin_config
from app.services.analysis_plugin_presets import (
    PresetPlugin,
    get_analysis_plugin_preset,
    list_analysis_plugin_presets,
)


class PluginService:
    def _apply_ui_settings(self, metadata: Dict[str, Any]) -> Dict[str, Any]:
        plugin_id = str(metadata.get("id") or "").strip()
        config = get_plugin_config(plugin_id)
        ui = config.get("ui") if isinstance(config, dict) else {}
        if not isinstance(ui, dict):
            ui = {}
        updated = dict(metadata)
        updated["is_active"] = bool(ui.get("is_active", True))
        updated["hidden_from_menu"] = not bool(ui.get("is_visible", True))
        updated["menu_path"] = str(ui.get("menu_path") or metadata.get("menu_path") or "Analysis").strip()
        try:
            updated["menu_order"] = int(ui.get("menu_order", 0))
        except (TypeError, ValueError):
            updated["menu_order"] = 0
        return updated

    def _apply_domain_menu_overrides(self, metadata: Dict[str, Any]) -> Dict[str, Any]:
        plugin_id = str(metadata.get("id") or "").strip()
        if not plugin_id:
            return metadata

        config = get_plugin_config(plugin_id)
        ui = config.get("ui") if isinstance(config, dict) else {}
        if isinstance(ui, dict) and ui.get("is_visible") is False:
            return metadata

        matching = [
            edge_type for edge_type in list_edge_types()
            if str(edge_type.get("plugin_id") or "").strip() == plugin_id
        ]
        if not matching:
            return metadata

        matching.sort(key=lambda item: int(item.get("menu_order") or 0))
        edge_type = matching[0]
        updated = dict(metadata)
        if edge_type.get("context_menu_label"):
            updated["name"] = str(edge_type["context_menu_label"])
        elif edge_type.get("label"):
            updated["name"] = str(edge_type["label"])
        if edge_type.get("show_in_context_menu"):
            updated["menu_path"] = str(edge_type.get("context_menu_section") or "Links").strip() or "Links"
            updated["hidden_from_menu"] = False
        else:
            updated["hidden_from_menu"] = True
        updated["menu_order"] = int(edge_type.get("menu_order") or 0)
        updated["edge_type_id"] = str(edge_type.get("id") or "").strip() or None
        return updated

    def metadata_for(self, plugin_id: str) -> Dict[str, Any]:
        instance = self.get_plugin(plugin_id)
        return self._apply_domain_menu_overrides(self._apply_ui_settings(instance.to_metadata()))

    def list_plugins(self) -> List[Dict[str, Any]]:
        identifiers = list(AVAILABLE_PLUGINS)
        identifiers.extend(item.id for item in list_analysis_plugin_presets() if item.id not in AVAILABLE_PLUGINS)
        return [self.metadata_for(plugin_id) for plugin_id in identifiers]

    def is_plugin_active(self, plugin_id: str) -> bool:
        return bool(self.metadata_for(plugin_id).get("is_active", True))

    def get_plugin(self, plugin_id: str) -> PluginBase:
        plugin_class = AVAILABLE_PLUGINS.get(plugin_id)
        if plugin_class is not None:
            return plugin_class()
        preset = get_analysis_plugin_preset(plugin_id)
        if preset is None:
            raise KeyError(plugin_id)
        base_class = AVAILABLE_PLUGINS.get(preset.base_plugin_id)
        if base_class is None:
            raise KeyError(f"Base plugin '{preset.base_plugin_id}' for preset '{plugin_id}' not found")
        return PresetPlugin(preset, base_class())

    async def execute(
        self,
        plugin_id: str,
        input_artifacts: List[Dict[str, Any]],
        params: Optional[Dict[str, Any]] = None,
    ) -> List[Dict[str, Any]]:
        plugin = self.get_plugin(plugin_id)
        if not await plugin.validate(input_artifacts):
            raise ValueError("Plugin validation failed")
        try:
            return await plugin.execute(input_artifacts, params)
        except NotImplementedError:
            if not input_artifacts:
                return []
            graph = input_artifacts[0]
            if hasattr(plugin, "analyze"):
                result = await plugin.analyze(graph.get("data", {}))
                return [{
                    "type": "document",
                    "name": f"{plugin.name} report",
                    "description": "Auto-generated plugin report",
                    "data": {"content": str(result)},
                    "metadata": {"source_plugin": plugin.id},
                }]
            raise