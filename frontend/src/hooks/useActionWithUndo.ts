// frontend/src/hooks/useActionWithUndo.ts
import { useCallback, useRef, useEffect } from 'react';
import { useAppDispatch } from '../store';
import { recordAction, undo as undoAction, redo as redoAction } from '../store/slices/historySlice';
// Удаляем неправильный импорт addAction
import { v4 as uuidv4 } from 'uuid';

export interface ActionOptions {
  description: string;
  actionType: string;
  groupId?: string;  // для группировки последовательных действий
  pluginId?: string;
  batch?: boolean;   // если true, не записываем сразу, ждем завершения батча
}

export interface ActionWithUndo<T> {
  /**
   * Выполнить действие с записью в историю
   * @param actionFn Функция, которая изменяет состояние
   * @param options Опции действия
   */
  execute: (actionFn: () => Promise<T> | T, options: ActionOptions) => Promise<T>;
  
  /**
   * Отменить последнее действие
   */
  undo: () => Promise<void>;
  
  /**
   * Повторить отмененное действие
   */
  redo: () => Promise<void>;
  
  /**
   * Начать группу действий (все последующие execute будут в одной группе)
   */
  startBatch: (description: string) => string;
  
  /**
   * Завершить группу действий и записать её в историю
   */
  endBatch: () => Promise<void>;
  
  /**
   * Можно ли отменить
   */
  canUndo: boolean;
  
  /**
   * Можно ли повторить
   */
  canRedo: boolean;
  
  /**
   * Текущее состояние истории (индекс)
   */
  currentIndex: number;
  
  /**
   * Количество действий в истории
   */
  historyLength: number;
}

export function useActionWithUndo<T extends object>(
  graphId: number,
  currentState: T,
  onStateChange: (newState: T) => Promise<void> | void,
  maxHistorySize: number = 100
): ActionWithUndo<T> {
  const dispatch = useAppDispatch();
  
  // Refs для управления группировкой
  const batchRef = useRef<{
    groupId: string;
    description: string;
    actions: Array<{ beforeState: T; afterState: T; options: ActionOptions }>;
    timeoutId?: NodeJS.Timeout;
  } | null>(null);
  
  // Refs для предотвращения рекурсии при undo/redo
  const isUndoRedoRef = useRef(false);
  
  // Состояние истории из Redux (будет обновляться через селектор в компоненте)
  // Здесь мы только используем его для canUndo/canRedo

  // ==========================================================================
  // Вспомогательные функции
  // ==========================================================================
  
  const deepClone = useCallback((obj: T): T => {
    return JSON.parse(JSON.stringify(obj));
  }, []);

  // ==========================================================================
  // Основные операции
  // ==========================================================================

  const execute = useCallback(async (
    actionFn: () => Promise<T> | T,
    options: ActionOptions
  ): Promise<T> => {
    // Если это undo/redo операция - пропускаем запись в историю
    if (isUndoRedoRef.current) {
      return actionFn();
    }

    // Сохраняем состояние ДО
    const beforeState = deepClone(currentState);
    
    try {
      // Выполняем действие
      const result = await actionFn();
      
      // Получаем состояние ПОСЛЕ (после выполнения actionFn состояние уже обновилось)
      // Но нам нужно подождать, пока React обработает обновление
      // Используем setTimeout чтобы дать React время
      setTimeout(async () => {
        const afterState = deepClone(currentState);
        
        // Если это батч-режим - добавляем в группу
        if (options.batch && batchRef.current) {
          batchRef.current.actions.push({
            beforeState,
            afterState,
            options
          });
          
          // Сбрасываем таймаут для завершения батча
          if (batchRef.current.timeoutId) {
            clearTimeout(batchRef.current.timeoutId);
          }
          
          // Устанавливаем новый таймаут (группируем действия за 500ms)
          batchRef.current.timeoutId = setTimeout(() => {
            if (batchRef.current && batchRef.current.actions.length > 0) {
              endBatch();
            }
          }, 500);
        } else {
          // Одиночное действие - записываем сразу
          await dispatch(recordAction({
            graphId,
            action: {
              graphId,
              actionType: options.actionType,
              beforeState,
              afterState,
              description: options.description,
              userType: options.pluginId ? 'plugin' : 'user',
              pluginId: options.pluginId,
              groupId: options.groupId
            }
          })).unwrap();
        }
      }, 0);
      
      return result;
    } catch (error) {
      console.error('Action failed:', error);
      throw error;
    }
  }, [graphId, currentState, deepClone, dispatch]);

  const undo = useCallback(async () => {
    if (isUndoRedoRef.current) return;
    
    isUndoRedoRef.current = true;
    try {
      const result = await dispatch(undoAction(graphId)).unwrap();
      if (result) {
        // Применяем состояние из ответа
        await onStateChange(result.state);
      }
    } catch (error) {
      console.error('Undo failed:', error);
    } finally {
      isUndoRedoRef.current = false;
    }
  }, [graphId, dispatch, onStateChange]);

  const redo = useCallback(async () => {
    if (isUndoRedoRef.current) return;
    
    isUndoRedoRef.current = true;
    try {
      const result = await dispatch(redoAction(graphId)).unwrap();
      if (result) {
        // Применяем состояние из ответа
        await onStateChange(result.state);
      }
    } catch (error) {
      console.error('Redo failed:', error);
    } finally {
      isUndoRedoRef.current = false;
    }
  }, [graphId, dispatch, onStateChange]);

  // ==========================================================================
  // Batch операции
  // ==========================================================================

  const startBatch = useCallback((description: string): string => {
    const groupId = uuidv4();
    batchRef.current = {
      groupId,
      description,
      actions: []
    };
    return groupId;
  }, []);

  const endBatch = useCallback(async () => {
    if (!batchRef.current || batchRef.current.actions.length === 0) {
      batchRef.current = null;
      return;
    }

    const batch = batchRef.current;
    
    // Берем первое состояние ДО и последнее состояние ПОСЛЕ
    const beforeState = batch.actions[0].beforeState;
    const afterState = batch.actions[batch.actions.length - 1].afterState;
    
    // Записываем как одно действие
    await dispatch(recordAction({
      graphId,
      action: {
        graphId,
        actionType: 'batch',
        beforeState,
        afterState,
        description: batch.description,
        userType: 'user',
        groupId: batch.groupId
      }
    })).unwrap();
    
    batchRef.current = null;
  }, [graphId, dispatch]);

  // ==========================================================================
  // Cleanup
  // ==========================================================================

  useEffect(() => {
    return () => {
      if (batchRef.current?.timeoutId) {
        clearTimeout(batchRef.current.timeoutId);
      }
    };
  }, []);

  // ==========================================================================
  // Return
  // ==========================================================================

  return {
    execute,
    undo,
    redo,
    startBatch,
    endBatch,
    canUndo: true, // Эти значения будут приходить из Redux селектора
    canRedo: true, // В компоненте мы будем использовать useSelector
    currentIndex: -1,
    historyLength: 0
  };
}
