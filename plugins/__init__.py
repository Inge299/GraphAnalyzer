"""
Plugins package for OSINT Graph Analyzer.
This directory contains analyzer plugins that can be loaded dynamically.
"""

import importlib
import pkgutil
import logging
from typing import Dict, Type

logger = logging.getLogger(__name__)

class PluginBase:
    """Base class for all plugins."""

    name: str = "base_plugin"
    version: str = "0.1.0"
    description: str = "Base plugin class"

    async def analyze(self, graph_data: dict) -> dict:
        """Analyze graph data."""
        raise NotImplementedError

    async def validate(self, graph_data: dict) -> bool:
        """Validate if plugin can process this graph."""
        return True

def discover_plugins() -> Dict[str, Type[PluginBase]]:
    """Discover and load all available plugins."""
    plugins = {}

    # Walk through all modules in the plugins package
    for finder, name, ispkg in pkgutil.iter_modules(__path__):
        if name.startswith('_'):
            continue

        try:
            module = importlib.import_module(f'{__name__}.{name}')

            # Find all PluginBase subclasses in the module
            for attr_name in dir(module):
                attr = getattr(module, attr_name)
                if (isinstance(attr, type) and 
                    issubclass(attr, PluginBase) and 
                    attr != PluginBase):
                    plugin_instance = attr()
                    plugins[plugin_instance.name] = attr
                    logger.info(f"Loaded plugin: {plugin_instance.name} v{plugin_instance.version}")
        except Exception as e:
            logger.error(f"Failed to load plugin {name}: {e}")

    return plugins

# Discover plugins when module is imported
AVAILABLE_PLUGINS = discover_plugins()
