// frontend/src/App.tsx
import { lazy, Suspense, useEffect, useState, useCallback, useMemo, useRef } from 'react';
import { useAppDispatch, useAppSelector } from './store';
import { fetchProjects, setCurrentProject } from './store/slices/projectsSlice';
import { setCurrentArtifact, fetchArtifacts, fetchArtifact } from './store/slices/artifactsSlice';
import { setSelectedElements } from './store/slices/uiSlice';
import TabBar from './components/layout/TabBar';
import Sidebar from './components/layout/Sidebar';
import InspectorPanel from './components/layout/InspectorPanel';
import PluginsPanel from './components/layout/PluginsPanel';
import type { ServiceCategory } from './components/views/ServiceFunctionsView';
import AppEmptyProjectsState from './components/app/AppEmptyProjectsState';
import { useActionWithUndo } from './hooks/useActionWithUndo';
import { useConsoleArtifact } from './hooks/useConsoleArtifact';
import { useGraphBottomPanelViewModel } from './hooks/useGraphBottomPanelViewModel';
import { initializeGraphDisplaySettings } from './config/graphDisplaySettings';
import { useDomainModelVisuals } from './hooks/useDomainModelVisuals';
import { useGraphBottomPanelState } from './hooks/useGraphBottomPanelState';
import { api, projectApi } from './services/api';
import './App.css';
import './components/layout/TabBar.css';

const ServiceFunctionsView = lazy(() => import('./components/views/ServiceFunctionsView'));
const ArtifactContentView = lazy(() => import('./components/app/ArtifactContentView'));
const AppGraphBottomPanel = lazy(() => import('./components/app/AppGraphBottomPanel'));

interface Tab {
  id: string;
  artifactId: number;
  title: string;
  type: string;
}

interface NodeCreationSpec {
  typeId: string;
  label: string;
}

type BackendHealthState =
  | { status: 'checking' | 'healthy' }
  | { status: 'slow'; responseMs: number }
  | { status: 'offline'; message: string };

  const labels = {
  loadingProjects: 'Загрузка проектов...',
  noProjectsTitle: 'Проектов пока нет',
  noProjectsHint: 'Создай первый проект, чтобы начать работу',
  projectsUnavailableTitle: 'Не удалось загрузить проекты',
  projectsUnavailableHint: 'Список проектов временно недоступен. Попробуй обновить страницу или повторить загрузку через пару секунд.',
  projectNamePlaceholder: 'Название проекта',
  creating: 'Создание...',
  create: 'Создать',
  emptyNameError: 'Введите название проекта',
  createError: 'Не удалось создать проект',
  devServerDisconnected: 'Потеряна связь с dev-сервером. Ожидаем восстановление...',
  reloadPage: 'Обновить страницу',
  noSelectionTitle: 'Выберите артефакт из левой панели',
  noSelectionHint: 'Используйте дерево проектов и артефактов для навигации'
};

const artifactTypeLabels: Record<string, string> = {
  graph: 'Граф',
  console: 'Консоль',
  document: 'Документ',
  map: 'Карта',
  table: 'Таблица',
  chart: 'Диаграмма',
};

function App() {
  const dispatch = useAppDispatch();
  const projects = useAppSelector((state) => state.projects.projects);
  const currentProject = useAppSelector((state) => state.projects.currentProject);
  const artifacts = useAppSelector((state) => state.artifacts.items);
  const currentArtifactId = useAppSelector((state) => state.artifacts.currentArtifactId);
  const loadingArtifactId = useAppSelector((state) => state.artifacts.loadingArtifactId);
  const projectsLoading = useAppSelector((state) => state.projects.isLoading);
  const projectsError = useAppSelector((state) => state.projects.error);
  const [newProjectName, setNewProjectName] = useState('');
  const [creatingProject, setCreatingProject] = useState(false);
  const [createProjectError, setCreateProjectError] = useState<string | null>(null);

  const [tabs, setTabs] = useState<Tab[]>([]);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [activeTabId, setActiveTabId] = useState<string | null>(null);
  const [requestedInspectorTab, setRequestedInspectorTab] = useState<'properties' | 'actions' | 'builder' | 'elements' | 'metadata' | null>(null);
  const [requestedAnalysis, setRequestedAnalysis] = useState<{ profileKey: string; token: number } | null>(null);
  const [isInspectorVisible, setIsInspectorVisible] = useState(true);

  useEffect(() => {
    initializeGraphDisplaySettings();
  }, []);
  const [inspectorTab, setInspectorTab] = useState<'inspector' | 'plugins'>('inspector');
  const [isServiceScreenActive, setIsServiceScreenActive] = useState(false);
  const [isProjectDataScreenActive, setIsProjectDataScreenActive] = useState(false);
  const [serviceScreenCategory, setServiceScreenCategory] = useState<ServiceCategory>('cell_towers');
  const [isDevServerDisconnected, setIsDevServerDisconnected] = useState(false);
  const [backendHealth, setBackendHealth] = useState<BackendHealthState>({ status: 'checking' });

  const lastNodesStateRef = useRef<any>(null);
  const [edgeCreationType, setEdgeCreationType] = useState<string | null>(null);
  const [nodeCreationSpec, setNodeCreationSpec] = useState<NodeCreationSpec | null>(null);
  const { edgeTypeVisuals, nodeTypeVisuals } = useDomainModelVisuals();
  const {
    isBottomPanelOpen,
    setIsBottomPanelOpen,
    bottomTab,
    setBottomTab,
    contentAreaRef,
    handleBottomResizerMouseDown,
    bottomPanelStyle,
  } = useGraphBottomPanelState({
    currentArtifactId: currentArtifactId || null,
    isInspectorVisible,
  });

  useEffect(() => {
    dispatch(fetchProjects());
  }, [dispatch]);

  useEffect(() => {
    let active = true;
    const startedAt = performance.now();
    api.get('/health', { timeout: 5000 })
      .then(() => {
        if (!active) return;
        const responseMs = Math.round(performance.now() - startedAt);
        setBackendHealth(responseMs >= 1500 ? { status: 'slow', responseMs } : { status: 'healthy' });
      })
      .catch((error: unknown) => {
        if (!active) return;
        const message = error instanceof Error ? error.message : 'Backend is unavailable';
        setBackendHealth({ status: 'offline', message });
      });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    if (!projectsError || projects.length > 0) return;

    const retryTimer = window.setTimeout(() => {
      dispatch(fetchProjects());
    }, 3000);

    return () => window.clearTimeout(retryTimer);
  }, [dispatch, projects.length, projectsError]);

  useEffect(() => {
    if (!import.meta.hot) return;

    const handleDisconnect = () => setIsDevServerDisconnected(true);
    const handleConnect = () => setIsDevServerDisconnected(false);

    import.meta.hot.on('vite:ws:disconnect', handleDisconnect);
    import.meta.hot.on('vite:ws:connect', handleConnect);

    return () => {
      import.meta.hot?.off('vite:ws:disconnect', handleDisconnect);
      import.meta.hot?.off('vite:ws:connect', handleConnect);
    };
  }, []);
  useEffect(() => {
    if (currentProject?.id) {
      dispatch(fetchArtifacts(currentProject.id));
    }
  }, [currentProject?.id, dispatch]);

  useEffect(() => {
    if (!currentProject?.id || !currentArtifactId) return;
    const artifact = artifacts[currentArtifactId];
    if (artifact && artifact.data_loaded === false && loadingArtifactId !== artifact.id) {
      void dispatch(fetchArtifact({ projectId: currentProject.id, id: artifact.id }));
    }
  }, [artifacts, currentArtifactId, currentProject?.id, dispatch, loadingArtifactId]);

  useEffect(() => {
    if (!currentArtifactId) return;
    const artifact = artifacts[currentArtifactId];
    if (!artifact) return;

    setTabs(prev => {
      const existing = prev.find(t => t.artifactId === currentArtifactId);
      if (existing) return prev;

      const newTab: Tab = {
        id: `tab-${artifact.id}`,
        artifactId: artifact.id,
        title: artifact.name,
        type: artifact.type
      };
      return [...prev, newTab];
    });
  }, [currentArtifactId, artifacts]);

  useEffect(() => {
    if (!currentArtifactId) return;
    const active = tabs.find(t => t.artifactId === currentArtifactId);
    if (!active) return;
    if (activeTabId !== active.id) {
      setActiveTabId(active.id);
    }
  }, [currentArtifactId, tabs, activeTabId]);

  useEffect(() => {
    setTabs(prev => prev.map(tab => {
      const artifact = artifacts[tab.artifactId];
      if (!artifact) return tab;
      if (tab.title === artifact.name && tab.type === artifact.type) return tab;
      return { ...tab, title: artifact.name, type: artifact.type };
    }));
  }, [artifacts]);
  useEffect(() => {
    setTabs(prev => {
      const validTabs = prev.filter(tab => !!artifacts[tab.artifactId]);
      const deduped: Tab[] = [];
      const seen = new Set<number>();
      for (const tab of validTabs) {
        if (seen.has(tab.artifactId)) continue;
        seen.add(tab.artifactId);
        deduped.push(tab);
      }
      if (deduped.length === prev.length && deduped.every((tab, idx) => tab.id === prev[idx]?.id)) {
        return prev;
      }
      return deduped;
    });
  }, [artifacts]);

  useEffect(() => {
    if (!tabs.length) {
      if (activeTabId !== null) {
        setActiveTabId(null);
      }
      return;
    }

    const stillActive = activeTabId && tabs.find(t => t.id === activeTabId);
    if (stillActive) return;

    const next = tabs[0];
    setActiveTabId(next.id);
    dispatch(setCurrentArtifact(next.artifactId));
  }, [tabs, activeTabId, dispatch]);

  const activeArtifact = useMemo(() => {
    if (!activeTabId) return null;
    const activeTab = tabs.find(t => t.id === activeTabId);
    if (!activeTab) return null;
    return artifacts[activeTab.artifactId];
  }, [activeTabId, tabs, artifacts]);

  const currentArtifactData = useMemo(() => {
    return activeArtifact?.data || { nodes: [], edges: [] };
  }, [activeArtifact]);

  const workspaceSummary = useMemo(() => {
    if (isProjectDataScreenActive) {
      return {
        modeLabel: 'Проект',
        title: 'Данные проекта',
        meta: currentProject?.name ? `Текущий проект: ${currentProject.name}` : 'Проект не выбран',
      };
    }

    if (isServiceScreenActive) {
      const serviceScreenTitle =
        serviceScreenCategory === 'project_data'
          ? 'Данные проекта'
          : serviceScreenCategory === 'console_registry'
            ? 'Консоль / процедуры'
            : 'Сервисные функции';
      return {
        modeLabel: serviceScreenCategory === 'project_data' ? 'Проект' : 'Администрирование',
        title: serviceScreenTitle,
        meta: currentProject?.name ? `Текущий проект: ${currentProject.name}` : 'Проект не выбран',
      };
    }

    if (!activeArtifact) {
      return {
        modeLabel: 'Анализ',
        title: 'Рабочая область',
        meta: currentProject?.name ? `Проект: ${currentProject.name}` : 'Выберите проект и артефакт',
      };
    }

    if (activeArtifact.type === 'graph') {
      return {
        modeLabel: 'Анализ',
        title: activeArtifact.name,
        meta: currentProject?.name ? `Проект: ${currentProject.name}` : artifactTypeLabels[activeArtifact.type] || activeArtifact.type,
      };
    }

    return {
      modeLabel: 'Анализ',
      title: activeArtifact.name,
      meta: artifactTypeLabels[activeArtifact.type] || activeArtifact.type,
    };
  }, [activeArtifact, currentProject?.name, isProjectDataScreenActive, isServiceScreenActive, serviceScreenCategory]);

  const {
    graphNodesForPanel,
    graphEdgesForPanel,
    toggleNodeSort,
    toggleEdgeSort,
    renderSortIndicator,
    nodeSortKey,
    nodeSortDir,
    edgeSortKey,
    edgeSortDir,
    nodeAttributeColumns,
    edgeAttributeColumns,
    formatAttributeHeader,
    visibleGraphNodesForPanel,
    visibleGraphEdgesForPanel,
    selectedNodeIds,
    selectedEdgeIds,
    handleNodeRowClick,
    handleEdgeRowClick,
    nodeRowRefs,
    edgeRowRefs,
    getNormalizedEdgeAttributes,
    nodeLabelById,
    searchQuery,
    setSearchQuery,
    nodeTypeOptions,
    edgeTypeOptions,
    activeTypeFilter,
    setNodeTypeFilter,
    setEdgeTypeFilter,
    nodeAttributeKeyOptions,
    edgeAttributeKeyOptions,
    activeAttributeKeyFilter,
    setNodeAttributeKeyFilter,
    setEdgeAttributeKeyFilter,
    attributeValueOptions,
    activeAttributeValueFilter,
    setNodeAttributeValueFilter,
    setEdgeAttributeValueFilter,
    showOnlySelected,
    setShowOnlySelected,
    resultTabs,
  } = useGraphBottomPanelViewModel({
    activeArtifact,
    edgeTypeVisuals,
    isBottomPanelOpen,
    bottomTab,
  });

  useEffect(() => {
    if (!activeArtifact || activeArtifact.type !== 'graph') {
      setEdgeCreationType(null);
      setNodeCreationSpec(null);
    }
  }, [activeArtifact]);
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      if (edgeCreationType || nodeCreationSpec) {
        setEdgeCreationType(null);
        setNodeCreationSpec(null);
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [edgeCreationType, nodeCreationSpec]);

  useEffect(() => {
    if (activeArtifact?.data?.nodes) {
      lastNodesStateRef.current = activeArtifact.data;
    }
  }, [activeArtifact]);

  const {
    execute,
    isRecording,
    lastError,
    undo: undoAction,
    redo: redoAction,
    refreshHistory,
    canUndo,
    canRedo
  } = useActionWithUndo(
    activeArtifact?.id || 0,
    currentArtifactData,
    (newData) => {
      lastNodesStateRef.current = newData;
    },
    activeArtifact?.project_id || 1
  );

  

  const handleNodeMove = useCallback(async (
    nodeId: string,
    x: number,
    y: number,
    groupId?: string | null
  ) => {
    if (!activeArtifact) return;

    let currentData = lastNodesStateRef.current;
    if (!currentData) {
      currentData = artifacts[activeArtifact.id]?.data;
    }
    if (!currentData) return;

    const updatedNodes = (currentData?.nodes || []).map((node: any) => {
      if (node.id === nodeId) {
        return { ...node, position_x: Math.round(x), position_y: Math.round(y) };
      }
      return node;
    });

    const afterState = {
      ...currentData,
      nodes: updatedNodes
    };

    lastNodesStateRef.current = afterState;

    await execute(
      async () => afterState,
      {
        description: `\u041f\u0435\u0440\u0435\u043c\u0435\u0449\u0435\u043d\u0438\u0435 \u0443\u0437\u043b\u0430 ${nodeId}`,
        actionType: 'move_node',
        groupId: groupId || undefined
      }
    );
  }, [activeArtifact, artifacts, execute]);

  const handleNodesMove = useCallback(async (
    moves: Array<{ nodeId: string; x: number; y: number }>,
    groupId?: string | null,
    history?: { description?: string; actionType?: string },
  ) => {
    if (!activeArtifact || moves.length === 0) return;

    let currentData = lastNodesStateRef.current;
    if (!currentData) {
      currentData = artifacts[activeArtifact.id]?.data;
    }
    if (!currentData) return;

    const moveMap = new Map(moves.map(m => [m.nodeId, { x: Math.round(m.x), y: Math.round(m.y) }]));

    const updatedNodes = (currentData?.nodes || []).map((node: any) => {
      const move = moveMap.get(node.id);
      if (move) {
        return { ...node, position_x: move.x, position_y: move.y };
      }
      return node;
    });

    const afterState = {
      ...currentData,
      nodes: updatedNodes
    };

    lastNodesStateRef.current = afterState;

    await execute(
      async () => afterState,
      {
        description: history?.description || `\u041f\u0435\u0440\u0435\u043c\u0435\u0449\u0435\u043d\u0438\u0435 ${moves.length} \u0443\u0437\u043b\u043e\u0432`,
        actionType: history?.actionType || 'batch_move',
        groupId: groupId || undefined
      }
    );
  }, [activeArtifact, artifacts, execute]);

  const handleAddNodeAtPosition = useCallback(async (
    label: string,
    typeId: string,
    x: number,
    y: number
  ) => {
    if (!activeArtifact) return;

    let currentData = lastNodesStateRef.current;
    if (!currentData) {
      currentData = artifacts[activeArtifact.id]?.data;
    }
    if (!currentData) return;

    const existingNodes = currentData?.nodes || [];
    const normalizedLabel = String(label || '').trim().toLowerCase();
    if (normalizedLabel) {
      const duplicate = existingNodes.some((node: any) => {
        const nodeType = String(node?.type || '');
        const nodeLabel = String(node?.label || node?.attributes?.visual?.label || node?.attributes?.label || '').trim().toLowerCase();
        return nodeType === typeId && nodeLabel === normalizedLabel;
      });
      if (duplicate) {
        window.alert('Узел такого типа с таким названием уже существует.');
        return;
      }
    }

    let nodeIndex = existingNodes.length + 1;
    let nodeId = `auto_node_${nodeIndex}`;
    const ids = new Set(existingNodes.map((n: any) => String(n.id)));
    while (ids.has(nodeId)) {
      nodeIndex += 1;
      nodeId = `auto_node_${nodeIndex}`;
    }

    const defaults = nodeTypeVisuals[typeId] || {
      icon: '',
      color: '#3b82f6',
      iconScale: 2,
      ringEnabled: false,
      ringWidth: 2,
      label: typeId
    };

    const nodeLabel = String(label || defaults.label || typeId || 'Новый узел').trim();

    const newNode = {
      id: nodeId,
      type: typeId,
      label: nodeLabel,
      position_x: Math.round(x),
      position_y: Math.round(y),
      attributes: {
        label: nodeLabel,
        icon: defaults.icon,
        visual: {
          label: nodeLabel,
          color: defaults.color,
          icon: defaults.icon,
          iconScale: defaults.iconScale,
          ringEnabled: defaults.ringEnabled,
          ringWidth: defaults.ringWidth
        }
      }
    };

    const afterState = {
      ...currentData,
      nodes: [...existingNodes, newNode]
    };

    lastNodesStateRef.current = afterState;

    await execute(
      async () => afterState,
      {
        description: `Добавление узла ${nodeLabel}`,
        actionType: 'add_node'
      }
    );

    dispatch(setSelectedElements([{ type: 'node', id: nodeId, data: null }]));
  }, [activeArtifact, artifacts, execute, nodeTypeVisuals, dispatch]);

  const handleAddEdge = useCallback(async (
    sourceId: string,
    targetId: string,
    edgeType: string = 'connected_to'
  ) => {
    if (!activeArtifact) return;

    let currentData = lastNodesStateRef.current;
    if (!currentData) {
      currentData = artifacts[activeArtifact.id]?.data;
    }
    if (!currentData) return;

    const existingEdges = currentData?.edges || [];
    let edgeIndex = existingEdges.length + 1;
    let edgeId = `auto_edge_${edgeIndex}`;
    const ids = new Set(existingEdges.map((e: any) => String(e.id)));
    while (ids.has(edgeId)) {
      edgeIndex += 1;
      edgeId = `auto_edge_${edgeIndex}`;
    }

    const defaults = edgeTypeVisuals[edgeType] || {
      color: '#475569',
      width: 2,
      direction: 'to',
      dashed: false,
      label: edgeType
    };

    const newEdge = {
      id: edgeId,
      type: edgeType,
      from: sourceId,
      to: targetId,
      label: defaults.label,
      attributes: {
        label: defaults.label,
        visual: {
          color: defaults.color,
          width: defaults.width,
          direction: defaults.direction,
          dashed: defaults.dashed,
          label: defaults.label
        }
      }
    };

    const afterState = {
      ...currentData,
      edges: [...existingEdges, newEdge]
    };

    lastNodesStateRef.current = afterState;

    await execute(
      async () => afterState,
      {
        description: `Add edge ${sourceId} -> ${targetId}`,
        actionType: 'add_edge'
      }
    );
  }, [activeArtifact, artifacts, execute, edgeTypeVisuals]);

  const handlePasteGraphClipboard = useCallback(async (payload: any) => {
    if (!activeArtifact) return;

    let currentData = lastNodesStateRef.current;
    if (!currentData) {
      currentData = artifacts[activeArtifact.id]?.data;
    }
    if (!currentData) return;

    const sourceNodes = Array.isArray(payload?.nodes) ? payload.nodes : [];
    if (!sourceNodes.length) return;
    const sourceEdges = Array.isArray(payload?.edges) ? payload.edges : [];

    const existingNodes = currentData?.nodes || [];
    const existingEdges = currentData?.edges || [];
    const existingNodeIds = new Set(existingNodes.map((node: any) => String(node.id)));
    const existingEdgeIds = new Set(existingEdges.map((edge: any) => String(edge.id)));
    const buildNodeIdentityKey = (typeId: string, label: string) =>
      `${String(typeId || '').trim().toLowerCase()}::${String(label || '').trim().toLowerCase()}`;
    const buildEdgeIdentityKey = (typeId: string, fromId: string, toId: string, label: string) =>
      `${String(typeId || '').trim().toLowerCase()}::${String(fromId || '')}::${String(toId || '')}::${String(label || '').trim().toLowerCase()}`;

    const existingNodeByIdentity = new Map<string, string>();
    for (const node of existingNodes) {
      const typeId = String(node?.type || '');
      const label = String(node?.label || node?.attributes?.visual?.label || node?.attributes?.label || '');
      const key = buildNodeIdentityKey(typeId, label);
      if (label.trim() && !existingNodeByIdentity.has(key)) {
        existingNodeByIdentity.set(key, String(node.id));
      }
    }

    const makeNodeId = () => {
      let nodeIndex = existingNodes.length + 1;
      let nodeId = `auto_node_${nodeIndex}`;
      while (existingNodeIds.has(nodeId)) {
        nodeIndex += 1;
        nodeId = `auto_node_${nodeIndex}`;
      }
      existingNodeIds.add(nodeId);
      return nodeId;
    };

    const makeEdgeId = () => {
      let edgeIndex = existingEdges.length + 1;
      let edgeId = `auto_edge_${edgeIndex}`;
      while (existingEdgeIds.has(edgeId)) {
        edgeIndex += 1;
        edgeId = `auto_edge_${edgeIndex}`;
      }
      existingEdgeIds.add(edgeId);
      return edgeId;
    };

    const pasteIndex = Math.max(1, Number((payload as any)?._pasteIndex ?? 1));
    const offset = 48 * pasteIndex;
    const nodeIdMap = new Map<string, string>();
    const createdNodeByIdentity = new Map<string, string>();
    const newNodes: any[] = [];

    sourceNodes.forEach((node: any) => {
      const typeId = String(node?.type || 'person');
      const sourceNodeId = String(node?.originalId || '');
      const sourceLabel = String(node?.label || '').trim();
      const identityKey = sourceLabel ? buildNodeIdentityKey(typeId, sourceLabel) : '';

      if (identityKey) {
        const existingNodeId = existingNodeByIdentity.get(identityKey) || createdNodeByIdentity.get(identityKey);
        if (existingNodeId) {
          nodeIdMap.set(sourceNodeId, existingNodeId);
          return;
        }
      }

      const nodeId = makeNodeId();
      nodeIdMap.set(sourceNodeId, nodeId);
      const nodeLabel = sourceLabel || String(node?.attributes?.visual?.label || node?.attributes?.label || 'Новый узел').trim() || 'Новый узел';
      const nextAttributes = { ...(node?.attributes || {}) } as any;
      nextAttributes.label = nodeLabel;
      nextAttributes.visual = {
        ...(nextAttributes.visual || {}),
        label: nodeLabel,
      };
      const nextNode = {
        id: nodeId,
        type: typeId,
        label: nodeLabel,
        position_x: Math.round(Number(node?.x || 0) + offset),
        position_y: Math.round(Number(node?.y || 0) + offset),
        attributes: nextAttributes,
      };
      newNodes.push(nextNode);
      if (identityKey) {
        createdNodeByIdentity.set(identityKey, nodeId);
      }
    });

    const existingEdgeIdentityKeys = new Set(
      existingEdges.map((edge: any) => {
        const edgeType = String(edge?.type || '');
        const fromId = String(edge?.from || edge?.source_node || '');
        const toId = String(edge?.to || edge?.target_node || '');
        const edgeLabel = String(edge?.label || edge?.attributes?.visual?.label || edge?.attributes?.label || '');
        return buildEdgeIdentityKey(edgeType, fromId, toId, edgeLabel);
      }),
    );

    const newEdges: any[] = sourceEdges
      .filter((edge: any) => nodeIdMap.has(String(edge?.from || '')) && nodeIdMap.has(String(edge?.to || '')))
      .reduce((acc: any[], edge: any) => {
        const edgeType = String(edge?.type || 'connected_to');
        const defaults = edgeTypeVisuals[edgeType] || {
          color: '#475569',
          width: 2,
          direction: 'to',
          dashed: false,
          label: edgeType,
        };
        const edgeLabel = String(edge?.label || edge?.attributes?.visual?.label || edge?.attributes?.label || defaults.label || edgeType);
        const fromId = String(nodeIdMap.get(String(edge?.from || '')) || '');
        const toId = String(nodeIdMap.get(String(edge?.to || '')) || '');
        const edgeIdentityKey = buildEdgeIdentityKey(edgeType, fromId, toId, edgeLabel);
        if (existingEdgeIdentityKeys.has(edgeIdentityKey)) {
          return acc;
        }
        existingEdgeIdentityKeys.add(edgeIdentityKey);
        acc.push({
          id: makeEdgeId(),
          type: edgeType,
          from: fromId,
          to: toId,
          label: edgeLabel,
          attributes: {
            ...(edge?.attributes || {}),
            label: edgeLabel,
            visual: {
              ...(edge?.attributes?.visual || {}),
              color: edge?.attributes?.visual?.color || defaults.color,
              width: edge?.attributes?.visual?.width || defaults.width,
              direction: edge?.attributes?.visual?.direction || defaults.direction,
              dashed: edge?.attributes?.visual?.dashed ?? defaults.dashed,
              label: edgeLabel,
            },
          },
        });
        return acc;
      }, [] as any[]);

    const afterState = {
      ...currentData,
      nodes: [...existingNodes, ...newNodes],
      edges: [...existingEdges, ...newEdges],
    };

    lastNodesStateRef.current = afterState;

    await execute(
      async () => afterState,
      {
        description: `Вставка элементов графа: узлов ${newNodes.length}, связей ${newEdges.length}`,
        actionType: 'paste_elements',
      }
    );

    dispatch(setSelectedElements([
      ...newNodes.map((node: any) => ({ type: 'node' as const, id: String(node.id), data: null })),
      ...newEdges.map((edge: any) => ({ type: 'edge' as const, id: String(edge.id), data: null })),
    ]));
  }, [activeArtifact, artifacts, dispatch, edgeTypeVisuals, execute]);

  const handleDeleteSelection = useCallback(async (nodeIds: string[], edgeIds: string[]) => {
    if (!activeArtifact) return;

    let currentData = lastNodesStateRef.current;
    if (!currentData) {
      currentData = artifacts[activeArtifact.id]?.data;
    }
    if (!currentData) return;

    const nodeIdSet = new Set((nodeIds || []).map((id) => String(id)));
    const edgeIdSet = new Set((edgeIds || []).map((id) => String(id)));
    if (!nodeIdSet.size && !edgeIdSet.size) return;

    const originalNodes = currentData?.nodes || [];
    const originalEdges = currentData?.edges || [];

    const nextNodes = originalNodes.filter((node: any) => !nodeIdSet.has(String(node.id)));
    const nextEdges = originalEdges.filter((edge: any) => {
      const id = String(edge.id || '');
      const from = String(edge.from || edge.source_node || '');
      const to = String(edge.to || edge.target_node || '');
      if (edgeIdSet.has(id)) return false;
      if (nodeIdSet.has(from) || nodeIdSet.has(to)) return false;
      return true;
    });

    if (nextNodes.length === originalNodes.length && nextEdges.length === originalEdges.length) return;

    const afterState = {
      ...currentData,
      nodes: nextNodes,
      edges: nextEdges
    };

    lastNodesStateRef.current = afterState;

    const removedNodesCount = originalNodes.length - nextNodes.length;
    const removedEdgesCount = originalEdges.length - nextEdges.length;

    await execute(
      async () => afterState,
      {
        description: `Delete elements: nodes ${removedNodesCount}, edges ${removedEdgesCount}`,
        actionType: 'delete_elements'
      }
    );

    dispatch(setSelectedElements([]));
  }, [activeArtifact, artifacts, dispatch, execute]);

  const handleGraphUpdate = useCallback(async (
    newData: any,
    description: string,
    actionType: string
  ) => {
    if (!activeArtifact) return;
    lastNodesStateRef.current = newData;
    await execute(
      async () => newData,
      {
        description,
        actionType
      }
    );
  }, [activeArtifact, execute]);

  const handleStartNodeCreation = useCallback((typeId: string, label: string) => {
    setNodeCreationSpec({ typeId, label });
    setEdgeCreationType(null);
  }, []);

  const handleFinishNodeCreation = useCallback(() => {
    setNodeCreationSpec(null);
  }, []);

  const handleStartEdgeCreation = useCallback((edgeType: string) => {
    setEdgeCreationType(edgeType);
    setNodeCreationSpec(null);
  }, []);

  const handleFinishEdgeCreation = useCallback(() => {
    setEdgeCreationType(null);
  }, []);

  const handleArtifactSelect = useCallback((artifact: any) => {
    const tabId = 'tab-' + artifact.id;

    setTabs(prev => {
      const existingTab = prev.find(t => t.artifactId === artifact.id);
      if (existingTab) return prev;

      const newTab: Tab = {
        id: tabId,
        artifactId: artifact.id,
        title: artifact.name,
        type: artifact.type
      };
      return [...prev, newTab];
    });

    setActiveTabId(tabId);
    setIsServiceScreenActive(false);
    setIsProjectDataScreenActive(false);
    dispatch(setCurrentArtifact(artifact.id));

    if (artifact?.data) {
      lastNodesStateRef.current = artifact.data;
    }
  }, [dispatch]);
  const { refreshConsole: handleRefreshConsole } = useConsoleArtifact({
    activeArtifact,
    currentProjectId: currentProject?.id,
    dispatch,
    fetchArtifactsAction: fetchArtifacts,
    setCurrentArtifactAction: setCurrentArtifact,
  });

  const handleTabClick = useCallback((tabId: string) => {
    setActiveTabId(tabId);
    setIsServiceScreenActive(false);
    setIsProjectDataScreenActive(false);
    const tab = tabs.find(t => t.id === tabId);
    if (tab) {
      dispatch(setCurrentArtifact(tab.artifactId));
      const artifact = artifacts[tab.artifactId];
      if (artifact?.data) {
        lastNodesStateRef.current = artifact.data;
      }
    }
  }, [tabs, artifacts, dispatch]);

  const handleOpenServiceScreen = useCallback((category: ServiceCategory = 'cell_towers') => {
    setServiceScreenCategory(category);
    setIsServiceScreenActive(true);
    setIsProjectDataScreenActive(false);
  }, []);

  const handleOpenProjectDataScreen = useCallback(() => {
    setServiceScreenCategory('project_data');
    setIsServiceScreenActive(false);
    setIsProjectDataScreenActive(true);
  }, []);

  const handleCloseServiceScreen = useCallback(() => {
    setIsServiceScreenActive(false);
    setIsProjectDataScreenActive(false);
  }, []);

  const handleRequestGraphAnalysis = useCallback((profileKey: string) => {
    setIsServiceScreenActive(false);
    setIsInspectorVisible(true);
    setInspectorTab('inspector');
    setRequestedInspectorTab('actions');
    setRequestedAnalysis({ profileKey, token: Date.now() });
  }, []);

  const handleTabClose = useCallback((tabId: string) => {
    setTabs(prev => prev.filter(t => t.id !== tabId));
    if (activeTabId === tabId) {
      const newActiveId = tabs.length > 1 ? tabs[0].id : null;
      setActiveTabId(newActiveId);
      if (newActiveId) {
        const tab = tabs.find(t => t.id === newActiveId);
        if (tab) {
          dispatch(setCurrentArtifact(tab.artifactId));
          const artifact = artifacts[tab.artifactId];
          if (artifact?.data) {
            lastNodesStateRef.current = artifact.data;
          }
        }
      } else {
        dispatch(setCurrentArtifact(null));
        lastNodesStateRef.current = null;
      }
    }
  }, [activeTabId, tabs, artifacts, dispatch]);

  const handleUndo = useCallback(async () => {
    await undoAction();
  }, [undoAction]);

  const handleRedo = useCallback(async () => {
    await redoAction();
  }, [redoAction]);

  const handleToggleCollapse = useCallback(() => {
    setIsSidebarCollapsed((prev) => !prev);
  }, []);

  const handleCreateProject = useCallback(async () => {
    if (!newProjectName.trim()) {
      setCreateProjectError(labels.emptyNameError);
      return;
    }
    setCreatingProject(true);
    setCreateProjectError(null);
    try {
      const created = await projectApi.create({ name: newProjectName.trim() });
      await dispatch(fetchProjects());
      dispatch(setCurrentProject(created.id));
      setNewProjectName('');
    } catch (error: any) {
      setCreateProjectError(labels.createError);
    } finally {
      setCreatingProject(false);
    }
  }, [newProjectName, dispatch]);

  if (projectsLoading) {
    return <div className="loading-screen">{labels.loadingProjects}</div>;
  }

  if (!projects || projects.length === 0) {
    if (projectsError) {
      return (
        <AppEmptyProjectsState
          labels={{
            ...labels,
            noProjectsTitle: labels.projectsUnavailableTitle,
            noProjectsHint: labels.projectsUnavailableHint,
            create: 'Повторить'
          }}
          newProjectName={newProjectName}
          setNewProjectName={setNewProjectName}
          creatingProject={projectsLoading}
          createProjectError={projectsError}
          onCreateProject={() => dispatch(fetchProjects())}
        />
      );
    }

    return (
      <AppEmptyProjectsState
        labels={labels}
        newProjectName={newProjectName}
        setNewProjectName={setNewProjectName}
        creatingProject={creatingProject}
        createProjectError={createProjectError}
        onCreateProject={handleCreateProject}
      />
    );
  }

  return (
    <div className="app">
      {isDevServerDisconnected && (
        <div className="dev-server-banner" role="status" aria-live="polite">
          <span>{labels.devServerDisconnected}</span>
          <button
            type="button"
            className="dev-server-banner-btn"
            onClick={() => window.location.reload()}
          >
            {labels.reloadPage}
          </button>
        </div>
      )}
      {backendHealth.status === 'slow' && (
        <div className="backend-health-banner" role="status">
          ?????? ??????? ?? {backendHealth.responseMs} ??. ?????? ????????, ?? ??? ???????? ??????? ?????????? ????? ???? ????????.
        </div>
      )}
      {backendHealth.status === 'offline' && (
        <div className="backend-health-banner backend-health-banner-error" role="alert">
          ?????? ?????????? ??????????. ????????? Docker, PostgreSQL ? ???????? ??????, ????? ???????? ????????.
        </div>
      )}
      <TabBar
        tabs={tabs}
        activeTabId={activeTabId}
        onTabClick={handleTabClick}
        onTabClose={handleTabClose}
        artifacts={artifacts}
        projectId={currentProject?.id || null}
      />
      <div className="main-layout">
        <Sidebar
          isCollapsed={isSidebarCollapsed}
          onToggleCollapse={handleToggleCollapse}
          onArtifactSelect={handleArtifactSelect}
          onOpenServiceScreen={handleOpenServiceScreen}
          onOpenProjectDataScreen={handleOpenProjectDataScreen}
          onCloseServiceScreen={handleCloseServiceScreen}
          isServiceScreenActive={isServiceScreenActive}
          isProjectDataScreenActive={isProjectDataScreenActive}
        />
        <div className="content-area" ref={contentAreaRef}>
          <div className="workspace-context-bar">
            {isServiceScreenActive || isProjectDataScreenActive ? (
              <div className={`workspace-mode-badge ${serviceScreenCategory === 'project_data' ? '' : 'admin'}`.trim()}>
                {workspaceSummary.modeLabel}
              </div>
            ) : null}
            <div className="workspace-context-copy">
              <div className="workspace-context-title">{workspaceSummary.title}</div>
              <div className="workspace-context-meta">{workspaceSummary.meta}</div>
            </div>
          </div>
          <div className="workspace-content-body">
            <Suspense fallback={<div className="workspace-loading">Загрузка рабочего представления...</div>}>
            {isProjectDataScreenActive ? (
              <ServiceFunctionsView
                projectId={currentProject?.id || null}
                initialCategory="project_data"
                mode="project_data_only"
              />
            ) : isServiceScreenActive ? (
              <ServiceFunctionsView
                projectId={currentProject?.id || null}
                initialCategory={serviceScreenCategory}
              />
            ) : (
              <ArtifactContentView
                activeArtifact={activeArtifact}
                isLoading={Boolean(activeArtifact && loadingArtifactId === activeArtifact.id)}
                labels={labels}
                graphViewProps={{
                  onNodeMove: handleNodeMove,
                  onNodesMove: handleNodesMove,
                  onAddEdge: handleAddEdge,
                  onDeleteSelection: handleDeleteSelection,
                  onAddNodeAtPosition: handleAddNodeAtPosition,
                  onPasteGraphClipboard: handlePasteGraphClipboard,
                  nodeCreateSpec: nodeCreationSpec,
                  onNodeCreateComplete: handleFinishNodeCreation,
                  connectType: edgeCreationType,
                  onConnectComplete: handleFinishEdgeCreation,
                  onUndo: handleUndo,
                  onRedo: handleRedo,
                  onHistoryChanged: refreshHistory,
                  canUndo,
                  canRedo,
                  isRecording,
                  lastError,
                  onRequestAnalysisProfile: handleRequestGraphAnalysis,
                  onOpenArtifact: handleArtifactSelect,
                }}
              />
            )}
            </Suspense>
          </div>
        </div>
        {!isServiceScreenActive && !isProjectDataScreenActive && (
          <div className={`inspector-shell ${isInspectorVisible ? 'expanded' : 'collapsed'}`}>
            <button
              type="button"
              className="inspector-grip"
              onClick={() => setIsInspectorVisible((prev) => !prev)}
              title={isInspectorVisible ? '\u0421\u043a\u0440\u044b\u0442\u044c \u0438\u043d\u0441\u043f\u0435\u043a\u0442\u043e\u0440' : '\u041f\u043e\u043a\u0430\u0437\u0430\u0442\u044c \u0438\u043d\u0441\u043f\u0435\u043a\u0442\u043e\u0440'}
              aria-label={isInspectorVisible ? '\u0421\u043a\u0440\u044b\u0442\u044c \u0438\u043d\u0441\u043f\u0435\u043a\u0442\u043e\u0440' : '\u041f\u043e\u043a\u0430\u0437\u0430\u0442\u044c \u0438\u043d\u0441\u043f\u0435\u043a\u0442\u043e\u0440'}
            >
              {isInspectorVisible ? '>' : '<'}
            </button>
            <div className="inspector-shell-body">
              {isInspectorVisible && (
                <div className="inspector-content-tabs">
                  <button
                    type="button"
                    className={`inspector-content-tab ${inspectorTab === 'inspector' ? 'active' : ''}`}
                    onClick={() => setInspectorTab('inspector')}
                  >
                    Инспектор
                  </button>
                  <button
                    type="button"
                    className={`inspector-content-tab ${inspectorTab === 'plugins' ? 'active' : ''}`}
                    onClick={() => setInspectorTab('plugins')}
                  >
                    Плагины
                  </button>
                </div>
              )}
              {isInspectorVisible && inspectorTab === 'inspector' && (
                <InspectorPanel
                  onApplyGraphData={handleGraphUpdate}
                  onStartNodeCreation={handleStartNodeCreation}
                  onStartEdgeCreation={handleStartEdgeCreation}
                  nodeCreationSpec={nodeCreationSpec}
                  edgeCreationType={edgeCreationType}
                  onRefreshConsole={handleRefreshConsole}
                  requestedTab={requestedInspectorTab}
                  requestedAnalysisProfileKey={requestedAnalysis?.profileKey || null}
                  requestedAnalysisToken={requestedAnalysis?.token || 0}
                />
              )}
              {isInspectorVisible && inspectorTab === 'plugins' && (
                <PluginsPanel />
              )}
            </div>
          </div>
        )}
      </div>
      {!isServiceScreenActive && !isProjectDataScreenActive && activeArtifact?.type === 'graph' && (
        <Suspense fallback={null}>
          <AppGraphBottomPanel
          projectId={activeArtifact?.project_id || 0}
          artifactTitle={activeArtifact?.name || 'Граф'}
          isOpen={isBottomPanelOpen}
          setIsOpen={setIsBottomPanelOpen}
          bottomPanelStyle={bottomPanelStyle}
          onResizerMouseDown={handleBottomResizerMouseDown}
          bottomTab={bottomTab}
          setBottomTab={setBottomTab}
          graphNodesForPanel={graphNodesForPanel}
          graphEdgesForPanel={graphEdgesForPanel}
          toggleNodeSort={toggleNodeSort}
          toggleEdgeSort={toggleEdgeSort}
          renderSortIndicator={renderSortIndicator}
          nodeSortKey={nodeSortKey}
          nodeSortDir={nodeSortDir}
          edgeSortKey={edgeSortKey}
          edgeSortDir={edgeSortDir}
          nodeAttributeColumns={nodeAttributeColumns}
          edgeAttributeColumns={edgeAttributeColumns}
          formatAttributeHeader={formatAttributeHeader}
          visibleGraphNodesForPanel={visibleGraphNodesForPanel}
          visibleGraphEdgesForPanel={visibleGraphEdgesForPanel}
          selectedNodeIds={selectedNodeIds}
          selectedEdgeIds={selectedEdgeIds}
          handleNodeRowClick={handleNodeRowClick}
          handleEdgeRowClick={handleEdgeRowClick}
          nodeRowRefs={nodeRowRefs}
          edgeRowRefs={edgeRowRefs}
          getNormalizedEdgeAttributes={getNormalizedEdgeAttributes}
          nodeLabelById={nodeLabelById}
          searchQuery={searchQuery}
          setSearchQuery={setSearchQuery}
          nodeTypeOptions={nodeTypeOptions}
          edgeTypeOptions={edgeTypeOptions}
          activeTypeFilter={activeTypeFilter}
          setNodeTypeFilter={setNodeTypeFilter}
          setEdgeTypeFilter={setEdgeTypeFilter}
          nodeAttributeKeyOptions={nodeAttributeKeyOptions}
          edgeAttributeKeyOptions={edgeAttributeKeyOptions}
          activeAttributeKeyFilter={activeAttributeKeyFilter}
          setNodeAttributeKeyFilter={setNodeAttributeKeyFilter}
          setEdgeAttributeKeyFilter={setEdgeAttributeKeyFilter}
          attributeValueOptions={attributeValueOptions}
          activeAttributeValueFilter={activeAttributeValueFilter}
          setNodeAttributeValueFilter={setNodeAttributeValueFilter}
          setEdgeAttributeValueFilter={setEdgeAttributeValueFilter}
          showOnlySelected={showOnlySelected}
          setShowOnlySelected={setShowOnlySelected}
          resultTabs={resultTabs}
          />
        </Suspense>
      )}
    </div>
  );
}

export default App;
















