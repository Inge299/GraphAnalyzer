# SNI traffic plugin (CSV/ZIP)

## What it does

- Input: CSV or ZIP(with CSV) traffic export.
- Output artifacts:
  - `document` with analytical summary.
  - `console` with tabbed tables (overview, top domains/IPs, categories, messengers, VPN, gaps, chronology).

## Runtime architecture

- `app` plugin: `sni_traffic_report` (calls external SNI service).
- External service: `sni` container (`/analyze` endpoint).

## Required path format

The plugin receives a file path visible **inside Docker app container**, for example:

- `/app/data/sni/my_file.csv`
- `/app/data/sni/my_archive.zip`

Both `app` and `sni` containers mount `./data` to `/app/data`.

## Start

```bash
docker compose up -d --build sni app
```

Health check:

```bash
curl http://localhost:8012/health
```

## Plugin params

- `input_path` (required)
- `device_id` (optional override)
- `top_n` (default 25)
- `gap_minutes` (default 180)
- optional custom artifact titles

### UI upload flow

- In plugin modal, for `input_path` there is file picker (`.csv/.zip`) and **Загрузить** button.
- After upload, UI auto-fills `input_path` with container path like:
  `/app/data/plugin_uploads/<project_id>/<timestamp>_<filename>.csv`
- Then run plugin normally.

## Limits

Configured by env:

- `SNI_MAX_INPUT_ROWS`
- `SNI_MAX_CHRONOLOGY_ROWS`
- `SNI_DEFAULT_TOP_N`
