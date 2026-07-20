// frontend/src/services/api.ts
import axios from 'axios';
import type {
  ApiPluginExecuteResponse,
  PluginArtifactDataOverride,
  CellTowerReferenceEnrichResponse,
  CellTowerReferenceLoadResponse,
  CellTowerReferenceStats,
  ConsoleDataSource,
  ConsoleDataSourcesResponse,
  ConsoleDataSourceTestResponse,
  ConsoleObjectTypeMappingsResponse,
  ConsoleProfilesResponse,
  ConsoleProfile,
  ConsoleRefreshResponse,
  PluginApplicableResponse,
  PluginExecutionContext,
  PluginListResponse,
  PluginUploadInputResponse,
  ProjectDataClearResponse,
  ProjectDataLoadResponse,
  ProjectDataStats,
} from '../types/api';
import { layoutConfig } from '../config/layout';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';

console.log('[API] Initializing with base URL:', API_BASE_URL);

export const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: layoutConfig.network.apiDefaultTimeoutMs,
});

// Request interceptor for logging
api.interceptors.request.use((config) => {
  console.log(`[API] -> ${config.method?.toUpperCase()} ${config.url}`, config.params || config.data);
  return config;
});

// Response interceptor for logging and error handling
api.interceptors.response.use(
  (response) => {
    console.log(`[API] <- ${response.config.url} (${response.status})`);
    return response;
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
  list: () => api.get<PluginListResponse>('/api/v1/plugins').then(res => res.data),
  applicable: (
    projectId: number,
    artifactId: number,
    context: PluginExecutionContext = {},
    artifactDataOverride?: PluginArtifactDataOverride,
  ) =>
    api.post<PluginApplicableResponse>('/api/v1/plugins/applicable', {
      project_id: projectId,
      artifact_id: artifactId,
      context,
      artifact_data_override: artifactDataOverride ?? undefined,
    }).then(res => res.data),
  execute: (
    pluginId: string,
    projectId: number,
    inputArtifactIds: number[],
    params: Record<string, any> = {},
    context: PluginExecutionContext = {},
    artifactDataOverride?: PluginArtifactDataOverride,
  ) =>
    api.post<ApiPluginExecuteResponse>(`/api/v1/plugins/${pluginId}/execute`, {
      project_id: projectId,
      input_artifact_ids: inputArtifactIds,
      params,
      context,
      artifact_data_override: artifactDataOverride ?? undefined,
    }, { timeout: 300000 }).then(res => res.data),
  uploadInput: (projectId: number, file: File) => {
    const formData = new FormData();
    formData.append('project_id', String(projectId));
    formData.append('file', file, file.name);
    return api.post<PluginUploadInputResponse>('/api/v1/plugins/upload-input', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
      timeout: 600000,
    }).then(res => res.data);
  },
};

export const projectDataApi = {
  load: (projectId: number, sourcePath: string) =>
    api.post<ProjectDataLoadResponse>(
      `/api/v1/projects/${projectId}/data/load`,
      { source_path: sourcePath },
      { timeout: layoutConfig.network.projectDataLoadTimeoutMs },
    ).then(res => res.data),
  loadFromFiles: (projectId: number, files: File[]) => {
    const formData = new FormData();
    files.forEach((file) => {
      const relativeName = (file as any).webkitRelativePath || file.name;
      formData.append('files', file, relativeName);
    });
    return api.post<ProjectDataLoadResponse>(`/api/v1/projects/${projectId}/data/load-upload`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
      timeout: layoutConfig.network.projectDataLoadTimeoutMs,
    }).then(res => res.data);
  },
  clear: (projectId: number) =>
    api.post<ProjectDataClearResponse>(
      `/api/v1/projects/${projectId}/data/clear`,
      {},
      { timeout: layoutConfig.network.projectDataClearTimeoutMs },
    ).then(res => res.data),
  stats: (projectId: number) =>
    api.get<ProjectDataStats>(
      `/api/v1/projects/${projectId}/data/stats`,
      { timeout: layoutConfig.network.projectDataStatsTimeoutMs },
    ).then(res => res.data),
  loadCellTowers: (sourcePath: string) =>
    api.post<CellTowerReferenceLoadResponse>(
      `/api/v1/projects/data/cell-towers/load`,
      { source_path: sourcePath },
      { timeout: layoutConfig.network.cellTowerLoadTimeoutMs },
    ).then(res => res.data),
  cellTowerStats: () =>
    api.get<CellTowerReferenceStats>(
      `/api/v1/projects/data/cell-towers/stats`,
      { timeout: layoutConfig.network.cellTowerStatsTimeoutMs },
    ).then(res => res.data),
  enrichCellTowersByProjectAddresses: (projectId: number) =>
    api.post<CellTowerReferenceEnrichResponse>(
      `/api/v1/projects/${projectId}/data/cell-towers/enrich-by-address`,
      {},
      { timeout: layoutConfig.network.cellTowerEnrichTimeoutMs },
    ).then(res => res.data),
};

export const consoleApi = {
  profiles: () => api.get<ConsoleProfilesResponse>('/api/v1/console/profiles').then(res => res.data),
  dataSources: () => api.get<ConsoleDataSourcesResponse>('/api/v1/console/datasources').then(res => res.data),
  createDataSource: (payload: Record<string, any>) =>
    api.post<ConsoleDataSource>('/api/v1/console/datasources', payload, { timeout: 120000 }).then(res => res.data),
  updateDataSource: (sourceKey: string, payload: Record<string, any>) =>
    api.put<ConsoleDataSource>(`/api/v1/console/datasources/${encodeURIComponent(sourceKey)}`, payload, { timeout: 120000 }).then(res => res.data),
  deleteDataSource: (sourceKey: string) =>
    api.delete<{ ok: boolean; source_key: string; message: string }>(`/api/v1/console/datasources/${encodeURIComponent(sourceKey)}`, { timeout: 120000 }).then(res => res.data),
  testDataSource: (sourceKey: string) =>
    api.post<ConsoleDataSourceTestResponse>(`/api/v1/console/datasources/${encodeURIComponent(sourceKey)}/test`, {}, { timeout: 30000 }).then(res => res.data),
  objectTypeMappings: () =>
    api.get<ConsoleObjectTypeMappingsResponse>('/api/v1/console/object-type-mappings').then(res => res.data),
  updateObjectTypeMappings: (mappings: Array<Record<string, any>>) =>
    api.put<ConsoleObjectTypeMappingsResponse>('/api/v1/console/object-type-mappings', { mappings }, { timeout: 120000 }).then(res => res.data),
  procedures: () => api.get<{ procedures: ConsoleProfile[] }>('/api/v1/console/procedures').then(res => res.data),
  getProcedure: (profileKey: string) =>
    api.get<ConsoleProfile>(`/api/v1/console/procedures/${encodeURIComponent(profileKey)}`).then(res => res.data),
  createProcedure: (payload: Record<string, any>) =>
    api.post<ConsoleProfile>('/api/v1/console/procedures', payload, { timeout: 120000 }).then(res => res.data),
  updateProcedure: (profileKey: string, payload: Record<string, any>) =>
    api.put<ConsoleProfile>(`/api/v1/console/procedures/${encodeURIComponent(profileKey)}`, payload, { timeout: 120000 }).then(res => res.data),
  deleteProcedure: (profileKey: string) =>
    api.delete<{ ok: boolean; profile_key: string; message: string }>(`/api/v1/console/procedures/${encodeURIComponent(profileKey)}`, { timeout: 120000 }).then(res => res.data),
  refresh: (
    projectId: number,
    artifactId: number,
    profileId: string,
    params: Record<string, any> = {},
    context?: Record<string, any>,
    contextArtifactId?: number | null,
  ) =>
    api.post<ConsoleRefreshResponse>(`/api/v1/projects/${projectId}/console/refresh`, {
      artifact_id: artifactId,
      profile_id: profileId,
      params,
      context,
      context_artifact_id: contextArtifactId,
    }, { timeout: layoutConfig.network.consoleRefreshTimeoutMs }).then(res => res.data),
};
export const domainModelApi = {
  get: () => api.get('/api/v1/config/domain-model').then(res => res.data),
};

export default api;













