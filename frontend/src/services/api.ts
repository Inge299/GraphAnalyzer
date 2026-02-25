// src/services/api.ts
import { ApiProject, ApiGraph, ApiNode, ApiEdge } from '../types/api';

class ApiClient {
  private baseURL: string;

  constructor() {
    // Используем правильный порт 8000 для бэкенда
    this.baseURL = 'http://localhost:8000';
  }

  async get(endpoint: string): Promise<any> {
    try {
      const response = await fetch(`${this.baseURL}${endpoint}`);
      if (!response.ok) {
        throw new Error(`API Error: ${response.statusText}`);
      }
      return response.json();
    } catch (error) {
      console.warn(`API call failed: ${endpoint}`, error);
      // Возвращаем моковые данные для разработки
      return this.getMockData(endpoint);
    }
  }

  async post(endpoint: string, data: any): Promise<any> {
    try {
      const response = await fetch(`${this.baseURL}${endpoint}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
      });
      if (!response.ok) {
        throw new Error(`API Error: ${response.statusText}`);
      }
      return response.json();
    } catch (error) {
      console.warn(`API post failed: ${endpoint}`, error);
      return { id: Date.now(), ...data };
    }
  }

  async patch(endpoint: string, data: any): Promise<any> {
    try {
      const response = await fetch(`${this.baseURL}${endpoint}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
      });
      if (!response.ok) {
        throw new Error(`API Error: ${response.statusText}`);
      }
      return response.json();
    } catch (error) {
      console.warn(`API patch failed: ${endpoint}`, error);
      return data;
    }
  }

  // Моковые данные для разработки
  private getMockData(endpoint: string): any {
    if (endpoint === '/api/v1/projects') {
      return [
        { id: 1, name: 'Тестовый проект 1', description: 'Описание проекта', created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
        { id: 2, name: 'Тестовый проект 2', description: 'Описание проекта', created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
      ];
    }
    if (endpoint.includes('/graphs')) {
      const projectId = parseInt(endpoint.split('/')[3]);
      return [
        { id: 1, project_id: projectId, name: 'Граф 1', version: 1, created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
        { id: 2, project_id: projectId, name: 'Граф 2', version: 1, created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
      ];
    }
    return [];
  }

  // Graph methods
  async getGraphNodes(graphId: number): Promise<ApiNode[]> {
    return this.get(`/api/v1/graphs/${graphId}/nodes`);
  }

  async getGraphEdges(graphId: number): Promise<ApiEdge[]> {
    return this.get(`/api/v1/graphs/${graphId}/edges`);
  }

  async createNode(graphId: number, node: Partial<ApiNode>): Promise<ApiNode> {
    return this.post(`/api/v1/graphs/${graphId}/nodes`, node);
  }

  async updateNodePosition(graphId: number, nodeId: string, x: number, y: number): Promise<void> {
    return this.patch(`/api/v1/graphs/${graphId}/nodes/${nodeId}`, { position_x: x, position_y: y });
  }
}

export const api = new ApiClient();
