import { useCallback } from 'react';
import type { MutableRefObject } from 'react';

interface UseGraphSelectionActionsArgs {
  networkRef: MutableRefObject<any>;
  artifactDataRef: MutableRefObject<any>;
  updateSelectionFromNetwork: () => void;
}

export const useGraphSelectionActions = ({
  networkRef,
  artifactDataRef,
  updateSelectionFromNetwork,
}: UseGraphSelectionActionsArgs) => {
  const handleSelectConnectedEdges = useCallback(() => {
    if (!networkRef.current) return;

    const selectedNodeIds = networkRef.current.getSelectedNodes().map((id: any) => String(id));
    if (selectedNodeIds.length === 0) return;

    const data = artifactDataRef.current || {};
    const edgeIds = new Set<string>(networkRef.current.getSelectedEdges().map((id: any) => String(id)));

    (data.edges || []).forEach((edge: any) => {
      const fromId = String(edge.from || edge.source_node || '');
      const toId = String(edge.to || edge.target_node || '');
      if (selectedNodeIds.includes(fromId) || selectedNodeIds.includes(toId)) {
        edgeIds.add(String(edge.id));
      }
    });

    networkRef.current.setSelection({ nodes: selectedNodeIds, edges: Array.from(edgeIds) }, { unselectAll: true, highlightEdges: false });
    updateSelectionFromNetwork();
  }, [artifactDataRef, networkRef, updateSelectionFromNetwork]);

  const handleSelectConnected = useCallback(() => {
    if (!networkRef.current) return;

    const data = artifactDataRef.current || {};
    const selectedNodeIds = new Set<string>(networkRef.current.getSelectedNodes().map((id: any) => String(id)));
    const selectedEdgeIds = new Set<string>(networkRef.current.getSelectedEdges().map((id: any) => String(id)));
    if (selectedNodeIds.size === 0 && selectedEdgeIds.size === 0) return;

    const expandedNodeIds = new Set<string>(selectedNodeIds);
    const expandedEdgeIds = new Set<string>(selectedEdgeIds);

    (data.edges || []).forEach((edge: any) => {
      const edgeId = String(edge.id || '');
      const fromId = String(edge.from || edge.source_node || '');
      const toId = String(edge.to || edge.target_node || '');

      if (selectedEdgeIds.has(edgeId)) {
        if (fromId) expandedNodeIds.add(fromId);
        if (toId) expandedNodeIds.add(toId);
        return;
      }

      if (selectedNodeIds.has(fromId) || selectedNodeIds.has(toId)) {
        expandedEdgeIds.add(edgeId);
        if (fromId) expandedNodeIds.add(fromId);
        if (toId) expandedNodeIds.add(toId);
      }
    });

    networkRef.current.setSelection(
      { nodes: Array.from(expandedNodeIds), edges: Array.from(expandedEdgeIds) },
      { unselectAll: true, highlightEdges: false },
    );
    updateSelectionFromNetwork();
  }, [artifactDataRef, networkRef, updateSelectionFromNetwork]);

  return {
    handleSelectConnectedEdges,
    handleSelectConnected,
  };
};
