// frontend/src/components/layout/InspectorPanel.tsx
import React, { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import { useAppDispatch, useAppSelector } from '../../store';
import { fetchArtifacts, deleteArtifact, updateArtifactSync, setCurrentArtifact } from '../../store/slices/artifactsSlice';
import { artifactApi, pluginApi, domainModelApi, projectDataApi } from '../../services/api';
import type { ApiPlugin, ApiArtifact, PluginExecutionContext, DomainModelConfig } from '../../types/api';
import type { SelectedElement } from '../../store/slices/uiSlice';
import './InspectorPanel.css';
import { collectPluginParamsWithPrompts, groupPluginsByMenuPath } from '../../utils/pluginParams';
import { nodeAttributePreviewConfig } from '../../config/nodeAttributePreview';
import { layoutConfig } from '../../config/layout';

interface InspectorPanelProps {
  onApplyGraphData?: (newData: any, description: string, actionType: string) => Promise<void> | void;
  onStartNodeCreation?: (nodeType: string, label: string) => void;
  onStartEdgeCreation?: (edgeType: string) => void;
  nodeCreationSpec?: { typeId: string; label: string } | null;
  edgeCreationType?: string | null;
  onRefreshConsole?: () => Promise<void> | void;
}

const labels = {
  inspector: '\u0418\u043d\u0441\u043f\u0435\u043a\u0442\u043e\u0440',
  selectArtifact: '\u0412\u044b\u0431\u0435\u0440\u0438\u0442\u0435 \u0430\u0440\u0442\u0435\u0444\u0430\u043a\u0442 \u0434\u043b\u044f \u043f\u0440\u043e\u0441\u043c\u043e\u0442\u0440\u0430',
  properties: '\u041e\u0431\u0449\u0430\u044f',
  builder: '\u041a\u043e\u043d\u0441\u0442\u0440\u0443\u043a\u0442\u043e\u0440',
  history: '\u0418\u0441\u0442\u043e\u0440\u0438\u044f',
  metadata: '\u041c\u0435\u0442\u0430\u0434\u0430\u043d\u043d\u044b\u0435',
  name: '\u041d\u0430\u0437\u0432\u0430\u043d\u0438\u0435',
  type: '\u0422\u0438\u043f',
  description: '\u041e\u043f\u0438\u0441\u0430\u043d\u0438\u0435',
  version: '\u0412\u0435\u0440\u0441\u0438\u044f',
  created: '\u0421\u043e\u0437\u0434\u0430\u043d',
  updated: '\u041e\u0431\u043d\u043e\u0432\u043b\u0435\u043d',
  plugins: '\u041f\u043b\u0430\u0433\u0438\u043d\u044b',
  loading: '\u0417\u0430\u0433\u0440\u0443\u0437\u043a\u0430...',
  noPlugins: '\u041d\u0435\u0442 \u0434\u043e\u0441\u0442\u0443\u043f\u043d\u044b\u0445 \u043f\u043b\u0430\u0433\u0438\u043d\u043e\u0432',
  pluginRun: '\u0417\u0430\u043f\u0443\u0441\u0442\u0438\u0442\u044c',
  pluginRunning: '\u0417\u0430\u043f\u0443\u0441\u043a...',
  pluginDone: '\u041f\u043b\u0430\u0433\u0438\u043d "{name}" \u0432\u044b\u043f\u043e\u043b\u043d\u0435\u043d',
  typeGraph: '\u0413\u0440\u0430\u0444',
  typeTable: '\u0422\u0430\u0431\u043b\u0438\u0446\u0430',
  typeMap: '\u041a\u0430\u0440\u0442\u0430',
  typeChart: '\u0414\u0438\u0430\u0433\u0440\u0430\u043c\u043c\u0430',
  typeDocument: 'Р”РѕРєСѓРјРµРЅС‚',
  typeConsole: 'РљРѕРЅСЃРѕР»СЊ',
  historyPlaceholder: '\u0418\u0441\u0442\u043e\u0440\u0438\u044f \u0438\u0437\u043c\u0435\u043d\u0435\u043d\u0438\u0439',
  artifactId: 'ID \u0430\u0440\u0442\u0435\u0444\u0430\u043a\u0442\u0430',
  projectId: 'ID \u043f\u0440\u043e\u0435\u043a\u0442\u0430',
  extraMetadata: '\u0414\u043e\u043f. \u043c\u0435\u0442\u0430\u0434\u0430\u043d\u043d\u044b\u0435',
  rename: '\u041f\u0435\u0440\u0435\u0438\u043c\u0435\u043d\u043e\u0432\u0430\u0442\u044c',
  renameConfirm: '\u041f\u0435\u0440\u0435\u0438\u043c\u0435\u043d\u043e\u0432\u0430\u0442\u044c \u0430\u0440\u0442\u0435\u0444\u0430\u043a\u0442? \u042d\u0442\u043e \u0438\u0437\u043c\u0435\u043d\u0438\u0442 \u0435\u0433\u043e \u043d\u0430\u0437\u0432\u0430\u043d\u0438\u0435.',
  delete: '\u0423\u0434\u0430\u043b\u0438\u0442\u044c',
  deleteConfirm: '\u0423\u0434\u0430\u043b\u0438\u0442\u044c \u0430\u0440\u0442\u0435\u0444\u0430\u043a\u0442? \u042d\u0442\u043e \u0434\u0435\u0439\u0441\u0442\u0432\u0438\u0435 \u043d\u0435\u043e\u0431\u0440\u0430\u0442\u0438\u043c\u043e.',
  loadData: '\u0417\u0430\u0433\u0440\u0443\u0437\u0438\u0442\u044c \u0434\u0430\u043d\u043d\u044b\u0435',
  clearProjectData: '\u041e\u0447\u0438\u0441\u0442\u0438\u0442\u044c \u0434\u0430\u043d\u043d\u044b\u0435 \u043f\u0440\u043e\u0435\u043a\u0442\u0430',
  dataManagement: '\u0423\u043f\u0440\u0430\u0432\u043b\u0435\u043d\u0438\u0435 \u0434\u0430\u043d\u043d\u044b\u043c\u0438',
  loadDataPrompt: '\u0423\u043a\u0430\u0436\u0438\u0442\u0435 \u043f\u0443\u0442\u044c \u043a \u043f\u0430\u043f\u043a\u0435 \u0432\u043d\u0443\u0442\u0440\u0438 /app/data (\u043d\u0430\u043f\u0440\u0438\u043c\u0435\u0440: imports/raw_batch_1)',
  clearDataConfirm: '\u041e\u0447\u0438\u0441\u0442\u0438\u0442\u044c \u0432\u0441\u0435 \u0434\u0430\u043d\u043d\u044b\u0435 \u0442\u0435\u043b\u0435\u043a\u043e\u043c-\u0442\u0430\u0431\u043b\u0438\u0446 \u0434\u043b\u044f \u044d\u0442\u043e\u0433\u043e \u043f\u0440\u043e\u0435\u043a\u0442\u0430? \u042d\u0442\u043e \u0434\u0435\u0439\u0441\u0442\u0432\u0438\u0435 \u043d\u0435 \u0437\u0430\u0442\u0440\u043e\u043d\u0435\u0442 \u0434\u0440\u0443\u0433\u0438\u0435 \u043f\u0440\u043e\u0435\u043a\u0442\u044b.',
  dataActionSuccess: '\u0413\u043e\u0442\u043e\u0432\u043e',
  dataActionError: '\u041e\u0448\u0438\u0431\u043a\u0430 \u043e\u043f\u0435\u0440\u0430\u0446\u0438\u0438',
  viewLoadReport: '\u041f\u043e\u043a\u0430\u0437\u0430\u0442\u044c \u043e\u0442\u0447\u0435\u0442 \u0437\u0430\u0433\u0440\u0443\u0437\u043a\u0438',
  loadReportTitle: '\u041e\u0442\u0447\u0435\u0442 \u0437\u0430\u0433\u0440\u0443\u0437\u043a\u0438',
  communicationsCount: '\u0421\u0432\u044f\u0437\u0438 \u0430\u0431\u043e\u043d\u0435\u043d\u0442\u043e\u0432',
  deviceHistoryCount: '\u0421\u043c\u0435\u043d\u044b \u0430\u043f\u043f\u0430\u0440\u0430\u0442\u043e\u0432',
  refreshConsole: 'РћР±РЅРѕРІРёС‚СЊ РєРѕРЅСЃРѕР»СЊ',
  cancel: '\u041e\u0442\u043c\u0435\u043d\u0430',
  save: '\u0421\u043e\u0445\u0440\u0430\u043d\u0438\u0442\u044c',
  selectResult: '\\u0412\\u044b\\u0431\\u0435\\u0440\\u0438\\u0442\\u0435 \\u0440\\u0435\\u0437\\u0443\\u043b\\u044c\\u0442\\u0430\\u0442',
  llmSection: 'LLM',
  llmModel: 'Модель',
  llmRuntime: 'Режим',
  llmLatency: 'Задержка',
  elementProps: '\u0421\u0432\u043e\u0439\u0441\u0442\u0432\u0430',
  selectedCount: '\u041a\u043e\u043b-\u0432\u043e',
  mixedSelection: '\u0412\u044b\u0434\u0435\u043b\u0435\u043d\u044b \u0438 \u0432\u0435\u0440\u0448\u0438\u043d\u044b, \u0438 \u0441\u0432\u044f\u0437\u0438. \u0412\u044b\u0431\u0435\u0440\u0438\u0442\u0435 \u043e\u0434\u0438\u043d \u0442\u0438\u043f \u044d\u043b\u0435\u043c\u0435\u043d\u0442\u043e\u0432.',
  elementLabel: '\u0422\u0435\u043a\u0441\u0442',
  elementColor: '\u0426\u0432\u0435\u0442',
  elementIcon: '\u0418\u043a\u043e\u043d\u043a\u0430',
  iconScale: '\u0420\u0430\u0437\u043c\u0435\u0440 \u0438\u043a\u043e\u043d\u043a\u0438',
  ringEnabled: '\u0420\u0430\u043c\u043a\u0430',
  ringWidth: '\u0422\u043e\u043b\u0449\u0438\u043d\u0430 \u0440\u0430\u043c\u043a\u0438',
  edgeWidth: '\u0422\u043e\u043b\u0449\u0438\u043d\u0430 \u0441\u0432\u044f\u0437\u0438',
  edgeDirection: '\u041d\u0430\u043f\u0440\u0430\u0432\u043b\u0435\u043d\u0438\u0435',
  edgeStyle: '\u0422\u0438\u043f \u043b\u0438\u043d\u0438\u0438',
  nodeType: '\u0422\u0438\u043f \u0443\u0437\u043b\u0430',
  edgeType: '\u0422\u0438\u043f \u0441\u0432\u044f\u0437\u0438',
  fromNode: '\u0418\u0437 \u0443\u0437\u043b\u0430',
  toNode: '\u0412 \u0443\u0437\u0435\u043b',
  createNode: '\u0421\u043e\u0437\u0434\u0430\u0442\u044c \u0443\u0437\u0435\u043b',
  createEdge: '\u0421\u043e\u0437\u0434\u0430\u0442\u044c \u0441\u0432\u044f\u0437\u044c',
  createEdgeOnGraph: '\u0412\u044b\u0431\u0440\u0430\u0442\u044c \u043d\u0430 \u0433\u0440\u0430\u0444\u0435',
  edgeCreationActive: '\u0420\u0435\u0436\u0438\u043c \u0441\u043e\u0437\u0434\u0430\u043d\u0438\u044f \u0441\u0432\u044f\u0437\u0438 \u0430\u043a\u0442\u0438\u0432\u0435\u043d: \u0432\u044b\u0431\u0435\u0440\u0438\u0442\u0435 \u0434\u0432\u0430 \u0443\u0437\u043b\u0430 \u043d\u0430 \u0433\u0440\u0430\u0444\u0435',
  nodeCreationActive: '\u0420\u0435\u0436\u0438\u043c \u0441\u043e\u0437\u0434\u0430\u043d\u0438\u044f \u0443\u0437\u043b\u0430 \u0430\u043a\u0442\u0438\u0432\u0435\u043d: \u043a\u043b\u0438\u043a\u043d\u0438\u0442\u0435 \u043f\u043e \u0433\u0440\u0430\u0444\u0443',
  nodeLabel: '\u041f\u043e\u0434\u043f\u0438\u0441\u044c \u0443\u0437\u043b\u0430',
  edgeDirectionNotAllowed: '\u042d\u0442\u043e\u0442 \u0442\u0438\u043f \u0441\u0432\u044f\u0437\u0438 \u043d\u0435 \u0440\u0430\u0437\u0440\u0435\u0448\u0435\u043d \u0434\u043b\u044f \u0432\u044b\u0431\u0440\u0430\u043d\u043d\u044b\u0445 \u0442\u0438\u043f\u043e\u0432 \u0443\u0437\u043b\u043e\u0432',
  edgeAlreadyExists: '\u0422\u0430\u043a\u0430\u044f \u0441\u0432\u044f\u0437\u044c \u0443\u0436\u0435 \u0441\u0443\u0449\u0435\u0441\u0442\u0432\u0443\u0435\u0442',
  chooseNodeFirst: '\u0421\u043d\u0430\u0447\u0430\u043b\u0430 \u0441\u043e\u0437\u0434\u0430\u0439\u0442\u0435 \u0445\u043e\u0442\u044f \u0431\u044b 2 \u0443\u0437\u043b\u0430',
  cannotLinkSameNode: '\u041d\u0435\u043b\u044c\u0437\u044f \u0441\u0432\u044f\u0437\u0430\u0442\u044c \u0443\u0437\u0435\u043b \u0441 \u0441\u0430\u043c\u0438\u043c \u0441\u043e\u0431\u043e\u0439',
  apply: '\u041f\u0440\u0438\u043c\u0435\u043d\u0438\u0442\u044c',
  noSelection: '\u0412\u044b\u0434\u0435\u043b\u0438\u0442\u0435 \u044d\u043b\u0435\u043c\u0435\u043d\u0442 \u043d\u0430 \u0433\u0440\u0430\u0444\u0435',
  unchanged: '\u0411\u0435\u0437 \u0438\u0437\u043c\u0435\u043d\u0435\u043d\u0438\u0439',
  on: '\u0415\u0441\u0442\u044c',
  off: '\u041d\u0435\u0442',
  solid: '\u0421\u043f\u043b\u043e\u0448\u043d\u0430\u044f',
  dashed: '\u041f\u0443\u043d\u043a\u0442\u0438\u0440\u043d\u0430\u044f'
};
type DomainNodeAttributeOption = {
  key: string;
  label: string;
  type: string;
  visibleOnGraph?: boolean;
};

type DomainNodeTypeOption = {
  id: string;
  label: string;
  icon?: string;
  defaultVisual?: Record<string, any>;
  attributes?: DomainNodeAttributeOption[];
};

type DomainEdgeTypeOption = {
  id: string;
  label: string;
  color: string;
  defaultVisual?: Record<string, any>;
  allowedFrom: string[];
  allowedTo: string[];
};

const fallbackIconOptions = [
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

const iconScaleOptions = ['1', '2', '3', '4', '5'];
const nodeColorPalette = ['#3b82f6', '#22c55e', '#f59e0b', '#ef4444', '#a855f7', '#06b6d4', '#14b8a6', '#84cc16', '#f43f5e', '#eab308', '#000000'];
const defaultEdgeDirectionOptions = ['from', 'to', 'both'];
const isLikelyMojibake = (value: string) => /[\u00D0\u00D1][\u0080-\u00BF]|[\uFFFD]|(?:Р В Р’В Р вЂ™Р’В .|Р В Р’В Р В Р вЂ№.){2,}/.test(value);

const normalizeDisplayLabel = (candidate: string, fallback: string) => {
  const trimmed = candidate.trim();
  if (!trimmed || isLikelyMojibake(trimmed)) return fallback;
  return trimmed;
};
const getEdgeTypeColor = (edgeType: DomainEdgeTypeOption | undefined) => {
  return String(edgeType?.defaultVisual?.color || edgeType?.color || '#64748b');
};
const getCommonValue = <T, U>(items: U[], getter: (item: U) => T | undefined): T | undefined => {
  if (items.length === 0) return undefined;
  const first = getter(items[0]);
  for (const item of items.slice(1)) {
    if (getter(item) !== first) return undefined;
  }
  return first;
};

const NODE_SYSTEM_ATTRIBUTE_KEYS = new Set(['visual', 'label', 'color', 'icon', 'iconScale', 'ringEnabled', 'ringWidth']);
const EDGE_SYSTEM_ATTRIBUTE_KEYS = new Set(['visual', 'label', 'color', 'width', 'direction', 'dashed']);

type NodeExtraAttributeState = {
  key: string;
  label: string;
  type: string;
  value: string;
  mixed: boolean;
  visibleOnGraph: 'on' | 'off' | 'mixed';
};

type EdgeExtraAttributeState = {
  key: string;
  label: string;
  type: string;
  value: string;
  mixed: boolean;
  visibleOnGraph: 'on' | 'off' | 'mixed';
};

type GraphSelectedElement = SelectedElement & {
  data: any;
};

type GraphSelectionState = {
  nodes: GraphSelectedElement[];
  edges: GraphSelectedElement[];
  mode: 'none' | 'nodes' | 'edges' | 'mixed';
  total: number;
};

const attributeTypePriority: Record<string, number> = {
  string: 1,
  text: 1,
  number: 2,
  integer: 2,
  float: 2,
  date: 3,
  datetime: 3,
  boolean: 4,
};

const attributeLabelAliases: Record<string, string> = {
  operator: '\u043e\u043f\u0435\u0440\u0430\u0442\u043e\u0440',
  ownership: '\u043e\u0444\u043e\u0440\u043c\u043b\u0435\u043d',
};

const edgeAttributeLabelAliases: Record<string, string> = {
  period_start: '\u041d\u0430\u0447\u0430\u043b\u043e \u043f\u0435\u0440\u0438\u043e\u0434\u0430',
  period_end: '\u041a\u043e\u043d\u0435\u0446 \u043f\u0435\u0440\u0438\u043e\u0434\u0430',
  calls_count: '\u041a\u043e\u043b\u0438\u0447\u0435\u0441\u0442\u0432\u043e \u0441\u0432\u044f\u0437\u0435\u0439',
  contacts: '\u041a\u043e\u043d\u0442\u0430\u043a\u0442\u043e\u0432',
  period: '\u041f\u0435\u0440\u0438\u043e\u0434',
};

const normalizeAttributeValue = (value: unknown) => {
  if (Array.isArray(value)) {
    return value.map((item) => String(item ?? '').trim()).filter(Boolean).join('\n');
  }
  if (value !== undefined && value !== null && typeof value === 'object') {
    return JSON.stringify(value, null, 2);
  }
  return value === undefined || value === null ? '' : String(value).replace(/\\n/g, '\n');
};

const buildEdgeLabelFromAttributes = (attributes: Record<string, any>, visibleKeys?: string[]) => {
  const visibleSet = Array.isArray(visibleKeys) ? new Set(visibleKeys.map((item) => String(item))) : null;
  const contactsLine = String(attributes.contacts || (attributes.calls_count !== undefined ? `Р С”Р С•Р Р…РЎвЂљР В°Р С”РЎвЂљР С•Р Р†: ${attributes.calls_count}` : '')).trim();
  const periodLine = String(attributes.period || '').trim();

  const lines: string[] = [];
  if ((!visibleSet || visibleSet.has('contacts')) && contactsLine) lines.push(contactsLine);
  if ((!visibleSet || visibleSet.has('period')) && periodLine) lines.push(periodLine);
  return lines.join('\n').trim();
};
type EdgeTypeSelectProps = {
  value: string;
  onChange: (value: string) => void;
  options: DomainEdgeTypeOption[];
  placeholder: string;
  allowEmpty?: boolean;
  emptyLabel?: string;
};

const EdgeTypeSelect: React.FC<EdgeTypeSelectProps> = ({ value, onChange, options, placeholder, allowEmpty = false, emptyLabel = 'Р‘РµР· РёР·РјРµРЅРµРЅРёР№' }) => {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const selected = options.find((item) => item.id === value) || null;

  useEffect(() => {
    const onDocumentClick = (event: MouseEvent) => {
      if (!containerRef.current) return;
      if (event.target instanceof Node && containerRef.current.contains(event.target)) return;
      setOpen(false);
    };

    document.addEventListener('mousedown', onDocumentClick);
    return () => document.removeEventListener('mousedown', onDocumentClick);
  }, []);

  const handleChoose = (next: string) => {
    onChange(next);
    setOpen(false);
  };

  return (
    <div className="edge-type-select" ref={containerRef}>
      <button
        type="button"
        className="edge-type-select-trigger"
        onClick={() => setOpen((prev) => !prev)}
      >
        {selected ? (
          <>
            <span className="edge-type-select-line" style={{ ['--edge-color' as any]: getEdgeTypeColor(selected) }} />
            <span className="edge-type-select-label">{selected.label}</span>
          </>
        ) : (
          <span className="edge-type-select-label edge-type-select-placeholder">{placeholder}</span>
        )}
        <span className="edge-type-select-caret">в–ѕ</span>
      </button>

      {open && (
        <div className="edge-type-select-menu">
          {allowEmpty && (
            <button type="button" className="edge-type-select-item" onClick={() => handleChoose('')}>
              <span className="edge-type-select-label edge-type-select-placeholder">{emptyLabel}</span>
            </button>
          )}
          {options.map((item) => (
            <button
              key={item.id}
              type="button"
              className={'edge-type-select-item ' + (item.id === value ? 'active' : '')}
              onClick={() => handleChoose(item.id)}
            >
              <span className="edge-type-select-line" style={{ ['--edge-color' as any]: getEdgeTypeColor(item) }} />
              <span className="edge-type-select-label">{item.label}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
};
const InspectorPanel: React.FC<InspectorPanelProps> = ({ onApplyGraphData, onStartNodeCreation, onStartEdgeCreation, nodeCreationSpec = null, edgeCreationType = null, onRefreshConsole }) => {
  const dispatch = useAppDispatch();
  const [activeTab, setActiveTab] = useState<'properties' | 'builder' | 'elements' | 'metadata'>('properties');
  const [plugins, setPlugins] = useState<ApiPlugin[]>([]);
  const [pluginsLoading, setPluginsLoading] = useState(false);
  void pluginsLoading;
  const [pluginsError, setPluginsError] = useState<string | null>(null);
  void pluginsError;
  const [runningPluginId, setRunningPluginId] = useState<string | null>(null);
  void runningPluginId;
  const [pluginsMessage, setPluginsMessage] = useState<string | null>(null);
  void pluginsMessage;
  const [isRenaming, setIsRenaming] = useState(false);
  const [renameValue, setRenameValue] = useState('');
  const [renaming, setRenaming] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [dataLoading, setDataLoading] = useState(false);
  const [dataClearing, setDataClearing] = useState(false);
  const [dataActionMessage, setDataActionMessage] = useState<string | null>(null);
  const [dataActionError, setDataActionError] = useState<string | null>(null);
  const [dataActionLog, setDataActionLog] = useState<string>('');
  const [isLoadReportOpen, setIsLoadReportOpen] = useState(false);
  const [dataStatsLoading, setDataStatsLoading] = useState(false);
  const [dataStats, setDataStats] = useState<{ communications: number; deviceHistory: number }>({ communications: 0, deviceHistory: 0 });
  const loadFilesInputRef = useRef<HTMLInputElement | null>(null);
  const [createdArtifacts, setCreatedArtifacts] = useState<ApiArtifact[] | null>(null);
  const [iconOptions, setIconOptions] = useState(fallbackIconOptions);
  const [edgeDirectionOptions, setEdgeDirectionOptions] = useState(defaultEdgeDirectionOptions);

  const [elementLabel, setElementLabel] = useState('');
  const [elementColor, setElementColor] = useState('');
  const [elementIcon, setElementIcon] = useState('');
  const [elementIconScale, setElementIconScale] = useState('');
  const [elementRingMode, setElementRingMode] = useState<'unchanged' | 'on' | 'off'>('unchanged');
  const [elementRingWidth, setElementRingWidth] = useState('');
  const [elementEdgeWidth, setElementEdgeWidth] = useState('');
  const [elementEdgeDirection, setElementEdgeDirection] = useState('');
  const [elementEdgeStyle, setElementEdgeStyle] = useState<'unchanged' | 'solid' | 'dashed'>('unchanged');
  const [elementEdgeType, setElementEdgeType] = useState('');
  const [nodeExtraAttributes, setNodeExtraAttributes] = useState<NodeExtraAttributeState[]>([]);
  const [edgeExtraAttributes, setEdgeExtraAttributes] = useState<EdgeExtraAttributeState[]>([]);
  const [elementsSaving, setElementsSaving] = useState(false);
  const [nodeTypeDefinitions, setNodeTypeDefinitions] = useState<DomainNodeTypeOption[]>([]);
  const [edgeTypeDefinitions, setEdgeTypeDefinitions] = useState<DomainEdgeTypeOption[]>([]);

  const [builderNodeLabel, setBuilderNodeLabel] = useState('');
  const [builderNodeType, setBuilderNodeType] = useState('');
  const [builderEdgeType, setBuilderEdgeType] = useState('');
  const [builderSaving] = useState(false);

  const selectedArtifact = useAppSelector(state => {
    const { currentArtifactId, items } = state.artifacts;
    return currentArtifactId ? items[currentArtifactId] : null;
  });

  const selectedElements = useAppSelector(state => state.ui.selectedElements);
  const currentProject = useAppSelector(state => state.projects.currentProject);

  const graphNodeIdSet = useMemo(() => {
    if (!selectedArtifact || selectedArtifact.type !== 'graph') return new Set<string>();
    const nodes = Array.isArray(selectedArtifact.data?.nodes) ? selectedArtifact.data.nodes : [];
    return new Set(nodes.map((node: any) => String(node?.id ?? node?.node_id ?? '')));
  }, [selectedArtifact]);

  const graphEdgeIdSet = useMemo(() => {
    if (!selectedArtifact || selectedArtifact.type !== 'graph') return new Set<string>();
    const edges = Array.isArray(selectedArtifact.data?.edges) ? selectedArtifact.data.edges : [];
    return new Set(edges.map((edge: any) => String(edge?.id ?? '')));
  }, [selectedArtifact]);


  const pluginContext = useMemo<PluginExecutionContext>(() => {
    if (!selectedArtifact) return {};

    if (selectedArtifact.type === 'graph') {
      const selected_nodes = selectedElements
        .filter(item => item.type === 'node')
        .map(item => String(item.id))
        .filter((id) => graphNodeIdSet.has(id)).slice(0, 120);
      const selected_edges = selectedElements
        .filter(item => item.type === 'edge')
        .map(item => String(item.id))
        .filter((id) => graphEdgeIdSet.has(id)).slice(0, 200);

      return { selected_nodes, selected_edges };
    }

    return {};
  }, [selectedArtifact, selectedElements, graphNodeIdSet, graphEdgeIdSet]);
  const getNodeTypeDefaultVisual = useCallback((nodeData: any) => {
    const typeId = String(nodeData?.type || '');
    const found = nodeTypeDefinitions.find((item) => item.id === typeId);
    return (found?.defaultVisual || {}) as Record<string, any>;
  }, [nodeTypeDefinitions]);

  const getNodeTypeAttributeDefinitions = useCallback((nodeData: any) => {
    const typeId = String(nodeData?.type || '');
    const found = nodeTypeDefinitions.find((item) => item.id === typeId);
    return Array.isArray(found?.attributes) ? found.attributes : [];
  }, [nodeTypeDefinitions]);

  const graphNodes = useMemo(() => {
    if (!selectedArtifact || selectedArtifact.type !== 'graph') return [] as any[];
    return selectedArtifact.data?.nodes || [];
  }, [selectedArtifact]);

  const graphNodeOptions = useMemo(() => {
    return graphNodes.map((node: any) => {
      const nodeId = String(node.id ?? node.node_id ?? node.uuid ?? node.key);
      const nodeLabel = String(node.label || node.attributes?.visual?.label || nodeId);
      return { id: nodeId, label: nodeLabel, type: String(node.type || '') };
    });
  }, [graphNodes]);
const pluginContextKey = useMemo(() => {
    const nodes = [...(pluginContext.selected_nodes || [])].sort();
    const edges = [...(pluginContext.selected_edges || [])].sort();
    const rows = [...(pluginContext.selected_rows || [])].sort();

    return JSON.stringify({
      selected_nodes: nodes,
      selected_edges: edges,
      selected_rows: rows,
      selected_text: pluginContext.selected_text || '',
      selected_geo: pluginContext.selected_geo || null,
    });
  }, [pluginContext]);

  useEffect(() => {
    let cancelled = false;

    const loadDomainModel = async () => {
      try {
        const model = await domainModelApi.get() as DomainModelConfig;
        if (cancelled) return;

        const icons = (model?.node_types || [])
          .map((node) => {
            const icon = String(node?.icon || '').trim();
            if (!icon) return null;
            const fallbackLabel = String(node?.id || icon);
            const label = normalizeDisplayLabel(String(node?.label || ''), fallbackLabel);
            return { value: icon, label };
          })
          .filter(Boolean) as Array<{ value: string; label: string }>;

        const uniqueIcons = Array.from(new Map(icons.map((item) => [item.value, item])).values());
        setIconOptions(uniqueIcons.length > 0 ? uniqueIcons : fallbackIconOptions);

        const nodeTypes = (model?.node_types || []).map((node) => ({
          id: String(node?.id || 'РЈР·РµР»'),
          label: normalizeDisplayLabel(String(node?.label || ''), String(node?.id || 'РЈР·РµР»')),
          icon: String(node?.icon || '').trim(),
          defaultVisual: ((node as any)?.default_visual || {}) as Record<string, any>,
          attributes: Array.isArray((node as any)?.attributes)
            ? (node as any).attributes
                .map((attribute: any) => {
                  const key = String(attribute?.key || '').trim();
                  if (!key) return null;
                  return {
                    key,
                    label: normalizeDisplayLabel(String(attribute?.label || ''), key),
                    type: String(attribute?.type || 'string').toLowerCase(),
                    visibleOnGraph: Boolean(attribute?.visible_on_graph),
                  } as DomainNodeAttributeOption;
                })
                .filter(Boolean) as DomainNodeAttributeOption[]
            : []
        })).filter((node) => !!node.id);
        setNodeTypeDefinitions(nodeTypes);

        const edgeTypes = (model?.edge_types || []).map((edge) => ({
          id: String((edge as any)?.id || 'РЎРІСЏР·СЊ'),
          label: normalizeDisplayLabel(String((edge as any)?.label || ''), String((edge as any)?.id || 'РЎРІСЏР·СЊ')),
          color: String((edge as any)?.default_visual?.color || '#64748b'),
          defaultVisual: (((edge as any)?.default_visual || {}) as Record<string, any>),
          allowedFrom: Array.isArray((edge as any)?.allowed_from) ? (edge as any).allowed_from.map((v: any) => String(v)) : ['*'],
          allowedTo: Array.isArray((edge as any)?.allowed_to) ? (edge as any).allowed_to.map((v: any) => String(v)) : ['*']
        })).filter((edge) => !!edge.id);
        setEdgeTypeDefinitions(edgeTypes);

        const configuredDirections = model?.rules?.edge_direction_values || [];
        const normalizedDirections = configuredDirections
          .map((value) => String(value).trim())
          .filter((value) => value === 'from' || value === 'to' || value === 'both');

        setEdgeDirectionOptions(normalizedDirections.length > 0 ? normalizedDirections : defaultEdgeDirectionOptions);
      } catch {
        if (cancelled) return;
        setIconOptions(fallbackIconOptions);
        setEdgeDirectionOptions(defaultEdgeDirectionOptions);
        setNodeTypeDefinitions([]);
        setEdgeTypeDefinitions([]);
      }
    };

    loadDomainModel();

    return () => {
      cancelled = true;
    };
  }, []);

  const handleTabChange = useCallback((tab: 'properties' | 'builder' | 'elements' | 'metadata') => {
    setActiveTab(tab);
  }, []);

  const refreshProjectDataStats = useCallback(async (projectId: number) => {
    setDataStatsLoading(true);
    try {
      const stats = await projectDataApi.stats(projectId);
      setDataStats({
        communications: Number(stats?.communications_count || 0),
        deviceHistory: Number(stats?.device_history_count || 0),
      });
    } catch {
      setDataStats({ communications: 0, deviceHistory: 0 });
    } finally {
      setDataStatsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!currentProject?.id) {
      setDataStats({ communications: 0, deviceHistory: 0 });
      return;
    }
    refreshProjectDataStats(currentProject.id);
  }, [currentProject?.id, refreshProjectDataStats]);


  useEffect(() => {
    if (!selectedArtifact) {
      setPlugins([]);
      return;
    }

    let cancelled = false;
    const timer = window.setTimeout(async () => {
      setPluginsLoading(true);
      setPluginsError(null);
      try {
        const response = await pluginApi.applicable(
          selectedArtifact.project_id,
          selectedArtifact.id,
          pluginContext
        );
        if (cancelled) return;
        const list: ApiPlugin[] = response?.plugins || [];
        setPlugins(list);
      } catch (error: any) {
        if (cancelled) return;
        setPluginsError(error?.message || 'Failed to load plugins');
      } finally {
        if (!cancelled) {
          setPluginsLoading(false);
        }
      }
    }, 120);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [selectedArtifact?.id, selectedArtifact?.project_id, pluginContextKey]);

  useEffect(() => {
    if (selectedArtifact?.name) {
      setRenameValue(selectedArtifact.name);
    }
  }, [selectedArtifact?.name]);

    const graphSelection = useMemo<GraphSelectionState | null>(() => {
    if (!selectedArtifact || selectedArtifact.type !== 'graph') return null;

    const data = selectedArtifact.data || { nodes: [], edges: [] };
    const nodeById = new Map((data.nodes || []).map((node: any) => [String(node.id ?? node.node_id ?? node.uuid ?? node.key), node]));
    const edgeById = new Map((data.edges || []).map((edge: any) => [String(edge.id), edge]));

    const nodes = selectedElements
      .filter((item): item is SelectedElement => item.type === 'node')
      .map((item) => ({ ...item, data: nodeById.get(String(item.id)) ?? item.data }))
      .filter((item): item is GraphSelectedElement => Boolean(item.data));

    const edges = selectedElements
      .filter((item): item is SelectedElement => item.type === 'edge')
      .map((item) => ({ ...item, data: edgeById.get(String(item.id)) ?? item.data }))
      .filter((item): item is GraphSelectedElement => Boolean(item.data));

    const mode: GraphSelectionState['mode'] = nodes.length > 0 && edges.length > 0 ? 'mixed' : nodes.length > 0 ? 'nodes' : edges.length > 0 ? 'edges' : 'none';
    return { nodes, edges, mode, total: nodes.length + edges.length };
  }, [selectedArtifact, selectedElements]);

  useEffect(() => {
    if (!graphSelection || graphSelection.mode === 'none' || graphSelection.mode === 'mixed') {
      setElementLabel('');
      setElementColor('');
      setElementIcon('');
      setElementIconScale('');
      setElementRingMode('unchanged');
      setElementRingWidth('');
      setElementEdgeWidth('');
      setElementEdgeDirection('');
      setElementEdgeStyle('unchanged');
      setElementEdgeType('');
      setNodeExtraAttributes([]);
      setEdgeExtraAttributes([]);
      return;
    }

    if (graphSelection.mode === 'nodes') {
      const label = getCommonValue(graphSelection.nodes, item => item.data?.label || item.data?.attributes?.visual?.label || item.data?.attributes?.label);
      const color = getCommonValue(graphSelection.nodes, item => item.data?.attributes?.visual?.color || item.data?.attributes?.color);
      const icon = getCommonValue(graphSelection.nodes, item => item.data?.attributes?.visual?.icon || item.data?.attributes?.icon);
      const scale = getCommonValue(graphSelection.nodes, item => {
        const fallback = getNodeTypeDefaultVisual(item.data);
        return item.data?.attributes?.visual?.iconScale ?? item.data?.attributes?.iconScale ?? fallback.iconScale ?? 2;
      });
      const ringEnabled = getCommonValue(graphSelection.nodes, item => {
        const fallback = getNodeTypeDefaultVisual(item.data);
        return item.data?.attributes?.visual?.ringEnabled ?? item.data?.attributes?.ringEnabled ?? fallback.ringEnabled ?? true;
      });
      const ringWidth = getCommonValue(graphSelection.nodes, item => {
        const fallback = getNodeTypeDefaultVisual(item.data);
        return item.data?.attributes?.visual?.ringWidth ?? item.data?.attributes?.ringWidth ?? fallback.ringWidth ?? 2;
      });

      setElementLabel(label === undefined ? '' : String(label));
      setElementColor(color === undefined ? '' : String(color));
      setElementIcon(icon === undefined ? '' : String(icon));
      setElementIconScale(scale === undefined ? '' : String(scale));
      setElementRingMode(ringEnabled === undefined ? 'unchanged' : (ringEnabled ? 'on' : 'off'));
      setElementRingWidth(ringWidth === undefined ? '' : String(ringWidth));
      setElementEdgeWidth('');
      setElementEdgeDirection('');
      setElementEdgeStyle('unchanged');
      setElementEdgeType('');
            const knownAttributeMap = new Map<string, DomainNodeAttributeOption>();
      graphSelection.nodes.forEach((nodeItem) => {
        getNodeTypeAttributeDefinitions(nodeItem.data).forEach((attribute) => {
          if (!knownAttributeMap.has(attribute.key)) {
            knownAttributeMap.set(attribute.key, attribute);
          }
        });
      });

      const keySet = new Set<string>();
      graphSelection.nodes.forEach((nodeItem) => {
        const nodeAttributes = (nodeItem.data?.attributes || {}) as Record<string, any>;
        Object.keys(nodeAttributes).forEach((key) => {
          if (!NODE_SYSTEM_ATTRIBUTE_KEYS.has(key)) keySet.add(key);
        });
      });
      knownAttributeMap.forEach((_, key) => keySet.add(key));

      const fields: NodeExtraAttributeState[] = Array.from(keySet).map((key) => {
        const descriptor = knownAttributeMap.get(key);
        const rawValues = graphSelection.nodes.map((nodeItem) => {
          const nodeAttributes = (nodeItem.data?.attributes || {}) as Record<string, any>;
          return normalizeAttributeValue(nodeAttributes[key]);
        });
        const firstValue = rawValues[0] || '';
        const mixedValue = rawValues.some((value) => value !== firstValue);

        const visibleValues = graphSelection.nodes.map((nodeItem) => {
          const visibleAttributes = nodeItem.data?.attributes?.visual?.visibleAttributes;
          if (Array.isArray(visibleAttributes)) return visibleAttributes.includes(key);
          const previewField = (nodeAttributePreviewConfig as any)?.fields?.[key];
          if (typeof previewField?.visibleOnGraph === 'boolean') {
            return Boolean(previewField.visibleOnGraph);
          }
          return false;
        });
        const firstVisible = visibleValues[0];
        const mixedVisible = visibleValues.some((value) => value !== firstVisible);

        return {
          key,
          label: normalizeDisplayLabel(String(descriptor?.label || ''), attributeLabelAliases[key] || key),
          type: String(descriptor?.type || 'string').toLowerCase(),
          value: mixedValue ? '' : firstValue,
          mixed: mixedValue,
          visibleOnGraph: mixedVisible ? 'mixed' : (firstVisible ? 'on' : 'off'),
        };
      });

      fields.sort((left, right) => {
        const typePriorityLeft = attributeTypePriority[left.type] ?? 99;
        const typePriorityRight = attributeTypePriority[right.type] ?? 99;
        if (typePriorityLeft !== typePriorityRight) return typePriorityLeft - typePriorityRight;
        return left.label.localeCompare(right.label, 'ru');
      });

      const fieldsForPanel = graphSelection.nodes.length === 1
        ? fields.filter((field) => field.mixed || field.visibleOnGraph !== 'off' || String(field.value || '').trim().length > 0)
        : fields;

      setNodeExtraAttributes(fieldsForPanel);
      setEdgeExtraAttributes([]);
      return;
    }

    const label = getCommonValue(graphSelection.edges, item => item.data?.label || item.data?.attributes?.visual?.label || item.data?.attributes?.label);
    const color = getCommonValue(graphSelection.edges, item => item.data?.attributes?.visual?.color || item.data?.attributes?.color);
    const width = getCommonValue(graphSelection.edges, item => item.data?.attributes?.visual?.width ?? item.data?.attributes?.width);
    const direction = getCommonValue(graphSelection.edges, item => item.data?.attributes?.visual?.direction || item.data?.attributes?.direction);
    const dashed = getCommonValue(graphSelection.edges, item => item.data?.attributes?.visual?.dashed ?? item.data?.attributes?.dashed);
    const edgeType = getCommonValue(graphSelection.edges, item => item.data?.type);

    setElementLabel(label === undefined ? '' : String(label));
    setElementColor(color === undefined ? '' : String(color));
    setElementIcon('');
    setElementIconScale('');
    setElementRingMode('unchanged');
    setElementRingWidth('');
    setElementEdgeWidth(width === undefined ? '' : String(width));
    setElementEdgeDirection(direction === undefined ? '' : String(direction));
    setElementEdgeStyle(dashed === undefined ? 'unchanged' : (dashed ? 'dashed' : 'solid'));
    setElementEdgeType(edgeType === undefined ? '' : String(edgeType));

    const edgeKeySet = new Set<string>();
    graphSelection.edges.forEach((edgeItem) => {
      const edgeAttributes = (edgeItem.data?.attributes || {}) as Record<string, any>;
      Object.keys(edgeAttributes).forEach((key) => {
        if (!EDGE_SYSTEM_ATTRIBUTE_KEYS.has(key)) edgeKeySet.add(key);
      });
    });

        const edgeFields: EdgeExtraAttributeState[] = Array.from(edgeKeySet).map((key) => {
      const rawValues = graphSelection.edges.map((edgeItem) => {
        const edgeAttributes = (edgeItem.data?.attributes || {}) as Record<string, any>;
        return normalizeAttributeValue(edgeAttributes[key]);
      });
      const firstValue = rawValues[0] || "";
      const mixedValue = rawValues.some((value) => value !== firstValue);
      const fallbackLabel = edgeAttributeLabelAliases[key] || key;
      const sampleValue = ((graphSelection.edges[0]?.data?.attributes || {}) as Record<string, any>)[key];
      const inferredType = typeof sampleValue === 'number' ? 'number' : 'string';

      const visibleValues = graphSelection.edges.map((edgeItem) => {
        const visibleAttributes = edgeItem.data?.attributes?.visual?.visibleAttributes;
        if (Array.isArray(visibleAttributes)) return visibleAttributes.includes(key);
        return true;
      });
      const firstVisible = visibleValues[0];
      const mixedVisible = visibleValues.some((value) => value !== firstVisible);

      return {
        key,
        label: normalizeDisplayLabel(fallbackLabel, fallbackLabel),
        type: inferredType,
        value: mixedValue ? "" : firstValue,
        mixed: mixedValue,
        visibleOnGraph: mixedVisible ? 'mixed' : (firstVisible ? 'on' : 'off'),
      };
    });

    const visibleEdgeFields = edgeFields.filter((field) => !["period_start", "period_end", "calls_count"].includes(field.key));
    visibleEdgeFields.sort((left, right) => left.label.localeCompare(right.label, "ru"));
    setNodeExtraAttributes([]);
    setEdgeExtraAttributes(visibleEdgeFields);
  }, [graphSelection, getNodeTypeDefaultVisual, getNodeTypeAttributeDefinitions]);
  useEffect(() => {
    if (!selectedArtifact || selectedArtifact.type !== 'graph') return;

    if (!builderNodeType && nodeTypeDefinitions.length > 0) {
      setBuilderNodeType(nodeTypeDefinitions[0].id);
    }
    if (!builderEdgeType && edgeTypeDefinitions.length > 0) {
      setBuilderEdgeType(edgeTypeDefinitions[0].id);
    }
  }, [selectedArtifact, nodeTypeDefinitions, edgeTypeDefinitions, builderNodeType, builderEdgeType]);
  const applicablePlugins = useMemo(() => plugins, [plugins]);
  const groupedPlugins = useMemo(() => groupPluginsByMenuPath(applicablePlugins), [applicablePlugins]);
  void groupedPlugins;

  const handleRunPlugin = useCallback(async (plugin: ApiPlugin) => {
    if (!selectedArtifact) return;
    setRunningPluginId(plugin.id);
    setPluginsMessage(null);
    setPluginsError(null);
    try {
      const targetProjectId = selectedArtifact.project_id;
      const params = await collectPluginParamsWithPrompts(plugin, targetProjectId);
      if (params === null) {
        setRunningPluginId(null);
        return;
      }
      const beforeNodeIds = new Set((selectedArtifact.data?.nodes || []).map((node: any) => String(node.id ?? node.node_id ?? '')));
      const response = await pluginApi.execute(plugin.id, targetProjectId, [selectedArtifact.id], params, pluginContext);
      await dispatch(fetchArtifacts(targetProjectId));
      const created = response?.created || [];
      if (created.length === 1) {
        dispatch(setCurrentArtifact(created[0].id));
      } else if (created.length > 1) {
        setCreatedArtifacts(created);
      }
      setPluginsMessage(labels.pluginDone.replace('{name}', plugin.name));

      const updatedCurrent = (response as any)?.updated?.find((item: any) => Number(item?.id) === Number(selectedArtifact.id));
      const nextNodes = Array.isArray(updatedCurrent?.data?.nodes) ? updatedCurrent.data.nodes : [];
      const newNodeIds = nextNodes
        .map((node: any) => String(node?.id ?? node?.node_id ?? ''))
        .filter((id: string) => id && !beforeNodeIds.has(id));

      const updatedMeta = updatedCurrent?.metadata || {};
      if (updatedMeta?.communications_selection_limited) {
        const limit = Number(updatedMeta?.communications_selection_limit || 0);
        setPluginsMessage(`РћР±СЂР°Р±РѕС‚Р°РЅС‹ С‚РѕР»СЊРєРѕ РїРµСЂРІС‹Рµ ${limit} Р°Р±РѕРЅРµРЅС‚РѕРІ РёР· РІС‹РґРµР»РµРЅРёСЏ. Р”Р»СЏ РѕСЃС‚Р°Р»СЊРЅС‹С… Р·Р°РїСѓСЃС‚РёС‚Рµ РїР»Р°РіРёРЅ РїРѕРІС‚РѕСЂРЅРѕ.`);
      }
      if (newNodeIds.length > 0) {
        const maxAutoLayout = Number(layoutConfig.pluginAutoLayout?.maxNewNodes || 80);
        const autoLayout = newNodeIds.length <= maxAutoLayout;
        window.dispatchEvent(new CustomEvent("graph:run-physics-layout", { detail: { newNodeIds, autoLayout } }));
      }
    } catch (error: any) {
      if (error?.response?.status === 404 && selectedArtifact) {
        try {
          const refreshed = await pluginApi.applicable(
            selectedArtifact.project_id,
            selectedArtifact.id,
            pluginContext
          );
          setPlugins(refreshed?.plugins || []);
        } catch {
          // ignore secondary failure
        }
        setPluginsError('Plugin is no longer available. Plugin list has been refreshed.');
      } else {
        const detail = error?.response?.data?.detail;
        setPluginsError(detail || error?.message || 'Failed to execute plugin');
      }
    } finally {
      setRunningPluginId(null);
    }
  }, [selectedArtifact, pluginContext, dispatch]);
  void handleRunPlugin;

  const handleSelectCreated = useCallback((artifactId: number) => {
    dispatch(setCurrentArtifact(artifactId));
    setCreatedArtifacts(null);
  }, [dispatch]);

  const handleRename = useCallback(async () => {
    if (!selectedArtifact || !currentProject) return;
    const trimmed = renameValue.trim();
    if (!trimmed || trimmed === selectedArtifact.name) {
      setIsRenaming(false);
      return;
    }
    const ok = window.confirm(`${labels.renameConfirm}\n\n${selectedArtifact.name} -> ${trimmed}`);
    if (!ok) return;
    setRenaming(true);
    try {
      const updated = await artifactApi.update(currentProject.id, selectedArtifact.id, { name: trimmed });
      dispatch(updateArtifactSync(updated));
      await dispatch(fetchArtifacts(currentProject.id));
      setIsRenaming(false);
    } catch (error) {
      // no-op
    } finally {
      setRenaming(false);
    }
  }, [selectedArtifact, currentProject, renameValue, dispatch]);

  const handleDelete = useCallback(async () => {
    if (!selectedArtifact || !currentProject || deleting) return;
    const ok = window.confirm(`${labels.deleteConfirm}\n\n${selectedArtifact.name}`);
    if (!ok) return;
    setDeleting(true);
    try {
      await dispatch(deleteArtifact({ projectId: currentProject.id, id: selectedArtifact.id }));
      await dispatch(fetchArtifacts(currentProject.id));
    } catch (error) {
      // no-op
    } finally {
      setDeleting(false);
    }
  }, [selectedArtifact, currentProject, deleting, dispatch]);

  const handleLoadProjectData = useCallback(() => {
    loadFilesInputRef.current?.click();
  }, []);

  const handleLoadProjectDataFiles = useCallback(async (event: React.ChangeEvent<HTMLInputElement>) => {
    if (!currentProject) return;
    const fileList = event.target.files;
    if (!fileList || fileList.length === 0) return;
    const files = Array.from(fileList);

    setDataLoading(true);
    setDataActionError(null);
    setDataActionMessage(null);
    setDataActionLog('');
    setIsLoadReportOpen(false);
    try {
      const result = await projectDataApi.loadFromFiles(currentProject.id, files);
      const readComm = Number(result.communications_rows || 0);
      const readDevice = Number(result.device_history_rows || 0);
      const insertedComm = Number(result.inserted_communications || 0);
      const insertedDevice = Number(result.inserted_device_history || 0);
      setDataActionMessage(
        `${labels.dataActionSuccess}:\n- РїСЂРѕС‡РёС‚Р°РЅРѕ ${readComm}/${readDevice}\n- РґРѕР±Р°РІР»РµРЅРѕ ${insertedComm}/${insertedDevice}\n(communications/device_history)`
      );
      if (result.load_log) {
        setDataActionLog(JSON.stringify(result.load_log, null, 2));
      }
      await refreshProjectDataStats(currentProject.id);
    } catch (error: any) {
      const detail = error?.response?.data?.detail || error?.message || labels.dataActionError;
      setDataActionError(String(detail));
    } finally {
      setDataLoading(false);
      event.target.value = '';
    }
  }, [currentProject, refreshProjectDataStats]);

  const handleClearProjectData = useCallback(async () => {
    if (!currentProject) return;
    const ok = window.confirm(`${labels.clearDataConfirm}\n\nProject ID: ${currentProject.id}`);
    if (!ok) return;

    setDataClearing(true);
    setDataActionError(null);
    setDataActionMessage(null);
    setDataActionLog('');
    setIsLoadReportOpen(false);
    try {
      const result = await projectDataApi.clear(currentProject.id);
      setDataActionMessage(
        `${labels.dataActionSuccess}: \u0443\u0434\u0430\u043b\u0435\u043d\u043e ${result.communications_deleted || 0} \u0437\u0430\u043f\u0438\u0441\u0435\u0439 communications \u0438 ${result.device_history_deleted || 0} \u0437\u0430\u043f\u0438\u0441\u0435\u0439 device_history.`
      );
      await refreshProjectDataStats(currentProject.id);
    } catch (error: any) {
      const detail = error?.response?.data?.detail || error?.message || labels.dataActionError;
      setDataActionError(String(detail));
    } finally {
      setDataClearing(false);
    }
  }, [currentProject, refreshProjectDataStats]);

const handleCreateNode = useCallback(() => {
    if (!selectedArtifact || selectedArtifact.type !== 'graph') return;
    const label = builderNodeLabel.trim();
    if (!label) return;
    const nodeType = nodeTypeDefinitions.find((item) => item.id === builderNodeType) || nodeTypeDefinitions[0];
    const nodeTypeId = nodeType?.id || 'entity';
    onStartNodeCreation?.(nodeTypeId, label);
    setBuilderNodeLabel('');
  }, [selectedArtifact, builderNodeLabel, builderNodeType, nodeTypeDefinitions, onStartNodeCreation]);

  const handleCreateEdge = useCallback(() => {
    if (!selectedArtifact || selectedArtifact.type !== 'graph') return;
    if (!builderEdgeType) return;
    if ((selectedArtifact.data?.nodes || []).length < 2) {
      window.alert(labels.chooseNodeFirst);
      return;
    }
    onStartEdgeCreation?.(builderEdgeType);
  }, [selectedArtifact, builderEdgeType, onStartEdgeCreation]);
  const applyElementEdits = useCallback(async () => {
    if (!selectedArtifact || !currentProject || !graphSelection || graphSelection.mode === 'none' || graphSelection.mode === 'mixed') {
      return;
    }

    const data = selectedArtifact.data || { nodes: [], edges: [] };
    const nodeIds = new Set(graphSelection.nodes.map(item => String(item.id)));
    const edgeIds = new Set(graphSelection.edges.map(item => String(item.id)));
    const nextLabel = elementLabel.trim();
    if (graphSelection.mode === 'nodes' && nextLabel) {
      const normalizedLabel = nextLabel.toLowerCase();
      const selectedNodes = (data.nodes || []).filter((node: any) => {
        const nodeId = String(node.id ?? node.node_id ?? node.uuid ?? node.key);
        return nodeIds.has(nodeId);
      });
      const selectedTypeGroups = new Map<string, number>();
      selectedNodes.forEach((node: any) => {
        const type = String(node?.type || '');
        selectedTypeGroups.set(type, (selectedTypeGroups.get(type) || 0) + 1);
      });

      const conflictInSelected = Array.from(selectedTypeGroups.values()).some((count) => count > 1);
      if (conflictInSelected) {
        window.alert('РћР±РЅР°СЂСѓР¶РµРЅС‹ РґСѓР±Р»РёРєР°С‚С‹: РґР»СЏ РІС‹Р±СЂР°РЅРЅС‹С… С‚РёРїРѕРІ СѓР¶Рµ РµСЃС‚СЊ СѓР·Р»С‹ СЃ С‚Р°РєРёРј РЅР°Р·РІР°РЅРёРµРј.');
        return;
      }

      const conflictWithExisting = (data.nodes || []).some((node: any) => {
        const nodeId = String(node.id ?? node.node_id ?? node.uuid ?? node.key);
        if (nodeIds.has(nodeId)) return false;
        const nodeType = String(node?.type || '');
        const nodeLabel = String(node?.label || node?.attributes?.visual?.label || node?.attributes?.label || '').trim().toLowerCase();
        if (nodeLabel !== normalizedLabel) return false;
        return selectedNodes.some((selected: any) => String(selected?.type || '') === nodeType);
      });

      if (conflictWithExisting) {
        window.alert('РћР±РЅР°СЂСѓР¶РµРЅС‹ РґСѓР±Р»РёРєР°С‚С‹: РґР»СЏ РІС‹Р±СЂР°РЅРЅС‹С… С‚РёРїРѕРІ СѓР¶Рµ РµСЃС‚СЊ СѓР·Р»С‹ СЃ С‚Р°РєРёРј РЅР°Р·РІР°РЅРёРµРј.');
        return;
      }
    }

    const updatedData = {
      ...data,
      nodes: (data.nodes || []).map((node: any) => {
        const nodeId = String(node.id ?? node.node_id ?? node.uuid ?? node.key);
        if (!nodeIds.has(nodeId)) return node;

        const attributes = { ...(node.attributes || {}) };
        const visual = { ...(attributes.visual || {}) };
        const nextNode = { ...node };

        if (elementLabel.trim()) {
          nextNode.label = elementLabel.trim();
          visual.label = elementLabel.trim();
          attributes.label = elementLabel.trim();
        }
        if (elementColor.trim()) {
          visual.color = elementColor.trim();
          attributes.color = elementColor.trim();
        }
        if (elementIcon.trim()) {
          visual.icon = elementIcon.trim();
          attributes.icon = elementIcon.trim();
        }
        if (elementIconScale.trim()) {
          const scale = Number(elementIconScale);
          if (!Number.isNaN(scale) && scale > 0) {
            visual.iconScale = scale;
            attributes.iconScale = scale;
          }
        }
        if (elementRingMode !== 'unchanged') {
          const enabled = elementRingMode === 'on';
          visual.ringEnabled = enabled;
          attributes.ringEnabled = enabled;
        }
        if (elementRingWidth.trim()) {
          const ringWidth = Number(elementRingWidth);
          if (!Number.isNaN(ringWidth) && ringWidth >= 0) {
            visual.ringWidth = ringWidth;
            attributes.ringWidth = ringWidth;
          }
        }

                if (graphSelection.mode === 'nodes' && nodeExtraAttributes.length > 0) {
          const visibleAttributesRaw = visual.visibleAttributes;
          const hasExplicitVisibleAttributes = Array.isArray(visibleAttributesRaw);
          let visibleAttributes = hasExplicitVisibleAttributes
            ? [...visibleAttributesRaw].map((key: any) => String(key))
            : null;

          nodeExtraAttributes.forEach((field) => {
            if (NODE_SYSTEM_ATTRIBUTE_KEYS.has(field.key)) return;

            if (!field.mixed) {
              const previousValue = attributes[field.key];
              if (Array.isArray(previousValue)) {
                attributes[field.key] = String(field.value || '').split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
              } else {
                attributes[field.key] = field.value;
              }
            }

            if (field.visibleOnGraph !== 'mixed') {
              if (!visibleAttributes) visibleAttributes = [];
              if (field.visibleOnGraph === 'on') {
                if (!visibleAttributes.includes(field.key)) visibleAttributes.push(field.key);
              } else {
                visibleAttributes = visibleAttributes.filter((item) => item !== field.key);
              }
            }
          });


          if (visibleAttributes) {
            visual.visibleAttributes = visibleAttributes;
          }
        }

        attributes.visual = visual;
        nextNode.attributes = attributes;
        return nextNode;
      }),
      edges: (data.edges || []).map((edge: any) => {
        const edgeId = String(edge.id);
        if (!edgeIds.has(edgeId)) return edge;

        const attributes = { ...(edge.attributes || {}) };
        const visual = { ...(attributes.visual || {}) };
        const nextEdge = { ...edge };

        const selectedEdgeType = elementEdgeType.trim();
        if (selectedEdgeType) {
          const edgeTypeDef = edgeTypeDefinitions.find((item) => item.id === selectedEdgeType);
          const defaults = edgeTypeDef?.defaultVisual || {};
          nextEdge.type = selectedEdgeType;
          if (!elementLabel.trim()) {
            const nextLabel = String(edgeTypeDef?.label || selectedEdgeType);
            nextEdge.label = nextLabel;
            visual.label = nextLabel;
            attributes.label = nextLabel;
          }
          visual.color = String(defaults.color || visual.color || '#64748b');
          attributes.color = visual.color;
          visual.width = Number(defaults.width ?? visual.width ?? 2);
          attributes.width = visual.width;
          visual.direction = String(defaults.direction || visual.direction || 'to');
          attributes.direction = visual.direction;
          visual.dashed = Boolean(defaults.dashed ?? visual.dashed ?? false);
          attributes.dashed = visual.dashed;
        }

        if (elementLabel.trim()) {
          nextEdge.label = elementLabel.trim();
          visual.label = elementLabel.trim();
          attributes.label = elementLabel.trim();
        }
        if (elementColor.trim()) {
          visual.color = elementColor.trim();
          attributes.color = elementColor.trim();
        }
        if (elementEdgeWidth.trim()) {
          const width = Number(elementEdgeWidth);
          if (!Number.isNaN(width) && width >= 1) {
            visual.width = width;
            attributes.width = width;
          }
        }
        if (elementEdgeDirection) {
          visual.direction = elementEdgeDirection;
          attributes.direction = elementEdgeDirection;
        }
        if (elementEdgeStyle !== 'unchanged') {
          const dashed = elementEdgeStyle === 'dashed';
          visual.dashed = dashed;
          attributes.dashed = dashed;
        }

        if (graphSelection.mode === 'edges' && edgeExtraAttributes.length > 0) {
          const nextVisibleAttributes = new Set<string>(
            Array.isArray(visual.visibleAttributes)
              ? visual.visibleAttributes.map((item: any) => String(item))
              : edgeExtraAttributes.filter((item) => item.visibleOnGraph !== 'off').map((item) => item.key)
          );

          edgeExtraAttributes.forEach((field) => {
            if (EDGE_SYSTEM_ATTRIBUTE_KEYS.has(field.key)) return;

            if (field.visibleOnGraph === 'on') nextVisibleAttributes.add(field.key);
            if (field.visibleOnGraph === 'off') nextVisibleAttributes.delete(field.key);

            if (field.mixed) return;
            const previousValue = attributes[field.key];
            if (Array.isArray(previousValue)) {
              attributes[field.key] = String(field.value || '').split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
              return;
            }
            if (field.type === 'number' || field.type === 'integer' || field.type === 'float') {
              const numeric = Number(field.value);
              attributes[field.key] = Number.isNaN(numeric) ? field.value : numeric;
              return;
            }
            attributes[field.key] = field.value;
          });

          visual.visibleAttributes = Array.from(nextVisibleAttributes);
          const nextEdgeLabel = buildEdgeLabelFromAttributes(attributes, visual.visibleAttributes);
          if (nextEdgeLabel) {
            nextEdge.label = nextEdgeLabel;
            visual.label = nextEdgeLabel;
            attributes.label = nextEdgeLabel;
          }
        }
        attributes.visual = visual;
        nextEdge.attributes = attributes;
        return nextEdge;
      })
    };

    setElementsSaving(true);
    try {
      if (onApplyGraphData && selectedArtifact.type === 'graph') {
        const actionType = graphSelection.mode === 'nodes' ? 'edit_node_attributes' : 'edit_edge_attributes';
        const description = graphSelection.mode === 'nodes'
          ? `Edit attributes for ${graphSelection.total} node(s)`
          : `Edit attributes for ${graphSelection.total} edge(s)`;
        await onApplyGraphData(updatedData, description, actionType);
      } else {
        const updated = await artifactApi.update(currentProject.id, selectedArtifact.id, { data: updatedData });
        dispatch(updateArtifactSync(updated));
      }
    } catch {
      // no-op
    } finally {
      setElementsSaving(false);
    }
  }, [
    selectedArtifact,
    currentProject,
    graphSelection,
    elementLabel,
    elementColor,
    elementIcon,
    elementIconScale,
    elementRingMode,
    elementRingWidth,
    elementEdgeWidth,
    elementEdgeDirection,
    elementEdgeStyle,
    elementEdgeType,
    nodeExtraAttributes,
    edgeExtraAttributes,
    edgeTypeDefinitions,
    dispatch,
    onApplyGraphData
  ]);
  if (!selectedArtifact) {
  return (
      <div className="inspector-panel">
        <div className="inspector-header">
          <h3>{labels.inspector}</h3>
        </div>
        <div className="inspector-empty">
          <p>{labels.selectArtifact}</p>
        </div>
      </div>
    );
  }


  const artifactMetadata = ((selectedArtifact as any).metadata || (selectedArtifact as any).artifact_metadata || {}) as Record<string, any>;
  const derivedFrom = artifactMetadata.derived_from;
  const sourcePlugin = artifactMetadata.source_plugin;
  const llmModel = String(artifactMetadata.llm_model || '').trim();
  const llmRuntime = String(artifactMetadata.llm_runtime || '').trim();
  const llmLatencyRaw = Number(artifactMetadata.llm_latency_ms);
  const llmLatency = Number.isFinite(llmLatencyRaw) && llmLatencyRaw > 0
    ? (llmLatencyRaw < 1000 ? `${Math.round(llmLatencyRaw)} мс` : `${(llmLatencyRaw / 1000).toFixed(2)} с`)
    : '';
  const hasLlmMeta = Boolean(llmModel || llmRuntime || llmLatency);

  const metadataRest = Object.fromEntries(
    Object.entries(artifactMetadata).filter(
      ([key]) =>
        key !== 'derived_from' &&
        key !== 'source_plugin' &&
        key !== 'llm_model' &&
        key !== 'llm_runtime' &&
        key !== 'llm_latency_ms'
    )
  );
  return (
    <div className="inspector-panel">
      {createdArtifacts && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.45)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 10000
          }}
        >
          <div
            style={{
              background: '#ffffff',
              border: '1px solid #d7deea',
              borderRadius: 8,
              padding: 12,
              minWidth: 260,
              maxWidth: 320
            }}
          >
            <div style={{ fontSize: 13, color: '#e5e7eb', marginBottom: 8 }}>{labels.selectResult}</div>
            {createdArtifacts.map(item => (
              <button
                key={item.id}
                onClick={() => handleSelectCreated(item.id)}
                style={{
                  width: '100%',
                  textAlign: 'left',
                  background: '#f8fafc',
                  border: '1px solid #d7deea',
                  color: '#e5e7eb',
                  padding: '6px 8px',
                  borderRadius: 6,
                  marginBottom: 6,
                  cursor: 'pointer'
                }}
              >
                {item.name}
              </button>
            ))}
            <button
              onClick={() => setCreatedArtifacts(null)}
              style={{
                width: '100%',
                background: 'transparent',
                border: 'none',
                color: '#9ca3af',
                padding: '6px 4px',
                cursor: 'pointer'
              }}
            >
              {labels.cancel}
            </button>
          </div>
        </div>
      )}

      {isLoadReportOpen && dataActionLog && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.45)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 10000
          }}
          onClick={() => setIsLoadReportOpen(false)}
        >
          <div
            style={{
              background: '#ffffff',
              border: '1px solid #d7deea',
              borderRadius: 8,
              padding: 12,
              width: 'min(92vw, 820px)',
              maxHeight: '80vh',
              display: 'flex',
              flexDirection: 'column',
              gap: 10
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ fontSize: 14, fontWeight: 600, color: '#0f172a' }}>{labels.loadReportTitle}</div>
            <pre style={{
              margin: 0,
              whiteSpace: 'pre-wrap',
              overflow: 'auto',
              maxHeight: '64vh',
              background: '#f8fafc',
              color: '#0f172a',
              border: '1px solid #d7deea',
              borderRadius: 6,
              padding: 10,
              fontSize: 12
            }}>{dataActionLog}</pre>
            <button
              onClick={() => setIsLoadReportOpen(false)}
              style={{
                alignSelf: 'flex-end',
                background: '#2563eb',
                border: '1px solid #3b82f6',
                color: '#fff',
                padding: '6px 12px',
                borderRadius: 6,
                cursor: 'pointer'
              }}
            >
              {labels.cancel}
            </button>
          </div>
        </div>
      )}

      <div className="inspector-header">
        <h3>{labels.inspector}</h3>
        {currentProject && (
          <div className="project-badge">
            {currentProject.name}
          </div>
        )}
      </div>

      <div className="inspector-tabs">
        <button
          className={'tab-btn ' + (activeTab === 'properties' ? 'active' : '')}
          onClick={() => handleTabChange('properties')}
        >
          {labels.properties}
        </button>
        {selectedArtifact.type === 'graph' && (
          <>
            <button
              className={'tab-btn ' + (activeTab === 'builder' ? 'active' : '')}
              onClick={() => handleTabChange('builder')}
            >
              {labels.builder}
            </button>
            <button
              className={'tab-btn ' + (activeTab === 'elements' ? 'active' : '')}
              onClick={() => handleTabChange('elements')}
            >
              {labels.elementProps}
            </button>
          </>
        )}
        <button
          className={'tab-btn ' + (activeTab === 'metadata' ? 'active' : '')}
          onClick={() => handleTabChange('metadata')}
        >
          {labels.metadata}
        </button>
      </div>

      <div className="inspector-content">
        {activeTab === 'properties' && (
          <div className="properties-tab">
            <details className="inspector-section" open>
              <summary>{'\u041e\u0431\u0437\u043e\u0440'}</summary>
              <div className="inspector-section-body">
                <div className="property-group">
                  <label>{labels.name}</label>
                  {!isRenaming ? (
                    <div className="property-inline">
                      <div className="property-value">{selectedArtifact.name}</div>
                      <button
                        className="property-action"
                        onClick={() => setIsRenaming(true)}
                      >
                        {labels.rename}
                      </button>
                    </div>
                  ) : (
                    <div className="property-inline">
                      <input
                        className="property-input"
                        value={renameValue}
                        onChange={(e) => setRenameValue(e.target.value)}
                      />
                      <button
                        className="property-action"
                        onClick={handleRename}
                        disabled={renaming}
                      >
                        {labels.save}
                      </button>
                      <button
                        className="property-action secondary"
                        onClick={() => {
                          setIsRenaming(false);
                          setRenameValue(selectedArtifact.name);
                        }}
                      >
                        {labels.cancel}
                      </button>
                    </div>
                  )}
                </div>

                <div className="property-group property-row-inline">
                  <label>{labels.created}</label>
                  <div className="property-value">
                    {new Date(selectedArtifact.created_at).toLocaleString()}
                  </div>
                </div>

                <div className="property-group property-row-inline">
                  <label>{labels.updated}</label>
                  <div className="property-value">
                    {new Date(selectedArtifact.updated_at).toLocaleString()}
                  </div>
                </div>
              </div>
            </details>

            <details className="inspector-section">
              <summary>{labels.dataManagement}</summary>
              <div className="inspector-section-body">
                <input
                  ref={loadFilesInputRef}
                  type="file"
                  multiple
                  style={{ display: 'none' }}
                  onChange={handleLoadProjectDataFiles}
                  {...({ webkitdirectory: '' } as any)}
                />

                <div className="data-stats-grid">
                  <div className="data-stat-card">
                    <div className="data-stat-label">{labels.communicationsCount}</div>
                    <div className="data-stat-value">{dataStatsLoading ? '...' : dataStats.communications}</div>
                  </div>
                  <div className="data-stat-card">
                    <div className="data-stat-label">{labels.deviceHistoryCount}</div>
                    <div className="data-stat-value">{dataStatsLoading ? '...' : dataStats.deviceHistory}</div>
                  </div>
                </div>

                <div className="property-group">
                  <label>{labels.loadData}</label>
                  <div className="property-inline">
                    <button
                      className="property-action"
                      onClick={handleLoadProjectData}
                      disabled={dataLoading || dataClearing}
                    >
                      {dataLoading ? labels.loading : labels.loadData}
                    </button>
                  </div>
                </div>

                <div className="property-group">
                  <label>{labels.clearProjectData}</label>
                  <div className="property-inline">
                    <button
                      className="property-action danger"
                      onClick={handleClearProjectData}
                      disabled={dataLoading || dataClearing}
                    >
                      {dataClearing ? labels.loading : labels.clearProjectData}
                    </button>
                  </div>
                </div>
                {dataActionMessage && <div className="property-value" style={{ whiteSpace: 'pre-line' }}>{dataActionMessage}</div>}
                {dataActionError && <div className="property-value" style={{ color: '#b91c1c' }}>{dataActionError}</div>}
                {dataActionLog && (
                  <button
                    className="property-action secondary"
                    type="button"
                    onClick={() => setIsLoadReportOpen(true)}
                  >
                    {labels.viewLoadReport}
                  </button>
                )}
              </div>
            </details>

            <details className="inspector-section">
              <summary>{'\u0414\u0435\u0439\u0441\u0442\u0432\u0438\u044f'}</summary>
              <div className="inspector-section-body">
                {selectedArtifact.type === 'console' && onRefreshConsole && (
                  <div className="property-group">
                    <label>{labels.refreshConsole}</label>
                    <div className="property-inline">
                      <button
                        className="property-action"
                        onClick={() => void onRefreshConsole()}
                        disabled={dataLoading || dataClearing || deleting}
                      >
                        {labels.refreshConsole}
                      </button>
                    </div>
                  </div>
                )}

                <div className="property-group">
                  <label>{labels.delete}</label>
                  <div className="property-inline">
                    <button
                      className="property-action danger"
                      onClick={handleDelete}
                      disabled={deleting || dataLoading || dataClearing}
                    >
                      {labels.delete}
                    </button>
                  </div>
                </div>
              </div>
            </details>
          </div>
        )}
        {activeTab === 'builder' && selectedArtifact.type === 'graph' && (
          <div className="properties-tab elements-tab builder-tab">
            <div className="property-group">
              <label>{labels.nodeLabel}</label>
              <input
                className="property-input"
                value={builderNodeLabel}
                onChange={(e) => setBuilderNodeLabel(e.target.value)}
                placeholder="New entity"
              />
            </div>
            <div className="property-group">
              <label>{labels.nodeType}</label>
              <select className="property-input" value={builderNodeType} onChange={(e) => setBuilderNodeType(e.target.value)}>
                {nodeTypeDefinitions.map((item) => (
                  <option key={item.id} value={item.id}>{item.label}</option>
                ))}
              </select>
            </div>
            <div className="property-group">
              <button className="property-action" onClick={handleCreateNode} disabled={builderSaving || !builderNodeLabel.trim()}>
                {builderSaving ? labels.loading : labels.createNode}
              </button>
            </div>

            <div className="property-group">
              <label>{labels.edgeType}</label>
              <EdgeTypeSelect
                value={builderEdgeType}
                onChange={setBuilderEdgeType}
                options={edgeTypeDefinitions}
                placeholder={labels.edgeType}
              />
            </div>
            <div className="property-group">
              <button className="property-action" onClick={handleCreateEdge} disabled={builderSaving || graphNodeOptions.length < 2 || !builderEdgeType}>
                {builderSaving ? labels.loading : labels.createEdgeOnGraph}
              </button>
            </div>

            {nodeCreationSpec && (
              <div className="property-value">{labels.nodeCreationActive}</div>
            )}
            {edgeCreationType && (
              <div className="property-value">{labels.edgeCreationActive}</div>
            )}
            {graphNodeOptions.length < 2 && (
              <div className="property-value">{labels.chooseNodeFirst}</div>
            )}
          </div>
        )}

        {activeTab === 'elements' && selectedArtifact.type === 'graph' && (
          <div className="properties-tab elements-tab">
            {!graphSelection || graphSelection.mode === 'none' ? (
              <div className="property-value">{labels.noSelection}</div>
            ) : graphSelection.mode === 'mixed' ? (
              <div className="property-value">{labels.mixedSelection}</div>
            ) : (
              <>
                <div className="property-group">
                  <label>{labels.selectedCount}</label>
                  <div className="property-value">{graphSelection.total}</div>
                </div>

                <div className="property-group">
                  <label>{labels.elementLabel}</label>
                  <input className="property-input" value={elementLabel} onChange={(e) => setElementLabel(e.target.value)} />
                </div>


                {graphSelection.mode === 'nodes' && (
                  <>
                    <div className="property-group">
                      <label>{labels.elementColor}</label>
                      <div className="property-inline">
                        <input
                          className="property-input"
                          type="color"
                          value={/^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(elementColor) ? elementColor : '#3b82f6'}
                          onChange={(e) => setElementColor(e.target.value)}
                          style={{ width: 36, minWidth: 36, height: 30, padding: 2, borderRadius: 6 }}
                        />
                        <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                          {nodeColorPalette.map((color) => (
                            <button
                              key={color}
                              type="button"
                              onClick={() => setElementColor(color)}
                              style={{ width: 18, height: 18, borderRadius: 4, border: '1px solid #475569', background: color, cursor: 'pointer' }}
                              title={color}
                            />
                          ))}
                          </div>
                        </div>
                      </div>
                    <div className="property-group">
                      <label>{labels.elementIcon}</label>
                      <select className="property-input" value={elementIcon} onChange={(e) => setElementIcon(e.target.value)}>
                        <option value="">{labels.unchanged}</option>
                        {iconOptions.map((opt) => (
                          <option key={opt.value} value={opt.value}>{opt.label}</option>
                        ))}
                      </select>
                    </div>
                    <div className="property-group">
                      <label>{labels.iconScale}</label>
                      <select className="property-input" value={elementIconScale} onChange={(e) => setElementIconScale(e.target.value)}>
                        <option value="">{labels.unchanged}</option>
                        {iconScaleOptions.map((size) => (
                          <option key={size} value={size}>{size}</option>
                        ))}
                      </select>
                    </div>
                    <div className="property-group">
                      <label>{labels.ringEnabled}</label>
                      <select className="property-input" value={elementRingMode} onChange={(e) => setElementRingMode(e.target.value as 'unchanged' | 'on' | 'off')}>
                        <option value="unchanged">{labels.unchanged}</option>
                        <option value="on">{labels.on}</option>
                        <option value="off">{labels.off}</option>
                      </select>
                    </div>
                    <div className="property-group">
                      <label>{labels.ringWidth}</label>
                      <input className="property-input" value={elementRingWidth} onChange={(e) => setElementRingWidth(e.target.value)} placeholder="2" />
                    </div>

                    {nodeExtraAttributes.length > 0 && (
                      <div className="node-attributes-editor">
                        {nodeExtraAttributes.map((field) => (
                          <div key={field.key} className="node-attribute-row">
                            <label className="node-attribute-title">
                              <input
                                type="checkbox"
                                checked={field.visibleOnGraph === 'on'}
                                ref={(el) => {
                                  if (el) el.indeterminate = field.visibleOnGraph === 'mixed';
                                }}
                                onChange={(event) => {
                                  const visibleOnGraph = event.target.checked ? 'on' : 'off';
                                  setNodeExtraAttributes((prev) => prev.map((item) => item.key === field.key ? { ...item, visibleOnGraph } : item));
                                }}
                              />
                              <span>{field.label}</span>
                            </label>
                            <textarea
                              className="property-input node-attribute-value"
                              value={field.value}
                              placeholder={field.mixed ? labels.unchanged : ''}
                              onChange={(event) => {
                                const nextValue = event.target.value;
                                setNodeExtraAttributes((prev) => prev.map((item) => item.key === field.key ? { ...item, value: nextValue, mixed: false } : item));
                              }}
                              rows={Math.max(2, Math.min(6, String(field.value || '').split(/\r?\n/).length || 2))}
                            />
                          </div>
                        ))}
                      </div>
                    )}
                  </>
                )}

                {graphSelection.mode === 'edges' && (
                  <>
                    <div className="property-group">
                      <label>{labels.edgeType}</label>
                      <EdgeTypeSelect
                        value={elementEdgeType}
                        onChange={setElementEdgeType}
                        options={edgeTypeDefinitions}
                        placeholder={labels.unchanged}
                        allowEmpty={true}
                        emptyLabel={labels.unchanged}
                      />
                    </div>
                    <div className="property-group">
                      <label>{labels.edgeWidth}</label>
                      <input className="property-input" value={elementEdgeWidth} onChange={(e) => setElementEdgeWidth(e.target.value)} placeholder="2" />
                    </div>
                    <div className="property-group">
                      <label>{labels.edgeDirection}</label>
                      <select className="property-input" value={elementEdgeDirection} onChange={(e) => setElementEdgeDirection(e.target.value)}>
                        <option value="">{labels.unchanged}</option>
                        {edgeDirectionOptions.map((direction) => (
                          <option key={direction} value={direction}>
                            {direction === 'from' ? '<-' : direction === 'to' ? '->' : '<->'}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="property-group">
                      <label>{labels.edgeStyle}</label>
                      <select className="property-input" value={elementEdgeStyle} onChange={(e) => setElementEdgeStyle(e.target.value as 'unchanged' | 'solid' | 'dashed')}>
                        <option value="unchanged">{labels.unchanged}</option>
                        <option value="solid">{labels.solid}</option>
                        <option value="dashed">{labels.dashed}</option>
                      </select>
                    </div>

                    {edgeExtraAttributes.length > 0 && (
                      <div className="node-attributes-editor">
                        {edgeExtraAttributes.map((field) => (
                          <div key={field.key} className="node-attribute-row">
                            <label className="node-attribute-title">
                              <input
                                type="checkbox"
                                checked={field.visibleOnGraph === 'on'}
                                ref={(el) => {
                                  if (el) el.indeterminate = field.visibleOnGraph === 'mixed';
                                }}
                                onChange={(event) => {
                                  const visibleOnGraph = event.target.checked ? 'on' : 'off';
                                  setEdgeExtraAttributes((prev) => prev.map((item) => item.key === field.key ? { ...item, visibleOnGraph } : item));
                                }}
                              />
                              <span>{field.label}</span>
                            </label>
                            <textarea
                              className="property-input node-attribute-value"
                              value={field.value}
                              placeholder={field.mixed ? labels.unchanged : ""}
                              onChange={(event) => {
                                const nextValue = event.target.value;
                                setEdgeExtraAttributes((prev) => prev.map((item) => item.key === field.key ? { ...item, value: nextValue, mixed: false } : item));
                              }}
                              rows={Math.max(2, Math.min(6, String(field.value || "").split(/\r?\n/).length || 2))}
                            />
                          </div>
                        ))}
                      </div>
                    )}
                  </>
                )}

                <div className="property-group apply-group">
                  <button className="property-action" onClick={applyElementEdits} disabled={elementsSaving}>
                    {elementsSaving ? labels.loading : labels.apply}
                  </button>
                </div>
              </>
            )}
          </div>
        )}
        {activeTab === 'metadata' && (
          <div className="metadata-tab">
            <div className="property-group">
              <label>{labels.type}</label>
              <div className="property-value type-badge">
                {selectedArtifact.type === 'graph' ? labels.typeGraph :
                 selectedArtifact.type === 'table' ? labels.typeTable :
                 selectedArtifact.type === 'map' ? labels.typeMap :
                 selectedArtifact.type === 'chart' ? labels.typeChart :
                 selectedArtifact.type === 'console' ? labels.typeConsole : labels.typeDocument}
              </div>
            </div>

            {selectedArtifact.description && (
              <div className="property-group">
                <label>{labels.description}</label>
                <div className="property-value">{selectedArtifact.description}</div>
              </div>
            )}

            <div className="property-group">
              <label>{labels.version}</label>
              <div className="property-value">v{selectedArtifact.version || 1}</div>
            </div>

            {hasLlmMeta && (
              <div className="property-group">
                <label>{labels.llmSection}</label>
                <div className="property-value">
                  {labels.llmModel}: {llmModel || '-'}
                  <br />
                  {labels.llmRuntime}: {llmRuntime || '-'}
                  <br />
                  {labels.llmLatency}: {llmLatency || '-'}
                </div>
              </div>
            )}

            {sourcePlugin && (
              <div className="property-group">
                <label>source_plugin</label>
                <div className="property-value">{String(sourcePlugin)}</div>
              </div>
            )}

            {derivedFrom !== undefined && derivedFrom !== null && (
              <div className="property-group">
                <label>derived_from</label>
                <div className="property-value">{String(derivedFrom)}</div>
              </div>
            )}

            <div className="property-group">
              <label>{labels.artifactId}</label>
              <div className="property-value">{selectedArtifact.id}</div>
            </div>

            <div className="property-group">
              <label>{labels.projectId}</label>
              <div className="property-value">{selectedArtifact.project_id}</div>
            </div>

            {Object.keys(metadataRest).length > 0 && (
              <div className="property-group">
                <label>{labels.extraMetadata}</label>
                <pre className="metadata-json">
                  {JSON.stringify(metadataRest, null, 2)}
                </pre>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default InspectorPanel;



