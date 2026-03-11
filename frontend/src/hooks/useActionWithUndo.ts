// frontend/src/hooks/useActionWithUndo.ts
import { useCallback } from 'react';
import { useAppDispatch, useAppSelector } from '../store';
import { addAction } from '../store/slices/historySlice';
import { v4 as uuidv4 } from 'uuid';

export const useActionWithUndo = (graphId: number) => {
  const dispatch = useAppDispatch();
  const currentState = useAppSelector(state => state.graph);

  const executeAction = useCallback((
    actionType: string,
    actionFn: () => void,
    description: string
  ) => {
    // Глубокое копирование состояния ДО
    const beforeState = JSON.parse(JSON.stringify(currentState));
    
    // Выполняем действие
    actionFn();
    
    // Глубокое копирование состояния ПОСЛЕ
    const afterState = JSON.parse(JSON.stringify(currentState));
    
    // Создаем запись в истории
    const historyAction = {
      id: uuidv4(),
      graphId,
      actionType,
      beforeState,
      afterState,
      timestamp: new Date().toISOString(),
      description
    };
    
    dispatch(addAction(historyAction));
  }, [graphId, dispatch, currentState]);

  return { executeAction };
};
