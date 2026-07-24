import React from 'react';
import type { ProjectDataImportPlugin } from '../../../types/api';

interface ProjectDataImportPluginsEditorProps {
  plugins: ProjectDataImportPlugin[];
  selectedPluginId: string | null;
  pluginForm: {
    name: string;
    description: string;
    priority: string;
    enabled: boolean;
  };
  onSelectPlugin: (pluginId: string) => void;
  onPluginFormChange: (updates: Partial<ProjectDataImportPluginsEditorProps['pluginForm']>) => void;
  onSavePlugin: () => void;
  onDeletePlugin: () => void;
  saving: boolean;
  managing: boolean;
}

const ProjectDataImportPluginsEditor: React.FC<ProjectDataImportPluginsEditorProps> = ({
  plugins,
  selectedPluginId,
  pluginForm,
  onSelectPlugin,
  onPluginFormChange,
  onSavePlugin,
  onDeletePlugin,
  saving,
  managing,
}) => {
  const selectedPlugin = plugins.find((plugin) => plugin.id === selectedPluginId) ?? null;

  return (
    <div className="service-summary-block">
      <div className="service-summary-header">
        <h4>Подключённые Python-модули</h4>
        <p>Код плагина не редактируется в интерфейсе. Через UI подключается готовый файл и настраивается его участие в импорте.</p>
      </div>

      <div className="service-import-plugin-editor">
        <div className="service-list">
          {plugins.map((plugin) => (
            <button
              key={plugin.id}
              type="button"
              className={`service-list-item ${plugin.id === selectedPluginId ? 'active' : ''}`}
              onClick={() => onSelectPlugin(plugin.id)}
            >
              <strong>{plugin.name}</strong>
              <span>{plugin.id} · v{plugin.version} · {plugin.removable ? 'внешний' : 'встроенный'}</span>
              <span>{plugin.enabled ? 'Включён' : 'Выключен'}</span>
            </button>
          ))}
        </div>

        <div className="service-card service-card-compact">
          {selectedPlugin ? (
            <>
              <div className="service-summary-header">
                <h4>Настройка импортного плагина</h4>
                <p>Manifest и логика остаются в Python-файле; пользовательские метаданные хранятся в конфигурации продукта.</p>
              </div>

              <div className="service-form-grid">
                <label className="service-field">
                  <span>ID плагина</span>
                  <input className="service-input" value={selectedPlugin.id} readOnly />
                </label>
                <label className="service-field">
                  <span>Версия плагина / SDK</span>
                  <input className="service-input" value={`${selectedPlugin.version} / ${selectedPlugin.sdk_version}`} readOnly />
                </label>
                <label className="service-field">
                  <span>Источник</span>
                  <input
                    className="service-input"
                    value={selectedPlugin.removable ? selectedPlugin.source.split(/[\\/]/).pop() ?? selectedPlugin.source : 'Встроенный модуль'}
                    readOnly
                  />
                </label>
                <label className="service-field">
                  <span>Поддерживаемые расширения</span>
                  <input className="service-input" value={selectedPlugin.extensions.join(', ')} readOnly />
                </label>
                <label className="service-field service-field-wide">
                  <span>Возможности</span>
                  <input className="service-input" value={selectedPlugin.capabilities.join(', ')} readOnly />
                </label>
                <label className="service-field service-field-wide">
                  <span>Название</span>
                  <input
                    className="service-input"
                    value={pluginForm.name}
                    onChange={(event) => onPluginFormChange({ name: event.target.value })}
                  />
                </label>
                <label className="service-field service-field-wide">
                  <span>Описание</span>
                  <textarea
                    className="service-textarea service-textarea-small"
                    value={pluginForm.description}
                    onChange={(event) => onPluginFormChange({ description: event.target.value })}
                  />
                </label>
                <label className="service-field">
                  <span>Приоритет распознавания</span>
                  <input
                    className="service-input"
                    value={pluginForm.priority}
                    onChange={(event) => onPluginFormChange({ priority: event.target.value })}
                  />
                </label>
                <label className="service-field">
                  <span>Подсказка распознавания</span>
                  <input className="service-input" value={selectedPlugin.recognition_hint} readOnly />
                </label>
                <label className="service-checkbox service-field-wide">
                  <input
                    type="checkbox"
                    checked={pluginForm.enabled}
                    onChange={(event) => onPluginFormChange({ enabled: event.target.checked })}
                  />
                  Плагин включён и участвует в автоматическом распознавании формата
                </label>
              </div>

              {Object.keys(selectedPlugin.config_schema).length > 0 && (
                <details className="service-technical-details">
                  <summary>Схема настраиваемых параметров</summary>
                  <pre className="service-json">{JSON.stringify(selectedPlugin.config_schema, null, 2)}</pre>
                </details>
              )}

              <div className="service-row">
                <button type="button" className="service-btn primary" onClick={onSavePlugin} disabled={saving}>
                  {saving ? 'Сохранение...' : 'Сохранить настройки плагина'}
                </button>
                {selectedPlugin.removable && (
                  <button type="button" className="service-btn danger" onClick={onDeletePlugin} disabled={managing}>
                    {managing ? 'Обработка...' : 'Удалить модуль'}
                  </button>
                )}
              </div>
            </>
          ) : (
            <div className="service-empty">Выберите импортный плагин слева, чтобы посмотреть и изменить его метаданные.</div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ProjectDataImportPluginsEditor;