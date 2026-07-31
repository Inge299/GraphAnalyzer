import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { consoleApi } from '../../services/api';
import GraphDomainEditor from './GraphDomainEditor';
import CellTowerReferenceSection from './service/CellTowerReferenceSection';
import ConsoleDataSourcesSection from './service/ConsoleDataSourcesSection';
import ConsoleProcedureRegistrySection from './service/ConsoleProcedureRegistrySection';
import AnalysisProfilesSection from './service/AnalysisProfilesSection';
import ImportPluginsAdminSection from './service/ImportPluginsAdminSection';
import MetadataBundleAdminSection from './service/MetadataBundleAdminSection';
import ReferenceProvidersSection from './service/ReferenceProvidersSection';
import {
  bindingModeOptions,
  categoryLabels,
  columnTypeOptions,
  formatBytes,
  paramTypeOptions,
  projectContextSourceOptions,
} from './service/formOptions';
import ObjectTypeMappingsSection from './service/ObjectTypeMappingsSection';
import ProjectDataSection from './service/ProjectDataSection';
import PythonConsolePluginsSection from './service/PythonConsolePluginsSection';
import PythonGraphPluginsSection from './service/PythonGraphPluginsSection';
import ServiceCategorySidebar from './service/ServiceCategorySidebar';
import { useConsoleRegistryAdmin } from './service/useConsoleRegistryAdmin';
import { useProcedureFormEditor } from './service/useProcedureFormEditor';
import { useProjectDataAdmin } from './service/useProjectDataAdmin';
import { formatDateTime } from '../../utils/formatters';
import type { ProcedureParamFormItem, ProcedureResultSetFormItem, ServiceCategory } from './service/types';
import './ServiceFunctionsView.css';

export type { ServiceCategory } from './service/types';

interface ServiceFunctionsViewProps {
  projectId: number | null;
  initialCategory?: ServiceCategory;
  mode?: 'full' | 'project_data_only';
}


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
    throw new Error(`${fallbackLabel}: РЅРµРєРѕСЂСЂРµРєС‚РЅС‹Р№ JSON`);
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
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

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
        setMessage(`РџСЂРѕС†РµРґСѓСЂР° ${payload.key} РѕР±РЅРѕРІР»РµРЅР°`);
      } else {
        await consoleApi.createProcedure(payload);
        setMessage(`РџСЂРѕС†РµРґСѓСЂР° ${payload.key} Р·Р°СЂРµРіРёСЃС‚СЂРёСЂРѕРІР°РЅР°`);
      }

      await consoleAdmin.fetchConsoleRegistry();
      procedureEditor.setSelectedProcedureKey(payload.key);
    } catch (err: any) {
      setError(String(err?.response?.data?.detail || err?.message || 'РќРµ СѓРґР°Р»РѕСЃСЊ СЃРѕС…СЂР°РЅРёС‚СЊ РїСЂРѕС†РµРґСѓСЂСѓ'));
    }
  }, [consoleAdmin, procedureEditor]);

  const handleDeleteProcedure = useCallback(async () => {
    if (!procedureEditor.selectedProcedureKey || !procedureEditor.selectedProcedure) {
      setError('РЎРЅР°С‡Р°Р»Р° РІС‹Р±РµСЂРё РїСЂРѕС†РµРґСѓСЂСѓ РґР»СЏ СѓРґР°Р»РµРЅРёСЏ');
      return;
    }
    const confirmed = window.confirm(
      `РЈРґР°Р»РёС‚СЊ Р·Р°СЂРµРіРёСЃС‚СЂРёСЂРѕРІР°РЅРЅСѓСЋ РїСЂРѕС†РµРґСѓСЂСѓ "${procedureEditor.selectedProcedure.name}" (${procedureEditor.selectedProcedure.key || procedureEditor.selectedProcedure.id})?`,
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
      setError(String(err?.response?.data?.detail || err?.message || 'РќРµ СѓРґР°Р»РѕСЃСЊ СѓРґР°Р»РёС‚СЊ РїСЂРѕС†РµРґСѓСЂСѓ'));
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

        {activeCategory === 'reference_providers' && (
          <ReferenceProvidersSection onMessage={setMessage} onError={setError} />
        )}
        {activeCategory === 'cell_towers' && (
          <CellTowerReferenceSection
              cellStats={projectDataAdmin.cellStats}
              cellStatsLoading={projectDataAdmin.cellStatsLoading}
              cellStatsError={projectDataAdmin.cellStatsError}
              onRefreshStats={() => void projectDataAdmin.fetchCellStats()}
            />
        )}

        {activeCategory === 'project_data' && (
          <ProjectDataSection
            projectId={projectId}
            projectDataFilesInputRef={projectDataAdmin.projectDataFilesInputRef}
            projectDataFileInputId={projectDataAdmin.projectDataFileInputId}
            projectDataLoading={projectDataAdmin.projectDataLoading}
            projectDataPreviewLoading={projectDataAdmin.projectDataPreviewLoading}
            projectDataPreview={projectDataAdmin.projectDataPreview}
            projectDataClearing={projectDataAdmin.projectDataClearing}
            projectStatsLoading={projectDataAdmin.projectStatsLoading}
            projectDataSelectedFiles={projectDataAdmin.projectDataSelectedFiles}
            projectDataSelectedSummary={projectDataAdmin.projectDataSelectedSummary}
            availableImportPlugins={projectDataAdmin.availableImportPlugins}
            projectDataLastLoadResult={projectDataAdmin.projectDataLastLoadResult}
            projectStats={projectDataAdmin.projectStats}
            formatBytes={formatBytes}
            formatDateTime={formatDateTime}
            onLoadProjectDataFiles={(event) => void projectDataAdmin.handleLoadProjectDataFiles(event)}
            onRefreshStats={() => void projectDataAdmin.fetchProjectStats()}
            onPreview={() => void projectDataAdmin.handlePreviewProjectData()}
            onUpload={() => void projectDataAdmin.handleUploadProjectData()}
            onClearSelection={projectDataAdmin.handleClearProjectDataSelection}
            onClearData={() => void projectDataAdmin.handleClearProjectData()}
            onRemoveFile={projectDataAdmin.handleRemoveProjectDataFile}
            onChangeFilePlugin={projectDataAdmin.handleChangeProjectDataFilePlugin}
          />
        )}

        {activeCategory === 'analysis_profiles' && (
          <AnalysisProfilesSection onMessage={setMessage} onError={setError} />
        )}
        {activeCategory === 'import_plugins' && (
          <ImportPluginsAdminSection
            plugins={projectDataAdmin.availableImportPlugins}
            selectedPluginId={projectDataAdmin.selectedImportPluginId}
            pluginForm={projectDataAdmin.importPluginForm}
            saving={projectDataAdmin.importPluginSaving}
            managing={projectDataAdmin.importPluginManaging}
            onSelectPlugin={projectDataAdmin.setSelectedImportPluginId}
            onPluginFormChange={(updates) => projectDataAdmin.setImportPluginForm((prev) => ({ ...prev, ...updates }))}
            onSavePlugin={() => void projectDataAdmin.handleSaveImportPlugin()}
            onInstallPlugin={(file) => void projectDataAdmin.handleInstallImportPlugin(file)}
            onDeletePlugin={() => void projectDataAdmin.handleDeleteImportPlugin()}
            onRefresh={() => void projectDataAdmin.fetchImportPlugins()}
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

        {activeCategory === 'graph_edges' && <GraphDomainEditor mode="edges" />}
        {activeCategory === 'graph_nodes' && <GraphDomainEditor mode="nodes" />}

        {activeCategory === 'console_registry' && (
          <div className="service-console-grid">
            <PythonConsolePluginsSection onMessage={setMessage} onError={setError} />
            <PythonGraphPluginsSection onMessage={setMessage} onError={setError} />

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
