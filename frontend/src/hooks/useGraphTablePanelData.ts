import { useCallback, useMemo, useState } from 'react';
import type { SelectedElement } from '../store/slices/uiSlice';
import {
  getGraphEdgeId,
  getGraphNodeId,
  isEdgeSelectedElement,
  isNodeSelectedElement,
  type GraphPanelArtifact,
  type GraphPanelEdge,
  type GraphPanelNode,
} from './graphTableTypes';

interface EdgeTypeVisual {
  color: string;
  width: number;
  direction: string;
  dashed: boolean;
  label: string;
}

interface UseGraphTablePanelDataArgs {
  activeArtifact: GraphPanelArtifact;
  selectedElements: SelectedElement[];
  edgeTypeVisuals: Record<string, EdgeTypeVisual>;
}

export const useGraphTablePanelData = ({
  activeArtifact,
  selectedElements,
  edgeTypeVisuals,
}: UseGraphTablePanelDataArgs) => {
  const [nodeSortKey, setNodeSortKey] = useState<string>('label');
  const [nodeSortDir, setNodeSortDir] = useState<'asc' | 'desc'>('asc');
  const [edgeSortKey, setEdgeSortKey] = useState<string>('label');
  const [edgeSortDir, setEdgeSortDir] = useState<'asc' | 'desc'>('asc');

  const graphNodesForPanel = useMemo<GraphPanelNode[]>(() => {
    if (!activeArtifact || activeArtifact.type !== 'graph') return [];
    const nodes = activeArtifact.data?.nodes;
    return Array.isArray(nodes) ? (nodes as GraphPanelNode[]) : [];
  }, [activeArtifact]);

  const graphEdgesForPanel = useMemo<GraphPanelEdge[]>(() => {
    if (!activeArtifact || activeArtifact.type !== 'graph') return [];
    const edges = activeArtifact.data?.edges;
    return Array.isArray(edges) ? (edges as GraphPanelEdge[]) : [];
  }, [activeArtifact]);

  const nodeLabelById = useMemo(() => {
    const result: Record<string, string> = {};
    graphNodesForPanel.forEach((node) => {
      const id = getGraphNodeId(node);
      if (!id) return;
      const attrs = (node.attributes || {}) as Record<string, unknown>;
      const visual = (attrs.visual || {}) as Record<string, unknown>;
      result[id] = String(node.label || visual.label || attrs.label || id);
    });
    return result;
  }, [graphNodesForPanel]);

  const selectedNodeIds = useMemo(
    () => new Set((selectedElements || []).filter(isNodeSelectedElement).map((item) => String(item.id))),
    [selectedElements],
  );

  const selectedEdgeIds = useMemo(
    () => new Set((selectedElements || []).filter(isEdgeSelectedElement).map((item) => String(item.id))),
    [selectedElements],
  );

  const nodeById = useMemo(() => {
    const result: Record<string, GraphPanelNode> = {};
    graphNodesForPanel.forEach((node) => {
      const id = getGraphNodeId(node);
      if (!id) return;
      result[id] = node;
    });
    return result;
  }, [graphNodesForPanel]);

  const edgeById = useMemo(() => {
    const result: Record<string, GraphPanelEdge> = {};
    graphEdgesForPanel.forEach((edge) => {
      const id = getGraphEdgeId(edge);
      if (!id) return;
      result[id] = edge;
    });
    return result;
  }, [graphEdgesForPanel]);

  const getNormalizedEdgeAttributes = useCallback((edge: GraphPanelEdge): Record<string, unknown> => {
    const attrs = { ...(edge?.attributes || {}) } as Record<string, unknown>;
    const currentDirection = String(attrs.direction ?? '').trim();
    if (!currentDirection) {
      const typeId = String(edge?.type || '');
      const fallbackDirection = edgeTypeVisuals[typeId]?.direction;
      if (fallbackDirection) attrs.direction = fallbackDirection;
    }
    return attrs;
  }, [edgeTypeVisuals]);

  const nodeAttributeColumns = useMemo(() => {
    const keys = new Set<string>();
    graphNodesForPanel.forEach((node) => {
      Object.keys(node?.attributes || {}).forEach((key) => {
        if (key === 'visual' || key === 'icon' || key === 'label') return;
        keys.add(key);
      });
    });
    return Array.from(keys);
  }, [graphNodesForPanel]);

  const edgeAttributeColumns = useMemo(() => {
    const keys = new Set<string>();
    graphEdgesForPanel.forEach((edge) => {
      const attrs = getNormalizedEdgeAttributes(edge);
      Object.keys(attrs).forEach((key) => {
        if (key === 'visual' || key === 'label') return;
        keys.add(key);
      });
    });
    return Array.from(keys);
  }, [graphEdgesForPanel, getNormalizedEdgeAttributes]);

  const valueToSortableString = useCallback((value: unknown): string => {
    if (Array.isArray(value)) return value.join(', ');
    if (value === null || value === undefined) return '';
    return String(value);
  }, []);

  const attributeHeaderAliases = useMemo(() => ({
    operator: 'оператор',
    ownership: 'оформлен',
    color: 'цвет',
    iconScale: 'размер иконки',
    ringWidth: 'толщина рамки',
    ringEnabled: 'рамка',
    period_start: 'начало периода',
    period_end: 'конец периода',
    calls_count: 'количество связей',
  }), []);

  const formatAttributeHeader = useCallback((rawKey: string) => {
    const cleaned = String(rawKey || '')
      .replace(/\uFFFD/g, '')
      .replace(/[\u0000-\u001F\u007F]/g, '')
      .trim();
    return attributeHeaderAliases[cleaned as keyof typeof attributeHeaderAliases] || cleaned || rawKey;
  }, [attributeHeaderAliases]);

  const sortedGraphNodesForPanel = useMemo(() => {
    const items = [...graphNodesForPanel];
    items.sort((a, b) => {
      let aValue = '';
      let bValue = '';
      const attrsA = (a.attributes || {}) as Record<string, unknown>;
      const attrsB = (b.attributes || {}) as Record<string, unknown>;
      if (nodeSortKey === 'type') {
        aValue = String(a?.type || '');
        bValue = String(b?.type || '');
      } else if (nodeSortKey === 'label') {
        aValue = String(a?.label || attrsA.label || '');
        bValue = String(b?.label || attrsB.label || '');
      } else {
        aValue = valueToSortableString(attrsA[nodeSortKey]);
        bValue = valueToSortableString(attrsB[nodeSortKey]);
      }
      const result = aValue.localeCompare(bValue, 'ru', { sensitivity: 'base', numeric: true });
      return nodeSortDir === 'asc' ? result : -result;
    });
    return items;
  }, [graphNodesForPanel, nodeSortKey, nodeSortDir, valueToSortableString]);

  const sortedGraphEdgesForPanel = useMemo(() => {
    const items = [...graphEdgesForPanel];
    items.sort((a, b) => {
      let aValue = '';
      let bValue = '';
      const attrsA = getNormalizedEdgeAttributes(a);
      const attrsB = getNormalizedEdgeAttributes(b);
      if (edgeSortKey === 'type') {
        aValue = String(a?.type || '');
        bValue = String(b?.type || '');
      } else if (edgeSortKey === 'from') {
        const aFrom = String(a?.from || a?.source_node || '');
        const bFrom = String(b?.from || b?.source_node || '');
        aValue = String(nodeLabelById[aFrom] || aFrom);
        bValue = String(nodeLabelById[bFrom] || bFrom);
      } else if (edgeSortKey === 'to') {
        const aTo = String(a?.to || a?.target_node || '');
        const bTo = String(b?.to || b?.target_node || '');
        aValue = String(nodeLabelById[aTo] || aTo);
        bValue = String(nodeLabelById[bTo] || bTo);
      } else if (edgeSortKey === 'label') {
        aValue = String(a?.label || '');
        bValue = String(b?.label || '');
      } else {
        aValue = valueToSortableString(attrsA[edgeSortKey]);
        bValue = valueToSortableString(attrsB[edgeSortKey]);
      }
      const result = aValue.localeCompare(bValue, 'ru', { sensitivity: 'base', numeric: true });
      return edgeSortDir === 'asc' ? result : -result;
    });
    return items;
  }, [graphEdgesForPanel, edgeSortKey, edgeSortDir, nodeLabelById, valueToSortableString, getNormalizedEdgeAttributes]);

  const toggleNodeSort = useCallback((key: string) => {
    if (nodeSortKey === key) {
      setNodeSortDir((prev) => (prev === 'asc' ? 'desc' : 'asc'));
      return;
    }
    setNodeSortKey(key);
    setNodeSortDir('asc');
  }, [nodeSortKey]);

  const toggleEdgeSort = useCallback((key: string) => {
    if (edgeSortKey === key) {
      setEdgeSortDir((prev) => (prev === 'asc' ? 'desc' : 'asc'));
      return;
    }
    setEdgeSortKey(key);
    setEdgeSortDir('asc');
  }, [edgeSortKey]);

  return {
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
  };
};
