// frontend/src/components/views/GraphView.tsx
import React, { useEffect, useRef, useCallback, memo } from 'react';
import { Network } from 'vis-network/standalone';
import { DataSet } from 'vis-data/standalone';
import { useDispatch } from 'react-redux';
import { Artifact } from '../../store/slices/artifactsSlice';
import { setSelectedElement, setSelectedElements } from '../../store/slices/uiSlice';

interface GraphViewProps {
  artifact: Artifact;
  onNodeMove?: (nodeId: string, x: number, y: number) => void;
}

const GraphView: React.FC<GraphViewProps> = memo(({ artifact, onNodeMove }) => {
  const dispatch = useDispatch();
  const networkRef = useRef<HTMLDivElement>(null);
  const networkInstanceRef = useRef<Network | null>(null);
  const nodesRef = useRef<DataSet<any> | null>(null);
  const edgesRef = useRef<DataSet<any> | null>(null);
  const nodeMapRef = useRef<Map<string, string>>(new Map());
  const isInitializedRef = useRef<boolean>(false);
  const shiftKeyRef = useRef<boolean>(false);
  
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
    edgesRef.current = edges;
    nodeMapRef.current = nodeMap;

    const options = {
      physics: false,
      layout: { 
        improvedLayout: false, 
        hierarchical: false 
      },
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
        multiselect: true, // Включаем множественное выделение
        dragNodes: true
      }
    };

    const network = new Network(networkRef.current, { nodes, edges }, options);
    networkInstanceRef.current = network;

    // Используем стандартное событие select
    network.on('select', (params) => {
      console.log('[GraphView] Select event:', params);
      
      if (params.nodes.length > 0) {
        // Выделены узлы
        const selectedNodesData = params.nodes.map(id => nodes.get(id));
        dispatch(setSelectedElements(selectedNodesData.map(data => ({ 
          type: 'node', 
          id: data.id, 
          data 
        }))));
      } else if (params.edges.length > 0) {
        // Выделены ребра
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
        // Ничего не выделено
        dispatch(setSelectedElement(null));
        dispatch(setSelectedElements([]));
      }
    });

    // Перемещение узлов
    network.on('dragEnd', (params) => {
      if (params.nodes.length > 0 && onNodeMove) {
        const nodeId = params.nodes[0];
        const position = network.getPosition(nodeId);
        onNodeMove(nodeId, position.x, position.y);
      }
    });

    return () => {
      if (networkInstanceRef.current) {
        networkInstanceRef.current.destroy();
        networkInstanceRef.current = null;
        isInitializedRef.current = false;
      }
    };
  }, [artifact.id]);

  const getNodeColor = (type: string = 'default'): string => {
    const colors: Record<string, string> = {
      person: '#3B82F6',
      phone: '#10B981',
      location: '#EF4444',
      message: '#F59E0B',
      organization: '#8B5CF6',
      email: '#EC4899',
      social: '#06B6D4',
      document: '#6B7280',
      default: '#6B7280'
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

  return (
    <div style={{ width: '100%', height: '100%', position: 'relative', background: '#111827' }}>
      <div ref={networkRef} style={{ width: '100%', height: '100%' }} />
      
      <div style={{
        position: 'absolute',
        bottom: '24px',
        right: '24px',
        display: 'flex',
        flexDirection: 'column',
        gap: '8px',
        zIndex: 1000
      }}>
        <button onClick={fitToScreen} style={buttonStyle}>⤢</button>
        <button onClick={zoomIn} style={buttonStyle}>+</button>
        <button onClick={zoomOut} style={buttonStyle}>−</button>
      </div>

      <div style={infoStyle}>
        <div style={{ fontWeight: 600, marginBottom: '8px', color: '#9ca3af', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
          Граф
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
          <span style={{ color: '#9ca3af' }}>Узлы:</span>
          <span style={{ fontWeight: 500 }}>{artifact.data?.nodes?.length || 0}</span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
          <span style={{ color: '#9ca3af' }}>Связи:</span>
          <span style={{ fontWeight: 500 }}>{artifact.data?.edges?.length || 0}</span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          <span style={{ color: '#9ca3af' }}>Версия:</span>
          <span style={{ fontWeight: 500 }}>{artifact.version}</span>
        </div>
      </div>
    </div>
  );
});

const buttonStyle = {
  width: '44px',
  height: '44px',
  backgroundColor: '#1f2937',
  border: '1px solid #374151',
  borderRadius: '12px',
  color: '#9ca3af',
  cursor: 'pointer',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  fontSize: '20px',
  boxShadow: '0 4px 6px rgba(0, 0, 0, 0.3)',
  transition: 'all 0.2s ease',
  backdropFilter: 'blur(8px)',
};

const infoStyle = {
  position: 'absolute' as const,
  top: '24px',
  right: '24px',
  backgroundColor: 'rgba(31, 41, 55, 0.9)',
  backdropFilter: 'blur(8px)',
  color: 'white',
  padding: '12px 16px',
  borderRadius: '12px',
  fontSize: '13px',
  zIndex: 1000,
  border: '1px solid #374151',
  boxShadow: '0 4px 6px rgba(0, 0, 0, 0.3)',
  minWidth: '160px'
};

export default GraphView;