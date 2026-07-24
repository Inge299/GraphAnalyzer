from typing import Any, Dict, Optional

from app.console_plugins import ConsoleExecutorPlugin


class ExampleConsoleExecutor(ConsoleExecutorPlugin):
    id = "example_console_executor"
    name = "Example Console Executor"
    description = "Template for file-based Python console executors."
    supports_graph_selection = True

    async def execute(
        self,
        *,
        project_id: int,
        artifact: Optional[Dict[str, Any]] = None,
        params: Optional[Dict[str, Any]] = None,
        context: Optional[Dict[str, Any]] = None,
    ) -> Dict[str, Any]:
        raise NotImplementedError("Example console executor is a template only")
