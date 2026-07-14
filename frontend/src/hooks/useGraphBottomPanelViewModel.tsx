import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { buildSearchText, formatGraphTableCellValue } from '../components/app/graphBottomPanelUtils';
import { useAppDispatch, useAppSelector } from '../store';
import { setSelectedElements } from '../store/slices/uiSlice';
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

export const useGraphBottomPanelViewModel = ({
  activeArtifact,
  edgeTypeVisuals,
  isBottomPanelOpen,
  bottomTab,
}: UseGraphBottomPanelViewModelArgs) => {
  const dispatch = useAppDispatch();
  const selectedElements = useAppSelector((state) => state.ui.selectedElements);
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
    bottomTab,
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
  };
};

export default useGraphBottomPanelViewModel;
