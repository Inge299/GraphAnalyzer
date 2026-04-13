// frontend/src/components/views/GraphView.tsx
import React, { useEffect, useRef, useState, useCallback } from 'react';
import { useAppDispatch } from '../../store';
import { setSelectedElements } from '../../store/slices/uiSlice';
import type { SelectedElement } from '../../store/slices/uiSlice';
import { Network } from 'vis-network/standalone';
import { DataSet } from 'vis-data/standalone';
import { domainModelApi } from '../../services/api';
import type { ApiArtifact, ApiPlugin, DomainModelConfig, PluginExecutionContext } from '../../types/api';
import { layoutConfig } from '../../config/layout';
import { nodeAttributePreviewConfig } from '../../config/nodeAttributePreview';
import { usePluginRunner } from '../../hooks/usePluginRunner';
import { useGraphViewportSelectionActions } from '../../hooks/useGraphViewportSelectionActions';
import { useGraphSelectionActions } from '../../hooks/useGraphSelectionActions';
import { useGraphPluginContextMenu } from '../../hooks/useGraphPluginContextMenu';
import { useGraphInteractionState } from '../../hooks/useGraphInteractionState';
import { useGraphKeyboardShortcuts } from '../../hooks/useGraphKeyboardShortcuts';
import { useGraphExternalEvents } from '../../hooks/useGraphExternalEvents';
import { useGraphLayoutActions } from '../../hooks/useGraphLayoutActions';
import { buildPluginContext, resolvePluginMenuTargets } from './graphPluginMenu';
import { applyRegularSelectionClick, handleConnectClick, handleNodeCreateClick } from './graphClickHandlers';
import { PluginContextMenu } from './PluginContextMenu';
import { GraphStatusOverlays } from './GraphStatusOverlays';
import { GraphToolbar } from './GraphToolbar';
import { GraphEmptyState } from './GraphEmptyState';
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

const getNodeBaseLabel = (node: any) => {
  const visual = node.attributes?.visual || {};
  const raw = String(node.label || visual.label || node.attributes?.label || node.attributes?.name || node.attributes?.title || getNodeId(node) || '');
  return raw.replace(/\\n/g, '\n').split(/\r?\n/)[0].trim();
};

type NodeAttributePreviewRuntime = {
  enabled: boolean;
  maxLinesPerField: number;
  defaultMarker: string;
  fields: Record<string, { marker?: string; maxLines?: number; visibleOnGraph?: boolean; label?: string }>;
};

type NodeTypeAttributeRuntime = {
  label: string;
  type: string;
};

const NODE_SYSTEM_KEYS = new Set(['visual', 'label', 'color', 'icon', 'iconScale', 'ringEnabled', 'ringWidth']);

const getNodeAttributePreviewLines = (
  node: any,
  preview: NodeAttributePreviewRuntime,
  nodeTypeAttributesMap: Record<string, Record<string, NodeTypeAttributeRuntime>>
) => {
  if (!preview.enabled) return [] as string[];
  const attributes = (node?.attributes || {}) as Record<string, any>;
  const typeId = String(node?.type || '');
  const typeAttributes = nodeTypeAttributesMap[typeId] || {};
  const visibleAttributesRaw = node?.attributes?.visual?.visibleAttributes;
  const visibleAttributesOverride = Array.isArray(visibleAttributesRaw)
    ? new Set(visibleAttributesRaw.map((item: any) => String(item)))
    : null;

  const keySet = new Set<string>();
  Object.entries(attributes).forEach(([key, value]) => {
    if (NODE_SYSTEM_KEYS.has(key)) return;
    if (value === undefined || value === null || value === '') return;
    keySet.add(key);
  });
  Object.keys(preview.fields || {}).forEach((key) => keySet.add(key));

  const keys = Array.from(keySet);
  keys.sort((left, right) => {
    const leftType = String(typeAttributes[left]?.type || 'string').toLowerCase();
    const rightType = String(typeAttributes[right]?.type || 'string').toLowerCase();
    const leftPriority = leftType === 'string' || leftType === 'text' ? 1 : leftType === 'number' || leftType === 'integer' || leftType === 'float' ? 2 : leftType === 'date' || leftType === 'datetime' ? 3 : leftType === 'boolean' ? 4 : 99;
    const rightPriority = rightType === 'string' || rightType === 'text' ? 1 : rightType === 'number' || rightType === 'integer' || rightType === 'float' ? 2 : rightType === 'date' || rightType === 'datetime' ? 3 : rightType === 'boolean' ? 4 : 99;
    if (leftPriority !== rightPriority) return leftPriority - rightPriority;
    const leftLabel = String(typeAttributes[left]?.label || left);
    const rightLabel = String(typeAttributes[right]?.label || right);
    return leftLabel.localeCompare(rightLabel, 'ru');
  });

  const lines: string[] = [];
  for (const key of keys) {
    const cfg = preview.fields?.[key] || {};
    const isVisible = visibleAttributesOverride
      ? visibleAttributesOverride.has(key)
      : (cfg.visibleOnGraph === true);
    if (!isVisible) continue;

    const rawValue = attributes[key];
    const values = Array.isArray(rawValue) ? rawValue : (rawValue ? [rawValue] : []);
    if (values.length === 0) continue;

    const marker = String(cfg?.marker || preview.defaultMarker || '*').trim() || '*';
    const maxLines = Number(cfg?.maxLines ?? preview.maxLinesPerField ?? 3);
    const safeLimit = Number.isFinite(maxLines) && maxLines > 0 ? maxLines : 3;

    for (let index = 0; index < values.length; index += 1) {
      const value = values[index];
      if (value === undefined || value === null) continue;
      const chunks = String(value)
        .replace(/\r/g, '')
        .split('\n')
        .map((line) => line.trim())
        .filter(Boolean)
        .slice(0, safeLimit);
      chunks.forEach((line) => lines.push(`${marker} ${line}`));
      if (index > 0 && chunks.length === 0) {
        lines.push(`${marker} ${String(value)}`.trim());
      }
    }
  }

  return lines;
};

const getNodeLabel = (
  node: any,
  preview: NodeAttributePreviewRuntime,
  nodeTypeAttributesMap: Record<string, Record<string, NodeTypeAttributeRuntime>> = {}
) => {
  const base = wrapLabel(getNodeBaseLabel(node), 22);
  const extra = getNodeAttributePreviewLines(node, preview, nodeTypeAttributesMap);
  if (extra.length === 0) return base;
  return [base, ...extra.map((line) => wrapLabel(line, 34))].join('\n');
};

const getNodeTooltip = (node: any, scale: number) => {
  const maxScale = Number((layoutConfig as any)?.interaction?.nodeTooltipMaxScale ?? 0.75);
  if (!Number.isFinite(maxScale) || scale > maxScale) return '';
  const base = getNodeBaseLabel(node).trim();
  return base || String(node?.type || getNodeId(node) || '');
};

const getEdgeComputedLines = (edge: any) => {
  const attrs = edge?.attributes || {};
  const visual = attrs?.visual || {};
  const visibleRaw = visual?.visibleAttributes;
  const visible = Array.isArray(visibleRaw) ? new Set(visibleRaw.map((item: any) => String(item))) : null;

  const contactsLine = String(
    attrs?.contacts ||
      (attrs?.calls_count !== undefined ? `contacts: ${attrs.calls_count}` : '')
  ).trim();
  const periodLine = String(attrs?.period || '').trim();

  const lines: string[] = [];
  if ((!visible || visible.has('contacts')) && contactsLine) lines.push(contactsLine);
  if ((!visible || visible.has('period')) && periodLine) lines.push(periodLine);

  return lines;
};

const getEdgeBaseLabel = (edge: any) => {
  const computedLines = getEdgeComputedLines(edge);
  if (computedLines.length > 0) return computedLines.join('\n');
  return String(edge.label || edge.attributes?.visual?.label || edge.attributes?.label || edge.type || '');
};

const getEdgeLabel = (edge: any) => {
  const base = getEdgeBaseLabel(edge);
  return String(base || '').split(/\r?\n/).map((line) => wrapLabel(line, 44)).join('\n');
};

const getNodeLabelMinScale = () => Number((layoutConfig as any)?.interaction?.nodeLabelMinScale ?? 0.6);
const getEdgeLabelMinScale = () => Number((layoutConfig as any)?.interaction?.edgeLabelMinScale ?? 0.8);
const shouldShowNodeLabel = (scale: number) => scale >= getNodeLabelMinScale();
const shouldShowEdgeLabel = (scale: number) => scale >= getEdgeLabelMinScale();
const GRAPH_TOOLBAR_HEIGHT = 54;

const getEdgeTooltip = (edge: any, scale: number) => {
  const maxScale = Number((layoutConfig as any)?.interaction?.nodeTooltipMaxScale ?? 0.75);
  if (!Number.isFinite(maxScale) || scale > maxScale) return '';
  return getEdgeBaseLabel(edge);
};
const getNodeIcon = (node: any) => {
  const visual = node.attributes?.visual || {};
  const explicitIcon = visual.icon || node.attributes?.icon;
  if (explicitIcon) return explicitIcon;
  if (String(node?.type || '') === 'document') return 'file';
  return '';
};

const getNodeRingEnabled = (node: any) => {
  const visual = node.attributes?.visual || {};
  const enabled = visual.ringEnabled ?? node.attributes?.ringEnabled;
  if (enabled === undefined || enabled === null) return true;
  return Boolean(enabled);
};

const getNodeRingWidth = (node: any) => {
  const visual = node.attributes?.visual || {};
  const raw = visual.ringWidth ?? node.attributes?.ringWidth ?? 1.5;
  const width = Number(raw);
  return Number.isFinite(width) ? Math.max(0, width) : 1.5;
};

const getIconVisualKey = (icon: string) => String(icon || '').trim().toLowerCase().replace(/\.[a-z0-9]+$/i, '');

const getNodeImagePadding = (node: any) => {
  const icon = getNodeIcon(node);
  if (!icon) return Number((layoutConfig as any)?.iconRendering?.defaultImagePadding ?? 10);

  const key = getIconVisualKey(icon);
  const iconRendering = (layoutConfig as any)?.iconRendering || {};
  const perIcon = (iconRendering.perIcon || {})[key] || {};
  const raw = Number(perIcon.imagePadding ?? iconRendering.defaultImagePadding ?? 10);
  return Number.isFinite(raw) ? Math.max(0, raw) : 10;
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
  const scaleValue = Number(scaleRaw);
  const iconScale = Number.isFinite(scaleValue) ? scaleValue : 2;
  const sizePaddingRaw = Number((layoutConfig as any)?.iconRendering?.sizePadding ?? (layoutConfig as any)?.iconRendering?.defaultImagePadding ?? 10);
  const sizePadding = Number.isFinite(sizePaddingRaw) ? Math.max(0, sizePaddingRaw) : 10;
  if (icon) {
    return Math.max(42, Math.min(140, 24 + (iconScale * 12) + (sizePadding * 2)));
  }
  return visual.size || node.attributes?.size || 20;
};

const getNodeShape = (node: any) => {
  const image = getNodeImage(node);
  return image ? 'circularImage' : (node.attributes?.visual?.shape || node.attributes?.shape || 'dot');
};

const iconAliasMap: Record<string, string> = {
  smartphone: 'smartphone',
  'mobile-phone': 'smartphone',
  phone: 'smartphone',
  mobile: 'smartphone',
  simcard: 'sim',
  'sim-card': 'sim',
  person: 'persona',
  persona: 'persona',
  abonent: 'abonent',
  social_id: 'social',
  'social-network': 'social',
  email: 'mail',
  'e-mail': 'mail',
  'ip-address': 'ip',
  'bank-card': 'bank_card',
  car_number: 'car',
  doc: 'document'
};

const normalizeIconName = (icon: string) => {
  const trimmed = String(icon || '').trim().toLowerCase();
  if (!trimmed) return '';

  const slash = Math.max(trimmed.lastIndexOf('/'), trimmed.lastIndexOf('\\'));
  const base = slash >= 0 ? trimmed.slice(slash + 1) : trimmed;
  const withoutExt = base.replace(/\.(svg|png|jpg|jpeg|webp)$/i, '');
  return iconAliasMap[withoutExt] || withoutExt;
};

const isValidIconName = (icon: string) => {
  if (!icon || icon === '?') return false;
  const normalized = icon.trim();
  if (!/^[a-zA-Z0-9_.-]+$/.test(normalized)) return false;
  if (!normalized.includes('.') && normalized.length < 2) return false;
  return true;
};

const printOsintIconMap: Record<string, string> = {
  person_phone: 'abonent',
  person: 'persona',
  persona: 'persona',
  abonent: 'abonent',
  smartphone: 'mobile-phone',
  phone: 'mobile-phone',
  mobile: 'mobile-phone',
  sim: 'sim-card',
  ip: 'ip-address',
  mail: 'e-mail',
  email: 'e-mail',
  social: 'social-network',
  social_id: 'social-network',
  bank_card: 'bank-card',
  car: 'car',
  address: 'address',
  location: 'location',
  passport: 'passport',
  document: 'file',
  file: 'file'
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
const buildEdgeForVis = (edge: any, nodeRadiusById: Record<string, number>, curveMap: Map<string, EdgeCurveMeta>, scale: number, suppressLabels = false) => {
  const visual = edge.attributes?.visual || {};
  const edgeColor = visual.color || edge.attributes?.color || '#848484';
  const edgeLabel = (!suppressLabels && shouldShowEdgeLabel(scale)) ? getEdgeLabel(edge) : "";
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
    id: String(edge.id),
    from: String(edge.from || edge.source_node),
    to: String(edge.to || edge.target_node),
    label: edgeLabel,
    title: getEdgeTooltip(edge, scale),
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
  const labelsSuppressedStateRef = useRef(false);
  const lastReduxStateRef = useRef<string>(JSON.stringify(artifact.data));
  const lastSelectionDigestRef = useRef<string>('');
  const isFirstLoadRef = useRef(true);
  const [domainModelRevision, setDomainModelRevision] = useState(0);
  const [previewConfigRevision, setPreviewConfigRevision] = useState(0);
  const edgeTypesRef = useRef<Array<any>>([]);
  const rulesRef = useRef<{ allow_parallel_edges: boolean }>({ allow_parallel_edges: true });
  const nodeTypeIconsRef = useRef<Record<string, string>>({});
  const nodeTypeAttributesRef = useRef<Record<string, Record<string, { label: string; type: string }>>>({});
  const nodeAttributePreviewRef = useRef<NodeAttributePreviewRuntime>({
    enabled: Boolean((nodeAttributePreviewConfig as any)?.enabled),
    maxLinesPerField: Number((nodeAttributePreviewConfig as any)?.maxLinesPerField ?? 3),
    defaultMarker: String((nodeAttributePreviewConfig as any)?.defaultMarker || '*'),
    fields: ((nodeAttributePreviewConfig as any)?.fields || {}) as Record<string, { marker?: string; maxLines?: number; visibleOnGraph?: boolean; label?: string }>,
  });
  useEffect(() => {
    nodeAttributePreviewRef.current = {
      enabled: Boolean((nodeAttributePreviewConfig as any)?.enabled),
      maxLinesPerField: Number((nodeAttributePreviewConfig as any)?.maxLinesPerField ?? 3),
      defaultMarker: String((nodeAttributePreviewConfig as any)?.defaultMarker || '*'),
      fields: ((nodeAttributePreviewConfig as any)?.fields || {}) as Record<string, { marker?: string; maxLines?: number; visibleOnGraph?: boolean; label?: string }>,
    };
    setPreviewConfigRevision((value) => value + 1);
  }, [JSON.stringify(nodeAttributePreviewConfig)]);

  const artifactDataRef = useRef<any>(artifact.data || {});
  const {
    setConnectMode,
    edgeSourceId,
    setEdgeSourceId,
    connectModeRef,
    edgeSourceIdRef,
    onAddEdgeRef,
    onDeleteSelectionRef,
    onAddNodeAtPositionRef,
    nodeCreateSpecRef,
    onNodeCreateCompleteRef,
    connectTypeRef,
    onConnectCompleteRef,
  } = useGraphInteractionState({
    connectType,
    onAddEdge,
    onDeleteSelection,
    onAddNodeAtPosition,
    nodeCreateSpec,
    onNodeCreateComplete,
    onConnectComplete,
  });


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
        nodeTypeAttributesRef.current = Array.isArray(model?.node_types)
          ? model.node_types.reduce((acc, item: any) => {
              const nodeTypeId = String(item?.id || '');
              if (!nodeTypeId) return acc;
              const attributes = Array.isArray(item?.attributes) ? item.attributes : [];
              acc[nodeTypeId] = attributes.reduce((attributeAcc: Record<string, { label: string; type: string }>, attribute: any) => {
                const key = String(attribute?.key || '').trim();
                if (!key) return attributeAcc;
                attributeAcc[key] = {
                  label: String(attribute?.label || key),
                  type: String(attribute?.type || 'string').toLowerCase(),
                };
                return attributeAcc;
              }, {} as Record<string, { label: string; type: string }>);
              return acc;
            }, {} as Record<string, Record<string, { label: string; type: string }>>)
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
        nodeTypeAttributesRef.current = {};
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
    const nodeById = new Map<string, any>(nodes.map((node: any) => [String(getNodeId(node)), node]));

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
    const currentScale = networkRef.current ? networkRef.current.getScale() : 1;

    const nodeUpdates = resolvedNodes.map((node: any) => {
      const id = String(getNodeId(node));
      const dimmed = Boolean(requestedEdgeType && allowedNodeIds && !allowedNodeIds.has(id));
      const colors = getNodeColors(node);
      const font = getNodeFont(node);

      return {
        id,
        label: (!labelsSuppressedStateRef.current && shouldShowNodeLabel(currentScale)) ? getNodeLabel(node, nodeAttributePreviewRef.current, nodeTypeAttributesRef.current) : "",
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

  const updateNodeTooltipsByScale = useCallback((scale: number) => {
    if (!nodesDataSetRef.current || !edgesDataSetRef.current) return;
    const selectedNodeIds = new Set<string>((networkRef.current?.getSelectedNodes() || []).map((id: any) => String(id)));
    const selectedEdgeIds = new Set<string>((networkRef.current?.getSelectedEdges() || []).map((id: any) => String(id)));

    const resolvedNodes = (artifactDataRef.current?.nodes || []).map((node: any) =>
      resolveNodeWithDomainIcon(node, nodeTypeIconsRef.current)
    );
    const nodeUpdates = resolvedNodes.map((node: any) => {
      const id = String(getNodeId(node));
      const isSelected = selectedNodeIds.has(id);
      const showLabel = isSelected || (!labelsSuppressedStateRef.current && shouldShowNodeLabel(scale));
      const baseColors = getNodeColors(node);
      const ringEnabled = getNodeRingEnabled(node);
      const ringWidth = getNodeRingWidth(node);
      return {
        id,
        title: getNodeTooltip(node, scale),
        label: showLabel ? getNodeLabel(node, nodeAttributePreviewRef.current, nodeTypeAttributesRef.current) : "",
        color: isSelected ? { ...baseColors, border: "#000000" } : baseColors,
        borderWidth: isSelected ? Math.max(ringEnabled ? ringWidth : 1, 2) : (ringEnabled ? ringWidth : 0),
        shadow: isSelected
          ? { enabled: true, size: 18, x: 0, y: 0, color: "rgba(0, 0, 0, 0.35)" }
          : (getNodeIcon(node) ? { enabled: true, size: 18, x: 0, y: 4, color: "rgba(15, 23, 42, 0.35)" } : false)
      };
    });
    if (nodeUpdates.length > 0) {
      nodesDataSetRef.current.update(nodeUpdates);
    }

    const edgeUpdates = (artifactDataRef.current?.edges || []).map((edge: any) => {
      const id = String(edge.id);
      const isSelected = selectedEdgeIds.has(id);
      const showLabel = isSelected || (!labelsSuppressedStateRef.current && shouldShowEdgeLabel(scale));
      const visual = edge.attributes?.visual || {};
      const baseColor = String(visual.color || edge.attributes?.color || "#848484");
      const baseWidth = Number(visual.width || edge.attributes?.width || 2);
      return {
        id,
        title: getEdgeTooltip(edge, scale),
        label: showLabel ? getEdgeLabel(edge) : "",
        width: isSelected ? Math.max(baseWidth, 4) : baseWidth,
        color: { color: isSelected ? "#2563eb" : baseColor, highlight: "#2563eb" },
        shadow: isSelected ? { enabled: true, size: 12, x: 0, y: 0, color: "rgba(37, 99, 235, 0.35)" } : false
      };
    });
    if (edgeUpdates.length > 0) {
      edgesDataSetRef.current.update(edgeUpdates);
    }
  }, []);

  const setLabelsSuppressed = useCallback((suppressed: boolean) => {
    labelsSuppressedStateRef.current = suppressed;
    const scale = networkRef.current ? networkRef.current.getScale() : 1;
    updateNodeTooltipsByScale(scale);
    applyConnectPreview();
  }, [applyConnectPreview, updateNodeTooltipsByScale]);

  const updateSelectionFromNetwork = useCallback(() => {
    if (!networkRef.current) return;
    const selectedNodeIds = networkRef.current.getSelectedNodes().map(id => String(id));
    const selectedEdgeIds = networkRef.current.getSelectedEdges().map(id => String(id));
    const digest = selectedNodeIds.join(',') + '|' + selectedEdgeIds.join(',');
    if (digest === lastSelectionDigestRef.current) return;
    lastSelectionDigestRef.current = digest;

    const nodes: SelectedElement[] = selectedNodeIds.map((id: string) => ({
      type: 'node',
      id,
      data: null,
    }));

    const edges: SelectedElement[] = selectedEdgeIds.map((id: string) => ({
      type: 'edge',
      id,
      data: null,
    }));


    dispatch(setSelectedElements([...nodes, ...edges]));
  }, [dispatch]);
  const {
    pluginMenu,
    pluginMenuRef,
    closePluginMenu,
    openPluginMenuAt,
    pluginMenuTree,
    pluginMenuLeft,
    pluginMenuTop,
    getPluginMenuEntries,
  } = useGraphPluginContextMenu({
    projectId: artifact.project_id,
    artifactId: artifact.id,
    networkRef,
    containerRef,
    updateSelectionFromNetwork,
    toolbarHeight: GRAPH_TOOLBAR_HEIGHT,
  });

  const {
    runPlugin,
    isPluginExecutingRef: pluginExecutionRef,
    pluginExecutionMessage,
  } = usePluginRunner({
    artifactId: artifact.id,
    projectId: artifact.project_id,
    getCurrentGraphNodeIds: () => ((artifactDataRef.current?.nodes || []) as any[]).map((node: any) => String(node?.id ?? node?.node_id ?? '')),
    buildLiveContext: (fallback: PluginExecutionContext) => {
      const hasMenuSelection =
        (Array.isArray(fallback?.selected_nodes) && fallback.selected_nodes.length > 0) ||
        (Array.isArray(fallback?.selected_edges) && fallback.selected_edges.length > 0);
      if (hasMenuSelection) return fallback;
      if (!networkRef.current) return fallback;
      return buildPluginContext(
        networkRef.current.getSelectedNodes().map((id: any) => String(id)),
        networkRef.current.getSelectedEdges().map((id: any) => String(id)),
      );
    },
    onFinally: closePluginMenu,
  });

  const runPluginFromMenu = useCallback(async (plugin: ApiPlugin, context: PluginExecutionContext) => {
    await runPlugin(plugin, context, dispatch);
  }, [dispatch, runPlugin]);

  useEffect(() => {
    if (!containerRef.current || isInitializedRef.current) return;

    console.log('[GraphView] Initializing network (first time only)');
    
    const nodes = (artifact.data?.nodes || []).map((node: any) =>
      resolveNodeWithDomainIcon(node, nodeTypeIconsRef.current)
    );
    const edges = artifact.data?.edges || [];

    const nodesData = new DataSet(
      nodes.map((node: any) => ({
        id: String(getNodeId(node)),
        label: (!labelsSuppressedStateRef.current && shouldShowNodeLabel(1)) ? getNodeLabel(node, nodeAttributePreviewRef.current, nodeTypeAttributesRef.current) : "",
        title: getNodeTooltip(node, 1),
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
      edges.map((edge: any) => buildEdgeForVis(edge, nodeRadiusById, edgeCurveMap, 1, labelsSuppressedStateRef.current))
    );

    nodesDataSetRef.current = nodesData;
    edgesDataSetRef.current = edgesData;

    const options: any = {
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
            const accent = '#111827';
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
              color: 'rgba(17, 24, 39, 0.45)'
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
      { nodes: nodesData as any, edges: edgesData as any },
      options
    );

    networkRef.current = network;
    updateNodeTooltipsByScale(network.getScale());

    const onZoom = () => {
      updateNodeTooltipsByScale(network.getScale());
      const selected = network.getSelection();
      if ((selected.nodes?.length || 0) > 0 || (selected.edges?.length || 0) > 0) {
        network.setSelection({ nodes: selected.nodes || [], edges: selected.edges || [] }, { unselectAll: true, highlightEdges: false });
      }
    };
    network.on('zoom', onZoom);

    const createBatchGroup = () => {
      return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
        const r = Math.random() * 16 | 0;
        const v = c === 'x' ? r : (r & 0x3 | 0x8);
        return v.toString(16);
      });
    };

    network.on('dragStart', (params: any) => {
      if (params.nodes && params.nodes.length > 0) {
        if (params.nodes.length === 1) {
          const draggedNodeId = String(params.nodes[0]);
          const selected = new Set(network.getSelectedNodes().map((id: any) => String(id)));
          if (!selected.has(draggedNodeId)) {
            const additive = Boolean(
              params?.event?.srcEvent?.shiftKey ||
              params?.event?.srcEvent?.ctrlKey ||
              params?.event?.srcEvent?.metaKey
            );
            network.selectNodes([draggedNodeId], additive);
            updateSelectionFromNetwork();
          }
        }
        isDraggingRef.current = true;
        batchGroupIdRef.current = createBatchGroup();
        console.log('[GraphView] Started drag batch for ' + params.nodes.length + ' nodes');
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

    const refreshSelectionVisuals = () => {
      updateSelectionFromNetwork();
      updateNodeTooltipsByScale(network.getScale());
    };
    network.on('select', refreshSelectionVisuals);
    network.on('deselectNode', refreshSelectionVisuals);
    network.on('deselectEdge', refreshSelectionVisuals);

    network.on('oncontext', async (params: any) => {
      params?.event?.preventDefault?.();
      if (pluginExecutionRef.current) return;
      const { domPoint, clickedNodes, clickedEdges } = resolvePluginMenuTargets(network, params);
      await openPluginMenuAt(domPoint, clickedNodes, clickedEdges);
    });

    network.on('click', (params: any) => {
      const created = handleNodeCreateClick({
        network,
        params,
        nodeCreateSpecRef,
        onAddNodeAtPositionRef,
        onNodeCreateCompleteRef,
      });
      if (created) return;

      if (!connectModeRef.current) {
        applyRegularSelectionClick(network, params, updateSelectionFromNetwork, updateNodeTooltipsByScale);
        return;
      }

      handleConnectClick({
        params,
        artifactData: artifactDataRef.current,
        getNodeId: (node: any) => String(getNodeId(node)),
        connectTypeRef,
        edgeSourceIdRef,
        setEdgeSourceId,
        setConnectMode,
        findEdgeType,
        matchesType,
        resolveAllowedEdgeType,
        isAllowedForEdgeType,
        onAddEdgeRef,
        onConnectCompleteRef,
      });
    });
    network.once('afterDrawing', () => {
      if (isFirstLoadRef.current) {
        network.fit({ animation: { duration: 300, easingFunction: 'easeInOutQuad' } });
        isFirstLoadRef.current = false;
      }
    });

    applyConnectPreview();

    isInitializedRef.current = true;

    return () => {
      if (moveTimeoutRef.current) clearTimeout(moveTimeoutRef.current);
      network.off('zoom', onZoom);
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
      id: String(getNodeId(node)),
        label: (!labelsSuppressedStateRef.current && shouldShowNodeLabel(currentScale)) ? getNodeLabel(node, nodeAttributePreviewRef.current, nodeTypeAttributesRef.current) : "",
      title: getNodeTooltip(node, currentScale),
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
    const edgesData = (artifact.data?.edges || []).map((edge: any) => buildEdgeForVis(edge, nodeRadiusById, edgeCurveMap, currentScale, labelsSuppressedStateRef.current));

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
  }, [artifact.data, artifact.version, domainModelRevision, previewConfigRevision]);

  useEffect(() => {
    applyConnectPreview();
  }, [connectType, edgeSourceId, domainModelRevision, applyConnectPreview]);
  useGraphKeyboardShortcuts({
    networkRef,
    nodesDataSetRef,
    onDeleteSelectionRef,
    dispatch,
    setSelectedElementsAction: setSelectedElements,
  });

  const handleUndoClick = useCallback(() => {
    console.log('[GraphView] Undo button clicked');
    onUndo?.();
  }, [onUndo]);

  const handleRedoClick = useCallback(() => {
    console.log('[GraphView] Redo button clicked');
    onRedo?.();
  }, [onRedo]);

  const estimateNodeFootprint = (node: any) => {
    const nodeSize = Number(getNodeSize(node) || 24);
    const wrapped = getNodeLabel(node, nodeAttributePreviewRef.current, nodeTypeAttributesRef.current) || String(node?.label || '');
    const lines = wrapped.split('\n').filter(Boolean);
    const maxLineLength = lines.reduce((acc: number, line: string) => Math.max(acc, line.length), 0);
    const labelWidth = Math.max(0, maxLineLength * 7);
    const labelHeight = lines.length * 18;
    const visualHeight = nodeSize + (labelHeight > 0 ? (10 + labelHeight) : 0);
    const visualWidth = Math.max(nodeSize, labelWidth);
    return Math.max(28, Math.sqrt((visualWidth * visualWidth + visualHeight * visualHeight) / 4));
  };

  const { handleAutoLayoutClick, handleBalancedLayoutClick } = useGraphLayoutActions({
    networkRef,
    nodesDataSetRef,
    artifactDataRef,
    onNodeMove,
    onNodesMove,
    setLabelsSuppressed,
    updateSelectionFromNetwork,
    getNodeId: (node: any) => String(getNodeId(node)),
    estimateNodeFootprint,
  });

  const {
    handleSelectConnectedEdges,
    handleSelectEndpoints,
  } = useGraphSelectionActions({
    networkRef,
    artifactDataRef,
    updateSelectionFromNetwork,
  });



  const {
    handleFitClick,
    handleFitSelectionClick,
    handleInvertSelectionClick,
  } = useGraphViewportSelectionActions({
    networkRef,
    artifactDataRef,
    nodesDataSetRef,
    edgesDataSetRef,
    updateSelectionFromNetwork,
  });

  useGraphExternalEvents({
    networkRef,
    nodesDataSetRef,
    updateSelectionFromNetwork,
    runBalancedLayoutForNodes: (nodeIds: string[]) => handleBalancedLayoutClick(false, nodeIds),
    artifactId: artifact.id,
  });


  const isGraphEmpty = !artifact.data || (!(artifact.data.nodes?.length) && !(artifact.data.edges?.length));

  return (
    <div className="graph-view" style={{ height: '100%', position: 'relative', background: '#ffffff', overflow: 'hidden' }}>
      
      <GraphToolbar
        canUndo={canUndo}
        canRedo={canRedo}
        onUndo={handleUndoClick}
        onRedo={handleRedoClick}
        onAutoLayout={handleAutoLayoutClick}
        onBalancedLayout={handleBalancedLayoutClick}
        onFit={handleFitClick}
        onFitSelection={handleFitSelectionClick}
        onInvertSelection={handleInvertSelectionClick}
        version={artifact.version}
      />

      
      <GraphStatusOverlays
        isRecording={isRecording}
        lastError={lastError}
        pendingMoveCount={new Set(pendingMoves.map((m) => m.nodeId)).size}
        nodeCreateSpec={nodeCreateSpec}
        connectType={connectType}
        edgeSourceId={edgeSourceId}
        pluginExecutionMessage={pluginExecutionMessage}
        toolbarHeight={GRAPH_TOOLBAR_HEIGHT}
      />
      <PluginContextMenu
        pluginMenu={pluginMenu}
        pluginMenuRef={pluginMenuRef}
        pluginMenuLeft={pluginMenuLeft}
        pluginMenuTop={pluginMenuTop}
        pluginMenuTree={pluginMenuTree}
        pluginExecutionMessage={pluginExecutionMessage}
        getPluginMenuEntries={getPluginMenuEntries}
        onRunPlugin={runPluginFromMenu}
        onSelectLinks={handleSelectConnectedEdges}
        onSelectEndpoints={handleSelectEndpoints}
        onClose={closePluginMenu}
      />
      {isGraphEmpty && <GraphEmptyState />}
      <div ref={containerRef} style={{ width: '100%', height: `calc(100% - ${GRAPH_TOOLBAR_HEIGHT}px)`, marginTop: `${GRAPH_TOOLBAR_HEIGHT}px` }} />

    </div>
  );
};

export default GraphView;
