import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { buildSearchText, formatGraphTableCellValue } from '../components/app/graphBottomPanelUtils';
import type { GraphWorkbenchResultColumn, GraphWorkbenchResultTab } from '../components/app/graphBottomPanelTypes';
import { useAppDispatch, useAppSelector } from '../store';
import { setSelectedElements } from '../store/slices/uiSlice';
import { normalizeConsoleTabs, type RawConsoleArtifactData } from '../utils/consoleResultTabs';
import type { GraphPanelArtifact, GraphPanelEdge, GraphPanelNode } from './graphTableTypes';
import { useGraphTablePanelData } from './useGraphTablePanelData';
import { useGraphTableSelection } from './useGraphTableSelection';
import type { BottomTab } from './useGraphBottomPanelState';

interface EdgeTypeVisual {
  color: string;
  width: number;
  direction: string;
  dashed: boolean;
  label: string;
}

interface UseGraphBottomPanelViewModelArgs {
  activeArtifact: GraphPanelArtifact;
  edgeTypeVisuals: Record<string, EdgeTypeVisual>;
  isBottomPanelOpen: boolean;
  bottomTab: BottomTab;
}

type ConsoleArtifactDataShape = RawConsoleArtifactData & {
  input_snapshot?: {
    params?: Record<string, unknown>;
    context?: {
      selected_nodes?: Array<{
        id?: string;
        type?: string;
        label?: unknown;
      }>;
      selected_edges?: Array<{
        id?: string;
      }>;
    };
  };
};

const formatInputSummary = (data: ConsoleArtifactDataShape): {
  inputSummary: string;
  inputObjectType: string | null;
  inputObjectCount: number | null;
  sourceSearchText: string;
} => {
  const params = data.input_snapshot?.params && typeof data.input_snapshot.params === 'object'
    ? data.input_snapshot.params
    : {};
  const selectedNodes = Array.isArray(data.input_snapshot?.context?.selected_nodes)
    ? data.input_snapshot?.context?.selected_nodes
    : [];

  const typeCounts = new Map<string, number>();
  selectedNodes.forEach((node) => {
    const type = String(node?.type || '').trim();
    if (!type) return;
    typeCounts.set(type, (typeCounts.get(type) || 0) + 1);
  });

  const dominantType = typeCounts.size === 1 ? Array.from(typeCounts.keys())[0] : null;
  const objectCount = selectedNodes.length || null;
  const paramPreview = Object.entries(params)
    .slice(0, 3)
    .map(([key, value]) => `${key}=${formatGraphTableCellValue(value)}`)
    .join(', ');

  const summaryParts: string[] = [];
  if (dominantType && objectCount) summaryParts.push(`${dominantType}: ${objectCount}`);
  else if (objectCount) summaryParts.push(`объектов: ${objectCount}`);
  if (paramPreview) summaryParts.push(paramPreview);

  const sourceSearchText = buildSearchText([
    dominantType,
    objectCount,
    ...selectedNodes.map((node) => [node?.id, node?.type, node?.label]),
    ...Object.entries(params).flatMap(([key, value]) => [key, formatGraphTableCellValue(value)]),
  ]);

  return {
    inputSummary: summaryParts.join(' • ') || 'Параметры запуска без сводки входа',
    inputObjectType: dominantType,
    inputObjectCount: objectCount,
    sourceSearchText,
  };
};

const collectAttributeValueOptions = (
  items: Array<GraphPanelNode | GraphPanelEdge>,
  getAttributes: (item: GraphPanelNode | GraphPanelEdge) => Record<string, unknown>,
  attributeKey: string,
) => {
  if (!attributeKey) return [];
  const values = new Set<string>();
  items.forEach((item) => {
    const value = getAttributes(item)[attributeKey];
    if (Array.isArray(value)) {
      value.forEach((entry) => {
        const normalized = formatGraphTableCellValue(entry).trim();
        if (normalized) values.add(normalized);
      });
      return;
    }
    const normalized = formatGraphTableCellValue(value).trim();
    if (normalized) values.add(normalized);
  });
  return Array.from(values).sort((a, b) => a.localeCompare(b, 'ru', { sensitivity: 'base', numeric: true }));
};

const normalizeResultColumn = (value: string | GraphWorkbenchResultColumn): GraphWorkbenchResultColumn => {
  if (typeof value === 'string') {
    return {
      key: value,
      original_name: value,
      label: value,
      type: 'string',
      width: null,
      visible: true,
    };
  }

  const key = String(value.key || value.original_name || '').trim();
  return {
    ...value,
    key,
    original_name: String(value.original_name || key).trim() || key,
    label: String(value.label || value.original_name || key).trim() || key,
    type: String(value.type || 'string'),
    width: typeof value.width === 'number' ? value.width : null,
    visible: value.visible !== false,
  };
};

const toResultTabs = (
  artifactId: number,
  artifactName: string,
  artifactVersion: number,
  profileName: string,
  executedAt: string | null,
  createdAt: string | null,
  data: ConsoleArtifactDataShape,
): GraphWorkbenchResultTab[] => {
  return normalizeConsoleTabs(data).map((tab) => ({
      ...formatInputSummary(data),
      sourceArtifactId: artifactId,
      sourceArtifactName: artifactName,
      sourceArtifactVersion: artifactVersion,
      profileName,
      executedAt,
      sourceArtifactCreatedAt: createdAt,
      tabId: tab.id,
      tabName: tab.name,
      rowCount: tab.row_count,
      columns: tab.columns.map(normalizeResultColumn).filter((column) => column.visible !== false && column.key),
      rows: tab.rows,
    }));
};

export const useGraphBottomPanelViewModel = ({
  activeArtifact,
  edgeTypeVisuals,
  isBottomPanelOpen,
  bottomTab,
}: UseGraphBottomPanelViewModelArgs) => {
  const dispatch = useAppDispatch();
  const selectedElements = useAppSelector((state) => state.ui.selectedElements);
  const artifacts = useAppSelector((state) => state.artifacts.items);
  const [searchQuery, setSearchQuery] = useState('');
  const [nodeTypeFilter, setNodeTypeFilter] = useState('');
  const [edgeTypeFilter, setEdgeTypeFilter] = useState('');
  const [nodeAttributeKeyFilter, setNodeAttributeKeyFilter] = useState('');
  const [edgeAttributeKeyFilter, setEdgeAttributeKeyFilter] = useState('');
  const [nodeAttributeValueFilter, setNodeAttributeValueFilter] = useState('');
  const [edgeAttributeValueFilter, setEdgeAttributeValueFilter] = useState('');
  const [showOnlySelected, setShowOnlySelected] = useState(false);
  const lastNodeRowIndexRef = useRef<number | null>(null);
  const lastEdgeRowIndexRef = useRef<number | null>(null);
  const nodeRowRefs = useRef<Record<string, HTMLTableRowElement | null>>({});
  const edgeRowRefs = useRef<Record<string, HTMLTableRowElement | null>>({});

  const {
    graphNodesForPanel,
    graphEdgesForPanel,
    nodeLabelById,
    selectedNodeIds,
    selectedEdgeIds,
    nodeById,
    edgeById,
    getNormalizedEdgeAttributes,
    nodeAttributeColumns,
    edgeAttributeColumns,
    formatAttributeHeader,
    sortedGraphNodesForPanel,
    sortedGraphEdgesForPanel,
    nodeSortKey,
    nodeSortDir,
    edgeSortKey,
    edgeSortDir,
    toggleNodeSort,
    toggleEdgeSort,
  } = useGraphTablePanelData({
    activeArtifact,
    selectedElements,
    edgeTypeVisuals,
  });

  const renderSortIndicator = useCallback((active: boolean, dir: 'asc' | 'desc') => {
    return (
      <span className={`bottom-sort-indicator ${active ? 'active' : ''}`} aria-hidden="true">
        {active ? (dir === 'asc' ? '\u2191' : '\u2193') : '\u2195'}
      </span>
    );
  }, []);

  const normalizedSearchQuery = useMemo(
    () => searchQuery.trim().toLowerCase(),
    [searchQuery],
  );

  const nodeTypeOptions = useMemo(
    () => Array.from(new Set(
      graphNodesForPanel
        .map((node) => String(node?.type || '').trim())
        .filter(Boolean),
    )).sort((a, b) => a.localeCompare(b, 'ru', { sensitivity: 'base', numeric: true })),
    [graphNodesForPanel],
  );

  const edgeTypeOptions = useMemo(
    () => Array.from(new Set(
      graphEdgesForPanel
        .map((edge) => String(edge?.type || '').trim())
        .filter(Boolean),
    )).sort((a, b) => a.localeCompare(b, 'ru', { sensitivity: 'base', numeric: true })),
    [graphEdgesForPanel],
  );

  const nodesAfterBaseFilters = useMemo(() => {
    return sortedGraphNodesForPanel.filter((node) => {
      const nodeId = String(node?.id ?? node?.node_id ?? '');
      if (nodeTypeFilter && String(node?.type || '').trim() !== nodeTypeFilter) {
        return false;
      }
      if (showOnlySelected && !selectedNodeIds.has(nodeId)) {
        return false;
      }
      if (!normalizedSearchQuery) {
        return true;
      }
      const attrs = node?.attributes || {};
      const searchableText = buildSearchText([
        node?.id,
        node?.node_id,
        node?.type,
        node?.label,
        attrs.label,
        ...Object.values(attrs),
      ]);
      return searchableText.includes(normalizedSearchQuery);
    });
  }, [
    nodeTypeFilter,
    normalizedSearchQuery,
    selectedNodeIds,
    showOnlySelected,
    sortedGraphNodesForPanel,
  ]);

  const edgesAfterBaseFilters = useMemo(() => {
    return sortedGraphEdgesForPanel.filter((edge) => {
      const edgeId = String(edge?.id ?? '');
      if (edgeTypeFilter && String(edge?.type || '').trim() !== edgeTypeFilter) {
        return false;
      }
      if (showOnlySelected && !selectedEdgeIds.has(edgeId)) {
        return false;
      }
      if (!normalizedSearchQuery) {
        return true;
      }
      const attrs = getNormalizedEdgeAttributes(edge);
      const fromId = String(edge?.from || edge?.source_node || '');
      const toId = String(edge?.to || edge?.target_node || '');
      const searchableText = buildSearchText([
        edge?.id,
        edge?.type,
        edge?.label,
        fromId,
        toId,
        nodeLabelById[fromId],
        nodeLabelById[toId],
        attrs.label,
        ...Object.values(attrs),
      ]);
      return searchableText.includes(normalizedSearchQuery);
    });
  }, [
    edgeTypeFilter,
    getNormalizedEdgeAttributes,
    nodeLabelById,
    normalizedSearchQuery,
    selectedEdgeIds,
    showOnlySelected,
    sortedGraphEdgesForPanel,
  ]);

  const nodeAttributeKeyOptions = useMemo(() => {
    const keys = new Set<string>();
    nodesAfterBaseFilters.forEach((node) => {
      Object.keys(node?.attributes || {}).forEach((key) => {
        if (key === 'visual' || key === 'icon' || key === 'label') return;
        keys.add(key);
      });
    });
    return Array.from(keys).sort((a, b) => formatAttributeHeader(a).localeCompare(formatAttributeHeader(b), 'ru', { sensitivity: 'base', numeric: true }));
  }, [formatAttributeHeader, nodesAfterBaseFilters]);

  const edgeAttributeKeyOptions = useMemo(() => {
    const keys = new Set<string>();
    edgesAfterBaseFilters.forEach((edge) => {
      Object.keys(getNormalizedEdgeAttributes(edge)).forEach((key) => {
        if (key === 'visual' || key === 'label') return;
        keys.add(key);
      });
    });
    return Array.from(keys).sort((a, b) => formatAttributeHeader(a).localeCompare(formatAttributeHeader(b), 'ru', { sensitivity: 'base', numeric: true }));
  }, [edgesAfterBaseFilters, formatAttributeHeader, getNormalizedEdgeAttributes]);

  const nodeAttributeValueOptions = useMemo(
    () => collectAttributeValueOptions(nodesAfterBaseFilters, (item) => (item as GraphPanelNode).attributes || {}, nodeAttributeKeyFilter),
    [nodeAttributeKeyFilter, nodesAfterBaseFilters],
  );

  const edgeAttributeValueOptions = useMemo(
    () => collectAttributeValueOptions(edgesAfterBaseFilters, (item) => getNormalizedEdgeAttributes(item as GraphPanelEdge), edgeAttributeKeyFilter),
    [edgeAttributeKeyFilter, edgesAfterBaseFilters, getNormalizedEdgeAttributes],
  );

  useEffect(() => {
    if (nodeTypeFilter && !nodeTypeOptions.includes(nodeTypeFilter)) {
      setNodeTypeFilter('');
    }
  }, [nodeTypeFilter, nodeTypeOptions]);

  useEffect(() => {
    if (edgeTypeFilter && !edgeTypeOptions.includes(edgeTypeFilter)) {
      setEdgeTypeFilter('');
    }
  }, [edgeTypeFilter, edgeTypeOptions]);

  useEffect(() => {
    if (nodeAttributeKeyFilter && !nodeAttributeKeyOptions.includes(nodeAttributeKeyFilter)) {
      setNodeAttributeKeyFilter('');
      setNodeAttributeValueFilter('');
    }
  }, [nodeAttributeKeyFilter, nodeAttributeKeyOptions]);

  useEffect(() => {
    if (edgeAttributeKeyFilter && !edgeAttributeKeyOptions.includes(edgeAttributeKeyFilter)) {
      setEdgeAttributeKeyFilter('');
      setEdgeAttributeValueFilter('');
    }
  }, [edgeAttributeKeyFilter, edgeAttributeKeyOptions]);

  useEffect(() => {
    if (nodeAttributeValueFilter && !nodeAttributeValueOptions.includes(nodeAttributeValueFilter)) {
      setNodeAttributeValueFilter('');
    }
  }, [nodeAttributeValueFilter, nodeAttributeValueOptions]);

  useEffect(() => {
    if (edgeAttributeValueFilter && !edgeAttributeValueOptions.includes(edgeAttributeValueFilter)) {
      setEdgeAttributeValueFilter('');
    }
  }, [edgeAttributeValueFilter, edgeAttributeValueOptions]);

  const visibleGraphNodesForPanel = useMemo(() => {
    return nodesAfterBaseFilters.filter((node) => {
      if (!nodeAttributeKeyFilter || !nodeAttributeValueFilter) {
        return true;
      }
      const rawValue = (node?.attributes || {})[nodeAttributeKeyFilter];
      if (Array.isArray(rawValue)) {
        return rawValue.some((entry) => formatGraphTableCellValue(entry).trim() === nodeAttributeValueFilter);
      }
      return formatGraphTableCellValue(rawValue).trim() === nodeAttributeValueFilter;
    });
  }, [nodeAttributeKeyFilter, nodeAttributeValueFilter, nodesAfterBaseFilters]);

  const visibleGraphEdgesForPanel = useMemo(() => {
    return edgesAfterBaseFilters.filter((edge) => {
      if (!edgeAttributeKeyFilter || !edgeAttributeValueFilter) {
        return true;
      }
      const rawValue = getNormalizedEdgeAttributes(edge)[edgeAttributeKeyFilter];
      if (Array.isArray(rawValue)) {
        return rawValue.some((entry) => formatGraphTableCellValue(entry).trim() === edgeAttributeValueFilter);
      }
      return formatGraphTableCellValue(rawValue).trim() === edgeAttributeValueFilter;
    });
  }, [edgeAttributeKeyFilter, edgeAttributeValueFilter, edgesAfterBaseFilters, getNormalizedEdgeAttributes]);

  const resultTabs = useMemo(() => {
    if (!activeArtifact || activeArtifact.type !== 'graph') return [] as GraphWorkbenchResultTab[];

    return Object.values(artifacts)
      .filter((artifact) => {
        if (!artifact || artifact.type !== 'console') return false;
        if (artifact.project_id !== activeArtifact.project_id) return false;
        return String(artifact.metadata?.console_context_artifact_id || '') === String(activeArtifact.id);
      })
      .flatMap((artifact) => {
        const profileName = String(
          artifact.data?.profile_name ||
          artifact.data?.profile_key ||
          artifact.data?.profile_id ||
          artifact.metadata?.console_profile_id ||
          'Консольный результат',
        );
        const executedAt = artifact.updated_at || artifact.created_at || null;
        return toResultTabs(
          artifact.id,
          artifact.name,
          artifact.version,
          profileName,
          executedAt,
          artifact.created_at || null,
          (artifact.data || {}) as ConsoleArtifactDataShape,
        );
      })
      .sort((left, right) => {
        const leftDate = left.executedAt ? Date.parse(left.executedAt) : 0;
        const rightDate = right.executedAt ? Date.parse(right.executedAt) : 0;
        return rightDate - leftDate;
      });
  }, [activeArtifact, artifacts]);

  const selectionTab = bottomTab === 'results' ? 'nodes' : bottomTab;

  const { handleNodeRowClick, handleEdgeRowClick } = useGraphTableSelection({
    dispatch,
    setSelectedElementsAction: setSelectedElements,
    selectedNodeIds,
    selectedEdgeIds,
    sortedGraphNodesForPanel: visibleGraphNodesForPanel,
    sortedGraphEdgesForPanel: visibleGraphEdgesForPanel,
    nodeById,
    edgeById,
    isBottomPanelOpen,
    bottomTab: selectionTab,
    lastNodeRowIndexRef,
    lastEdgeRowIndexRef,
    nodeRowRefs,
    edgeRowRefs,
  });

  return {
    graphNodesForPanel,
    graphEdgesForPanel,
    toggleNodeSort,
    toggleEdgeSort,
    renderSortIndicator,
    nodeSortKey,
    nodeSortDir,
    edgeSortKey,
    edgeSortDir,
    nodeAttributeColumns,
    edgeAttributeColumns,
    formatAttributeHeader,
    visibleGraphNodesForPanel,
    visibleGraphEdgesForPanel,
    selectedNodeIds,
    selectedEdgeIds,
    handleNodeRowClick,
    handleEdgeRowClick,
    nodeRowRefs,
    edgeRowRefs,
    getNormalizedEdgeAttributes,
    nodeLabelById,
    searchQuery,
    setSearchQuery,
    nodeTypeOptions,
    edgeTypeOptions,
    activeTypeFilter: bottomTab === 'nodes' ? nodeTypeFilter : edgeTypeFilter,
    setNodeTypeFilter,
    setEdgeTypeFilter,
    nodeAttributeKeyOptions,
    edgeAttributeKeyOptions,
    activeAttributeKeyFilter: bottomTab === 'nodes' ? nodeAttributeKeyFilter : edgeAttributeKeyFilter,
    setNodeAttributeKeyFilter,
    setEdgeAttributeKeyFilter,
    attributeValueOptions: bottomTab === 'nodes' ? nodeAttributeValueOptions : edgeAttributeValueOptions,
    activeAttributeValueFilter: bottomTab === 'nodes' ? nodeAttributeValueFilter : edgeAttributeValueFilter,
    setNodeAttributeValueFilter,
    setEdgeAttributeValueFilter,
    showOnlySelected,
    setShowOnlySelected,
    resultTabs,
  };
};

export default useGraphBottomPanelViewModel;
