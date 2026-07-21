import React from 'react';
import type { ProjectDataImportPlugin, ProjectDataLoadResponse } from '../../../types/api';
import type { ProjectDataSelectedFileItem } from './types';

interface ProjectDataSectionProps {
  projectId: number | null;
  projectDataFilesInputRef: React.Ref<HTMLInputElement>;
  projectDataFileInputId: string;
  projectDataLoading: boolean;
  projectDataClearing: boolean;
  enrichLoading: boolean;
  projectStatsLoading: boolean;
  projectDataSelectedFiles: ProjectDataSelectedFileItem[];
  projectDataSelectedSummary: {
    totalFiles: number;
    totalSizeBytes: number;
    byKind: Array<[string, number]>;
  };
  availableImportPlugins: ProjectDataImportPlugin[];
  selectedImportPluginPreview: { name: string } | null;
  projectDataLastLoadResult: ProjectDataLoadResponse | null;
  projectDataLoadReport: unknown | null;
  projectStats: any | null;
  projectStatsError: string | null;
  cellStats: any | null;
  cellStatsError: string | null;
  enrichReport: any | null;
  formatBytes: (sizeBytes: number) => string;
  formatDateTime: (value: unknown) => string;
  onLoadProjectDataFiles: (event: React.ChangeEvent<HTMLInputElement>) => void;
  onRefreshStats: () => void;
  onUpload: () => void;
  onClearSelection: () => void;
  onClearData: () => void;
  onEnrich: () => void;
  onRemoveFile: (id: string) => void;
  onChangeFilePlugin: (id: string, pluginId: string) => void;
}

const ProjectDataSection: React.FC<ProjectDataSectionProps> = ({
  projectId,
  projectDataFilesInputRef,
  projectDataFileInputId,
  projectDataLoading,
  projectDataClearing,
  enrichLoading,
  projectStatsLoading,
  projectDataSelectedFiles,
  projectDataSelectedSummary,
  availableImportPlugins,
  selectedImportPluginPreview,
  projectDataLastLoadResult,
  projectDataLoadReport,
  projectStats,
  projectStatsError,
  cellStats,
  cellStatsError,
  enrichReport,
  formatBytes,
  formatDateTime,
  onLoadProjectDataFiles,
  onRefreshStats,
  onUpload,
  onClearSelection,
  onClearData,
  onEnrich,
  onRemoveFile,
  onChangeFilePlugin,
}) => (
  <div className="service-card">
    <h3>Данные проекта</h3>
    <p className="service-card-hint">
      Здесь можно загрузить исходные файлы проекта, посмотреть статистику и запустить проектные операции над уже
      загруженными данными.
    </p>

    <div className="service-row">
      <input
        ref={projectDataFilesInputRef}
        id={projectDataFileInputId}
        type="file"
        multiple
        className="service-file-input"
        onChange={onLoadProjectDataFiles}
      />
      <label
        htmlFor={projectDataFileInputId}
        className={`service-btn file-picker ${!projectId || projectDataLoading || projectDataClearing ? 'disabled' : ''}`}
      >
        Выбрать файлы
      </label>
      <button
        type="button"
        className="service-btn"
        onClick={onRefreshStats}
        disabled={!projectId || projectStatsLoading || projectDataLoading || projectDataClearing}
      >
        {projectStatsLoading ? 'Обновление...' : 'Обновить статистику'}
      </button>
      <button
        type="button"
        className="service-btn primary"
        onClick={onUpload}
        disabled={!projectId || projectDataLoading || projectDataClearing || projectDataSelectedFiles.length === 0}
      >
        {projectDataLoading ? 'Загрузка...' : 'Загрузить выбранные'}
      </button>
      <button
        type="button"
        className="service-btn"
        onClick={onClearSelection}
        disabled={projectDataLoading || projectDataSelectedFiles.length === 0}
      >
        Очистить список
      </button>
      <button
        type="button"
        className="service-btn danger"
        onClick={onClearData}
        disabled={!projectId || projectDataLoading || projectDataClearing}
      >
        {projectDataClearing ? 'Очистка...' : 'Очистить данные'}
      </button>
      <button
        type="button"
        className="service-btn"
        onClick={onEnrich}
        disabled={!projectId || enrichLoading || projectDataLoading || projectDataClearing}
        title="Добавить в справочник БС координаты по совпадающим адресам из данных проекта"
      >
        {enrichLoading ? 'Обогащение...' : 'Обогатить БС по адресам'}
      </button>
    </div>

    {!projectId ? (
      <div className="service-empty">Выбери проект в левой панели, чтобы работать с его данными.</div>
    ) : (
      <>
        <div className="service-upload-panel">
          <div className="service-importer-summary">
            <div className="service-upload-summary-item">
              <span>Будет применён</span>
              <strong>{selectedImportPluginPreview?.name ?? 'Будет определено по каждому файлу'}</strong>
            </div>
            <div className="service-upload-summary-item">
              <span>Выбрано файлов</span>
              <strong>{projectDataSelectedSummary.totalFiles}</strong>
            </div>
            <div className="service-upload-summary-item">
              <span>Общий размер</span>
              <strong>{formatBytes(projectDataSelectedSummary.totalSizeBytes)}</strong>
            </div>
          </div>

          <div className="service-upload-summary-kinds">
            {projectDataSelectedSummary.byKind.length > 0 ? (
              projectDataSelectedSummary.byKind.map(([kind, count]) => (
                <span key={kind} className="service-upload-kind-chip">
                  {kind}: {count}
                </span>
              ))
            ) : (
              <span className="service-upload-placeholder">Выбери набор файлов для загрузки данных проекта.</span>
            )}
          </div>

          {projectDataSelectedFiles.length > 0 && (
            <div className="service-upload-file-list">
              {projectDataSelectedFiles.map((item) => (
                <div key={item.id} className="service-upload-file-item">
                  <div className="service-upload-file-main">
                    <div className="service-upload-file-name">{item.name}</div>
                    <div className="service-upload-file-meta">
                      <span>{item.kind}</span>
                      <span>{formatBytes(item.sizeBytes)}</span>
                    </div>
                    <div className="service-upload-file-meta">
                      <label className="service-field">
                        <span>Плагин импорта</span>
                        <select
                          className="service-select"
                          value={item.recognizedPluginId ?? ''}
                          onChange={(event) => onChangeFilePlugin(item.id, event.target.value)}
                        >
                          {availableImportPlugins.map((plugin) => (
                            <option key={plugin.id} value={plugin.id}>
                              {plugin.name}
                            </option>
                          ))}
                        </select>
                      </label>
                    </div>
                  </div>
                  <button
                    type="button"
                    className="service-upload-file-remove"
                    onClick={() => onRemoveFile(item.id)}
                    title="Убрать файл из списка"
                  >
                    Убрать
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {projectDataLastLoadResult && (
          <div className="service-summary-block">
            <div className="service-summary-header">
              <h4>Итог последней загрузки</h4>
              <p>Показываем, сколько записей обработано и сколько из них реально добавилось в проект.</p>
            </div>
            <div className="service-inline-note">
              Импорт выполнил: <strong>{projectDataLastLoadResult.import_plugin_name}</strong>
            </div>
            <div className="service-report-grid">
              <div className="service-report-item"><span>Связи</span><strong>добавлено {projectDataLastLoadResult.inserted_communications} из {projectDataLastLoadResult.communications_rows}</strong></div>
              <div className="service-report-item"><span>Устройства</span><strong>добавлено {projectDataLastLoadResult.inserted_device_history} из {projectDataLastLoadResult.device_history_rows}</strong></div>
              <div className="service-report-item"><span>Локации</span><strong>добавлено {projectDataLastLoadResult.inserted_location_events} из {projectDataLastLoadResult.location_events_rows}</strong></div>
              <div className="service-report-item"><span>IP-привязки</span><strong>добавлено {projectDataLastLoadResult.inserted_ip_bindings} из {projectDataLastLoadResult.ip_bindings_rows}</strong></div>
              <div className="service-report-item"><span>Ид. пользователя → MSISDN</span><strong>добавлено {projectDataLastLoadResult.inserted_user_msisdn_facts} из {projectDataLastLoadResult.user_msisdn_facts_rows}</strong></div>
              <div className="service-report-item"><span>IP → MSISDN пользователя</span><strong>добавлено {projectDataLastLoadResult.inserted_ip_msisdn_facts} из {projectDataLastLoadResult.ip_msisdn_facts_rows}</strong></div>
              <div className="service-report-item"><span>MSISDN → Устройство</span><strong>добавлено {projectDataLastLoadResult.inserted_msisdn_device_facts} из {projectDataLastLoadResult.msisdn_device_facts_rows}</strong></div>
              <div className="service-report-item"><span>MSISDN → Номер файла и текст</span><strong>добавлено {projectDataLastLoadResult.inserted_msisdn_text_facts} из {projectDataLastLoadResult.msisdn_text_facts_rows}</strong></div>
            </div>
          </div>
        )}

        <div className="service-summary-block">
          <div className="service-summary-header">
            <h4>Сейчас в проекте</h4>
            <p>Текущее количество записей в проектных таблицах после загрузки и дедупликации.</p>
          </div>
          {projectStatsError ? <p className="service-inline-error">{projectStatsError}</p> : null}
          <div className="service-report-grid">
            <div className="service-report-item"><span>Связей в проекте</span><strong>{projectStats?.communications_count ?? 0}</strong></div>
            <div className="service-report-item"><span>Устройств в проекте</span><strong>{projectStats?.device_history_count ?? 0}</strong></div>
            <div className="service-report-item"><span>Локационных событий</span><strong>{projectStats?.location_events_count ?? 0}</strong></div>
            <div className="service-report-item"><span>IP-привязок</span><strong>{projectStats?.ip_bindings_count ?? 0}</strong></div>
            <div className="service-report-item"><span>Ид. пользователя → MSISDN</span><strong>{projectStats?.user_msisdn_facts_count ?? 0}</strong></div>
            <div className="service-report-item"><span>IP → MSISDN пользователя</span><strong>{projectStats?.ip_msisdn_facts_count ?? 0}</strong></div>
            <div className="service-report-item"><span>MSISDN → Устройство</span><strong>{projectStats?.msisdn_device_facts_count ?? 0}</strong></div>
            <div className="service-report-item"><span>MSISDN → Номер файла и текст</span><strong>{projectStats?.msisdn_text_facts_count ?? 0}</strong></div>
          </div>
        </div>

        <div className="service-summary-block">
          <div className="service-summary-header">
            <h4>Справочник БС</h4>
            <p>Этот блок наполняется после загрузки справочника БС и обогащения по адресам из данных проекта.</p>
          </div>
          {cellStatsError ? <p className="service-inline-error">{cellStatsError}</p> : null}
          <div className="service-report-grid">
            <div className="service-report-item"><span>Записей БС</span><strong>{cellStats?.cell_tower_reference_count ?? 0}</strong></div>
            <div className="service-report-item"><span>Последняя загрузка БС</span><strong>{formatDateTime(cellStats?.last_loaded_at)}</strong></div>
            <div className="service-report-item"><span>Совпадений по адресам</span><strong>{enrichReport?.matched_by_address ?? 0}</strong></div>
            <div className="service-report-item"><span>Добавлено при обогащении</span><strong>{enrichReport?.inserted_rows ?? 0}</strong></div>
          </div>
        </div>

        {(projectDataLoadReport || projectStats || enrichReport) && (
          <details className="service-technical-details">
            <summary>Технические детали</summary>
            {projectDataLoadReport && <pre className="service-json">{JSON.stringify(projectDataLoadReport, null, 2)}</pre>}
            {projectStats && <pre className="service-json">{JSON.stringify(projectStats ?? {}, null, 2)}</pre>}
            {enrichReport && <pre className="service-json">{JSON.stringify(enrichReport, null, 2)}</pre>}
          </details>
        )}
      </>
    )}
  </div>
);

export default ProjectDataSection;
