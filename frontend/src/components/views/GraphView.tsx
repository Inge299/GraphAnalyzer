// frontend/src/components/views/GraphView.tsx
import React, { useEffect, useRef, useState, useCallback } from 'react';
import { useAppDispatch } from '../../store';
import { updateArtifact } from '../../store/slices/artifactsSlice';
import { HistoryPanel } from '../history/HistoryPanel';
import { useActionWithUndo } from '../../hooks/useActionWithUndo';
import { useKeyboardShortcuts } from '../../hooks/useKeyboardShortcuts';
import { Network } from 'vis-network/standalone';
import { DataSet } from 'vis-data/standalone';
import 'vis-network/styles/vis-network.css';
import './GraphView.css';

interface GraphViewProps {
  artifact: {
    id: number;
    project_id: number;
    data: {
      nodes?: Array<{
        id: string;
        label: string;
        type: string;
        position_x?: number;
        position_y?: number;
        [key: string]: any;
      }>;
      edges?: Array<{
        id: string;
        from: string;
        to: string;
        type: string;
        [key: string]: any;
      }>;
    };
  };
}

export const GraphView: React.FC<GraphViewProps> = ({ artifact }) => {
  const dispatch = useAppDispatch();
  const containerRef = useRef<HTMLDivElement>(null);
  const networkRef = useRef<Network | null>(null);
  const nodesDataSetRef = useRef<DataSet<any> | null>(null);
  const edgesDataSetRef = useRef<DataSet<any> | null>(null);

  // Сохраняем ID артефакта для стабильности
  const artifactIdRef = useRef(artifact.id);
  const projectIdRef = useRef(artifact.project_id);

  // Локальное состояние для позиций узлов (оптимистичные обновления)
  const [localNodePositions, setLocalNodePositions] = useState<Record<string, {x: number, y: number}>>({});

  // Состояние для группировки перемещений
  const [pendingMoves, setPendingMoves] = useState<Record<string, {x: number, y: number}>>({});
  const moveTimeoutRef = useRef<NodeJS.Timeout>();
  const batchGroupIdRef = useRef<string | null>(null);

  // Флаг для предотвращения повторной инициализации
  const isInitializedRef = useRef(false);

  // Флаг для игнорирования обновлений из Redux во время перетаскивания
  const isDraggingRef = useRef(false);

  // Последнее примененное состояние из Redux
  const lastReduxStateRef = useRef<string>(JSON.stringify(artifact.data));

  // Флаг для пропуска fit() при внешних обновлениях
  const skipFitRef = useRef(false);

  // ==========================================================================
  // Инициализация хука для undo/redo
  // ==========================================================================

  const handleStateChange = useCallback(async (newData: any) => {
    console.log('Updating Redux state:', newData);
    await dispatch(updateArtifact({
      projectId: projectIdRef.current,
      id: artifactIdRef.current,
      updates: { data: newData }
    })).unwrap();
  }, [dispatch]);

  const {
    execute,
    undo,
    redo,
    canUndo,
    canRedo
  } = useActionWithUndo(
    artifact.id,
    artifact.data,
    handleStateChange
  );

  // Подключаем клавиатурные сокращения
  useKeyboardShortcuts(artifact.id);

  // ==========================================================================
  // Инициализация vis-network
  // ==========================================================================

  useEffect(() => {
    if (!containerRef.current || isInitializedRef.current) return;

    console.log('Initializing graph with data:', artifact.data);
    isInitializedRef.current = true;

    // Создаем DataSet'ы с учетом локальных позиций
    const initialNodes = (artifact.data.nodes || []).map(node => ({
      id: node.id,
      label: node.label || node.id,
      title: `${node.type}\n${JSON.stringify(node, null, 2)}`,
      x: node.position_x,
      y: node.position_y,
      group: node.type,
      ...node
    }));

    const nodes = new DataSet(initialNodes);
    const edges = new DataSet(
      (artifact.data.edges || []).map(edge => ({
        id: edge.id,
        from: edge.from,
        to: edge.to,
        label: edge.type,
        title: `${edge.type}\n${JSON.stringify(edge, null, 2)}`,
        arrows: 'to',
        ...edge
      }))
    );

    nodesDataSetRef.current = nodes;
    edgesDataSetRef.current = edges;

    // Настройки сети
    const options = {
      physics: {
        enabled: false,
        stabilization: false
      },
      layout: {
        randomSeed: 42,
        improvedLayout: false
      },
      nodes: {
        shape: 'dot',
        size: 20,
        font: {
          size: 14,
          color: '#ffffff',
        },
        borderWidth: 2,
        shadow: true,
        fixed: false
      },
      edges: {
        width: 2,
        smooth: {
          enabled: false,
          type: 'continuous'
        },
        font: {
          size: 12,
          color: '#ffffff',
          align: 'middle',
          strokeWidth: 2,
          strokeColor: '#2d2d2d'
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
      manipulation: {
        enabled: false,
      },
    };

    // Создаем сеть
    const network = new Network(
      containerRef.current,
      { nodes, edges },
      options
    );

    networkRef.current = network;

    // Отключаем автоматическое масштабирование при старте
    network.once('afterDrawing', () => {
      console.log('Network initialized, skipping fit');
    });

    // ========================================================================
    // Обработчики событий
    // ========================================================================

    // Обработчик начала перетаскивания
    network.on('dragStart', (params) => {
      const nodeId = params.nodes[0];
      if (nodeId) {
        console.log('Drag start for node:', nodeId);
        isDraggingRef.current = true;
        // Создаем группу для batch операций
        batchGroupIdRef.current = `move_${Date.now()}`;
      }
    });

    // Обработчик во время перетаскивания - обновляем локальное состояние
    network.on('dragging', (params) => {
      const nodeId = params.nodes[0];
      if (nodeId) {
        const position = network.getPosition(nodeId);
        setLocalNodePositions(prev => ({
          ...prev,
          [nodeId]: { x: position.x, y: position.y }
        }));
      }
    });



    // Обработчик окончания перетаскивания
    network.on('dragEnd', async (params) => {
      const nodeId = params.nodes[0];
      if (!nodeId) {
        isDraggingRef.current = false;
        return;
      }

      const position = network.getPosition(nodeId);
      console.log('Drag end for node:', nodeId, position);

      // Добавляем в ожидающие перемещения
      setPendingMoves(prev => {
        const newMoves = {
          ...prev,
          [nodeId]: { x: position.x, y: position.y }
        };

        // Сбрасываем предыдущий таймаут
        if (moveTimeoutRef.current) {
          clearTimeout(moveTimeoutRef.current);
        }

        // Устанавливаем новый таймаут
        moveTimeoutRef.current = setTimeout(async () => {
          const movesToApply = { ...newMoves };
      
          // Очищаем pending moves
          setPendingMoves({});
      
          // Создаем функцию для обновления данных
          const updateData = () => {
            const updatedNodes = (artifact.data.nodes || []).map(node =>
              movesToApply[node.id]
                ? {
                    ...node,
                    position_x: movesToApply[node.id].x,
                    position_y: movesToApply[node.id].y
                  }
                : node
            );

            return {
              ...artifact.data,
              nodes: updatedNodes
            };
          };

          // Выполняем действие через execute
          await execute(
            async () => {
              const newData = updateData();
              // НЕ вызываем handleStateChange здесь!
              // execute сам вызовет onStateChange
              return newData; // Возвращаем новое состояние
            },
            {
              description: Object.keys(movesToApply).length === 1 
                ? `Перемещение узла` 
                : `Перемещение ${Object.keys(movesToApply).length} узлов`,
              actionType: 'batch_move',
              groupId: batchGroupIdRef.current || undefined
            }
          );

          batchGroupIdRef.current = null;
          isDraggingRef.current = false;
        }, 500);

        return newMoves;
      });
    });
    


    // Обработчик клика на узле
    network.on('click', (params) => {
      if (params.nodes.length > 0) {
        console.log('Clicked node:', params.nodes[0]);
      }
    });

    // Cleanup
    return () => {
      if (moveTimeoutRef.current) {
        clearTimeout(moveTimeoutRef.current);
      }
      network.destroy();
      isInitializedRef.current = false;
    };
  }, []); // Пустой массив - инициализация только один раз

  // ==========================================================================
  // Синхронизация с Redux (только когда не перетаскиваем)
  // ==========================================================================

  useEffect(() => {
    if (!networkRef.current || !nodesDataSetRef.current || isDraggingRef.current) {
      return;
    }

    const currentReduxState = JSON.stringify(artifact.data);

    // Если состояние в Redux изменилось (не из-за нашего перетаскивания)
    if (currentReduxState !== lastReduxStateRef.current) {
      console.log('Redux state changed externally, updating graph');
      lastReduxStateRef.current = currentReduxState;

      // Обновляем узлы
      const nodesData = (artifact.data.nodes || []).map(node => ({
        id: node.id,
        label: node.label || node.id,
        x: node.position_x,
        y: node.position_y,
        group: node.type,
        ...node
      }));

      // Очищаем и добавляем заново
      nodesDataSetRef.current.clear();
      if (nodesData.length > 0) {
        nodesDataSetRef.current.add(nodesData);
      }

      // Очищаем локальные позиции
      setLocalNodePositions({});

      // Обновляем ребра
      const edgesData = (artifact.data.edges || []).map(edge => ({
        id: edge.id,
        from: edge.from,
        to: edge.to,
        label: edge.type,
        ...edge
      }));

      edgesDataSetRef.current?.clear();
      if (edgesData.length > 0) {
        edgesDataSetRef.current?.add(edgesData);
      }

      // НЕ делаем fit() - сохраняем текущий масштаб и позицию
      skipFitRef.current = false;
    }
  }, [artifact.data]);

  // ==========================================================================
  // Обработчик клавиш для undo/redo
  // ==========================================================================

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement).tagName === 'INPUT' ||
          (e.target as HTMLElement).tagName === 'TEXTAREA') {
        return;
      }

      if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey) {
        e.preventDefault();
        console.log('Undo keyboard shortcut');
        undo();
      }

      if ((e.ctrlKey || e.metaKey) && (e.key === 'y' || (e.key === 'z' && e.shiftKey))) {
        e.preventDefault();
        console.log('Redo keyboard shortcut');
        redo();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [undo, redo]);

  // ==========================================================================
  // Render
  // ==========================================================================

  return (
    <div className="graph-view">
      {/* Панель инструментов */}
      <div className="graph-toolbar">
        <div className="toolbar-group">
          <button
            onClick={undo}
            disabled={!canUndo}
            title="Отменить (Ctrl+Z)"
            className="toolbar-btn"
          >
            ↩️ Undo {canUndo ? '(доступно)' : ''}
          </button>
          <button
            onClick={redo}
            disabled={!canRedo}
            title="Повторить (Ctrl+Y / Ctrl+Shift+Z)"
            className="toolbar-btn"
          >
            ↪️ Redo {canRedo ? '(доступно)' : ''}
          </button>
        </div>

        <div className="toolbar-group">
          <button
            onClick={() => {
              // Сохранить
              dispatch(updateArtifact({
                projectId: projectIdRef.current,
                id: artifactIdRef.current,
                updates: { data: artifact.data }
              }));
            }}
            title="Сохранить (Ctrl+S)"
            className="toolbar-btn"
          >
            💾 Save
          </button>
          <button
            onClick={() => {
              // Экспорт
              const dataStr = JSON.stringify(artifact.data, null, 2);
              const dataUri = 'data:application/json;charset=utf-8,'+ encodeURIComponent(dataStr);
              const exportFileDefaultName = `graph-${artifact.id}.json`;
              const linkElement = document.createElement('a');
              linkElement.setAttribute('href', dataUri);
              linkElement.setAttribute('download', exportFileDefaultName);
              linkElement.click();
            }}
            title="Экспорт в JSON"
            className="toolbar-btn"
          >
            📤 Export
          </button>
        </div>

        <div className="toolbar-group">
          <button
            onClick={() => {
              if (networkRef.current) {
                networkRef.current.fit();
              }
            }}
            title="Подогнать под экран"
            className="toolbar-btn"
          >
            🔍 Fit
          </button>
          <button
            onClick={() => {
              if (networkRef.current) {
                networkRef.current.moveTo({
                  scale: 1,
                  position: { x: 0, y: 0 }
                });
              }
            }}
            title="Сбросить масштаб"
            className="toolbar-btn"
          >
            🔄 Reset
          </button>
        </div>

        <div className="toolbar-status">
          {Object.keys(pendingMoves).length > 0 && (
            <span className="status-badge">
              Группировка... {Object.keys(pendingMoves).length}
            </span>
          )}
          {isDraggingRef.current && (
            <span className="status-badge" style={{background: '#ff9800'}}>
              Перетаскивание...
            </span>
          )}
        </div>
      </div>

      {/* Контейнер для графа */}
      <div
        ref={containerRef}
        className="graph-container"
        style={{ width: '100%', height: 'calc(100vh - 200px)' }}
      />

      {/* Панель истории */}
      <HistoryPanel 
        artifactId={artifact.id}
        onJump={(state) => {
          // Обновляем граф из истории
          if (networkRef.current && nodesDataSetRef.current) {
            skipFitRef.current = true;
            
            const nodesData = (state.nodes || []).map((node: any) => ({
              id: node.id,
              label: node.label || node.id,
              x: node.position_x,
              y: node.position_y,
              group: node.type,
              ...node
            }));

            nodesDataSetRef.current.clear();
            nodesDataSetRef.current.add(nodesData);

            const edgesData = (state.edges || []).map((edge: any) => ({
              id: edge.id,
              from: edge.from,
              to: edge.to,
              label: edge.type,
              ...edge
            }));

            edgesDataSetRef.current?.clear();
            if (edgesData.length > 0) {
              edgesDataSetRef.current?.add(edgesData);
            }
          }
        }}
      />
    </div>
  );
};
