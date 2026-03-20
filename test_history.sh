#!/bin/bash
# test_history.sh - скрипт для проверки работы UNDO/REDO

echo "=== Тестирование истории артефакта ==="

# Получаем текущий артефакт
ARTIFACT_ID=3
PROJECT_ID=2

echo "1. Получение текущего состояния артефакта $ARTIFACT_ID..."
curl -s "http://localhost:5000/api/v2/projects/$PROJECT_ID/artifacts/$ARTIFACT_ID" | python3 -m json.tool | head -20

echo ""
echo "2. Получение истории..."
curl -s "http://localhost:5000/api/v2/artifacts/$ARTIFACT_ID/history" | python3 -m json.tool

echo ""
echo "3. Создание тестового действия..."
curl -s -X POST "http://localhost:5000/api/v2/artifacts/$ARTIFACT_ID/history/actions" \
  -H "Content-Type: application/json" \
  -d '{
    "action_type": "test_move",
    "before_state": {"test": "before"},
    "after_state": {"test": "after"},
    "description": "Test move action",
    "user_type": "user"
  }' | python3 -m json.tool

echo ""
echo "4. Проверка UNDO..."
curl -s -X POST "http://localhost:5000/api/v2/artifacts/$ARTIFACT_ID/history/undo" | python3 -m json.tool

echo ""
echo "5. Проверка REDO (если доступен)..."
curl -s -X POST "http://localhost:5000/api/v2/artifacts/$ARTIFACT_ID/history/redo" | python3 -m json.tool

echo ""
echo "=== Тестирование завершено ==="