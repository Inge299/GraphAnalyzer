// frontend/src/App.tsx
import { useEffect, useState, useCallback, useMemo, useRef } from 'react';
import { useAppDispatch, useAppSelector } from './store';
import { fetchProjects, setCurrentProject } from './store/slices/projectsSlice';
import { setCurrentArtifact, fetchArtifacts } from './store/slices/artifactsSlice';
import { setSelectedElements } from './store/slices/uiSlice';
import TabBar from './components/layout/TabBar';
import Sidebar from './components/layout/Sidebar';
import InspectorPanel from './components/layout/InspectorPanel';
import PluginsPanel from './components/layout/PluginsPanel';
import ServiceFunctionsView from './components/views/ServiceFunctionsView';
import AppEmptyProjectsState from './components/app/AppEmptyProjectsState';
import ArtifactContentView from './components/app/ArtifactContentView';
import AppGraphBottomPanel from './components/app/AppGraphBottomPanel';
import { useActionWithUndo } from './hooks/useActionWithUndo';
import { useConsoleArtifact } from './hooks/useConsoleArtifact';
import { useGraphBottomPanelViewModel } from './hooks/useGraphBottomPanelViewModel';
import { initializeGraphDisplaySettings } from './config/graphDisplaySettings';
import { useDomainModelVisuals } from './hooks/useDomainModelVisuals';
import { useGraphBottomPanelState } from './hooks/useGraphBottomPanelState';
import { projectApi } from './services/api';
import './App.css';
import './components/layout/TabBar.css';

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

  const labels = {
  loadingProjects: 'Загрузка проектов...',
  noProjectsTitle: 'Проектов пока нет',
  noProjectsHint: 'Создай первый проект, чтобы начать работу',
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
  const projectsLoading = useAppSelector((state) => state.projects.isLoading);
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
  const [isDevServerDisconnected, setIsDevServerDisconnected] = useState(false);

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
    if (isServiceScreenActive) {
      return {
        modeLabel: 'Администрирование',
        title: 'Сервисные функции',
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
      const nodesCount = Array.isArray(activeArtifact.data?.nodes) ? activeArtifact.data.nodes.length : 0;
      const edgesCount = Array.isArray(activeArtifact.data?.edges) ? activeArtifact.data.edges.length : 0;
      return {
        modeLabel: 'Анализ',
        title: activeArtifact.name,
        meta: `${artifactTypeLabels[activeArtifact.type] || activeArtifact.type} · узлов ${nodesCount} · связей ${edgesCount}`,
      };
    }

    return {
      modeLabel: 'Анализ',
      title: activeArtifact.name,
      meta: artifactTypeLabels[activeArtifact.type] || activeArtifact.type,
    };
  }, [activeArtifact, currentProject?.name, isServiceScreenActive]);

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
    groupId?: string | null
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
        description: `\u041f\u0435\u0440\u0435\u043c\u0435\u0449\u0435\u043d\u0438\u0435 ${moves.length} \u0443\u0437\u043b\u043e\u0432`,
        actionType: 'batch_move',
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
    const tab = tabs.find(t => t.id === tabId);
    if (tab) {
      dispatch(setCurrentArtifact(tab.artifactId));
      const artifact = artifacts[tab.artifactId];
      if (artifact?.data) {
        lastNodesStateRef.current = artifact.data;
      }
    }
  }, [tabs, artifacts, dispatch]);

  const handleOpenServiceScreen = useCallback(() => {
    setIsServiceScreenActive(true);
  }, []);

  const handleCloseServiceScreen = useCallback(() => {
    setIsServiceScreenActive(false);
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
          onCloseServiceScreen={handleCloseServiceScreen}
          isServiceScreenActive={isServiceScreenActive}
        />
        <div className="content-area" ref={contentAreaRef}>
          <div className="workspace-context-bar">
            <div className={`workspace-mode-badge ${isServiceScreenActive ? 'admin' : 'analysis'}`}>
              {workspaceSummary.modeLabel}
            </div>
            <div className="workspace-context-copy">
              <div className="workspace-context-title">{workspaceSummary.title}</div>
              <div className="workspace-context-meta">{workspaceSummary.meta}</div>
            </div>
          </div>
          <div className="workspace-content-body">
            {isServiceScreenActive ? (
              <ServiceFunctionsView projectId={currentProject?.id || null} />
            ) : (
              <ArtifactContentView
                activeArtifact={activeArtifact}
                labels={labels}
                graphViewProps={{
                  onNodeMove: handleNodeMove,
                  onNodesMove: handleNodesMove,
                  onAddEdge: handleAddEdge,
                  onDeleteSelection: handleDeleteSelection,
                  onAddNodeAtPosition: handleAddNodeAtPosition,
                  nodeCreateSpec: nodeCreationSpec,
                  onNodeCreateComplete: handleFinishNodeCreation,
                  connectType: edgeCreationType,
                  onConnectComplete: handleFinishEdgeCreation,
                  onUndo: handleUndo,
                  onRedo: handleRedo,
                  canUndo,
                  canRedo,
                  isRecording,
                  lastError,
                  onRequestAnalysisProfile: handleRequestGraphAnalysis,
                }}
              />
            )}
          </div>
        </div>
        {!isServiceScreenActive && (
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
      {!isServiceScreenActive && activeArtifact?.type === 'graph' && (
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
      )}
    </div>
  );
}

export default App;
















