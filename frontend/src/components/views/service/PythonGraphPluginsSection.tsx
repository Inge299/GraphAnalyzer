import React, { useCallback, useEffect, useState } from 'react';
import { pluginApi } from '../../../services/api';


interface GraphPlugin {
  id: string;
  name: string;
  description: string;
  menu_path?: string;
  menu_order?: number;
  hidden_from_menu?: boolean;
  is_active?: boolean;
  source?: string;
  removable?: boolean;
}

interface PluginDraft extends GraphPlugin {
  draftActive: boolean;
  draftVisible: boolean;
  draftMenuPath: string;
  draftMenuOrder: string;
}

interface PythonGraphPluginsSectionProps {
  onMessage: (message: string | null) => void;
  onError: (message: string | null) => void;
}

const toDraft = (plugin: GraphPlugin): PluginDraft => ({
  ...plugin,
  draftActive: plugin.is_active !== false,
  draftVisible: plugin.hidden_from_menu !== true,
  draftMenuPath: String(plugin.menu_path || 'Анализ'),
  draftMenuOrder: String(plugin.menu_order || 0),
});

const sourceName = (plugin: GraphPlugin) => {
  if (!plugin.removable) return 'Встроенный модуль';
  const parts = String(plugin.source || '').split(/[\\/]/);
  return parts[parts.length - 1] || 'Внешний модуль';
};

const PythonGraphPluginsSection: React.FC<PythonGraphPluginsSectionProps> = ({
  onMessage,
  onError,
}) => {
  const [plugins, setPlugins] = useState<PluginDraft[]>([]);
  const [loading, setLoading] = useState(false);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [managing, setManaging] = useState(false);

  const loadPlugins = useCallback(async () => {
    setLoading(true);
    onError(null);
    try {
      const response = await pluginApi.graphPythonPlugins();
      setPlugins(((response.plugins || []) as unknown as GraphPlugin[]).map(toDraft));
    } catch (error: any) {
      onError(String(error?.response?.data?.detail || error?.message || 'Не удалось загрузить графовые Python-плагины'));
    } finally {
      setLoading(false);
    }
  }, [onError]);

  useEffect(() => {
    void loadPlugins();
  }, [loadPlugins]);

  const updateDraft = (pluginId: string, updates: Partial<PluginDraft>) => {
    setPlugins((current) => current.map((item) => (item.id === pluginId ? { ...item, ...updates } : item)));
  };

  const handleInstall = async (file: File) => {
    setManaging(true);
    onMessage(null);
    onError(null);
    try {
      const result = await pluginApi.installPythonGraphPlugin(file);
      await loadPlugins();
      const names = result.plugins.map((plugin) => plugin.name).join(', ');
      onMessage(names ? `Подключены аналитические плагины: ${names}.` : `Подключён модуль .`);
    } catch (error: any) {
      onError(String(error?.response?.data?.detail || error?.message || 'Не удалось подключить графовый Python-плагин'));
    } finally {
      setManaging(false);
    }
  };

  const handleDelete = async (plugin: PluginDraft) => {
    if (!plugin.removable) return;
    if (!window.confirm(`Удалить внешний модуль «${sourceName(plugin)}»? Все плагины из этого файла будут удалены.`)) return;

    setManaging(true);
    onMessage(null);
    onError(null);
    try {
      await pluginApi.deletePythonGraphPlugin(plugin.id);
      await loadPlugins();
      onMessage(`Внешний модуль  удалён.`);
    } catch (error: any) {
      onError(String(error?.response?.data?.detail || error?.message || 'Не удалось удалить графовый Python-плагин'));
    } finally {
      setManaging(false);
    }
  };

  const savePlugin = async (plugin: PluginDraft) => {
    setSavingId(plugin.id);
    onMessage(null);
    onError(null);
    try {
      const updated = await pluginApi.updatePythonGraphPlugin(plugin.id, {
        is_active: plugin.draftActive,
        is_visible: plugin.draftVisible,
        menu_path: plugin.draftMenuPath.trim() || 'Анализ',
        menu_order: Number.parseInt(plugin.draftMenuOrder, 10) || 0,
      });
      setPlugins((current) => current.map((item) => (item.id === plugin.id ? toDraft(updated) : item)));
      onMessage(`Настройки плагина «${plugin.name}» сохранены.`);
    } catch (error: any) {
      onError(String(error?.response?.data?.detail || error?.message || 'Не удалось сохранить настройки графового плагина'));
    } finally {
      setSavingId(null);
    }
  };

  return (
    <div className="service-card service-python-plugins-card service-graph-plugins-card">
      <div className="service-card-header">
        <div>
          <h3>Графовые Python-плагины</h3>
          <p className="service-card-hint">
            Подключайте готовые Python-модули. Через интерфейс настраиваются доступность и место плагина в меню; код не редактируется.
          </p>
        </div>
        <button type="button" className="service-btn" onClick={() => void loadPlugins()} disabled={loading || managing}>
          {loading ? 'Обновление...' : 'Обновить список'}
        </button>
      </div>

      <div className="service-row">
        <input
          id="graph-python-plugin-file"
          type="file"
          accept=".py,text/x-python"
          hidden
          disabled={managing}
          onChange={(event) => {
            const file = event.target.files?.[0];
            event.target.value = '';
            if (file) void handleInstall(file);
          }}
        />
        <label className={`service-btn primary ${managing ? 'disabled' : ''}`} htmlFor="graph-python-plugin-file">
          {managing ? 'Обработка...' : 'Подключить .py'}
        </label>
        <span className="service-card-hint">Одноимённый файл обновит уже подключенный модуль.</span>
      </div>

      {plugins.length === 0 && !loading ? (
        <div className="service-empty">Графовые Python-плагины не обнаружены.</div>
      ) : (
        <div className="service-python-plugin-list">
          {plugins.map((plugin) => (
            <div key={plugin.id} className="service-python-plugin-row">
              <div className="service-python-plugin-main">
                <strong>{plugin.name}</strong>
                <span>{plugin.description || 'Без описания'}</span>
                <code>{plugin.id} · {sourceName(plugin)}</code>
              </div>

              <label className="service-field">
                <span>Раздел меню</span>
                <input
                  className="service-input"
                  value={plugin.draftMenuPath}
                  onChange={(event) => updateDraft(plugin.id, { draftMenuPath: event.target.value })}
                  placeholder="Анализ/Связи"
                />
              </label>

              <label className="service-field service-python-plugin-order">
                <span>Порядок</span>
                <input
                  className="service-input"
                  type="number"
                  value={plugin.draftMenuOrder}
                  onChange={(event) => updateDraft(plugin.id, { draftMenuOrder: event.target.value })}
                />
              </label>

              <div className="service-python-plugin-flags">
                <label className="service-checkbox">
                  <input
                    type="checkbox"
                    checked={plugin.draftActive}
                    onChange={(event) => updateDraft(plugin.id, { draftActive: event.target.checked })}
                  />
                  <span>Активен</span>
                </label>
                <label className="service-checkbox">
                  <input
                    type="checkbox"
                    checked={plugin.draftVisible}
                    onChange={(event) => updateDraft(plugin.id, { draftVisible: event.target.checked })}
                  />
                  <span>Показывать в меню</span>
                </label>
              </div>

              <div className="service-python-plugin-actions">
                <button
                  type="button"
                  className="service-btn primary"
                  onClick={() => void savePlugin(plugin)}
                  disabled={savingId === plugin.id || managing}
                >
                  {savingId === plugin.id ? 'Сохранение...' : 'Сохранить'}
                </button>
                {plugin.removable && (
                  <button type="button" className="service-btn danger" onClick={() => void handleDelete(plugin)} disabled={managing}>
                    Удалить
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default PythonGraphPluginsSection;