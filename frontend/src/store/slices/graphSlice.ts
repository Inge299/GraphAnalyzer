// src/store/slices/graphSlice.ts
import { createSlice, PayloadAction } from '@reduxjs/toolkit';

export interface Node {
  id: string;
  label?: string;
  type: string;
  attributes: Record<string, any>;
  x?: number;
  y?: number;
}

export interface Edge {
  id: string;
  from: string;
  to: string;
  type: string;
  attributes: Record<string, any>;
}

interface GraphState {
  nodes: Node[];
  edges: Edge[];
  isLoading: boolean;
  error: string | null;
  networkInstance: any | null;
  lastSaved: Date | null;
}

const initialState: GraphState = {
  nodes: [],
  edges: [],
  isLoading: false,
  error: null,
  networkInstance: null,
  lastSaved: null,
};

const graphSlice = createSlice({
  name: 'graph',
  initialState,
  reducers: {
    setGraphData: (state, action: PayloadAction<{ nodes: Node[]; edges: Edge[] }>) => {
      state.nodes = action.payload.nodes;
      state.edges = action.payload.edges;
    },
    addNode: (state, action: PayloadAction<Node>) => {
      state.nodes.push(action.payload);
    },
    updateNode: (state, action: PayloadAction<{ id: string; updates: Partial<Node> }>) => {
      const index = state.nodes.findIndex(n => n.id === action.payload.id);
      if (index !== -1) {
        state.nodes[index] = { ...state.nodes[index], ...action.payload.updates };
      }
    },
    deleteNode: (state, action: PayloadAction<string>) => {
      state.nodes = state.nodes.filter(n => n.id !== action.payload);
      state.edges = state.edges.filter(e => e.from !== action.payload && e.to !== action.payload);
    },
    addEdge: (state, action: PayloadAction<Edge>) => {
      state.edges.push(action.payload);
    },
    deleteEdge: (state, action: PayloadAction<string>) => {
      state.edges = state.edges.filter(e => e.id !== action.payload);
    },
    setLoading: (state, action: PayloadAction<boolean>) => {
      state.isLoading = action.payload;
    },
    setError: (state, action: PayloadAction<string | null>) => {
      state.error = action.payload;
    },
    setNetworkInstance: (state, action: PayloadAction<any>) => {
      state.networkInstance = action.payload;
    },
    setLastSaved: (state, action: PayloadAction<Date>) => {
      state.lastSaved = action.payload;
    },
    clearGraph: (state) => {
      state.nodes = [];
      state.edges = [];
      state.error = null;
    },
  },
});

export const {
  setGraphData,
  addNode,
  updateNode,
  deleteNode,
  addEdge,
  deleteEdge,
  setLoading,
  setError,
  setNetworkInstance,
  setLastSaved,
  clearGraph,
} = graphSlice.actions;
export default graphSlice.reducer;
