import type { ApiPlugin, PluginExecutionContext } from '../../types/api';

export interface PluginMenuNode {
  key: string;
  label: string;
  depth: number;
  children: PluginMenuNode[];
  plugins: ApiPlugin[];
}

export interface PluginMenuEntry {
  kind: 'folder' | 'plugin';
  key: string;
  label: string;
  node?: PluginMenuNode;
  plugin?: ApiPlugin;
}

export interface PluginContextMenuState {
  x: number;
  y: number;
  context: PluginExecutionContext;
  plugins: ApiPlugin[];
  loading: boolean;
}

interface PluginMenuPointer {
  x: number;
  y: number;
}

interface PluginMenuParams {
  pointer?: {
    DOM?: PluginMenuPointer;
  };
  event?: {
    center?: PluginMenuPointer;
  };
  nodes?: Array<string | number>;
  edges?: Array<string | number>;
}

interface NetworkForPluginMenu {
  getNodeAt: (point: PluginMenuPointer) => string | number | null | undefined;
  getEdgeAt: (point: PluginMenuPointer) => string | number | null | undefined;
}

const MENU_FALLBACK_LABEL = 'Прочее';

export const buildPluginContext = (selectedNodes: string[], selectedEdges: string[]): PluginExecutionContext => ({
  selected_nodes: selectedNodes,
  selected_edges: selectedEdges,
});

export const buildPluginMenuTree = (plugins: ApiPlugin[]): PluginMenuNode[] => {
  const root: PluginMenuNode[] = [];
  const nodeByPath = new Map<string, PluginMenuNode>();

  const ensureNode = (segments: string[]) => {
    let parentPath = '';
    let siblings = root;

    segments.forEach((segment, index) => {
      const safe = segment.trim() || MENU_FALLBACK_LABEL;
      const path = parentPath ? `${parentPath}/${safe}` : safe;
      let node = nodeByPath.get(path);
      if (!node) {
        node = { key: path, label: safe, depth: index, children: [], plugins: [] };
        siblings.push(node);
        nodeByPath.set(path, node);
      }
      siblings = node.children;
      parentPath = path;
    });

    return nodeByPath.get(parentPath);
  };

  plugins.forEach((plugin) => {
    const rawPath = String(plugin.menu_path || MENU_FALLBACK_LABEL).trim() || MENU_FALLBACK_LABEL;
    const segments = rawPath.split('/').map((s) => s.trim()).filter(Boolean);
    const target = ensureNode(segments.length > 0 ? segments : [MENU_FALLBACK_LABEL]);
    if (target) target.plugins.push(plugin);
  });

  const sortTree = (nodes: PluginMenuNode[]) => {
    nodes.sort((a, b) => a.label.localeCompare(b.label, 'ru'));
    nodes.forEach((node) => {
      node.plugins.sort((a, b) => a.name.localeCompare(b.name, 'ru'));
      sortTree(node.children);
    });
  };

  sortTree(root);
  return root;
};

export const resolvePluginContext = (
  clickedNodes: string[],
  clickedEdges: string[],
  selectedNodes: string[],
  selectedEdges: string[],
): PluginExecutionContext => {
  let contextNodes = clickedNodes;
  let contextEdges = clickedEdges;

  if (contextNodes.length > 0) {
    const clickedNodeId = String(contextNodes[0]);
    if (selectedNodes.length > 1 && selectedNodes.includes(clickedNodeId)) {
      contextNodes = selectedNodes;
      contextEdges = [];
    } else {
      contextNodes = [clickedNodeId];
      contextEdges = [];
    }
  } else if (contextEdges.length > 0) {
    contextNodes = [];
    contextEdges = [String(contextEdges[0])];
  } else {
    contextNodes = selectedNodes;
    contextEdges = selectedEdges;
  }

  return buildPluginContext(contextNodes, contextEdges);
};

export const getPluginMenuEntries = (
  node: PluginMenuNode | null,
  pluginMenuTree: PluginMenuNode[],
): PluginMenuEntry[] => {
  const folders = (node ? node.children : pluginMenuTree).map((child) => ({
    kind: 'folder' as const,
    key: child.key,
    label: child.label,
    node: child,
  }));

  const plugins = (node ? node.plugins : []).map((plugin) => ({
    kind: 'plugin' as const,
    key: `plugin:${plugin.id}`,
    label: plugin.name,
    plugin,
  }));

  return [...folders, ...plugins];
};

export const resolvePluginMenuPosition = (
  pluginMenu: { x: number; y: number } | null,
  containerSize: { width: number; height: number },
  toolbarHeight: number,
  menuSize: { width: number; height: number } = { width: 360, height: 440 },
): { left: number; top: number } => {
  const { width, height } = containerSize;
  const menuLeft = pluginMenu
    ? Math.max(8, Math.min(pluginMenu.x + 8, width - menuSize.width - 8))
    : 8;
  const menuTop = pluginMenu
    ? Math.max(toolbarHeight + 8, Math.min(pluginMenu.y + toolbarHeight + 8, toolbarHeight + height - menuSize.height - 8))
    : toolbarHeight + 8;

  return { left: menuLeft, top: menuTop };
};

export const resolvePluginMenuTargets = (
  network: NetworkForPluginMenu,
  params: PluginMenuParams,
): { domPoint: PluginMenuPointer; clickedNodes: string[]; clickedEdges: string[] } => {
  const domPoint = params?.pointer?.DOM || params?.event?.center || { x: 0, y: 0 };
  const clickedNodes = Array.isArray(params?.nodes) ? params.nodes.map((id) => String(id)) : [];
  const clickedEdges = Array.isArray(params?.edges) ? params.edges.map((id) => String(id)) : [];

  if (clickedNodes.length === 0 && clickedEdges.length === 0) {
    const hoveredNode = network.getNodeAt(domPoint);
    const hoveredEdge = network.getEdgeAt(domPoint);
    if (hoveredNode !== undefined && hoveredNode !== null) {
      clickedNodes.push(String(hoveredNode));
    } else if (hoveredEdge !== undefined && hoveredEdge !== null) {
      clickedEdges.push(String(hoveredEdge));
    }
  }

  return { domPoint, clickedNodes, clickedEdges };
};
