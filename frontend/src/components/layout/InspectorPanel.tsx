// frontend/src/components/layout/InspectorPanel.tsx
import React, { useState, useCallback, useMemo, useEffect } from 'react';
import { useAppDispatch, useAppSelector } from '../../store';
import { fetchArtifacts, deleteArtifact, updateArtifactSync, setCurrentArtifact } from '../../store/slices/artifactsSlice';
import { artifactApi, pluginApi, domainModelApi } from '../../services/api';
import type { ApiPlugin, ApiArtifact, PluginExecutionContext, DomainModelConfig } from '../../types/api';
import type { SelectedElement } from '../../store/slices/uiSlice';
import './InspectorPanel.css';

interface InspectorPanelProps {
  onApplyGraphData?: (newData: any, description: string, actionType: string) => Promise<void> | void;
}

const labels = {
  inspector: '\u0418\u043d\u0441\u043f\u0435\u043a\u0442\u043e\u0440',
  selectArtifact: '\u0412\u044b\u0431\u0435\u0440\u0438\u0442\u0435 \u0430\u0440\u0442\u0435\u0444\u0430\u043a\u0442 \u0434\u043b\u044f \u043f\u0440\u043e\u0441\u043c\u043e\u0442\u0440\u0430',
  properties: '\u041e\u0431\u0449\u0430\u044f',
  history: '\u0418\u0441\u0442\u043e\u0440\u0438\u044f',
  metadata: '\u041c\u0435\u0442\u0430\u0434\u0430\u043d\u043d\u044b\u0435',
  name: '\u041d\u0430\u0437\u0432\u0430\u043d\u0438\u0435',
  type: '\u0422\u0438\u043f',
  description: '\u041e\u043f\u0438\u0441\u0430\u043d\u0438\u0435',
  version: '\u0412\u0435\u0440\u0441\u0438\u044f',
  created: '\u0421\u043e\u0437\u0434\u0430\u043d',
  updated: '\u041e\u0431\u043d\u043e\u0432\u043b\u0435\u043d',
  plugins: '\u041f\u043b\u0430\u0433\u0438\u043d\u044b',
  loading: '\u0417\u0430\u0433\u0440\u0443\u0437\u043a\u0430...',
  noPlugins: '\u041d\u0435\u0442 \u0434\u043e\u0441\u0442\u0443\u043f\u043d\u044b\u0445 \u043f\u043b\u0430\u0433\u0438\u043d\u043e\u0432',
  pluginRun: '\u0417\u0430\u043f\u0443\u0441\u0442\u0438\u0442\u044c',
  pluginRunning: '\u0417\u0430\u043f\u0443\u0441\u043a...',
  pluginDone: '\u041f\u043b\u0430\u0433\u0438\u043d "{name}" \u0432\u044b\u043f\u043e\u043b\u043d\u0435\u043d',
  typeGraph: '\u0413\u0440\u0430\u0444',
  typeTable: '\u0422\u0430\u0431\u043b\u0438\u0446\u0430',
  typeMap: '\u041a\u0430\u0440\u0442\u0430',
  typeChart: '\u0414\u0438\u0430\u0433\u0440\u0430\u043c\u043c\u0430',
  typeDocument: '\u0414\u043e\u043a\u0443\u043c\u0435\u043d\u0442',
  historyPlaceholder: '\u0418\u0441\u0442\u043e\u0440\u0438\u044f \u0438\u0437\u043c\u0435\u043d\u0435\u043d\u0438\u0439',
  artifactId: 'ID \u0430\u0440\u0442\u0435\u0444\u0430\u043a\u0442\u0430',
  projectId: 'ID \u043f\u0440\u043e\u0435\u043a\u0442\u0430',
  extraMetadata: '\u0414\u043e\u043f. \u043c\u0435\u0442\u0430\u0434\u0430\u043d\u043d\u044b\u0435',
  rename: '\u041f\u0435\u0440\u0435\u0438\u043c\u0435\u043d\u043e\u0432\u0430\u0442\u044c',
  renameConfirm: '\u041f\u0435\u0440\u0435\u0438\u043c\u0435\u043d\u043e\u0432\u0430\u0442\u044c \u0430\u0440\u0442\u0435\u0444\u0430\u043a\u0442? \u042d\u0442\u043e \u0438\u0437\u043c\u0435\u043d\u0438\u0442 \u0435\u0433\u043e \u043d\u0430\u0437\u0432\u0430\u043d\u0438\u0435.',
  delete: '\u0423\u0434\u0430\u043b\u0438\u0442\u044c',
  deleteConfirm: '\u0423\u0434\u0430\u043b\u0438\u0442\u044c \u0430\u0440\u0442\u0435\u0444\u0430\u043a\u0442? \u042d\u0442\u043e \u0434\u0435\u0439\u0441\u0442\u0432\u0438\u0435 \u043d\u0435\u043e\u0431\u0440\u0430\u0442\u0438\u043c\u043e.',
  cancel: '\u041e\u0442\u043c\u0435\u043d\u0430',
  save: '\u0421\u043e\u0445\u0440\u0430\u043d\u0438\u0442\u044c',
  selectResult: '\u0412\u044b\u0431\u0435\u0440\u0438\u0442\u0435 \u0440\u0435\u0437\u0443\u043b\u044c\u0442\u0430\u0442',
  elementProps: '\u0421\u0432\u043e\u0439\u0441\u0442\u0432\u0430',
  selectedCount: '\u041a\u043e\u043b-\u0432\u043e',
  mixedSelection: '\u0412\u044b\u0434\u0435\u043b\u0435\u043d\u044b \u0438 \u0432\u0435\u0440\u0448\u0438\u043d\u044b, \u0438 \u0441\u0432\u044f\u0437\u0438. \u0412\u044b\u0431\u0435\u0440\u0438\u0442\u0435 \u043e\u0434\u0438\u043d \u0442\u0438\u043f \u044d\u043b\u0435\u043c\u0435\u043d\u0442\u043e\u0432.',
  elementLabel: '\u0422\u0435\u043a\u0441\u0442',
  elementColor: '\u0426\u0432\u0435\u0442',
  elementIcon: '\u0418\u043a\u043e\u043d\u043a\u0430',
  iconScale: '\u0420\u0430\u0437\u043c\u0435\u0440 \u0438\u043a\u043e\u043d\u043a\u0438',
  ringEnabled: '\u0420\u0430\u043c\u043a\u0430',
  ringWidth: '\u0422\u043e\u043b\u0449\u0438\u043d\u0430 \u0440\u0430\u043c\u043a\u0438',
  edgeWidth: '\u0422\u043e\u043b\u0449\u0438\u043d\u0430 \u0441\u0432\u044f\u0437\u0438',
  edgeDirection: '\u041d\u0430\u043f\u0440\u0430\u0432\u043b\u0435\u043d\u0438\u0435',
  edgeStyle: '\u0422\u0438\u043f \u043b\u0438\u043d\u0438\u0438',
  apply: '\u041f\u0440\u0438\u043c\u0435\u043d\u0438\u0442\u044c',
  noSelection: '\u0412\u044b\u0434\u0435\u043b\u0438\u0442\u0435 \u044d\u043b\u0435\u043c\u0435\u043d\u0442 \u043d\u0430 \u0433\u0440\u0430\u0444\u0435',
  unchanged: '\u0411\u0435\u0437 \u0438\u0437\u043c\u0435\u043d\u0435\u043d\u0438\u0439',
  on: '\u0415\u0441\u0442\u044c',
  off: '\u041d\u0435\u0442',
  solid: '\u0421\u043f\u043b\u043e\u0448\u043d\u0430\u044f',
  dashed: '\u041f\u0443\u043d\u043a\u0442\u0438\u0440\u043d\u0430\u044f'
};

const fallbackIconOptions = [
  { value: 'smartphone', label: 'Smartphone' },
  { value: 'sim', label: 'SIM card' },
  { value: 'person_phone', label: 'Subscriber' },
  { value: 'ip', label: 'IP' },
  { value: 'mail', label: 'Email' },
  { value: 'social', label: 'Social ID' },
  { value: 'passport', label: 'Passport' },
  { value: 'car', label: 'Car number' },
  { value: 'address', label: 'Address' },
  { value: 'location', label: 'Location' },
  { value: 'bank_card', label: 'Bank card' }
];

const iconScaleOptions = ['1', '2', '3', '4', '5'];
const nodeColorPalette = ['#3b82f6', '#22c55e', '#f59e0b', '#ef4444', '#a855f7', '#06b6d4', '#14b8a6', '#84cc16', '#f43f5e', '#eab308', '#000000'];
const edgeColorPalette = ['#64748b', '#60a5fa', '#f97316', '#22c55e', '#a855f7', '#ef4444', '#facc15', '#e5e7eb', '#000000'];
const defaultEdgeDirectionOptions = ['from', 'to', 'both'];
const isLikelyMojibake = (value: string) => /[\u00D0\u00D1][\u0080-\u00BF]|[\uFFFD]/.test(value);

const normalizeDisplayLabel = (candidate: string, fallback: string) => {
  const trimmed = candidate.trim();
  if (!trimmed || isLikelyMojibake(trimmed)) return fallback;
  return trimmed;
};
const getCommonValue = <T,>(items: SelectedElement[], getter: (item: SelectedElement) => T | undefined): T | undefined => {
  if (items.length === 0) return undefined;
  const first = getter(items[0]);
  for (const item of items.slice(1)) {
    if (getter(item) !== first) return undefined;
  }
  return first;
};

const InspectorPanel: React.FC<InspectorPanelProps> = ({ onApplyGraphData }) => {
  const dispatch = useAppDispatch();
  const [activeTab, setActiveTab] = useState<'properties' | 'elements' | 'metadata'>('properties');
  const [plugins, setPlugins] = useState<ApiPlugin[]>([]);
  const [pluginsLoading, setPluginsLoading] = useState(false);
  const [pluginsError, setPluginsError] = useState<string | null>(null);
  const [runningPluginId, setRunningPluginId] = useState<string | null>(null);
  const [pluginsMessage, setPluginsMessage] = useState<string | null>(null);
  const [isRenaming, setIsRenaming] = useState(false);
  const [renameValue, setRenameValue] = useState('');
  const [renaming, setRenaming] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [createdArtifacts, setCreatedArtifacts] = useState<ApiArtifact[] | null>(null);
  const [iconOptions, setIconOptions] = useState(fallbackIconOptions);
  const [edgeDirectionOptions, setEdgeDirectionOptions] = useState(defaultEdgeDirectionOptions);

  const [elementLabel, setElementLabel] = useState('');
  const [elementColor, setElementColor] = useState('');
  const [elementIcon, setElementIcon] = useState('');
  const [elementIconScale, setElementIconScale] = useState('');
  const [elementRingMode, setElementRingMode] = useState<'unchanged' | 'on' | 'off'>('unchanged');
  const [elementRingWidth, setElementRingWidth] = useState('');
  const [elementEdgeWidth, setElementEdgeWidth] = useState('');
  const [elementEdgeDirection, setElementEdgeDirection] = useState('');
  const [elementEdgeStyle, setElementEdgeStyle] = useState<'unchanged' | 'solid' | 'dashed'>('unchanged');
  const [elementsSaving, setElementsSaving] = useState(false);

  const selectedArtifact = useAppSelector(state => {
    const { currentArtifactId, items } = state.artifacts;
    return currentArtifactId ? items[currentArtifactId] : null;
  });

  const selectedElements = useAppSelector(state => state.ui.selectedElements);
  const currentProject = useAppSelector(state => state.projects.currentProject);

  const pluginContext = useMemo<PluginExecutionContext>(() => {
    if (!selectedArtifact) return {};

    if (selectedArtifact.type === 'graph') {
      const selected_nodes = selectedElements
        .filter(item => item.type === 'node')
        .map(item => String(item.id));
      const selected_edges = selectedElements
        .filter(item => item.type === 'edge')
        .map(item => String(item.id));

      return { selected_nodes, selected_edges };
    }

    return {};
  }, [selectedArtifact, selectedElements]);

  const pluginContextKey = useMemo(() => {
    const nodes = [...(pluginContext.selected_nodes || [])].sort();
    const edges = [...(pluginContext.selected_edges || [])].sort();
    const rows = [...(pluginContext.selected_rows || [])].sort();

    return JSON.stringify({
      selected_nodes: nodes,
      selected_edges: edges,
      selected_rows: rows,
      selected_text: pluginContext.selected_text || '',
      selected_geo: pluginContext.selected_geo || null,
    });
  }, [pluginContext]);

  useEffect(() => {
    let cancelled = false;

    const loadDomainModel = async () => {
      try {
        const model = await domainModelApi.get() as DomainModelConfig;
        if (cancelled) return;

        const icons = (model?.node_types || [])
          .map((node) => {
            const icon = String(node?.icon || '').trim();
            if (!icon) return null;
            const fallbackLabel = String(node?.id || icon);
            const label = normalizeDisplayLabel(String(node?.label || ''), fallbackLabel);
            return { value: icon, label };
          })
          .filter(Boolean) as Array<{ value: string; label: string }>;

        const uniqueIcons = Array.from(new Map(icons.map((item) => [item.value, item])).values());
        setIconOptions(uniqueIcons.length > 0 ? uniqueIcons : fallbackIconOptions);

        const configuredDirections = model?.rules?.edge_direction_values || [];
        const normalizedDirections = configuredDirections
          .map((value) => String(value).trim())
          .filter((value) => value === 'from' || value === 'to' || value === 'both');

        setEdgeDirectionOptions(normalizedDirections.length > 0 ? normalizedDirections : defaultEdgeDirectionOptions);
      } catch {
        if (cancelled) return;
        setIconOptions(fallbackIconOptions);
        setEdgeDirectionOptions(defaultEdgeDirectionOptions);
      }
    };

    loadDomainModel();

    return () => {
      cancelled = true;
    };
  }, []);

  const handleTabChange = useCallback((tab: 'properties' | 'elements' | 'metadata') => {
    setActiveTab(tab);
  }, []);

  useEffect(() => {
    if (!selectedArtifact) {
      setPlugins([]);
      return;
    }

    let cancelled = false;
    const timer = window.setTimeout(async () => {
      setPluginsLoading(true);
      setPluginsError(null);
      try {
        const response = await pluginApi.applicable(
          selectedArtifact.project_id,
          selectedArtifact.id,
          pluginContext
        );
        if (cancelled) return;
        const list: ApiPlugin[] = response?.plugins || [];
        setPlugins(list);
      } catch (error: any) {
        if (cancelled) return;
        setPluginsError(error?.message || 'Failed to load plugins');
      } finally {
        if (!cancelled) {
          setPluginsLoading(false);
        }
      }
    }, 120);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [selectedArtifact?.id, selectedArtifact?.project_id, pluginContextKey]);

  useEffect(() => {
    if (selectedArtifact?.name) {
      setRenameValue(selectedArtifact.name);
    }
  }, [selectedArtifact?.name]);


  const graphSelection = useMemo(() => {
    if (!selectedArtifact || selectedArtifact.type !== 'graph') return null;

    const data = selectedArtifact.data || { nodes: [], edges: [] };
    const nodeById = new Map((data.nodes || []).map((node: any) => [String(node.id ?? node.node_id ?? node.uuid ?? node.key), node]));
    const edgeById = new Map((data.edges || []).map((edge: any) => [String(edge.id), edge]));

    const nodes = selectedElements
      .filter(item => item.type === 'node')
      .map((item) => ({ ...item, data: nodeById.get(String(item.id)) || item.data }))
      .filter(item => !!item.data);

    const edges = selectedElements
      .filter(item => item.type === 'edge')
      .map((item) => ({ ...item, data: edgeById.get(String(item.id)) || item.data }))
      .filter(item => !!item.data);

    const mode = nodes.length > 0 && edges.length > 0 ? 'mixed' : nodes.length > 0 ? 'nodes' : edges.length > 0 ? 'edges' : 'none';
    return { nodes, edges, mode, total: nodes.length + edges.length };
  }, [selectedArtifact, selectedElements]);

  useEffect(() => {
    if (!graphSelection || graphSelection.mode === 'none' || graphSelection.mode === 'mixed') {
      setElementLabel('');
      setElementColor('');
      setElementIcon('');
      setElementIconScale('');
      setElementRingMode('unchanged');
      setElementRingWidth('');
      setElementEdgeWidth('');
      setElementEdgeDirection('');
      setElementEdgeStyle('unchanged');
      return;
    }

    if (graphSelection.mode === 'nodes') {
      const label = getCommonValue(graphSelection.nodes, item => item.data?.label || item.data?.attributes?.visual?.label || item.data?.attributes?.label);
      const color = getCommonValue(graphSelection.nodes, item => item.data?.attributes?.visual?.color || item.data?.attributes?.color);
      const icon = getCommonValue(graphSelection.nodes, item => item.data?.attributes?.visual?.icon || item.data?.attributes?.icon);
      const scale = getCommonValue(graphSelection.nodes, item => item.data?.attributes?.visual?.iconScale ?? item.data?.attributes?.iconScale);
      const ringEnabled = getCommonValue(graphSelection.nodes, item => item.data?.attributes?.visual?.ringEnabled ?? item.data?.attributes?.ringEnabled);
      const ringWidth = getCommonValue(graphSelection.nodes, item => item.data?.attributes?.visual?.ringWidth ?? item.data?.attributes?.ringWidth);

      setElementLabel(label === undefined ? '' : String(label));
      setElementColor(color === undefined ? '' : String(color));
      setElementIcon(icon === undefined ? '' : String(icon));
      setElementIconScale(scale === undefined ? '' : String(scale));
      setElementRingMode(ringEnabled === undefined ? 'unchanged' : (ringEnabled ? 'on' : 'off'));
      setElementRingWidth(ringWidth === undefined ? '' : String(ringWidth));
      setElementEdgeWidth('');
      setElementEdgeDirection('');
      setElementEdgeStyle('unchanged');
      return;
    }

    const label = getCommonValue(graphSelection.edges, item => item.data?.label || item.data?.attributes?.visual?.label || item.data?.attributes?.label);
    const color = getCommonValue(graphSelection.edges, item => item.data?.attributes?.visual?.color || item.data?.attributes?.color);
    const width = getCommonValue(graphSelection.edges, item => item.data?.attributes?.visual?.width ?? item.data?.attributes?.width);
    const direction = getCommonValue(graphSelection.edges, item => item.data?.attributes?.visual?.direction || item.data?.attributes?.direction);
    const dashed = getCommonValue(graphSelection.edges, item => item.data?.attributes?.visual?.dashed ?? item.data?.attributes?.dashed);

    setElementLabel(label === undefined ? '' : String(label));
    setElementColor(color === undefined ? '' : String(color));
    setElementIcon('');
    setElementIconScale('');
    setElementRingMode('unchanged');
    setElementRingWidth('');
    setElementEdgeWidth(width === undefined ? '' : String(width));
    setElementEdgeDirection(direction === undefined ? '' : String(direction));
    setElementEdgeStyle(dashed === undefined ? 'unchanged' : (dashed ? 'dashed' : 'solid'));
  }, [graphSelection]);
  const applicablePlugins = useMemo(() => plugins, [plugins]);

  const handleRunPlugin = useCallback(async (plugin: ApiPlugin) => {
    if (!selectedArtifact) return;
    setRunningPluginId(plugin.id);
    setPluginsMessage(null);
    setPluginsError(null);
    try {
      const targetProjectId = selectedArtifact.project_id;
      const response = await pluginApi.execute(plugin.id, targetProjectId, [selectedArtifact.id], {}, pluginContext);
      await dispatch(fetchArtifacts(targetProjectId));
      const created = response?.created || [];
      if (created.length === 1) {
        dispatch(setCurrentArtifact(created[0].id));
      } else if (created.length > 1) {
        setCreatedArtifacts(created);
      }
      setPluginsMessage(labels.pluginDone.replace('{name}', plugin.name));
    } catch (error: any) {
      setPluginsError(error?.message || 'Failed to execute plugin');
    } finally {
      setRunningPluginId(null);
    }
  }, [selectedArtifact, pluginContext, dispatch]);

  const handleSelectCreated = useCallback((artifactId: number) => {
    dispatch(setCurrentArtifact(artifactId));
    setCreatedArtifacts(null);
  }, [dispatch]);

  const handleRename = useCallback(async () => {
    if (!selectedArtifact || !currentProject) return;
    const trimmed = renameValue.trim();
    if (!trimmed || trimmed === selectedArtifact.name) {
      setIsRenaming(false);
      return;
    }
    const ok = window.confirm(`${labels.renameConfirm}\n\n${selectedArtifact.name} -> ${trimmed}`);
    if (!ok) return;
    setRenaming(true);
    try {
      const updated = await artifactApi.update(currentProject.id, selectedArtifact.id, { name: trimmed });
      dispatch(updateArtifactSync(updated));
      await dispatch(fetchArtifacts(currentProject.id));
      setIsRenaming(false);
    } catch (error) {
      // no-op
    } finally {
      setRenaming(false);
    }
  }, [selectedArtifact, currentProject, renameValue, dispatch]);

  const handleDelete = useCallback(async () => {
    if (!selectedArtifact || !currentProject || deleting) return;
    const ok = window.confirm(`${labels.deleteConfirm}\n\n${selectedArtifact.name}`);
    if (!ok) return;
    setDeleting(true);
    try {
      await dispatch(deleteArtifact({ projectId: currentProject.id, id: selectedArtifact.id }));
      await dispatch(fetchArtifacts(currentProject.id));
    } catch (error) {
      // no-op
    } finally {
      setDeleting(false);
    }
  }, [selectedArtifact, currentProject, deleting, dispatch]);

  const applyElementEdits = useCallback(async () => {
    if (!selectedArtifact || !currentProject || !graphSelection || graphSelection.mode === 'none' || graphSelection.mode === 'mixed') {
      return;
    }

    const data = selectedArtifact.data || { nodes: [], edges: [] };
    const nodeIds = new Set(graphSelection.nodes.map(item => String(item.id)));
    const edgeIds = new Set(graphSelection.edges.map(item => String(item.id)));

    const updatedData = {
      ...data,
      nodes: (data.nodes || []).map((node: any) => {
        const nodeId = String(node.id ?? node.node_id ?? node.uuid ?? node.key);
        if (!nodeIds.has(nodeId)) return node;

        const attributes = { ...(node.attributes || {}) };
        const visual = { ...(attributes.visual || {}) };
        const nextNode = { ...node };

        if (elementLabel.trim()) {
          nextNode.label = elementLabel.trim();
          visual.label = elementLabel.trim();
          attributes.label = elementLabel.trim();
        }
        if (elementColor.trim()) {
          visual.color = elementColor.trim();
          attributes.color = elementColor.trim();
        }
        if (elementIcon.trim()) {
          visual.icon = elementIcon.trim();
          attributes.icon = elementIcon.trim();
        }
        if (elementIconScale.trim()) {
          const scale = Number(elementIconScale);
          if (!Number.isNaN(scale) && scale > 0) {
            visual.iconScale = scale;
            attributes.iconScale = scale;
          }
        }
        if (elementRingMode !== 'unchanged') {
          const enabled = elementRingMode === 'on';
          visual.ringEnabled = enabled;
          attributes.ringEnabled = enabled;
        }
        if (elementRingWidth.trim()) {
          const ringWidth = Number(elementRingWidth);
          if (!Number.isNaN(ringWidth) && ringWidth >= 0) {
            visual.ringWidth = ringWidth;
            attributes.ringWidth = ringWidth;
          }
        }

        attributes.visual = visual;
        nextNode.attributes = attributes;
        return nextNode;
      }),
      edges: (data.edges || []).map((edge: any) => {
        const edgeId = String(edge.id);
        if (!edgeIds.has(edgeId)) return edge;

        const attributes = { ...(edge.attributes || {}) };
        const visual = { ...(attributes.visual || {}) };
        const nextEdge = { ...edge };

        if (elementLabel.trim()) {
          nextEdge.label = elementLabel.trim();
          visual.label = elementLabel.trim();
          attributes.label = elementLabel.trim();
        }
        if (elementColor.trim()) {
          visual.color = elementColor.trim();
          attributes.color = elementColor.trim();
        }
        if (elementEdgeWidth.trim()) {
          const width = Number(elementEdgeWidth);
          if (!Number.isNaN(width) && width >= 1) {
            visual.width = width;
            attributes.width = width;
          }
        }
        if (elementEdgeDirection) {
          visual.direction = elementEdgeDirection;
          attributes.direction = elementEdgeDirection;
        }
        if (elementEdgeStyle !== 'unchanged') {
          const dashed = elementEdgeStyle === 'dashed';
          visual.dashed = dashed;
          attributes.dashed = dashed;
        }

        attributes.visual = visual;
        nextEdge.attributes = attributes;
        return nextEdge;
      })
    };

    setElementsSaving(true);
    try {
      if (onApplyGraphData && selectedArtifact.type === 'graph') {
        const actionType = graphSelection.mode === 'nodes' ? 'edit_node_attributes' : 'edit_edge_attributes';
        const description = graphSelection.mode === 'nodes'
          ? `Edit attributes for ${graphSelection.total} node(s)`
          : `Edit attributes for ${graphSelection.total} edge(s)`;
        await onApplyGraphData(updatedData, description, actionType);
      } else {
        const updated = await artifactApi.update(currentProject.id, selectedArtifact.id, { data: updatedData });
        dispatch(updateArtifactSync(updated));
      }
    } catch {
      // no-op
    } finally {
      setElementsSaving(false);
    }
  }, [
    selectedArtifact,
    currentProject,
    graphSelection,
    elementLabel,
    elementColor,
    elementIcon,
    elementIconScale,
    elementRingMode,
    elementRingWidth,
    elementEdgeWidth,
    elementEdgeDirection,
    elementEdgeStyle,
    dispatch,
    onApplyGraphData
  ]);
  if (!selectedArtifact) {
  return (
      <div className="inspector-panel">
        <div className="inspector-header">
          <h3>{labels.inspector}</h3>
        </div>
        <div className="inspector-empty">
          <p>{labels.selectArtifact}</p>
        </div>
      </div>
    );
  }


  const artifactMetadata = ((selectedArtifact as any).metadata || (selectedArtifact as any).artifact_metadata || {}) as Record<string, any>;
  const derivedFrom = artifactMetadata.derived_from;
  const sourcePlugin = artifactMetadata.source_plugin;
  const metadataRest = Object.fromEntries(Object.entries(artifactMetadata).filter(([key]) => key !== 'derived_from' && key !== 'source_plugin'));
  return (
    <div className="inspector-panel">
      {createdArtifacts && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.45)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 10000
          }}
        >
          <div
            style={{
              background: '#1f2937',
              border: '1px solid #2f3b4a',
              borderRadius: 8,
              padding: 12,
              minWidth: 260,
              maxWidth: 320
            }}
          >
            <div style={{ fontSize: 13, color: '#e5e7eb', marginBottom: 8 }}>{labels.selectResult}</div>
            {createdArtifacts.map(item => (
              <button
                key={item.id}
                onClick={() => handleSelectCreated(item.id)}
                style={{
                  width: '100%',
                  textAlign: 'left',
                  background: '#111827',
                  border: '1px solid #2f3b4a',
                  color: '#e5e7eb',
                  padding: '6px 8px',
                  borderRadius: 6,
                  marginBottom: 6,
                  cursor: 'pointer'
                }}
              >
                {item.name}
              </button>
            ))}
            <button
              onClick={() => setCreatedArtifacts(null)}
              style={{
                width: '100%',
                background: 'transparent',
                border: 'none',
                color: '#9ca3af',
                padding: '6px 4px',
                cursor: 'pointer'
              }}
            >
              {labels.cancel}
            </button>
          </div>
        </div>
      )}

      <div className="inspector-header">
        <h3>{labels.inspector}</h3>
        {currentProject && (
          <div className="project-badge">
            {currentProject.name}
          </div>
        )}
      </div>

      <div className="inspector-tabs">
        <button
          className={'tab-btn ' + (activeTab === 'properties' ? 'active' : '')}
          onClick={() => handleTabChange('properties')}
        >
          {labels.properties}
        </button>
        {selectedArtifact.type === 'graph' && (
          <button
            className={'tab-btn ' + (activeTab === 'elements' ? 'active' : '')}
            onClick={() => handleTabChange('elements')}
          >
            {labels.elementProps}
          </button>
        )}
        <button
          className={'tab-btn ' + (activeTab === 'metadata' ? 'active' : '')}
          onClick={() => handleTabChange('metadata')}
        >
          {labels.metadata}
        </button>
      </div>

      <div className="inspector-content">
        {activeTab === 'properties' && (
          <div className="properties-tab">
            <div className="property-group">
              <label>{labels.name}</label>
              {!isRenaming ? (
                <div className="property-inline">
                  <div className="property-value">{selectedArtifact.name}</div>
                  <button
                    className="property-action"
                    onClick={() => setIsRenaming(true)}
                  >
                    {labels.rename}
                  </button>
                </div>
              ) : (
                <div className="property-inline">
                  <input
                    className="property-input"
                    value={renameValue}
                    onChange={(e) => setRenameValue(e.target.value)}
                  />
                  <button
                    className="property-action"
                    onClick={handleRename}
                    disabled={renaming}
                  >
                    {labels.save}
                  </button>
                  <button
                    className="property-action secondary"
                    onClick={() => {
                      setIsRenaming(false);
                      setRenameValue(selectedArtifact.name);
                    }}
                  >
                    {labels.cancel}
                  </button>
                </div>
              )}
            </div>

            <div className="property-group property-row-inline">
              <label>{labels.created}</label>
              <div className="property-value">
                {new Date(selectedArtifact.created_at).toLocaleString()}
              </div>
            </div>

            <div className="property-group property-row-inline">
              <label>{labels.updated}</label>
              <div className="property-value">
                {new Date(selectedArtifact.updated_at).toLocaleString()}
              </div>
            </div>

            <div className="property-group">
              <label>{labels.plugins}</label>
              {pluginsLoading && (
                <div className="property-value">{labels.loading}</div>
              )}
              {pluginsError && (
                <div className="property-value" style={{ color: '#ff6b6b' }}>
                  {pluginsError}
                </div>
              )}
              {pluginsMessage && (
                <div className="property-value" style={{ color: '#81c784' }}>
                  {pluginsMessage}
                </div>
              )}
              {!pluginsLoading && !pluginsError && applicablePlugins.length === 0 && (
                <div className="property-value">{labels.noPlugins}</div>
              )}
              {applicablePlugins.map((plugin) => (
                <div key={plugin.id} className="property-value" style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                  <button
                    className="tab-btn"
                    onClick={() => handleRunPlugin(plugin)}
                    disabled={!!runningPluginId}
                  >
                    {runningPluginId === plugin.id ? labels.pluginRunning : `${labels.pluginRun}: ${plugin.name}`}
                  </button>
                </div>
              ))}
            </div>

            <div className="property-group">
              <label>{labels.delete}</label>
              <div className="property-inline">
                <button
                  className="property-action danger"
                  onClick={handleDelete}
                  disabled={deleting}
                >
                  {labels.delete}
                </button>
              </div>
            </div>

            {selectedArtifact.metadata && Object.entries(selectedArtifact.metadata).map(([key, value]) => (
              <div key={key} className="property-group">
                <label>{key}</label>
                <div className="property-value">
                  {typeof value === 'object' ? JSON.stringify(value) : String(value)}
                </div>
              </div>
            ))}
          </div>
        )}

        {activeTab === 'elements' && selectedArtifact.type === 'graph' && (
          <div className="properties-tab elements-tab">
            {!graphSelection || graphSelection.mode === 'none' ? (
              <div className="property-value">{labels.noSelection}</div>
            ) : graphSelection.mode === 'mixed' ? (
              <div className="property-value">{labels.mixedSelection}</div>
            ) : (
              <>
                <div className="property-group">
                  <label>{labels.selectedCount}</label>
                  <div className="property-value">{graphSelection.total}</div>
                </div>

                <div className="property-group">
                  <label>{labels.elementLabel}</label>
                  <input className="property-input" value={elementLabel} onChange={(e) => setElementLabel(e.target.value)} />
                </div>


                {graphSelection.mode === 'nodes' && (
                  <>
                    <div className="property-group">
                      <label>{labels.elementColor}</label>
                      <div className="property-inline">
                        <input
                          className="property-input"
                          type="color"
                          value={/^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(elementColor) ? elementColor : '#3b82f6'}
                          onChange={(e) => setElementColor(e.target.value)}
                          style={{ width: 36, minWidth: 36, height: 30, padding: 2, borderRadius: 6 }}
                        />
                        <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                          {nodeColorPalette.map((color) => (
                            <button
                              key={color}
                              type="button"
                              onClick={() => setElementColor(color)}
                              style={{ width: 18, height: 18, borderRadius: 4, border: '1px solid #475569', background: color, cursor: 'pointer' }}
                              title={color}
                            />
                          ))}
                        </div>
                      </div>
                    </div>
                    <div className="property-group">
                      <label>{labels.elementIcon}</label>
                      <select className="property-input" value={elementIcon} onChange={(e) => setElementIcon(e.target.value)}>
                        <option value="">{labels.unchanged}</option>
                        {iconOptions.map((opt) => (
                          <option key={opt.value} value={opt.value}>{opt.label}</option>
                        ))}
                      </select>
                    </div>
                    <div className="property-group">
                      <label>{labels.iconScale}</label>
                      <select className="property-input" value={elementIconScale} onChange={(e) => setElementIconScale(e.target.value)}>
                        <option value="">{labels.unchanged}</option>
                        {iconScaleOptions.map((size) => (
                          <option key={size} value={size}>{size}</option>
                        ))}
                      </select>
                    </div>
                    <div className="property-group">
                      <label>{labels.ringEnabled}</label>
                      <select className="property-input" value={elementRingMode} onChange={(e) => setElementRingMode(e.target.value as 'unchanged' | 'on' | 'off')}>
                        <option value="unchanged">{labels.unchanged}</option>
                        <option value="on">{labels.on}</option>
                        <option value="off">{labels.off}</option>
                      </select>
                    </div>
                    <div className="property-group">
                      <label>{labels.ringWidth}</label>
                      <input className="property-input" value={elementRingWidth} onChange={(e) => setElementRingWidth(e.target.value)} placeholder="2" />
                    </div>
                  </>
                )}

                {graphSelection.mode === 'edges' && (
                  <>
                    <div className="property-group">
                      <label>{labels.elementColor}</label>
                      <div className="property-inline">
                        <input
                          className="property-input"
                          type="color"
                          value={/^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(elementColor) ? elementColor : '#64748b'}
                          onChange={(e) => setElementColor(e.target.value)}
                          style={{ width: 36, minWidth: 36, height: 30, padding: 2, borderRadius: 6 }}
                        />
                        <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                          {edgeColorPalette.map((color) => (
                            <button
                              key={color}
                              type="button"
                              onClick={() => setElementColor(color)}
                              style={{ width: 18, height: 18, borderRadius: 4, border: '1px solid #475569', background: color, cursor: 'pointer' }}
                              title={color}
                            />
                          ))}
                        </div>
                      </div>
                    </div>
                    <div className="property-group">
                      <label>{labels.edgeWidth}</label>
                      <input className="property-input" value={elementEdgeWidth} onChange={(e) => setElementEdgeWidth(e.target.value)} placeholder="2" />
                    </div>
                    <div className="property-group">
                      <label>{labels.edgeDirection}</label>
                      <select className="property-input" value={elementEdgeDirection} onChange={(e) => setElementEdgeDirection(e.target.value)}>
                        <option value="">{labels.unchanged}</option>
                        {edgeDirectionOptions.map((direction) => (
                          <option key={direction} value={direction}>
                            {direction === 'from' ? '<-' : direction === 'to' ? '->' : '<->'}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="property-group">
                      <label>{labels.edgeStyle}</label>
                      <select className="property-input" value={elementEdgeStyle} onChange={(e) => setElementEdgeStyle(e.target.value as 'unchanged' | 'solid' | 'dashed')}>
                        <option value="unchanged">{labels.unchanged}</option>
                        <option value="solid">{labels.solid}</option>
                        <option value="dashed">{labels.dashed}</option>
                      </select>
                    </div>
                  </>
                )}

                <div className="property-group">
                  <button className="property-action" onClick={applyElementEdits} disabled={elementsSaving}>
                    {elementsSaving ? labels.loading : labels.apply}
                  </button>
                </div>
              </>
            )}
          </div>
        )}
        {activeTab === 'metadata' && (
          <div className="metadata-tab">
            <div className="property-group">
              <label>{labels.type}</label>
              <div className="property-value type-badge">
                {selectedArtifact.type === 'graph' ? labels.typeGraph :
                 selectedArtifact.type === 'table' ? labels.typeTable :
                 selectedArtifact.type === 'map' ? labels.typeMap :
                 selectedArtifact.type === 'chart' ? labels.typeChart : labels.typeDocument}
              </div>
            </div>

            {selectedArtifact.description && (
              <div className="property-group">
                <label>{labels.description}</label>
                <div className="property-value">{selectedArtifact.description}</div>
              </div>
            )}

            <div className="property-group">
              <label>{labels.version}</label>
              <div className="property-value">v{selectedArtifact.version || 1}</div>
            </div>

            {sourcePlugin && (
              <div className="property-group">
                <label>source_plugin</label>
                <div className="property-value">{String(sourcePlugin)}</div>
              </div>
            )}

            {derivedFrom !== undefined && derivedFrom !== null && (
              <div className="property-group">
                <label>derived_from</label>
                <div className="property-value">{String(derivedFrom)}</div>
              </div>
            )}

            <div className="property-group">
              <label>{labels.artifactId}</label>
              <div className="property-value">{selectedArtifact.id}</div>
            </div>

            <div className="property-group">
              <label>{labels.projectId}</label>
              <div className="property-value">{selectedArtifact.project_id}</div>
            </div>

            {Object.keys(metadataRest).length > 0 && (
              <div className="property-group">
                <label>{labels.extraMetadata}</label>
                <pre className="metadata-json">
                  {JSON.stringify(metadataRest, null, 2)}
                </pre>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default InspectorPanel;








































































