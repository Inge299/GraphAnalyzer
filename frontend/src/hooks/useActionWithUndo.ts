// frontend/src/hooks/useActionWithUndo.ts
import { useCallback, useRef } from 'react';
import { useAppDispatch } from '../store';
import { api } from '../services/api';
import { addAction, setCurrentIndex, clearError } from '../store/slices/historySlice';
import { v4 as uuidv4 } from 'uuid';

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

  /**
   * Выполнить действие с записью в историю
   */
  const execute = useCallback(async (
    actionFn: () => Promise<T | void> | T | void,
    options: ActionOptions
  ) => {
    // Предотвращаем повторную запись
    if (isRecordingRef.current) {
      console.log('⏭️ Already recording, skipping');
      return;
    }

    isRecordingRef.current = true;
    
    // Сохраняем состояние ДО
    const beforeState = JSON.parse(JSON.stringify(currentState));
    let afterState: T;
    
    try {
      // Выполняем действие и получаем новое состояние
      const result = await actionFn();
      
      // Если actionFn вернула новое состояние, используем его
      if (result) {
        afterState = result as T;
        // Обновляем состояние через onStateChange
        await onStateChange(afterState);
      } else {
        // Иначе ждем обновления React состояния
        await new Promise(resolve => setTimeout(resolve, 100));
        afterState = JSON.parse(JSON.stringify(currentState));
      }
      
      // Проверяем, изменилось ли состояние
      const stateChanged = JSON.stringify(beforeState) !== JSON.stringify(afterState);
      
      if (!stateChanged) {
        console.log('⏭️ State unchanged, skipping history');
        isRecordingRef.current = false;
        return;
      }
      
      console.log(`📝 Recording action: ${options.description}`, { beforeState, afterState });
      
      // Отправляем на сервер - ВСЕ ПОЛЯ ОБЯЗАТЕЛЬНЫ!
      const actionData = {
        action_type: options.actionType,
        before_state: beforeState,
        after_state: afterState,
        description: options.description,
        user_type: options.pluginId ? 'plugin' : 'user',  // 'user' по умолчанию
        plugin_id: options.pluginId || null,  // Явно передаем null если нет
        group_id: options.groupId || null     // Явно передаем null если нет
      };
      
      console.log('Sending action data:', actionData);
      
      const response = await api.post(
        `/api/v2/artifacts/${artifactId}/history/actions`,
        actionData
      );
      
      console.log('✅ Action recorded, response:', response);
      
      // Добавляем в Redux
      dispatch(addAction({
        id: response.id,
        artifactId,
        actionType: options.actionType,
        beforeState,
        afterState,
        timestamp: response.timestamp || new Date().toISOString(),
        description: options.description,
        userType: options.pluginId ? 'plugin' : 'user',
        pluginId: options.pluginId,
        groupId: options.groupId
      }));
      
    } catch (error) {
      console.error('❌ Action failed:', error);
      throw error;
    } finally {
      isRecordingRef.current = false;
    }
  }, [artifactId, currentState, onStateChange, dispatch]);

  /**
   * Отменить последнее действие
   */
  const undo = useCallback(async () => {
    console.log('⏪ Undo requested');
    
    try {
      dispatch(clearError());
      
      const response = await api.post(`/api/v2/artifacts/${artifactId}/history/undo`);
      
      console.log('✅ Undo response:', response);
      
      // Применяем состояние от сервера
      await onStateChange(response.state);
      
      // Обновляем индекс в истории
      if (response.action_id) {
        dispatch(setCurrentIndex({ 
          actionId: response.action_id, 
          direction: 'undo' 
        }));
      }
      
      return response;
    } catch (error: any) {
      console.error('❌ Undo failed:', error);
      
      if (error.status === 404) {
        console.log('ℹ️ No actions to undo');
        return null;
      }
      
      throw error;
    }
  }, [artifactId, onStateChange, dispatch]);

  /**
   * Повторить отмененное действие
   */
  const redo = useCallback(async () => {
    console.log('⏩ Redo requested');
    
    try {
      dispatch(clearError());
      
      const response = await api.post(`/api/v2/artifacts/${artifactId}/history/redo`);
      
      console.log('✅ Redo response:', response);
      
      // Применяем состояние от сервера
      await onStateChange(response.state);
      
      // Обновляем индекс в истории
      if (response.action_id) {
        dispatch(setCurrentIndex({ 
          actionId: response.action_id, 
          direction: 'redo' 
        }));
      }
      
      return response;
    } catch (error: any) {
      console.error('❌ Redo failed:', error);
      
      if (error.status === 404) {
        console.log('ℹ️ No actions to redo');
        return null;
      }
      
      throw error;
    }
  }, [artifactId, onStateChange, dispatch]);

  return {
    execute,
    undo,
    redo,
    canUndo: true,
    canRedo: true
  };
}
