#!/bin/bash

echo "=== ПОЛНАЯ ОЧИСТКА БАЗЫ ДАННЫХ ==="

# Подключаемся к PostgreSQL и очищаем все таблицы
docker-compose exec -T postgres psql -U osint_user -d osint_db << EOF
-- Отключаем проверку внешних ключей временно
SET session_replication_role = 'replica';

-- Очищаем все таблицы в правильном порядке (сначала зависимые)
TRUNCATE TABLE artifact_relations CASCADE;
TRUNCATE TABLE artifact_versions CASCADE;
TRUNCATE TABLE artifacts CASCADE;
TRUNCATE TABLE edges CASCADE;
TRUNCATE TABLE nodes CASCADE;
TRUNCATE TABLE graphs CASCADE;
TRUNCATE TABLE edge_types CASCADE;
TRUNCATE TABLE node_types CASCADE;
TRUNCATE TABLE project_schemas CASCADE;
TRUNCATE TABLE projects CASCADE;

-- Включаем проверку внешних ключей обратно
SET session_replication_role = 'origin';

-- Проверяем что все таблицы пусты
SELECT 'projects' as table_name, COUNT(*) FROM projects
UNION ALL
SELECT 'artifacts', COUNT(*) FROM artifacts
UNION ALL
SELECT 'graphs', COUNT(*) FROM graphs
UNION ALL
SELECT 'nodes', COUNT(*) FROM nodes
UNION ALL
SELECT 'edges', COUNT(*) FROM edges;
EOF

echo "=== ОЧИСТКА ЗАВЕРШЕНА ==="
