import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { consoleApi } from '../../services/api';
import { useAppDispatch, useAppSelector } from '../../store';
import { fetchArtifacts, setCurrentArtifact } from '../../store/slices/artifactsSlice';
import type {
  ApiArtifact,
  ConsoleProcedureColumn,
  ConsoleProcedureParam,
  ConsoleProfile,
  ConsoleProfilesResponse,
  ConsoleRefreshResponse,
} from '../../types/api';
import { normalizeConsoleTabs } from '../../utils/consoleResultTabs';

type SortDir = 'asc' | 'desc';
type ParamInputValues = Record<string, string | boolean>;

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
  manual: 'Вручную',
  fixed: 'Фиксированное значение',
  project_context: 'Из контекста проекта',
  selection_json: 'JSON выделения',
  selected_node_ids_csv: 'ID выбранных узлов',
  selected_edge_ids_csv: 'ID выбранных связей',
  selected_node_labels_csv: 'Подписи выбранных узлов',
  selected_node_types_csv: 'Типы выбранных узлов',
  selected_node_attr_csv: 'Атрибуты выбранных узлов',
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
    return projectContextSourceLabels[bindingSource || 'project_id'] || 'Из контекста проекта';
  }
  if (bindingMode === 'selected_node_attr_csv' && attrKey) {
    return `Из атрибута "${attrKey}" выбранных узлов`;
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

  const initialTabId = useMemo(() => {
    const active = String(data.active_tab_id || '').trim();
    if (active && tabs.some((tab) => tab.id === active)) return active;
    return tabs[0]?.id || '';
  }, [data.active_tab_id, tabs]);

  const [activeTabId, setActiveTabId] = useState<string>(initialTabId);
  const [sortKey, setSortKey] = useState<string>('');
  const [sortDir, setSortDir] = useState<SortDir>('asc');
  const [filters, setFilters] = useState<Record<string, string>>({});

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
  }, [activeTabId]);

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

  const filteredRows = useMemo(() => {
    const activeFilters = Object.entries(filters)
      .filter(([, value]) => String(value || '').trim() !== '')
      .map(([key, value]) => [key, String(value).trim().toLowerCase()] as const);

    let nextRows = rows;
    if (activeFilters.length > 0) {
      nextRows = nextRows.filter((row) =>
        activeFilters.every(([key, value]) => normalize(row[key]).toLowerCase().includes(value)),
      );
    }

    if (!sortKey) return nextRows;

    return [...nextRows].sort((left, right) => {
      const leftValue = normalize(left[sortKey]);
      const rightValue = normalize(right[sortKey]);
      const result = leftValue.localeCompare(rightValue, 'ru', { sensitivity: 'base', numeric: true });
      return sortDir === 'asc' ? result : -result;
    });
  }, [rows, filters, sortKey, sortDir]);

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
      const response = await consoleApi.profiles() as ConsoleProfilesResponse;
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

    setExecuting(true);
    setError(null);
    setMessage(null);

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

  return (
    <div className="console-view" style={{ height: '100%', display: 'flex', flexDirection: 'column', minHeight: 0 }}>
      <div
        style={{
          padding: '12px',
          borderBottom: '1px solid #dbe3f0',
          display: 'flex',
          flexDirection: 'column',
          gap: 12,
          background: '#f8fafc',
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

        {(message || error) && (
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
              {profiles.map((profile) => (
                <option key={String(profile.key || profile.id)} value={String(profile.key || profile.id)}>
                  {profile.name} ({profile.key || profile.id})
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
              Процедура: <strong>{selectedProfile.schema_name || 'dbo'}.{selectedProfile.procedure_name || '-'}</strong>
              {selectedProfile.source_name && <span style={{ marginLeft: 12 }}>Источник: <strong>{selectedProfile.source_name}</strong></span>}
            </div>
            <div>
              В выделение уйдут: <strong>{selectionContext.nodesCount}</strong> узлов и <strong>{selectionContext.edgesCount}</strong> связей
              {selectedContextArtifact && <span style={{ marginLeft: 12 }}>Из графа: <strong>{selectedContextArtifact.name}</strong></span>}
            </div>
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
                    <div key={node.id} style={{ border: '1px solid #e2e8f0', borderRadius: 8, padding: '8px 10px', fontSize: 12 }}>
                      <div style={{ color: '#0f172a', fontWeight: 600 }}>{String(node.label || node.node_id || node.id)}</div>
                      <div style={{ color: '#475569', marginTop: 2 }}>
                        id: {node.id} · type: {node.type || '—'}
                      </div>
                      {Object.keys(node.attributes || {}).length > 0 && (
                        <div style={{ color: '#64748b', marginTop: 4 }}>
                          attrs: {Object.entries(node.attributes).slice(0, 3).map(([key, value]) => `${key}=${normalize(value)}`).join(' · ')}
                        </div>
                      )}
                    </div>
                  ))}
                  {nodePreview.remaining > 0 && (
                    <div style={{ fontSize: 12, color: '#64748b' }}>И ещё {nodePreview.remaining} узл.</div>
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
                    <div key={edge.id} style={{ border: '1px solid #e2e8f0', borderRadius: 8, padding: '8px 10px', fontSize: 12 }}>
                      <div style={{ color: '#0f172a', fontWeight: 600 }}>{String(edge.label || `${edge.from} → ${edge.to}`)}</div>
                      <div style={{ color: '#475569', marginTop: 2 }}>
                        id: {edge.id} · {edge.from} → {edge.to} · type: {edge.type || '—'}
                      </div>
                      {Object.keys(edge.attributes || {}).length > 0 && (
                        <div style={{ color: '#64748b', marginTop: 4 }}>
                          attrs: {Object.entries(edge.attributes).slice(0, 3).map(([key, value]) => `${key}=${normalize(value)}`).join(' · ')}
                        </div>
                      )}
                    </div>
                  ))}
                  {edgePreview.remaining > 0 && (
                    <div style={{ fontSize: 12, color: '#64748b' }}>И ещё {edgePreview.remaining} связей.</div>
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
                          type={type === 'number' || type === 'float' || type === 'integer' || type === 'int' ? 'number' : 'text'}
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
                      Тип: {type}
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
            {executing ? 'Выполнение...' : 'Выполнить процедуру'}
          </button>
        </div>
      </div>

      {tabs.length > 1 && (
        <div style={{ display: 'flex', gap: 8, padding: '8px 12px', borderBottom: '1px solid #dbe3f0', overflowX: 'auto' }}>
          {tabs.map((tab) => (
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

      <div style={{ flex: 1, overflow: 'auto', minHeight: 0 }}>
        {columns.length === 0 ? (
          <div style={{ padding: 16, color: '#64748b' }}>Нет данных в активной вкладке. Выбери процедуру и выполни её.</div>
        ) : (
          <table className="bottom-table" style={{ minWidth: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                {columns.map((column) => (
                  <th
                    key={`head-${column.key}`}
                    style={column.width ? { width: `${column.width}px`, minWidth: `${column.width}px` } : undefined}
                  >
                    <button type="button" className="bottom-sort-btn" onClick={() => handleSort(column.key)}>
                      {column.label || column.key}
                      {sortKey === column.key ? (sortDir === 'asc' ? ' ▲' : ' ▼') : ''}
                    </button>
                  </th>
                ))}
              </tr>
              <tr>
                {columns.map((column) => (
                  <th key={`flt-${column.key}`}>
                    <input
                      value={filters[column.key] || ''}
                      onChange={(event) => setFilters((prev) => ({ ...prev, [column.key]: event.target.value }))}
                      placeholder="Фильтр"
                      style={{ width: '100%', padding: '2px 6px', border: '1px solid #cbd5e1', borderRadius: 4, fontSize: 11 }}
                    />
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filteredRows.map((row, index) => (
                <tr key={`row-${index}`}>
                  {columns.map((column) => (
                    <td key={`row-${index}-${column.key}`}>{normalize(row[column.key])}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
};

export default ConsoleView;
