import { useCallback, useEffect } from 'react';
import type { MutableRefObject, MouseEvent } from 'react';
import type { AppDispatch } from '../store';
import type { SelectedElement } from '../store/slices/uiSlice';
import { getGraphEdgeId, getGraphNodeId, type GraphPanelEdge, type GraphPanelNode } from './graphTableTypes';

interface UseGraphTableSelectionArgs {
  dispatch: AppDispatch;
  setSelectedElementsAction: (payload: SelectedElement[]) => { type: string; payload: SelectedElement[] };
  selectedNodeIds: Set<string>;
  selectedEdgeIds: Set<string>;
  sortedGraphNodesForPanel: GraphPanelNode[];
  sortedGraphEdgesForPanel: GraphPanelEdge[];
  nodeById: Record<string, GraphPanelNode>;
  edgeById: Record<string, GraphPanelEdge>;
  isBottomPanelOpen: boolean;
  bottomTab: 'nodes' | 'edges';
  lastNodeRowIndexRef: MutableRefObject<number | null>;
  lastEdgeRowIndexRef: MutableRefObject<number | null>;
  nodeRowRefs: MutableRefObject<Record<string, HTMLTableRowElement | null>>;
  edgeRowRefs: MutableRefObject<Record<string, HTMLTableRowElement | null>>;
}

export const useGraphTableSelection = ({
  dispatch,
  setSelectedElementsAction,
  selectedNodeIds,
  selectedEdgeIds,
  sortedGraphNodesForPanel,
  sortedGraphEdgesForPanel,
  nodeById,
  edgeById,
  isBottomPanelOpen,
  bottomTab,
  lastNodeRowIndexRef,
  lastEdgeRowIndexRef,
  nodeRowRefs,
  edgeRowRefs,
}: UseGraphTableSelectionArgs) => {
  const syncGraphSelection = useCallback((nodeIds: string[], edgeIds: string[]) => {
    window.dispatchEvent(new CustomEvent('graph:set-selection', { detail: { nodeIds, edgeIds } }));
  }, []);

  const buildSelectedElements = useCallback((nodeIds: string[], edgeIds: string[]): SelectedElement[] => {
    const result: SelectedElement[] = [];
    nodeIds.forEach((id) => {
      result.push({ type: 'node', id, data: nodeById[id] });
    });
    edgeIds.forEach((id) => {
      result.push({ type: 'edge', id, data: edgeById[id] });
    });
    return result;
  }, [edgeById, nodeById]);

  const handleNodeRowClick = useCallback((event: MouseEvent<HTMLTableRowElement>, node: GraphPanelNode, rowIndex: number) => {
    const nodeId = getGraphNodeId(node);
    if (!nodeId) return;

    const nextNodeIds = new Set<string>(Array.from(selectedNodeIds));
    const edgeIds = Array.from(selectedEdgeIds);
    const isToggleClick = event.ctrlKey || event.metaKey;

    if (event.shiftKey && lastNodeRowIndexRef.current !== null) {
      const start = Math.min(lastNodeRowIndexRef.current, rowIndex);
      const end = Math.max(lastNodeRowIndexRef.current, rowIndex);
      for (let i = start; i <= end; i += 1) {
        const id = getGraphNodeId(sortedGraphNodesForPanel[i] || {});
        if (id) nextNodeIds.add(id);
      }
      lastNodeRowIndexRef.current = rowIndex;
    } else if (isToggleClick) {
      if (nextNodeIds.has(nodeId)) {
        nextNodeIds.delete(nodeId);
      } else {
        nextNodeIds.add(nodeId);
      }
      lastNodeRowIndexRef.current = rowIndex;
    } else {
      nextNodeIds.clear();
      nextNodeIds.add(nodeId);
      lastNodeRowIndexRef.current = rowIndex;
    }

    const nodeIds = Array.from(nextNodeIds);
    dispatch(setSelectedElementsAction(buildSelectedElements(nodeIds, edgeIds)));
    syncGraphSelection(nodeIds, edgeIds);
  }, [buildSelectedElements, dispatch, lastNodeRowIndexRef, selectedEdgeIds, selectedNodeIds, setSelectedElementsAction, sortedGraphNodesForPanel, syncGraphSelection]);

  const handleEdgeRowClick = useCallback((event: MouseEvent<HTMLTableRowElement>, edge: GraphPanelEdge, rowIndex: number) => {
    const edgeId = getGraphEdgeId(edge);
    if (!edgeId) return;

    const nodeIds = Array.from(selectedNodeIds);
    const nextEdgeIds = new Set<string>(Array.from(selectedEdgeIds));
    const isToggleClick = event.ctrlKey || event.metaKey;

    if (event.shiftKey && lastEdgeRowIndexRef.current !== null) {
      const start = Math.min(lastEdgeRowIndexRef.current, rowIndex);
      const end = Math.max(lastEdgeRowIndexRef.current, rowIndex);
      for (let i = start; i <= end; i += 1) {
        const id = getGraphEdgeId(sortedGraphEdgesForPanel[i] || {});
        if (id) nextEdgeIds.add(id);
      }
      lastEdgeRowIndexRef.current = rowIndex;
    } else if (isToggleClick) {
      if (nextEdgeIds.has(edgeId)) {
        nextEdgeIds.delete(edgeId);
      } else {
        nextEdgeIds.add(edgeId);
      }
      lastEdgeRowIndexRef.current = rowIndex;
    } else {
      nextEdgeIds.clear();
      nextEdgeIds.add(edgeId);
      lastEdgeRowIndexRef.current = rowIndex;
    }

    const edgeIds = Array.from(nextEdgeIds);
    dispatch(setSelectedElementsAction(buildSelectedElements(nodeIds, edgeIds)));
    syncGraphSelection(nodeIds, edgeIds);
  }, [buildSelectedElements, dispatch, lastEdgeRowIndexRef, selectedEdgeIds, selectedNodeIds, setSelectedElementsAction, sortedGraphEdgesForPanel, syncGraphSelection]);

  useEffect(() => {
    if (!isBottomPanelOpen) return;

    if (bottomTab === 'nodes' && selectedNodeIds.size > 0) {
      const firstId = sortedGraphNodesForPanel
        .map((node) => getGraphNodeId(node))
        .find((id) => id && selectedNodeIds.has(id));
      if (firstId) {
        nodeRowRefs.current[firstId]?.scrollIntoView({ block: 'nearest' });
      }
      return;
    }

    if (bottomTab === 'edges' && selectedEdgeIds.size > 0) {
      const firstId = sortedGraphEdgesForPanel
        .map((edge) => getGraphEdgeId(edge))
        .find((id) => id && selectedEdgeIds.has(id));
      if (firstId) {
        edgeRowRefs.current[firstId]?.scrollIntoView({ block: 'nearest' });
      }
    }
  }, [
    bottomTab,
    edgeRowRefs,
    isBottomPanelOpen,
    nodeRowRefs,
    selectedEdgeIds,
    selectedNodeIds,
    sortedGraphEdgesForPanel,
    sortedGraphNodesForPanel,
  ]);

  return {
    handleNodeRowClick,
    handleEdgeRowClick,
  };
};
