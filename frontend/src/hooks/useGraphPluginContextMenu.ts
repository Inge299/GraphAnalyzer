import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { MutableRefObject } from 'react';
import { pluginApi } from '../services/api';
import {
  buildPluginMenuTree,
  getPluginMenuEntries as buildPluginMenuEntries,
  resolvePluginContext,
  resolvePluginMenuPosition,
  type PluginContextMenuState,
  type PluginMenuNode,
} from '../components/views/graphPluginMenu';

interface UseGraphPluginContextMenuArgs {
  projectId: number;
  artifactId: number;
  networkRef: MutableRefObject<any>;
  containerRef: MutableRefObject<HTMLDivElement | null>;
  updateSelectionFromNetwork: () => void;
  toolbarHeight: number;
}

export const useGraphPluginContextMenu = ({
  projectId,
  artifactId,
  networkRef,
  containerRef,
  updateSelectionFromNetwork,
  toolbarHeight,
}: UseGraphPluginContextMenuArgs) => {
  const [pluginMenu, setPluginMenu] = useState<PluginContextMenuState | null>(null);
  const pluginMenuRef = useRef<HTMLDivElement | null>(null);

  const closePluginMenu = useCallback(() => {
    setPluginMenu(null);
  }, []);

  useEffect(() => {
    const onMouseDown = (event: MouseEvent) => {
      if (event.button !== 0) return;
      if (!pluginMenuRef.current) return;
      if (event.target instanceof Node && pluginMenuRef.current.contains(event.target)) return;
      setPluginMenu(null);
    };

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setPluginMenu(null);
      }
    };

    document.addEventListener('mousedown', onMouseDown);
    window.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('mousedown', onMouseDown);
      window.removeEventListener('keydown', onKeyDown);
    };
  }, []);

  const openPluginMenuAt = useCallback(async (
    domPoint: { x: number; y: number },
    clickedNodes: string[] = [],
    clickedEdges: string[] = [],
  ) => {
    if (!networkRef.current) return;

    const selectedNodes = networkRef.current.getSelectedNodes().map((id: any) => String(id));
    const selectedEdges = networkRef.current.getSelectedEdges().map((id: any) => String(id));
    const context = resolvePluginContext(clickedNodes, clickedEdges, selectedNodes, selectedEdges);

    updateSelectionFromNetwork();

    setPluginMenu({
      x: Number(domPoint.x || 0),
      y: Number(domPoint.y || 0),
      context,
      plugins: [],
      loading: true,
    });

    try {
      const response = await pluginApi.applicable(projectId, artifactId, context);
      setPluginMenu((prev) => {
        if (!prev) return prev;
        return { ...prev, loading: false, plugins: response?.plugins || [] };
      });
    } catch {
      setPluginMenu((prev) => {
        if (!prev) return prev;
        return { ...prev, loading: false, plugins: [] };
      });
    }
  }, [artifactId, networkRef, projectId, updateSelectionFromNetwork]);

  const pluginMenuTree = useMemo(() => buildPluginMenuTree(pluginMenu?.plugins || []), [pluginMenu?.plugins]);

  const pluginMenuPosition = useMemo(() => resolvePluginMenuPosition(
    pluginMenu ? { x: pluginMenu.x, y: pluginMenu.y } : null,
    { width: containerRef.current?.clientWidth || 800, height: containerRef.current?.clientHeight || 600 },
    toolbarHeight,
  ), [containerRef, pluginMenu, toolbarHeight]);

  const pluginMenuLeft = pluginMenuPosition.left;
  const pluginMenuTop = pluginMenuPosition.top;

  const getPluginMenuEntries = useCallback((node: PluginMenuNode | null) => {
    return buildPluginMenuEntries(node, pluginMenuTree);
  }, [pluginMenuTree]);

  return {
    pluginMenu,
    pluginMenuRef,
    closePluginMenu,
    openPluginMenuAt,
    pluginMenuTree,
    pluginMenuLeft,
    pluginMenuTop,
    getPluginMenuEntries,
  };
};


