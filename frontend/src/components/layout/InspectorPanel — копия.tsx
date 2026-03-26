// frontend/src/components/layout/InspectorPanel.tsx
import React, { useState, useCallback } from 'react';
import { useAppSelector } from '../../store';
import './InspectorPanel.css';

export const InspectorPanel: React.FC = () => {
  const selectedElement = useAppSelector((state) => state.ui.selectedElement);
  const selectedElements = useAppSelector((state) => state.ui.selectedElements);
  const [activeTab, setActiveTab] = useState<'properties' | 'metadata'>('properties');

  const handleTabChange = useCallback((tab: 'properties' | 'metadata') => {
    setActiveTab(tab);
  }, []);

  const renderPropertiesTab = () => {
    if (selectedElements.length > 1) {
      return (
        <div className="inspector-content">
          <h4>Выбрано элементов: {selectedElements.length}</h4>
          <div className="inspector-list">
            {selectedElements.map((el, idx) => (
              <div key={idx} className="inspector-item">
                <span className="inspector-type">{el.type}:</span>
                <span className="inspector-id">{el.id}</span>
              </div>
            ))}
          </div>
        </div>
      );
    }

    if (selectedElement) {
      const { type, id, data } = selectedElement;
      return (
        <div className="inspector-content">
          <div className="inspector-field">
            <label>Тип:</label>
            <span>{type}</span>
          </div>
          <div className="inspector-field">
            <label>ID:</label>
            <span>{id}</span>
          </div>
          <div className="inspector-field">
            <label>Атрибуты:</label>
            <pre className="inspector-json">
              {JSON.stringify(data?.attributes || data, null, 2)}
            </pre>
          </div>
        </div>
      );
    }

    return (
      <div className="inspector-empty">
        <p>Ничего не выбрано</p>
        <p className="inspector-hint">Кликните на узел или связь для просмотра свойств</p>
      </div>
    );
  };

  const renderMetadataTab = () => {
    if (selectedElement) {
      const { data } = selectedElement;
      return (
        <div className="inspector-content">
          <div className="inspector-field">
            <label>Метаданные:</label>
            <pre className="inspector-json">
              {JSON.stringify(data?.metadata || data, null, 2)}
            </pre>
          </div>
        </div>
      );
    }
    return (
      <div className="inspector-empty">
        <p>Нет данных</p>
      </div>
    );
  };

  return (
    <div className="inspector-panel">
      <div className="inspector-header">
        <h3>Инспектор</h3>
        <div className="inspector-tabs">
          <button 
            className={`tab-btn ${activeTab === 'properties' ? 'active' : ''}`}
            onClick={() => handleTabChange('properties')}
          >
            Свойства
          </button>
          <button 
            className={`tab-btn ${activeTab === 'metadata' ? 'active' : ''}`}
            onClick={() => handleTabChange('metadata')}
          >
            Метаданные
          </button>
        </div>
      </div>
      {activeTab === 'properties' && renderPropertiesTab()}
      {activeTab === 'metadata' && renderMetadataTab()}
    </div>
  );
};

export default InspectorPanel;