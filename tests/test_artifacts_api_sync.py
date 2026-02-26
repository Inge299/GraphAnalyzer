# tests/test_artifacts_api_sync.py
"""
Синхронные тесты для API артефактов.
Не требует настройки asyncio.
"""
from fastapi.testclient import TestClient
from app.main import app
import unittest

class TestArtifactsAPI(unittest.TestCase):
    """Синхронные тесты для API артефактов."""
    
    def setUp(self):
        """Создаем тестовый клиент и проект перед каждым тестом."""
        self.client = TestClient(app)
        
        # Создаем тестовый проект
        response = self.client.post("/api/v1/projects", params={"name": "Test Project"})
        self.assertEqual(response.status_code, 200)
        self.project_id = response.json()["id"]
        print(f"✅ Создан проект с ID: {self.project_id}")
    
    def tearDown(self):
        """Очистка после теста."""
        # Можно удалить тестовые данные если нужно
        pass
    
    def test_1_create_artifact(self):
        """Тест создания артефакта."""
        # Создаем артефакт
        response = self.client.post(
            f"/api/v2/projects/{self.project_id}/artifacts",
            json={
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
        )
        
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertEqual(data["type"], "graph")
        self.assertEqual(data["name"], "Test Graph")
        self.assertEqual(data["version"], 1)
        self.assertIn("id", data)
        
        # Сохраняем ID для следующих тестов
        self.artifact_id = data["id"]
        print(f"✅ Создан артефакт с ID: {self.artifact_id}")
    
    def test_2_list_artifacts(self):
        """Тест списка артефактов."""
        # Создаем несколько артефактов
        for i in range(3):
            self.client.post(
                f"/api/v2/projects/{self.project_id}/artifacts",
                json={
                    "type": "graph",
                    "name": f"Graph {i}",
                    "data": {"nodes": []}
                }
            )
        
        # Получаем список
        response = self.client.get(f"/api/v2/projects/{self.project_id}/artifacts")
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertGreaterEqual(len(data), 3)
        print(f"✅ Получен список из {len(data)} артефактов")
    
    def test_3_get_artifact(self):
        """Тест получения конкретного артефакта."""
        # Сначала создаем артефакт
        create_response = self.client.post(
            f"/api/v2/projects/{self.project_id}/artifacts",
            json={
                "type": "graph",
                "name": "Get Test",
                "data": {"nodes": [{"id": 1}]}
            }
        )
        artifact_id = create_response.json()["id"]
        
        # Получаем его
        response = self.client.get(
            f"/api/v2/projects/{self.project_id}/artifacts/{artifact_id}"
        )
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertEqual(data["name"], "Get Test")
        self.assertEqual(data["data"]["nodes"][0]["id"], 1)
        print(f"✅ Получен артефакт {artifact_id}")
    
    def test_4_update_artifact(self):
        """Тест обновления артефакта."""
        # Создаем артефакт
        create_response = self.client.post(
            f"/api/v2/projects/{self.project_id}/artifacts",
            json={
                "type": "graph",
                "name": "Update Test",
                "data": {"nodes": []}
            }
        )
        artifact_id = create_response.json()["id"]
        
        # Обновляем
        response = self.client.put(
            f"/api/v2/projects/{self.project_id}/artifacts/{artifact_id}",
            json={
                "name": "Updated Name",
                "data": {"nodes": [{"id": 1}]}
            }
        )
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertEqual(data["name"], "Updated Name")
        self.assertEqual(data["version"], 2)
        print(f"✅ Обновлен артефакт {artifact_id} до версии 2")
    
    def test_5_artifact_versions(self):
        """Тест версионирования."""
        # Создаем артефакт
        create_response = self.client.post(
            f"/api/v2/projects/{self.project_id}/artifacts",
            json={
                "type": "graph",
                "name": "Versions Test",
                "data": {"version": 1}
            }
        )
        artifact_id = create_response.json()["id"]
        
        # Обновляем несколько раз
        for i in range(2, 5):
            self.client.put(
                f"/api/v2/projects/{self.project_id}/artifacts/{artifact_id}",
                json={"data": {"version": i}}
            )
        
        # Получаем список версий
        response = self.client.get(
            f"/api/v2/projects/{self.project_id}/artifacts/{artifact_id}/versions"
        )
        self.assertEqual(response.status_code, 200)
        versions = response.json()
        self.assertEqual(len(versions), 4)  # Начальная + 3 обновления
        
        # Проверяем порядок (последняя версия первая)
        self.assertEqual(versions[0]["version"], 4)
        self.assertEqual(versions[0]["data"]["version"], 4)
        print(f"✅ Получено {len(versions)} версий артефакта")
    
    def test_6_artifact_relations(self):
        """Тест связей между артефактами."""
        # Создаем два артефакта
        source_response = self.client.post(
            f"/api/v2/projects/{self.project_id}/artifacts",
            json={
                "type": "graph",
                "name": "Source",
                "data": {}
            }
        )
        source_id = source_response.json()["id"]
        
        target_response = self.client.post(
            f"/api/v2/projects/{self.project_id}/artifacts",
            json={
                "type": "table",
                "name": "Target",
                "data": {}
            }
        )
        target_id = target_response.json()["id"]
        
        # Создаем связь
        relation_response = self.client.post(
            f"/api/v2/projects/{self.project_id}/artifacts/{source_id}/relations",
            json={
                "target_id": target_id,
                "relation_type": "derived_from"
            }
        )
        self.assertEqual(relation_response.status_code, 200)
        
        # Получаем связи
        get_response = self.client.get(
            f"/api/v2/projects/{self.project_id}/artifacts/{source_id}/relations"
        )
        self.assertEqual(get_response.status_code, 200)
        relations = get_response.json()
        self.assertEqual(len(relations), 1)
        self.assertEqual(relations[0]["target_id"], target_id)
        self.assertEqual(relations[0]["relation_type"], "derived_from")
        print(f"✅ Создана связь {source_id} -> {target_id}")
    
    def test_7_delete_artifact(self):
        """Тест удаления артефакта."""
        # Создаем артефакт
        create_response = self.client.post(
            f"/api/v2/projects/{self.project_id}/artifacts",
            json={
                "type": "graph",
                "name": "Delete Test",
                "data": {}
            }
        )
        artifact_id = create_response.json()["id"]
        
        # Удаляем
        delete_response = self.client.delete(
            f"/api/v2/projects/{self.project_id}/artifacts/{artifact_id}"
        )
        self.assertEqual(delete_response.status_code, 200)
        
        # Проверяем что удалился
        get_response = self.client.get(
            f"/api/v2/projects/{self.project_id}/artifacts/{artifact_id}"
        )
        self.assertEqual(get_response.status_code, 404)
        print(f"✅ Удален артефакт {artifact_id}")

if __name__ == '__main__':
    unittest.main(verbosity=2)