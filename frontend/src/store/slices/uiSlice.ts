// src/store/slices/uiSlice.ts
import { createSlice, PayloadAction } from '@reduxjs/toolkit';

export type ViewType = 'graph' | 'map' | 'table' | 'text' | 'stats';

interface UIState {
  activeView: ViewType;
  selectedNodeId: string | null;
  selectedEdgeId: string | null;
  selectedProjectId: number | null;
  selectedGraphId: number | null;
  inspectorExpanded: boolean;
  sidebarExpanded: boolean;
}

const initialState: UIState = {
  activeView: 'graph',
  selectedNodeId: null,
  selectedEdgeId: null,
  selectedProjectId: null,
  selectedGraphId: null,
  inspectorExpanded: true,
  sidebarExpanded: true,
};

const uiSlice = createSlice({
  name: 'ui',
  initialState,
  reducers: {
    setActiveView: (state, action: PayloadAction<ViewType>) => {
      state.activeView = action.payload;
    },
    setSelectedNode: (state, action: PayloadAction<string | null>) => {
      state.selectedNodeId = action.payload;
      state.selectedEdgeId = null;
    },
    setSelectedEdge: (state, action: PayloadAction<string | null>) => {
      state.selectedEdgeId = action.payload;
      state.selectedNodeId = null;
    },
    setSelectedProject: (state, action: PayloadAction<number | null>) => {
      state.selectedProjectId = action.payload;
      if (action.payload === null) {
        state.selectedGraphId = null;
      }
    },
    setSelectedGraph: (state, action: PayloadAction<number | null>) => {
      state.selectedGraphId = action.payload;
    },
    toggleInspector: (state) => {
      state.inspectorExpanded = !state.inspectorExpanded;
    },
    toggleSidebar: (state) => {
      state.sidebarExpanded = !state.sidebarExpanded;
    },
  },
});

export const {
  setActiveView,
  setSelectedNode,
  setSelectedEdge,
  setSelectedProject,
  setSelectedGraph,
  toggleInspector,
  toggleSidebar,
} = uiSlice.actions;
export default uiSlice.reducer;
