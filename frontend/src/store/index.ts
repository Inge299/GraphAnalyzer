// frontend/src/store/index.ts
import { configureStore } from '@reduxjs/toolkit';
import { useDispatch, useSelector } from 'react-redux';
import type { TypedUseSelectorHook } from 'react-redux';

// Импорт всех слайсов
import projectsReducer from './slices/projectsSlice';
import artifactsReducer from './slices/artifactsSlice';
import graphReducer from './slices/graphSlice';
import uiReducer from './slices/uiSlice';
import historyReducer from './slices/historySlice';  // 👈 новый импорт

export const store = configureStore({
  reducer: {
    projects: projectsReducer,
    artifacts: artifactsReducer,
    graph: graphReducer,
    ui: uiReducer,
    history: historyReducer,  // 👈 добавляем в store
  },
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware({
      serializableCheck: {
        // Игнорируем несериализуемые значения в определенных путях
        ignoredActions: ['history/recordAction/fulfilled'],
        ignoredPaths: ['history.actions.*.beforeState', 'history.actions.*.afterState'],
      },
    }),
});

// Infer the `RootState` and `AppDispatch` types from the store itself
export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;

// Use throughout your app instead of plain `useDispatch` and `useSelector`
export const useAppDispatch: () => AppDispatch = useDispatch;
export const useAppSelector: TypedUseSelectorHook<RootState> = useSelector;
