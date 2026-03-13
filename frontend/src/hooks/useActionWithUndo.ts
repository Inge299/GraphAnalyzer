// frontend/src/hooks/useActionWithUndo.ts
import { useCallback, useRef, useEffect } from 'react';
import { useAppDispatch } from '../store';
import { recordAction, undo as undoAction, redo as redoAction } from '../store/slices/historySlice';
import { v4 as uuidv4 } from 'uuid';

export interface ActionOptions {
  description: string;
  actionType: string;
  groupId?: string;
  pluginId?: string;
  batch?: boolean;
}

export interface ActionWithUndo<T> {
  execute: (actionFn: () => Promise<T> | T, options: ActionOptions) => Promise<T>;
  undo: () => Promise<void>;
  redo: () => Promise<void>;
  startBatch: (description: string) => string;
  endBatch: () => Promise<void>;
  canUndo: boolean;
  canRedo: boolean;
  currentIndex: number;
  historyLength: number;
}

export function useActionWithUndo<T extends object>(
  artifactId: number,
  currentState: T,
  onStateChange: (newState: T) => Promise<void> | void,
  maxHistorySize: number = 100
): ActionWithUndo<T> {
  const dispatch = useAppDispatch();
  
  const batchRef = useRef<{
    groupId: string;
    description: string;
    actions: Array<{ beforeState: T; afterState: T; options: ActionOptions }>;
    timeoutId?: NodeJS.Timeout;
  } | null>(null);
  
  const isUndoRedoRef = useRef(false);
  
  const deepClone = useCallback((obj: T): T => {
    return JSON.parse(JSON.stringify(obj));
  }, []);

  const execute = useCallback(async (
    actionFn: () => Promise<T> | T,
    options: ActionOptions
  ): Promise<T> => {
    if (isUndoRedoRef.current) {
      return actionFn();
    }

    const beforeState = deepClone(currentState);
    
    try {
      const result = await actionFn();
      
      setTimeout(async () => {
        const afterState = deepClone(currentState);
        
        if (options.batch && batchRef.current) {
          batchRef.current.actions.push({
            beforeState,
            afterState,
            options
          });
          
          if (batchRef.current.timeoutId) {
            clearTimeout(batchRef.current.timeoutId);
          }
          
          batchRef.current.timeoutId = setTimeout(() => {
            if (batchRef.current && batchRef.current.actions.length > 0) {
              endBatch();
            }
          }, 500);
        } else {
          try {
            await dispatch(recordAction({
              artifactId,
              action: {
                action_type: options.actionType,
                before_state: beforeState,
                after_state: afterState,
                description: options.description,
                user_type: options.pluginId ? 'plugin' : 'user',
                plugin_id: options.pluginId,
                group_id: options.groupId
              }
            })).unwrap();
            console.log('✅ Action recorded:', options.description);
          } catch (error) {
            console.error('❌ Failed to record action:', error);
          }
        }
      }, 0);
      
      return result;
    } catch (error) {
      console.error('❌ Action failed:', error);
      throw error;
    }
  }, [artifactId, currentState, deepClone, dispatch]);

  const undo = useCallback(async () => {
    if (isUndoRedoRef.current) return;
    
    isUndoRedoRef.current = true;
    try {
      const result = await dispatch(undoAction(artifactId)).unwrap();
      if (result) {
        await onStateChange(result.state);
        console.log('⏪ Undo successful');
      }
    } catch (error) {
      console.error('❌ Undo failed:', error);
    } finally {
      isUndoRedoRef.current = false;
    }
  }, [artifactId, dispatch, onStateChange]);

  const redo = useCallback(async () => {
    if (isUndoRedoRef.current) return;
    
    isUndoRedoRef.current = true;
    try {
      const result = await dispatch(redoAction(artifactId)).unwrap();
      if (result) {
        await onStateChange(result.state);
        console.log('⏩ Redo successful');
      }
    } catch (error) {
      console.error('❌ Redo failed:', error);
    } finally {
      isUndoRedoRef.current = false;
    }
  }, [artifactId, dispatch, onStateChange]);

  const startBatch = useCallback((description: string): string => {
    const groupId = uuidv4();
    console.log('📦 Batch started:', { description, groupId });
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
    const beforeState = batch.actions[0].beforeState;
    const afterState = batch.actions[batch.actions.length - 1].afterState;
    
    try {
      await dispatch(recordAction({
        artifactId,
        action: {
          action_type: 'batch',
          before_state: beforeState,
          after_state: afterState,
          description: batch.description,
          user_type: 'user',
          group_id: batch.groupId
        }
      })).unwrap();
      console.log('📦 Batch recorded:', batch.description, batch.actions.length);
    } catch (error) {
      console.error('❌ Failed to record batch:', error);
    }
    
    batchRef.current = null;
  }, [artifactId, dispatch]);

  useEffect(() => {
    return () => {
      if (batchRef.current?.timeoutId) {
        clearTimeout(batchRef.current.timeoutId);
      }
    };
  }, []);

  return {
    execute,
    undo,
    redo,
    startBatch,
    endBatch,
    canUndo: true,
    canRedo: true,
    currentIndex: -1,
    historyLength: 0
  };
}
