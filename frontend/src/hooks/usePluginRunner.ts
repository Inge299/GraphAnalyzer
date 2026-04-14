import { useCallback, useRef, useState } from 'react';
import { fetchArtifacts, setCurrentArtifact } from '../store/slices/artifactsSlice';
import { pluginApi } from '../services/api';
import { layoutConfig } from '../config/layout';
import { collectPluginParamsWithPrompts } from '../utils/pluginParams';
import type { AppDispatch } from '../store';
import type { ApiPlugin, PluginExecutionContext } from '../types/api';

interface UsePluginRunnerArgs {
  artifactId: number;
  projectId: number;
  getCurrentGraphNodeIds: () => string[];
  buildLiveContext: (fallback: PluginExecutionContext) => PluginExecutionContext;
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

const getErrorMessage = (error: unknown): string => {
  const fallback = 'Не удалось запустить плагин.';

  const explainByText = (text: string): string | null => {
    const normalized = text.toLowerCase();

    if (
      normalized.includes('timeout') ||
      normalized.includes('timed out') ||
      normalized.includes('econnaborted')
    ) {
      return 'Превышено время ожидания ответа от LLM. Попробуйте уменьшить объём задачи (например, max_sections=3-4) или выбрать более быструю модель.';
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

      const response = await pluginApi.execute(
        plugin.id,
        projectId,
        [artifactId],
        params,
        liveContext,
      ) as PluginExecuteResponse;

      await dispatch(fetchArtifacts(projectId));

      const created = response?.created || [];
      if (created.length > 0) {
        dispatch(setCurrentArtifact(created[0].id));
      }

      const updatedCurrent = response?.updated?.find((item) => Number(item?.id) === Number(artifactId));
      const nextNodes = Array.isArray(updatedCurrent?.data?.nodes) ? updatedCurrent.data.nodes : [];
      const newNodeIds = nextNodes
        .map((node) => String(node?.id ?? node?.node_id ?? ''))
        .filter((id: string) => id && !beforeNodeIds.has(id));

      const updatedMeta = updatedCurrent?.metadata || {};
      const liveSelectedNodeCount = Array.isArray(liveContext?.selected_nodes) ? liveContext.selected_nodes.length : 0;
      const limitRaw = typeof updatedMeta.communications_selection_limit === 'number'
        ? updatedMeta.communications_selection_limit
        : Number(updatedMeta.communications_selection_limit || 150);
      const limit = Number.isFinite(limitRaw) ? limitRaw : 150;
      const isCommunicationsPlugin = plugin.id === 'abonent_communications';
      const shouldWarnExceeded = isCommunicationsPlugin
        && Boolean(updatedMeta.communications_selection_exceeded)
        && liveSelectedNodeCount > limit;
      const shouldWarnLimited = isCommunicationsPlugin
        && Boolean(updatedMeta.communications_selection_limited)
        && liveSelectedNodeCount > limit;

      if (shouldWarnExceeded) {
        window.alert(`Выделено ${liveSelectedNodeCount} абонентов. Лимит для запуска плагина: ${limit}. Пожалуйста, запускайте расширение частями.`);
      } else if (shouldWarnLimited) {
        window.alert(`Обработано только первые ${limit} абонентов из выделения. Для остальных запустите плагин повторно.`);
      }

      if (newNodeIds.length > 0) {
        const maxAutoLayout = Number(layoutConfig.pluginAutoLayout?.maxNewNodes || 80);
        const autoLayout = newNodeIds.length <= maxAutoLayout;
        window.dispatchEvent(new CustomEvent('graph:run-physics-layout', { detail: { newNodeIds, autoLayout } }));
      }
    } catch (error: unknown) {
      window.alert(getErrorMessage(error));
    } finally {
      pluginExecutionRef.current = false;
      setPluginExecutionMessage(null);
      onFinally?.();
    }
  }, [artifactId, buildLiveContext, getCurrentGraphNodeIds, onFinally, projectId]);

  return {
    runPlugin,
    isPluginExecutingRef: pluginExecutionRef,
    pluginExecutionMessage,
  };
};
