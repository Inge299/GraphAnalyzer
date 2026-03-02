// src/components/layout/Sidebar.tsx
import React, { useEffect, useState } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { 
  faFolder, 
  faProjectDiagram, 
  faPlus, 
  faChevronLeft, 
  faChevronRight,
  faChevronDown,
  faChevronUp,
  faSpinner,
  faPlug,
  faCog,
  faSearch,
  faGlobe,
  faDatabase,
  faCode,
  faChartLine,
  faFilter,
  faDownload,
  faUpload,
  faMagic,
  faRobot,
  faBrain,
  faEye,
  faShare,
  faUserPlus,
  faPhoneAlt,
  faLocationDot,
  faEnvelope,
  faFile,
  faBuilding,
  faAt,
  faUsers,
  faFileAlt
} from '@fortawesome/free-solid-svg-icons';
import { useAppDispatch, useAppSelector } from '../../store';
import {
  fetchProjects,
  fetchGraphs,
  createProject,
  createGraph,
  setCurrentProject,
  setCurrentGraph,
} from '../../store/slices/projectsSlice';
import { toggleSidebar } from '../../store/slices/uiSlice';
import { setGraphData } from '../../store/slices/graphSlice';

// Интерфейс для плагина
interface Plugin {
  id: string;
  name: string;
  icon: any;
  category: string;
  color: string;
  description?: string;
  execute: () => void;
  hotkey?: string;
}

// Интерфейс для категории плагинов
interface PluginCategory {
  id: string;
  name: string;
  icon: any;
  plugins: Plugin[];
  defaultCollapsed?: boolean;
}

export const Sidebar: React.FC = () => {
  const dispatch = useAppDispatch();
  const expanded = useAppSelector((state) => state.ui.sidebarExpanded);
  const { projects, graphs, currentProject, currentGraph, isLoading } = useAppSelector(
    (state) => state.projects
  );
  const nodes = useAppSelector((state) => state.graph.nodes);
  const edges = useAppSelector((state) => state.graph.edges);

  // Состояние для сворачивания групп
  const [collapsedGroups, setCollapsedGroups] = useState<Record<string, boolean>>({
    projects: false,
    create: false,
    analyze: false,
    import: false,
    export: false,
    ai: false,
    visualize: false
  });

  useEffect(() => {
    dispatch(fetchProjects());
  }, [dispatch]);

  // Функция создания нового узла
  const createNode = (type: string, x?: number, y?: number) => {
    const centerX = x || 300;
    const centerY = y || 300;
    
    const newNodeId = `node-${Date.now()}`;
    const typeConfig: Record<string, { label: string; attrs: Record<string, string> }> = {
      person: { label: 'Человек', attrs: { full_name: 'Новый контакт' } },
      phone: { label: 'Телефон', attrs: { number: '+7XXXXXXXXXX' } },
      location: { label: 'Адрес', attrs: { address: 'Новый адрес' } },
      message: { label: 'Сообщение', attrs: { content: 'Новое сообщение' } },
      organization: { label: 'Организация', attrs: { name: 'Новая организация' } },
      email: { label: 'Email', attrs: { address: 'new@example.com' } },
      social: { label: 'Соцсеть', attrs: { profile: '@new' } },
      document: { label: 'Документ', attrs: { title: 'Новый документ' } }
    };
    
    const config = typeConfig[type];
    if (!config) return;
    
    const newNode = {
      id: newNodeId,
      type: type,
      attributes: {
        name: `Новый ${config.label}`,
        created: new Date().toLocaleString(),
        ...config.attrs
      },
      x: centerX + Math.random() * 100 - 50,
      y: centerY + Math.random() * 100 - 50
    };
    
    dispatch(setGraphData({
      nodes: [...nodes, newNode],
      edges: edges
    }));
    
    console.log(`✅ Создан узел типа ${type}`);
  };

  // Плагины для создания объектов
  const createPlugins: Plugin[] = [
    {
      id: 'create-person',
      name: 'Человек',
      icon: faUserPlus,
      category: 'create',
      color: '#4F46E5',
      description: 'Добавить новую персону',
      execute: () => createNode('person'),
      hotkey: 'Ctrl+P'
    },
    {
      id: 'create-phone',
      name: 'Телефон',
      icon: faPhoneAlt,
      category: 'create',
      color: '#10B981',
      description: 'Добавить новый телефон',
      execute: () => createNode('phone'),
      hotkey: 'Ctrl+T'
    },
    {
      id: 'create-location',
      name: 'Адрес',
      icon: faLocationDot,
      category: 'create',
      color: '#EF4444',
      description: 'Добавить новый адрес',
      execute: () => createNode('location'),
      hotkey: 'Ctrl+L'
    },
    {
      id: 'create-message',
      name: 'Сообщение',
      icon: faEnvelope,
      category: 'create',
      color: '#F59E0B',
      description: 'Добавить новое сообщение',
      execute: () => createNode('message'),
      hotkey: 'Ctrl+M'
    },
    {
      id: 'create-organization',
      name: 'Организация',
      icon: faBuilding,
      category: 'create',
      color: '#8B5CF6',
      description: 'Добавить организацию',
      execute: () => createNode('organization'),
    },
    {
      id: 'create-email',
      name: 'Email',
      icon: faAt,
      category: 'create',
      color: '#EC4899',
      description: 'Добавить email',
      execute: () => createNode('email'),
    },
    {
      id: 'create-social',
      name: 'Соцсеть',
      icon: faUsers,
      category: 'create',
      color: '#3B82F6',
      description: 'Добавить профиль соцсети',
      execute: () => createNode('social'),
    },
    {
      id: 'create-document',
      name: 'Документ',
      icon: faFileAlt,
      category: 'create',
      color: '#6B7280',
      description: 'Добавить документ',
      execute: () => createNode('document'),
    }
  ];

  // Плагины для анализа
  const analyzePlugins: Plugin[] = [
    {
      id: 'analyze-network',
      name: 'Анализ связей',
      icon: faProjectDiagram,
      category: 'analyze',
      color: '#8B5CF6',
      description: 'Поиск связей между узлами',
      execute: () => console.log('Анализ связей'),
      hotkey: 'Ctrl+A'
    },
    {
      id: 'analyze-patterns',
      name: 'Поиск паттернов',
      icon: faSearch,
      category: 'analyze',
      color: '#EC4899',
      description: 'Поиск повторяющихся паттернов',
      execute: () => console.log('Поиск паттернов'),
    },
    {
      id: 'analyze-geo',
      name: 'Гео-анализ',
      icon: faGlobe,
      category: 'analyze',
      color: '#14B8A6',
      description: 'Анализ географических связей',
      execute: () => console.log('Гео-анализ'),
    },
    {
      id: 'analyze-timeline',
      name: 'Временная шкала',
      icon: faChartLine,
      category: 'analyze',
      color: '#F97316',
      description: 'Построить временную шкалу',
      execute: () => console.log('Timeline'),
    },
    {
      id: 'analyze-filter',
      name: 'Фильтр данных',
      icon: faFilter,
      category: 'analyze',
      color: '#3B82F6',
      description: 'Фильтрация узлов',
      execute: () => console.log('Filter'),
    }
  ];

  // AI-плагины
  const aiPlugins: Plugin[] = [
    {
      id: 'ai-entity-extract',
      name: 'Извлечь сущности',
      icon: faRobot,
      category: 'ai',
      color: '#A855F7',
      description: 'AI: извлечение сущностей из текста',
      execute: () => console.log('AI Entity Extraction'),
    },
    {
      id: 'ai-summarize',
      name: 'Суммаризация',
      icon: faBrain,
      category: 'ai',
      color: '#D946EF',
      description: 'AI: суммаризация связей',
      execute: () => console.log('AI Summarize'),
    },
    {
      id: 'ai-predict',
      name: 'Прогнозирование',
      icon: faMagic,
      category: 'ai',
      color: '#F43F5E',
      description: 'AI: прогнозирование связей',
      execute: () => console.log('AI Predict'),
    }
  ];

  // Плагины импорта
  const importPlugins: Plugin[] = [
    {
      id: 'import-csv',
      name: 'CSV',
      icon: faDatabase,
      category: 'import',
      color: '#F97316',
      description: 'Загрузить данные из CSV',
      execute: () => console.log('Импорт CSV'),
    },
    {
      id: 'import-json',
      name: 'JSON',
      icon: faCode,
      category: 'import',
      color: '#3B82F6',
      description: 'Загрузить данные из JSON',
      execute: () => console.log('Импорт JSON'),
    },
    {
      id: 'import-api',
      name: 'API',
      icon: faGlobe,
      category: 'import',
      color: '#A855F7',
      description: 'Загрузить из внешнего API',
      execute: () => console.log('Импорт из API'),
    },
    {
      id: 'import-excel',
      name: 'Excel',
      icon: faFile,
      category: 'import',
      color: '#10B981',
      description: 'Импорт из Excel',
      execute: () => console.log('Импорт Excel'),
    }
  ];

  // Плагины экспорта
  const exportPlugins: Plugin[] = [
    {
      id: 'export-image',
      name: 'PNG',
      icon: faProjectDiagram,
      category: 'export',
      color: '#6B7280',
      description: 'Сохранить как изображение',
      execute: () => console.log('Экспорт PNG'),
    },
    {
      id: 'export-graphml',
      name: 'GraphML',
      icon: faCode,
      category: 'export',
      color: '#6B7280',
      description: 'Экспорт в формат GraphML',
      execute: () => console.log('Экспорт GraphML'),
    },
    {
      id: 'export-pdf',
      name: 'PDF',
      icon: faFile,
      category: 'export',
      color: '#EF4444',
      description: 'Экспорт в PDF',
      execute: () => console.log('Экспорт PDF'),
    },
    {
      id: 'export-csv',
      name: 'CSV',
      icon: faDatabase,
      category: 'export',
      color: '#F59E0B',
      description: 'Экспорт данных в CSV',
      execute: () => console.log('Экспорт CSV'),
    }
  ];

  // Плагины визуализации
  const visualizePlugins: Plugin[] = [
    {
      id: 'viz-layout',
      name: 'Изменить layout',
      icon: faProjectDiagram,
      category: 'visualize',
      color: '#8B5CF6',
      description: 'Изменить расположение узлов',
      execute: () => console.log('Change layout'),
    },
    {
      id: 'viz-theme',
      name: 'Тема',
      icon: faEye,
      category: 'visualize',
      color: '#EC4899',
      description: 'Сменить тему оформления',
      execute: () => console.log('Change theme'),
    },
    {
      id: 'viz-cluster',
      name: 'Кластеризация',
      icon: faFilter,
      category: 'visualize',
      color: '#14B8A6',
      description: 'Сгруппировать узлы',
      execute: () => console.log('Cluster'),
    }
  ];

  // Функция для группировки плагинов
  const getPluginCategories = (): PluginCategory[] => {
    return [
      {
        id: 'create',
        name: '📦 Создание',
        icon: faPlus,
        plugins: createPlugins,
        defaultCollapsed: false
      },
      {
        id: 'analyze',
        name: '🔍 Анализ',
        icon: faSearch,
        plugins: analyzePlugins,
        defaultCollapsed: false
      },
      {
        id: 'ai',
        name: '🤖 AI',
        icon: faRobot,
        plugins: aiPlugins,
        defaultCollapsed: true
      },
      {
        id: 'import',
        name: '📥 Импорт',
        icon: faDownload,
        plugins: importPlugins,
        defaultCollapsed: true
      },
      {
        id: 'export',
        name: '📤 Экспорт',
        icon: faUpload,
        plugins: exportPlugins,
        defaultCollapsed: true
      },
      {
        id: 'visualize',
        name: '🎨 Визуализация',
        icon: faEye,
        plugins: visualizePlugins,
        defaultCollapsed: true
      }
    ];
  };

  // Переключение сворачивания группы
  const toggleGroup = (groupId: string) => {
    setCollapsedGroups(prev => ({
      ...prev,
      [groupId]: !prev[groupId]
    }));
  };

  const handleProjectClick = (project: any) => {
    dispatch(setCurrentProject(project));
    dispatch(fetchGraphs(project.id));
  };

  const handleGraphClick = (graph: any) => {
    dispatch(setCurrentGraph(graph));
  };

  const handleCreateProject = async () => {
    const name = prompt('Введите название проекта:');
    if (name) {
      await dispatch(createProject(name));
      dispatch(fetchProjects());
    }
  };

  const handleCreateGraph = async () => {
    if (!currentProject) {
      alert('Сначала выберите проект');
      return;
    }
    const name = prompt('Введите название графа:');
    if (name) {
      await dispatch(createGraph({ projectId: currentProject.id, name }));
      dispatch(fetchGraphs(currentProject.id));
    }
  };

  if (!expanded) {
    return (
      <div style={styles.collapsed}>
        <button onClick={() => dispatch(toggleSidebar())} style={styles.toggleButton}>
          <FontAwesomeIcon icon={faChevronRight} />
        </button>
      </div>
    );
  }

  const pluginCategories = getPluginCategories();

  return (
    <div style={styles.container}>
      {/* Верхняя часть - Проекты */}
      <div style={styles.projectsSection}>
        <div 
          style={styles.groupHeader}
          onClick={() => toggleGroup('projects')}
        >
          <div style={styles.groupTitle}>
            <FontAwesomeIcon icon={faFolder} style={styles.groupIcon} />
            <span>Проекты</span>
          </div>
          <button style={styles.groupToggle}>
            <FontAwesomeIcon icon={collapsedGroups.projects ? faChevronRight : faChevronDown} />
          </button>
        </div>

        {!collapsedGroups.projects && (
          <>
            <button onClick={handleCreateProject} style={styles.createButton}>
              <FontAwesomeIcon icon={faPlus} />
              Новый проект
            </button>

            {isLoading ? (
              <div style={styles.loading}>
                <FontAwesomeIcon icon={faSpinner} spin style={styles.spinner} />
                <span>Загрузка...</span>
              </div>
            ) : (
              <div style={styles.projectList}>
                {projects.map((project) => (
                  <div key={project.id}>
                    <div
                      onClick={() => handleProjectClick(project)}
                      style={{
                        ...styles.projectItem,
                        ...(currentProject?.id === project.id ? styles.selectedProject : {}),
                      }}
                    >
                      <FontAwesomeIcon icon={faFolder} style={styles.projectIcon} />
                      {project.name}
                    </div>
                    
                    {currentProject?.id === project.id && (
                      <div style={styles.graphList}>
                        <button onClick={handleCreateGraph} style={styles.createGraphButton}>
                          <FontAwesomeIcon icon={faPlus} style={styles.smallIcon} />
                          Новый граф
                        </button>
                        {graphs[project.id]?.map((graph) => (
                          <div
                            key={graph.id}
                            onClick={() => handleGraphClick(graph)}
                            style={{
                              ...styles.graphItem,
                              ...(currentGraph?.id === graph.id ? styles.selectedGraph : {}),
                            }}
                          >
                            <FontAwesomeIcon icon={faProjectDiagram} style={styles.graphIcon} />
                            {graph.name}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </div>

      {/* Разделитель */}
      <div style={styles.divider} />

      {/* Нижняя часть - Панель плагинов */}
      <div style={styles.pluginsSection}>
        <div style={styles.pluginsHeader}>
          <FontAwesomeIcon icon={faPlug} style={styles.pluginsIcon} />
          <span style={styles.pluginsTitle}>Плагины</span>
        </div>

        {/* Динамическая генерация категорий плагинов */}
        {pluginCategories.map(category => (
          <div key={category.id} style={styles.pluginCategory}>
            <div 
              style={styles.categoryHeader}
              onClick={() => toggleGroup(category.id)}
            >
              <div style={styles.categoryTitle}>
                <FontAwesomeIcon icon={category.icon} style={styles.categoryIcon} />
                <span>{category.name}</span>
                <span style={styles.pluginCount}>{category.plugins.length}</span>
              </div>
              <button style={styles.categoryToggle}>
                <FontAwesomeIcon icon={collapsedGroups[category.id] ? faChevronRight : faChevronDown} />
              </button>
            </div>

            {!collapsedGroups[category.id] && (
              <div style={styles.pluginGrid}>
                {category.plugins.map(plugin => (
                  <button
                    key={plugin.id}
                    style={styles.pluginButton}
                    onClick={plugin.execute}
                    title={plugin.description}
                  >
                    <FontAwesomeIcon icon={plugin.icon} style={{ ...styles.pluginIcon, color: plugin.color }} />
                    <span style={styles.pluginName}>{plugin.name}</span>
                    {plugin.hotkey && <span style={styles.pluginHotkey}>{plugin.hotkey}</span>}
                  </button>
                ))}
              </div>
            )}
          </div>
        ))}

        {/* Настройки плагинов */}
        <div style={styles.pluginFooter}>
          <button style={styles.settingsButton}>
            <FontAwesomeIcon icon={faCog} />
            <span>Управление</span>
          </button>
        </div>
      </div>
    </div>
  );
};

const styles = {
  container: {
    width: '280px', // Уменьшил ширину
    height: '100%',
    backgroundColor: 'var(--bg-secondary)',
    borderRight: '1px solid var(--border-light)',
    display: 'flex',
    flexDirection: 'column' as const,
    boxShadow: 'var(--shadow-md)',
    overflow: 'hidden' as const,
  },
  collapsed: {
    width: '48px',
    height: '100%',
    backgroundColor: 'var(--bg-secondary)',
    borderRight: '1px solid var(--border-light)',
    display: 'flex',
    justifyContent: 'center',
    paddingTop: '12px',
  },
  toggleButton: {
    padding: '8px',
    border: 'none',
    backgroundColor: 'var(--bg-tertiary)',
    color: 'var(--text-secondary)',
    borderRadius: '6px',
    cursor: 'pointer',
    fontSize: '14px',
    transition: 'all var(--transition-fast)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    ':hover': {
      color: 'var(--text-primary)',
      backgroundColor: 'var(--border-light)',
    },
  },
  projectsSection: {
    flex: '0 0 auto',
    maxHeight: '35%',
    overflowY: 'auto' as const,
    padding: '0 6px',
  },
  pluginsSection: {
    flex: 1,
    overflowY: 'auto' as const,
    padding: '12px 8px',
    backgroundColor: 'var(--bg-tertiary)',
  },
  divider: {
    height: '3px',
    background: 'var(--gradient-primary)',
    opacity: 0.2,
  },
  groupHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '8px 6px',
    cursor: 'pointer',
    borderRadius: '4px',
    transition: 'all var(--transition-fast)',
    ':hover': {
      backgroundColor: 'var(--bg-tertiary)',
    },
  },
  groupTitle: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    color: 'var(--text-primary)',
    fontSize: '13px',
    fontWeight: 600,
  },
  groupIcon: {
    color: 'var(--accent-primary)',
    fontSize: '12px',
  },
  groupToggle: {
    padding: '2px',
    backgroundColor: 'transparent',
    border: 'none',
    color: 'var(--text-secondary)',
    cursor: 'pointer',
    fontSize: '11px',
    ':hover': {
      color: 'var(--text-primary)',
    },
  },
  createButton: {
    margin: '8px 6px',
    padding: '6px 12px',
    background: 'var(--gradient-primary)',
    color: 'white',
    border: 'none',
    borderRadius: '6px',
    cursor: 'pointer',
    fontSize: '13px',
    fontWeight: 500,
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    transition: 'all var(--transition-base)',
    boxShadow: 'var(--shadow-sm)',
    width: 'calc(100% - 12px)',
    ':hover': {
      transform: 'scale(1.02)',
      boxShadow: 'var(--shadow-glow)',
    },
  },
  projectList: {
    padding: '0 2px',
  },
  projectItem: {
    padding: '6px 8px',
    margin: '1px 0',
    borderRadius: '4px',
    cursor: 'pointer',
    fontSize: '12px',
    color: 'var(--text-secondary)',
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    transition: 'all var(--transition-fast)',
    ':hover': {
      backgroundColor: 'var(--bg-tertiary)',
      color: 'var(--text-primary)',
    },
  },
  projectIcon: {
    color: 'var(--accent-primary)',
    fontSize: '11px',
  },
  selectedProject: {
    backgroundColor: 'var(--bg-tertiary)',
    color: 'var(--text-primary)',
    borderLeft: '2px solid var(--accent-primary)',
  },
  graphList: {
    marginLeft: '16px',
    marginBottom: '2px',
  },
  graphItem: {
    padding: '4px 8px',
    margin: '1px 0',
    borderRadius: '4px',
    cursor: 'pointer',
    fontSize: '11px',
    color: 'var(--text-secondary)',
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    transition: 'all var(--transition-fast)',
    ':hover': {
      backgroundColor: 'var(--bg-tertiary)',
      color: 'var(--text-primary)',
    },
  },
  graphIcon: {
    color: 'var(--accent-success)',
    fontSize: '10px',
  },
  selectedGraph: {
    backgroundColor: 'var(--bg-tertiary)',
    color: 'var(--accent-success)',
    borderLeft: '2px solid var(--accent-success)',
  },
  createGraphButton: {
    margin: '2px 0',
    padding: '3px 6px',
    backgroundColor: 'transparent',
    border: '1px dashed var(--border-light)',
    color: 'var(--text-secondary)',
    borderRadius: '4px',
    cursor: 'pointer',
    fontSize: '10px',
    width: '100%',
    display: 'flex',
    alignItems: 'center',
    gap: '4px',
    transition: 'all var(--transition-fast)',
    ':hover': {
      borderColor: 'var(--accent-primary)',
      color: 'var(--accent-primary)',
      backgroundColor: 'var(--bg-tertiary)',
    },
  },
  loading: {
    padding: '12px',
    textAlign: 'center' as const,
    color: 'var(--text-secondary)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '6px',
    fontSize: '12px',
  },
  spinner: {
    color: 'var(--accent-primary)',
    fontSize: '12px',
  },
  pluginsHeader: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    marginBottom: '12px',
    padding: '6px',
    backgroundColor: 'var(--bg-secondary)',
    borderRadius: '6px',
  },
  pluginsIcon: {
    color: 'var(--accent-primary)',
    fontSize: '12px',
  },
  pluginsTitle: {
    color: 'var(--text-primary)',
    fontSize: '13px',
    fontWeight: 600,
  },
  pluginCategory: {
    marginBottom: '8px',
  },
  categoryHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '4px 6px',
    cursor: 'pointer',
    borderRadius: '4px',
    transition: 'all var(--transition-fast)',
    ':hover': {
      backgroundColor: 'var(--bg-secondary)',
    },
  },
  categoryTitle: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    color: 'var(--text-secondary)',
    fontSize: '11px',
    fontWeight: 600,
    textTransform: 'uppercase' as const,
    letterSpacing: '0.3px',
  },
  categoryIcon: {
    fontSize: '10px',
    color: 'var(--accent-primary)',
  },
  categoryToggle: {
    padding: '2px',
    backgroundColor: 'transparent',
    border: 'none',
    color: 'var(--text-secondary)',
    cursor: 'pointer',
    fontSize: '10px',
    ':hover': {
      color: 'var(--text-primary)',
    },
  },
  pluginCount: {
    marginLeft: '4px',
    color: 'var(--text-disabled)',
    fontSize: '9px',
    fontWeight: 'normal',
  },
  pluginGrid: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '2px',
    marginTop: '4px',
    marginLeft: '16px',
  },
  pluginButton: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    padding: '4px 8px',
    backgroundColor: 'var(--bg-secondary)',
    border: '1px solid var(--border-light)',
    borderRadius: '4px',
    color: 'var(--text-primary)',
    cursor: 'pointer',
    fontSize: '11px',
    transition: 'all var(--transition-fast)',
    width: '100%',
    textAlign: 'left' as const,
    ':hover': {
      backgroundColor: 'var(--bg-tertiary)',
      borderColor: 'var(--accent-primary)',
    },
  },
  pluginIcon: {
    fontSize: '11px',
  },
  pluginName: {
    flex: 1,
  },
  pluginHotkey: {
    color: 'var(--text-disabled)',
    fontSize: '9px',
    padding: '1px 3px',
    backgroundColor: 'var(--bg-tertiary)',
    borderRadius: '3px',
  },
  pluginFooter: {
    marginTop: '12px',
    paddingTop: '8px',
    borderTop: '1px solid var(--border-light)',
  },
  settingsButton: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    padding: '6px',
    backgroundColor: 'transparent',
    border: '1px solid var(--border-light)',
    borderRadius: '4px',
    color: 'var(--text-secondary)',
    cursor: 'pointer',
    fontSize: '11px',
    width: '100%',
    transition: 'all var(--transition-fast)',
    ':hover': {
      backgroundColor: 'var(--bg-secondary)',
      color: 'var(--text-primary)',
    },
  },
  smallIcon: {
    fontSize: '9px',
  },
} as const;
