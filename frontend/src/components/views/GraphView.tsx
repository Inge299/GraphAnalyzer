// frontend/src/components/views/GraphView.tsx
import React, { useEffect, useRef, useState, useCallback } from 'react';
import { Network } from 'vis-network/standalone';
import { DataSet } from 'vis-data/standalone';
import type { ApiArtifact } from '../../types/api';
import 'vis-network/styles/vis-network.css';
import './GraphView.css';

interface GraphViewProps {
  artifact: ApiArtifact;
  onNodeMove: (nodeId: string, x: number, y: number, groupId?: string | null) => void;
  onNodesMove?: (moves: Array<{ nodeId: string; x: number; y: number }>, groupId?: string | null) => void;
  onUndo?: () => void;
  onRedo?: () => void;
  canUndo?: boolean;
  canRedo?: boolean;
  isRecording?: boolean;
  lastError?: Error | null;
}

interface PendingMove {
  nodeId: string;
  x: number;
  y: number;
}


const getNodeId = (node: any) => node.id || node.node_id;

const getNodeLabel = (node: any) => {
  const visual = node.attributes?.visual || {};
  const baseLabel = node.label || visual.label || node.attributes?.label || node.attributes?.name || node.attributes?.title || getNodeId(node) || '';
  const icon = visual.icon || node.attributes?.icon;
  if (icon && typeof icon === 'string') {
    return `${icon} ${baseLabel}`.trim();
  }
  return baseLabel;
};

const getNodeColors = (node: any) => {
  const visual = node.attributes?.visual || {};
  const color = visual.color || node.attributes?.color || (
    node.type === 'person' ? '#64b5f6' :
    node.type === 'company' ? '#81c784' :
    node.type === 'domain' ? '#ffb74d' : '#e0e0e0'
  );
  const border = visual.borderColor || node.attributes?.borderColor || color;
  return { background: color, border };
};

const getNodeFont = (node: any) => {
  const visual = node.attributes?.visual || {};
  return {
    size: visual.fontSize || node.attributes?.fontSize || 14,
    color: visual.fontColor || node.attributes?.fontColor || '#ffffff'
  };
};

const getNodeSize = (node: any) => {
  const visual = node.attributes?.visual || {};
  return visual.size || node.attributes?.size || 20;
};

export const GraphView: React.FC<GraphViewProps> = ({ 
  artifact, 
  onNodeMove,
  onNodesMove,
  onUndo,
  onRedo,
  canUndo = false,
  canRedo = false,
  isRecording = false,
  lastError = null
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const networkRef = useRef<Network | null>(null);
  const nodesDataSetRef = useRef<any>(null);
  const edgesDataSetRef = useRef<any>(null);
  
  const [pendingMoves, setPendingMoves] = useState<PendingMove[]>([]);
  const moveTimeoutRef = useRef<ReturnType<typeof setTimeout>>();
  const batchGroupIdRef = useRef<string | null>(null);
  const isInitializedRef = useRef(false);
  const isDraggingRef = useRef(false);
  const lastReduxStateRef = useRef<string>(JSON.stringify(artifact.data));
  const viewPositionRef = useRef<{ scale: number; position: { x: number; y: number } } | null>(null);
  const isFirstLoadRef = useRef(true);

  // Инициализация графа (только один раз)
  useEffect(() => {
    if (!containerRef.current || isInitializedRef.current) return;

    console.log('[GraphView] Initializing network (first time only)');
    
    const nodes = artifact.data?.nodes || [];
    const edges = artifact.data?.edges || [];

    // Создаем DataSet для узлов
    const nodesData = new DataSet(
      nodes.map((node: any) => ({
        id: getNodeId(node),
        label: getNodeLabel(node),
        title: `${node.type}\n${JSON.stringify(node.attributes || {}, null, 2)}`,
        x: node.position_x,
        y: node.position_y,
        color: getNodeColors(node),
        shape: (node.attributes?.visual?.shape || node.attributes?.shape || 'dot'),
        size: getNodeSize(node),
        font: getNodeFont(node),
        borderWidth: node.attributes?.visual?.borderWidth || node.attributes?.borderWidth || 2,
        shadow: true
      }))
    );

    // Создаем DataSet для связей
    const edgesData = new DataSet(
      edges.map((edge: any) => {
        const visual = edge.attributes?.visual || {};
        const edgeColor = visual.color || edge.attributes?.color || '#848484';
        const edgeLabel = edge.label || visual.label || edge.attributes?.label || edge.type;
        return {
          id: edge.id,
          from: edge.from || edge.source_node,
          to: edge.to || edge.target_node,
          label: edgeLabel,
          title: `${edge.type}\n${JSON.stringify(edge.attributes || {}, null, 2)}`,
          arrows: 'to',
          width: visual.width || edge.attributes?.width || 2,
          color: { color: edgeColor, highlight: '#2196f3' },
          smooth: { enabled: false, type: 'continuous' }
        };
      })
    );

    nodesDataSetRef.current = nodesData;
    edgesDataSetRef.current = edgesData;

    const options = {
      physics: { enabled: false, stabilization: false },
      nodes: {
        shape: 'dot',
        size: 20,
        font: { size: 14, color: '#ffffff' },
        borderWidth: 2,
        shadow: true
      },
      edges: {
        width: 2,
        smooth: { enabled: false, type: 'continuous' },
        font: { size: 12, color: '#ffffff', align: 'middle' },
        arrows: { to: { enabled: true, scaleFactor: 0.8 } }
      },
      interaction: {
        dragNodes: true,
        dragView: true,
        zoomView: true,
        hover: true,
        multiselect: true,
        navigationButtons: true,
        keyboard: false
      },
      manipulation: { enabled: false }
    };

    const network = new Network(
      containerRef.current,
      { nodes: nodesData, edges: edgesData },
      options
    );

    networkRef.current = network;

    // Генерация UUID для группировки
    const createBatchGroup = () => {
      return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
        const r = Math.random() * 16 | 0;
        const v = c === 'x' ? r : (r & 0x3 | 0x8);
        return v.toString(16);
      });
    };

    network.on('dragStart', (params) => {
      if (params.nodes && params.nodes.length > 0) {
        isDraggingRef.current = true;
        batchGroupIdRef.current = createBatchGroup();
        console.log(`[GraphView] Started drag batch for ${params.nodes.length} nodes`);
      }
    });

    network.on('dragEnd', (params) => {
      if (!params.nodes || params.nodes.length === 0) {
        isDraggingRef.current = false;
        return;
      }

      const moves: PendingMove[] = params.nodes.map((nodeId: string) => {
        const position = network.getPosition(nodeId);
        return { nodeId, x: Math.round(position.x), y: Math.round(position.y) };
      });

      setPendingMoves(prev => [...prev, ...moves]);

      if (moveTimeoutRef.current) {
        clearTimeout(moveTimeoutRef.current);
      }

      moveTimeoutRef.current = setTimeout(() => {
        const allMoves = [...pendingMoves, ...moves];
        
        console.log(`[GraphView] Drag ended, processing ${allMoves.length} moves`);
        
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
      }, 500);
    });

    // Подгоняем вид под граф только при первой загрузке
    network.once('afterDrawing', () => {
      if (isFirstLoadRef.current) {
        network.fit({ animation: true, duration: 300 });
        isFirstLoadRef.current = false;
      }
    });

    isInitializedRef.current = true;

    return () => {
      if (moveTimeoutRef.current) clearTimeout(moveTimeoutRef.current);
      network.destroy();
      isInitializedRef.current = false;
      isFirstLoadRef.current = true;
    };
  }, []); // Пустой массив - инициализация только один раз

  // Обновление данных при изменении artifact.data (без переинициализации)
  useEffect(() => {
    if (!networkRef.current || !nodesDataSetRef.current || isDraggingRef.current) return;

    const currentReduxState = JSON.stringify(artifact.data);
    if (currentReduxState === lastReduxStateRef.current) return;

    console.log('[GraphView] Updating data from Redux, version:', artifact.version);
    lastReduxStateRef.current = currentReduxState;

    // Сохраняем текущий вид перед обновлением
    const currentScale = networkRef.current.getScale();
    const currentPosition = networkRef.current.getViewPosition();

    // Обновляем узлы
    const nodesData = (artifact.data?.nodes || []).map((node: any) => ({
      id: node.id,
      label: node.label || node.id,
      x: node.position_x,
      y: node.position_y,
      color: node.type === 'person' ? '#64b5f6' : 
             node.type === 'company' ? '#81c784' : 
             node.type === 'domain' ? '#ffb74d' : '#e0e0e0'
    }));

    nodesDataSetRef.current.clear();
    if (nodesData.length > 0) {
      nodesDataSetRef.current.add(nodesData);
    }

    // Обновляем связи
    const edgesData = (artifact.data?.edges || []).map((edge: any) => ({
      id: edge.id,
      from: edge.from || edge.source_node,
      to: edge.to || edge.target_node,
      label: edge.type
    }));

    edgesDataSetRef.current?.clear();
    if (edgesData.length > 0) {
      edgesDataSetRef.current?.add(edgesData);
    }
    
    // Восстанавливаем вид после обновления (без анимации)
    networkRef.current.moveTo({
      position: currentPosition,
      scale: currentScale,
      animation: false
    });
  }, [artifact.data, artifact.version]);

  const handleUndoClick = useCallback(() => {
    console.log('[GraphView] Undo button clicked');
    onUndo?.();
  }, [onUndo]);

  const handleRedoClick = useCallback(() => {
    console.log('[GraphView] Redo button clicked');
    onRedo?.();
  }, [onRedo]);

  const handleHistoryJump = useCallback((state: any) => {
    console.log('[GraphView] History jump');
    // Здесь нужно вызвать обновление артефакта
    // onUndo/onRedo уже вызываются из HistoryPanel
  }, []);

  if (!artifact.data || (!artifact.data.nodes?.length && !artifact.data.edges?.length)) {
    return (
      <div className="graph-view" style={{ height: '100%', position: 'relative' }}>
        <div style={{ 
          position: 'absolute', 
          top: '50%', 
          left: '50%', 
          transform: 'translate(-50%, -50%)',
          textAlign: 'center',
          color: '#888'
        }}>
          <h3>Пустой граф</h3>
          <p>Нет узлов для отображения</p>
        </div>
      </div>
    );
  }

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
          title="Отменить (Ctrl+Z)"
          style={{
            padding: '6px 12px',
            background: '#3b82f6',
            border: 'none',
            borderRadius: '4px',
            color: 'white',
            cursor: canUndo ? 'pointer' : 'not-allowed',
            opacity: canUndo ? 1 : 0.5
          }}
        >
          ↩️ Undo
        </button>
        <button 
          onClick={handleRedoClick} 
          disabled={!canRedo}
          title="Повторить (Ctrl+Y)"
          style={{
            padding: '6px 12px',
            background: '#3b82f6',
            border: 'none',
            borderRadius: '4px',
            color: 'white',
            cursor: canRedo ? 'pointer' : 'not-allowed',
            opacity: canRedo ? 1 : 0.5
          }}
        >
          ↪️ Redo
        </button>
        <div style={{ fontSize: '12px', color: '#aaa', marginLeft: '8px', padding: '6px 0' }}>
          v{artifact.version}
        </div>
      </div>

      {/* Индикаторы */}
      <div style={{ 
        position: 'absolute', 
        top: 10, 
        right: 10, 
        zIndex: 10, 
        display: 'flex', 
        flexDirection: 'column', 
        gap: '5px' 
      }}>
        {isRecording && (
          <div style={{ background: '#f59e0b', color: 'white', padding: '4px 12px', borderRadius: '4px', fontSize: '12px' }}>
            ⏺ Recording...
          </div>
        )}
        {lastError && (
          <div style={{ background: '#ef4444', color: 'white', padding: '4px 12px', borderRadius: '4px', fontSize: '12px' }}>
            ❌ {lastError.message}
          </div>
        )}
        {pendingMoves.length > 0 && (
          <div style={{ background: '#3b82f6', color: 'white', padding: '4px 12px', borderRadius: '4px', fontSize: '12px' }}>
            📦 Grouping {new Set(pendingMoves.map(m => m.nodeId)).size} nodes...
          </div>
        )}
      </div>

      {/* Контейнер для графа */}
      <div ref={containerRef} style={{ width: '100%', height: '100%' }} />

      {/* Панель истории */}
      
    </div>
  );
};

export default GraphView;






