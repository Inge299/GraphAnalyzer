// store/slices/projectsSlice.ts
import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit';
import { api } from '../../services/api';

export interface Project {
  id: number;
  name: string;
  description?: string;
  created_at: string;
  updated_at: string;
}

interface ProjectsState {
  projects: Project[];
  currentProject: Project | null;
  isLoading: boolean;
  error: string | null;
}

const initialState: ProjectsState = {
  projects: [],
  currentProject: null,
  isLoading: false,
  error: null,
};

export const fetchProjects = createAsyncThunk(
  'projects/fetchAll',
  async () => {
    console.log('[Projects] Fetching all projects');
    const response = await api.get('/api/v1/projects');
    return response;
  }
);

const projectsSlice = createSlice({
  name: 'projects',
  initialState,
  reducers: {
    setCurrentProject: (state, action: PayloadAction<number>) => {
      const project = state.projects.find(p => p.id === action.payload);
      if (project) {
        state.currentProject = project;
        console.log('[Projects] Current project set to:', project.id, project.name);
      } else {
        console.warn('[Projects] Project not found:', action.payload);
      }
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchProjects.pending, (state) => {
        state.isLoading = true;
      })
      .addCase(fetchProjects.fulfilled, (state, action) => {
        state.isLoading = false;
        state.projects = action.payload;
        console.log('[Projects] Loaded projects:', action.payload.length);
      })
      .addCase(fetchProjects.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.error.message || 'Failed to fetch projects';
      });
  },
});

export const { setCurrentProject } = projectsSlice.actions;
export default projectsSlice.reducer;