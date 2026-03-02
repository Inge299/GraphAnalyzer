// frontend/src/store/index.ts
import { configureStore } from '@reduxjs/toolkit';
import uiReducer from './slices/uiSlice';
import projectsReducer from './slices/projectsSlice';
import artifactsReducer from './slices/artifactsSlice';
// Старый graphSlice пока оставляем для обратной совместимости
import graphReducer from './slices/graphSlice';

export const store = configureStore({
  reducer: {
    ui: uiReducer,
    projects: projectsReducer,
    artifacts: artifactsReducer,
    graph: graphReducer, // пока оставляем, постепенно заменится на artifacts
  },
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware({
      serializableCheck: {
        // Игнорируем несериализуемые значения в определенных путях
        ignoredActions: ['artifacts/setGraphData'],
      },
    }),
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;