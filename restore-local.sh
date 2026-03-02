#!/bin/bash

# Скрипт восстановления из локального бэкапа
# Сохраните как ~/projects/GraphAnalyzer/restore-local.sh

echo "🔄 ВОССТАНОВЛЕНИЕ ИЗ ЛОКАЛЬНОГО БЭКАПА"
echo "========================================"

# 1. Показать доступные бэкапы
echo "📋 Доступные бэкапы:"
ls -lh ~/osint-backups/ | grep -E "code_.*\.tar\.gz|db_.*\.sql|env_.*\.backup|volume_.*\.tar\.gz"
echo ""

# 2. Запросить дату бэкапа
read -p "Введите дату бэкапа (YYYYMMDD_HHMMSS): " BACKUP_DATE

# 3. Проверить что бэкап существует
if [ ! -f ~/osint-backups/code_${BACKUP_DATE}.tar.gz ]; then
    echo "❌ Бэкап с датой ${BACKUP_DATE} не найден!"
    exit 1
fi

echo "✅ Найден бэкап: ${BACKUP_DATE}"
echo ""

# 4. Остановить текущие контейнеры
echo "🛑 Остановка контейнеров..."
cd ~/projects/GraphAnalyzer
docker-compose down -v
echo ""

# 5. Восстановить код проекта
echo "📁 Восстановление кода проекта..."
# Создать резервную копию текущего кода (на всякий случай)
mv ~/projects/GraphAnalyzer ~/projects/GraphAnalyzer_old_$(date +"%Y%m%d_%H%M%S") 2>/dev/null
mkdir -p ~/projects/GraphAnalyzer
cd ~/projects/GraphAnalyzer

# Распаковать код из бэкапа
tar -xzf ~/osint-backups/code_${BACKUP_DATE}.tar.gz -C ~/projects/GraphAnalyzer
echo "✅ Код восстановлен"
echo ""

# 6. Восстановить .env файл
echo "🔐 Восстановление .env файла..."
cp ~/osint-backups/env_${BACKUP_DATE}.backup .env
echo "✅ .env восстановлен"
echo ""

# 7. Восстановить пользовательские данные
if [ -f ~/osint-backups/data_${BACKUP_DATE}.tar.gz ]; then
    echo "📂 Восстановление пользовательских данных..."
    tar -xzf ~/osint-backups/data_${BACKUP_DATE}.tar.gz -C ~/projects/GraphAnalyzer
    echo "✅ Данные восстановлены"
else
    echo "⚠️  Файл data_${BACKUP_DATE}.tar.gz не найден, пропускаем"
fi
echo ""

# 8. Восстановить Docker volumes
if [ -f ~/osint-backups/volume_${BACKUP_DATE}.tar.gz ]; then
    echo "💾 Восстановление Docker volumes..."
    # Создать временный контейнер для восстановления volume
    docker run --rm -v postgres_data:/data -v ~/osint-backups:/backup alpine tar xzf /backup/volume_${BACKUP_DATE}.tar.gz -C /data
    echo "✅ Volume восстановлен"
else
    echo "⚠️  Файл volume_${BACKUP_DATE}.tar.gz не найден, пропускаем"
fi
echo ""

# 9. Запустить контейнеры
echo "🚀 Запуск контейнеров..."
docker-compose up -d
echo "✅ Контейнеры запущены"
echo ""

# 10. Восстановить базу данных (если есть дамп)
if [ -f ~/osint-backups/db_${BACKUP_DATE}.sql ]; then
    echo "🛢️  Восстановление базы данных..."
    # Подождать пока PostgreSQL запустится
    sleep 10
    # Восстановить базу
    docker-compose exec -T postgres psql -U osint_user -d osint_db < ~/osint-backups/db_${BACKUP_DATE}.sql
    echo "✅ База данных восстановлена"
else
    echo "⚠️  Файл db_${BACKUP_DATE}.sql не найден, пропускаем"
fi
echo ""

# 11. Проверка
echo "🔍 Проверка восстановления..."
echo "Контейнеры:"
docker-compose ps
echo ""
echo "Health check:"
curl -s http://localhost:5000/health || echo "❌ Health check failed"
echo ""

echo "🎉 ВОССТАНОВЛЕНИЕ ЗАВЕРШЕНО!"
echo "📁 Проект восстановлен в: ~/projects/GraphAnalyzer"
echo "📅 Дата бэкапа: ${BACKUP_DATE}"
