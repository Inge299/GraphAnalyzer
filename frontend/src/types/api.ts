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

export interface ProjectDataStats {
  project_id: number;
  communications_count: number;
  device_history_count: number;
  location_events_count: number;
  ip_bindings_count: number;
  user_msisdn_facts_count: number;
  ip_msisdn_facts_count: number;
  msisdn_device_facts_count: number;
  msisdn_text_facts_count: number;
}

export interface ProjectDataLoadResponse {
  message: string;
  project_id: number;
  source_path: string;
  output_dir: string;
  communications_rows: number;
  device_history_rows: number;
  location_events_rows: number;
  ip_bindings_rows: number;
  user_msisdn_facts_rows: number;
  ip_msisdn_facts_rows: number;
  msisdn_device_facts_rows: number;
  msisdn_text_facts_rows: number;
  inserted_communications: number;
  inserted_device_history: number;
  inserted_location_events: number;
  inserted_ip_bindings: number;
  inserted_user_msisdn_facts: number;
  inserted_ip_msisdn_facts: number;
  inserted_msisdn_device_facts: number;
  inserted_msisdn_text_facts: number;
  load_batch_id: string;
  load_log: Record<string, any>;
  graph_artifact?: ApiArtifact | Record<string, any> | null;
}

export interface ProjectDataClearResponse {
  message: string;
  project_id: number;
  communications_deleted: number;
  device_history_deleted: number;
  location_events_deleted: number;
  ip_bindings_deleted: number;
  user_msisdn_facts_deleted: number;
  ip_msisdn_facts_deleted: number;
  msisdn_device_facts_deleted: number;
  msisdn_text_facts_deleted: number;
}

export interface CellTowerReferenceLoadResponse {
  message: string;
  source_path: string;
  inserted_rows: number;
  loaded_at: string;
}

export interface CellTowerReferenceEnrichResponse {
  message: string;
  project_id: number;
  raw_candidates: number;
  matched_by_address: number;
  inserted_rows: number;
}

export interface CellTowerReferenceStats {
  cell_tower_reference_count: number;
  last_loaded_at: string | null;
}

export interface ConsoleProcedureParam {
  id?: string | number;
  key?: string;
  name?: string;
  label?: string;
  type?: string;
  default?: unknown;
  required?: boolean;
  hidden?: boolean;
  binding_mode?: string;
  binding_source?: string | null;
  binding_config?: Record<string, any>;
}

export interface ConsoleProcedureColumn {
  key: string;
  original_name?: string;
  label?: string;
  type?: string;
  width?: number | null;
  visible?: boolean;
}

export interface ConsoleProcedureResultSet {
  id?: string | number;
  result_index?: number;
  result_key?: string;
  name?: string;
  visible?: boolean;
  columns?: ConsoleProcedureColumn[];
}

export interface ConsoleProfile {
  id: string;
  db_id?: number;
  key?: string;
  name: string;
  description?: string;
  kind?: string;
  schema_name?: string;
  procedure_name?: string;
  source_id?: number;
  source_key?: string | null;
  source_name?: string | null;
  timeout_seconds?: number;
  is_active?: boolean;
  params?: ConsoleProcedureParam[];
  result_sets?: ConsoleProcedureResultSet[];
  supports_graph_selection?: boolean;
  default_limit?: number | null;
}

export interface ConsoleProfilesResponse {
  profiles: ConsoleProfile[];
}

export interface ConsoleRefreshResponse {
  id: number;
  project_id: number;
  type: string;
  name: string;
  description: string | null;
  data: Record<string, any>;
  metadata: Record<string, any>;
  created_at: string | null;
  updated_at: string | null;
  version: number;
}

export interface ConsoleDataSource {
  id: number;
  key: string;
  name: string;
  description?: string | null;
  dbms: string;
  driver: string;
  host: string;
  port: number;
  database_name: string;
  auth_type: string;
  username?: string | null;
  options?: Record<string, any>;
  is_active: boolean;
  has_password?: boolean;
  created_at?: string | null;
  updated_at?: string | null;
}

export interface ConsoleDataSourcesResponse {
  data_sources: ConsoleDataSource[];
}

export interface ConsoleDataSourceTestResponse {
  ok: boolean;
  source_key: string;
  source_name: string;
  server_name?: string | null;
  database_name?: string | null;
  message: string;
}

export interface ConsoleObjectTypeMapping {
  id?: number | null;
  graph_type: string;
  procedure_type: string;
  is_active: boolean;
  position?: number;
  is_default?: boolean;
  created_at?: string | null;
  updated_at?: string | null;
}

export interface ConsoleObjectTypeMappingsResponse {
  mappings: ConsoleObjectTypeMapping[];
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
  key?: string;
  name?: string;
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
  plugin_scope?: 'context' | 'global' | string;
}

export interface PluginExecutionContext {
  selected_nodes?: string[];
  selected_edges?: string[];
  selected_rows?: string[];
  selected_text?: string;
  selected_geo?: Record<string, any>;
}

export type PluginArtifactDataOverride = Record<string, any> | any[] | null;

export interface PluginListResponse {
  plugins: ApiPlugin[];
}

export interface PluginApplicableResponse {
  plugins: ApiPlugin[];
}

export interface PluginUploadInputResponse {
  project_id: number;
  original_name: string;
  saved_name: string;
  container_path: string;
  size_bytes: number;
}

export interface ApiPluginExecuteRequest {
  project_id: number;
  input_artifact_ids: number[];
  params?: Record<string, any>;
  context?: PluginExecutionContext;
}

export interface ApiPluginExecuteResponse {
  created: ApiArtifact[];
  updated: ApiArtifact[];
}

export interface DomainModelNodeType {
  id: string;
  label?: string;
  icon?: string;
}

export interface DomainModelRules {
  edge_direction_values?: string[];
  allow_parallel_edges?: boolean;
  merge_nodes_with_same_label?: boolean;
}

export interface DomainModelConfig {
  version: number;
  node_types: DomainModelNodeType[];
  edge_types: Array<Record<string, any>>;
  rules?: DomainModelRules;
}



