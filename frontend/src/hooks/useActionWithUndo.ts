// frontend/src/hooks/useActionWithUndo.ts
import { useCallback, useRef, useState } from 'react';
import { useAppDispatch, useAppSelector } from '../store';
import { api } from '../services/api';
import { 
  addAction, 
  setCurrentIndex, 
  clearError,
  selectCanUndo,
  selectCanRedo 
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
  onStateChange: (newState: T) => Promise<void> | void
) {
  const dispatch = useAppDispatch();
  const isRecordingRef = useRef(false);
  
  const [isRecording, setIsRecording] = useState(false);
  const [lastError, setLastError] = useState<Error | null>(null);
  
  const canUndo = useAppSelector(selectCanUndo);
  const canRedo = useAppSelector(selectCanRedo);

  const createBatchGroup = useCallback(() => {
    // Генерируем валидный UUID v4
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
    
    const safeCurrentState = currentState || {} as T;
    const beforeState = JSON.parse(JSON.stringify(safeCurrentState));
    let afterState: T;
    
    try {
      const result = await actionFn();
      
      if (result) {
        afterState = result as T;
        await onStateChange(afterState);
      } else {
        await new Promise(resolve => setTimeout(resolve, 50));
        const safeNewState = currentState || {} as T;
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
      
      // Экранируем описание на всякий случай
      const safeDescription = options.description
        .replace(/[^\x00-\x7F]/g, '') // Удаляем не-ASCII символы для теста
        .substring(0, 200);
      
      const actionData = {
        action_type: options.actionType,
        before_state: beforeState || {},
        after_state: afterState || {},
        description: safeDescription,
        user_type: options.pluginId ? 'plugin' : 'user',
        plugin_id: options.pluginId || null,
        // group_id должен быть валидным UUID или null
        group_id: options.groupId || null  // Теперь groupId будет валидным UUID
      };
      
      console.log('📦 SENDING ACTION DATA:', JSON.stringify(actionData, null, 2));
      
      const response = await api.post(
        `/api/v2/artifacts/${artifactId}/history/actions`,
        actionData
      );
      
      const data = response.data;
      console.log('✅ Action recorded:', data);
      
      dispatch(addAction({
        id: data.id,
        artifactId,
        actionType: options.actionType,
        beforeState,
        afterState,
        timestamp: data.timestamp || new Date().toISOString(),
        description: options.description, // Сохраняем оригинальное описание в Redux
        userType: options.pluginId ? 'plugin' : 'user',
        pluginId: options.pluginId,
        groupId: options.groupId
      }));
      
    } catch (error: any) {
      console.error('❌ Action failed:', error);
      if (error.response) {
        console.error('  Status:', error.response.status);
        console.error('  Data:', error.response.data);
        console.error('  Headers:', error.response.headers);
      }
      setLastError(error as Error);
      
      try {
        await onStateChange(beforeState);
        console.log('↩️ Rolled back to previous state');
      } catch (rollbackError) {
        console.error('❌ Rollback failed:', rollbackError);
      }
      
      throw error;
    } finally {
      isRecordingRef.current = false;
      setIsRecording(false);
    }
  }, [artifactId, currentState, onStateChange, dispatch]);

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
      
      console.log('✅ Undo response:', data);
      await onStateChange(data.state);
      
      if (data.action_id) {
        dispatch(setCurrentIndex({ 
          actionId: data.action_id, 
          direction: 'undo' 
        }));
      }
      
      return data;
    } catch (error: any) {
      console.error('❌ Undo failed:', error);
      if (error.response?.status === 404) {
        console.log('ℹ️ No actions to undo');
        return null;
      }
      setLastError(error as Error);
      throw error;
    }
  }, [artifactId, onStateChange, dispatch, canUndo]);

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
      
      console.log('✅ Redo response:', data);
      await onStateChange(data.state);
      
      if (data.action_id) {
        dispatch(setCurrentIndex({ 
          actionId: data.action_id, 
          direction: 'redo' 
        }));
      }
      
      return data;
    } catch (error: any) {
      console.error('❌ Redo failed:', error);
      if (error.response?.status === 404) {
        console.log('ℹ️ No actions to redo');
        return null;
      }
      setLastError(error as Error);
      throw error;
    }
  }, [artifactId, onStateChange, dispatch, canRedo]);

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