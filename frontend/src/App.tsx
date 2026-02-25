// src/App.tsx
import React from 'react';
import { Provider } from 'react-redux';
import { store } from './store';
import { useAppSelector } from './store';
import { TabBar } from './components/layout/TabBar';
import { Sidebar } from './components/layout/Sidebar';
import { InspectorPanel } from './components/layout/InspectorPanel';
import { GraphView } from './components/views/GraphView';
import './App.css';

function AppContent() {
  const activeView = useAppSelector((state) => state.ui.activeView);

  const renderActiveView = () => {
    switch (activeView) {
      case 'graph':
        return <GraphView />;
      case 'map':
        return <div style={styles.placeholder}>Карта (в разработке)</div>;
      case 'table':
        return <div style={styles.placeholder}>Таблица (в разработке)</div>;
      case 'text':
        return <div style={styles.placeholder}>Текст (в разработке)</div>;
      case 'stats':
        return <div style={styles.placeholder}>Статистика (в разработке)</div>;
      default:
        return <GraphView />;
    }
  };

  return (
    <div style={styles.app}>
      <div style={styles.main}>
        <Sidebar />
        <div style={styles.content}>
          <TabBar />
          <div style={styles.viewContainer}>
            {renderActiveView()}
          </div>
        </div>
        <InspectorPanel />
      </div>
    </div>
  );
}

function App() {
  return (
    <Provider store={store}>
      <AppContent />
    </Provider>
  );
}

const styles = {
  app: {
    width: '100vw',
    height: '100vh',
    overflow: 'hidden' as const,
    backgroundColor: 'var(--bg-primary)',
  },
  main: {
    display: 'flex',
    width: '100%',
    height: '100%',
  },
  content: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column' as const,
    overflow: 'hidden' as const,
  },
  viewContainer: {
    flex: 1,
    overflow: 'hidden' as const,
    position: 'relative' as const,
  },
  placeholder: {
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    height: '100%',
    fontSize: '18px',
    color: 'var(--text-disabled)',
    backgroundColor: 'var(--bg-primary)',
  },
} as const;

export default App;
