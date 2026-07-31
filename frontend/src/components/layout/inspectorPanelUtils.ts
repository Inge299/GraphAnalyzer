import type { SelectedElement } from '../../store/slices/uiSlice';

export type DomainNodeAttributeOption = {
  key: string;
  label: string;
  type: string;
  visibleOnGraph?: boolean;
};

export type DomainNodeTypeOption = {
  id: string;
  label: string;
  icon?: string;
  defaultVisual?: Record<string, any>;
  attributes?: DomainNodeAttributeOption[];
};

export type DomainEdgeTypeOption = {
  id: string;
  label: string;
  color: string;
  defaultVisual?: Record<string, any>;
  allowedFrom: string[];
  allowedTo: string[];
};

export type NodeExtraAttributeState = {
  key: string;
  label: string;
  type: string;
  value: string;
  mixed: boolean;
  visibleOnGraph: 'on' | 'off' | 'mixed';
};

export type EdgeExtraAttributeState = {
  key: string;
  label: string;
  type: string;
  value: string;
  mixed: boolean;
  visibleOnGraph: 'on' | 'off' | 'mixed';
};

export type GraphSelectedElement = SelectedElement & {
  data: any;
};

export type GraphSelectionState = {
  nodes: GraphSelectedElement[];
  edges: GraphSelectedElement[];
  mode: 'none' | 'nodes' | 'edges' | 'mixed';
  total: number;
};

export const fallbackIconOptions = [
  { value: 'smartphone', label: 'Smartphone' },
  { value: 'imsi', label: 'IMSI' },
  { value: 'person_phone', label: 'Subscriber' },
  { value: 'ip_address', label: 'IP' },
  { value: 'mail', label: 'Email' },
  { value: 'social', label: 'Social ID' },
  { value: 'passport', label: 'Passport' },
  { value: 'car', label: 'Car number' },
  { value: 'address', label: 'Address' },
  { value: 'location', label: 'Location' },
  { value: 'bank_card', label: 'Bank card' }
];

export const iconScaleOptions = ['1', '2', '3', '4', '5'];
export const nodeColorPalette = ['#3b82f6', '#22c55e', '#f59e0b', '#ef4444', '#a855f7', '#06b6d4', '#14b8a6', '#84cc16', '#f43f5e', '#eab308', '#000000'];
export const defaultEdgeDirectionOptions = ['from', 'to', 'both'];

const isLikelyMojibake = (value: string) => /[\u00D0\u00D1][\u0080-\u00BF]|[\uFFFD]|(?:Р В Р’В Р вЂ™Р’В .|Р В Р’В Р вЂ™Р’В Р В РІР‚в„ўР вЂ™Р’В .|Р В Р’В Р вЂ™Р’В Р В Р’В Р В РІР‚в„–.){2,}/.test(value);

export const normalizeDisplayLabel = (candidate: string, fallback: string) => {
  const trimmed = candidate.trim();
  if (!trimmed || isLikelyMojibake(trimmed)) return fallback;
  return trimmed;
};

export const getEdgeTypeColor = (edgeType: DomainEdgeTypeOption | undefined) => {
  return String(edgeType?.defaultVisual?.color || edgeType?.color || '#64748b');
};

export const getCommonValue = <T, U>(items: U[], getter: (item: U) => T | undefined): T | undefined => {
  if (items.length === 0) return undefined;
  const first = getter(items[0]);
  for (const item of items.slice(1)) {
    if (getter(item) !== first) return undefined;
  }
  return first;
};

export const NODE_SYSTEM_ATTRIBUTE_KEYS = new Set(['visual', 'label', 'color', 'icon', 'iconScale', 'ringEnabled', 'ringWidth']);
export const EDGE_SYSTEM_ATTRIBUTE_KEYS = new Set(['visual', 'label', 'color', 'width', 'direction', 'dashed']);

export const attributeTypePriority: Record<string, number> = {
  string: 1,
  text: 1,
  number: 2,
  integer: 2,
  float: 2,
  date: 3,
  datetime: 3,
  boolean: 4,
};

export const attributeLabelAliases: Record<string, string> = {
  operator: '\u041e\u043f\u0435\u0440\u0430\u0442\u043e\u0440',
  ownership: '\u041e\u0444\u043e\u0440\u043c\u043b\u0435\u043d',
};

export const edgeAttributeLabelAliases: Record<string, string> = {
  period_start: '\u041d\u0430\u0447\u0430\u043b\u043e \u043f\u0435\u0440\u0438\u043e\u0434\u0430',
  period_end: '\u041a\u043e\u043d\u0435\u0446 \u043f\u0435\u0440\u0438\u043e\u0434\u0430',
  calls_count: '\u041a\u043e\u043b\u0438\u0447\u0435\u0441\u0442\u0432\u043e \u0441\u043e\u0435\u0434\u0438\u043d\u0435\u043d\u0438\u0439',
  contacts_count: '\u0423\u043d\u0438\u043a\u0430\u043b\u044c\u043d\u044b\u0445 \u043a\u043e\u043d\u0442\u0430\u043a\u0442\u043e\u0432',
  contacts: '\u041a\u043e\u043d\u0442\u0430\u043a\u0442\u043e\u0432',
  connections: '\u0421\u043e\u0435\u0434\u0438\u043d\u0435\u043d\u0438\u0439',
  period: '\u041f\u0435\u0440\u0438\u043e\u0434',
};

export const normalizeAttributeValue = (value: unknown) => {
  if (Array.isArray(value)) {
    return value.map((item) => String(item ?? '').trim()).filter(Boolean).join('\n');
  }
  if (value !== undefined && value !== null && typeof value === 'object') {
    return JSON.stringify(value, null, 2);
  }
  return value === undefined || value === null ? '' : String(value).replace(/\\n/g, '\n');
};

export const buildEdgeLabelFromAttributes = (attributes: Record<string, any>, visibleKeys?: string[]) => {
  const visibleSet = Array.isArray(visibleKeys) ? new Set(visibleKeys.map((item) => String(item))) : null;
  const contactsLine = String(
    attributes.contacts ||
      (attributes.contacts_count !== undefined ? `contacts: ${attributes.contacts_count}` : '')
  ).trim();
  const connectionsLine = String(
    attributes.connections ||
      (attributes.calls_count !== undefined ? `connections: ${attributes.calls_count}` : '')
  ).trim();
  const periodLine = String(attributes.period || '').trim();

  const lines: string[] = [];
  if ((!visibleSet || visibleSet.has('contacts')) && contactsLine) lines.push(contactsLine);
  if ((!visibleSet || visibleSet.has('connections')) && connectionsLine && connectionsLine !== contactsLine) lines.push(connectionsLine);
  if ((!visibleSet || visibleSet.has('period')) && periodLine) lines.push(periodLine);
  return lines.join('\n').trim();
};
