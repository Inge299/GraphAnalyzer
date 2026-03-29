"""
Service for plugin discovery and execution.
"""
from typing import List, Dict, Any, Optional

from plugins import AVAILABLE_PLUGINS, PluginBase


class PluginService:
    def list_plugins(self) -> List[Dict[str, Any]]:
        plugins = []
        for plugin_id, cls in AVAILABLE_PLUGINS.items():
            instance = cls()
            plugins.append(instance.to_metadata())
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
