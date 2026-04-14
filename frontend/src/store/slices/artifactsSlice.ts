// frontend/src/store/slices/artifactsSlice.ts
import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit';
import { api } from '../../services/api';
import { ApiArtifact, ApiArtifactCreate } from '../../types/api';

interface ArtifactsState {
  items: Record<number, ApiArtifact>;
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
      return response.data;
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
      return response.data;
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
      return response.data;
    } catch (error: any) {
      console.error('[Artifacts] Error creating artifact:', error);
      return rejectWithValue(error.message || 'Failed to create artifact');
    }
  }
);

// updateArtifact С‚РµРїРµСЂСЊ РќР• РґРµР»Р°РµС‚ API Р·Р°РїСЂРѕСЃ, С‚РѕР»СЊРєРѕ РѕР±РЅРѕРІР»СЏРµС‚ Redux
// РќРѕ РїСЂРёРЅРёРјР°РµС‚ РѕР±РЅРѕРІР»РµРЅРЅС‹Р№ Р°СЂС‚РµС„Р°РєС‚ РёР· useActionWithUndo
export const updateArtifactRedux = createAsyncThunk(
  'artifacts/updateRedux',
  async (artifact: ApiArtifact) => {
    // РџСЂРѕСЃС‚Рѕ РІРѕР·РІСЂР°С‰Р°РµРј Р°СЂС‚РµС„Р°РєС‚ РґР»СЏ РѕР±РЅРѕРІР»РµРЅРёСЏ Redux
    return artifact;
  }
);

export const deleteArtifact = createAsyncThunk(
  'artifacts/delete',
  async ({ projectId, id }: { projectId: number; id: number }, { rejectWithValue }) => {
    try {
      console.log(`[Artifacts] Deleting artifact ${id}`);
      await api.delete(`/api/v2/projects/${projectId}/artifacts/${id}`);
      return id;
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
      console.log('[Artifacts] Current artifact set to:', action.payload);
    },
    clearError: (state) => {
      state.error = null;
    },
    // РЎРёРЅС…СЂРѕРЅРЅРѕРµ РѕР±РЅРѕРІР»РµРЅРёРµ Р°СЂС‚РµС„Р°РєС‚Р° (Р±РµР· API)
    updateArtifactSync: (state, action: PayloadAction<ApiArtifact>) => {
      const artifact = action.payload;
      if (artifact && artifact.id) {
        state.items[artifact.id] = artifact;
        console.log(`[Artifacts] Sync updated artifact ${artifact.id}, version:`, artifact.version);
      }
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
        const artifacts = action.payload;
        if (Array.isArray(artifacts)) {
          artifacts.forEach((artifact: ApiArtifact) => {
            if (artifact && artifact.id) {
              state.items[artifact.id] = artifact;
            }
          });
        }
      })
      .addCase(fetchArtifacts.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload as string;
      })

      // Fetch single artifact
      .addCase(fetchArtifact.pending, (state) => {
        state.isLoading = true;
      })
      .addCase(fetchArtifact.fulfilled, (state, action) => {
        state.isLoading = false;
        const artifact = action.payload;
        if (artifact && artifact.id) {
          state.items[artifact.id] = artifact;
        }
      })
      .addCase(fetchArtifact.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload as string;
      })

      // Create artifact
      .addCase(createArtifact.fulfilled, (state, action) => {
        const artifact = action.payload;
        if (artifact && artifact.id) {
          state.items[artifact.id] = artifact;
          state.currentArtifactId = artifact.id;
        }
      })

      // Update artifact Redux (СЃРёРЅС…СЂРѕРЅРЅРѕ)
      .addCase(updateArtifactRedux.fulfilled, (state, action) => {
        const artifact = action.payload;
        if (artifact && artifact.id) {
          state.items[artifact.id] = artifact;
          console.log(`[Artifacts] Redux updated for artifact ${artifact.id}, version:`, artifact.version);
        }
      })

      // Delete artifact
      .addCase(deleteArtifact.fulfilled, (state, action) => {
        const id = action.payload;
        delete state.items[id];
        if (state.currentArtifactId === id) {
          state.currentArtifactId = null;
        }
      });
  }
});

export const { setCurrentArtifact, clearError, updateArtifactSync } = artifactsSlice.actions;
export default artifactsSlice.reducer;
