// frontend/src/components/views/ArtifactView.tsx
import React, { Suspense, memo, useCallback } from 'react';
import { useAppDispatch } from '../../store';
import type { ApiArtifact } from '../../types/api';  // Импортируем тип, а не компонент
import { updateArtifact } from '../../store/slices/artifactsSlice';
import { useActionWithUndo } from '../../hooks/useActionWithUndo';
import { useKeyboardShortcuts } from '../../hooks/useKeyboardShortcuts';
import { setSelectedElement, setSelectedElements } from '../../store/slices/uiSlice';

// Импортируем GraphView напрямую (убираем lazy)
import { GraphView } from './GraphView';  

interface ArtifactViewProps {
  artifact: ApiArtifact;  // Используем правильный тип
  onClose: () => void;
  onUpdate: (updates: Partial<ApiArtifact>) => void;  // Исправлен тип
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
  
  // Инициализация хука для undo/redo - передаем ВСЕ 3 аргумента
  const { 
    execute, 
    isRecording,
    lastError
  } = useActionWithUndo(
    artifact.id,
    artifact.data,
    async (newData: any) => {
      // Функция обновления состояния
      await onUpdate({ data: newData });
      await dispatch(updateArtifact({
        projectId: artifact.project_id,
        id: artifact.id,  // было artifactId, исправлено на id
        updates: { data: newData }
      }));
    }
  );
  
  useKeyboardShortcuts(artifact.id);

  console.log('[ArtifactView] Rendering', artifact.type, 'artifact:', artifact.id);

  // Обработчик перемещения узла с поддержкой undo/redo
  const handleNodeMove = useCallback((nodeId: string, x: number, y: number) => {
    execute(
      async () => {
        // Обновляем позицию узла в данных артефакта
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
        description: `Перемещение узла ${nodeId}`,
        actionType: 'move_node'
      }
    );
  }, [artifact.data, execute]);

  // Обработчик добавления узла
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
        description: `Добавление узла ${nodeType}`,
        actionType: 'add_node'
      }
    );
  }, [artifact.data, execute]);

  // Обработчик удаления узла
  const handleDeleteNode = useCallback((nodeId: string) => {
    execute(
      async () => {
        const updatedNodes = artifact.data?.nodes?.filter((node: any) => 
          node.id !== nodeId && node.node_id !== nodeId
        ) || [];

        // Также удаляем связанные ребра
        const updatedEdges = artifact.data?.edges?.filter((edge: any) => 
          edge.from !== nodeId && 
          edge.to !== nodeId && 
          edge.source_node !== nodeId && 
          edge.target_node !== nodeId
        ) || [];

        // Сбрасываем выделение
        dispatch(setSelectedElement(null));
        dispatch(setSelectedElements([]));

        return {
          ...artifact.data,
          nodes: updatedNodes,
          edges: updatedEdges
        };
      },
      {
        description: `Удаление узла ${nodeId}`,
        actionType: 'delete_node'
      }
    );
  }, [artifact.data, execute, dispatch]);

  // Обработчик добавления ребра
  const handleAddEdge = useCallback((sourceId: string, targetId: string, edgeType: string = 'connects') => {
    execute(
      async () => {
        const newEdgeId = `edge_${Date.now()}`;
        const newEdge = {
          id: newEdgeId,
          edge_id: newEdgeId,
          from: sourceId,
          to: targetId,
          source_node: sourceId,
          target_node: targetId,
          type: edgeType,
          label: edgeType
        };

        const updatedEdges = [...(artifact.data?.edges || []), newEdge];
        
        return {
          ...artifact.data,
          edges: updatedEdges
        };
      },
      {
        description: `Добавление связи ${sourceId} → ${targetId}`,
        actionType: 'add_edge'
      }
    );
  }, [artifact.data, execute]);

  // Обработчик удаления ребра
  const handleDeleteEdge = useCallback((edgeId: string) => {
    execute(
      async () => {
        const updatedEdges = artifact.data?.edges?.filter((edge: any) => 
          edge.id !== edgeId && edge.edge_id !== edgeId
        ) || [];

        // Сбрасываем выделение
        dispatch(setSelectedElement(null));
        dispatch(setSelectedElements([]));

        return {
          ...artifact.data,
          edges: updatedEdges
        };
      },
      {
        description: `Удаление связи ${edgeId}`,
        actionType: 'delete_edge'
      }
    );
  }, [artifact.data, execute, dispatch]);

  // Обработчик редактирования атрибутов
  const handleEditAttributes = useCallback((nodeId: string, attributes: Record<string, any>) => {
    execute(
      async () => {
        const updatedNodes = artifact.data?.nodes?.map((node: any) => {
          if (node.id === nodeId || node.node_id === nodeId) {
            return {
              ...node,
              attributes: {
                ...(node.attributes || {}),
                ...attributes
              }
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
        description: `Редактирование атрибутов узла ${nodeId}`,
        actionType: 'edit_attribute'
      }
    );
  }, [artifact.data, execute]);

  const renderView = () => {
    switch (artifact.type) {
      case 'graph':
        return (
          <Suspense fallback={<LoadingFallback />}>
            <GraphView
              artifact={artifact}
              onNodeMove={handleNodeMove}
              onAddNode={handleAddNode}
              onDeleteNode={handleDeleteNode}
              onAddEdge={handleAddEdge}
              onDeleteEdge={handleDeleteEdge}
              onEditAttributes={handleEditAttributes}
            />
          </Suspense>
        );
      case 'table':
        return <PlaceholderView icon="📋" text="Таблицы будут в Этапе 2.5" />;
      case 'map':
        return <PlaceholderView icon="🗺️" text="Карты будут в Этапе 2.5" />;
      case 'chart':
        return <PlaceholderView icon="📈" text="Диаграммы будут в Этапе 2.5" />;
      case 'document':
        return <PlaceholderView icon="📄" text="Документы будут в Этапе 2.5" />;
      default:
        return <PlaceholderView icon="❓" text="Неизвестный тип артефакта" />;
    }
  };

  return (
    <div className="artifact-view" style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      {/* Компактный заголовок */}
      <div style={{
        padding: '8px 12px',
        borderBottom: '1px solid #374151',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        backgroundColor: '#1f2937',
        flexShrink: 0
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ fontSize: '16px' }}>
            {artifact.type === 'graph' && '📊'}
            {artifact.type === 'table' && '📋'}
            {artifact.type === 'map' && '🗺️'}
            {artifact.type === 'chart' && '📈'}
            {artifact.type === 'document' && '📄'}
          </span>
          <span style={{ color: '#ffffff', fontSize: '13px', fontWeight: 500 }}>
            {artifact.name}
          </span>
          <span style={{ color: '#6b7280', fontSize: '11px' }}>
            v{artifact.version}
          </span>
          {isRecording && (
            <span style={{ color: '#f59e0b', fontSize: '11px', marginLeft: '8px' }}>
              ⟳ запись...
            </span>
          )}
          {lastError && (
            <span style={{ color: '#ef4444', fontSize: '11px', marginLeft: '8px' }}>
              ⚠️ ошибка
            </span>
          )}
        </div>
        <button
          onClick={onClose}
          style={{
            background: 'none',
            border: 'none',
            color: '#9ca3af',
            cursor: 'pointer',
            fontSize: '16px',
            padding: '4px'
          }}
          title="Закрыть"
        >
          ✕
        </button>
      </div>
      
      <div style={{ flex: 1, overflow: 'hidden' }}>
        {renderView()}
      </div>
    </div>
  );
});

export default ArtifactView;