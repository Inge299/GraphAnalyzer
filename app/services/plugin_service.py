"""
Service for plugin discovery and execution.
"""
from typing import List, Dict, Any, Optional

from plugins import AVAILABLE_PLUGINS, PluginBase
from app.services.domain_model_service import list_edge_types


class PluginService:
    def _apply_domain_menu_overrides(self, metadata: Dict[str, Any]) -> Dict[str, Any]:
        plugin_id = str(metadata.get("id") or "").strip()
        if not plugin_id:
            return metadata

        edge_types = list_edge_types()
        matching = [
            edge_type
            for edge_type in edge_types
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
            section = str(edge_type.get("context_menu_section") or "Связи").strip() or "Связи"
            updated["menu_path"] = section
            updated["hidden_from_menu"] = False
        else:
            updated["hidden_from_menu"] = True

        updated["menu_order"] = int(edge_type.get("menu_order") or 0)
        updated["edge_type_id"] = str(edge_type.get("id") or "").strip() or None
        return updated

    def list_plugins(self) -> List[Dict[str, Any]]:
        plugins = []
        for plugin_id, cls in AVAILABLE_PLUGINS.items():
            instance = cls()
            plugins.append(self._apply_domain_menu_overrides(instance.to_metadata()))
        return plugins

    def get_plugin(self, plugin_id: str) -> PluginBase:
        if plugin_id not in AVAILABLE_PLUGINS:
            raise KeyError(plugin_id)
        return AVAILABLE_PLUGINS[plugin_id]()

    async def execute(
        self,
        plugin_id: str,
        input_artifacts: List[Dict[str, Any]],
        params: Optional[Dict[str, Any]] = None
    ) -> List[Dict[str, Any]]:
        plugin = self.get_plugin(plugin_id)

        if not await plugin.validate(input_artifacts):
            raise ValueError("Plugin validation failed")

        try:
            return await plugin.execute(input_artifacts, params)
        except NotImplementedError:
            # Legacy fallback: run analyze on a single graph and wrap into document
            if not input_artifacts:
                return []
            graph = input_artifacts[0]
            if hasattr(plugin, "analyze"):
                result = await plugin.analyze(graph.get("data", {}))
                return [
                    {
                        "type": "document",
                        "name": f"{plugin.name} report",
                        "description": "Auto-generated plugin report",
                        "data": {"content": str(result)},
                        "metadata": {"source_plugin": plugin.id}
                    }
                ]
            raise
