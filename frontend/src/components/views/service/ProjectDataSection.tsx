import React from 'react';
import { projectDataApi } from '../../../services/api';
import type { ProjectDataImportPlugin, ProjectDataImportQualityReport, ProjectDataLoadResponse, ProjectDataPreviewResponse } from '../../../types/api';
import type { ProjectDataSelectedFileItem } from './types';

const ImportQualityBlock: React.FC<{
  projectId: number;
  refreshToken: unknown;
  formatDateTime: (value: unknown) => string;
}> = ({ projectId, refreshToken, formatDateTime }) => {
  const [report, setReport] = React.useState<ProjectDataImportQualityReport | null>(null);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const loadReport = React.useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setReport(await projectDataApi.importQuality(projectId));
    } catch (err: any) {
      setError(String(err?.response?.data?.detail || err?.message || '\u041d\u0435 \u0443\u0434\u0430\u043b\u043e\u0441\u044c \u043f\u043e\u043b\u0443\u0447\u0438\u0442\u044c \u043e\u0442\u0447\u0451\u0442 \u043a\u0430\u0447\u0435\u0441\u0442\u0432\u0430 \u0438\u043c\u043f\u043e\u0440\u0442\u0430'));
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  React.useEffect(() => {
    void loadReport();
  }, [loadReport, refreshToken]);

  const summary = report?.summary;
  return (
    <div className="service-summary-block">
      <div className="service-summary-header">
        <h4>{'\u041a\u043e\u043d\u0442\u0440\u043e\u043b\u044c \u043a\u0430\u0447\u0435\u0441\u0442\u0432\u0430 \u0438\u043c\u043f\u043e\u0440\u0442\u0430'}</h4>
        <p>{'\u041f\u0440\u043e\u0438\u0441\u0445\u043e\u0436\u0434\u0435\u043d\u0438\u0435 \u0434\u0430\u043d\u043d\u044b\u0445, \u0440\u0435\u0437\u0443\u043b\u044c\u0442\u0430\u0442\u044b \u0437\u0430\u043f\u0443\u0441\u043a\u043e\u0432 \u0438 \u043f\u0440\u0435\u0434\u0443\u043f\u0440\u0435\u0436\u0434\u0435\u043d\u0438\u044f. \u0422\u043e\u043b\u044c\u043a\u043e \u0447\u0442\u0435\u043d\u0438\u0435, \u0434\u0430\u043d\u043d\u044b\u0435 \u043f\u0440\u043e\u0435\u043a\u0442\u0430 \u043d\u0435 \u0438\u0437\u043c\u0435\u043d\u044f\u044e\u0442\u0441\u044f.'}</p>
      </div>
      <button type="button" className="service-btn" onClick={() => void loadReport()} disabled={loading}>
        {loading ? '\u041e\u0431\u043d\u043e\u0432\u043b\u0435\u043d\u0438\u0435...' : '\u041e\u0431\u043d\u043e\u0432\u0438\u0442\u044c \u043e\u0442\u0447\u0451\u0442'}
      </button>
      {error ? <p className="service-inline-error">{error}</p> : null}
      {!loading && summary && summary.import_runs === 0 ? (
        <p className="service-inline-note">{'\u0417\u0430\u043f\u0443\u0441\u043a\u043e\u0432 \u0438\u043c\u043f\u043e\u0440\u0442\u0430 \u0435\u0449\u0451 \u043d\u0435\u0442.'}</p>
      ) : summary ? (
        <>
          <div className="service-report-grid">
            <div className="service-report-item"><span>{'\u041f\u043e\u0441\u043b\u0435\u0434\u043d\u0438\u0439 \u043f\u0430\u043a\u0435\u0442'}</span><strong>{summary.latest_batch}</strong></div>
            <div className="service-report-item"><span>{'\u0417\u0430\u043f\u0443\u0441\u043a\u043e\u0432 \u0438\u043c\u043f\u043e\u0440\u0442\u0430'}</span><strong>{summary.import_runs}</strong></div>
            <div className="service-report-item"><span>{'\u0418\u0441\u0442\u043e\u0447\u043d\u0438\u043a\u043e\u0432 \u0432 \u043f\u0430\u043a\u0435\u0442\u0435'}</span><strong>{summary.latest_sources}</strong></div>
            <div className="service-report-item"><span>{'\u041f\u0440\u043e\u0447\u0438\u0442\u0430\u043d\u043e \u0441\u0442\u0440\u043e\u043a'}</span><strong>{summary.read_total}</strong></div>
            <div className="service-report-item"><span>{'\u0421\u0442\u0440\u043e\u043a \u0441\u0432\u044f\u0437\u0435\u0439'}</span><strong>{summary.communications_rows}</strong></div>
            <div className="service-report-item"><span>{'\u041f\u043e\u0441\u043b\u0435 \u0434\u0435\u0434\u0443\u043f\u043b\u0438\u043a\u0430\u0446\u0438\u0438'}</span><strong>{summary.events_after_dedup}</strong></div>
          </div>
          {report && report.warnings.length > 0 && (
            <details className="service-technical-details">
              <summary>{'\u041f\u0440\u0435\u0434\u0443\u043f\u0440\u0435\u0436\u0434\u0435\u043d\u0438\u044f'}: {report.warnings.length}</summary>
              {report.warnings.map((warning, index) => (
                <p key={`${String(warning.batch_id)}-${index}`} className="service-inline-note">
                  {formatDateTime(warning.generated_at)} · {String(warning.message)} ({String(warning.rows)})
                </p>
              ))}
            </details>
          )}
          {report && report.runs.length > 0 && (
            <details className="service-technical-details">
              <summary>{'\u0418\u0441\u0442\u043e\u0440\u0438\u044f \u0437\u0430\u043f\u0443\u0441\u043a\u043e\u0432'}: {report.runs.length}</summary>
              <div className="service-preview-table-wrap">
                <table className="service-preview-table">
                  <thead><tr><th>{'\u0412\u0440\u0435\u043c\u044f'}</th><th>{'\u041f\u0430\u043a\u0435\u0442'}</th><th>{'\u041f\u0440\u043e\u0447\u0438\u0442\u0430\u043d\u043e'}</th><th>{'\u0421\u0432\u044f\u0437\u0435\u0439'}</th><th>{'\u0423\u0441\u0442\u0440\u043e\u0439\u0441\u0442\u0432'}</th><th>{'\u041b\u043e\u043a\u0430\u0446\u0438\u0439'}</th></tr></thead>
                  <tbody>{report.runs.map((run, index) => <tr key={`${String(run.manifest_path)}-${index}`}><td>{formatDateTime(run.generated_at)}</td><td>{String(run.batch_id)}</td><td>{String(run.read_total)}</td><td>{String(run.communications_rows)}</td><td>{String(run.device_rows)}</td><td>{String(run.location_rows)}</td></tr>)}</tbody>
                </table>
              </div>
            </details>
          )}
        </>
      ) : null}
    </div>
  );
};
interface ProjectDataSectionProps {
  projectId: number | null;
  projectDataFilesInputRef: React.Ref<HTMLInputElement>;
  projectDataFileInputId: string;
  projectDataLoading: boolean;
  projectDataPreviewLoading: boolean;
  projectDataPreview: ProjectDataPreviewResponse | null;
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
  onPreview: () => void;
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
  projectDataPreviewLoading,
  projectDataPreview,
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
  onPreview,
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
        className="service-btn"
        onClick={onPreview}
        disabled={!projectId || projectDataLoading || projectDataPreviewLoading || projectDataClearing || projectDataSelectedFiles.length === 0}
      >
        {projectDataPreviewLoading ? 'Проверка...' : 'Проверить без загрузки'}
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

          {projectDataPreview && (
            <div className={`service-preview-summary ${projectDataPreview.errors.length > 0 ? 'error' : 'ready'}`}>
              <div>
                <strong>{projectDataPreview.errors.length > 0 ? 'Есть замечания перед загрузкой' : 'Файлы готовы к загрузке'}</strong>
                <span>Проверка не изменила данные проекта.</span>
              </div>
              <div className="service-preview-summary-stats">
                <span>{projectDataPreview.files.length} файл.</span>
                <span>{projectDataPreview.errors.length} ошиб.</span>
                <span>
                  {projectDataPreview.runs.reduce(
                    (total, run) => total + run.datasets.reduce((sum, dataset) => sum + dataset.row_count, 0),
                    0,
                  )} строк
                </span>
              </div>
            </div>
          )}

          {projectDataSelectedFiles.length > 0 && (
            <div className="service-upload-file-list">
              {projectDataSelectedFiles.map((item) => {
                const itemPath = (item.file as File & { webkitRelativePath?: string }).webkitRelativePath || item.file.name;
                const previewFile = projectDataPreview?.files.find((file) => file.path === itemPath) ?? null;
                const previewRun = projectDataPreview?.runs.find((run) => run.recognized_files.includes(itemPath)) ?? null;
                const fileErrors = projectDataPreview?.errors.filter(
                  (error) => error.path === itemPath || (!error.path && previewRun && error.plugin_id === previewRun.plugin.id),
                ) ?? [];
                const runWarnings = projectDataPreview?.warnings.filter(
                  (warning) => previewRun && warning.startsWith(`${previewRun.plugin.name}:`),
                ) ?? [];
                const isGroupOwner = Boolean(previewRun && previewRun.recognized_files[0] === itemPath);
                const nonEmptyDatasets = previewRun?.datasets.filter((dataset) => dataset.row_count > 0) ?? [];
                const displayedDatasets = isGroupOwner ? nonEmptyDatasets : [];
                const status = !projectDataPreview
                  ? { label: 'Не проверен', tone: 'idle' }
                  : fileErrors.length > 0 || !previewFile?.plugin_id
                    ? { label: 'Ошибка', tone: 'error' }
                    : runWarnings.length > 0
                      ? { label: 'С предупреждениями', tone: 'warning' }
                      : { label: 'Готов', tone: 'ready' };

                return (
                  <div key={item.id} className={`service-upload-file-item preview-${status.tone}`}>
                    <div className="service-upload-file-header">
                      <div className="service-upload-file-main">
                        <div className="service-upload-file-title-row">
                          <div className="service-upload-file-name">{item.name}</div>
                          <span className={`service-file-status ${status.tone}`}>{status.label}</span>
                        </div>
                        <div className="service-upload-file-meta">
                          <span>{item.kind}</span>
                          <span>{formatBytes(item.sizeBytes)}</span>
                        </div>
                        <label className="service-field">
                          <span>Плагин импорта</span>
                          <select
                            className="service-select"
                            value={item.recognizedPluginId ?? ''}
                            onChange={(event) => onChangeFilePlugin(item.id, event.target.value)}
                          >
                            <option value="">Не выбран: формат не распознан</option>
                            {availableImportPlugins.map((plugin) => (
                              <option key={plugin.id} value={plugin.id}>
                                {plugin.name}
                              </option>
                            ))}
                          </select>
                        </label>
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

                    {projectDataPreview && (
                      <details className="service-file-preview-details" open={fileErrors.length > 0}>
                        <summary>
                          Результат проверки
                          {previewRun && isGroupOwner && ` · ${nonEmptyDatasets.reduce((sum, dataset) => sum + dataset.row_count, 0)} строк`}
                        </summary>
                        <div className="service-file-preview-content">
                          <div className="service-file-preview-plugin">
                            <strong>{previewFile?.plugin_name || 'Формат не распознан'}</strong>
                            {previewFile?.score != null && <span>Уверенность распознавания: {previewFile.score}</span>}
                          </div>

                          {fileErrors.length > 0 && (
                            <div className="service-preview-messages error">
                              {fileErrors.map((error, index) => <div key={index}>{error.message}</div>)}
                            </div>
                          )}

                          {runWarnings.length > 0 && (
                            <div className="service-preview-messages warning">
                              {runWarnings.map((warning, index) => <div key={index}>{warning}</div>)}
                            </div>
                          )}

                          {previewRun && previewRun.recognized_files.length > 1 && (
                            <div className="service-file-preview-group">
                              {isGroupOwner
                                ? `\u041f\u0430\u043a\u0435\u0442\u043d\u044b\u0439 \u0437\u0430\u043f\u0443\u0441\u043a: ${previewRun.recognized_files.length} \u0444\u0430\u0439\u043b. \u0420\u0435\u0437\u0443\u043b\u044c\u0442\u0430\u0442\u044b \u0440\u0430\u0441\u0441\u0447\u0438\u0442\u0430\u043d\u044b \u0434\u043b\u044f \u0432\u0441\u0435\u0439 \u0433\u0440\u0443\u043f\u043f\u044b.`
                                : `\u0412\u0445\u043e\u0434\u0438\u0442 \u0432 \u043f\u0430\u043a\u0435\u0442\u043d\u044b\u0439 \u0437\u0430\u043f\u0443\u0441\u043a. \u041e\u0431\u0449\u0438\u0439 \u0440\u0435\u0437\u0443\u043b\u044c\u0442\u0430\u0442 \u043f\u043e\u043a\u0430\u0437\u0430\u043d \u0432 \u043a\u0430\u0440\u0442\u043e\u0447\u043a\u0435: ${previewRun.recognized_files[0]}.`}
                            </div>
                          )}

                          {displayedDatasets.length > 0 && (
                            <div className="service-file-preview-datasets">
                              {displayedDatasets.map((dataset) => (
                                <details key={dataset.id} className="service-preview-dataset">
                                  <summary>{dataset.label}: {dataset.row_count} строк</summary>
                                  {isGroupOwner && dataset.sample_rows.length > 0 ? (
                                    <div className="service-preview-table-wrap">
                                      <table className="service-preview-table">
                                        <thead>
                                          <tr>{dataset.columns.slice(0, 12).map((column) => <th key={column}>{column}</th>)}</tr>
                                        </thead>
                                        <tbody>
                                          {dataset.sample_rows.map((row, rowIndex) => (
                                            <tr key={rowIndex}>
                                              {dataset.columns.slice(0, 12).map((column) => (
                                                <td key={column}>
                                                  {typeof row[column] === 'object' ? JSON.stringify(row[column]) : String(row[column] ?? '')}
                                                </td>
                                              ))}
                                            </tr>
                                          ))}
                                        </tbody>
                                      </table>
                                    </div>
                                  ) : previewRun && previewRun.recognized_files.length > 1 ? (
                                    <p className="service-file-preview-note">
                                      Образец строк показан в первой карточке пакетной группы: {previewRun.recognized_files[0]}.
                                    </p>
                                  ) : null}
                                </details>
                              ))}
                            </div>
                          )}
                        </div>
                      </details>
                    )}
                  </div>
                );
              })}
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

        <ImportQualityBlock
          projectId={projectId}
          refreshToken={`${String(projectDataLastLoadResult?.load_batch_id || '')}:${JSON.stringify(projectStats || {})}`}
          formatDateTime={formatDateTime}
        />
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
