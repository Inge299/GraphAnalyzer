// frontend/src/store/slices/historySlice.ts
import { createSlice, PayloadAction, createAsyncThunk } from '@reduxjs/toolkit';
import { api } from '../../services/api';
import { RootState } from '../../store';

export interface HistoryAction {
  id: string;
  artifactId: number;
  actionType: string;
  beforeState: any;
  afterState: any;
  timestamp: string;
  description: string;
  userType: 'user' | 'plugin';
  pluginId?: string;
  groupId?: string;
}

interface HistoryState {
  actions: HistoryAction[];
  currentActionId: string | null;
  isLoading: boolean;
  error: string | null;
  hasRedo: boolean;
}

const initialState: HistoryState = {
  actions: [],
  currentActionId: null,
  isLoading: false,
  error: null,
  hasRedo: false,
};

// Async thunks
export const fetchHistory = createAsyncThunk(
  'history/fetch',
  async (artifactId: number) => {
    const response = await api.get(`/api/v2/artifacts/${artifactId}/history?limit=100`);
    return response.data;
  }
);

export const undo = createAsyncThunk(
  'history/undo',
  async (artifactId: number) => {
    const response = await api.post(`/api/v2/artifacts/${artifactId}/history/undo`);
    return response.data;
  }
);

export const redo = createAsyncThunk(
  'history/redo',
  async (artifactId: number) => {
    const response = await api.post(`/api/v2/artifacts/${artifactId}/history/redo`);
    return response.data;
  }
);

const historySlice = createSlice({
  name: 'history',
  initialState,
  reducers: {
    addAction: (state, action: PayloadAction<HistoryAction>) => {
      state.actions.push(action.payload);
      state.currentActionId = action.payload.id;
      state.error = null;
    },
    
    setCurrentIndex: (state, action: PayloadAction<{ actionId: string; direction: 'undo' | 'redo' }>) => {
      state.currentActionId = action.payload.actionId;
      state.error = null;
    },
    
    resetHistory: (state) => {
      state.actions = [];
      state.currentActionId = null;
      state.error = null;
    },
    
    clearError: (state) => {
      state.error = null;
    },
    
    setHistoryActions: (state, action: PayloadAction<HistoryAction[]>) => {
      state.actions = action.payload;
      state.currentActionId = action.payload.length > 0 ? action.payload[action.payload.length - 1].id : null;
      state.error = null;
    },
    
    setRedoAvailable: (state, action: PayloadAction<boolean>) => {
      state.hasRedo = action.payload;  // ← ЭТО ОСТАВЛЯЕМ
    }
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchHistory.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(fetchHistory.fulfilled, (state, action) => {
        state.isLoading = false;
        state.actions = action.payload;
        if (action.payload.length > 0) {
          state.currentActionId = action.payload[action.payload.length - 1].id;
        }
      })
      .addCase(fetchHistory.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.error.message || 'Failed to fetch history';
      })
      
      .addCase(undo.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(undo.fulfilled, (state) => {
        state.isLoading = false;
        state.hasRedo = true;  // После UNDO можно сделать REDO
      })
      .addCase(undo.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.error.message || 'Failed to undo';
      })
      
      .addCase(redo.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(redo.fulfilled, (state) => {
        state.isLoading = false;
	state.hasRedo = true;
      })
      .addCase(redo.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.error.message || 'Failed to redo';
      });
  }
});

export const { addAction, setCurrentIndex, resetHistory, clearError, setHistoryActions, setRedoAvailable } = historySlice.actions;
export default historySlice.reducer;

// ========== СЕЛЕКТОРЫ ==========
export const selectHistoryActions = (state: RootState) => state.history.actions;
export const selectCurrentActionId = (state: RootState) => state.history.currentActionId;
export const selectIsHistoryLoading = (state: RootState) => state.history.isLoading;
export const selectHistoryError = (state: RootState) => state.history.error;
export const selectHasRedo = (state: RootState) => state.history.hasRedo;

export const selectCanUndo = (state: RootState) => {
  const { actions } = state.history;
  return actions.length > 0;
};

export const selectCanRedo = (state: RootState) => {
  return state.history.hasRedo;
};

export const selectCurrentAction = (state: RootState) => {
  const { actions, currentActionId } = state.history;
  if (!currentActionId) return null;
  return actions.find(a => a.id === currentActionId) || null;
};

export const selectActionsForDisplay = (state: RootState) => {
  return [...state.history.actions].reverse();
};

export const selectActionsCount = (state: RootState) => state.history.actions.length;