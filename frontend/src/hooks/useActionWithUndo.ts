// frontend/src/hooks/useActionWithUndo.ts
import { useCallback, useRef, useState, useEffect } from 'react';
import { useAppDispatch, useAppSelector } from '../store';
import { api } from '../services/api';
import { updateArtifactSync } from '../store/slices/artifactsSlice';
import {
  addAction,
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

interface HistoryActionDto {
  id: string;
  artifact_id: number;
  action_type: string;
  before_state: any;
  after_state: any;
  timestamp: string;
  description: string;
  user_type: 'user' | 'plugin';
  plugin_id?: string | null;
  group_id?: string | null;
}

const HISTORY_REFRESH_DEBOUNCE_MS = 800;

export function useActionWithUndo<T extends object>(
  artifactId: number,
  currentState: T,
  onStateChange: (newState: T) => void,
  projectId: number = 1
) {
  const dispatch = useAppDispatch();
  const isRecordingRef = useRef(false);
  const lastStateRef = useRef<T>(currentState);
  const historyRefreshTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const historyMutationInFlightRef = useRef(false);

  const [isRecording, setIsRecording] = useState(false);
  const [lastError, setLastError] = useState<Error | null>(null);

  const canUndo = useAppSelector(selectCanUndo);
  const canRedo = useAppSelector(selectCanRedo);

  useEffect(() => {
    lastStateRef.current = currentState;
  }, [currentState]);

  useEffect(() => {
    return () => {
      if (historyRefreshTimerRef.current) {
        clearTimeout(historyRefreshTimerRef.current);
      }
    };
  }, []);

  const refreshHistory = useCallback(async () => {
    try {
      const response = await api.get(`/api/v2/artifacts/${artifactId}/history?limit=100`);
      dispatch(setHistoryActions(response.data));
    } catch (error) {
      console.error('Failed to refresh history:', error);
    }
  }, [artifactId, dispatch]);

  const scheduleHistoryRefresh = useCallback(() => {
    if (historyRefreshTimerRef.current) {
      clearTimeout(historyRefreshTimerRef.current);
    }
    historyRefreshTimerRef.current = setTimeout(() => {
      historyRefreshTimerRef.current = null;
      void refreshHistory();
    }, HISTORY_REFRESH_DEBOUNCE_MS);
  }, [refreshHistory]);

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

      // 1) Р вЂ”Р В°Р С—Р С‘РЎРѓРЎвЂ№Р Р†Р В°Р ВµР С Р Т‘Р ВµР в„–РЎРѓРЎвЂљР Р†Р С‘Р Вµ Р Р† Р С‘РЎРѓРЎвЂљР С•РЎР‚Р С‘РЎР‹
      const historyResponse = await api.post<HistoryActionDto>(`/api/v2/artifacts/${artifactId}/history/actions`, {
        action_type: options.actionType,
        before_state: beforeState,
        after_state: afterState,
        description: options.description.substring(0, 200),
        user_type: options.pluginId ? 'plugin' : 'user',
        plugin_id: options.pluginId || null,
        group_id: options.groupId || null
      });

      // 2) Р С›Р В±Р Р…Р С•Р Р†Р В»РЎРЏР ВµР С Р В°РЎР‚РЎвЂљР ВµРЎвЂћР В°Р С”РЎвЂљ
      const updateResponse = await api.put(
        `/api/v2/projects/${projectId}/artifacts/${artifactId}`,
        { data: afterState }
      );

      // 3) Р С›Р В±Р Р…Р С•Р Р†Р В»РЎРЏР ВµР С Redux Р В°РЎР‚РЎвЂљР ВµРЎвЂћР В°Р С”РЎвЂљР С•Р Р†
      dispatch(updateArtifactSync(updateResponse.data));
      lastStateRef.current = updateResponse.data.data;
      onStateChange(lastStateRef.current as T);

      // 4) Р вЂєР С•Р С”Р В°Р В»РЎРЉР Р…Р С• Р Т‘Р С•Р В±Р В°Р Р†Р В»РЎРЏР ВµР С Р В·Р В°Р С—Р С‘РЎРѓРЎРЉ Р Р† Р С‘РЎРѓРЎвЂљР С•РЎР‚Р С‘РЎР‹ Р Т‘Р В»РЎРЏ Р СР С–Р Р…Р С•Р Р†Р ВµР Р…Р Р…Р С•Р С–Р С• UI
      dispatch(addAction({
        id: String(historyResponse.data.id),
        artifactId: Number(historyResponse.data.artifact_id),
        actionType: String(historyResponse.data.action_type),
        beforeState: historyResponse.data.before_state,
        afterState: historyResponse.data.after_state,
        timestamp: String(historyResponse.data.timestamp),
        description: String(historyResponse.data.description || options.description),
        userType: historyResponse.data.user_type || 'user',
        pluginId: historyResponse.data.plugin_id || undefined,
        groupId: historyResponse.data.group_id || undefined
      }));

      // 5) Р СњР С•Р Р†РЎвЂ№Р в„– action Р С‘Р Р…Р Р†Р В°Р В»Р С‘Р Т‘Р С‘РЎР‚РЎС“Р ВµРЎвЂљ redo, Р В° РЎРѓР С‘Р Р…РЎвЂ¦РЎР‚Р С•Р Р…Р С‘Р В·Р В°РЎвЂ Р С‘РЎР‹ Р С‘РЎРѓРЎвЂљР С•РЎР‚Р С‘Р С‘ Р Т‘Р ВµР В»Р В°Р ВµР С Р Р† РЎвЂћР С•Р Р…Р Вµ
      dispatch(setRedoAvailable(false));
      scheduleHistoryRefresh();
    } catch (error: any) {
      console.error('Action failed:', error);
      setLastError(error);
    } finally {
      isRecordingRef.current = false;
      setIsRecording(false);
    }
  }, [artifactId, projectId, dispatch, scheduleHistoryRefresh, onStateChange]);

  const undo = useCallback(async () => {
    if (!canUndo || historyMutationInFlightRef.current || isRecordingRef.current) return;
    historyMutationInFlightRef.current = true;

    try {
      const response = await api.post(`/api/v2/artifacts/${artifactId}/history/undo`);
      const updateResponse = await api.put(
        `/api/v2/projects/${projectId}/artifacts/${artifactId}`,
        { data: response.data.state }
      );
      dispatch(updateArtifactSync(updateResponse.data));
      lastStateRef.current = updateResponse.data.data;
      onStateChange(lastStateRef.current as T);
      dispatch(setRedoAvailable(true));
      scheduleHistoryRefresh();
    } catch (error) {
      console.error('Undo failed:', error);
    } finally {
      historyMutationInFlightRef.current = false;
    }
  }, [artifactId, projectId, dispatch, scheduleHistoryRefresh, canUndo]);

  const redo = useCallback(async () => {
    if (!canRedo || historyMutationInFlightRef.current || isRecordingRef.current) return;
    historyMutationInFlightRef.current = true;

    try {
      const response = await api.post(`/api/v2/artifacts/${artifactId}/history/redo`);
      const updateResponse = await api.put(
        `/api/v2/projects/${projectId}/artifacts/${artifactId}`,
        { data: response.data.state }
      );
      dispatch(updateArtifactSync(updateResponse.data));
      lastStateRef.current = updateResponse.data.data;
      onStateChange(lastStateRef.current as T);
      scheduleHistoryRefresh();
    } catch (error) {
      console.error('Redo failed:', error);
    } finally {
      historyMutationInFlightRef.current = false;
    }
  }, [artifactId, projectId, dispatch, scheduleHistoryRefresh, canRedo]);

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


