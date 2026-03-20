// frontend/src/types/api.ts

export interface ApiNode {
  id: string;
  type: string;
  label?: string;
  position_x: number;
  position_y: number;
  attributes?: Record<string, any>;
}

export interface ApiEdge {
  id: string;
  from: string;
  to: string;
  type: string;
  attributes?: Record<string, any>;
}

export interface ApiGraphData {
  nodes: ApiNode[];
  edges: ApiEdge[];
}

export interface ApiArtifact {
  id: number;
  project_id: number;
  type: string;
  name: string;
  description: string | null;
  data: ApiGraphData | any;
  metadata: Record<string, any>;
  created_at: string;
  updated_at: string;
  version: number;
}

export interface ApiArtifactCreate {
  type: string;
  name: string;
  description?: string;
  data: ApiGraphData | any;
  metadata?: Record<string, any>;
}

export interface ApiArtifactUpdate {
  name?: string;
  description?: string;
  data?: ApiGraphData | any;
  metadata?: Record<string, any>;
}

export interface ApiProject {
  id: number;
  name: string;
  description: string | null;
  created_at: string;
  updated_at: string;
}