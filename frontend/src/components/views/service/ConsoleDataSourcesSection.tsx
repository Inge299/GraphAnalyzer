import React from 'react';
import type { ConsoleDataSource } from '../../../types/api';
import type { DataSourceFormState } from './types';

interface ConsoleDataSourcesSectionProps {
  consoleLoading: boolean;
  consoleSaving: boolean;
  consoleTestingSource: boolean;
  selectedSourceKey: string;
  selectedSource?: ConsoleDataSource | null;
  sourceSearch: string;
  filteredDataSources: ConsoleDataSource[];
  allDataSourcesCount: number;
  dataSourceForm: DataSourceFormState;
  onRefresh: () => void;
  onTest: () => void;
  onReset: () => void;
  onDelete: () => void;
  onSelectSource: (key: string) => void;
  onSourceSearchChange: (value: string) => void;
  onFormChange: (updates: Partial<DataSourceFormState>) => void;
  onSave: () => void;
}

const ConsoleDataSourcesSection: React.FC<ConsoleDataSourcesSectionProps> = ({
  consoleLoading,
  consoleSaving,
  consoleTestingSource,
  selectedSourceKey,
  selectedSource,
  sourceSearch,
  filteredDataSources,
  allDataSourcesCount,
  dataSourceForm,
  onRefresh,
  onTest,
  onReset,
  onDelete,
  onSelectSource,
  onSourceSearchChange,
  onFormChange,
  onSave,
}) => (
  <div className="service-card">
    <div className="service-card-header">
      <div>
        <h3>Источники данных MS SQL</h3>
        <p className="service-card-hint">
          Здесь регистрируем только подключения. Сами хранимые процедуры уже существуют и
          создаются другими разработчиками.
        </p>
        <p className="service-card-meta">
          Источников: {allDataSourcesCount}
          {selectedSource ? ` · выбран: ${selectedSource.name}` : ''}
        </p>
      </div>
      <div className="service-row">
        <button type="button" className="service-btn" onClick={onRefresh} disabled={consoleLoading}>
          {consoleLoading ? 'Обновление...' : 'Обновить'}
        </button>
        <button
          type="button"
          className="service-btn"
          onClick={onTest}
          disabled={!selectedSourceKey || consoleTestingSource}
        >
          {consoleTestingSource ? 'Проверка...' : 'Проверить подключение'}
        </button>
        <button type="button" className="service-btn" onClick={onReset}>
          Новый источник
        </button>
        <button
          type="button"
          className="service-btn danger"
          onClick={onDelete}
          disabled={!selectedSourceKey || consoleSaving}
        >
          Удалить источник
        </button>
      </div>
    </div>

    <div className="service-list">
      <input
        className="service-input"
        type="text"
        value={sourceSearch}
        onChange={(event) => onSourceSearchChange(event.target.value)}
        placeholder="Поиск по источникам данных"
        style={{ minWidth: 0 }}
      />
      {filteredDataSources.map((source) => (
        <button
          key={source.key}
          type="button"
          className={`service-list-item ${selectedSourceKey === source.key ? 'active' : ''}`}
          onClick={() => onSelectSource(source.key)}
        >
          <strong>{source.name}</strong>
          <span>{source.key}</span>
          <span>
            {source.host}:{source.port} / {source.database_name}
          </span>
        </button>
      ))}
      {!filteredDataSources.length && (
        <div className="service-empty">
          {allDataSourcesCount
            ? 'По текущему фильтру источники не найдены.'
            : 'Источники данных ещё не зарегистрированы.'}
        </div>
      )}
    </div>

    <div className="service-form-grid">
      <label className="service-field">
        <span>Ключ</span>
        <input
          className="service-input"
          value={dataSourceForm.key}
          onChange={(event) => onFormChange({ key: event.target.value })}
        />
      </label>
      <label className="service-field">
        <span>Название</span>
        <input
          className="service-input"
          value={dataSourceForm.name}
          onChange={(event) => onFormChange({ name: event.target.value })}
        />
      </label>
      <label className="service-field service-field-wide">
        <span>Описание</span>
        <input
          className="service-input"
          value={dataSourceForm.description}
          onChange={(event) => onFormChange({ description: event.target.value })}
        />
      </label>
      <label className="service-field">
        <span>Host</span>
        <input
          className="service-input"
          value={dataSourceForm.host}
          onChange={(event) => onFormChange({ host: event.target.value })}
        />
      </label>
      <label className="service-field">
        <span>Port</span>
        <input
          className="service-input"
          value={dataSourceForm.port}
          onChange={(event) => onFormChange({ port: event.target.value })}
        />
      </label>
      <label className="service-field">
        <span>База данных</span>
        <input
          className="service-input"
          value={dataSourceForm.database_name}
          onChange={(event) => onFormChange({ database_name: event.target.value })}
        />
      </label>
      <label className="service-field">
        <span>Пользователь</span>
        <input
          className="service-input"
          value={dataSourceForm.username}
          onChange={(event) => onFormChange({ username: event.target.value })}
        />
      </label>
      <label className="service-field">
        <span>Пароль</span>
        <input
          className="service-input"
          type="password"
          value={dataSourceForm.password}
          onChange={(event) => onFormChange({ password: event.target.value })}
          placeholder={selectedSource?.has_password ? 'Оставь пустым, чтобы не менять' : ''}
        />
      </label>
      <label className="service-field">
        <span>Driver</span>
        <input
          className="service-input"
          value={dataSourceForm.driver}
          onChange={(event) => onFormChange({ driver: event.target.value })}
        />
      </label>
      <label className="service-field">
        <span>Auth type</span>
        <input
          className="service-input"
          value={dataSourceForm.auth_type}
          onChange={(event) => onFormChange({ auth_type: event.target.value })}
        />
      </label>
      <label className="service-field">
        <span>DBMS</span>
        <input
          className="service-input"
          value={dataSourceForm.dbms}
          onChange={(event) => onFormChange({ dbms: event.target.value })}
        />
      </label>
      <label className="service-checkbox">
        <input
          type="checkbox"
          checked={dataSourceForm.is_active}
          onChange={(event) => onFormChange({ is_active: event.target.checked })}
        />
        <span>Источник активен</span>
      </label>
      <label className="service-field service-field-wide">
        <span>Опции подключения (JSON)</span>
        <textarea
          className="service-textarea"
          rows={6}
          value={dataSourceForm.optionsText}
          onChange={(event) => onFormChange({ optionsText: event.target.value })}
        />
      </label>
    </div>

    <div className="service-row">
      <button type="button" className="service-btn primary" onClick={onSave} disabled={consoleSaving}>
        {consoleSaving
          ? 'Сохранение...'
          : selectedSourceKey
            ? 'Сохранить источник'
            : 'Создать источник'}
      </button>
    </div>
  </div>
);

export default ConsoleDataSourcesSection;
