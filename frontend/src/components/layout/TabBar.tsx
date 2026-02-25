// src/components/layout/TabBar.tsx
import React from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { 
  faProjectDiagram, 
  faMap, 
  faTable, 
  faFileAlt, 
  faChartBar 
} from '@fortawesome/free-solid-svg-icons';
import { useAppDispatch, useAppSelector } from '../../store';
import { setActiveView, ViewType } from '../../store/slices/uiSlice';

interface Tab {
  id: ViewType;
  label: string;
  icon: any;
}

const tabs: Tab[] = [
  { id: 'graph', label: 'Граф', icon: faProjectDiagram },
  { id: 'map', label: 'Карта', icon: faMap },
  { id: 'table', label: 'Таблица', icon: faTable },
  { id: 'text', label: 'Текст', icon: faFileAlt },
  { id: 'stats', label: 'Статистика', icon: faChartBar },
];

export const TabBar: React.FC = () => {
  const dispatch = useAppDispatch();
  const activeView = useAppSelector((state) => state.ui.activeView);

  return (
    <div style={styles.container}>
      {tabs.map((tab) => (
        <button
          key={tab.id}
          onClick={() => dispatch(setActiveView(tab.id))}
          style={{
            ...styles.tab,
            ...(activeView === tab.id ? styles.activeTab : {}),
          }}
          className={activeView === tab.id ? 'active-tab' : ''}
        >
          <FontAwesomeIcon icon={tab.icon} style={styles.icon} />
          <span style={styles.label}>{tab.label}</span>
          {activeView === tab.id && <div style={styles.activeIndicator} />}
        </button>
      ))}
    </div>
  );
};

const styles = {
  container: {
    display: 'flex',
    gap: '4px',
    padding: '8px 16px',
    backgroundColor: 'var(--bg-secondary)',
    borderBottom: '1px solid var(--border-light)',
  },
  tab: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    padding: '8px 16px',
    border: 'none',
    borderRadius: '8px',
    backgroundColor: 'transparent',
    cursor: 'pointer',
    fontSize: '14px',
    fontWeight: 500,
    color: 'var(--text-secondary)',
    transition: 'all var(--transition-base)',
    position: 'relative' as const,
  },
  activeTab: {
    color: 'var(--accent-primary)',
    fontWeight: 600,
  },
  icon: {
    fontSize: '18px',
  },
  label: {},
  activeIndicator: {
    position: 'absolute' as const,
    bottom: '-8px',
    left: 0,
    right: 0,
    height: '2px',
    background: 'var(--gradient-primary)',
    borderRadius: '2px',
  },
} as const;
