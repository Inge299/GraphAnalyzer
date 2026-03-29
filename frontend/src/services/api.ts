// frontend/src/services/api.ts
import axios from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';

console.log('[API] Initializing with base URL:', API_BASE_URL);

export const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 10000,
});

// Request interceptor for logging
api.interceptors.request.use((config) => {
  console.log(`[API] ➡️ ${config.method?.toUpperCase()} ${config.url}`, config.params || config.data);
  return config;
});

// Response interceptor for logging and error handling
// ВАЖНО: Возвращаем весь response, а не только response.data!
api.interceptors.response.use(
  (response) => {
    console.log(`[API] ⬅️ ${response.config.url} (${response.status})`);
    return response;  // ← ИСПРАВЛЕНО: возвращаем весь response
  },
  (error) => {
    console.error('[API] Error:', error.response?.data || error.message);
    return Promise.reject(error);
  }
);

// Artifact API methods
export const artifactApi = {
  getByProject: (projectId: number) => 
    api.get(`/api/v2/projects/${projectId}/artifacts`).then(res => res.data),
  
  get: (projectId: number, id: number) =>
    api.get(`/api/v2/projects/${projectId}/artifacts/${id}`).then(res => res.data),
  
  create: (projectId: number, artifact: any) =>
    api.post(`/api/v2/projects/${projectId}/artifacts`, artifact).then(res => res.data),
  
  update: (projectId: number, id: number, updates: any) =>
    api.put(`/api/v2/projects/${projectId}/artifacts/${id}`, updates).then(res => res.data),
  
  delete: (projectId: number, id: number) =>
    api.delete(`/api/v2/projects/${projectId}/artifacts/${id}`).then(res => res.data),
  
  getVersions: (projectId: number, id: number) =>
    api.get(`/api/v2/projects/${projectId}/artifacts/${id}/versions`).then(res => res.data),
  
  derive: (projectId: number, id: number, derivation: any) =>
    api.post(`/api/v2/projects/${projectId}/artifacts/${id}/derive`, derivation).then(res => res.data),
  
  getRelations: (projectId: number, id: number) =>
    api.get(`/api/v2/projects/${projectId}/artifacts/${id}/relations`).then(res => res.data),
};

// Legacy APIs
export const graphApi = {
  getNodes: (graphId: number) => api.get(`/api/v1/graphs/${graphId}/nodes`).then(res => res.data),
  getEdges: (graphId: number) => api.get(`/api/v1/graphs/${graphId}/edges`).then(res => res.data),
};

export const projectApi = {
  getAll: () => api.get('/api/v1/projects').then(res => res.data),
  get: (id: number) => api.get(`/api/v1/projects/${id}`).then(res => res.data),
  create: (data: any) => api.post('/api/v1/projects', null, { params: data }).then(res => res.data),
  update: (id: number, data: any) => api.put(`/api/v1/projects/${id}`, data).then(res => res.data),
  delete: (id: number) => api.delete(`/api/v1/projects/${id}`).then(res => res.data),
  getGraphs: (projectId: number) => api.get(`/api/v1/projects/${projectId}/graphs`).then(res => res.data),
};

export const pluginApi = {
  list: () => api.get('/api/v1/plugins').then(res => res.data),
  execute: (pluginId: string, projectId: number, inputArtifactIds: number[], params: any = {}) =>
    api.post(`/api/v1/plugins/${pluginId}/execute`, {
      project_id: projectId,
      input_artifact_ids: inputArtifactIds,
      params
    }).then(res => res.data),
};

export default api;

