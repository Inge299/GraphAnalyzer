# Python Import Plugins

Custom project-data importers live in this package. A module is discovered
automatically on backend startup when its filename does not start with `_`.

## Stable SDK

Import plugin code should depend only on `app.import_plugin_sdk`, not on API
routes, database models, or internal services:

```python
from app.import_plugin_sdk import (
    ProjectDataImportExecutionResult,
    ProjectDataImportPlugin,
)
```

Each plugin class must declare:

- stable `id` matching `[a-z][a-z0-9_]{2,63}`;
- semantic `version`;
- `name`, `description`, `extensions`, and `recognition_hint`;
- optional JSON-Schema-like `config_schema`;
- `recognize_file(source_dir, input_file)`;
- `run(source_dir, output_dir)`.

The `_example.py` module is a template and is ignored by discovery.

## Execution Contract

The plugin must return `ProjectDataImportExecutionResult`. All generated files
must stay inside the supplied `output_dir`. The platform validates the result
before previewing or inserting anything into the database.

Required canonical outputs:

- `communications.csv`
- `device_history.csv`
- `location_events.csv`
- `ip_bindings.csv`
- `user_msisdn_facts.csv`
- `ip_msisdn_facts.csv`
- `msisdn_device_facts.csv`
- `msisdn_text_facts.csv`
- a JSON manifest

Every CSV must exist and contain the canonical header even when it has no data
rows. The SDK validates file containment, required columns, plugin identity,
SDK version, and JSON manifest structure.

`execute(context)` is the versioned entry point used by the platform.
The default implementation calls legacy-compatible
`run(source_dir, output_dir)`, so existing plugins continue to work.