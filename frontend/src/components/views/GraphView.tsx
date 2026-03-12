// frontend/src/components/views/GraphView.tsx
import React, { useEffect, useRef, useCallback, useState } from 'react';
import { Network } from 'vis-network/standalone';
import { DataSet } from 'vis-data/standalone';
import { useAppDispatch, useAppSelector } from '../../store';
import { setSelectedElement, setSelectedElements } from '../../store/slices/uiSlice';
import { updateArtifact, fetchArtifactVersions } from '../../store/slices/artifactsSlice';
import { HistoryPanel } from '../history/HistoryPanel';
import { useActionWithUndo } from '../../hooks/useActionWithUndo';
import { useKeyboardShortcuts } from '../../hooks/useKeyboardShortcuts';

interface GraphViewProps {
  artifact: any;
  onNodeMove?: (nodeId: string, x: number, y: number) => void;
  onAddNode?: (position: { x: number, y: number }, nodeType?: string) => void;
  onDeleteNode?: (nodeId: string) => void;
  onAddEdge?: (sourceId: string, targetId: string, edgeType?: string) => void;
  onDeleteEdge?: (edgeId: string) => void;
  onEditAttributes?: (nodeId: string, attributes: Record<string, any>) => void;
}

const getNodeColor = (type: string): string => {
  const colors: Record<string, string> = {
    person: '#2196f3',
    organization: '#4caf50',
    location: '#ff9800',
    event: '#f44336',
    document: '#9c27b0',
    email: '#00bcd4',
    phone: '#ffeb3b',
    account: '#795548',
    ip: '#607d8b'
  };
  return colors[type] || '#9e9e9e';
};

export const GraphView: React.FC<GraphViewProps> = ({ artifact, onNodeMove }) => {
  const dispatch = useAppDispatch();
  const networkRef = useRef<HTMLDivElement>(null);
  const networkInstanceRef = useRef<Network | null>(null);
  const nodesRef = useRef<DataSet | null>(null);
  const edgesRef = useRef<DataSet | null>(null);
  const isInitializedRef = useRef(false);
  
  // Для группировки перемещений
  const [pendingMoves, setPendingMoves] = useState<Record<string, {x: number, y: number}>>({});
  const moveTimeoutRef = useRef<NodeJS.Timeout>();

  // ИНИЦИАЛИЗАЦИЯ - ТОЛЬКО ОДИН РАЗ
  useEffect(() => {
    if (!networkRef.current || isInitializedRef.current) return;
    
    console.log('Initializing graph...');
    isInitializedRef.current = true;
    
    nodesRef.current = new DataSet([]);
    edgesRef.current = new DataSet([]);

    const options = {
      physics: false, // ОТКЛЮЧАЕМ ФИЗИКУ
      layout: { 
        improvedLayout: false, // ОТКЛЮЧАЕМ АВТО-ЛЕЙАУТ
        hierarchical: false 
      },
      interaction: {
        multiselect: true, // ВКЛЮЧАЕМ МУЛЬТИВЫДЕЛЕНИЕ
        selectable: true,
        hover: true,
        dragNodes: true,
        dragView: true,
        zoomView: true
      },
      nodes: {
        shape: 'dot',
        size: 20,
        font: { color: '#ffffff', size: 14 },
        borderWidth: 2,
        shadow: true,
        scaling: {
          min: 16,
          max: 32
        }
      },
      edges: {
        width: 2,
        smooth: { type: 'continuous' },
        arrows: { to: { enabled: true } },
        font: { size: 12, color: '#cccccc' }
      }
    };

    const network = new Network(
      networkRef.current, 
      { nodes: nodesRef.current, edges: edgesRef.current }, 
      options
    );
    
    networkInstanceRef.current = network;

    // ОБРАБОТКА ВЫДЕЛЕНИЯ
    network.on('select', (params) => {
      if (params.nodes.length > 0) {
        const selectedNodes = params.nodes.map(id => ({
          type: 'node',
          id,
          data: nodesRef.current?.get(id)
        }));
        dispatch(setSelectedElements(selectedNodes));
        dispatch(setSelectedElement({ type: 'node', id: params.nodes[0] }));
      } else if (params.edges.length > 0) {
        const edge = edgesRef.current?.get(params.edges[0]);
        dispatch(setSelectedElement({ 
          type: 'edge', 
          id: params.edges[0], 
          data: edge 
        }));
        dispatch(setSelectedElements([]));
      } else {
        dispatch(setSelectedElement(null));
        dispatch(setSelectedElements([]));
      }
    });

    // ОБРАБОТКА КЛИКА
    network.on('click', (params) => {
      if (params.nodes.length === 0 && params.edges.length === 0) {
        dispatch(setSelectedElement(null));
        dispatch(setSelectedElements([]));
      }
    });

    // ПЕРЕМЕЩЕНИЕ УЗЛОВ С ГРУППИРОВКОЙ
    network.on('dragEnd', (params) => {
      if (params.nodes.length === 0) return;
      
      const nodeId = params.nodes[0];
      const position = network.getPosition(nodeId);
      
      // Добавляем в ожидающие перемещения
      setPendingMoves(prev => ({
        ...prev,
        [nodeId]: { x: position.x, y: position.y }
      }));
      
      // Группируем перемещения за 500ms
      if (moveTimeoutRef.current) {
        clearTimeout(moveTimeoutRef.current);
      }
      
      moveTimeoutRef.current = setTimeout(() => {
        const moves = { ...pendingMoves };
        if (Object.keys(moves).length > 0 && onNodeMove) {
          // Применяем все накопленные перемещения
          Object.entries(moves).forEach(([id, pos]) => {
            onNodeMove(id, pos.x, pos.y);
          });
          setPendingMoves({});
        }
      }, 500);
    });

    return () => {
      if (moveTimeoutRef.current) {
        clearTimeout(moveTimeoutRef.current);
      }
      network.destroy();
      networkInstanceRef.current = null;
      isInitializedRef.current = false;
    };
  }, []); // ПУСТОЙ МАССИВ - ИНИЦИАЛИЗАЦИЯ ОДИН РАЗ

  // ОБНОВЛЕНИЕ ДАННЫХ - БЕЗ ПЕРЕСОЗДАНИЯ
  useEffect(() => {
    if (!networkInstanceRef.current || !artifact?.data) return;

    console.log('Updating graph data...');
    
    const nodes = artifact.data.nodes?.map((n: any) => ({
      id: n.id || n.node_id,
      label: n.label || n.attributes?.name || n.id,
      x: n.position_x,
      y: n.position_y,
      color: getNodeColor(n.type)
    })) || [];

    const edges = artifact.data.edges?.map((e: any) => ({
      id: e.id || e.edge_id,
      from: e.from || e.source_node,
      to: e.to || e.target_node,
      label: e.label || e.type,
      arrows: e.directed !== false ? 'to' : undefined
    })) || [];

    nodesRef.current?.clear();
    edgesRef.current?.clear();
    nodesRef.current?.add(nodes);
    edgesRef.current?.add(edges);

    // НИКАКОГО FIT() ЗДЕСЬ! Только если данные пустые
    if (nodes.length === 0) {
      networkInstanceRef.current?.fit();
    }
  }, [artifact?.data]);

  // ОБРАБОТКА UNDO/REDO ЧЕРЕЗ КЛАВИАТУРУ
  useEffect(() => {
    const handleKeyDown = async (e: KeyboardEvent) => {
      // Игнорируем, если фокус на поле ввода
      if ((e.target as HTMLElement).tagName === 'INPUT' || 
          (e.target as HTMLElement).tagName === 'TEXTAREA' ||
          (e.target as HTMLElement).isContentEditable) {
        return;
      }

      if ((e.ctrlKey || e.metaKey) && e.key === 'z') {
        e.preventDefault();
        
        if (!artifact) return;
        
        try {
          // Получаем версии артефакта
          const versions = await dispatch(
            fetchArtifactVersions({ 
              projectId: artifact.project_id, 
              artifactId: artifact.id 
            })
          ).unwrap();
          
          if (e.shiftKey) {
            // Redo: следующая версия (Ctrl+Shift+Z)
            const currentIndex = versions.findIndex(v => v.version === artifact.version);
            if (currentIndex < versions.length - 1) {
              await dispatch(updateArtifact({
                projectId: artifact.project_id,
                artifactId: artifact.id,
                data: versions[currentIndex + 1].data
              }));
            }
          } else {
            // Undo: предыдущая версия (Ctrl+Z)
            const currentIndex = versions.findIndex(v => v.version === artifact.version);
            if (currentIndex > 0) {
              await dispatch(updateArtifact({
                projectId: artifact.project_id,
                artifactId: artifact.id,
                data: versions[currentIndex - 1].data
              }));
            }
          }
          
          // Сбрасываем выделение
          dispatch(setSelectedElement(null));
          dispatch(setSelectedElements([]));
        } catch (error) {
          console.error('Undo/Redo failed:', error);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [artifact, dispatch]);

  // ОБРАБОТКА ПРЫЖКА ПО ИСТОРИИ
  const handleHistoryJump = useCallback(async (state: any) => {
    if (!artifact) return;
    
    try {
      await dispatch(updateArtifact({
        projectId: artifact.project_id,
        artifactId: artifact.id,
        data: state
      }));
      dispatch(setSelectedElement(null));
      dispatch(setSelectedElements([]));
    } catch (error) {
      console.error('Failed to restore state:', error);
    }
  }, [artifact, dispatch]);

  // КНОПКА ДЛЯ ЦЕНТРИРОВАНИЯ
  const handleFit = useCallback(() => {
    networkInstanceRef.current?.fit();
  }, []);

  return (
    <div style={{ width: '100%', height: '100%', position: 'relative' }}>
      <div ref={networkRef} style={{ width: '100%', height: '100%' }} />
      
      {/* Кнопка центрирования */}
      <button
        onClick={handleFit}
        style={{
          position: 'absolute',
          top: 10,
          right: 10,
          padding: '8px 12px',
          background: '#2196f3',
          color: 'white',
          border: 'none',
          borderRadius: 4,
          cursor: 'pointer',
          zIndex: 1000,
          boxShadow: '0 2px 8px rgba(0,0,0,0.3)'
        }}
      >
        🔍 Центрировать
      </button>
      
      {/* Панель истории */}
      <HistoryPanel 
        graphId={artifact?.id} 
        onJump={handleHistoryJump}
      />
      
      {/* Индикатор группировки */}
      {Object.keys(pendingMoves).length > 0 && (
        <div style={{
          position: 'absolute',
          bottom: 80,
          right: 20,
          background: '#ff9800',
          color: 'white',
          padding: '4px 12px',
          borderRadius: 16,
          fontSize: 12,
          boxShadow: '0 2px 8px rgba(0,0,0,0.3)',
          zIndex: 10001
        }}>
          ⏳ Группировка {Object.keys(pendingMoves).length}...
        </div>
      )}
    </div>
  );
};