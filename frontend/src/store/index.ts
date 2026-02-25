// src/store/index.ts
import { configureStore } from '@reduxjs/toolkit';
import { useDispatch, useSelector, TypedUseSelectorHook } from 'react-redux';
import uiReducer from './slices/uiSlice';
import graphReducer from './slices/graphSlice';
import projectsReducer from './slices/projectsSlice';

export const store = configureStore({
  reducer: {
    ui: uiReducer,
    graph: graphReducer,
    projects: projectsReducer,
  },
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware({
      serializableCheck: {
        // Игнорируем non-serializable значения в graph (vis-network instance)
        ignoredActions: ['graph/setNetworkInstance'],
        ignoredPaths: ['graph.networkInstance'],
      },
    }),
  devTools: process.env.NODE_ENV !== 'production',
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;
export const useAppDispatch: () => AppDispatch = useDispatch;
export const useAppSelector: TypedUseSelectorHook<RootState> = useSelector;
