// frontend/src/components/layout/Sidebar.tsx
import React, { useEffect, useMemo, useState, useCallback, useRef } from 'react';
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

type ArtifactContextMenuState = {
  x: number;
  y: number;
  artifact: ApiArtifact;
} | null;

const labels = {
  title: '\u041f\u0440\u043e\u0435\u043a\u0442\u044b',
  loading: '\u0417\u0430\u0433\u0440\u0443\u0437\u043a\u0430...',
  noProjects: '\u041d\u0435\u0442 \u043f\u0440\u043e\u0435\u043a\u0442\u043e\u0432',
  noArtifacts: '\u041d\u0435\u0442 \u0430\u0440\u0442\u0435\u0444\u0430\u043a\u0442\u043e\u0432',
  recent: '\u041d\u0435\u0434\u0430\u0432\u043d\u0438\u0435',
  artifacts: '\u0410\u0440\u0442\u0435\u0444\u0430\u043a\u0442\u044b',
  createGraph: '\u0421\u043e\u0437\u0434\u0430\u0442\u044c \u043d\u043e\u0432\u044b\u0439 \u0433\u0440\u0430\u0444',
  createDocument: '\u0421\u043e\u0437\u0434\u0430\u0442\u044c \u043d\u043e\u0432\u044b\u0439 \u0434\u043e\u043a\u0443\u043c\u0435\u043d\u0442',
  createMap: 'Создать новую карту',
  createConsole: 'Создать новую консоль',
  createNamePlaceholder: '\u041d\u0430\u0437\u0432\u0430\u043d\u0438\u0435 \u0430\u0440\u0442\u0435\u0444\u0430\u043a\u0442\u0430',
  createConfirm: '\u0421\u043e\u0437\u0434\u0430\u0442\u044c',
  createCancel: '\u041e\u0442\u043c\u0435\u043d\u0430',
  createProjectPlaceholder: '\u041d\u0430\u0437\u0432\u0430\u043d\u0438\u0435 \u043f\u0440\u043e\u0435\u043a\u0442\u0430',
  createProject: '\u0421\u043e\u0437\u0434\u0430\u0442\u044c \u043f\u0440\u043e\u0435\u043a\u0442',
  createProjectDuplicate: '\u0422\u0430\u043a\u043e\u0435 \u0438\u043c\u044f \u0443\u0436\u0435 \u0435\u0441\u0442\u044c',
  deleteProject: '\u0423\u0434\u0430\u043b\u0438\u0442\u044c \u043f\u0440\u043e\u0435\u043a\u0442',
  deleteProjectConfirm: '\u0423\u0434\u0430\u043b\u0438\u0442\u044c \u043f\u0440\u043e\u0435\u043a\u0442? \u042d\u0442\u043e \u0434\u0435\u0439\u0441\u0442\u0432\u0438\u0435 \u043d\u0435\u043e\u0431\u0440\u0430\u0442\u0438\u043c\u043e.',
  deleteProjectNotEmpty: '\u041f\u0440\u043e\u0435\u043a\u0442 \u043d\u0435 \u043f\u0443\u0441\u0442\u043e\u0439. \u0421\u043d\u0430\u0447\u0430\u043b\u0430 \u0443\u0434\u0430\u043b\u0438\u0442\u0435 \u0432\u0441\u0435 \u0430\u0440\u0442\u0435\u0444\u0430\u043a\u0442\u044b.',
  duplicate: '\u0414\u0443\u0431\u043b\u0438\u0440\u043e\u0432\u0430\u0442\u044c',
  rename: '\u041f\u0435\u0440\u0435\u0438\u043c\u0435\u043d\u043e\u0432\u0430\u0442\u044c',
  renamePrompt: '\u041d\u043e\u0432\u043e\u0435 \u0438\u043c\u044f \u0430\u0440\u0442\u0435\u0444\u0430\u043a\u0442\u0430:',
  renameSame: '\u0418\u043c\u044f \u043d\u0435 \u0438\u0437\u043c\u0435\u043d\u0438\u043b\u043e\u0441\u044c',
  renameEmpty: '\u0418\u043c\u044f \u043d\u0435 \u043c\u043e\u0436\u0435\u0442 \u0431\u044b\u0442\u044c \u043f\u0443\u0441\u0442\u044b\u043c',
  duplicateSuffix: '\u043a\u043e\u043f\u0438\u044f',
  createArtifactDuplicate: 'Артефакт с таким именем и типом уже существует. Выберите другое имя.',
};

const typeIcon: Record<string, string> = {
  graph: '\u25c9',
  document: '📄',
  table: '\u25a6',
  map: '🗺️',
  chart: '📊',
  console: '🖥',
};

const Sidebar: React.FC<SidebarProps> = ({ isCollapsed, onToggleCollapse, onArtifactSelect }) => {
  const dispatch = useAppDispatch();
  const projects = useAppSelector((state) => state.projects.projects);
  const projectsLoading = useAppSelector((state) => state.projects.isLoading);
  const currentProject = useAppSelector((state) => state.projects.currentProject);
  const artifacts = useAppSelector((state) => state.artifacts.items);
  const artifactsLoading = useAppSelector((state) => state.artifacts.isLoading);
  const currentArtifactId = useAppSelector((state) => state.artifacts.currentArtifactId);

  const [creatingType, setCreatingType] = useState<'graph' | 'document' | 'map' | 'console' | null>(null);
  const [createName, setCreateName] = useState('');
  const [deletingProjectId, setDeletingProjectId] = useState<number | null>(null);
  const [projectName, setProjectName] = useState('');
  const [projectError, setProjectError] = useState<string | null>(null);
  const [creatingProject, setCreatingProject] = useState(false);
  const [contextMenu, setContextMenu] = useState<ArtifactContextMenuState>(null);
  const [recentArtifactIds, setRecentArtifactIds] = useState<number[]>([]);

  const sidebarRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    try {
      const raw = localStorage.getItem('nodex.recentArtifacts');
      if (!raw) return;
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        const ids = parsed.map((v) => Number(v)).filter((v) => Number.isFinite(v));
        setRecentArtifactIds(ids);
      }
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    if (currentProject?.id) {
      dispatch(fetchArtifacts(currentProject.id));
    }
  }, [currentProject?.id, dispatch]);

  useEffect(() => {
    if (!currentArtifactId) return;
    setRecentArtifactIds((prev) => {
      const next = [currentArtifactId, ...prev.filter((id) => id !== currentArtifactId)].slice(0, 10);
      try {
        localStorage.setItem('nodex.recentArtifacts', JSON.stringify(next));
      } catch {
        // ignore
      }
      return next;
    });
  }, [currentArtifactId]);

  useEffect(() => {
    const onWindowClick = () => setContextMenu(null);
    window.addEventListener('click', onWindowClick);
    return () => window.removeEventListener('click', onWindowClick);
  }, []);

  const sortedProjects = useMemo(() => (
    [...projects].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
  ), [projects]);

  const allArtifacts = useMemo(() => (
    Object.values(artifacts || {}).filter((artifact): artifact is ApiArtifact => Boolean(artifact))
  ), [artifacts]);

  const projectNameById = useMemo(() => {
    const map = new Map<number, string>();
    projects.forEach((project) => map.set(project.id, project.name));
    return map;
  }, [projects]);

  const projectArtifacts = useMemo(() => {
    if (!currentProject?.id) return [] as ApiArtifact[];
    return allArtifacts
      .filter((artifact) => artifact.project_id === currentProject.id)
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  }, [allArtifacts, currentProject?.id]);

  const recentArtifacts = useMemo(() => {
    const byId = new Map<number, ApiArtifact>(allArtifacts.map((a) => [a.id, a]));
    return recentArtifactIds.map((id) => byId.get(id)).filter((a): a is ApiArtifact => Boolean(a)).slice(0, 8);
  }, [allArtifacts, recentArtifactIds]);

  const openArtifactContextMenu = useCallback((event: React.MouseEvent, artifact: ApiArtifact) => {
    event.preventDefault();
    event.stopPropagation();
    const panel = sidebarRef.current;
    const rect = panel?.getBoundingClientRect();
    const x = rect ? event.clientX - rect.left : event.clientX;
    const y = rect ? event.clientY - rect.top : event.clientY;
    setContextMenu({ x, y, artifact });
  }, []);

  const contextMenuStyle = useMemo<React.CSSProperties>(() => {
    if (!contextMenu) return {};
    const maxWidth = 180;
    const maxHeight = 96;
    const panel = sidebarRef.current;
    const width = panel?.clientWidth || 300;
    const height = panel?.clientHeight || 600;
    return {
      left: Math.max(8, Math.min(contextMenu.x, width - maxWidth - 8)),
      top: Math.max(8, Math.min(contextMenu.y, height - maxHeight - 8)),
    };
  }, [contextMenu]);

  const handleProjectSelect = useCallback((projectId: number) => {
    dispatch(setCurrentProject(projectId));
  }, [dispatch]);

  const handleArtifactSelect = useCallback((artifact: ApiArtifact) => {
    dispatch(setCurrentArtifact(artifact.id));
    onArtifactSelect(artifact);
    setContextMenu(null);
  }, [dispatch, onArtifactSelect]);

  const handleDeleteProject = useCallback(async (projectId: number, projectNameValue: string) => {
    setDeletingProjectId(projectId);
    try {
      const list = await artifactApi.getByProject(projectId);
      if (Array.isArray(list) && list.length > 0) {
        window.alert(labels.deleteProjectNotEmpty);
        return;
      }
      const ok = window.confirm(`${labels.deleteProjectConfirm}\n\n${projectNameValue}`);
      if (!ok) return;
      await projectApi.delete(projectId);
      await dispatch(fetchProjects());
    } finally {
      setDeletingProjectId(null);
    }
  }, [dispatch]);

  const handleCreateProject = useCallback(async () => {
    const trimmed = projectName.trim();
    if (!trimmed) return;
    const exists = projects.some((p) => p.name.trim().toLowerCase() === trimmed.toLowerCase());
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
    } finally {
      setCreatingProject(false);
    }
  }, [projectName, projects, dispatch]);

  const openCreate = useCallback((type: 'graph' | 'document' | 'map' | 'console') => {
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
    const baseName = creatingType === 'graph' ? 'Граф' : creatingType === 'document' ? 'Документ' : creatingType === 'console' ? 'Консоль' : 'Карта';
    const data = creatingType === 'graph' ? { nodes: [], edges: [] } : creatingType === 'console' ? { columns: [], rows: [] } : {};

    try {
      const trimmedName = createName.trim();
      const name = trimmedName.length > 0 ? trimmedName : `${baseName} ${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
      const normalizedName = name.trim().toLowerCase();
      const duplicateByType = allArtifacts.some((artifact) => (
        artifact.project_id === currentProject.id
        && String(artifact.type || '') === creatingType
        && String(artifact.name || '').trim().toLowerCase() === normalizedName
      ));
      if (duplicateByType) {
        window.alert(labels.createArtifactDuplicate);
        return;
      }

      const created = await dispatch(createArtifact({ projectId: currentProject.id, data: { name, type: creatingType, data } })).unwrap();
      handleArtifactSelect(created as ApiArtifact);
    } catch (error: any) {
      const detail = String(error?.response?.data?.detail || error?.message || '');
      if (detail) window.alert(detail);
    } finally {
      setCreatingType(null);
      setCreateName('');
    }
  }, [currentProject?.id, creatingType, createName, dispatch, handleArtifactSelect, allArtifacts]);

  const handleDuplicateArtifact = useCallback(async (artifact: ApiArtifact) => {
    if (!currentProject?.id) return;
    const siblingNames = Object.values(artifacts)
      .filter((a) => a.project_id === currentProject.id && a.type === artifact.type)
      .map((a) => (a.name || '').trim().toLowerCase());

    const base = `${artifact.name} (${labels.duplicateSuffix})`;
    let nextName = base;
    let idx = 2;
    while (siblingNames.includes(nextName.trim().toLowerCase())) {
      nextName = `${base} ${idx}`;
      idx += 1;
    }

    try {
      const created = await dispatch(createArtifact({
        projectId: currentProject.id,
        data: {
          name: nextName,
          type: artifact.type,
          description: artifact.description,
          data: artifact.data || {},
          metadata: artifact.metadata || {},
        },
      })).unwrap();
      handleArtifactSelect(created as ApiArtifact);
    } catch (error: any) {
      const detail = String(error?.response?.data?.detail || error?.message || '');
      if (detail) window.alert(detail);
    }
  }, [currentProject?.id, artifacts, dispatch, handleArtifactSelect]);

  const handleRenameArtifact = useCallback(async (artifact: ApiArtifact) => {
    if (!currentProject?.id) return;
    const raw = window.prompt(labels.renamePrompt, artifact.name || '');
    if (raw === null) return;
    const nextName = raw.trim();
    if (!nextName) {
      window.alert(labels.renameEmpty);
      return;
    }
    if (nextName === String(artifact.name || '').trim()) {
      window.alert(labels.renameSame);
      return;
    }

    try {
      await artifactApi.update(currentProject.id, artifact.id, { name: nextName });
      await dispatch(fetchArtifacts(currentProject.id));
    } catch (error: any) {
      const detail = String(error?.response?.data?.detail || error?.message || '');
      if (detail) window.alert(detail);
    }
  }, [currentProject?.id, dispatch]);

  const actionsDisabled = !currentProject || !!creatingType;

  return (
    <div className={`sidebar-shell ${isCollapsed ? 'collapsed' : 'expanded'}`}>
      <div className={`sidebar ${isCollapsed ? 'collapsed' : ''}`} ref={sidebarRef}>
        <button className="sidebar-grip" onClick={onToggleCollapse} title="\u0421\u043a\u0440\u044b\u0442\u044c/\u043f\u043e\u043a\u0430\u0437\u0430\u0442\u044c \u043f\u0430\u043d\u0435\u043b\u044c" aria-label="\u0421\u043a\u0440\u044b\u0442\u044c/\u043f\u043e\u043a\u0430\u0437\u0430\u0442\u044c \u043f\u0430\u043d\u0435\u043b\u044c">
          {isCollapsed ? '>' : '<'}
        </button>

        <div className="sidebar-header">
          <h3>{labels.title}</h3>
        </div>

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
            onKeyDown={(e) => { if (e.key === 'Enter') handleCreateProject(); }}
          />
          <button className="project-create" onClick={handleCreateProject} disabled={creatingProject || !projectName.trim()}>
            {labels.createProject}
          </button>
          {projectError && <div className="project-error">{projectError}</div>}
        </div>

        <div className="sidebar-actions">
          <button className="action-btn wide" onClick={() => openCreate('graph')} disabled={actionsDisabled} title={labels.createGraph}>{labels.createGraph}</button>
          <button className="action-btn wide" onClick={() => openCreate('document')} disabled={actionsDisabled} title={labels.createDocument}>{labels.createDocument}</button>
          <button className="action-btn wide" onClick={() => openCreate('map')} disabled={actionsDisabled} title={labels.createMap}>{labels.createMap}</button>
          <button className="action-btn wide" onClick={() => openCreate('console')} disabled={actionsDisabled} title={labels.createConsole}>{labels.createConsole}</button>
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
            <button className="create-confirm" onClick={handleCreateArtifact}>{labels.createConfirm}</button>
            <button className="create-cancel" onClick={cancelCreate}>{labels.createCancel}</button>
          </div>
        )}

        <div className="sidebar-list">
          {recentArtifacts.length > 0 && (
            <div className="sidebar-group recent-group">
              <div className="sidebar-group-title">{labels.recent} ({recentArtifacts.length})</div>
              <div className="sidebar-group-list">
                {recentArtifacts.map((artifact) => (
                  <div
                    key={`recent-${artifact.id}`}
                    className={`sidebar-item compact recent-item ${currentArtifactId === artifact.id ? 'active' : ''}`}
                    onClick={() => handleArtifactSelect(artifact)}
                    onContextMenu={(e) => openArtifactContextMenu(e, artifact)}
                  >
                    <div className={`item-icon type-${artifact.type}`}>{typeIcon[artifact.type] || '\u25cf'}</div>
                    <div className="item-content">
                      <div className="item-name">{artifact.name}</div>
                      <div className="item-meta">
                        <span className="item-type">{artifact.type}</span>
                        <span className="item-date">{projectNameById.get(artifact.project_id) || '-'}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="project-tree-scroll">
            {projectsLoading ? (
            <div className="sidebar-loading">{labels.loading}</div>
          ) : sortedProjects.length === 0 ? (
            <div className="sidebar-empty">{labels.noProjects}</div>
          ) : (
            sortedProjects.map((project) => {
              const isCurrent = currentProject?.id === project.id;
              const knownCount = Number((project as any)?.artifacts_count ?? NaN);
              const artifactsCount = isCurrent ? projectArtifacts.length : (Number.isFinite(knownCount) ? knownCount : null);

              return (
                <div key={project.id} className="tree-project-node">
                  <div className={`sidebar-item tree-project-item ${isCurrent ? 'active' : ''}`} onClick={() => handleProjectSelect(project.id)}>
                    <div className="item-icon">{'📁'}</div>
                    <div className="item-content">
                      <div className="item-name">{project.name}</div>
                      <div className="item-meta">
                        <span className="item-date">{new Date(project.created_at).toLocaleDateString()}</span>
                        {artifactsCount !== null && <span className="item-version">({artifactsCount})</span>}
                      </div>
                    </div>
                    <button className="project-delete" onClick={(e) => { e.stopPropagation(); handleDeleteProject(project.id, project.name); }} title={labels.deleteProject} disabled={deletingProjectId === project.id}>x</button>
                  </div>

                  {isCurrent && (
                    <div className="tree-artifacts">
                      <div className="tree-project-children">- {labels.artifacts} ({projectArtifacts.length})</div>
                      {artifactsLoading ? (
                        <div className="sidebar-loading compact">{labels.loading}</div>
                      ) : projectArtifacts.length === 0 ? (
                        <div className="sidebar-empty compact">{labels.noArtifacts}</div>
                      ) : (
                        projectArtifacts.map((artifact) => (
                          <div
                            key={artifact.id}
                            className={`sidebar-item tree-artifact-item ${currentArtifactId === artifact.id ? 'active' : ''}`}
                            onClick={() => handleArtifactSelect(artifact)}
                            onContextMenu={(e) => openArtifactContextMenu(e, artifact)}
                          >
                            <div className={`item-icon type-${artifact.type}`}>{typeIcon[artifact.type] || '\u25cf'}</div>
                            <div className="item-content">
                              <div className="item-name">{artifact.name}</div>
                              <div className="item-meta"><span className="item-type">{artifact.type}</span><span className="item-version">v{artifact.version || 1}</span></div>
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
        </div>

        {contextMenu && (
          <div className="artifact-context-menu" style={contextMenuStyle} onClick={(e) => e.stopPropagation()}>
            <button type="button" className="artifact-context-btn" onClick={() => handleDuplicateArtifact(contextMenu.artifact)}>{labels.duplicate}</button>
            <button type="button" className="artifact-context-btn" onClick={() => handleRenameArtifact(contextMenu.artifact)}>{labels.rename}</button>
          </div>
        )}
      </div>
    </div>
  );
};

export default Sidebar;










