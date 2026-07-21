import React from 'react';
import type { ConsoleDataSource, ConsoleProfile } from '../../../types/api';
import type {
  ProcedureColumnFormItem,
  ProcedureParamFormItem,
  ProcedureResultSetFormItem,
  ProcedureFormState,
  SelectOption,
} from './types';
import ProcedureParamsEditor from './ProcedureParamsEditor';
import ProcedureResultSetsEditor from './ProcedureResultSetsEditor';

interface ConsoleProcedureRegistrySectionProps {
  consoleSaving: boolean;
  selectedProcedureKey: string;
  selectedProcedure: ConsoleProfile | null;
  procedureSearch: string;
  filteredProcedures: ConsoleProfile[];
  allProceduresCount: number;
  consoleDataSources: ConsoleDataSource[];
  procedureForm: ProcedureFormState;
  paramTypeOptions: SelectOption[];
  bindingModeOptions: SelectOption[];
  projectContextSourceOptions: SelectOption[];
  columnTypeOptions: SelectOption[];
  onReset: () => void;
  onDuplicateTemplate: () => void;
  onDelete: () => void;
  onProcedureSearchChange: (value: string) => void;
  onSelectProcedure: (key: string) => void;
  onProcedureFormChange: (updates: Partial<ProcedureFormState>) => void;
  onApplyObjectsAnalysisPreset: () => void;
  onAddProcedureParam: () => void;
  onUpdateProcedureParam: (id: string, patch: Partial<ProcedureParamFormItem>) => void;
  onRemoveProcedureParam: (id: string) => void;
  onAddResultSet: () => void;
  onUpdateResultSet: (id: string, patch: Partial<ProcedureResultSetFormItem>) => void;
  onRemoveResultSet: (id: string) => void;
  onAddColumnToResultSet: (resultSetId: string) => void;
  onUpdateColumnInResultSet: (
    resultSetId: string,
    columnId: string,
    patch: Partial<ProcedureColumnFormItem>,
  ) => void;
  onRemoveColumnFromResultSet: (resultSetId: string, columnId: string) => void;
  onSave: () => void;
}

const ConsoleProcedureRegistrySection: React.FC<ConsoleProcedureRegistrySectionProps> = ({
  consoleSaving,
  selectedProcedureKey,
  selectedProcedure,
  procedureSearch,
  filteredProcedures,
  allProceduresCount,
  consoleDataSources,
  procedureForm,
  paramTypeOptions,
  bindingModeOptions,
  projectContextSourceOptions,
  columnTypeOptions,
  onReset,
  onDuplicateTemplate,
  onDelete,
  onProcedureSearchChange,
  onSelectProcedure,
  onProcedureFormChange,
  onApplyObjectsAnalysisPreset,
  onAddProcedureParam,
  onUpdateProcedureParam,
  onRemoveProcedureParam,
  onAddResultSet,
  onUpdateResultSet,
  onRemoveResultSet,
  onAddColumnToResultSet,
  onUpdateColumnInResultSet,
  onRemoveColumnFromResultSet,
  onSave,
}) => (
  <div className="service-card">
    <div className="service-card-header">
      <div>
        <h3>Реестр хранимых процедур</h3>
        <p className="service-card-hint">
          Здесь описываются уже существующие процедуры: источник, schema/name, параметры,
          привязка к графовому контексту и отображение result set в интерфейсе.
        </p>
        <p className="service-card-meta">
          Процедур: {allProceduresCount}
          {selectedProcedure ? ` · выбрана: ${selectedProcedure.name}` : ''}
        </p>
      </div>
      <div className="service-row">
        <button type="button" className="service-btn" onClick={onReset}>
          Новая процедура
        </button>
        <button
          type="button"
          className="service-btn"
          onClick={onDuplicateTemplate}
          disabled={!selectedProcedure}
        >
          Дублировать как шаблон
        </button>
        <button
          type="button"
          className="service-btn danger"
          onClick={onDelete}
          disabled={!selectedProcedureKey || consoleSaving}
        >
          Удалить процедуру
        </button>
      </div>
    </div>

    <div className="service-list">
      <input
        className="service-input"
        type="text"
        value={procedureSearch}
        onChange={(event) => onProcedureSearchChange(event.target.value)}
        placeholder="Поиск по процедурам"
        style={{ minWidth: 0 }}
      />
      {filteredProcedures.map((procedure) => (
        <button
          key={String(procedure.key || procedure.id)}
          type="button"
          className={`service-list-item ${selectedProcedureKey === String(procedure.key || procedure.id) ? 'active' : ''}`}
          onClick={() => onSelectProcedure(String(procedure.key || procedure.id))}
        >
          <strong>{procedure.name}</strong>
          <span>{procedure.key || procedure.id}</span>
          <span>{procedure.source_name || procedure.source_key || 'Источник не задан'}</span>
        </button>
      ))}
      {!filteredProcedures.length && (
        <div className="service-empty">
          {allProceduresCount
            ? 'По текущему фильтру процедуры не найдены.'
            : 'Процедуры ещё не зарегистрированы.'}
        </div>
      )}
    </div>

    <div className="service-form-grid">
      <label className="service-field">
        <span>Ключ</span>
        <input
          className="service-input"
          value={procedureForm.key}
          onChange={(event) => onProcedureFormChange({ key: event.target.value })}
        />
      </label>
      <label className="service-field">
        <span>Название</span>
        <input
          className="service-input"
          value={procedureForm.name}
          onChange={(event) => onProcedureFormChange({ name: event.target.value })}
        />
      </label>
      <label className="service-field service-field-wide">
        <span>Описание</span>
        <input
          className="service-input"
          value={procedureForm.description}
          onChange={(event) => onProcedureFormChange({ description: event.target.value })}
        />
      </label>
      <label className="service-field">
        <span>Источник</span>
        <select
          className="service-input"
          value={procedureForm.source_key}
          onChange={(event) => onProcedureFormChange({ source_key: event.target.value })}
        >
          <option value="">Выбери источник</option>
          {consoleDataSources.map((source) => (
            <option key={source.key} value={source.key}>
              {source.name} ({source.key})
            </option>
          ))}
        </select>
      </label>
      <label className="service-field">
        <span>Schema</span>
        <input
          className="service-input"
          value={procedureForm.schema_name}
          onChange={(event) => onProcedureFormChange({ schema_name: event.target.value })}
        />
      </label>
      <label className="service-field service-field-wide">
        <span>Имя процедуры</span>
        <input
          className="service-input"
          value={procedureForm.procedure_name}
          onChange={(event) => onProcedureFormChange({ procedure_name: event.target.value })}
          placeholder="Например usp_GetAbonentDossier"
        />
      </label>
      <label className="service-field">
        <span>Таймаут, сек</span>
        <input
          className="service-input"
          value={procedureForm.timeout_seconds}
          onChange={(event) => onProcedureFormChange({ timeout_seconds: event.target.value })}
        />
      </label>
      <label className="service-field">
        <span>Лимит по умолчанию</span>
        <input
          className="service-input"
          value={procedureForm.default_limit}
          onChange={(event) => onProcedureFormChange({ default_limit: event.target.value })}
        />
      </label>
      <label className="service-checkbox">
        <input
          type="checkbox"
          checked={procedureForm.supports_graph_selection}
          onChange={(event) =>
            onProcedureFormChange({ supports_graph_selection: event.target.checked })
          }
        />
        <span>Поддерживает выделение графа</span>
      </label>
      <label className="service-checkbox">
        <input
          type="checkbox"
          checked={procedureForm.is_active}
          onChange={(event) => onProcedureFormChange({ is_active: event.target.checked })}
        />
        <span>Процедура активна</span>
      </label>
    </div>

    <ProcedureParamsEditor
      params={procedureForm.params}
      paramTypeOptions={paramTypeOptions}
      bindingModeOptions={bindingModeOptions}
      projectContextSourceOptions={projectContextSourceOptions}
      onApplyObjectsAnalysisPreset={onApplyObjectsAnalysisPreset}
      onAddProcedureParam={onAddProcedureParam}
      onUpdateProcedureParam={onUpdateProcedureParam}
      onRemoveProcedureParam={onRemoveProcedureParam}
    />

    <ProcedureResultSetsEditor
      resultSets={procedureForm.resultSets}
      columnTypeOptions={columnTypeOptions}
      onAddResultSet={onAddResultSet}
      onUpdateResultSet={onUpdateResultSet}
      onRemoveResultSet={onRemoveResultSet}
      onAddColumnToResultSet={onAddColumnToResultSet}
      onUpdateColumnInResultSet={onUpdateColumnInResultSet}
      onRemoveColumnFromResultSet={onRemoveColumnFromResultSet}
    />

    <div className="service-row">
      <button type="button" className="service-btn primary" onClick={onSave} disabled={consoleSaving}>
        {consoleSaving
          ? 'Сохранение...'
          : selectedProcedureKey
            ? 'Сохранить процедуру'
            : 'Зарегистрировать процедуру'}
      </button>
    </div>
  </div>
);

export default ConsoleProcedureRegistrySection;
