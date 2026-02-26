# tests/test_artifacts_api_unittest.py
"""
Тесты для API артефактов (с использованием unittest).
"""
import unittest
import sys
import os
import json

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from fastapi.testclient import TestClient
from app.main import app

class TestArtifactsAPI(unittest.TestCase):
    """Тесты для API артефактов."""
    
    def setUp(self):
        """Настройка перед каждым тестом."""
        self.client = TestClient(app)
        
        # Создаем тестовый проект
        response = self.client.post("/api/v1/projects", params={"name": "Test Project"})
        self.assertEqual(response.status_code, 200)
        self.project_id = response.json()["id"]
    
    def test_1_create_artifact(self):
        """Тест создания артефакта."""
        response = self.client.post(
            f"/api/v2/projects/{self.project_id}/artifacts",
            json={
                "type": "graph",
                "name": "Test Graph",
                "description": "Test Description",
                "data": {"nodes": [], "edges": []},
                "metadata": {"source": "test"}
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

if __name__ == '__main__':
    unittest.main(verbosity=2)