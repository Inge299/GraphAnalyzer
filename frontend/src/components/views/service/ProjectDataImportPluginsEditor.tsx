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
  const inputContract = selectedPlugin?.input_contract ?? {};
  const inputFile = (inputContract.file ?? {}) as Record<string, unknown>;
  const inputHeaders = (inputContract.headers ?? {}) as Record<string, unknown>;
  const inputContainer = (inputContract.container ?? {}) as Record<string, unknown>;
  const inputFilename = (inputContract.filename ?? {}) as Record<string, unknown>;
  const contractList = (value: unknown): string[] => Array.isArray(value) ? value.map(String) : [];

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

              {Object.keys(inputContract).length > 0 && (
                <details className="service-technical-details" open>
                  <summary>{'\u0412\u0445\u043e\u0434\u043d\u043e\u0439 \u0444\u043e\u0440\u043c\u0430\u0442'}</summary>
                  <div className="service-plugin-datasets">
                    <div className="service-plugin-dataset">
                      <strong>{'\u0424\u0430\u0439\u043b\u044b \u0438 \u043a\u043e\u0434\u0438\u0440\u043e\u0432\u043a\u0438'}</strong>
                      <span>{contractList(inputFile.extensions).join(', ') || '\u043b\u044e\u0431\u043e\u0439 \u0444\u0430\u0439\u043b'}; {contractList(inputFile.encodings).join(', ') || '\u043a\u043e\u0434\u0438\u0440\u043e\u0432\u043a\u0430 \u043d\u0435 \u0437\u0430\u0434\u0430\u043d\u0430'}</span>
                      {contractList(inputFile.delimiters).length > 0 && <span>{'\u0420\u0430\u0437\u0434\u0435\u043b\u0438\u0442\u0435\u043b\u044c: '}{contractList(inputFile.delimiters).join(', ')}</span>}
                    </div>
                    <div className="service-plugin-dataset">
                      <strong>{'\u041f\u0440\u0438\u0437\u043d\u0430\u043a\u0438 \u0444\u043e\u0440\u043c\u0430\u0442\u0430'}</strong>
                      <span>{'\u041e\u0431\u044f\u0437\u0430\u0442\u0435\u043b\u044c\u043d\u044b\u0435 \u043f\u043e\u043b\u044f: '}{contractList(inputHeaders.required).join(', ') || '\u043d\u0435 \u0437\u0430\u0434\u0430\u043d\u044b'}</span>
                      {contractList(inputHeaders.optional).length > 0 && <span>{'\u0414\u043e\u043f\u043e\u043b\u043d\u0438\u0442\u0435\u043b\u044c\u043d\u043e: '}{contractList(inputHeaders.optional).join(', ')}</span>}
                      {Array.isArray(inputHeaders.signatures) && <span>{'\u041e\u0434\u043d\u0430 \u0438\u0437 \u0441\u0445\u0435\u043c \u0437\u0430\u0433\u043e\u043b\u043e\u0432\u043a\u043e\u0432: '}{(inputHeaders.signatures as unknown[]).map((item) => Array.isArray(item) ? item.map(String).join(' + ') : String(item)).join(' / ')}</span>}
                    </div>
                    {Boolean(inputContainer.zip_members) && <div className="service-plugin-dataset"><strong>ZIP</strong><span>{'\u0420\u0430\u0441\u043f\u043e\u0437\u043d\u0430\u0432\u0430\u043d\u0438\u0435 \u0432\u044b\u043f\u043e\u043b\u043d\u044f\u0435\u0442\u0441\u044f \u043f\u043e \u0444\u0430\u0439\u043b\u0430\u043c \u0432\u043d\u0443\u0442\u0440\u0438 \u0430\u0440\u0445\u0438\u0432\u0430'}</span></div>}
                    {typeof inputFilename.source_msisdn === 'string' && <div className="service-plugin-dataset"><strong>MSISDN</strong><span>{String(inputFilename.source_msisdn)}</span></div>}
                  </div>
                </details>
              )}

              {(selectedPlugin.output_datasets ?? []).length > 0 && (
                <details className="service-technical-details">
                  <summary>{'\u0412\u044b\u0445\u043e\u0434\u043d\u044b\u0435 \u043d\u0430\u0431\u043e\u0440\u044b \u0434\u0430\u043d\u043d\u044b\u0445'}</summary>
                  <div className="service-plugin-datasets">
                    {selectedPlugin.output_datasets.map((dataset) => (
                      <div key={dataset.id} className="service-plugin-dataset">
                        <strong>{dataset.label}</strong>
                        <span>{dataset.id} · {dataset.filename}</span>
                        <span>{dataset.required_columns.join(', ')}</span>
                      </div>
                    ))}
                  </div>
                </details>
              )}
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