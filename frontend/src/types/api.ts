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
