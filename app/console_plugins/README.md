# Console Executor Plugins

Analytical Python modules are console executors: they receive the project, optional graph artifact and current selection, then return console tabs with rows and columns.

## Built-in modules

Modules in `app/console_plugins` are shipped with the application. Filenames starting with `_` are ignored by discovery.

## External modules

In a closed trusted environment, connect a ready `.py` module from **Administration -> Console registry -> Analytical Python plugins -> Connect .py**. The application stores it in `data/console_plugins` and activates it immediately; no restart is required.

Uploading a file with the same name updates that external module. External modules can be removed in the same screen. Built-in modules cannot be deleted through the UI.

## Plugin contract

Each module can expose one or more classes derived from `ConsoleExecutorPlugin`:

- use a stable identifier matching `[a-z][a-z0-9_]{2,63}`;
- define `id`, `name`, `description` and implement `async execute(...)`;
- optionally declare `menu_path`, `menu_order`, `params_schema` and `supports_graph_selection`;
- return the shared console artifact structure with `tabs`, `rows`, `columns` and `result_sets`.

The interface only configures activation, visibility and position in the menu. Plugin code remains in the supplied Python file.