// frontend/src/store/slices/historySlice.ts
import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit';
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
}

const initialState: HistoryState = {
  actions: [],
  currentActionId: null,
  isLoading: false,
  error: null
};

// Async thunks
export const fetchHistory = createAsyncThunk(
  'history/fetch',
  async (artifactId: number, { rejectWithValue }) => {
    try {
      console.log('[History] Fetching history for artifact', artifactId);
      const response = await api.get(`/api/v2/artifacts/${artifactId}/history?limit=100`);
      console.log('[History] Fetched', response.data?.length || 0, 'actions');
      return response.data;
    } catch (error: any) {
      console.error('[History] Fetch failed:', error);
      return rejectWithValue(error.message || 'Failed to fetch history');
    }
  }
);

export const undo = createAsyncThunk(
  'history/undo',
  async (artifactId: number, { rejectWithValue }) => {
    try {
      console.log('[History] Undo requested for artifact', artifactId);
      const response = await api.post(`/api/v2/artifacts/${artifactId}/history/undo`);
      console.log('[History] Undo response:', response.data);
      return response.data;
    } catch (error: any) {
      console.error('[History] Undo failed:', error);
      return rejectWithValue(error.message || 'Failed to undo');
    }
  }
);

export const redo = createAsyncThunk(
  'history/redo',
  async (artifactId: number, { rejectWithValue }) => {
    try {
      console.log('[History] Redo requested for artifact', artifactId);
      const response = await api.post(`/api/v2/artifacts/${artifactId}/history/redo`);
      console.log('[History] Redo response:', response.data);
      return response.data;
    } catch (error: any) {
      console.error('[History] Redo failed:', error);
      return rejectWithValue(error.message || 'Failed to redo');
    }
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
      console.log('[History] Action added, total:', state.actions.length);
    },
    
    setCurrentIndex: (state, action: PayloadAction<{ actionId: string; direction: 'undo' | 'redo' }>) => {
      state.currentActionId = action.payload.actionId;
      state.error = null;
      console.log('[History] Current index set to:', action.payload.actionId, 'direction:', action.payload.direction);
    },
    
    setHistoryActions: (state, action: PayloadAction<HistoryAction[]>) => {
      state.actions = action.payload;
      state.currentActionId = action.payload.length > 0 ? action.payload[action.payload.length - 1].id : null;
      state.error = null;
      console.log('[History] Set history actions, count:', action.payload.length);
    },
    
    resetHistory: (state) => {
      state.actions = [];
      state.currentActionId = null;
      state.error = null;
      console.log('[History] History reset');
    },
    
    clearError: (state) => {
      state.error = null;
    }
  },
  extraReducers: (builder) => {
    builder
      // Fetch history
      .addCase(fetchHistory.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(fetchHistory.fulfilled, (state, action) => {
        state.isLoading = false;
        state.actions = action.payload;
        if (action.payload.length > 0) {
          state.currentActionId = action.payload[action.payload.length - 1].id;
        } else {
          state.currentActionId = null;
        }
        console.log('[History] Loaded', action.payload.length, 'actions');
      })
      .addCase(fetchHistory.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload as string;
        console.error('[History] Fetch rejected:', state.error);
      })
      
      // Undo
      .addCase(undo.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(undo.fulfilled, (state, action) => {
        state.isLoading = false;
        const undoneActionId = action.payload.action_id;
        // Находим индекс отмененного действия
        const index = state.actions.findIndex(a => a.id === undoneActionId);
        if (index > 0) {
          state.currentActionId = state.actions[index - 1].id;
        } else if (index === 0) {
          state.currentActionId = null;
        }
        // Удаляем отмененное действие из списка
        if (index !== -1) {
          state.actions = state.actions.filter(a => a.id !== undoneActionId);
        }
        console.log('[History] Undo completed, remaining actions:', state.actions.length);
      })
      .addCase(undo.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload as string;
        console.error('[History] Undo rejected:', state.error);
      })
      
      // Redo
      .addCase(redo.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(redo.fulfilled, (state, action) => {
        state.isLoading = false;
        const redoneActionId = action.payload.action_id;
        state.currentActionId = redoneActionId;
        // Redo добавляет новое действие, нужно получить обновленный список
        // Это будет сделано через fetchHistory в useActionWithUndo
        console.log('[History] Redo completed, new action id:', redoneActionId);
      })
      .addCase(redo.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload as string;
        console.error('[History] Redo rejected:', state.error);
      });
  }
});

// ========== ЭКСПОРТЫ ==========
export const { addAction, setCurrentIndex, resetHistory, clearError, setHistoryActions } = historySlice.actions;
export default historySlice.reducer;

// ========== СЕЛЕКТОРЫ ==========
export const selectHistoryActions = (state: RootState) => state.history.actions;
export const selectCurrentActionId = (state: RootState) => state.history.currentActionId;
export const selectIsHistoryLoading = (state: RootState) => state.history.isLoading;
export const selectHistoryError = (state: RootState) => state.history.error;

export const selectCanUndo = (state: RootState) => {
  const { actions, currentActionId } = state.history;
  if (actions.length === 0) return false;
  if (!currentActionId) return actions.length > 0;
  const currentIndex = actions.findIndex(a => a.id === currentActionId);
  return currentIndex > 0;
};

export const selectCanRedo = (state: RootState) => {
  const { actions, currentActionId } = state.history;
  if (actions.length === 0) return false;
  if (!currentActionId) return false;
  const currentIndex = actions.findIndex(a => a.id === currentActionId);
  return currentIndex < actions.length - 1;
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