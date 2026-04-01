// frontend/src/components/views/GraphView.tsx
import React, { useEffect, useRef, useState, useCallback } from 'react';
import { useAppDispatch } from '../../store';
import { setSelectedElements } from '../../store/slices/uiSlice';
import { Network } from 'vis-network/standalone';
import { DataSet } from 'vis-data/standalone';
import { domainModelApi } from '../../services/api';
import type { ApiArtifact, DomainModelConfig } from '../../types/api';
import { layoutConfig } from '../../config/layout';
import 'vis-network/styles/vis-network.css';
import './GraphView.css';

interface GraphViewProps {
  artifact: ApiArtifact;
  onNodeMove: (nodeId: string, x: number, y: number, groupId?: string | null) => void;
  onNodesMove?: (moves: Array<{ nodeId: string; x: number; y: number }>, groupId?: string | null) => void;
  onAddEdge?: (sourceId: string, targetId: string, edgeType?: string) => void;
  onDeleteSelection?: (nodeIds: string[], edgeIds: string[]) => void;
  onAddNodeAtPosition?: (label: string, typeId: string, x: number, y: number) => void;
  nodeCreateSpec?: { typeId: string; label: string } | null;
  onNodeCreateComplete?: () => void;
  connectType?: string | null;
  onConnectComplete?: () => void;
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


const withAlpha = (color: string, alpha: number) => {
  if (!color) return `rgba(148, 163, 184, ${alpha})`;
  const normalized = color.trim();
  const fullHex = /^#([0-9a-fA-F]{3})$/;
  const longHex = /^#([0-9a-fA-F]{6})$/;
  const rgb = /^rgb\((\d{1,3}),\s*(\d{1,3}),\s*(\d{1,3})\)$/;

  if (fullHex.test(normalized)) {
    const match = normalized.match(fullHex);
    if (!match) return normalized;
    const hex = match[1];
    const r = parseInt(hex[0] + hex[0], 16);
    const g = parseInt(hex[1] + hex[1], 16);
    const b = parseInt(hex[2] + hex[2], 16);
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
  }

  if (longHex.test(normalized)) {
    const match = normalized.match(longHex);
    if (!match) return normalized;
    const hex = match[1];
    const r = parseInt(hex.slice(0, 2), 16);
    const g = parseInt(hex.slice(2, 4), 16);
    const b = parseInt(hex.slice(4, 6), 16);
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
  }

  const rgbMatch = normalized.match(rgb);
  if (rgbMatch) {
    return `rgba(${rgbMatch[1]}, ${rgbMatch[2]}, ${rgbMatch[3]}, ${alpha})`;
  }

  return normalized;
};

const getNodeColors = (node: any) => {
  const visual = node.attributes?.visual || {};
  const color = visual.color || node.attributes?.color || node.color || '#94a3b8';




  const ringVisible = getNodeRingEnabled(node);
  const border = ringVisible ? (visual.borderColor || node.attributes?.borderColor || color) : 'rgba(0,0,0,0)';
  const hasIcon = Boolean(getNodeIcon(node));
  if (hasIcon) {
    return { background: 'rgba(255,255,255,0)', border };
  }
  return { background: color, border };
};

const getNodeFont = (node: any) => {
  const visual = node.attributes?.visual || {};
  const baseSize = Number(visual.fontSize || node.attributes?.fontSize || 13);
  return {
    size: Math.max(12, Math.round(baseSize * 1.5)),
    color: '#0f172a',
    face: 'Inter, Arial, sans-serif',
    strokeWidth: 6,
    strokeColor: '#f8fafc',
    vadjust: 0
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

const iconAliasMap: Record<string, string> = {
  smartphone: 'smartphone',
  phone: 'smartphone',
  mobile: 'smartphone',
  simcard: 'sim',
  person: 'person_phone',
  social_id: 'social',
  email: 'mail',
  car_number: 'car'
};

const normalizeIconName = (icon: string) => {
  const trimmed = icon.trim();
  return iconAliasMap[trimmed] || trimmed;
};

const isValidIconName = (icon: string) => {
  if (!icon || icon === '?') return false;
  return /^[a-zA-Z0-9_.-]+$/.test(icon);
};

const printOsintIconMap: Record<string, string> = {
  person_phone: 'abonent',
  smartphone: 'mobile-phone',
  sim: 'sim-card',
  ip: 'ip-address',
  mail: 'e-mail',
  social: 'social-network',
  bank_card: 'bank-card',
  car: 'car',
  address: 'address',
  location: 'location',
  passport: 'passport'
};

const getNodeImage = (node: any) => {
  const icon = getNodeIcon(node);
  if (!icon) return undefined;
  const normalized = normalizeIconName(String(icon));
  if (!isValidIconName(normalized)) return undefined;

  const printName = printOsintIconMap[normalized];
  if (printName) {
    return `/icons/print-osint/${printName}.svg`;
  }

  if (normalized.includes('.')) {
    return `/icons/${normalized}`;
  }

  return `/icons/${normalized}.svg`;
};

const resolveNodeWithDomainIcon = (node: any, iconByType: Record<string, string>) => {
  if (!node || typeof node !== 'object') return node;
  const attributes = node.attributes || {};
  const visual = attributes.visual || {};
  const currentIcon = normalizeIconName(String(visual.icon || attributes.icon || ''));
  if (isValidIconName(currentIcon)) return node;

  const typeIcon = normalizeIconName(String(iconByType[String(node.type || '')] || ''));
  if (!isValidIconName(typeIcon)) return node;

  return {
    ...node,
    attributes: {
      ...attributes,
      icon: typeIcon,
      visual: {
        ...visual,
        icon: typeIcon
      }
    }
  };
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

interface EdgeCurveMeta {
  type: 'dynamic' | 'curvedCW' | 'curvedCCW';
  roundness: number;
}

const buildEdgeCurveMap = (edges: any[]) => {
  type EdgeRef = { id: string; from: string; to: string };
  const groupMap = new Map<string, EdgeRef[]>();

  edges.forEach((edge: any) => {
    const fromId = String(edge.from || edge.source_node || '');
    const toId = String(edge.to || edge.target_node || '');
    if (!fromId || !toId) return;

    const [left, right] = fromId < toId ? [fromId, toId] : [toId, fromId];
    const key = `${left}::${right}`;
    const edgeRef: EdgeRef = { id: String(edge.id), from: fromId, to: toId };

    if (!groupMap.has(key)) groupMap.set(key, []);
    groupMap.get(key)!.push(edgeRef);
  });

  const curveMap = new Map<string, EdgeCurveMeta>();

  const roundnessByIndex = (index: number, totalInPair: number) => {
    // Most pairs have one edge. For two edges keep separation very small.
    if (totalInPair <= 2) return 0.02;
    const base = 0.084 + index * 0.054;
    return Math.min(0.33, base);
  };

  groupMap.forEach((edgeRefs, key) => {
    if (edgeRefs.length <= 1) {
      curveMap.set(edgeRefs[0].id, { type: 'dynamic', roundness: 0 });
      return;
    }

    const [left, right] = key.split('::');
    const forward = edgeRefs.filter((ref) => ref.from === left && ref.to === right);
    const backward = edgeRefs.filter((ref) => ref.from === right && ref.to === left);

    if (forward.length > 0 && backward.length > 0) {
      // For opposite directions we keep the same curve type for both directions.
      // vis-network mirrors reversed edges, which naturally separates them.
      forward.forEach((ref, index) => {
        curveMap.set(ref.id, { type: 'curvedCW', roundness: roundnessByIndex(index, edgeRefs.length) });
      });
      backward.forEach((ref, index) => {
        curveMap.set(ref.id, { type: 'curvedCW', roundness: roundnessByIndex(index, edgeRefs.length) });
      });
      return;
    }

    // Same-direction multi-edges: alternate sides with small roundness.
    edgeRefs.forEach((ref, index) => {
      const level = Math.floor(index / 2);
      const type = index % 2 === 0 ? 'curvedCW' : 'curvedCCW';
      curveMap.set(ref.id, { type, roundness: roundnessByIndex(level, edgeRefs.length) });
    });
  });

  return curveMap;
};
const buildEdgeForVis = (edge: any, nodeRadiusById: Record<string, number>, curveMap: Map<string, EdgeCurveMeta>) => {
  const visual = edge.attributes?.visual || {};
  const edgeColor = visual.color || edge.attributes?.color || '#848484';
  const edgeLabel = wrapLabel(String(edge.label || visual.label || edge.attributes?.label || edge.type || ''), 24);
  const edgeWidth = Number(visual.width || edge.attributes?.width || 2);
  const direction = visual.direction || edge.attributes?.direction || 'to';
  const dashed = Boolean(visual.dashed ?? edge.attributes?.dashed);
  const fromId = String(edge.from || edge.source_node);
  const toId = String(edge.to || edge.target_node);
  const showTo = direction === 'to' || direction === 'both';
  const showFrom = direction === 'from' || direction === 'both';
  const arrows = {
    to: { enabled: true, scaleFactor: showTo ? 0.8 : 0 },
    from: { enabled: true, scaleFactor: showFrom ? 0.8 : 0 }
  };

  const curve = curveMap.get(String(edge.id)) || { type: 'dynamic', roundness: 0 };

  return {
    id: edge.id,
    from: edge.from || edge.source_node,
    to: edge.to || edge.target_node,
    label: edgeLabel,
    title: `${edge.type}\n${JSON.stringify(edge.attributes || {}, null, 2)}`,
    arrows,
    arrowStrikethrough: false,
    dashes: dashed ? [Math.max(12, edgeWidth * 3), Math.max(10, edgeWidth * 2.8)] : false,
    width: edgeWidth,
    color: { color: edgeColor, highlight: '#2196f3' },
    endPointOffset: {
      from: nodeRadiusById[fromId] || 0,
      to: nodeRadiusById[toId] || 0
    },
    smooth: curve.roundness > 0 ? { enabled: true, type: curve.type, roundness: curve.roundness } : { enabled: false, type: 'continuous' }
  };
};

export const GraphView: React.FC<GraphViewProps> = ({ 
  artifact, 
  onNodeMove,
  onNodesMove,
  onAddEdge,
  onDeleteSelection,
  onAddNodeAtPosition,
  nodeCreateSpec = null,
  onNodeCreateComplete,
  connectType = null,
  onConnectComplete,
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
  const [domainModelRevision, setDomainModelRevision] = useState(0);
  const [connectMode, setConnectMode] = useState(false);
  const [edgeSourceId, setEdgeSourceId] = useState<string | null>(null);
  const connectModeRef = useRef(false);
  const edgeSourceIdRef = useRef<string | null>(null);
  const edgeTypesRef = useRef<Array<any>>([]);
  const rulesRef = useRef<{ allow_parallel_edges: boolean }>({ allow_parallel_edges: true });
  const nodeTypeIconsRef = useRef<Record<string, string>>({});
  const artifactDataRef = useRef<any>(artifact.data || {});
  const onAddEdgeRef = useRef(onAddEdge);
  const onDeleteSelectionRef = useRef(onDeleteSelection);
  const onAddNodeAtPositionRef = useRef(onAddNodeAtPosition);
  const nodeCreateSpecRef = useRef<{ typeId: string; label: string } | null>(nodeCreateSpec || null);
  const onNodeCreateCompleteRef = useRef(onNodeCreateComplete);
  const connectTypeRef = useRef<string | null>(connectType || null);
  const onConnectCompleteRef = useRef(onConnectComplete);

  useEffect(() => {
    connectModeRef.current = connectMode;
  }, [connectMode]);

  useEffect(() => {
    if (connectType) {
      setConnectMode(true);
      return;
    }
    setConnectMode(false);
    setEdgeSourceId(null);
  }, [connectType]);

  useEffect(() => {
    edgeSourceIdRef.current = edgeSourceId;
  }, [edgeSourceId]);

  useEffect(() => {
    onAddEdgeRef.current = onAddEdge;
  }, [onAddEdge]);
  useEffect(() => {
    onDeleteSelectionRef.current = onDeleteSelection;
  }, [onDeleteSelection]);
  useEffect(() => {
    onAddNodeAtPositionRef.current = onAddNodeAtPosition;
  }, [onAddNodeAtPosition]);

  useEffect(() => {
    nodeCreateSpecRef.current = nodeCreateSpec || null;
    if (nodeCreateSpec) {
      setConnectMode(false);
      setEdgeSourceId(null);
    }
  }, [nodeCreateSpec]);

  useEffect(() => {
    onNodeCreateCompleteRef.current = onNodeCreateComplete;
  }, [onNodeCreateComplete]);

  useEffect(() => {
    connectTypeRef.current = connectType || null;
  }, [connectType]);

  useEffect(() => {
    onConnectCompleteRef.current = onConnectComplete;
  }, [onConnectComplete]);

  useEffect(() => {
    artifactDataRef.current = artifact.data || {};
  }, [artifact.data]);

  useEffect(() => {
    let cancelled = false;
    const loadDomainModel = async () => {
      try {
        const model = await domainModelApi.get() as DomainModelConfig;
        if (cancelled) return;
        edgeTypesRef.current = Array.isArray(model?.edge_types) ? model.edge_types : [];
        nodeTypeIconsRef.current = Array.isArray(model?.node_types)
          ? model.node_types.reduce((acc, item: any) => {
              if (item?.id && item?.icon) acc[String(item.id)] = String(item.icon);
              return acc;
            }, {} as Record<string, string>)
          : {};
        rulesRef.current = {
          allow_parallel_edges: model?.rules?.allow_parallel_edges !== false,
        };
        lastReduxStateRef.current = '';
        setDomainModelRevision((value) => value + 1);
      } catch {
        if (cancelled) return;
        edgeTypesRef.current = [];
        nodeTypeIconsRef.current = {};
        rulesRef.current = { allow_parallel_edges: true };
        lastReduxStateRef.current = '';
        setDomainModelRevision((value) => value + 1);
      }
    };

    loadDomainModel();
    return () => { cancelled = true; };
  }, []);


  const matchesType = (allowed: any, itemType: string) => {
    if (!Array.isArray(allowed)) return false;
    return allowed.includes('*') || allowed.includes(itemType);
  };

  const findEdgeType = (edgeTypeId: string) => {
    const edgeTypes = edgeTypesRef.current || [];
    return edgeTypes.find((item: any) => String(item?.id || '') === edgeTypeId) || null;
  };

  const isAllowedForEdgeType = (edgeTypeId: string, fromType: string, toType: string) => {
    const edgeType = findEdgeType(edgeTypeId);
    if (!edgeType) return false;
    return matchesType(edgeType.allowed_from, fromType) && matchesType(edgeType.allowed_to, toType);
  };

  const resolveAllowedEdgeType = (fromType: string, toType: string) => {
    const edgeTypes = edgeTypesRef.current || [];
    for (const edgeType of edgeTypes) {
      if (!edgeType || typeof edgeType !== 'object') continue;
      if (matchesType(edgeType.allowed_from, fromType) && matchesType(edgeType.allowed_to, toType)) {
        return String(edgeType.id || 'connected_to');
      }
    }
    return null;
  };


  const getAllowedNodeIdsForConnectType = (data: any, edgeTypeId: string, sourceNodeId: string | null) => {
    const edgeType = findEdgeType(edgeTypeId);
    if (!edgeType) return new Set<string>();

    const nodes = data?.nodes || [];
    const nodeById = new Map(nodes.map((node: any) => [String(getNodeId(node)), node]));

    if (!sourceNodeId) {
      return new Set<string>(
        nodes
          .filter((node: any) => matchesType(edgeType.allowed_from, String(node.type || '')))
          .map((node: any) => String(getNodeId(node)))
      );
    }

    const sourceNode = nodeById.get(sourceNodeId);
    const sourceType = String(sourceNode?.type || '');
    if (!sourceNode || !matchesType(edgeType.allowed_from, sourceType)) {
      return new Set<string>();
    }

    return new Set<string>(
      nodes
        .filter((node: any) => String(getNodeId(node)) !== sourceNodeId)
        .filter((node: any) => matchesType(edgeType.allowed_to, String(node.type || '')))
        .map((node: any) => String(getNodeId(node)))
    );
  };

  const applyConnectPreview = useCallback(() => {
    if (!nodesDataSetRef.current || !edgesDataSetRef.current) return;

    const requestedEdgeType = connectTypeRef.current;
    const data = artifactDataRef.current || {};

    const resolvedNodes = (data.nodes || []).map((node: any) =>
      resolveNodeWithDomainIcon(node, nodeTypeIconsRef.current)
    );

    const allowedNodeIds = requestedEdgeType
      ? getAllowedNodeIdsForConnectType(data, requestedEdgeType, edgeSourceIdRef.current)
      : null;

    const nodeUpdates = resolvedNodes.map((node: any) => {
      const id = String(getNodeId(node));
      const dimmed = Boolean(requestedEdgeType && allowedNodeIds && !allowedNodeIds.has(id));
      const colors = getNodeColors(node);
      const font = getNodeFont(node);

      return {
        id,
        label: getNodeLabel(node),
        color: dimmed ? {
          background: withAlpha(String(colors.background || '#94a3b8'), 0.2),
          border: withAlpha(String(colors.border || '#94a3b8'), 0.25)
        } : colors,
        font: dimmed ? { ...font, color: '#94a3b8' } : font,
        borderWidth: getNodeRingEnabled(node) ? getNodeRingWidth(node) : 0,
        shadow: dimmed ? false : (getNodeIcon(node) ? { enabled: true, size: 18, x: 0, y: 4, color: 'rgba(15, 23, 42, 0.35)' } : false),
      };
    });

    nodesDataSetRef.current.update(nodeUpdates);

    const edgeUpdates = (data.edges || []).map((edge: any) => {
      const baseColor = String(edge.attributes?.visual?.color || edge.attributes?.color || '#848484');
      const dimmed = Boolean(requestedEdgeType);
      return {
        id: String(edge.id),
        color: {
          color: dimmed ? withAlpha(baseColor, 0.2) : baseColor,
          highlight: dimmed ? '#94a3b8' : '#2563eb'
        },
        font: { color: dimmed ? '#94a3b8' : '#0f172a' }
      };
    });
    if (edgeUpdates.length > 0) {
      edgesDataSetRef.current.update(edgeUpdates);
    }
  }, []);

  const updateSelectionFromNetwork = useCallback(() => {
    if (!networkRef.current) return;
    const selectedNodeIds = networkRef.current.getSelectedNodes().map(id => String(id));
    const selectedEdgeIds = networkRef.current.getSelectedEdges().map(id => String(id));
    const data = artifactDataRef.current || {};

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
  }, [dispatch]);
  useEffect(() => {
    if (!containerRef.current || isInitializedRef.current) return;

    console.log('[GraphView] Initializing network (first time only)');
    
    const nodes = (artifact.data?.nodes || []).map((node: any) =>
      resolveNodeWithDomainIcon(node, nodeTypeIconsRef.current)
    );
    const edges = artifact.data?.edges || [];

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
        shadow: getNodeIcon(node) ? { enabled: true, size: 18, x: 0, y: 4, color: 'rgba(15, 23, 42, 0.35)' } : false
      }))
    );

    const nodeRadiusById = buildNodeRadiusById(nodes);
    const edgeCurveMap = buildEdgeCurveMap(edges);
    const edgesData = new DataSet(
      edges.map((edge: any) => buildEdgeForVis(edge, nodeRadiusById, edgeCurveMap))
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
        chosen: {
          node: (values: any) => {
            const background = 'rgba(255,255,255,0)';
            const accent = '#60a5fa';
            values.color = {
              border: accent,
              background,
              highlight: {
                border: accent,
                background
              },
              hover: {
                border: accent,
                background
              }
            };

            values.shadow = {
              enabled: true,
              size: 18,
              x: 0,
              y: 0,
              color: 'rgba(96, 165, 250, 0.45)'
            };
          },
        },
        shadow: false
      },
      edges: {
        width: 2,
        smooth: { enabled: true, type: 'dynamic', roundness: 0.2 },
        font: { size: 14, color: '#0f172a', align: 'middle', face: 'Inter, Arial, sans-serif', strokeWidth: 3, strokeColor: '#ffffff' },
        arrows: { to: { enabled: true, scaleFactor: 0.8 } },
        arrowStrikethrough: false,
        chosen: {
          edge: (values: any) => {
            values.width = Math.max(Number(values.width || 2), 4);
            values.color = '#2563eb';
            values.shadow = {
              enabled: true,
              size: 14,
              x: 0,
              y: 0,
              color: 'rgba(37, 99, 235, 0.35)'
            };
          }
        }
      },
      interaction: {
        dragNodes: true,
        dragView: true,
        zoomView: true,
        hover: true,
        multiselect: true,
        selectConnectedEdges: false,
        navigationButtons: false,
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

    network.on('click', (params: any) => {
      const pendingNode = nodeCreateSpecRef.current;
      if (pendingNode) {
        nodeCreateSpecRef.current = null;
        const canvasPoint = params?.pointer?.canvas
          || (params?.pointer?.DOM && networkRef.current
            ? networkRef.current.DOMtoCanvas(params.pointer.DOM)
            : null);

        if (!canvasPoint) {
          onNodeCreateCompleteRef.current?.();
          return;
        }

        onAddNodeAtPositionRef.current?.(
          pendingNode.label,
          pendingNode.typeId,
          Number(canvasPoint.x || 0),
          Number(canvasPoint.y || 0)
        );
        onNodeCreateCompleteRef.current?.();
        return;
      }

      if (!connectModeRef.current) return;
      if (!params.nodes || params.nodes.length === 0) return;

      const clickedNodeId = String(params.nodes[0]);
      const sourceId = edgeSourceIdRef.current;

      if (!sourceId) {
        const requestedEdgeType = connectTypeRef.current ? String(connectTypeRef.current) : null;
        if (requestedEdgeType) {
          const data = artifactDataRef.current || {};
          const nodesById = new Map((data.nodes || []).map((node: any) => [String(getNodeId(node)), node]));
          const sourceNode = nodesById.get(clickedNodeId);
          const sourceType = String(sourceNode?.type || '');
          const edgeType = findEdgeType(requestedEdgeType);
          const allowedFrom = Array.isArray(edgeType?.allowed_from) ? edgeType.allowed_from : ['*'];
          if (!matchesType(allowedFrom, sourceType)) {
            window.alert('Выбранный узел не может быть началом выбранного типа связи.');
            return;
          }
        }
        setEdgeSourceId(clickedNodeId);
        return;
      }

      if (sourceId === clickedNodeId) {
        setEdgeSourceId(null);
        return;
      }

      const data = artifactDataRef.current || {};
      const nodesById = new Map((data.nodes || []).map((node: any) => [String(getNodeId(node)), node]));
      const sourceNode = nodesById.get(sourceId);
      const targetNode = nodesById.get(clickedNodeId);
      const sourceType = String(sourceNode?.type || '');
      const targetType = String(targetNode?.type || '');

      const requestedEdgeType = connectTypeRef.current ? String(connectTypeRef.current) : null;
      const edgeType = requestedEdgeType || resolveAllowedEdgeType(sourceType, targetType);
      if (!edgeType) {
        window.alert('Нельзя создать связь: для выбранных типов узлов нет подходящего типа связи.');
        setEdgeSourceId(null);
        if (requestedEdgeType) {
          onConnectCompleteRef.current?.();
        } else {
          setConnectMode(false);
        }
        return;
      }

      if (requestedEdgeType && !isAllowedForEdgeType(requestedEdgeType, sourceType, targetType)) {
        window.alert('Связь выбранного типа недопустима для этих узлов.');
        setEdgeSourceId(null);
        return;
      }

      const allowParallelEdges = rulesRef.current.allow_parallel_edges;
      if (!allowParallelEdges) {
        const edges = data.edges || [];
        const alreadyExists = edges.some((edge: any) => {
          const from = String(edge.from || edge.source_node || '');
          const to = String(edge.to || edge.target_node || '');
          const type = String(edge.type || '');
          return from === sourceId && to === clickedNodeId && type === edgeType;
        });
        if (alreadyExists) {
          window.alert('Такая связь уже существует. Создание дубликата запрещено правилами.');
          setEdgeSourceId(null);
          if (!requestedEdgeType) {
            setConnectMode(false);
          }
          return;
        }
      }

      onAddEdgeRef.current?.(sourceId, clickedNodeId, edgeType);
      setEdgeSourceId(null);
      if (requestedEdgeType) {
        onConnectCompleteRef.current?.();
      } else {
        setConnectMode(false);
      }
    });

    network.once('afterDrawing', () => {
      if (isFirstLoadRef.current) {
        network.fit({ animation: true, duration: 300 });
        isFirstLoadRef.current = false;
      }
    });

    applyConnectPreview();

    isInitializedRef.current = true;

    return () => {
      if (moveTimeoutRef.current) clearTimeout(moveTimeoutRef.current);
      network.destroy();
      isInitializedRef.current = false;
      isFirstLoadRef.current = true;
    };
  }, []);

  useEffect(() => {
    if (!networkRef.current || !nodesDataSetRef.current || isDraggingRef.current) return;

    const currentReduxState = JSON.stringify(artifact.data);
    if (currentReduxState === lastReduxStateRef.current) return;

    console.log('[GraphView] Updating data from Redux, version:', artifact.version);
    lastReduxStateRef.current = currentReduxState;

    const previousSelection = networkRef.current.getSelection();
    const currentScale = networkRef.current.getScale();
    const currentPosition = networkRef.current.getViewPosition();

    const resolvedNodes = (artifact.data?.nodes || []).map((node: any) =>
      resolveNodeWithDomainIcon(node, nodeTypeIconsRef.current)
    );
    const nodesData = resolvedNodes.map((node: any) => ({
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
      shadow: getNodeIcon(node) ? { enabled: true, size: 18, x: 0, y: 4, color: 'rgba(15, 23, 42, 0.35)' } : false
    }));

    nodesDataSetRef.current.clear();
    if (nodesData.length > 0) {
      nodesDataSetRef.current.add(nodesData);
    }

    const nodeRadiusById = buildNodeRadiusById(resolvedNodes);
    const edgeCurveMap = buildEdgeCurveMap(artifact.data?.edges || []);
    const edgesData = (artifact.data?.edges || []).map((edge: any) => buildEdgeForVis(edge, nodeRadiusById, edgeCurveMap));

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
    applyConnectPreview();
  }, [artifact.data, artifact.version, domainModelRevision]);

  useEffect(() => {
    applyConnectPreview();
  }, [connectType, edgeSourceId, applyConnectPreview]);
  useEffect(() => {
    const isTypingTarget = (target: EventTarget | null) => {
      if (!(target instanceof HTMLElement)) return false;
      const tag = target.tagName.toLowerCase();
      return tag === 'input' || tag === 'textarea' || tag === 'select' || target.isContentEditable;
    };

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Delete') return;
      if (isTypingTarget(event.target)) return;
      if (!networkRef.current) return;

      const selectedNodeIds = networkRef.current.getSelectedNodes().map((id) => String(id));
      const selectedEdgeIds = networkRef.current.getSelectedEdges().map((id) => String(id));
      if (!selectedNodeIds.length && !selectedEdgeIds.length) return;

      event.preventDefault();
      onDeleteSelectionRef.current?.(selectedNodeIds, selectedEdgeIds);
      networkRef.current.unselectAll();
      dispatch(setSelectedElements([]));
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [dispatch]);

  const handleUndoClick = useCallback(() => {
    console.log('[GraphView] Undo button clicked');
    onUndo?.();
  }, [onUndo]);

  const handleRedoClick = useCallback(() => {
    console.log('[GraphView] Redo button clicked');
    onRedo?.();
  }, [onRedo]);

  const createLayoutGroupId = () => {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
      const r = Math.random() * 16 | 0;
      const v = c === 'x' ? r : ((r & 0x3) | 0x8);
      return v.toString(16);
    });
  };

  const estimateNodeFootprint = (node: any) => {
    const nodeSize = Number(getNodeSize(node) || 24);
    const wrapped = getNodeLabel(node) || String(node?.label || '');
    const lines = wrapped.split('\n').filter(Boolean);
    const maxLineLength = lines.reduce((acc: number, line: string) => Math.max(acc, line.length), 0);
    const labelWidth = Math.max(0, maxLineLength * 7);
    const labelHeight = lines.length * 18;
    const visualHeight = nodeSize + (labelHeight > 0 ? (10 + labelHeight) : 0);
    const visualWidth = Math.max(nodeSize, labelWidth);
    return Math.max(28, Math.sqrt((visualWidth * visualWidth + visualHeight * visualHeight) / 4));
  };

  const runAntiOverlap = (
    targetIds: string[],
    initialPositions: Map<string, { x: number; y: number }>,
    radiusById: Map<string, number>,
    blockers: Array<{ x: number; y: number; radius: number }>,
    paddingOverride?: number
  ) => {
    const next = new Map<string, { x: number; y: number }>();
    targetIds.forEach((id) => {
      const pos = initialPositions.get(id) || { x: 0, y: 0 };
      next.set(id, { x: pos.x, y: pos.y });
    });

    const padding = paddingOverride ?? (layoutConfig.hybrid.antiOverlapPaddingBase * layoutConfig.hybrid.spacingMultiplier);
    for (let iter = 0; iter < 90; iter += 1) {
      let totalShift = 0;

      for (let i = 0; i < targetIds.length; i += 1) {
        for (let j = i + 1; j < targetIds.length; j += 1) {
          const aId = targetIds[i];
          const bId = targetIds[j];
          const a = next.get(aId)!;
          const b = next.get(bId)!;
          const ra = radiusById.get(aId) || 30;
          const rb = radiusById.get(bId) || 30;
          const dx = b.x - a.x;
          const dy = b.y - a.y;
          const dist = Math.hypot(dx, dy) || 0.0001;
          const desired = ra + rb + padding;
          if (dist >= desired) continue;

          const push = (desired - dist) / 2;
          const ux = dx / dist;
          const uy = dy / dist;
          a.x -= ux * push;
          a.y -= uy * push;
          b.x += ux * push;
          b.y += uy * push;
          totalShift += push * 2;
        }
      }

      for (const id of targetIds) {
        const point = next.get(id)!;
        const r = radiusById.get(id) || 30;
        for (const blocker of blockers) {
          const dx = point.x - blocker.x;
          const dy = point.y - blocker.y;
          const dist = Math.hypot(dx, dy) || 0.0001;
          const desired = r + blocker.radius + padding;
          if (dist >= desired) continue;

          const push = desired - dist;
          point.x += (dx / dist) * push;
          point.y += (dy / dist) * push;
          totalShift += push;
        }
      }

      if (totalShift < 0.35) break;
    }

    return next;
  };
  const handleBalancedLayoutClick = useCallback(async () => {
    if (!networkRef.current || !nodesDataSetRef.current) return;

    const data = artifactDataRef.current || {};
    const allNodes = data.nodes || [];
    if (!allNodes.length) return;

    const selectedIds = networkRef.current.getSelectedNodes().map((id) => String(id));
    const targetIds = selectedIds.length
      ? selectedIds
      : allNodes.map((node: any) => String(getNodeId(node)));

    if (targetIds.length <= 1) return;

    const targetSet = new Set(targetIds);
    const allIds = allNodes.map((node: any) => String(getNodeId(node)));
    const physicsFlags = allIds.map((id) => ({ id, physics: targetSet.has(id) }));
    nodesDataSetRef.current.update(physicsFlags);

    const cfg = layoutConfig.physicsEngine;

    networkRef.current.setOptions({
      physics: {
        enabled: true,
        solver: cfg.solver,
        forceAtlas2Based: {
          gravitationalConstant: cfg.gravitationalConstant,
          centralGravity: cfg.centralGravity,
          springLength: cfg.springLength,
          springConstant: cfg.springConstant,
          damping: cfg.damping,
          avoidOverlap: cfg.avoidOverlap
        },
        minVelocity: cfg.minVelocity,
        timestep: cfg.timestep,
        stabilization: {
          enabled: true,
          iterations: cfg.iterations,
          fit: false,
          updateInterval: 25
        }
      }
    });

    await new Promise<void>((resolve) => {
      let settled = false;
      const finish = () => {
        if (settled) return;
        settled = true;
        try {
          networkRef.current?.off?.('stabilizationIterationsDone', onDone as any);
        } catch {
          // no-op
        }
        resolve();
      };
      const onDone = () => finish();

      networkRef.current?.on('stabilizationIterationsDone', onDone as any);
      networkRef.current?.startSimulation();
      setTimeout(finish, cfg.maxDurationMs);
    });

    networkRef.current.stopSimulation();

    const moves = targetIds.map((id) => {
      const pos = networkRef.current!.getPosition(id);
      return { nodeId: id, x: Math.round(Number(pos.x || 0)), y: Math.round(Number(pos.y || 0)) };
    });

    nodesDataSetRef.current.update([
      ...allIds.map((id) => ({ id, physics: false })),
      ...moves.map((move) => ({ id: move.nodeId, x: move.x, y: move.y }))
    ]);

    networkRef.current.setOptions({ physics: { enabled: false } });

    const groupId = createLayoutGroupId();
    if (onNodesMove && moves.length > 1) {
      onNodesMove(moves, groupId);
    } else {
      moves.forEach((move) => onNodeMove(move.nodeId, move.x, move.y, groupId));
    }

    networkRef.current.selectNodes(targetIds, false);
    updateSelectionFromNetwork();
  }, [onNodeMove, onNodesMove, updateSelectionFromNetwork]);
  const handleAutoLayoutClick = useCallback(async () => {
    if (!networkRef.current || !nodesDataSetRef.current) return;

    const data = artifactDataRef.current || {};
    const allNodes = data.nodes || [];
    if (!allNodes.length) return;

    const selectedIds = networkRef.current.getSelectedNodes().map((id) => String(id));
    const targetIds = selectedIds.length
      ? selectedIds
      : allNodes.map((node: any) => String(getNodeId(node)));

    if (targetIds.length <= 1) return;

    const targetSet = new Set(targetIds);
    const allIds = allNodes.map((node: any) => String(getNodeId(node)));
    const nodeById = new Map(allNodes.map((node: any) => [String(getNodeId(node)), node]));

    const blockers = selectedIds.length
      ? allNodes
          .filter((node: any) => !targetSet.has(String(getNodeId(node))))
          .map((node: any) => ({
            x: Number(node.position_x || 0),
            y: Number(node.position_y || 0),
            radius: estimateNodeFootprint(node)
          }))
      : [];

    const physicsFlags = allIds.map((id) => ({ id, physics: targetSet.has(id) }));
    nodesDataSetRef.current.update(physicsFlags);

    networkRef.current.setOptions({
      physics: {
        enabled: true,
        solver: 'forceAtlas2Based',
        forceAtlas2Based: {
          gravitationalConstant: layoutConfig.hybrid.physics.gravitationalConstantBase * layoutConfig.hybrid.spacingMultiplier,
          centralGravity: layoutConfig.hybrid.physics.centralGravityBase / layoutConfig.hybrid.spacingMultiplier,
          springLength: layoutConfig.hybrid.physics.springLengthBase * layoutConfig.hybrid.spacingMultiplier,
          springConstant: layoutConfig.hybrid.physics.springConstant,
          avoidOverlap: layoutConfig.hybrid.physics.avoidOverlap
        },
        minVelocity: layoutConfig.hybrid.physics.minVelocity,
        timestep: layoutConfig.hybrid.physics.timestep,
        stabilization: false
      }
    });

    networkRef.current.startSimulation();
    await new Promise((resolve) => setTimeout(resolve, layoutConfig.hybrid.forceDurationMs));
    networkRef.current.stopSimulation();

    const forcePositions = new Map<string, { x: number; y: number }>();
    targetIds.forEach((id) => {
      const pos = networkRef.current!.getPosition(id);
      forcePositions.set(id, { x: Number(pos.x || 0), y: Number(pos.y || 0) });
    });

    const radiusById = new Map<string, number>();
    targetIds.forEach((id) => {
      const node = nodeById.get(id);
      radiusById.set(id, estimateNodeFootprint(node));
    });

    const finalPositions = runAntiOverlap(targetIds, forcePositions, radiusById, blockers);

    const moves = targetIds.map((id) => {
      const pos = finalPositions.get(id) || forcePositions.get(id) || { x: 0, y: 0 };
      return { nodeId: id, x: Math.round(pos.x), y: Math.round(pos.y) };
    });

    nodesDataSetRef.current.update([
      ...allIds.map((id) => ({ id, physics: false })),
      ...moves.map((move) => ({ id: move.nodeId, x: move.x, y: move.y }))
    ]);

    networkRef.current.setOptions({ physics: { enabled: false } });

    const groupId = createLayoutGroupId();
    if (onNodesMove && moves.length > 1) {
      onNodesMove(moves, groupId);
    } else {
      moves.forEach((move) => onNodeMove(move.nodeId, move.x, move.y, groupId));
    }

    networkRef.current.selectNodes(targetIds, false);
    updateSelectionFromNetwork();
  }, [onNodeMove, onNodesMove, updateSelectionFromNetwork]);

  const handleFitClick = useCallback(() => {
    if (!networkRef.current) return;
    networkRef.current.fit({ animation: true, duration: 250 });
  }, []);

  const handleHistoryJump = useCallback((state: any) => {
    console.log('[GraphView] History jump');

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
          <h3>{'\u041f\u0443\u0441\u0442\u043e\u0439 \u0433\u0440\u0430\u0444'}</h3>
          <p>{'\u041d\u0435\u0442 \u0443\u0437\u043b\u043e\u0432 \u0434\u043b\u044f \u043e\u0442\u043e\u0431\u0440\u0430\u0436\u0435\u043d\u0438\u044f'}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="graph-view" style={{ height: '100%', position: 'relative', background: '#f8fafc' }}>
      
      <div style={{ 
        position: 'absolute', 
        top: 10, 
        left: 10, 
        zIndex: 10, 
        display: 'flex', 
        gap: '8px',
        background: 'rgba(255, 255, 255, 0.95)',
        border: '1px solid #d7deea',
        padding: '8px 12px',
        borderRadius: '6px',
        backdropFilter: 'blur(4px)'
      }}>
        <button 
          onClick={handleUndoClick} 
          disabled={!canUndo}
          title="Undo (Ctrl+Z)"
          style={{
            padding: '6px 12px',
            background: '#2563eb',
            border: '1px solid #2563eb',
            borderRadius: '4px',
            color: '#ffffff',
            cursor: canUndo ? 'pointer' : 'not-allowed',
            opacity: canUndo ? 1 : 0.5
          }}
        >
          {'\u21B6'}
        </button>
        <button 
          onClick={handleRedoClick} 
          disabled={!canRedo}
          title="Redo (Ctrl+Y)"
          style={{
            padding: '6px 12px',
            background: '#2563eb',
            border: '1px solid #2563eb',
            borderRadius: '4px',
            color: '#ffffff',
            cursor: canRedo ? 'pointer' : 'not-allowed',
            opacity: canRedo ? 1 : 0.5
          }}
        >
          {'\u21B7'}
        </button>
        <button
          onClick={handleAutoLayoutClick}
          title={"\u0410\u0432\u0442\u043e\u0440\u0430\u0437\u043c\u0435\u0449\u0435\u043d\u0438\u0435"}
          style={{
            padding: '6px 10px',
            background: '#2563eb',
            border: '1px solid #2563eb',
            borderRadius: '4px',
            color: '#ffffff',
            cursor: 'pointer'
          }}
        >
          {'\u2728'}
        </button>
        <button
          onClick={handleBalancedLayoutClick}
          title={"Physics layout"}
          style={{
            padding: '6px 10px',
            background: '#2563eb',
            border: '1px solid #2563eb',
            borderRadius: '4px',
            color: '#ffffff',
            cursor: 'pointer'
          }}
        >
          {'\u2696'}
        </button>
        <button
          onClick={handleFitClick}
          title="Fit to screen"
          style={{
            padding: '6px 10px',
            background: '#2563eb',
            border: '1px solid #2563eb',
            borderRadius: '4px',
            color: '#ffffff',
            cursor: 'pointer'
          }}
        >
          {'\u2922'}
        </button>
        <div style={{ fontSize: '12px', color: '#475569', marginLeft: '8px', padding: '6px 0' }}>
          v{artifact.version}
        </div>
      </div>

      
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
            Recording...
          </div>
        )}
        {lastError && (
          <div style={{ background: '#ef4444', color: 'white', padding: '4px 12px', borderRadius: '4px', fontSize: '12px' }}>
            Error: {lastError.message}
          </div>
        )}
        {pendingMoves.length > 0 && (
          <div style={{ background: '#3b82f6', color: 'white', padding: '4px 12px', borderRadius: '4px', fontSize: '12px' }}>
            Grouping {new Set(pendingMoves.map(m => m.nodeId)).size} nodes...
          </div>
        )}
        {nodeCreateSpec && (
          <div style={{ background: '#16a34a', color: 'white', padding: '4px 12px', borderRadius: '4px', fontSize: '12px' }}>
            {`Кликните по графу для добавления узла: ${nodeCreateSpec.label}`}
          </div>
        )}
        {connectType && (
          <div style={{ background: '#2563eb', color: 'white', padding: '4px 12px', borderRadius: '4px', fontSize: '12px' }}>
            {edgeSourceId ? 'Выберите конечный узел для создания связи' : 'Выберите начальный узел для создания связи'}
          </div>
        )}
      </div>

      
      <div ref={containerRef} style={{ width: '100%', height: '100%' }} />

      
      
    </div>
  );
};

export default GraphView;











































