import { useEffect, useState } from 'react';
import type { MutableRefObject } from 'react';

interface UseGraphExternalEventsArgs {
  networkRef: MutableRefObject<any>;
  nodesDataSetRef: MutableRefObject<any>;
  updateSelectionFromNetwork: () => void;
  runBalancedLayoutForNodes: (nodeIds: string[]) => Promise<void>;
  artifactId: number;
}

export const useGraphExternalEvents = ({
  networkRef,
  nodesDataSetRef,
  updateSelectionFromNetwork,
  runBalancedLayoutForNodes,
  artifactId,
}: UseGraphExternalEventsArgs) => {
  const [pendingPluginNodeIds, setPendingPluginNodeIds] = useState<string[]>([]);

  useEffect(() => {
    const handler = (event: Event) => {
      const detail = (event as CustomEvent<any>)?.detail || {};
      const newNodeIds = Array.isArray(detail.newNodeIds)
        ? detail.newNodeIds.map((id: any) => String(id)).filter(Boolean)
        : [];
      if (newNodeIds.length === 0) return;

      const autoLayout = detail.autoLayout !== false;
      setPendingPluginNodeIds((prev) => Array.from(new Set([...prev, ...newNodeIds])));
      if (!autoLayout) return;

      const tryRun = (attempt = 0) => {
        const ds = nodesDataSetRef.current;
        const availableIds = newNodeIds.filter((id: string) => Boolean(ds?.get(id)));
        if (!availableIds.length) {
          if (attempt < 12) {
            window.setTimeout(() => tryRun(attempt + 1), 150);
          }
          return;
        }

        networkRef.current?.selectNodes(availableIds, false);
        void runBalancedLayoutForNodes(availableIds).then(() => {
          setPendingPluginNodeIds((prev) => prev.filter((id: string) => !availableIds.includes(id)));
        });
      };

      tryRun();
    };

    window.addEventListener('graph:run-physics-layout', handler as EventListener);
    return () => window.removeEventListener('graph:run-physics-layout', handler as EventListener);
  }, [networkRef, nodesDataSetRef, runBalancedLayoutForNodes]);

  useEffect(() => {
    const handler = (event: Event) => {
      if (!networkRef.current) return;
      const detail = (event as CustomEvent<any>)?.detail || {};
      const nodeIds = Array.isArray(detail.nodeIds) ? detail.nodeIds.map((id: any) => String(id)) : [];
      const edgeIds = Array.isArray(detail.edgeIds) ? detail.edgeIds.map((id: any) => String(id)) : [];
      networkRef.current.setSelection({ nodes: nodeIds, edges: edgeIds }, { unselectAll: true, highlightEdges: false });
      updateSelectionFromNetwork();
    };

    window.addEventListener('graph:set-selection', handler as EventListener);
    return () => window.removeEventListener('graph:set-selection', handler as EventListener);
  }, [networkRef, updateSelectionFromNetwork]);

  useEffect(() => {
    setPendingPluginNodeIds([]);
  }, [artifactId]);

  return {
    pendingPluginNodeIds,
    setPendingPluginNodeIds,
  };
};

