export type ServiceCategory =
  | 'cell_towers'
  | 'project_data'
  | 'console_registry'
  | 'graph_model'
  | 'import_plugins'
  | 'metadata_bundle';

export interface SelectOption {
  value: string;
  label: string;
}

export interface ProcedureParamFormItem {
  id: string;
  name: string;
  label: string;
  type: string;
  required: boolean;
  hidden: boolean;
  defaultValue: string;
  binding_mode: string;
  binding_source: string;
  binding_attr_key: string;
}

export interface ProcedureColumnFormItem {
  id: string;
  key: string;
  label: string;
  type: string;
  width: string;
  visible: boolean;
}

export interface ProcedureResultSetFormItem {
  id: string;
  result_index: string;
  result_key: string;
  name: string;
  visible: boolean;
  columns: ProcedureColumnFormItem[];
}

export interface ObjectTypeMappingFormItem {
  id: string;
  graph_type: string;
  procedure_type: string;
  is_active: boolean;
}

export interface ProjectDataSelectedFileItem {
  id: string;
  file: File;
  name: string;
  kind: string;
  sizeBytes: number;
  recognizedPluginId?: string | null;
  recognizedPluginName?: string | null;
}

export interface DataSourceFormState {
  key: string;
  name: string;
  description: string;
  host: string;
  port: string;
  database_name: string;
  username: string;
  password: string;
  driver: string;
  auth_type: string;
  dbms: string;
  is_active: boolean;
  optionsText: string;
}

export interface ProcedureFormState {
  key: string;
  name: string;
  description: string;
  source_key: string;
  schema_name: string;
  procedure_name: string;
  timeout_seconds: string;
  default_limit: string;
  supports_graph_selection: boolean;
  is_active: boolean;
  params: ProcedureParamFormItem[];
  resultSets: ProcedureResultSetFormItem[];
}
