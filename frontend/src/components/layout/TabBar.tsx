// frontend/src/components/layout/TabBar.tsx
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useAppDispatch } from '../../store';
import { fetchArtifacts, setCurrentArtifact } from '../../store/slices/artifactsSlice';
import { pluginApi } from '../../services/api';
import type { ApiArtifact, ApiPlugin } from '../../types/api';

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
  artifacts: Record<number, ApiArtifact>;
  projectId: number | null;
}

const labels = {
  selectResult: "\u0412\u044b\u0431\u0435\u0440\u0438\u0442\u0435 \u0440\u0435\u0437\u0443\u043b\u044c\u0442\u0430\u0442",
  cancel: "\u041e\u0442\u043c\u0435\u043d\u0430",
  plugins: "\u041f\u043b\u0430\u0433\u0438\u043d\u044b",
  projectNotSelected: "\u041f\u0440\u043e\u0435\u043a\u0442 \u043d\u0435 \u0432\u044b\u0431\u0440\u0430\u043d",
  loading: "\u0417\u0430\u0433\u0440\u0443\u0437\u043a\u0430...",
  noPlugins: "\u041d\u0435\u0442 \u0434\u043e\u0441\u0442\u0443\u043f\u043d\u044b\u0445 \u043f\u043b\u0430\u0433\u0438\u043d\u043e\u0432",
  running: "\u0417\u0430\u043f\u0443\u0441\u043a..."
};
const TabBar: React.FC<TabBarProps> = ({
  tabs,
  activeTabId,
  onTabClick,
  onTabClose,
  artifacts,
  projectId,
}) => {
  const dispatch = useAppDispatch();
  const [plugins, setPlugins] = useState<ApiPlugin[]>([]);
  const [pluginsLoading, setPluginsLoading] = useState(false);
  const [pluginsError, setPluginsError] = useState<string | null>(null);
  const [runningPluginId, setRunningPluginId] = useState<string | null>(null);
  const [contextMenu, setContextMenu] = useState<{ visible: boolean; x: number; y: number; artifactId: number | null }>(
    { visible: false, x: 0, y: 0, artifactId: null }
  );
  const [createdArtifacts, setCreatedArtifacts] = useState<ApiArtifact[] | null>(null);

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

  useEffect(() => {
    let isMounted = true;
    const loadPlugins = async () => {
      setPluginsLoading(true);
      setPluginsError(null);
      try {
        const response = await pluginApi.list();
        if (!isMounted) return;
        setPlugins(response?.plugins || []);
      } catch (error: any) {
        if (!isMounted) return;
        setPluginsError(error?.message || 'Failed to load plugins');
      } finally {
        if (isMounted) setPluginsLoading(false);
      }
    };

    loadPlugins();
    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    const handleClick = () => {
      if (contextMenu.visible) {
        setContextMenu({ visible: false, x: 0, y: 0, artifactId: null });
      }
    };
    window.addEventListener('click', handleClick);
    return () => window.removeEventListener('click', handleClick);
  }, [contextMenu.visible]);

  const contextArtifact = useMemo(() => {
    if (!contextMenu.artifactId) return null;
    return artifacts[contextMenu.artifactId] || null;
  }, [contextMenu.artifactId, artifacts]);

  const applicablePlugins = useMemo(() => {
    if (!contextArtifact) return [];
    return plugins.filter(p => !p.applicable_to?.length || p.applicable_to.includes(contextArtifact.type));
  }, [plugins, contextArtifact]);

  const handleRunPlugin = useCallback(async (plugin: ApiPlugin) => {
    if (!contextArtifact || !projectId) return;
    setRunningPluginId(plugin.id);
    setPluginsError(null);
    try {
      const response = await pluginApi.execute(plugin.id, projectId, [contextArtifact.id], {});
      await dispatch(fetchArtifacts(projectId));
      const created = response?.created || [];
      if (created.length === 1) {
        dispatch(setCurrentArtifact(created[0].id));
      } else if (created.length > 1) {
        setCreatedArtifacts(created);
      }
      setContextMenu({ visible: false, x: 0, y: 0, artifactId: null });
    } catch (error: any) {
      setPluginsError(error?.message || 'Failed to execute plugin');
    } finally {
      setRunningPluginId(null);
    }
  }, [contextArtifact, projectId, dispatch]);

  const handleContextMenu = useCallback((event: React.MouseEvent, artifactId: number) => {
    event.preventDefault();
    setContextMenu({ visible: true, x: event.clientX, y: event.clientY, artifactId });
  }, []);

  const handleSelectCreated = useCallback((artifactId: number) => {
    dispatch(setCurrentArtifact(artifactId));
    setCreatedArtifacts(null);
  }, [dispatch]);

  return (
    <div className="tab-bar">
      {createdArtifacts && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.45)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 10000
          }}
        >
          <div
            style={{
              background: '#1f2937',
              border: '1px solid #2f3b4a',
              borderRadius: 8,
              padding: 12,
              minWidth: 260,
              maxWidth: 320
            }}
          >
            <div style={{ fontSize: 13, color: '#e5e7eb', marginBottom: 8 }}>{labels.selectResult}</div>
            {createdArtifacts.map(item => (
              <button
                key={item.id}
                onClick={() => handleSelectCreated(item.id)}
                style={{
                  width: '100%',
                  textAlign: 'left',
                  background: '#111827',
                  border: '1px solid #2f3b4a',
                  color: '#e5e7eb',
                  padding: '6px 8px',
                  borderRadius: 6,
                  marginBottom: 6,
                  cursor: 'pointer'
                }}
              >
                {item.name}
              </button>
            ))}
            <button
              onClick={() => setCreatedArtifacts(null)}
              style={{
                width: '100%',
                background: 'transparent',
                border: 'none',
                color: '#9ca3af',
                padding: '6px 4px',
                cursor: 'pointer'
              }}
            >
              {labels.cancel}
            </button>
          </div>
        </div>
      )}

      {contextMenu.visible && (
        <div
          style={{
            position: 'fixed',
            top: contextMenu.y,
            left: contextMenu.x,
            background: '#1f2937',
            border: '1px solid #2f3b4a',
            borderRadius: 6,
            padding: 8,
            minWidth: 220,
            zIndex: 9999
          }}
        >
          <div style={{ fontSize: 12, color: '#9ca3af', marginBottom: 6 }}>{labels.plugins}</div>
          {!projectId && (
            <div style={{ fontSize: 12, color: '#f87171' }}>{labels.projectNotSelected}</div>
          )}
          {pluginsLoading && (
            <div style={{ fontSize: 12, color: '#9ca3af' }}>{labels.loading}</div>
          )}
          {pluginsError && (
            <div style={{ fontSize: 12, color: '#f87171' }}>{pluginsError}</div>
          )}
          {!pluginsLoading && !pluginsError && applicablePlugins.length === 0 && (
            <div style={{ fontSize: 12, color: '#9ca3af' }}>{labels.noPlugins}</div>
          )}
          {applicablePlugins.map(plugin => (
            <button
              key={plugin.id}
              onClick={() => handleRunPlugin(plugin)}
              disabled={!!runningPluginId || !projectId}
              style={{
                width: '100%',
                textAlign: 'left',
                background: 'transparent',
                border: 'none',
                color: '#e5e7eb',
                padding: '6px 4px',
                cursor: 'pointer'
              }}
            >
              {runningPluginId === plugin.id ? labels.running : plugin.name}
            </button>
          ))}
        </div>
      )}
      <div className="tabs-container">
        {tabs.map(tab => (
          <div
            key={tab.id}
            className={`tab ${activeTabId === tab.id ? 'active' : ''} ${getTabColor(tab.type)}`}
            onClick={() => onTabClick(tab.id)}
            onContextMenu={(event) => handleContextMenu(event, tab.artifactId)}
          >
            <span className="tab-title">{tab.title}</span>
            <button
              className="tab-close"
              onClick={(e) => {
                e.stopPropagation();
                onTabClose(tab.id);
              }}
              aria-label="Close tab"
              title="Close"
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





