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
  setRedoAvailable
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
    if (isRecordingRef.current) {
      console.log('⏭️ Already recording, skipping');
      return;
    }

    isRecordingRef.current = true;
    setIsRecording(true);
    setLastError(null);
    
    const safeCurrentState = lastStateRef.current || {} as T;
    const beforeState = JSON.parse(JSON.stringify(safeCurrentState));
    let afterState: T;
    
    try {
      const result = await actionFn();
      
      if (result) {
        afterState = result as T;
      } else {
        await new Promise(resolve => setTimeout(resolve, 50));
        const safeNewState = lastStateRef.current || {} as T;
        afterState = JSON.parse(JSON.stringify(safeNewState));
      }
      
      const stateChanged = JSON.stringify(beforeState) !== JSON.stringify(afterState);
      
      if (!stateChanged) {
        console.log('⏭️ State unchanged, skipping history');
        isRecordingRef.current = false;
        setIsRecording(false);
        return;
      }
      
      console.log(`📝 Recording action: ${options.description}`);
      
      const safeDescription = options.description
        .replace(/[^\x00-\x7F]/g, '')
        .substring(0, 200);
      
      const actionData = {
        action_type: options.actionType,
        before_state: beforeState || {},
        after_state: afterState || {},
        description: safeDescription,
        user_type: options.pluginId ? 'plugin' : 'user',
        plugin_id: options.pluginId || null,
        group_id: options.groupId || null
      };
      
      // 1. Сохраняем в историю
      const historyResponse = await api.post(
        `/api/v2/artifacts/${artifactId}/history/actions`,
        actionData
      );
      
      const historyData = historyResponse.data;
      console.log('✅ Action recorded in history:', historyData.id);
      
      // 2. Обновляем артефакт через API
      const updateResponse = await api.put(
        `/api/v2/projects/${projectId}/artifacts/${artifactId}`,
        { data: afterState }
      );
      
      const updatedArtifact = updateResponse.data;
      console.log('✅ Artifact updated, new version:', updatedArtifact.version);
      
      // 3. Обновляем Redux store с актуальными данными из API
      dispatch(updateArtifactSync(updatedArtifact));
      lastStateRef.current = updatedArtifact.data;
      
      // 4. Вызываем callback для синхронизации (если нужно)
      onStateChange(updatedArtifact.data);
      
      // 5. Добавляем в историю Redux
      dispatch(addAction({
        id: historyData.id,
        artifactId,
        actionType: options.actionType,
        beforeState,
        afterState: updatedArtifact.data,
        timestamp: historyData.timestamp || new Date().toISOString(),
        description: options.description,
        userType: options.pluginId ? 'plugin' : 'user',
        pluginId: options.pluginId,
        groupId: options.groupId
      }));
      
      // 6. После нового действия REDO недоступен
      dispatch(setRedoAvailable(false));
      
      // 7. Обновляем историю
      await refreshHistory();
      
      console.log('✅ Action fully processed');
      
    } catch (error: any) {
      console.error('❌ Action failed:', error);
      setLastError(error as Error);
      
      try {
        onStateChange(beforeState);
        lastStateRef.current = beforeState;
        console.log('↩️ Rolled back to previous state');
      } catch (rollbackError) {
        console.error('❌ Rollback failed:', rollbackError);
      }
      
      throw error;
    } finally {
      isRecordingRef.current = false;
      setIsRecording(false);
    }
  }, [artifactId, projectId, onStateChange, dispatch, refreshHistory]);

  const undo = useCallback(async () => {
    if (!canUndo) {
      console.log('⏭️ Nothing to undo');
      return null;
    }
    
    console.log('⏪ Undo requested');
    setLastError(null);
    
    try {
      dispatch(clearError());
      
      const response = await api.post(`/api/v2/artifacts/${artifactId}/history/undo`);
      const data = response.data;
      
      console.log('✅ Undo response, action_id:', data.action_id);
      
      // Обновляем артефакт через API
      const updateResponse = await api.put(
        `/api/v2/projects/${projectId}/artifacts/${artifactId}`,
        { data: data.state }
      );
      
      const updatedArtifact = updateResponse.data;
      console.log('✅ Artifact restored to version:', updatedArtifact.version);
      
      // Обновляем Redux store
      dispatch(updateArtifactSync(updatedArtifact));
      lastStateRef.current = updatedArtifact.data;
      onStateChange(updatedArtifact.data);
      
      // После UNDO становится доступен REDO
      dispatch(setRedoAvailable(true));
      
      // Обновляем историю
      await refreshHistory();
      
      if (data.action_id) {
        dispatch(setCurrentIndex({ 
          actionId: data.action_id, 
          direction: 'undo' 
        }));
      }
      
      return data;
    } catch (error: any) {
      console.error('❌ Undo failed:', error);
      setLastError(error as Error);
      throw error;
    }
  }, [artifactId, projectId, onStateChange, dispatch, refreshHistory, canUndo]);

  const redo = useCallback(async () => {
    if (!canRedo) {
      console.log('⏭️ Nothing to redo');
      return null;
    }
    
    console.log('⏩ Redo requested');
    setLastError(null);
    
    try {
      dispatch(clearError());
      
      const response = await api.post(`/api/v2/artifacts/${artifactId}/history/redo`);
      const data = response.data;
      
      console.log('✅ Redo response, action_id:', data.action_id);
      
      // Обновляем артефакт через API
      const updateResponse = await api.put(
        `/api/v2/projects/${projectId}/artifacts/${artifactId}`,
        { data: data.state }
      );
      
      const updatedArtifact = updateResponse.data;
      console.log('✅ Artifact restored to version:', updatedArtifact.version);
      
      // Обновляем Redux store
      dispatch(updateArtifactSync(updatedArtifact));
      lastStateRef.current = updatedArtifact.data;
      onStateChange(updatedArtifact.data);
      
      // После REDO снова недоступен следующий REDO
      dispatch(setRedoAvailable(false));
      
      // Обновляем историю
      await refreshHistory();
      
      if (data.action_id) {
        dispatch(setCurrentIndex({ 
          actionId: data.action_id, 
          direction: 'redo' 
        }));
      }
      
      return data;
    } catch (error: any) {
      console.error('❌ Redo failed:', error);
      setLastError(error as Error);
      throw error;
    }
  }, [artifactId, projectId, onStateChange, dispatch, refreshHistory, canRedo]);

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