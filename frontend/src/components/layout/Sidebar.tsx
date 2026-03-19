// frontend/src/components/layout/Sidebar.tsx
import React, { useState, useEffect } from 'react';
import { useAppSelector, useAppDispatch } from '../../store';
import { fetchProjects, setCurrentProject, Project } from '../../store/slices/projectsSlice';
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
  const { projects, currentProject, isLoading: projectsLoading } = useAppSelector(state => state.projects);
  const { items: artifacts, isLoading: artifactsLoading } = useAppSelector(state => state.artifacts);
  const [selectedView, setSelectedView] = useState<'projects' | 'artifacts'>('projects');
  const [filter, setFilter] = useState('');

  // Загружаем проекты при монтировании
  useEffect(() => {
    dispatch(fetchProjects());
  }, [dispatch]);

  // Загружаем артефакты когда выбран проект
  useEffect(() => {
    if (currentProject?.id && selectedView === 'artifacts') {
      dispatch(fetchArtifacts(currentProject.id));
    }
  }, [currentProject?.id, selectedView, dispatch]);

  const handleProjectSelect = (project: Project) => {
    dispatch(setCurrentProject(project.id));
    setSelectedView('artifacts');
  };

  const handleArtifactSelect = (artifact: any) => {
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

  const isLoading = selectedView === 'projects' ? projectsLoading : artifactsLoading;

  return (
    <div className="sidebar">
      <div className="sidebar-header">
        <h3>{selectedView === 'projects' ? 'Проекты' : 'Артефакты'}</h3>
        <button className="sidebar-toggle" onClick={onToggleCollapse}>◀</button>
      </div>

      {/* Кнопки навигации */}
      <div className="sidebar-nav">
        <button 
          className={`nav-btn ${selectedView === 'projects' ? 'active' : ''}`}
          onClick={() => setSelectedView('projects')}
        >
          📁 Проекты
        </button>
        <button 
          className={`nav-btn ${selectedView === 'artifacts' ? 'active' : ''}`}
          onClick={() => setSelectedView('artifacts')}
          disabled={!currentProject}
          title={!currentProject ? 'Сначала выберите проект' : undefined}
        >
          📊 Артефакты
        </button>
      </div>

      {/* Поиск */}
      <div className="sidebar-search">
        <input
          type="text"
          placeholder="🔍 Поиск..."
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
        />
      </div>

      {/* Кнопка назад к проектам (если мы в артефактах) */}
      {selectedView === 'artifacts' && (
        <button 
          className="back-btn"
          onClick={() => setSelectedView('projects')}
        >
          ← Назад к проектам
        </button>
      )}

      {/* Список */}
      <div className="sidebar-list">
        {isLoading ? (
          <div className="sidebar-loading">Загрузка...</div>
        ) : selectedView === 'projects' ? (
          // Список проектов
          projects.length === 0 ? (
            <div className="sidebar-empty">Нет проектов</div>
          ) : (
            projects.map(project => (
              <div
                key={project.id}
                className={`sidebar-item ${currentProject?.id === project.id ? 'active' : ''}`}
                onClick={() => handleProjectSelect(project)}
              >
                <div className="item-icon">📁</div>
                <div className="item-content">
                  <div className="item-name">{project.name}</div>
                  <div className="item-meta">
                    <span className="item-date">
                      {new Date(project.created_at).toLocaleDateString()}
                    </span>
                  </div>
                </div>
              </div>
            ))
          )
        ) : (
          // Список артефактов
          !artifacts || Object.values(artifacts).length === 0 ? (
            <div className="sidebar-empty">Нет артефактов</div>
          ) : (
            Object.values(artifacts).map(artifact => {
              if (!artifact) return null;
              return (
                <div
                  key={artifact.id}
                  className="sidebar-item"
                  onClick={() => handleArtifactSelect(artifact)}
                >
                  <div className="item-icon">
                    {artifact.type === 'graph' ? '📊' : 
                     artifact.type === 'table' ? '📋' :
                     artifact.type === 'map' ? '🗺️' :
                     artifact.type === 'chart' ? '📈' : '📄'}
                  </div>
                  <div className="item-content">
                    <div className="item-name">{artifact.name}</div>
                    <div className="item-meta">
                      <span className="item-type">{artifact.type}</span>
                      <span className="item-version">v{artifact.version || 1}</span>
                    </div>
                  </div>
                </div>
              );
            })
          )
        )}
      </div>

      {/* Информация о выбранном проекте */}
      {selectedView === 'artifacts' && currentProject && (
        <div className="sidebar-footer">
          <div className="current-project-info">
            <strong>Проект:</strong> {currentProject.name}
          </div>
        </div>
      )}
    </div>
  );
};

export default Sidebar;