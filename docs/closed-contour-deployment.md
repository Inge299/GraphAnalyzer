# Nodex: запуск в закрытом контуре

## Состав поставки

`docker-compose.closed.yml` запускает Nodex frontend, backend, PostgreSQL,
Redis. Локальная LLM подключается через OpenAI-совместимый endpoint и по умолчанию выключена: для
пилота без подходящего GPU они не требуются.

PostgreSQL является служебной БД Nodex. Внутренний Microsoft SQL Server
подключается после запуска как источник SQL-процедур и не заменяет PostgreSQL.

## Первый запуск

1. Скопируйте `.env.closed.example` в `.env.closed` и укажите адрес внутреннего
   Nominatim.
2. При необходимости укажите `VITE_MAP_TILE_URL` для внутреннего сервера тайлов.
   Nominatim выполняет геокодирование, но не является источником картографической
   подложки.
3. Выполните:

```powershell
docker compose --env-file .env.closed -f docker-compose.closed.yml up -d --build
```

4. Откройте `http://<сервер>:8080` и проверьте `http://<сервер>:8080/health`.

## Подключение SQL Server

После запуска создайте источник данных в администрировании Nodex. Укажите
внутренний адрес SQL Server и отдельную техническую учетную запись с правами
только на нужные таблицы и процедуры. SQL-плагины остаются на стороне SQL
Server, а Nodex хранит только их регистрацию и результаты работы.

## Перенос на изолированный сервер

На машине со сборкой заранее получите базовые образы и соберите поставку:

```powershell
docker compose --env-file .env.closed -f docker-compose.closed.yml build
docker save -o nodex-images.tar nodex/app:pilot nodex/frontend:pilot postgres:15-alpine redis:7-alpine
```

Передайте исходный каталог проекта, `data/`, требуемые Python-плагины и архив
образов. На изолированном сервере загрузите образы командой
`docker load -i nodex-images.tar`, после чего выполните первый запуск.

Данные PostgreSQL и Redis сохраняются в Docker volumes. Для резервного
копирования PostgreSQL используйте `pg_dump` из контейнера PostgreSQL и
архивируйте каталог `data/` с внешними плагинами и справочниками.