import { useCallback, useRef, useState } from 'react';
import { fetchArtifacts, setCurrentArtifact } from '../store/slices/artifactsSlice';
import { pluginApi } from '../services/api';
import { collectPluginParamsWithPrompts } from '../utils/pluginParams';
import type { AppDispatch } from '../store';
import type { ApiPlugin, PluginArtifactDataOverride, PluginExecutionContext } from '../types/api';

interface UsePluginRunnerArgs {
  artifactId: number;
  projectId: number;
  getCurrentGraphNodeIds: () => string[];
  buildLiveContext: (fallback: PluginExecutionContext) => PluginExecutionContext;
  getArtifactSnapshot: () => PluginArtifactDataOverride;
  onHistoryChanged?: () => Promise<void> | void;
  onFinally?: () => void;
}

interface UpdatedArtifactResponse {
  id?: number | string;
  data?: {
    nodes?: Array<{ id?: string | number; node_id?: string | number }>;
  };
  metadata?: Record<string, unknown>;
}

interface PluginExecuteResponse {
  created?: Array<{ id: number }>;
  updated?: UpdatedArtifactResponse[];
}

const serializeComparable = (value: unknown): string => {
  try {
    return JSON.stringify(value ?? null);
  } catch {
    return '';
  }
};

const getErrorMessage = (error: unknown): string => {
  const fallback = 'Не удалось запустить плагин.';

  const explainByText = (text: string): string | null => {
    const normalized = text.toLowerCase();

    const isLlmError = normalized.includes('llm') || normalized.includes('language model');
    if (
      normalized.includes('timeout') ||
      normalized.includes('timed out') ||
      normalized.includes('econnaborted')
    ) {
      return isLlmError
        ? 'Превышено время ожидания ответа от LLM. Попробуйте уменьшить объём задачи или выбрать более быструю модель.'
        : 'Превышено время ожидания выполнения плагина. Попробуйте повторить запуск или уменьшить объём результата.';
    }

    if (
      normalized.includes('context length') ||
      normalized.includes('n_ctx') ||
      normalized.includes('n_keep') ||
      normalized.includes('too many tokens') ||
      normalized.includes('maximum context')
    ) {
      return 'Слишком большой контекст для текущей модели LLM. Уменьшите объём входных данных/число секций или используйте модель с большим context window.';
    }

    return null;
  };

  if (typeof error === 'object' && error !== null && 'response' in error) {
    const response = (error as { response?: { data?: { detail?: unknown } } }).response;
    const detail = response?.data?.detail;
    if (typeof detail === 'string' && detail.trim()) {
      return explainByText(detail) || detail;
    }
  }

  if (typeof error === 'object' && error !== null && 'message' in error) {
    const message = String((error as { message?: unknown }).message || '');
    const explained = explainByText(message);
    if (explained) {
      return explained;
    }
  }

  if (error instanceof Error && error.message) {
    return error.message;
  }

  return fallback;
};

export const usePluginRunner = ({
  artifactId,
  projectId,
  getCurrentGraphNodeIds,
  buildLiveContext,
  getArtifactSnapshot,
  onHistoryChanged,
  onFinally,
}: UsePluginRunnerArgs) => {
  const pluginExecutionRef = useRef(false);
  const [pluginExecutionMessage, setPluginExecutionMessage] = useState<string | null>(null);

  const runPlugin = useCallback(async (
    plugin: ApiPlugin,
    context: PluginExecutionContext,
    dispatch: AppDispatch,
  ) => {
    if (pluginExecutionRef.current) return;

    try {
      const params = await collectPluginParamsWithPrompts(plugin, projectId);
      if (params === null) return;

      pluginExecutionRef.current = true;
      setPluginExecutionMessage(`Выполняется плагин: ${plugin.name}...`);

      const beforeNodeIds = new Set(getCurrentGraphNodeIds());
      const liveContext = buildLiveContext(context);
      const liveArtifactData = getArtifactSnapshot();

      const response = await pluginApi.execute(
        plugin.id,
        projectId,
        [artifactId],
        params,
        liveContext,
        liveArtifactData,
      ) as PluginExecuteResponse;

      await dispatch(fetchArtifacts(projectId));
      await onHistoryChanged?.();

      const created = response?.created || [];
      if (created.length > 0) {
        dispatch(setCurrentArtifact(created[0].id));
      }

      const updatedCurrent = response?.updated?.find((item) => Number(item?.id) === Number(artifactId));
      const nextNodes = Array.isArray(updatedCurrent?.data?.nodes) ? updatedCurrent.data.nodes : [];
      const newNodeIds = nextNodes
        .map((node) => String(node?.id ?? node?.node_id ?? ''))
        .filter((id: string) => id && !beforeNodeIds.has(id));
      const artifactChanged = updatedCurrent
        ? serializeComparable(updatedCurrent.data) !== serializeComparable(liveArtifactData)
        : false;
      const noVisibleResult = created.length === 0
        && newNodeIds.length === 0
        && !artifactChanged;

      if (newNodeIds.length > 0) {
        window.dispatchEvent(new CustomEvent('graph:run-physics-layout', { detail: { newNodeIds, autoLayout: true } }));
      }

      if (noVisibleResult) {
        window.alert('Результат отсутствует.');
      }
    } catch (error: unknown) {
      window.alert(getErrorMessage(error));
    } finally {
      pluginExecutionRef.current = false;
      setPluginExecutionMessage(null);
      onFinally?.();
    }
  }, [artifactId, buildLiveContext, getArtifactSnapshot, getCurrentGraphNodeIds, onFinally, onHistoryChanged, projectId]);

  return {
    runPlugin,
    isPluginExecutingRef: pluginExecutionRef,
    pluginExecutionMessage,
  };
};
