// frontend/src/hooks/useActionWithUndo.ts
import { useCallback, useRef, useState, useEffect } from 'react';
import { useAppDispatch, useAppSelector } from '../store';
import { api } from '../services/api';
import { updateArtifactSync } from '../store/slices/artifactsSlice';
import { 
  addAction, 
  setCurrentIndex, 
  clearError,
  selectCanUndo,
  selectCanRedo,
  setHistoryActions,
  setRedoAvailable  // Добавляем
} from '../store/slices/historySlice';

interface ActionOptions {
  description: string;
  actionType: string;
  groupId?: string;
  pluginId?: string;
}

export function useActionWithUndo<T extends object>(
  artifactId: number,
  currentState: T,
  onStateChange: (newState: T) => void,
  projectId: number = 1
) {
  const dispatch = useAppDispatch();
  const isRecordingRef = useRef(false);
  const lastStateRef = useRef<T>(currentState);
  
  const [isRecording, setIsRecording] = useState(false);
  const [lastError, setLastError] = useState<Error | null>(null);
  
  const canUndo = useAppSelector(selectCanUndo);
  const canRedo = useAppSelector(selectCanRedo);

  useEffect(() => {
    lastStateRef.current = currentState;
  }, [currentState]);

  const refreshHistory = useCallback(async () => {
    try {
      const response = await api.get(`/api/v2/artifacts/${artifactId}/history?limit=100`);
      dispatch(setHistoryActions(response.data));
    } catch (error) {
      console.error('Failed to refresh history:', error);
    }
  }, [artifactId, dispatch]);

  const createBatchGroup = useCallback(() => {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
      const r = Math.random() * 16 | 0;
      const v = c === 'x' ? r : (r & 0x3 | 0x8);
      return v.toString(16);
    });
  }, []);

  const execute = useCallback(async (
    actionFn: () => Promise<T | void> | T | void,
    options: ActionOptions
  ) => {
    if (isRecordingRef.current) return;

    isRecordingRef.current = true;
    setIsRecording(true);
    setLastError(null);
    
    const beforeState = JSON.parse(JSON.stringify(lastStateRef.current || {}));
    let afterState: T;
    
    try {
      const result = await actionFn();
      afterState = (result as T) || JSON.parse(JSON.stringify(lastStateRef.current || {}));
      
      // 1. Сохраняем в историю
      await api.post(`/api/v2/artifacts/${artifactId}/history/actions`, {
        action_type: options.actionType,
        before_state: beforeState,
        after_state: afterState,
        description: options.description.substring(0, 200),
        user_type: options.pluginId ? 'plugin' : 'user',
        plugin_id: options.pluginId || null,
        group_id: options.groupId || null
      });
      
      // 2. Обновляем артефакт
      const updateResponse = await api.put(
        `/api/v2/projects/${projectId}/artifacts/${artifactId}`,
        { data: afterState }
      );
      
      // 3. Обновляем Redux
      dispatch(updateArtifactSync(updateResponse.data));
      lastStateRef.current = updateResponse.data.data;
      
      // 4. Обновляем историю и сбрасываем REDO
      await refreshHistory();
      dispatch(setRedoAvailable(false));  // Новое действие — REDO недоступен
      
    } catch (error: any) {
      console.error('Action failed:', error);
      setLastError(error);
    } finally {
      isRecordingRef.current = false;
      setIsRecording(false);
    }
  }, [artifactId, projectId, dispatch, refreshHistory]);

  const undo = useCallback(async () => {
    if (!canUndo) return;
    
    try {
      const response = await api.post(`/api/v2/artifacts/${artifactId}/history/undo`);
      const updateResponse = await api.put(
        `/api/v2/projects/${projectId}/artifacts/${artifactId}`,
        { data: response.data.state }
      );
      dispatch(updateArtifactSync(updateResponse.data));
      lastStateRef.current = updateResponse.data.data;
      await refreshHistory();
      dispatch(setRedoAvailable(true));  // После UNDO можно сделать REDO
    } catch (error) {
      console.error('Undo failed:', error);
    }
  }, [artifactId, projectId, dispatch, refreshHistory, canUndo]);

  const redo = useCallback(async () => {
    if (!canRedo) return;
    
    try {
      const response = await api.post(`/api/v2/artifacts/${artifactId}/history/redo`);
      const updateResponse = await api.put(
        `/api/v2/projects/${projectId}/artifacts/${artifactId}`,
        { data: response.data.state }
      );
      dispatch(updateArtifactSync(updateResponse.data));
      lastStateRef.current = updateResponse.data.data;
      await refreshHistory();
      dispatch(setRedoAvailable(false));  // После REDO следующий REDO недоступен
    } catch (error) {
      console.error('Redo failed:', error);
    }
  }, [artifactId, projectId, dispatch, refreshHistory, canRedo]);

  return {
    execute,
    undo,
    redo,
    createBatchGroup,
    isRecording,
    lastError,
    canUndo,
    canRedo
  };
}