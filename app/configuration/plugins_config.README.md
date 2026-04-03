# plugins_config.json

Настройки плагинов backend.

## Для `abonent_period_enricher`

Файл: `app/configuration/plugins_config.json`

- `plugins.abonent_period_enricher.connection.url`
  - Полный SQLAlchemy URL (если задан, имеет приоритет над остальными полями).
- `plugins.abonent_period_enricher.connection.db`
  - Параметры для сборки URL:
    - `driver` — например `mssql+pymssql` или `mssql+pyodbc`
    - `host` — адрес SQL Server
    - `instance` — имя инстанса (опционально)
    - `port` — порт (обычно 1433)
    - `database` — имя БД
    - `auth_type` — `sql` или `trusted`
    - `username` / `password` — для `auth_type = sql`
- `plugins.abonent_period_enricher.query.table`
  - Полное имя таблицы, например `[TestData].[dbo].[abonents_list]`

## Приоритеты источников подключения

1. `ABONENTS_DB_URL` (env)
2. `connection.url` (plugins_config.json)
3. `connection.db` (plugins_config.json, сборка URL)

Для имени таблицы:

1. `query.table` (plugins_config.json)
2. `ABONENTS_TABLE` (env)
3. значение по умолчанию `[TestData].[dbo].[abonents_list]`
