import { useCallback } from 'react';
import type { MutableRefObject } from 'react';

export interface UseGraphViewportSelectionActionsArgs {
  networkRef: MutableRefObject<any>;
  artifactDataRef: MutableRefObject<any>;
  nodesDataSetRef: MutableRefObject<any>;
  edgesDataSetRef: MutableRefObject<any>;
  updateSelectionFromNetwork: () => void;
}

export const useGraphViewportSelectionActions = ({
  networkRef,
  artifactDataRef,
  nodesDataSetRef,
  edgesDataSetRef,
  updateSelectionFromNetwork,
}: UseGraphViewportSelectionActionsArgs) => {
  const handleFitClick = useCallback(() => {
    if (!networkRef.current) return;
    networkRef.current.fit({ animation: { duration: 250, easingFunction: 'easeInOutQuad' } });
  }, [networkRef]);

  const handleFitSelectionClick = useCallback(() => {
    if (!networkRef.current) return;

    const selectedNodeIds = networkRef.current.getSelectedNodes().map((id: any) => String(id));
    const selectedEdgeIds = networkRef.current.getSelectedEdges().map((id: any) => String(id));
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
      animation: { duration: 250, easingFunction: 'easeInOutQuad' },
    });
  }, [artifactDataRef, networkRef]);

  const handleInvertSelectionClick = useCallback(() => {
    if (!networkRef.current || !nodesDataSetRef.current || !edgesDataSetRef.current) return;

    const allNodeIds = nodesDataSetRef.current.getIds().map((id: any) => String(id));
    const allEdgeIds = edgesDataSetRef.current.getIds().map((id: any) => String(id));
    const selectedNodeIds = new Set(networkRef.current.getSelectedNodes().map((id: any) => String(id)));
    const selectedEdgeIds = new Set(networkRef.current.getSelectedEdges().map((id: any) => String(id)));

    const nextNodeIds = allNodeIds.filter((id: string) => !selectedNodeIds.has(id));
    const nextEdgeIds = allEdgeIds.filter((id: string) => !selectedEdgeIds.has(id));

    networkRef.current.setSelection({ nodes: nextNodeIds, edges: nextEdgeIds }, { unselectAll: true, highlightEdges: false });
    updateSelectionFromNetwork();
  }, [edgesDataSetRef, networkRef, nodesDataSetRef, updateSelectionFromNetwork]);

  return {
    handleFitClick,
    handleFitSelectionClick,
    handleInvertSelectionClick,
  };
};


