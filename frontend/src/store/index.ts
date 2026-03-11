// src/store/index.ts
import { configureStore } from '@reduxjs/toolkit';
import { useDispatch, useSelector, TypedUseSelectorHook } from 'react-redux';

import projectsReducer from './slices/projectsSlice';
import artifactsReducer from './slices/artifactsSlice';
import uiReducer from './slices/uiSlice';
import graphReducer from './slices/graphSlice';
import historyReducer from './slices/historySlice';

export const store = configureStore({
  reducer: {
    projects: projectsReducer,
    artifacts: artifactsReducer,
    ui: uiReducer,
    graph: graphReducer,
    history: historyReducer,
  },
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware({
      serializableCheck: false,
    }),
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;

export const useAppDispatch = () => useDispatch<AppDispatch>();
export const useAppSelector: TypedUseSelectorHook<RootState> = useSelector;
