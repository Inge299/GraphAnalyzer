"""
Plugins package for OSINT Graph Analyzer.
This directory contains analyzer plugins that can be loaded dynamically.
"""

import importlib
import logging
import pkgutil
from typing import Dict, Type, List, Any, Optional

logger = logging.getLogger(__name__)


class PluginBase:
    """Base class for all plugins."""

    # Stable identifiers
    id: str = "base_plugin"
    name: str = "Base Plugin"
    version: str = "0.1.0"
    description: str = "Base plugin class"

    # UI and routing metadata
    menu_path: str = "Analysis"
    input_types: List[str] = ["graph"]
    output_types: List[str] = ["graph"]
    applicable_to: List[str] = ["graph"]

    # New contract (optional, backward compatible)
    inputs: Dict[str, Any] = {"artifact_types": ["graph"], "selection": {}}
    applicable_when: Dict[str, Any] = {}
    params_schema: List[Dict[str, Any]] = []
    output_strategy: Dict[str, Any] = {
        "mode": "create_new",
        "history_action": "plugin_execute",
    }

    async def execute(self, input_artifacts: List[dict], params: Optional[dict] = None) -> List[dict]:
        """
        Execute plugin logic.

        Returns a list of artifact specs:
        {
            "type": "graph|document|table|map|chart",
            "name": "...",
            "description": "...",
            "data": {...},
            "metadata": {...}
        }
        """
        raise NotImplementedError

    async def analyze(self, graph_data: dict) -> dict:
        """Legacy: analyze graph data."""
        raise NotImplementedError

    async def validate(self, input_artifacts: List[dict]) -> bool:
        """Validate if plugin can process these artifacts."""
        return True

    def _normalized_params_schema(self) -> List[Dict[str, Any]]:
        schema = self.params_schema if isinstance(self.params_schema, list) else []
        normalized: List[Dict[str, Any]] = []
        for item in schema:
            if not isinstance(item, dict):
                continue
            entry = dict(item)
            key = str(entry.get("key") or entry.get("name") or "").strip()
            if not key:
                continue
            entry["key"] = key
            normalized.append(entry)
        return normalized
    def to_metadata(self) -> dict:
        """Serialize plugin metadata for API responses."""
        return {
            "id": self.id or self.name,
            "name": self.name,
            "version": self.version,
            "description": self.description,
            "menu_path": self.menu_path,
            "input_types": self.input_types,
            "output_types": self.output_types,
            "applicable_to": self.applicable_to,
            "inputs": self.inputs,
            "applicable_when": self.applicable_when,
            "params_schema": self._normalized_params_schema(),
            "output_strategy": self.output_strategy,
        }


def _discover_plugin_classes() -> List[Type[PluginBase]]:
    classes: List[Type[PluginBase]] = []

    for finder, name, ispkg in pkgutil.walk_packages(__path__, f"{__name__}."):
        if name.split(".")[-1].startswith("_"):
            continue
        try:
            module = importlib.import_module(name)
            for attr_name in dir(module):
                attr = getattr(module, attr_name)
                if isinstance(attr, type) and issubclass(attr, PluginBase) and attr is not PluginBase:
                    classes.append(attr)
        except Exception as e:
            logger.error(f"Failed to load plugin module {name}: {e}")

    return classes


def discover_plugins() -> Dict[str, Type[PluginBase]]:
    """Discover and load all available plugins."""
    plugins: Dict[str, Type[PluginBase]] = {}

    for cls in _discover_plugin_classes():
        try:
            instance = cls()
            plugin_id = instance.id or instance.name
            plugins[plugin_id] = cls
            logger.info(f"Loaded plugin: {plugin_id} v{instance.version}")
        except Exception as e:
            logger.error(f"Failed to initialize plugin {cls}: {e}")

    return plugins


# Discover plugins when module is imported
AVAILABLE_PLUGINS = discover_plugins()


