// frontend/src/App.tsx
import React, { useEffect, useState, useCallback } from 'react';
import { useAppDispatch, useAppSelector } from './store';
import { fetchProjects } from './store/slices/projectsSlice';
import { updateArtifact } from './store/slices/artifactsSlice';
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
  const currentArtifactId = useAppSelector((state) => state.artifacts.currentArtifact);
  
  const [tabs, setTabs] = useState<Tab[]>([]);
  const [activeTabId, setActiveTabId] = useState<string | null>(null);
  
  const projectsCount = projects?.length ?? 0;

  console.log('[App] State:', { 
    projectsCount, 
    currentProject: currentProject?.id,
    currentArtifact: currentArtifactId,
    tabsCount: tabs.length
  });

  useEffect(() => {
    dispatch(fetchProjects());
  }, [dispatch]);

  const handleArtifactSelect = (artifact: any) => {
    console.log('[App] Artifact selected:', artifact.id, artifact.name);
    
    const existingTab = tabs.find(t => t.artifactId === artifact.id);
    if (existingTab) {
      setActiveTabId(existingTab.id);
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
  };

  const handleTabClick = (tabId: string) => {
    setActiveTabId(tabId);
  };

  const handleTabClose = (tabId: string) => {
    setTabs(prev => prev.filter(t => t.id !== tabId));
    if (activeTabId === tabId) {
      setActiveTabId(tabs.length > 1 ? tabs[0].id : null);
    }
  };

  const handleToggleCollapse = () => {
    console.log('Toggle sidebar');
  };

  const getActiveArtifact = () => {
    if (!activeTabId) return null;
    const activeTab = tabs.find(t => t.id === activeTabId);
    if (!activeTab) return null;
    return artifacts[activeTab.artifactId];
  };

  const activeArtifact = getActiveArtifact();

  const { execute } = useActionWithUndo(
    activeArtifact?.id || 0,
    activeArtifact?.data || {},
    async (newData) => {
      if (activeArtifact) {
        await dispatch(updateArtifact({
          projectId: activeArtifact.project_id,
          id: activeArtifact.id,
          updates: { data: newData }
        })).unwrap();
      }
    }
  );

  const handleNodeMove = useCallback(async (
    nodeId: string, 
    x: number, 
    y: number, 
    groupId?: string | null
  ) => {
    if (!activeArtifact) return;

    console.log('[App] Moving node:', { nodeId, x, y, groupId });

    const beforeState = activeArtifact.data;
    
    const afterState = {
      ...beforeState,
      nodes: (beforeState?.nodes || []).map((node: any) =>
        node.id === nodeId
          ? { ...node, position_x: Math.round(x), position_y: Math.round(y) }
          : node
      )
    };

    console.log('[App] Before state:', beforeState);
    console.log('[App] After state:', afterState);

    try {
      await execute(
        async () => afterState,
        {
          description: `Moving node ${nodeId}`,
          actionType: 'move_node',
          groupId: groupId || undefined
        }
      );
    } catch (error) {
      console.error('[App] Move failed:', error);
    }
  }, [activeArtifact, execute]);

  const handleNodesMove = useCallback(async (
    moves: Array<{ nodeId: string; x: number; y: number }>,
    groupId?: string | null
  ) => {
    if (!activeArtifact || moves.length === 0) return;

    console.log('[App] Moving multiple nodes:', moves.length, moves);

    const beforeState = activeArtifact.data;
    const moveMap = new Map(moves.map(m => [m.nodeId, { x: Math.round(m.x), y: Math.round(m.y) }]));
    
    const afterState = {
      ...beforeState,
      nodes: (beforeState?.nodes || []).map((node: any) => {
        const move = moveMap.get(node.id);
        return move
          ? { ...node, position_x: move.x, position_y: move.y }
          : node;
      })
    };

    try {
      await execute(
        async () => afterState,
        {
          description: `Moving ${moves.length} nodes`,
          actionType: 'batch_move',
          groupId: groupId || undefined
        }
      );
    } catch (error) {
      console.error('[App] Batch move failed:', error);
    }
  }, [activeArtifact, execute]);

  if (!projects) {
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
              artifact={activeArtifact}
              onNodeMove={handleNodeMove}
              onNodesMove={handleNodesMove}
            />
          ) : (
            <div className="no-selection">
              <h2>Select an artifact from the sidebar</h2>
              <p>Use the sidebar to navigate projects and artifacts</p>
            </div>
          )}
        </div>
        <InspectorPanel />
      </div>
    </div>
  );
}

export default App;