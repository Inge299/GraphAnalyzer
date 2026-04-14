import { useEffect, useRef, useState } from 'react';

interface NodeCreateSpec {
  typeId: string;
  label: string;
}

interface UseGraphInteractionStateArgs {
  connectType?: string | null;
  onAddEdge?: (sourceId: string, targetId: string, edgeType?: string) => void;
  onDeleteSelection?: (nodeIds: string[], edgeIds: string[]) => void;
  onAddNodeAtPosition?: (label: string, typeId: string, x: number, y: number) => void;
  nodeCreateSpec?: NodeCreateSpec | null;
  onNodeCreateComplete?: () => void;
  onConnectComplete?: () => void;
}

export const useGraphInteractionState = ({
  connectType = null,
  onAddEdge,
  onDeleteSelection,
  onAddNodeAtPosition,
  nodeCreateSpec = null,
  onNodeCreateComplete,
  onConnectComplete,
}: UseGraphInteractionStateArgs) => {
  const [connectMode, setConnectMode] = useState(false);
  const [edgeSourceId, setEdgeSourceId] = useState<string | null>(null);

  const connectModeRef = useRef(false);
  const edgeSourceIdRef = useRef<string | null>(null);
  const onAddEdgeRef = useRef(onAddEdge);
  const onDeleteSelectionRef = useRef(onDeleteSelection);
  const onAddNodeAtPositionRef = useRef(onAddNodeAtPosition);
  const nodeCreateSpecRef = useRef<NodeCreateSpec | null>(nodeCreateSpec || null);
  const onNodeCreateCompleteRef = useRef(onNodeCreateComplete);
  const connectTypeRef = useRef<string | null>(connectType || null);
  const onConnectCompleteRef = useRef(onConnectComplete);

  useEffect(() => {
    connectModeRef.current = connectMode;
  }, [connectMode]);

  useEffect(() => {
    if (connectType) {
      setConnectMode(true);
      return;
    }
    setConnectMode(false);
    setEdgeSourceId(null);
  }, [connectType]);

  useEffect(() => {
    edgeSourceIdRef.current = edgeSourceId;
  }, [edgeSourceId]);

  useEffect(() => {
    onAddEdgeRef.current = onAddEdge;
  }, [onAddEdge]);

  useEffect(() => {
    onDeleteSelectionRef.current = onDeleteSelection;
  }, [onDeleteSelection]);

  useEffect(() => {
    onAddNodeAtPositionRef.current = onAddNodeAtPosition;
  }, [onAddNodeAtPosition]);

  useEffect(() => {
    nodeCreateSpecRef.current = nodeCreateSpec || null;
    if (nodeCreateSpec) {
      setConnectMode(false);
      setEdgeSourceId(null);
    }
  }, [nodeCreateSpec]);

  useEffect(() => {
    onNodeCreateCompleteRef.current = onNodeCreateComplete;
  }, [onNodeCreateComplete]);

  useEffect(() => {
    connectTypeRef.current = connectType || null;
  }, [connectType]);

  useEffect(() => {
    onConnectCompleteRef.current = onConnectComplete;
  }, [onConnectComplete]);

  return {
    connectMode,
    setConnectMode,
    edgeSourceId,
    setEdgeSourceId,
    connectModeRef,
    edgeSourceIdRef,
    onAddEdgeRef,
    onDeleteSelectionRef,
    onAddNodeAtPositionRef,
    nodeCreateSpecRef,
    onNodeCreateCompleteRef,
    connectTypeRef,
    onConnectCompleteRef,
  };
};
