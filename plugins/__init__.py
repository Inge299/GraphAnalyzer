"""
Plugins package for OSINT Graph Analyzer.
This directory contains analyzer plugins that can be loaded dynamically.
"""

import importlib
import importlib.util
import logging
import os
import pkgutil
import re
import sys
from pathlib import Path
from typing import Dict, Type, List, Any, Optional

logger = logging.getLogger(__name__)
EXTERNAL_GRAPH_PLUGIN_DIR = Path(os.getenv("GRAPH_PLUGIN_DIR", "/app/data/graph_plugins"))


class PluginBase:
    """Base class for all plugins."""

    abstract_plugin: bool = False
    id: str = "base_plugin"
    name: str = "Base Plugin"
    version: str = "0.1.0"
    description: str = "Base plugin class"

    menu_path: str = "Analysis"
    input_types: List[str] = ["graph"]
    output_types: List[str] = ["graph"]
    applicable_to: List[str] = ["graph"]

    inputs: Dict[str, Any] = {"artifact_types": ["graph"], "selection": {}}
    applicable_when: Dict[str, Any] = {}
    params_schema: List[Dict[str, Any]] = []
    output_strategy: Dict[str, Any] = {
        "mode": "create_new",
        "history_action": "plugin_execute",
    }
    plugin_scope: str = "context"

    async def execute(self, input_artifacts: List[dict], params: Optional[dict] = None) -> List[dict]:
        raise NotImplementedError

    async def analyze(self, graph_data: dict) -> dict:
        raise NotImplementedError

    async def validate(self, input_artifacts: List[dict]) -> bool:
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
            "plugin_scope": self.plugin_scope,
            "source": str(getattr(self, "_installed_file", "builtin")),
            "removable": bool(getattr(self, "_installed_file", None)),
        }


def _load_graph_plugin_file(path: Path) -> List[Type[PluginBase]]:
    module_name = f"_nodex_graph_plugin_{path.stem}_{path.stat().st_mtime_ns}"
    spec = importlib.util.spec_from_file_location(module_name, path)
    if spec is None or spec.loader is None:
        raise ValueError(f"Cannot create module loader for {path.name}")
    module = importlib.util.module_from_spec(spec)
    sys.modules[module_name] = module
    try:
        spec.loader.exec_module(module)
    except Exception:
        sys.modules.pop(module_name, None)
        raise

    classes: List[Type[PluginBase]] = []
    for attr_name in dir(module):
        attr = getattr(module, attr_name)
        if (
            isinstance(attr, type)
            and issubclass(attr, PluginBase)
            and attr is not PluginBase
            and attr.__module__ == module.__name__
            and not attr_name.startswith("_")
            and not getattr(attr, "abstract_plugin", False)
        ):
            setattr(attr, "_installed_file", str(path.resolve()))
            classes.append(attr)
    return classes


def _discover_plugin_classes() -> List[Type[PluginBase]]:
    classes: List[Type[PluginBase]] = []
    for _, name, _ in pkgutil.walk_packages(__path__, f"{__name__}."):
        if name.split(".")[-1].startswith("_"):
            continue
        try:
            module = importlib.import_module(name)
            for attr_name in dir(module):
                attr = getattr(module, attr_name)
                if (
                    isinstance(attr, type)
                    and issubclass(attr, PluginBase)
                    and attr is not PluginBase
                    and not attr_name.startswith("_")
                    and not getattr(attr, "abstract_plugin", False)
                ):
                    classes.append(attr)
        except Exception as exc:
            logger.error("Failed to load plugin module %s: %s", name, exc)

    EXTERNAL_GRAPH_PLUGIN_DIR.mkdir(parents=True, exist_ok=True)
    for plugin_path in sorted(EXTERNAL_GRAPH_PLUGIN_DIR.glob("*.py")):
        if plugin_path.name.startswith("_"):
            continue
        try:
            classes.extend(_load_graph_plugin_file(plugin_path))
        except Exception as exc:
            logger.error("Failed to load installed graph plugin %s: %s", plugin_path, exc)
    return classes


def discover_plugins() -> Dict[str, Type[PluginBase]]:
    plugins: Dict[str, Type[PluginBase]] = {}
    for cls in _discover_plugin_classes():
        try:
            instance = cls()
            plugin_id = instance.id or instance.name
            if plugin_id in plugins:
                logger.error("Skipping duplicate graph plugin id: %s", plugin_id)
                continue
            plugins[plugin_id] = cls
            logger.info("Loaded plugin: %s v%s", plugin_id, instance.version)
        except Exception as exc:
            logger.error("Failed to initialize plugin %s: %s", cls, exc)
    return plugins


AVAILABLE_PLUGINS = discover_plugins()


def reload_plugins() -> Dict[str, Type[PluginBase]]:
    plugins = discover_plugins()
    AVAILABLE_PLUGINS.clear()
    AVAILABLE_PLUGINS.update(plugins)
    return AVAILABLE_PLUGINS


def install_graph_plugin_file(filename: str, content: bytes, *, overwrite: bool = True) -> List[str]:
    safe_name = Path(filename or "").name
    if safe_name != filename or not safe_name.endswith(".py"):
        raise ValueError("Plugin filename must be a plain .py filename")
    if safe_name.startswith("_") or not re.fullmatch(r"[A-Za-z0-9][A-Za-z0-9_-]{1,63}\.py", safe_name):
        raise ValueError("Plugin filename contains unsupported characters")
    if not content:
        raise ValueError("Plugin file is empty")
    try:
        source = content.decode("utf-8-sig")
    except UnicodeDecodeError as exc:
        raise ValueError("Plugin file must use UTF-8 encoding") from exc
    try:
        compile(source, safe_name, "exec")
    except SyntaxError as exc:
        raise ValueError(f"Python syntax error at line {exc.lineno}: {exc.msg}") from exc

    EXTERNAL_GRAPH_PLUGIN_DIR.mkdir(parents=True, exist_ok=True)
    root = EXTERNAL_GRAPH_PLUGIN_DIR.resolve()
    target = (root / safe_name).resolve()
    if root not in target.parents:
        raise ValueError("Invalid plugin path")
    if target.exists() and not overwrite:
        raise ValueError(f"Plugin file {safe_name} already exists")

    check_path = root / f"_upload_check_{safe_name}"
    try:
        check_path.write_bytes(content)
        classes = _load_graph_plugin_file(check_path)
        if not classes:
            raise ValueError("No PluginBase class found in file")
        plugin_ids: List[str] = []
        for cls in classes:
            instance = cls()
            plugin_id = str(instance.id or "").strip()
            if not re.fullmatch(r"[a-z][a-z0-9_]{2,63}", plugin_id):
                raise ValueError("Plugin id must match [a-z][a-z0-9_]{2,63}")
            if not str(instance.name or "").strip() or not str(instance.description or "").strip():
                raise ValueError(f"Plugin {plugin_id!r} must define name and description")
            if cls.execute is PluginBase.execute:
                raise ValueError(f"Plugin {plugin_id!r} must implement execute(...)")
            existing = AVAILABLE_PLUGINS.get(plugin_id)
            existing_file = getattr(existing, "_installed_file", None) if existing else None
            if existing and (not existing_file or Path(existing_file).resolve() != target):
                raise ValueError(f"Plugin id {plugin_id!r} is already registered")
            if plugin_id in plugin_ids:
                raise ValueError(f"Duplicate plugin id {plugin_id!r} in uploaded file")
            plugin_ids.append(plugin_id)
    finally:
        check_path.unlink(missing_ok=True)

    staging_path = root / f"_{safe_name}.part"
    try:
        staging_path.write_bytes(content)
        staging_path.replace(target)
    finally:
        staging_path.unlink(missing_ok=True)
    reload_plugins()
    return plugin_ids


def delete_graph_plugin_file(plugin_id: str) -> tuple[str, List[str]]:
    cls = AVAILABLE_PLUGINS.get(str(plugin_id or "").strip())
    installed_file = getattr(cls, "_installed_file", None) if cls else None
    if cls is None:
        raise KeyError(f"Graph plugin {plugin_id!r} not found")
    if not installed_file:
        raise ValueError("Built-in graph plugins cannot be deleted")
    path = Path(installed_file).resolve()
    root = EXTERNAL_GRAPH_PLUGIN_DIR.resolve()
    if root not in path.parents:
        raise ValueError("Plugin file is outside the managed directory")
    affected_ids = [
        current_id for current_id, current_cls in AVAILABLE_PLUGINS.items()
        if getattr(current_cls, "_installed_file", None)
        and Path(current_cls._installed_file).resolve() == path
    ]
    path.unlink(missing_ok=True)
    reload_plugins()
    return path.name, affected_ids