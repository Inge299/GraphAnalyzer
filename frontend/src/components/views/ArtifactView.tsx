// frontend/src/components/views/ArtifactView.tsx
import React, { Suspense, memo, useCallback, useEffect, useMemo, useState } from 'react';
import { useAppDispatch } from '../../store';
import { fetchArtifacts, setCurrentArtifact } from '../../store/slices/artifactsSlice';
import { pluginApi } from '../../services/api';
import type { ApiPlugin } from '../../types/api';
import type { ApiArtifact } from '../../types/api';
import { updateArtifact } from '../../store/slices/artifactsSlice';
import { useActionWithUndo } from '../../hooks/useActionWithUndo';
import { useKeyboardShortcuts } from '../../hooks/useKeyboardShortcuts';
import { setSelectedElement, setSelectedElements } from '../../store/slices/uiSlice';
import { GraphView } from './GraphView';

interface ArtifactViewProps {
  artifact: ApiArtifact;
  onClose: () => void;
  onUpdate: (updates: Partial<ApiArtifact>) => void;
}

const LoadingFallback = () => (
  <div className="flex items-center justify-center h-full">
    <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-500" />
  </div>
);

const PlaceholderView = ({ icon, text }: { icon: string; text: string }) => (
  <div className="flex items-center justify-center h-full text-gray-400">
    <div className="text-center">
      <div className="text-3xl mb-3">{icon}</div>
      <div className="text-sm opacity-75">{text}</div>
    </div>
  </div>
);

const ArtifactView: React.FC<ArtifactViewProps> = memo(({
  artifact,
  onClose,
  onUpdate,
}) => {
  const dispatch = useAppDispatch();
  const [plugins, setPlugins] = useState<ApiPlugin[]>([]);
  const [pluginsLoading, setPluginsLoading] = useState(false);
  const [pluginsError, setPluginsError] = useState<string | null>(null);
  const [runningPluginId, setRunningPluginId] = useState<string | null>(null);
  const [contextMenu, setContextMenu] = useState<{ visible: boolean; x: number; y: number }>(
    {
      visible: false,
      x: 0,
      y: 0
    }
  );

  const {
    execute,
    isRecording,
    lastError
  } = useActionWithUndo(
    artifact.id,
    artifact.data,
    async (newData: any) => {
      await onUpdate({ data: newData });
      await dispatch(updateArtifact({
        projectId: artifact.project_id,
        id: artifact.id,
        updates: { data: newData }
      }));
    }
  );

  useKeyboardShortcuts(artifact.id);
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
  }, [artifact.id]);

  useEffect(() => {
    const handleClick = () => {
      if (contextMenu.visible) {
        setContextMenu({ visible: false, x: 0, y: 0 });
      }
    };
    window.addEventListener('click', handleClick);
    return () => window.removeEventListener('click', handleClick);
  }, [contextMenu.visible]);

  const applicablePlugins = useMemo(() => {
    return plugins.filter(p => !p.applicable_to?.length || p.applicable_to.includes(artifact.type));
  }, [plugins, artifact.type]);

  const handleRunPlugin = useCallback(async (plugin: ApiPlugin) => {
    setRunningPluginId(plugin.id);
    setPluginsError(null);
    try {
      const response = await pluginApi.execute(plugin.id, artifact.project_id, [artifact.id], {});
      await dispatch(fetchArtifacts(artifact.project_id));
      const created = response?.created || [];
      if (created.length > 0) {
        dispatch(setCurrentArtifact(created[0].id));
      }
      setContextMenu({ visible: false, x: 0, y: 0 });
    } catch (error: any) {
      setPluginsError(error?.message || 'Failed to execute plugin');
    } finally {
      setRunningPluginId(null);
    }
  }, [artifact.id, artifact.project_id, dispatch]);

  const handleContextMenu = useCallback((event: React.MouseEvent) => {
    event.preventDefault();
    setContextMenu({ visible: true, x: event.clientX, y: event.clientY });
  }, []);

  console.log('[ArtifactView] Rendering', artifact.type, 'artifact:', artifact.id);

  const handleNodeMove = useCallback((nodeId: string, x: number, y: number) => {
    execute(
      async () => {
        const updatedNodes = artifact.data?.nodes?.map((node: any) => {
          if (node.id === nodeId || node.node_id === nodeId) {
            return {
              ...node,
              position_x: x,
              position_y: y
            };
          }
          return node;
        }) || [];

        return {
          ...artifact.data,
          nodes: updatedNodes
        };
      },
      {
        description: `\u041f\u0435\u0440\u0435\u043c\u0435\u0449\u0435\u043d\u0438\u0435 \u0443\u0437\u043b\u0430 ${nodeId}`
        actionType: 'move_node'
      }
    );
  }, [artifact.data, execute]);

  const handleAddNode = useCallback((position: { x: number, y: number }, nodeType: string = 'person') => {
    execute(
      async () => {
        const newNodeId = `node_${Date.now()}`;
        const newNode = {
          id: newNodeId,
          node_id: newNodeId,
          type: nodeType,
          label: `New ${nodeType}`,
          position_x: position.x,
          position_y: position.y,
          attributes: {
            name: `New ${nodeType}`,
            created: new Date().toISOString()
          }
        };

        const updatedNodes = [...(artifact.data?.nodes || []), newNode];

        return {
          ...artifact.data,
          nodes: updatedNodes
        };
      },
      {
        description: `\u0414\u043e\u0431\u0430\u0432\u043b\u0435\u043d\u0438\u0435 \u0443\u0437\u043b\u0430 ${nodeType}`
        actionType: 'add_node'
      }
    );
  }, [artifact.data, execute]);

  const handleDeleteNode = useCallback((nodeId: string) => {
    execute(
      async () => {
        const updatedNodes = artifact.data?.nodes?.filter((node: any) =>
          node.id !== nodeId && node.node_id !== nodeId
        ) || [];

        const updatedEdges = artifact.data?.edges?.filter((edge: any) =>
          edge.from !== nodeId &&
          edge.to !== nodeId &&
          edge.source_node !== nodeId &&
          edge.target_node !== nodeId
        ) || [];

        dispatch(setSelectedElement(null));
        dispatch(setSelectedElements([]));

        return {
          ...artifact.data,
          nodes: updatedNodes,
          edges: updatedEdges
        };
      },
      {
        description: `\u0423\u0434\u0430\u043b\u0435\u043d\u0438\u0435 \u0443\u0437\u043b\u0430 ${nodeId}`
        actionType: 'delete_node'
      }
    );
  }, [artifact.data, execute, dispatch]);

  return (
    <div className="artifact-view" onContextMenu={handleContextMenu}>
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
          <div style={{ fontSize: 12, color: '#9ca3af', marginBottom: 6 }}>Плагины</div>
          {pluginsLoading && (
            <div style={{ fontSize: 12, color: '#9ca3af' }}>Загрузка...</div>
          )}
          {pluginsError && (
            <div style={{ fontSize: 12, color: '#f87171' }}>{pluginsError}</div>
          )}
          {!pluginsLoading && !pluginsError && applicablePlugins.length === 0 && (
            <div style={{ fontSize: 12, color: '#9ca3af' }}>Нет доступных плагинов</div>
          )}
          {applicablePlugins.map(plugin => (
            <button
              key={plugin.id}
              onClick={() => handleRunPlugin(plugin)}
              disabled={!!runningPluginId}
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
              {runningPluginId === plugin.id ? 'Запуск...' : plugin.name}
            </button>
          ))}
        </div>
      )}

      <GraphView
        key={artifact.id}
        artifact={artifact}
        onNodeMove={handleNodeMove}
        onNodesMove={() => {}}
        onUndo={() => {}}
        onRedo={() => {}}
        canUndo={false}
        canRedo={false}
        isRecording={isRecording}
        lastError={lastError}
      />
    </div>
  );
});

export default ArtifactView;