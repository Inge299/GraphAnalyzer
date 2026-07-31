import React from 'react';
import type { ProjectDataImportPlugin, ProjectDataLoadResponse, ProjectDataPreviewResponse } from '../../../types/api';
import type { ProjectDataSelectedFileItem } from './types';

const text = {
  title: '\u0418\u043c\u043f\u043e\u0440\u0442 \u0434\u0430\u043d\u043d\u044b\u0445 \u043f\u0440\u043e\u0435\u043a\u0442\u0430',
  hint: '\u0412\u044b\u0431\u0435\u0440\u0438\u0442\u0435 \u0444\u0430\u0439\u043b\u044b \u0438\u043b\u0438 ZIP-\u0430\u0440\u0445\u0438\u0432\u044b. \u0421\u0438\u0441\u0442\u0435\u043c\u0430 \u043f\u0440\u043e\u0432\u0435\u0440\u0438\u0442 \u0438\u0445 \u0441\u043e\u0434\u0435\u0440\u0436\u0438\u043c\u043e\u0435, \u043f\u043e\u0434\u0431\u0435\u0440\u0451\u0442 import-\u043f\u043b\u0430\u0433\u0438\u043d \u0438 \u043f\u043e\u043a\u0430\u0436\u0435\u0442 \u0440\u0435\u0437\u0443\u043b\u044c\u0442\u0430\u0442 \u0434\u043e \u0437\u0430\u043f\u0438\u0441\u0438 \u0432 \u043f\u0440\u043e\u0435\u043a\u0442.',
  choose: '\u0412\u044b\u0431\u0440\u0430\u0442\u044c \u0444\u0430\u0439\u043b\u044b / \u0430\u0440\u0445\u0438\u0432\u044b',
  check: '\u041f\u0440\u043e\u0432\u0435\u0440\u0438\u0442\u044c \u0438 \u0440\u0430\u0441\u043f\u043e\u0437\u043d\u0430\u0442\u044c',
  checking: '\u041f\u0440\u043e\u0432\u0435\u0440\u043a\u0430...',
  import: '\u0418\u043c\u043f\u043e\u0440\u0442\u0438\u0440\u043e\u0432\u0430\u0442\u044c',
  importing: '\u0418\u043c\u043f\u043e\u0440\u0442...',
  clear: '\u041e\u0447\u0438\u0441\u0442\u0438\u0442\u044c \u0441\u043f\u0438\u0441\u043e\u043a',
  clearData: '\u041e\u0447\u0438\u0441\u0442\u0438\u0442\u044c \u0434\u0430\u043d\u043d\u044b\u0435 \u043f\u0440\u043e\u0435\u043a\u0442\u0430',
  clearing: '\u041e\u0447\u0438\u0441\u0442\u043a\u0430...',
};

const ImportResultBlock: React.FC<{ result: ProjectDataLoadResponse }> = ({ result }) => {
  const sources = Object.entries(result.source_counts || {}).filter(([, count]) => Number(count) > 0);
  const sourceRows = sources.reduce((sum, [, count]) => sum + Number(count || 0), 0);
  return (
    <div className="service-summary-block">
      <div className="service-summary-header">
        <h4>{'\u0418\u043c\u043f\u043e\u0440\u0442 \u0437\u0430\u0432\u0435\u0440\u0448\u0451\u043d'}</h4>
        <p>{`\u041f\u043b\u0430\u0433\u0438\u043d: ${result.import_plugin_name || result.import_plugin_id}`}</p>
      </div>
      <div className="service-report-grid">
        <div className="service-report-item"><span>{'\u041e\u0431\u0440\u0430\u0431\u043e\u0442\u0430\u043d\u043e \u0441\u0442\u0440\u043e\u043a'}</span><strong>{sourceRows}</strong></div>
        <div className="service-report-item"><span>{'\u0421\u0443\u0449\u043d\u043e\u0441\u0442\u0435\u0439'}</span><strong>{result.entities}</strong></div>
        <div className="service-report-item"><span>{'\u0424\u0430\u043a\u0442\u043e\u0432'}</span><strong>{result.facts}</strong></div>
        <div className="service-report-item"><span>{'\u0421\u0432\u044f\u0437\u0435\u0439'}</span><strong>{result.relations}</strong></div>
      </div>
      {sources.length > 0 && <p className="service-inline-note">{'\u0418\u0441\u0442\u043e\u0447\u043d\u0438\u043a\u0438: '}{sources.map(([id, count]) => `${id}: ${count}`).join(' · ')}</p>}
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
  projectStatsLoading: boolean;
  projectDataSelectedFiles: ProjectDataSelectedFileItem[];
  projectDataSelectedSummary: { totalFiles: number; totalSizeBytes: number; byKind: Array<[string, number]> };
  availableImportPlugins: ProjectDataImportPlugin[];
  projectDataLastLoadResult: ProjectDataLoadResponse | null;
  projectStats: any | null;
  formatBytes: (sizeBytes: number) => string;
  formatDateTime: (value: unknown) => string;
  onLoadProjectDataFiles: (event: React.ChangeEvent<HTMLInputElement>) => void;
  onRefreshStats: () => void;
  onPreview: () => void;
  onUpload: () => void;
  onClearSelection: () => void;
  onClearData: () => void;
  onRemoveFile: (id: string) => void;
  onChangeFilePlugin: (id: string, pluginId: string) => void;
}

const ProjectDataSection: React.FC<ProjectDataSectionProps> = ({
  projectId, projectDataFilesInputRef, projectDataFileInputId, projectDataLoading, projectDataPreviewLoading,
  projectDataPreview, projectDataClearing, projectStatsLoading, projectDataSelectedFiles, projectDataSelectedSummary,
  availableImportPlugins, projectDataLastLoadResult, projectStats, formatBytes, onLoadProjectDataFiles,
  onRefreshStats, onPreview, onUpload, onClearSelection, onClearData, onRemoveFile, onChangeFilePlugin,
}) => {
  const hasFiles = projectDataSelectedFiles.length > 0;
  const previewReady = Boolean(projectDataPreview && projectDataPreview.errors.length === 0 && projectDataPreview.files.length > 0);
  const previewRows = projectDataPreview?.runs.reduce((sum, run) => sum + run.datasets.reduce((inner, dataset) => inner + Number(dataset.row_count || 0), 0), 0) ?? 0;

  return (
    <div className="service-card">
      <h3>{text.title}</h3>
      <p className="service-card-hint">{text.hint}</p>

      <div className="service-import-steps" aria-label={'\u042d\u0442\u0430\u043f\u044b \u0438\u043c\u043f\u043e\u0440\u0442\u0430'}>
        <span className={hasFiles ? 'done' : 'active'}>1. {'\u0424\u0430\u0439\u043b\u044b'}</span>
        <span className={previewReady ? 'done' : hasFiles ? 'active' : ''}>2. {'\u041f\u0440\u043e\u0432\u0435\u0440\u043a\u0430 \u0444\u043e\u0440\u043c\u0430\u0442\u0430'}</span>
        <span className={projectDataLastLoadResult ? 'done' : previewReady ? 'active' : ''}>3. {'\u0418\u043c\u043f\u043e\u0440\u0442'}</span>
      </div>

      <div className="service-row">
        <input ref={projectDataFilesInputRef} id={projectDataFileInputId} type="file" multiple className="service-file-input" onChange={onLoadProjectDataFiles} />
        <label htmlFor={projectDataFileInputId} className={`service-btn file-picker ${!projectId || projectDataLoading || projectDataClearing ? 'disabled' : ''}`}>{text.choose}</label>
        <button type="button" className="service-btn" onClick={onPreview} disabled={!projectId || !hasFiles || projectDataLoading || projectDataPreviewLoading || projectDataClearing}>
          {projectDataPreviewLoading ? text.checking : text.check}
        </button>
        <button type="button" className="service-btn primary" onClick={onUpload} disabled={!projectId || !previewReady || projectDataLoading || projectDataClearing}>
          {projectDataLoading ? text.importing : text.import}
        </button>
        <button type="button" className="service-btn" onClick={onClearSelection} disabled={projectDataLoading || !hasFiles}>{text.clear}</button>
        <button type="button" className="service-btn danger" onClick={onClearData} disabled={!projectId || projectDataLoading || projectDataClearing}>
          {projectDataClearing ? text.clearing : text.clearData}
        </button>
      </div>

      {!projectId ? <div className="service-empty">{'\u0412\u044b\u0431\u0435\u0440\u0438\u0442\u0435 \u043f\u0440\u043e\u0435\u043a\u0442, \u0447\u0442\u043e\u0431\u044b \u0437\u0430\u0433\u0440\u0443\u0436\u0430\u0442\u044c \u0435\u0433\u043e \u0434\u0430\u043d\u043d\u044b\u0435.'}</div> : (
        <>
          <div className="service-upload-panel">
            <div className="service-importer-summary">
              <div className="service-upload-summary-item"><span>{'\u0424\u0430\u0439\u043b\u043e\u0432 \u0432 \u043e\u0447\u0435\u0440\u0435\u0434\u0438'}</span><strong>{projectDataSelectedSummary.totalFiles}</strong></div>
              <div className="service-upload-summary-item"><span>{'\u041e\u0431\u0449\u0438\u0439 \u0440\u0430\u0437\u043c\u0435\u0440'}</span><strong>{formatBytes(projectDataSelectedSummary.totalSizeBytes)}</strong></div>
              <div className="service-upload-summary-item"><span>{'\u0421\u0442\u0430\u0442\u0443\u0441'}</span><strong>{previewReady ? '\u0413\u043e\u0442\u043e\u0432\u043e \u043a \u0438\u043c\u043f\u043e\u0440\u0442\u0443' : hasFiles ? '\u0422\u0440\u0435\u0431\u0443\u0435\u0442\u0441\u044f \u043f\u0440\u043e\u0432\u0435\u0440\u043a\u0430' : '\u041e\u0436\u0438\u0434\u0430\u043d\u0438\u0435 \u0444\u0430\u0439\u043b\u043e\u0432'}</strong></div>
            </div>
            <div className="service-upload-summary-kinds">
              {projectDataSelectedSummary.byKind.length ? projectDataSelectedSummary.byKind.map(([kind, count]) => <span key={kind} className="service-upload-kind-chip">{kind}: {count}</span>) : <span className="service-upload-placeholder">{'\u0412\u044b\u0431\u0435\u0440\u0438\u0442\u0435 \u0444\u0430\u0439\u043b\u044b \u0434\u043b\u044f \u0438\u043c\u043f\u043e\u0440\u0442\u0430.'}</span>}
            </div>
          </div>

          {projectDataPreview && <div className={`service-preview-summary ${projectDataPreview.errors.length ? 'error' : 'ready'}`}>
            <div><strong>{projectDataPreview.errors.length ? '\u041d\u0443\u0436\u043d\u043e \u0432\u043d\u0435\u0441\u0442\u0438 \u0438\u0437\u043c\u0435\u043d\u0435\u043d\u0438\u044f' : '\u0424\u043e\u0440\u043c\u0430\u0442 \u043f\u0440\u043e\u0432\u0435\u0440\u0435\u043d'}</strong><span>{'\u041f\u0440\u043e\u0432\u0435\u0440\u043a\u0430 \u043d\u0435 \u0438\u0437\u043c\u0435\u043d\u044f\u0435\u0442 \u0434\u0430\u043d\u043d\u044b\u0435 \u043f\u0440\u043e\u0435\u043a\u0442\u0430.'}</span></div>
            <div className="service-preview-summary-stats"><span>{projectDataPreview.files.length} {'\u0444\u0430\u0439\u043b.'}</span><span>{previewRows} {'\u0441\u0442\u0440\u043e\u043a'}</span><span>{projectDataPreview.errors.length} {'\u043e\u0448\u0438\u0431.'}</span></div>
          </div>}

          {hasFiles && <div className="service-upload-file-list">{projectDataSelectedFiles.map((item) => {
            const path = (item.file as File & { webkitRelativePath?: string }).webkitRelativePath || item.file.name;
            const filePreview = projectDataPreview?.files.find((file) => file.path === path);
            const fileErrors = projectDataPreview?.errors.filter((error) => error.path === path) ?? [];
            const members = filePreview?.members ?? [];
            const label = item.pluginSelectionMode === 'manual' ? '\u0412\u044b\u0431\u0440\u0430\u043d \u0432\u0440\u0443\u0447\u043d\u0443\u044e' : item.recognizedPluginName ? '\u0420\u0430\u0441\u043f\u043e\u0437\u043d\u0430\u043d \u0430\u0432\u0442\u043e\u043c\u0430\u0442\u0438\u0447\u0435\u0441\u043a\u0438' : '\u0415\u0449\u0451 \u043d\u0435 \u043f\u0440\u043e\u0432\u0435\u0440\u0435\u043d';
            return <div key={item.id} className={`service-upload-file-item ${fileErrors.length ? 'preview-error' : previewReady ? 'preview-ready' : ''}`}>
              <div className="service-upload-file-header"><div className="service-upload-file-main">
                <div className="service-upload-file-title-row"><div className="service-upload-file-name">{item.name}</div><span className={`service-file-status ${fileErrors.length ? 'error' : previewReady ? 'ready' : 'idle'}`}>{fileErrors.length ? '\u041e\u0448\u0438\u0431\u043a\u0430' : label}</span></div>
                <div className="service-upload-file-meta"><span>{item.kind}</span><span>{formatBytes(item.sizeBytes)}</span></div>
                <label className="service-field"><span>{'\u0418\u043c\u043f\u043e\u0440\u0442-\u043f\u043b\u0430\u0433\u0438\u043d'}</span><select className="service-select" value={item.recognizedPluginId ?? ''} onChange={(event) => onChangeFilePlugin(item.id, event.target.value)}><option value="">{'\u041d\u0435 \u0432\u044b\u0431\u0440\u0430\u043d'}</option>{availableImportPlugins.map((plugin) => <option key={plugin.id} value={plugin.id}>{plugin.name}</option>)}</select></label>
              </div><button type="button" className="service-upload-file-remove" onClick={() => onRemoveFile(item.id)}>{'\u0423\u0431\u0440\u0430\u0442\u044c'}</button></div>
              {projectDataPreview && <details className="service-file-preview-details" open={fileErrors.length > 0}><summary>{'\u041f\u043e\u0434\u0440\u043e\u0431\u043d\u043e\u0441\u0442\u0438 \u043f\u0440\u043e\u0432\u0435\u0440\u043a\u0438'}</summary><div className="service-file-preview-content">
                {members.length > 0 && <div className="service-file-preview-plugin">{members.map((member) => <span key={member.path}>{member.path} · {member.plugin_name}</span>)}</div>}
                {fileErrors.length > 0 && <div className="service-preview-messages error">{fileErrors.map((error, index) => <div key={index}>{error.message}</div>)}</div>}
              </div></details>}
            </div>;
          })}</div>}

          {projectDataLastLoadResult && <ImportResultBlock result={projectDataLastLoadResult} />}
          <div className="service-row service-data-actions"><button type="button" className="service-btn" onClick={onRefreshStats} disabled={projectStatsLoading || projectDataLoading || projectDataClearing}>{projectStatsLoading ? '\u041e\u0431\u043d\u043e\u0432\u043b\u0435\u043d\u0438\u0435...' : '\u041e\u0431\u043d\u043e\u0432\u0438\u0442\u044c \u0441\u0442\u0432\u043e\u0434\u043a\u0443 \u043f\u0440\u043e\u0435\u043a\u0442\u0430'}</button></div>
          {projectStats && <details className="service-technical-details"><summary>{'\u0422\u0435\u0445\u043d\u0438\u0447\u0435\u0441\u043a\u0438\u0435 \u0434\u0435\u0442\u0430\u043b\u0438'}</summary><pre className="service-json">{JSON.stringify(projectStats, null, 2)}</pre></details>}
        </>
      )}
    </div>
  );
};

export default ProjectDataSection;