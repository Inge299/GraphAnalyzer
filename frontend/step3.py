#!/usr/bin/env python3
"""
Setup script for OSINT Graph Analyzer frontend structure.
Creates all necessary files with the premium dark theme.
"""

import os
import subprocess
from pathlib import Path

# Base path for the project
BASE_PATH = Path("/Users/sra/projects/GraphAnalyzer/frontend")


def create_directory(path):
    """Create directory if it doesn't exist."""
    full_path = BASE_PATH / path
    full_path.mkdir(parents=True, exist_ok=True)
    print(f"✓ Created directory: {path}")


def write_file(filepath, content):
    """Write content to file."""
    full_path = BASE_PATH / filepath
    full_path.parent.mkdir(parents=True, exist_ok=True)

    with open(full_path, 'w', encoding='utf-8') as f:
        f.write(content)
    print(f"✓ Created file: {filepath}")


def create_store_index():
    """Create src/store/index.ts"""
    content = """// src/store/index.ts
import { configureStore } from '@reduxjs/toolkit';
import { useDispatch, useSelector, TypedUseSelectorHook } from 'react-redux';
import uiReducer from './slices/uiSlice';
import graphReducer from './slices/graphSlice';
import projectsReducer from './slices/projectsSlice';

export const store = configureStore({
  reducer: {
    ui: uiReducer,
    graph: graphReducer,
    projects: projectsReducer,
  },
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware({
      serializableCheck: {
        // Игнорируем non-serializable значения в graph (vis-network instance)
        ignoredActions: ['graph/setNetworkInstance'],
        ignoredPaths: ['graph.networkInstance'],
      },
    }),
  devTools: process.env.NODE_ENV !== 'production',
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;
export const useAppDispatch: () => AppDispatch = useDispatch;
export const useAppSelector: TypedUseSelectorHook<RootState> = useSelector;
"""
    write_file("src/store/index.ts", content)


def create_ui_slice():
    """Create src/store/slices/uiSlice.ts"""
    content = """// src/store/slices/uiSlice.ts
import { createSlice, PayloadAction } from '@reduxjs/toolkit';

export type ViewType = 'graph' | 'map' | 'table' | 'text' | 'stats';

interface UIState {
  activeView: ViewType;
  selectedNodeId: string | null;
  selectedEdgeId: string | null;
  selectedProjectId: number | null;
  selectedGraphId: number | null;
  inspectorExpanded: boolean;
  sidebarExpanded: boolean;
}

const initialState: UIState = {
  activeView: 'graph',
  selectedNodeId: null,
  selectedEdgeId: null,
  selectedProjectId: null,
  selectedGraphId: null,
  inspectorExpanded: true,
  sidebarExpanded: true,
};

const uiSlice = createSlice({
  name: 'ui',
  initialState,
  reducers: {
    setActiveView: (state, action: PayloadAction<ViewType>) => {
      state.activeView = action.payload;
    },
    setSelectedNode: (state, action: PayloadAction<string | null>) => {
      state.selectedNodeId = action.payload;
      state.selectedEdgeId = null;
    },
    setSelectedEdge: (state, action: PayloadAction<string | null>) => {
      state.selectedEdgeId = action.payload;
      state.selectedNodeId = null;
    },
    setSelectedProject: (state, action: PayloadAction<number | null>) => {
      state.selectedProjectId = action.payload;
      if (action.payload === null) {
        state.selectedGraphId = null;
      }
    },
    setSelectedGraph: (state, action: PayloadAction<number | null>) => {
      state.selectedGraphId = action.payload;
    },
    toggleInspector: (state) => {
      state.inspectorExpanded = !state.inspectorExpanded;
    },
    toggleSidebar: (state) => {
      state.sidebarExpanded = !state.sidebarExpanded;
    },
  },
});

export const {
  setActiveView,
  setSelectedNode,
  setSelectedEdge,
  setSelectedProject,
  setSelectedGraph,
  toggleInspector,
  toggleSidebar,
} = uiSlice.actions;
export default uiSlice.reducer;
"""
    write_file("src/store/slices/uiSlice.ts", content)


def create_graph_slice():
    """Create src/store/slices/graphSlice.ts"""
    content = """// src/store/slices/graphSlice.ts
import { createSlice, PayloadAction } from '@reduxjs/toolkit';

export interface Node {
  id: string;
  label?: string;
  type: string;
  attributes: Record<string, any>;
  x?: number;
  y?: number;
}

export interface Edge {
  id: string;
  from: string;
  to: string;
  type: string;
  attributes: Record<string, any>;
}

interface GraphState {
  nodes: Node[];
  edges: Edge[];
  isLoading: boolean;
  error: string | null;
  networkInstance: any | null;
  lastSaved: Date | null;
}

const initialState: GraphState = {
  nodes: [],
  edges: [],
  isLoading: false,
  error: null,
  networkInstance: null,
  lastSaved: null,
};

const graphSlice = createSlice({
  name: 'graph',
  initialState,
  reducers: {
    setGraphData: (state, action: PayloadAction<{ nodes: Node[]; edges: Edge[] }>) => {
      state.nodes = action.payload.nodes;
      state.edges = action.payload.edges;
    },
    addNode: (state, action: PayloadAction<Node>) => {
      state.nodes.push(action.payload);
    },
    updateNode: (state, action: PayloadAction<{ id: string; updates: Partial<Node> }>) => {
      const index = state.nodes.findIndex(n => n.id === action.payload.id);
      if (index !== -1) {
        state.nodes[index] = { ...state.nodes[index], ...action.payload.updates };
      }
    },
    deleteNode: (state, action: PayloadAction<string>) => {
      state.nodes = state.nodes.filter(n => n.id !== action.payload);
      state.edges = state.edges.filter(e => e.from !== action.payload && e.to !== action.payload);
    },
    addEdge: (state, action: PayloadAction<Edge>) => {
      state.edges.push(action.payload);
    },
    deleteEdge: (state, action: PayloadAction<string>) => {
      state.edges = state.edges.filter(e => e.id !== action.payload);
    },
    setLoading: (state, action: PayloadAction<boolean>) => {
      state.isLoading = action.payload;
    },
    setError: (state, action: PayloadAction<string | null>) => {
      state.error = action.payload;
    },
    setNetworkInstance: (state, action: PayloadAction<any>) => {
      state.networkInstance = action.payload;
    },
    setLastSaved: (state, action: PayloadAction<Date>) => {
      state.lastSaved = action.payload;
    },
    clearGraph: (state) => {
      state.nodes = [];
      state.edges = [];
      state.error = null;
    },
  },
});

export const {
  setGraphData,
  addNode,
  updateNode,
  deleteNode,
  addEdge,
  deleteEdge,
  setLoading,
  setError,
  setNetworkInstance,
  setLastSaved,
  clearGraph,
} = graphSlice.actions;
export default graphSlice.reducer;
"""
    write_file("src/store/slices/graphSlice.ts", content)


def create_projects_slice():
    """Create src/store/slices/projectsSlice.ts"""
    content = """// src/store/slices/projectsSlice.ts
import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit';
import { api } from '../services/api';

interface Project {
  id: number;
  name: string;
  description?: string;
  created_at: string;
  updated_at: string;
}

interface Graph {
  id: number;
  project_id: number;
  name: string;
  description?: string;
  version: number;
  created_at: string;
  updated_at: string;
}

interface ProjectsState {
  projects: Project[];
  graphs: Record<number, Graph[]>;
  currentProject: Project | null;
  currentGraph: Graph | null;
  isLoading: boolean;
  error: string | null;
}

const initialState: ProjectsState = {
  projects: [],
  graphs: {},
  currentProject: null,
  currentGraph: null,
  isLoading: false,
  error: null,
};

// Async thunks
export const fetchProjects = createAsyncThunk('projects/fetchAll', async () => {
  const response = await api.get('/api/v1/projects');
  return response;
});

export const fetchGraphs = createAsyncThunk(
  'projects/fetchGraphs',
  async (projectId: number) => {
    const response = await api.get(`/api/v1/projects/${projectId}/graphs`);
    return { projectId, graphs: response };
  }
);

export const createProject = createAsyncThunk(
  'projects/create',
  async (name: string) => {
    const response = await api.post('/api/v1/projects', { name });
    return response;
  }
);

export const createGraph = createAsyncThunk(
  'projects/createGraph',
  async ({ projectId, name }: { projectId: number; name: string }) => {
    const response = await api.post(`/api/v1/projects/${projectId}/graphs`, { name });
    return { projectId, graph: response };
  }
);

const projectsSlice = createSlice({
  name: 'projects',
  initialState,
  reducers: {
    setCurrentProject: (state, action: PayloadAction<Project | null>) => {
      state.currentProject = action.payload;
    },
    setCurrentGraph: (state, action: PayloadAction<Graph | null>) => {
      state.currentGraph = action.payload;
    },
  },
  extraReducers: (builder) => {
    builder
      // fetchProjects
      .addCase(fetchProjects.pending, (state) => {
        state.isLoading = true;
      })
      .addCase(fetchProjects.fulfilled, (state, action) => {
        state.isLoading = false;
        state.projects = action.payload;
      })
      .addCase(fetchProjects.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.error.message || 'Failed to fetch projects';
      })
      // fetchGraphs
      .addCase(fetchGraphs.fulfilled, (state, action) => {
        state.graphs[action.payload.projectId] = action.payload.graphs;
      })
      // createProject
      .addCase(createProject.fulfilled, (state, action) => {
        state.projects.push(action.payload);
      })
      // createGraph
      .addCase(createGraph.fulfilled, (state, action) => {
        const { projectId, graph } = action.payload;
        if (!state.graphs[projectId]) {
          state.graphs[projectId] = [];
        }
        state.graphs[projectId].push(graph);
      });
  },
});

export const { setCurrentProject, setCurrentGraph } = projectsSlice.actions;
export default projectsSlice.reducer;
"""
    write_file("src/store/slices/projectsSlice.ts", content)


def create_tab_bar():
    """Create src/components/layout/TabBar.tsx"""
    content = """// src/components/layout/TabBar.tsx
import React from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { 
  faProjectDiagram, 
  faMap, 
  faTable, 
  faFileAlt, 
  faChartBar 
} from '@fortawesome/free-solid-svg-icons';
import { useAppDispatch, useAppSelector } from '../../store';
import { setActiveView, ViewType } from '../../store/slices/uiSlice';

interface Tab {
  id: ViewType;
  label: string;
  icon: any;
}

const tabs: Tab[] = [
  { id: 'graph', label: 'Граф', icon: faProjectDiagram },
  { id: 'map', label: 'Карта', icon: faMap },
  { id: 'table', label: 'Таблица', icon: faTable },
  { id: 'text', label: 'Текст', icon: faFileAlt },
  { id: 'stats', label: 'Статистика', icon: faChartBar },
];

export const TabBar: React.FC = () => {
  const dispatch = useAppDispatch();
  const activeView = useAppSelector((state) => state.ui.activeView);

  return (
    <div style={styles.container}>
      {tabs.map((tab) => (
        <button
          key={tab.id}
          onClick={() => dispatch(setActiveView(tab.id))}
          style={{
            ...styles.tab,
            ...(activeView === tab.id ? styles.activeTab : {}),
          }}
          className={activeView === tab.id ? 'active-tab' : ''}
        >
          <FontAwesomeIcon icon={tab.icon} style={styles.icon} />
          <span style={styles.label}>{tab.label}</span>
          {activeView === tab.id && <div style={styles.activeIndicator} />}
        </button>
      ))}
    </div>
  );
};

const styles = {
  container: {
    display: 'flex',
    gap: '4px',
    padding: '8px 16px',
    backgroundColor: 'var(--bg-secondary)',
    borderBottom: '1px solid var(--border-light)',
  },
  tab: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    padding: '8px 16px',
    border: 'none',
    borderRadius: '8px',
    backgroundColor: 'transparent',
    cursor: 'pointer',
    fontSize: '14px',
    fontWeight: 500,
    color: 'var(--text-secondary)',
    transition: 'all var(--transition-base)',
    position: 'relative' as const,
    ':hover': {
      color: 'var(--text-primary)',
      backgroundColor: 'var(--bg-tertiary)',
    },
  },
  activeTab: {
    color: 'var(--accent-primary)',
    background: 'linear-gradient(135deg, var(--accent-primary) 0%, #7C3AED 100%)',
    backgroundClip: 'text',
    WebkitBackgroundClip: 'text',
    WebkitTextFillColor: 'transparent',
    fontWeight: 600,
  },
  icon: {
    fontSize: '18px',
  },
  label: {
    '@media (max-width: 768px)': {
      display: 'none',
    },
  },
  activeIndicator: {
    position: 'absolute' as const,
    bottom: '-8px',
    left: 0,
    right: 0,
    height: '2px',
    background: 'var(--gradient-primary)',
    borderRadius: '2px',
    animation: 'slideIn var(--transition-base)',
  },
} as const;
"""
    write_file("src/components/layout/TabBar.tsx", content)


def create_sidebar():
    """Create src/components/layout/Sidebar.tsx"""
    content = """// src/components/layout/Sidebar.tsx
import React, { useEffect } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { 
  faFolder, 
  faProjectDiagram, 
  faPlus, 
  faChevronLeft, 
  faChevronRight,
  faSpinner
} from '@fortawesome/free-solid-svg-icons';
import { useAppDispatch, useAppSelector } from '../../store';
import {
  fetchProjects,
  fetchGraphs,
  createProject,
  createGraph,
  setCurrentProject,
  setCurrentGraph,
} from '../../store/slices/projectsSlice';
import { toggleSidebar } from '../../store/slices/uiSlice';

export const Sidebar: React.FC = () => {
  const dispatch = useAppDispatch();
  const expanded = useAppSelector((state) => state.ui.sidebarExpanded);
  const { projects, graphs, currentProject, currentGraph, isLoading } = useAppSelector(
    (state) => state.projects
  );

  useEffect(() => {
    dispatch(fetchProjects());
  }, [dispatch]);

  const handleProjectClick = (project: any) => {
    dispatch(setCurrentProject(project));
    dispatch(fetchGraphs(project.id));
  };

  const handleGraphClick = (graph: any) => {
    dispatch(setCurrentGraph(graph));
  };

  const handleCreateProject = async () => {
    const name = prompt('Введите название проекта:');
    if (name) {
      await dispatch(createProject(name));
      dispatch(fetchProjects());
    }
  };

  const handleCreateGraph = async () => {
    if (!currentProject) {
      alert('Сначала выберите проект');
      return;
    }
    const name = prompt('Введите название графа:');
    if (name) {
      await dispatch(createGraph({ projectId: currentProject.id, name }));
      dispatch(fetchGraphs(currentProject.id));
    }
  };

  if (!expanded) {
    return (
      <div style={styles.collapsed}>
        <button onClick={() => dispatch(toggleSidebar())} style={styles.toggleButton}>
          <FontAwesomeIcon icon={faChevronRight} />
        </button>
      </div>
    );
  }

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <h3 style={styles.title}>
          <FontAwesomeIcon icon={faFolder} style={styles.headerIcon} />
          Проекты
        </h3>
        <button onClick={() => dispatch(toggleSidebar())} style={styles.toggleButton}>
          <FontAwesomeIcon icon={faChevronLeft} />
        </button>
      </div>

      <button onClick={handleCreateProject} style={styles.createButton}>
        <FontAwesomeIcon icon={faPlus} />
        Новый проект
      </button>

      {isLoading ? (
        <div style={styles.loading}>
          <FontAwesomeIcon icon={faSpinner} spin style={styles.spinner} />
          <span>Загрузка...</span>
        </div>
      ) : (
        <div style={styles.projectList}>
          {projects.map((project) => (
            <div key={project.id}>
              <div
                onClick={() => handleProjectClick(project)}
                style={{
                  ...styles.projectItem,
                  ...(currentProject?.id === project.id ? styles.selectedProject : {}),
                }}
              >
                <FontAwesomeIcon icon={faFolder} style={styles.projectIcon} />
                {project.name}
              </div>

              {currentProject?.id === project.id && (
                <div style={styles.graphList}>
                  <button onClick={handleCreateGraph} style={styles.createGraphButton}>
                    <FontAwesomeIcon icon={faPlus} style={styles.smallIcon} />
                    Новый граф
                  </button>
                  {graphs[project.id]?.map((graph) => (
                    <div
                      key={graph.id}
                      onClick={() => handleGraphClick(graph)}
                      style={{
                        ...styles.graphItem,
                        ...(currentGraph?.id === graph.id ? styles.selectedGraph : {}),
                      }}
                    >
                      <FontAwesomeIcon icon={faProjectDiagram} style={styles.graphIcon} />
                      {graph.name}
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

const styles = {
  container: {
    width: '280px',
    height: '100%',
    backgroundColor: 'var(--bg-secondary)',
    borderRight: '1px solid var(--border-light)',
    display: 'flex',
    flexDirection: 'column' as const,
    boxShadow: 'var(--shadow-md)',
    animation: 'slideIn var(--transition-base)',
  },
  collapsed: {
    width: '48px',
    height: '100%',
    backgroundColor: 'var(--bg-secondary)',
    borderRight: '1px solid var(--border-light)',
    display: 'flex',
    justifyContent: 'center',
    paddingTop: '12px',
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '16px',
    borderBottom: '1px solid var(--border-light)',
  },
  headerIcon: {
    color: 'var(--accent-primary)',
    marginRight: '8px',
  },
  title: {
    margin: 0,
    fontSize: '16px',
    fontWeight: 600,
    color: 'var(--text-primary)',
  },
  toggleButton: {
    padding: '8px',
    border: 'none',
    backgroundColor: 'var(--bg-tertiary)',
    color: 'var(--text-secondary)',
    borderRadius: '6px',
    cursor: 'pointer',
    fontSize: '14px',
    transition: 'all var(--transition-fast)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    ':hover': {
      color: 'var(--text-primary)',
      backgroundColor: 'var(--border-light)',
    },
  },
  createButton: {
    margin: '16px',
    padding: '10px 16px',
    background: 'var(--gradient-primary)',
    color: 'white',
    border: 'none',
    borderRadius: '8px',
    cursor: 'pointer',
    fontSize: '14px',
    fontWeight: 500,
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    transition: 'all var(--transition-base)',
    boxShadow: 'var(--shadow-sm)',
    ':hover': {
      transform: 'scale(1.02)',
      boxShadow: 'var(--shadow-glow)',
    },
  },
  projectList: {
    flex: 1,
    overflowY: 'auto' as const,
    padding: '0 8px',
  },
  projectItem: {
    padding: '10px 12px',
    margin: '4px 0',
    borderRadius: '6px',
    cursor: 'pointer',
    fontSize: '14px',
    color: 'var(--text-secondary)',
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    transition: 'all var(--transition-fast)',
    ':hover': {
      backgroundColor: 'var(--bg-tertiary)',
      color: 'var(--text-primary)',
    },
  },
  projectIcon: {
    color: 'var(--accent-primary)',
    fontSize: '14px',
  },
  selectedProject: {
    backgroundColor: 'var(--bg-tertiary)',
    color: 'var(--text-primary)',
    borderLeft: '2px solid var(--accent-primary)',
  },
  graphList: {
    marginLeft: '20px',
    marginBottom: '8px',
    animation: 'slideIn var(--transition-fast)',
  },
  graphItem: {
    padding: '8px 12px',
    margin: '2px 0',
    borderRadius: '6px',
    cursor: 'pointer',
    fontSize: '13px',
    color: 'var(--text-secondary)',
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    transition: 'all var(--transition-fast)',
    ':hover': {
      backgroundColor: 'var(--bg-tertiary)',
      color: 'var(--text-primary)',
    },
  },
  graphIcon: {
    color: 'var(--accent-success)',
    fontSize: '12px',
  },
  selectedGraph: {
    backgroundColor: 'var(--bg-tertiary)',
    color: 'var(--accent-success)',
    borderLeft: '2px solid var(--accent-success)',
  },
  createGraphButton: {
    margin: '8px 0',
    padding: '6px 12px',
    backgroundColor: 'transparent',
    border: '1px dashed var(--border-light)',
    color: 'var(--text-secondary)',
    borderRadius: '6px',
    cursor: 'pointer',
    fontSize: '12px',
    width: '100%',
    display: 'flex',
    alignItems: 'center',
    gap: '4px',
    transition: 'all var(--transition-fast)',
    ':hover': {
      borderColor: 'var(--accent-primary)',
      color: 'var(--accent-primary)',
      backgroundColor: 'var(--bg-tertiary)',
    },
  },
  smallIcon: {
    fontSize: '10px',
  },
  loading: {
    padding: '20px',
    textAlign: 'center' as const,
    color: 'var(--text-secondary)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '8px',
  },
  spinner: {
    color: 'var(--accent-primary)',
  },
} as const;
"""
    write_file("src/components/layout/Sidebar.tsx", content)


def create_inspector_panel():
    """Create src/components/layout/InspectorPanel.tsx"""
    content = """// src/components/layout/InspectorPanel.tsx
import React from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { 
  faChevronLeft, 
  faChevronRight,
  faUser,
  faPhone,
  faEnvelope,
  faMapMarkerAlt,
  faCircle
} from '@fortawesome/free-solid-svg-icons';
import { useAppDispatch, useAppSelector } from '../../store';
import { toggleInspector } from '../../store/slices/uiSlice';

const getNodeIcon = (type: string) => {
  const icons: Record<string, any> = {
    person: faUser,
    phone: faPhone,
    message: faEnvelope,
    location: faMapMarkerAlt,
    default: faCircle
  };
  return icons[type] || icons.default;
};

const getNodeColor = (type: string) => {
  const colors: Record<string, string> = {
    person: '#4F46E5',
    phone: '#10B981',
    message: '#F59E0B',
    location: '#EF4444',
    default: '#94A3B8'
  };
  return colors[type] || colors.default;
};

export const InspectorPanel: React.FC = () => {
  const dispatch = useAppDispatch();
  const expanded = useAppSelector((state) => state.ui.inspectorExpanded);
  const selectedNodeId = useAppSelector((state) => state.ui.selectedNodeId);
  const selectedEdgeId = useAppSelector((state) => state.ui.selectedEdgeId);
  const nodes = useAppSelector((state) => state.graph.nodes);
  const edges = useAppSelector((state) => state.graph.edges);

  const selectedObject = selectedNodeId
    ? nodes.find((n) => n.id === selectedNodeId)
    : selectedEdgeId
    ? edges.find((e) => e.id === selectedEdgeId)
    : null;

  if (!expanded) {
    return (
      <div style={styles.collapsed}>
        <button onClick={() => dispatch(toggleInspector())} style={styles.toggleButton}>
          <FontAwesomeIcon icon={faChevronLeft} />
        </button>
      </div>
    );
  }

  const renderNodeDetails = (node: any) => (
    <div>
      <div style={styles.objectHeader}>
        <div style={styles.objectTitle}>
          <FontAwesomeIcon 
            icon={getNodeIcon(node.type)} 
            style={{ ...styles.objectIcon, color: getNodeColor(node.type) }} 
          />
          <strong>{node.type === 'person' ? 'Узел' : 'Сущность'}</strong>
        </div>
        <span style={styles.objectId}>{node.id}</span>
      </div>

      <div style={styles.section}>
        <h4 style={styles.sectionTitle}>Тип</h4>
        <div style={styles.type}>
          <FontAwesomeIcon 
            icon={getNodeIcon(node.type)} 
            style={{ ...styles.typeIcon, color: getNodeColor(node.type) }} 
          />
          {node.type}
        </div>
      </div>

      <div style={styles.section}>
        <h4 style={styles.sectionTitle}>Атрибуты</h4>
        {Object.entries(node.attributes || {}).map(([key, value]) => (
          <div key={key} style={styles.attribute}>
            <span style={styles.attributeKey}>{key}:</span>
            <span style={styles.attributeValue}>
              {typeof value === 'object' ? JSON.stringify(value) : String(value)}
            </span>
          </div>
        ))}
      </div>
    </div>
  );

  const renderEdgeDetails = (edge: any) => (
    <div>
      <div style={styles.objectHeader}>
        <div style={styles.objectTitle}>
          <FontAwesomeIcon icon={faCircle} style={styles.objectIcon} />
          <strong>Ребро</strong>
        </div>
        <span style={styles.objectId}>{edge.id}</span>
      </div>

      <div style={styles.section}>
        <h4 style={styles.sectionTitle}>Связь</h4>
        <div style={styles.edgeInfo}>
          <div style={styles.edgeNode}>{edge.from} → {edge.to}</div>
          <div style={styles.edgeType}>{edge.type}</div>
        </div>
      </div>

      <div style={styles.section}>
        <h4 style={styles.sectionTitle}>Атрибуты</h4>
        {Object.entries(edge.attributes || {}).map(([key, value]) => (
          <div key={key} style={styles.attribute}>
            <span style={styles.attributeKey}>{key}:</span>
            <span style={styles.attributeValue}>
              {typeof value === 'object' ? JSON.stringify(value) : String(value)}
            </span>
          </div>
        ))}
      </div>
    </div>
  );

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <h4 style={styles.title}>
          Свойства
          {selectedObject && (
            <span style={styles.titleBadge}>
              {selectedNodeId ? 'Узел' : 'Ребро'}
            </span>
          )}
        </h4>
        <button onClick={() => dispatch(toggleInspector())} style={styles.toggleButton}>
          <FontAwesomeIcon icon={faChevronRight} />
        </button>
      </div>

      <div style={styles.content}>
        {!selectedObject ? (
          <div style={styles.placeholder}>
            <FontAwesomeIcon icon={faCircle} style={styles.placeholderIcon} />
            <p>Выберите узел или ребро для просмотра свойств</p>
          </div>
        ) : (
          selectedNodeId ? renderNodeDetails(selectedObject) : renderEdgeDetails(selectedObject)
        )}
      </div>
    </div>
  );
};

const styles = {
  container: {
    width: '320px',
    height: '100%',
    backgroundColor: 'var(--bg-secondary)',
    borderLeft: '1px solid var(--border-light)',
    display: 'flex',
    flexDirection: 'column' as const,
    boxShadow: 'var(--shadow-md)',
    animation: 'slideIn var(--transition-base)',
  },
  collapsed: {
    width: '48px',
    height: '100%',
    backgroundColor: 'var(--bg-secondary)',
    borderLeft: '1px solid var(--border-light)',
    display: 'flex',
    justifyContent: 'center',
    paddingTop: '12px',
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '12px 16px',
    borderBottom: '1px solid var(--border-light)',
  },
  title: {
    margin: 0,
    fontSize: '14px',
    fontWeight: 600,
    color: 'var(--text-primary)',
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
  },
  titleBadge: {
    padding: '2px 8px',
    backgroundColor: 'var(--bg-tertiary)',
    borderRadius: '12px',
    fontSize: '11px',
    fontWeight: 500,
    color: 'var(--text-secondary)',
  },
  toggleButton: {
    padding: '8px',
    border: 'none',
    backgroundColor: 'var(--bg-tertiary)',
    color: 'var(--text-secondary)',
    borderRadius: '6px',
    cursor: 'pointer',
    fontSize: '14px',
    transition: 'all var(--transition-fast)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    ':hover': {
      color: 'var(--text-primary)',
      backgroundColor: 'var(--border-light)',
    },
  },
  content: {
    flex: 1,
    overflowY: 'auto' as const,
    padding: '16px',
  },
  placeholder: {
    color: 'var(--text-secondary)',
    textAlign: 'center' as const,
    padding: '32px 16px',
    display: 'flex',
    flexDirection: 'column' as const,
    alignItems: 'center',
    gap: '12px',
  },
  placeholderIcon: {
    fontSize: '32px',
    color: 'var(--border-light)',
  },
  objectHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '16px',
    padding: '8px 12px',
    backgroundColor: 'var(--bg-tertiary)',
    borderRadius: '8px',
  },
  objectTitle: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    color: 'var(--text-primary)',
  },
  objectIcon: {
    fontSize: '14px',
  },
  objectId: {
    fontSize: '11px',
    color: 'var(--text-disabled)',
    fontFamily: 'JetBrains Mono, monospace',
  },
  section: {
    marginBottom: '20px',
  },
  sectionTitle: {
    fontSize: '12px',
    fontWeight: 600,
    color: 'var(--text-secondary)',
    textTransform: 'uppercase' as const,
    letterSpacing: '0.05em',
    marginBottom: '8px',
  },
  type: {
    padding: '8px 12px',
    backgroundColor: 'var(--bg-tertiary)',
    border: '1px solid var(--border-light)',
    borderRadius: '6px',
    fontSize: '13px',
    color: 'var(--text-primary)',
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
  },
  typeIcon: {
    fontSize: '12px',
  },
  attribute: {
    display: 'flex',
    marginBottom: '4px',
    padding: '6px 8px',
    fontSize: '13px',
    backgroundColor: 'var(--bg-primary)',
    borderRadius: '4px',
    transition: 'all var(--transition-fast)',
    ':hover': {
      backgroundColor: 'var(--bg-tertiary)',
    },
  },
  attributeKey: {
    width: '100px',
    color: 'var(--text-secondary)',
    fontSize: '12px',
  },
  attributeValue: {
    flex: 1,
    color: 'var(--text-primary)',
    wordBreak: 'break-word' as const,
    fontFamily: 'JetBrains Mono, monospace',
    fontSize: '12px',
  },
  edgeInfo: {
    padding: '8px 12px',
    backgroundColor: 'var(--bg-tertiary)',
    border: '1px solid var(--border-light)',
    borderRadius: '6px',
  },
  edgeNode: {
    color: 'var(--text-primary)',
    fontSize: '13px',
    marginBottom: '4px',
  },
  edgeType: {
    color: 'var(--accent-primary)',
    fontSize: '12px',
    fontWeight: 500,
  },
} as const;
"""
    write_file("src/components/layout/InspectorPanel.tsx", content)


def create_graph_view():
    """Create src/components/views/GraphView.tsx"""
    content = """// src/components/views/GraphView.tsx
import React, { useEffect, useRef, useState } from 'react';
import { Network, DataSet } from 'vis-network/standalone';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faSpinner } from '@fortawesome/free-solid-svg-icons';
import { useAppDispatch, useAppSelector } from '../../store';
import { setGraphData, setNetworkInstance, setLoading, setError } from '../../store/slices/graphSlice';
import { setSelectedNode, setSelectedEdge } from '../../store/slices/uiSlice';

interface GraphViewProps {
  graphId?: number;
}

const nodeStyles = {
  color: {
    border: '#4F46E5',
    background: '#1E293B',
    highlight: {
      border: '#7C3AED',
      background: '#2D3A4F'
    },
    hover: {
      border: '#4F46E5',
      background: '#2D3A4F'
    }
  },
  font: {
    color: '#F1F5F9',
    size: 14,
    face: 'Inter, system-ui, sans-serif',
    strokeWidth: 2,
    strokeColor: '#0B1120'
  },
  shadow: {
    enabled: true,
    color: 'rgba(0,0,0,0.5)',
    size: 10,
    x: 0,
    y: 4
  },
  shape: 'dot',
  size: 25,
  borderWidth: 2,
  borderWidthSelected: 3
};

const edgeStyles = {
  color: {
    color: '#4F46E5',
    highlight: '#7C3AED',
    hover: '#4F46E5',
    opacity: 0.8
  },
  font: {
    color: '#94A3B8',
    size: 11,
    face: 'Inter, system-ui, sans-serif',
    background: '#1E293B',
    strokeWidth: 0
  },
  width: 2,
  widthSelected: 3,
  smooth: {
    type: 'continuous',
    forceDirection: 'none',
    roundness: 0.5
  },
  arrows: {
    to: {
      enabled: true,
      scaleFactor: 1,
      type: 'arrow'
    }
  }
};

export const GraphView: React.FC<GraphViewProps> = ({ graphId }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const networkRef = useRef<Network | null>(null);
  const dispatch = useAppDispatch();

  const nodes = useAppSelector((state) => state.graph.nodes);
  const edges = useAppSelector((state) => state.graph.edges);
  const isLoading = useAppSelector((state) => state.graph.isLoading);
  const selectedNodeId = useAppSelector((state) => state.ui.selectedNodeId);
  const selectedEdgeId = useAppSelector((state) => state.ui.selectedEdgeId);
  const currentGraph = useAppSelector((state) => state.projects.currentGraph);

  // Инициализация vis-network
  useEffect(() => {
    if (!containerRef.current) return;

    const nodesDataSet = new DataSet(
      nodes.map((node) => ({
        id: node.id,
        label: node.attributes?.full_name || node.id,
        title: `Type: ${node.type}`,
        ...nodeStyles,
        color: getNodeColor(node.type),
        x: node.x,
        y: node.y,
      }))
    );

    const edgesDataSet = new DataSet(
      edges.map((edge) => ({
        id: edge.id,
        from: edge.from,
        to: edge.to,
        label: edge.type,
        title: `Type: ${edge.type}`,
        ...edgeStyles,
      }))
    );

    const options = {
      nodes: nodeStyles,
      edges: edgeStyles,
      physics: {
        enabled: nodes.length < 2000,
        stabilization: {
          enabled: true,
          iterations: 100,
        },
      },
      interaction: {
        hover: true,
        tooltipDelay: 200,
        hideEdgesOnDrag: true,
        hideEdgesOnZoom: true,
        navigationButtons: true,
        keyboard: true,
      },
      manipulation: {
        enabled: false,
      },
      layout: {
        improvedLayout: true,
        randomSeed: 42,
      },
    };

    const network = new Network(
      containerRef.current,
      { nodes: nodesDataSet, edges: edgesDataSet },
      options
    );

    networkRef.current = network;
    dispatch(setNetworkInstance(network));

    network.on('click', (params) => {
      if (params.nodes.length > 0) {
        dispatch(setSelectedNode(params.nodes[0]));
      } else if (params.edges.length > 0) {
        dispatch(setSelectedEdge(params.edges[0]));
      } else {
        dispatch(setSelectedNode(null));
        dispatch(setSelectedEdge(null));
      }
    });

    network.on('doubleClick', (params) => {
      if (params.nodes.length === 0 && params.edges.length === 0) {
        const position = network.getPointerOnCanvas(params.pointer.DOM);
        handleCreateNode(position);
      }
    });

    network.on('dragEnd', (params) => {
      if (params.nodes.length > 0) {
        const positions = network.getPositions(params.nodes);
        console.log('New positions:', positions);
      }
    });

    return () => {
      network.destroy();
      dispatch(setNetworkInstance(null));
    };
  }, []);

  // Обновление данных при изменении nodes/edges
  useEffect(() => {
    if (!networkRef.current) return;

    const nodesDataSet = new DataSet(
      nodes.map((node) => ({
        id: node.id,
        label: node.attributes?.full_name || node.id,
        title: `Type: ${node.type}`,
        ...nodeStyles,
        color: getNodeColor(node.type),
        x: node.x,
        y: node.y,
      }))
    );

    const edgesDataSet = new DataSet(
      edges.map((edge) => ({
        id: edge.id,
        from: edge.from,
        to: edge.to,
        label: edge.type,
        title: `Type: ${edge.type}`,
        ...edgeStyles,
      }))
    );

    networkRef.current.setData({ nodes: nodesDataSet, edges: edgesDataSet });
  }, [nodes, edges]);

  // Выделение узла/ребра из store
  useEffect(() => {
    if (!networkRef.current) return;

    if (selectedNodeId) {
      networkRef.current.selectNodes([selectedNodeId]);
    } else if (selectedEdgeId) {
      networkRef.current.selectEdges([selectedEdgeId]);
    } else {
      networkRef.current.unselectAll();
    }
  }, [selectedNodeId, selectedEdgeId]);

  // Загрузка данных при смене графа
  useEffect(() => {
    if (!graphId && !currentGraph?.id) return;

    const loadGraphData = async (id: number) => {
      dispatch(setLoading(true));
      try {
        // Временные данные для тестирования
        setTimeout(() => {
          const mockNodes = [
            { id: '1', type: 'person', attributes: { full_name: 'Иван Петров', age: 35, city: 'Москва' }, x: 100, y: 100 },
            { id: '2', type: 'person', attributes: { full_name: 'Мария Сидорова', age: 32, city: 'СПб' }, x: 300, y: 100 },
            { id: '3', type: 'phone', attributes: { number: '+79161234567', operator: 'МТС' }, x: 200, y: 300 },
            { id: '4', type: 'location', attributes: { address: 'ул. Тверская, 1', city: 'Москва' }, x: 400, y: 300 },
          ];
          const mockEdges = [
            { id: 'e1', from: '1', to: '2', type: 'knows', attributes: { since: '2020' } },
            { id: 'e2', from: '1', to: '3', type: 'uses', attributes: { frequency: 'daily' } },
            { id: 'e3', from: '2', to: '3', type: 'uses', attributes: { frequency: 'weekly' } },
            { id: 'e4', from: '1', to: '4', type: 'visited', attributes: { last: '2024-01-15' } },
          ];
          dispatch(setGraphData({ nodes: mockNodes, edges: mockEdges }));
          dispatch(setLoading(false));
        }, 1000);
      } catch (error) {
        dispatch(setError(error instanceof Error ? error.message : 'Failed to load graph'));
        dispatch(setLoading(false));
      }
    };

    loadGraphData(graphId || currentGraph!.id);
  }, [graphId, currentGraph?.id]);

  const handleCreateNode = (position: { x: number; y: number }) => {
    console.log('Create node at:', position);
  };

  const getNodeColor = (type: string): any => {
    const colors: Record<string, any> = {
      person: {
        border: '#4F46E5',
        background: '#1E293B',
        highlight: { border: '#7C3AED', background: '#2D3A4F' },
        hover: { border: '#4F46E5', background: '#2D3A4F' }
      },
      phone: {
        border: '#10B981',
        background: '#1E293B',
        highlight: { border: '#34D399', background: '#2D3A4F' },
        hover: { border: '#10B981', background: '#2D3A4F' }
      },
      message: {
        border: '#F59E0B',
        background: '#1E293B',
        highlight: { border: '#FBBF24', background: '#2D3A4F' },
        hover: { border: '#F59E0B', background: '#2D3A4F' }
      },
      location: {
        border: '#EF4444',
        background: '#1E293B',
        highlight: { border: '#F87171', background: '#2D3A4F' },
        hover: { border: '#EF4444', background: '#2D3A4F' }
      },
      default: {
        border: '#4F46E5',
        background: '#1E293B',
        highlight: { border: '#7C3AED', background: '#2D3A4F' },
        hover: { border: '#4F46E5', background: '#2D3A4F' }
      },
    };
    return colors[type] || colors.default;
  };

  return (
    <div style={styles.container}>
      {isLoading && (
        <div style={styles.loadingOverlay}>
          <div style={styles.spinner}>
            <FontAwesomeIcon icon={faSpinner} spin size="2x" />
          </div>
          <div style={styles.loadingText}>Загрузка графа...</div>
        </div>
      )}
      <div ref={containerRef} style={styles.graph} />
    </div>
  );
};

const styles = {
  container: {
    width: '100%',
    height: '100%',
    position: 'relative' as const,
    backgroundColor: 'var(--bg-primary)',
  },
  graph: {
    width: '100%',
    height: '100%',
    backgroundColor: 'var(--bg-primary)',
  },
  loadingOverlay: {
    position: 'absolute' as const,
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(11, 18, 32, 0.9)',
    backdropFilter: 'blur(8px)',
    display: 'flex',
    flexDirection: 'column' as const,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1000,
    gap: '16px',
    animation: 'pulse 2s infinite',
  },
  spinner: {
    color: 'var(--accent-primary)',
    filter: 'drop-shadow(var(--shadow-glow))',
  },
  loadingText: {
    color: 'var(--text-primary)',
    fontSize: '16px',
    fontWeight: 500,
  },
} as const;
"""
    write_file("src/components/views/GraphView.tsx", content)


def create_api_types():
    """Create src/types/api.ts"""
    content = """// src/types/api.ts
export interface ApiProject {
  id: number;
  name: string;
  description?: string;
  created_at: string;
  updated_at: string;
}

export interface ApiGraph {
  id: number;
  project_id: number;
  name: string;
  description?: string;
  version: number;
  created_at: string;
  updated_at: string;
}

export interface ApiNode {
  node_id: string;
  type: string;
  attributes: Record<string, any>;
  position_x?: number;
  position_y?: number;
}

export interface ApiEdge {
  edge_id: string;
  source_node: string;
  target_node: string;
  type: string;
  attributes: Record<string, any>;
}
"""
    write_file("src/types/api.ts", content)


def update_api_service():
    """Update src/services/api.ts with new methods"""
    content = """// src/services/api.ts
import { ApiProject, ApiGraph, ApiNode, ApiEdge } from '../types/api';

class ApiClient {
  private baseURL: string;

  constructor() {
    this.baseURL = 'http://192.168.4.12:8000';
  }

  async get(endpoint: string): Promise<any> {
    const response = await fetch(`${this.baseURL}${endpoint}`);
    if (!response.ok) {
      throw new Error(`API Error: ${response.statusText}`);
    }
    return response.json();
  }

  async post(endpoint: string, data: any): Promise<any> {
    const response = await fetch(`${this.baseURL}${endpoint}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(data),
    });
    if (!response.ok) {
      throw new Error(`API Error: ${response.statusText}`);
    }
    return response.json();
  }

  async patch(endpoint: string, data: any): Promise<any> {
    const response = await fetch(`${this.baseURL}${endpoint}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(data),
    });
    if (!response.ok) {
      throw new Error(`API Error: ${response.statusText}`);
    }
    return response.json();
  }

  // Graph methods
  async getGraphNodes(graphId: number): Promise<ApiNode[]> {
    return this.get(`/api/v1/graphs/${graphId}/nodes`);
  }

  async getGraphEdges(graphId: number): Promise<ApiEdge[]> {
    return this.get(`/api/v1/graphs/${graphId}/edges`);
  }

  async createNode(graphId: number, node: Partial<ApiNode>): Promise<ApiNode> {
    return this.post(`/api/v1/graphs/${graphId}/nodes`, node);
  }

  async updateNodePosition(graphId: number, nodeId: string, x: number, y: number): Promise<void> {
    return this.patch(`/api/v1/graphs/${graphId}/nodes/${nodeId}`, { position_x: x, position_y: y });
  }
}

export const api = new ApiClient();
"""
    write_file("src/services/api.ts", content)


def update_app():
    """Update src/App.tsx"""
    content = """// src/App.tsx
import React from 'react';
import { Provider } from 'react-redux';
import { store } from './store';
import { useAppSelector } from './store';
import { TabBar } from './components/layout/TabBar';
import { Sidebar } from './components/layout/Sidebar';
import { InspectorPanel } from './components/layout/InspectorPanel';
import { GraphView } from './components/views/GraphView';
import './App.css';

function AppContent() {
  const activeView = useAppSelector((state) => state.ui.activeView);

  const renderActiveView = () => {
    switch (activeView) {
      case 'graph':
        return <GraphView />;
      case 'map':
        return <div style={styles.placeholder}>Карта (в разработке)</div>;
      case 'table':
        return <div style={styles.placeholder}>Таблица (в разработке)</div>;
      case 'text':
        return <div style={styles.placeholder}>Текст (в разработке)</div>;
      case 'stats':
        return <div style={styles.placeholder}>Статистика (в разработке)</div>;
      default:
        return <GraphView />;
    }
  };

  return (
    <div style={styles.app}>
      <div style={styles.main}>
        <Sidebar />
        <div style={styles.content}>
          <TabBar />
          <div style={styles.viewContainer}>
            {renderActiveView()}
          </div>
        </div>
        <InspectorPanel />
      </div>
    </div>
  );
}

function App() {
  return (
    <Provider store={store}>
      <AppContent />
    </Provider>
  );
}

const styles = {
  app: {
    width: '100vw',
    height: '100vh',
    overflow: 'hidden' as const,
    backgroundColor: 'var(--bg-primary)',
  },
  main: {
    display: 'flex',
    width: '100%',
    height: '100%',
  },
  content: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column' as const,
    overflow: 'hidden' as const,
  },
  viewContainer: {
    flex: 1,
    overflow: 'hidden' as const,
    position: 'relative' as const,
  },
  placeholder: {
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    height: '100%',
    fontSize: '18px',
    color: 'var(--text-disabled)',
    backgroundColor: 'var(--bg-primary)',
  },
} as const;

export default App;
"""
    write_file("src/App.tsx", content)


def create_app_css():
    """Create src/App.css with theme variables"""
    content = """:root {
  /* Основные цвета */
  --bg-primary: #0B1120;
  --bg-secondary: #1E293B;
  --bg-tertiary: #2D3A4F;

  --text-primary: #F1F5F9;
  --text-secondary: #94A3B8;
  --text-disabled: #64748B;

  --border-light: #334155;
  --border-focus: #4F46E5;

  /* Акцентные цвета */
  --accent-primary: #4F46E5;
  --accent-success: #10B981;
  --accent-warning: #F59E0B;
  --accent-danger: #EF4444;

  /* Градиенты */
  --gradient-primary: linear-gradient(135deg, #4F46E5 0%, #7C3AED 100%);
  --gradient-success: linear-gradient(135deg, #10B981 0%, #34D399 100%);

  /* Тени */
  --shadow-sm: 0 4px 6px -1px rgba(0, 0, 0, 0.3);
  --shadow-md: 0 10px 15px -3px rgba(0, 0, 0, 0.4);
  --shadow-lg: 0 20px 25px -5px rgba(0, 0, 0, 0.5);
  --shadow-glow: 0 0 20px rgba(79, 70, 229, 0.3);

  /* Анимации */
  --transition-fast: 150ms cubic-bezier(0.4, 0, 0.2, 1);
  --transition-base: 250ms cubic-bezier(0.4, 0, 0.2, 1);
  --transition-slow: 350ms cubic-bezier(0.4, 0, 0.2, 1);
}

@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap');

* {
  box-sizing: border-box;
  margin: 0;
  padding: 0;
}

body {
  font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', 'Oxygen',
    'Ubuntu', 'Cantarell', 'Fira Sans', 'Droid Sans', 'Helvetica Neue',
    sans-serif;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
  background-color: var(--bg-primary);
  color: var(--text-primary);
}

code, pre, .attribute-value {
  font-family: 'JetBrains Mono', 'Fira Code', 'Courier New', monospace;
  font-size: 12px;
}

/* Анимации */
@keyframes spin {
  0% { transform: rotate(0deg); }
  100% { transform: rotate(360deg); }
}

@keyframes slideIn {
  from {
    transform: translateX(-20px);
    opacity: 0;
  }
  to {
    transform: translateX(0);
    opacity: 1;
  }
}

@keyframes pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.7; }
}

@keyframes glow {
  0%, 100% { box-shadow: var(--shadow-glow); }
  50% { box-shadow: 0 0 30px rgba(79, 70, 229, 0.5); }
}

/* Кастомные скроллбары */
::-webkit-scrollbar {
  width: 8px;
  height: 8px;
}

::-webkit-scrollbar-track {
  background: var(--bg-secondary);
}

::-webkit-scrollbar-thumb {
  background: var(--border-light);
  border-radius: 4px;
}

::-webkit-scrollbar-thumb:hover {
  background: var(--accent-primary);
}

/* Vis.js Network стили */
.vis-network {
  outline: none;
  background-color: var(--bg-primary);
}

.vis-tooltip {
  position: absolute;
  padding: 8px 12px;
  background-color: var(--bg-secondary) !important;
  color: var(--text-primary) !important;
  border: 1px solid var(--border-light) !important;
  border-radius: 6px !important;
  box-shadow: var(--shadow-md) !important;
  font-family: 'Inter', sans-serif !important;
  font-size: 12px !important;
  pointer-events: none;
  z-index: 1000;
}

.vis-navigation-buttons button {
  background-color: var(--bg-tertiary) !important;
  border: 1px solid var(--border-light) !important;
  border-radius: 6px !important;
  color: var(--text-primary) !important;
  width: 32px !important;
  height: 32px !important;
  cursor: pointer !important;
  transition: all var(--transition-fast) !important;
}

.vis-navigation-buttons button:hover {
  background-color: var(--accent-primary) !important;
  border-color: var(--accent-primary) !important;
  color: white !important;
}

/* Адаптивность */
@media (max-width: 1024px) {
  .sidebar { width: 240px; }
  .inspector { width: 280px; }
  .node-label { font-size: 12px; }
}

@media (max-width: 768px) {
  .sidebar { 
    position: absolute;
    z-index: 10;
    transform: translateX(-100%);
    transition: transform var(--transition-base);
  }
  .sidebar.open {
    transform: translateX(0);
  }
  .inspector { 
    position: absolute;
    right: 0;
    z-index: 10;
  }
  .tab-label { display: none; }
}
"""
    write_file("src/App.css", content)


def create_index_css():
    """Create src/index.css"""
    content = """body {
  margin: 0;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', 'Oxygen',
    'Ubuntu', 'Cantarell', 'Fira Sans', 'Droid Sans', 'Helvetica Neue',
    sans-serif;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
}

code {
  font-family: source-code-pro, Menlo, Monaco, Consolas, 'Courier New',
    monospace;
}
"""
    write_file("src/index.css", content)


def main():
    """Main function to create all files"""
    print("🚀 Setting up OSINT Graph Analyzer frontend structure...\n")

    # Create directories
    directories = [
        "src/store/slices",
        "src/components/layout",
        "src/components/views",
        "src/types",
        "src/services",
    ]

    for directory in directories:
        create_directory(directory)

    # Create all files
    create_store_index()
    create_ui_slice()
    create_graph_slice()
    create_projects_slice()
    create_tab_bar()
    create_sidebar()
    create_inspector_panel()
    create_graph_view()
    create_api_types()
    update_api_service()
    update_app()
    create_app_css()
    create_index_css()

    print("\n📦 Installing required packages...")
    try:
        # Change to frontend directory and install packages
        os.chdir(BASE_PATH)
        subprocess.run(["npm", "install", "vis-network@9.1.2"], check=True)
        subprocess.run(["npm", "install", "--save-dev", "@types/vis"], check=True)
        subprocess.run([
            "npm", "install",
            "@fortawesome/react-fontawesome",
            "@fortawesome/fontawesome-svg-core",
            "@fortawesome/free-solid-svg-icons",
            "@fortawesome/free-regular-svg-icons"
        ], check=True)
        print("✓ Packages installed successfully")
    except subprocess.CalledProcessError as e:
        print(f"⚠️  Failed to install packages: {e}")
        print(
            "Please run manually: npm install vis-network@9.1.2 @types/vis @fortawesome/react-fontawesome @fortawesome/fontawesome-svg-core @fortawesome/free-solid-svg-icons @fortawesome/free-regular-svg-icons")

    print("\n✨ Setup complete!")
    print("\n📋 Next steps:")
    print("1. cd frontend")
    print("2. npm run dev")
    print("3. Open http://localhost:5173")
    print("\n🎨 Features implemented:")
    print("✓ Premium dark theme with CSS variables")
    print("✓ Tab navigation with 5 views")
    print("✓ Project sidebar with create functionality")
    print("✓ Graph view with vis-network")
    print("✓ Inspector panel with property display")
    print("✓ FontAwesome icons integration")
    print("✓ Responsive design")
    print("✓ Custom scrollbars")
    print("✓ Animations and transitions")


if __name__ == "__main__":
    main()