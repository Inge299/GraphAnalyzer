# Nodex: установка в закрытом контуре (Ubuntu)

Поставка рассчитана на сервер Ubuntu без доступа к Интернету. В каталоге поставки должны находиться `nodex-images.tar`, `nodex-source.zip`, `docker-compose.closed.yml`, `.env.closed.example` и `SHA256SUMS.txt`.

## Требования

- Ubuntu 22.04 LTS или новее;
- Docker Engine и Docker Compose v2 уже установлены на сервере;
- не менее 8 ГБ RAM и 20 ГБ свободного места;
- свободный TCP-порт `8080` либо другой выбранный порт;
- при необходимости — внутренние сервисы геокодирования и картографии.

## 1. Проверка поставки

Скопируйте всю папку поставки на сервер, например в `/opt/nodex-delivery`, и проверьте контрольные суммы:

```bash
cd /opt/nodex-delivery
sha256sum -c SHA256SUMS.txt
```

Все строки должны завершиться `OK`.

## 2. Подготовка приложения

```bash
sudo mkdir -p /opt/nodex
sudo unzip -o /opt/nodex-delivery/nodex-source.zip -d /opt/nodex
sudo cp /opt/nodex-delivery/.env.closed.example /opt/nodex/.env.closed
sudo cp /opt/nodex-delivery/docker-compose.closed.yml /opt/nodex/docker-compose.closed.yml
sudo mkdir -p /opt/nodex/data
sudo chown -R "$USER":"$USER" /opt/nodex
```

Откройте `/opt/nodex/.env.closed` и обязательно задайте уникальные значения:

- `POSTGRES_PASSWORD` — пароль базы данных;
- `SECRET_KEY` — случайная секретная строка;
- `NODEX_PORT` — порт публикации, если `8080` занят.

Для генерации `SECRET_KEY` можно выполнить:

```bash
openssl rand -base64 48
```

Если внутреннего геокодера нет, установите `GEOCODER_ENABLED=false`. Для внутренней картографии выберите `MAP_MODE=local` и задайте доступные в контуре `MAP_*` URL.

## 3. Загрузка образов и первый запуск

```bash
cd /opt/nodex-delivery
docker load -i nodex-images.tar

cd /opt/nodex
docker compose --env-file .env.closed -f docker-compose.closed.yml up -d --no-build
```

`--no-build` обязателен: он использует образы из поставки и исключает обращение к внешним registry.

## 4. Проверка

```bash
cd /opt/nodex
docker compose --env-file .env.closed -f docker-compose.closed.yml ps
curl -fsS http://127.0.0.1:8080/health
```

Откройте `http://<адрес-сервера>:8080` из сети внутреннего контура. При необходимости настройте внутренний reverse proxy и HTTPS.

## Обновление

Перед обновлением сохраните резервную копию БД и каталога `/opt/nodex/data`. Распакуйте переданный архив `nodex-update-*.tar.gz` и выполните:

```bash
tar -xzf nodex-update-*.tar.gz
cd nodex-update-*
sudo NODEX_HOME=/opt/nodex NODEX_IMAGES_TAR=/opt/nodex-delivery/nodex-images.tar bash ./install-update.sh
```

Скрипт сохраняет предыдущие плагины в каталоге `plugins.before-YYYYMMDD-HHMMSS`, заменяет плагины из обновления и перезапускает только `app` и `frontend`. Данные PostgreSQL, Redis и проекта сохраняются.

## Резервное копирование

```bash
cd /opt/nodex
docker compose --env-file .env.closed -f docker-compose.closed.yml exec -T postgres \
  sh -c 'pg_dump -U "$POSTGRES_USER" "$POSTGRES_DB"' > nodex-backup.sql
```

Регулярно архивируйте `nodex-backup.sql` и `/opt/nodex/data` во внутреннее хранилище.
