// frontend/src/store/slices/uiSlice.ts
import { createSlice, PayloadAction } from '@reduxjs/toolkit';

interface Tab {
  id: string;
  artifactId: number;
  title: string;
  type: string;
}

interface SelectedElement {
  type: 'node' | 'edge';
  id: string;
  data: any;
}

interface UIState {
  darkMode: boolean;
  sidebarCollapsed: boolean;
  inspectorWidth: number;
  tabs: Tab[];
  activeTabId: string | null;
  selectedElement: SelectedElement | null;
  notifications: Array<{
    id: string;
    type: 'info' | 'success' | 'warning' | 'error';
    message: string;
    timeout?: number;
  }>;
}

const initialState: UIState = {
  darkMode: true,
  sidebarCollapsed: false,
  inspectorWidth: 300,
  tabs: [],
  activeTabId: null,
  selectedElement: null,
  notifications: [],
};

const uiSlice = createSlice({
  name: 'ui',
  initialState,
  reducers: {
    toggleDarkMode: (state) => {
      state.darkMode = !state.darkMode;
    },
    setSidebarCollapsed: (state, action: PayloadAction<boolean>) => {
      state.sidebarCollapsed = action.payload;
    },
    setInspectorWidth: (state, action: PayloadAction<number>) => {
      state.inspectorWidth = action.payload;
    },
    addTab: (state, action: PayloadAction<Tab>) => {
      state.tabs.push(action.payload);
    },
    removeTab: (state, action: PayloadAction<string>) => {
      state.tabs = state.tabs.filter(tab => tab.id !== action.payload);
      if (state.activeTabId === action.payload) {
        state.activeTabId = state.tabs[state.tabs.length - 1]?.id || null;
      }
    },
    setActiveTab: (state, action: PayloadAction<string | null>) => {
      state.activeTabId = action.payload;
    },
    setSelectedElement: (state, action: PayloadAction<SelectedElement | null>) => {
      console.log('[uiSlice] Setting selected element:', action.payload);
      state.selectedElement = action.payload;
    },
    addNotification: (state, action: PayloadAction<Omit<UIState['notifications'][0], 'id'>>) => {
      const id = `notification-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      state.notifications.push({ id, ...action.payload });
    },
    removeNotification: (state, action: PayloadAction<string>) => {
      state.notifications = state.notifications.filter(n => n.id !== action.payload);
    },
    clearNotifications: (state) => {
      state.notifications = [];
    },
  },
});

export const {
  toggleDarkMode,
  setSidebarCollapsed,
  setInspectorWidth,
  addTab,
  removeTab,
  setActiveTab,
  setSelectedElement,
  addNotification,
  removeNotification,
  clearNotifications,
} = uiSlice.actions;

export default uiSlice.reducer;