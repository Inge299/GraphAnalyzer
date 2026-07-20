import { layoutConfig } from '../../config/layout';

export type NodeAttributePreviewRuntime = {
  enabled: boolean;
  maxLinesPerField: number;
  defaultMarker: string;
  fields: Record<string, { marker?: string; maxLines?: number; visibleOnGraph?: boolean; label?: string }>;
};

export type NodeTypeAttributeRuntime = {
  label: string;
  type: string;
};

const NODE_SYSTEM_KEYS = new Set(['visual', 'label', 'color', 'icon', 'iconScale', 'ringEnabled', 'ringWidth']);

export const GRAPH_TOOLBAR_HEIGHT = 52;

export const getNodeId = (node: any) => node.id || node.node_id;

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
      : cfg.visibleOnGraph === true;
    if (!isVisible) continue;

    const rawValue = attributes[key];
    const values = Array.isArray(rawValue) ? rawValue : rawValue ? [rawValue] : [];
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

export const getNodeLabel = (
  node: any,
  preview: NodeAttributePreviewRuntime,
  nodeTypeAttributesMap: Record<string, Record<string, NodeTypeAttributeRuntime>> = {}
) => {
  const base = wrapLabel(getNodeBaseLabel(node), 22);
  const extra = getNodeAttributePreviewLines(node, preview, nodeTypeAttributesMap);
  if (extra.length === 0) return base;
  return [base, ...extra.map((line) => wrapLabel(line, 34))].join('\n');
};

export const getNodeTooltip = (node: any, scale: number) => {
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
      (attrs?.contacts_count !== undefined ? `contacts: ${attrs.contacts_count}` : '')
  ).trim();
  const connectionsLine = String(
    attrs?.connections ||
      (attrs?.calls_count !== undefined ? `connections: ${attrs.calls_count}` : '')
  ).trim();
  const periodLine = String(attrs?.period || '').trim();

  const lines: string[] = [];
  if ((!visible || visible.has('contacts')) && contactsLine) lines.push(contactsLine);
  if ((!visible || visible.has('connections')) && connectionsLine && connectionsLine !== contactsLine) lines.push(connectionsLine);
  if ((!visible || visible.has('period')) && periodLine) lines.push(periodLine);

  return lines;
};

const getEdgeBaseLabel = (edge: any) => {
  const computedLines = getEdgeComputedLines(edge);
  if (computedLines.length > 0) return computedLines.join('\n');
  return String(edge.label || edge.attributes?.visual?.label || edge.attributes?.label || edge.type || '');
};

export const getEdgeLabel = (edge: any) => {
  const base = getEdgeBaseLabel(edge);
  return String(base || '')
    .split(/\r?\n/)
    .map((line) => wrapLabel(line, 44))
    .join('\n');
};

const getNodeLabelMinScale = () => Number((layoutConfig as any)?.interaction?.nodeLabelMinScale ?? 0.6);
const getEdgeLabelMinScale = () => Number((layoutConfig as any)?.interaction?.edgeLabelMinScale ?? 0.8);
const getTooltipMaxScale = () => Number((layoutConfig as any)?.interaction?.nodeTooltipMaxScale ?? 0.75);

export const shouldShowNodeLabel = (scale: number) => scale >= getNodeLabelMinScale();
export const shouldShowEdgeLabel = (scale: number) => scale >= getEdgeLabelMinScale();

export const getGraphTextVisibilityState = (scale: number) => ({
  nodeLabelsVisible: shouldShowNodeLabel(scale),
  edgeLabelsVisible: shouldShowEdgeLabel(scale),
  tooltipsVisible: Number.isFinite(getTooltipMaxScale()) ? scale <= getTooltipMaxScale() : false,
});

export const getEdgeTooltip = (edge: any, scale: number) => {
  const maxScale = getTooltipMaxScale();
  if (!Number.isFinite(maxScale) || scale > maxScale) return '';
  return getEdgeBaseLabel(edge);
};

export const getNodeIcon = (node: any) => {
  const visual = node.attributes?.visual || {};
  const explicitIcon = visual.icon || node.attributes?.icon;
  if (explicitIcon) return explicitIcon;
  if (String(node?.type || '') === 'document') return 'file';
  return '';
};

export const getNodeRingEnabled = (node: any) => {
  const visual = node.attributes?.visual || {};
  const enabled = visual.ringEnabled ?? node.attributes?.ringEnabled;
  if (enabled === undefined || enabled === null) return true;
  return Boolean(enabled);
};

export const getNodeRingWidth = (node: any) => {
  const visual = node.attributes?.visual || {};
  const raw = visual.ringWidth ?? node.attributes?.ringWidth ?? 1.5;
  const width = Number(raw);
  return Number.isFinite(width) ? Math.max(0, width) : 1.5;
};

const getIconVisualKey = (icon: string) => String(icon || '').trim().toLowerCase().replace(/\.[a-z0-9]+$/i, '');

export const getNodeImagePadding = (node: any) => {
  const icon = getNodeIcon(node);
  if (!icon) return Number((layoutConfig as any)?.iconRendering?.defaultImagePadding ?? 10);

  const key = getIconVisualKey(icon);
  const iconRendering = (layoutConfig as any)?.iconRendering || {};
  const perIcon = (iconRendering.perIcon || {})[key] || {};
  const raw = Number(perIcon.imagePadding ?? iconRendering.defaultImagePadding ?? 10);
  return Number.isFinite(raw) ? Math.max(0, raw) : 10;
};

export const withAlpha = (color: string, alpha: number) => {
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

export const getNodeColors = (node: any) => {
  const visual = node.attributes?.visual || {};
  const color = visual.color || node.attributes?.color || node.color || '#94a3b8';

  const ringVisible = getNodeRingEnabled(node);
  const border = ringVisible ? visual.borderColor || node.attributes?.borderColor || color : 'rgba(0,0,0,0)';
  const hasIconImage = Boolean(getNodeImage(node));
  if (hasIconImage) {
    return { background: 'rgba(255,255,255,0)', border };
  }
  return { background: color, border };
};

export const getNodeFont = (node: any) => {
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

export const getNodeSize = (node: any) => {
  const visual = node.attributes?.visual || {};
  const icon = getNodeIcon(node);
  const scaleRaw = visual.iconScale ?? node.attributes?.iconScale;
  const scaleValue = Number(scaleRaw);
  const iconScale = Number.isFinite(scaleValue) ? scaleValue : 2;
  const sizePaddingRaw = Number((layoutConfig as any)?.iconRendering?.sizePadding ?? (layoutConfig as any)?.iconRendering?.defaultImagePadding ?? 10);
  const sizePadding = Number.isFinite(sizePaddingRaw) ? Math.max(0, sizePaddingRaw) : 10;
  if (icon) {
    return Math.max(42, Math.min(140, 24 + iconScale * 12 + sizePadding * 2));
  }
  return visual.size || node.attributes?.size || 20;
};

export const getNodePosition = (node: any, index: number, total: number) => {
  const rawX = Number(node?.position_x ?? node?.x);
  const rawY = Number(node?.position_y ?? node?.y);
  if (Number.isFinite(rawX) && Number.isFinite(rawY)) {
    return { x: rawX, y: rawY };
  }

  const safeTotal = Math.max(1, total);
  const radius = Math.max(220, Math.min(1800, safeTotal * 18));
  const angle = (2 * Math.PI * index) / safeTotal;
  return {
    x: Math.round(radius * Math.cos(angle)),
    y: Math.round(radius * Math.sin(angle))
  };
};

export const getNodeShape = (node: any) => {
  const image = getNodeImage(node);
  return image ? 'circularImage' : node.attributes?.visual?.shape || node.attributes?.shape || 'dot';
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

export const getNodeImage = (node: any) => {
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

export const resolveNodeWithDomainIcon = (node: any, iconByType: Record<string, string>) => {
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

export const buildNodeRadiusById = (nodes: any[]) => {
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

export const buildEdgeCurveMap = (edges: any[]) => {
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
      forward.forEach((ref, index) => {
        curveMap.set(ref.id, { type: 'curvedCW', roundness: roundnessByIndex(index, edgeRefs.length) });
      });
      backward.forEach((ref, index) => {
        curveMap.set(ref.id, { type: 'curvedCW', roundness: roundnessByIndex(index, edgeRefs.length) });
      });
      return;
    }

    edgeRefs.forEach((ref, index) => {
      const level = Math.floor(index / 2);
      const type = index % 2 === 0 ? 'curvedCW' : 'curvedCCW';
      curveMap.set(ref.id, { type, roundness: roundnessByIndex(level, edgeRefs.length) });
    });
  });

  return curveMap;
};

export const buildEdgeForVis = (
  edge: any,
  nodeRadiusById: Record<string, number>,
  curveMap: Map<string, EdgeCurveMeta>,
  scale: number,
  suppressLabels = false
) => {
  const visual = edge.attributes?.visual || {};
  const edgeColor = visual.color || edge.attributes?.color || '#848484';
  const showLabel = !suppressLabels && shouldShowEdgeLabel(scale);
  const edgeLabel = showLabel ? getEdgeLabel(edge) : '';
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
    font: {
      size: showLabel ? 14 : 0,
      color: '#0f172a',
      align: 'middle',
      face: 'Inter, Arial, sans-serif',
      strokeWidth: showLabel ? 3 : 0,
      strokeColor: '#ffffff'
    },
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
