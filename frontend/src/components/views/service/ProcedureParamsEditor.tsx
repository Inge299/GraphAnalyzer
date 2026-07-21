import React from 'react';
import type { ProcedureParamFormItem } from './types';

interface SelectOption {
  value: string;
  label: string;
}

interface ProcedureParamsEditorProps {
  params: ProcedureParamFormItem[];
  paramTypeOptions: SelectOption[];
  bindingModeOptions: SelectOption[];
  projectContextSourceOptions: SelectOption[];
  onApplyObjectsAnalysisPreset: () => void;
  onAddProcedureParam: () => void;
  onUpdateProcedureParam: (id: string, patch: Partial<ProcedureParamFormItem>) => void;
  onRemoveProcedureParam: (id: string) => void;
}

const ProcedureParamsEditor: React.FC<ProcedureParamsEditorProps> = ({
  params,
  paramTypeOptions,
  bindingModeOptions,
  projectContextSourceOptions,
  onApplyObjectsAnalysisPreset,
  onAddProcedureParam,
  onUpdateProcedureParam,
  onRemoveProcedureParam,
}) => (
  <div className="service-editor-block">
    <div className="service-editor-header">
      <div>
        <h4>Параметры процедуры</h4>
        <p>
          Здесь настраиваем форму запуска и правила автопривязки к графовому выделению.
        </p>
        <p className="service-card-meta">Параметров: {params.length}</p>
      </div>
      <div className="service-row">
        <button type="button" className="service-btn" onClick={onApplyObjectsAnalysisPreset}>
          Шаблон Objects/Types
        </button>
        <button type="button" className="service-btn" onClick={onAddProcedureParam}>
          Добавить параметр
        </button>
      </div>
    </div>

    {params.length === 0 ? (
      <div className="service-empty">Параметры пока не описаны.</div>
    ) : (
      <div className="service-editor-list">
        {params.map((param, index) => (
          <div key={param.id} className="service-editor-card">
            <div className="service-editor-card-header">
              <strong>Параметр #{index + 1}</strong>
              <button
                type="button"
                className="service-btn danger"
                onClick={() => onRemoveProcedureParam(param.id)}
              >
                Удалить
              </button>
            </div>

            <div className="service-form-grid">
              <label className="service-field">
                <span>Имя параметра</span>
                <input
                  className="service-input"
                  value={param.name}
                  onChange={(event) => onUpdateProcedureParam(param.id, { name: event.target.value })}
                  placeholder="Например msisdn или selection_json"
                />
              </label>
              <label className="service-field">
                <span>Подпись в UI</span>
                <input
                  className="service-input"
                  value={param.label}
                  onChange={(event) => onUpdateProcedureParam(param.id, { label: event.target.value })}
                />
              </label>
              <label className="service-field">
                <span>Тип</span>
                <select
                  className="service-input"
                  value={param.type}
                  onChange={(event) => onUpdateProcedureParam(param.id, { type: event.target.value })}
                >
                  {paramTypeOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="service-field">
                <span>Режим заполнения</span>
                <select
                  className="service-input"
                  value={param.binding_mode}
                  onChange={(event) =>
                    onUpdateProcedureParam(param.id, { binding_mode: event.target.value })
                  }
                >
                  {bindingModeOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>

              {(param.binding_mode === 'manual' || param.binding_mode === 'fixed') && (
                <label className="service-field">
                  <span>
                    {param.binding_mode === 'fixed'
                      ? 'Фиксированное значение'
                      : 'Значение по умолчанию'}
                  </span>
                  <input
                    className="service-input"
                    value={param.defaultValue}
                    onChange={(event) =>
                      onUpdateProcedureParam(param.id, { defaultValue: event.target.value })
                    }
                  />
                </label>
              )}

              {param.binding_mode === 'project_context' && (
                <label className="service-field">
                  <span>Что брать из контекста</span>
                  <select
                    className="service-input"
                    value={param.binding_source}
                    onChange={(event) =>
                      onUpdateProcedureParam(param.id, { binding_source: event.target.value })
                    }
                  >
                    <option value="">Выбери источник значения</option>
                    {projectContextSourceOptions.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </label>
              )}

              {param.binding_mode === 'selected_node_attr_csv' && (
                <label className="service-field">
                  <span>Ключ атрибута узла</span>
                  <input
                    className="service-input"
                    value={param.binding_attr_key}
                    onChange={(event) =>
                      onUpdateProcedureParam(param.id, { binding_attr_key: event.target.value })
                    }
                    placeholder="Например msisdn или imsi"
                  />
                </label>
              )}

              <label className="service-checkbox">
                <input
                  type="checkbox"
                  checked={param.required}
                  onChange={(event) => onUpdateProcedureParam(param.id, { required: event.target.checked })}
                />
                <span>Обязательный параметр</span>
              </label>
              <label className="service-checkbox">
                <input
                  type="checkbox"
                  checked={param.hidden}
                  onChange={(event) => onUpdateProcedureParam(param.id, { hidden: event.target.checked })}
                />
                <span>Скрыть в форме запуска</span>
              </label>
            </div>
          </div>
        ))}
      </div>
    )}
  </div>
);

export default ProcedureParamsEditor;
