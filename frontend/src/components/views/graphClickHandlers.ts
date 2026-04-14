interface GraphClickParams {
  nodes?: Array<string | number>;
  edges?: Array<string | number>;
  pointer?: {
    canvas?: { x: number; y: number };
    DOM?: { x: number; y: number };
  };
  event?: {
    srcEvent?: {
      shiftKey?: boolean;
      ctrlKey?: boolean;
      metaKey?: boolean;
    };
  };
}

interface NetworkLike {
  DOMtoCanvas: (point: { x: number; y: number }) => { x: number; y: number };
  unselectAll: () => void;
  getScale: () => number;
  getSelectedNodes: () => Array<string | number>;
  getSelectedEdges: () => Array<string | number>;
  setSelection: (
    selection: { nodes?: string[]; edges?: string[] },
    options?: { unselectAll?: boolean; highlightEdges?: boolean },
  ) => void;
}

interface ConnectNode {
  id?: string | number;
  node_id?: string | number;
  type?: string;
}

interface ConnectArtifactData {
  nodes?: ConnectNode[];
}

interface ConnectEdgeType {
  allowed_from?: string[];
}

export const resolveCanvasPoint = (network: NetworkLike | null, params: GraphClickParams): { x: number; y: number } | null => {
  return params?.pointer?.canvas
    || (params?.pointer?.DOM && network ? network.DOMtoCanvas(params.pointer.DOM) : null)
    || null;
};

export const applyRegularSelectionClick = (
  network: NetworkLike,
  params: GraphClickParams,
  updateSelectionFromNetwork: () => void,
  updateNodeTooltipsByScale: (scale: number) => void,
) => {
  const clickedNodes = Array.isArray(params?.nodes) ? params.nodes.map((id) => String(id)) : [];
  const clickedEdges = Array.isArray(params?.edges) ? params.edges.map((id) => String(id)) : [];
  const additive = Boolean(
    params?.event?.srcEvent?.shiftKey ||
    params?.event?.srcEvent?.ctrlKey ||
    params?.event?.srcEvent?.metaKey,
  );

  if (clickedNodes.length === 0 && clickedEdges.length === 0) {
    network.unselectAll();
    updateSelectionFromNetwork();
    updateNodeTooltipsByScale(network.getScale());
    return;
  }

  if (additive) {
    const nodeSet = new Set(network.getSelectedNodes().map((id) => String(id)));
    const edgeSet = new Set(network.getSelectedEdges().map((id) => String(id)));
    clickedNodes.forEach((id) => nodeSet.add(id));
    clickedEdges.forEach((id) => edgeSet.add(id));
    network.setSelection({ nodes: Array.from(nodeSet), edges: Array.from(edgeSet) }, { unselectAll: true, highlightEdges: false });
  } else {
    network.setSelection({ nodes: clickedNodes, edges: clickedEdges }, { unselectAll: true, highlightEdges: false });
  }

  updateSelectionFromNetwork();
  updateNodeTooltipsByScale(network.getScale());
};

interface HandleNodeCreateClickArgs {
  network: NetworkLike;
  params: GraphClickParams;
  nodeCreateSpecRef: { current: { typeId: string; label: string } | null };
  onAddNodeAtPositionRef: { current?: ((label: string, typeId: string, x: number, y: number) => void) | undefined };
  onNodeCreateCompleteRef: { current?: (() => void) | undefined };
}

export const handleNodeCreateClick = ({
  network,
  params,
  nodeCreateSpecRef,
  onAddNodeAtPositionRef,
  onNodeCreateCompleteRef,
}: HandleNodeCreateClickArgs): boolean => {
  const pendingNode = nodeCreateSpecRef.current;
  if (!pendingNode) return false;

  nodeCreateSpecRef.current = null;
  const canvasPoint = resolveCanvasPoint(network, params);

  if (!canvasPoint) {
    onNodeCreateCompleteRef.current?.();
    return true;
  }

  onAddNodeAtPositionRef.current?.(
    pendingNode.label,
    pendingNode.typeId,
    Number(canvasPoint.x || 0),
    Number(canvasPoint.y || 0),
  );
  onNodeCreateCompleteRef.current?.();
  return true;
};

interface HandleConnectClickArgs {
  params: GraphClickParams;
  artifactData: ConnectArtifactData;
  getNodeId: (node: ConnectNode) => string;
  connectTypeRef: { current: string | null };
  edgeSourceIdRef: { current: string | null };
  setEdgeSourceId: (id: string | null) => void;
  setConnectMode: (enabled: boolean) => void;
  findEdgeType: (edgeTypeId: string) => ConnectEdgeType | null;
  matchesType: (allowed: string[] | string, itemType: string) => boolean;
  resolveAllowedEdgeType: (fromType: string, toType: string) => string | null;
  isAllowedForEdgeType: (edgeTypeId: string, fromType: string, toType: string) => boolean;
  onAddEdgeRef: { current?: ((sourceId: string, targetId: string, edgeType?: string) => void) | undefined };
  onConnectCompleteRef: { current?: (() => void) | undefined };
}

export const handleConnectClick = ({
  params,
  artifactData,
  getNodeId,
  connectTypeRef,
  edgeSourceIdRef,
  setEdgeSourceId,
  setConnectMode,
  findEdgeType,
  matchesType,
  resolveAllowedEdgeType,
  isAllowedForEdgeType,
  onAddEdgeRef,
  onConnectCompleteRef,
}: HandleConnectClickArgs): boolean => {
  if (!params.nodes || params.nodes.length === 0) return true;

  const clickedNodeId = String(params.nodes[0]);
  const sourceId = edgeSourceIdRef.current;

  if (!sourceId) {
    const requestedEdgeType = connectTypeRef.current ? String(connectTypeRef.current) : null;
    if (requestedEdgeType) {
      const data = artifactData || {};
      const nodesById = new Map((data.nodes || []).map((node) => [String(getNodeId(node)), node]));
      const sourceNode = nodesById.get(clickedNodeId);
      const sourceType = String(sourceNode?.type || '');
      const edgeType = findEdgeType(requestedEdgeType);
      const allowedFrom = Array.isArray(edgeType?.allowed_from) ? edgeType.allowed_from : ['*'];

      if (!matchesType(allowedFrom, sourceType)) {
        window.alert('Начальный узел не подходит для выбранного типа связи.');
        return true;
      }
    }

    setEdgeSourceId(clickedNodeId);
    return true;
  }

  let edgeType = 'connected_to';
  const requestedEdgeType = connectTypeRef.current ? String(connectTypeRef.current) : null;

  if (requestedEdgeType) {
    edgeType = requestedEdgeType;
  } else {
    const data = artifactData || {};
    const nodesById = new Map((data.nodes || []).map((node) => [String(getNodeId(node)), node]));
    const sourceNode = nodesById.get(sourceId);
    const targetNode = nodesById.get(clickedNodeId);
    const sourceType = String(sourceNode?.type || '');
    const targetType = String(targetNode?.type || '');
    const resolvedType = resolveAllowedEdgeType(sourceType, targetType);

    if (!resolvedType) {
      window.alert('Для выбранной пары узлов нет допустимого типа связи.');
      setEdgeSourceId(null);
      if (!requestedEdgeType) setConnectMode(false);
      return true;
    }

    edgeType = resolvedType;
  }

  if (clickedNodeId === sourceId) {
    window.alert('Нельзя создать связь узла с самим собой.');
    setEdgeSourceId(null);
    if (!requestedEdgeType) setConnectMode(false);
    return true;
  }

  if (requestedEdgeType) {
    const data = artifactData || {};
    const nodesById = new Map((data.nodes || []).map((node) => [String(getNodeId(node)), node]));
    const sourceNode = nodesById.get(sourceId);
    const targetNode = nodesById.get(clickedNodeId);
    const sourceType = String(sourceNode?.type || '');
    const targetType = String(targetNode?.type || '');

    if (!isAllowedForEdgeType(requestedEdgeType, sourceType, targetType)) {
      window.alert('Этот тип связи нельзя создать между выбранными узлами.');
      setEdgeSourceId(null);
      onConnectCompleteRef.current?.();
      return true;
    }
  }

  onAddEdgeRef.current?.(sourceId, clickedNodeId, edgeType);
  setEdgeSourceId(null);
  if (requestedEdgeType) {
    onConnectCompleteRef.current?.();
  } else {
    setConnectMode(false);
  }

  return true;
};
