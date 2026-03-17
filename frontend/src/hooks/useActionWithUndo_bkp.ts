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

interface BatchMove {
  [nodeId: string]: { x: number; y: number };
}

export function useActionWithUndo<T extends object>(
  artifactId: number,
  currentState: T,
  onStateChange: (newState: T) => Promise<void> | void
) {
  const dispatch = useAppDispatch();
  const pendingBatch = useRef<{ moves: BatchMove; timeout: NodeJS.Timeout | null }>({
    moves: {},
    timeout: null
  });

  /**
   * Выполнить действие с записью в историю
   */
  const execute = useCallback(async (
    actionFn: () => Promise<void> | void,
    options: ActionOptions
  ) => {
    // Сохраняем состояние ДО
    const beforeState = JSON.parse(JSON.stringify(currentState));
    
    try {
      // Выполняем действие
      await actionFn();
      
      // Получаем состояние ПОСЛЕ
      const afterState = JSON.parse(JSON.stringify(currentState));
      
      // Если состояние не изменилось - не записываем
      if (JSON.stringify(beforeState) === JSON.stringify(afterState)) {
        console.log('⏭️ State unchanged, skipping history');
        return;
      }
      
      // Создаем запись
      const actionData = {
        action_type: options.actionType,
        before_state: beforeState,
        after_state: afterState,
        description: options.description,
        user_type: options.pluginId ? 'plugin' : 'user',
        plugin_id: options.pluginId,
        group_id: options.groupId
      };
      
      console.log(`📝 Recording action: ${options.description}`);
      
      // Отправляем на сервер
      const response = await api.post(
        `/api/v2/artifacts/${artifactId}/history/actions`,
        actionData
      );
      
      // Добавляем в Redux
      dispatch(addAction({
        id: response.id,
        artifactId,
        actionType: options.actionType,
        beforeState,
        afterState,
        timestamp: response.timestamp || new Date().toISOString(),
        description: options.description,
        userType: actionData.user_type,
        pluginId: options.pluginId,
        groupId: options.groupId
      }));
      
      console.log(`✅ Action recorded: ${options.description}`);
    } catch (error) {
      console.error('❌ Action failed:', error);
      // Пытаемся откатить изменения
      try {
        await onStateChange(beforeState);
      } catch (rollbackError) {
        console.error('❌ Rollback failed:', rollbackError);
      }
      throw error;
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
      
      // Показываем понятное сообщение
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

  /**
   * Группировка перемещений (batch)
   */
  const queueMove = useCallback((nodeId: string, x: number, y: number) => {
    // Добавляем в очередь
    pendingBatch.current.moves[nodeId] = { x, y };
    
    // Отменяем предыдущий таймаут
    if (pendingBatch.current.timeout) {
      clearTimeout(pendingBatch.current.timeout);
    }
    
    // Устанавливаем новый таймаут
    pendingBatch.current.timeout = setTimeout(async () => {
      const movesToApply = { ...pendingBatch.current.moves };
      const moveCount = Object.keys(movesToApply).length;
      
      if (moveCount === 0) return;
      
      console.log(`📦 Executing batch move of ${moveCount} nodes`);
      
      await execute(
        async () => {
          // Применяем все перемещения
          for (const [nodeId, pos] of Object.entries(movesToApply)) {
            await onStateChange({
              ...currentState,
              nodes: (currentState as any).nodes?.map((node: any) =>
                node.id === nodeId
                  ? { ...node, x: pos.x, y: pos.y }
                  : node
              )
            });
          }
        },
        {
          description: moveCount === 1 
            ? `Перемещение узла` 
            : `Перемещение ${moveCount} узлов`,
          actionType: 'batch_move'
        }
      );
      
      // Очищаем очередь
      pendingBatch.current.moves = {};
      pendingBatch.current.timeout = null;
    }, 500); // Группируем за 500ms
  }, [currentState, onStateChange, execute]);

  return {
    execute,
    undo,
    redo,
    queueMove,
    canUndo: true, // Доверяем серверу, а не локальному стейту
    canRedo: true
  };
}
