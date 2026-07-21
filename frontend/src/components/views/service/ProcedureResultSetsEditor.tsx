import React from 'react';
import type {
  ProcedureColumnFormItem,
  ProcedureResultSetFormItem,
} from './types';

interface SelectOption {
  value: string;
  label: string;
}

interface ProcedureResultSetsEditorProps {
  resultSets: ProcedureResultSetFormItem[];
  columnTypeOptions: SelectOption[];
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
}

const ProcedureResultSetsEditor: React.FC<ProcedureResultSetsEditorProps> = ({
  resultSets,
  columnTypeOptions,
  onAddResultSet,
  onUpdateResultSet,
  onRemoveResultSet,
  onAddColumnToResultSet,
  onUpdateColumnInResultSet,
  onRemoveColumnFromResultSet,
}) => (
  <div className="service-editor-block">
    <div className="service-editor-header">
      <div>
        <h4>Result set и колонки</h4>
        <p>
          Здесь задаём вкладки результата и человекочитаемые названия колонок, которые
          вернёт процедура.
        </p>
        <p className="service-card-meta">Result set: {resultSets.length}</p>
      </div>
      <button type="button" className="service-btn" onClick={onAddResultSet}>
        Добавить result set
      </button>
    </div>

    {resultSets.length === 0 ? (
      <div className="service-empty">Result set пока не описаны.</div>
    ) : (
      <div className="service-editor-list">
        {resultSets.map((resultSet, resultSetIndex) => (
          <div key={resultSet.id} className="service-editor-card">
            <div className="service-editor-card-header">
              <strong>Result set #{resultSetIndex + 1}</strong>
              <div className="service-row">
                <button
                  type="button"
                  className="service-btn"
                  onClick={() => onAddColumnToResultSet(resultSet.id)}
                >
                  Добавить колонку
                </button>
                <button
                  type="button"
                  className="service-btn danger"
                  onClick={() => onRemoveResultSet(resultSet.id)}
                >
                  Удалить
                </button>
              </div>
            </div>

            <div className="service-form-grid">
              <label className="service-field">
                <span>Порядковый индекс</span>
                <input
                  className="service-input"
                  value={resultSet.result_index}
                  onChange={(event) =>
                    onUpdateResultSet(resultSet.id, { result_index: event.target.value })
                  }
                />
              </label>
              <label className="service-field">
                <span>Ключ вкладки</span>
                <input
                  className="service-input"
                  value={resultSet.result_key}
                  onChange={(event) =>
                    onUpdateResultSet(resultSet.id, { result_key: event.target.value })
                  }
                />
              </label>
              <label className="service-field service-field-wide">
                <span>Название вкладки</span>
                <input
                  className="service-input"
                  value={resultSet.name}
                  onChange={(event) => onUpdateResultSet(resultSet.id, { name: event.target.value })}
                />
              </label>
              <label className="service-checkbox">
                <input
                  type="checkbox"
                  checked={resultSet.visible}
                  onChange={(event) =>
                    onUpdateResultSet(resultSet.id, { visible: event.target.checked })
                  }
                />
                <span>Показывать вкладку</span>
              </label>
            </div>

            {resultSet.columns.length === 0 ? (
              <div className="service-empty">
                Колонки ещё не описаны. Их можно добавлять по мере договорённости с авторами
                процедуры.
              </div>
            ) : (
              <div className="service-column-grid">
                {resultSet.columns.map((column, columnIndex) => (
                  <div key={column.id} className="service-column-card">
                    <div className="service-editor-card-header">
                      <strong>Колонка #{columnIndex + 1}</strong>
                      <button
                        type="button"
                        className="service-btn danger"
                        onClick={() => onRemoveColumnFromResultSet(resultSet.id, column.id)}
                      >
                        Удалить
                      </button>
                    </div>
                    <div className="service-form-grid">
                      <label className="service-field">
                        <span>Оригинальное имя</span>
                        <input
                          className="service-input"
                          value={column.key}
                          onChange={(event) =>
                            onUpdateColumnInResultSet(resultSet.id, column.id, {
                              key: event.target.value,
                            })
                          }
                          placeholder="Например subscriber_id"
                        />
                      </label>
                      <label className="service-field">
                        <span>Подпись в интерфейсе</span>
                        <input
                          className="service-input"
                          value={column.label}
                          onChange={(event) =>
                            onUpdateColumnInResultSet(resultSet.id, column.id, {
                              label: event.target.value,
                            })
                          }
                        />
                      </label>
                      <label className="service-field">
                        <span>Тип</span>
                        <select
                          className="service-input"
                          value={column.type}
                          onChange={(event) =>
                            onUpdateColumnInResultSet(resultSet.id, column.id, {
                              type: event.target.value,
                            })
                          }
                        >
                          {columnTypeOptions.map((option) => (
                            <option key={option.value} value={option.value}>
                              {option.label}
                            </option>
                          ))}
                        </select>
                      </label>
                      <label className="service-field">
                        <span>Ширина колонки, px</span>
                        <input
                          className="service-input"
                          value={column.width}
                          onChange={(event) =>
                            onUpdateColumnInResultSet(resultSet.id, column.id, {
                              width: event.target.value,
                            })
                          }
                          placeholder="Например 180"
                        />
                      </label>
                      <label className="service-checkbox">
                        <input
                          type="checkbox"
                          checked={column.visible}
                          onChange={(event) =>
                            onUpdateColumnInResultSet(resultSet.id, column.id, {
                              visible: event.target.checked,
                            })
                          }
                        />
                        <span>Показывать колонку</span>
                      </label>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
    )}
  </div>
);

export default ProcedureResultSetsEditor;
