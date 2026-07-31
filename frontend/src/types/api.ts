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
  entities_count: number;
  facts_count: number;
  relations_count: number;
  entity_counts: Record<string, number>;
  fact_counts: Record<string, number>;
  relation_counts: Record<string, number>;
}
export interface ProjectDataImportQualityReport {
  project_id: number;
  summary: {
    latest_batch: string;
    import_runs: number;
    latest_sources: number;
    source_rows: number;
  };
  runs: Array<Record<string, unknown>>;
  warnings: Array<Record<string, unknown>>;
}
export interface ProjectDataLoadResponse {
  message: string;
  project_id: number;
  source_path: string;
  output_dir: string;
  import_plugin_id: string;
  import_plugin_name: string;
  entities: number;
  facts: number;
  relations: number;
  source_counts: Record<string, number>;
  fact_counts: Record<string, number>;
  load_batch_id: string;
  load_log: Record<string, any>;
  graph_artifact?: ApiArtifact | Record<string, any> | null;
}

export interface ProjectDataPreviewDataset {
  id: string;
  label: string;
  row_count: number;
  columns: string[];
  sample_rows: Array<Record<string, unknown>>;
}

export interface ProjectDataPreviewResponse {
  project_id: number;
  dry_run: true;
  write_performed: false;
  files: Array<{
    path: string;
    size_bytes?: number;
    plugin_id?: string | null;
    plugin_name?: string | null;
    score?: number | null;
    members?: Array<{ path: string; plugin_id: string; plugin_name: string; score: number }>;
  }>;
  runs: Array<{
    plugin: { id: string; name: string; description?: string };
    recognized_files: string[];
    source_files?: string[];
    score: number;
    datasets: ProjectDataPreviewDataset[];
    manifest?: Record<string, unknown>;
    converter_stdout?: string;
    converter_stderr?: string;
  }>;
  warnings: string[];
  errors: Array<{ path?: string; plugin_id?: string; stage: string; message: string }>;
}
export interface ProjectDataImportPlugin {
  id: string;
  name: string;
  description: string;
  priority: number;
  enabled: boolean;
  extensions: string[];
  recognition_hint: string;
  version: string;
  sdk_version: string;
  config_schema: Record<string, unknown>;
  input_contract: Record<string, unknown>;
  capabilities: string[];
  output_datasets: Array<{ id: string; label: string; filename: string; required_columns: string[] }> ;
  source: string;
  removable: boolean;
}

export interface ProjectDataImportPluginInstallResponse {
  filename: string;
  plugins: ProjectDataImportPlugin[];
}
export interface MetadataBundle {
  version: number;
  exported_at_utc?: string;
  domain_model: DomainModelConfig;
  project_data_import_plugins: {
    version: number;
    plugins: Array<{
      id: string;
      name: string;
      description: string;
      priority: number;
      enabled: boolean;
    }>;
  };
}

export interface ProjectDataClearResponse {
  message: string;
  project_id: number;
  entities_deleted: number;
  facts_deleted: number;
  relations_deleted: number;
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

export interface DomainAttributeDefinition {
  key: string;
  type: string;
  label: string;
  required?: boolean;
  multiline?: boolean;
}

export interface DomainNodeType {
  id: string;
  label: string;
  icon: string;
  identity_attribute?: string;
  default_visual: {
    color: string;
    iconScale: number;
    ringEnabled: boolean;
    ringWidth: number;
  };
  attributes: DomainAttributeDefinition[];
}

export interface DomainEdgeType {
  id: string;
  label: string;
  from_type: string;
  to_type: string;
  supports_reverse?: boolean;
  system?: boolean;
  allowed_from: string[];
  allowed_to: string[];
  attributes: DomainAttributeDefinition[];
  directed?: boolean;
  default_visual?: {
    color: string;
    width: number;
    direction: string;
    dashed: boolean;
  };
  plugin_id?: string;
  show_in_context_menu?: boolean;
  context_menu_section?: string;
  context_menu_label?: string;
  menu_order?: number;
}

export interface AnalysisPluginPreset {
  id: string;
  base_plugin_id: 'expand_typed_relations';
  name: string;
  description: string;
  menu_path: string;
  menu_order: number;
  fixed_params: {
    relation_type: string;
  };
}
export interface DomainFactType {
  id: string;
  label: string;
  attributes: DomainAttributeDefinition[];
}

export interface DomainIngestionMapping {
  id: string;
  label: string;
  source: string;
  fact: Record<string, unknown>;
  entities: Array<Record<string, unknown>>;
  relations: Array<Record<string, unknown>>;
}

export interface DomainModelConfig {
  version: number;
  node_types: DomainNodeType[];
  edge_types: DomainEdgeType[];
  fact_types?: DomainFactType[];
  ingestion_mappings?: DomainIngestionMapping[];
  rules?: Record<string, any>;
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
  executor_type?: string;
  origin?: string;
  menu_path?: string;
  menu_order?: number;
  hidden_from_menu?: boolean;
  settings_updated_at?: string | null;
  source?: string;
  removable?: boolean;
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

export interface ConsolePythonPluginsResponse {
  plugins: ConsoleProfile[];
}

export interface ConsoleExecutorsResponse {
  executors: ConsoleProfile[];
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
  multiline?: boolean;
  options?: Array<{ value: string; label: string }>;
  default?: any;
}

export interface ApiPlugin {
  id: string;
  name: string;
  version: string;
  description: string;
  menu_path: string;
  hidden_from_menu?: boolean;
  menu_order?: number;
  input_types: string[];
  output_types: string[];
  applicable_to: string[];
  inputs?: PluginInputs;
  applicable_when?: Record<string, any>;
  params_schema?: PluginParamSpec[];
  output_strategy?: Record<string, any>;
  plugin_scope?: 'context' | 'global' | string;
}

export interface SelectedDomainEntity {
  type_id: string;
  external_key: string;
  label?: string;
  attributes?: Record<string, any>;
  source?: string;
}

export interface PluginExecutionContext {
  selected_nodes?: string[];
  selected_edges?: string[];
  selected_rows?: Array<string | Record<string, any>>;
  selected_entities?: SelectedDomainEntity[];
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


export interface ReferenceProvider {
  id: string;
  kind: string;
  name: string;
  description: string;
  enabled: boolean;
  capabilities: string[];
  config: Record<string, string>;
  editable_fields: string[];
  source: string;
}