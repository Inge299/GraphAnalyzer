import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { flushSync } from 'react-dom';
import { consoleApi } from '../../services/api';
import { useAppDispatch, useAppSelector } from '../../store';
import { fetchArtifacts, setCurrentArtifact } from '../../store/slices/artifactsSlice';
import { setSelectedDomainEntities } from '../../store/slices/uiSlice';
import type {
  ApiArtifact,
  ConsoleProcedureColumn,
  ConsoleProcedureParam,
  ConsoleProfile,
  ConsoleProfilesResponse,
  ConsoleRefreshResponse,
} from '../../types/api';
import { normalizeConsoleTabs } from '../../utils/consoleResultTabs';
import { formatDateTime } from '../../utils/formatters';
import { selectedEntityFromRow, uniqueSelectedDomainEntities } from '../../utils/domainSelection';
import MapView from './MapView';

type SortDir = 'asc' | 'desc';
type ParamInputValues = Record<string, string | boolean>;
type DateFilterMode = 'before' | 'after' | 'between';

interface DateFilterValue {
  mode: DateFilterMode;
  from: string;
  to: string;
}

interface ConsoleViewProps {
  artifact: ApiArtifact;
}

interface ConsoleColumnData extends ConsoleProcedureColumn {
  key: string;
}

interface ConsoleTabData {
  id: string;
  name: string;
  columns: Array<string | ConsoleColumnData>;
  rows: Record<string, unknown>[];
  row_count?: number;
  view?: 'map';
  map_data?: Record<string, unknown>;
}

interface ConsoleArtifactData {
  profile_id?: string;
  profile_key?: string;
  profile_name?: string;
  tabs?: ConsoleTabData[];
  active_tab_id?: string | null;
  columns?: Array<string | ConsoleColumnData>;
  rows?: Record<string, unknown>[];
}

interface GraphSelectionNode {
  id: string;
  node_id: string;
  type: string;
  label?: unknown;
  attributes: Record<string, unknown>;
}

interface GraphSelectionEdge {
  id: string;
  from: string;
  to: string;
  type: string;
  label?: unknown;
  attributes: Record<string, unknown>;
}

interface SelectionContextShape {
  selected_nodes: GraphSelectionNode[];
  selected_edges: GraphSelectionEdge[];
  nodesCount: number;
  edgesCount: number;
}

const bindingModeLabels: Record<string, string> = {
  manual: '\u0412\u0440\u0443\u0447\u043d\u0443\u044e',
  fixed: '\u0424\u0438\u043a\u0441\u0438\u0440\u043e\u0432\u0430\u043d\u043d\u043e\u0435 \u0437\u043d\u0430\u0447\u0435\u043d\u0438\u0435',
  project_context: '\u0418\u0437 \u043a\u043e\u043d\u0442\u0435\u043a\u0441\u0442\u0430 \u043f\u0440\u043e\u0435\u043a\u0442\u0430',
  selection_json: 'JSON \u0432\u044b\u0434\u0435\u043b\u0435\u043d\u0438\u044f',
  selected_node_ids_csv: 'ID \u0432\u044b\u0431\u0440\u0430\u043d\u043d\u044b\u0445 \u0443\u0437\u043b\u043e\u0432',
  selected_edge_ids_csv: 'ID \u0432\u044b\u0431\u0440\u0430\u043d\u043d\u044b\u0445 \u0441\u0432\u044f\u0437\u0435\u0439',
  selected_node_labels_csv: '\u041f\u043e\u0434\u043f\u0438\u0441\u0438 \u0432\u044b\u0431\u0440\u0430\u043d\u043d\u044b\u0445 \u0443\u0437\u043b\u043e\u0432',
  selected_node_types_csv: '\u0422\u0438\u043f\u044b \u0432\u044b\u0431\u0440\u0430\u043d\u043d\u044b\u0445 \u0443\u0437\u043b\u043e\u0432',
  selected_node_attr_csv: '\u0410\u0442\u0440\u0438\u0431\u0443\u0442\u044b \u0432\u044b\u0431\u0440\u0430\u043d\u043d\u044b\u0445 \u0443\u0437\u043b\u043e\u0432',
};

const projectContextSourceLabels: Record<string, string> = {
  project_id: 'ID проекта',
  artifact_id: 'ID console-артефакта',
  context_artifact_id: 'ID графа-источника',
};

const normalize = (value: unknown): string => {
  if (value === null || value === undefined) return '';
  if (Array.isArray(value)) return value.join(', ');
  if (typeof value === 'object') return JSON.stringify(value);
  return String(value);
};

const isDateTimeColumn = (column: ConsoleColumnData): boolean =>
  ['date', 'datetime'].includes(String(column.type || '').trim().toLowerCase());

const parseDateTime = (value: unknown): number | null => {
  const source = normalize(value).trim();
  if (!source) return null;
  const ruMatch = source.match(/^(\d{2})\.(\d{2})\.(\d{4})(?:,?\s+(\d{2}):(\d{2})(?::(\d{2}))?)?$/);
  if (ruMatch) {
    const [, day, month, year, hours = '0', minutes = '0', seconds = '0'] = ruMatch;
    const result = new Date(Number(year), Number(month) - 1, Number(day), Number(hours), Number(minutes), Number(seconds));
    return Number.isNaN(result.getTime()) ? null : result.getTime();
  }
  const result = new Date(source);
  return Number.isNaN(result.getTime()) ? null : result.getTime();
};
const artifactTypeLabels: Record<string, string> = {
  console: 'Консольный результат',
  graph: 'Граф',
  table: 'Таблица',
  map: 'Карта',
  report: 'Отчет',
  text: 'Текстовый документ',
};
const weekdayOptions = [
  ['0', 'Пн'], ['1', 'Вт'], ['2', 'Ср'], ['3', 'Чт'], ['4', 'Пт'], ['5', 'Сб'], ['6', 'Вс'],
] as const;

const InteractiveHeatmap: React.FC<{ artifact: ApiArtifact; mapData: Record<string, unknown> }> = ({ artifact, mapData }) => {
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [timeFrom, setTimeFrom] = useState('');
  const [timeTo, setTimeTo] = useState('');
  const [weekdays, setWeekdays] = useState<Set<string>>(new Set());
  const rawPoints = useMemo(() => Array.isArray(mapData.filter_points) ? mapData.filter_points.filter((item): item is Record<string, unknown> => Boolean(item && typeof item === 'object')) : [], [mapData.filter_points]);
  const points = useMemo<Array<Record<string, unknown>>>(() => {
    const buckets = new Map<string, Record<string, unknown>>();
    rawPoints.forEach((row) => {
      const date = new Date(String(row.event_time || ''));
      if (Number.isNaN(date.getTime())) return;
      const dateValue = date.toISOString().slice(0, 10);
      const timeValue = `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
      const weekday = String((date.getDay() + 6) % 7);
      const matchesTime = !timeFrom && !timeTo ? true : !timeFrom ? timeValue <= timeTo : !timeTo ? timeValue >= timeFrom : timeFrom <= timeTo ? timeValue >= timeFrom && timeValue <= timeTo : timeValue >= timeFrom || timeValue <= timeTo;
      if ((dateFrom && dateValue < dateFrom) || (dateTo && dateValue > dateTo) || (weekdays.size && !weekdays.has(weekday)) || !matchesTime) return;
      const latitude = Number(row.latitude); const longitude = Number(row.longitude);
      if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return;
      const key = `${latitude.toFixed(6)},${longitude.toFixed(6)}`;
      const current = buckets.get(key) || { id: `heat-${buckets.size + 1}`, latitude, longitude, weight: 0, msisdns: new Set<string>(), first_event: String(row.event_time || ''), last_event: String(row.event_time || ''), address: row.address || '', lac: row.lac || '', bs: row.bs || '' };
      current.weight = Number(current.weight || 0) + Number(row.location_probability || 1);
      (current.msisdns as Set<string>).add(String(row.msisdn || ''));
      if (String(row.event_time || '') < String(current.first_event || '')) current.first_event = String(row.event_time || '');
      if (String(row.event_time || '') > String(current.last_event || '')) current.last_event = String(row.event_time || '');
      buckets.set(key, current);
    });
    return [...buckets.values()].map((point) => ({ ...point, msisdn: [...(point.msisdns as Set<string>)].filter(Boolean).slice(0, 3).join(', '), event_time: point.last_event })).sort((a, b) => Number((b as Record<string, unknown>).weight) - Number((a as Record<string, unknown>).weight));
  }, [dateFrom, dateTo, rawPoints, timeFrom, timeTo, weekdays]);
  const filteredMapData = useMemo(() => ({ ...mapData, points }), [mapData, points]);
  const reset = () => { setDateFrom(''); setDateTo(''); setTimeFrom(''); setTimeTo(''); setWeekdays(new Set()); };
  return <div style={{ display: 'flex', flexDirection: 'column', minHeight: 0, gap: 8 }}>
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', padding: '8px 12px', border: '1px solid #dbe3f0', borderRadius: 10, background: '#f8fafc', fontSize: 12 }}>
      <strong style={{ color: '#334155' }}>Фильтр</strong>
      <label>с <input type="date" value={dateFrom} onChange={(event) => setDateFrom(event.target.value)} /></label>
      <label>по <input type="date" value={dateTo} onChange={(event) => setDateTo(event.target.value)} /></label>
      <span style={{ width: 1, height: 22, background: '#dbe3f0' }} />
      <label>время <input type="time" value={timeFrom} onChange={(event) => setTimeFrom(event.target.value)} /></label>
      <span>—</span><input type="time" value={timeTo} onChange={(event) => setTimeTo(event.target.value)} aria-label="Время до" />
      <span style={{ width: 1, height: 22, background: '#dbe3f0' }} />
      <div style={{ display: 'flex', gap: 3 }}>{weekdayOptions.map(([day, label]) => <button key={day} type="button" onClick={() => setWeekdays((previous) => { const next = new Set(previous); if (next.has(day)) next.delete(day); else next.add(day); return next; })} style={{ minWidth: 29, padding: '3px 5px', borderRadius: 6, border: weekdays.has(day) ? '1px solid #2563eb' : '1px solid #cbd5e1', background: weekdays.has(day) ? '#dbeafe' : '#fff', color: weekdays.has(day) ? '#1d4ed8' : '#475569', fontWeight: 700 }}>{label}</button>)}</div>
      <button type="button" className="service-btn" onClick={reset} style={{ marginLeft: 'auto' }}>Сбросить</button>
    </div>
    <MapView artifact={artifact} _onUpdate={() => {}} dataOverride={filteredMapData} titleOverride="Тепловая карта" descriptionOverride={`Отфильтровано событий: ${points.reduce((total, point) => total + Number(point.weight || 0), 0).toFixed(2)}`} showRouteTable={false} />
  </div>;
};

const getFriendlyArtifactType = (value: unknown): string => {
  const key = String(value || '').trim().toLowerCase();
  return artifactTypeLabels[key] || String(value || 'Артефакт');
};

const normalizeColumn = (value: string | ConsoleColumnData): ConsoleColumnData => {
  if (typeof value === 'string') {
    return {
      key: value,
      original_name: value,
      label: value,
      type: 'string',
      width: null,
      visible: true,
    };
  }

  const key = String(value.key || value.original_name || '').trim();
  return {
    key,
    original_name: String(value.original_name || key).trim() || key,
    label: String(value.label || value.original_name || key).trim() || key,
    type: String(value.type || 'string'),
    width: typeof value.width === 'number' ? value.width : null,
    visible: value.visible !== false,
  };
};

const toTabList = (data: ConsoleArtifactData): ConsoleTabData[] =>
  normalizeConsoleTabs(data) as unknown as ConsoleTabData[];

const buildDefaultParamValues = (
  profile: ConsoleProfile | null,
  previous: Record<string, unknown>,
): ParamInputValues => {
  const next: ParamInputValues = {};
  const params = Array.isArray(profile?.params) ? profile.params : [];
  for (const spec of params) {
    const key = String(spec?.key || spec?.name || '').trim();
    if (!key) continue;
    const fallback =
      String(spec?.type || '').toLowerCase() === 'boolean'
        ? false
        : String(spec?.default ?? '');
    const raw = previous?.[key] ?? fallback;
    next[key] = typeof raw === 'boolean' ? raw : String(raw ?? '');
  }
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

const buildSelectionContext = (artifact: ApiArtifact | null, selectedElements: Array<{ type: string; id: string }>): SelectionContextShape => {
  if (!artifact || artifact.type !== 'graph') {
    return { selected_nodes: [], selected_edges: [], nodesCount: 0, edgesCount: 0 };
  }

  const graphData = artifact.data || { nodes: [], edges: [] };
  const nodes = Array.isArray(graphData.nodes) ? graphData.nodes : [];
  const edges = Array.isArray(graphData.edges) ? graphData.edges : [];
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

  return {
    selected_nodes,
    selected_edges,
    nodesCount: selected_nodes.length,
    edgesCount: selected_edges.length,
  };
};

const extractSelectedNodeAttrValues = (nodes: GraphSelectionNode[], attrKey: string): string[] => {
  const normalizedKey = String(attrKey || '').trim();
  if (!normalizedKey) return [];

  return nodes.flatMap((node) => {
    const raw =
      node.attributes?.[normalizedKey] ??
      (node as unknown as Record<string, unknown>)[normalizedKey];
    if (Array.isArray(raw)) {
      return raw.filter((item) => item !== null && item !== undefined && item !== '').map(String);
    }
    return raw !== null && raw !== undefined && raw !== '' ? [String(raw)] : [];
  });
};

const getParamKey = (param: ConsoleProcedureParam): string =>
  String(param.key || param.name || '').trim();

const getParamBindingHint = (param: ConsoleProcedureParam): string => {
  const bindingMode = String(param.binding_mode || 'manual').trim().toLowerCase();
  const bindingSource = String(param.binding_source || '').trim();
  const attrKey = String(param.binding_config?.attr_key || '').trim();

  if (bindingMode === 'project_context') {
    return projectContextSourceLabels[bindingSource || 'project_id'] || '\u0418\u0437 \u043a\u043e\u043d\u0442\u0435\u043a\u0441\u0442\u0430 \u043f\u0440\u043e\u0435\u043a\u0442\u0430';
  }
  if (bindingMode === 'selected_node_attr_csv' && attrKey) {
    return `\u0418\u0437 \u0430\u0442\u0440\u0438\u0431\u0443\u0442\u0430 "${attrKey}" \u0432\u044b\u0431\u0440\u0430\u043d\u043d\u044b\u0445 \u0443\u0437\u043b\u043e\u0432`;
  }
  return bindingModeLabels[bindingMode] || bindingMode;
};

const getPreviewParamValue = (
  param: ConsoleProcedureParam,
  manualValue: string | boolean | undefined,
  selectionContext: SelectionContextShape,
  artifact: ApiArtifact,
  contextArtifactId: string,
): unknown => {
  const bindingMode = String(param.binding_mode || 'manual').trim().toLowerCase();
  const bindingSource = String(param.binding_source || '').trim();
  const attrKey = String(param.binding_config?.attr_key || '').trim();
  const key = getParamKey(param);

  if (bindingMode === 'manual') {
    return coerceParamValue(param.type, manualValue ?? '');
  }
  if (bindingMode === 'fixed') {
    return param.default ?? '';
  }
  if (bindingMode === 'project_context') {
    if (bindingSource === 'artifact_id') return artifact.id;
    if (bindingSource === 'context_artifact_id') return contextArtifactId || '';
    return artifact.project_id;
  }
  if (bindingMode === 'selection_json') {
    return JSON.stringify(
      {
        project_id: artifact.project_id,
        artifact_id: artifact.id,
        context_artifact_id: contextArtifactId || null,
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
      .filter((item) => item !== null && item !== undefined && item !== '')
      .map(String)
      .join(', ');
  }
  if (bindingMode === 'selected_node_attr_csv') {
    return extractSelectedNodeAttrValues(selectionContext.selected_nodes, attrKey).join(', ');
  }

  return key ? coerceParamValue(param.type, manualValue ?? '') : '';
};

const previewSelectionItems = <T,>(items: T[], limit = 8): { visible: T[]; remaining: number } => ({
  visible: items.slice(0, limit),
  remaining: Math.max(0, items.length - limit),
});

const ConsoleView: React.FC<ConsoleViewProps> = ({ artifact }) => {
  const dispatch = useAppDispatch();
  const artifacts = useAppSelector((state) => state.artifacts.items);
  const selectedElements = useAppSelector((state) => state.ui.selectedElements);

  const data = (artifact.data || {}) as ConsoleArtifactData;
  const tabs = useMemo(() => toTabList(data), [data]);

  const profileId = String(data.profile_id || data.profile_key || '');
  const isLocationTimeline = profileId === 'location_timeline';
  const isMovementAnalysis = profileId === 'movement_analysis';
  const movementMapTab = useMemo(
    () => tabs.find((tab) => tab.id === 'map' && tab.view === 'map' && tab.map_data),
    [tabs],
  );

  const initialTabId = useMemo(() => {
    const active = String(data.active_tab_id || '').trim();
    if (active && tabs.some((tab) => tab.id === active)) return active;
    return tabs[0]?.id || '';
  }, [data.active_tab_id, tabs]);

  const [activeTabId, setActiveTabId] = useState<string>(initialTabId);
  const [sortKey, setSortKey] = useState<string>('');
  const [sortDir, setSortDir] = useState<SortDir>('asc');
  const [filters, setFilters] = useState<Record<string, string>>({});
  const [dateFilters, setDateFilters] = useState<Record<string, DateFilterValue>>({});
  const [selectedLocationIds, setSelectedLocationIds] = useState<string[]>([]);
  const [selectedMapPointId, setSelectedMapPointId] = useState<string | null>(null);
  const [selectedRows, setSelectedRows] = useState<Record<string, Record<string, unknown>>>({});
  const [tablePage, setTablePage] = useState(1);
  const [tablePageSize, setTablePageSize] = useState(100);
  const [filtersExpanded, setFiltersExpanded] = useState(false);
  const [consoleTopTab, setConsoleTopTab] = useState<'results' | 'params'>('results');
  const [showUnmappedLocationRows, setShowUnmappedLocationRows] = useState(false);

  const [profiles, setProfiles] = useState<ConsoleProfile[]>([]);
  const [profilesLoading, setProfilesLoading] = useState(false);
  const [executing, setExecuting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [selectedProfileId, setSelectedProfileId] = useState<string>(
    String(artifact.metadata?.console_profile_id || data.profile_key || data.profile_id || '').trim(),
  );
  const [contextArtifactId, setContextArtifactId] = useState<string>(
    String(artifact.metadata?.console_context_artifact_id || '').trim(),
  );
  const [paramValues, setParamValues] = useState<ParamInputValues>({});

  useEffect(() => {
    setActiveTabId(initialTabId);
  }, [initialTabId]);

  useEffect(() => {
    setSortKey('');
    setSortDir('asc');
    setFilters({});
    setDateFilters({});
    setSelectedRows({});
    setSelectedLocationIds([]);
    setSelectedMapPointId(null);
    setTablePage(1);
  }, [activeTabId]);

  useEffect(() => {
    if (!isMovementAnalysis || activeTabId !== 'map') return;
    setActiveTabId(tabs.find((tab) => tab.id === 'locations')?.id || tabs.find((tab) => tab.id !== 'map')?.id || '');
  }, [activeTabId, isMovementAnalysis, tabs]);

  const activeTab = useMemo(
    () => tabs.find((tab) => tab.id === activeTabId) || tabs[0],
    [tabs, activeTabId],
  );
  const columns = useMemo(() => {
    if (!activeTab) return [] as ConsoleColumnData[];
    if (activeTab.columns.length > 0) {
      return activeTab.columns.map(normalizeColumn).filter((column) => column.visible !== false && column.key);
    }
    const first = activeTab.rows[0];
    if (first && typeof first === 'object') {
      return Object.keys(first).map((item) => normalizeColumn(item));
    }
    return [] as ConsoleColumnData[];
  }, [activeTab]);

  const rows = useMemo(() => activeTab?.rows || [], [activeTab]);
  const selectedEntities = useMemo(
    () => uniqueSelectedDomainEntities(Object.values(selectedRows).map(selectedEntityFromRow)),
    [selectedRows],
  );

  useEffect(() => {
    dispatch(setSelectedDomainEntities(selectedEntities));
  }, [dispatch, selectedEntities]);

  useEffect(() => () => {
    dispatch(setSelectedDomainEntities([]));
  }, [dispatch]);

  const filteredRows = useMemo(() => {
    const dateColumnKeys = new Set(columns.filter(isDateTimeColumn).map((column) => column.key));
    const activeFilters = Object.entries(filters)
      .filter(([key, value]) => !dateColumnKeys.has(key) && String(value || '').trim() !== '')
      .map(([key, value]) => [key, String(value).trim().toLowerCase()] as const);
    const activeDateFilters = Object.entries(dateFilters).filter(([, filter]) =>
      filter.mode === 'between'
        ? Boolean(filter.from || filter.to)
        : Boolean(filter.from),
    );

    let nextRows = rows;
    if (activeFilters.length > 0 || activeDateFilters.length > 0) {
      nextRows = nextRows.filter((row) =>
        activeFilters.every(([key, value]) => normalize(row[key]).toLowerCase().includes(value)) &&
        activeDateFilters.every(([key, filter]) => {
          const rowTime = parseDateTime(row[key]);
          if (rowTime === null) return false;
          const from = parseDateTime(filter.from);
          const to = parseDateTime(filter.to);
          if (filter.mode === 'before') return from === null || rowTime <= from;
          if (filter.mode === 'after') return from === null || rowTime >= from;
          return (from === null || rowTime >= from) && (to === null || rowTime <= to);
        }),
      );
    }

    if (!sortKey) return nextRows;

    return [...nextRows].sort((left, right) => {
      const leftValue = normalize(left[sortKey]);
      const rightValue = normalize(right[sortKey]);
      const result = leftValue.localeCompare(rightValue, 'ru', { sensitivity: 'base', numeric: true });
      return sortDir === 'asc' ? result : -result;
    });
  }, [rows, columns, filters, dateFilters, sortKey, sortDir]);

  const displayedRows = useMemo(() => {
    if (!isLocationTimeline || activeTab?.id !== 'locations' || showUnmappedLocationRows) return filteredRows;
    return filteredRows.filter((row) => /^[-+]?\d+(?:\.\d+)?\s*,\s*[-+]?\d+(?:\.\d+)?$/.test(normalize(row.coordinates).trim()));
  }, [activeTab?.id, filteredRows, isLocationTimeline, showUnmappedLocationRows]);
  const pageCount = Math.max(1, Math.ceil(displayedRows.length / tablePageSize));
  const currentPage = Math.min(tablePage, pageCount);
  const pageStart = (currentPage - 1) * tablePageSize;
  const pagedRows = useMemo(
    () => displayedRows.slice(pageStart, pageStart + tablePageSize),
    [displayedRows, pageStart, tablePageSize],
  );

  useEffect(() => {
    setTablePage(1);
  }, [activeTabId, filters, dateFilters, sortKey, sortDir, showUnmappedLocationRows]);

  const graphArtifacts = useMemo(
    () =>
      Object.values(artifacts)
        .filter((item): item is ApiArtifact => Boolean(item && item.project_id === artifact.project_id && item.type === 'graph'))
        .sort((left, right) => left.name.localeCompare(right.name, 'ru')),
    [artifacts, artifact.project_id],
  );

  const selectedProfile = useMemo(
    () => profiles.find((item) => String(item.key || item.id) === selectedProfileId) || null,
    [profiles, selectedProfileId],
  );

  const visibleProfiles = useMemo(
    () => profiles.filter((item) => item.hidden_from_menu !== true).sort((left, right) =>
      (Number(left.menu_order || 0) - Number(right.menu_order || 0)) || left.name.localeCompare(right.name, 'ru')),
    [profiles],
  );

  const resultTitle = useMemo(() => {
    if (activeTab?.name) return String(activeTab.name);
    return String(selectedProfile?.name || data.profile_name || 'Результат');
  }, [activeTab?.name, selectedProfile?.name, data.profile_name]);

  const resultDescription = useMemo(() => {
    if (selectedProfile?.description) return String(selectedProfile.description);
    if (selectedProfileId === 'project_artifacts_inventory') {
      return 'Список всех артефактов текущего проекта с типом, названием, версией и временем последнего обновления.';
    }
    return '';
  }, [selectedProfile?.description, selectedProfileId]);

  const resultSummary = useMemo(() => {
    if (selectedProfileId !== 'project_artifacts_inventory') return '';
    const graphCount = rows.filter((row) => String(row.type || '').toLowerCase() === 'graph').length;
    const consoleCount = rows.filter((row) => String(row.type || '').toLowerCase() === 'console').length;
    const otherCount = Math.max(0, rows.length - graphCount - consoleCount);
    return `\u0412\u0441\u0435\u0433\u043e \u0430\u0440\u0442\u0435\u0444\u0430\u043a\u0442\u043e\u0432: ${rows.length}. \u0413\u0440\u0430\u0444\u043e\u0432: ${graphCount}. \u041a\u043e\u043d\u0441\u043e\u043b\u0435\u0439: ${consoleCount}. \u041f\u0440\u043e\u0447\u0438\u0445: ${otherCount}.`;
  }, [rows, selectedProfileId]);
  const selectedContextArtifact = useMemo(
    () => graphArtifacts.find((item) => String(item.id) === contextArtifactId) || null,
    [graphArtifacts, contextArtifactId],
  );

  const selectionContext = useMemo(
    () => buildSelectionContext(selectedContextArtifact, selectedElements),
    [selectedContextArtifact, selectedElements],
  );

  const loadProfiles = useCallback(async () => {
    setProfilesLoading(true);
    setError(null);
    try {
      const response = await consoleApi.executors() as ConsoleProfilesResponse;
      const nextProfiles = Array.isArray(response?.profiles) ? response.profiles : [];
      setProfiles(nextProfiles);
      if (!selectedProfileId && nextProfiles.length > 0) {
        setSelectedProfileId(String(nextProfiles[0].key || nextProfiles[0].id));
      }
    } catch (err: any) {
      setError(String(err?.response?.data?.detail || err?.message || 'Не удалось загрузить профили консоли'));
    } finally {
      setProfilesLoading(false);
    }
  }, [selectedProfileId]);

  useEffect(() => {
    void loadProfiles();
  }, [loadProfiles]);

  useEffect(() => {
    if (!selectedProfile) return;
    setParamValues((prev) => {
      const baseline = buildDefaultParamValues(
        selectedProfile,
        artifact.metadata?.console_last_params || {},
      );
      const currentProfileId = String(
        artifact.metadata?.console_profile_id || data.profile_key || data.profile_id || '',
      ).trim();
      if (Object.keys(prev).length > 0 && currentProfileId === String(selectedProfile.key || selectedProfile.id)) {
        return { ...baseline, ...prev };
      }
      return baseline;
    });
  }, [artifact.metadata, data.profile_id, data.profile_key, selectedProfile]);

  const canOpenArtifactFromRow = useCallback((row: Record<string, unknown>) => {
    const rawId = row?.artifact_id;
    const artifactId = typeof rawId === 'number' ? rawId : Number(rawId);
    return Number.isFinite(artifactId) && Boolean(artifacts[artifactId]);
  }, [artifacts]);

  const handleOpenArtifact = useCallback((row: Record<string, unknown>) => {
    const rawId = row?.artifact_id;
    const artifactId = typeof rawId === 'number' ? rawId : Number(rawId);
    if (!Number.isFinite(artifactId)) return;
    dispatch(setCurrentArtifact(artifactId));
  }, [dispatch]);

  const handleSort = (key: string) => {
    if (sortKey === key) {
      setSortDir((prev) => (prev === 'asc' ? 'desc' : 'asc'));
      return;
    }
    setSortKey(key);
    setSortDir('asc');
  };

  const handleExecute = useCallback(async () => {
    if (!selectedProfile) {
      setError('Выбери профиль консоли');
      return;
    }

    flushSync(() => setExecuting(true));
    setError(null);
    setMessage(null);
    await new Promise<void>((resolve) => window.requestAnimationFrame(() => resolve()));

    try {
      const params: Record<string, unknown> = {};
      for (const spec of selectedProfile.params || []) {
        const key = getParamKey(spec);
        if (!key) continue;
        params[key] = coerceParamValue(spec.type, paramValues[key] ?? '');
      }

      const context = selectedContextArtifact
        ? {
            selected_nodes: selectionContext.selected_nodes,
            selected_edges: selectionContext.selected_edges,
          }
        : undefined;

      const updated = await consoleApi.refresh(
        artifact.project_id,
        artifact.id,
        String(selectedProfile.key || selectedProfile.id),
        params,
        context,
        selectedContextArtifact ? selectedContextArtifact.id : null,
      ) as ConsoleRefreshResponse;

      dispatch(setCurrentArtifact(updated.id));
      await dispatch(fetchArtifacts(artifact.project_id));
      setMessage(`Консоль обновлена: ${selectedProfile.name}`);
    } catch (err: any) {
      setError(String(err?.response?.data?.detail || err?.message || 'Не удалось выполнить процедуру'));
    } finally {
      setExecuting(false);
    }
  }, [
    artifact.id,
    artifact.project_id,
    dispatch,
    paramValues,
    selectedContextArtifact,
    selectedProfile,
    selectionContext.selected_edges,
    selectionContext.selected_nodes,
  ]);

  const nodePreview = useMemo(
    () => previewSelectionItems(selectionContext.selected_nodes),
    [selectionContext.selected_nodes],
  );
  const edgePreview = useMemo(
    () => previewSelectionItems(selectionContext.selected_edges),
    [selectionContext.selected_edges],
  );

  if (executing) {
    return (
      <div className="console-view" style={{ height: '100%', minHeight: 0, overflow: 'hidden' }}>
        <div className="artifact-load-state" role="status" aria-live="polite">
          <div className="artifact-load-spinner" />
          <h2>Выполняем анализ</h2>
          <p>Получаем и обрабатываем данные. Для больших выборок это может занять несколько секунд.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="console-view" style={{ height: '100%', display: 'flex', flexDirection: 'column', minHeight: 0, overflow: 'hidden' }}>
      <div
        style={{
          padding: '12px',
          borderBottom: '1px solid #dbe3f0',
          display: 'flex',
          flexDirection: 'column',
          gap: 12,
          background: '#f8fafc',
          flex: '0 1 auto',
          maxHeight: '52%',
          overflowY: 'auto',
          overflowX: 'hidden',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
          <div style={{ fontSize: 12, color: '#475569' }}>
            Профиль: <strong>{String(data.profile_name || data.profile_key || data.profile_id || '-')}</strong>
            <span style={{ marginLeft: 12 }}>Вкладок: <strong>{tabs.length}</strong></span>
            <span style={{ marginLeft: 12 }}>Строк: <strong>{filteredRows.length}</strong></span>
          </div>
          <button
            type="button"
            className="service-btn"
            onClick={() => void loadProfiles()}
            disabled={profilesLoading || executing}
          >
            {profilesLoading ? 'Загрузка профилей...' : 'Обновить профили'}
          </button>
        </div>

                <div style={{ display: 'flex', gap: 8, borderBottom: '1px solid #dbe3f0', paddingBottom: 8 }}>
          {([['results', '\u0420\u0435\u0437\u0443\u043b\u044c\u0442\u0430\u0442\u044b'], ['params', '\u041f\u0430\u0440\u0430\u043c\u0435\u0442\u0440\u044b']] as const).map(([id, label]) => (
            <button key={id} type="button" className="service-btn" onClick={() => setConsoleTopTab(id)} style={consoleTopTab === id ? { borderColor: '#2563eb', background: '#eff6ff', color: '#1d4ed8' } : undefined}>{label}</button>
          ))}
        </div>
        {consoleTopTab === 'params' && (<>{(message || error) && (
          <div
            style={{
              borderRadius: 8,
              padding: '8px 10px',
              fontSize: 13,
              background: error ? '#fef2f2' : '#ecfdf5',
              border: error ? '1px solid #fca5a5' : '1px solid #86efac',
              color: error ? '#991b1b' : '#166534',
            }}
          >
            {error || message}
          </div>
        )}

        <div className="service-form-grid" style={{ gridTemplateColumns: 'repeat(2, minmax(240px, 1fr))' }}>
          <label className="service-field">
            <span>Процедура</span>
            <select
              className="service-input"
              value={selectedProfileId}
              onChange={(event) => setSelectedProfileId(event.target.value)}
            >
              <option value="">Выбери процедуру</option>
              {visibleProfiles.map((profile) => (
                <option key={String(profile.key || profile.id)} value={String(profile.key || profile.id)}>
                  {profile.menu_path ? profile.menu_path + ' / ' : ''}{profile.name} ({profile.key || profile.id})
                </option>
              ))}
            </select>
          </label>

          <label className="service-field">
            <span>Граф-источник контекста</span>
            <select
              className="service-input"
              value={contextArtifactId}
              onChange={(event) => setContextArtifactId(event.target.value)}
            >
              <option value="">Без графового контекста</option>
              {graphArtifacts.map((graphArtifact) => (
                <option key={graphArtifact.id} value={String(graphArtifact.id)}>
                  {graphArtifact.name} (#{graphArtifact.id})
                </option>
              ))}
            </select>
          </label>
        </div>

        {selectedProfile && (
          <div style={{ fontSize: 12, color: '#475569', display: 'flex', flexDirection: 'column', gap: 4 }}>
            <div>
              {selectedProfile.executor_type === 'python' ? (
                <>Плагин: <strong>{selectedProfile.name}</strong></>
              ) : (
                <>Процедура: <strong>{selectedProfile.schema_name || 'dbo'}.{selectedProfile.procedure_name || '-'}</strong></>
              )}
              {selectedProfile.source_name && <span style={{ marginLeft: 12 }}>{'\u0418\u0441\u0442\u043e\u0447\u043d\u0438\u043a'}: <strong>{selectedProfile.source_name}</strong></span>}
            </div>
            <div>
              Выделено в контексте: <strong>{selectionContext.nodesCount}</strong> узл. и <strong>{selectionContext.edgesCount}</strong> связ.
              {selectedContextArtifact && <span style={{ marginLeft: 12 }}>{'\u0418\u0437 \u0433\u0440\u0430\u0444\u0430'}: <strong>{selectedContextArtifact.name}</strong></span>}
            </div>
          </div>
        )}

        {selectedProfile && (
          <div
            style={{
              border: '1px solid #dbe3f0',
              borderRadius: 10,
              background: '#ffffff',
              padding: 12,
              display: 'flex',
              flexDirection: 'column',
              gap: 6,
            }}
          >
            <div style={{ fontSize: 14, fontWeight: 700, color: '#0f172a' }}>{resultTitle}</div>
            {resultDescription && (
              <div style={{ fontSize: 12, color: '#475569' }}>{resultDescription}</div>
            )}
            <div style={{ fontSize: 12, color: '#334155' }}>
              Активная вкладка: <strong>{activeTab?.name || 'Основная'}</strong>. Показано строк: <strong>{filteredRows.length}</strong>
              {rows.length !== filteredRows.length && <span> из <strong>{rows.length}</strong></span>}.
            </div>
            {resultSummary && (
              <div style={{ fontSize: 12, color: '#334155' }}>{resultSummary}</div>
            )}
          </div>
        )}

        {selectedContextArtifact && (
          <div
            style={{
              border: '1px solid #dbe3f0',
              borderRadius: 10,
              background: '#ffffff',
              padding: 12,
              display: 'grid',
              gridTemplateColumns: 'repeat(2, minmax(260px, 1fr))',
              gap: 12,
            }}
          >
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: '#0f172a', marginBottom: 8 }}>
                Preview узлов ({selectionContext.nodesCount})
              </div>
              {nodePreview.visible.length === 0 ? (
                <div style={{ fontSize: 12, color: '#64748b' }}>Сейчас на выбранном графе не выделено ни одного узла.</div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {nodePreview.visible.map((node) => (
                    <div key={node.id} style={{ border: '1px solid #e2e8f0', borderRadius: 8, padding: '8px 10px', fontSize: 12, maxHeight: 180, overflow: 'auto', overflowWrap: 'anywhere' }}>
                      <div style={{ color: '#0f172a', fontWeight: 600 }}>{String(node.label || node.node_id || node.id)}</div>
                      <div style={{ color: '#475569', marginTop: 2 }}>
                        id: {node.id} В· type: {node.type || 'вЂ”'}
                      </div>
                      {Object.keys(node.attributes || {}).length > 0 && (
                        <div style={{ color: '#64748b', marginTop: 4 }}>
                          attrs: {Object.entries(node.attributes).slice(0, 3).map(([key, value]) => `${key}=${normalize(value)}`).join(' В· ')}
                        </div>
                      )}
                    </div>
                  ))}
                  {nodePreview.remaining > 0 && (
                    <div style={{ fontSize: 12, color: '#64748b' }}>{'\u0418 \u0435\u0449\u0451'} {nodePreview.remaining} {'\u0443\u0437\u043b\u043e\u0432'}.</div>
                  )}
                </div>
              )}
            </div>

            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: '#0f172a', marginBottom: 8 }}>
                Preview связей ({selectionContext.edgesCount})
              </div>
              {edgePreview.visible.length === 0 ? (
                <div style={{ fontSize: 12, color: '#64748b' }}>Сейчас на выбранном графе не выделено ни одной связи.</div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {edgePreview.visible.map((edge) => (
                    <div key={edge.id} style={{ border: '1px solid #e2e8f0', borderRadius: 8, padding: '8px 10px', fontSize: 12, maxHeight: 180, overflow: 'auto', overflowWrap: 'anywhere' }}>
                      <div style={{ color: '#0f172a', fontWeight: 600 }}>{String(edge.label || `${edge.from} в†’ ${edge.to}`)}</div>
                      <div style={{ color: '#475569', marginTop: 2 }}>
                        id: {edge.id} В· {edge.from} в†’ {edge.to} В· type: {edge.type || 'вЂ”'}
                      </div>
                      {Object.keys(edge.attributes || {}).length > 0 && (
                        <div style={{ color: '#64748b', marginTop: 4 }}>
                          attrs: {Object.entries(edge.attributes).slice(0, 3).map(([key, value]) => `${key}=${normalize(value)}`).join(' В· ')}
                        </div>
                      )}
                    </div>
                  ))}
                  {edgePreview.remaining > 0 && (
                    <div style={{ fontSize: 12, color: '#64748b' }}>{'\u0418 \u0435\u0449\u0451'} {edgePreview.remaining} {'\u0441\u0432\u044f\u0437\u0435\u0439'}.</div>
                  )}
                </div>
              )}
            </div>
          </div>
        )}

        {selectedProfile && (selectedProfile.params?.length || 0) > 0 && (
          <div
            style={{
              border: '1px solid #dbe3f0',
              borderRadius: 10,
              background: '#ffffff',
              padding: 12,
              display: 'flex',
              flexDirection: 'column',
              gap: 10,
            }}
          >
            <div style={{ fontSize: 13, fontWeight: 700, color: '#0f172a' }}>Параметры процедуры</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(240px, 1fr))', gap: 10 }}>
              {(selectedProfile.params || []).map((param) => {
                const key = getParamKey(param);
                if (!key || param.hidden) return null;

                const bindingMode = String(param.binding_mode || 'manual').trim().toLowerCase();
                const isManual = bindingMode === 'manual';
                const type = String(param.type || 'string').toLowerCase();
                const value = paramValues[key] ?? (type === 'boolean' ? false : '');
                const previewValue = getPreviewParamValue(param, value, selectionContext, artifact, contextArtifactId);
                const bindingHint = getParamBindingHint(param);

                const header = (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, justifyContent: 'space-between', flexWrap: 'wrap' }}>
                    <span>{param.label || key}</span>
                    <span
                      style={{
                        fontSize: 11,
                        fontWeight: 600,
                        color: isManual ? '#1d4ed8' : '#7c3aed',
                        background: isManual ? '#dbeafe' : '#ede9fe',
                        borderRadius: 999,
                        padding: '2px 8px',
                      }}
                    >
                      {bindingHint}
                    </span>
                  </div>
                );

                if (type === 'weekday_set') {
                  const selectedWeekdays = new Set(String(value || '').split(',').map((item) => item.trim()).filter(Boolean));
                  return (
                    <div key={key} className="service-field" style={{ border: '1px solid #e2e8f0', borderRadius: 10, padding: 10, gap: 8 }}>
                      {header}
                      <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
                        {weekdayOptions.map(([day, label]) => (
                          <button
                            key={day}
                            type="button"
                            disabled={!isManual}
                            onClick={() => setParamValues((previous) => {
                              const next = new Set(String(previous[key] || '').split(',').map((item) => item.trim()).filter(Boolean));
                              if (next.has(day)) next.delete(day); else next.add(day);
                              return { ...previous, [key]: [...next].sort().join(',') };
                            })}
                            style={{ minWidth: 34, border: selectedWeekdays.has(day) ? '1px solid #2563eb' : '1px solid #cbd5e1', background: selectedWeekdays.has(day) ? '#dbeafe' : '#fff', color: selectedWeekdays.has(day) ? '#1d4ed8' : '#475569', borderRadius: 7, padding: '5px 7px', fontWeight: 700, cursor: isManual ? 'pointer' : 'default' }}
                          >{label}</button>
                        ))}
                      </div>
                      <div style={{ fontSize: 12, color: '#64748b' }}>Ничего не выбрано — учитываются все дни.</div>
                    </div>
                  );
                }

                if (type === 'boolean') {
                  return (
                    <div key={key} className="service-field" style={{ border: '1px solid #e2e8f0', borderRadius: 10, padding: 10, gap: 8 }}>
                      {header}
                      <label className="service-checkbox">
                        <input
                          type="checkbox"
                          checked={Boolean(value)}
                          disabled={!isManual}
                          onChange={(event) => setParamValues((prev) => ({ ...prev, [key]: event.target.checked }))}
                        />
                        <span>{param.required ? 'Обязательный параметр' : 'Необязательный параметр'}</span>
                      </label>
                    </div>
                  );
                }

                const isLongText = type === 'json' || String(previewValue).length > 180;
                return (
                  <div key={key} className="service-field" style={{ border: '1px solid #e2e8f0', borderRadius: 10, padding: 10, gap: 8 }}>
                    {header}
                    {isManual ? (
                      type === 'json' ? (
                        <textarea
                          className="service-textarea"
                          rows={5}
                          value={String(value)}
                          onChange={(event) => setParamValues((prev) => ({ ...prev, [key]: event.target.value }))}
                          placeholder={param.required ? 'Обязательный параметр' : ''}
                        />
                      ) : (
                        <input
                          className="service-input"
                          type={type === 'number' || type === 'float' || type === 'integer' || type === 'int' ? 'number' : (type === 'date' ? 'date' : (type === 'time' ? 'time' : 'text'))}
                          value={String(value)}
                          onChange={(event) => setParamValues((prev) => ({ ...prev, [key]: event.target.value }))}
                          placeholder={param.required ? 'Обязательный параметр' : ''}
                          style={{ minWidth: 0 }}
                        />
                      )
                    ) : (
                      <div
                        style={{
                          border: '1px solid #cbd5e1',
                          borderRadius: 8,
                          background: '#f8fafc',
                          padding: '8px 10px',
                          fontSize: 12,
                          color: '#334155',
                          whiteSpace: isLongText ? 'pre-wrap' : 'normal',
                          wordBreak: 'break-word',
                          maxHeight: isLongText ? 180 : undefined,
                          overflow: isLongText ? 'auto' : undefined,
                        }}
                      >
                        {String(previewValue || '') || 'Пустое значение'}
                      </div>
                    )}
                    <div style={{ fontSize: 12, color: '#64748b' }}>
                      {'\u0422\u0438\u043f'}: {type}
                      {param.required ? ' · обязательный' : ' · необязательный'}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
          <button
            type="button"
            className="service-btn primary"
            onClick={() => void handleExecute()}
            disabled={!selectedProfile || executing}
          >
            {executing ? 'Выполнение...' : 'Запустить'}
          </button>
        </div>
        </>)}
      </div>

      {consoleTopTab === 'results' && tabs.length > 1 && (
        <div style={{ display: 'flex', gap: 8, padding: '8px 12px', borderBottom: '1px solid #dbe3f0', overflowX: 'auto', flexShrink: 0 }}>
          {isLocationTimeline && activeTab?.id === 'locations' && (
            <button type="button" className="service-btn" onClick={() => setShowUnmappedLocationRows((value) => !value)}>
              {showUnmappedLocationRows ? 'Скрыть без координат' : 'Показать без координат'}
            </button>
          )}          {tabs.filter((tab) => !(isMovementAnalysis && tab.id === 'map')).map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTabId(tab.id)}
              style={{
                border: activeTabId === tab.id ? '1px solid #2563eb' : '1px solid #cbd5e1',
                background: activeTabId === tab.id ? '#eff6ff' : '#fff',
                borderRadius: 6,
                padding: '4px 10px',
                fontSize: 12,
                cursor: 'pointer',
                whiteSpace: 'nowrap',
              }}
            >
              {tab.name}
              <span style={{ marginLeft: 6, color: '#64748b' }}>({tab.row_count ?? tab.rows.length})</span>
            </button>
          ))}
        </div>
      )}

      {consoleTopTab === 'results' && (
        <div
          className={`console-results${isMovementAnalysis ? ' movement-results' : ''}`}
          style={{
            flex: '1 1 420px',
            overflow: isMovementAnalysis ? 'hidden' : 'auto',
            minHeight: 320,
            display: isMovementAnalysis ? 'flex' : 'block',
            flexDirection: isMovementAnalysis ? 'column' : undefined,
          }}
        >
        {isMovementAnalysis && activeTab?.id !== 'map' && movementMapTab?.map_data && (
          <div className="movement-inline-map">
            <MapView
              artifact={artifact}
              _onUpdate={() => {}}
              dataOverride={movementMapTab.map_data}
              titleOverride={'\u041a\u0430\u0440\u0442\u0430 \u043f\u0435\u0440\u0435\u043c\u0435\u0449\u0435\u043d\u0438\u0439'}
              descriptionOverride={'\u0412\u044b\u0431\u0435\u0440\u0438\u0442\u0435 \u0441\u0442\u0440\u043e\u043a\u0438 \u043b\u043e\u043a\u0430\u0446\u0438\u0439, \u0441\u0442\u043e\u044f\u043d\u043e\u043a \u0438\u043b\u0438 \u043f\u0435\u0440\u0435\u043c\u0435\u0449\u0435\u043d\u0438\u0439: \u043d\u0430 \u043a\u0430\u0440\u0442\u0435 \u043e\u0441\u0442\u0430\u043d\u0443\u0442\u0441\u044f \u0442\u043e\u043b\u044c\u043a\u043e \u0441\u043e\u043e\u0442\u0432\u0435\u0442\u0441\u0442\u0432\u0443\u044e\u0449\u0438\u0435 \u0442\u043e\u0447\u043a\u0438 \u0438\u043b\u0438 \u043c\u0430\u0440\u0448\u0440\u0443\u0442.'}
              selectedPointId={selectedMapPointId || selectedLocationIds[0] || null}
              visiblePointIds={selectedLocationIds}
              onSelectPointIds={(pointIds) => {
                setSelectedLocationIds(pointIds);
                setSelectedMapPointId(pointIds[0] || null);
              }}
              showRouteTable={false}
            />
          </div>
        )}
        {activeTab?.view === 'map' && activeTab.map_data && profileId === 'movement_heatmap' ? (
          <InteractiveHeatmap artifact={artifact} mapData={activeTab.map_data} />
        ) : activeTab?.view === 'map' && activeTab.map_data ? (
          <MapView
            artifact={artifact}
            _onUpdate={() => {}}
            dataOverride={activeTab.map_data}
            titleOverride={`${artifact.name}: ${activeTab.name}`}
            descriptionOverride={'\u041c\u0430\u0440\u0448\u0440\u0443\u0442 \u043f\u043e \u043a\u043e\u043e\u0440\u0434\u0438\u043d\u0430\u0442\u0430\u043c \u0431\u0430\u0437\u043e\u0432\u044b\u0445 \u0441\u0442\u0430\u043d\u0446\u0438\u0439.'}
            showRouteTable={false}
          />
        ) : columns.length === 0 ? (
          <div style={{ padding: 16, color: '#64748b' }}>
            {'\u041d\u0435\u0442 \u0434\u0430\u043d\u043d\u044b\u0445 \u0432 \u0430\u043a\u0442\u0438\u0432\u043d\u043e\u0439 \u0432\u043a\u043b\u0430\u0434\u043a\u0435. \u0412\u044b\u0431\u0435\u0440\u0438\u0442\u0435 \u043f\u043b\u0430\u0433\u0438\u043d \u0438\u043b\u0438 \u043f\u0440\u043e\u0446\u0435\u0434\u0443\u0440\u0443 \u0438 \u0437\u0430\u043f\u0443\u0441\u0442\u0438\u0442\u0435 \u0435\u0435.'}
          </div>
        ) : (
          <div className="console-table-scroll">
          <div className="console-table-pagination">
            <span>{'\u0421\u0442\u0440\u043e\u043a\u0438 ' + (displayedRows.length ? pageStart + 1 : 0) + '\u2013' + Math.min(pageStart + tablePageSize, displayedRows.length) + ' \u0438\u0437 ' + displayedRows.length}</span>
            <label>{'\u041d\u0430 \u0441\u0442\u0440\u0430\u043d\u0438\u0446\u0435'}
              <select value={tablePageSize} onChange={(event) => setTablePageSize(Number(event.target.value))}>
                {[50, 100, 250, 500].map((size) => <option key={size} value={size}>{size}</option>)}
              </select>
            </label>
            <button type="button" className="service-btn" disabled={currentPage <= 1} onClick={() => setTablePage((page) => Math.max(1, page - 1))}>{'\u041d\u0430\u0437\u0430\u0434'}</button>
            <span>{currentPage} / {pageCount}</span>
            <button
              type="button"
              className="service-btn"
              aria-expanded={filtersExpanded}
              onClick={() => setFiltersExpanded((expanded) => !expanded)}
            >
              {filtersExpanded ? '\u0421\u043a\u0440\u044b\u0442\u044c \u0444\u0438\u043b\u044c\u0442\u0440\u044b' : '\u0424\u0438\u043b\u044c\u0442\u0440\u044b'}
            </button>
            <button type="button" className="service-btn" disabled={currentPage >= pageCount} onClick={() => setTablePage((page) => Math.min(pageCount, page + 1))}>{'\u0414\u0430\u043b\u0435\u0435'}</button>
          </div>
          <table className="bottom-table" style={{ width: 'max-content', minWidth: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                {columns.map((column) => (
                  <th
                    key={`head-${column.key}`}
                    style={column.width ? { width: `${column.width}px`, minWidth: `${column.width}px` } : undefined}
                  >
                    <button type="button" className="bottom-sort-btn" onClick={() => handleSort(column.key)}>
                      {column.label || column.key}
                      {sortKey === column.key ? (sortDir === 'asc' ? ' ^' : ' v') : ''}
                    </button>
                  </th>
                ))}
                <th style={{ width: '120px', minWidth: '120px' }}>{'\u0414\u0435\u0439\u0441\u0442\u0432\u0438\u044f'}</th>
              </tr>
              <tr style={{ display: filtersExpanded ? undefined : 'none' }}>
                {columns.map((column) => {
                  if (isDateTimeColumn(column)) {
                    const dateFilter = dateFilters[column.key] || { mode: 'between' as DateFilterMode, from: '', to: '' };
                    const isPeriod = dateFilter.mode === 'between';
                    const setDateFilter = (updates: Partial<DateFilterValue>) => setDateFilters((prev) => ({
                      ...prev,
                      [column.key]: { ...dateFilter, ...updates },
                    }));
                    const inputStyle: React.CSSProperties = { width: 120, minWidth: 120, padding: '2px 4px', border: '1px solid #cbd5e1', borderRadius: 4, fontSize: 11, boxSizing: 'border-box' };
                    return (
                      <th key={`flt-${column.key}`} style={{ minWidth: isPeriod ? 322 : 200 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 4, width: 'max-content' }}>
                          <select
                            value={dateFilter.mode}
                            onChange={(event) => setDateFilter({ mode: event.target.value as DateFilterMode })}
                            aria-label={`${column.label || column.key}: \u0440\u0435\u0436\u0438\u043c \u0444\u0438\u043b\u044c\u0442\u0440\u0430`}
                            style={{ width: 70, minWidth: 70, padding: '2px 4px', border: '1px solid #cbd5e1', borderRadius: 4, fontSize: 11 }}
                          >
                            <option value="before">{'\u0414\u043e'}</option>
                            <option value="after">{'\u041f\u043e\u0441\u043b\u0435'}</option>
                            <option value="between">{'\u0412 \u043f\u0435\u0440\u0438\u043e\u0434'}</option>
                          </select>
                          <input
                            type="datetime-local"
                            value={dateFilter.from}
                            onChange={(event) => setDateFilter({ from: event.target.value })}
                            title={isPeriod ? '\u041d\u0430\u0447\u0430\u043b\u043e \u043f\u0435\u0440\u0438\u043e\u0434\u0430' : dateFilter.mode === 'before' ? '\u0414\u043e' : '\u041f\u043e\u0441\u043b\u0435'}
                            aria-label={`${column.label || column.key}: \u043f\u0435\u0440\u0432\u0430\u044f \u0433\u0440\u0430\u043d\u0438\u0446\u0430`}
                            style={inputStyle}
                          />
                          {isPeriod && (
                            <>
                              <span style={{ color: '#64748b', fontSize: 12 }}>{'\u2014'}</span>
                              <input
                                type="datetime-local"
                                value={dateFilter.to}
                                onChange={(event) => setDateFilter({ to: event.target.value })}
                                title={'\u041e\u043a\u043e\u043d\u0447\u0430\u043d\u0438\u0435 \u043f\u0435\u0440\u0438\u043e\u0434\u0430'}
                                aria-label={`${column.label || column.key}: \u0432\u0442\u043e\u0440\u0430\u044f \u0433\u0440\u0430\u043d\u0438\u0446\u0430`}
                                style={inputStyle}
                              />
                            </>
                          )}
                        </div>
                      </th>
                    );
                  }
                  return (
                    <th key={`flt-${column.key}`}>
                      <input
                        value={filters[column.key] || ''}
                        onChange={(event) => setFilters((prev) => ({ ...prev, [column.key]: event.target.value }))}
                        placeholder={'\u0424\u0438\u043b\u044c\u0442\u0440'}
                        style={{ width: '100%', minWidth: 90, padding: '2px 6px', border: '1px solid #cbd5e1', borderRadius: 4, fontSize: 11, boxSizing: 'border-box' }}
                      />
                    </th>
                  );
                })}
                <th />
              </tr>
            </thead>
            <tbody>
              {pagedRows.map((row, index) => {
                const rowIndex = pageStart + index;
                const rowKey = `${activeTabId}:${rowIndex}`;
                const domainEntity = selectedEntityFromRow(row);
                const isSelected = Boolean(selectedRows[rowKey]);
                const locationPointIds = isMovementAnalysis
                  ? [...new Set([row.from_point_id, row.to_point_id, row.map_point_id]
                    .map((value) => String(value || ''))
                    .filter((value) => Boolean(value) && value !== '-'))]
                  : (isLocationTimeline ? [`${String(row.msisdn || '')}-${String(row.sequence || '')}`] : []);
                const isArtifactRow = canOpenArtifactFromRow(row);
                return (
                  <tr
                    key={`row-${rowIndex}`}
                    tabIndex={locationPointIds.length ? 0 : undefined}
                    onClick={(event) => {
                      if (domainEntity || locationPointIds.length) {
                        setSelectedRows((previous) => {
                          if (!event.ctrlKey && !event.metaKey) return { [rowKey]: row };
                          const next = { ...previous };
                          if (next[rowKey]) delete next[rowKey];
                          else next[rowKey] = row;
                          return next;
                        });
                      }
                      if (locationPointIds.length) {
                        setSelectedLocationIds((previous) => {
                          if (!event.ctrlKey && !event.metaKey) return locationPointIds;
                          const next = new Set(previous);
                          const alreadySelected = locationPointIds.every((pointId) => next.has(pointId));
                          locationPointIds.forEach((pointId) => alreadySelected ? next.delete(pointId) : next.add(pointId));
                          return [...next];
                        });
                        setSelectedMapPointId(String(row.map_point_id || row.to_point_id || row.from_point_id || locationPointIds[0] || ''));
                      }
                      if (isArtifactRow) handleOpenArtifact(row);
                    }}
                    onKeyDown={(event) => {
                      if (!locationPointIds.length || (event.key !== 'ArrowDown' && event.key !== 'ArrowUp')) return;
                      const targetIndex = index + (event.key === 'ArrowDown' ? 1 : -1);
                      const targetRow = pagedRows[targetIndex];
                      if (!targetRow) return;
                      event.preventDefault();
                      const targetGlobalIndex = pageStart + targetIndex;
                      const targetKey = `${activeTabId}:${targetGlobalIndex}`;
                      const targetPointIds = isMovementAnalysis
                        ? [...new Set([targetRow.from_point_id, targetRow.to_point_id, targetRow.map_point_id]
                          .map((value) => String(value || '')).filter((value) => Boolean(value) && value !== '-'))]
                        : [`${String(targetRow.msisdn || '')}-${String(targetRow.sequence || '')}`];
                      setSelectedRows({ [targetKey]: targetRow });
                      setSelectedLocationIds(targetPointIds);
                      setSelectedMapPointId(String(targetRow.map_point_id || targetRow.to_point_id || targetRow.from_point_id || targetPointIds[0] || ''));
                      const rows = event.currentTarget.parentElement?.querySelectorAll('tr[tabindex="0"]');
                      (rows?.[targetIndex] as HTMLElement | undefined)?.focus();
                    }}
                    style={isSelected
                      ? { cursor: domainEntity || isArtifactRow || locationPointIds.length ? 'pointer' : undefined, background: '#dbeafe' }
                      : (domainEntity || isArtifactRow || locationPointIds.length ? { cursor: 'pointer' } : undefined)}
                  >
                  {columns.map((column) => (
                    <td key={`row-${rowIndex}-${column.key}`}>{column.key === 'type' ? getFriendlyArtifactType(row[column.key]) : (['date', 'datetime'].includes(String(column.type || '').toLowerCase()) ? formatDateTime(row[column.key]) : normalize(row[column.key]))}</td>
                  ))}
                  <td>
                    {canOpenArtifactFromRow(row) ? (
                      <button
                        type="button"
                        className="service-btn"
                        onClick={() => handleOpenArtifact(row)}
                        style={{ padding: '4px 8px', fontSize: 12 }}
                      >
                        {'\u041e\u0442\u043a\u0440\u044b\u0442\u044c'}
                      </button>
                    ) : (
                      <span style={{ color: '#94a3b8', fontSize: 12 }}>-</span>
                    )}
                  </td>
                </tr>
                );
              })}
            </tbody>
          </table>
          </div>
        )}
        </div>
      )}
    </div>
  );
};

export default ConsoleView;
