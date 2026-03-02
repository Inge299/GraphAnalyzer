// frontend/src/components/layout/Sidebar.tsx
import React, { useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { RootState, AppDispatch } from '../../store';
import { Artifact, createArtifact } from '../../store/slices/artifactsSlice';
import { setCurrentProject } from '../../store/slices/projectsSlice';

interface SidebarProps {
  isCollapsed: boolean;
  onToggleCollapse: () => void;
  onArtifactSelect: (artifact: Artifact) => void;
}

interface GroupedArtifacts {
  graphs: Artifact[];
  tables: Artifact[];
  maps: Artifact[];
  charts: Artifact[];
  documents: Artifact[];
}

const Sidebar: React.FC<SidebarProps> = ({
  isCollapsed,
  onToggleCollapse,
  onArtifactSelect,
}) => {
  const dispatch = useDispatch<AppDispatch>();
  const [searchTerm, setSearchTerm] = useState('');
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set(['graphs', 'tables']));
  
  const { projects, currentProject } = useSelector((state: RootState) => state.projects);
  const { artifacts, isLoading } = useSelector((state: RootState) => state.artifacts);

  // Группировка артефактов по типам
  const groupedArtifacts: GroupedArtifacts = {
    graphs: [],
    tables: [],
    maps: [],
    charts: [],
    documents: [],
  };

  // Фильтрация по поиску
  const filteredArtifacts = artifacts.filter(artifact =>
    artifact.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    artifact.description?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Группировка отфильтрованных артефактов
  filteredArtifacts.forEach(artifact => {
    switch (artifact.type) {
      case 'graph':
        groupedArtifacts.graphs.push(artifact);
        break;
      case 'table':
        groupedArtifacts.tables.push(artifact);
        break;
      case 'map':
        groupedArtifacts.maps.push(artifact);
        break;
      case 'chart':
        groupedArtifacts.charts.push(artifact);
        break;
      case 'document':
        groupedArtifacts.documents.push(artifact);
        break;
    }
  });

  const toggleGroup = (group: string) => {
    setExpandedGroups(prev => {
      const newSet = new Set(prev);
      if (newSet.has(group)) {
        newSet.delete(group);
      } else {
        newSet.add(group);
      }
      return newSet;
    });
  };

  const handleCreateArtifact = async (type: Artifact['type']) => {
    if (!currentProject) {
      alert('Please select a project first');
      return;
    }

    const name = prompt(`Enter name for new ${type}:`);
    if (!name) return;

    const newArtifact = {
      project_id: currentProject.id,
      type,
      name,
      description: '',
      data: getDefaultDataForType(type),
      metadata: {},
    };

    try {
      await dispatch(createArtifact({
        projectId: currentProject.id,
        artifact: newArtifact,
      }));
    } catch (error) {
      console.error('Failed to create artifact:', error);
    }
  };

  const getDefaultDataForType = (type: string): any => {
    switch (type) {
      case 'graph':
        return { nodes: [], edges: [] };
      case 'table':
        return { columns: [], rows: [] };
      case 'map':
        return { layers: [], points: [] };
      case 'chart':
        return { series: [] };
      case 'document':
        return { content: '' };
      default:
        return {};
    }
  };

  const getGroupIcon = (group: string): string => {
    switch (group) {
      case 'graphs': return '📊';
      case 'tables': return '📋';
      case 'maps': return '🗺️';
      case 'charts': return '📈';
      case 'documents': return '📄';
      default: return '📁';
    }
  };

  const getGroupColor = (group: string): string => {
    switch (group) {
      case 'graphs': return 'text-blue-400';
      case 'tables': return 'text-green-400';
      case 'maps': return 'text-purple-400';
      case 'charts': return 'text-yellow-400';
      case 'documents': return 'text-red-400';
      default: return 'text-gray-400';
    }
  };

  if (isCollapsed) {
    return (
      <div className="sidebar collapsed">
        <button onClick={onToggleCollapse} className="toggle-button">
          →
        </button>
        <div className="collapsed-icons">
          {projects.map(project => (
            <div
              key={project.id}
              className={`icon ${currentProject?.id === project.id ? 'active' : ''}`}
              onClick={() => dispatch(setCurrentProject(project.id))}
              title={project.name}
            >
              📁
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="sidebar">
      <div className="sidebar-header">
        <h2>Projects</h2>
        <button onClick={onToggleCollapse} className="toggle-button">
          ←
        </button>
      </div>

      {/* Projects dropdown */}
      <div className="projects-section">
        <select
          value={currentProject?.id || ''}
          onChange={(e) => dispatch(setCurrentProject(Number(e.target.value)))}
          className="project-select"
        >
          <option value="">Select Project</option>
          {projects.map(project => (
            <option key={project.id} value={project.id}>
              {project.name}
            </option>
          ))}
        </select>
      </div>

      {/* Search */}
      <div className="search-section">
        <input
          type="text"
          placeholder="Search artifacts..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="search-input"
        />
      </div>

      {/* Artifacts groups */}
      <div className="artifacts-section">
        {isLoading ? (
          <div className="loading">Loading artifacts...</div>
        ) : (
          <>
            {/* Quick create buttons */}
            <div className="quick-create">
              <button onClick={() => handleCreateArtifact('graph')} title="New Graph">📊</button>
              <button onClick={() => handleCreateArtifact('table')} title="New Table">📋</button>
              <button onClick={() => handleCreateArtifact('map')} title="New Map">🗺️</button>
              <button onClick={() => handleCreateArtifact('chart')} title="New Chart">📈</button>
              <button onClick={() => handleCreateArtifact('document')} title="New Document">📄</button>
            </div>

            {/* Groups */}
            {Object.entries(groupedArtifacts).map(([group, items]) => (
              <div key={group} className="artifact-group">
                <div
                  className="group-header"
                  onClick={() => toggleGroup(group)}
                >
                  <span className="group-toggle">{expandedGroups.has(group) ? '▼' : '▶'}</span>
                  <span className={`group-icon ${getGroupColor(group)}`}>
                    {getGroupIcon(group)}
                  </span>
                  <span className="group-name capitalize">{group}</span>
                  <span className="group-count">({items.length})</span>
                </div>
                
                {expandedGroups.has(group) && (
                  <div className="group-items">
                    {items.length === 0 ? (
                      <div className="empty-group">No {group}</div>
                    ) : (
                      items.map(artifact => (
                        <div
                          key={artifact.id}
                          className="artifact-item"
                          onClick={() => onArtifactSelect(artifact)}
                          title={artifact.description}
                        >
                          <span className="artifact-icon">{getGroupIcon(group)}</span>
                          <span className="artifact-name">{artifact.name}</span>
                          <span className="artifact-version">v{artifact.version}</span>
                        </div>
                      ))
                    )}
                  </div>
                )}
              </div>
            ))}
          </>
        )}
      </div>

      {/* Project stats */}
      <div className="sidebar-footer">
        <div className="stats">
          <div>Total: {artifacts.length}</div>
          <div>Updated: {new Date().toLocaleDateString()}</div>
        </div>
      </div>
    </div>
  );
};

export default Sidebar;