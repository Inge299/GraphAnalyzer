#!/bin/bash

BACKUP_DIR="backups"
DATE=$(date +"%Y%m%d_%H%M%S")
mkdir -p $BACKUP_DIR

echo "📦 ПОЛНЫЙ БЭКАП СИСТЕМЫ $DATE"

# 1. База данных
echo "🛢️  Бэкап PostgreSQL..."
docker-compose exec -T postgres pg_dump -U osint_user osint_db | gzip > ${BACKUP_DIR}/db_${DATE}.sql.gz

# 2. Docker volumes
echo "💾 Бэкап Docker volumes..."
docker run --rm -v postgres_data:/data -v $(pwd)/${BACKUP_DIR}:/backup alpine tar czf /backup/volume_postgres_${DATE}.tar.gz -C /data .
docker run --rm -v redis_data:/data -v $(pwd)/${BACKUP_DIR}:/backup alpine tar czf /backup/volume_redis_${DATE}.tar.gz -C /data . 2>/dev/null || true

# 3. .env и конфиги
echo "🔐 Бэкап конфигураций..."
cp .env ${BACKUP_DIR}/env_${DATE}.backup
cp docker-compose.yml ${BACKUP_DIR}/docker-compose_${DATE}.yml

# 4. Список зависимостей
echo "📋 Бэкап зависимостей..."
pip freeze > ${BACKUP_DIR}/requirements_${DATE}.txt
npm list --depth=0 > ${BACKUP_DIR}/npm-deps_${DATE}.txt 2>/dev/null || true

# 5. Данные пользователя
echo "📁 Бэкап пользовательских данных..."
tar -czf ${BACKUP_DIR}/data_${DATE}.tar.gz data/ 2>/dev/null || echo "Нет данных в data/"

# 6. Информация о системе
echo "ℹ️  Информация о системе..."
{
    echo "Дата: $(date)"
    echo "Git commit: $(git rev-parse HEAD 2>/dev/null || echo 'не git')"
    echo "Docker version: $(docker --version)"
    echo "Docker Compose version: $(docker-compose --version)"
    docker images | grep graphanalyzer
} > ${BACKUP_DIR}/system_info_${DATE}.txt

# 7. Очистка старых бэкапов (оставить 5 последних)
echo "🧹 Очистка старых бэкапов..."
ls -t ${BACKUP_DIR}/db_*.sql.gz 2>/dev/null | tail -n +6 | xargs -r rm
ls -t ${BACKUP_DIR}/*.tar.gz 2>/dev/null | tail -n +6 | xargs -r rm

# 8. Подсчёт размера
echo "📊 Размер бэкапа:"
du -sh ${BACKUP_DIR}/

# 9. Создать контрольную сумму
cd ${BACKUP_DIR}
sha256sum * > checksums_${DATE}.txt
cd ..

echo "✅ ПОЛНЫЙ БЭКАП ЗАВЕРШЕН!"
echo "📁 Бэкап сохранён в: ${BACKUP_DIR}/"
ls -lh ${BACKUP_DIR}/ | tail -n +2