import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useAppDispatch, useAppSelector } from '../../store';
import { setCurrentProject, fetchProjects } from '../../store/slices/projectsSlice';
import { fetchArtifacts, setCurrentArtifact, createArtifact, deleteArtifact } from '../../store/slices/artifactsSlice';
import { artifactApi, projectApi } from '../../services/api';
import type { ApiArtifact } from '../../types/api';
import './Sidebar.css';

interface SidebarProps {
  isCollapsed: boolean;
  onToggleCollapse: () => void;
  onArtifactSelect: (artifact: ApiArtifact) => void;
  onOpenServiceScreen: () => void;
  onCloseServiceScreen: () => void;
  isServiceScreenActive: boolean;
}

type ArtifactContextMenuState = {
  x: number;
  y: number;
  artifact: ApiArtifact;
} | null;

type ArtifactCreateType = 'graph' | 'document' | 'map' | 'console';

const labels = {
  title: 'Рабочая область',
  analysisMode: 'Анализ',
  adminMode: 'Администрирование',
  loading: 'Загрузка...',
  noProjects: 'Нет проектов',
  noArtifacts: 'В проекте пока нет артефактов',
  recent: 'Недавние',
  projects: 'Проекты',
  currentProject: 'Текущий проект',
  createLabel: 'Создать',
  createGraph: 'Новый граф',
  createDocument: 'Новый документ',
  createMap: 'Новая карта',
  createConsole: 'Новая консоль',
  adminHint: 'Системные настройки и внешние источники данных вынесены в отдельный режим, чтобы основной анализ оставался чище.',
  openAdmin: 'Открыть сервисные функции',
  createNamePlaceholder: 'Название артефакта',
  createConfirm: 'Создать',
  createCancel: 'Отмена',
  createProjectPlaceholder: 'Название проекта',
  createProject: 'Новый проект',
  createProjectDuplicate: 'Такое имя проекта уже существует',
  deleteProject: 'Удалить проект',
  deleteProjectConfirm: 'Удалить проект? Это действие необратимо.',
  deleteProjectNotEmpty: 'Проект не пустой. Сначала удалите все артефакты.',
  duplicate: 'Дублировать',
  rename: 'Переименовать',
  deleteArtifact: 'Удалить',
  deleteArtifactConfirm: 'Удалить артефакт? Это действие необратимо.',
  renamePrompt: 'Новое имя артефакта:',
  renameSame: 'Имя не изменилось',
  renameEmpty: 'Имя не может быть пустым',
  duplicateSuffix: 'копия',
  createArtifactDuplicate: 'Артефакт с таким именем и типом уже существует. Выберите другое имя.',
};

const artifactTypeLabels: Record<string, string> = {
  graph: 'Графы',
  console: 'Консоли',
  document: 'Документы',
  map: 'Карты',
  table: 'Таблицы',
  chart: 'Диаграммы',
};

const artifactTypeOrder = ['graph', 'console', 'document', 'map', 'table', 'chart'];

const typeIcon: Record<string, string> = {
  graph: '◎',
  document: 'D',
  table: 'T',
  map: 'M',
  chart: 'C',
  console: '>',
};

const createOptions: Array<{ type: ArtifactCreateType; label: string }> = [
  { type: 'graph', label: labels.createGraph },
  { type: 'document', label: labels.createDocument },
  { type: 'map', label: labels.createMap },
  { type: 'console', label: labels.createConsole },
];

const Sidebar: React.FC<SidebarProps> = ({
  isCollapsed,
  onToggleCollapse,
  onArtifactSelect,
  onOpenServiceScreen,
  onCloseServiceScreen,
  isServiceScreenActive,
}) => {
  const dispatch = useAppDispatch();
  const projects = useAppSelector((state) => state.projects.projects);
  const projectsLoading = useAppSelector((state) => state.projects.isLoading);
  const currentProject = useAppSelector((state) => state.projects.currentProject);
  const artifacts = useAppSelector((state) => state.artifacts.items);
  const artifactsLoading = useAppSelector((state) => state.artifacts.isLoading);
  const currentArtifactId = useAppSelector((state) => state.artifacts.currentArtifactId);

  const [creatingType, setCreatingType] = useState<ArtifactCreateType | null>(null);
  const [createName, setCreateName] = useState('');
  const [isCreateMenuOpen, setIsCreateMenuOpen] = useState(false);
  const [deletingProjectId, setDeletingProjectId] = useState<number | null>(null);
  const [projectName, setProjectName] = useState('');
  const [projectError, setProjectError] = useState<string | null>(null);
  const [creatingProject, setCreatingProject] = useState(false);
  const [contextMenu, setContextMenu] = useState<ArtifactContextMenuState>(null);
  const [recentArtifactIds, setRecentArtifactIds] = useState<number[]>([]);
  const [showRecent, setShowRecent] = useState(false);

  const sidebarRef = useRef<HTMLDivElement | null>(null);
  const createMenuRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    try {
      const raw = localStorage.getItem('nodex.recentArtifacts');
      if (!raw) return;
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        const ids = parsed.map((value) => Number(value)).filter((value) => Number.isFinite(value));
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
    const handleWindowClick = () => {
      setContextMenu(null);
      setIsCreateMenuOpen(false);
    };
    window.addEventListener('click', handleWindowClick);
    return () => window.removeEventListener('click', handleWindowClick);
  }, []);

  const sortedProjects = useMemo(
    () => [...projects].sort((left, right) => new Date(right.created_at).getTime() - new Date(left.created_at).getTime()),
    [projects],
  );

  const allArtifacts = useMemo(
    () => Object.values(artifacts || {}).filter((artifact): artifact is ApiArtifact => Boolean(artifact)),
    [artifacts],
  );

  const projectArtifacts = useMemo(() => {
    if (!currentProject?.id) return [] as ApiArtifact[];
    return allArtifacts
      .filter((artifact) => artifact.project_id === currentProject.id)
      .sort((left, right) => left.name.localeCompare(right.name, 'ru'));
  }, [allArtifacts, currentProject?.id]);

  const groupedProjectArtifacts = useMemo(() => {
    const groups = artifactTypeOrder
      .map((type) => ({
        type,
        title: artifactTypeLabels[type] || type,
        items: projectArtifacts.filter((artifact) => artifact.type === type),
      }))
      .filter((group) => group.items.length > 0);

    const knownTypes = new Set(groups.map((group) => group.type));
    const extraGroups = Array.from(
      projectArtifacts.reduce((map, artifact) => {
        if (knownTypes.has(artifact.type)) return map;
        const bucket = map.get(artifact.type) || [];
        bucket.push(artifact);
        map.set(artifact.type, bucket);
        return map;
      }, new Map<string, ApiArtifact[]>()),
    ).map(([type, items]) => ({
      type,
      title: artifactTypeLabels[type] || type,
      items,
    }));

    return [...groups, ...extraGroups];
  }, [projectArtifacts]);

  const recentArtifacts = useMemo(() => {
    const byId = new Map<number, ApiArtifact>(allArtifacts.map((artifact) => [artifact.id, artifact]));
    return recentArtifactIds.map((id) => byId.get(id)).filter((artifact): artifact is ApiArtifact => Boolean(artifact)).slice(0, 8);
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
    const maxHeight = 140;
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

  const handleSelectArtifact = useCallback((artifact: ApiArtifact) => {
    dispatch(setCurrentArtifact(artifact.id));
    onCloseServiceScreen();
    onArtifactSelect(artifact);
    setContextMenu(null);
  }, [dispatch, onArtifactSelect, onCloseServiceScreen]);

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
    const exists = projects.some((project) => project.name.trim().toLowerCase() === trimmed.toLowerCase());
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
  }, [dispatch, projectName, projects]);

  const openCreate = useCallback((type: ArtifactCreateType) => {
    if (!currentProject?.id) return;
    setCreatingType(type);
    setCreateName('');
    setIsCreateMenuOpen(false);
  }, [currentProject?.id]);

  const cancelCreate = useCallback(() => {
    setCreatingType(null);
    setCreateName('');
  }, []);

  const handleCreateArtifact = useCallback(async () => {
    if (!currentProject?.id || !creatingType) return;
    const baseName =
      creatingType === 'graph'
        ? 'Граф'
        : creatingType === 'document'
          ? 'Документ'
          : creatingType === 'console'
            ? 'Консоль'
            : 'Карта';
    const data =
      creatingType === 'graph'
        ? { nodes: [], edges: [] }
        : creatingType === 'console'
          ? { tabs: [{ id: 'main', name: 'Основная', columns: [], rows: [], row_count: 0 }], active_tab_id: 'main', columns: [], rows: [] }
          : {};

    try {
      const trimmedName = createName.trim();
      const name = trimmedName.length > 0
        ? trimmedName
        : `${baseName} ${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
      const normalizedName = name.trim().toLowerCase();
      const duplicateByType = allArtifacts.some((artifact) =>
        artifact.project_id === currentProject.id &&
        String(artifact.type || '') === creatingType &&
        String(artifact.name || '').trim().toLowerCase() === normalizedName,
      );
      if (duplicateByType) {
        window.alert(labels.createArtifactDuplicate);
        return;
      }

      const created = await dispatch(createArtifact({
        projectId: currentProject.id,
        data: { name, type: creatingType, data },
      })).unwrap();
      handleSelectArtifact(created as ApiArtifact);
    } catch (error: any) {
      const detail = String(error?.response?.data?.detail || error?.message || '');
      if (detail) window.alert(detail);
    } finally {
      setCreatingType(null);
      setCreateName('');
    }
  }, [allArtifacts, creatingType, currentProject?.id, createName, dispatch, handleSelectArtifact]);

  const handleDuplicateArtifact = useCallback(async (artifact: ApiArtifact) => {
    if (!currentProject?.id) return;
    const siblingNames = Object.values(artifacts)
      .filter((item) => item.project_id === currentProject.id && item.type === artifact.type)
      .map((item) => (item.name || '').trim().toLowerCase());

    const base = `${artifact.name} (${labels.duplicateSuffix})`;
    let nextName = base;
    let index = 2;
    while (siblingNames.includes(nextName.trim().toLowerCase())) {
      nextName = `${base} ${index}`;
      index += 1;
    }

    try {
      const created = await dispatch(createArtifact({
        projectId: currentProject.id,
        data: {
          name: nextName,
          type: artifact.type,
          description: artifact.description ?? undefined,
          data: artifact.data || {},
          metadata: artifact.metadata || {},
        },
      })).unwrap();
      handleSelectArtifact(created as ApiArtifact);
    } catch (error: any) {
      const detail = String(error?.response?.data?.detail || error?.message || '');
      if (detail) window.alert(detail);
    }
  }, [artifacts, currentProject?.id, dispatch, handleSelectArtifact]);

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

  const handleDeleteArtifact = useCallback(async (artifact: ApiArtifact) => {
    if (!currentProject?.id) return;
    const ok = window.confirm(`${labels.deleteArtifactConfirm}\n\n${artifact.name || ''}`);
    if (!ok) return;
    try {
      await dispatch(deleteArtifact({ projectId: currentProject.id, id: artifact.id })).unwrap();
      setContextMenu(null);
    } catch (error: any) {
      const detail = String(error?.response?.data?.detail || error?.message || '');
      if (detail) window.alert(detail);
    }
  }, [currentProject?.id, dispatch]);

  const actionsDisabled = !currentProject || !!creatingType;

  return (
    <div className={`sidebar-shell ${isCollapsed ? 'collapsed' : 'expanded'}`}>
      <div className={`sidebar ${isCollapsed ? 'collapsed' : ''}`} ref={sidebarRef}>
        <button
          className="sidebar-grip"
          onClick={onToggleCollapse}
          title="Скрыть или показать панель"
          aria-label="Скрыть или показать панель"
        >
          {isCollapsed ? '>' : '<'}
        </button>

        <div className="sidebar-header">
          <h3>{labels.title}</h3>
          <div className="sidebar-mode-switch">
            <button
              type="button"
              className={`sidebar-mode-btn ${!isServiceScreenActive ? 'active' : ''}`}
              onClick={onCloseServiceScreen}
            >
              {labels.analysisMode}
            </button>
            <button
              type="button"
              className={`sidebar-mode-btn ${isServiceScreenActive ? 'active' : ''}`}
              onClick={onOpenServiceScreen}
            >
              {labels.adminMode}
            </button>
          </div>
        </div>

        {!isServiceScreenActive ? (
          <>
            <div className="sidebar-section">
              <div className="sidebar-section-header">
                <span className="sidebar-section-title">{labels.projects}</span>
              </div>
              <div className="project-create-row">
                <input
                  className="project-input"
                  type="text"
                  value={projectName}
                  placeholder={labels.createProjectPlaceholder}
                  onChange={(event) => {
                    setProjectName(event.target.value);
                    setProjectError(null);
                  }}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter') handleCreateProject();
                  }}
                />
                <button className="project-create" onClick={handleCreateProject} disabled={creatingProject || !projectName.trim()}>
                  {labels.createProject}
                </button>
                {projectError && <div className="project-error">{projectError}</div>}
              </div>
              <div className="project-tree-scroll">
                {projectsLoading ? (
                  <div className="sidebar-loading">{labels.loading}</div>
                ) : sortedProjects.length === 0 ? (
                  <div className="sidebar-empty">{labels.noProjects}</div>
                ) : (
                  sortedProjects.map((project) => {
                    const isCurrent = currentProject?.id === project.id;
                    return (
                      <div key={project.id} className="tree-project-node">
                        <div className={`sidebar-item tree-project-item ${isCurrent ? 'active' : ''}`} onClick={() => handleProjectSelect(project.id)}>
                          <div className="item-icon">{'P'}</div>
                          <div className="item-content">
                            <div className="item-name">{project.name}</div>
                            <div className="item-meta">
                              <span className="item-date">{new Date(project.created_at).toLocaleDateString()}</span>
                            </div>
                          </div>
                          <button
                            className="project-delete"
                            onClick={(event) => {
                              event.stopPropagation();
                              void handleDeleteProject(project.id, project.name);
                            }}
                            title={labels.deleteProject}
                            disabled={deletingProjectId === project.id}
                          >
                            x
                          </button>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>

            <div className="sidebar-section artifacts-section">
              <div className="sidebar-section-header">
                <div>
                  <div className="sidebar-section-title">{labels.currentProject}</div>
                  <div className="sidebar-section-subtitle">{currentProject?.name || 'Проект не выбран'}</div>
                </div>
                <div className="create-menu-wrap" ref={createMenuRef} onClick={(event) => event.stopPropagation()}>
                  <button
                    type="button"
                    className="create-menu-trigger"
                    onClick={() => setIsCreateMenuOpen((prev) => !prev)}
                    disabled={actionsDisabled}
                  >
                    {labels.createLabel}
                  </button>
                  {isCreateMenuOpen && !actionsDisabled && (
                    <div className="create-menu-popover">
                      {createOptions.map((option) => (
                        <button
                          key={option.type}
                          type="button"
                          className="create-menu-item"
                          onClick={() => openCreate(option.type)}
                        >
                          {option.label}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {creatingType && (
                <div className="sidebar-create-row">
                  <input
                    className="create-input"
                    type="text"
                    value={createName}
                    placeholder={labels.createNamePlaceholder}
                    onChange={(event) => setCreateName(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter') void handleCreateArtifact();
                      if (event.key === 'Escape') cancelCreate();
                    }}
                  />
                  <button className="create-confirm" onClick={() => void handleCreateArtifact()}>{labels.createConfirm}</button>
                  <button className="create-cancel" onClick={cancelCreate}>{labels.createCancel}</button>
                </div>
              )}

              <div className="artifact-groups-scroll">
                {artifactsLoading ? (
                  <div className="sidebar-loading">{labels.loading}</div>
                ) : groupedProjectArtifacts.length === 0 ? (
                  <div className="sidebar-empty">{labels.noArtifacts}</div>
                ) : (
                  groupedProjectArtifacts.map((group) => (
                    <div key={group.type} className="artifact-type-group">
                      <div className="artifact-type-header">{group.title} ({group.items.length})</div>
                      <div className="artifact-type-list">
                        {group.items.map((artifact) => (
                          <div
                            key={artifact.id}
                            className={`sidebar-item tree-artifact-item ${currentArtifactId === artifact.id ? 'active' : ''}`}
                            onClick={() => handleSelectArtifact(artifact)}
                            onContextMenu={(event) => openArtifactContextMenu(event, artifact)}
                          >
                            <div className={`item-icon type-${artifact.type}`}>{typeIcon[artifact.type] || '•'}</div>
                            <div className="item-content">
                              <div className="item-name">{artifact.name}</div>
                              <div className="item-meta">
                                <span className="item-type">{artifact.type}</span>
                                <span className="item-version">v{artifact.version || 1}</span>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            <div className="sidebar-section recent-section">
              <button
                type="button"
                className="recent-toggle"
                onClick={() => setShowRecent((prev) => !prev)}
              >
                <span>{labels.recent}</span>
                <span>{showRecent ? '−' : '+'}</span>
              </button>
              {showRecent && (
                <div className="sidebar-group-list">
                  {recentArtifacts.length > 0 ? recentArtifacts.map((artifact) => (
                    <div
                      key={`recent-${artifact.id}`}
                      className={`sidebar-item compact recent-item ${currentArtifactId === artifact.id ? 'active' : ''}`}
                      onClick={() => handleSelectArtifact(artifact)}
                      onContextMenu={(event) => openArtifactContextMenu(event, artifact)}
                    >
                      <div className={`item-icon type-${artifact.type}`}>{typeIcon[artifact.type] || '•'}</div>
                      <div className="item-content">
                        <div className="item-name">{artifact.name}</div>
                        <div className="item-meta">
                          <span className="item-type">{artifact.type}</span>
                        </div>
                      </div>
                    </div>
                  )) : (
                    <div className="sidebar-empty compact">Недавних артефактов пока нет</div>
                  )}
                </div>
              )}
            </div>
          </>
        ) : (
          <div className="sidebar-admin-panel">
            <div className="sidebar-section-title">{labels.adminMode}</div>
            <div className="sidebar-admin-card">
              <div className="sidebar-admin-card-title">Текущий проект</div>
              <div className="sidebar-admin-card-value">{currentProject?.name || 'Проект не выбран'}</div>
            </div>
            <div className="sidebar-admin-card">
              <div className="sidebar-admin-card-title">Что здесь находится</div>
              <div className="sidebar-admin-card-text">{labels.adminHint}</div>
            </div>
            <div className="sidebar-admin-card">
              <div className="sidebar-admin-card-title">Разделы</div>
              <ul className="sidebar-admin-list">
                <li>Источники данных</li>
                <li>Каталог процедур</li>
                <li>Справочники</li>
                <li>Загрузка данных проекта</li>
              </ul>
            </div>
          </div>
        )}

        {contextMenu && (
          <div className="artifact-context-menu" style={contextMenuStyle} onClick={(event) => event.stopPropagation()}>
            <button type="button" className="artifact-context-btn" onClick={() => void handleDuplicateArtifact(contextMenu.artifact)}>{labels.duplicate}</button>
            <button type="button" className="artifact-context-btn" onClick={() => void handleRenameArtifact(contextMenu.artifact)}>{labels.rename}</button>
            <button type="button" className="artifact-context-btn danger" onClick={() => void handleDeleteArtifact(contextMenu.artifact)}>{labels.deleteArtifact}</button>
          </div>
        )}
      </div>
    </div>
  );
};

export default Sidebar;
