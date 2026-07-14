# sni_traffic_report

`SNI Traffic Report` — система анализа CSV/ZIP выгрузок сетевой активности (SNI/IP/порт/протокол/байты/время) с explainable VPN/proxy/tunnel detection.

## Что делает система

- парсит `.csv` и `.zip` (CSV внутри архива, включая вложенные директории);
- нормализует события в единую модель;
- обогащает события ASN/cloud/category/messenger/IOC;
- детектирует VPN hard+soft правилами с suppression;
- строит аналитические таблицы и markdown-отчёт;
- отдаёт результат через Python API, FastAPI endpoint, CLI и plugin wrapper.

## Поддерживаемые форматы

- `CSV`
- `ZIP` (рекурсивно по членам архива)

## Требования к CSV

- delimiter: `;`
- quotechar: `"`
- кодировки: `utf-8-sig -> cp1251 -> latin-1`
- поддерживаются русские/английские алиасы колонок (время, endpoints, bytes, протоколы, SNI, NAT и пр.)

## Поведение на проблемных входах

- пустой CSV: `200`, событий `0`, warning в `meta.warnings`;
- ZIP без CSV: `400`;
- повреждённый ZIP: `400`;
- refs_dir отсутствует: анализ продолжается с warnings;
- неподдерживаемый формат файла: `400`;
- несуществующий файл: `404`.

## Безопасность ZIP

- архив не извлекается на диск;
- чтение CSV идёт через `ZipFile.open`;
- path traversal члены (`../`, абсолютные пути) игнорируются с warning;
- перезапись локальных файлов невозможна.

## Единый pipeline

```python
from app.analytics import analyze_input

result = analyze_input(
    input_path="tests/fixtures/sample_sorm.csv",
    refs_dir="tests/fixtures/refs",
    top_n=25,
    gap_minutes=180,
)
```

Шаги:
1. `parse_input`
2. `ReferenceLoader(...).load_all()`
3. `enrich_events`
4. `detect_vpn_for_events`
5. `build_analytics`
6. `build_console_tables`
7. `build_markdown_report`

## Конфигурация через env

- `SNI_REFS_DIR`
- `SNI_SERVICE_URL`
- `SNI_MAX_CHRONOLOGY_ROWS`
- `SNI_DEFAULT_TOP_N`
- `SNI_DEFAULT_GAP_MINUTES`
- `SNI_LOG_LEVEL`

## Логирование

Логируются ключевые этапы:
- старт анализа;
- входные CSV/члены ZIP;
- выбранные кодировки;
- количество строк/пропусков;
- загрузка справочников;
- количество VPN hits;
- warnings.

Логи не содержат лишних персональных данных.

## VPN detector

### Hard rules
- `JA3_VPN_SIGNATURE`
- `VPN_INFRA_IP_MATCH`
- `SNI_ASN_MISMATCH` (с cloud/CDN exemption)
- `SELF_SIGNED_CERTIFICATE`
- `CUSTOM_PAIR_MATCH`

### Soft rules
- `MISSING_DNS_QUERY`
- `ALT_DNS_GATEWAY`
- `LONG_KEEPALIVE`
- `HIGH_ENTROPY`
- `RTT_GEO_ANOMALY` (активируется только при наличии geo-ASN данных)

### Suppression
- `TOP_DOMAIN_SUPPRESSION`
- `MESSAGING_SUPPRESSION`
- `CLOUD_DNS_SUPPRESSION`

### Важная оговорка

Alt DNS не равен подтверждённому VPN. Это отдельный сигнал альтернативного доступа.

## Таблицы результата

- overview
- data_quality
- top_domains
- top_ips
- categories
- topics
- protocols
- messengers
- vpn
- vpn_detector
- vpn_detector_hits
- alt_access
- gaps
- chronology
- hours
- days
- references

Пустые секции всегда возвращаются как `[]`.

## FastAPI

Запуск:

```bash
uvicorn app.main:app --host 0.0.0.0 --port 8000
```

Запрос:

```bash
curl -X POST http://localhost:8000/analyze \
  -H "Content-Type: application/json" \
  -d '{
    "input_path": "tests/fixtures/sample_sorm.csv",
    "refs_dir": "tests/fixtures/refs",
    "top_n": 25,
    "gap_minutes": 180,
    "document_title": "Отчёт по SNI-трафику"
  }'
```

## CLI

```bash
python -m sni_traffic_report.app.cli analyze \
  --input sni_traffic_report/tests/fixtures/sample_sorm.csv \
  --refs-dir sni_traffic_report/tests/fixtures/refs \
  --top-n 25 \
  --gap-minutes 180 \
  --out report.md \
  --tables-out tables.json
```

Если `--out` не задан, markdown печатается в stdout.

## Plugin wrapper

```python
from app.plugin import run_plugin

result = run_plugin({
    "input_path": "tests/fixtures/sample_sorm.csv",
    "refs_dir": "tests/fixtures/refs",
})
```

Возвращает:
- `document` artifact;
- `console` artifact;
- `meta`.

При `use_remote_service=True` и заданном `SNI_SERVICE_URL` выполняется `POST {SNI_SERVICE_URL}/analyze`, иначе локальный анализ.

## Nodex integration pack

В репозитории есть готовый пакет интеграции:

- `nodex/plugin.manifest.json`
- `nodex/schemas/plugin-input.schema.json`
- `nodex/schemas/plugin-output.schema.json`
- `nodex/NODEX_INTEGRATION.md`
- `nodex/examples/request.local.json`

Контракт плагина зафиксирован как `plugin_contract_version=1.0.0`.

## Как читать markdown report

Отчёт использует осторожные формулировки:
- «наблюдается активность»;
- «может указывать»;
- «вероятно использовался сервис».

Категоричные выводы о личности не делаются.

## Ограничения

- Точность зависит от полноты телеметрии SNI/DNS/ASN/JA3.
- При частично отсутствующих сигналах выводы вероятностные.
- Хронология в markdown ограничивается `SNI_MAX_CHRONOLOGY_ROWS`; полная хронология остаётся в `tables.chronology`.

## Установка и тесты

```bash
cd sni_traffic_report
pip install -e .[dev]
pytest -q
```

Контейнерный прогон (пример):

```bash
docker compose run --rm -v "E:/Codex projects/SNI-1/sni_traffic_report:/app/sni_traffic_report" sni sh -lc "python -m pip install -q pytest pydantic fastapi 'httpx<0.28' && python -m pytest /app/sni_traffic_report/tests -q"
```
