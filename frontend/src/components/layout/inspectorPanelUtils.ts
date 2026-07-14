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
  { value: 'sim', label: 'SIM card' },
  { value: 'person_phone', label: 'Subscriber' },
  { value: 'ip', label: 'IP' },
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
  operator: 'оператор',
  ownership: 'оформлен',
};

export const edgeAttributeLabelAliases: Record<string, string> = {
  period_start: 'Начало периода',
  period_end: 'Конец периода',
  calls_count: 'Количество соединений',
  contacts_count: 'Уникальных контактов',
  contacts: 'Контактов',
  connections: 'Соединений',
  period: 'Период',
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
