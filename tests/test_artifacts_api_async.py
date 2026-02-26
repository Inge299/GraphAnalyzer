# tests/test_artifacts_api_async.py
"""
Асинхронные тесты для API артефактов.
Использует pytest-asyncio для правильной работы с event loop.
"""
import pytest
from fastapi.testclient import TestClient
from app.main import app
import time

@pytest.mark.asyncio
async def test_1_create_artifact(client):
    """Тест 1: Создание артефакта."""
    print("\n" + "="*50)
    print("ТЕСТ 1: Создание артефакта")
    print("="*50)
    
    # Создаем проект
    response = client.post("/api/v1/projects", params={"name": "Test Project 1"})
    assert response.status_code == 200
    project_id = response.json()["id"]
    print(f"✅ Создан проект с ID: {project_id}")
    
    # Создаем артефакт
    artifact_data = {
        "type": "graph",
        "name": "Test Graph",
        "description": "Test Description",
        "data": {
            "nodes": [
                {"id": "1", "label": "Node 1"},
                {"id": "2", "label": "Node 2"}
            ],
            "edges": [
                {"from": "1", "to": "2", "label": "connects"}
            ]
        },
        "metadata": {"source": "test", "version": "1.0"}
    }
    
    response = client.post(
        f"/api/v2/projects/{project_id}/artifacts",
        json=artifact_data
    )
    
    assert response.status_code == 200
    data = response.json()
    assert data["type"] == "graph"
    assert data["name"] == "Test Graph"
    assert data["version"] == 1
    assert "id" in data
    
    print(f"✅ Создан артефакт с ID: {data['id']}")
    print(f"   Тип: {data['type']}")
    print(f"   Имя: {data['name']}")
    print(f"   Версия: {data['version']}")
    
    # Сохраняем для следующих тестов
    return {"project_id": project_id, "artifact_id": data["id"]}

@pytest.mark.asyncio
async def test_2_list_artifacts(client):
    """Тест 2: Список артефактов."""
    print("\n" + "="*50)
    print("ТЕСТ 2: Список артефактов")
    print("="*50)
    
    # Создаем проект
    response = client.post("/api/v1/projects", params={"name": "Test Project 2"})
    assert response.status_code == 200
    project_id = response.json()["id"]
    print(f"✅ Создан проект с ID: {project_id}")
    
    # Создаем несколько артефактов
    artifact_count = 3
    for i in range(artifact_count):
        response = client.post(
            f"/api/v2/projects/{project_id}/artifacts",
            json={
                "type": "graph",
                "name": f"Graph {i}",
                "data": {"nodes": [], "index": i}
            }
        )
        assert response.status_code == 200
        print(f"  ➕ Создан артефакт {i+1}: {response.json()['id']}")
    
    # Получаем список
    response = client.get(f"/api/v2/projects/{project_id}/artifacts")
    assert response.status_code == 200
    data = response.json()
    
    assert len(data) >= artifact_count
    print(f"✅ Получен список из {len(data)} артефактов")
    for i, artifact in enumerate(data[:3]):
        print(f"   {i+1}. ID: {artifact['id']}, Name: {artifact['name']}")

@pytest.mark.asyncio
async def test_3_get_artifact(client):
    """Тест 3: Получение конкретного артефакта."""
    print("\n" + "="*50)
    print("ТЕСТ 3: Получение конкретного артефакта")
    print("="*50)
    
    # Создаем проект
    response = client.post("/api/v1/projects", params={"name": "Test Project 3"})
    assert response.status_code == 200
    project_id = response.json()["id"]
    print(f"✅ Создан проект с ID: {project_id}")
    
    # Создаем артефакт
    create_response = client.post(
        f"/api/v2/projects/{project_id}/artifacts",
        json={
            "type": "graph",
            "name": "Get Test",
            "data": {"nodes": [{"id": 1, "value": "test"}]}
        }
    )
    assert create_response.status_code == 200
    artifact_id = create_response.json()["id"]
    print(f"✅ Создан артефакт с ID: {artifact_id}")
    
    # Получаем его
    response = client.get(
        f"/api/v2/projects/{project_id}/artifacts/{artifact_id}"
    )
    assert response.status_code == 200
    data = response.json()
    
    assert data["name"] == "Get Test"
    assert data["data"]["nodes"][0]["id"] == 1
    assert data["data"]["nodes"][0]["value"] == "test"
    
    print(f"✅ Получен артефакт {artifact_id}")
    print(f"   Имя: {data['name']}")
    print(f"   Данные: {data['data']}")

@pytest.mark.asyncio
async def test_4_update_artifact(client):
    """Тест 4: Обновление артефакта."""
    print("\n" + "="*50)
    print("ТЕСТ 4: Обновление артефакта")
    print("="*50)
    
    # Создаем проект
    response = client.post("/api/v1/projects", params={"name": "Test Project 4"})
    assert response.status_code == 200
    project_id = response.json()["id"]
    print(f"✅ Создан проект с ID: {project_id}")
    
    # Создаем артефакт
    create_response = client.post(
        f"/api/v2/projects/{project_id}/artifacts",
        json={
            "type": "graph",
            "name": "Update Test",
            "data": {"nodes": [], "version": 1}
        }
    )
    assert create_response.status_code == 200
    artifact_id = create_response.json()["id"]
    print(f"✅ Создан артефакт с ID: {artifact_id}, версия 1")
    
    # Обновляем
    update_data = {
        "name": "Updated Name",
        "data": {"nodes": [{"id": 1}], "version": 2}
    }
    response = client.put(
        f"/api/v2/projects/{project_id}/artifacts/{artifact_id}",
        json=update_data
    )
    assert response.status_code == 200
    data = response.json()
    
    assert data["name"] == "Updated Name"
    assert data["version"] == 2
    assert data["data"]["nodes"][0]["id"] == 1
    
    print(f"✅ Обновлен артефакт {artifact_id}")
    print(f"   Новое имя: {data['name']}")
    print(f"   Новая версия: {data['version']}")

@pytest.mark.asyncio
async def test_5_artifact_versions(client):
    """Тест 5: Версионирование артефакта."""
    print("\n" + "="*50)
    print("ТЕСТ 5: Версионирование артефакта")
    print("="*50)
    
    # Создаем проект
    response = client.post("/api/v1/projects", params={"name": "Test Project 5"})
    assert response.status_code == 200
    project_id = response.json()["id"]
    print(f"✅ Создан проект с ID: {project_id}")
    
    # Создаем артефакт
    create_response = client.post(
        f"/api/v2/projects/{project_id}/artifacts",
        json={
            "type": "graph",
            "name": "Versions Test",
            "data": {"version": 1}
        }
    )
    assert create_response.status_code == 200
    artifact_id = create_response.json()["id"]
    print(f"✅ Создан артефакт с ID: {artifact_id}, версия 1")
    
    # Обновляем несколько раз
    for i in range(2, 5):
        response = client.put(
            f"/api/v2/projects/{project_id}/artifacts/{artifact_id}",
            json={"data": {"version": i}}
        )
        assert response.status_code == 200
        print(f"  🔄 Обновлен до версии {i}")
    
    # Получаем список версий
    response = client.get(
        f"/api/v2/projects/{project_id}/artifacts/{artifact_id}/versions"
    )
    assert response.status_code == 200
    versions = response.json()
    
    assert len(versions) == 4  # Начальная + 3 обновления
    
    # Проверяем порядок (последняя версия первая)
    assert versions[0]["version"] == 4
    assert versions[0]["data"]["version"] == 4
    assert versions[3]["version"] == 1
    assert versions[3]["data"]["version"] == 1
    
    print(f"✅ Получено {len(versions)} версий:")
    for v in versions:
        print(f"   Версия {v['version']}: {v['data']}")

@pytest.mark.asyncio
async def test_6_artifact_relations(client):
    """Тест 6: Связи между артефактами."""
    print("\n" + "="*50)
    print("ТЕСТ 6: Связи между артефактами")
    print("="*50)
    
    # Создаем проект
    response = client.post("/api/v1/projects", params={"name": "Test Project 6"})
    assert response.status_code == 200
    project_id = response.json()["id"]
    print(f"✅ Создан проект с ID: {project_id}")
    
    # Создаем два артефакта
    source_response = client.post(
        f"/api/v2/projects/{project_id}/artifacts",
        json={
            "type": "graph",
            "name": "Source",
            "data": {}
        }
    )
    assert source_response.status_code == 200
    source_id = source_response.json()["id"]
    print(f"✅ Создан исходный артефакт: {source_id}")
    
    target_response = client.post(
        f"/api/v2/projects/{project_id}/artifacts",
        json={
            "type": "table",
            "name": "Target",
            "data": {}
        }
    )
    assert target_response.status_code == 200
    target_id = target_response.json()["id"]
    print(f"✅ Создан целевой артефакт: {target_id}")
    
    # Создаем связь
    relation_response = client.post(
        f"/api/v2/projects/{project_id}/artifacts/{source_id}/relations",
        json={
            "target_id": target_id,
            "relation_type": "derived_from"
        }
    )
    assert relation_response.status_code == 200
    print(f"✅ Создана связь: {source_id} -> {target_id} (derived_from)")
    
    # Получаем связи
    get_response = client.get(
        f"/api/v2/projects/{project_id}/artifacts/{source_id}/relations"
    )
    assert get_response.status_code == 200
    relations = get_response.json()
    
    assert len(relations) == 1
    assert relations[0]["target_id"] == target_id
    assert relations[0]["relation_type"] == "derived_from"
    assert relations[0]["direction"] == "out"
    
    print(f"✅ Получены связи:")
    for rel in relations:
        print(f"   {rel['source_id']} --{rel['relation_type']}--> {rel['target_id']}")

@pytest.mark.asyncio
async def test_7_delete_artifact(client):
    """Тест 7: Удаление артефакта."""
    print("\n" + "="*50)
    print("ТЕСТ 7: Удаление артефакта")
    print("="*50)
    
    # Создаем проект
    response = client.post("/api/v1/projects", params={"name": "Test Project 7"})
    assert response.status_code == 200
    project_id = response.json()["id"]
    print(f"✅ Создан проект с ID: {project_id}")
    
    # Создаем артефакт
    create_response = client.post(
        f"/api/v2/projects/{project_id}/artifacts",
        json={
            "type": "graph",
            "name": "Delete Test",
            "data": {}
        }
    )
    assert create_response.status_code == 200
    artifact_id = create_response.json()["id"]
    print(f"✅ Создан артефакт для удаления: {artifact_id}")
    
    # Удаляем
    delete_response = client.delete(
        f"/api/v2/projects/{project_id}/artifacts/{artifact_id}"
    )
    assert delete_response.status_code == 200
    print(f"✅ Артефакт {artifact_id} удален")
    
    # Проверяем что удалился
    get_response = client.get(
        f"/api/v2/projects/{project_id}/artifacts/{artifact_id}"
    )
    assert get_response.status_code == 404
    print(f"✅ Подтверждено: артефакт {artifact_id} не найден (404)")

@pytest.mark.asyncio
async def test_all_operations_sequence(client):
    """Тест 8: Последовательность всех операций."""
    print("\n" + "="*50)
    print("ТЕСТ 8: Последовательность всех операций")
    print("="*50)
    
    # 1. Создаем проект
    response = client.post("/api/v1/projects", params={"name": "Sequence Test"})
    assert response.status_code == 200
    project_id = response.json()["id"]
    print(f"✅ 1. Создан проект: {project_id}")
    
    # 2. Создаем артефакт
    response = client.post(
        f"/api/v2/projects/{project_id}/artifacts",
        json={
            "type": "graph",
            "name": "Main Graph",
            "data": {"initial": True}
        }
    )
    assert response.status_code == 200
    artifact_id = response.json()["id"]
    print(f"✅ 2. Создан артефакт: {artifact_id}")
    
    # 3. Получаем артефакт
    response = client.get(f"/api/v2/projects/{project_id}/artifacts/{artifact_id}")
    assert response.status_code == 200
    print(f"✅ 3. Получен артефакт")
    
    # 4. Обновляем артефакт
    response = client.put(
        f"/api/v2/projects/{project_id}/artifacts/{artifact_id}",
        json={"name": "Updated Graph", "data": {"updated": True}}
    )
    assert response.status_code == 200
    print(f"✅ 4. Обновлен артефакт")
    
    # 5. Проверяем версии
    response = client.get(
        f"/api/v2/projects/{project_id}/artifacts/{artifact_id}/versions"
    )
    assert response.status_code == 200
    versions = response.json()
    assert len(versions) >= 2
    print(f"✅ 5. Получены версии: {len(versions)} версий")
    
    # 6. Удаляем артефакт
    response = client.delete(
        f"/api/v2/projects/{project_id}/artifacts/{artifact_id}"
    )
    assert response.status_code == 200
    print(f"✅ 6. Удален артефакт")
    
    print("\n" + "="*50)
    print("🎉 ВСЕ ОПЕРАЦИИ ВЫПОЛНЕНЫ УСПЕШНО!")
    print("="*50)

if __name__ == "__main__":
    print("Запускайте этот файл через pytest: pytest tests/test_artifacts_api_async.py -v -s")