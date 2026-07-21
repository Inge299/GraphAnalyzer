import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { consoleApi, projectDataApi } from '../../services/api';
import GraphDomainEditor from './GraphDomainEditor';
import CellTowerReferenceSection from './service/CellTowerReferenceSection';
import ConsoleDataSourcesSection from './service/ConsoleDataSourcesSection';
import ConsoleProcedureRegistrySection from './service/ConsoleProcedureRegistrySection';
import ImportPluginsAdminSection from './service/ImportPluginsAdminSection';
import MetadataBundleAdminSection from './service/MetadataBundleAdminSection';
import {
  bindingModeOptions,
  categoryLabels,
  columnTypeOptions,
  defaultReferencePath,
  formatBytes,
  paramTypeOptions,
  projectContextSourceOptions,
} from './service/formOptions';
import ObjectTypeMappingsSection from './service/ObjectTypeMappingsSection';
import ProjectDataSection from './service/ProjectDataSection';
import ServiceCategorySidebar from './service/ServiceCategorySidebar';
import { useConsoleRegistryAdmin } from './service/useConsoleRegistryAdmin';
import { useProcedureFormEditor } from './service/useProcedureFormEditor';
import { useProjectDataAdmin } from './service/useProjectDataAdmin';
import type { ProcedureParamFormItem, ProcedureResultSetFormItem, ServiceCategory } from './service/types';
import './ServiceFunctionsView.css';

export type { ServiceCategory } from './service/types';

interface ServiceFunctionsViewProps {
  projectId: number | null;
  initialCategory?: ServiceCategory;
  mode?: 'full' | 'project_data_only';
}

const formatDateTime = (value: unknown): string => {
  if (!value) return '—';
  const dt = new Date(String(value));
  if (Number.isNaN(dt.getTime())) return String(value);
  return dt.toLocaleString('ru-RU');
};

const isTimeoutError = (error: unknown): boolean => {
  if (error instanceof Error) {
    return String(error.message || '').toLowerCase().includes('timeout');
  }
  return String((error as { message?: string })?.message || '').toLowerCase().includes('timeout');
};

const getRequestErrorMessage = (error: unknown, fallback: string, timeoutMessage?: string): string => {
  const detail = (error as { response?: { data?: { detail?: unknown } } })?.response?.data?.detail;
  if (typeof detail === 'string' && detail.trim()) return detail;
  if (timeoutMessage && isTimeoutError(error)) return timeoutMessage;
  if (error instanceof Error && error.message) return error.message;
  const message = String((error as { message?: string })?.message || '').trim();
  return message || fallback;
};

const parseJsonInput = <T,>(raw: string, fallbackLabel: string): T => {
  try {
    return JSON.parse(raw) as T;
  } catch {
    throw new Error(`${fallbackLabel}: некорректный JSON`);
  }
};

const toPrettyJson = (value: unknown) => JSON.stringify(value, null, 2);

const buildProcedureParamsPayload = (items: ProcedureParamFormItem[]) =>
  items
    .map((item, index) => {
      const name = item.name.trim().replace(/^@+/, '');
      if (!name) return null;
      const payload: Record<string, any> = {
        name,
        label: item.label.trim() || name,
        type: item.type.trim() || 'string',
        required: item.required,
        hidden: item.hidden,
        binding_mode: item.binding_mode.trim() || 'manual',
        position: index,
      };
      if (item.defaultValue.trim() !== '') payload.default = item.defaultValue;
      if (item.binding_source.trim()) payload.binding_source = item.binding_source.trim();
      if (item.binding_mode === 'selected_node_attr_csv' && item.binding_attr_key.trim()) {
        payload.binding_config = { attr_key: item.binding_attr_key.trim() };
      }
      return payload;
    })
    .filter(Boolean);

const buildResultSetsPayload = (items: ProcedureResultSetFormItem[]) =>
  items
    .map((resultSet, resultSetIndex) => {
      const resultKey = resultSet.result_key.trim() || `result_${resultSetIndex + 1}`;
      const resultIndexNumber = Number.parseInt(resultSet.result_index, 10);
      return {
        result_index: Number.isFinite(resultIndexNumber) && resultIndexNumber > 0 ? resultIndexNumber : resultSetIndex + 1,
        result_key: resultKey,
        name: resultSet.name.trim() || resultKey,
        visible: resultSet.visible,
        position: resultSetIndex,
        columns: resultSet.columns
          .map((column, columnIndex) => {
            const key = column.key.trim();
            if (!key) return null;
            return {
              key,
              original_name: key,
              label: column.label.trim() || key,
              type: column.type.trim() || 'string',
              width: column.width.trim() ? Number.parseInt(column.width, 10) : null,
              visible: column.visible,
              position: columnIndex,
            };
          })
          .filter(Boolean),
      };
    })
    .filter(Boolean);

const ServiceFunctionsView: React.FC<ServiceFunctionsViewProps> = ({
  projectId,
  initialCategory = 'cell_towers',
  mode = 'full',
}) => {
  const [activeCategory, setActiveCategory] = useState<ServiceCategory>(initialCategory);
  const [referencePath, setReferencePath] = useState(defaultReferencePath);
  const [cellStats, setCellStats] = useState<any | null>(null);
  const [cellStatsLoading, setCellStatsLoading] = useState(false);
  const [cellLoadLoading, setCellLoadLoading] = useState(false);
  const [cellLoadReport, setCellLoadReport] = useState<any | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [cellStatsError, setCellStatsError] = useState<string | null>(null);

  const consoleAdmin = useConsoleRegistryAdmin({
    onMessage: setMessage,
    onError: setError,
    parseJsonInput,
    toPrettyJson,
  });

  const procedureEditor = useProcedureFormEditor({
    consoleDataSources: consoleAdmin.consoleDataSources,
    consoleProcedures: consoleAdmin.consoleProcedures,
    onMessage: setMessage,
    onError: setError,
  });

  const projectDataAdmin = useProjectDataAdmin({
    projectId,
    onMessage: setMessage,
    onError: setError,
    getRequestErrorMessage,
  });

  const fetchCellStats = useCallback(async () => {
    setCellStatsLoading(true);
    setCellStatsError(null);
    try {
      setCellStats(await projectDataApi.cellTowerStats());
    } catch (err: unknown) {
      setCellStatsError(
        getRequestErrorMessage(
          err,
          'Не удалось получить статистику справочника БС',
          'Статистика справочника БС обновляется дольше обычного. Попробуй повторить через минуту.',
        ),
      );
    } finally {
      setCellStatsLoading(false);
    }
  }, []);

  const filteredProcedures = useMemo(() => {
    const query = procedureEditor.procedureSearch.trim().toLowerCase();
    if (!query) return consoleAdmin.consoleProcedures;
    return consoleAdmin.consoleProcedures.filter((procedure) =>
      [
        procedure.name,
        procedure.key || procedure.id,
        procedure.schema_name || '',
        procedure.procedure_name || '',
        procedure.source_name || '',
        procedure.source_key || '',
        procedure.description || '',
      ]
        .join(' ')
        .toLowerCase()
        .includes(query),
    );
  }, [consoleAdmin.consoleProcedures, procedureEditor.procedureSearch]);

  useEffect(() => {
    void fetchCellStats();
  }, [fetchCellStats]);

  useEffect(() => {
    if (activeCategory !== 'console_registry') return;
    void (async () => {
      const { procedures } = await consoleAdmin.fetchConsoleRegistry();
      if (!procedureEditor.selectedProcedureKey && procedures[0]?.key) {
        procedureEditor.setSelectedProcedureKey(String(procedures[0].key || procedures[0].id));
      }
    })();
  }, [activeCategory, consoleAdmin, procedureEditor]);

  useEffect(() => {
    setActiveCategory(initialCategory);
    setMessage(null);
    setError(null);
  }, [initialCategory]);

  const handleLoadReference = useCallback(async () => {
    const path = referencePath.trim();
    if (!path) {
      setError('Укажи путь к CSV справочника БС');
      return;
    }
    setCellLoadLoading(true);
    setMessage(null);
    setError(null);
    try {
      const report = await projectDataApi.loadCellTowers(path);
      setCellLoadReport(report);
      setMessage('Справочник БС успешно загружен');
      await fetchCellStats();
    } catch (err: any) {
      setError(String(err?.response?.data?.detail || err?.message || 'Не удалось загрузить справочник БС'));
    } finally {
      setCellLoadLoading(false);
    }
  }, [fetchCellStats, referencePath]);

  const handleSaveProcedure = useCallback(async () => {
    setError(null);
    setMessage(null);
    try {
      const payload = {
        key: procedureEditor.procedureForm.key.trim(),
        name: procedureEditor.procedureForm.name.trim(),
        description: procedureEditor.procedureForm.description.trim(),
        source_key: procedureEditor.procedureForm.source_key.trim(),
        schema_name: procedureEditor.procedureForm.schema_name.trim() || 'dbo',
        procedure_name: procedureEditor.procedureForm.procedure_name.trim(),
        timeout_seconds: Number(procedureEditor.procedureForm.timeout_seconds || 120),
        default_limit: Number(procedureEditor.procedureForm.default_limit || 200),
        supports_graph_selection: procedureEditor.procedureForm.supports_graph_selection,
        is_active: procedureEditor.procedureForm.is_active,
        params: buildProcedureParamsPayload(procedureEditor.procedureForm.params),
        result_sets: buildResultSetsPayload(procedureEditor.procedureForm.resultSets),
      };

      if (procedureEditor.selectedProcedureKey) {
        await consoleApi.updateProcedure(procedureEditor.selectedProcedureKey, payload);
        setMessage(`Процедура ${payload.key} обновлена`);
      } else {
        await consoleApi.createProcedure(payload);
        setMessage(`Процедура ${payload.key} зарегистрирована`);
      }

      await consoleAdmin.fetchConsoleRegistry();
      procedureEditor.setSelectedProcedureKey(payload.key);
    } catch (err: any) {
      setError(String(err?.response?.data?.detail || err?.message || 'Не удалось сохранить процедуру'));
    }
  }, [consoleAdmin, procedureEditor]);

  const handleDeleteProcedure = useCallback(async () => {
    if (!procedureEditor.selectedProcedureKey || !procedureEditor.selectedProcedure) {
      setError('Сначала выбери процедуру для удаления');
      return;
    }
    const confirmed = window.confirm(
      `Удалить зарегистрированную процедуру "${procedureEditor.selectedProcedure.name}" (${procedureEditor.selectedProcedure.key || procedureEditor.selectedProcedure.id})?`,
    );
    if (!confirmed) return;

    setError(null);
    setMessage(null);
    try {
      const response = await consoleApi.deleteProcedure(procedureEditor.selectedProcedureKey);
      setMessage(response.message);
      await consoleAdmin.fetchConsoleRegistry();
      procedureEditor.resetProcedureForm();
    } catch (err: any) {
      setError(String(err?.response?.data?.detail || err?.message || 'Не удалось удалить процедуру'));
    }
  }, [consoleAdmin, procedureEditor]);

  const categories = useMemo<ServiceCategory[]>(
    () =>
      mode === 'project_data_only'
        ? ['project_data']
        : (Object.keys(categoryLabels) as ServiceCategory[]).filter(
            (category): category is Exclude<ServiceCategory, 'project_data'> => category !== 'project_data',
          ),
    [mode],
  );

  return (
    <div className={`service-screen ${mode === 'project_data_only' ? 'project-data-only' : ''}`}>
      {mode === 'full' && (
        <ServiceCategorySidebar
          categories={categories}
          activeCategory={activeCategory}
          categoryLabels={categoryLabels}
          onSelect={(category) => {
            setActiveCategory(category);
            setMessage(null);
            setError(null);
          }}
        />
      )}

      <section className="service-screen-content">
        {message && <div className="service-screen-banner success">{message}</div>}
        {error && <div className="service-screen-banner error">{error}</div>}

        {activeCategory === 'cell_towers' && (
          <CellTowerReferenceSection
            referencePath={referencePath}
            onReferencePathChange={setReferencePath}
            onLoadReference={() => void handleLoadReference()}
            onRefreshStats={() => void fetchCellStats()}
            cellLoadLoading={cellLoadLoading}
            cellStatsLoading={cellStatsLoading}
            cellLoadReport={cellLoadReport}
            cellStats={cellStats}
            cellStatsError={cellStatsError}
            formatDateTime={formatDateTime}
          />
        )}

        {activeCategory === 'project_data' && (
          <ProjectDataSection
            projectId={projectId}
            projectDataFilesInputRef={projectDataAdmin.projectDataFilesInputRef}
            projectDataFileInputId={projectDataAdmin.projectDataFileInputId}
            projectDataLoading={projectDataAdmin.projectDataLoading}
            projectDataClearing={projectDataAdmin.projectDataClearing}
            enrichLoading={projectDataAdmin.enrichLoading}
            projectStatsLoading={projectDataAdmin.projectStatsLoading}
            projectDataSelectedFiles={projectDataAdmin.projectDataSelectedFiles}
            projectDataSelectedSummary={projectDataAdmin.projectDataSelectedSummary}
            availableImportPlugins={projectDataAdmin.availableImportPlugins}
            selectedImportPluginPreview={projectDataAdmin.selectedImportPluginPreview}
            projectDataLastLoadResult={projectDataAdmin.projectDataLastLoadResult}
            projectDataLoadReport={projectDataAdmin.projectDataLoadReport}
            projectStats={projectDataAdmin.projectStats}
            projectStatsError={projectDataAdmin.projectStatsError}
            cellStats={projectDataAdmin.cellStats}
            cellStatsError={projectDataAdmin.cellStatsError}
            enrichReport={projectDataAdmin.enrichReport}
            formatBytes={formatBytes}
            formatDateTime={formatDateTime}
            onLoadProjectDataFiles={(event) => void projectDataAdmin.handleLoadProjectDataFiles(event)}
            onRefreshStats={() => void projectDataAdmin.fetchProjectStats()}
            onUpload={() => void projectDataAdmin.handleUploadProjectData()}
            onClearSelection={projectDataAdmin.handleClearProjectDataSelection}
            onClearData={() => void projectDataAdmin.handleClearProjectData()}
            onEnrich={() => void projectDataAdmin.handleEnrichCellTowersByAddress()}
            onRemoveFile={projectDataAdmin.handleRemoveProjectDataFile}
            onChangeFilePlugin={projectDataAdmin.handleChangeProjectDataFilePlugin}
          />
        )}

        {activeCategory === 'import_plugins' && (
          <ImportPluginsAdminSection
            plugins={projectDataAdmin.availableImportPlugins}
            selectedPluginId={projectDataAdmin.selectedImportPluginId}
            pluginForm={projectDataAdmin.importPluginForm}
            saving={projectDataAdmin.importPluginSaving}
            onSelectPlugin={projectDataAdmin.setSelectedImportPluginId}
            onPluginFormChange={(updates) => projectDataAdmin.setImportPluginForm((prev) => ({ ...prev, ...updates }))}
            onSavePlugin={() => void projectDataAdmin.handleSaveImportPlugin()}
          />
        )}

        {activeCategory === 'metadata_bundle' && (
          <MetadataBundleAdminSection
            metadataExporting={projectDataAdmin.metadataExporting}
            metadataImporting={projectDataAdmin.metadataImporting}
            metadataImportInputRef={projectDataAdmin.metadataImportInputRef}
            onExportMetadata={() => void projectDataAdmin.handleExportMetadataBundle()}
            onImportMetadataFile={(event) => void projectDataAdmin.handleMetadataImportFile(event)}
          />
        )}

        {activeCategory === 'graph_model' && <GraphDomainEditor />}

        {activeCategory === 'console_registry' && (
          <div className="service-console-grid">
            <ConsoleDataSourcesSection
              consoleLoading={consoleAdmin.consoleLoading}
              consoleSaving={consoleAdmin.consoleSaving}
              consoleTestingSource={consoleAdmin.consoleTestingSource}
              selectedSourceKey={consoleAdmin.selectedSourceKey}
              selectedSource={consoleAdmin.selectedSource}
              sourceSearch={consoleAdmin.sourceSearch}
              filteredDataSources={consoleAdmin.filteredDataSources}
              allDataSourcesCount={consoleAdmin.consoleDataSources.length}
              dataSourceForm={consoleAdmin.dataSourceForm}
              onRefresh={() => void consoleAdmin.fetchConsoleRegistry()}
              onTest={() => void consoleAdmin.handleTestDataSource()}
              onReset={consoleAdmin.resetDataSourceForm}
              onDelete={() => void consoleAdmin.handleDeleteDataSource()}
              onSelectSource={consoleAdmin.setSelectedSourceKey}
              onSourceSearchChange={consoleAdmin.setSourceSearch}
              onFormChange={(updates) => consoleAdmin.setDataSourceForm((prev) => ({ ...prev, ...updates }))}
              onSave={() => void consoleAdmin.handleSaveDataSource()}
            />

            <ObjectTypeMappingsSection
              mappings={consoleAdmin.consoleObjectTypeMappings}
              consoleSaving={consoleAdmin.consoleSaving}
              onReset={consoleAdmin.resetObjectTypeMappings}
              onAdd={consoleAdmin.addObjectTypeMapping}
              onUpdate={consoleAdmin.updateObjectTypeMapping}
              onRemove={consoleAdmin.removeObjectTypeMapping}
              onSave={() => void consoleAdmin.handleSaveObjectTypeMappings()}
            />

            <ConsoleProcedureRegistrySection
              consoleSaving={consoleAdmin.consoleSaving}
              selectedProcedureKey={procedureEditor.selectedProcedureKey}
              selectedProcedure={procedureEditor.selectedProcedure}
              procedureSearch={procedureEditor.procedureSearch}
              filteredProcedures={filteredProcedures}
              allProceduresCount={consoleAdmin.consoleProcedures.length}
              consoleDataSources={consoleAdmin.consoleDataSources}
              procedureForm={procedureEditor.procedureForm}
              paramTypeOptions={paramTypeOptions}
              bindingModeOptions={bindingModeOptions}
              projectContextSourceOptions={projectContextSourceOptions}
              columnTypeOptions={columnTypeOptions}
              onReset={procedureEditor.resetProcedureForm}
              onDuplicateTemplate={procedureEditor.handleDuplicateProcedureTemplate}
              onDelete={() => void handleDeleteProcedure()}
              onProcedureSearchChange={procedureEditor.setProcedureSearch}
              onSelectProcedure={procedureEditor.setSelectedProcedureKey}
              onProcedureFormChange={(updates) => procedureEditor.setProcedureForm((prev) => ({ ...prev, ...updates }))}
              onApplyObjectsAnalysisPreset={procedureEditor.applyObjectsAnalysisPreset}
              onAddProcedureParam={procedureEditor.addProcedureParam}
              onUpdateProcedureParam={procedureEditor.updateProcedureParam}
              onRemoveProcedureParam={procedureEditor.removeProcedureParam}
              onAddResultSet={procedureEditor.addResultSet}
              onUpdateResultSet={procedureEditor.updateResultSet}
              onRemoveResultSet={procedureEditor.removeResultSet}
              onAddColumnToResultSet={procedureEditor.addColumnToResultSet}
              onUpdateColumnInResultSet={procedureEditor.updateColumnInResultSet}
              onRemoveColumnFromResultSet={procedureEditor.removeColumnFromResultSet}
              onSave={() => void handleSaveProcedure()}
            />
          </div>
        )}
      </section>
    </div>
  );
};

export default ServiceFunctionsView;
