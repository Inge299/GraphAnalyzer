// src/types/api.ts
export interface ApiProject {
  id: number;
  name: string;
  description?: string;
  created_at: string;
  updated_at: string;
}

export interface ApiGraph {
  id: number;
  project_id: number;
  name: string;
  description?: string;
  version: number;
  created_at: string;
  updated_at: string;
}

export interface ApiNode {
  node_id: string;
  type: string;
  attributes: Record<string, any>;
  position_x?: number;
  position_y?: number;
}

export interface ApiEdge {
  edge_id: string;
  source_node: string;
  target_node: string;
  type: string;
  attributes: Record<string, any>;
}

// API v2 - Артефакты
export interface ApiArtifact {
  id: number;
  project_id: number;
  type: 'graph' | 'table' | 'map' | 'chart' | 'document';
  name: string;
  description?: string;
  data: any;  // Специфичные для типа данные
  metadata?: Record<string, any>;
  version: number;
  created_at: string;
  updated_at: string;
}

// Для создания нового артефакта
export interface ApiArtifactCreate {
  type: 'graph' | 'table' | 'map' | 'chart' | 'document';
  name: string;
  description?: string;
  data: any;
  metadata?: Record<string, any>;
}

// Для обновления существующего артефакта
export interface ApiArtifactUpdate {
  name?: string;
  description?: string;
  data?: any;
  metadata?: Record<string, any>;
}

// API v2 - История действий
export interface ApiHistoryAction {
  id: string;
  artifact_id: number;
  action_type: string;
  before_state: any;
  after_state: any;
  timestamp: string;
  description: string;
  user_type: 'user' | 'plugin';
  plugin_id?: string;
  group_id?: string;
}

export interface ApiHistoryActionCreate {
  action_type: string;
  before_state: any;
  after_state: any;
  description: string;
  user_type?: 'user' | 'plugin';
  plugin_id?: string;
  group_id?: string;
}

export interface ApiUndoResponse {
  action_id: string;
  artifact_id: number;
  state: any;
  description: string;
  timestamp: string;
}

export interface ApiRedoResponse {
  action_id: string;
  artifact_id: number;
  state: any;
  description: string;
  timestamp: string;
}
