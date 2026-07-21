import { useCallback, useEffect, useMemo, useState } from 'react';
import type { ConsoleDataSource, ConsoleProfile } from '../../../types/api';
import {
  createDefaultProcedureColumn,
  createDefaultProcedureParam,
  createDefaultResultSet,
  createLocalId,
  createObjectsAnalysisParamPreset,
  defaultProcedureForm,
} from './formOptions';
import type {
  ProcedureColumnFormItem,
  ProcedureFormState,
  ProcedureParamFormItem,
  ProcedureResultSetFormItem,
} from './types';

interface UseProcedureFormEditorArgs {
  consoleDataSources: ConsoleDataSource[];
  consoleProcedures: ConsoleProfile[];
  onMessage: (message: string | null) => void;
  onError: (message: string | null) => void;
}

const mapParamToForm = (param: ConsoleProcedureParamLike): ProcedureParamFormItem => ({
  id: createLocalId('param'),
  name: String(param.name || '').trim(),
  label: String(param.label || param.name || '').trim(),
  type: String(param.type || 'string'),
  required: Boolean(param.required),
  hidden: Boolean(param.hidden),
  defaultValue: param.default_value == null ? '' : String(param.default_value),
  binding_mode: String(param.binding_mode || 'manual'),
  binding_source: String(param.binding_source || ''),
  binding_attr_key: String(param.binding_attr_key || ''),
});

const mapColumnToForm = (column: ConsoleProcedureColumnLike): ProcedureColumnFormItem => ({
  id: createLocalId('column'),
  key: String(column.key || '').trim(),
  label: String(column.label || column.key || '').trim(),
  type: String(column.type || 'string'),
  width: column.width == null ? '' : String(column.width),
  visible: column.visible !== false,
});

const mapResultSetToForm = (resultSet: ConsoleProcedureResultSetLike): ProcedureResultSetFormItem => ({
  id: createLocalId('result-set'),
  result_index: resultSet.result_index == null ? '1' : String(resultSet.result_index),
  result_key: String(resultSet.result_key || 'main').trim(),
  name: String(resultSet.name || 'Основная таблица').trim(),
  visible: resultSet.visible !== false,
  columns: Array.isArray(resultSet.columns) ? resultSet.columns.map(mapColumnToForm) : [],
});

type ConsoleProcedureParamLike = {
  name?: string | null;
  label?: string | null;
  type?: string | null;
  required?: boolean | null;
  hidden?: boolean | null;
  default_value?: unknown;
  binding_mode?: string | null;
  binding_source?: string | null;
  binding_attr_key?: string | null;
};

type ConsoleProcedureColumnLike = {
  key?: string | null;
  label?: string | null;
  type?: string | null;
  width?: number | string | null;
  visible?: boolean | null;
};

type ConsoleProcedureResultSetLike = {
  result_index?: number | string | null;
  result_key?: string | null;
  name?: string | null;
  visible?: boolean | null;
  columns?: ConsoleProcedureColumnLike[] | null;
};

export const useProcedureFormEditor = ({
  consoleDataSources,
  consoleProcedures,
  onMessage,
  onError,
}: UseProcedureFormEditorArgs) => {
  const [selectedProcedureKey, setSelectedProcedureKey] = useState<string>('');
  const [procedureSearch, setProcedureSearch] = useState('');
  const [procedureForm, setProcedureForm] = useState<ProcedureFormState>(defaultProcedureForm);

  const selectedProcedure = useMemo(
    () => consoleProcedures.find((item) => String(item.key || item.id) === selectedProcedureKey) || null,
    [consoleProcedures, selectedProcedureKey],
  );

  useEffect(() => {
    if (!selectedProcedure) return;
    setProcedureForm({
      key: String(selectedProcedure.key || selectedProcedure.id || ''),
      name: selectedProcedure.name || '',
      description: selectedProcedure.description || '',
      source_key: selectedProcedure.source_key || '',
      schema_name: selectedProcedure.schema_name || 'dbo',
      procedure_name: selectedProcedure.procedure_name || '',
      timeout_seconds: String(selectedProcedure.timeout_seconds || 120),
      default_limit: String(selectedProcedure.default_limit || 200),
      supports_graph_selection: selectedProcedure.supports_graph_selection !== false,
      is_active: selectedProcedure.is_active !== false,
      params:
        Array.isArray(selectedProcedure.params) && selectedProcedure.params.length > 0
          ? selectedProcedure.params.map(mapParamToForm)
          : [],
      resultSets:
        Array.isArray(selectedProcedure.result_sets) && selectedProcedure.result_sets.length > 0
          ? selectedProcedure.result_sets.map(mapResultSetToForm)
          : [createDefaultResultSet()],
    });
  }, [selectedProcedure]);

  const resetProcedureForm = useCallback(() => {
    setSelectedProcedureKey('');
    setProcedureForm({
      ...defaultProcedureForm,
      source_key: consoleDataSources[0]?.key || '',
      params: defaultProcedureForm.params.map((item) => ({ ...item, id: createLocalId('param') })),
      resultSets: defaultProcedureForm.resultSets.map((item) => ({
        ...item,
        id: createLocalId('result-set'),
      })),
    });
  }, [consoleDataSources]);

  const handleDuplicateProcedureTemplate = useCallback(() => {
    if (!selectedProcedure) {
      onError('Сначала выбери процедуру, которую хочешь взять как шаблон');
      return;
    }

    const baseKey = String(selectedProcedure.key || selectedProcedure.id || '').trim();
    const baseName = String(selectedProcedure.name || '').trim();

    setSelectedProcedureKey('');
    setProcedureForm({
      key: baseKey ? `${baseKey}_copy` : '',
      name: baseName ? `${baseName} (копия)` : '',
      description: selectedProcedure.description || '',
      source_key: selectedProcedure.source_key || '',
      schema_name: selectedProcedure.schema_name || 'dbo',
      procedure_name: selectedProcedure.procedure_name || '',
      timeout_seconds: String(selectedProcedure.timeout_seconds || 120),
      default_limit: String(selectedProcedure.default_limit || 200),
      supports_graph_selection: selectedProcedure.supports_graph_selection !== false,
      is_active: selectedProcedure.is_active !== false,
      params:
        Array.isArray(selectedProcedure.params) && selectedProcedure.params.length > 0
          ? selectedProcedure.params.map(mapParamToForm)
          : [],
      resultSets:
        Array.isArray(selectedProcedure.result_sets) && selectedProcedure.result_sets.length > 0
          ? selectedProcedure.result_sets.map(mapResultSetToForm)
          : [createDefaultResultSet()],
    });
    onMessage(`Процедура "${selectedProcedure.name}" скопирована в форму как шаблон`);
    onError(null);
  }, [onError, onMessage, selectedProcedure]);

  const updateProcedureParam = useCallback((id: string, patch: Partial<ProcedureParamFormItem>) => {
    setProcedureForm((prev) => ({
      ...prev,
      params: prev.params.map((item) => {
        if (item.id !== id) return item;
        const next = { ...item, ...patch };
        if (patch.binding_mode && patch.binding_mode !== 'selected_node_attr_csv') {
          next.binding_attr_key = '';
        }
        if (patch.binding_mode && patch.binding_mode !== 'project_context') {
          next.binding_source = '';
        }
        return next;
      }),
    }));
  }, []);

  const addProcedureParam = useCallback(() => {
    setProcedureForm((prev) => ({
      ...prev,
      params: [...prev.params, createDefaultProcedureParam()],
    }));
  }, []);

  const applyObjectsAnalysisPreset = useCallback(() => {
    setProcedureForm((prev) => ({
      ...prev,
      supports_graph_selection: true,
      params: createObjectsAnalysisParamPreset(),
    }));
    onMessage('Шаблон параметров для анализа объектов применён');
    onError(null);
  }, [onError, onMessage]);

  const removeProcedureParam = useCallback((id: string) => {
    setProcedureForm((prev) => ({
      ...prev,
      params: prev.params.filter((item) => item.id !== id),
    }));
  }, []);

  const updateResultSet = useCallback((id: string, patch: Partial<ProcedureResultSetFormItem>) => {
    setProcedureForm((prev) => ({
      ...prev,
      resultSets: prev.resultSets.map((item) => (item.id === id ? { ...item, ...patch } : item)),
    }));
  }, []);

  const addResultSet = useCallback(() => {
    setProcedureForm((prev) => ({
      ...prev,
      resultSets: [
        ...prev.resultSets,
        {
          ...createDefaultResultSet(),
          result_index: String(prev.resultSets.length + 1),
          result_key: `result_${prev.resultSets.length + 1}`,
          name: `Результат ${prev.resultSets.length + 1}`,
        },
      ],
    }));
  }, []);

  const removeResultSet = useCallback((id: string) => {
    setProcedureForm((prev) => ({
      ...prev,
      resultSets: prev.resultSets.filter((item) => item.id !== id),
    }));
  }, []);

  const addColumnToResultSet = useCallback((resultSetId: string) => {
    setProcedureForm((prev) => ({
      ...prev,
      resultSets: prev.resultSets.map((resultSet) =>
        resultSet.id === resultSetId
          ? { ...resultSet, columns: [...resultSet.columns, createDefaultProcedureColumn()] }
          : resultSet,
      ),
    }));
  }, []);

  const updateColumnInResultSet = useCallback((
    resultSetId: string,
    columnId: string,
    patch: Partial<ProcedureColumnFormItem>,
  ) => {
    setProcedureForm((prev) => ({
      ...prev,
      resultSets: prev.resultSets.map((resultSet) =>
        resultSet.id === resultSetId
          ? {
              ...resultSet,
              columns: resultSet.columns.map((column) =>
                column.id === columnId ? { ...column, ...patch } : column,
              ),
            }
          : resultSet,
      ),
    }));
  }, []);

  const removeColumnFromResultSet = useCallback((resultSetId: string, columnId: string) => {
    setProcedureForm((prev) => ({
      ...prev,
      resultSets: prev.resultSets.map((resultSet) =>
        resultSet.id === resultSetId
          ? { ...resultSet, columns: resultSet.columns.filter((column) => column.id !== columnId) }
          : resultSet,
      ),
    }));
  }, []);

  return {
    selectedProcedure,
    selectedProcedureKey,
    setSelectedProcedureKey,
    procedureSearch,
    setProcedureSearch,
    procedureForm,
    setProcedureForm,
    resetProcedureForm,
    handleDuplicateProcedureTemplate,
    updateProcedureParam,
    addProcedureParam,
    applyObjectsAnalysisPreset,
    removeProcedureParam,
    updateResultSet,
    addResultSet,
    removeResultSet,
    addColumnToResultSet,
    updateColumnInResultSet,
    removeColumnFromResultSet,
  };
};
