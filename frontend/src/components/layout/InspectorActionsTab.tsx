import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { artifactApi, consoleApi } from '../../services/api';
import { fetchArtifacts } from '../../store/slices/artifactsSlice';
import { useAppDispatch } from '../../store';
import { loadProjectPeriodDefaults, rememberProjectPeriodDefaults } from '../../utils/pluginParams';
import type {
  ApiArtifact,
  ApiPlugin,
  ConsoleProfile,
  ConsoleProfilesResponse,
  PluginExecutionContext,
} from '../../types/api';

type ActionMode = 'analysis' | 'transform' | null;
type InputSource = 'selection' | 'clipboard' | 'file';
type ParamValues = Record<string, string | boolean>;
type SelectedElementLite = { type: string; id: string; data?: unknown };

type GraphSelectionNode = {
  id: string;
  node_id: string;
  type: string;
  label?: unknown;
  attributes: Record<string, unknown>;
};

type GraphSelectionEdge = {
  id: string;
  from: string;
  to: string;
  type: string;
  label?: unknown;
  attributes: Record<string, unknown>;
};

type SelectionContextShape = {
  selected_nodes: GraphSelectionNode[];
  selected_edges: GraphSelectionEdge[];
};

type InputValidationResult = {
  values: string[];
  errors: string[];
  warnings: string[];
};

const MAX_RAW_INPUT_CHARS = 200000;
const MAX_FILE_SIZE_BYTES = 512 * 1024;
const MAX_OBJECT_COUNT = 5000;
const MAX_OBJECT_LENGTH = 256;
const DEFAULT_SOURCE_IDS = 'All';

const PERIOD_START_KEYS = ['begtime', 'period_start', 'start_date', 'date_from', 'from_date', 'begin_date', 'beg_date'];
const PERIOD_END_KEYS = ['endtime', 'period_end', 'end_date', 'date_to', 'to_date', 'finish_date'];
const INPUT_SOURCE_LABELS: Record<InputSource, string> = {
  selection: 'Из выделения',
  clipboard: 'Из буфера',
  file: 'Из файла',
};

const INPUT_SOURCE_SHORT_LABELS: Record<InputSource, string> = {
  selection: 'Граф',
  clipboard: 'Буфер',
  file: 'Файл',
};

type InspectorActionsTabProps = {
  artifact: ApiArtifact;
  selectedElements: SelectedElementLite[];
  pluginContext: PluginExecutionContext;
  plugins: ApiPlugin[];
  groupedPlugins: Array<{ path: string; items: ApiPlugin[] }>;
  pluginsLoading: boolean;
  pluginsError: string | null;
  runningPluginId: string | null;
  onRunPlugin: (plugin: ApiPlugin) => Promise<void>;
  presetProfileKey?: string | null;
  presetToken?: number;
};

const fallbackObjectTypes = ['abonent', 'device', 'imei', 'imsi', 'msisdn'];

const getParamKey = (param: any): string => String(param?.key || param?.name || '').trim();
const getParamKeyLower = (param: any): string => getParamKey(param).toLowerCase();
const isPeriodStartKey = (key: string): boolean => PERIOD_START_KEYS.includes(key.toLowerCase());
const isPeriodEndKey = (key: string): boolean => PERIOD_END_KEYS.includes(key.toLowerCase());
const isObjectsParam = (param: any): boolean => getParamKeyLower(param) === 'objects';
const isObjectTypesParam = (param: any): boolean => getParamKeyLower(param) === 'objectstype';
const isSourceIdsParam = (param: any): boolean => getParamKeyLower(param) === 'sourceids';

const splitObjectInput = (value: string): string[] => {
  const unique = new Set<string>();
  value
    .split(/[\r\n,;]+/)
    .map((item) => item.trim())
    .filter(Boolean)
    .forEach((item) => unique.add(item));
  return Array.from(unique);
};

const validateObjectInput = (value: string): InputValidationResult => {
  const normalized = String(value || '');
  const errors: string[] = [];
  const warnings: string[] = [];

  if (!normalized.trim()) {
    return { values: [], errors, warnings };
  }

  if (normalized.length > MAX_RAW_INPUT_CHARS) {
    errors.push(`Слишком большой объём ввода: максимум ${MAX_RAW_INPUT_CHARS.toLocaleString('ru-RU')} символов.`);
    return { values: [], errors, warnings };
  }

  if (normalized.includes('\0')) {
    errors.push('Похоже, загружен бинарный файл или текст в неподдерживаемом формате.');
    return { values: [], errors, warnings };
  }

  const values = splitObjectInput(normalized);
  if (values.length > MAX_OBJECT_COUNT) {
    errors.push(`Слишком много объектов для одного запуска: максимум ${MAX_OBJECT_COUNT.toLocaleString('ru-RU')}.`);
  }

  if (values.some((item) => item.length > MAX_OBJECT_LENGTH)) {
    errors.push(`Обнаружено слишком длинное значение. Максимальная длина одного объекта — ${MAX_OBJECT_LENGTH} символов.`);
  }

  if (values.length === 0) {
    warnings.push('После разбора списка не найдено ни одного корректного объекта.');
  }

  return {
    values: errors.length ? [] : values,
    errors,
    warnings,
  };
};

const buildGraphSelection = (
  artifact: ApiArtifact,
  selectedElements: SelectedElementLite[],
): SelectionContextShape => {
  const nodes = Array.isArray(artifact.data?.nodes) ? artifact.data.nodes : [];
  const edges = Array.isArray(artifact.data?.edges) ? artifact.data.edges : [];
  const nodeIdSet = new Set(nodes.map((item: any) => String(item?.id ?? item?.node_id ?? '')));
  const edgeIdSet = new Set(edges.map((item: any) => String(item?.id ?? '')));

  const selectedNodeIds = new Set(
    selectedElements
      .filter((item) => item.type === 'node' && nodeIdSet.has(String(item.id)))
      .map((item) => String(item.id)),
  );

  const selectedEdgeIds = new Set(
    selectedElements
      .filter((item) => item.type === 'edge' && edgeIdSet.has(String(item.id)))
      .map((item) => String(item.id)),
  );

  const selected_nodes = nodes
    .filter((item: any) => selectedNodeIds.has(String(item?.id ?? item?.node_id ?? '')))
    .map((item: any) => ({
      id: String(item?.id ?? item?.node_id ?? ''),
      node_id: String(item?.node_id ?? item?.id ?? ''),
      type: String(item?.type || ''),
      label: item?.label,
      attributes: item?.attributes && typeof item.attributes === 'object' ? item.attributes : {},
    }));

  const selected_edges = edges
    .filter((item: any) => selectedEdgeIds.has(String(item?.id ?? '')))
    .map((item: any) => ({
      id: String(item?.id ?? ''),
      from: String(item?.from ?? item?.source_node ?? ''),
      to: String(item?.to ?? item?.target_node ?? ''),
      type: String(item?.type || ''),
      label: item?.label,
      attributes: item?.attributes && typeof item.attributes === 'object' ? item.attributes : {},
    }));

  return { selected_nodes, selected_edges };
};

const extractSelectedNodeAttrValues = (nodes: GraphSelectionNode[], attrKey: string): string[] => {
  const normalizedKey = String(attrKey || '').trim();
  if (!normalizedKey) return [];
  return nodes.flatMap((node) => {
    const raw = node.attributes?.[normalizedKey] ?? (node as unknown as Record<string, unknown>)[normalizedKey];
    if (Array.isArray(raw)) {
      return raw.filter((item) => item !== null && item !== undefined && item !== '').map(String);
    }
    return raw !== null && raw !== undefined && raw !== '' ? [String(raw)] : [];
  });
};

const buildDefaultParamValues = (profile: ConsoleProfile | null, projectId: number): ParamValues => {
  const next: ParamValues = {};
  const params = Array.isArray(profile?.params) ? profile.params : [];
  const periodDefaults = projectId > 0 ? loadProjectPeriodDefaults(projectId) : {};
  params.forEach((spec) => {
    const key = getParamKey(spec);
    if (!key) return;
    const lowerKey = key.toLowerCase();
    if (String(spec?.type || '').toLowerCase() === 'boolean') {
      next[key] = false;
      return;
    }
    if (isSourceIdsParam(spec)) {
      next[key] = String(spec?.default ?? DEFAULT_SOURCE_IDS);
      return;
    }
    if (isPeriodStartKey(lowerKey) && periodDefaults.period_start) {
      next[key] = periodDefaults.period_start;
      return;
    }
    if (isPeriodEndKey(lowerKey) && periodDefaults.period_end) {
      next[key] = periodDefaults.period_end;
      return;
    }
    next[key] = String(spec?.default ?? '');
  });
  return next;
};

const coerceParamValue = (type: string | undefined, value: string | boolean): unknown => {
  const normalizedType = String(type || '').trim().toLowerCase();
  if (normalizedType === 'boolean') return Boolean(value);
  if (normalizedType === 'number' || normalizedType === 'float') {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : value;
  }
  if (normalizedType === 'integer' || normalizedType === 'int') {
    const parsed = Number.parseInt(String(value), 10);
    return Number.isFinite(parsed) ? parsed : value;
  }
  return String(value ?? '');
};

const getPreviewParamValue = (
  param: any,
  manualValue: string | boolean | undefined,
  selectionContext: SelectionContextShape,
  artifact: ApiArtifact,
): unknown => {
  const bindingMode = String(param?.binding_mode || 'manual').trim().toLowerCase();
  const bindingSource = String(param?.binding_source || '').trim();
  const attrKey = String(param?.binding_config?.attr_key || '').trim();

  if (bindingMode === 'manual') {
    return coerceParamValue(param?.type, manualValue ?? '');
  }
  if (bindingMode === 'fixed') {
    return param?.default ?? '';
  }
  if (bindingMode === 'project_context') {
    if (bindingSource === 'artifact_id' || bindingSource === 'context_artifact_id') return artifact.id;
    return artifact.project_id;
  }
  if (bindingMode === 'selection_json') {
    return JSON.stringify(
      {
        project_id: artifact.project_id,
        artifact_id: artifact.id,
        context_artifact_id: artifact.id,
        selected_nodes: selectionContext.selected_nodes,
        selected_edges: selectionContext.selected_edges,
        selected_node_ids: selectionContext.selected_nodes.map((item) => item.id),
        selected_edge_ids: selectionContext.selected_edges.map((item) => item.id),
        selected_node_labels: selectionContext.selected_nodes
          .map((item) => item.label)
          .filter((item) => item !== null && item !== undefined && item !== ''),
      },
      null,
      2,
    );
  }
  if (bindingMode === 'selected_node_ids_csv') {
    return selectionContext.selected_nodes.map((item) => item.id).join(', ');
  }
  if (bindingMode === 'selected_edge_ids_csv') {
    return selectionContext.selected_edges.map((item) => item.id).join(', ');
  }
  if (bindingMode === 'selected_node_labels_csv') {
    return selectionContext.selected_nodes
      .map((item) => item.label)
      .filter((item) => item !== null && item !== undefined && item !== '')
      .map(String)
      .join(', ');
  }
  if (bindingMode === 'selected_node_types_csv') {
    return selectionContext.selected_nodes
      .map((item) => item.type)
      .filter(Boolean)
      .join(', ');
  }
  if (bindingMode === 'selected_node_attr_csv') {
    return extractSelectedNodeAttrValues(selectionContext.selected_nodes, attrKey).join(', ');
  }
  return coerceParamValue(param?.type, manualValue ?? '');
};

const formatDateISO = (date: Date) => date.toISOString().slice(0, 10);

export const InspectorActionsTab: React.FC<InspectorActionsTabProps> = ({
  artifact,
  selectedElements,
  pluginContext,
  plugins,
  groupedPlugins,
  pluginsLoading,
  pluginsError,
  runningPluginId,
  onRunPlugin,
  presetProfileKey = null,
  presetToken = 0,
}) => {
  const dispatch = useAppDispatch();
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [actionMode, setActionMode] = useState<ActionMode>(null);
  const [profiles, setProfiles] = useState<ConsoleProfile[]>([]);
  const [profilesLoading, setProfilesLoading] = useState(false);
  const [profilesError, setProfilesError] = useState<string | null>(null);
  const [selectedProfileId, setSelectedProfileId] = useState('');
  const [selectedPluginId, setSelectedPluginId] = useState('');
  const [inputSource, setInputSource] = useState<InputSource>('selection');
  const [inputObjectType, setInputObjectType] = useState('');
  const [selectedGraphObjectType, setSelectedGraphObjectType] = useState('');
  const [rawInput, setRawInput] = useState('');
  const [paramValues, setParamValues] = useState<ParamValues>({});
  const [excludedSelectionNodeIds, setExcludedSelectionNodeIds] = useState<string[]>([]);
  const [excludedInputValues, setExcludedInputValues] = useState<string[]>([]);
  const [analysisRunning, setAnalysisRunning] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const graphSelection = useMemo(
    () => buildGraphSelection(artifact, selectedElements),
    [artifact, selectedElements],
  );

  const selectedNodeTypeCounts = useMemo(() => {
    const counts = new Map<string, number>();
    graphSelection.selected_nodes.forEach((node) => {
      const type = String(node.type || '').trim() || 'unknown';
      counts.set(type, (counts.get(type) || 0) + 1);
    });
    return Array.from(counts.entries()).map(([type, count]) => ({ type, count }));
  }, [graphSelection.selected_nodes]);

  const selectedProfile = useMemo(
    () => profiles.find((item) => String(item.key || item.id) === selectedProfileId) || null,
    [profiles, selectedProfileId],
  );

  const selectedPlugin = useMemo(
    () => plugins.find((item) => item.id === selectedPluginId) || null,
    [plugins, selectedPluginId],
  );

  useEffect(() => {
    setSelectedProfileId('');
    setSelectedPluginId('');
    setInputSource('selection');
    setRawInput('');
    setInputObjectType('');
    setSelectedGraphObjectType('');
    setExcludedSelectionNodeIds([]);
    setExcludedInputValues([]);
    setMessage(null);
    setError(null);
  }, [artifact.id]);

  useEffect(() => {
    if (actionMode !== 'analysis') return;
    if (profiles.length > 0) return;
    let cancelled = false;
    const loadProfiles = async () => {
      setProfilesLoading(true);
      setProfilesError(null);
      try {
        const response = (await consoleApi.profiles()) as ConsoleProfilesResponse;
        if (cancelled) return;
        setProfiles(Array.isArray(response?.profiles) ? response.profiles : []);
      } catch (err: any) {
        if (cancelled) return;
        setProfilesError(String(err?.response?.data?.detail || err?.message || 'Не удалось загрузить процедуры'));
      } finally {
        if (!cancelled) setProfilesLoading(false);
      }
    };
    void loadProfiles();
    return () => {
      cancelled = true;
    };
  }, [actionMode, profiles.length]);

  useEffect(() => {
    if (selectedNodeTypeCounts.length === 1) {
      setSelectedGraphObjectType(selectedNodeTypeCounts[0].type);
    } else if (selectedNodeTypeCounts.length === 0) {
      setSelectedGraphObjectType('');
    }
  }, [selectedNodeTypeCounts]);

  useEffect(() => {
    setParamValues(buildDefaultParamValues(selectedProfile, artifact.project_id));
  }, [artifact.project_id, selectedProfile]);

  useEffect(() => {
    if (!presetProfileKey) return;
    setActionMode('analysis');
    setSelectedProfileId(String(presetProfileKey));
  }, [presetProfileKey, presetToken]);

  useEffect(() => {
    setExcludedSelectionNodeIds([]);
  }, [selectedGraphObjectType, selectedElements]);

  const inputValidation = useMemo(() => validateObjectInput(rawInput), [rawInput]);
  const parsedInputValues = inputValidation.values;

  useEffect(() => {
    setExcludedInputValues((prev) => prev.filter((item) => parsedInputValues.includes(item)));
  }, [parsedInputValues]);

  const objectTypeOptions = useMemo(() => {
    const values = new Set<string>(fallbackObjectTypes);
    selectedNodeTypeCounts.forEach((item) => {
      if (item.type) values.add(item.type);
    });
    if (inputObjectType.trim()) values.add(inputObjectType.trim());
    return Array.from(values).sort((a, b) => a.localeCompare(b, 'ru', { sensitivity: 'base', numeric: true }));
  }, [inputObjectType, selectedNodeTypeCounts]);

  const analysisParams = useMemo(
    () =>
      (selectedProfile?.params || []).filter((param) => {
        if (param.hidden) return false;
        if (isObjectsParam(param)) return false;
        if (isObjectTypesParam(param)) return false;
        if (isSourceIdsParam(param)) return false;
        return true;
      }),
    [selectedProfile],
  );

  const effectiveSelectionContext = useMemo<SelectionContextShape>(() => {
    if (inputSource === 'selection') {
      const chosenType = selectedGraphObjectType.trim();
      if (!chosenType) {
        return { selected_nodes: [], selected_edges: [] };
      }
      return {
        selected_nodes: graphSelection.selected_nodes.filter(
          (item) => String(item.type || '').trim() === chosenType && !excludedSelectionNodeIds.includes(item.id),
        ),
        selected_edges: graphSelection.selected_edges,
      };
    }

    const chosenType = inputObjectType.trim();
    if (!chosenType) return { selected_nodes: [], selected_edges: [] };
    const syntheticNodes: GraphSelectionNode[] = parsedInputValues
      .filter((value) => !excludedInputValues.includes(value))
      .map((value, index) => ({
        id: `${chosenType}:${index}:${value}`,
        node_id: value,
        type: chosenType,
        label: value,
        attributes: { value, [chosenType]: value },
      }));
    return { selected_nodes: syntheticNodes, selected_edges: [] };
  }, [
    excludedInputValues,
    excludedSelectionNodeIds,
    graphSelection.selected_edges,
    graphSelection.selected_nodes,
    inputObjectType,
    inputSource,
    parsedInputValues,
    selectedGraphObjectType,
  ]);

  const activeObjectType = inputSource === 'selection' ? selectedGraphObjectType : inputObjectType;

  const canRunAnalysis = useMemo(() => {
    if (!selectedProfile) return false;
    if (inputSource === 'selection') {
      return effectiveSelectionContext.selected_nodes.length > 0;
    }
    return Boolean(inputObjectType.trim())
      && effectiveSelectionContext.selected_nodes.length > 0
      && inputValidation.errors.length === 0;
  }, [
    effectiveSelectionContext.selected_nodes.length,
    inputObjectType,
    inputSource,
    inputValidation.errors.length,
    selectedProfile,
  ]);

  const handlePasteFromClipboard = useCallback(async () => {
    try {
      const text = await navigator.clipboard.readText();
      if ((text || '').length > MAX_RAW_INPUT_CHARS) {
        setError(`Буфер обмена слишком большой. Максимум ${MAX_RAW_INPUT_CHARS.toLocaleString('ru-RU')} символов.`);
        setMessage(null);
        return;
      }
      setRawInput(text || '');
      setMessage('Данные вставлены из буфера');
      setError(null);
    } catch (err: any) {
      setError(String(err?.message || 'Не удалось прочитать буфер обмена'));
      setMessage(null);
    }
  }, []);

  const handleOpenFile = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  const handleFileChange = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    if (file.size > MAX_FILE_SIZE_BYTES) {
      setError(`Файл слишком большой. Максимум ${Math.round(MAX_FILE_SIZE_BYTES / 1024)} КБ на один запуск.`);
      setMessage(null);
      event.target.value = '';
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const nextValue = String(reader.result || '');
      if (nextValue.length > MAX_RAW_INPUT_CHARS) {
        setError(`Файл содержит слишком много данных. Максимум ${MAX_RAW_INPUT_CHARS.toLocaleString('ru-RU')} символов.`);
        setMessage(null);
        event.target.value = '';
        return;
      }
      setRawInput(nextValue);
      setMessage(`Загружено из файла: ${file.name}`);
      setError(null);
      event.target.value = '';
    };
    reader.onerror = () => {
      setError('Не удалось прочитать файл');
      setMessage(null);
      event.target.value = '';
    };
    reader.readAsText(file);
  }, []);

  const handleRunAnalysis = useCallback(async () => {
    if (!selectedProfile) return;
    if (!canRunAnalysis) {
      setError(inputValidation.errors[0] || 'Подготовьте входные данные перед запуском анализа');
      setMessage(null);
      return;
    }

    setAnalysisRunning(true);
    setMessage(null);
    setError(null);

    try {
      const consoleArtifact = await artifactApi.create(artifact.project_id, {
        type: 'console',
        name: `${selectedProfile.name} ${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}`,
        data: {
          tabs: [{ id: 'main', name: 'Основная', columns: [], rows: [], row_count: 0 }],
          active_tab_id: 'main',
          columns: [],
          rows: [],
        },
        metadata: {
          console_profile_id: String(selectedProfile.key || selectedProfile.id),
          console_context_artifact_id: artifact.id,
        },
      });

      const params: Record<string, unknown> = {};
      (selectedProfile.params || []).forEach((spec) => {
        const key = getParamKey(spec);
        if (!key) return;
        if (isObjectsParam(spec) || isObjectTypesParam(spec)) return;
        if (isSourceIdsParam(spec)) {
          params[key] = String(paramValues[key] ?? DEFAULT_SOURCE_IDS);
          return;
        }
        if (String(spec.binding_mode || 'manual').trim().toLowerCase() === 'manual') {
          params[key] = coerceParamValue(spec.type, paramValues[key] ?? '');
        }
      });

      await consoleApi.refresh(
        artifact.project_id,
        consoleArtifact.id,
        String(selectedProfile.key || selectedProfile.id),
        params,
        {
          selected_nodes: effectiveSelectionContext.selected_nodes,
          selected_edges: effectiveSelectionContext.selected_edges,
        },
        artifact.id,
      );

      rememberProjectPeriodDefaults(artifact.project_id, params as Record<string, any>);
      await dispatch(fetchArtifacts(artifact.project_id));
      setMessage('Анализ выполнен. Результат появился во вкладке "Результаты" нижней панели.');
    } catch (err: any) {
      setError(String(err?.response?.data?.detail || err?.message || 'Не удалось выполнить анализ'));
    } finally {
      setAnalysisRunning(false);
    }
  }, [
    artifact.id,
    artifact.project_id,
    canRunAnalysis,
    dispatch,
    effectiveSelectionContext.selected_edges,
    effectiveSelectionContext.selected_nodes,
    inputValidation.errors,
    paramValues,
    selectedProfile,
  ]);

  const handleManualInputPaste = useCallback((event: React.ClipboardEvent<HTMLTextAreaElement>) => {
    const pasted = event.clipboardData.getData('text') || '';
    const selectionLength = event.currentTarget.selectionEnd - event.currentTarget.selectionStart;
    const nextLength = rawInput.length - selectionLength + pasted.length;
    if (nextLength > MAX_RAW_INPUT_CHARS) {
      event.preventDefault();
      setError(`Слишком большой фрагмент. Максимум ${MAX_RAW_INPUT_CHARS.toLocaleString('ru-RU')} символов в одном запуске.`);
      setMessage(null);
    }
  }, [rawInput.length]);

  const handleRemovePreviewNode = useCallback((nodeId: string, value: string) => {
    if (inputSource === 'selection') {
      setExcludedSelectionNodeIds((prev) => (prev.includes(nodeId) ? prev : [...prev, nodeId]));
      return;
    }
    setExcludedInputValues((prev) => (prev.includes(value) ? prev : [...prev, value]));
  }, [inputSource]);

  const applyPeriodPreset = useCallback((days: number) => {
    const end = new Date();
    const start = new Date();
    start.setDate(end.getDate() - Math.max(days - 1, 0));

    setParamValues((prev) => {
      const next = { ...prev };
      (selectedProfile?.params || []).forEach((param) => {
        const key = getParamKey(param);
        if (!key) return;
        if (isPeriodStartKey(key)) next[key] = formatDateISO(start);
        if (isPeriodEndKey(key)) next[key] = formatDateISO(end);
        if (isSourceIdsParam(param) && !String(next[key] || '').trim()) next[key] = DEFAULT_SOURCE_IDS;
      });
      return next;
    });
  }, [selectedProfile]);

  const actionModeDescription = actionMode === 'analysis'
    ? 'Выберите процедуру, затем подготовьте входные данные и параметры запуска.'
    : actionMode === 'transform'
      ? 'Преобразования пока работают по текущему выделению графа и используют применимые плагины.'
      : 'Сначала выберите, что именно вы хотите сделать с текущим графом или выделением.';

  return (
    <div className="inspector-actions-tab">
      <div className="inspector-actions-step">
        <div className="inspector-actions-step-title">1. Выбор действия</div>
        <div className="inspector-actions-mode-grid">
          <button
            type="button"
            className={`inspector-actions-mode-card ${actionMode === 'analysis' ? 'active' : ''}`}
            onClick={() => setActionMode('analysis')}
          >
            <div className="inspector-actions-mode-title">Анализ</div>
            <div className="inspector-actions-mode-copy">Запуск зарегистрированной процедуры по выделению или произвольному набору объектов.</div>
          </button>
          <button
            type="button"
            className={`inspector-actions-mode-card ${actionMode === 'transform' ? 'active' : ''}`}
            onClick={() => setActionMode('transform')}
          >
            <div className="inspector-actions-mode-title">Преобразования</div>
            <div className="inspector-actions-mode-copy">Запуск внутренних преобразований и плагинов в контексте текущего выделения.</div>
          </button>
        </div>
        <div className="inspector-actions-step-hint">{actionModeDescription}</div>
      </div>

      {(message || error) && (
        <div className={`inspector-actions-banner ${error ? 'error' : 'success'}`}>
          {error || message}
        </div>
      )}

      {actionMode === 'analysis' && (
        <>
          <div className="inspector-actions-step">
            <div className="inspector-actions-step-title">2. Процедура</div>
            {profilesLoading ? (
              <div className="inspector-actions-empty">Загружаем зарегистрированные процедуры...</div>
            ) : profilesError ? (
              <div className="inspector-actions-empty error">{profilesError}</div>
            ) : (
              <label className="property-group">
                <label>Процедура</label>
                <select
                  className="property-input"
                  value={selectedProfileId}
                  onChange={(event) => setSelectedProfileId(event.target.value)}
                >
                  <option value="">Выберите процедуру</option>
                  {profiles.map((profile) => (
                    <option key={String(profile.key || profile.id)} value={String(profile.key || profile.id)}>
                      {profile.name}
                    </option>
                  ))}
                </select>
              </label>
            )}
            {selectedProfile && (
              <div className="inspector-actions-footer">
                <button
                  type="button"
                  className="property-action inspector-actions-primary-button"
                  onClick={() => void handleRunAnalysis()}
                  disabled={!canRunAnalysis || analysisRunning}
                >
                  {analysisRunning ? 'Запуск...' : 'Запустить анализ'}
                </button>
              </div>
            )}
          </div>

          {selectedProfile && (
            <div className="inspector-actions-step">
              <div className="inspector-actions-step-title">3. Источник входных данных</div>
              <div className="inspector-actions-source-grid">
                {(['selection', 'clipboard', 'file'] as InputSource[]).map((mode) => (
                  <button
                    key={mode}
                    type="button"
                    className={`inspector-actions-source-chip ${inputSource === mode ? 'active' : ''}`}
                    onClick={() => setInputSource(mode)}
                    title={INPUT_SOURCE_LABELS[mode]}
                    aria-label={INPUT_SOURCE_LABELS[mode]}
                  >
                    <span className="inspector-actions-source-short-label">{INPUT_SOURCE_SHORT_LABELS[mode]}</span>
                  </button>
                ))}
              </div>

              {inputSource === 'selection' ? (
                <>
                  <div className="inspector-actions-step-hint">
                    На вход пойдут только выделенные вершины одного типа. Связи в этом сценарии не используются как объектный вход.
                  </div>
                  {selectedNodeTypeCounts.length === 0 ? (
                    <div className="inspector-actions-empty">На графе пока не выделено ни одной вершины.</div>
                  ) : selectedNodeTypeCounts.length > 1 ? (
                    <div className="inspector-actions-type-choice">
                      <div className="inspector-actions-step-hint">В выделении найдено несколько типов объектов. Выберите один тип для запуска:</div>
                      <div className="inspector-actions-source-grid">
                        {selectedNodeTypeCounts.map((item) => (
                          <button
                            key={item.type}
                            type="button"
                            className={`inspector-actions-source-chip ${selectedGraphObjectType === item.type ? 'active' : ''}`}
                            onClick={() => setSelectedGraphObjectType(item.type)}
                          >
                            {item.type} ({item.count})
                          </button>
                        ))}
                      </div>
                    </div>
                  ) : null}
                </>
              ) : inputSource === 'clipboard' ? (
                <>
                  <div className="inspector-actions-manual-toolbar">
                    <select
                      className="property-input inspector-actions-type-select"
                      value={inputObjectType}
                      onChange={(event) => setInputObjectType(event.target.value)}
                    >
                      <option value="">Тип объектов</option>
                      {objectTypeOptions.map((type) => (
                        <option key={type} value={type}>{type}</option>
                      ))}
                    </select>
                    <button type="button" className="property-action secondary" onClick={() => void handlePasteFromClipboard()}>
                      Вставить из буфера
                    </button>
                  </div>
                  <textarea
                    className="property-input inspector-actions-textarea"
                    value={rawInput}
                    onChange={(event) => setRawInput(event.target.value)}
                    onPaste={handleManualInputPaste}
                    maxLength={MAX_RAW_INPUT_CHARS}
                    placeholder="Один объект на строку или список через запятую"
                  />
                  <div className="inspector-actions-step-hint">
                    До {MAX_OBJECT_COUNT.toLocaleString('ru-RU')} объектов, максимум {MAX_OBJECT_LENGTH} символов на одно значение.
                  </div>
                  {(inputValidation.errors.length > 0 || inputValidation.warnings.length > 0) && (
                    <div className="inspector-actions-validation">
                      {inputValidation.errors.map((item) => (
                        <div key={item} className="inspector-actions-validation-item error">{item}</div>
                      ))}
                      {inputValidation.warnings.map((item) => (
                        <div key={item} className="inspector-actions-validation-item warning">{item}</div>
                      ))}
                    </div>
                  )}
                </>
              ) : (
                <>
                  <div className="inspector-actions-manual-toolbar file-only">
                    <select
                      className="property-input inspector-actions-type-select"
                      value={inputObjectType}
                      onChange={(event) => setInputObjectType(event.target.value)}
                    >
                      <option value="">Тип объектов</option>
                      {objectTypeOptions.map((type) => (
                        <option key={type} value={type}>{type}</option>
                      ))}
                    </select>
                    <button type="button" className="property-action secondary" onClick={handleOpenFile}>
                      Открыть файл
                    </button>
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept=".txt,.csv"
                      style={{ display: 'none' }}
                      onChange={handleFileChange}
                    />
                  </div>
                  <div className="inspector-actions-step-hint">
                    До {MAX_OBJECT_COUNT.toLocaleString('ru-RU')} объектов, максимум {MAX_OBJECT_LENGTH} символов на одно значение, до {Math.round(MAX_FILE_SIZE_BYTES / 1024)} КБ из файла.
                  </div>
                  {(inputValidation.errors.length > 0 || inputValidation.warnings.length > 0) && (
                    <div className="inspector-actions-validation">
                      {inputValidation.errors.map((item) => (
                        <div key={item} className="inspector-actions-validation-item error">{item}</div>
                      ))}
                      {inputValidation.warnings.map((item) => (
                        <div key={item} className="inspector-actions-validation-item warning">{item}</div>
                      ))}
                    </div>
                  )}
                </>
              )}
            </div>
          )}

          {selectedProfile && (
            <div className="inspector-actions-step">
              <div className="inspector-actions-step-title">4. Preview входа</div>
              <div className="inspector-actions-preview-card">
                <div className="inspector-actions-preview-meta">
                  <span>Тип: <strong>{activeObjectType || 'не выбран'}</strong></span>
                  <span>Объектов: <strong>{effectiveSelectionContext.selected_nodes.length}</strong></span>
                  <span>Связей в контексте: <strong>{effectiveSelectionContext.selected_edges.length}</strong></span>
                </div>
                {effectiveSelectionContext.selected_nodes.length === 0 ? (
                  <div className="inspector-actions-empty">Пока нечего передавать в запуск.</div>
                ) : (
                  <div className="inspector-actions-preview-list">
                    {effectiveSelectionContext.selected_nodes.map((node) => {
                      const displayValue = String(node.label || node.node_id || node.id);
                      return (
                        <div key={node.id} className="inspector-actions-preview-item">
                          <div className="inspector-actions-preview-item-row">
                            <div>
                              <div className="inspector-actions-preview-item-title">{displayValue}</div>
                              <div className="inspector-actions-preview-item-meta">id: {node.id} • type: {node.type}</div>
                            </div>
                            <button
                              type="button"
                              className="inspector-actions-preview-remove"
                              onClick={() => handleRemovePreviewNode(node.id, displayValue)}
                            >
                              Удалить
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          )}

          {selectedProfile && analysisParams.length > 0 && (
            <div className="inspector-actions-step">
              <div className="inspector-actions-step-title">5. Параметры</div>
              {analysisParams.some((param) => isPeriodStartKey(getParamKey(param)) || isPeriodEndKey(getParamKey(param))) && (
                <div className="inspector-actions-period-presets">
                  <button type="button" className="property-action secondary" onClick={() => applyPeriodPreset(7)}>7 дней</button>
                  <button type="button" className="property-action secondary" onClick={() => applyPeriodPreset(30)}>30 дней</button>
                  <button type="button" className="property-action secondary" onClick={() => applyPeriodPreset(365)}>Год</button>
                </div>
              )}
              <div className="inspector-actions-params-grid">
                {analysisParams.map((param) => {
                  const key = getParamKey(param);
                  if (!key) return null;
                  const bindingMode = String(param.binding_mode || 'manual').trim().toLowerCase();
                  const isManual = bindingMode === 'manual';
                  const type = String(param.type || 'string').toLowerCase();
                  const value = paramValues[key] ?? (type === 'boolean' ? false : '');
                  const previewValue = getPreviewParamValue(param, value, effectiveSelectionContext, artifact);

                  return (
                    <div key={key} className="inspector-actions-param-card">
                      <div className="inspector-actions-param-head">
                        <div className="inspector-actions-param-title">{param.label || key}</div>
                        <div className={`inspector-actions-param-badge ${isManual ? 'manual' : 'auto'}`}>
                          {isManual ? 'Ввод вручную' : 'Заполняется автоматически'}
                        </div>
                      </div>
                      {isManual ? (
                        type === 'boolean' ? (
                          <label className="inspector-actions-checkbox">
                            <input
                              type="checkbox"
                              checked={Boolean(value)}
                              onChange={(event) => setParamValues((prev) => ({ ...prev, [key]: event.target.checked }))}
                            />
                            <span>{param.required ? 'Обязательный параметр' : 'Необязательный параметр'}</span>
                          </label>
                        ) : type === 'json' ? (
                          <textarea
                            className="property-input inspector-actions-textarea compact"
                            value={String(value)}
                            onChange={(event) => setParamValues((prev) => ({ ...prev, [key]: event.target.value }))}
                          />
                        ) : (
                          <input
                            className="property-input"
                            type={
                              type === 'date'
                                ? 'date'
                                : type === 'integer' || type === 'int' || type === 'number' || type === 'float'
                                  ? 'number'
                                  : 'text'
                            }
                            value={String(value)}
                            onChange={(event) => setParamValues((prev) => ({ ...prev, [key]: event.target.value }))}
                          />
                        )
                      ) : (
                        <div className="inspector-actions-param-preview">
                          {String(previewValue || '') || 'Пустое значение'}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </>
      )}

      {actionMode === 'transform' && (
        <>
          <div className="inspector-actions-step">
            <div className="inspector-actions-step-title">2. Преобразование</div>
            <div className="inspector-actions-step-hint">
              Сейчас преобразования используют текущее выделение графа: узлы {pluginContext.selected_nodes?.length || 0}, связи {pluginContext.selected_edges?.length || 0}.
            </div>
            {pluginsLoading ? (
              <div className="inspector-actions-empty">Подбираем доступные преобразования...</div>
            ) : pluginsError ? (
              <div className="inspector-actions-empty error">{pluginsError}</div>
            ) : groupedPlugins.length === 0 ? (
              <div className="inspector-actions-empty">Для этого контекста подходящих преобразований пока нет.</div>
            ) : (
              <div className="inspector-actions-plugin-groups">
                {groupedPlugins.map((group) => (
                  <div key={group.path} className="inspector-actions-plugin-group">
                    <div className="inspector-actions-plugin-group-title">{group.path}</div>
                    <div className="inspector-actions-plugin-list">
                      {group.items.map((plugin) => (
                        <button
                          key={plugin.id}
                          type="button"
                          className={`inspector-actions-plugin-item ${selectedPluginId === plugin.id ? 'active' : ''}`}
                          onClick={() => setSelectedPluginId(plugin.id)}
                        >
                          <div className="inspector-actions-plugin-name">{plugin.name}</div>
                          <div className="inspector-actions-plugin-description">{plugin.description}</div>
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {selectedPlugin && (
            <div className="inspector-actions-step">
              <div className="inspector-actions-step-title">3. Вход и запуск</div>
              <div className="inspector-actions-preview-card">
                <div className="inspector-actions-preview-meta">
                  <span>Плагин: <strong>{selectedPlugin.name}</strong></span>
                  <span>Узлов в выделении: <strong>{pluginContext.selected_nodes?.length || 0}</strong></span>
                  <span>Связей в выделении: <strong>{pluginContext.selected_edges?.length || 0}</strong></span>
                </div>
                <div className="inspector-actions-step-hint">
                  Для плагинов пока используется текущее выделение графа. Произвольный внешний ввод для преобразований добавим позже на более строгом контракте.
                </div>
              </div>
              <div className="inspector-actions-footer">
                <button
                  type="button"
                  className="property-action"
                  onClick={() => void onRunPlugin(selectedPlugin)}
                  disabled={runningPluginId === selectedPlugin.id}
                >
                  {runningPluginId === selectedPlugin.id ? 'Запуск...' : 'Запустить преобразование'}
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default InspectorActionsTab;
