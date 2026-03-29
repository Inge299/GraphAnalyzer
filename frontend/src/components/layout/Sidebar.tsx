// frontend/src/components/layout/Sidebar.tsx
import React, { useEffect, useMemo, useState, useCallback } from 'react';
import { useAppDispatch, useAppSelector } from '../../store';
import { setCurrentProject, fetchProjects } from '../../store/slices/projectsSlice';
import { fetchArtifacts, setCurrentArtifact, createArtifact } from '../../store/slices/artifactsSlice';
import { projectApi, artifactApi } from '../../services/api';
import type { ApiArtifact } from '../../types/api';
import './Sidebar.css';

interface SidebarProps {
  isCollapsed: boolean;
  onToggleCollapse: () => void;
  onArtifactSelect: (artifact: ApiArtifact) => void;
}

const labels = {
  projects: '\u041f\u0440\u043e\u0435\u043a\u0442\u044b',
  artifacts: '\u0410\u0440\u0442\u0435\u0444\u0430\u043a\u0442\u044b',
  search: '\u041f\u043e\u0438\u0441\u043a...',
  backToProjects: '\u041d\u0430\u0437\u0430\u0434 \u043a \u043f\u0440\u043e\u0435\u043a\u0442\u0430\u043c',
  loading: '\u0417\u0430\u0433\u0440\u0443\u0437\u043a\u0430...',
  noProjects: '\u041d\u0435\u0442 \u043f\u0440\u043e\u0435\u043a\u0442\u043e\u0432',
  noArtifacts: '\u041d\u0435\u0442 \u0430\u0440\u0442\u0435\u0444\u0430\u043a\u0442\u043e\u0432',
  selectProject: '\u0421\u043d\u0430\u0447\u0430\u043b\u0430 \u0432\u044b\u0431\u0435\u0440\u0438\u0442\u0435 \u043f\u0440\u043e\u0435\u043a\u0442',
  projectLabel: '\u041f\u0440\u043e\u0435\u043a\u0442:',
  createGraph: '\u0413\u0440\u0430\u0444',
  createDocument: '\u0414\u043e\u043a\u0443\u043c\u0435\u043d\u0442',
  createMap: '\u041a\u0430\u0440\u0442\u0430',
  createNamePlaceholder: '\u041d\u0430\u0437\u0432\u0430\u043d\u0438\u0435 \u0430\u0440\u0442\u0435\u0444\u0430\u043a\u0442\u0430',
  createConfirm: '\u0421\u043e\u0437\u0434\u0430\u0442\u044c',
  createCancel: '\u041e\u0442\u043c\u0435\u043d\u0430',
  deleteProject: '\u0423\u0434\u0430\u043b\u0438\u0442\u044c \u043f\u0440\u043e\u0435\u043a\u0442',
  deleteProjectConfirm: '\u0423\u0434\u0430\u043b\u0438\u0442\u044c \u043f\u0440\u043e\u0435\u043a\u0442? \u042d\u0442\u043e \u0434\u0435\u0439\u0441\u0442\u0432\u0438\u0435 \u043d\u0435\u043e\u0431\u0440\u0430\u0442\u0438\u043c\u043e.',
  deleteProjectNotEmpty: '\u041f\u0440\u043e\u0435\u043a\u0442 \u043d\u0435 \u043f\u0443\u0441\u0442\u043e\u0439. \u0421\u043d\u0430\u0447\u0430\u043b\u0430 \u0443\u0434\u0430\u043b\u0438\u0442\u0435 \u0432\u0441\u0435 \u0430\u0440\u0442\u0435\u0444\u0430\u043a\u0442\u044b.',
  createProjectPlaceholder: '\u041d\u0430\u0437\u0432\u0430\u043d\u0438\u0435 \u043f\u0440\u043e\u0435\u043a\u0442\u0430',
  createProject: '\u0421\u043e\u0437\u0434\u0430\u0442\u044c \u043f\u0440\u043e\u0435\u043a\u0442',
  createProjectDuplicate: '\u0422\u0430\u043a\u043e\u0435 \u0438\u043c\u044f \u0443\u0436\u0435 \u0435\u0441\u0442\u044c'
};

const icons = {
  graph: '\uD83D\uDCC8',
  document: '\uD83D\uDCC4',
  map: '\uD83D\uDDFA\uFE0F'
};

const Sidebar: React.FC<SidebarProps> = ({
  isCollapsed,
  onToggleCollapse,
  onArtifactSelect
}) => {
  const dispatch = useAppDispatch();
  const projects = useAppSelector((state) => state.projects.projects);
  const projectsLoading = useAppSelector((state) => state.projects.isLoading);
  const currentProject = useAppSelector((state) => state.projects.currentProject);
  const artifacts = useAppSelector((state) => state.artifacts.items);
  const artifactsLoading = useAppSelector((state) => state.artifacts.isLoading);

  const [selectedView, setSelectedView] = useState<'projects' | 'artifacts'>(() => (currentProject ? 'artifacts' : 'projects'));
  const [filter, setFilter] = useState('');
  const [creatingType, setCreatingType] = useState<'graph' | 'document' | 'map' | null>(null);
  const [createName, setCreateName] = useState('');
  const [deletingProjectId, setDeletingProjectId] = useState<number | null>(null);
  const [projectName, setProjectName] = useState('');
  const [projectError, setProjectError] = useState<string | null>(null);
  const [creatingProject, setCreatingProject] = useState(false);

  useEffect(() => {
    if (currentProject?.id && selectedView === 'artifacts') {
      dispatch(fetchArtifacts(currentProject.id));
    }
  }, [currentProject?.id, selectedView, dispatch]);

  const handleProjectSelect = (projectId: number) => {
    dispatch(setCurrentProject(projectId));
    setSelectedView('artifacts');
  };

  const handleArtifactSelect = (artifact: ApiArtifact) => {
    dispatch(setCurrentArtifact(artifact.id));
    onArtifactSelect(artifact);
  };

  const handleDeleteProject = useCallback(async (projectId: number, projectName: string) => {
    setDeletingProjectId(projectId);
    try {
      const list = await artifactApi.getByProject(projectId);
      if (Array.isArray(list) && list.length > 0) {
        window.alert(labels.deleteProjectNotEmpty);
        return;
      }
      const ok = window.confirm(`${labels.deleteProjectConfirm}\n\n${projectName}`);
      if (!ok) return;
      await projectApi.delete(projectId);
      await dispatch(fetchProjects());
      if (currentProject?.id === projectId) {
        setSelectedView('projects');
      }
    } catch (error) {
      // no-op for now; could add toast later
    } finally {
      setDeletingProjectId(null);
    }
  }, [dispatch, currentProject?.id]);

  const handleCreateProject = useCallback(async () => {
    const trimmed = projectName.trim();
    if (!trimmed) return;
    const exists = projects.some(p => p.name.trim().toLowerCase() === trimmed.toLowerCase());
    if (exists) {
      setProjectError(labels.createProjectDuplicate);
      return;
    }
    setProjectError(null);
    setCreatingProject(true);
    try {
      await projectApi.create({ name: trimmed });
      await dispatch(fetchProjects());
      setProjectName('');
    } catch (error) {
      // no-op
    } finally {
      setCreatingProject(false);
    }
  }, [projectName, projects, dispatch]);

  const openCreate = useCallback((type: 'graph' | 'document' | 'map') => {
    if (!currentProject?.id) return;
    setCreatingType(type);
    setCreateName('');
  }, [currentProject?.id]);

  const cancelCreate = useCallback(() => {
    setCreatingType(null);
    setCreateName('');
  }, []);

  const handleCreateArtifact = useCallback(async () => {
    if (!currentProject?.id || !creatingType) return;

    const baseName = creatingType === 'graph'
      ? labels.createGraph
      : creatingType === 'document'
        ? labels.createDocument
        : labels.createMap;

    const data = creatingType === 'graph'
      ? { nodes: [], edges: [] }
      : {};

    try {
      const trimmedName = createName.trim();
      const name = trimmedName.length > 0
        ? trimmedName
        : `${baseName} ${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;

      const created = await dispatch(createArtifact({
        projectId: currentProject.id,
        data: {
          name,
          type: creatingType,
          data
        }
      })).unwrap();

      setSelectedView('artifacts');
      handleArtifactSelect(created as ApiArtifact);
    } catch (error) {
      // no-op for now; could add toast later
    } finally {
      setCreatingType(null);
      setCreateName('');
    }
  }, [currentProject?.id, creatingType, createName, dispatch, handleArtifactSelect]);

  const normalizedFilter = filter.trim().toLowerCase();

  const filteredProjects = useMemo(() => {
    const list = normalizedFilter
      ? projects.filter(project => project.name.toLowerCase().includes(normalizedFilter))
      : projects;
    return [...list].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  }, [projects, normalizedFilter]);

  const projectArtifacts = useMemo(() => {
    if (!currentProject?.id) return [];
    return Object.values(artifacts || {}).filter((artifact) => artifact && artifact.project_id === currentProject.id);
  }, [artifacts, currentProject?.id]);

  const filteredArtifacts = useMemo(() => {
    if (!normalizedFilter) return projectArtifacts;
    return projectArtifacts.filter(artifact => {
      if (!artifact) return false;
      const name = artifact.name?.toLowerCase() || '';
      const type = artifact.type?.toLowerCase() || '';
      return name.includes(normalizedFilter) || type.includes(normalizedFilter);
    });
  }, [projectArtifacts, normalizedFilter]);

  if (isCollapsed) {
    return (
      <div className="sidebar collapsed">
        <button className="sidebar-toggle" onClick={onToggleCollapse}>
          &gt;
        </button>
      </div>
    );
  }

  const isLoading = selectedView === 'projects' ? projectsLoading : artifactsLoading;
  const actionsDisabled = !currentProject || !!creatingType;

  return (
    <div className="sidebar">
      <div className="sidebar-header">
        <h3>{selectedView === 'projects' ? labels.projects : labels.artifacts}</h3>
        <button className="sidebar-toggle" onClick={onToggleCollapse}>&lt;</button>
      </div>

      <div className="sidebar-nav">
        <button
          className={`nav-btn ${selectedView === 'projects' ? 'active' : ''}`}
          onClick={() => setSelectedView('projects')}
        >
          {labels.projects}
        </button>
        <button
          className={`nav-btn ${selectedView === 'artifacts' ? 'active' : ''}`}
          onClick={() => setSelectedView('artifacts')}
          disabled={!currentProject}
          title={!currentProject ? labels.selectProject : undefined}
        >
          {labels.artifacts}
        </button>
      </div>

      {selectedView === 'projects' && (
        <div className="project-create-row">
          <input
            className="project-input"
            type="text"
            value={projectName}
            placeholder={labels.createProjectPlaceholder}
            onChange={(e) => {
              setProjectName(e.target.value);
              setProjectError(null);
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleCreateProject();
            }}
          />
          <button
            className="project-create"
            onClick={handleCreateProject}
            disabled={creatingProject || !projectName.trim()}
          >
            {labels.createProject}
          </button>
          {projectError && <div className="project-error">{projectError}</div>}
        </div>
      )}

      <div className="sidebar-actions">
        <button
          className="action-btn"
          onClick={() => openCreate('graph')}
          disabled={actionsDisabled}
          title={!currentProject ? labels.selectProject : labels.createGraph}
        >
          {icons.graph}
        </button>
        <button
          className="action-btn"
          onClick={() => openCreate('document')}
          disabled={actionsDisabled}
          title={!currentProject ? labels.selectProject : labels.createDocument}
        >
          {icons.document}
        </button>
        <button
          className="action-btn"
          onClick={() => openCreate('map')}
          disabled={actionsDisabled}
          title={!currentProject ? labels.selectProject : labels.createMap}
        >
          {icons.map}
        </button>
      </div>
      {creatingType && (
        <div className="sidebar-create-row">
          <input
            className="create-input"
            type="text"
            value={createName}
            placeholder={labels.createNamePlaceholder}
            onChange={(e) => setCreateName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleCreateArtifact();
              if (e.key === 'Escape') cancelCreate();
            }}
          />
          <button className="create-confirm" onClick={handleCreateArtifact}>
            {labels.createConfirm}
          </button>
          <button className="create-cancel" onClick={cancelCreate}>
            {labels.createCancel}
          </button>
        </div>
      )}

      <div className="sidebar-search">
        <input
          type="text"
          placeholder={labels.search}
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
        />
      </div>

      {selectedView === 'artifacts' && (
        <button
          className="back-btn"
          onClick={() => setSelectedView('projects')}
        >
          {labels.backToProjects}
        </button>
      )}

      <div className="sidebar-list">
        {isLoading ? (
          <div className="sidebar-loading">{labels.loading}</div>
        ) : selectedView === 'projects' ? (
          filteredProjects.length === 0 ? (
            <div className="sidebar-empty">{labels.noProjects}</div>
          ) : (
            filteredProjects.map(project => (
              <div
                key={project.id}
                className={`sidebar-item ${currentProject?.id === project.id ? 'active' : ''}`}
                onClick={() => handleProjectSelect(project.id)}
              >
                <div className="item-icon">P</div>
                <div className="item-content">
                  <div className="item-name">{project.name}</div>
                  <div className="item-meta">
                    <span className="item-date">
                      {new Date(project.created_at).toLocaleDateString()}
                    </span>
                  </div>
                </div>
                <button
                  className="project-delete"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleDeleteProject(project.id, project.name);
                  }}
                  title={labels.deleteProject}
                  disabled={deletingProjectId === project.id}
                >
                  X
                </button>
              </div>
            ))
          )
        ) : (
          filteredArtifacts.length === 0 ? (
            <div className="sidebar-empty">{labels.noArtifacts}</div>
          ) : (
            filteredArtifacts.map(artifact => {
              if (!artifact) return null;
              const icon = artifact.type === 'graph'
                ? 'G'
                : artifact.type === 'table'
                  ? 'T'
                  : artifact.type === 'map'
                    ? 'M'
                    : artifact.type === 'chart'
                      ? 'C'
                      : 'D';
              return (
                <div
                  key={artifact.id}
                  className="sidebar-item"
                  onClick={() => handleArtifactSelect(artifact)}
                >
                  <div className="item-icon">{icon}</div>
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

      {selectedView === 'artifacts' && currentProject && (
        <div className="sidebar-footer">
          <div className="current-project-info">
            <strong>{labels.projectLabel}</strong> {currentProject.name}
          </div>
        </div>
      )}
    </div>
  );
};

export default Sidebar;
