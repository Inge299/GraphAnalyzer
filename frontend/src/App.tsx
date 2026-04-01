// frontend/src/App.tsx
import React, { useEffect, useState, useCallback, useMemo, useRef } from 'react';
import { useAppDispatch, useAppSelector } from './store';
import { fetchProjects, setCurrentProject } from './store/slices/projectsSlice';
import { setCurrentArtifact, fetchArtifacts } from './store/slices/artifactsSlice';
import { setSelectedElements } from './store/slices/uiSlice';
import TabBar from './components/layout/TabBar';
import Sidebar from './components/layout/Sidebar';
import InspectorPanel from './components/layout/InspectorPanel';
import { GraphView } from './components/views/GraphView';
import DocumentView from './components/views/DocumentView';
import MapView from './components/views/MapView';
import TableView from './components/views/TableView';
import ChartView from './components/views/ChartView';
import { useActionWithUndo } from './hooks/useActionWithUndo';
import { projectApi, domainModelApi } from './services/api';
import './App.css';
import './components/layout/TabBar.css';
import type { DomainModelConfig } from './types/api';

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
  loadingProjects: 'Loading projects...',
  noProjectsTitle: '\u041f\u0440\u043e\u0435\u043a\u0442\u043e\u0432 \u043f\u043e\u043a\u0430 \u043d\u0435\u0442',
  noProjectsHint: '\u0421\u043e\u0437\u0434\u0430\u0439 \u043f\u0435\u0440\u0432\u044b\u0439 \u043f\u0440\u043e\u0435\u043a\u0442, \u0447\u0442\u043e\u0431\u044b \u043d\u0430\u0447\u0430\u0442\u044c \u0440\u0430\u0431\u043e\u0442\u0443',
  projectNamePlaceholder: '\u041d\u0430\u0437\u0432\u0430\u043d\u0438\u0435 \u043f\u0440\u043e\u0435\u043a\u0442\u0430',
  creating: '\u0421\u043e\u0437\u0434\u0430\u043d\u0438\u0435...',
  create: '\u0421\u043e\u0437\u0434\u0430\u0442\u044c',
  emptyNameError: '\u0412\u0432\u0435\u0434\u0438\u0442\u0435 \u043d\u0430\u0437\u0432\u0430\u043d\u0438\u0435 \u043f\u0440\u043e\u0435\u043a\u0442\u0430',
  createError: '\u041d\u0435 \u0443\u0434\u0430\u043b\u043e\u0441\u044c \u0441\u043e\u0437\u0434\u0430\u0442\u044c \u043f\u0440\u043e\u0435\u043a\u0442',
  noSelectionTitle: '\u0412\u044b\u0431\u0435\u0440\u0438\u0442\u0435 \u0430\u0440\u0442\u0435\u0444\u0430\u043a\u0442 \u0438\u0437 \u0441\u0430\u0439\u0434\u0431\u0430\u0440\u0430',
  noSelectionHint: '\u0418\u0441\u043f\u043e\u043b\u044c\u0437\u0443\u0439\u0442\u0435 \u0441\u0430\u0439\u0434\u0431\u0430\u0440 \u0434\u043b\u044f \u043d\u0430\u0432\u0438\u0433\u0430\u0446\u0438\u0438 \u043f\u043e \u043f\u0440\u043e\u0435\u043a\u0442\u0430\u043c \u0438 \u0430\u0440\u0442\u0435\u0444\u0430\u043a\u0442\u0430\u043c'
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

  const lastNodesStateRef = useRef<any>(null);
  const [edgeCreationType, setEdgeCreationType] = useState<string | null>(null);
  const [nodeCreationSpec, setNodeCreationSpec] = useState<NodeCreationSpec | null>(null);
  const [edgeTypeVisuals, setEdgeTypeVisuals] = useState<Record<string, { color: string; width: number; direction: string; dashed: boolean; label: string }>>({});
  const [nodeTypeVisuals, setNodeTypeVisuals] = useState<Record<string, { icon: string; color: string; iconScale: number; ringEnabled: boolean; ringWidth: number; label: string }>>({});

  useEffect(() => {
    dispatch(fetchProjects());
  }, [dispatch]);

  useEffect(() => {
    if (currentProject?.id) {
      dispatch(fetchArtifacts(currentProject.id));
    }
  }, [currentProject?.id, dispatch]);

  useEffect(() => {
    let cancelled = false;

    const loadDomainModel = async () => {
      try {
        const model = await domainModelApi.get() as DomainModelConfig;
        if (cancelled) return;

        const edgeMap: Record<string, { color: string; width: number; direction: string; dashed: boolean; label: string }> = {};
        (model?.edge_types || []).forEach((edge: any) => {
          const id = String(edge?.id || '').trim();
          if (!id) return;
          const visual = edge?.default_visual || {};
          edgeMap[id] = {
            color: String(visual.color || '#475569'),
            width: Number(visual.width ?? 2),
            direction: String(visual.direction || 'to'),
            dashed: Boolean(visual.dashed ?? false),
            label: String(edge?.label || id)
          };
        });

        const nodeMap: Record<string, { icon: string; color: string; iconScale: number; ringEnabled: boolean; ringWidth: number; label: string }> = {};
        (model?.node_types || []).forEach((node: any) => {
          const id = String(node?.id || '').trim();
          if (!id) return;
          const visual = node?.default_visual || {};
          nodeMap[id] = {
            icon: String(node?.icon || ''),
            color: String(visual.color || '#3b82f6'),
            iconScale: Number(visual.iconScale ?? 2),
            ringEnabled: Boolean(visual.ringEnabled ?? true),
            ringWidth: Number(visual.ringWidth ?? 2),
            label: String(node?.label || id)
          };
        });

        setEdgeTypeVisuals(edgeMap);
        setNodeTypeVisuals(nodeMap);
      } catch {
        if (cancelled) return;
        setEdgeTypeVisuals({});
        setNodeTypeVisuals({});
      }
    };

    loadDomainModel();
    return () => { cancelled = true; };
  }, []);

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
      return validTabs.length === prev.length ? prev : validTabs;
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
    createBatchGroup,
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
        window.alert('РЈР·РµР» СЃ С‚Р°РєРёРј С‚РёРїРѕРј Рё РїРѕРґРїРёСЃСЊСЋ СѓР¶Рµ СЃСѓС‰РµСЃС‚РІСѓРµС‚');
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
      ringEnabled: true,
      ringWidth: 2,
      label: typeId
    };

    const nodeLabel = String(label || defaults.label || typeId || 'РќРѕРІС‹Р№ СѓР·РµР»');

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
        description: `Р”РѕР±Р°РІР»РµРЅ СѓР·РµР» ${nodeLabel}`,
        actionType: 'add_node'
      }
    );

    dispatch(setSelectedElements([{ type: 'node', id: nodeId, data: newNode }]));
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
    const existingTab = tabs.find(t => t.artifactId === artifact.id);

    if (existingTab) {
      setActiveTabId(existingTab.id);
    } else {
      const newTab: Tab = {
        id: 'tab-' + artifact.id,
        artifactId: artifact.id,
        title: artifact.name,
        type: artifact.type
      };
      setTabs(prev => [...prev, newTab]);
      setActiveTabId(newTab.id);
    }

    dispatch(setCurrentArtifact(artifact.id));

    if (artifact?.data) {
      lastNodesStateRef.current = artifact.data;
    }
  }, [tabs, dispatch]);

  const handleTabClick = useCallback((tabId: string) => {
    setActiveTabId(tabId);
    const tab = tabs.find(t => t.id === tabId);
    if (tab) {
      dispatch(setCurrentArtifact(tab.artifactId));
      const artifact = artifacts[tab.artifactId];
      if (artifact?.data) {
        lastNodesStateRef.current = artifact.data;
      }
    }
  }, [tabs, artifacts, dispatch]);

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
      <div className="loading-screen" style={{ display: 'flex', flexDirection: 'column', gap: '12px', alignItems: 'center' }}>
        <div style={{ fontSize: '18px', color: '#ffffff' }}>{labels.noProjectsTitle}</div>
        <div style={{ color: '#9ca3af', fontSize: '13px' }}>{labels.noProjectsHint}</div>
        <div style={{ display: 'flex', gap: '8px', marginTop: '8px' }}>
          <input
            type="text"
            value={newProjectName}
            onChange={(e) => setNewProjectName(e.target.value)}
            placeholder={labels.projectNamePlaceholder}
            style={{
              padding: '8px 10px',
              borderRadius: '6px',
              border: '1px solid #374151',
              background: '#111827',
              color: '#e5e7eb',
              minWidth: '260px'
            }}
          />
          <button
            onClick={handleCreateProject}
            disabled={creatingProject}
            style={{
              padding: '8px 12px',
              borderRadius: '6px',
              border: '1px solid #2563eb',
              background: '#2563eb',
              color: '#ffffff',
              cursor: 'pointer'
            }}
          >
            {creatingProject ? labels.creating : labels.create}
          </button>
        </div>
        {createProjectError && (
          <div style={{ color: '#f87171', fontSize: '12px' }}>{createProjectError}</div>
        )}
      </div>
    );
  }

  return (
    <div className="app">
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
        />
        <div className="content-area">
          {activeArtifact ? (
            activeArtifact.type === 'graph' ? (
              <GraphView
                key={activeArtifact.id}
                artifact={activeArtifact}
                onNodeMove={handleNodeMove}
                onNodesMove={handleNodesMove}
                onAddEdge={handleAddEdge}
                onDeleteSelection={handleDeleteSelection}
                onAddNodeAtPosition={handleAddNodeAtPosition}
                nodeCreateSpec={nodeCreationSpec}
                onNodeCreateComplete={handleFinishNodeCreation}
                connectType={edgeCreationType}
                onConnectComplete={handleFinishEdgeCreation}
                onUndo={handleUndo}
                onRedo={handleRedo}
                canUndo={canUndo}
                canRedo={canRedo}
                isRecording={isRecording}
                lastError={lastError}
              />
            ) : activeArtifact.type === 'document' ? (
              <DocumentView artifact={activeArtifact} />
            ) : activeArtifact.type === 'map' ? (
              <MapView artifact={activeArtifact} _onUpdate={() => {}} />
            ) : activeArtifact.type === 'table' ? (
              <TableView artifact={activeArtifact} _onUpdate={() => {}} />
            ) : activeArtifact.type === 'chart' ? (
              <ChartView artifact={activeArtifact} _onUpdate={() => {}} />
            ) : (
              <DocumentView artifact={activeArtifact} />
            )
          ) : (
            <div className="no-selection">
              <h2>{labels.noSelectionTitle}</h2>
              <p>{labels.noSelectionHint}</p>
            </div>
          )}
        </div>
        <InspectorPanel onApplyGraphData={handleGraphUpdate} onStartNodeCreation={handleStartNodeCreation} onStartEdgeCreation={handleStartEdgeCreation} nodeCreationSpec={nodeCreationSpec} edgeCreationType={edgeCreationType} />
      </div>
    </div>
  );
}

export default App;













































