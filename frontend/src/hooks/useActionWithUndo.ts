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
  actionType: string;  // 'add_node', 'delete_edge', 'move_node', 'batch_move', etc.
  groupId?: string;    // для группировки последовательных действий
  pluginId?: string;   // если действие от плагина
}

export function useActionWithUndo<T extends object>(
  artifactId: number,
  currentState: T,
  onStateChange: (newState: T) => Promise<void> | void
) {
  const dispatch = useAppDispatch();
  const isRecordingRef = useRef(false);
  
  // Состояния для индикации записи и ошибок
  const [isRecording, setIsRecording] = useState(false);
  const [lastError, setLastError] = useState<Error | null>(null);
  
  // Селекторы из historySlice
  const canUndo = useAppSelector(selectCanUndo);
  const canRedo = useAppSelector(selectCanRedo);

  /**
   * Создать группу для batch-операций (например, множественное перемещение узлов)
   */
  const createBatchGroup = useCallback(() => {
    return `batch_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }, []);

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
    setIsRecording(true);
    setLastError(null);
    
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
        await new Promise(resolve => setTimeout(resolve, 50));
        afterState = JSON.parse(JSON.stringify(currentState));
      }
      
      // Проверяем, изменилось ли состояние
      const stateChanged = JSON.stringify(beforeState) !== JSON.stringify(afterState);
      
      if (!stateChanged) {
        console.log('⏭️ State unchanged, skipping history');
        isRecordingRef.current = false;
        setIsRecording(false);
        return;
      }
      
      console.log(`📝 Recording action: ${options.description}`);
      
      // Отправляем на сервер - ВСЕ ПОЛЯ ОБЯЗАТЕЛЬНЫ!
      const actionData = {
        action_type: options.actionType,
        before_state: beforeState,
        after_state: afterState,
        description: options.description,
        user_type: options.pluginId ? 'plugin' : 'user',
        plugin_id: options.pluginId || null,
        group_id: options.groupId || null
      };
      
      console.log('Sending action data:', actionData);
      
      const response = await api.post(
        `/api/v2/artifacts/${artifactId}/history/actions`,
        actionData
      );
      
      // ИЗВЛЕКАЕМ DATA ИЗ ОТВЕТА
      const data = response.data;
      
      console.log('✅ Action recorded, response data:', data);
      
      // Добавляем в Redux - используем data вместо response
      dispatch(addAction({
        id: data.id,
        artifactId,
        actionType: options.actionType,
        beforeState,
        afterState,
        timestamp: data.timestamp || new Date().toISOString(),
        description: options.description,
        userType: options.pluginId ? 'plugin' : 'user',
        pluginId: options.pluginId,
        groupId: options.groupId
      }));
      
    } catch (error) {
      console.error('❌ Action failed:', error);
      setLastError(error as Error);
      
      // Пытаемся откатить изменения
      try {
        await onStateChange(beforeState);
        console.log('↩️ Rolled back to previous state');
      } catch (rollbackError) {
        console.error('❌ Rollback failed:', rollbackError);
      }
      
      // Пробрасываем ошибку дальше, чтобы компонент мог ее обработать
      throw error;
    } finally {
      isRecordingRef.current = false;
      setIsRecording(false);
    }
  }, [artifactId, currentState, onStateChange, dispatch]);

  /**
   * Отменить последнее действие
   */
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
      
      // ИЗВЛЕКАЕМ DATA ИЗ ОТВЕТА
      const data = response.data;
      
      console.log('✅ Undo response data:', data);
      
      // Применяем состояние от сервера - используем data.state
      await onStateChange(data.state);
      
      // Обновляем индекс в истории - используем data.action_id
      if (data.action_id) {
        dispatch(setCurrentIndex({ 
          actionId: data.action_id, 
          direction: 'undo' 
        }));
      }
      
      return data; // Возвращаем data вместо response
    } catch (error: any) {
      console.error('❌ Undo failed:', error);
      
      if (error.status === 404) {
        console.log('ℹ️ No actions to undo');
        return null;
      }
      
      setLastError(error as Error);
      throw error;
    }
  }, [artifactId, onStateChange, dispatch, canUndo]);

  /**
   * Повторить отмененное действие
   */
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
      
      // ИЗВЛЕКАЕМ DATA ИЗ ОТВЕТА
      const data = response.data;
      
      console.log('✅ Redo response data:', data);
      
      // Применяем состояние от сервера - используем data.state
      await onStateChange(data.state);
      
      // Обновляем индекс в истории - используем data.action_id
      if (data.action_id) {
        dispatch(setCurrentIndex({ 
          actionId: data.action_id, 
          direction: 'redo' 
        }));
      }
      
      return data; // Возвращаем data вместо response
    } catch (error: any) {
      console.error('❌ Redo failed:', error);
      
      if (error.status === 404) {
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