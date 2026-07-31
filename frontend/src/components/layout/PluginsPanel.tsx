import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useAppDispatch, useAppSelector } from '../../store';
import { fetchArtifacts, setCurrentArtifact } from '../../store/slices/artifactsSlice';
import { pluginApi } from '../../services/api';
import type { ApiPlugin, PluginApplicableResponse, PluginExecutionContext, SelectedDomainEntity } from '../../types/api';
import { collectPluginParamsWithPrompts, groupPluginsByMenuPath } from '../../utils/pluginParams';
import { getPluginDisplayDescription, getPluginDisplayName } from '../../utils/pluginMenu';
import './PluginsPanel.css';

const labels = {
  title: 'РџР»Р°РіРёРЅС‹',
  loading: 'Р—Р°РіСЂСѓР·РєР°...',
  empty: 'Р”Р»СЏ С‚РµРєСѓС‰РµРіРѕ Р°СЂС‚РµС„Р°РєС‚Р° РїРѕРєР° РЅРµС‚ РґРѕСЃС‚СѓРїРЅС‹С… РіР»РѕР±Р°Р»СЊРЅС‹С… РїР»Р°РіРёРЅРѕРІ.',
  noArtifact: 'Р’С‹Р±РµСЂРёС‚Рµ Р°СЂС‚РµС„Р°РєС‚, С‡С‚РѕР±С‹ РїРѕСЃРјРѕС‚СЂРµС‚СЊ РґРѕСЃС‚СѓРїРЅС‹Рµ РїР»Р°РіРёРЅС‹.',
  run: 'Р—Р°РїСѓСЃС‚РёС‚СЊ',
  running: 'Р—Р°РїСѓСЃРє...',
  loadError: 'РќРµ СѓРґР°Р»РѕСЃСЊ Р·Р°РіСЂСѓР·РёС‚СЊ СЃРїРёСЃРѕРє РїР»Р°РіРёРЅРѕРІ.',
  runError: 'РћС€РёР±РєР° Р·Р°РїСѓСЃРєР° РїР»Р°РіРёРЅР°.',
  success: 'Р“РѕС‚РѕРІРѕ',
};

const buildContext = (selectedElements: Array<{ type: string; id: string }>, selected_entities: SelectedDomainEntity[], isGraph: boolean): PluginExecutionContext => {
  const selected_nodes = (isGraph ? selectedElements : [])
    .filter((item) => item.type === 'node')
    .map((item) => String(item.id));
  const selected_edges = (isGraph ? selectedElements : [])
    .filter((item) => item.type === 'edge')
    .map((item) => String(item.id));
  return { selected_nodes, selected_edges, selected_entities };
};

const PluginsPanel: React.FC = () => {
  const dispatch = useAppDispatch();
  const currentProject = useAppSelector((state) => state.projects.currentProject);
  const currentArtifactId = useAppSelector((state) => state.artifacts.currentArtifactId);
  const artifacts = useAppSelector((state) => state.artifacts.items);
  const selectedElements = useAppSelector((state) => state.ui.selectedElements);
  const selectedDomainEntities = useAppSelector((state) => state.ui.selectedDomainEntities);

  const selectedArtifact = currentArtifactId ? artifacts[currentArtifactId] : null;
  const pluginContext = useMemo(
    () => buildContext(
      selectedElements as Array<{ type: string; id: string }>,
      selectedDomainEntities,
      selectedArtifact?.type === 'graph',
    ),
    [selectedElements, selectedDomainEntities, selectedArtifact?.type],
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
        setError(String(fetchError?.response?.data?.detail || fetchError?.message || labels.loadError));
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
      setMessage(`${labels.success}: ${getPluginDisplayName(plugin)}`);
    } catch (runError: any) {
      setError(String(runError?.response?.data?.detail || runError?.message || labels.runError));
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
                    <div className="plugins-panel-item-name">{getPluginDisplayName(plugin)}</div>
                    <div className="plugins-panel-item-desc">{getPluginDisplayDescription(plugin)}</div>
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
