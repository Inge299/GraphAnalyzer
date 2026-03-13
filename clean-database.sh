#!/bin/bash

DB_CONTAINER="osint-postgres"
DB_USER="osint_user"
DB_NAME="osint_db"

echo "================================================================================"
echo "🧹 ОЧИСТКА БАЗЫ ДАННЫХ OSINT GRAPH ANALYZER"
echo "================================================================================"
echo ""

# Цвета для вывода
GREEN='\033[0;32m'
BLUE='\033[0;34m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Функция для выполнения SQL запросов
exec_sql() {
    docker exec -i "$DB_CONTAINER" psql -U "$DB_USER" -d "$DB_NAME" -t -c "$1"
}

# Функция для подсчета записей
count_records() {
    local table=$1
    local count=$(exec_sql "SELECT COUNT(*) FROM $table;" | tr -d ' ')
    echo $count
}

# 1. Проверка доступности контейнера
echo -e "${BLUE}📡 Проверка подключения к PostgreSQL...${NC}"
if ! docker ps | grep -q "$DB_CONTAINER"; then
    echo -e "${RED}❌ Контейнер $DB_CONTAINER не запущен${NC}"
    echo "   Запустите: docker-compose up -d"
    exit 1
fi
echo -e "${GREEN}✅ Контейнер доступен${NC}"
echo ""

# 2. Подсчет записей до очистки
echo -e "${BLUE}📊 ТЕКУЩЕЕ СОСТОЯНИЕ БАЗЫ:${NC}"
echo "   ┌─────────────────────────────────────┐"
echo "   │ Таблица              │ Записей      │"
echo "   ├──────────────────────┼──────────────┤"

tables=(
    "graph_actions"
    "artifact_relations"
    "artifact_versions"
    "artifacts"
    "edges"
    "nodes"
    "graphs"
    "edge_types"
    "node_types"
    "project_schemas"
    "projects"
)

for table in "${tables[@]}"; do
    count=$(count_records "$table" 2>/dev/null || echo "0")
    printf "   │ %-20s │ %12s │\n" "$table" "$count"
done
echo "   └─────────────────────────────────────┘"
echo ""

# 3. Запрос подтверждения
echo -e "${RED}⚠️  ВНИМАНИЕ! Это удалит ВСЕ данные из базы!${NC}"
echo -e "${YELLOW}   Будут удалены:${NC}"
echo "   • Все проекты и их схемы"
echo "   • Все артефакты и их версии"
echo "   • Все связи между артефактами"
echo "   • Все графы, узлы и ребра (legacy)"
echo "   • Вся история действий (undo/redo)"
echo ""
read -p "Продолжить? (y/N): " -n 1 -r
echo ""
echo ""

if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo -e "${YELLOW}❌ Очистка отменена${NC}"
    exit 0
fi

# 4. Отключаем внешние ключи временно (для ускорения)
echo -e "${BLUE}🔧 Подготовка к очистке...${NC}"
exec_sql "SET session_replication_role = 'replica';" > /dev/null 2>&1
echo -e "${GREEN}✅ Внешние ключи отключены${NC}"
echo ""

# 5. Очистка таблиц в правильном порядке (с учетом зависимостей)
echo -e "${BLUE}🗑️  ОЧИСТКА ТАБЛИЦ:${NC}"

# Массив таблиц в порядке удаления (сначала зависимые, потом главные)
clean_tables=(
    "graph_actions"
    "artifact_relations"
    "artifact_versions"
    "artifacts"
    "edges"
    "nodes"
    "graphs"
    "edge_types"
    "node_types"
    "project_schemas"
    "projects"
)

for table in "${clean_tables[@]}"; do
    echo -ne "   • $table ... "
    exec_sql "TRUNCATE TABLE $table CASCADE;" > /dev/null 2>&1
    if [ $? -eq 0 ]; then
        echo -e "${GREEN}✅${NC}"
    else
        echo -e "${YELLOW}⚠️  (возможно уже пуста)${NC}"
    fi
done
echo ""

# 6. Включаем внешние ключи обратно
echo -e "${BLUE}🔧 Восстановление внешних ключей...${NC}"
exec_sql "SET session_replication_role = 'origin';" > /dev/null 2>&1
echo -e "${GREEN}✅ Внешние ключи включены${NC}"
echo ""

# 7. Сброс последовательностей (чтобы ID начинались с 1)
echo -e "${BLUE}🔄 Сброс последовательностей...${NC}"

sequences=(
    "projects_id_seq"
    "artifacts_id_seq"
    "graphs_id_seq"
    "nodes_id_seq"
    "edges_id_seq"
)

for seq in "${sequences[@]}"; do
    echo -ne "   • $seq ... "
    exec_sql "ALTER SEQUENCE $seq RESTART WITH 1;" > /dev/null 2>&1
    if [ $? -eq 0 ]; then
        echo -e "${GREEN}✅${NC}"
    else
        echo -e "${YELLOW}⚠️  (последовательность не существует)${NC}"
    fi
done
echo ""

# 8. Проверка результатов очистки
echo -e "${BLUE}📊 СОСТОЯНИЕ ПОСЛЕ ОЧИСТКИ:${NC}"
echo "   ┌─────────────────────────────────────┐"
echo "   │ Таблица              │ Записей      │"
echo "   ├──────────────────────┼──────────────┤"

total=0
for table in "${tables[@]}"; do
    count=$(count_records "$table" 2>/dev/null || echo "0")
    printf "   │ %-20s │ %12s │\n" "$table" "$count"
    total=$((total + count))
done
echo "   └─────────────────────────────────────┘"
echo ""

if [ "$total" -eq 0 ]; then
    echo -e "${GREEN}✅ База данных полностью очищена!${NC}"
else
    echo -e "${YELLOW}⚠️  Осталось записей: $total${NC}"
    echo "   Возможно, некоторые таблицы не были очищены"
fi
echo ""

# 9. Очистка Redis кэша (если используется)
echo -e "${BLUE}📦 Проверка Redis кэша...${NC}"
if docker ps | grep -q "osint-redis"; then
    echo -ne "   • Очистка кэша истории... "
    docker exec osint-redis redis-cli FLUSHALL > /dev/null 2>&1
    echo -e "${GREEN}✅${NC}"
else
    echo -e "${YELLOW}   • Redis не запущен (пропускаем)${NC}"
fi
echo ""

# 10. Итог
echo "================================================================================"
echo -e "${GREEN}✅ ОЧИСТКА ЗАВЕРШЕНА УСПЕШНО${NC}"
echo "================================================================================"
echo ""
echo -e "${BLUE}📋 ЧТО ДАЛЬШЕ:${NC}"
echo "   1. Создайте тестовые данные: ./create-test-data.sh"
echo "   2. Запустите фронтенд: cd frontend && npm run dev"
echo "   3. Откройте браузер: http://localhost:3000"
echo ""
echo "================================================================================"
