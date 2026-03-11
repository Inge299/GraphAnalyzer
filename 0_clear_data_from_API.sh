#!/bin/bash

echo "=== НАЧАЛО ОЧИСТКИ ДАННЫХ ==="

# Получаем список всех проектов
echo "Получение списка проектов..."
PROJECTS=$(curl -s -X GET "http://localhost:5000/api/v1/projects" | jq -r '.[].id')

# Удаляем все проекты (каскадно удалит все артефакты, графы, узлы, ребра)
for PROJECT_ID in $PROJECTS; do
    echo "Удаление проекта ID: $PROJECT_ID"
    curl -s -X DELETE "http://localhost:5000/api/v1/projects/$PROJECT_ID"
done

# Получаем список всех графов (на всякий случай)
echo "Получение списка графов..."
GRAPHS=$(curl -s -X GET "http://localhost:5000/api/v1/graphs" | jq -r '.[].id')

# Удаляем все графы
for GRAPH_ID in $GRAPHS; do
    echo "Удаление графа ID: $GRAPH_ID"
    curl -s -X DELETE "http://localhost:5000/api/v1/graphs/$GRAPH_ID"
done

echo "=== ОЧИСТКА ЗАВЕРШЕНА ==="
