// frontend/src/components/views/GraphView.tsx
import React, { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import { useAppDispatch } from '../../store';
import { setSelectedElements } from '../../store/slices/uiSlice';
import { Network } from 'vis-network/standalone';
import { DataSet } from 'vis-data/standalone';
import { domainModelApi, pluginApi } from '../../services/api';
import type { ApiArtifact, ApiPlugin, DomainModelConfig, PluginExecutionContext } from '../../types/api';
import { layoutConfig } from '../../config/layout';
import { nodeAttributePreviewConfig } from '../../config/nodeAttributePreview';
import { fetchArtifacts, setCurrentArtifact } from '../../store/slices/artifactsSlice';
import { collectPluginParamsWithPrompts } from '../../utils/pluginParams';
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

interface PluginContextMenuState {
  x: number;
  y: number;
  context: PluginExecutionContext;
  plugins: ApiPlugin[];
  loading: boolean;
}

interface PluginMenuNode {
  key: string;
  label: string;
  depth: number;
  children: PluginMenuNode[];
  plugins: ApiPlugin[];
}

interface PluginMenuEntry {
  kind: 'folder' | 'plugin';
  key: string;
  label: string;
  node?: PluginMenuNode;
  plugin?: ApiPlugin;
}

const buildPluginMenuTree = (plugins: ApiPlugin[]): PluginMenuNode[] => {
  const root: PluginMenuNode[] = [];
  const nodeByPath = new Map<string, PluginMenuNode>();

  const ensureNode = (segments: string[]) => {
    let parentPath = '';
    let siblings = root;

    segments.forEach((segment, index) => {
      const safe = segment.trim() || '\u041f\u0440\u043e\u0447\u0435\u0435';
      const path = parentPath ? `${parentPath}/${safe}` : safe;
      let node = nodeByPath.get(path);
      if (!node) {
        node = { key: path, label: safe, depth: index, children: [], plugins: [] };
        siblings.push(node);
        nodeByPath.set(path, node);
      }
      siblings = node.children;
      parentPath = path;
    });

    return nodeByPath.get(parentPath);
  };

  plugins.forEach((plugin) => {
    const rawPath = String(plugin.menu_path || '\u041f\u0440\u043e\u0447\u0435\u0435').trim() || '\u041f\u0440\u043e\u0447\u0435\u0435';
    const segments = rawPath.split('/').map((s) => s.trim()).filter(Boolean);
    const target = ensureNode(segments.length > 0 ? segments : ['\u041f\u0440\u043e\u0447\u0435\u0435']);
    if (target) target.plugins.push(plugin);
  });

  const sortTree = (nodes: PluginMenuNode[]) => {
    nodes.sort((a, b) => a.label.localeCompare(b.label, 'ru'));
    nodes.forEach((node) => {
      node.plugins.sort((a, b) => a.name.localeCompare(b.name, 'ru'));
      sortTree(node.children);
    });
  };

  sortTree(root);
  return root;
};

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

    const marker = String(cfg?.marker || preview.defaultMarker || 'Р В Р’В Р вЂ™Р’В Р В РІР‚в„ўР вЂ™Р’В Р В Р’В Р вЂ™Р’В Р В Р вЂ Р В РІР‚С™Р вЂ™Р’В Р В Р’В Р вЂ™Р’В Р В РІР‚в„ўР вЂ™Р’В Р В Р’В Р В РІР‚В Р В Р’В Р Р†Р вЂљРЎв„ўР В Р Р‹Р Р†РІР‚С›РЎС›Р В Р’В Р вЂ™Р’В Р В Р’В Р В РІР‚в„–Р В Р’В Р В Р вЂ№Р В Р вЂ Р В РІР‚С™Р РЋРІР‚Сњ').trim() || 'Р В Р’В Р вЂ™Р’В Р В РІР‚в„ўР вЂ™Р’В Р В Р’В Р вЂ™Р’В Р В Р вЂ Р В РІР‚С™Р вЂ™Р’В Р В Р’В Р вЂ™Р’В Р В РІР‚в„ўР вЂ™Р’В Р В Р’В Р В РІР‚В Р В Р’В Р Р†Р вЂљРЎв„ўР В Р Р‹Р Р†РІР‚С›РЎС›Р В Р’В Р вЂ™Р’В Р В Р’В Р В РІР‚в„–Р В Р’В Р В Р вЂ№Р В Р вЂ Р В РІР‚С™Р РЋРІР‚Сњ';
    const maxLines = Number.isFinite(Number(cfg?.maxLines)) ? Math.max(1, Number(cfg?.maxLines)) : preview.maxLinesPerField;
    const fieldLabel = String(cfg?.label || typeAttributes[key]?.label || key);

    for (const item of values.slice(0, maxLines)) {
      const text = String(item || '').replace(/\\n/g, '\n').trim();
      if (!text) continue;
      lines.push(`${marker} ${fieldLabel}: ${text}`.trim());
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

  const contactsLine = String(attrs?.contacts || (attrs?.calls_count !== undefined ? `Р В Р’В Р вЂ™Р’В Р В РІР‚в„ўР вЂ™Р’В Р В Р’В Р В Р вЂ№Р В Р вЂ Р В РІР‚С™Р РЋРЎС™Р В Р’В Р вЂ™Р’В Р В РІР‚в„ўР вЂ™Р’В Р В Р’В Р В Р вЂ№Р В Р вЂ Р В РІР‚С™Р РЋРЎвЂєР В Р’В Р вЂ™Р’В Р В РІР‚в„ўР вЂ™Р’В Р В Р’В Р вЂ™Р’В Р В Р вЂ Р В РІР‚С™Р вЂ™Р’В¦Р В Р’В Р вЂ™Р’В Р В Р’В Р В РІР‚в„–Р В Р’В Р В РІР‚В Р В Р’В Р Р†Р вЂљРЎв„ўР В Р Р‹Р Р†РІР‚С›РЎС›Р В Р’В Р вЂ™Р’В Р В РІР‚в„ўР вЂ™Р’В Р В Р’В Р Р†Р вЂљРІвЂћСћР В РІР‚в„ўР вЂ™Р’В°Р В Р’В Р вЂ™Р’В Р В РІР‚в„ўР вЂ™Р’В Р В Р’В Р В Р вЂ№Р В Р вЂ Р В РІР‚С™Р РЋРЎС™Р В Р’В Р вЂ™Р’В Р В Р’В Р В РІР‚в„–Р В Р’В Р В РІР‚В Р В Р’В Р Р†Р вЂљРЎв„ўР В Р Р‹Р Р†РІР‚С›РЎС›Р В Р’В Р вЂ™Р’В Р В РІР‚в„ўР вЂ™Р’В Р В Р’В Р В Р вЂ№Р В Р вЂ Р В РІР‚С™Р РЋРЎвЂєР В Р’В Р вЂ™Р’В Р В РІР‚в„ўР вЂ™Р’В Р В Р’В Р вЂ™Р’В Р В Р вЂ Р В РІР‚С™Р вЂ™Р’В : ${attrs.calls_count}` : '')).trim();
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
  const normalized = icon.trim();
  if (!/^[a-zA-Z0-9_.-]+$/.test(normalized)) return false;
  if (!normalized.includes('.') && normalized.length < 2) return false;
  return true;
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
    id: edge.id,
    from: edge.from || edge.source_node,
    to: edge.to || edge.target_node,
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
  const lastReduxStateRef = useRef<string>(JSON.stringify(artifact.data));
  const viewPositionRef = useRef<{ scale: number; position: { x: number; y: number } } | null>(null);
  const isFirstLoadRef = useRef(true);
  const [domainModelRevision, setDomainModelRevision] = useState(0);
  const [previewConfigRevision, setPreviewConfigRevision] = useState(0);
  const [connectMode, setConnectMode] = useState(false);
  const [edgeSourceId, setEdgeSourceId] = useState<string | null>(null);
  const connectModeRef = useRef(false);
  const edgeSourceIdRef = useRef<string | null>(null);
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
  const onAddEdgeRef = useRef(onAddEdge);
  const onDeleteSelectionRef = useRef(onDeleteSelection);
  const onAddNodeAtPositionRef = useRef(onAddNodeAtPosition);
  const nodeCreateSpecRef = useRef<{ typeId: string; label: string } | null>(nodeCreateSpec || null);
  const onNodeCreateCompleteRef = useRef(onNodeCreateComplete);
  const connectTypeRef = useRef<string | null>(connectType || null);
  const onConnectCompleteRef = useRef(onConnectComplete);
  const [pluginMenu, setPluginMenu] = useState<PluginContextMenuState | null>(null);
  const [pendingPluginNodeIds, setPendingPluginNodeIds] = useState<string[]>([]);
  const pluginMenuRef = useRef<HTMLDivElement | null>(null);
  const labelsSuppressedRef = useRef(false);

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
    const onMouseDown = (event: MouseEvent) => {
      if (event.button !== 0) return;
      if (!pluginMenuRef.current) return;
      if (event.target instanceof Node && pluginMenuRef.current.contains(event.target)) return;
      setPluginMenu(null);
    };

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setPluginMenu(null);
      }
    };

    document.addEventListener('mousedown', onMouseDown);
    window.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('mousedown', onMouseDown);
      window.removeEventListener('keydown', onKeyDown);
    };
  }, []);

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
    const currentScale = networkRef.current ? networkRef.current.getScale() : 1;

    const nodeUpdates = resolvedNodes.map((node: any) => {
      const id = String(getNodeId(node));
      const dimmed = Boolean(requestedEdgeType && allowedNodeIds && !allowedNodeIds.has(id));
      const colors = getNodeColors(node);
      const font = getNodeFont(node);

      return {
        id,
        label: (!labelsSuppressedRef.current && shouldShowNodeLabel(currentScale)) ? getNodeLabel(node, nodeAttributePreviewRef.current, nodeTypeAttributesRef.current) : "",
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

    const resolvedNodes = (artifactDataRef.current?.nodes || []).map((node: any) =>
      resolveNodeWithDomainIcon(node, nodeTypeIconsRef.current)
    );
    const nodeUpdates = resolvedNodes.map((node: any) => ({
      id: getNodeId(node),
      title: getNodeTooltip(node, scale),
      label: (!labelsSuppressedRef.current && shouldShowNodeLabel(scale)) ? getNodeLabel(node, nodeAttributePreviewRef.current, nodeTypeAttributesRef.current) : ""
    }));
    if (nodeUpdates.length > 0) {
      nodesDataSetRef.current.update(nodeUpdates);
    }

    const edgeUpdates = (artifactDataRef.current?.edges || []).map((edge: any) => ({
      id: String(edge.id),
      title: getEdgeTooltip(edge, scale),
      label: (!labelsSuppressedRef.current && shouldShowEdgeLabel(scale)) ? getEdgeLabel(edge) : ""
    }));
    if (edgeUpdates.length > 0) {
      edgesDataSetRef.current.update(edgeUpdates);
    }
  }, []);

  const setLabelsSuppressed = useCallback((suppressed: boolean) => {
    labelsSuppressedRef.current = suppressed;
    const scale = networkRef.current ? networkRef.current.getScale() : 1;
    updateNodeTooltipsByScale(scale);
    applyConnectPreview();
  }, [applyConnectPreview, updateNodeTooltipsByScale]);

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

  const buildPluginContextFromSelection = useCallback((
    selectedNodes: string[],
    selectedEdges: string[]
  ): PluginExecutionContext => {
    return {
      selected_nodes: selectedNodes,
      selected_edges: selectedEdges
    };
  }, []);

  const closePluginMenu = useCallback(() => {
    setPluginMenu(null);
  }, []);

  const runPluginFromMenu = useCallback(async (plugin: ApiPlugin, context: PluginExecutionContext) => {
    try {
      const params = await collectPluginParamsWithPrompts(plugin, artifact.project_id);
      if (params === null) return;

      const beforeNodeIds = new Set(((artifact.data?.nodes || []) as any[]).map((node: any) => String(node?.id ?? node?.node_id ?? '')));

      const hasMenuSelection =
        (Array.isArray(context?.selected_nodes) && context.selected_nodes.length > 0) ||
        (Array.isArray(context?.selected_edges) && context.selected_edges.length > 0);
      const liveContext = hasMenuSelection
        ? context
        : (
          networkRef.current
            ? buildPluginContextFromSelection(
                networkRef.current.getSelectedNodes().map((id: any) => String(id)),
                networkRef.current.getSelectedEdges().map((id: any) => String(id))
              )
            : context
        );

      const response = await pluginApi.execute(
        plugin.id,
        artifact.project_id,
        [artifact.id],
        params,
        liveContext
      );

      await dispatch(fetchArtifacts(artifact.project_id));

      const created = response?.created || [];
      if (created.length > 0) {
        dispatch(setCurrentArtifact(created[0].id));
      }

      const updatedCurrent = (response as any)?.updated?.find((item: any) => Number(item?.id) === Number(artifact.id));
      const nextNodes = Array.isArray(updatedCurrent?.data?.nodes) ? updatedCurrent.data.nodes : [];
      const newNodeIds = nextNodes
        .map((node: any) => String(node?.id ?? node?.node_id ?? ''))
        .filter((id: string) => id && !beforeNodeIds.has(id));

      const updatedMeta = updatedCurrent?.metadata || {};
      if (updatedMeta?.communications_selection_exceeded) {
        const limit = Number(updatedMeta?.communications_selection_limit || 150);
        const total = Number(updatedMeta?.communications_selected_total || 0);
        window.alert(`\u0412\u044b\u0434\u0435\u043b\u0435\u043d\u043e ${total} \u0430\u0431\u043e\u043d\u0435\u043d\u0442\u043e\u0432. \u041b\u0438\u043c\u0438\u0442 \u0434\u043b\u044f \u0437\u0430\u043f\u0443\u0441\u043a\u0430 \u043f\u043b\u0430\u0433\u0438\u043d\u0430: ${limit}. \u041f\u043e\u0436\u0430\u043b\u0443\u0439\u0441\u0442\u0430, \u0437\u0430\u043f\u0443\u0441\u043a\u0430\u0439\u0442\u0435 \u0440\u0430\u0441\u0448\u0438\u0440\u0435\u043d\u0438\u0435 \u0447\u0430\u0441\u0442\u044f\u043c\u0438.`);
      } else if (updatedMeta?.communications_selection_limited) {
        const limit = Number(updatedMeta?.communications_selection_limit || 0);
        window.alert(`\u041e\u0431\u0440\u0430\u0431\u043e\u0442\u0430\u043d\u043e \u0442\u043e\u043b\u044c\u043a\u043e \u043f\u0435\u0440\u0432\u044b\u0435 ${limit} \u0430\u0431\u043e\u043d\u0435\u043d\u0442\u043e\u0432 \u0438\u0437 \u0432\u044b\u0434\u0435\u043b\u0435\u043d\u0438\u044f. \u0414\u043b\u044f \u043e\u0441\u0442\u0430\u043b\u044c\u043d\u044b\u0445 \u0437\u0430\u043f\u0443\u0441\u0442\u0438\u0442\u0435 \u043f\u043b\u0430\u0433\u0438\u043d \u043f\u043e\u0432\u0442\u043e\u0440\u043d\u043e.`);
      }
      if (newNodeIds.length > 0) {
        const maxAutoLayout = Number(layoutConfig.pluginAutoLayout?.maxNewNodes || 80);
        const autoLayout = newNodeIds.length <= maxAutoLayout;
        window.dispatchEvent(new CustomEvent("graph:run-physics-layout", { detail: { newNodeIds, autoLayout } }));
      }
    } catch (error: any) {
      const detail = error?.response?.data?.detail || error?.message || '\u041d\u0435 \u0443\u0434\u0430\u043b\u043e\u0441\u044c \u0437\u0430\u043f\u0443\u0441\u0442\u0438\u0442\u044c \u043f\u043b\u0430\u0433\u0438\u043d.';
      window.alert(detail);
    } finally {
      closePluginMenu();
    }
  }, [artifact.id, artifact.project_id, closePluginMenu, dispatch]);

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
        label: (!labelsSuppressedRef.current && shouldShowNodeLabel(1)) ? getNodeLabel(node, nodeAttributePreviewRef.current, nodeTypeAttributesRef.current) : "",
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
      edges.map((edge: any) => buildEdgeForVis(edge, nodeRadiusById, edgeCurveMap, 1, labelsSuppressedRef.current))
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
    updateNodeTooltipsByScale(network.getScale());

    const onZoom = () => {
      updateNodeTooltipsByScale(network.getScale());
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

    network.on('select', updateSelectionFromNetwork);
    network.on('deselectNode', updateSelectionFromNetwork);
    network.on('deselectEdge', updateSelectionFromNetwork);

    
    const openPluginMenuAt = async (
      domPoint: { x: number; y: number },
      clickedNodes: string[] = [],
      clickedEdges: string[] = []
    ) => {
      let contextNodes = clickedNodes;
      let contextEdges = clickedEdges;

      if (contextNodes.length > 0) {
        contextNodes = [String(contextNodes[0])];
        contextEdges = [];
        network.setSelection({ nodes: contextNodes, edges: contextEdges }, { unselectAll: true, highlightEdges: false });
      } else if (contextEdges.length > 0) {
        contextNodes = [];
        contextEdges = [String(contextEdges[0])];
        network.setSelection({ nodes: contextNodes, edges: contextEdges }, { unselectAll: true, highlightEdges: false });
      } else {
        contextNodes = network.getSelectedNodes().map((id: any) => String(id));
        contextEdges = network.getSelectedEdges().map((id: any) => String(id));
      }

      updateSelectionFromNetwork();

      const context = buildPluginContextFromSelection(contextNodes, contextEdges);

      setPluginMenu({
        x: Number(domPoint.x || 0),
        y: Number(domPoint.y || 0),
        context,
        plugins: [],
        loading: true,
      });

      try {
        const response = await pluginApi.applicable(artifact.project_id, artifact.id, context);
        setPluginMenu((prev) => {
          if (!prev) return prev;
          return { ...prev, loading: false, plugins: response?.plugins || [] };
        });
      } catch {
        setPluginMenu((prev) => {
          if (!prev) return prev;
          return { ...prev, loading: false, plugins: [] };
        });
      }
    };

    network.on('oncontext', async (params: any) => {
      params?.event?.preventDefault?.();
      const domPoint = params?.pointer?.DOM || params?.event?.center || { x: 0, y: 0 };
      const clickedNodes = Array.isArray(params?.nodes) ? params.nodes.map((id: any) => String(id)) : [];
      const clickedEdges = Array.isArray(params?.edges) ? params.edges.map((id: any) => String(id)) : [];
      if (clickedNodes.length === 0 && clickedEdges.length === 0) {
        const hoveredNode = network.getNodeAt(domPoint as any);
        const hoveredEdge = network.getEdgeAt(domPoint as any);
        if (hoveredNode !== undefined && hoveredNode !== null) {
          clickedNodes.push(String(hoveredNode));
        } else if (hoveredEdge !== undefined && hoveredEdge !== null) {
          clickedEdges.push(String(hoveredEdge));
        }
      }
      await openPluginMenuAt(domPoint, clickedNodes, clickedEdges);
    });

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

      if (!connectModeRef.current) {
        const clickedNodes = Array.isArray(params?.nodes) ? params.nodes.map((id: any) => String(id)) : [];
        const clickedEdges = Array.isArray(params?.edges) ? params.edges.map((id: any) => String(id)) : [];
        const additive = Boolean(
          params?.event?.srcEvent?.shiftKey ||
          params?.event?.srcEvent?.ctrlKey ||
          params?.event?.srcEvent?.metaKey
        );

        if (clickedNodes.length === 0 && clickedEdges.length === 0) {
          network.unselectAll();
          updateSelectionFromNetwork();
          return;
        }

        if (additive) {
          const nodeSet = new Set(network.getSelectedNodes().map((id: any) => String(id)));
          const edgeSet = new Set(network.getSelectedEdges().map((id: any) => String(id)));
          clickedNodes.forEach((id: string) => nodeSet.add(id));
          clickedEdges.forEach((id: string) => edgeSet.add(id));
          network.setSelection({ nodes: Array.from(nodeSet), edges: Array.from(edgeSet) }, { unselectAll: true, highlightEdges: false });
        } else {
          network.setSelection({ nodes: clickedNodes, edges: clickedEdges }, { unselectAll: true, highlightEdges: false });
        }

        updateSelectionFromNetwork();
        return;
      }
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
            window.alert('\u041d\u0430\u0447\u0430\u043b\u044c\u043d\u044b\u0439 \u0443\u0437\u0435\u043b \u043d\u0435 \u043f\u043e\u0434\u0445\u043e\u0434\u0438\u0442 \u0434\u043b\u044f \u0432\u044b\u0431\u0440\u0430\u043d\u043d\u043e\u0433\u043e \u0442\u0438\u043f\u0430 \u0441\u0432\u044f\u0437\u0438.');
            return;
          }
        }

        setEdgeSourceId(clickedNodeId);
        return;
      }

      let edgeType = 'connected_to';
      const requestedEdgeType = connectTypeRef.current ? String(connectTypeRef.current) : null;

      if (requestedEdgeType) {
        edgeType = requestedEdgeType;
      } else {
        const data = artifactDataRef.current || {};
        const nodesById = new Map((data.nodes || []).map((node: any) => [String(getNodeId(node)), node]));
        const sourceNode = nodesById.get(sourceId);
        const targetNode = nodesById.get(clickedNodeId);
        const sourceType = String(sourceNode?.type || '');
        const targetType = String(targetNode?.type || '');
        const resolvedType = resolveAllowedEdgeType(sourceType, targetType);

        if (!resolvedType) {
          window.alert('\u0414\u043b\u044f \u0432\u044b\u0431\u0440\u0430\u043d\u043d\u043e\u0439 \u043f\u0430\u0440\u044b \u0443\u0437\u043b\u043e\u0432 \u043d\u0435\u0442 \u0434\u043e\u043f\u0443\u0441\u0442\u0438\u043c\u043e\u0433\u043e \u0442\u0438\u043f\u0430 \u0441\u0432\u044f\u0437\u0438.');
          setEdgeSourceId(null);
          if (!requestedEdgeType) setConnectMode(false);
          return;
        }

        edgeType = resolvedType;
      }

      if (clickedNodeId === sourceId) {
        window.alert('\u041d\u0435\u043b\u044c\u0437\u044f \u0441\u043e\u0437\u0434\u0430\u0442\u044c \u0441\u0432\u044f\u0437\u044c \u0443\u0437\u043b\u0430 \u0441 \u0441\u0430\u043c\u0438\u043c \u0441\u043e\u0431\u043e\u0439.');
        setEdgeSourceId(null);
        if (!requestedEdgeType) setConnectMode(false);
        return;
      }

      if (requestedEdgeType) {
        const data = artifactDataRef.current || {};
        const nodesById = new Map((data.nodes || []).map((node: any) => [String(getNodeId(node)), node]));
        const sourceNode = nodesById.get(sourceId);
        const targetNode = nodesById.get(clickedNodeId);
        const sourceType = String(sourceNode?.type || '');
        const targetType = String(targetNode?.type || '');

        if (!isAllowedForEdgeType(requestedEdgeType, sourceType, targetType)) {
          window.alert('\u042d\u0442\u043e\u0442 \u0442\u0438\u043f \u0441\u0432\u044f\u0437\u0438 \u043d\u0435\u043b\u044c\u0437\u044f \u0441\u043e\u0437\u0434\u0430\u0442\u044c \u043c\u0435\u0436\u0434\u0443 \u0432\u044b\u0431\u0440\u0430\u043d\u043d\u044b\u043c\u0438 \u0443\u0437\u043b\u0430\u043c\u0438.');
          setEdgeSourceId(null);
          onConnectCompleteRef.current?.();
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
      id: getNodeId(node),
        label: (!labelsSuppressedRef.current && shouldShowNodeLabel(currentScale)) ? getNodeLabel(node, nodeAttributePreviewRef.current, nodeTypeAttributesRef.current) : "",
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
    const edgesData = (artifact.data?.edges || []).map((edge: any) => buildEdgeForVis(edge, nodeRadiusById, edgeCurveMap, currentScale, labelsSuppressedRef.current));

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
  useEffect(() => {
    const isTypingTarget = (target: EventTarget | null) => {
      if (!(target instanceof HTMLElement)) return false;
      const tag = target.tagName.toLowerCase();
      return tag === 'input' || tag === 'textarea' || tag === 'select' || target.isContentEditable;
    };

    const onKeyDown = (event: KeyboardEvent) => {
      if (isTypingTarget(event.target)) return;
      if (!networkRef.current) return;
      if (!nodesDataSetRef.current) return;

      const isSelectAll = (event.ctrlKey || event.metaKey) && (event.code === 'KeyA' || event.key.toLowerCase() === 'a' || event.key.toLowerCase() === 'Р В Р Р‹Р Р†Р вЂљРЎвЂє');
      if (isSelectAll) {
        event.preventDefault();
        const allNodeIds = nodesDataSetRef.current.getIds().map((id: any) => String(id));
        if (!allNodeIds.length) return;
        networkRef.current.setSelection({ nodes: allNodeIds, edges: [] }, { unselectAll: true, highlightEdges: false });
        return;
      }

      if (event.key !== 'Delete') return;

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
    const wrapped = getNodeLabel(node, nodeAttributePreviewRef.current, nodeTypeAttributesRef.current) || String(node?.label || '');
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
  const handleBalancedLayoutClick = useCallback(async (forceAll = false, explicitIds?: string[]) => {
    if (!networkRef.current || !nodesDataSetRef.current) return;

    const data = artifactDataRef.current || {};
    const allNodes = data.nodes || [];
    if (!allNodes.length) return;

    const selectedIds = networkRef.current.getSelectedNodes().map((id) => String(id));
    const targetIds = (explicitIds && explicitIds.length)
      ? explicitIds
      : ((!forceAll && selectedIds.length)
          ? selectedIds
          : allNodes.map((node: any) => String(getNodeId(node))));

    if (targetIds.length <= 1) return;

    setLabelsSuppressed(true);
    try {
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
    } finally {
      setLabelsSuppressed(false);
    }
  }, [onNodeMove, onNodesMove, setLabelsSuppressed, updateSelectionFromNetwork]);

  useEffect(() => {
    const handler = (event: Event) => {
      const detail = (event as CustomEvent<any>)?.detail || {};
      const newNodeIds = Array.isArray(detail.newNodeIds) ? detail.newNodeIds.map((id: any) => String(id)).filter(Boolean) : [];
      if (newNodeIds.length === 0) return;
      const autoLayout = detail.autoLayout !== false;
      setPendingPluginNodeIds((prev) => Array.from(new Set([...prev, ...newNodeIds])));
      if (!autoLayout) return;

      const tryRun = (attempt = 0) => {
        const ds = nodesDataSetRef.current;
        const availableIds = newNodeIds.filter((id) => Boolean(ds?.get(id)));
        if (!availableIds.length) {
          if (attempt < 12) {
            window.setTimeout(() => tryRun(attempt + 1), 150);
          }
          return;
        }
        networkRef.current?.selectNodes(availableIds, false);
        void handleBalancedLayoutClick(false, availableIds).then(() => {
          setPendingPluginNodeIds((prev) => prev.filter((id) => !availableIds.includes(id)));
        });
      };
      tryRun();
    };

    window.addEventListener("graph:run-physics-layout", handler as EventListener);
    return () => window.removeEventListener("graph:run-physics-layout", handler as EventListener);
  }, [handleBalancedLayoutClick]);

  useEffect(() => {
    const handler = (event: Event) => {
      if (!networkRef.current) return;
      const detail = (event as CustomEvent<any>)?.detail || {};
      const nodeIds = Array.isArray(detail.nodeIds) ? detail.nodeIds.map((id: any) => String(id)) : [];
      const edgeIds = Array.isArray(detail.edgeIds) ? detail.edgeIds.map((id: any) => String(id)) : [];
      networkRef.current.setSelection({ nodes: nodeIds, edges: edgeIds }, { unselectAll: true, highlightEdges: false });
      updateSelectionFromNetwork();
    };

    window.addEventListener('graph:set-selection', handler as EventListener);
    return () => window.removeEventListener('graph:set-selection', handler as EventListener);
  }, [updateSelectionFromNetwork]);


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

    setLabelsSuppressed(true);
    try {
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
    } finally {
      setLabelsSuppressed(false);
    }
  }, [onNodeMove, onNodesMove, setLabelsSuppressed, updateSelectionFromNetwork]);

  const handleSelectConnectedEdges = useCallback(() => {
    if (!networkRef.current) return;

    const selectedNodeIds = networkRef.current.getSelectedNodes().map((id) => String(id));
    if (selectedNodeIds.length === 0) return;

    const data = artifactDataRef.current || {};
    const edgeIds = new Set<string>(networkRef.current.getSelectedEdges().map((id) => String(id)));

    (data.edges || []).forEach((edge: any) => {
      const fromId = String(edge.from || edge.source_node || '');
      const toId = String(edge.to || edge.target_node || '');
      if (selectedNodeIds.includes(fromId) || selectedNodeIds.includes(toId)) {
        edgeIds.add(String(edge.id));
      }
    });

    networkRef.current.setSelection({ nodes: selectedNodeIds, edges: Array.from(edgeIds) }, { unselectAll: true, highlightEdges: false });
    updateSelectionFromNetwork();
  }, [updateSelectionFromNetwork]);

  const handleSelectEndpoints = useCallback(() => {
    if (!networkRef.current) return;

    const data = artifactDataRef.current || {};
    const selectedNodeIds = new Set<string>(networkRef.current.getSelectedNodes().map((id) => String(id)));
    const selectedEdgeIds = new Set<string>(networkRef.current.getSelectedEdges().map((id) => String(id)));
    if (selectedEdgeIds.size === 0) return;

    (data.edges || []).forEach((edge: any) => {
      const edgeId = String(edge.id);
      if (!selectedEdgeIds.has(edgeId)) return;

      const fromId = String(edge.from || edge.source_node || '');
      const toId = String(edge.to || edge.target_node || '');
      selectedNodeIds.add(fromId);
      selectedNodeIds.add(toId);
    });

    networkRef.current.setSelection({ nodes: Array.from(selectedNodeIds), edges: Array.from(selectedEdgeIds) }, { unselectAll: true, highlightEdges: false });
    updateSelectionFromNetwork();
  }, [updateSelectionFromNetwork]);
  const handleFitClick = useCallback(() => {
    if (!networkRef.current) return;
    networkRef.current.fit({ animation: true, duration: 250 });
  }, []);

  const handleFitSelectionClick = useCallback(() => {
    if (!networkRef.current) return;

    const selectedNodeIds = networkRef.current.getSelectedNodes().map((id) => String(id));
    const selectedEdgeIds = networkRef.current.getSelectedEdges().map((id) => String(id));
    const targetNodes = new Set<string>(selectedNodeIds);

    if (selectedEdgeIds.length > 0) {
      const edges = (artifactDataRef.current?.edges || []) as any[];
      edges.forEach((edge: any) => {
        if (!selectedEdgeIds.includes(String(edge.id))) return;
        targetNodes.add(String(edge.from || edge.source_node || ''));
        targetNodes.add(String(edge.to || edge.target_node || ''));
      });
    }

    const nodeIds = Array.from(targetNodes).filter(Boolean);
    if (!nodeIds.length) return;

    networkRef.current.fit({
      nodes: nodeIds,
      animation: { duration: 250, easingFunction: 'easeInOutQuad' }
    });
  }, []);

  const handleInvertSelectionClick = useCallback(() => {
    if (!networkRef.current || !nodesDataSetRef.current || !edgesDataSetRef.current) return;

    const allNodeIds = nodesDataSetRef.current.getIds().map((id: any) => String(id));
    const allEdgeIds = edgesDataSetRef.current.getIds().map((id: any) => String(id));
    const selectedNodeIds = new Set(networkRef.current.getSelectedNodes().map((id: any) => String(id)));
    const selectedEdgeIds = new Set(networkRef.current.getSelectedEdges().map((id: any) => String(id)));

    const nextNodeIds = allNodeIds.filter((id) => !selectedNodeIds.has(id));
    const nextEdgeIds = allEdgeIds.filter((id) => !selectedEdgeIds.has(id));

    networkRef.current.setSelection({ nodes: nextNodeIds, edges: nextEdgeIds }, { unselectAll: true, highlightEdges: false });
    updateSelectionFromNetwork();
  }, [updateSelectionFromNetwork]);

  const handleLayoutNewNodesClick = useCallback(async () => {
    if (pendingPluginNodeIds.length === 0) return;
    const ds = nodesDataSetRef.current;
    const availableIds = pendingPluginNodeIds.filter((id) => Boolean(ds?.get(id)));
    if (availableIds.length === 0) {
      setPendingPluginNodeIds([]);
      return;
    }
    networkRef.current?.selectNodes(availableIds, false);
    await handleBalancedLayoutClick(false, availableIds);
    setPendingPluginNodeIds((prev) => prev.filter((id) => !availableIds.includes(id)));
  }, [handleBalancedLayoutClick, pendingPluginNodeIds]);

  useEffect(() => {
    setPendingPluginNodeIds([]);
  }, [artifact.id]);
  const handleHistoryJump = useCallback((state: any) => {
    console.log('[GraphView] History jump');

  }, []);
  const pluginMenuTree = useMemo(() => buildPluginMenuTree(pluginMenu?.plugins || []), [pluginMenu?.plugins]);
  const menuMaxWidth = 360;
  const menuMaxHeight = 440;
  const pluginMenuLeft = pluginMenu ? Math.max(8, Math.min(pluginMenu.x + 8, (containerRef.current?.clientWidth || 800) - menuMaxWidth - 8)) : 8;
  const pluginMenuTop = pluginMenu ? Math.max(GRAPH_TOOLBAR_HEIGHT + 8, Math.min(pluginMenu.y + GRAPH_TOOLBAR_HEIGHT + 8, GRAPH_TOOLBAR_HEIGHT + (containerRef.current?.clientHeight || 600) - menuMaxHeight - 8)) : GRAPH_TOOLBAR_HEIGHT + 8;
  const getPluginMenuEntries = useCallback((node: PluginMenuNode | null): PluginMenuEntry[] => {
    const folders = (node ? node.children : pluginMenuTree).map((child) => ({
      kind: 'folder' as const,
      key: child.key,
      label: child.label,
      node: child,
    }));

    const plugins = (node ? node.plugins : []).map((plugin) => ({
      kind: 'plugin' as const,
      key: `plugin:${plugin.id}`,
      label: plugin.name,
      plugin,
    }));

    return [...folders, ...plugins];
  }, [pluginMenuTree]);

  const renderPluginMenuRows = (entries: PluginMenuEntry[], depth = 0): React.ReactNode => (
    <>
      {entries.map((entry) => {
        const rowBaseStyle: React.CSSProperties = {
          width: '100%',
          textAlign: 'left',
          border: 'none',
          background: 'transparent',
          color: '#0f172a',
          borderRadius: 4,
          padding: '4px 8px',
          cursor: 'pointer',
          fontSize: 12,
          lineHeight: '16px',
          display: 'block',
          whiteSpace: 'nowrap',
          paddingLeft: `${8 + depth * 14}px`
        };

        if (entry.kind === 'plugin' && entry.plugin) {
          return (
            <button
              key={entry.key}
              type='button'
              onClick={() => runPluginFromMenu(entry.plugin!, pluginMenu?.context || {})}
              style={rowBaseStyle}
            >
              {entry.label}
            </button>
          );
        }

        const folderNode = entry.node;
        if (!folderNode) return null;

        return (
          <React.Fragment key={entry.key}>
            <div
              style={{
                ...rowBaseStyle,
                cursor: 'default',
                color: '#475569',
                fontWeight: 600
              }}
            >
              {entry.label}
            </div>
            {renderPluginMenuRows(getPluginMenuEntries(folderNode), depth + 1)}
          </React.Fragment>
        );
      })}
    </>
  );

  const isGraphEmpty = !artifact.data || (!(artifact.data.nodes?.length) && !(artifact.data.edges?.length));

  return (
    <div className="graph-view" style={{ height: '100%', position: 'relative', background: '#ffffff', overflow: 'hidden' }}>
      
      <div style={{ 
        position: 'absolute', 
        top: 8,
        left: 8,
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
          title="Р В Р’В Р вЂ™Р’В Р В РІР‚в„ўР вЂ™Р’В Р В Р’В Р В Р вЂ№Р В Р вЂ Р В РІР‚С™Р РЋРІР‚СњР В Р’В Р вЂ™Р’В Р В Р’В Р В РІР‚в„–Р В Р’В Р В РІР‚В Р В Р’В Р Р†Р вЂљРЎв„ўР В Р Р‹Р Р†РІР‚С›РЎС›Р В Р’В Р вЂ™Р’В Р В РІР‚в„ўР вЂ™Р’В Р В Р’В Р В Р вЂ№Р В РІР‚в„ўР вЂ™Р’ВР В Р’В Р вЂ™Р’В Р В РІР‚в„ўР вЂ™Р’В Р В Р’В Р Р†Р вЂљРІвЂћСћР В РІР‚в„ўР вЂ™Р’ВµР В Р’В Р вЂ™Р’В Р В РІР‚в„ўР вЂ™Р’В Р В Р’В Р вЂ™Р’В Р В Р вЂ Р В РІР‚С™Р вЂ™Р’В¦Р В Р’В Р вЂ™Р’В Р В РІР‚в„ўР вЂ™Р’В Р В Р’В Р В Р вЂ№Р В Р вЂ Р В РІР‚С™Р вЂ™Р’ВР В Р’В Р вЂ™Р’В Р В Р’В Р В РІР‚в„–Р В Р’В Р В РІР‚В Р В Р’В Р Р†Р вЂљРЎв„ўР В Р Р‹Р Р†РІР‚С›РЎС›Р В Р’В Р вЂ™Р’В Р В Р’В Р В РІР‚в„–Р В Р’В Р вЂ™Р’В Р В Р’В Р Р†Р вЂљР’В° (Ctrl+Z)"
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
          title="Р В Р’В Р вЂ™Р’В Р В РІР‚в„ўР вЂ™Р’В Р В Р’В Р В Р вЂ№Р В Р Р‹Р РЋРЎСџР В Р’В Р вЂ™Р’В Р В РІР‚в„ўР вЂ™Р’В Р В Р’В Р В Р вЂ№Р В Р вЂ Р В РІР‚С™Р РЋРЎвЂєР В Р’В Р вЂ™Р’В Р В РІР‚в„ўР вЂ™Р’В Р В Р’В Р вЂ™Р’В Р В Р вЂ Р В РІР‚С™Р вЂ™Р’В Р В Р’В Р вЂ™Р’В Р В Р’В Р В РІР‚в„–Р В Р’В Р В РІР‚В Р В Р’В Р Р†Р вЂљРЎв„ўР В Р Р‹Р Р†РІР‚С›РЎС›Р В Р’В Р вЂ™Р’В Р В РІР‚в„ўР вЂ™Р’В Р В Р’В Р В Р вЂ№Р В Р вЂ Р В РІР‚С™Р РЋРЎвЂєР В Р’В Р вЂ™Р’В Р В Р’В Р В РІР‚в„–Р В Р’В Р вЂ™Р’В Р В Р вЂ Р В РІР‚С™Р РЋРІвЂћСћР В Р’В Р вЂ™Р’В Р В РІР‚в„ўР вЂ™Р’В Р В Р’В Р В Р вЂ№Р В Р вЂ Р В РІР‚С™Р вЂ™Р’ВР В Р’В Р вЂ™Р’В Р В Р’В Р В РІР‚в„–Р В Р’В Р В РІР‚В Р В Р’В Р Р†Р вЂљРЎв„ўР В Р Р‹Р Р†РІР‚С›РЎС›Р В Р’В Р вЂ™Р’В Р В Р’В Р В РІР‚в„–Р В Р’В Р вЂ™Р’В Р В Р’В Р Р†Р вЂљР’В° (Ctrl+Y)"
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
        {pendingPluginNodeIds.length > 0 && (
          <button
            onClick={handleLayoutNewNodesClick}
            title={"��������� ������ ����� ����"}
            style={{
              padding: "6px 10px",
              background: "#0ea5e9",
              border: "1px solid #0284c7",
              borderRadius: "4px",
              color: "#ffffff",
              cursor: "pointer"
            }}
          >
            {`N+${pendingPluginNodeIds.length}`}
          </button>
        )}
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
          title={"Р В Р’В Р вЂ™Р’В Р В РІР‚в„ўР вЂ™Р’В Р В Р’В Р Р†Р вЂљРІвЂћСћР В РІР‚в„ўР вЂ™Р’В¤Р В Р’В Р вЂ™Р’В Р В РІР‚в„ўР вЂ™Р’В Р В Р’В Р В Р вЂ№Р В Р вЂ Р В РІР‚С™Р вЂ™Р’ВР В Р’В Р вЂ™Р’В Р В РІР‚в„ўР вЂ™Р’В Р В Р’В Р Р†Р вЂљРІвЂћСћР В РІР‚в„ўР вЂ™Р’В·Р В Р’В Р вЂ™Р’В Р В РІР‚в„ўР вЂ™Р’В Р В Р’В Р В Р вЂ№Р В Р вЂ Р В РІР‚С™Р вЂ™Р’ВР В Р’В Р вЂ™Р’В Р В Р’В Р В РІР‚в„–Р В Р’В Р В РІР‚В Р В Р’В Р Р†Р вЂљРЎв„ўР В Р’В Р В РІР‚в„–Р В Р’В Р вЂ™Р’В Р В РІР‚в„ўР вЂ™Р’В Р В Р’В Р Р†Р вЂљРІвЂћСћР В РІР‚в„ўР вЂ™Р’ВµР В Р’В Р вЂ™Р’В Р В Р’В Р В РІР‚в„–Р В Р’В Р вЂ™Р’В Р В Р Р‹Р Р†Р вЂљРЎС™Р В Р’В Р вЂ™Р’В Р В РІР‚в„ўР вЂ™Р’В Р В Р’В Р В Р вЂ№Р В Р вЂ Р В РІР‚С™Р РЋРЎС™Р В Р’В Р вЂ™Р’В Р В РІР‚в„ўР вЂ™Р’В Р В Р’В Р Р†Р вЂљРІвЂћСћР В РІР‚в„ўР вЂ™Р’В°Р В Р’В Р вЂ™Р’В Р В Р’В Р В РІР‚в„–Р В Р’В Р вЂ™Р’В Р В Р’В Р В Р РЏ Р В Р’В Р вЂ™Р’В Р В Р’В Р В РІР‚в„–Р В Р’В Р вЂ™Р’В Р В Р вЂ Р В РІР‚С™Р РЋРІвЂћСћР В Р’В Р вЂ™Р’В Р В РІР‚в„ўР вЂ™Р’В Р В Р’В Р Р†Р вЂљРІвЂћСћР В РІР‚в„ўР вЂ™Р’В°Р В Р’В Р вЂ™Р’В Р В Р’В Р В РІР‚в„–Р В Р’В Р вЂ™Р’В Р В Р Р‹Р Р†Р вЂљРЎС™Р В Р’В Р вЂ™Р’В Р В РІР‚в„ўР вЂ™Р’В Р В Р’В Р В Р вЂ№Р В Р вЂ Р В РІР‚С™Р РЋРЎС™Р В Р’В Р вЂ™Р’В Р В РІР‚в„ўР вЂ™Р’В Р В Р’В Р Р†Р вЂљРІвЂћСћР В РІР‚в„ўР вЂ™Р’В»Р В Р’В Р вЂ™Р’В Р В РІР‚в„ўР вЂ™Р’В Р В Р’В Р Р†Р вЂљРІвЂћСћР В РІР‚в„ўР вЂ™Р’В°Р В Р’В Р вЂ™Р’В Р В РІР‚в„ўР вЂ™Р’В Р В Р’В Р РЋРЎвЂєР В Р вЂ Р В РІР‚С™Р вЂ™Р’ВР В Р’В Р вЂ™Р’В Р В РІР‚в„ўР вЂ™Р’В Р В Р’В Р В Р вЂ№Р В Р вЂ Р В РІР‚С™Р РЋРЎС™Р В Р’В Р вЂ™Р’В Р В РІР‚в„ўР вЂ™Р’В Р В Р’В Р Р†Р вЂљРІвЂћСћР В РІР‚в„ўР вЂ™Р’В°"}
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
          title="Р В Р’В Р вЂ™Р’В Р В РІР‚в„ўР вЂ™Р’В Р В Р’В Р В Р вЂ№Р В Р Р‹Р РЋРЎСџР В Р’В Р вЂ™Р’В Р В РІР‚в„ўР вЂ™Р’В Р В Р’В Р В Р вЂ№Р В Р вЂ Р В РІР‚С™Р РЋРЎвЂєР В Р’В Р вЂ™Р’В Р В РІР‚в„ўР вЂ™Р’В Р В Р’В Р В Р вЂ№Р В Р вЂ Р В РІР‚С™Р РЋРЎС™Р В Р’В Р вЂ™Р’В Р В РІР‚в„ўР вЂ™Р’В Р В Р’В Р Р†Р вЂљРІвЂћСћР В РІР‚в„ўР вЂ™Р’В°Р В Р’В Р вЂ™Р’В Р В РІР‚в„ўР вЂ™Р’В Р В Р’В Р Р†Р вЂљРІвЂћСћР В РІР‚в„ўР вЂ™Р’В·Р В Р’В Р вЂ™Р’В Р В РІР‚в„ўР вЂ™Р’В Р В Р’В Р Р†Р вЂљРІвЂћСћР В РІР‚в„ўР вЂ™Р’В°Р В Р’В Р вЂ™Р’В Р В Р’В Р В РІР‚в„–Р В Р’В Р В РІР‚В Р В Р’В Р Р†Р вЂљРЎв„ўР В Р Р‹Р Р†РІР‚С›РЎС›Р В Р’В Р вЂ™Р’В Р В Р’В Р В РІР‚в„–Р В Р’В Р вЂ™Р’В Р В Р’В Р Р†Р вЂљР’В° Р В Р’В Р вЂ™Р’В Р В Р’В Р В РІР‚в„–Р В Р’В Р В РІР‚В Р В Р’В Р Р†Р вЂљРЎв„ўР В РІР‚в„ўР вЂ™Р’В Р В Р’В Р вЂ™Р’В Р В РІР‚в„ўР вЂ™Р’В Р В Р’В Р Р†Р вЂљРІвЂћСћР В РІР‚в„ўР вЂ™Р’ВµР В Р’В Р вЂ™Р’В Р В РІР‚в„ўР вЂ™Р’В Р В Р’В Р Р†Р вЂљРІвЂћСћР В РІР‚в„ўР вЂ™Р’В»Р В Р’В Р вЂ™Р’В Р В РІР‚в„ўР вЂ™Р’В Р В Р’В Р В Р вЂ№Р В Р вЂ Р В РІР‚С™Р вЂ™Р’ВР В Р’В Р вЂ™Р’В Р В РІР‚в„ўР вЂ™Р’В Р В Р’В Р В Р вЂ№Р В Р вЂ Р В РІР‚С™Р РЋРЎС™Р В Р’В Р вЂ™Р’В Р В РІР‚в„ўР вЂ™Р’В Р В Р’В Р В Р вЂ№Р В Р вЂ Р В РІР‚С™Р РЋРЎвЂєР В Р’В Р вЂ™Р’В Р В РІР‚в„ўР вЂ™Р’В Р В Р’В Р В Р вЂ№Р В РІР‚в„ўР вЂ™Р’В"
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
        <button
          onClick={handleFitSelectionClick}
          title={"��������������� ����� �� ���������� ���������"}
          style={{
            padding: '6px 10px',
            background: '#2563eb',
            border: '1px solid #2563eb',
            borderRadius: '4px',
            color: '#ffffff',
            cursor: 'pointer'
          }}
        >
          {'?'}
        </button>
        <button
          onClick={handleInvertSelectionClick}
          title={"������������� ���������"}
          style={{
            padding: '6px 10px',
            background: '#2563eb',
            border: '1px solid #2563eb',
            borderRadius: '4px',
            color: '#ffffff',
            cursor: 'pointer'
          }}
        >
          {'?'}
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
            {`\u041a\u043b\u0438\u043a\u043d\u0438\u0442\u0435 \u043f\u043e \u0433\u0440\u0430\u0444\u0443 \u0434\u043b\u044f \u0434\u043e\u0431\u0430\u0432\u043b\u0435\u043d\u0438\u044f \u0443\u0437\u043b\u0430: ${nodeCreateSpec.label}`}
          </div>
        )}
        {connectType && (
          <div style={{ background: '#2563eb', color: 'white', padding: '4px 12px', borderRadius: '4px', fontSize: '12px' }}>
            {edgeSourceId
              ? '\u0412\u044b\u0431\u0435\u0440\u0438\u0442\u0435 \u043a\u043e\u043d\u0435\u0447\u043d\u044b\u0439 \u0443\u0437\u0435\u043b \u0434\u043b\u044f \u0441\u043e\u0437\u0434\u0430\u043d\u0438\u044f \u0441\u0432\u044f\u0437\u0438'
              : '\u0412\u044b\u0431\u0435\u0440\u0438\u0442\u0435 \u043d\u0430\u0447\u0430\u043b\u044c\u043d\u044b\u0439 \u0443\u0437\u0435\u043b \u0434\u043b\u044f \u0441\u043e\u0437\u0434\u0430\u043d\u0438\u044f \u0441\u0432\u044f\u0437\u0438'}
          </div>
        )}
      </div>

      
      {pluginMenu && (
        <div
          ref={pluginMenuRef}
          style={{
            position: 'absolute',
            left: pluginMenuLeft,
            top: pluginMenuTop,
            zIndex: 1000,
            minWidth: 240,
            maxWidth: 300,
            background: '#ffffff',
            border: '1px solid #d7deea',
            borderRadius: 8,
            boxShadow: '0 12px 28px rgba(15, 23, 42, 0.16)',
            padding: 6
          }}
        >


          <button
            type='button'
            onClick={() => {
              handleSelectConnectedEdges();
              closePluginMenu();
            }}
            disabled={!pluginMenu.context.selected_nodes || pluginMenu.context.selected_nodes.length === 0}
            style={{
              width: '100%',
              textAlign: 'left',
              border: 'none',
              background: 'transparent',
              color: '#0f172a',
              borderRadius: 4,
              padding: '5px 8px',
              cursor: (!pluginMenu.context.selected_nodes || pluginMenu.context.selected_nodes.length === 0) ? 'not-allowed' : 'pointer',
              opacity: (!pluginMenu.context.selected_nodes || pluginMenu.context.selected_nodes.length === 0) ? 0.5 : 1,
              fontSize: 12,
              lineHeight: '16px'
            }}
          >
            {'\u0412\u044b\u0434\u0435\u043b\u0438\u0442\u044c \u0441\u0432\u044f\u0437\u0438'}
          </button>

          <button
            type='button'
            onClick={() => {
              handleSelectEndpoints();
              closePluginMenu();
            }}
            disabled={!pluginMenu.context.selected_edges || pluginMenu.context.selected_edges.length === 0}
            style={{
              width: '100%',
              textAlign: 'left',
              border: 'none',
              background: 'transparent',
              color: '#0f172a',
              borderRadius: 4,
              padding: '5px 8px',
              cursor: (!pluginMenu.context.selected_edges || pluginMenu.context.selected_edges.length === 0) ? 'not-allowed' : 'pointer',
              opacity: (!pluginMenu.context.selected_edges || pluginMenu.context.selected_edges.length === 0) ? 0.5 : 1,
              fontSize: 12,
              lineHeight: '16px'
            }}
          >
            {'\u0412\u044b\u0434\u0435\u043b\u0438\u0442\u044c \u043e\u043a\u043e\u043d\u0447\u0430\u043d\u0438\u044f'}
          </button>

          <div style={{ height: 1, background: '#eef2f7', margin: '4px 0 6px 0' }} />

          {pluginMenu.loading && (
            <div style={{ fontSize: 12, color: '#334155', padding: '6px 8px' }}>{'\u0417\u0430\u0433\u0440\u0443\u0437\u043a\u0430...'}</div>
          )}
          {!pluginMenu.loading && pluginMenuTree.length === 0 && (
            <div style={{ fontSize: 12, color: '#64748b', padding: '6px 8px' }}>{'\u041d\u0435\u0442 \u0434\u043e\u0441\u0442\u0443\u043f\u043d\u044b\u0445 \u043f\u043b\u0430\u0433\u0438\u043d\u043e\u0432'}</div>
          )}
          {!pluginMenu.loading && renderPluginMenuRows(getPluginMenuEntries(null))}
        </div>
      )}

      {isGraphEmpty && (
        <div style={{
          position: 'absolute',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          textAlign: 'center',
          color: '#64748b',
          pointerEvents: 'none',
          zIndex: 2
        }}>
          <h3 style={{ margin: '0 0 8px 0' }}>{'\u041f\u0443\u0441\u0442\u043e\u0439 \u0433\u0440\u0430\u0444'}</h3>
          <p style={{ margin: 0 }}>{'\u041a\u043b\u0438\u043a\u043d\u0438\u0442\u0435 \u043f\u043e \u043f\u043e\u043b\u044e, \u0447\u0442\u043e\u0431\u044b \u0441\u043e\u0437\u0434\u0430\u0442\u044c \u043f\u0435\u0440\u0432\u0443\u044e \u0432\u0435\u0440\u0448\u0438\u043d\u0443'}</p>
        </div>
      )}
      <div ref={containerRef} style={{ width: '100%', height: `calc(100% - ${GRAPH_TOOLBAR_HEIGHT}px)`, marginTop: `${GRAPH_TOOLBAR_HEIGHT}px` }} />

    </div>
  );
};

export default GraphView;








































