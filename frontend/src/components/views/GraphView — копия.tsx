// frontend/src/components/views/GraphView.tsx
import React, { useEffect, useRef, useState, useCallback } from 'react';
import { useAppDispatch, useAppSelector } from '../../store';
import { updateArtifact } from '../../store/slices/artifactsSlice';
import { selectCanUndo, selectCanRedo } from '../../store/slices/historySlice';
import { useActionWithUndo } from '../../hooks/useActionWithUndo';
import { useKeyboardShortcuts } from '../../hooks/useKeyboardShortcuts';
import { HistoryPanel } from '../history/HistoryPanel';
import { Network } from 'vis-network/standalone';
import { DataSet } from 'vis-data/standalone';
import type { ApiArtifact } from '../../types/api';
import 'vis-network/styles/vis-network.css';
import './GraphView.css';

interface GraphViewProps {
  artifact: ApiArtifact;
  onNodeMove: (nodeId: string, x: number, y: number, groupId?: string | null) => void;
  onNodesMove?: (moves: Array<{ nodeId: string; x: number; y: number }>, groupId?: string | null) => void;
  onAddNode?: (position: { x: number, y: number }, nodeType?: string) => void;
  onDeleteNode?: (nodeId: string) => void;
  onAddEdge?: (sourceId: string, targetId: string, edgeType?: string) => void;
  onDeleteEdge?: (edgeId: string) => void;
  onEditAttributes?: (nodeId: string, attributes: Record<string, any>) => void;
}

interface PendingMove {
  nodeId: string;
  x: number;
  y: number;
}

export const GraphView: React.FC<GraphViewProps> = ({ 
  artifact, 
  onNodeMove,
  onNodesMove,
  onAddNode: _onAddNode,
  onDeleteNode: _onDeleteNode,
  onAddEdge: _onAddEdge,
  onDeleteEdge: _onDeleteEdge,
  onEditAttributes: _onEditAttributes
}) => {
  const dispatch = useAppDispatch();
  const containerRef = useRef<HTMLDivElement>(null);
  const networkRef = useRef<Network | null>(null);
  const nodesDataSetRef = useRef<any>(null);
  const edgesDataSetRef = useRef<any>(null);
  
  const [pendingMoves, setPendingMoves] = useState<PendingMove[]>([]);
  const moveTimeoutRef = useRef<ReturnType<typeof setTimeout>>();
  const batchGroupIdRef = useRef<string | null>(null);
  const isInitializedRef = useRef(false);
  const isDraggingRef = useRef(false);
  const draggedNodesRef = useRef<string[]>([]);
  const lastReduxStateRef = useRef<string>(JSON.stringify(artifact.data));
  const viewPositionRef = useRef<{ scale: number; position: { x: number; y: number } } | null>(null);

  // --- Селекторы для истории ---
  const canUndo = useAppSelector(selectCanUndo);
  const canRedo = useAppSelector(selectCanRedo);

  const handleStateChange = useCallback(async (newData: any) => {
    await dispatch(updateArtifact({
      projectId: artifact.project_id,
      id: artifact.id,
      updates: { data: newData }
    })).unwrap();
  }, [dispatch, artifact.project_id, artifact.id]);

  // --- Хук для UNDO/REDO ---
  const {
    execute,
    isRecording,
    lastError,
    createBatchGroup,
    undo: undoAction,
    redo: redoAction
  } = useActionWithUndo(
    artifact.id,
    artifact.data,
    handleStateChange
  );

  // --- Клавиатурные сокращения ---
  useKeyboardShortcuts(artifact.id);

  // Функция для перехода по истории с сохранением масштаба
  const handleHistoryJump = useCallback(async (state: any) => {
    if (networkRef.current) {
      viewPositionRef.current = {
        scale: networkRef.current.getScale(),
        position: networkRef.current.getViewPosition()
      };
    }
    await handleStateChange(state);
  }, [handleStateChange]);

  // Эффект для восстановления масштаба после обновления данных
  useEffect(() => {
    if (networkRef.current && viewPositionRef.current) {
      networkRef.current.moveTo({
        position: viewPositionRef.current.position,
        scale: viewPositionRef.current.scale
      });
      viewPositionRef.current = null;
    }
  }, [artifact.data]);

  useEffect(() => {
    if (!containerRef.current || isInitializedRef.current) return;

    console.log('[GraphView] Initializing with data:', artifact.data);
    isInitializedRef.current = true;

    // Создаем DataSet с приведением типов через any
    const nodes = new DataSet(
      (artifact.data?.nodes || []).map((node: any) => ({
        ...node,
        id: node.id,
        label: node.label || node.id,
        title: `${node.type}\n${JSON.stringify(node, null, 2)}`,
        x: node.position_x,
        y: node.position_y,
      }))
    ) as any;

    const edges = new DataSet(
      (artifact.data?.edges || []).map((edge: any) => ({
        ...edge,
        id: edge.id,
        from: edge.from || edge.source_node,
        to: edge.to || edge.target_node,
        label: edge.type,
        title: `${edge.type}\n${JSON.stringify(edge, null, 2)}`,
        arrows: 'to',
      }))
    ) as any;

    nodesDataSetRef.current = nodes;
    edgesDataSetRef.current = edges;

    const options = {
      physics: { enabled: false, stabilization: false },
      layout: { randomSeed: 42, improvedLayout: false },
      nodes: {
        shape: 'dot',
        size: 20,
        font: { size: 14, color: '#ffffff' },
        borderWidth: 2,
        shadow: true,
        fixed: false
      },
      edges: {
        width: 2,
        smooth: {
          enabled: true,
          type: 'continuous',
          roundness: 0.5
        },
        font: { 
          size: 12, 
          color: '#ffffff', 
          align: 'middle' 
        },
        arrows: { 
          to: { 
            enabled: true, 
            scaleFactor: 0.8 
          } 
        },
        color: { 
          color: '#848484', 
          highlight: '#2196f3', 
          hover: '#2196f3' 
        }
      },
      interaction: {
        dragNodes: true,
        dragView: true,
        zoomView: true,
        hover: true,
        tooltipDelay: 300,
        multiselect: true,
        navigationButtons: true,
        keyboard: false
      },
      manipulation: { enabled: false }
    };

    const network = new Network(
      containerRef.current,
      { nodes, edges },
      options
    );

    networkRef.current = network;

    // Обработчик начала перетаскивания
    network.on('dragStart', (params) => {
      if (params.nodes && params.nodes.length > 0) {
        draggedNodesRef.current = params.nodes;
        isDraggingRef.current = true;
        batchGroupIdRef.current = createBatchGroup();
        console.log(`[GraphView] Started drag batch for ${params.nodes.length} nodes:`, batchGroupIdRef.current);
      }
    });

    // Обработчик окончания перетаскивания
    network.on('dragEnd', (params) => {
      if (!params.nodes || params.nodes.length === 0) {
        isDraggingRef.current = false;
        draggedNodesRef.current = [];
        return;
      }

      // Собираем позиции всех перемещаемых узлов
      const moves: PendingMove[] = params.nodes.map((nodeId: string) => {
        const position = network.getPosition(nodeId);
        return { nodeId, x: position.x, y: position.y };
      });

      setPendingMoves(prev => [...prev, ...moves]);

      if (moveTimeoutRef.current) {
        clearTimeout(moveTimeoutRef.current);
      }

      moveTimeoutRef.current = setTimeout(() => {
        const allMoves = [...pendingMoves, ...moves];
        
        console.log(`[GraphView] Applying batch of ${allMoves.length} moves for ${new Set(allMoves.map(m => m.nodeId)).size} unique nodes`);

        if (onNodesMove && allMoves.length > 1) {
          onNodesMove(allMoves, batchGroupIdRef.current);
        } else {
          allMoves.forEach(({ nodeId, x, y }) => {
            onNodeMove(nodeId, x, y, batchGroupIdRef.current);
          });
        }

        setPendingMoves([]);
        batchGroupIdRef.current = null;
        isDraggingRef.current = false;
        draggedNodesRef.current = [];
        
        console.log('[GraphView] Batch moves applied');
      }, 500);
    });

    return () => {
      if (moveTimeoutRef.current) clearTimeout(moveTimeoutRef.current);
      network.destroy();
      isInitializedRef.current = false;
    };
  }, [artifact.data, onNodeMove, onNodesMove, createBatchGroup]); // Убрал pendingMoves из зависимостей

  // Эффект для обновления DataSet при изменении данных
  useEffect(() => {
    if (!networkRef.current || !nodesDataSetRef.current || isDraggingRef.current) return;

    const currentReduxState = JSON.stringify(artifact.data);
    if (currentReduxState === lastReduxStateRef.current) return;

    lastReduxStateRef.current = currentReduxState;

    const nodesData = (artifact.data?.nodes || []).map((node: any) => ({
      ...node,
      id: node.id,
      label: node.label || node.id,
      x: node.position_x,
      y: node.position_y,
    }));

    nodesDataSetRef.current.clear();
    if (nodesData.length > 0) {
      nodesDataSetRef.current.add(nodesData);
    }

    const edgesData = (artifact.data?.edges || []).map((edge: any) => ({
      ...edge,
      id: edge.id,
      from: edge.from || edge.source_node,
      to: edge.to || edge.target_node,
      label: edge.type,
    }));

    edgesDataSetRef.current?.clear();
    if (edgesData.length > 0) {
      edgesDataSetRef.current?.add(edgesData);
    }
  }, [artifact.data]);

  // --- Обработчики для кнопок ---
  const handleUndoClick = useCallback(() => {
    undoAction();
  }, [undoAction]);

  const handleRedoClick = useCallback(() => {
    redoAction();
  }, [redoAction]);

  return (
    <div className="graph-view" style={{ height: '100%', position: 'relative' }}>
      {/* Тулбар */}
      <div style={{ 
        position: 'absolute', 
        top: 10, 
        left: 10, 
        zIndex: 10, 
        display: 'flex', 
        gap: '8px',
        background: 'rgba(45, 45, 45, 0.9)',
        padding: '8px 12px',
        borderRadius: '6px',
        backdropFilter: 'blur(4px)'
      }}>
        <button 
          onClick={handleUndoClick} 
          disabled={!canUndo}
          style={{
            padding: '6px 12px',
            background: !canUndo ? '#444' : '#2196f3',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: !canUndo ? 'not-allowed' : 'pointer',
            opacity: !canUndo ? 0.5 : 1
          }}
          title="Undo (Ctrl+Z)"
        >
          ↩️ Undo
        </button>
        <button 
          onClick={handleRedoClick} 
          disabled={!canRedo}
          style={{
            padding: '6px 12px',
            background: !canRedo ? '#444' : '#2196f3',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: !canRedo ? 'not-allowed' : 'pointer',
            opacity: !canRedo ? 0.5 : 1
          }}
          title="Redo (Ctrl+Y)"
        >
          ↪️ Redo
        </button>
      </div>

      {/* Индикаторы состояния */}
      <div style={{ 
        position: 'absolute', 
        top: 10, 
        right: 10, 
        zIndex: 10, 
        display: 'flex', 
        flexDirection: 'column', 
        gap: '5px', 
        alignItems: 'flex-end' 
      }}>
        {isRecording && (
          <div style={{ 
            background: '#f59e0b', 
            color: 'white', 
            padding: '4px 12px', 
            borderRadius: '4px', 
            fontSize: '12px',
            boxShadow: '0 2px 8px rgba(0,0,0,0.2)'
          }}>
            ⏺ Recording...
          </div>
        )}
        {lastError && (
          <div style={{ 
            background: '#ef4444', 
            color: 'white', 
            padding: '4px 12px', 
            borderRadius: '4px', 
            fontSize: '12px',
            boxShadow: '0 2px 8px rgba(0,0,0,0.2)'
          }}>
            ❌ {lastError.message}
          </div>
        )}
        {pendingMoves.length > 0 && (
          <div style={{ 
            background: '#3b82f6', 
            color: 'white', 
            padding: '4px 12px', 
            borderRadius: '4px', 
            fontSize: '12px',
            boxShadow: '0 2px 8px rgba(0,0,0,0.2)'
          }}>
            📦 Grouping {new Set(pendingMoves.map(m => m.nodeId)).size} nodes...
          </div>
        )}
      </div>

      {/* Контейнер для графа */}
      <div 
        ref={containerRef} 
        style={{ width: '100%', height: '100%' }}
      />

      {/* Панель истории */}
      <HistoryPanel
        artifactId={artifact.id}
        onJump={handleHistoryJump}
        onUndo={handleUndoClick}
        onRedo={handleRedoClick}
      />
    </div>
  );
};

export default GraphView;