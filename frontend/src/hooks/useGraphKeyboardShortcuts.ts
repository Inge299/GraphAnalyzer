import { useEffect } from 'react';
import type { MutableRefObject } from 'react';
import type { Network } from 'vis-network/standalone';

interface UseGraphKeyboardShortcutsArgs {
  networkRef: MutableRefObject<Network | null>;
  nodesDataSetRef: MutableRefObject<any>;
  onDeleteSelectionRef: MutableRefObject<((nodeIds: string[], edgeIds: string[]) => void) | undefined>;
  dispatch: (action: any) => void;
  setSelectedElementsAction: (payload: any[]) => any;
}

export const useGraphKeyboardShortcuts = ({
  networkRef,
  nodesDataSetRef,
  onDeleteSelectionRef,
  dispatch,
  setSelectedElementsAction,
}: UseGraphKeyboardShortcutsArgs) => {
  useEffect(() => {
    const isTypingTarget = (target: EventTarget | null) => {
      if (!(target instanceof HTMLElement)) return false;
      const tag = target.tagName.toLowerCase();
      return tag === 'input' || tag === 'textarea' || tag === 'select' || target.isContentEditable;
    };

    const onKeyDown = (event: KeyboardEvent) => {
      if (isTypingTarget(event.target)) return;
      if (!networkRef.current || !nodesDataSetRef.current) return;

      const isSelectAll = (event.ctrlKey || event.metaKey) && (event.code === 'KeyA' || event.key.toLowerCase() === 'a');
      if (isSelectAll) {
        event.preventDefault();
        const allNodeIds = nodesDataSetRef.current.getIds().map((id: any) => String(id));
        if (!allNodeIds.length) return;
        networkRef.current.setSelection({ nodes: allNodeIds, edges: [] }, { unselectAll: true, highlightEdges: false });
        return;
      }

      if (event.key !== 'Delete') return;
      const selectedNodeIds = networkRef.current.getSelectedNodes().map((id: any) => String(id));
      const selectedEdgeIds = networkRef.current.getSelectedEdges().map((id: any) => String(id));
      if (!selectedNodeIds.length && !selectedEdgeIds.length) return;

      event.preventDefault();
      onDeleteSelectionRef.current?.(selectedNodeIds, selectedEdgeIds);
      networkRef.current.unselectAll();
      dispatch(setSelectedElementsAction([]));
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [dispatch, networkRef, nodesDataSetRef, onDeleteSelectionRef, setSelectedElementsAction]);
};
