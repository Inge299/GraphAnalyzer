// frontend/src/components/views/GraphView.tsx
import React, { useEffect, useRef, useState, useCallback } from 'react';
import { useAppDispatch } from '../../store';
import { setSelectedElements } from '../../store/slices/uiSlice';
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

const wrapLabel = (value: string, maxChars = 22) => {
  if (!value) return '';
  const words = String(value).split(/\s+/);
  const lines: string[] = [];
  let current = '';

  for (const word of words) {
    if (!word) continue;
    if (!current) {
      current = word;
      continue;
    }
    if (`${current} ${word}`.length <= maxChars) {
      current = `${current} ${word}`;
    } else {
      lines.push(current);
      current = word;
    }
  }

  if (current) lines.push(current);
  return lines.join('\n');
};

const getNodeLabel = (node: any) => {
  const visual = node.attributes?.visual || {};
  const baseLabel = node.label || visual.label || node.attributes?.label || node.attributes?.name || node.attributes?.title || getNodeId(node) || '';
  return wrapLabel(String(baseLabel), 22);
};

const getNodeIcon = (node: any) => {
  const visual = node.attributes?.visual || {};
  return visual.icon || node.attributes?.icon || '';
};

const getNodeRingEnabled = (node: any) => {
  const visual = node.attributes?.visual || {};
  const enabled = visual.ringEnabled ?? node.attributes?.ringEnabled;
  if (enabled === undefined || enabled === null) return true;
  return Boolean(enabled);
};

const getNodeRingWidth = (node: any) => {
  const visual = node.attributes?.visual || {};
  const raw = visual.ringWidth ?? node.attributes?.ringWidth ?? 2;
  const width = Number(raw);
  return Number.isFinite(width) ? Math.max(0, width) : 2;
};

const getNodeImagePadding = (_node: any) => {
  return 10;
};

const getNodeColors = (node: any) => {
  const visual = node.attributes?.visual || {};
  const color = visual.color || node.attributes?.color || (
    node.type === 'person' ? '#3b82f6' :
    node.type === 'company' ? '#22c55e' :
    node.type === 'domain' ? '#f59e0b' : '#94a3b8'
  );
  const ringVisible = getNodeRingEnabled(node);
  const border = ringVisible ? (visual.borderColor || node.attributes?.borderColor || color) : 'rgba(0,0,0,0)';
  const hasIcon = Boolean(getNodeIcon(node));
  if (hasIcon) {
    return { background: '#ffffff', border };
  }
  return { background: color, border };
};

const getNodeFont = (node: any) => {
  const visual = node.attributes?.visual || {};
  return {
    size: visual.fontSize || node.attributes?.fontSize || 13,
    color: '#0f172a',
    face: 'Inter, Arial, sans-serif'
  };
};

const getNodeSize = (node: any) => {
  const visual = node.attributes?.visual || {};
  const icon = getNodeIcon(node);
  const scaleRaw = visual.iconScale ?? node.attributes?.iconScale;
  const iconScale = Number(scaleRaw || 2);
  const padding = getNodeImagePadding(node);
  if (icon) {
    return Math.max(42, Math.min(140, 24 + (iconScale * 12) + (padding * 2)));
  }
  return visual.size || node.attributes?.size || 20;
};

const getNodeShape = (node: any) => {
  return getNodeIcon(node) ? 'circularImage' : (node.attributes?.visual?.shape || node.attributes?.shape || 'dot');
};

const getNodeImage = (node: any) => {
  const icon = getNodeIcon(node);
  if (!icon) return undefined;
  const iconName = String(icon).trim();
  const alias: Record<string, string> = {
    smartphone: 'smartphone',
    phone: 'smartphone',
    mobile: 'smartphone',
    simcard: 'sim',
    person: 'person_phone',
    social_id: 'social',
    email: 'mail',
    car_number: 'car'
  };
  const normalized = alias[iconName] || iconName;

  if (normalized.includes('.')) {
    return `/icons/${normalized}`;
  }

  return `/icons/${normalized}.svg`;
};

const buildNodeRadiusById = (nodes: any[]) => {
  const radiusById: Record<string, number> = {};
  nodes.forEach((node: any) => {
    const id = String(getNodeId(node));
    const size = Number(getNodeSize(node));
    radiusById[id] = Math.max(8, Math.round((Number.isFinite(size) ? size : 20) / 2));
  });
  return radiusById;
};

const buildEdgeForVis = (edge: any, nodeRadiusById: Record<string, number>) => {
  const visual = edge.attributes?.visual || {};
  const edgeColor = visual.color || edge.attributes?.color || '#848484';
  const edgeLabel = wrapLabel(String(edge.label || visual.label || edge.attributes?.label || edge.type || ''), 24);
  const edgeWidth = Number(visual.width || edge.attributes?.width || 2);
  const direction = visual.direction || edge.attributes?.direction || 'to';
  const dashed = Boolean(visual.dashed ?? edge.attributes?.dashed);
  const fromId = String(edge.from || edge.source_node);
  const toId = String(edge.to || edge.target_node);
  const arrows = direction === 'both' ? 'to, from' : direction === 'from' ? 'from' : 'to';

  return {
    id: edge.id,
    from: edge.from || edge.source_node,
    to: edge.to || edge.target_node,
    label: edgeLabel,
    title: `${edge.type}\n${JSON.stringify(edge.attributes || {}, null, 2)}`,
    arrows,
    dashes: dashed ? [Math.max(12, edgeWidth * 3), Math.max(10, edgeWidth * 2.8)] : false,
    width: edgeWidth,
    color: { color: edgeColor, highlight: '#2196f3' },
    endPointOffset: {
      from: nodeRadiusById[fromId] || 0,
      to: nodeRadiusById[toId] || 0
    },
    smooth: { enabled: false, type: 'continuous' }
  };
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
  const lastReduxStateRef = useRef<string>(JSON.stringify(artifact.data));
  const viewPositionRef = useRef<{ scale: number; position: { x: number; y: number } } | null>(null);
  const isFirstLoadRef = useRef(true);

  const updateSelectionFromNetwork = useCallback(() => {
    if (!networkRef.current) return;
    const selectedNodeIds = networkRef.current.getSelectedNodes().map(id => String(id));
    const selectedEdgeIds = networkRef.current.getSelectedEdges().map(id => String(id));
    const data = artifact.data || {};

    const nodes = (data.nodes || [])
      .filter((node: any) => selectedNodeIds.includes(String(getNodeId(node))))
      .map((node: any) => ({
        type: 'node',
        id: String(getNodeId(node)),
        data: node
      }));

    const edges = (data.edges || [])
      .filter((edge: any) => selectedEdgeIds.includes(String(edge.id)))
      .map((edge: any) => ({
        type: 'edge',
        id: String(edge.id),
        data: edge
      }));

    dispatch(setSelectedElements([...nodes, ...edges]));
  }, [artifact.data, dispatch]);
  // РРЅРёС†РёР°Р»РёР·Р°С†РёСЏ РіСЂР°С„Р° (С‚РѕР»СЊРєРѕ РѕРґРёРЅ СЂР°Р·)
  useEffect(() => {
    if (!containerRef.current || isInitializedRef.current) return;

    console.log('[GraphView] Initializing network (first time only)');
    
    const nodes = artifact.data?.nodes || [];
    const edges = artifact.data?.edges || [];

    // РЎРѕР·РґР°РµРј DataSet РґР»СЏ СѓР·Р»РѕРІ
    const nodesData = new DataSet(
      nodes.map((node: any) => ({
        id: getNodeId(node),
        label: getNodeLabel(node),
        title: `${node.type}\n${JSON.stringify(node.attributes || {}, null, 2)}`,
        x: node.position_x,
        y: node.position_y,
        color: getNodeColors(node),
        shape: getNodeShape(node),
        size: getNodeSize(node),
        font: getNodeFont(node),
        image: getNodeImage(node),
        borderWidth: getNodeRingEnabled(node) ? getNodeRingWidth(node) : 0,
        shapeProperties: { useBorderWithImage: true },
        imagePadding: getNodeImagePadding(node),
        shadow: true
      }))
    );

    // РЎРѕР·РґР°РµРј DataSet РґР»СЏ СЃРІСЏР·РµР№
    const nodeRadiusById = buildNodeRadiusById(nodes);
    const edgesData = new DataSet(
      edges.map((edge: any) => buildEdgeForVis(edge, nodeRadiusById))
    );

    nodesDataSetRef.current = nodesData;
    edgesDataSetRef.current = edgesData;

    const options = {
      physics: { enabled: false, stabilization: false },
      nodes: {
        shape: 'dot',
        size: 20,
        font: { size: 13, color: '#0f172a', face: 'Inter, Arial, sans-serif' },
        borderWidth: 2,
        labelHighlightBold: false,
        shapeProperties: { useBorderWithImage: true },
        chosen: false,
        shadow: true
      },
      edges: {
        width: 2,
        smooth: { enabled: false, type: 'continuous' },
        font: { size: 14, color: '#0f172a', align: 'middle', face: 'Inter, Arial, sans-serif', bold: false, strokeWidth: 3, strokeColor: '#ffffff' },
        arrows: { to: { enabled: true, scaleFactor: 0.8 } },
        chosen: false
      },
      interaction: {
        dragNodes: true,
        dragView: true,
        zoomView: true,
        hover: true,
        multiselect: true,
        selectConnectedEdges: false,
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

    // Р“РµРЅРµСЂР°С†РёСЏ UUID РґР»СЏ РіСЂСѓРїРїРёСЂРѕРІРєРё
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

    network.on('select', updateSelectionFromNetwork);
    network.on('deselectNode', updateSelectionFromNetwork);
    network.on('deselectEdge', updateSelectionFromNetwork);

    // РџРѕРґРіРѕРЅСЏРµРј РІРёРґ РїРѕРґ РіСЂР°С„ С‚РѕР»СЊРєРѕ РїСЂРё РїРµСЂРІРѕР№ Р·Р°РіСЂСѓР·РєРµ
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
  }, []); // РџСѓСЃС‚РѕР№ РјР°СЃСЃРёРІ - РёРЅРёС†РёР°Р»РёР·Р°С†РёСЏ С‚РѕР»СЊРєРѕ РѕРґРёРЅ СЂР°Р·

  // РћР±РЅРѕРІР»РµРЅРёРµ РґР°РЅРЅС‹С… РїСЂРё РёР·РјРµРЅРµРЅРёРё artifact.data (Р±РµР· РїРµСЂРµРёРЅРёС†РёР°Р»РёР·Р°С†РёРё)
  useEffect(() => {
    if (!networkRef.current || !nodesDataSetRef.current || isDraggingRef.current) return;

    const currentReduxState = JSON.stringify(artifact.data);
    if (currentReduxState === lastReduxStateRef.current) return;

    console.log('[GraphView] Updating data from Redux, version:', artifact.version);
    lastReduxStateRef.current = currentReduxState;

    const previousSelection = networkRef.current.getSelection();
    const currentScale = networkRef.current.getScale();
    const currentPosition = networkRef.current.getViewPosition();

    const nodesData = (artifact.data?.nodes || []).map((node: any) => ({
      id: getNodeId(node),
      label: getNodeLabel(node),
      title: `${node.type}\n${JSON.stringify(node.attributes || {}, null, 2)}`,
      x: node.position_x,
      y: node.position_y,
      color: getNodeColors(node),
      shape: getNodeShape(node),
      size: getNodeSize(node),
      font: getNodeFont(node),
      image: getNodeImage(node),
      borderWidth: getNodeRingEnabled(node) ? getNodeRingWidth(node) : 0,
      shapeProperties: { useBorderWithImage: true },
      imagePadding: getNodeImagePadding(node),
      shadow: true
    }));

    nodesDataSetRef.current.clear();
    if (nodesData.length > 0) {
      nodesDataSetRef.current.add(nodesData);
    }

    const nodeRadiusById = buildNodeRadiusById(artifact.data?.nodes || []);
    const edgesData = (artifact.data?.edges || []).map((edge: any) => buildEdgeForVis(edge, nodeRadiusById));

    edgesDataSetRef.current?.clear();
    if (edgesData.length > 0) {
      edgesDataSetRef.current?.add(edgesData);
    }

    const nodeIdSet = new Set(nodesData.map((n: any) => String(n.id)));
    const edgeIdSet = new Set(edgesData.map((e: any) => String(e.id)));
    const selectedNodes = (previousSelection.nodes || []).map((id: any) => String(id)).filter((id: string) => nodeIdSet.has(id));
    const selectedEdges = (previousSelection.edges || []).map((id: any) => String(id)).filter((id: string) => edgeIdSet.has(id));
    networkRef.current.setSelection({ nodes: selectedNodes, edges: selectedEdges }, { unselectAll: true, highlightEdges: false });

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
    // Р—РґРµСЃСЊ РЅСѓР¶РЅРѕ РІС‹Р·РІР°С‚СЊ РѕР±РЅРѕРІР»РµРЅРёРµ Р°СЂС‚РµС„Р°РєС‚Р°
    // onUndo/onRedo СѓР¶Рµ РІС‹Р·С‹РІР°СЋС‚СЃСЏ РёР· HistoryPanel
  }, []);

  if (!artifact.data || (!artifact.data.nodes?.length && !artifact.data.edges?.length)) {
    return (
      <div className="graph-view" style={{ height: '100%', position: 'relative', background: '#f8fafc' }}>
        <div style={{ 
          position: 'absolute', 
          top: '50%', 
          left: '50%', 
          transform: 'translate(-50%, -50%)',
          textAlign: 'center',
          color: '#888'
        }}>
          <h3>РџСѓСЃС‚РѕР№ РіСЂР°С„</h3>
          <p>РќРµС‚ СѓР·Р»РѕРІ РґР»СЏ РѕС‚РѕР±СЂР°Р¶РµРЅРёСЏ</p>
        </div>
      </div>
    );
  }

  return (
    <div className="graph-view" style={{ height: '100%', position: 'relative', background: '#f8fafc' }}>
      {/* РўСѓР»Р±Р°СЂ */}
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
          title="РћС‚РјРµРЅРёС‚СЊ (Ctrl+Z)"
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
          Undo
        </button>
        <button 
          onClick={handleRedoClick} 
          disabled={!canRedo}
          title="РџРѕРІС‚РѕСЂРёС‚СЊ (Ctrl+Y)"
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
          Redo
        </button>
        <div style={{ fontSize: '12px', color: '#aaa', marginLeft: '8px', padding: '6px 0' }}>
          v{artifact.version}
        </div>
      </div>

      {/* РРЅРґРёРєР°С‚РѕСЂС‹ */}
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
            вЏє Recording...
          </div>
        )}
        {lastError && (
          <div style={{ background: '#ef4444', color: 'white', padding: '4px 12px', borderRadius: '4px', fontSize: '12px' }}>
            вќЊ {lastError.message}
          </div>
        )}
        {pendingMoves.length > 0 && (
          <div style={{ background: '#3b82f6', color: 'white', padding: '4px 12px', borderRadius: '4px', fontSize: '12px' }}>
            рџ“¦ Grouping {new Set(pendingMoves.map(m => m.nodeId)).size} nodes...
          </div>
        )}
      </div>

      {/* РљРѕРЅС‚РµР№РЅРµСЂ РґР»СЏ РіСЂР°С„Р° */}
      <div ref={containerRef} style={{ width: '100%', height: '100%' }} />

      {/* РџР°РЅРµР»СЊ РёСЃС‚РѕСЂРёРё */}
      
    </div>
  );
};

export default GraphView;



















































