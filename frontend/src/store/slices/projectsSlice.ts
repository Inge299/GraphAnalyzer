// store/slices/projectsSlice.ts
import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit';
import { api } from '../../services/api';
import { layoutConfig } from '../../config/layout';

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

const PROJECTS_CACHE_KEY = 'graph-analyzer.projects-cache';
const CURRENT_PROJECT_ID_KEY = 'graph-analyzer.current-project-id';

const loadCachedProjectsState = (): Pick<ProjectsState, 'projects' | 'currentProject'> => {
  if (typeof window === 'undefined') {
    return { projects: [], currentProject: null };
  }

  try {
    const projectsRaw = window.localStorage.getItem(PROJECTS_CACHE_KEY);
    const currentProjectIdRaw = window.localStorage.getItem(CURRENT_PROJECT_ID_KEY);
    const projects = projectsRaw ? (JSON.parse(projectsRaw) as Project[]) : [];
    const currentProjectId = currentProjectIdRaw ? Number(currentProjectIdRaw) : null;
    const currentProject =
      currentProjectId != null ? projects.find((project) => project.id === currentProjectId) || null : null;

    return {
      projects: Array.isArray(projects) ? projects : [],
      currentProject,
    };
  } catch {
    return { projects: [], currentProject: null };
  }
};

const persistProjectsState = (projects: Project[], currentProject: Project | null) => {
  if (typeof window === 'undefined') return;

  try {
    window.localStorage.setItem(PROJECTS_CACHE_KEY, JSON.stringify(projects));
    if (currentProject?.id != null) {
      window.localStorage.setItem(CURRENT_PROJECT_ID_KEY, String(currentProject.id));
    } else {
      window.localStorage.removeItem(CURRENT_PROJECT_ID_KEY);
    }
  } catch {
    // Ignore cache persistence issues and keep app responsive.
  }
};

const cachedState = loadCachedProjectsState();

const initialState: ProjectsState = {
  projects: cachedState.projects,
  currentProject: cachedState.currentProject,
  isLoading: false,
  error: null,
};

export const fetchProjects = createAsyncThunk(
  'projects/fetchAll',
  async (_, { rejectWithValue }) => {
    try {
      console.log('[Projects] Fetching all projects');
      const response = await api.get('/api/v1/projects', {
        timeout: layoutConfig.network.projectsLoadTimeoutMs,
      });
      console.log('[Projects] Response:', {
        status: response.status,
        dataType: typeof response.data,
        isArray: Array.isArray(response.data),
        data: response.data
      });
      
      // Убедимся, что возвращаем массив
      const projects = Array.isArray(response.data) ? [...response.data].sort((left, right) => {
        const leftTime = new Date(left.updated_at || left.created_at || 0).getTime();
        const rightTime = new Date(right.updated_at || right.created_at || 0).getTime();
        return rightTime - leftTime;
      }) : [];
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
        persistProjectsState(state.projects, state.currentProject);
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

        if (!state.currentProject && state.projects.length > 0) {
          state.currentProject = state.projects[0];
        }

        persistProjectsState(state.projects, state.currentProject);
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
