import React from 'react';
import type { ProjectDataImportPlugin } from '../../../types/api';
import ProjectDataImportPluginsEditor from './ProjectDataImportPluginsEditor';
import { DomainDataMappingsEditor } from '../DomainDataMappingsEditor';

interface ImportPluginsAdminSectionProps {
  plugins: ProjectDataImportPlugin[];
  selectedPluginId: string | null;
  pluginForm: {
    name: string;
    description: string;
    priority: string;
    enabled: boolean;
  };
  saving: boolean;
  managing: boolean;
  onSelectPlugin: (pluginId: string) => void;
  onPluginFormChange: (updates: Partial<ImportPluginsAdminSectionProps['pluginForm']>) => void;
  onSavePlugin: () => void;
  onInstallPlugin: (file: File) => void;
  onDeletePlugin: () => void;
  onRefresh: () => void;
}

const ImportPluginsAdminSection: React.FC<ImportPluginsAdminSectionProps> = ({
  plugins,
  selectedPluginId,
  pluginForm,
  saving,
  managing,
  onSelectPlugin,
  onPluginFormChange,
  onSavePlugin,
  onInstallPlugin,
  onDeletePlugin,
  onRefresh,
}) => (
  <div className="service-import-admin">
    <h3>Плагины импорта</h3>
    <p className="service-card-hint">
      Подключайте готовые Python-модули и настраивайте их без редактирования кода: название, описание,
      приоритет распознавания и доступность плагина.
    </p>

    <div className="service-row">
      <input
        id="project-data-import-plugin-file"
        type="file"
        accept=".py,text/x-python"
        hidden
        disabled={managing}
        onChange={(event) => {
          const file = event.target.files?.[0];
          event.target.value = '';
          if (file) onInstallPlugin(file);
        }}
      />
      <label className={`service-btn primary ${managing ? 'disabled' : ''}`} htmlFor="project-data-import-plugin-file">
        {managing ? 'Обработка...' : 'Подключить .py'}
      </label>
      <button type="button" className="service-btn" onClick={onRefresh} disabled={managing}>
        Обновить список
      </button>
      <span className="service-card-hint">Повторная загрузка файла с тем же именем обновит модуль.</span>
    </div>

    <ProjectDataImportPluginsEditor
      plugins={plugins}
      selectedPluginId={selectedPluginId}
      pluginForm={pluginForm}
      saving={saving}
      managing={managing}
      onSelectPlugin={onSelectPlugin}
      onPluginFormChange={onPluginFormChange}
      onSavePlugin={onSavePlugin}
      onDeletePlugin={onDeletePlugin}
    />
    <div className="service-card"><DomainDataMappingsEditor /></div>
  </div>
);

export default ImportPluginsAdminSection;