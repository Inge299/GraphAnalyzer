// frontend/src/components/layout/InspectorPanel.tsx
import React, { useState, useCallback, useMemo } from 'react';
import { useAppSelector } from '../../store';
import './InspectorPanel.css';

interface InspectorPanelProps {
  // пропсы если есть
}

const InspectorPanel: React.FC<InspectorPanelProps> = () => {
  const [activeTab, setActiveTab] = useState<'properties' | 'history' | 'metadata'>('properties');
  
  // Все хуки вызываются безусловно в начале компонента
  const selectedArtifact = useAppSelector(state => {
    const { currentArtifact, items } = state.artifacts;
    return currentArtifact ? items[currentArtifact] : null;
  });
  
  const currentProject = useAppSelector(state => state.projects.currentProject);
  
  // Мемоизированные значения
  const artifactProperties = useMemo(() => {
    if (!selectedArtifact) return [];
    return Object.entries(selectedArtifact).filter(([key]) => 
      !['id', 'project_id', 'data'].includes(key)
    );
  }, [selectedArtifact]);

  const handleTabChange = useCallback((tab: 'properties' | 'history' | 'metadata') => {
    setActiveTab(tab);
  }, []);

  // Если нет выбранного артефакта - показываем заглушку
  if (!selectedArtifact) {
    return (
      <div className="inspector-panel">
        <div className="inspector-header">
          <h3>Инспектор</h3>
        </div>
        <div className="inspector-empty">
          <p>Выберите артефакт для просмотра</p>
        </div>
      </div>
    );
  }

  // Основной рендер с выбранным артефактом
  return (
    <div className="inspector-panel">
      <div className="inspector-header">
        <h3>Инспектор</h3>
        {currentProject && (
          <div className="project-badge">
            {currentProject.name}
          </div>
        )}
      </div>

      <div className="inspector-tabs">
        <button 
          className={`tab-btn ${activeTab === 'properties' ? 'active' : ''}`}
          onClick={() => handleTabChange('properties')}
        >
          Свойства
        </button>
        <button 
          className={`tab-btn ${activeTab === 'history' ? 'active' : ''}`}
          onClick={() => handleTabChange('history')}
        >
          История
        </button>
        <button 
          className={`tab-btn ${activeTab === 'metadata' ? 'active' : ''}`}
          onClick={() => handleTabChange('metadata')}
        >
          Метаданные
        </button>
      </div>

      <div className="inspector-content">
        {activeTab === 'properties' && (
          <div className="properties-tab">
            <div className="property-group">
              <label>Название</label>
              <div className="property-value">{selectedArtifact.name}</div>
            </div>
            
            <div className="property-group">
              <label>Тип</label>
              <div className="property-value type-badge">
                {selectedArtifact.type === 'graph' ? '📊 Граф' :
                 selectedArtifact.type === 'table' ? '📋 Таблица' :
                 selectedArtifact.type === 'map' ? '🗺️ Карта' :
                 selectedArtifact.type === 'chart' ? '📈 Диаграмма' : '📄 Документ'}
              </div>
            </div>

            {selectedArtifact.description && (
              <div className="property-group">
                <label>Описание</label>
                <div className="property-value">{selectedArtifact.description}</div>
              </div>
            )}

            <div className="property-group">
              <label>Версия</label>
              <div className="property-value">v{selectedArtifact.version || 1}</div>
            </div>

            <div className="property-group">
              <label>Создан</label>
              <div className="property-value">
                {new Date(selectedArtifact.created_at).toLocaleString()}
              </div>
            </div>

            <div className="property-group">
              <label>Обновлен</label>
              <div className="property-value">
                {new Date(selectedArtifact.updated_at).toLocaleString()}
              </div>
            </div>

            {/* Дополнительные свойства из artifact_metadata */}
            {selectedArtifact.metadata && Object.entries(selectedArtifact.metadata).map(([key, value]) => (
              <div key={key} className="property-group">
                <label>{key}</label>
                <div className="property-value">
                  {typeof value === 'object' ? JSON.stringify(value) : String(value)}
                </div>
              </div>
            ))}
          </div>
        )}

        {activeTab === 'history' && (
          <div className="history-tab">
            <p className="placeholder">История изменений</p>
            {/* Здесь будет компонент истории */}
          </div>
        )}

        {activeTab === 'metadata' && (
          <div className="metadata-tab">
            <div className="property-group">
              <label>ID артефакта</label>
              <div className="property-value">{selectedArtifact.id}</div>
            </div>
            
            <div className="property-group">
              <label>ID проекта</label>
              <div className="property-value">{selectedArtifact.project_id}</div>
            </div>

            {selectedArtifact.metadata && (
              <div className="property-group">
                <label>Доп. метаданные</label>
                <pre className="metadata-json">
                  {JSON.stringify(selectedArtifact.metadata, null, 2)}
                </pre>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default InspectorPanel;