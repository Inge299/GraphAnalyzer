import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useAppDispatch, useAppSelector } from '../../store';
import { fetchArtifacts, setCurrentArtifact } from '../../store/slices/artifactsSlice';
import { pluginApi } from '../../services/api';
import type { ApiPlugin, PluginApplicableResponse, PluginExecutionContext } from '../../types/api';
import { collectPluginParamsWithPrompts, groupPluginsByMenuPath } from '../../utils/pluginParams';
import './PluginsPanel.css';

const labels = {
  title: 'Плагины',
  loading: 'Загрузка...',
  empty: 'Нет плагинов общего назначения для текущего артефакта.',
  noArtifact: 'Выберите артефакт, чтобы запустить плагин.',
  run: 'Запустить',
  running: 'Запуск...',
};

const buildContext = (selectedElements: Array<{ type: string; id: string }>): PluginExecutionContext => {
  const selected_nodes = selectedElements
    .filter((item) => item.type === 'node')
    .map((item) => String(item.id));
  const selected_edges = selectedElements
    .filter((item) => item.type === 'edge')
    .map((item) => String(item.id));
  return { selected_nodes, selected_edges };
};

const PluginsPanel: React.FC = () => {
  const dispatch = useAppDispatch();
  const currentProject = useAppSelector((state) => state.projects.currentProject);
  const currentArtifactId = useAppSelector((state) => state.artifacts.currentArtifactId);
  const artifacts = useAppSelector((state) => state.artifacts.items);
  const selectedElements = useAppSelector((state) => state.ui.selectedElements);

  const selectedArtifact = currentArtifactId ? artifacts[currentArtifactId] : null;
  const pluginContext = useMemo(
    () => buildContext(selectedElements as Array<{ type: string; id: string }>),
    [selectedElements],
  );
  const pluginContextKey = useMemo(() => JSON.stringify(pluginContext), [pluginContext]);

  const [plugins, setPlugins] = useState<ApiPlugin[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [runningPluginId, setRunningPluginId] = useState<string | null>(null);

  useEffect(() => {
    if (!currentProject?.id || !selectedArtifact?.id) {
      setPlugins([]);
      setError(null);
      return;
    }
    let cancelled = false;
    setIsLoading(true);
    setError(null);
    pluginApi
      .applicable(currentProject.id, selectedArtifact.id, pluginContext)
      .then((response: PluginApplicableResponse) => {
        if (cancelled) return;
        const globals = (response.plugins || []).filter(
          (plugin: ApiPlugin) => String(plugin.plugin_scope || 'context') === 'global',
        );
        setPlugins(globals);
      })
      .catch((fetchError: any) => {
        if (cancelled) return;
        setPlugins([]);
        setError(String(fetchError?.response?.data?.detail || fetchError?.message || 'Не удалось загрузить плагины.'));
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [currentProject?.id, selectedArtifact?.id, pluginContextKey]);

  const groupedPlugins = useMemo(() => groupPluginsByMenuPath(plugins), [plugins]);

  const handleRunPlugin = useCallback(async (plugin: ApiPlugin) => {
    if (!currentProject?.id || !selectedArtifact?.id) return;
    setRunningPluginId(plugin.id);
    setError(null);
    setMessage(null);
    try {
      const params = await collectPluginParamsWithPrompts(plugin, currentProject.id);
      if (params === null) return;
      const response = await pluginApi.execute(
        plugin.id,
        currentProject.id,
        [selectedArtifact.id],
        params,
        pluginContext,
      );
      await dispatch(fetchArtifacts(currentProject.id));
      const created = response?.created || [];
      if (created.length > 0) {
        dispatch(setCurrentArtifact(created[0].id));
      }
      setMessage(`Готово: ${plugin.name}`);
    } catch (runError: any) {
      setError(String(runError?.response?.data?.detail || runError?.message || 'Ошибка запуска плагина.'));
    } finally {
      setRunningPluginId(null);
    }
  }, [currentProject?.id, selectedArtifact?.id, pluginContext, dispatch]);

  return (
    <div className="plugins-panel">
      <div className="plugins-panel-title">{labels.title}</div>
      {!selectedArtifact ? (
        <div className="plugins-panel-hint">{labels.noArtifact}</div>
      ) : isLoading ? (
        <div className="plugins-panel-hint">{labels.loading}</div>
      ) : groupedPlugins.length === 0 ? (
        <div className="plugins-panel-hint">{labels.empty}</div>
      ) : (
        <div className="plugins-panel-list">
          {groupedPlugins.map((group) => (
            <div className="plugins-panel-group" key={group.path}>
              <div className="plugins-panel-group-title">{group.path}</div>
              {group.items.map((plugin) => (
                <div className="plugins-panel-item" key={plugin.id}>
                  <div className="plugins-panel-item-main">
                    <div className="plugins-panel-item-name">{plugin.name}</div>
                    <div className="plugins-panel-item-desc">{plugin.description || ''}</div>
                  </div>
                  <button
                    type="button"
                    className="plugins-panel-run"
                    onClick={() => void handleRunPlugin(plugin)}
                    disabled={runningPluginId !== null}
                  >
                    {runningPluginId === plugin.id ? labels.running : labels.run}
                  </button>
                </div>
              ))}
            </div>
          ))}
        </div>
      )}
      {message && <div className="plugins-panel-message">{message}</div>}
      {error && <div className="plugins-panel-error">{error}</div>}
    </div>
  );
};

export default PluginsPanel;
