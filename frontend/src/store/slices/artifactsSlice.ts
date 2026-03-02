// frontend/src/store/slices/artifactsSlice.ts
import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit';
import { api } from '../../services/api';

export interface ArtifactData {
  nodes?: Array<{
    id: string;
    type: string;
    label?: string;
    attributes?: Record<string, any>;
    position_x?: number;
    position_y?: number;
  }>;
  edges?: Array<{
    id: string;
    source: string;
    target: string;
    type: string;
    attributes?: Record<string, any>;
  }>;
  columns?: Array<{ key: string; label: string; type?: string }>;
  rows?: Array<Record<string, any>>;
  layers?: Array<any>;
  points?: Array<{ lat: number; lng: number; properties?: any }>;
  series?: Array<{ name: string; data: number[] }>;
  content?: string;
  [key: string]: any;
}

export interface Artifact {
  id: number;
  project_id: number;
  type: 'graph' | 'table' | 'map' | 'chart' | 'document';
  name: string;
  description?: string;
  data: ArtifactData;
  metadata: Record<string, any>;
  created_at: string;
  updated_at: string;
  version: number;
  created_by?: string;
  updated_by?: string;
  source_artifact_id?: number;
  derivation_type?: string;
}

export interface ArtifactVersion {
  id: number;
  artifact_id: number;
  version: number;
  data: ArtifactData;
  metadata: Record<string, any>;
  created_at: string;
  created_by?: string;
  comment?: string;
}

export interface ArtifactRelation {
  id: number;
  source_artifact_id: number;
  target_artifact_id: number;
  relation_type: string;
  metadata: Record<string, any>;
  created_at: string;
}

interface ArtifactsState {
  artifacts: Artifact[];
  currentArtifact: Artifact | null;
  currentArtifactVersions: ArtifactVersion[];
  currentArtifactRelations: ArtifactRelation[];
  isLoading: boolean;
  isLoadingVersions: boolean;
  isLoadingRelations: boolean;
  error: string | null;
  lastFetched: number | null;
}

const initialState: ArtifactsState = {
  artifacts: [],
  currentArtifact: null,
  currentArtifactVersions: [],
  currentArtifactRelations: [],
  isLoading: false,
  isLoadingVersions: false,
  isLoadingRelations: false,
  error: null,
  lastFetched: null,
};

// Async thunks
export const fetchArtifacts = createAsyncThunk(
  'artifacts/fetchAll',
  async (projectId: number, { rejectWithValue }) => {
    console.log(`[Artifacts] fetchArtifacts called with projectId: ${projectId}`);
    try {
      console.log(`[Artifacts] Fetching artifacts for project ${projectId}`);
      const response = await api.get(`/api/v2/projects/${projectId}/artifacts`);
      console.log(`[Artifacts] Fetched ${response.length} artifacts`);
      return response;
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
      console.log(`[Artifacts] Fetching artifact ${id} for project ${projectId}`);
      const response = await api.get(`/api/v2/projects/${projectId}/artifacts/${id}`);
      return response;
    } catch (error: any) {
      console.error('[Artifacts] Error fetching artifact:', error);
      return rejectWithValue(error.message || 'Failed to fetch artifact');
    }
  }
);

export const createArtifact = createAsyncThunk(
  'artifacts/create',
  async ({ projectId, artifact }: { projectId: number; artifact: Partial<Artifact> }, { rejectWithValue }) => {
    try {
      console.log(`[Artifacts] Creating artifact in project ${projectId}:`, artifact.name);
      const response = await api.post(`/api/v2/projects/${projectId}/artifacts`, artifact);
      console.log(`[Artifacts] Created artifact with id ${response.id}`);
      return response;
    } catch (error: any) {
      console.error('[Artifacts] Error creating artifact:', error);
      return rejectWithValue(error.message || 'Failed to create artifact');
    }
  }
);

export const updateArtifact = createAsyncThunk(
  'artifacts/update',
  async ({ projectId, id, updates }: { projectId: number; id: number; updates: Partial<Artifact> }, { rejectWithValue }) => {
    try {
      console.log(`[Artifacts] Updating artifact ${id} in project ${projectId}`);
      const response = await api.put(`/api/v2/projects/${projectId}/artifacts/${id}`, updates);
      console.log(`[Artifacts] Updated artifact ${id} to version ${response.version}`);
      return response;
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
      console.log(`[Artifacts] Deleting artifact ${id} from project ${projectId}`);
      await api.delete(`/api/v2/projects/${projectId}/artifacts/${id}`);
      console.log(`[Artifacts] Deleted artifact ${id}`);
      return id;
    } catch (error: any) {
      console.error('[Artifacts] Error deleting artifact:', error);
      return rejectWithValue(error.message || 'Failed to delete artifact');
    }
  }
);

export const deriveArtifact = createAsyncThunk(
  'artifacts/derive',
  async ({ projectId, id, derivation }: { projectId: number; id: number; derivation: Partial<Artifact> }, { rejectWithValue }) => {
    try {
      console.log(`[Artifacts] Deriving new artifact from ${id} in project ${projectId}`);
      const response = await api.post(`/api/v2/projects/${projectId}/artifacts/${id}/derive`, derivation);
      console.log(`[Artifacts] Derived artifact ${response.id} from ${id}`);
      return response;
    } catch (error: any) {
      console.error('[Artifacts] Error deriving artifact:', error);
      return rejectWithValue(error.message || 'Failed to derive artifact');
    }
  }
);

export const fetchArtifactVersions = createAsyncThunk(
  'artifacts/fetchVersions',
  async ({ projectId, id }: { projectId: number; id: number }, { rejectWithValue }) => {
    try {
      console.log(`[Artifacts] Fetching versions for artifact ${id}`);
      const response = await api.get(`/api/v2/projects/${projectId}/artifacts/${id}/versions`);
      console.log(`[Artifacts] Fetched ${response.length} versions`);
      return response;
    } catch (error: any) {
      console.error('[Artifacts] Error fetching versions:', error);
      return rejectWithValue(error.message || 'Failed to fetch versions');
    }
  }
);

export const fetchArtifactRelations = createAsyncThunk(
  'artifacts/fetchRelations',
  async ({ projectId, id }: { projectId: number; id: number }, { rejectWithValue }) => {
    try {
      console.log(`[Artifacts] Fetching relations for artifact ${id}`);
      const response = await api.get(`/api/v2/projects/${projectId}/artifacts/${id}/relations`);
      console.log(`[Artifacts] Fetched ${response.length} relations`);
      return response;
    } catch (error: any) {
      console.error('[Artifacts] Error fetching relations:', error);
      return rejectWithValue(error.message || 'Failed to fetch relations');
    }
  }
);

// Helper function to migrate legacy graph to artifact format
export const migrateLegacyGraph = (graph: any): Artifact => {
  console.log('[Artifacts] Migrating legacy graph to artifact format:', graph.id);
  return {
    id: graph.id,
    project_id: graph.project_id,
    type: 'graph',
    name: graph.name || 'Imported Graph',
    description: graph.description,
    data: {
      nodes: graph.nodes || [],
      edges: graph.edges || [],
    },
    metadata: {
      legacy: true,
      original_id: graph.id,
      migrated_at: new Date().toISOString(),
    },
    created_at: graph.created_at || new Date().toISOString(),
    updated_at: graph.updated_at || new Date().toISOString(),
    version: 1,
  };
};

const artifactsSlice = createSlice({
  name: 'artifacts',
  initialState,
  reducers: {
    setCurrentArtifact: (state, action: PayloadAction<Artifact | null>) => {
      console.log('[Artifacts] Setting current artifact:', action.payload?.id);
      state.currentArtifact = action.payload;
    },
    clearArtifactError: (state) => {
      state.error = null;
    },
    clearCurrentArtifact: (state) => {
      state.currentArtifact = null;
      state.currentArtifactVersions = [];
      state.currentArtifactRelations = [];
    },
    updateArtifactData: (state, action: PayloadAction<{ id: number; data: Partial<ArtifactData> }>) => {
      const artifact = state.artifacts.find(a => a.id === action.payload.id);
      if (artifact) {
        artifact.data = { ...artifact.data, ...action.payload.data };
        artifact.updated_at = new Date().toISOString();
      }
      if (state.currentArtifact?.id === action.payload.id) {
        state.currentArtifact.data = { ...state.currentArtifact.data, ...action.payload.data };
        state.currentArtifact.updated_at = new Date().toISOString();
      }
    },
    // Для обратной совместимости со старым graphSlice
    setGraphData: (state, action: PayloadAction<{ nodes: any[]; edges: any[] }>) => {
      if (state.currentArtifact?.type === 'graph') {
        state.currentArtifact.data.nodes = action.payload.nodes;
        state.currentArtifact.data.edges = action.payload.edges;
      }
    },
  },
  extraReducers: (builder) => {
    builder
      // fetchArtifacts
      .addCase(fetchArtifacts.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(fetchArtifacts.fulfilled, (state, action) => {
        state.isLoading = false;
        state.artifacts = action.payload;
        state.lastFetched = Date.now();
        console.log(`[Artifacts] Store updated with ${action.payload.length} artifacts`);
      })
      .addCase(fetchArtifacts.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload as string;
      })
      
      // fetchArtifact
      .addCase(fetchArtifact.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(fetchArtifact.fulfilled, (state, action) => {
        state.isLoading = false;
        state.currentArtifact = action.payload;
        console.log(`[Artifacts] Current artifact set to ${action.payload.id}`);
      })
      .addCase(fetchArtifact.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload as string;
      })
      
      // createArtifact
      .addCase(createArtifact.fulfilled, (state, action) => {
        state.artifacts.push(action.payload);
        console.log(`[Artifacts] Artifact ${action.payload.id} added to store`);
      })
      
      // updateArtifact
      .addCase(updateArtifact.fulfilled, (state, action) => {
        const index = state.artifacts.findIndex(a => a.id === action.payload.id);
        if (index !== -1) {
          state.artifacts[index] = action.payload;
        }
        if (state.currentArtifact?.id === action.payload.id) {
          state.currentArtifact = action.payload;
        }
        console.log(`[Artifacts] Artifact ${action.payload.id} updated in store`);
      })
      
      // deleteArtifact
      .addCase(deleteArtifact.fulfilled, (state, action) => {
        state.artifacts = state.artifacts.filter(a => a.id !== action.payload);
        if (state.currentArtifact?.id === action.payload) {
          state.currentArtifact = null;
        }
        console.log(`[Artifacts] Artifact ${action.payload} removed from store`);
      })
      
      // deriveArtifact
      .addCase(deriveArtifact.fulfilled, (state, action) => {
        state.artifacts.push(action.payload);
        console.log(`[Artifacts] Derived artifact ${action.payload.id} added to store`);
      })
      
      // fetchArtifactVersions
      .addCase(fetchArtifactVersions.pending, (state) => {
        state.isLoadingVersions = true;
      })
      .addCase(fetchArtifactVersions.fulfilled, (state, action) => {
        state.isLoadingVersions = false;
        state.currentArtifactVersions = action.payload;
      })
      .addCase(fetchArtifactVersions.rejected, (state) => {
        state.isLoadingVersions = false;
      })
      
      // fetchArtifactRelations
      .addCase(fetchArtifactRelations.pending, (state) => {
        state.isLoadingRelations = true;
      })
      .addCase(fetchArtifactRelations.fulfilled, (state, action) => {
        state.isLoadingRelations = false;
        state.currentArtifactRelations = action.payload;
      })
      .addCase(fetchArtifactRelations.rejected, (state) => {
        state.isLoadingRelations = false;
      });
  },
});

export const { 
  setCurrentArtifact, 
  clearArtifactError, 
  clearCurrentArtifact,
  updateArtifactData,
  setGraphData // для обратной совместимости
} = artifactsSlice.actions;

export default artifactsSlice.reducer;