// frontend/src/store/slices/historySlice.ts
import { createSlice, PayloadAction, createAsyncThunk } from '@reduxjs/toolkit';
import { api } from '../../services/api';

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
  currentActionId: string | null; // ID текущего действия (последнего примененного)
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
  async (artifactId: number) => {
    const response = await api.get(`/api/v2/artifacts/${artifactId}/history?limit=100`);
    return response;
  }
);

export const undo = createAsyncThunk(
  'history/undo',
  async (artifactId: number, { dispatch }) => {
    const response = await api.post(`/api/v2/artifacts/${artifactId}/history/undo`);
    return response;
  }
);

export const redo = createAsyncThunk(
  'history/redo',
  async (artifactId: number, { dispatch }) => {
    const response = await api.post(`/api/v2/artifacts/${artifactId}/history/redo`);
    return response;
  }
);

const historySlice = createSlice({
  name: 'history',
  initialState,
  reducers: {
    addAction: (state, action: PayloadAction<HistoryAction>) => {
      // Добавляем действие в конец списка
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
        // Последнее действие в списке - текущее
        if (action.payload.length > 0) {
          state.currentActionId = action.payload[action.payload.length - 1].id;
        }
      })
      .addCase(fetchHistory.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.error.message || 'Failed to fetch history';
      })
      
      // Undo
      .addCase(undo.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(undo.fulfilled, (state, action) => {
        state.isLoading = false;
        // Сервер вернул action_id отмененного действия
        // Находим индекс этого действия и устанавливаем предыдущее как текущее
        const undoneActionId = action.payload.action_id;
        const index = state.actions.findIndex(a => a.id === undoneActionId);
        if (index > 0) {
          state.currentActionId = state.actions[index - 1].id;
        } else if (index === 0) {
          state.currentActionId = null; // Отменили первое действие
        }
      })
      .addCase(undo.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.error.message || 'Failed to undo';
      })
      
      // Redo
      .addCase(redo.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(redo.fulfilled, (state, action) => {
        state.isLoading = false;
        // Сервер вернул action_id повторяемого действия
        state.currentActionId = action.payload.action_id;
      })
      .addCase(redo.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.error.message || 'Failed to redo';
      });
  }
});

export const { addAction, setCurrentIndex, resetHistory, clearError } = historySlice.actions;
export default historySlice.reducer;
