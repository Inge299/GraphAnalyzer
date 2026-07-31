# Внешний справочник базовых станций

Справочник БС не является частью базы проектов Nodex. Он должен размещаться в отдельной PostgreSQL-базе или отдельном экземпляре PostgreSQL и иметь таблицу, совместимую с `cell_tower_reference`:

- `mcc`, `mnc`, `lac`, `cid` — ключи БС;
- `latitude`, `longitude` — координаты;
- `address` — адрес (необязательно).

Для быстрых пакетных запросов обязательны индексы:

```sql
CREATE INDEX IF NOT EXISTS ix_cell_towers_lac_cid ON cell_tower_reference (lac, cid);
CREATE INDEX IF NOT EXISTS ix_cell_towers_mcc_mnc_lac_cid ON cell_tower_reference (mcc, mnc, lac, cid);
```

В `.env.open` или `.env.closed` задайте:

```dotenv
CELL_TOWER_REFERENCE_DSN=postgresql://reference_user:password@reference-host:5432/cell_reference
CELL_TOWER_REFERENCE_TABLE=cell_tower_reference
CELL_TOWER_REFERENCE_TIMEOUT_SECONDS=20
```

Плагин «Последовательность локаций» читает события только из проектного хранилища, формирует уникальный набор MCC/MNC/LAC/CID и одним пакетным запросом обращается к внешнему провайдеру. При отсутствии настройки карта остаётся доступна, но события выводятся без координат; данные проекта при этом не дублируются в справочнике.
## Реестр провайдеров данных

Справочник БС подключается как встроенный провайдер `external_postgres_cell_towers`. Его адаптер находится в коде Nodex, а переносимые метаданные находятся в `app/configuration/reference_providers.json` и входят в экспорт метаданных.

В разделе `Администрирование -> Провайдеры данных` можно изменить название, описание, активность и имя таблицы. Строка подключения, пароль и другие секреты не экспортируются и задаются только через `CELL_TOWER_REFERENCE_DSN` на сервере.

Новый исполняемый провайдер добавляется как Python-адаптер с отдельным `id`; после этого его эксплуатационные метаданные регистрируются по тому же контракту.
