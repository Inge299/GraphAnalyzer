"""Console executor plugins package."""

from __future__ import annotations

import importlib
import importlib.util
import logging
import os
import pkgutil
import re
import sys
from pathlib import Path
from typing import Any, Dict, List, Optional, Type

logger = logging.getLogger(__name__)

EXTERNAL_CONSOLE_PLUGIN_DIR = Path(os.getenv("CONSOLE_PLUGIN_DIR", "/app/data/console_plugins"))


class ConsoleExecutorPlugin:
    """Base class for file-based Python console executors."""

    abstract_plugin: bool = False
    id: str = "base_console_executor"
    name: str = "Base Console Executor"
    description: str = "Base Python console executor"
    kind: str = "python_plugin"
    executor_type: str = "python"
    menu_path: str = "Анализ/Служебное"
    menu_order: int = 0
    supports_graph_selection: bool = False
    default_limit: int | None = None
    timeout_seconds: int = 120
    params_schema: List[Dict[str, Any]] = []
    result_sets: List[Dict[str, Any]] = []

    async def execute(
        self,
        *,
        project_id: int,
        artifact: Optional[Dict[str, Any]] = None,
        params: Optional[Dict[str, Any]] = None,
        context: Optional[Dict[str, Any]] = None,
    ) -> Dict[str, Any]:
        raise NotImplementedError

    def to_descriptor(self) -> Dict[str, Any]:
        installed_file = getattr(self, "_installed_file", None)
        return {
            "id": self.id,
            "key": self.id,
            "name": self.name,
            "description": self.description,
            "kind": self.kind,
            "executor_type": self.executor_type,
            "origin": "python_module",
            "menu_path": self.menu_path,
            "menu_order": self.menu_order,
            "hidden_from_menu": False,
            "supports_graph_selection": bool(self.supports_graph_selection),
            "default_limit": self.default_limit,
            "timeout_seconds": self.timeout_seconds,
            "params": list(self.params_schema or []),
            "result_sets": list(self.result_sets or []),
            "is_active": True,
            "is_editable": False,
            "source_key": None,
            "source_name": None,
            "source": str(installed_file or "builtin"),
            "removable": bool(installed_file),
        }


def _load_console_plugin_file(path: Path) -> List[Type[ConsoleExecutorPlugin]]:
    module_name = f"_nodex_console_plugin_{path.stem}_{path.stat().st_mtime_ns}"
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

    classes: List[Type[ConsoleExecutorPlugin]] = []
    for attr_name in dir(module):
        attr = getattr(module, attr_name)
        if (
            isinstance(attr, type)
            and issubclass(attr, ConsoleExecutorPlugin)
            and attr is not ConsoleExecutorPlugin
            and attr.__module__ == module.__name__
            and not attr_name.startswith("_")
            and not getattr(attr, "abstract_plugin", False)
        ):
            setattr(attr, "_installed_file", str(path.resolve()))
            classes.append(attr)
    return classes


def _discover_executor_classes() -> List[Type[ConsoleExecutorPlugin]]:
    classes: List[Type[ConsoleExecutorPlugin]] = []

    for _, name, _ in pkgutil.walk_packages(__path__, f"{__name__}."):
        if name.split(".")[-1].startswith("_"):
            continue
        try:
            module = importlib.import_module(name)
        except Exception as exc:
            logger.error("Failed to load console executor module %s: %s", name, exc)
            continue

        for attr_name in dir(module):
            attr = getattr(module, attr_name)
            if (
                isinstance(attr, type)
                and issubclass(attr, ConsoleExecutorPlugin)
                and attr is not ConsoleExecutorPlugin
                and attr.__module__ == module.__name__
                and not attr_name.startswith("_")
                and not getattr(attr, "abstract_plugin", False)
            ):
                classes.append(attr)

    EXTERNAL_CONSOLE_PLUGIN_DIR.mkdir(parents=True, exist_ok=True)
    for plugin_path in sorted(EXTERNAL_CONSOLE_PLUGIN_DIR.glob("*.py")):
        if plugin_path.name.startswith("_"):
            continue
        try:
            classes.extend(_load_console_plugin_file(plugin_path))
        except Exception as exc:
            logger.error("Failed to load installed console plugin %s: %s", plugin_path, exc)
    return classes


def discover_console_executors() -> Dict[str, Type[ConsoleExecutorPlugin]]:
    executors: Dict[str, Type[ConsoleExecutorPlugin]] = {}
    for cls in _discover_executor_classes():
        try:
            instance = cls()
        except Exception as exc:
            logger.error("Failed to initialize console executor %s: %s", cls, exc)
            continue
        executor_id = str(instance.id or "").strip()
        if not executor_id:
            logger.error("Skipping console executor without id: %s", cls)
            continue
        if executor_id in executors:
            logger.error("Skipping duplicate console executor id: %s", executor_id)
            continue
        executors[executor_id] = cls
    return executors


AVAILABLE_CONSOLE_EXECUTORS = discover_console_executors()


def reload_console_executors() -> Dict[str, Type[ConsoleExecutorPlugin]]:
    executors = discover_console_executors()
    AVAILABLE_CONSOLE_EXECUTORS.clear()
    AVAILABLE_CONSOLE_EXECUTORS.update(executors)
    return AVAILABLE_CONSOLE_EXECUTORS


def install_console_plugin_file(filename: str, content: bytes, *, overwrite: bool = True) -> List[str]:
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

    EXTERNAL_CONSOLE_PLUGIN_DIR.mkdir(parents=True, exist_ok=True)
    root = EXTERNAL_CONSOLE_PLUGIN_DIR.resolve()
    target = (root / safe_name).resolve()
    if root not in target.parents:
        raise ValueError("Invalid plugin path")
    if target.exists() and not overwrite:
        raise ValueError(f"Plugin file {safe_name} already exists")

    check_path = root / f"_upload_check_{safe_name}"
    try:
        check_path.write_bytes(content)
        classes = _load_console_plugin_file(check_path)
        if not classes:
            raise ValueError("No ConsoleExecutorPlugin class found in file")
        plugin_ids: List[str] = []
        for cls in classes:
            instance = cls()
            plugin_id = str(instance.id or "").strip()
            if not re.fullmatch(r"[a-z][a-z0-9_]{2,63}", plugin_id):
                raise ValueError("Plugin id must match [a-z][a-z0-9_]{2,63}")
            if not str(instance.name or "").strip() or not str(instance.description or "").strip():
                raise ValueError(f"Plugin {plugin_id!r} must define name and description")
            if cls.execute is ConsoleExecutorPlugin.execute:
                raise ValueError(f"Plugin {plugin_id!r} must implement execute(...)")
            if plugin_id in plugin_ids:
                raise ValueError(f"Duplicate plugin id {plugin_id!r} in uploaded file")
            existing = AVAILABLE_CONSOLE_EXECUTORS.get(plugin_id)
            existing_file = getattr(existing, "_installed_file", None) if existing else None
            if existing and (not existing_file or Path(existing_file).resolve() != target):
                raise ValueError(f"Plugin id {plugin_id!r} is already registered")
            plugin_ids.append(plugin_id)
    finally:
        check_path.unlink(missing_ok=True)

    staging_path = root / f"_{safe_name}.part"
    try:
        staging_path.write_bytes(content)
        staging_path.replace(target)
    finally:
        staging_path.unlink(missing_ok=True)
    reload_console_executors()
    return plugin_ids


def delete_console_plugin_file(plugin_id: str) -> tuple[str, List[str]]:
    cls = AVAILABLE_CONSOLE_EXECUTORS.get(str(plugin_id or "").strip())
    installed_file = getattr(cls, "_installed_file", None) if cls else None
    if cls is None:
        raise KeyError(f"Python console plugin {plugin_id!r} not found")
    if not installed_file:
        raise ValueError("Built-in console plugins cannot be deleted")
    path = Path(installed_file).resolve()
    root = EXTERNAL_CONSOLE_PLUGIN_DIR.resolve()
    if root not in path.parents:
        raise ValueError("Plugin file is outside the managed directory")
    affected_ids = [
        executor_id
        for executor_id, executor_cls in AVAILABLE_CONSOLE_EXECUTORS.items()
        if getattr(executor_cls, "_installed_file", None)
        and Path(executor_cls._installed_file).resolve() == path
    ]
    path.unlink(missing_ok=True)
    reload_console_executors()
    return path.name, affected_ids