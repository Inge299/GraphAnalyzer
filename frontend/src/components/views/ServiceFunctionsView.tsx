import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { consoleApi, projectDataApi } from '../../services/api';
import type {
  ConsoleDataSource,
  ConsoleObjectTypeMapping,
  ConsoleProcedureColumn,
  ConsoleProcedureParam,
  ConsoleProcedureResultSet,
  ConsoleProfile,
} from '../../types/api';
import './ServiceFunctionsView.css';

type ServiceCategory = 'cell_towers' | 'project_data' | 'console_registry';

interface ServiceFunctionsViewProps {
  projectId: number | null;
}

interface ProcedureParamFormItem {
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

interface ProcedureColumnFormItem {
  id: string;
  key: string;
  label: string;
  type: string;
  width: string;
  visible: boolean;
}

interface ProcedureResultSetFormItem {
  id: string;
  result_index: string;
  result_key: string;
  name: string;
  visible: boolean;
  columns: ProcedureColumnFormItem[];
}

interface ObjectTypeMappingFormItem {
  id: string;
  graph_type: string;
  procedure_type: string;
  is_active: boolean;
}

const categoryLabels: Record<ServiceCategory, string> = {
  cell_towers: 'Справочник БС',
  project_data: 'Данные проекта',
  console_registry: 'Консоль / процедуры',
};

const defaultReferencePath = 'reference/cell_towers_full.csv';

const paramTypeOptions = [
  { value: 'string', label: 'Строка' },
  { value: 'integer', label: 'Целое число' },
  { value: 'number', label: 'Число' },
  { value: 'boolean', label: 'Булево' },
  { value: 'date', label: 'Дата' },
  { value: 'json', label: 'JSON' },
];

const bindingModeOptions = [
  { value: 'manual', label: 'Вводится пользователем' },
  { value: 'fixed', label: 'Фиксированное значение' },
  { value: 'project_context', label: 'Из контекста проекта' },
  { value: 'selection_json', label: 'JSON выделенных объектов' },
  { value: 'selected_node_ids_csv', label: 'ID выбранных узлов (CSV)' },
  { value: 'selected_edge_ids_csv', label: 'ID выбранных связей (CSV)' },
  { value: 'selected_node_labels_csv', label: 'Подписи выбранных узлов (CSV)' },
  { value: 'selected_node_types_csv', label: 'Типы выбранных узлов (CSV)' },
  { value: 'selected_node_attr_csv', label: 'Атрибут выбранных узлов (CSV)' },
];

const projectContextSourceOptions = [
  { value: 'project_id', label: 'ID проекта' },
  { value: 'artifact_id', label: 'ID console-артефакта' },
  { value: 'context_artifact_id', label: 'ID графа-источника' },
];

const columnTypeOptions = [
  { value: 'string', label: 'Строка' },
  { value: 'integer', label: 'Целое число' },
  { value: 'number', label: 'Число' },
  { value: 'boolean', label: 'Булево' },
  { value: 'datetime', label: 'Дата/время' },
];

const createLocalId = (prefix: string) =>
  `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

const createDefaultProcedureParam = (): ProcedureParamFormItem => ({
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

const createDefaultProcedureColumn = (): ProcedureColumnFormItem => ({
  id: createLocalId('column'),
  key: '',
  label: '',
  type: 'string',
  width: '',
  visible: true,
});

const createDefaultResultSet = (): ProcedureResultSetFormItem => ({
  id: createLocalId('result-set'),
  result_index: '1',
  result_key: 'main',
  name: 'Основная таблица',
  visible: true,
  columns: [],
});

const defaultObjectTypeMappings: ObjectTypeMappingFormItem[] = [
  { id: createLocalId('type-map'), graph_type: 'person', procedure_type: 'MSISDN', is_active: true },
  { id: createLocalId('type-map'), graph_type: 'device', procedure_type: 'IMEI', is_active: true },
  { id: createLocalId('type-map'), graph_type: 'sim', procedure_type: 'IMSI', is_active: true },
];

const defaultDataSourceForm = {
  key: '',
  name: '',
  description: '',
  host: '',
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

const defaultProcedureForm = {
  key: '',
  name: '',
  description: '',
  source_key: '',
  schema_name: 'dbo',
  procedure_name: '',
  timeout_seconds: '120',
  default_limit: '200',
  supports_graph_selection: true,
  is_active: true,
  params: [
    {
      ...createDefaultProcedureParam(),
      name: 'selection_json',
      label: 'Выделение графа (JSON)',
      type: 'json',
      binding_mode: 'selection_json',
    },
  ] as ProcedureParamFormItem[],
  resultSets: [createDefaultResultSet()] as ProcedureResultSetFormItem[],
};

const createObjectsAnalysisParamPreset = (): ProcedureParamFormItem[] => [
  {
    ...createDefaultProcedureParam(),
    name: 'Objects',
    label: 'Объекты',
    type: 'string',
    binding_mode: 'selected_node_labels_csv',
  },
  {
    ...createDefaultProcedureParam(),
    name: 'ObjectsType',
    label: 'Типы объектов',
    type: 'string',
    binding_mode: 'selected_node_types_csv',
  },
  {
    ...createDefaultProcedureParam(),
    name: 'SourceIDs',
    label: 'Source IDs',
    type: 'string',
    binding_mode: 'fixed',
    defaultValue: 'All',
  },
  {
    ...createDefaultProcedureParam(),
    name: 'BegTime',
    label: 'Начало периода',
    type: 'date',
    binding_mode: 'manual',
  },
  {
    ...createDefaultProcedureParam(),
    name: 'EndTime',
    label: 'Конец периода',
    type: 'date',
    binding_mode: 'manual',
  },
];

const formatDateTime = (value: unknown): string => {
  if (!value) return '—';
  const dt = new Date(String(value));
  if (Number.isNaN(dt.getTime())) return String(value);
  return dt.toLocaleString('ru-RU');
};

const parseJsonInput = <T,>(raw: string, fallbackLabel: string): T => {
  try {
    return JSON.parse(raw) as T;
  } catch (error) {
    throw new Error(`${fallbackLabel}: некорректный JSON`);
  }
};

const toPrettyJson = (value: unknown) => JSON.stringify(value, null, 2);

const mapParamToForm = (param: ConsoleProcedureParam): ProcedureParamFormItem => ({
  id: createLocalId('param'),
  name: String(param.name || param.key || '').trim(),
  label: String(param.label || param.name || param.key || '').trim(),
  type: String(param.type || 'string').trim() || 'string',
  required: Boolean(param.required),
  hidden: Boolean(param.hidden),
  defaultValue: param.default === null || param.default === undefined ? '' : String(param.default),
  binding_mode: String(param.binding_mode || 'manual').trim() || 'manual',
  binding_source: String(param.binding_source || '').trim(),
  binding_attr_key: String(param.binding_config?.attr_key || '').trim(),
});

const mapColumnToForm = (column: ConsoleProcedureColumn): ProcedureColumnFormItem => ({
  id: createLocalId('column'),
  key: String(column.original_name || column.key || '').trim(),
  label: String(column.label || column.original_name || column.key || '').trim(),
  type: String(column.type || 'string').trim() || 'string',
  width: column.width === null || column.width === undefined ? '' : String(column.width),
  visible: column.visible !== false,
});

const mapResultSetToForm = (resultSet: ConsoleProcedureResultSet, index: number): ProcedureResultSetFormItem => ({
  id: createLocalId('result-set'),
  result_index: String(resultSet.result_index || index + 1),
  result_key: String(resultSet.result_key || `result_${index + 1}`).trim(),
  name: String(resultSet.name || `Результат ${index + 1}`).trim(),
  visible: resultSet.visible !== false,
  columns: Array.isArray(resultSet.columns) ? resultSet.columns.map(mapColumnToForm) : [],
});

const mapObjectTypeMappingToForm = (mapping: ConsoleObjectTypeMapping): ObjectTypeMappingFormItem => ({
  id: createLocalId('type-map'),
  graph_type: String(mapping.graph_type || '').trim(),
  procedure_type: String(mapping.procedure_type || '').trim(),
  is_active: mapping.is_active !== false,
});

const buildProcedureParamsPayload = (items: ProcedureParamFormItem[]) =>
  items
    .map((item, index) => {
      const name = item.name.trim().replace(/^@+/, '');
      if (!name) return null;

      const payload: Record<string, any> = {
        name,
        label: item.label.trim() || name,
        type: item.type.trim() || 'string',
        required: item.required,
        hidden: item.hidden,
        binding_mode: item.binding_mode.trim() || 'manual',
        position: index,
      };

      if (item.defaultValue.trim() !== '') {
        payload.default = item.defaultValue;
      }
      if (item.binding_source.trim()) {
        payload.binding_source = item.binding_source.trim();
      }
      if (item.binding_mode === 'selected_node_attr_csv' && item.binding_attr_key.trim()) {
        payload.binding_config = { attr_key: item.binding_attr_key.trim() };
      }

      return payload;
    })
    .filter(Boolean);

const buildResultSetsPayload = (items: ProcedureResultSetFormItem[]) =>
  items
    .map((resultSet, resultSetIndex) => {
      const resultKey = resultSet.result_key.trim() || `result_${resultSetIndex + 1}`;
      const resultIndexNumber = Number.parseInt(resultSet.result_index, 10);

      const payload = {
        result_index: Number.isFinite(resultIndexNumber) && resultIndexNumber > 0 ? resultIndexNumber : resultSetIndex + 1,
        result_key: resultKey,
        name: resultSet.name.trim() || resultKey,
        visible: resultSet.visible,
        position: resultSetIndex,
        columns: resultSet.columns
          .map((column, columnIndex) => {
            const key = column.key.trim();
            if (!key) return null;
            return {
              key,
              original_name: key,
              label: column.label.trim() || key,
              type: column.type.trim() || 'string',
              width: column.width.trim() ? Number.parseInt(column.width, 10) : null,
              visible: column.visible,
              position: columnIndex,
            };
          })
          .filter(Boolean),
      };

      return payload;
    })
    .filter(Boolean);

const ServiceFunctionsView: React.FC<ServiceFunctionsViewProps> = ({ projectId }) => {
  const [activeCategory, setActiveCategory] = useState<ServiceCategory>('cell_towers');

  const [referencePath, setReferencePath] = useState(defaultReferencePath);
  const [cellStats, setCellStats] = useState<any | null>(null);
  const [cellStatsLoading, setCellStatsLoading] = useState(false);
  const [cellLoadLoading, setCellLoadLoading] = useState(false);
  const [cellLoadReport, setCellLoadReport] = useState<any | null>(null);

  const [projectStats, setProjectStats] = useState<any | null>(null);
  const [projectStatsLoading, setProjectStatsLoading] = useState(false);
  const [enrichLoading, setEnrichLoading] = useState(false);
  const [enrichReport, setEnrichReport] = useState<any | null>(null);

  const [consoleDataSources, setConsoleDataSources] = useState<ConsoleDataSource[]>([]);
  const [consoleProcedures, setConsoleProcedures] = useState<ConsoleProfile[]>([]);
  const [consoleObjectTypeMappings, setConsoleObjectTypeMappings] = useState<ObjectTypeMappingFormItem[]>(defaultObjectTypeMappings);
  const [consoleLoading, setConsoleLoading] = useState(false);
  const [consoleSaving, setConsoleSaving] = useState(false);
  const [consoleTestingSource, setConsoleTestingSource] = useState(false);
  const [sourceSearch, setSourceSearch] = useState('');
  const [procedureSearch, setProcedureSearch] = useState('');
  const [selectedSourceKey, setSelectedSourceKey] = useState<string>('');
  const [selectedProcedureKey, setSelectedProcedureKey] = useState<string>('');
  const [dataSourceForm, setDataSourceForm] = useState(defaultDataSourceForm);
  const [procedureForm, setProcedureForm] = useState(defaultProcedureForm);

  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const fetchCellStats = useCallback(async () => {
    setCellStatsLoading(true);
    setError(null);
    try {
      const stats = await projectDataApi.cellTowerStats();
      setCellStats(stats);
    } catch (err: any) {
      setError(String(err?.response?.data?.detail || err?.message || 'Не удалось получить статистику справочника БС'));
    } finally {
      setCellStatsLoading(false);
    }
  }, []);

  const fetchProjectStats = useCallback(async () => {
    if (!projectId) {
      setProjectStats(null);
      return;
    }
    setProjectStatsLoading(true);
    setError(null);
    try {
      const stats = await projectDataApi.stats(projectId);
      setProjectStats(stats);
    } catch (err: any) {
      setError(String(err?.response?.data?.detail || err?.message || 'Не удалось получить статистику проекта'));
    } finally {
      setProjectStatsLoading(false);
    }
  }, [projectId]);

  const fetchConsoleRegistry = useCallback(async () => {
    setConsoleLoading(true);
    setError(null);
    try {
      const [sourcesResponse, proceduresResponse, mappingsResponse] = await Promise.all([
        consoleApi.dataSources(),
        consoleApi.procedures(),
        consoleApi.objectTypeMappings(),
      ]);
      const sources = Array.isArray(sourcesResponse?.data_sources) ? sourcesResponse.data_sources : [];
      const procedures = Array.isArray(proceduresResponse?.procedures) ? proceduresResponse.procedures : [];
      const mappings = Array.isArray(mappingsResponse?.mappings) ? mappingsResponse.mappings : [];
      setConsoleDataSources(sources);
      setConsoleProcedures(procedures);
      setConsoleObjectTypeMappings(
        mappings.length ? mappings.map(mapObjectTypeMappingToForm) : defaultObjectTypeMappings.map((item) => ({ ...item })),
      );
      if (!selectedSourceKey && sources[0]?.key) {
        setSelectedSourceKey(sources[0].key);
      }
      if (!selectedProcedureKey && (procedures[0]?.key || procedures[0]?.id)) {
        setSelectedProcedureKey(String(procedures[0].key || procedures[0].id));
      }
    } catch (err: any) {
      setError(String(err?.response?.data?.detail || err?.message || 'Не удалось загрузить реестр консольных процедур'));
    } finally {
      setConsoleLoading(false);
    }
  }, [selectedProcedureKey, selectedSourceKey]);

  const handleEnrichCellTowersByAddress = useCallback(async () => {
    if (!projectId) {
      setError('Сначала выбери проект');
      return;
    }
    setEnrichLoading(true);
    setEnrichReport(null);
    setMessage(null);
    setError(null);
    try {
      const report = await projectDataApi.enrichCellTowersByProjectAddresses(projectId);
      setEnrichReport(report);
      setMessage('Справочник БС обогащён по адресам из данных проекта');
      await fetchCellStats();
      await fetchProjectStats();
    } catch (err: any) {
      setError(String(err?.response?.data?.detail || err?.message || 'Не удалось обогатить справочник по адресам'));
    } finally {
      setEnrichLoading(false);
    }
  }, [projectId, fetchCellStats, fetchProjectStats]);

  useEffect(() => {
    void fetchCellStats();
  }, [fetchCellStats]);

  useEffect(() => {
    void fetchProjectStats();
  }, [fetchProjectStats]);

  useEffect(() => {
    if (activeCategory === 'console_registry') {
      void fetchConsoleRegistry();
    }
  }, [activeCategory, fetchConsoleRegistry]);

  const handleLoadReference = useCallback(async () => {
    const path = referencePath.trim();
    if (!path) {
      setError('Укажи путь к CSV справочника БС');
      return;
    }
    setCellLoadLoading(true);
    setMessage(null);
    setError(null);
    try {
      const report = await projectDataApi.loadCellTowers(path);
      setCellLoadReport(report);
      setMessage('Справочник БС успешно загружен');
      await fetchCellStats();
    } catch (err: any) {
      setError(String(err?.response?.data?.detail || err?.message || 'Не удалось загрузить справочник БС'));
    } finally {
      setCellLoadLoading(false);
    }
  }, [referencePath, fetchCellStats]);

  const categories = useMemo(() => (Object.keys(categoryLabels) as ServiceCategory[]), []);

  const locationCoverage = useMemo(() => {
    const total = Number(projectStats?.location_timeline_count || 0);
    const geocoded = Number(projectStats?.location_timeline_geocoded_count || 0);
    if (!total) return '0%';
    return `${((geocoded / total) * 100).toFixed(1)}%`;
  }, [projectStats]);

  const selectedSource = useMemo(
    () => consoleDataSources.find((item) => item.key === selectedSourceKey) || null,
    [consoleDataSources, selectedSourceKey],
  );

  const selectedProcedure = useMemo(
    () => consoleProcedures.find((item) => String(item.key || item.id) === selectedProcedureKey) || null,
    [consoleProcedures, selectedProcedureKey],
  );

  const filteredDataSources = useMemo(() => {
    const query = sourceSearch.trim().toLowerCase();
    if (!query) return consoleDataSources;
    return consoleDataSources.filter((source) =>
      [
        source.name,
        source.key,
        source.host,
        source.database_name,
        source.username || '',
        source.description || '',
      ]
        .join(' ')
        .toLowerCase()
        .includes(query),
    );
  }, [consoleDataSources, sourceSearch]);

  const filteredProcedures = useMemo(() => {
    const query = procedureSearch.trim().toLowerCase();
    if (!query) return consoleProcedures;
    return consoleProcedures.filter((procedure) =>
      [
        procedure.name,
        procedure.key || procedure.id,
        procedure.schema_name || '',
        procedure.procedure_name || '',
        procedure.source_name || '',
        procedure.source_key || '',
        procedure.description || '',
      ]
        .join(' ')
        .toLowerCase()
        .includes(query),
    );
  }, [consoleProcedures, procedureSearch]);

  useEffect(() => {
    if (!selectedSource) return;
    setDataSourceForm({
      key: selectedSource.key || '',
      name: selectedSource.name || '',
      description: selectedSource.description || '',
      host: selectedSource.host || '',
      port: String(selectedSource.port || 1433),
      database_name: selectedSource.database_name || '',
      username: selectedSource.username || '',
      password: '',
      driver: selectedSource.driver || 'pymssql',
      auth_type: selectedSource.auth_type || 'sql',
      dbms: selectedSource.dbms || 'mssql',
      is_active: selectedSource.is_active !== false,
      optionsText: toPrettyJson(selectedSource.options || {}),
    });
  }, [selectedSource]);

  useEffect(() => {
    if (!selectedProcedure) return;
    setProcedureForm({
      key: String(selectedProcedure.key || selectedProcedure.id || ''),
      name: selectedProcedure.name || '',
      description: selectedProcedure.description || '',
      source_key: selectedProcedure.source_key || '',
      schema_name: selectedProcedure.schema_name || 'dbo',
      procedure_name: selectedProcedure.procedure_name || '',
      timeout_seconds: String(selectedProcedure.timeout_seconds || 120),
      default_limit: String(selectedProcedure.default_limit || 200),
      supports_graph_selection: selectedProcedure.supports_graph_selection !== false,
      is_active: selectedProcedure.is_active !== false,
      params: Array.isArray(selectedProcedure.params) && selectedProcedure.params.length > 0
        ? selectedProcedure.params.map(mapParamToForm)
        : [],
      resultSets: Array.isArray(selectedProcedure.result_sets) && selectedProcedure.result_sets.length > 0
        ? selectedProcedure.result_sets.map(mapResultSetToForm)
        : [createDefaultResultSet()],
    });
  }, [selectedProcedure]);

  const resetDataSourceForm = () => {
    setSelectedSourceKey('');
    setDataSourceForm(defaultDataSourceForm);
  };

  const resetProcedureForm = () => {
    setSelectedProcedureKey('');
    setProcedureForm({
      ...defaultProcedureForm,
      source_key: consoleDataSources[0]?.key || '',
      params: defaultProcedureForm.params.map((item) => ({ ...item, id: createLocalId('param') })),
      resultSets: defaultProcedureForm.resultSets.map((item) => ({ ...item, id: createLocalId('result-set') })),
    });
  };

  const handleSaveDataSource = useCallback(async () => {
    setConsoleSaving(true);
    setError(null);
    setMessage(null);
    try {
      const payload = {
        key: dataSourceForm.key.trim(),
        name: dataSourceForm.name.trim(),
        description: dataSourceForm.description.trim(),
        host: dataSourceForm.host.trim(),
        port: Number(dataSourceForm.port || 1433),
        database_name: dataSourceForm.database_name.trim(),
        username: dataSourceForm.username.trim() || null,
        password: dataSourceForm.password || undefined,
        driver: dataSourceForm.driver.trim() || 'pymssql',
        auth_type: dataSourceForm.auth_type.trim() || 'sql',
        dbms: dataSourceForm.dbms.trim() || 'mssql',
        is_active: dataSourceForm.is_active,
        options: parseJsonInput<Record<string, any>>(dataSourceForm.optionsText || '{}', 'Опции datasource'),
      };

      if (selectedSourceKey) {
        await consoleApi.updateDataSource(selectedSourceKey, payload);
        setMessage(`Источник данных ${payload.key} обновлён`);
      } else {
        await consoleApi.createDataSource(payload);
        setMessage(`Источник данных ${payload.key} создан`);
      }
      await fetchConsoleRegistry();
      setSelectedSourceKey(payload.key);
    } catch (err: any) {
      setError(String(err?.response?.data?.detail || err?.message || 'Не удалось сохранить источник данных'));
    } finally {
      setConsoleSaving(false);
    }
  }, [dataSourceForm, fetchConsoleRegistry, selectedSourceKey]);

  const handleTestDataSource = useCallback(async () => {
    if (!selectedSourceKey) {
      setError('Сначала выбери или сохрани datasource');
      return;
    }
    setConsoleTestingSource(true);
    setError(null);
    setMessage(null);
    try {
      const response = await consoleApi.testDataSource(selectedSourceKey);
      setMessage(
        `${response.message}. Server: ${response.server_name || 'unknown'}, DB: ${response.database_name || 'unknown'}`,
      );
    } catch (err: any) {
      setError(String(err?.response?.data?.detail || err?.message || 'Не удалось проверить подключение'));
    } finally {
      setConsoleTestingSource(false);
    }
  }, [selectedSourceKey]);

  const handleDeleteDataSource = useCallback(async () => {
    if (!selectedSourceKey || !selectedSource) {
      setError('Сначала выбери datasource для удаления');
      return;
    }
    const confirmed = window.confirm(
      `Удалить источник данных "${selectedSource.name}" (${selectedSource.key})?`,
    );
    if (!confirmed) return;

    setConsoleSaving(true);
    setError(null);
    setMessage(null);
    try {
      const response = await consoleApi.deleteDataSource(selectedSourceKey);
      setMessage(response.message);
      await fetchConsoleRegistry();
      resetDataSourceForm();
    } catch (err: any) {
      setError(String(err?.response?.data?.detail || err?.message || 'Не удалось удалить источник данных'));
    } finally {
      setConsoleSaving(false);
    }
  }, [fetchConsoleRegistry, selectedSource, selectedSourceKey]);

  const addObjectTypeMapping = useCallback(() => {
    setConsoleObjectTypeMappings((prev) => [
      ...prev,
      { id: createLocalId('type-map'), graph_type: '', procedure_type: '', is_active: true },
    ]);
  }, []);

  const updateObjectTypeMapping = useCallback((id: string, updates: Partial<ObjectTypeMappingFormItem>) => {
    setConsoleObjectTypeMappings((prev) => prev.map((item) => (item.id === id ? { ...item, ...updates } : item)));
  }, []);

  const removeObjectTypeMapping = useCallback((id: string) => {
    setConsoleObjectTypeMappings((prev) => prev.filter((item) => item.id !== id));
  }, []);

  const resetObjectTypeMappings = useCallback(() => {
    setConsoleObjectTypeMappings(defaultObjectTypeMappings.map((item) => ({ ...item, id: createLocalId('type-map') })));
  }, []);

  const handleSaveObjectTypeMappings = useCallback(async () => {
    setConsoleSaving(true);
    setError(null);
    setMessage(null);
    try {
      const payload = consoleObjectTypeMappings
        .map((item, index) => ({
          graph_type: item.graph_type.trim(),
          procedure_type: item.procedure_type.trim(),
          is_active: item.is_active,
          position: index,
        }))
        .filter((item) => item.graph_type && item.procedure_type);

      const response = await consoleApi.updateObjectTypeMappings(payload);
      const items = Array.isArray(response?.mappings) ? response.mappings : [];
      setConsoleObjectTypeMappings(
        items.length ? items.map(mapObjectTypeMappingToForm) : defaultObjectTypeMappings.map((item) => ({ ...item })),
      );
      setMessage('Соответствия типов объектов сохранены');
    } catch (err: any) {
      setError(String(err?.response?.data?.detail || err?.message || 'Не удалось сохранить соответствия типов объектов'));
    } finally {
      setConsoleSaving(false);
    }
  }, [consoleObjectTypeMappings]);

  const handleSaveProcedure = useCallback(async () => {
    setConsoleSaving(true);
    setError(null);
    setMessage(null);
    try {
      const payload = {
        key: procedureForm.key.trim(),
        name: procedureForm.name.trim(),
        description: procedureForm.description.trim(),
        source_key: procedureForm.source_key.trim(),
        schema_name: procedureForm.schema_name.trim() || 'dbo',
        procedure_name: procedureForm.procedure_name.trim(),
        timeout_seconds: Number(procedureForm.timeout_seconds || 120),
        default_limit: Number(procedureForm.default_limit || 200),
        supports_graph_selection: procedureForm.supports_graph_selection,
        is_active: procedureForm.is_active,
        params: buildProcedureParamsPayload(procedureForm.params),
        result_sets: buildResultSetsPayload(procedureForm.resultSets),
      };

      if (selectedProcedureKey) {
        await consoleApi.updateProcedure(selectedProcedureKey, payload);
        setMessage(`Процедура ${payload.key} обновлена`);
      } else {
        await consoleApi.createProcedure(payload);
        setMessage(`Процедура ${payload.key} зарегистрирована`);
      }
      await fetchConsoleRegistry();
      setSelectedProcedureKey(payload.key);
    } catch (err: any) {
      setError(String(err?.response?.data?.detail || err?.message || 'Не удалось сохранить процедуру'));
    } finally {
      setConsoleSaving(false);
    }
  }, [fetchConsoleRegistry, procedureForm, selectedProcedureKey]);

  const handleDeleteProcedure = useCallback(async () => {
    if (!selectedProcedureKey || !selectedProcedure) {
      setError('Сначала выбери процедуру для удаления');
      return;
    }
    const confirmed = window.confirm(
      `Удалить зарегистрированную процедуру "${selectedProcedure.name}" (${selectedProcedure.key || selectedProcedure.id})?`,
    );
    if (!confirmed) return;

    setConsoleSaving(true);
    setError(null);
    setMessage(null);
    try {
      const response = await consoleApi.deleteProcedure(selectedProcedureKey);
      setMessage(response.message);
      await fetchConsoleRegistry();
      resetProcedureForm();
    } catch (err: any) {
      setError(String(err?.response?.data?.detail || err?.message || 'Не удалось удалить процедуру'));
    } finally {
      setConsoleSaving(false);
    }
  }, [fetchConsoleRegistry, selectedProcedure, selectedProcedureKey]);

  const handleDuplicateProcedureTemplate = useCallback(() => {
    if (!selectedProcedure) {
      setError('Сначала выбери процедуру, которую хочешь взять как шаблон');
      return;
    }

    const baseKey = String(selectedProcedure.key || selectedProcedure.id || '').trim();
    const baseName = String(selectedProcedure.name || '').trim();

    setSelectedProcedureKey('');
    setProcedureForm({
      key: baseKey ? `${baseKey}_copy` : '',
      name: baseName ? `${baseName} (копия)` : '',
      description: selectedProcedure.description || '',
      source_key: selectedProcedure.source_key || '',
      schema_name: selectedProcedure.schema_name || 'dbo',
      procedure_name: selectedProcedure.procedure_name || '',
      timeout_seconds: String(selectedProcedure.timeout_seconds || 120),
      default_limit: String(selectedProcedure.default_limit || 200),
      supports_graph_selection: selectedProcedure.supports_graph_selection !== false,
      is_active: selectedProcedure.is_active !== false,
      params: Array.isArray(selectedProcedure.params) && selectedProcedure.params.length > 0
        ? selectedProcedure.params.map(mapParamToForm)
        : [],
      resultSets: Array.isArray(selectedProcedure.result_sets) && selectedProcedure.result_sets.length > 0
        ? selectedProcedure.result_sets.map(mapResultSetToForm)
        : [createDefaultResultSet()],
    });
    setMessage(`Процедура "${selectedProcedure.name}" скопирована в форму как шаблон`);
    setError(null);
  }, [selectedProcedure]);

  const updateProcedureParam = (id: string, patch: Partial<ProcedureParamFormItem>) => {
    setProcedureForm((prev) => ({
      ...prev,
      params: prev.params.map((item) => {
        if (item.id !== id) return item;
        const next = { ...item, ...patch };
        if (patch.binding_mode && patch.binding_mode !== 'selected_node_attr_csv') {
          next.binding_attr_key = '';
        }
        if (patch.binding_mode && patch.binding_mode !== 'project_context') {
          next.binding_source = '';
        }
        return next;
      }),
    }));
  };

  const addProcedureParam = () => {
    setProcedureForm((prev) => ({
      ...prev,
      params: [...prev.params, createDefaultProcedureParam()],
    }));
  };

  const applyObjectsAnalysisPreset = () => {
    setProcedureForm((prev) => ({
      ...prev,
      supports_graph_selection: true,
      params: createObjectsAnalysisParamPreset(),
    }));
    setMessage('Шаблон параметров для анализа объектов применён');
    setError(null);
  };

  const removeProcedureParam = (id: string) => {
    setProcedureForm((prev) => ({
      ...prev,
      params: prev.params.filter((item) => item.id !== id),
    }));
  };

  const updateResultSet = (id: string, patch: Partial<ProcedureResultSetFormItem>) => {
    setProcedureForm((prev) => ({
      ...prev,
      resultSets: prev.resultSets.map((item) => (item.id === id ? { ...item, ...patch } : item)),
    }));
  };

  const addResultSet = () => {
    setProcedureForm((prev) => ({
      ...prev,
      resultSets: [
        ...prev.resultSets,
        {
          ...createDefaultResultSet(),
          result_index: String(prev.resultSets.length + 1),
          result_key: `result_${prev.resultSets.length + 1}`,
          name: `Результат ${prev.resultSets.length + 1}`,
        },
      ],
    }));
  };

  const removeResultSet = (id: string) => {
    setProcedureForm((prev) => ({
      ...prev,
      resultSets: prev.resultSets.filter((item) => item.id !== id),
    }));
  };

  const addColumnToResultSet = (resultSetId: string) => {
    setProcedureForm((prev) => ({
      ...prev,
      resultSets: prev.resultSets.map((resultSet) =>
        resultSet.id === resultSetId
          ? { ...resultSet, columns: [...resultSet.columns, createDefaultProcedureColumn()] }
          : resultSet,
      ),
    }));
  };

  const updateColumnInResultSet = (
    resultSetId: string,
    columnId: string,
    patch: Partial<ProcedureColumnFormItem>,
  ) => {
    setProcedureForm((prev) => ({
      ...prev,
      resultSets: prev.resultSets.map((resultSet) =>
        resultSet.id === resultSetId
          ? {
              ...resultSet,
              columns: resultSet.columns.map((column) => (column.id === columnId ? { ...column, ...patch } : column)),
            }
          : resultSet,
      ),
    }));
  };

  const removeColumnFromResultSet = (resultSetId: string, columnId: string) => {
    setProcedureForm((prev) => ({
      ...prev,
      resultSets: prev.resultSets.map((resultSet) =>
        resultSet.id === resultSetId
          ? { ...resultSet, columns: resultSet.columns.filter((column) => column.id !== columnId) }
          : resultSet,
      ),
    }));
  };

  return (
    <div className="service-screen">
      <aside className="service-screen-sidebar">
        <div className="service-screen-title">Сервисные функции</div>
        {categories.map((category) => (
          <button
            key={category}
            type="button"
            className={`service-screen-category ${activeCategory === category ? 'active' : ''}`}
            onClick={() => {
              setActiveCategory(category);
              setMessage(null);
              setError(null);
            }}
          >
            {categoryLabels[category]}
          </button>
        ))}
      </aside>

      <section className="service-screen-content">
        {message && <div className="service-screen-banner success">{message}</div>}
        {error && <div className="service-screen-banner error">{error}</div>}

        {activeCategory === 'cell_towers' && (
          <div className="service-card">
            <h3>Загрузка справочника базовых станций</h3>
            <p className="service-card-hint">
              Загрузка полностью заменяет текущий справочник БС. Используется при определении координат по MCC/MNC/LAC/CID и fallback LAC/CID.
            </p>

            <label className="service-label">Путь к CSV (относительно /app/data)</label>
            <div className="service-row">
              <input
                className="service-input"
                type="text"
                value={referencePath}
                onChange={(event) => setReferencePath(event.target.value)}
                placeholder="reference/cell_towers_full.csv"
              />
              <button
                type="button"
                className="service-btn primary"
                onClick={() => void handleLoadReference()}
                disabled={cellLoadLoading}
              >
                {cellLoadLoading ? 'Загрузка...' : 'Загрузить'}
              </button>
              <button
                type="button"
                className="service-btn"
                onClick={() => void fetchCellStats()}
                disabled={cellStatsLoading}
              >
                {cellStatsLoading ? 'Обновление...' : 'Обновить статистику'}
              </button>
            </div>

            <div className="service-report-grid">
              <div className="service-report-item">
                <span>Записей в справочнике</span>
                <strong>{cellStats?.cell_tower_reference_count ?? 0}</strong>
              </div>
              <div className="service-report-item">
                <span>Последняя загрузка</span>
                <strong>{formatDateTime(cellStats?.last_loaded_at)}</strong>
              </div>
            </div>

            {cellLoadReport && (
              <pre className="service-json">{JSON.stringify(cellLoadReport, null, 2)}</pre>
            )}
          </div>
        )}

        {activeCategory === 'project_data' && (
          <div className="service-card">
            <h3>Состояние данных проекта</h3>
            <p className="service-card-hint">
              Сводная статистика загруженных данных и производных таблиц по активному проекту.
            </p>

            <div className="service-row">
              <button
                type="button"
                className="service-btn"
                onClick={() => void fetchProjectStats()}
                disabled={!projectId || projectStatsLoading}
              >
                {projectStatsLoading ? 'Обновление...' : 'Обновить статистику проекта'}
              </button>
              <button
                type="button"
                className="service-btn primary"
                onClick={() => void handleEnrichCellTowersByAddress()}
                disabled={!projectId || enrichLoading}
                title="Добавить в справочник БС координаты по совпадающим адресам из данных проекта"
              >
                {enrichLoading ? 'Обогащение...' : 'Обогатить БС по адресам'}
              </button>
            </div>

            {!projectId ? (
              <div className="service-empty">Выбери проект в левой панели, чтобы увидеть статистику.</div>
            ) : (
              <>
                <div className="service-report-grid">
                  <div className="service-report-item">
                    <span>Периодов локаций (всего)</span>
                    <strong>{projectStats?.location_timeline_count ?? 0}</strong>
                  </div>
                  <div className="service-report-item">
                    <span>Периодов с координатами</span>
                    <strong>{projectStats?.location_timeline_geocoded_count ?? 0}</strong>
                  </div>
                  <div className="service-report-item">
                    <span>Покрытие геокодирования</span>
                    <strong>{locationCoverage}</strong>
                  </div>
                  <div className="service-report-item">
                    <span>Загружено записей БС</span>
                    <strong>{projectStats?.cell_tower_reference_count ?? 0}</strong>
                  </div>
                </div>
                <pre className="service-json">{JSON.stringify(projectStats ?? {}, null, 2)}</pre>
                {enrichReport && (
                  <pre className="service-json">{JSON.stringify(enrichReport, null, 2)}</pre>
                )}
              </>
            )}
          </div>
        )}

        {activeCategory === 'console_registry' && (
          <div className="service-console-grid">
            <div className="service-card">
              <div className="service-card-header">
                <div>
                  <h3>Источники данных MS SQL</h3>
                  <p className="service-card-hint">
                    Здесь регистрируем только подключения. Сами хранимые процедуры уже существуют и создаются другими разработчиками.
                  </p>
                </div>
                <div className="service-row">
                  <button type="button" className="service-btn" onClick={() => void fetchConsoleRegistry()} disabled={consoleLoading}>
                    {consoleLoading ? 'Обновление...' : 'Обновить'}
                  </button>
                  <button
                    type="button"
                    className="service-btn"
                    onClick={() => void handleTestDataSource()}
                    disabled={!selectedSourceKey || consoleTestingSource}
                  >
                    {consoleTestingSource ? 'Проверка...' : 'Проверить подключение'}
                  </button>
                  <button type="button" className="service-btn" onClick={resetDataSourceForm}>
                    Новый источник
                  </button>
                  <button
                    type="button"
                    className="service-btn danger"
                    onClick={() => void handleDeleteDataSource()}
                    disabled={!selectedSourceKey || consoleSaving}
                  >
                    Удалить источник
                  </button>
                </div>
              </div>

              <div className="service-list">
                <input
                  className="service-input"
                  type="text"
                  value={sourceSearch}
                  onChange={(event) => setSourceSearch(event.target.value)}
                  placeholder="Поиск по источникам данных"
                  style={{ minWidth: 0 }}
                />
                {filteredDataSources.map((source) => (
                  <button
                    key={source.key}
                    type="button"
                    className={`service-list-item ${selectedSourceKey === source.key ? 'active' : ''}`}
                    onClick={() => setSelectedSourceKey(source.key)}
                  >
                    <strong>{source.name}</strong>
                    <span>{source.key}</span>
                    <span>{source.host}:{source.port} / {source.database_name}</span>
                  </button>
                ))}
                {!filteredDataSources.length && (
                  <div className="service-empty">
                    {consoleDataSources.length ? 'По текущему фильтру источники не найдены.' : 'Источники данных ещё не зарегистрированы.'}
                  </div>
                )}
              </div>

              <div className="service-form-grid">
                <label className="service-field">
                  <span>Ключ</span>
                  <input className="service-input" value={dataSourceForm.key} onChange={(event) => setDataSourceForm((prev) => ({ ...prev, key: event.target.value }))} />
                </label>
                <label className="service-field">
                  <span>Название</span>
                  <input className="service-input" value={dataSourceForm.name} onChange={(event) => setDataSourceForm((prev) => ({ ...prev, name: event.target.value }))} />
                </label>
                <label className="service-field service-field-wide">
                  <span>Описание</span>
                  <input className="service-input" value={dataSourceForm.description} onChange={(event) => setDataSourceForm((prev) => ({ ...prev, description: event.target.value }))} />
                </label>
                <label className="service-field">
                  <span>Host</span>
                  <input className="service-input" value={dataSourceForm.host} onChange={(event) => setDataSourceForm((prev) => ({ ...prev, host: event.target.value }))} />
                </label>
                <label className="service-field">
                  <span>Port</span>
                  <input className="service-input" value={dataSourceForm.port} onChange={(event) => setDataSourceForm((prev) => ({ ...prev, port: event.target.value }))} />
                </label>
                <label className="service-field">
                  <span>База данных</span>
                  <input className="service-input" value={dataSourceForm.database_name} onChange={(event) => setDataSourceForm((prev) => ({ ...prev, database_name: event.target.value }))} />
                </label>
                <label className="service-field">
                  <span>Пользователь</span>
                  <input className="service-input" value={dataSourceForm.username} onChange={(event) => setDataSourceForm((prev) => ({ ...prev, username: event.target.value }))} />
                </label>
                <label className="service-field">
                  <span>Пароль</span>
                  <input className="service-input" type="password" value={dataSourceForm.password} onChange={(event) => setDataSourceForm((prev) => ({ ...prev, password: event.target.value }))} placeholder={selectedSource?.has_password ? 'Оставь пустым, чтобы не менять' : ''} />
                </label>
                <label className="service-field">
                  <span>Driver</span>
                  <input className="service-input" value={dataSourceForm.driver} onChange={(event) => setDataSourceForm((prev) => ({ ...prev, driver: event.target.value }))} />
                </label>
                <label className="service-field">
                  <span>Auth type</span>
                  <input className="service-input" value={dataSourceForm.auth_type} onChange={(event) => setDataSourceForm((prev) => ({ ...prev, auth_type: event.target.value }))} />
                </label>
                <label className="service-field">
                  <span>DBMS</span>
                  <input className="service-input" value={dataSourceForm.dbms} onChange={(event) => setDataSourceForm((prev) => ({ ...prev, dbms: event.target.value }))} />
                </label>
                <label className="service-checkbox">
                  <input type="checkbox" checked={dataSourceForm.is_active} onChange={(event) => setDataSourceForm((prev) => ({ ...prev, is_active: event.target.checked }))} />
                  <span>Источник активен</span>
                </label>
                <label className="service-field service-field-wide">
                  <span>Опции подключения (JSON)</span>
                  <textarea className="service-textarea" rows={6} value={dataSourceForm.optionsText} onChange={(event) => setDataSourceForm((prev) => ({ ...prev, optionsText: event.target.value }))} />
                </label>
              </div>

              <div className="service-row">
                <button type="button" className="service-btn primary" onClick={() => void handleSaveDataSource()} disabled={consoleSaving}>
                  {consoleSaving ? 'Сохранение...' : (selectedSourceKey ? 'Сохранить источник' : 'Создать источник')}
                </button>
              </div>
            </div>

            <div className="service-card">
              <div className="service-card-header">
                <div>
                  <h3>Соответствия типов объектов</h3>
                  <p className="service-card-hint">
                    Граф продолжает жить со своими типами, а процедуры получают ожидаемые типы объектов вроде
                    {' '}
                    <code>MSISDN</code>
                    ,
                    {' '}
                    <code>IMEI</code>
                    {' '}
                    и
                    {' '}
                    <code>IMSI</code>
                    .
                  </p>
                </div>
                <div className="service-row">
                  <button type="button" className="service-btn" onClick={resetObjectTypeMappings}>
                    Базовые соответствия
                  </button>
                  <button type="button" className="service-btn" onClick={addObjectTypeMapping}>
                    Добавить строку
                  </button>
                </div>
              </div>

              {consoleObjectTypeMappings.length === 0 ? (
                <div className="service-empty">Соответствия пока не заданы.</div>
              ) : (
                <div className="service-mapping-table">
                  <div className="service-mapping-row service-mapping-row-header">
                    <div>Тип на графе</div>
                    <div>Тип для процедуры</div>
                    <div>Активно</div>
                    <div />
                  </div>
                  {consoleObjectTypeMappings.map((mapping) => (
                    <div key={mapping.id} className="service-mapping-row">
                      <input
                        className="service-input service-mapping-input"
                        value={mapping.graph_type}
                        onChange={(event) => updateObjectTypeMapping(mapping.id, { graph_type: event.target.value })}
                        placeholder="person"
                      />
                      <input
                        className="service-input service-mapping-input"
                        value={mapping.procedure_type}
                        onChange={(event) => updateObjectTypeMapping(mapping.id, { procedure_type: event.target.value })}
                        placeholder="MSISDN"
                      />
                      <label className="service-checkbox service-mapping-checkbox">
                        <input
                          type="checkbox"
                          checked={mapping.is_active}
                          onChange={(event) => updateObjectTypeMapping(mapping.id, { is_active: event.target.checked })}
                        />
                        <span>Да</span>
                      </label>
                      <button
                        type="button"
                        className="service-btn danger"
                        onClick={() => removeObjectTypeMapping(mapping.id)}
                      >
                        Удалить
                      </button>
                    </div>
                  ))}
                </div>
              )}

              <div className="service-row">
                <button
                  type="button"
                  className="service-btn primary"
                  onClick={() => void handleSaveObjectTypeMappings()}
                  disabled={consoleSaving}
                >
                  {consoleSaving ? 'Сохранение...' : 'Сохранить соответствия'}
                </button>
              </div>
            </div>

            <div className="service-card">
              <div className="service-card-header">
                <div>
                  <h3>Реестр хранимых процедур</h3>
                  <p className="service-card-hint">
                    Описываем уже существующие процедуры: источник, schema/name, параметры, связи с графовым контекстом и маппинг result set в интерфейс.
                  </p>
                </div>
                <div className="service-row">
                  <button type="button" className="service-btn" onClick={resetProcedureForm}>
                    Новая процедура
                  </button>
                  <button
                    type="button"
                    className="service-btn"
                    onClick={handleDuplicateProcedureTemplate}
                    disabled={!selectedProcedure}
                  >
                    Дублировать как шаблон
                  </button>
                  <button
                    type="button"
                    className="service-btn danger"
                    onClick={() => void handleDeleteProcedure()}
                    disabled={!selectedProcedureKey || consoleSaving}
                  >
                    Удалить процедуру
                  </button>
                </div>
              </div>

              <div className="service-list">
                <input
                  className="service-input"
                  type="text"
                  value={procedureSearch}
                  onChange={(event) => setProcedureSearch(event.target.value)}
                  placeholder="Поиск по процедурам"
                  style={{ minWidth: 0 }}
                />
                {filteredProcedures.map((procedure) => (
                  <button
                    key={String(procedure.key || procedure.id)}
                    type="button"
                    className={`service-list-item ${selectedProcedureKey === String(procedure.key || procedure.id) ? 'active' : ''}`}
                    onClick={() => setSelectedProcedureKey(String(procedure.key || procedure.id))}
                  >
                    <strong>{procedure.name}</strong>
                    <span>{procedure.key || procedure.id}</span>
                    <span>{procedure.source_name || procedure.source_key || 'Источник не задан'}</span>
                  </button>
                ))}
                {!filteredProcedures.length && (
                  <div className="service-empty">
                    {consoleProcedures.length ? 'По текущему фильтру процедуры не найдены.' : 'Процедуры ещё не зарегистрированы.'}
                  </div>
                )}
              </div>

              <div className="service-form-grid">
                <label className="service-field">
                  <span>Ключ</span>
                  <input className="service-input" value={procedureForm.key} onChange={(event) => setProcedureForm((prev) => ({ ...prev, key: event.target.value }))} />
                </label>
                <label className="service-field">
                  <span>Название</span>
                  <input className="service-input" value={procedureForm.name} onChange={(event) => setProcedureForm((prev) => ({ ...prev, name: event.target.value }))} />
                </label>
                <label className="service-field service-field-wide">
                  <span>Описание</span>
                  <input className="service-input" value={procedureForm.description} onChange={(event) => setProcedureForm((prev) => ({ ...prev, description: event.target.value }))} />
                </label>
                <label className="service-field">
                  <span>Источник</span>
                  <select className="service-input" value={procedureForm.source_key} onChange={(event) => setProcedureForm((prev) => ({ ...prev, source_key: event.target.value }))}>
                    <option value="">Выбери источник</option>
                    {consoleDataSources.map((source) => (
                      <option key={source.key} value={source.key}>{source.name} ({source.key})</option>
                    ))}
                  </select>
                </label>
                <label className="service-field">
                  <span>Schema</span>
                  <input className="service-input" value={procedureForm.schema_name} onChange={(event) => setProcedureForm((prev) => ({ ...prev, schema_name: event.target.value }))} />
                </label>
                <label className="service-field service-field-wide">
                  <span>Procedure name</span>
                  <input className="service-input" value={procedureForm.procedure_name} onChange={(event) => setProcedureForm((prev) => ({ ...prev, procedure_name: event.target.value }))} placeholder="Например usp_GetAbonentDossier" />
                </label>
                <label className="service-field">
                  <span>Timeout, сек</span>
                  <input className="service-input" value={procedureForm.timeout_seconds} onChange={(event) => setProcedureForm((prev) => ({ ...prev, timeout_seconds: event.target.value }))} />
                </label>
                <label className="service-field">
                  <span>Default limit</span>
                  <input className="service-input" value={procedureForm.default_limit} onChange={(event) => setProcedureForm((prev) => ({ ...prev, default_limit: event.target.value }))} />
                </label>
                <label className="service-checkbox">
                  <input type="checkbox" checked={procedureForm.supports_graph_selection} onChange={(event) => setProcedureForm((prev) => ({ ...prev, supports_graph_selection: event.target.checked }))} />
                  <span>Поддерживает выделение графа</span>
                </label>
                <label className="service-checkbox">
                  <input type="checkbox" checked={procedureForm.is_active} onChange={(event) => setProcedureForm((prev) => ({ ...prev, is_active: event.target.checked }))} />
                  <span>Процедура активна</span>
                </label>
              </div>

              <div className="service-editor-block">
                <div className="service-editor-header">
                  <div>
                    <h4>Параметры процедуры</h4>
                    <p>Здесь настраиваем форму запуска и правила автопривязки к графовому выделению.</p>
                  </div>
                  <div className="service-row">
                    <button type="button" className="service-btn" onClick={applyObjectsAnalysisPreset}>
                      Шаблон Objects/Types
                    </button>
                    <button type="button" className="service-btn" onClick={addProcedureParam}>
                      Добавить параметр
                    </button>
                  </div>
                </div>

                {procedureForm.params.length === 0 ? (
                  <div className="service-empty">Параметры пока не описаны.</div>
                ) : (
                  <div className="service-editor-list">
                    {procedureForm.params.map((param, index) => (
                      <div key={param.id} className="service-editor-card">
                        <div className="service-editor-card-header">
                          <strong>Параметр #{index + 1}</strong>
                          <button type="button" className="service-btn danger" onClick={() => removeProcedureParam(param.id)}>
                            Удалить
                          </button>
                        </div>

                        <div className="service-form-grid">
                          <label className="service-field">
                            <span>Имя параметра</span>
                            <input className="service-input" value={param.name} onChange={(event) => updateProcedureParam(param.id, { name: event.target.value })} placeholder="Например msisdn или selection_json" />
                          </label>
                          <label className="service-field">
                            <span>Подпись в UI</span>
                            <input className="service-input" value={param.label} onChange={(event) => updateProcedureParam(param.id, { label: event.target.value })} />
                          </label>
                          <label className="service-field">
                            <span>Тип</span>
                            <select className="service-input" value={param.type} onChange={(event) => updateProcedureParam(param.id, { type: event.target.value })}>
                              {paramTypeOptions.map((option) => (
                                <option key={option.value} value={option.value}>{option.label}</option>
                              ))}
                            </select>
                          </label>
                          <label className="service-field">
                            <span>Режим заполнения</span>
                            <select className="service-input" value={param.binding_mode} onChange={(event) => updateProcedureParam(param.id, { binding_mode: event.target.value })}>
                              {bindingModeOptions.map((option) => (
                                <option key={option.value} value={option.value}>{option.label}</option>
                              ))}
                            </select>
                          </label>

                          {(param.binding_mode === 'manual' || param.binding_mode === 'fixed') && (
                            <label className="service-field">
                              <span>{param.binding_mode === 'fixed' ? 'Фиксированное значение' : 'Значение по умолчанию'}</span>
                              <input className="service-input" value={param.defaultValue} onChange={(event) => updateProcedureParam(param.id, { defaultValue: event.target.value })} />
                            </label>
                          )}

                          {param.binding_mode === 'project_context' && (
                            <label className="service-field">
                              <span>Что брать из контекста</span>
                              <select className="service-input" value={param.binding_source} onChange={(event) => updateProcedureParam(param.id, { binding_source: event.target.value })}>
                                <option value="">Выбери источник значения</option>
                                {projectContextSourceOptions.map((option) => (
                                  <option key={option.value} value={option.value}>{option.label}</option>
                                ))}
                              </select>
                            </label>
                          )}

                          {param.binding_mode === 'selected_node_attr_csv' && (
                            <label className="service-field">
                              <span>Ключ атрибута узла</span>
                              <input className="service-input" value={param.binding_attr_key} onChange={(event) => updateProcedureParam(param.id, { binding_attr_key: event.target.value })} placeholder="Например msisdn или imsi" />
                            </label>
                          )}

                          <label className="service-checkbox">
                            <input type="checkbox" checked={param.required} onChange={(event) => updateProcedureParam(param.id, { required: event.target.checked })} />
                            <span>Обязательный параметр</span>
                          </label>
                          <label className="service-checkbox">
                            <input type="checkbox" checked={param.hidden} onChange={(event) => updateProcedureParam(param.id, { hidden: event.target.checked })} />
                            <span>Скрыть в форме запуска</span>
                          </label>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="service-editor-block">
                <div className="service-editor-header">
                  <div>
                    <h4>Result set и колонки</h4>
                    <p>Здесь задаём вкладки результата и человекочитаемые названия колонок, которые вернёт процедура.</p>
                  </div>
                  <button type="button" className="service-btn" onClick={addResultSet}>
                    Добавить result set
                  </button>
                </div>

                {procedureForm.resultSets.length === 0 ? (
                  <div className="service-empty">Result set пока не описаны.</div>
                ) : (
                  <div className="service-editor-list">
                    {procedureForm.resultSets.map((resultSet, resultSetIndex) => (
                      <div key={resultSet.id} className="service-editor-card">
                        <div className="service-editor-card-header">
                          <strong>Result set #{resultSetIndex + 1}</strong>
                          <div className="service-row">
                            <button type="button" className="service-btn" onClick={() => addColumnToResultSet(resultSet.id)}>
                              Добавить колонку
                            </button>
                            <button type="button" className="service-btn danger" onClick={() => removeResultSet(resultSet.id)}>
                              Удалить
                            </button>
                          </div>
                        </div>

                        <div className="service-form-grid">
                          <label className="service-field">
                            <span>Порядковый индекс</span>
                            <input className="service-input" value={resultSet.result_index} onChange={(event) => updateResultSet(resultSet.id, { result_index: event.target.value })} />
                          </label>
                          <label className="service-field">
                            <span>Ключ вкладки</span>
                            <input className="service-input" value={resultSet.result_key} onChange={(event) => updateResultSet(resultSet.id, { result_key: event.target.value })} />
                          </label>
                          <label className="service-field service-field-wide">
                            <span>Название вкладки</span>
                            <input className="service-input" value={resultSet.name} onChange={(event) => updateResultSet(resultSet.id, { name: event.target.value })} />
                          </label>
                          <label className="service-checkbox">
                            <input type="checkbox" checked={resultSet.visible} onChange={(event) => updateResultSet(resultSet.id, { visible: event.target.checked })} />
                            <span>Показывать вкладку</span>
                          </label>
                        </div>

                        {resultSet.columns.length === 0 ? (
                          <div className="service-empty">Колонки ещё не описаны. Их можно добавлять по мере договорённости с авторами процедуры.</div>
                        ) : (
                          <div className="service-column-grid">
                            {resultSet.columns.map((column, columnIndex) => (
                              <div key={column.id} className="service-column-card">
                                <div className="service-editor-card-header">
                                  <strong>Колонка #{columnIndex + 1}</strong>
                                  <button type="button" className="service-btn danger" onClick={() => removeColumnFromResultSet(resultSet.id, column.id)}>
                                    Удалить
                                  </button>
                                </div>
                                <div className="service-form-grid">
                                  <label className="service-field">
                                    <span>Оригинальное имя</span>
                                    <input className="service-input" value={column.key} onChange={(event) => updateColumnInResultSet(resultSet.id, column.id, { key: event.target.value })} placeholder="Например subscriber_id" />
                                  </label>
                                  <label className="service-field">
                                    <span>Подпись в интерфейсе</span>
                                    <input className="service-input" value={column.label} onChange={(event) => updateColumnInResultSet(resultSet.id, column.id, { label: event.target.value })} />
                                  </label>
                                  <label className="service-field">
                                    <span>Тип</span>
                                    <select className="service-input" value={column.type} onChange={(event) => updateColumnInResultSet(resultSet.id, column.id, { type: event.target.value })}>
                                      {columnTypeOptions.map((option) => (
                                        <option key={option.value} value={option.value}>{option.label}</option>
                                      ))}
                                    </select>
                                  </label>
                                  <label className="service-field">
                                    <span>Ширина колонки, px</span>
                                    <input className="service-input" value={column.width} onChange={(event) => updateColumnInResultSet(resultSet.id, column.id, { width: event.target.value })} placeholder="Например 180" />
                                  </label>
                                  <label className="service-checkbox">
                                    <input type="checkbox" checked={column.visible} onChange={(event) => updateColumnInResultSet(resultSet.id, column.id, { visible: event.target.checked })} />
                                    <span>Показывать колонку</span>
                                  </label>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="service-row">
                <button type="button" className="service-btn primary" onClick={() => void handleSaveProcedure()} disabled={consoleSaving}>
                  {consoleSaving ? 'Сохранение...' : (selectedProcedureKey ? 'Сохранить процедуру' : 'Зарегистрировать процедуру')}
                </button>
              </div>
            </div>
          </div>
        )}
      </section>
    </div>
  );
};

export default ServiceFunctionsView;
