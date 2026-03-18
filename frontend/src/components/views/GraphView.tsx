// frontend/src/components/views/GraphView.tsx
import React, { useEffect, useRef, useState, useCallback } from 'react';
import { useAppDispatch } from '../../store';
import { updateArtifact } from '../../store/slices/artifactsSlice';
import { useActionWithUndo } from '../../hooks/useActionWithUndo';
import { useKeyboardShortcuts } from '../../hooks/useKeyboardShortcuts';
import { Network } from 'vis-network/standalone';
import { DataSet } from 'vis-data/standalone';
import type { ApiArtifact } from '../../types/api';
import 'vis-network/styles/vis-network.css';
import './GraphView.css';

interface GraphViewProps {
  artifact: ApiArtifact;
  onNodeMove: (nodeId: string, x: number, y: number) => void;
  // Другие пропсы опциональны, временно не используются
  onAddNode?: (position: { x: number, y: number }, nodeType?: string) => void;
  onDeleteNode?: (nodeId: string) => void;
  onAddEdge?: (sourceId: string, targetId: string, edgeType?: string) => void;
  onDeleteEdge?: (edgeId: string) => void;
  onEditAttributes?: (nodeId: string, attributes: Record<string, any>) => void;
}

export const GraphView: React.FC<GraphViewProps> = ({ 
  artifact, 
  onNodeMove,
  onAddNode: _onAddNode,
  onDeleteNode: _onDeleteNode,
  onAddEdge: _onAddEdge,
  onDeleteEdge: _onDeleteEdge,
  onEditAttributes: _onEditAttributes
}) => {
  const dispatch = useAppDispatch();
  const containerRef = useRef<HTMLDivElement>(null);
  const networkRef = useRef<Network | null>(null);
  // Используем any для DataSet, чтобы избежать сложностей с типами
  const nodesDataSetRef = useRef<any>(null);
  const edgesDataSetRef = useRef<any>(null);
  
  const [pendingMoves, setPendingMoves] = useState<Record<string, {x: number, y: number}>>({});
  const moveTimeoutRef = useRef<ReturnType<typeof setTimeout>>();
  const batchGroupIdRef = useRef<string | null>(null);
  const isInitializedRef = useRef(false);
  const isDraggingRef = useRef(false);
  const lastReduxStateRef = useRef<string>(JSON.stringify(artifact.data));

  const handleStateChange = useCallback(async (newData: any) => {
    await dispatch(updateArtifact({
      projectId: artifact.project_id,
      id: artifact.id,
      updates: { data: newData }
    })).unwrap();
  }, [dispatch, artifact.project_id, artifact.id]);

  // Временно не используем execute
  const {
    execute: _execute,
    isRecording,
    lastError
  } = useActionWithUndo(
    artifact.id,
    artifact.data,
    handleStateChange
  );

  useKeyboardShortcuts(artifact.id);

  useEffect(() => {
    if (!containerRef.current || isInitializedRef.current) return;

    console.log('[GraphView] Initializing with data:', artifact.data);
    isInitializedRef.current = true;

    // Создаем DataSet с приведением типов через any
    const nodes = new DataSet(
      (artifact.data?.nodes || []).map((node: any) => ({
        ...node,
        id: node.id,
        label: node.label || node.id,
        title: `${node.type}\n${JSON.stringify(node, null, 2)}`,
        x: node.position_x,
        y: node.position_y,
      }))
    ) as any;

    const edges = new DataSet(
      (artifact.data?.edges || []).map((edge: any) => ({
        ...edge,
        id: edge.id,
        from: edge.from || edge.source_node,
        to: edge.to || edge.target_node,
        label: edge.type,
        title: `${edge.type}\n${JSON.stringify(edge, null, 2)}`,
        arrows: 'to',
      }))
    ) as any;

    nodesDataSetRef.current = nodes;
    edgesDataSetRef.current = edges;

    const options = {
      physics: { enabled: false, stabilization: false },
      layout: { randomSeed: 42, improvedLayout: false },
      nodes: {
        shape: 'dot',
        size: 20,
        font: { size: 14, color: '#ffffff' },
        borderWidth: 2,
        shadow: true,
        fixed: false
      },
      edges: {
        width: 2,
        smooth: {
          enabled: true,
          type: 'continuous',
          roundness: 0.5
        },
        font: { 
          size: 12, 
          color: '#ffffff', 
          align: 'middle' 
        },
        arrows: { 
          to: { 
            enabled: true, 
            scaleFactor: 0.8 
          } 
        },
        color: { 
          color: '#848484', 
          highlight: '#2196f3', 
          hover: '#2196f3' 
        }
      },
      interaction: {
        dragNodes: true,
        dragView: true,
        zoomView: true,
        hover: true,
        tooltipDelay: 300,
        multiselect: true,
        navigationButtons: true,
        keyboard: false
      },
      manipulation: { enabled: false }
    };

    const network = new Network(
      containerRef.current,
      { nodes, edges },
      options
    );

    networkRef.current = network;

    network.on('dragStart', (params) => {
      const nodeId = params.nodes[0];
      if (nodeId) {
        isDraggingRef.current = true;
        batchGroupIdRef.current = `move_${Date.now()}`;
      }
    });

    network.on('dragEnd', (params) => {
      const nodeId = params.nodes[0];
      if (!nodeId) {
        isDraggingRef.current = false;
        return;
      }

      const position = network.getPosition(nodeId);
      
      setPendingMoves(prev => ({
        ...prev,
        [nodeId]: { x: position.x, y: position.y }
      }));

      if (moveTimeoutRef.current) {
        clearTimeout(moveTimeoutRef.current);
      }

      moveTimeoutRef.current = setTimeout(() => {
        const currentMoves = { ...pendingMoves, [nodeId]: { x: position.x, y: position.y } };
        setPendingMoves({});

        Object.entries(currentMoves).forEach(([id, pos]) => {
          const typedPos = pos as {x: number, y: number};
          onNodeMove(id, typedPos.x, typedPos.y);
        });

        batchGroupIdRef.current = null;
        isDraggingRef.current = false;
      }, 500);
    });

    return () => {
      if (moveTimeoutRef.current) clearTimeout(moveTimeoutRef.current);
      network.destroy();
      isInitializedRef.current = false;
    };
  }, []); // Пустой массив зависимостей - инициализация только один раз

  useEffect(() => {
    if (!networkRef.current || !nodesDataSetRef.current || isDraggingRef.current) return;

    const currentReduxState = JSON.stringify(artifact.data);
    if (currentReduxState === lastReduxStateRef.current) return;

    lastReduxStateRef.current = currentReduxState;

    const nodesData = (artifact.data?.nodes || []).map((node: any) => ({
      ...node,
      id: node.id,
      label: node.label || node.id,
      x: node.position_x,
      y: node.position_y,
    }));

    nodesDataSetRef.current.clear();
    if (nodesData.length > 0) {
      nodesDataSetRef.current.add(nodesData);
    }

    const edgesData = (artifact.data?.edges || []).map((edge: any) => ({
      ...edge,
      id: edge.id,
      from: edge.from || edge.source_node,
      to: edge.to || edge.target_node,
      label: edge.type,
    }));

    edgesDataSetRef.current?.clear();
    if (edgesData.length > 0) {
      edgesDataSetRef.current?.add(edgesData);
    }
  }, [artifact.data]);

  return (
    <div className="graph-view" style={{ height: '100%', position: 'relative' }}>
      <div 
        ref={containerRef} 
        style={{ width: '100%', height: '100%' }}
      />
      {isRecording && (
        <div style={{
          position: 'absolute',
          top: 10,
          right: 10,
          background: '#f59e0b',
          color: 'white',
          padding: '4px 8px',
          borderRadius: '4px',
          fontSize: '12px',
          zIndex: 1000
        }}>
          Recording...
        </div>
      )}
      {lastError && (
        <div style={{
          position: 'absolute',
          top: 10,
          right: 10,
          background: '#ef4444',
          color: 'white',
          padding: '4px 8px',
          borderRadius: '4px',
          fontSize: '12px',
          zIndex: 1000
        }}>
          Error
        </div>
      )}
    </div>
  );
};

export default GraphView;