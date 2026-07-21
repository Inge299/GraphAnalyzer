import React from 'react';

interface MetadataBundleAdminSectionProps {
  metadataExporting: boolean;
  metadataImporting: boolean;
  metadataImportInputRef: React.Ref<HTMLInputElement>;
  onExportMetadata: () => void;
  onImportMetadataFile: (event: React.ChangeEvent<HTMLInputElement>) => void;
}

const metadataImportInputId = 'metadata-bundle-import-input';

const MetadataBundleAdminSection: React.FC<MetadataBundleAdminSectionProps> = ({
  metadataExporting,
  metadataImporting,
  metadataImportInputRef,
  onExportMetadata,
  onImportMetadataFile,
}) => (
  <div className="service-card">
    <h3>Метаданные</h3>
    <p className="service-card-hint">
      Здесь можно сохранить или восстановить пакет метаданных системы. Сейчас в пакет входят типы графа и реестр
      import-плагинов.
    </p>

    <div className="service-row">
      <button type="button" className="service-btn" onClick={onExportMetadata} disabled={metadataExporting}>
        {metadataExporting ? 'Выгрузка...' : 'Экспорт метаданных'}
      </button>
      <input
        ref={metadataImportInputRef}
        id={metadataImportInputId}
        type="file"
        accept="application/json,.json"
        className="service-file-input"
        onChange={onImportMetadataFile}
      />
      <label htmlFor={metadataImportInputId} className={`service-btn file-picker ${metadataImporting ? 'disabled' : ''}`}>
        Импорт метаданных
      </label>
    </div>

    <div className="service-inline-note">
      Полезно для переноса настроек между окружениями, резервного копирования и отката конфигурации.
    </div>
  </div>
);

export default MetadataBundleAdminSection;
