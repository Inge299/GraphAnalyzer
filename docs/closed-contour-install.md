# Nodex: установка во внутреннем контуре

Эта инструкция рассчитана на сервер без доступа в интернет. В поставке должны быть
`nodex-images.tar`, `nodex-source.zip`, `docker-compose.closed.yml`,
`.env.closed.example` и `SHA256SUMS.txt`.

## 1. Требования

- Docker Engine / Docker Desktop с Docker Compose v2;
- не менее 8 ГБ RAM и 20 ГБ свободного диска для пилота;
- свободный TCP-порт 8080 или другой выбранный порт;
- при необходимости: внутренние серверы геокодирования и картографических тайлов.

## 2. Проверка перед установкой

Скопируйте всю папку поставки на сервер, например в `C:\Nodex-delivery`.
Проверьте контрольные суммы:

```powershell
Set-Location C:\Nodex-delivery
Get-Content .\SHA256SUMS.txt | ForEach-Object {
  $parts = $_ -split '\s{2,}', 2
  $actual = (Get-FileHash -Algorithm SHA256 -LiteralPath $parts[1]).Hash.ToLowerInvariant()
  if ($actual -ne $parts[0]) { throw "Checksum mismatch: $($parts[1])" }
}
```

## 3. Подготовка каталога приложения

```powershell
Expand-Archive .\nodex-source.zip -DestinationPath C:\Nodex -Force
Copy-Item .\.env.closed.example C:\Nodex\.env.closed
Copy-Item .\docker-compose.closed.yml C:\Nodex\docker-compose.closed.yml -Force
New-Item -ItemType Directory -Path C:\Nodex\data -Force
```

Откройте `C:\Nodex\.env.closed` и обязательно задайте:

- `POSTGRES_PASSWORD` — уникальный пароль БД;
- `SECRET_KEY` — уникальное случайное значение;
- `NODEX_PORT` — порт публикации, если 8080 занят;
- `GEOCODER_ENABLED=false`, если внутренний Nominatim не предусмотрен;
- `MAP_MODE=local` и внутренние `MAP_*` URL, если используется внутренняя карта.

Для генерации значения `SECRET_KEY` можно выполнить:

```powershell
[Convert]::ToBase64String((1..48 | ForEach-Object { Get-Random -Maximum 256 }))
```

## 4. Загрузка образов и первый запуск

```powershell
Set-Location C:\Nodex-delivery
docker load -i .\nodex-images.tar

Set-Location C:\Nodex
docker compose --env-file .env.closed -f docker-compose.closed.yml up -d --no-build
```

Опция `--no-build` обязательна для изолированного контура: она использует образы,
загруженные из поставки, и не обращается к внешним registries.

## 5. Проверка

```powershell
docker compose --env-file .env.closed -f docker-compose.closed.yml ps
Invoke-WebRequest http://localhost:8080/health -UseBasicParsing
```

Откройте `http://<адрес-сервера>:8080`. При необходимости настройте внутренний
reverse proxy и HTTPS перед предоставлением доступа пользователям.

## 6. Эксплуатация и резервное копирование

Данные PostgreSQL и Redis находятся в Docker volumes, справочники и внешние
плагины — в `C:\Nodex\data` и `C:\Nodex\plugins`.

Резервная копия БД:

```powershell
docker compose --env-file .env.closed -f docker-compose.closed.yml exec -T postgres sh -c 'pg_dump -U "$POSTGRES_USER" "$POSTGRES_DB"' > nodex-backup.sql
```

Также регулярно архивируйте каталог `C:\Nodex\data`. Перед обновлением делайте
резервную копию БД и данных, затем загружайте новый архив образов и запускайте
`docker compose ... up -d --no-build`.
