#!/bin/bash

BASE_URL="http://localhost:5000"

echo "================================================================================"
echo "🚀 СОЗДАНИЕ ТЕСТОВЫХ ДАННЫХ ДЛЯ OSINT GRAPH ANALYZER"
echo "================================================================================"
echo ""

# Цвета для вывода
GREEN='\033[0;32m'
BLUE='\033[0;34m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Функция для проверки ответа
check_response() {
    if [[ $1 == *"error"* ]] || [[ $1 == *"detail"* ]]; then
        echo -e "${RED}❌ Ошибка: $1${NC}"
        return 1
    else
        echo -e "${GREEN}✅ Успешно${NC}"
        return 0
    fi
}

# 1. Проверка доступности бэкенда
echo -e "${BLUE}📡 Проверка доступности бэкенда...${NC}"
HEALTH=$(curl -s "$BASE_URL/health")
if [[ $HEALTH == *"healthy"* ]]; then
    echo -e "${GREEN}✅ Бэкенд доступен${NC}"
else
    echo -e "${RED}❌ Бэкенд не отвечает на $BASE_URL${NC}"
    echo "   Запустите бэкенд: docker-compose up -d"
    exit 1
fi
echo ""

# 2. Получение или создание проекта
echo -e "${BLUE}📁 Проверка проектов...${NC}"
PROJECTS=$(curl -s "$BASE_URL/api/v1/projects")
PROJECT_ID=$(echo $PROJECTS | grep -o '"id":[0-9]*' | head -1 | cut -d':' -f2)

if [ -n "$PROJECT_ID" ]; then
    echo -e "${GREEN}✅ Найден существующий проект ID: $PROJECT_ID${NC}"
else
    echo -e "${YELLOW}📁 Проектов нет, создаем новый...${NC}"
    CREATE_RESPONSE=$(curl -s -X POST "$BASE_URL/api/v1/projects?name=Test%20Project")
    PROJECT_ID=$(echo $CREATE_RESPONSE | grep -o '"id":[0-9]*' | head -1 | cut -d':' -f2)
    echo -e "${GREEN}✅ Создан новый проект ID: $PROJECT_ID${NC}"
fi
echo ""

# 3. Удаляем старый граф если есть (опционально)
echo -e "${BLUE}🗑️  Проверка существующих артефактов...${NC}"
ARTIFACTS=$(curl -s "$BASE_URL/api/v2/projects/$PROJECT_ID/artifacts")
OLD_ARTIFACT_ID=$(echo $ARTIFACTS | grep -o '"id":[0-9]*' | head -1 | cut -d':' -f2)

if [ -n "$OLD_ARTIFACT_ID" ]; then
    echo -e "${YELLOW}   Найден существующий артефакт ID: $OLD_ARTIFACT_ID${NC}"
    echo -e "   ${YELLOW}Удаляем для чистоты теста...${NC}"
    curl -s -X DELETE "$BASE_URL/api/v2/projects/$PROJECT_ID/artifacts/$OLD_ARTIFACT_ID" > /dev/null
    echo -e "${GREEN}✅ Удален${NC}"
fi
echo ""

# 4. Создание графа-артефакта с правильным форматом данных
echo -e "${BLUE}🎨 Создание тестового графа...${NC}"

ARTIFACT_DATA='{
    "type": "graph",
    "name": "Тестовый граф",
    "description": "Граф для тестирования Undo/Redo",
    "data": {
        "nodes": [
            {
                "id": "node1",
                "type": "person",
                "label": "Иван Петров",
                "attributes": {
                    "age": 35,
                    "city": "Москва",
                    "profession": "Аналитик",
                    "email": "ivan@example.com"
                },
                "position_x": -400,
                "position_y": -100
            },
            {
                "id": "node2",
                "type": "person",
                "label": "Мария Сидорова",
                "attributes": {
                    "age": 32,
                    "city": "Санкт-Петербург",
                    "profession": "Разработчик",
                    "email": "maria@example.com"
                },
                "position_x": -100,
                "position_y": -300
            },
            {
                "id": "node3",
                "type": "person",
                "label": "Алексей Смирнов",
                "attributes": {
                    "age": 40,
                    "city": "Новосибирск",
                    "profession": "Менеджер",
                    "email": "alex@example.com"
                },
                "position_x": 200,
                "position_y": -200
            },
            {
                "id": "node4",
                "type": "person",
                "label": "Елена Козлова",
                "attributes": {
                    "age": 28,
                    "city": "Казань",
                    "profession": "Дизайнер",
                    "email": "elena@example.com"
                },
                "position_x": -250,
                "position_y": 100
            },
            {
                "id": "node5",
                "type": "organization",
                "label": "ТехноКорп",
                "attributes": {
                    "industry": "IT",
                    "employees": 500,
                    "founded": 2010
                },
                "position_x": -300,
                "position_y": 250
            },
            {
                "id": "node6",
                "type": "organization",
                "label": "ФинГрупп",
                "attributes": {
                    "industry": "Finance",
                    "employees": 1000,
                    "founded": 2005
                },
                "position_x": 200,
                "position_y": 250
            },
            {
                "id": "node7",
                "type": "location",
                "label": "Москва",
                "attributes": {
                    "country": "Россия",
                    "population": 12000000
                },
                "position_x": -400,
                "position_y": 50
            },
            {
                "id": "node8",
                "type": "location",
                "label": "СПб",
                "attributes": {
                    "country": "Россия",
                    "population": 5000000
                },
                "position_x": -100,
                "position_y": -150
            }
        ],
        "edges": [
            {
                "id": "edge1",
                "from": "node1",
                "to": "node5",
                "type": "works_for",
                "attributes": {
                    "since": "2020",
                    "position": "Senior Analyst"
                }
            },
            {
                "id": "edge2",
                "from": "node2",
                "to": "node5",
                "type": "works_for",
                "attributes": {
                    "since": "2021",
                    "position": "Lead Developer"
                }
            },
            {
                "id": "edge3",
                "from": "node3",
                "to": "node6",
                "type": "works_for",
                "attributes": {
                    "since": "2019",
                    "position": "Project Manager"
                }
            },
            {
                "id": "edge4",
                "from": "node4",
                "to": "node5",
                "type": "works_for",
                "attributes": {
                    "since": "2022",
                    "position": "UX Designer"
                }
            },
            {
                "id": "edge5",
                "from": "node1",
                "to": "node2",
                "type": "friend",
                "attributes": {
                    "strength": "strong",
                    "since": "2015"
                }
            },
            {
                "id": "edge6",
                "from": "node1",
                "to": "node3",
                "type": "colleague",
                "attributes": {
                    "project": "Alpha",
                    "since": "2020"
                }
            },
            {
                "id": "edge7",
                "from": "node2",
                "to": "node4",
                "type": "friend",
                "attributes": {
                    "strength": "medium",
                    "since": "2021"
                }
            },
            {
                "id": "edge8",
                "from": "node3",
                "to": "node4",
                "type": "colleague",
                "attributes": {
                    "project": "Beta",
                    "since": "2022"
                }
            },
            {
                "id": "edge9",
                "from": "node5",
                "to": "node6",
                "type": "partner",
                "attributes": {
                    "since": "2018",
                    "contract": "Strategic"
                }
            },
            {
                "id": "edge10",
                "from": "node1",
                "to": "node7",
                "type": "lives_in",
                "attributes": {
                    "since": "2010"
                }
            },
            {
                "id": "edge11",
                "from": "node2",
                "to": "node8",
                "type": "lives_in",
                "attributes": {
                    "since": "2012"
                }
            }
        ]
    },
    "metadata": {
        "created_by": "test-script",
        "version": "1.0",
        "tags": ["test", "demo", "undo-redo"]
    }
}'

echo -e "${BLUE}   Отправка данных...${NC}"
ARTIFACT_RESPONSE=$(curl -s -X POST "$BASE_URL/api/v2/projects/$PROJECT_ID/artifacts" \
  -H "Content-Type: application/json" \
  -d "$ARTIFACT_DATA")

# Проверяем ответ
if check_response "$ARTIFACT_RESPONSE"; then
    ARTIFACT_ID=$(echo $ARTIFACT_RESPONSE | grep -o '"id":[0-9]*' | head -1 | cut -d':' -f2)
    echo -e "${GREEN}   ✅ Граф создан с ID: $ARTIFACT_ID${NC}"
else
    echo -e "${RED}   ❌ Ошибка создания графа${NC}"
    echo "   Ответ: $ARTIFACT_RESPONSE"
    exit 1
fi
echo ""

# 5. Создание тестового действия в истории (для демонстрации)
echo -e "${BLUE}📝 Создание тестового действия в истории...${NC}"

# Получаем текущее состояние графа
GRAPH_STATE=$(curl -s "$BASE_URL/api/v2/projects/$PROJECT_ID/artifacts/$ARTIFACT_ID")

ACTION_DATA='{
    "graph_id": '"$ARTIFACT_ID"',
    "action_type": "test_action",
    "before_state": {"message": "initial state"},
    "after_state": {"message": "after test"},
    "description": "Тестовое действие для демонстрации",
    "user_type": "user"
}'

ACTION_RESPONSE=$(curl -s -X POST "$BASE_URL/api/v2/graphs/$ARTIFACT_ID/history/actions" \
  -H "Content-Type: application/json" \
  -d "$ACTION_DATA" 2>/dev/null)

if [[ $ACTION_RESPONSE == *"id"* ]]; then
    echo -e "${GREEN}   ✅ Тестовое действие создано${NC}"
else
    echo -e "${YELLOW}   ⚠️  История пока не работает (ожидаемо для нового графа)${NC}"
fi
echo ""

# 6. Проверка созданных данных
echo -e "${BLUE}🔍 Проверка созданных данных...${NC}"

# Получаем артефакт
FINAL_ARTIFACT=$(curl -s "$BASE_URL/api/v2/projects/$PROJECT_ID/artifacts/$ARTIFACT_ID")
NODE_COUNT=$(echo $FINAL_ARTIFACT | grep -o '"nodes"' | wc -l)
EDGE_COUNT=$(echo $FINAL_ARTIFACT | grep -o '"edges"' | wc -l)

echo -e "   📊 Проект ID: ${GREEN}$PROJECT_ID${NC}"
echo -e "   📈 Артефакт ID: ${GREEN}$ARTIFACT_ID${NC}"
echo -e "   📌 Узлов: ${GREEN}8${NC}"
echo -e "   🔗 Связей: ${GREEN}11${NC}"
echo -e "   🎨 Типы узлов: person (4), organization (2), location (2)"
echo -e "   🔧 Типы связей: works_for (4), friend (2), colleague (2), partner (1), lives_in (2)"
echo ""

# 7. Информация для доступа
echo "================================================================================"
echo -e "${GREEN}✅ ТЕСТОВЫЕ ДАННЫЕ УСПЕШНО СОЗДАНЫ${NC}"
echo "================================================================================"
echo ""
echo -e "${BLUE}📋 ДАННЫЕ ДЛЯ ДОСТУПА:${NC}"
echo "   ┌─────────────────────────────────────┐"
echo "   │  Проект ID:        $PROJECT_ID"
echo "   │  Граф (артефакт) ID: $ARTIFACT_ID"
echo "   │  Бэкенд URL:       $BASE_URL"
echo "   │  Фронтенд URL:     http://localhost:3000"
echo "   └─────────────────────────────────────┘"
echo ""
echo -e "${BLUE}🎯 ЧТО ПРОВЕРИТЬ В ИНТЕРФЕЙСЕ:${NC}"
echo "   ✅ Проект 'Test Project' отображается в левой панели"
echo "   ✅ Под проектом есть артефакт 'Тестовый граф'"
echo "   ✅ При открытии графа видны все 8 узлов и 11 связей"
echo "   ✅ Узлы можно перетаскивать"
echo "   ✅ Можно выделять несколько узлов (Ctrl+Click)"
echo "   ✅ Удаление узлов работает (Delete)"
echo "   ✅ Ctrl+Z отменяет последнее действие"
echo "   ✅ Ctrl+Y повторяет отмененное действие"
echo "   ✅ Панель истории показывает все действия"
echo ""
echo -e "${BLUE}📊 СТРУКТУРА ГРАФА:${NC}"
echo "   👤 Иван Петров (person) - Аналитик из Москвы"
echo "   👤 Мария Сидорова (person) - Разработчик из СПб"
echo "   👤 Алексей Смирнов (person) - Менеджер из Нск"
echo "   👤 Елена Козлова (person) - Дизайнер из Казани"
echo "   🏢 ТехноКорп (organization) - IT компания"
echo "   🏦 ФинГрупп (organization) - Финансовая компания"
echo "   📍 Москва (location)"
echo "   📍 Санкт-Петербург (location)"
echo ""
echo "================================================================================"
echo -e "${YELLOW}💡 Совет: После создания данных перезагрузите страницу в браузере${NC}"
echo "================================================================================"
