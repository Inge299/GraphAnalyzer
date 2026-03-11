#!/bin/bash

echo "=== СОЗДАНИЕ ТЕСТОВЫХ ДАННЫХ ==="

# Цвета для вывода
GREEN='\033[0;32m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Функция для красивого вывода
print_step() {
    echo -e "${BLUE}===${NC} $1 ${BLUE}===${NC}"
}

print_success() {
    echo -e "${GREEN}✅ $1${NC}"
}

# 1. СОЗДАНИЕ ПРОЕКТА
print_step "1. Создание проекта"

PROJECT_RESPONSE=$(curl -s -X POST "http://localhost:5000/api/v1/projects?name=UndoRedoTest")
PROJECT_ID=$(echo $PROJECT_RESPONSE | jq -r '.id')
print_success "Проект создан с ID: $PROJECT_ID"

# 2. СОЗДАНИЕ АРТЕФАКТА (ГРАФА)
print_step "2. Создание артефакта-графа"

ARTIFACT_RESPONSE=$(curl -s -X POST "http://localhost:5000/api/v2/projects/$PROJECT_ID/artifacts" \
  -H "Content-Type: application/json" \
  -d '{
    "type": "graph",
    "name": "Тестовый граф",
    "description": "Граф для проверки undo/redo",
    "data": {
      "nodes": [],
      "edges": []
    },
    "metadata": {
      "source": "тестовые данные",
      "created_by": "agent",
      "purpose": "testing undo/redo"
    }
  }')

ARTIFACT_ID=$(echo $ARTIFACT_RESPONSE | jq -r '.id')
print_success "Артефакт создан с ID: $ARTIFACT_ID (версия 1 - пустой)"

# 3. ДОБАВЛЕНИЕ УЗЛОВ (ВЕРСИЯ 2)
print_step "3. Добавление узлов (версия 2)"

curl -s -X PUT "http://localhost:5000/api/v2/projects/$PROJECT_ID/artifacts/$ARTIFACT_ID" \
  -H "Content-Type: application/json" \
  -d '{
    "data": {
      "nodes": [
        {
          "id": "person1",
          "label": "👤 Алексей Смирнов",
          "type": "person",
          "position_x": 200,
          "position_y": 150,
          "attributes": {
            "name": "Алексей Смирнов",
            "age": 42,
            "email": "alexey@example.com",
            "phone": "+7-915-123-45-67",
            "role": "CEO",
            "skills": ["management", "strategy", "python"]
          }
        },
        {
          "id": "person2",
          "label": "👤 Елена Козлова",
          "type": "person",
          "position_x": 400,
          "position_y": 150,
          "attributes": {
            "name": "Елена Козлова",
            "age": 35,
            "email": "elena@example.com",
            "phone": "+7-916-234-56-78",
            "role": "CTO",
            "skills": ["architecture", "devops", "teamlead"]
          }
        },
        {
          "id": "person3",
          "label": "👤 Дмитрий Волков",
          "type": "person",
          "position_x": 300,
          "position_y": 300,
          "attributes": {
            "name": "Дмитрий Волков",
            "age": 28,
            "email": "dmitry@example.com",
            "phone": "+7-917-345-67-89",
            "role": "Developer",
            "skills": ["react", "typescript", "fastapi"]
          }
        },
        {
          "id": "company1",
          "label": "🏢 ООО ТехноСистемы",
          "type": "company",
          "position_x": 500,
          "position_y": 250,
          "attributes": {
            "name": "ООО ТехноСистемы",
            "inn": "7712345678",
            "industry": "IT",
            "employees": 120,
            "founded": 2015
          }
        },
        {
          "id": "phone1",
          "label": "📞 Офисный телефон",
          "type": "phone",
          "position_x": 100,
          "position_y": 250,
          "attributes": {
            "number": "+7-495-123-45-67",
            "operator": "МТС",
            "location": "Москва"
          }
        }
      ],
      "edges": []
    }
  }' > /dev/null

print_success "Версия 2 создана (5 узлов)"

# 4. ДОБАВЛЕНИЕ РЕБЕР (ВЕРСИЯ 3)
print_step "4. Добавление ребер (версия 3)"

curl -s -X PUT "http://localhost:5000/api/v2/projects/$PROJECT_ID/artifacts/$ARTIFACT_ID" \
  -H "Content-Type: application/json" \
  -d '{
    "data": {
      "nodes": [
        {
          "id": "person1",
          "label": "👤 Алексей Смирнов",
          "type": "person",
          "position_x": 200,
          "position_y": 150,
          "attributes": {"name": "Алексей Смирнов", "age": 42, "role": "CEO"}
        },
        {
          "id": "person2",
          "label": "👤 Елена Козлова",
          "type": "person",
          "position_x": 400,
          "position_y": 150,
          "attributes": {"name": "Елена Козлова", "age": 35, "role": "CTO"}
        },
        {
          "id": "person3",
          "label": "👤 Дмитрий Волков",
          "type": "person",
          "position_x": 300,
          "position_y": 300,
          "attributes": {"name": "Дмитрий Волков", "age": 28, "role": "Developer"}
        },
        {
          "id": "company1",
          "label": "🏢 ООО ТехноСистемы",
          "type": "company",
          "position_x": 500,
          "position_y": 250,
          "attributes": {"name": "ООО ТехноСистемы", "industry": "IT"}
        },
        {
          "id": "phone1",
          "label": "📞 Офисный телефон",
          "type": "phone",
          "position_x": 100,
          "position_y": 250,
          "attributes": {"number": "+7-495-123-45-67"}
        }
      ],
      "edges": [
        {
          "from": "person1",
          "to": "person2",
          "label": "знакомы",
          "attributes": {"since": "2015", "strength": 0.9}
        },
        {
          "from": "person1",
          "to": "person3",
          "label": "руководит",
          "attributes": {"since": "2021", "type": "management"}
        },
        {
          "from": "person2",
          "to": "person3",
          "label": "коллеги",
          "attributes": {"since": "2021", "project": "OSINT"}
        },
        {
          "from": "person1",
          "to": "company1",
          "label": "работает в",
          "attributes": {"position": "CEO", "since": "2018"}
        },
        {
          "from": "person2",
          "to": "company1",
          "label": "работает в",
          "attributes": {"position": "CTO", "since": "2019"}
        },
        {
          "from": "person3",
          "to": "company1",
          "label": "работает в",
          "attributes": {"position": "Developer", "since": "2021"}
        },
        {
          "from": "company1",
          "to": "phone1",
          "label": "использует",
          "attributes": {"purpose": "main", "since": "2020"}
        }
      ]
    }
  }' > /dev/null

print_success "Версия 3 создана (5 узлов + 7 ребер)"

# 5. СОЗДАНИЕ ДОПОЛНИТЕЛЬНЫХ АРТЕФАКТОВ
print_step "5. Создание дополнительных артефактов"

# Документ
DOC_RESPONSE=$(curl -s -X POST "http://localhost:5000/api/v2/projects/$PROJECT_ID/artifacts" \
  -H "Content-Type: application/json" \
  -d '{
    "type": "document",
    "name": "Аналитическая записка",
    "description": "Результаты анализа графа связей",
    "data": {
      "content": "# Анализ графа связей\n\n## Участники\n- **Алексей Смирнов** (CEO) - 42 года, управляет компанией с 2018\n- **Елена Козлова** (CTO) - 35 лет, технический директор\n- **Дмитрий Волков** (Developer) - 28 лет, разработчик\n\n## Компания\nООО ТехноСистемы, IT сектор, 120 сотрудников, основана в 2015\n\n## Связи\n- Алексей и Елена знакомы с 2015 (крепкие связи)\n- Дмитрий работает под руководством Алексея с 2021\n- Все сотрудники работают в одной компании\n\n## Выводы\nУстановлены прочные связи между ключевыми сотрудниками. Рекомендуется дальнейший анализ.",
      "format": "markdown",
      "tags": ["анализ", "компания", "персонал", "отчет"],
      "word_count": 350
    },
    "metadata": {
      "author": "agent",
      "related_graph": $ARTIFACT_ID
    }
  }')
DOC_ID=$(echo $DOC_RESPONSE | jq -r '.id')
print_success "Документ создан с ID: $DOC_ID"

# Таблица
TABLE_RESPONSE=$(curl -s -X POST "http://localhost:5000/api/v2/projects/$PROJECT_ID/artifacts" \
  -H "Content-Type: application/json" \
  -d '{
    "type": "table",
    "name": "Сотрудники компании",
    "description": "Таблица с данными сотрудников",
    "data": {
      "columns": [
        {"key": "id", "label": "ID", "type": "number"},
        {"key": "name", "label": "Имя", "type": "string"},
        {"key": "age", "label": "Возраст", "type": "number"},
        {"key": "role", "label": "Должность", "type": "string"},
        {"key": "email", "label": "Email", "type": "string"},
        {"key": "phone", "label": "Телефон", "type": "string"},
        {"key": "since", "label": "Работает с", "type": "number"}
      ],
      "rows": [
        {"id": 1, "name": "Алексей Смирнов", "age": 42, "role": "CEO", "email": "alexey@example.com", "phone": "+7-915-123-45-67", "since": 2018},
        {"id": 2, "name": "Елена Козлова", "age": 35, "role": "CTO", "email": "elena@example.com", "phone": "+7-916-234-56-78", "since": 2019},
        {"id": 3, "name": "Дмитрий Волков", "age": 28, "role": "Developer", "email": "dmitry@example.com", "phone": "+7-917-345-67-89", "since": 2021}
      ],
      "sortable": true,
      "filterable": true,
      "page_size": 10
    }
  }')
TABLE_ID=$(echo $TABLE_RESPONSE | jq -r '.id')
print_success "Таблица создана с ID: $TABLE_ID"

# 6. СОЗДАНИЕ СВЯЗЕЙ МЕЖДУ АРТЕФАКТАМИ
print_step "6. Создание связей между артефактами"

# Граф -> Документ
curl -s -X POST "http://localhost:5000/api/v2/projects/$PROJECT_ID/artifacts/$ARTIFACT_ID/relations" \
  -H "Content-Type: application/json" \
  -d "{
    \"target_id\": $DOC_ID,
    \"relation_type\": \"references\"
  }" > /dev/null
print_success "Связь: Граф ($ARTIFACT_ID) -> Документ ($DOC_ID)"

# Граф -> Таблица
curl -s -X POST "http://localhost:5000/api/v2/projects/$PROJECT_ID/artifacts/$ARTIFACT_ID/relations" \
  -H "Content-Type: application/json" \
  -d "{
    \"target_id\": $TABLE_ID,
    \"relation_type\": \"attached_to\"
  }" > /dev/null
print_success "Связь: Граф ($ARTIFACT_ID) -> Таблица ($TABLE_ID)"

# Документ -> Таблица
curl -s -X POST "http://localhost:5000/api/v2/projects/$PROJECT_ID/artifacts/$DOC_ID/relations" \
  -H "Content-Type: application/json" \
  -d "{
    \"target_id\": $TABLE_ID,
    \"relation_type\": \"references\"
  }" > /dev/null
print_success "Связь: Документ ($DOC_ID) -> Таблица ($TABLE_ID)"

# 7. ПРОВЕРКА РЕЗУЛЬТАТОВ
print_step "7. Проверка результатов"

echo -e "\n📊 Проект ID $PROJECT_ID:"
curl -s -X GET "http://localhost:5000/api/v1/projects/$PROJECT_ID" | jq '.'

echo -e "\n📦 Артефакты проекта:"
curl -s -X GET "http://localhost:5000/api/v2/projects/$PROJECT_ID/artifacts" | jq 'map({id, type, name, version})'

echo -e "\n📜 Версии графа:"
curl -s -X GET "http://localhost:5000/api/v2/projects/$PROJECT_ID/artifacts/$ARTIFACT_ID/versions" | jq 'map({version, changed_at})'

echo -e "\n🔗 Связи графа:"
curl -s -X GET "http://localhost:5000/api/v2/projects/$PROJECT_ID/artifacts/$ARTIFACT_ID/relations" | jq '.'

echo -e "\n"
print_success "ТЕСТОВЫЕ ДАННЫЕ УСПЕШНО СОЗДАНЫ!"
echo -e "${GREEN}ID графа: $ARTIFACT_ID${NC}"
echo -e "${GREEN}ID документа: $DOC_ID${NC}"
echo -e "${GREEN}ID таблицы: $TABLE_ID${NC}"
