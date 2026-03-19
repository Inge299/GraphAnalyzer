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
  async (_, { rejectWithValue }) => {
    try {
      console.log('[Projects] Fetching all projects');
      const response = await api.get('/api/v1/projects');
      console.log('[Projects] Response:', {
        status: response.status,
        dataType: typeof response.data,
        isArray: Array.isArray(response.data),
        data: response.data
      });
      
      // Убедимся, что возвращаем массив
      const projects = Array.isArray(response.data) ? response.data : [];
      return projects;  // Возвращаем сам массив, а не response
      
    } catch (error: any) {
      console.error('[Projects] Fetch error:', error);
      return rejectWithValue(error.message);
    }
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
        state.error = null;
        console.log('[Projects] Fetch pending');
      })
      .addCase(fetchProjects.fulfilled, (state, action) => {
        state.isLoading = false;
        // action.payload - это уже массив проектов
        state.projects = action.payload;
        console.log('[Projects] Loaded projects:', state.projects.length);
        
        // Если есть сохраненный проект, проверяем что он все еще существует
        if (state.currentProject) {
          const stillExists = state.projects.some(p => p.id === state.currentProject?.id);
          if (!stillExists) {
            state.currentProject = null;
            console.log('[Projects] Current project no longer exists, cleared');
          }
        }
      })
      .addCase(fetchProjects.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload as string || 'Failed to fetch projects';
        console.error('[Projects] Fetch rejected:', state.error);
      });
  },
});

export const { setCurrentProject } = projectsSlice.actions;
export default projectsSlice.reducer;