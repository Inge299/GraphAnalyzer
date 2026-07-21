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
  saving: boolean;
}

const ProjectDataImportPluginsEditor: React.FC<ProjectDataImportPluginsEditorProps> = ({
  plugins,
  selectedPluginId,
  pluginForm,
  onSelectPlugin,
  onPluginFormChange,
  onSavePlugin,
  saving,
}) => {
  const selectedPlugin = plugins.find((plugin) => plugin.id === selectedPluginId) ?? null;

  return (
    <div className="service-summary-block">
      <div className="service-summary-header">
        <h4>Плагины импорта</h4>
        <p>
          Здесь можно посмотреть доступные форматы импорта и поправить их пользовательские названия, описания и
          приоритет распознавания.
        </p>
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
              <span>{plugin.id}</span>
              <span>{plugin.enabled ? 'Включён' : 'Выключен'}</span>
            </button>
          ))}
        </div>

        <div className="service-card service-card-compact">
          {selectedPlugin ? (
            <>
              <div className="service-summary-header">
                <h4>Редактирование import-плагина</h4>
                <p>
                  Распознавание и логика остаются кодовыми, а здесь мы управляем тем, как формат выглядит для
                  пользователя и в каком приоритете участвует в автоопределении.
                </p>
              </div>

              <div className="service-form-grid">
                <label className="service-field">
                  <span>ID плагина</span>
                  <input className="service-input" value={selectedPlugin.id} readOnly />
                </label>
                <label className="service-field">
                  <span>Поддерживаемые расширения</span>
                  <input className="service-input" value={selectedPlugin.extensions.join(', ')} readOnly />
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

              <div className="service-row">
                <button type="button" className="service-btn primary" onClick={onSavePlugin} disabled={saving}>
                  {saving ? 'Сохранение...' : 'Сохранить настройки плагина'}
                </button>
              </div>
            </>
          ) : (
            <div className="service-empty">Выбери import-плагин слева, чтобы посмотреть и изменить его метаданные.</div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ProjectDataImportPluginsEditor;
