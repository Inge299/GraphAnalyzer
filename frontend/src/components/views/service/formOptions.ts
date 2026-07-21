import type {
  DataSourceFormState,
  ObjectTypeMappingFormItem,
  ProcedureColumnFormItem,
  ProcedureFormState,
  ProcedureParamFormItem,
  ProcedureResultSetFormItem,
  SelectOption,
  ServiceCategory,
} from './types';

export const categoryLabels: Record<ServiceCategory, string> = {
  cell_towers: 'Справочник БС',
  project_data: 'Данные проекта',
  console_registry: 'Консоль / процедуры',
  graph_model: 'Типы графа',
  import_plugins: 'Плагины импорта',
  metadata_bundle: 'Метаданные',
};

export const defaultReferencePath = 'reference/cell_towers_full.csv';

export const detectProjectDataFileKind = (fileName: string): string => {
  const normalized = fileName.trim().toLowerCase();
  if (normalized.includes('communications')) return 'Связи абонентов';
  if (normalized.includes('device_history')) return 'История устройств';
  if (normalized.includes('location_events')) return 'События локаций';
  if (normalized.includes('ip_bindings')) return 'IP-привязки';
  if (normalized.includes('manifest')) return 'Манифест';
  if (normalized.includes('взаимодейств') || normalized.includes('техданные')) return 'Адресная книга и идентификаторы';
  if (normalized.endsWith('.zip')) return 'Архив';
  return 'Прочее';
};

export const formatBytes = (sizeBytes: number): string => {
  if (!Number.isFinite(sizeBytes) || sizeBytes <= 0) return '0 Б';
  const units = ['Б', 'КБ', 'МБ', 'ГБ'];
  let value = sizeBytes;
  let unitIndex = 0;
  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024;
    unitIndex += 1;
  }
  return `${value >= 10 || unitIndex === 0 ? value.toFixed(0) : value.toFixed(1)} ${units[unitIndex]}`;
};

export const paramTypeOptions: SelectOption[] = [
  { value: 'string', label: 'Строка' },
  { value: 'integer', label: 'Целое число' },
  { value: 'number', label: 'Число' },
  { value: 'boolean', label: 'Булево' },
  { value: 'date', label: 'Дата' },
  { value: 'json', label: 'JSON' },
];

export const bindingModeOptions: SelectOption[] = [
  { value: 'manual', label: 'Вводится пользователем' },
  { value: 'fixed', label: 'Фиксированное значение' },
  { value: 'project_context', label: 'Из контекста проекта' },
  { value: 'selection_json', label: 'Выделение графа (JSON)' },
  { value: 'selected_node_ids_csv', label: 'ID выбранных узлов (CSV)' },
  { value: 'selected_edge_ids_csv', label: 'ID выбранных связей (CSV)' },
  { value: 'selected_node_labels_csv', label: 'Подписи выбранных узлов (CSV)' },
  { value: 'selected_node_types_csv', label: 'Типы выбранных узлов (CSV)' },
  { value: 'selected_node_attr_csv', label: 'Атрибут выбранных узлов (CSV)' },
];

export const projectContextSourceOptions: SelectOption[] = [
  { value: 'project_id', label: 'ID проекта' },
  { value: 'artifact_id', label: 'ID console-артефакта' },
  { value: 'context_artifact_id', label: 'ID графа-источника' },
];

export const columnTypeOptions: SelectOption[] = [
  { value: 'string', label: 'Строка' },
  { value: 'integer', label: 'Целое число' },
  { value: 'number', label: 'Число' },
  { value: 'boolean', label: 'Булево' },
  { value: 'datetime', label: 'Дата/время' },
];

export const createLocalId = (prefix: string) => `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

export const createDefaultProcedureParam = (): ProcedureParamFormItem => ({
  id: createLocalId('param'),
  name: '',
  label: '',
  type: 'string',
  required: false,
  hidden: false,
  defaultValue: '',
  binding_mode: 'manual',
  binding_source: '',
  binding_attr_key: '',
});

export const createObjectsAnalysisParamPreset = (): ProcedureParamFormItem[] => [
  {
    ...createDefaultProcedureParam(),
    name: 'Objects',
    label: 'Объекты',
    type: 'string',
    binding_mode: 'selection_json',
  },
  {
    ...createDefaultProcedureParam(),
    name: 'ObjectsType',
    label: 'Типы объектов',
    type: 'string',
    binding_mode: 'manual',
  },
  {
    ...createDefaultProcedureParam(),
    name: 'SourceIDs',
    label: 'Source IDs',
    type: 'string',
    binding_mode: 'manual',
  },
];

export const createDefaultProcedureColumn = (): ProcedureColumnFormItem => ({
  id: createLocalId('column'),
  key: '',
  label: '',
  type: 'string',
  width: '',
  visible: true,
});

export const createDefaultResultSet = (): ProcedureResultSetFormItem => ({
  id: createLocalId('result-set'),
  result_index: '1',
  result_key: 'main',
  name: 'Основная таблица',
  visible: true,
  columns: [],
});

export const defaultObjectTypeMappings: ObjectTypeMappingFormItem[] = [
  { id: createLocalId('type-map'), graph_type: 'person', procedure_type: 'MSISDN', is_active: true },
  { id: createLocalId('type-map'), graph_type: 'device', procedure_type: 'IMEI', is_active: true },
  { id: createLocalId('type-map'), graph_type: 'sim', procedure_type: 'IMSI', is_active: true },
];

export const defaultDataSourceForm: DataSourceFormState = {
  key: '',
  name: '',
  description: '',
  host: 'host.docker.internal',
  port: '1433',
  database_name: '',
  username: '',
  password: '',
  driver: 'pymssql',
  auth_type: 'sql',
  dbms: 'mssql',
  is_active: true,
  optionsText: '{}',
};

export const defaultProcedureForm: ProcedureFormState = {
  key: '',
  name: '',
  description: '',
  source_key: '',
  schema_name: 'dbo',
  procedure_name: '',
  timeout_seconds: '60',
  default_limit: '200',
  supports_graph_selection: true,
  is_active: true,
  params: [],
  resultSets: [createDefaultResultSet()],
};
