// frontend/src/store/slices/artifactsSlice.ts
import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit';
import { api } from '../../services/api';
import { ApiArtifact, ApiArtifactCreate, ApiArtifactUpdate } from '../../types/api';

interface ArtifactsState {
  items: Record<number, ApiArtifact>;  // key: artifactId
  currentArtifactId: number | null;
  isLoading: boolean;
  error: string | null;
}

const initialState: ArtifactsState = {
  items: {},
  currentArtifactId: null,
  isLoading: false,
  error: null
};

// ============================================================================
// Async thunks
// ============================================================================

export const fetchArtifacts = createAsyncThunk(
  'artifacts/fetchAll',
  async (projectId: number, { rejectWithValue }) => {
    try {
      console.log(`[Artifacts] Fetching artifacts for project ${projectId}`);
      const response = await api.get(`/api/v2/projects/${projectId}/artifacts`);
      return response.data;  // <-- ИСПРАВЛЕНО
    } catch (error: any) {
      console.error('[Artifacts] Error fetching artifacts:', error);
      return rejectWithValue(error.message || 'Failed to fetch artifacts');
    }
  }
);

export const fetchArtifact = createAsyncThunk(
  'artifacts/fetchOne',
  async ({ projectId, id }: { projectId: number; id: number }, { rejectWithValue }) => {
    try {
      console.log(`[Artifacts] Fetching artifact ${id}`);
      const response = await api.get(`/api/v2/projects/${projectId}/artifacts/${id}`);
      return response.data;  // <-- ИСПРАВЛЕНО
    } catch (error: any) {
      console.error('[Artifacts] Error fetching artifact:', error);
      return rejectWithValue(error.message || 'Failed to fetch artifact');
    }
  }
);

export const createArtifact = createAsyncThunk(
  'artifacts/create',
  async ({ projectId, data }: { projectId: number; data: ApiArtifactCreate }, { rejectWithValue }) => {
    try {
      console.log(`[Artifacts] Creating artifact in project ${projectId}`);
      const response = await api.post(`/api/v2/projects/${projectId}/artifacts`, data);
      return response.data;  // <-- ИСПРАВЛЕНО
    } catch (error: any) {
      console.error('[Artifacts] Error creating artifact:', error);
      return rejectWithValue(error.message || 'Failed to create artifact');
    }
  }
);

export const updateArtifact = createAsyncThunk(
  'artifacts/update',
  async ({ 
    projectId, 
    id, 
    updates 
  }: { 
    projectId: number; 
    id: number; 
    updates: ApiArtifactUpdate  // Используем правильный тип
  }, { rejectWithValue }) => {
    try {
      console.log(`[Artifacts] Updating artifact ${id} in project ${projectId}`, updates);
      const response = await api.put(`/api/v2/projects/${projectId}/artifacts/${id}`, updates);
      console.log(`[Artifacts] Updated artifact ${id} to version ${response.data.version}`);  // <-- ИСПРАВЛЕНО
      return response.data;  // <-- ИСПРАВЛЕНО
    } catch (error: any) {
      console.error('[Artifacts] Error updating artifact:', error);
      return rejectWithValue(error.message || 'Failed to update artifact');
    }
  }
);

export const deleteArtifact = createAsyncThunk(
  'artifacts/delete',
  async ({ projectId, id }: { projectId: number; id: number }, { rejectWithValue }) => {
    try {
      console.log(`[Artifacts] Deleting artifact ${id}`);
      await api.delete(`/api/v2/projects/${projectId}/artifacts/${id}`);
      return id;  // id и так число, не нужно .data
    } catch (error: any) {
      console.error('[Artifacts] Error deleting artifact:', error);
      return rejectWithValue(error.message || 'Failed to delete artifact');
    }
  }
);

// ============================================================================
// Slice
// ============================================================================

const artifactsSlice = createSlice({
  name: 'artifacts',
  initialState,
  reducers: {
    setCurrentArtifact: (state, action: PayloadAction<number | null>) => {
      state.currentArtifactId = action.payload;
    },
    clearError: (state) => {
      state.error = null;
    }
  },
  extraReducers: (builder) => {
    builder
      // Fetch all artifacts
      .addCase(fetchArtifacts.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(fetchArtifacts.fulfilled, (state, action) => {
        state.isLoading = false;
        const artifacts = action.payload;  // теперь это уже data
        artifacts.forEach((artifact: ApiArtifact) => {
          state.items[artifact.id] = artifact;
        });
      })
      .addCase(fetchArtifacts.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload as string;
      })

      // Fetch single artifact
      .addCase(fetchArtifact.fulfilled, (state, action) => {
        const artifact = action.payload;  // теперь это уже data
        state.items[artifact.id] = artifact;
      })

      // Create artifact
      .addCase(createArtifact.fulfilled, (state, action) => {
        const artifact = action.payload;  // теперь это уже data
        state.items[artifact.id] = artifact;
        state.currentArtifactId = artifact.id;
        console.log(`[Artifacts] Artifact ${artifact.id} created in store`);
      })

      // Update artifact
      .addCase(updateArtifact.fulfilled, (state, action) => {
        const artifact = action.payload;  // теперь это уже data
        state.items[artifact.id] = {
          ...state.items[artifact.id],
          ...artifact
        };
        console.log(`[Artifacts] Artifact ${artifact.id} updated in store`);
      })

      // Delete artifact
      .addCase(deleteArtifact.fulfilled, (state, action) => {
        const id = action.payload;  // id уже число
        delete state.items[id];
        if (state.currentArtifactId === id) {
          state.currentArtifactId = null;
        }
        console.log(`[Artifacts] Artifact ${id} deleted from store`);
      });
  }
});

export const { setCurrentArtifact, clearError } = artifactsSlice.actions;
export default artifactsSlice.reducer;