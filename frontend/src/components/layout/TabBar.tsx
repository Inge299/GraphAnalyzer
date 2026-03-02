// frontend/src/components/layout/TabBar.tsx
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
}

const TabBar: React.FC<TabBarProps> = ({
  tabs,
  activeTabId,
  onTabClick,
  onTabClose,
}) => {
  const getTabColor = (type: string): string => {
    switch (type) {
      case 'graph': return 'border-blue-500 text-blue-400';
      case 'table': return 'border-green-500 text-green-400';
      case 'map': return 'border-purple-500 text-purple-400';
      case 'chart': return 'border-yellow-500 text-yellow-400';
      case 'document': return 'border-red-500 text-red-400';
      default: return 'border-gray-500 text-gray-400';
    }
  };

  return (
    <div className="tab-bar">
      <div className="tabs-container">
        {tabs.map(tab => (
          <div
            key={tab.id}
            className={`tab ${activeTabId === tab.id ? 'active' : ''} ${getTabColor(tab.type)}`}
            onClick={() => onTabClick(tab.id)}
          >
            <span className="tab-title">{tab.title}</span>
            <button
              className="tab-close"
              onClick={(e) => {
                e.stopPropagation();
                onTabClose(tab.id);
              }}
            >
              ×
            </button>
          </div>
        ))}
      </div>
      
      {/* Add tab button */}
      <button className="add-tab" title="New artifact">
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
        </svg>
      </button>
    </div>
  );
};

export default TabBar;