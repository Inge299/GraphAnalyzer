// frontend/src/store/index.ts
import { configureStore } from '@reduxjs/toolkit';
import { useDispatch, useSelector } from 'react-redux';
import type { TypedUseSelectorHook } from 'react-redux';

import projectsReducer from './slices/projectsSlice';
import artifactsReducer from './slices/artifactsSlice';
import graphReducer from './slices/graphSlice';
import uiReducer from './slices/uiSlice';
import historyReducer from './slices/historySlice';

const isDev = import.meta.env.DEV;

export const store = configureStore({
  reducer: {
    projects: projectsReducer,
    artifacts: artifactsReducer,
    graph: graphReducer,
    ui: uiReducer,
    history: historyReducer,
  },
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware({
      serializableCheck: isDev
        ? false
        : {
            ignoredActions: ['history/recordAction/fulfilled'],
            ignoredPaths: ['history.actions.*.beforeState', 'history.actions.*.afterState'],
          },
      immutableCheck: isDev ? false : undefined,
    }),
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;

export const useAppDispatch: () => AppDispatch = useDispatch;
export const useAppSelector: TypedUseSelectorHook<RootState> = useSelector;
