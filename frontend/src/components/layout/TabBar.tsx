import React from 'react';

interface Tab {
  id: string;
  artifactId: number;
  title: string;
  type: string;
}

interface TabBarProps {
  tabs: Tab[];
  activeTabId: string | null;
  onTabClick: (tabId: string) => void;
  onTabClose: (tabId: string) => void;
  artifacts?: Record<number, unknown>;
  projectId?: number | null;
}

const labels = {
  appName: 'Nodex',
};

const TabBar: React.FC<TabBarProps> = ({
  tabs,
  activeTabId,
  onTabClick,
  onTabClose,
}) => {
  const getTabColor = (type: string): string => {
    switch (type) {
      case 'graph':
        return 'border-blue-500 text-blue-400';
      case 'table':
        return 'border-green-500 text-green-400';
      case 'map':
        return 'border-purple-500 text-purple-400';
      case 'chart':
        return 'border-yellow-500 text-yellow-400';
      case 'document':
        return 'border-red-500 text-red-400';
      default:
        return 'border-gray-500 text-gray-400';
    }
  };

  return (
    <div className="tab-bar">
      <div className="tab-brand" title={labels.appName}>
        <img className="tab-brand-logo" src="/brand/nodex-logo.png" alt={labels.appName} />
        <span className="tab-brand-name">{labels.appName}</span>
      </div>
      <div className="tabs-container">
        {tabs.map((tab) => (
          <div
            key={tab.id}
            className={`tab ${activeTabId === tab.id ? 'active' : ''} ${getTabColor(tab.type)}`}
            onClick={() => onTabClick(tab.id)}
          >
            <span className="tab-title">{tab.title}</span>
            <button
              className="tab-close"
              onClick={(event) => {
                event.stopPropagation();
                onTabClose(tab.id);
              }}
              aria-label="Закрыть вкладку"
              title="Закрыть"
            >
              <svg viewBox="0 0 16 16" aria-hidden="true" focusable="false">
                <path
                  d="M3.7 3.7a1 1 0 0 1 1.4 0L8 6.6l2.9-2.9a1 1 0 1 1 1.4 1.4L9.4 8l2.9 2.9a1 1 0 0 1-1.4 1.4L8 9.4l-2.9 2.9a1 1 0 0 1-1.4-1.4L6.6 8 3.7 5.1a1 1 0 0 1 0-1.4z"
                  fill="currentColor"
                />
              </svg>
            </button>
          </div>
        ))}
      </div>
    </div>
  );
};

export default TabBar;
