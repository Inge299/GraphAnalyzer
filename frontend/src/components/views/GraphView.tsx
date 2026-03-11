// frontend/src/components/views/GraphView.tsx
import React, { useEffect, useRef, useCallback, memo, useState } from 'react';
import { Network } from 'vis-network/standalone';
import { DataSet } from 'vis-data/standalone';
import { useDispatch } from 'react-redux';
import { Artifact } from '../../store/slices/artifactsSlice';
import { setSelectedElement, setSelectedElements } from '../../store/slices/uiSlice';
import { useActionWithUndo } from '../../hooks/useActionWithUndo';
import { useKeyboardShortcuts } from '../../hooks/useKeyboardShortcuts';
import { HistoryPanel } from '../history/HistoryPanel';
import { setGraphData } from '../../store/slices/graphSlice';

interface GraphViewProps {
  artifact: Artifact;
  onNodeMove?: (nodeId: string, x: number, y: number) => void;
}

const GraphView: React.FC<GraphViewProps> = memo(({ artifact, onNodeMove }) => {
  const dispatch = useDispatch();
  const networkRef = useRef<HTMLDivElement>(null);
  const networkInstanceRef = useRef<Network | null>(null);
  const nodesRef = useRef<DataSet<any> | null>(null);
  const isInitializedRef = useRef<boolean>(false);
  const shiftKeyRef = useRef<boolean>(false);
  
  // Хуки для undo/redo
  const { executeAction } = useActionWithUndo(artifact.id);
  useKeyboardShortcuts(artifact.id);
  
  // Состояние для группировки перемещений
  const [pendingMoves, setPendingMoves] = useState<Record<string, {x: number, y: number}>>({});
  const moveTimeoutRef = useRef<NodeJS.Timeout>();
  
  const fitToScreen = useCallback(() => {
    if (networkInstanceRef.current) {
      networkInstanceRef.current.fit({ animation: true, duration: 1000 });
    }
  }, []);

  const zoomIn = useCallback(() => {
    if (networkInstanceRef.current) {
      const scale = networkInstanceRef.current.getScale();
      networkInstanceRef.current.moveTo({ scale: scale * 1.2, animation: true });
    }
  }, []);

  const zoomOut = useCallback(() => {
    if (networkInstanceRef.current) {
      const scale = networkInstanceRef.current.getScale();
      networkInstanceRef.current.moveTo({ scale: scale * 0.8, animation: true });
    }
  }, []);

  // Функция для получения цвета узла по типу
  const getNodeColor = (type: string = 'default'): string => {
    const colors: Record<string, string> = {
      person: '#97c2fc',      // синий
      phone: '#7be141',       // зеленый
      message: '#ffb752',     // оранжевый
      location: '#ff7b7b',    // красный
      organization: '#d9b4ff', // фиолетовый
      device: '#ffb3ba',      // розовый
      email: '#b0e57c',       // светло-зеленый
      social: '#f7cac9',      // персиковый
      document: '#c0c0c0',    // серебряный
      default: '#cccccc'      // серый по умолчанию
    };
    return colors[type] || colors.default;
  };

  const getEdgeColor = (type: string = 'default'): string => {
    const colors: Record<string, string> = {
      follows: '#3B82F6',
      subscribed: '#10B981',
      default: '#6B7280'
    };
    return colors[type] || colors.default;
  };

  // Функция для получения текущего состояния графа
  const getCurrentGraphState = useCallback(() => {
    if (!nodesRef.current || !networkInstanceRef.current) return null;
    
    const nodes = nodesRef.current.get();
    const edges = networkInstanceRef.current.body.data.edges.get();
    
    return {
      nodes: nodes.map((node: any) => ({
        id: node.id,
        node_id: node.id,
        type: node.type || 'default',
        label: node.label,
        position_x: node.x,
        position_y: node.y,
        attributes: node.attributes || {}
      })),
      edges: edges.map((edge: any) => ({
        id: edge.id,
        edge_id: edge.id,
        source: edge.from,
        target: edge.to,
        source_node: edge.from,
        target_node: edge.to,
        type: edge.type || '',
        label: edge.label,
        attributes: edge.attributes || {}
      }))
    };
  }, []);

  // Обработчик перемещения узлов с группировкой
  const handleNodeDragEnd = useCallback((params: any) => {
    const nodeId = params.nodes[0];
    if (!nodeId || !networkInstanceRef.current) return;
    
    const position = networkInstanceRef.current.getPosition(nodeId);
    
    // Вызываем внешний обработчик если есть
    if (onNodeMove) {
      onNodeMove(nodeId, position.x, position.y);
    }
    
    // Добавляем в ожидающие перемещения
    setPendingMoves(prev => ({
      ...prev,
      [nodeId]: { x: position.x, y: position.y }
    }));
    
    // Группируем перемещения за 500ms
    if (moveTimeoutRef.current) {
      clearTimeout(moveTimeoutRef.current);
    }
    
    moveTimeoutRef.current = setTimeout(() => {
      const moves = { ...pendingMoves };
      if (Object.keys(moves).length === 0) return;
      
      executeAction(
        'batch_move',
        () => {
          // Здесь можно обновить состояние в Redux если нужно
          console.log(`Batch move of ${Object.keys(moves).length} nodes`);
        },
        `Перемещение ${Object.keys(moves).length} узл${Object.keys(moves).length === 1 ? 'а' : 'ов'}`
      );
      
      setPendingMoves({});
    }, 500);
  }, [onNodeMove, executeAction, pendingMoves]);

  // Обработчик добавления узла (пример)
  const handleAddNode = useCallback((position: {x: number, y: number}, type: string = 'default') => {
    executeAction(
      'add_node',
      () => {
        // Здесь логика добавления узла через API или Redux
        const newNode = {
          id: `node_${Date.now()}`,
          type,
          label: `Новый узел`,
          position_x: position.x,
          position_y: position.y,
          attributes: {}
        };
        
        if (nodesRef.current) {
          nodesRef.current.add({
            ...newNode,
            x: position.x,
            y: position.y,
            color: getNodeColor(type),
            font: { color: '#ffffff', size: 14, strokeWidth: 0 }
          });
        }
      },
      'Добавление узла'
    );
  }, [executeAction]);

  // Обработчик удаления узла
  const handleDeleteNode = useCallback((nodeId: string) => {
    executeAction(
      'delete_node',
      () => {
        if (nodesRef.current) {
          nodesRef.current.remove(nodeId);
        }
      },
      `Удаление узла`
    );
  }, [executeAction]);

  // Обработчик прыжка по истории
  const handleHistoryJump = useCallback((state: any) => {
    if (!state || !nodesRef.current || !networkInstanceRef.current) return;
    
    // Обновляем данные в vis-network
    nodesRef.current.clear();
    nodesRef.current.add(state.nodes.map((node: any) => ({
      id: node.id || node.node_id,
      label: node.label || node.name || 'Узел',
      x: node.position_x,
      y: node.position_y,
      color: getNodeColor(node.type),
      font: { color: '#ffffff', size: 14, strokeWidth: 0 },
      shape: 'dot',
      size: 20,
      borderWidth: 2,
      shadow: true,
      type: node.type,
      attributes: node.attributes || {}
    })));
    
    networkInstanceRef.current.body.data.edges.clear();
    networkInstanceRef.current.body.data.edges.add(state.edges.map((edge: any) => ({
      id: edge.id || edge.edge_id,
      from: edge.source || edge.from || edge.source_node,
      to: edge.target || edge.to || edge.target_node,
      label: edge.label || edge.type || '',
      color: getEdgeColor(edge.type),
      font: { color: '#ffffff', size: 12, align: 'middle', strokeWidth: 0 },
      arrows: { to: { enabled: true, type: 'arrow', scaleFactor: 1 } },
      smooth: { type: 'continuous', forceDirection: 'none' },
      width: 2,
      type: edge.type,
      attributes: edge.attributes || {}
    })));
    
    // Обновляем Redux состояние
    dispatch(setGraphData(state));
  }, [dispatch]);

  // Отслеживаем Shift
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Shift') {
        shiftKeyRef.current = true;
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.key === 'Shift') {
        shiftKeyRef.current = false;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, []);

  // Cleanup timeout при размонтировании
  useEffect(() => {
    return () => {
      if (moveTimeoutRef.current) {
        clearTimeout(moveTimeoutRef.current);
      }
    };
  }, []);

  // Инициализация графа
  useEffect(() => {
    if (!networkRef.current || isInitializedRef.current) return;

    console.log('[GraphView] INITIALIZING GRAPH');
    isInitializedRef.current = true;

    // Отключаем контекстное меню
    networkRef.current.addEventListener('contextmenu', (e) => {
      e.preventDefault();
    });

    const nodesData = artifact.data?.nodes ? JSON.parse(JSON.stringify(artifact.data.nodes)) : [];
    const edgesData = artifact.data?.edges ? JSON.parse(JSON.stringify(artifact.data.edges)) : [];

    const nodeMap = new Map();
    const visNodes = nodesData.map((node: any) => {
      const nodeId = node.id || node.node_id;
      nodeMap.set(nodeId, node.label || node.name || 'Узел');
      
      return {
        id: nodeId,
        label: node.label || node.name || 'Узел',
        x: node.position_x,
        y: node.position_y,
        color: getNodeColor(node.type),
        font: { color: '#ffffff', size: 14, strokeWidth: 0 },
        shape: 'dot',
        size: 20,
        borderWidth: 2,
        shadow: true,
        title: node.attributes ? JSON.stringify(node.attributes, null, 2) : '',
        type: node.type,
        attributes: node.attributes || {}
      };
    });

    const visEdges = edgesData.map((edge: any) => {
      const fromId = edge.source || edge.from || edge.source_node;
      const toId = edge.target || edge.to || edge.target_node;
      return {
        id: edge.id || edge.edge_id,
        from: fromId,
        to: toId,
        label: edge.label || edge.type || '',
        color: getEdgeColor(edge.type),
        font: { color: '#ffffff', size: 12, align: 'middle', strokeWidth: 0 },
        arrows: { to: { enabled: true, type: 'arrow', scaleFactor: 1 } },
        smooth: { type: 'continuous', forceDirection: 'none' },
        width: 2,
        dashes: false,
        title: `${nodeMap.get(fromId) || fromId} → ${nodeMap.get(toId) || toId}${edge.label ? ': ' + edge.label : ''}`,
        type: edge.type,
        attributes: edge.attributes || {}
      };
    });

    const nodes = new DataSet(visNodes);
    nodesRef.current = nodes;
    const edges = new DataSet(visEdges);

    const options = {
      physics: false,
      layout: { improvedLayout: false, hierarchical: false },
      nodes: {
        shape: 'dot',
        size: 20,
        font: { color: '#ffffff', size: 14, strokeWidth: 0 },
        borderWidth: 2,
        shadow: true,
        color: {
          border: '#4b5563',
          background: '#6b7280',
          highlight: { border: '#3b82f6', background: '#60a5fa' },
          hover: { border: '#60a5fa', background: '#3b82f6' }
        }
      },
      edges: {
        width: 2,
        color: { color: '#6b7280', highlight: '#3b82f6', hover: '#60a5fa' },
        smooth: { type: 'continuous', forceDirection: 'none' },
        arrows: { to: { enabled: true, type: 'arrow', scaleFactor: 1 } },
        font: { color: '#ffffff', size: 12, align: 'middle', strokeWidth: 0 },
        dashes: false
      },
      interaction: {
        hover: true,
        tooltipDelay: 200,
        navigationButtons: false,
        keyboard: true,
        zoomView: true,
        dragView: true,
        multiselect: true,
        dragNodes: true
      }
    };

    const network = new Network(networkRef.current, { nodes, edges }, options);
    networkInstanceRef.current = network;

    network.on('select', (params) => {
      console.log('[GraphView] Select event:', params);
      
      if (params.nodes.length > 0) {
        const selectedNodesData = params.nodes.map(id => nodes.get(id));
        dispatch(setSelectedElements(selectedNodesData.map(data => ({ 
          type: 'node', 
          id: data.id, 
          data 
        }))));
      } else if (params.edges.length > 0) {
        const edgeId = params.edges[0];
        const edge = edges.get(edgeId);
        if (edge) {
          const enrichedEdge = {
            ...edge,
            fromLabel: nodeMap.get(edge.from) || edge.from,
            toLabel: nodeMap.get(edge.to) || edge.to
          };
          dispatch(setSelectedElement({ type: 'edge', id: edgeId, data: enrichedEdge }));
        }
      } else {
        dispatch(setSelectedElement(null));
        dispatch(setSelectedElements([]));
      }
    });

    network.on('dragEnd', handleNodeDragEnd);

    return () => {
      if (networkInstanceRef.current) {
        networkInstanceRef.current.destroy();
        networkInstanceRef.current = null;
        isInitializedRef.current = false;
      }
    };
  }, [artifact.id, artifact.data, dispatch, handleNodeDragEnd]);

  return (
    <div style={{ width: '100%', height: '100%', position: 'relative', background: '#111827' }}>
      <div ref={networkRef} style={{ width: '100%', height: '100%' }} />
      
      {/* Панель истории */}
      <HistoryPanel 
        graphId={artifact.id} 
        onJump={handleHistoryJump}
      />
      
      {/* Индикатор группировки перемещений */}
      {Object.keys(pendingMoves).length > 0 && (
        <div style={{
          position: 'fixed',
          bottom: '80px',
          right: '20px',
          background: '#ff9800',
          color: 'white',
          padding: '4px 12px',
          borderRadius: '16px',
          fontSize: '12px',
          boxShadow: '0 2px 8px rgba(0,0,0,0.3)',
          zIndex: 10001,
          display: 'flex',
          alignItems: 'center',
          gap: '6px'
        }}>
          <span>⏳</span>
          <span>Группировка {Object.keys(pendingMoves).length} перемещений...</span>
        </div>
      )}
      
      {/* Компактная панель навигации */}
      <div style={{
        position: 'absolute',
        bottom: '16px',
        right: '16px',
        display: 'flex',
        flexDirection: 'column',
        gap: '6px',
        zIndex: 1000
      }}>
        <button onClick={fitToScreen} style={compactButtonStyle} title="По размеру экрана">⤢</button>
        <button onClick={zoomIn} style={compactButtonStyle} title="Приблизить">+</button>
        <button onClick={zoomOut} style={compactButtonStyle} title="Отдалить">−</button>
      </div>

      {/* Компактная информационная панель */}
      <div style={compactInfoStyle}>
        <div style={{ fontWeight: 600, marginBottom: '4px', color: '#9ca3af', fontSize: '10px', textTransform: 'uppercase' }}>
          Граф
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '2px', fontSize: '11px' }}>
          <span style={{ color: '#9ca3af' }}>Узлы:</span>
          <span style={{ fontWeight: 500 }}>{artifact.data?.nodes?.length || 0}</span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '2px', fontSize: '11px' }}>
          <span style={{ color: '#9ca3af' }}>Связи:</span>
          <span style={{ fontWeight: 500 }}>{artifact.data?.edges?.length || 0}</span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px' }}>
          <span style={{ color: '#9ca3af' }}>Версия:</span>
          <span style={{ fontWeight: 500 }}>{artifact.version}</span>
        </div>
      </div>
    </div>
  );
});

// Компактные стили для кнопок
const compactButtonStyle = {
  width: '32px',
  height: '32px',
  backgroundColor: '#1f2937',
  border: '1px solid #374151',
  borderRadius: '6px',
  color: '#9ca3af',
  cursor: 'pointer',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  fontSize: '16px',
  boxShadow: '0 2px 4px rgba(0, 0, 0, 0.2)',
  transition: 'all 0.2s ease',
};

// Компактная информационная панель
const compactInfoStyle = {
  position: 'absolute' as const,
  top: '16px',
  right: '16px',
  backgroundColor: 'rgba(31, 41, 55, 0.95)',
  backdropFilter: 'blur(8px)',
  color: 'white',
  padding: '8px 12px',
  borderRadius: '6px',
  fontSize: '11px',
  zIndex: 1000,
  border: '1px solid #374151',
  boxShadow: '0 2px 4px rgba(0, 0, 0, 0.2)',
  minWidth: '120px'
};

export default GraphView;
