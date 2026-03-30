// frontend/src/App.tsx
import React, { useEffect, useState, useCallback, useMemo, useRef } from 'react';
import { useAppDispatch, useAppSelector } from './store';
import { fetchProjects, setCurrentProject } from './store/slices/projectsSlice';
import { setCurrentArtifact, fetchArtifacts } from './store/slices/artifactsSlice';
import TabBar from './components/layout/TabBar';
import Sidebar from './components/layout/Sidebar';
import InspectorPanel from './components/layout/InspectorPanel';
import { GraphView } from './components/views/GraphView';
import DocumentView from './components/views/DocumentView';
import MapView from './components/views/MapView';
import TableView from './components/views/TableView';
import ChartView from './components/views/ChartView';
import { useActionWithUndo } from './hooks/useActionWithUndo';
import { projectApi } from './services/api';
import './App.css';
import './components/layout/TabBar.css';

interface Tab {
  id: string;
  artifactId: number;
  title: string;
  type: string;
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
  const [activeTabId, setActiveTabId] = useState<string | null>(null);

  const lastNodesStateRef = useRef<any>(null);

  useEffect(() => {
    dispatch(fetchProjects());
  }, [dispatch]);

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
      if (existing) {
        setActiveTabId(existing.id);
        return prev;
      }
      const newTab: Tab = {
        id: `tab-${artifact.id}`,
        artifactId: artifact.id,
        title: artifact.name,
        type: artifact.type
      };
      setActiveTabId(newTab.id);
      return [...prev, newTab];
    });
  }, [currentArtifactId, artifacts]);

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
      if (validTabs.length === prev.length) return prev;

      const stillActive = activeTabId && validTabs.find(t => t.id === activeTabId);
      if (!stillActive) {
        const next = validTabs[0] || null;
        setActiveTabId(next ? next.id : null);
        if (next) {
          dispatch(setCurrentArtifact(next.artifactId));
        } else {
          dispatch(setCurrentArtifact(null));
        }
      }

      return validTabs;
    });
  }, [artifacts, activeTabId, dispatch]);

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

  const handleArtifactSelect = useCallback((artifact: any) => {
    setTabs(prev => {
      const existingTab = prev.find(t => t.artifactId === artifact.id);
      if (existingTab) {
        setActiveTabId(existingTab.id);
        dispatch(setCurrentArtifact(artifact.id));
        return prev;
      }

      const newTab: Tab = {
        id: `tab-${artifact.id}`,
        artifactId: artifact.id,
        title: artifact.name,
        type: artifact.type
      };

      setActiveTabId(newTab.id);
      dispatch(setCurrentArtifact(artifact.id));

      if (artifact?.data) {
        lastNodesStateRef.current = artifact.data;
      }

      return [...prev, newTab];
    });
  }, [dispatch]);

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

  const handleToggleCollapse = useCallback(() => {}, []);

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
          isCollapsed={false}
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
                onGraphUpdate={handleGraphUpdate}
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
        <InspectorPanel />
      </div>
    </div>
  );
}

export default App;



















