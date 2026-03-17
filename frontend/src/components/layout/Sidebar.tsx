// frontend/src/components/layout/Sidebar.tsx
import React, { useState, useEffect } from 'react';
import { useAppSelector, useAppDispatch } from '../../store';
import { fetchArtifacts, setCurrentArtifact } from '../../store/slices/artifactsSlice';
import './Sidebar.css';

interface SidebarProps {
  isCollapsed: boolean;
  onToggleCollapse: () => void;
  onArtifactSelect: (artifact: any) => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ 
  isCollapsed, 
  onToggleCollapse, 
  onArtifactSelect 
}) => {
  const dispatch = useAppDispatch();
  const { items, isLoading } = useAppSelector(state => state.artifacts);
  const { currentProject } = useAppSelector(state => state.projects);
  const [filter, setFilter] = useState('');
  const [selectedType, setSelectedType] = useState<string | null>(null);

  // Загружаем артефакты при монтировании
  useEffect(() => {
    if (currentProject?.id) {
      dispatch(fetchArtifacts(currentProject.id));
    }
  }, [currentProject?.id, dispatch]);

  // Получаем все артефакты как массив
  const artifacts = Object.values(items || {});

  // Группируем по типам
  const groupedArtifacts = artifacts.reduce((acc, artifact) => {
    if (!artifact) return acc;
    
    const type = artifact.type || 'unknown';
    if (!acc[type]) {
      acc[type] = [];
    }
    acc[type].push(artifact);
    return acc;
  }, {} as Record<string, typeof artifacts>);

  // Иконки для разных типов
  const typeIcons: Record<string, string> = {
    graph: '📊',
    table: '📋',
    map: '🗺️',
    chart: '📈',
    document: '📄',
    unknown: '📁'
  };

  // Фильтрация по поиску
  const filteredArtifacts = filter
    ? artifacts.filter(a => 
        a?.name?.toLowerCase().includes(filter.toLowerCase()) ||
        a?.description?.toLowerCase().includes(filter.toLowerCase())
      )
    : artifacts;

  // Фильтрация по типу
  const displayedArtifacts = selectedType
    ? filteredArtifacts.filter(a => a?.type === selectedType)
    : filteredArtifacts;

  const handleSelectArtifact = (artifact: any) => {
    dispatch(setCurrentArtifact(artifact.id));
    onArtifactSelect(artifact);
  };

  if (isCollapsed) {
    return (
      <div className="sidebar collapsed">
        <button className="sidebar-toggle" onClick={onToggleCollapse}>
          ▶
        </button>
      </div>
    );
  }

  if (isLoading && artifacts.length === 0) {
    return (
      <div className="sidebar">
        <div className="sidebar-header">
          <h3>Артефакты</h3>
          <button className="sidebar-toggle" onClick={onToggleCollapse}>◀</button>
        </div>
        <div className="sidebar-loading">
          <div className="spinner"></div>
          <span>Загрузка...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="sidebar">
      <div className="sidebar-header">
        <h3>Артефакты</h3>
        <button className="sidebar-toggle" onClick={onToggleCollapse}>◀</button>
      </div>

      <div className="sidebar-search">
        <input
          type="text"
          placeholder="🔍 Поиск..."
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
        />
      </div>

      <div className="sidebar-filters">
        <button
          className={`filter-btn ${!selectedType ? 'active' : ''}`}
          onClick={() => setSelectedType(null)}
        >
          Все
          <span className="type-count">({artifacts.length})</span>
        </button>
        {Object.keys(groupedArtifacts).map(type => (
          <button
            key={type}
            className={`filter-btn ${selectedType === type ? 'active' : ''}`}
            onClick={() => setSelectedType(type)}
          >
            {typeIcons[type] || '📁'} {type}
            <span className="type-count">({groupedArtifacts[type]?.length || 0})</span>
          </button>
        ))}
      </div>

      <div className="sidebar-list">
        {displayedArtifacts.length === 0 ? (
          <div className="sidebar-empty">
            {filter ? 'Ничего не найдено' : 'Нет артефактов'}
          </div>
        ) : (
          displayedArtifacts.map(artifact => {
            if (!artifact) return null;
            
            return (
              <div
                key={artifact.id}
                className="sidebar-item"
                onClick={() => handleSelectArtifact(artifact)}
              >
                <div className="item-icon">
                  {typeIcons[artifact.type] || '📁'}
                </div>
                <div className="item-content">
                  <div className="item-name">{artifact.name}</div>
                  <div className="item-meta">
                    <span className="item-type">{artifact.type}</span>
                    <span className="item-version">v{artifact.version}</span>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};

export default Sidebar;
