// frontend/src/store/slices/historySlice.ts
import { createSlice, PayloadAction, createAsyncThunk } from '@reduxjs/toolkit';
import { api } from '../../services/api';

export interface HistoryAction {
  id: string;
  graphId: number;
  actionType: string;
  beforeState: any;
  afterState: any;
  timestamp: string;
  description: string;
  userType?: 'user' | 'plugin';
  pluginId?: string;
  groupId?: string;
}

interface HistoryState {
  actions: HistoryAction[];
  currentIndex: number;  // -1 если нет действий, индекс текущего состояния
  isLoading: boolean;
  error: string | null;
  cacheStats: {
    cachedCount: number;
    maxActions: number;
  } | null;
}

const initialState: HistoryState = {
  actions: [],
  currentIndex: -1,
  isLoading: false,
  error: null,
  cacheStats: null
};

// ============================================================================
// Async Thunks
// ============================================================================

export const fetchHistory = createAsyncThunk(
  'history/fetch',
  async (graphId: number, { rejectWithValue }) => {
    try {
      const response = await api.get(`/api/v2/graphs/${graphId}/history?limit=100`);
      return { graphId, actions: response.data };
    } catch (error: any) {
      return rejectWithValue(error.response?.data?.detail || 'Failed to fetch history');
    }
  }
);

export const recordAction = createAsyncThunk(
  'history/record',
  async ({ 
    graphId, 
    action 
  }: { 
    graphId: number; 
    action: Omit<HistoryAction, 'id' | 'timestamp'>;
  }, { rejectWithValue }) => {
    try {
      const response = await api.post(`/api/v2/graphs/${graphId}/history/actions`, action);
      return response.data;
    } catch (error: any) {
      return rejectWithValue(error.response?.data?.detail || 'Failed to record action');
    }
  }
);

export const undo = createAsyncThunk(
  'history/undo',
  async (graphId: number, { dispatch, rejectWithValue }) => {
    try {
      const response = await api.post(`/api/v2/graphs/${graphId}/history/undo`);
      return response.data;
    } catch (error: any) {
      if (error.response?.status === 404) {
        // Нет действий для отмены - это нормально
        return null;
      }
      return rejectWithValue(error.response?.data?.detail || 'Failed to undo');
    }
  }
);

export const redo = createAsyncThunk(
  'history/redo',
  async (graphId: number, { dispatch, rejectWithValue }) => {
    try {
      const response = await api.post(`/api/v2/graphs/${graphId}/history/redo`);
      return response.data;
    } catch (error: any) {
      if (error.response?.status === 404) {
        // Нет действий для повтора - это нормально
        return null;
      }
      return rejectWithValue(error.response?.data?.detail || 'Failed to redo');
    }
  }
);

export const clearHistory = createAsyncThunk(
  'history/clear',
  async (graphId: number, { rejectWithValue }) => {
    try {
      await api.delete(`/api/v2/graphs/${graphId}/history`);
      return graphId;
    } catch (error: any) {
      return rejectWithValue(error.response?.data?.detail || 'Failed to clear history');
    }
  }
);

// ============================================================================
// Slice
// ============================================================================

const historySlice = createSlice({
  name: 'history',
  initialState,
  reducers: {
    // Локальное добавление действия (без бэкенда, для оптимистичных обновлений)
    addLocalAction: (state, action: PayloadAction<HistoryAction>) => {
      // Удаляем все действия после currentIndex (как в Git)
      if (state.currentIndex < state.actions.length - 1) {
        state.actions = state.actions.slice(0, state.currentIndex + 1);
      }
      state.actions.push(action.payload);
      state.currentIndex = state.actions.length - 1;
    },
    
    // Переход к конкретному действию
    jumpToAction: (state, action: PayloadAction<number>) => {
      if (action.payload >= 0 && action.payload < state.actions.length) {
        state.currentIndex = action.payload;
      }
    },
    
    // Сброс истории (при закрытии графа)
    resetHistory: (state) => {
      state.actions = [];
      state.currentIndex = -1;
      state.error = null;
      state.cacheStats = null;
    },
    
    // Обновление состояния графа после undo/redo (для синхронизации)
    updateCurrentState: (state, action: PayloadAction<any>) => {
      // Этот редьюсер просто маркер, само обновление происходит в компоненте
      // Но мы можем обновить текущее состояние в actions если нужно
      if (state.currentIndex >= 0 && state.currentIndex < state.actions.length) {
        state.actions[state.currentIndex].afterState = action.payload;
      }
    },
    
    // Очистка ошибок
    clearError: (state) => {
      state.error = null;
    }
  },
  extraReducers: (builder) => {
    builder
      // Fetch History
      .addCase(fetchHistory.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(fetchHistory.fulfilled, (state, action) => {
        state.isLoading = false;
        state.actions = action.payload.actions;
        state.currentIndex = action.payload.actions.length - 1;
      })
      .addCase(fetchHistory.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload as string;
      })
      
      // Record Action
      .addCase(recordAction.fulfilled, (state, action) => {
        // Добавляем действие в конец списка
        if (state.currentIndex < state.actions.length - 1) {
          state.actions = state.actions.slice(0, state.currentIndex + 1);
        }
        state.actions.push(action.payload);
        state.currentIndex = state.actions.length - 1;
      })
      
      // Undo
      .addCase(undo.fulfilled, (state, action) => {
        if (action.payload) {
          // Уменьшаем индекс, но само состояние графа обновит компонент
          state.currentIndex = Math.max(-1, state.currentIndex - 1);
        }
      })
      
      // Redo
      .addCase(redo.fulfilled, (state, action) => {
        if (action.payload) {
          // Увеличиваем индекс
          state.currentIndex = Math.min(state.actions.length - 1, state.currentIndex + 1);
        }
      })
      
      // Clear History
      .addCase(clearHistory.fulfilled, (state) => {
        state.actions = [];
        state.currentIndex = -1;
      });
  }
});

export const { 
  addLocalAction, 
  jumpToAction, 
  resetHistory, 
  updateCurrentState,
  clearError 
} = historySlice.actions;

export default historySlice.reducer;
