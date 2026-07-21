import { useCallback, useEffect, useMemo, useState } from 'react';
import { consoleApi } from '../../../services/api';
import type { ConsoleDataSource, ConsoleObjectTypeMapping, ConsoleProfile } from '../../../types/api';
import { createLocalId, defaultDataSourceForm, defaultObjectTypeMappings } from './formOptions';
import type { DataSourceFormState, ObjectTypeMappingFormItem } from './types';

const mapObjectTypeMappingToForm = (mapping: ConsoleObjectTypeMapping): ObjectTypeMappingFormItem => ({
  id: createLocalId('type-map'),
  graph_type: String(mapping.graph_type || '').trim(),
  procedure_type: String(mapping.procedure_type || '').trim(),
  is_active: mapping.is_active !== false,
});

interface UseConsoleRegistryAdminOptions {
  onMessage: (message: string | null) => void;
  onError: (message: string | null) => void;
  parseJsonInput: <T>(raw: string, fallbackLabel: string) => T;
  toPrettyJson: (value: unknown) => string;
}

export const useConsoleRegistryAdmin = ({
  onMessage,
  onError,
  parseJsonInput,
  toPrettyJson,
}: UseConsoleRegistryAdminOptions) => {
  const [consoleDataSources, setConsoleDataSources] = useState<ConsoleDataSource[]>([]);
  const [consoleProcedures, setConsoleProcedures] = useState<ConsoleProfile[]>([]);
  const [consoleObjectTypeMappings, setConsoleObjectTypeMappings] = useState<ObjectTypeMappingFormItem[]>(defaultObjectTypeMappings);
  const [consoleLoading, setConsoleLoading] = useState(false);
  const [consoleSaving, setConsoleSaving] = useState(false);
  const [consoleTestingSource, setConsoleTestingSource] = useState(false);
  const [sourceSearch, setSourceSearch] = useState('');
  const [selectedSourceKey, setSelectedSourceKey] = useState<string>('');
  const [dataSourceForm, setDataSourceForm] = useState<DataSourceFormState>(defaultDataSourceForm);

  const selectedSource = useMemo(
    () => consoleDataSources.find((item) => item.key === selectedSourceKey) || null,
    [consoleDataSources, selectedSourceKey],
  );

  const filteredDataSources = useMemo(() => {
    const query = sourceSearch.trim().toLowerCase();
    if (!query) return consoleDataSources;
    return consoleDataSources.filter((source) =>
      [
        source.name,
        source.key,
        source.host,
        source.database_name,
        source.username || '',
        source.description || '',
      ]
        .join(' ')
        .toLowerCase()
        .includes(query),
    );
  }, [consoleDataSources, sourceSearch]);

  useEffect(() => {
    if (!selectedSource) return;
    setDataSourceForm({
      key: selectedSource.key || '',
      name: selectedSource.name || '',
      description: selectedSource.description || '',
      host: selectedSource.host || '',
      port: String(selectedSource.port || 1433),
      database_name: selectedSource.database_name || '',
      username: selectedSource.username || '',
      password: '',
      driver: selectedSource.driver || 'pymssql',
      auth_type: selectedSource.auth_type || 'sql',
      dbms: selectedSource.dbms || 'mssql',
      is_active: selectedSource.is_active !== false,
      optionsText: toPrettyJson(selectedSource.options || {}),
    });
  }, [selectedSource, toPrettyJson]);

  const fetchConsoleRegistry = useCallback(async (currentProcedureKey?: string) => {
    setConsoleLoading(true);
    onError(null);
    try {
      const [sourcesResponse, proceduresResponse, mappingsResponse] = await Promise.all([
        consoleApi.dataSources(),
        consoleApi.procedures(),
        consoleApi.objectTypeMappings(),
      ]);

      const sources = Array.isArray(sourcesResponse?.data_sources) ? sourcesResponse.data_sources : [];
      const procedures = Array.isArray(proceduresResponse?.procedures) ? proceduresResponse.procedures : [];
      const mappings = Array.isArray(mappingsResponse?.mappings) ? mappingsResponse.mappings : [];

      setConsoleDataSources(sources);
      setConsoleProcedures(procedures);
      setConsoleObjectTypeMappings(
        mappings.length ? mappings.map(mapObjectTypeMappingToForm) : defaultObjectTypeMappings.map((item) => ({ ...item })),
      );

      if (!selectedSourceKey && sources[0]?.key) {
        setSelectedSourceKey(sources[0].key);
      }
      if (currentProcedureKey) {
        return { sources, procedures };
      }
      return { sources, procedures };
    } catch (err: any) {
      onError(String(err?.response?.data?.detail || err?.message || 'Не удалось загрузить реестр консольных процедур'));
      return { sources: [], procedures: [] };
    } finally {
      setConsoleLoading(false);
    }
  }, [onError, selectedSourceKey]);

  const resetDataSourceForm = useCallback(() => {
    setSelectedSourceKey('');
    setDataSourceForm(defaultDataSourceForm);
  }, []);

  const handleSaveDataSource = useCallback(async () => {
    setConsoleSaving(true);
    onError(null);
    onMessage(null);
    try {
      const payload = {
        key: dataSourceForm.key.trim(),
        name: dataSourceForm.name.trim(),
        description: dataSourceForm.description.trim(),
        host: dataSourceForm.host.trim(),
        port: Number(dataSourceForm.port || 1433),
        database_name: dataSourceForm.database_name.trim(),
        username: dataSourceForm.username.trim() || null,
        password: dataSourceForm.password || undefined,
        driver: dataSourceForm.driver.trim() || 'pymssql',
        auth_type: dataSourceForm.auth_type.trim() || 'sql',
        dbms: dataSourceForm.dbms.trim() || 'mssql',
        is_active: dataSourceForm.is_active,
        options: parseJsonInput<Record<string, any>>(dataSourceForm.optionsText || '{}', 'Опции datasource'),
      };

      if (selectedSourceKey) {
        await consoleApi.updateDataSource(selectedSourceKey, payload);
        onMessage(`Источник данных ${payload.key} обновлён`);
      } else {
        await consoleApi.createDataSource(payload);
        onMessage(`Источник данных ${payload.key} создан`);
      }

      await fetchConsoleRegistry();
      setSelectedSourceKey(payload.key);
    } catch (err: any) {
      onError(String(err?.response?.data?.detail || err?.message || 'Не удалось сохранить источник данных'));
    } finally {
      setConsoleSaving(false);
    }
  }, [dataSourceForm, fetchConsoleRegistry, onError, onMessage, parseJsonInput, selectedSourceKey]);

  const handleTestDataSource = useCallback(async () => {
    if (!selectedSourceKey) {
      onError('Сначала выбери или сохрани datasource');
      return;
    }
    setConsoleTestingSource(true);
    onError(null);
    onMessage(null);
    try {
      const response = await consoleApi.testDataSource(selectedSourceKey);
      onMessage(`${response.message}. Server: ${response.server_name || 'unknown'}, DB: ${response.database_name || 'unknown'}`);
    } catch (err: any) {
      onError(String(err?.response?.data?.detail || err?.message || 'Не удалось проверить подключение'));
    } finally {
      setConsoleTestingSource(false);
    }
  }, [onError, onMessage, selectedSourceKey]);

  const handleDeleteDataSource = useCallback(async () => {
    if (!selectedSourceKey || !selectedSource) {
      onError('Сначала выбери datasource для удаления');
      return;
    }

    const confirmed = window.confirm(`Удалить источник данных "${selectedSource.name}" (${selectedSource.key})?`);
    if (!confirmed) return;

    setConsoleSaving(true);
    onError(null);
    onMessage(null);
    try {
      const response = await consoleApi.deleteDataSource(selectedSourceKey);
      onMessage(response.message);
      await fetchConsoleRegistry();
      resetDataSourceForm();
    } catch (err: any) {
      onError(String(err?.response?.data?.detail || err?.message || 'Не удалось удалить источник данных'));
    } finally {
      setConsoleSaving(false);
    }
  }, [fetchConsoleRegistry, onError, onMessage, resetDataSourceForm, selectedSource, selectedSourceKey]);

  const addObjectTypeMapping = useCallback(() => {
    setConsoleObjectTypeMappings((prev) => [
      ...prev,
      { id: createLocalId('type-map'), graph_type: '', procedure_type: '', is_active: true },
    ]);
  }, []);

  const updateObjectTypeMapping = useCallback((id: string, updates: Partial<ObjectTypeMappingFormItem>) => {
    setConsoleObjectTypeMappings((prev) => prev.map((item) => (item.id === id ? { ...item, ...updates } : item)));
  }, []);

  const removeObjectTypeMapping = useCallback((id: string) => {
    setConsoleObjectTypeMappings((prev) => prev.filter((item) => item.id !== id));
  }, []);

  const resetObjectTypeMappings = useCallback(() => {
    setConsoleObjectTypeMappings(defaultObjectTypeMappings.map((item) => ({ ...item, id: createLocalId('type-map') })));
  }, []);

  const handleSaveObjectTypeMappings = useCallback(async () => {
    setConsoleSaving(true);
    onError(null);
    onMessage(null);
    try {
      const payload = consoleObjectTypeMappings
        .map((item, index) => ({
          graph_type: item.graph_type.trim(),
          procedure_type: item.procedure_type.trim(),
          is_active: item.is_active,
          position: index,
        }))
        .filter((item) => item.graph_type && item.procedure_type);

      const response = await consoleApi.updateObjectTypeMappings(payload);
      const items = Array.isArray(response?.mappings) ? response.mappings : [];
      setConsoleObjectTypeMappings(
        items.length ? items.map(mapObjectTypeMappingToForm) : defaultObjectTypeMappings.map((item) => ({ ...item })),
      );
      onMessage('Соответствия типов объектов сохранены');
    } catch (err: any) {
      onError(String(err?.response?.data?.detail || err?.message || 'Не удалось сохранить соответствия типов объектов'));
    } finally {
      setConsoleSaving(false);
    }
  }, [consoleObjectTypeMappings, onError, onMessage]);

  return {
    consoleDataSources,
    consoleProcedures,
    consoleObjectTypeMappings,
    consoleLoading,
    consoleSaving,
    consoleTestingSource,
    sourceSearch,
    setSourceSearch,
    selectedSourceKey,
    setSelectedSourceKey,
    selectedSource,
    filteredDataSources,
    dataSourceForm,
    setDataSourceForm,
    fetchConsoleRegistry,
    resetDataSourceForm,
    handleSaveDataSource,
    handleTestDataSource,
    handleDeleteDataSource,
    addObjectTypeMapping,
    updateObjectTypeMapping,
    removeObjectTypeMapping,
    resetObjectTypeMappings,
    handleSaveObjectTypeMappings,
  };
};
