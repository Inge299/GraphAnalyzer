// frontend/src/services/api.ts
import axios from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';

export const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor for logging
api.interceptors.request.use((config) => {
  console.log(`[API] ${config.method?.toUpperCase()} ${config.url}`, config.data || config.params);
  return config;
});

// Response interceptor for logging and error handling
api.interceptors.response.use(
  (response) => {
    console.log(`[API] Response from ${response.config.url}:`, response.status);
    return response.data;
  },
  (error) => {
    console.error('[API] Error:', error.response?.data || error.message);
    return Promise.reject(error.response?.data || error.message);
  }
);

// Artifact API methods
export const artifactApi = {
  // Базовые CRUD
  getByProject: (projectId: number) => 
    api.get(`/api/v2/projects/${projectId}/artifacts`),
  
  get: (projectId: number, id: number) =>
    api.get(`/api/v2/projects/${projectId}/artifacts/${id}`),
  
  create: (projectId: number, artifact: any) =>
    api.post(`/api/v2/projects/${projectId}/artifacts`, artifact),
  
  update: (projectId: number, id: number, updates: any) =>
    api.put(`/api/v2/projects/${projectId}/artifacts/${id}`, updates),
  
  delete: (projectId: number, id: number) =>
    api.delete(`/api/v2/projects/${projectId}/artifacts/${id}`),
  
  // Специализированные
  getVersions: (projectId: number, id: number) =>
    api.get(`/api/v2/projects/${projectId}/artifacts/${id}/versions`),
  
  derive: (projectId: number, id: number, derivation: any) =>
    api.post(`/api/v2/projects/${projectId}/artifacts/${id}/derive`, derivation),
  
  getRelations: (projectId: number, id: number) =>
    api.get(`/api/v2/projects/${projectId}/artifacts/${id}/relations`),
};

// Legacy APIs (для обратной совместимости)
export const graphApi = {
  getNodes: (graphId: number) => api.get(`/api/v1/graphs/${graphId}/nodes`),
  getEdges: (graphId: number) => api.get(`/api/v1/graphs/${graphId}/edges`),
  // ... остальные методы
};

export const projectApi = {
  getAll: () => api.get('/api/v1/projects'),
  get: (id: number) => api.get(`/api/v1/projects/${id}`),
  create: (data: any) => api.post('/api/v1/projects', data),
  update: (id: number, data: any) => api.put(`/api/v1/projects/${id}`, data),
  delete: (id: number) => api.delete(`/api/v1/projects/${id}`),
  getGraphs: (projectId: number) => api.get(`/api/v1/projects/${projectId}/graphs`),
};

export default api;