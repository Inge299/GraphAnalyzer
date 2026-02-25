import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit';
import { api } from '../../services/api';

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
