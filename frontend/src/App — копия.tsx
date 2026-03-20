// frontend/src/App.tsx
import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { useAppDispatch, useAppSelector } from './store';
import { fetchProjects } from './store/slices/projectsSlice';
import { setCurrentArtifact, fetchArtifacts } from './store/slices/artifactsSlice';
import TabBar from './components/layout/TabBar';
import Sidebar from './components/layout/Sidebar';
import InspectorPanel from './components/layout/InspectorPanel';
import { GraphView } from './components/views/GraphView';
import { useActionWithUndo } from './hooks/useActionWithUndo';
import './App.css';
import './components/layout/TabBar.css';

interface Tab {
  id: string;
  artifactId: number;
  title: string;
  type: string;
}

function App() {
  const dispatch = useAppDispatch();
  const projects = useAppSelector((state) => state.projects.projects);
  const currentProject = useAppSelector((state) => state.projects.currentProject);
  const artifacts = useAppSelector((state) => state.artifacts.items);
  
  const [tabs, setTabs] = useState<Tab[]>([]);
  const [activeTabId, setActiveTabId] = useState<string | null>(null);

  useEffect(() => {
    dispatch(fetchProjects());
  }, [dispatch]);

  useEffect(() => {
    if (currentProject?.id) {
      dispatch(fetchArtifacts(currentProject.id));
    }
  }, [currentProject?.id, dispatch]);

  const activeArtifact = useMemo(() => {
    if (!activeTabId) return null;
    const activeTab = tabs.find(t => t.id === activeTabId);
    if (!activeTab) return null;
    return artifacts[activeTab.artifactId];
  }, [activeTabId, tabs, artifacts]);

  const currentArtifactData = useMemo(() => {
    return activeArtifact?.data || { nodes: [], edges: [] };
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
    () => {}, // пустая функция
    activeArtifact?.project_id || 1
  );

  // Исправленный обработчик перемещения одного узла
  const handleNodeMove = useCallback(async (
    nodeId: string, 
    x: number, 
    y: number, 
    groupId?: string | null
  ) => {
    if (!activeArtifact) return;

    // Берем актуальные данные из Redux
    const currentData = artifacts[activeArtifact.id]?.data;
    if (!currentData) {
      console.error('[App] Artifact data not found in store');
      return;
    }

    console.log('[App] Moving node:', nodeId, 'to:', x, y);
    console.log('[App] Current nodes:', currentData.nodes.map((n: any) => ({ id: n.id, x: n.position_x, y: n.position_y })));

    // СОХРАНЯЕМ ВСЕ УЗЛЫ, обновляем только текущий
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

    console.log('[App] After state nodes:', afterState.nodes.map((n: any) => ({ id: n.id, x: n.position_x, y: n.position_y })));

    await execute(
      async () => afterState,
      {
        description: `Перемещение узла ${nodeId}`,
        actionType: 'move_node',
        groupId: groupId || undefined
      }
    );
  }, [activeArtifact, artifacts, execute]);

  // Исправленный обработчик перемещения нескольких узлов
  const handleNodesMove = useCallback(async (
    moves: Array<{ nodeId: string; x: number; y: number }>,
    groupId?: string | null
  ) => {
    if (!activeArtifact || moves.length === 0) return;

    const currentData = artifacts[activeArtifact.id]?.data;
    if (!currentData) {
      console.error('[App] Artifact data not found in store');
      return;
    }

    // Создаем карту новых позиций
    const moveMap = new Map(moves.map(m => [m.nodeId, { x: Math.round(m.x), y: Math.round(m.y) }]));
    
    // СОХРАНЯЕМ ВСЕ УЗЛЫ, обновляем только перемещаемые
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

    await execute(
      async () => afterState,
      {
        description: `Перемещение ${moves.length} узлов`,
        actionType: 'batch_move',
        groupId: groupId || undefined
      }
    );
  }, [activeArtifact, artifacts, execute]);

  const handleArtifactSelect = useCallback((artifact: any) => {
    const existingTab = tabs.find(t => t.artifactId === artifact.id);
    if (existingTab) {
      setActiveTabId(existingTab.id);
      dispatch(setCurrentArtifact(artifact.id));
      return;
    }
    
    const newTab: Tab = {
      id: `tab-${artifact.id}-${Date.now()}`,
      artifactId: artifact.id,
      title: artifact.name,
      type: artifact.type
    };
    
    setTabs(prev => [...prev, newTab]);
    setActiveTabId(newTab.id);
    dispatch(setCurrentArtifact(artifact.id));
  }, [tabs, dispatch]);

  const handleTabClick = useCallback((tabId: string) => {
    setActiveTabId(tabId);
    const tab = tabs.find(t => t.id === tabId);
    if (tab) {
      dispatch(setCurrentArtifact(tab.artifactId));
    }
  }, [tabs, dispatch]);

  const handleTabClose = useCallback((tabId: string) => {
    setTabs(prev => prev.filter(t => t.id !== tabId));
    if (activeTabId === tabId) {
      const newActiveId = tabs.length > 1 ? tabs[0].id : null;
      setActiveTabId(newActiveId);
      if (newActiveId) {
        const tab = tabs.find(t => t.id === newActiveId);
        if (tab) {
          dispatch(setCurrentArtifact(tab.artifactId));
        }
      } else {
        dispatch(setCurrentArtifact(null));
      }
    }
  }, [activeTabId, tabs, dispatch]);

  const handleUndo = useCallback(async () => {
    await undoAction();
  }, [undoAction]);

  const handleRedo = useCallback(async () => {
    await redoAction();
  }, [redoAction]);

  const handleToggleCollapse = useCallback(() => {}, []);

  if (!projects || projects.length === 0) {
    return <div className="loading-screen">Loading projects...</div>;
  }

  return (
    <div className="app">
      <TabBar 
        tabs={tabs}
        activeTabId={activeTabId}
        onTabClick={handleTabClick}
        onTabClose={handleTabClose}
      />
      <div className="main-layout">
        <Sidebar 
          isCollapsed={false}
          onToggleCollapse={handleToggleCollapse}
          onArtifactSelect={handleArtifactSelect}
        />
        <div className="content-area">
          {activeArtifact ? (
            <GraphView 
              key={activeArtifact.id}
              artifact={activeArtifact}
              onNodeMove={handleNodeMove}
              onNodesMove={handleNodesMove}
              onUndo={handleUndo}
              onRedo={handleRedo}
              canUndo={canUndo}
              canRedo={canRedo}
              isRecording={isRecording}
              lastError={lastError}
            />
          ) : (
            <div className="no-selection">
              <h2>Выберите артефакт из сайдбара</h2>
              <p>Используйте сайдбар для навигации по проектам и артефактам</p>
            </div>
          )}
        </div>
        <InspectorPanel />
      </div>
    </div>
  );
}

export default App;