import { configureStore } from '@reduxjs/toolkit'
import { useDispatch, useSelector, TypedUseSelectorHook } from 'react-redux'

// Import reducers (to be implemented)
// import graphReducer from './slices/graphSlice'
// import pluginReducer from './slices/pluginSlice'
// import uiReducer from './slices/uiSlice'

export const store = configureStore({
  reducer: {
    // graph: graphReducer,
    // plugins: pluginReducer,
    // ui: uiReducer,
  },
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware({
      serializableCheck: {
        // Ignore these paths in state for non-serializable values
        ignoredActions: ['graph/setGraphData'],
        ignoredPaths: ['graph.networkInstance'],
      },
    }),
  devTools: process.env.NODE_ENV !== 'production',
})

// Infer the `RootState` and `AppDispatch` types from the store itself
export type RootState = ReturnType<typeof store.getState>
export type AppDispatch = typeof store.dispatch

// Use throughout your app instead of plain `useDispatch` and `useSelector`
export const useAppDispatch: () => AppDispatch = useDispatch
export const useAppSelector: TypedUseSelectorHook<RootState> = useSelector

// Example slice structure (to be implemented)
/*
import { createSlice, PayloadAction } from '@reduxjs/toolkit'

interface GraphState {
  nodes: any[]
  edges: any[]
  selectedNode: string | null
  isLoading: boolean
  error: string | null
}

const initialState: GraphState = {
  nodes: [],
  edges: [],
  selectedNode: null,
  isLoading: false,
  error: null,
}

const graphSlice = createSlice({
  name: 'graph',
  initialState,
  reducers: {
    setGraphData: (state, action: PayloadAction<{ nodes: any[]; edges: any[] }>) => {
      state.nodes = action.payload.nodes
      state.edges = action.payload.edges
    },
    setSelectedNode: (state, action: PayloadAction<string | null>) => {
      state.selectedNode = action.payload
    },
    setLoading: (state, action: PayloadAction<boolean>) => {
      state.isLoading = action.payload
    },
    setError: (state, action: PayloadAction<string | null>) => {
      state.error = action.payload
    },
  },
})

export const { setGraphData, setSelectedNode, setLoading, setError } = graphSlice.actions
export default graphSlice.reducer
*/
