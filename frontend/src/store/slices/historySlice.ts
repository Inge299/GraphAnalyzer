// src/store/slices/historySlice.ts
import { createSlice, PayloadAction } from '@reduxjs/toolkit';

export interface HistoryAction {
  id: string;
  graphId: number;
  actionType: string;
  beforeState: any;
  afterState: any;
  timestamp: string;
  description: string;
}

interface HistoryState {
  actions: HistoryAction[];
  currentIndex: number;
}

const initialState: HistoryState = {
  actions: [],
  currentIndex: -1
};

const historySlice = createSlice({
  name: 'history',
  initialState,
  reducers: {
    addAction: (state, action: PayloadAction<HistoryAction>) => {
      // Удаляем все действия после currentIndex
      if (state.currentIndex < state.actions.length - 1) {
        state.actions = state.actions.slice(0, state.currentIndex + 1);
      }
      state.actions.push(action.payload);
      state.currentIndex = state.actions.length - 1;
    },
    
    undo: (state) => {
      if (state.currentIndex >= 0) {
        state.currentIndex -= 1;
      }
    },
    
    redo: (state) => {
      if (state.currentIndex < state.actions.length - 1) {
        state.currentIndex += 1;
      }
    },
    
    jumpTo: (state, action: PayloadAction<number>) => {
      if (action.payload >= 0 && action.payload < state.actions.length) {
        state.currentIndex = action.payload;
      }
    },
    
    clearHistory: (state) => {
      state.actions = [];
      state.currentIndex = -1;
    }
  }
});

export const { addAction, undo, redo, jumpTo, clearHistory } = historySlice.actions;
export default historySlice.reducer;
