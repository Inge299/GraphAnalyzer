// frontend/src/App.tsx
import React, { useEffect, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { RootState, AppDispatch } from './store';
import Sidebar from './components/layout/Sidebar';
import TabBar from './components/layout/TabBar';
import InspectorPanel from './components/layout/InspectorPanel';
import ArtifactView from './components/views/ArtifactView';
import { fetchProjects, setCurrentProject } from './store/slices/projectsSlice';
import { fetchArtifacts, Artifact, updateArtifact } from './store/slices/artifactsSlice';
import { addTab, removeTab, setActiveTab } from './store/slices/uiSlice';
import './App.css';

interface Tab {
  id: string;
  artifactId: number;
  title: string;
  type: string;
}

const App: React.FC = () => {
  const dispatch = useDispatch<AppDispatch>();
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [hasInitialized, setHasInitialized] = useState(false);
  
  const { projects, currentProject } = useSelector((state: RootState) => state.projects);
  const { artifacts } = useSelector((state: RootState) => state.artifacts);
  const { tabs, activeTabId, darkMode, inspectorWidth } = useSelector((state: RootState) => state.ui);

  useEffect(() => {
    console.log('[App] Initializing app, fetching projects');
    dispatch(fetchProjects());
  }, [dispatch]);

  useEffect(() => {
    console.log('[App] projects or currentProject changed:', { 
      projectsCount: projects.length, 
      currentProject: currentProject?.id 
    });
    
    if (projects.length > 0 && !currentProject && !hasInitialized) {
      console.log('[App] Setting first project as current:', projects[0].id);
      dispatch(setCurrentProject(projects[0].id));
      setHasInitialized(true);
    }
    
    if (currentProject?.id) {
      console.log(`[App] Current project ID: ${currentProject.id}, fetching artifacts`);
      dispatch(fetchArtifacts(currentProject.id));
    }
  }, [projects, currentProject, dispatch, hasInitialized]);

  const handleArtifactSelect = (artifact: Artifact) => {
    console.log('[App] Artifact selected:', artifact.id, artifact.name);
    
    const existingTab = tabs.find(tab => tab.artifactId === artifact.id);
    
    if (existingTab) {
      dispatch(setActiveTab(existingTab.id));
    } else {
      const tabId = `tab-${Date.now()}-${artifact.id}`;
      const icon = getArtifactIcon(artifact.type);
      
      dispatch(addTab({
        id: tabId,
        artifactId: artifact.id,
        title: `${icon} ${artifact.name}`,
        type: artifact.type,
      }));
      
      dispatch(setActiveTab(tabId));
    }
  };

  const handleTabClose = (tabId: string) => {
    console.log('[App] Closing tab:', tabId);
    dispatch(removeTab(tabId));
  };

  const handleArtifactUpdate = async (artifactId: number, updates: Partial<Artifact>) => {
    if (!currentProject) return;
    
    console.log(`[App] Updating artifact ${artifactId}:`, updates);
    
    try {
      await dispatch(updateArtifact({
        projectId: currentProject.id,
        id: artifactId,
        updates,
      }));
    } catch (error) {
      console.error('[App] Failed to update artifact:', error);
    }
  };

  const handleNodeMove = (artifactId: number, nodeId: string, x: number, y: number) => {
    console.log(`[App] Node ${nodeId} moved to (${x}, ${y}) in artifact ${artifactId}`);
    
    const artifact = artifacts.find(a => a.id === artifactId);
    if (!artifact || artifact.type !== 'graph') return;
    
    const updatedNodes = artifact.data.nodes?.map((node: any) =>
      node.id === nodeId || node.node_id === nodeId
        ? { ...node, position_x: x, position_y: y }
        : node
    );
    
    handleArtifactUpdate(artifactId, {
      data: {
        ...artifact.data,
        nodes: updatedNodes,
      },
    });
  };

  const getArtifactIcon = (type: string): string => {
    switch (type) {
      case 'graph': return '📊';
      case 'table': return '📋';
      case 'map': return '🗺️';
      case 'chart': return '📈';
      case 'document': return '📄';
      default: return '📁';
    }
  };

  const activeArtifact = activeTabId
    ? artifacts.find(a => a.id === tabs.find(t => t.id === activeTabId)?.artifactId)
    : null;

  return (
    <div className={`app ${darkMode ? 'dark' : 'light'}`}>
      <Sidebar
        isCollapsed={isSidebarCollapsed}
        onToggleCollapse={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
        onArtifactSelect={handleArtifactSelect}
      />

      <div className="main-content">
        <TabBar
          tabs={tabs}
          activeTabId={activeTabId}
          onTabClick={(tabId) => dispatch(setActiveTab(tabId))}
          onTabClose={handleTabClose}
        />

        <div className="content-area">
          <div className="view-container">
            {activeArtifact ? (
              <ArtifactView
                key={activeArtifact.id}
                artifact={activeArtifact}
                onClose={() => activeTabId && handleTabClose(activeTabId)}
                onUpdate={(updates) => handleArtifactUpdate(activeArtifact.id, updates)}
                onNodeMove={(nodeId, x, y) => handleNodeMove(activeArtifact.id, nodeId, x, y)}
              />
            ) : (
              <div className="empty-state">
                <div className="text-center">
                  <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M4 5a1 1 0 011-1h14a1 1 0 011 1v2a1 1 0 01-1 1H5a1 1 0 01-1-1V5zM4 13a1 1 0 011-1h6a1 1 0 011 1v6a1 1 0 01-1 1H5a1 1 0 01-1-1v-6zM16 13a1 1 0 011-1h2a1 1 0 011 1v6a1 1 0 01-1 1h-2a1 1 0 01-1-1v-6z" />
                  </svg>
                  <h3 className="mt-2 text-sm font-medium text-gray-900 dark:text-gray-100">No artifact selected</h3>
                  <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                    Select an artifact from the sidebar to start working
                  </p>
                </div>
              </div>
            )}
          </div>

          <InspectorPanel width={inspectorWidth} />
        </div>
      </div>
    </div>
  );
};

export default App;