import React from 'react';
import type { ObjectTypeMappingFormItem } from './types';

interface ObjectTypeMappingsSectionProps {
  mappings: ObjectTypeMappingFormItem[];
  consoleSaving: boolean;
  onReset: () => void;
  onAdd: () => void;
  onUpdate: (id: string, updates: Partial<ObjectTypeMappingFormItem>) => void;
  onRemove: (id: string) => void;
  onSave: () => void;
}

const ObjectTypeMappingsSection: React.FC<ObjectTypeMappingsSectionProps> = ({
  mappings,
  consoleSaving,
  onReset,
  onAdd,
  onUpdate,
  onRemove,
  onSave,
}) => (
  <div className="service-card">
    <div className="service-card-header">
      <div>
        <h3>Соответствия типов объектов</h3>
        <p className="service-card-hint">
          Граф продолжает жить со своими типами, а процедуры получают ожидаемые типы объектов
          вроде <code>MSISDN</code>, <code>IMEI</code> и <code>IMSI</code>.
        </p>
      </div>
      <div className="service-row">
        <button type="button" className="service-btn" onClick={onReset}>
          Базовые соответствия
        </button>
        <button type="button" className="service-btn" onClick={onAdd}>
          Добавить строку
        </button>
      </div>
    </div>

    {mappings.length === 0 ? (
      <div className="service-empty">Соответствия пока не заданы.</div>
    ) : (
      <div className="service-mapping-table">
        <div className="service-mapping-row service-mapping-row-header">
          <div>Тип на графе</div>
          <div>Тип для процедуры</div>
          <div>Активно</div>
          <div />
        </div>
        {mappings.map((mapping) => (
          <div key={mapping.id} className="service-mapping-row">
            <input
              className="service-input service-mapping-input"
              value={mapping.graph_type}
              onChange={(event) => onUpdate(mapping.id, { graph_type: event.target.value })}
              placeholder="msisdn"
            />
            <input
              className="service-input service-mapping-input"
              value={mapping.procedure_type}
              onChange={(event) => onUpdate(mapping.id, { procedure_type: event.target.value })}
              placeholder="MSISDN"
            />
            <label className="service-checkbox service-mapping-checkbox">
              <input
                type="checkbox"
                checked={mapping.is_active}
                onChange={(event) => onUpdate(mapping.id, { is_active: event.target.checked })}
              />
              <span>Да</span>
            </label>
            <button
              type="button"
              className="service-btn danger"
              onClick={() => onRemove(mapping.id)}
            >
              Удалить
            </button>
          </div>
        ))}
      </div>
    )}

    <div className="service-row">
      <button type="button" className="service-btn primary" onClick={onSave} disabled={consoleSaving}>
        {consoleSaving ? 'Сохранение...' : 'Сохранить соответствия'}
      </button>
    </div>
  </div>
);

export default ObjectTypeMappingsSection;
