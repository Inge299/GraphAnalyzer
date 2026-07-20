import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { consoleApi, projectDataApi } from '../../services/api';
import type {
  ConsoleDataSource,
  ConsoleObjectTypeMapping,
  ConsoleProcedureColumn,
  ConsoleProcedureParam,
  ConsoleProcedureResultSet,
  ConsoleProfile,
  ProjectDataLoadResponse,
} from '../../types/api';
import './ServiceFunctionsView.css';

export type ServiceCategory = 'cell_towers' | 'project_data' | 'console_registry';

interface ServiceFunctionsViewProps {
  projectId: number | null;
  initialCategory?: ServiceCategory;
  mode?: 'full' | 'project_data_only';
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

interface ProjectDataSelectedFileItem {
  id: string;
  file: File;
  name: string;
  kind: string;
  sizeBytes: number;
}

const categoryLabels: Record<ServiceCategory, string> = {
  cell_towers: 'Справочник БС',
  project_data: 'Данные проекта',
  console_registry: 'Консоль / процедуры',
};

const defaultReferencePath = 'reference/cell_towers_full.csv';

const detectProjectDataFileKind = (fileName: string): string => {
  const normalized = fileName.trim().toLowerCase();
  if (normalized.includes('communications')) return 'Связи абонентов';
  if (normalized.includes('device_history')) return 'История устройств';
  if (normalized.includes('location_events')) return 'События локаций';
  if (normalized.includes('ip_bindings')) return 'IP-привязки';
  if (normalized.includes('manifest')) return 'Манифест';
  return 'Прочее';
};

const formatBytes = (sizeBytes: number): string => {
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
      label: 'Р’С‹РґРµР»РµРЅРёРµ РіСЂР°С„Р° (JSON)',
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
    label: 'РћР±СЉРµРєС‚С‹',
    type: 'string',
    binding_mode: 'selected_node_labels_csv',
  },
  {
    ...createDefaultProcedureParam(),
    name: 'ObjectsType',
    label: 'РўРёРїС‹ РѕР±СЉРµРєС‚РѕРІ',
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
    label: 'РќР°С‡Р°Р»Рѕ РїРµСЂРёРѕРґР°',
    type: 'date',
    binding_mode: 'manual',
  },
  {
    ...createDefaultProcedureParam(),
    name: 'EndTime',
    label: 'РљРѕРЅРµС† РїРµСЂРёРѕРґР°',
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

const isTimeoutError = (error: unknown): boolean => {
  if (error instanceof Error) {
    const message = String(error.message || '').toLowerCase();
    return message.includes('timeout');
  }
  const message = String((error as any)?.message || '').toLowerCase();
  return message.includes('timeout');
};

const getRequestErrorMessage = (error: unknown, fallback: string, timeoutMessage?: string): string => {
  const detail = (error as any)?.response?.data?.detail;
  if (typeof detail === 'string' && detail.trim()) return detail;
  if (timeoutMessage && isTimeoutError(error)) return timeoutMessage;
  if (error instanceof Error && error.message) return error.message;
  const message = String((error as any)?.message || '').trim();
  return message || fallback;
};

const parseJsonInput = <T,>(raw: string, fallbackLabel: string): T => {
  try {
    return JSON.parse(raw) as T;
  } catch (error) {
    throw new Error(`${fallbackLabel}: РЅРµРєРѕСЂСЂРµРєС‚РЅС‹Р№ JSON`);
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
  name: String(resultSet.name || `Р РµР·СѓР»СЊС‚Р°С‚ ${index + 1}`).trim(),
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

const ServiceFunctionsView: React.FC<ServiceFunctionsViewProps> = ({
  projectId,
  initialCategory = 'cell_towers',
  mode = 'full',
}) => {
  const [activeCategory, setActiveCategory] = useState<ServiceCategory>(initialCategory);

  const [referencePath, setReferencePath] = useState(defaultReferencePath);
  const [cellStats, setCellStats] = useState<any | null>(null);
  const [cellStatsLoading, setCellStatsLoading] = useState(false);
  const [cellLoadLoading, setCellLoadLoading] = useState(false);
  const [cellLoadReport, setCellLoadReport] = useState<any | null>(null);

  const [projectStats, setProjectStats] = useState<any | null>(null);
  const [projectStatsLoading, setProjectStatsLoading] = useState(false);
  const [projectDataLoading, setProjectDataLoading] = useState(false);
  const [projectDataClearing, setProjectDataClearing] = useState(false);
  const [projectDataLoadReport, setProjectDataLoadReport] = useState<any | null>(null);
  const [projectDataLastLoadResult, setProjectDataLastLoadResult] = useState<ProjectDataLoadResponse | null>(null);
  const [projectDataSelectedFiles, setProjectDataSelectedFiles] = useState<ProjectDataSelectedFileItem[]>([]);
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
  const [projectStatsError, setProjectStatsError] = useState<string | null>(null);
  const [cellStatsError, setCellStatsError] = useState<string | null>(null);
  const projectDataFilesInputRef = useRef<HTMLInputElement | null>(null);
  const projectDataFileInputId = 'project-data-files-input';

  const projectDataSelectedSummary = useMemo(() => {
    const totalSizeBytes = projectDataSelectedFiles.reduce((sum, item) => sum + item.sizeBytes, 0);
    const byKind = projectDataSelectedFiles.reduce<Record<string, number>>((acc, item) => {
      acc[item.kind] = (acc[item.kind] || 0) + 1;
      return acc;
    }, {});
    return {
      totalFiles: projectDataSelectedFiles.length,
      totalSizeBytes,
      byKind: Object.entries(byKind),
    };
  }, [projectDataSelectedFiles]);

  const fetchCellStats = useCallback(async () => {
    setCellStatsLoading(true);
    setCellStatsError(null);
    try {
      const stats = await projectDataApi.cellTowerStats();
      setCellStats(stats);
    } catch (err: any) {
      setCellStatsError(
        getRequestErrorMessage(
          err,
          'Не удалось получить статистику справочника БС',
          'Статистика справочника БС обновляется дольше обычного. Попробуй повторить через минуту.',
        ),
      );
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
    setProjectStatsError(null);
    try {
      const stats = await projectDataApi.stats(projectId);
      setProjectStats(stats);
    } catch (err: any) {
      setProjectStatsError(
        getRequestErrorMessage(
          err,
          'Не удалось получить статистику проекта',
          'Статистика проекта обновляется дольше обычного. Попробуй повторить через минуту.',
        ),
      );
    } finally {
      setProjectStatsLoading(false);
    }
  }, [projectId]);

  const handleLoadProjectDataFiles = useCallback(async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files ?? []);
    event.target.value = '';
    if (files.length === 0) return;
    setError(null);
    setProjectDataLoadReport(null);
    setProjectDataLastLoadResult(null);
    setMessage(`Выбрано файлов: ${files.length}. Проверь список и нажми «Загрузить выбранные».`);
    setProjectDataSelectedFiles((prev) => {
      const known = new Set(prev.map((item) => `${item.name}::${item.sizeBytes}::${item.file.lastModified}`));
      const next = [...prev];
      files.forEach((file) => {
        const key = `${file.name}::${file.size}::${file.lastModified}`;
        if (known.has(key)) return;
        next.push({
          id: createLocalId('project-file'),
          file,
          name: file.name,
          kind: detectProjectDataFileKind(file.name),
          sizeBytes: file.size,
        });
        known.add(key);
      });
      return next;
    });
  }, []);

  const handleRemoveProjectDataFile = useCallback((fileId: string) => {
    setProjectDataSelectedFiles((prev) => prev.filter((item) => item.id !== fileId));
  }, []);

  const handleClearProjectDataSelection = useCallback(() => {
    setProjectDataSelectedFiles([]);
    setMessage(null);
  }, []);

  const handleUploadProjectData = useCallback(async () => {
    if (!projectId || projectDataSelectedFiles.length === 0) return;

    const files = projectDataSelectedFiles.map((item) => item.file);
    setProjectDataLoading(true);
    setError(null);
    setMessage(null);
    setProjectDataLoadReport(null);
    setProjectDataLastLoadResult(null);

    try {
      const result = await projectDataApi.loadFromFiles(projectId, files);
      const totalRead =
        Number(result.communications_rows || 0) +
        Number(result.device_history_rows || 0) +
        Number(result.location_events_rows || 0) +
        Number(result.ip_bindings_rows || 0) +
        Number(result.user_msisdn_facts_rows || 0) +
        Number(result.ip_msisdn_facts_rows || 0) +
        Number(result.msisdn_device_facts_rows || 0) +
        Number(result.msisdn_text_facts_rows || 0);
      const totalInserted =
        Number(result.inserted_communications || 0) +
        Number(result.inserted_device_history || 0) +
        Number(result.inserted_location_events || 0) +
        Number(result.inserted_ip_bindings || 0) +
        Number(result.inserted_user_msisdn_facts || 0) +
        Number(result.inserted_ip_msisdn_facts || 0) +
        Number(result.inserted_msisdn_device_facts || 0) +
        Number(result.inserted_msisdn_text_facts || 0);

      setMessage(`Данные проекта загружены: прочитано ${totalRead} строк, добавлено ${totalInserted}.`);
      setProjectDataLastLoadResult(result);
      if (result.load_log) {
        setProjectDataLoadReport(result.load_log);
      }
      setProjectDataSelectedFiles([]);
      try {
        await Promise.all([fetchProjectStats(), fetchCellStats()]);
      } catch {
        setMessage(
          `Данные проекта загружены: прочитано ${totalRead} строк, добавлено ${totalInserted}. Статистика обновится чуть позже.`,
        );
      }
    } catch (err: any) {
      setError(
        getRequestErrorMessage(
          err,
          'Не удалось загрузить данные проекта',
          'Загрузка данных проекта выполняется слишком долго. Попробуй повторить запуск и дай операции больше времени.',
        ),
      );
    } finally {
      setProjectDataLoading(false);
    }
  }, [fetchCellStats, fetchProjectStats, projectDataSelectedFiles, projectId]);

  const handleClearProjectData = useCallback(async () => {
    if (!projectId) return;
    const confirmed = window.confirm(`Очистить данные проекта?\n\nProject ID: ${projectId}`);
    if (!confirmed) return;

    setProjectDataClearing(true);
    setError(null);
    setMessage(null);
    setProjectDataLoadReport(null);
    setProjectDataLastLoadResult(null);

    try {
      const result = await projectDataApi.clear(projectId);
      setMessage(
        `Данные проекта очищены: удалено связей ${result.communications_deleted || 0}, устройств ${result.device_history_deleted || 0}, локаций ${result.location_events_deleted || 0}, IP ${result.ip_bindings_deleted || 0}.`,
      );
      try {
        await fetchProjectStats();
      } catch {
        setMessage(
          `Данные проекта очищены: удалено связей ${result.communications_deleted || 0}, устройств ${result.device_history_deleted || 0}, локаций ${result.location_events_deleted || 0}, IP ${result.ip_bindings_deleted || 0}. Статистика обновится чуть позже.`,
        );
      }
    } catch (err: any) {
      setError(
        getRequestErrorMessage(
          err,
          'Не удалось очистить данные проекта',
          'Очистка данных проекта выполняется дольше обычного. Попробуй повторить через минуту.',
        ),
      );
    } finally {
      setProjectDataClearing(false);
    }
  }, [fetchProjectStats, projectId]);

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
      try {
        await Promise.all([fetchCellStats(), fetchProjectStats()]);
      } catch {
        setMessage('Справочник БС обогащён по адресам из данных проекта. Статистика обновится чуть позже.');
      }
    } catch (err: any) {
      setError(
        getRequestErrorMessage(
          err,
          'Не удалось обогатить справочник по адресам',
          'Обогащение справочника БС по адресам выполняется дольше обычного. Попробуй повторить позже или увеличить объём времени на операцию.',
        ),
      );
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

  useEffect(() => {
    setActiveCategory(initialCategory);
    setMessage(null);
    setError(null);
  }, [initialCategory]);

  useEffect(() => {
    setProjectDataSelectedFiles([]);
    setProjectDataLoadReport(null);
    setProjectDataLastLoadResult(null);
  }, [projectId]);

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

  const categories = useMemo<ServiceCategory[]>(
    () =>
      mode === 'project_data_only'
        ? ['project_data']
        : (Object.keys(categoryLabels) as ServiceCategory[]).filter(
            (category): category is Exclude<ServiceCategory, 'project_data'> => category !== 'project_data',
          ),
    [mode],
  );

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
        options: parseJsonInput<Record<string, any>>(dataSourceForm.optionsText || '{}', 'РћРїС†РёРё datasource'),
      };

      if (selectedSourceKey) {
        await consoleApi.updateDataSource(selectedSourceKey, payload);
        setMessage(`РСЃС‚РѕС‡РЅРёРє РґР°РЅРЅС‹С… ${payload.key} РѕР±РЅРѕРІР»С‘РЅ`);
      } else {
        await consoleApi.createDataSource(payload);
        setMessage(`РСЃС‚РѕС‡РЅРёРє РґР°РЅРЅС‹С… ${payload.key} СЃРѕР·РґР°РЅ`);
      }
      await fetchConsoleRegistry();
      setSelectedSourceKey(payload.key);
    } catch (err: any) {
      setError(String(err?.response?.data?.detail || err?.message || 'РќРµ СѓРґР°Р»РѕСЃСЊ СЃРѕС…СЂР°РЅРёС‚СЊ РёСЃС‚РѕС‡РЅРёРє РґР°РЅРЅС‹С…'));
    } finally {
      setConsoleSaving(false);
    }
  }, [dataSourceForm, fetchConsoleRegistry, selectedSourceKey]);

  const handleTestDataSource = useCallback(async () => {
    if (!selectedSourceKey) {
      setError('РЎРЅР°С‡Р°Р»Р° РІС‹Р±РµСЂРё РёР»Рё СЃРѕС…СЂР°РЅРё datasource');
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
      setError(String(err?.response?.data?.detail || err?.message || 'РќРµ СѓРґР°Р»РѕСЃСЊ РїСЂРѕРІРµСЂРёС‚СЊ РїРѕРґРєР»СЋС‡РµРЅРёРµ'));
    } finally {
      setConsoleTestingSource(false);
    }
  }, [selectedSourceKey]);

  const handleDeleteDataSource = useCallback(async () => {
    if (!selectedSourceKey || !selectedSource) {
      setError('РЎРЅР°С‡Р°Р»Р° РІС‹Р±РµСЂРё datasource РґР»СЏ СѓРґР°Р»РµРЅРёСЏ');
      return;
    }
    const confirmed = window.confirm(
      `РЈРґР°Р»РёС‚СЊ РёСЃС‚РѕС‡РЅРёРє РґР°РЅРЅС‹С… "${selectedSource.name}" (${selectedSource.key})?`,
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
      setError(String(err?.response?.data?.detail || err?.message || 'РќРµ СѓРґР°Р»РѕСЃСЊ СѓРґР°Р»РёС‚СЊ РёСЃС‚РѕС‡РЅРёРє РґР°РЅРЅС‹С…'));
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
      setMessage('РЎРѕРѕС‚РІРµС‚СЃС‚РІРёСЏ С‚РёРїРѕРІ РѕР±СЉРµРєС‚РѕРІ СЃРѕС…СЂР°РЅРµРЅС‹');
    } catch (err: any) {
      setError(String(err?.response?.data?.detail || err?.message || 'РќРµ СѓРґР°Р»РѕСЃСЊ СЃРѕС…СЂР°РЅРёС‚СЊ СЃРѕРѕС‚РІРµС‚СЃС‚РІРёСЏ С‚РёРїРѕРІ РѕР±СЉРµРєС‚РѕРІ'));
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
        setMessage(`РџСЂРѕС†РµРґСѓСЂР° ${payload.key} РѕР±РЅРѕРІР»РµРЅР°`);
      } else {
        await consoleApi.createProcedure(payload);
        setMessage(`РџСЂРѕС†РµРґСѓСЂР° ${payload.key} Р·Р°СЂРµРіРёСЃС‚СЂРёСЂРѕРІР°РЅР°`);
      }
      await fetchConsoleRegistry();
      setSelectedProcedureKey(payload.key);
    } catch (err: any) {
      setError(String(err?.response?.data?.detail || err?.message || 'РќРµ СѓРґР°Р»РѕСЃСЊ СЃРѕС…СЂР°РЅРёС‚СЊ РїСЂРѕС†РµРґСѓСЂСѓ'));
    } finally {
      setConsoleSaving(false);
    }
  }, [fetchConsoleRegistry, procedureForm, selectedProcedureKey]);

  const handleDeleteProcedure = useCallback(async () => {
    if (!selectedProcedureKey || !selectedProcedure) {
      setError('РЎРЅР°С‡Р°Р»Р° РІС‹Р±РµСЂРё РїСЂРѕС†РµРґСѓСЂСѓ РґР»СЏ СѓРґР°Р»РµРЅРёСЏ');
      return;
    }
    const confirmed = window.confirm(
      `РЈРґР°Р»РёС‚СЊ Р·Р°СЂРµРіРёСЃС‚СЂРёСЂРѕРІР°РЅРЅСѓСЋ РїСЂРѕС†РµРґСѓСЂСѓ "${selectedProcedure.name}" (${selectedProcedure.key || selectedProcedure.id})?`,
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
      setError(String(err?.response?.data?.detail || err?.message || 'РќРµ СѓРґР°Р»РѕСЃСЊ СѓРґР°Р»РёС‚СЊ РїСЂРѕС†РµРґСѓСЂСѓ'));
    } finally {
      setConsoleSaving(false);
    }
  }, [fetchConsoleRegistry, selectedProcedure, selectedProcedureKey]);

  const handleDuplicateProcedureTemplate = useCallback(() => {
    if (!selectedProcedure) {
      setError('РЎРЅР°С‡Р°Р»Р° РІС‹Р±РµСЂРё РїСЂРѕС†РµРґСѓСЂСѓ, РєРѕС‚РѕСЂСѓСЋ С…РѕС‡РµС€СЊ РІР·СЏС‚СЊ РєР°Рє С€Р°Р±Р»РѕРЅ');
      return;
    }

    const baseKey = String(selectedProcedure.key || selectedProcedure.id || '').trim();
    const baseName = String(selectedProcedure.name || '').trim();

    setSelectedProcedureKey('');
    setProcedureForm({
      key: baseKey ? `${baseKey}_copy` : '',
      name: baseName ? `${baseName} (РєРѕРїРёСЏ)` : '',
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
    setMessage(`РџСЂРѕС†РµРґСѓСЂР° "${selectedProcedure.name}" СЃРєРѕРїРёСЂРѕРІР°РЅР° РІ С„РѕСЂРјСѓ РєР°Рє С€Р°Р±Р»РѕРЅ`);
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
    setMessage('РЁР°Р±Р»РѕРЅ РїР°СЂР°РјРµС‚СЂРѕРІ РґР»СЏ Р°РЅР°Р»РёР·Р° РѕР±СЉРµРєС‚РѕРІ РїСЂРёРјРµРЅС‘РЅ');
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
          name: `Р РµР·СѓР»СЊС‚Р°С‚ ${prev.resultSets.length + 1}`,
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
    <div className={`service-screen ${mode === 'project_data_only' ? 'project-data-only' : ''}`}>
      {mode === 'full' && <aside className="service-screen-sidebar">
        <div className="service-screen-title">РЎРµСЂРІРёСЃРЅС‹Рµ С„СѓРЅРєС†РёРё</div>
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
      </aside>}

      <section className="service-screen-content">
        {message && <div className="service-screen-banner success">{message}</div>}
        {error && <div className="service-screen-banner error">{error}</div>}

        {activeCategory === 'cell_towers' && (
          <div className="service-card">
            <h3>Р—Р°РіСЂСѓР·РєР° СЃРїСЂР°РІРѕС‡РЅРёРєР° Р±Р°Р·РѕРІС‹С… СЃС‚Р°РЅС†РёР№</h3>
            <p className="service-card-hint">
              Р—Р°РіСЂСѓР·РєР° РїРѕР»РЅРѕСЃС‚СЊСЋ Р·Р°РјРµРЅСЏРµС‚ С‚РµРєСѓС‰РёР№ СЃРїСЂР°РІРѕС‡РЅРёРє Р‘РЎ. РСЃРїРѕР»СЊР·СѓРµС‚СЃСЏ РїСЂРё РѕРїСЂРµРґРµР»РµРЅРёРё РєРѕРѕСЂРґРёРЅР°С‚ РїРѕ MCC/MNC/LAC/CID Рё fallback LAC/CID.
            </p>

            <label className="service-label">РџСѓС‚СЊ Рє CSV (РѕС‚РЅРѕСЃРёС‚РµР»СЊРЅРѕ /app/data)</label>
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
                {cellLoadLoading ? 'Р—Р°РіСЂСѓР·РєР°...' : 'Р—Р°РіСЂСѓР·РёС‚СЊ'}
              </button>
              <button
                type="button"
                className="service-btn"
                onClick={() => void fetchCellStats()}
                disabled={cellStatsLoading}
              >
                {cellStatsLoading ? 'РћР±РЅРѕРІР»РµРЅРёРµ...' : 'РћР±РЅРѕРІРёС‚СЊ СЃС‚Р°С‚РёСЃС‚РёРєСѓ'}
              </button>
            </div>

            <div className="service-report-grid">
              <div className="service-report-item">
                <span>Р—Р°РїРёСЃРµР№ РІ СЃРїСЂР°РІРѕС‡РЅРёРєРµ</span>
                <strong>{cellStats?.cell_tower_reference_count ?? 0}</strong>
              </div>
              <div className="service-report-item">
                <span>РџРѕСЃР»РµРґРЅСЏСЏ Р·Р°РіСЂСѓР·РєР°</span>
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
            <h3>Данные проекта</h3>
            <p className="service-card-hint">
              Здесь можно загрузить или очистить исходные данные проекта, а также посмотреть краткую статистику и производные таблицы.
            </p>

            <div className="service-row">
              <input
                ref={projectDataFilesInputRef}
                id={projectDataFileInputId}
                type="file"
                multiple
                className="service-file-input"
                onChange={handleLoadProjectDataFiles}
              />
              <label
                htmlFor={projectDataFileInputId}
                className={`service-btn file-picker ${!projectId || projectDataLoading || projectDataClearing ? 'disabled' : ''}`}
              >
                Выбрать файлы
              </label>
              <button
                type="button"
                className="service-btn"
                onClick={() => void fetchProjectStats()}
                disabled={!projectId || projectStatsLoading || projectDataLoading || projectDataClearing}
              >
                {projectStatsLoading ? 'Обновление...' : 'Обновить статистику'}
              </button>
              <button
                type="button"
                className="service-btn primary"
                onClick={() => void handleUploadProjectData()}
                disabled={!projectId || projectDataLoading || projectDataClearing || projectDataSelectedFiles.length === 0}
              >
                {projectDataLoading ? 'Загрузка...' : 'Загрузить выбранные'}
              </button>
              <button
                type="button"
                className="service-btn"
                onClick={handleClearProjectDataSelection}
                disabled={projectDataLoading || projectDataSelectedFiles.length === 0}
              >
                Очистить список
              </button>
              <button
                type="button"
                className="service-btn danger"
                onClick={() => void handleClearProjectData()}
                disabled={!projectId || projectDataLoading || projectDataClearing}
              >
                {projectDataClearing ? 'Очистка...' : 'Очистить данные'}
              </button>
              <button
                type="button"
                className="service-btn"
                onClick={() => void handleEnrichCellTowersByAddress()}
                disabled={!projectId || enrichLoading || projectDataLoading || projectDataClearing}
                title="Добавить в справочник БС координаты по совпадающим адресам из данных проекта"
              >
                {enrichLoading ? 'Обогащение...' : 'Обогатить БС по адресам'}
              </button>
            </div>

            {!projectId ? (
              <div className="service-empty">Выбери проект в левой панели, чтобы работать с его данными.</div>
            ) : (
              <>
                <div className="service-upload-panel">
                  <div className="service-upload-summary">
                    <div className="service-upload-summary-item">
                      <span>Выбрано файлов</span>
                      <strong>{projectDataSelectedSummary.totalFiles}</strong>
                    </div>
                    <div className="service-upload-summary-item">
                      <span>Общий размер</span>
                      <strong>{formatBytes(projectDataSelectedSummary.totalSizeBytes)}</strong>
                    </div>
                    <div className="service-upload-summary-kinds">
                      {projectDataSelectedSummary.byKind.length > 0 ? (
                        projectDataSelectedSummary.byKind.map(([kind, count]) => (
                          <span key={kind} className="service-upload-kind-chip">{kind}: {count}</span>
                        ))
                      ) : (
                         <span className="service-upload-placeholder">Выбери набор файлов для загрузки данных проекта.</span>
                      )}
                    </div>
                  </div>

                  {projectDataSelectedFiles.length > 0 && (
                    <div className="service-upload-file-list">
                      {projectDataSelectedFiles.map((item) => (
                        <div key={item.id} className="service-upload-file-item">
                          <div className="service-upload-file-main">
                            <div className="service-upload-file-name">{item.name}</div>
                            <div className="service-upload-file-meta">
                              <span>{item.kind}</span>
                              <span>{formatBytes(item.sizeBytes)}</span>
                            </div>
                          </div>
                          <button
                            type="button"
                            className="service-upload-file-remove"
                            onClick={() => handleRemoveProjectDataFile(item.id)}
                            title="Убрать файл из списка"
                          >
                            Убрать
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {projectDataLastLoadResult && (
                  <div className="service-summary-block">
                    <div className="service-summary-header">
                      <h4>Итог последней загрузки</h4>
                      <p>Показываем, сколько записей обработано и сколько из них реально добавилось в проект.</p>
                    </div>
                    <div className="service-report-grid">
                      <div className="service-report-item">
                        <span>Связи</span>
                        <strong>
                          добавлено {projectDataLastLoadResult.inserted_communications} из {projectDataLastLoadResult.communications_rows}
                        </strong>
                      </div>
                      <div className="service-report-item">
                        <span>Устройства</span>
                        <strong>
                          добавлено {projectDataLastLoadResult.inserted_device_history} из {projectDataLastLoadResult.device_history_rows}
                        </strong>
                      </div>
                      <div className="service-report-item">
                        <span>Локации</span>
                        <strong>
                          добавлено {projectDataLastLoadResult.inserted_location_events} из {projectDataLastLoadResult.location_events_rows}
                        </strong>
                      </div>
                      <div className="service-report-item">
                        <span>IP-привязки</span>
                        <strong>
                          добавлено {projectDataLastLoadResult.inserted_ip_bindings} из {projectDataLastLoadResult.ip_bindings_rows}
                        </strong>
                      </div>
                      <div className="service-report-item">
                        <span>Ид. пользователя → MSISDN</span>
                        <strong>
                          добавлено {projectDataLastLoadResult.inserted_user_msisdn_facts} из {projectDataLastLoadResult.user_msisdn_facts_rows}
                        </strong>
                      </div>
                      <div className="service-report-item">
                        <span>IP → MSISDN пользователя</span>
                        <strong>
                          добавлено {projectDataLastLoadResult.inserted_ip_msisdn_facts} из {projectDataLastLoadResult.ip_msisdn_facts_rows}
                        </strong>
                      </div>
                      <div className="service-report-item">
                        <span>MSISDN → Устройство</span>
                        <strong>
                          добавлено {projectDataLastLoadResult.inserted_msisdn_device_facts} из {projectDataLastLoadResult.msisdn_device_facts_rows}
                        </strong>
                      </div>
                      <div className="service-report-item">
                        <span>MSISDN → Номер файла и текст</span>
                        <strong>
                          добавлено {projectDataLastLoadResult.inserted_msisdn_text_facts} из {projectDataLastLoadResult.msisdn_text_facts_rows}
                        </strong>
                      </div>
                    </div>
                  </div>
                )}

                <div className="service-summary-block">
                  <div className="service-summary-header">
                    <h4>Сейчас в проекте</h4>
                    <p>Текущее количество записей в проектных таблицах после загрузки и дедупликации.</p>
                  </div>
                  {projectStatsError ? <p className="service-inline-error">{projectStatsError}</p> : null}
                  <div className="service-report-grid">
                    <div className="service-report-item">
                      <span>Связей в проекте</span>
                      <strong>{projectStats?.communications_count ?? 0}</strong>
                    </div>
                    <div className="service-report-item">
                      <span>Устройств в проекте</span>
                      <strong>{projectStats?.device_history_count ?? 0}</strong>
                    </div>
                    <div className="service-report-item">
                      <span>Локационных событий</span>
                      <strong>{projectStats?.location_events_count ?? 0}</strong>
                    </div>
                    <div className="service-report-item">
                      <span>IP-привязок</span>
                      <strong>{projectStats?.ip_bindings_count ?? 0}</strong>
                    </div>
                    <div className="service-report-item">
                      <span>Ид. пользователя → MSISDN</span>
                      <strong>{projectStats?.user_msisdn_facts_count ?? 0}</strong>
                    </div>
                    <div className="service-report-item">
                      <span>IP → MSISDN пользователя</span>
                      <strong>{projectStats?.ip_msisdn_facts_count ?? 0}</strong>
                    </div>
                    <div className="service-report-item">
                      <span>MSISDN → Устройство</span>
                      <strong>{projectStats?.msisdn_device_facts_count ?? 0}</strong>
                    </div>
                    <div className="service-report-item">
                      <span>MSISDN → Номер файла и текст</span>
                      <strong>{projectStats?.msisdn_text_facts_count ?? 0}</strong>
                    </div>
                  </div>
                </div>

                <div className="service-summary-block">
                  <div className="service-summary-header">
                    <h4>Справочник БС</h4>
                    <p>Этот блок наполняется после загрузки справочника БС и обогащения по адресам из данных проекта.</p>
                  </div>
                  {cellStatsError ? <p className="service-inline-error">{cellStatsError}</p> : null}
                  <div className="service-report-grid">
                    <div className="service-report-item">
                      <span>Записей БС</span>
                      <strong>{cellStats?.cell_tower_reference_count ?? 0}</strong>
                    </div>
                    <div className="service-report-item">
                      <span>Последняя загрузка БС</span>
                      <strong>{formatDateTime(cellStats?.last_loaded_at)}</strong>
                    </div>
                    <div className="service-report-item">
                      <span>Совпадений по адресам</span>
                      <strong>{enrichReport?.matched_by_address ?? 0}</strong>
                    </div>
                    <div className="service-report-item">
                      <span>Добавлено при обогащении</span>
                      <strong>{enrichReport?.inserted_rows ?? 0}</strong>
                    </div>
                  </div>
                </div>
                {(projectDataLoadReport || projectStats || enrichReport) && (
                  <details className="service-technical-details">
                    <summary>Технические детали</summary>
                    {projectDataLoadReport && (
                      <pre className="service-json">{JSON.stringify(projectDataLoadReport, null, 2)}</pre>
                    )}
                    {projectStats && (
                      <pre className="service-json">{JSON.stringify(projectStats ?? {}, null, 2)}</pre>
                    )}
                    {enrichReport && (
                      <pre className="service-json">{JSON.stringify(enrichReport, null, 2)}</pre>
                    )}
                  </details>
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
                  <h3>РСЃС‚РѕС‡РЅРёРєРё РґР°РЅРЅС‹С… MS SQL</h3>
                  <p className="service-card-hint">
                    Р—РґРµСЃСЊ СЂРµРіРёСЃС‚СЂРёСЂСѓРµРј С‚РѕР»СЊРєРѕ РїРѕРґРєР»СЋС‡РµРЅРёСЏ. РЎР°РјРё С…СЂР°РЅРёРјС‹Рµ РїСЂРѕС†РµРґСѓСЂС‹ СѓР¶Рµ СЃСѓС‰РµСЃС‚РІСѓСЋС‚ Рё СЃРѕР·РґР°СЋС‚СЃСЏ РґСЂСѓРіРёРјРё СЂР°Р·СЂР°Р±РѕС‚С‡РёРєР°РјРё.
                  </p>
                </div>
                <div className="service-row">
                  <button type="button" className="service-btn" onClick={() => void fetchConsoleRegistry()} disabled={consoleLoading}>
                    {consoleLoading ? 'РћР±РЅРѕРІР»РµРЅРёРµ...' : 'РћР±РЅРѕРІРёС‚СЊ'}
                  </button>
                  <button
                    type="button"
                    className="service-btn"
                    onClick={() => void handleTestDataSource()}
                    disabled={!selectedSourceKey || consoleTestingSource}
                  >
                    {consoleTestingSource ? 'РџСЂРѕРІРµСЂРєР°...' : 'РџСЂРѕРІРµСЂРёС‚СЊ РїРѕРґРєР»СЋС‡РµРЅРёРµ'}
                  </button>
                  <button type="button" className="service-btn" onClick={resetDataSourceForm}>
                    РќРѕРІС‹Р№ РёСЃС‚РѕС‡РЅРёРє
                  </button>
                  <button
                    type="button"
                    className="service-btn danger"
                    onClick={() => void handleDeleteDataSource()}
                    disabled={!selectedSourceKey || consoleSaving}
                  >
                    РЈРґР°Р»РёС‚СЊ РёСЃС‚РѕС‡РЅРёРє
                  </button>
                </div>
              </div>

              <div className="service-list">
                <input
                  className="service-input"
                  type="text"
                  value={sourceSearch}
                  onChange={(event) => setSourceSearch(event.target.value)}
                  placeholder="РџРѕРёСЃРє РїРѕ РёСЃС‚РѕС‡РЅРёРєР°Рј РґР°РЅРЅС‹С…"
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
                    {consoleDataSources.length ? 'РџРѕ С‚РµРєСѓС‰РµРјСѓ С„РёР»СЊС‚СЂСѓ РёСЃС‚РѕС‡РЅРёРєРё РЅРµ РЅР°Р№РґРµРЅС‹.' : 'РСЃС‚РѕС‡РЅРёРєРё РґР°РЅРЅС‹С… РµС‰С‘ РЅРµ Р·Р°СЂРµРіРёСЃС‚СЂРёСЂРѕРІР°РЅС‹.'}
                  </div>
                )}
              </div>

              <div className="service-form-grid">
                <label className="service-field">
                  <span>РљР»СЋС‡</span>
                  <input className="service-input" value={dataSourceForm.key} onChange={(event) => setDataSourceForm((prev) => ({ ...prev, key: event.target.value }))} />
                </label>
                <label className="service-field">
                  <span>РќР°Р·РІР°РЅРёРµ</span>
                  <input className="service-input" value={dataSourceForm.name} onChange={(event) => setDataSourceForm((prev) => ({ ...prev, name: event.target.value }))} />
                </label>
                <label className="service-field service-field-wide">
                  <span>РћРїРёСЃР°РЅРёРµ</span>
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
                  <span>Р‘Р°Р·Р° РґР°РЅРЅС‹С…</span>
                  <input className="service-input" value={dataSourceForm.database_name} onChange={(event) => setDataSourceForm((prev) => ({ ...prev, database_name: event.target.value }))} />
                </label>
                <label className="service-field">
                  <span>РџРѕР»СЊР·РѕРІР°С‚РµР»СЊ</span>
                  <input className="service-input" value={dataSourceForm.username} onChange={(event) => setDataSourceForm((prev) => ({ ...prev, username: event.target.value }))} />
                </label>
                <label className="service-field">
                  <span>РџР°СЂРѕР»СЊ</span>
                  <input className="service-input" type="password" value={dataSourceForm.password} onChange={(event) => setDataSourceForm((prev) => ({ ...prev, password: event.target.value }))} placeholder={selectedSource?.has_password ? 'РћСЃС‚Р°РІСЊ РїСѓСЃС‚С‹Рј, С‡С‚РѕР±С‹ РЅРµ РјРµРЅСЏС‚СЊ' : ''} />
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
                  <span>РСЃС‚РѕС‡РЅРёРє Р°РєС‚РёРІРµРЅ</span>
                </label>
                <label className="service-field service-field-wide">
                  <span>РћРїС†РёРё РїРѕРґРєР»СЋС‡РµРЅРёСЏ (JSON)</span>
                  <textarea className="service-textarea" rows={6} value={dataSourceForm.optionsText} onChange={(event) => setDataSourceForm((prev) => ({ ...prev, optionsText: event.target.value }))} />
                </label>
              </div>

              <div className="service-row">
                <button type="button" className="service-btn primary" onClick={() => void handleSaveDataSource()} disabled={consoleSaving}>
                  {consoleSaving ? 'РЎРѕС…СЂР°РЅРµРЅРёРµ...' : (selectedSourceKey ? 'РЎРѕС…СЂР°РЅРёС‚СЊ РёСЃС‚РѕС‡РЅРёРє' : 'РЎРѕР·РґР°С‚СЊ РёСЃС‚РѕС‡РЅРёРє')}
                </button>
              </div>
            </div>

            <div className="service-card">
              <div className="service-card-header">
                <div>
                  <h3>РЎРѕРѕС‚РІРµС‚СЃС‚РІРёСЏ С‚РёРїРѕРІ РѕР±СЉРµРєС‚РѕРІ</h3>
                  <p className="service-card-hint">
                    Р“СЂР°С„ РїСЂРѕРґРѕР»Р¶Р°РµС‚ Р¶РёС‚СЊ СЃРѕ СЃРІРѕРёРјРё С‚РёРїР°РјРё, Р° РїСЂРѕС†РµРґСѓСЂС‹ РїРѕР»СѓС‡Р°СЋС‚ РѕР¶РёРґР°РµРјС‹Рµ С‚РёРїС‹ РѕР±СЉРµРєС‚РѕРІ РІСЂРѕРґРµ
                    {' '}
                    <code>MSISDN</code>
                    ,
                    {' '}
                    <code>IMEI</code>
                    {' '}
                    Рё
                    {' '}
                    <code>IMSI</code>
                    .
                  </p>
                </div>
                <div className="service-row">
                  <button type="button" className="service-btn" onClick={resetObjectTypeMappings}>
                    Р‘Р°Р·РѕРІС‹Рµ СЃРѕРѕС‚РІРµС‚СЃС‚РІРёСЏ
                  </button>
                  <button type="button" className="service-btn" onClick={addObjectTypeMapping}>
                    Р”РѕР±Р°РІРёС‚СЊ СЃС‚СЂРѕРєСѓ
                  </button>
                </div>
              </div>

              {consoleObjectTypeMappings.length === 0 ? (
                <div className="service-empty">РЎРѕРѕС‚РІРµС‚СЃС‚РІРёСЏ РїРѕРєР° РЅРµ Р·Р°РґР°РЅС‹.</div>
              ) : (
                <div className="service-mapping-table">
                  <div className="service-mapping-row service-mapping-row-header">
                    <div>РўРёРї РЅР° РіСЂР°С„Рµ</div>
                    <div>РўРёРї РґР»СЏ РїСЂРѕС†РµРґСѓСЂС‹</div>
                    <div>РђРєС‚РёРІРЅРѕ</div>
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
                        <span>Р”Р°</span>
                      </label>
                      <button
                        type="button"
                        className="service-btn danger"
                        onClick={() => removeObjectTypeMapping(mapping.id)}
                      >
                        РЈРґР°Р»РёС‚СЊ
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
                  {consoleSaving ? 'РЎРѕС…СЂР°РЅРµРЅРёРµ...' : 'РЎРѕС…СЂР°РЅРёС‚СЊ СЃРѕРѕС‚РІРµС‚СЃС‚РІРёСЏ'}
                </button>
              </div>
            </div>

            <div className="service-card">
              <div className="service-card-header">
                <div>
                  <h3>Р РµРµСЃС‚СЂ С…СЂР°РЅРёРјС‹С… РїСЂРѕС†РµРґСѓСЂ</h3>
                  <p className="service-card-hint">
                    РћРїРёСЃС‹РІР°РµРј СѓР¶Рµ СЃСѓС‰РµСЃС‚РІСѓСЋС‰РёРµ РїСЂРѕС†РµРґСѓСЂС‹: РёСЃС‚РѕС‡РЅРёРє, schema/name, РїР°СЂР°РјРµС‚СЂС‹, СЃРІСЏР·Рё СЃ РіСЂР°С„РѕРІС‹Рј РєРѕРЅС‚РµРєСЃС‚РѕРј Рё РјР°РїРїРёРЅРі result set РІ РёРЅС‚РµСЂС„РµР№СЃ.
                  </p>
                </div>
                <div className="service-row">
                  <button type="button" className="service-btn" onClick={resetProcedureForm}>
                    РќРѕРІР°СЏ РїСЂРѕС†РµРґСѓСЂР°
                  </button>
                  <button
                    type="button"
                    className="service-btn"
                    onClick={handleDuplicateProcedureTemplate}
                    disabled={!selectedProcedure}
                  >
                    Р”СѓР±Р»РёСЂРѕРІР°С‚СЊ РєР°Рє С€Р°Р±Р»РѕРЅ
                  </button>
                  <button
                    type="button"
                    className="service-btn danger"
                    onClick={() => void handleDeleteProcedure()}
                    disabled={!selectedProcedureKey || consoleSaving}
                  >
                    РЈРґР°Р»РёС‚СЊ РїСЂРѕС†РµРґСѓСЂСѓ
                  </button>
                </div>
              </div>

              <div className="service-list">
                <input
                  className="service-input"
                  type="text"
                  value={procedureSearch}
                  onChange={(event) => setProcedureSearch(event.target.value)}
                  placeholder="РџРѕРёСЃРє РїРѕ РїСЂРѕС†РµРґСѓСЂР°Рј"
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
                    <span>{procedure.source_name || procedure.source_key || 'РСЃС‚РѕС‡РЅРёРє РЅРµ Р·Р°РґР°РЅ'}</span>
                  </button>
                ))}
                {!filteredProcedures.length && (
                  <div className="service-empty">
                    {consoleProcedures.length ? 'РџРѕ С‚РµРєСѓС‰РµРјСѓ С„РёР»СЊС‚СЂСѓ РїСЂРѕС†РµРґСѓСЂС‹ РЅРµ РЅР°Р№РґРµРЅС‹.' : 'РџСЂРѕС†РµРґСѓСЂС‹ РµС‰С‘ РЅРµ Р·Р°СЂРµРіРёСЃС‚СЂРёСЂРѕРІР°РЅС‹.'}
                  </div>
                )}
              </div>

              <div className="service-form-grid">
                <label className="service-field">
                  <span>РљР»СЋС‡</span>
                  <input className="service-input" value={procedureForm.key} onChange={(event) => setProcedureForm((prev) => ({ ...prev, key: event.target.value }))} />
                </label>
                <label className="service-field">
                  <span>РќР°Р·РІР°РЅРёРµ</span>
                  <input className="service-input" value={procedureForm.name} onChange={(event) => setProcedureForm((prev) => ({ ...prev, name: event.target.value }))} />
                </label>
                <label className="service-field service-field-wide">
                  <span>РћРїРёСЃР°РЅРёРµ</span>
                  <input className="service-input" value={procedureForm.description} onChange={(event) => setProcedureForm((prev) => ({ ...prev, description: event.target.value }))} />
                </label>
                <label className="service-field">
                  <span>РСЃС‚РѕС‡РЅРёРє</span>
                  <select className="service-input" value={procedureForm.source_key} onChange={(event) => setProcedureForm((prev) => ({ ...prev, source_key: event.target.value }))}>
                    <option value="">Р’С‹Р±РµСЂРё РёСЃС‚РѕС‡РЅРёРє</option>
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
                  <input className="service-input" value={procedureForm.procedure_name} onChange={(event) => setProcedureForm((prev) => ({ ...prev, procedure_name: event.target.value }))} placeholder="РќР°РїСЂРёРјРµСЂ usp_GetAbonentDossier" />
                </label>
                <label className="service-field">
                  <span>Timeout, СЃРµРє</span>
                  <input className="service-input" value={procedureForm.timeout_seconds} onChange={(event) => setProcedureForm((prev) => ({ ...prev, timeout_seconds: event.target.value }))} />
                </label>
                <label className="service-field">
                  <span>Default limit</span>
                  <input className="service-input" value={procedureForm.default_limit} onChange={(event) => setProcedureForm((prev) => ({ ...prev, default_limit: event.target.value }))} />
                </label>
                <label className="service-checkbox">
                  <input type="checkbox" checked={procedureForm.supports_graph_selection} onChange={(event) => setProcedureForm((prev) => ({ ...prev, supports_graph_selection: event.target.checked }))} />
                  <span>РџРѕРґРґРµСЂР¶РёРІР°РµС‚ РІС‹РґРµР»РµРЅРёРµ РіСЂР°С„Р°</span>
                </label>
                <label className="service-checkbox">
                  <input type="checkbox" checked={procedureForm.is_active} onChange={(event) => setProcedureForm((prev) => ({ ...prev, is_active: event.target.checked }))} />
                  <span>РџСЂРѕС†РµРґСѓСЂР° Р°РєС‚РёРІРЅР°</span>
                </label>
              </div>

              <div className="service-editor-block">
                <div className="service-editor-header">
                  <div>
                    <h4>РџР°СЂР°РјРµС‚СЂС‹ РїСЂРѕС†РµРґСѓСЂС‹</h4>
                    <p>Р—РґРµСЃСЊ РЅР°СЃС‚СЂР°РёРІР°РµРј С„РѕСЂРјСѓ Р·Р°РїСѓСЃРєР° Рё РїСЂР°РІРёР»Р° Р°РІС‚РѕРїСЂРёРІСЏР·РєРё Рє РіСЂР°С„РѕРІРѕРјСѓ РІС‹РґРµР»РµРЅРёСЋ.</p>
                  </div>
                  <div className="service-row">
                    <button type="button" className="service-btn" onClick={applyObjectsAnalysisPreset}>
                      РЁР°Р±Р»РѕРЅ Objects/Types
                    </button>
                    <button type="button" className="service-btn" onClick={addProcedureParam}>
                      Р”РѕР±Р°РІРёС‚СЊ РїР°СЂР°РјРµС‚СЂ
                    </button>
                  </div>
                </div>

                {procedureForm.params.length === 0 ? (
                  <div className="service-empty">РџР°СЂР°РјРµС‚СЂС‹ РїРѕРєР° РЅРµ РѕРїРёСЃР°РЅС‹.</div>
                ) : (
                  <div className="service-editor-list">
                    {procedureForm.params.map((param, index) => (
                      <div key={param.id} className="service-editor-card">
                        <div className="service-editor-card-header">
                          <strong>РџР°СЂР°РјРµС‚СЂ #{index + 1}</strong>
                          <button type="button" className="service-btn danger" onClick={() => removeProcedureParam(param.id)}>
                            РЈРґР°Р»РёС‚СЊ
                          </button>
                        </div>

                        <div className="service-form-grid">
                          <label className="service-field">
                            <span>РРјСЏ РїР°СЂР°РјРµС‚СЂР°</span>
                            <input className="service-input" value={param.name} onChange={(event) => updateProcedureParam(param.id, { name: event.target.value })} placeholder="РќР°РїСЂРёРјРµСЂ msisdn РёР»Рё selection_json" />
                          </label>
                          <label className="service-field">
                            <span>РџРѕРґРїРёСЃСЊ РІ UI</span>
                            <input className="service-input" value={param.label} onChange={(event) => updateProcedureParam(param.id, { label: event.target.value })} />
                          </label>
                          <label className="service-field">
                            <span>РўРёРї</span>
                            <select className="service-input" value={param.type} onChange={(event) => updateProcedureParam(param.id, { type: event.target.value })}>
                              {paramTypeOptions.map((option) => (
                                <option key={option.value} value={option.value}>{option.label}</option>
                              ))}
                            </select>
                          </label>
                          <label className="service-field">
                            <span>Р РµР¶РёРј Р·Р°РїРѕР»РЅРµРЅРёСЏ</span>
                            <select className="service-input" value={param.binding_mode} onChange={(event) => updateProcedureParam(param.id, { binding_mode: event.target.value })}>
                              {bindingModeOptions.map((option) => (
                                <option key={option.value} value={option.value}>{option.label}</option>
                              ))}
                            </select>
                          </label>

                          {(param.binding_mode === 'manual' || param.binding_mode === 'fixed') && (
                            <label className="service-field">
                              <span>{param.binding_mode === 'fixed' ? 'Р¤РёРєСЃРёСЂРѕРІР°РЅРЅРѕРµ Р·РЅР°С‡РµРЅРёРµ' : 'Р—РЅР°С‡РµРЅРёРµ РїРѕ СѓРјРѕР»С‡Р°РЅРёСЋ'}</span>
                              <input className="service-input" value={param.defaultValue} onChange={(event) => updateProcedureParam(param.id, { defaultValue: event.target.value })} />
                            </label>
                          )}

                          {param.binding_mode === 'project_context' && (
                            <label className="service-field">
                              <span>Р§С‚Рѕ Р±СЂР°С‚СЊ РёР· РєРѕРЅС‚РµРєСЃС‚Р°</span>
                              <select className="service-input" value={param.binding_source} onChange={(event) => updateProcedureParam(param.id, { binding_source: event.target.value })}>
                                <option value="">Р’С‹Р±РµСЂРё РёСЃС‚РѕС‡РЅРёРє Р·РЅР°С‡РµРЅРёСЏ</option>
                                {projectContextSourceOptions.map((option) => (
                                  <option key={option.value} value={option.value}>{option.label}</option>
                                ))}
                              </select>
                            </label>
                          )}

                          {param.binding_mode === 'selected_node_attr_csv' && (
                            <label className="service-field">
                              <span>РљР»СЋС‡ Р°С‚СЂРёР±СѓС‚Р° СѓР·Р»Р°</span>
                              <input className="service-input" value={param.binding_attr_key} onChange={(event) => updateProcedureParam(param.id, { binding_attr_key: event.target.value })} placeholder="РќР°РїСЂРёРјРµСЂ msisdn РёР»Рё imsi" />
                            </label>
                          )}

                          <label className="service-checkbox">
                            <input type="checkbox" checked={param.required} onChange={(event) => updateProcedureParam(param.id, { required: event.target.checked })} />
                            <span>РћР±СЏР·Р°С‚РµР»СЊРЅС‹Р№ РїР°СЂР°РјРµС‚СЂ</span>
                          </label>
                          <label className="service-checkbox">
                            <input type="checkbox" checked={param.hidden} onChange={(event) => updateProcedureParam(param.id, { hidden: event.target.checked })} />
                            <span>РЎРєСЂС‹С‚СЊ РІ С„РѕСЂРјРµ Р·Р°РїСѓСЃРєР°</span>
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
                    <h4>Result set Рё РєРѕР»РѕРЅРєРё</h4>
                    <p>Р—РґРµСЃСЊ Р·Р°РґР°С‘Рј РІРєР»Р°РґРєРё СЂРµР·СѓР»СЊС‚Р°С‚Р° Рё С‡РµР»РѕРІРµРєРѕС‡РёС‚Р°РµРјС‹Рµ РЅР°Р·РІР°РЅРёСЏ РєРѕР»РѕРЅРѕРє, РєРѕС‚РѕСЂС‹Рµ РІРµСЂРЅС‘С‚ РїСЂРѕС†РµРґСѓСЂР°.</p>
                  </div>
                  <button type="button" className="service-btn" onClick={addResultSet}>
                    Р”РѕР±Р°РІРёС‚СЊ result set
                  </button>
                </div>

                {procedureForm.resultSets.length === 0 ? (
                  <div className="service-empty">Result set РїРѕРєР° РЅРµ РѕРїРёСЃР°РЅС‹.</div>
                ) : (
                  <div className="service-editor-list">
                    {procedureForm.resultSets.map((resultSet, resultSetIndex) => (
                      <div key={resultSet.id} className="service-editor-card">
                        <div className="service-editor-card-header">
                          <strong>Result set #{resultSetIndex + 1}</strong>
                          <div className="service-row">
                            <button type="button" className="service-btn" onClick={() => addColumnToResultSet(resultSet.id)}>
                              Р”РѕР±Р°РІРёС‚СЊ РєРѕР»РѕРЅРєСѓ
                            </button>
                            <button type="button" className="service-btn danger" onClick={() => removeResultSet(resultSet.id)}>
                              РЈРґР°Р»РёС‚СЊ
                            </button>
                          </div>
                        </div>

                        <div className="service-form-grid">
                          <label className="service-field">
                            <span>РџРѕСЂСЏРґРєРѕРІС‹Р№ РёРЅРґРµРєСЃ</span>
                            <input className="service-input" value={resultSet.result_index} onChange={(event) => updateResultSet(resultSet.id, { result_index: event.target.value })} />
                          </label>
                          <label className="service-field">
                            <span>РљР»СЋС‡ РІРєР»Р°РґРєРё</span>
                            <input className="service-input" value={resultSet.result_key} onChange={(event) => updateResultSet(resultSet.id, { result_key: event.target.value })} />
                          </label>
                          <label className="service-field service-field-wide">
                            <span>РќР°Р·РІР°РЅРёРµ РІРєР»Р°РґРєРё</span>
                            <input className="service-input" value={resultSet.name} onChange={(event) => updateResultSet(resultSet.id, { name: event.target.value })} />
                          </label>
                          <label className="service-checkbox">
                            <input type="checkbox" checked={resultSet.visible} onChange={(event) => updateResultSet(resultSet.id, { visible: event.target.checked })} />
                            <span>РџРѕРєР°Р·С‹РІР°С‚СЊ РІРєР»Р°РґРєСѓ</span>
                          </label>
                        </div>

                        {resultSet.columns.length === 0 ? (
                          <div className="service-empty">РљРѕР»РѕРЅРєРё РµС‰С‘ РЅРµ РѕРїРёСЃР°РЅС‹. РС… РјРѕР¶РЅРѕ РґРѕР±Р°РІР»СЏС‚СЊ РїРѕ РјРµСЂРµ РґРѕРіРѕРІРѕСЂС‘РЅРЅРѕСЃС‚Рё СЃ Р°РІС‚РѕСЂР°РјРё РїСЂРѕС†РµРґСѓСЂС‹.</div>
                        ) : (
                          <div className="service-column-grid">
                            {resultSet.columns.map((column, columnIndex) => (
                              <div key={column.id} className="service-column-card">
                                <div className="service-editor-card-header">
                                  <strong>РљРѕР»РѕРЅРєР° #{columnIndex + 1}</strong>
                                  <button type="button" className="service-btn danger" onClick={() => removeColumnFromResultSet(resultSet.id, column.id)}>
                                    РЈРґР°Р»РёС‚СЊ
                                  </button>
                                </div>
                                <div className="service-form-grid">
                                  <label className="service-field">
                                    <span>РћСЂРёРіРёРЅР°Р»СЊРЅРѕРµ РёРјСЏ</span>
                                    <input className="service-input" value={column.key} onChange={(event) => updateColumnInResultSet(resultSet.id, column.id, { key: event.target.value })} placeholder="РќР°РїСЂРёРјРµСЂ subscriber_id" />
                                  </label>
                                  <label className="service-field">
                                    <span>РџРѕРґРїРёСЃСЊ РІ РёРЅС‚РµСЂС„РµР№СЃРµ</span>
                                    <input className="service-input" value={column.label} onChange={(event) => updateColumnInResultSet(resultSet.id, column.id, { label: event.target.value })} />
                                  </label>
                                  <label className="service-field">
                                    <span>РўРёРї</span>
                                    <select className="service-input" value={column.type} onChange={(event) => updateColumnInResultSet(resultSet.id, column.id, { type: event.target.value })}>
                                      {columnTypeOptions.map((option) => (
                                        <option key={option.value} value={option.value}>{option.label}</option>
                                      ))}
                                    </select>
                                  </label>
                                  <label className="service-field">
                                    <span>РЁРёСЂРёРЅР° РєРѕР»РѕРЅРєРё, px</span>
                                    <input className="service-input" value={column.width} onChange={(event) => updateColumnInResultSet(resultSet.id, column.id, { width: event.target.value })} placeholder="РќР°РїСЂРёРјРµСЂ 180" />
                                  </label>
                                  <label className="service-checkbox">
                                    <input type="checkbox" checked={column.visible} onChange={(event) => updateColumnInResultSet(resultSet.id, column.id, { visible: event.target.checked })} />
                                    <span>РџРѕРєР°Р·С‹РІР°С‚СЊ РєРѕР»РѕРЅРєСѓ</span>
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
                  {consoleSaving ? 'РЎРѕС…СЂР°РЅРµРЅРёРµ...' : (selectedProcedureKey ? 'РЎРѕС…СЂР°РЅРёС‚СЊ РїСЂРѕС†РµРґСѓСЂСѓ' : 'Р—Р°СЂРµРіРёСЃС‚СЂРёСЂРѕРІР°С‚СЊ РїСЂРѕС†РµРґСѓСЂСѓ')}
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


