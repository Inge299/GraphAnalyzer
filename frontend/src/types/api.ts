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

export interface PluginSelectionRules {
  nodes?: 'required' | 'optional' | 'forbidden';
  edges?: 'required' | 'optional' | 'forbidden';
  text?: 'required' | 'optional' | 'forbidden';
  rows?: 'required' | 'optional' | 'forbidden';
  geo?: 'required' | 'optional' | 'forbidden';
}

export interface PluginInputs {
  artifact_types?: string[];
  selection?: PluginSelectionRules;
}

export interface PluginParamSpec {
  key: string;
  label?: string;
  type: 'string' | 'number' | 'integer' | 'boolean' | 'date';
  required?: boolean;
  default?: any;
}

export interface ApiPlugin {
  id: string;
  name: string;
  version: string;
  description: string;
  menu_path: string;
  input_types: string[];
  output_types: string[];
  applicable_to: string[];
  inputs?: PluginInputs;
  applicable_when?: Record<string, any>;
  params_schema?: PluginParamSpec[];
  output_strategy?: Record<string, any>;
}

export interface PluginExecutionContext {
  selected_nodes?: string[];
  selected_edges?: string[];
  selected_rows?: string[];
  selected_text?: string;
  selected_geo?: Record<string, any>;
}

export interface ApiPluginExecuteRequest {
  project_id: number;
  input_artifact_ids: number[];
  params?: Record<string, any>;
  context?: PluginExecutionContext;
}

export interface ApiPluginExecuteResponse {
  created: ApiArtifact[];
}

export interface DomainModelNodeType {
  id: string;
  label?: string;
  icon?: string;
}

export interface DomainModelRules {
  edge_direction_values?: string[];
}

export interface DomainModelConfig {
  version: number;
  node_types: DomainModelNodeType[];
  edge_types: Array<Record<string, any>>;
  rules?: DomainModelRules;
}
