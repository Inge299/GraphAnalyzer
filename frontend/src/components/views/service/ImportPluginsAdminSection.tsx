import React from 'react';
import type { ProjectDataImportPlugin } from '../../../types/api';
import ProjectDataImportPluginsEditor from './ProjectDataImportPluginsEditor';

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
  onSelectPlugin: (pluginId: string) => void;
  onPluginFormChange: (updates: Partial<ImportPluginsAdminSectionProps['pluginForm']>) => void;
  onSavePlugin: () => void;
}

const ImportPluginsAdminSection: React.FC<ImportPluginsAdminSectionProps> = ({
  plugins,
  selectedPluginId,
  pluginForm,
  saving,
  onSelectPlugin,
  onPluginFormChange,
  onSavePlugin,
}) => (
  <div className="service-card">
    <h3>Плагины импорта</h3>
    <p className="service-card-hint">
      Здесь живут настройки распознавания форматов и пользовательские названия import-плагинов. Логика распознавания и
      импорта остаётся кодовой, а этот раздел управляет витриной и приоритетами.
    </p>

    <ProjectDataImportPluginsEditor
      plugins={plugins}
      selectedPluginId={selectedPluginId}
      pluginForm={pluginForm}
      saving={saving}
      onSelectPlugin={onSelectPlugin}
      onPluginFormChange={onPluginFormChange}
      onSavePlugin={onSavePlugin}
    />
  </div>
);

export default ImportPluginsAdminSection;
