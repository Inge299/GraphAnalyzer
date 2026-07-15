// frontend/src/components/views/GraphView.tsx
import React, { useEffect, useRef, useState, useCallback } from 'react';
import { useAppDispatch } from '../../store';
import { fetchArtifacts } from '../../store/slices/artifactsSlice';
import { setSelectedElements } from '../../store/slices/uiSlice';
import type { SelectedElement } from '../../store/slices/uiSlice';
import { Network } from 'vis-network/standalone';
import { DataSet } from 'vis-data/standalone';
import { artifactApi, consoleApi, domainModelApi } from '../../services/api';
import type { ApiArtifact, ApiPlugin, ConsoleProfile, ConsoleProfilesResponse, DomainModelConfig, PluginExecutionContext } from '../../types/api';
import { nodeAttributePreviewConfig } from '../../config/nodeAttributePreview';
import { loadProjectPeriodDefaults } from '../../utils/pluginParams';
import { usePluginRunner } from '../../hooks/usePluginRunner';
import { useGraphViewportSelectionActions } from '../../hooks/useGraphViewportSelectionActions';
import { useGraphSelectionActions } from '../../hooks/useGraphSelectionActions';
import { useGraphPluginContextMenu } from '../../hooks/useGraphPluginContextMenu';
import { useGraphInteractionState } from '../../hooks/useGraphInteractionState';
import { useGraphKeyboardShortcuts } from '../../hooks/useGraphKeyboardShortcuts';
import { useGraphExternalEvents } from '../../hooks/useGraphExternalEvents';
import { useGraphLayoutActions } from '../../hooks/useGraphLayoutActions';
import { buildPluginContext, resolvePluginMenuTargets } from './graphPluginMenu';
import { applyRegularSelectionClick, handleConnectClick, handleNodeCreateClick } from './graphClickHandlers';
import { PluginContextMenu } from './PluginContextMenu';
import { GraphStatusOverlays } from './GraphStatusOverlays';
import { GraphToolbar } from './GraphToolbar';
import { GraphEmptyState } from './GraphEmptyState';
import {
  GRAPH_TOOLBAR_HEIGHT,
  buildEdgeCurveMap,
  buildEdgeForVis,
  buildNodeRadiusById,
  getGraphTextVisibilityState,
  getNodeColors,
  getNodeFont,
  getNodeId,
  getNodeIcon,
  getNodeImage,
  getNodeImagePadding,
  getNodeLabel,
  getNodePosition,
  getNodeRingEnabled,
  getNodeRingWidth,
  getNodeShape,
  getNodeSize,
  getEdgeTooltip,
  getNodeTooltip,
  getEdgeLabel,
  NodeAttributePreviewRuntime,
  resolveNodeWithDomainIcon,
  shouldShowNodeLabel,
  withAlpha,
} from './graphViewUtils';
import 'vis-network/styles/vis-network.css';
import './GraphView.css';

interface GraphViewProps {
  artifact: ApiArtifact;
  onNodeMove: (nodeId: string, x: number, y: number, groupId?: string | null) => void;
  onNodesMove?: (moves: Array<{ nodeId: string; x: number; y: number }>, groupId?: string | null) => void;
  onAddEdge?: (sourceId: string, targetId: string, edgeType?: string) => void;
  onDeleteSelection?: (nodeIds: string[], edgeIds: string[]) => void;
  onAddNodeAtPosition?: (label: string, typeId: string, x: number, y: number) => void;
  nodeCreateSpec?: { typeId: string; label: string } | null;
  onNodeCreateComplete?: () => void;
  connectType?: string | null;
  onConnectComplete?: () => void;
  onUndo?: () => void;
  onRedo?: () => void;
  canUndo?: boolean;
  canRedo?: boolean;
  isRecording?: boolean;
  lastError?: Error | null;
  onRequestAnalysisProfile?: (profileKey: string) => void;
}

interface PendingMove {
  nodeId: string;
  x: number;
  y: number;
}

const DEFAULT_SOURCE_IDS = 'All';
const PERIOD_START_KEYS = ['begtime', 'period_start', 'start_date', 'date_from', 'from_date', 'begin_date', 'beg_date'];
const PERIOD_END_KEYS = ['endtime', 'period_end', 'end_date', 'date_to', 'to_date', 'finish_date'];

const getParamKey = (param: any): string => String(param?.key || param?.name || '').trim();
const getParamKeyLower = (param: any): string => getParamKey(param).toLowerCase();
const isObjectsParam = (param: any): boolean => getParamKeyLower(param) === 'objects';
const isObjectTypesParam = (param: any): boolean => getParamKeyLower(param) === 'objectstype';
const isSourceIdsParam = (param: any): boolean => getParamKeyLower(param) === 'sourceids';
const isPeriodStartKey = (key: string): boolean => PERIOD_START_KEYS.includes(key.toLowerCase());
const isPeriodEndKey = (key: string): boolean => PERIOD_END_KEYS.includes(key.toLowerCase());

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

export const GraphView: React.FC<GraphViewProps> = ({ 
  artifact, 
  onNodeMove,
  onNodesMove,
  onAddEdge,
  onDeleteSelection,
  onAddNodeAtPosition,
  nodeCreateSpec = null,
  onNodeCreateComplete,
  connectType = null,
  onConnectComplete,
  onUndo,
  onRedo,
  canUndo = false,
  canRedo = false,
  isRecording = false,
  lastError = null,
  onRequestAnalysisProfile,
}) => {
  const dispatch = useAppDispatch();
  const containerRef = useRef<HTMLDivElement>(null);
  const networkRef = useRef<Network | null>(null);
  const nodesDataSetRef = useRef<any>(null);
  const edgesDataSetRef = useRef<any>(null);
  
  const [pendingMoves, setPendingMoves] = useState<PendingMove[]>([]);
  const moveTimeoutRef = useRef<ReturnType<typeof setTimeout>>();
  const batchGroupIdRef = useRef<string | null>(null);
  const isInitializedRef = useRef(false);
  const isDraggingRef = useRef(false);
  const labelsSuppressedStateRef = useRef(false);
  const lastReduxStateRef = useRef<string>(JSON.stringify(artifact.data));
  const lastSelectionDigestRef = useRef<string>('');
  const isFirstLoadRef = useRef(true);
  const graphTextVisibilityRef = useRef<{ nodeLabelsVisible: boolean; edgeLabelsVisible: boolean; tooltipsVisible: boolean } | null>(null);
  const [domainModelRevision, setDomainModelRevision] = useState(0);
  const [previewConfigRevision, setPreviewConfigRevision] = useState(0);
  const [, setGraphSettingsRevision] = useState(0);
  const [analysisProfiles, setAnalysisProfiles] = useState<ConsoleProfile[]>([]);
  const edgeTypesRef = useRef<Array<any>>([]);
  const rulesRef = useRef<{ allow_parallel_edges: boolean }>({ allow_parallel_edges: true });
  const nodeTypeIconsRef = useRef<Record<string, string>>({});
  const nodeTypeAttributesRef = useRef<Record<string, Record<string, { label: string; type: string }>>>({});
  const nodeAttributePreviewRef = useRef<NodeAttributePreviewRuntime>({
    enabled: Boolean((nodeAttributePreviewConfig as any)?.enabled),
    maxLinesPerField: Number((nodeAttributePreviewConfig as any)?.maxLinesPerField ?? 3),
    defaultMarker: String((nodeAttributePreviewConfig as any)?.defaultMarker || '*'),
    fields: ((nodeAttributePreviewConfig as any)?.fields || {}) as Record<string, { marker?: string; maxLines?: number; visibleOnGraph?: boolean; label?: string }>,
  });
  useEffect(() => {
    nodeAttributePreviewRef.current = {
      enabled: Boolean((nodeAttributePreviewConfig as any)?.enabled),
      maxLinesPerField: Number((nodeAttributePreviewConfig as any)?.maxLinesPerField ?? 3),
      defaultMarker: String((nodeAttributePreviewConfig as any)?.defaultMarker || '*'),
      fields: ((nodeAttributePreviewConfig as any)?.fields || {}) as Record<string, { marker?: string; maxLines?: number; visibleOnGraph?: boolean; label?: string }>,
    };
    setPreviewConfigRevision((value) => value + 1);
  }, [JSON.stringify(nodeAttributePreviewConfig)]);

  const artifactDataRef = useRef<any>(artifact.data || {});
  const {
    setConnectMode,
    edgeSourceId,
    setEdgeSourceId,
    connectModeRef,
    edgeSourceIdRef,
    onAddEdgeRef,
    onDeleteSelectionRef,
    onAddNodeAtPositionRef,
    nodeCreateSpecRef,
    onNodeCreateCompleteRef,
    connectTypeRef,
    onConnectCompleteRef,
  } = useGraphInteractionState({
    connectType,
    onAddEdge,
    onDeleteSelection,
    onAddNodeAtPosition,
    nodeCreateSpec,
    onNodeCreateComplete,
    onConnectComplete,
  });


  useEffect(() => {
    artifactDataRef.current = artifact.data || {};
  }, [artifact.data]);

  const loadAnalysisProfiles = useCallback(async () => {
    try {
      const response = (await consoleApi.profiles()) as ConsoleProfilesResponse;
      const nextProfiles = Array.isArray(response?.profiles)
        ? response.profiles.filter((profile) => profile.is_active !== false)
        : [];
      setAnalysisProfiles(nextProfiles);
      return nextProfiles;
    } catch {
      setAnalysisProfiles([]);
      return [] as ConsoleProfile[];
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    const loadProfiles = async () => {
      const nextProfiles = await loadAnalysisProfiles();
      if (cancelled) return;
      setAnalysisProfiles(nextProfiles);
    };
    void loadProfiles();
    return () => {
      cancelled = true;
    };
  }, [loadAnalysisProfiles]);

  useEffect(() => {
    let cancelled = false;
    const loadDomainModel = async () => {
      try {
        const model = await domainModelApi.get() as DomainModelConfig;
        if (cancelled) return;
        edgeTypesRef.current = Array.isArray(model?.edge_types) ? model.edge_types : [];
        nodeTypeIconsRef.current = Array.isArray(model?.node_types)
          ? model.node_types.reduce((acc, item: any) => {
              if (item?.id && item?.icon) acc[String(item.id)] = String(item.icon);
              return acc;
            }, {} as Record<string, string>)
          : {};
        nodeTypeAttributesRef.current = Array.isArray(model?.node_types)
          ? model.node_types.reduce((acc, item: any) => {
              const nodeTypeId = String(item?.id || '');
              if (!nodeTypeId) return acc;
              const attributes = Array.isArray(item?.attributes) ? item.attributes : [];
              acc[nodeTypeId] = attributes.reduce((attributeAcc: Record<string, { label: string; type: string }>, attribute: any) => {
                const key = String(attribute?.key || '').trim();
                if (!key) return attributeAcc;
                attributeAcc[key] = {
                  label: String(attribute?.label || key),
                  type: String(attribute?.type || 'string').toLowerCase(),
                };
                return attributeAcc;
              }, {} as Record<string, { label: string; type: string }>);
              return acc;
            }, {} as Record<string, Record<string, { label: string; type: string }>>)
          : {};
        rulesRef.current = {
          allow_parallel_edges: model?.rules?.allow_parallel_edges !== false,
        };
        lastReduxStateRef.current = '';
        setDomainModelRevision((value) => value + 1);
      } catch {
        if (cancelled) return;
        edgeTypesRef.current = [];
        nodeTypeIconsRef.current = {};
        nodeTypeAttributesRef.current = {};
        rulesRef.current = { allow_parallel_edges: true };
        lastReduxStateRef.current = '';
        setDomainModelRevision((value) => value + 1);
      }
    };

    loadDomainModel();
    return () => { cancelled = true; };
  }, []);


  const matchesType = (allowed: any, itemType: string) => {
    if (!Array.isArray(allowed)) return false;
    return allowed.includes('*') || allowed.includes(itemType);
  };

  const findEdgeType = (edgeTypeId: string) => {
    const edgeTypes = edgeTypesRef.current || [];
    return edgeTypes.find((item: any) => String(item?.id || '') === edgeTypeId) || null;
  };

  const isAllowedForEdgeType = (edgeTypeId: string, fromType: string, toType: string) => {
    const edgeType = findEdgeType(edgeTypeId);
    if (!edgeType) return false;
    return matchesType(edgeType.allowed_from, fromType) && matchesType(edgeType.allowed_to, toType);
  };

  const resolveAllowedEdgeType = (fromType: string, toType: string) => {
    const edgeTypes = edgeTypesRef.current || [];
    for (const edgeType of edgeTypes) {
      if (!edgeType || typeof edgeType !== 'object') continue;
      if (matchesType(edgeType.allowed_from, fromType) && matchesType(edgeType.allowed_to, toType)) {
        return String(edgeType.id || 'connected_to');
      }
    }
    return null;
  };


  const getAllowedNodeIdsForConnectType = (data: any, edgeTypeId: string, sourceNodeId: string | null) => {
    const edgeType = findEdgeType(edgeTypeId);
    if (!edgeType) return new Set<string>();

    const nodes = data?.nodes || [];
    const nodeById = new Map<string, any>(nodes.map((node: any) => [String(getNodeId(node)), node]));

    if (!sourceNodeId) {
      return new Set<string>(
        nodes
          .filter((node: any) => matchesType(edgeType.allowed_from, String(node.type || '')))
          .map((node: any) => String(getNodeId(node)))
      );
    }

    const sourceNode = nodeById.get(sourceNodeId);
    const sourceType = String(sourceNode?.type || '');
    if (!sourceNode || !matchesType(edgeType.allowed_from, sourceType)) {
      return new Set<string>();
    }

    return new Set<string>(
      nodes
        .filter((node: any) => String(getNodeId(node)) !== sourceNodeId)
        .filter((node: any) => matchesType(edgeType.allowed_to, String(node.type || '')))
        .map((node: any) => String(getNodeId(node)))
    );
  };

  const applyConnectPreview = useCallback(() => {
    if (!nodesDataSetRef.current || !edgesDataSetRef.current) return;

    const requestedEdgeType = connectTypeRef.current;
    const data = artifactDataRef.current || {};

    const resolvedNodes = (data.nodes || []).map((node: any) =>
      resolveNodeWithDomainIcon(node, nodeTypeIconsRef.current)
    );

    const allowedNodeIds = requestedEdgeType
      ? getAllowedNodeIdsForConnectType(data, requestedEdgeType, edgeSourceIdRef.current)
      : null;
    const currentScale = networkRef.current ? networkRef.current.getScale() : 1;

    const nodeUpdates = resolvedNodes.map((node: any) => {
      const id = String(getNodeId(node));
      const dimmed = Boolean(requestedEdgeType && allowedNodeIds && !allowedNodeIds.has(id));
      const colors = getNodeColors(node);
      const font = getNodeFont(node);

      return {
        id,
        label: (!labelsSuppressedStateRef.current && shouldShowNodeLabel(currentScale)) ? getNodeLabel(node, nodeAttributePreviewRef.current, nodeTypeAttributesRef.current) : "",
        color: dimmed ? {
          background: withAlpha(String(colors.background || '#94a3b8'), 0.2),
          border: withAlpha(String(colors.border || '#94a3b8'), 0.25)
        } : colors,
        font: dimmed ? { ...font, color: '#94a3b8' } : font,
        borderWidth: getNodeRingEnabled(node) ? getNodeRingWidth(node) : 0,
        shadow: dimmed ? false : (getNodeIcon(node) ? { enabled: true, size: 18, x: 0, y: 4, color: 'rgba(15, 23, 42, 0.35)' } : false),
      };
    });

    nodesDataSetRef.current.update(nodeUpdates);

    const edgeUpdates = (data.edges || []).map((edge: any) => {
      const baseColor = String(edge.attributes?.visual?.color || edge.attributes?.color || '#848484');
      const dimmed = Boolean(requestedEdgeType);
      return {
        id: String(edge.id),
        color: {
          color: dimmed ? withAlpha(baseColor, 0.2) : baseColor,
          highlight: dimmed ? '#94a3b8' : '#2563eb'
        },
        font: { color: dimmed ? '#94a3b8' : '#0f172a' }
      };
    });
    if (edgeUpdates.length > 0) {
      edgesDataSetRef.current.update(edgeUpdates);
    }
}, []);

  const updateNodeTooltipsByScale = useCallback((scale: number, force = true) => {
    if (!nodesDataSetRef.current || !edgesDataSetRef.current) return;
    const nextVisibility = getGraphTextVisibilityState(scale);
    const prevVisibility = graphTextVisibilityRef.current;
    if (
      !force &&
      prevVisibility &&
      prevVisibility.nodeLabelsVisible === nextVisibility.nodeLabelsVisible &&
      prevVisibility.edgeLabelsVisible === nextVisibility.edgeLabelsVisible &&
      prevVisibility.tooltipsVisible === nextVisibility.tooltipsVisible
    ) {
      return;
    }
    graphTextVisibilityRef.current = nextVisibility;

    const selectedNodeIds = new Set<string>((networkRef.current?.getSelectedNodes() || []).map((id: any) => String(id)));
    const selectedEdgeIds = new Set<string>((networkRef.current?.getSelectedEdges() || []).map((id: any) => String(id)));

    const resolvedNodes = (artifactDataRef.current?.nodes || []).map((node: any) =>
      resolveNodeWithDomainIcon(node, nodeTypeIconsRef.current)
    );
    const nodeUpdates = resolvedNodes.map((node: any) => {
      const id = String(getNodeId(node));
      const isSelected = selectedNodeIds.has(id);
      const showLabel = isSelected || (!labelsSuppressedStateRef.current && nextVisibility.nodeLabelsVisible);
      const baseColors = getNodeColors(node);
      const ringEnabled = getNodeRingEnabled(node);
      const ringWidth = getNodeRingWidth(node);
      return {
        id,
        title: getNodeTooltip(node, scale),
        label: showLabel ? getNodeLabel(node, nodeAttributePreviewRef.current, nodeTypeAttributesRef.current) : "",
        color: isSelected ? { ...baseColors, border: "#000000" } : baseColors,
        borderWidth: isSelected ? Math.max(ringEnabled ? ringWidth : 1, 2) : (ringEnabled ? ringWidth : 0),
        shadow: isSelected
          ? { enabled: true, size: 18, x: 0, y: 0, color: "rgba(0, 0, 0, 0.35)" }
          : (getNodeIcon(node) ? { enabled: true, size: 18, x: 0, y: 4, color: "rgba(15, 23, 42, 0.35)" } : false)
      };
    });
    if (nodeUpdates.length > 0) {
      nodesDataSetRef.current.update(nodeUpdates);
    }

    const edgeUpdates = (artifactDataRef.current?.edges || []).map((edge: any) => {
      const id = String(edge.id);
      const isSelected = selectedEdgeIds.has(id);
      const showLabel = !labelsSuppressedStateRef.current && nextVisibility.edgeLabelsVisible;
      const visual = edge.attributes?.visual || {};
      const baseColor = String(visual.color || edge.attributes?.color || "#848484");
      const baseWidth = Number(visual.width || edge.attributes?.width || 2);
      return {
        id,
        title: getEdgeTooltip(edge, scale),
        label: showLabel ? getEdgeLabel(edge) : "",
        font: {
          size: showLabel ? 14 : 0,
          color: isSelected ? "#2563eb" : "#0f172a",
          align: "middle",
          face: "Inter, Arial, sans-serif",
          strokeWidth: showLabel ? 3 : 0,
          strokeColor: "#ffffff"
        },
        width: isSelected ? Math.max(baseWidth, 4) : baseWidth,
        color: { color: isSelected ? "#2563eb" : baseColor, highlight: "#2563eb" },
        shadow: isSelected ? { enabled: true, size: 12, x: 0, y: 0, color: "rgba(37, 99, 235, 0.35)" } : false
      };
    });
    if (edgeUpdates.length > 0) {
      edgesDataSetRef.current.update(edgeUpdates);
    }
  }, []);

  const setLabelsSuppressed = useCallback((suppressed: boolean) => {
    labelsSuppressedStateRef.current = suppressed;
    const scale = networkRef.current ? networkRef.current.getScale() : 1;
    updateNodeTooltipsByScale(scale);
    applyConnectPreview();
  }, [applyConnectPreview, updateNodeTooltipsByScale]);

  useEffect(() => {
    const handleGraphSettingsChanged = () => {
      setGraphSettingsRevision((value) => value + 1);
      const scale = networkRef.current ? networkRef.current.getScale() : 1;
      updateNodeTooltipsByScale(scale, true);
    };

    window.addEventListener('graph:settings-changed', handleGraphSettingsChanged);
    return () => window.removeEventListener('graph:settings-changed', handleGraphSettingsChanged);
  }, [updateNodeTooltipsByScale]);

  const updateSelectionFromNetwork = useCallback(() => {
    if (!networkRef.current) return;
    const selectedNodeIds = networkRef.current.getSelectedNodes().map(id => String(id));
    const selectedEdgeIds = networkRef.current.getSelectedEdges().map(id => String(id));
    const digest = selectedNodeIds.join(',') + '|' + selectedEdgeIds.join(',');
    if (digest === lastSelectionDigestRef.current) return;
    lastSelectionDigestRef.current = digest;

    const nodes: SelectedElement[] = selectedNodeIds.map((id: string) => ({
      type: 'node',
      id,
      data: null,
    }));

    const edges: SelectedElement[] = selectedEdgeIds.map((id: string) => ({
      type: 'edge',
      id,
      data: null,
    }));


    dispatch(setSelectedElements([...nodes, ...edges]));
  }, [dispatch]);
  const {
    pluginMenu,
    pluginMenuRef,
    closePluginMenu,
    openPluginMenuAt,
    pluginMenuTree,
    pluginMenuLeft,
    pluginMenuTop,
    getPluginMenuEntries,
  } = useGraphPluginContextMenu({
    projectId: artifact.project_id,
    artifactId: artifact.id,
    networkRef,
    containerRef,
    updateSelectionFromNetwork,
    toolbarHeight: GRAPH_TOOLBAR_HEIGHT,
  });

  const {
    runPlugin,
    isPluginExecutingRef: pluginExecutionRef,
    pluginExecutionMessage,
  } = usePluginRunner({
    artifactId: artifact.id,
    projectId: artifact.project_id,
    getCurrentGraphNodeIds: () => ((artifactDataRef.current?.nodes || []) as any[]).map((node: any) => String(node?.id ?? node?.node_id ?? '')),
    buildLiveContext: (fallback: PluginExecutionContext) => {
      const hasMenuSelection =
        (Array.isArray(fallback?.selected_nodes) && fallback.selected_nodes.length > 0) ||
        (Array.isArray(fallback?.selected_edges) && fallback.selected_edges.length > 0);
      if (hasMenuSelection) return fallback;
      if (!networkRef.current) return fallback;
      return buildPluginContext(
        networkRef.current.getSelectedNodes().map((id: any) => String(id)),
        networkRef.current.getSelectedEdges().map((id: any) => String(id)),
      );
    },
    onFinally: closePluginMenu,
  });

  const runPluginFromMenu = useCallback(async (plugin: ApiPlugin, context: PluginExecutionContext) => {
    await runPlugin(plugin, context, dispatch);
  }, [dispatch, runPlugin]);

  const buildSelectionPayloadFromContext = useCallback((context: PluginExecutionContext) => {
    const nodeIds = new Set((context.selected_nodes || []).map((id) => String(id)));
    const edgeIds = new Set((context.selected_edges || []).map((id) => String(id)));
    const nodes = Array.isArray(artifactDataRef.current?.nodes) ? artifactDataRef.current.nodes : [];
    const edges = Array.isArray(artifactDataRef.current?.edges) ? artifactDataRef.current.edges : [];

    return {
      selected_nodes: nodes
        .filter((item: any) => nodeIds.has(String(item?.id ?? item?.node_id ?? '')))
        .map((item: any) => ({
          id: String(item?.id ?? item?.node_id ?? ''),
          node_id: String(item?.node_id ?? item?.id ?? ''),
          type: String(item?.type || ''),
          label: item?.label,
          attributes: item?.attributes && typeof item.attributes === 'object' ? item.attributes : {},
        })),
      selected_edges: edges
        .filter((item: any) => edgeIds.has(String(item?.id ?? '')))
        .map((item: any) => ({
          id: String(item?.id ?? ''),
          from: String(item?.from ?? item?.source_node ?? ''),
          to: String(item?.to ?? item?.target_node ?? ''),
          type: String(item?.type || ''),
          label: item?.label,
          attributes: item?.attributes && typeof item.attributes === 'object' ? item.attributes : {},
        })),
    };
  }, []);

  const hasRequiredManualParams = useCallback((profile: ConsoleProfile) => {
    const defaults = loadProjectPeriodDefaults(artifact.project_id);
    return (profile.params || []).some((param: any) => {
      if (param.hidden) return false;
      if (isObjectsParam(param) || isObjectTypesParam(param) || isSourceIdsParam(param)) return false;
      const bindingMode = String(param.binding_mode || 'manual').trim().toLowerCase();
      if (bindingMode !== 'manual') return false;
      if (!param.required) return false;
      const key = getParamKey(param);
      const explicitDefault = String(param.default ?? '').trim();
      if (explicitDefault) return false;
      if (isPeriodStartKey(key) && defaults.period_start) return false;
      if (isPeriodEndKey(key) && defaults.period_end) return false;
      return true;
    });
  }, [artifact.project_id]);

  const buildMenuRunParams = useCallback((profile: ConsoleProfile) => {
    const defaults = loadProjectPeriodDefaults(artifact.project_id);
    const params: Record<string, unknown> = {};
    (profile.params || []).forEach((param: any) => {
      const key = getParamKey(param);
      if (!key) return;
      if (isObjectsParam(param) || isObjectTypesParam(param)) return;
      if (isSourceIdsParam(param)) {
        params[key] = String(param.default ?? DEFAULT_SOURCE_IDS);
        return;
      }
      const bindingMode = String(param.binding_mode || 'manual').trim().toLowerCase();
      if (bindingMode !== 'manual') return;
      if (isPeriodStartKey(key) && defaults.period_start) {
        params[key] = defaults.period_start;
        return;
      }
      if (isPeriodEndKey(key) && defaults.period_end) {
        params[key] = defaults.period_end;
        return;
      }
      params[key] = coerceParamValue(param.type, String(param.default ?? ''));
    });
    return params;
  }, [artifact.project_id]);

  const handleRunAnalysisFromMenu = useCallback(async (profile: ConsoleProfile, context: PluginExecutionContext) => {
    if (hasRequiredManualParams(profile)) {
      onRequestAnalysisProfile?.(String(profile.key || profile.id));
      closePluginMenu();
      return;
    }

    const selectionPayload = buildSelectionPayloadFromContext(context);
    if (!selectionPayload.selected_nodes.length) {
      closePluginMenu();
      return;
    }

    try {
      const consoleArtifact = await artifactApi.create(artifact.project_id, {
        type: 'console',
        name: `${profile.name} ${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}`,
        data: {
          tabs: [{ id: 'main', name: 'Основная', columns: [], rows: [], row_count: 0 }],
          active_tab_id: 'main',
          columns: [],
          rows: [],
        },
        metadata: {
          console_profile_id: String(profile.key || profile.id),
          console_context_artifact_id: artifact.id,
        },
      });

      await consoleApi.refresh(
        artifact.project_id,
        consoleArtifact.id,
        String(profile.key || profile.id),
        buildMenuRunParams(profile),
        selectionPayload,
        artifact.id,
      );

      await dispatch(fetchArtifacts(artifact.project_id));
    } finally {
      closePluginMenu();
    }
  }, [
    artifact.id,
    artifact.project_id,
    buildMenuRunParams,
    buildSelectionPayloadFromContext,
    closePluginMenu,
    dispatch,
    hasRequiredManualParams,
    onRequestAnalysisProfile,
  ]);

  useEffect(() => {
    if (!containerRef.current || isInitializedRef.current) return;

    console.log('[GraphView] Initializing network (first time only)');
    
    const nodes = (artifact.data?.nodes || []).map((node: any) =>
      resolveNodeWithDomainIcon(node, nodeTypeIconsRef.current)
    );
    const edges = artifact.data?.edges || [];

    const nodesData = new DataSet(
      nodes.map((node: any, index: number) => {
        const position = getNodePosition(node, index, nodes.length);
        return ({
        id: String(getNodeId(node)),
        label: (!labelsSuppressedStateRef.current && shouldShowNodeLabel(1)) ? getNodeLabel(node, nodeAttributePreviewRef.current, nodeTypeAttributesRef.current) : "",
        title: getNodeTooltip(node, 1),
        x: position.x,
        y: position.y,
        color: getNodeColors(node),
        shape: getNodeShape(node),
        size: getNodeSize(node),
        font: getNodeFont(node),
        image: getNodeImage(node),
        borderWidth: getNodeRingEnabled(node) ? getNodeRingWidth(node) : 0,
        shapeProperties: { useBorderWithImage: true },
        imagePadding: getNodeImagePadding(node),
        shadow: getNodeIcon(node) ? { enabled: true, size: 18, x: 0, y: 4, color: 'rgba(15, 23, 42, 0.35)' } : false
      });
      })
    );

    const nodeRadiusById = buildNodeRadiusById(nodes);
    const edgeCurveMap = buildEdgeCurveMap(edges);
    const edgesData = new DataSet(
      edges.map((edge: any) => buildEdgeForVis(edge, nodeRadiusById, edgeCurveMap, 1, labelsSuppressedStateRef.current))
    );

    nodesDataSetRef.current = nodesData;
    edgesDataSetRef.current = edgesData;

    const options: any = {
      physics: { enabled: false, stabilization: false },
      nodes: {
        shape: 'dot',
        size: 20,
        font: { size: 13, color: '#0f172a', face: 'Inter, Arial, sans-serif' },
        borderWidth: 2,
        labelHighlightBold: false,
        shapeProperties: { useBorderWithImage: true },
        chosen: {
          node: (values: any) => {
            const background = 'rgba(255,255,255,0)';
            const accent = '#111827';
            values.color = {
              border: accent,
              background,
              highlight: {
                border: accent,
                background
              },
              hover: {
                border: accent,
                background
              }
            };

            values.shadow = {
              enabled: true,
              size: 18,
              x: 0,
              y: 0,
              color: 'rgba(17, 24, 39, 0.45)'
            };
          },
        },
        shadow: false
      },
      edges: {
        width: 2,
        smooth: { enabled: true, type: 'dynamic', roundness: 0.2 },
        font: { size: 14, color: '#0f172a', align: 'middle', face: 'Inter, Arial, sans-serif', strokeWidth: 3, strokeColor: '#ffffff' },
        arrows: { to: { enabled: true, scaleFactor: 0.8 } },
        arrowStrikethrough: false,
        chosen: {
          edge: (values: any) => {
            values.width = Math.max(Number(values.width || 2), 4);
            values.color = '#2563eb';
            values.shadow = {
              enabled: true,
              size: 14,
              x: 0,
              y: 0,
              color: 'rgba(37, 99, 235, 0.35)'
            };
          }
        }
      },
      interaction: {
        dragNodes: true,
        dragView: true,
        zoomView: true,
        hover: true,
        multiselect: true,
        selectConnectedEdges: false,
        navigationButtons: false,
        keyboard: false
      },
      manipulation: { enabled: false }
    };

    const network = new Network(
      containerRef.current,
      { nodes: nodesData as any, edges: edgesData as any },
      options
    );

    networkRef.current = network;
    updateNodeTooltipsByScale(network.getScale(), true);

    const onZoom = () => {
      updateNodeTooltipsByScale(network.getScale(), false);
      const selected = network.getSelection();
      if ((selected.nodes?.length || 0) > 0 || (selected.edges?.length || 0) > 0) {
        network.setSelection({ nodes: selected.nodes || [], edges: selected.edges || [] }, { unselectAll: true, highlightEdges: false });
      }
    };
    network.on('zoom', onZoom);

    const createBatchGroup = () => {
      return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
        const r = Math.random() * 16 | 0;
        const v = c === 'x' ? r : (r & 0x3 | 0x8);
        return v.toString(16);
      });
    };

    network.on('dragStart', (params: any) => {
      if (params.nodes && params.nodes.length > 0) {
        if (params.nodes.length === 1) {
          const draggedNodeId = String(params.nodes[0]);
          const selected = new Set(network.getSelectedNodes().map((id: any) => String(id)));
          if (!selected.has(draggedNodeId)) {
            const additive = Boolean(
              params?.event?.srcEvent?.shiftKey ||
              params?.event?.srcEvent?.ctrlKey ||
              params?.event?.srcEvent?.metaKey
            );
            network.selectNodes([draggedNodeId], additive);
            updateSelectionFromNetwork();
          }
        }
        isDraggingRef.current = true;
        batchGroupIdRef.current = createBatchGroup();
        console.log('[GraphView] Started drag batch for ' + params.nodes.length + ' nodes');
      }
    });

    network.on('dragEnd', (params) => {
      if (!params.nodes || params.nodes.length === 0) {
        isDraggingRef.current = false;
        return;
      }

      const moves: PendingMove[] = params.nodes.map((nodeId: string) => {
        const position = network.getPosition(nodeId);
        return { nodeId, x: Math.round(position.x), y: Math.round(position.y) };
      });

      setPendingMoves(prev => [...prev, ...moves]);

      if (moveTimeoutRef.current) {
        clearTimeout(moveTimeoutRef.current);
      }

      moveTimeoutRef.current = setTimeout(() => {
        const allMoves = [...pendingMoves, ...moves];
        
        console.log(`[GraphView] Drag ended, processing ${allMoves.length} moves`);
        
        if (onNodesMove && allMoves.length > 1) {
          onNodesMove(allMoves, batchGroupIdRef.current);
        } else {
          allMoves.forEach(({ nodeId, x, y }) => {
            onNodeMove(nodeId, x, y, batchGroupIdRef.current);
          });
        }

        setPendingMoves([]);
        batchGroupIdRef.current = null;
        isDraggingRef.current = false;
      }, 500);
    });

    const refreshSelectionVisuals = () => {
      updateSelectionFromNetwork();
      updateNodeTooltipsByScale(network.getScale(), true);
    };
    network.on('select', refreshSelectionVisuals);
    network.on('deselectNode', refreshSelectionVisuals);
    network.on('deselectEdge', refreshSelectionVisuals);

    network.on('oncontext', async (params: any) => {
      params?.event?.preventDefault?.();
      if (pluginExecutionRef.current) return;
      if (analysisProfiles.length === 0) {
        await loadAnalysisProfiles();
      }
      const { domPoint, clickedNodes, clickedEdges } = resolvePluginMenuTargets(network, params);
      await openPluginMenuAt(domPoint, clickedNodes, clickedEdges);
    });

    network.on('click', (params: any) => {
      const created = handleNodeCreateClick({
        network,
        params,
        nodeCreateSpecRef,
        onAddNodeAtPositionRef,
        onNodeCreateCompleteRef,
      });
      if (created) return;

      if (!connectModeRef.current) {
        applyRegularSelectionClick(network, params, updateSelectionFromNetwork, updateNodeTooltipsByScale);
        return;
      }

      handleConnectClick({
        params,
        artifactData: artifactDataRef.current,
        getNodeId: (node: any) => String(getNodeId(node)),
        connectTypeRef,
        edgeSourceIdRef,
        setEdgeSourceId,
        setConnectMode,
        findEdgeType,
        matchesType,
        resolveAllowedEdgeType,
        isAllowedForEdgeType,
        onAddEdgeRef,
        onConnectCompleteRef,
      });
    });
    network.once('afterDrawing', () => {
      if (isFirstLoadRef.current) {
        network.fit({ animation: { duration: 300, easingFunction: 'easeInOutQuad' } });
        isFirstLoadRef.current = false;
      }
    });

    applyConnectPreview();

    isInitializedRef.current = true;

    return () => {
      if (moveTimeoutRef.current) clearTimeout(moveTimeoutRef.current);
      network.off('zoom', onZoom);
      network.destroy();
      isInitializedRef.current = false;
      isFirstLoadRef.current = true;
    };
  }, [analysisProfiles.length, loadAnalysisProfiles]);

  useEffect(() => {
    if (!networkRef.current || !nodesDataSetRef.current || isDraggingRef.current) return;

    const currentReduxState = JSON.stringify(artifact.data);
    if (currentReduxState === lastReduxStateRef.current) return;

    console.log('[GraphView] Updating data from Redux, version:', artifact.version);
    lastReduxStateRef.current = currentReduxState;

    const previousSelection = networkRef.current.getSelection();
    const currentScale = networkRef.current.getScale();
    const currentPosition = networkRef.current.getViewPosition();

    const resolvedNodes = (artifact.data?.nodes || []).map((node: any) =>
      resolveNodeWithDomainIcon(node, nodeTypeIconsRef.current)
    );
    const hadNodes = nodesDataSetRef.current.getIds().length > 0;
    const nodesData = resolvedNodes.map((node: any, index: number) => {
      const position = getNodePosition(node, index, resolvedNodes.length);
      return ({
      id: String(getNodeId(node)),
        label: (!labelsSuppressedStateRef.current && shouldShowNodeLabel(currentScale)) ? getNodeLabel(node, nodeAttributePreviewRef.current, nodeTypeAttributesRef.current) : "",
      title: getNodeTooltip(node, currentScale),
      x: position.x,
      y: position.y,
      color: getNodeColors(node),
      shape: getNodeShape(node),
      size: getNodeSize(node),
      font: getNodeFont(node),
      image: getNodeImage(node),
      borderWidth: getNodeRingEnabled(node) ? getNodeRingWidth(node) : 0,
      shapeProperties: { useBorderWithImage: true },
      imagePadding: getNodeImagePadding(node),
      shadow: getNodeIcon(node) ? { enabled: true, size: 18, x: 0, y: 4, color: 'rgba(15, 23, 42, 0.35)' } : false
    });
    });

    nodesDataSetRef.current.clear();
    if (nodesData.length > 0) {
      nodesDataSetRef.current.add(nodesData);
    }

    const nodeRadiusById = buildNodeRadiusById(resolvedNodes);
    const edgeCurveMap = buildEdgeCurveMap(artifact.data?.edges || []);
    const edgesData = (artifact.data?.edges || []).map((edge: any) => buildEdgeForVis(edge, nodeRadiusById, edgeCurveMap, currentScale, labelsSuppressedStateRef.current));

    edgesDataSetRef.current?.clear();
    if (edgesData.length > 0) {
      edgesDataSetRef.current?.add(edgesData);
    }

    const nodeIdSet = new Set(nodesData.map((n: any) => String(n.id)));
    const edgeIdSet = new Set(edgesData.map((e: any) => String(e.id)));
    const selectedNodes = (previousSelection.nodes || []).map((id: any) => String(id)).filter((id: string) => nodeIdSet.has(id));
    const selectedEdges = (previousSelection.edges || []).map((id: any) => String(id)).filter((id: string) => edgeIdSet.has(id));
    networkRef.current.setSelection({ nodes: selectedNodes, edges: selectedEdges }, { unselectAll: true, highlightEdges: false });

    if (!hadNodes && nodesData.length > 0) {
      networkRef.current.fit({ animation: { duration: 300, easingFunction: 'easeInOutQuad' } });
    } else {
      networkRef.current.moveTo({
        position: currentPosition,
        scale: currentScale,
        animation: false
      });
    }
    applyConnectPreview();
  }, [artifact.data, artifact.version, domainModelRevision, previewConfigRevision]);

  useEffect(() => {
    applyConnectPreview();
  }, [connectType, edgeSourceId, domainModelRevision, applyConnectPreview]);
  useGraphKeyboardShortcuts({
    networkRef,
    nodesDataSetRef,
    onDeleteSelectionRef,
    dispatch,
    setSelectedElementsAction: setSelectedElements,
  });

  const handleUndoClick = useCallback(() => {
    console.log('[GraphView] Undo button clicked');
    onUndo?.();
  }, [onUndo]);

  const handleRedoClick = useCallback(() => {
    console.log('[GraphView] Redo button clicked');
    onRedo?.();
  }, [onRedo]);

  const estimateNodeFootprint = (node: any) => {
    const nodeSize = Number(getNodeSize(node) || 24);
    const wrapped = getNodeLabel(node, nodeAttributePreviewRef.current, nodeTypeAttributesRef.current) || String(node?.label || '');
    const lines = wrapped.split('\n').filter(Boolean);
    const maxLineLength = lines.reduce((acc: number, line: string) => Math.max(acc, line.length), 0);
    const labelWidth = Math.max(0, maxLineLength * 7);
    const labelHeight = lines.length * 18;
    const visualHeight = nodeSize + (labelHeight > 0 ? (10 + labelHeight) : 0);
    const visualWidth = Math.max(nodeSize, labelWidth);
    return Math.max(28, Math.sqrt((visualWidth * visualWidth + visualHeight * visualHeight) / 4));
  };

  const { handleAutoLayoutClick, handleBalancedLayoutClick } = useGraphLayoutActions({
    networkRef,
    nodesDataSetRef,
    artifactDataRef,
    onNodeMove,
    onNodesMove,
    setLabelsSuppressed,
    updateSelectionFromNetwork,
    getNodeId: (node: any) => String(getNodeId(node)),
    estimateNodeFootprint,
  });

  const {
    handleSelectConnectedEdges,
    handleSelectEndpoints,
  } = useGraphSelectionActions({
    networkRef,
    artifactDataRef,
    updateSelectionFromNetwork,
  });



  const {
    handleFitClick,
    handleFitSelectionClick,
    handleInvertSelectionClick,
  } = useGraphViewportSelectionActions({
    networkRef,
    artifactDataRef,
    nodesDataSetRef,
    edgesDataSetRef,
    updateSelectionFromNetwork,
  });

  useGraphExternalEvents({
    networkRef,
    nodesDataSetRef,
    updateSelectionFromNetwork,
    runBalancedLayoutForNodes: (nodeIds: string[]) => handleBalancedLayoutClick(false, nodeIds),
    artifactId: artifact.id,
  });


  const isGraphEmpty = !artifact.data || (!(artifact.data.nodes?.length) && !(artifact.data.edges?.length));

  return (
    <div className="graph-view" style={{ height: '100%', position: 'relative', background: '#ffffff', overflow: 'hidden' }}>
      
      <GraphToolbar
        canUndo={canUndo}
        canRedo={canRedo}
        onUndo={handleUndoClick}
        onRedo={handleRedoClick}
        onAutoLayout={handleAutoLayoutClick}
        onBalancedLayout={handleBalancedLayoutClick}
        onFit={handleFitClick}
        onFitSelection={handleFitSelectionClick}
        onInvertSelection={handleInvertSelectionClick}
        version={artifact.version}
      />

      
      <GraphStatusOverlays
        isRecording={isRecording}
        lastError={lastError}
        pendingMoveCount={new Set(pendingMoves.map((m) => m.nodeId)).size}
        nodeCreateSpec={nodeCreateSpec}
        connectType={connectType}
        edgeSourceId={edgeSourceId}
        pluginExecutionMessage={pluginExecutionMessage}
        toolbarHeight={GRAPH_TOOLBAR_HEIGHT}
      />
      <PluginContextMenu
        pluginMenu={pluginMenu}
        pluginMenuRef={pluginMenuRef}
        pluginMenuLeft={pluginMenuLeft}
        pluginMenuTop={pluginMenuTop}
        pluginMenuTree={pluginMenuTree}
        analysisProfiles={analysisProfiles}
        pluginExecutionMessage={pluginExecutionMessage}
        getPluginMenuEntries={getPluginMenuEntries}
        onRunPlugin={runPluginFromMenu}
        onRunAnalysis={handleRunAnalysisFromMenu}
        onSelectLinks={handleSelectConnectedEdges}
        onSelectEndpoints={handleSelectEndpoints}
        onClose={closePluginMenu}
      />
      {isGraphEmpty && <GraphEmptyState />}
      <div ref={containerRef} style={{ width: '100%', height: `calc(100% - ${GRAPH_TOOLBAR_HEIGHT}px)`, marginTop: `${GRAPH_TOOLBAR_HEIGHT}px` }} />

    </div>
  );
};

export default GraphView;

