// frontend/src/components/views/GraphView.tsx
import React, { useEffect, useRef, useState, useCallback } from 'react';
import { useAppDispatch, useAppSelector } from '../../store';
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
  
  // Текущее состояние графа из артефакта
  const currentGraphData = artifact.data;
  
  // Состояние для группировки перемещений
  const [pendingMoves, setPendingMoves] = useState<Record<string, {x: number, y: number}>>({});
  const moveTimeoutRef = useRef<NodeJS.Timeout>();
  const batchGroupIdRef = useRef<string | null>(null);

  // ==========================================================================
  // Инициализация хука для undo/redo
  // ==========================================================================
  
  const handleStateChange = useCallback(async (newData: any) => {
    await dispatch(updateArtifact({
      projectId: artifact.project_id,
      id: artifact.id,
      updates: { data: newData }
    })).unwrap();
  }, [artifact.project_id, artifact.id, dispatch]);

  const { 
    execute, 
    undo, 
    redo, 
    startBatch, 
    endBatch,
    canUndo, 
    canRedo 
  } = useActionWithUndo(
    artifact.id,
    currentGraphData,
    handleStateChange
  );

  // Подключаем клавиатурные сокращения
  useKeyboardShortcuts(artifact.id);

  // ==========================================================================
  // Инициализация vis-network
  // ==========================================================================
  
  useEffect(() => {
    if (!containerRef.current) return;

    // Создаем DataSet'ы
    const nodes = new DataSet(currentGraphData.nodes?.map(node => ({
      id: node.id,
      label: node.label,
      title: `${node.type}\n${JSON.stringify(node, null, 2)}`,
      x: node.position_x,
      y: node.position_y,
      group: node.type,
      // Добавляем все остальные атрибуты
      ...node
    })) || []);

    const edges = new DataSet(currentGraphData.edges?.map(edge => ({
      id: edge.id,
      from: edge.from,
      to: edge.to,
      label: edge.type,
      title: `${edge.type}\n${JSON.stringify(edge, null, 2)}`,
      arrows: 'to',
      ...edge
    })) || []);

    nodesDataSetRef.current = nodes;
    edgesDataSetRef.current = edges;

    // Настройки сети
    const options = {
      physics: {
        enabled: false, // Отключаем физику для ручного управления
      },
      layout: {
        randomSeed: 42, // Для воспроизводимости
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
      },
      edges: {
        width: 2,
        smooth: {
          type: 'continuous',
        },
        font: {
          size: 12,
          color: '#ffffff',
          align: 'middle',
        },
      },
      interaction: {
        dragNodes: true,
        dragView: true,
        zoomView: true,
        hover: true,
        tooltipDelay: 300,
        multiselect: true,
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

    // ========================================================================
    // Обработчики событий
    // ========================================================================

    // Обработчик перемещения узла (начало)
    network.on('dragStart', (params) => {
      const nodeId = params.nodes[0];
      if (nodeId) {
        // Начинаем новую группу для перемещений
        batchGroupIdRef.current = startBatch('Перемещение узлов');
      }
    });

    // Обработчик перемещения узла (конец) - с группировкой
    network.on('dragEnd', async (params) => {
      const nodeId = params.nodes[0];
      if (!nodeId) return;

      const position = network.getPosition(nodeId);
      
      // Добавляем в ожидающие перемещения
      setPendingMoves(prev => ({
        ...prev,
        [nodeId]: { x: position.x, y: position.y }
      }));

      // Сбрасываем предыдущий таймаут
      if (moveTimeoutRef.current) {
        clearTimeout(moveTimeoutRef.current);
      }

      // Устанавливаем новый таймаут (500ms группировки)
      moveTimeoutRef.current = setTimeout(async () => {
        if (Object.keys(pendingMoves).length === 0 && !nodeId) return;

        const movesToApply = { ...pendingMoves };
        if (nodeId) {
          movesToApply[nodeId] = { x: position.x, y: position.y };
        }

        await execute(
          async () => {
            // Обновляем позиции узлов
            const updatedNodes = currentGraphData.nodes?.map(node => 
              movesToApply[node.id] 
                ? { 
                    ...node, 
                    position_x: movesToApply[node.id].x, 
                    position_y: movesToApply[node.id].y 
                  }
                : node
            ) || [];

            const newData = {
              ...currentGraphData,
              nodes: updatedNodes
            };

            await handleStateChange(newData);
          },
          {
            description: `Перемещение ${Object.keys(movesToApply).length} узлов`,
            actionType: 'batch_move',
            groupId: batchGroupIdRef.current || undefined,
            batch: false // Уже сгруппировали
          }
        );

        // Очищаем pending moves и завершаем группу
        setPendingMoves({});
        if (batchGroupIdRef.current) {
          await endBatch();
          batchGroupIdRef.current = null;
        }
      }, 500);
    });

    // Обработчик добавления узла (через контекстное меню)
    network.on('oncontext', (params) => {
      params.event.preventDefault();
      
      const { pointer } = params;
      
      // Показываем кастомное меню для добавления узла
      // В реальном проекте здесь должно быть модальное окно или дропдаун
      const nodeType = prompt('Введите тип узла (person, organization, etc):');
      if (!nodeType) return;

      const nodeLabel = prompt('Введите название узла:');
      if (!nodeLabel) return;

      const nodeId = `node_${Date.now()}`;

      execute(
        async () => {
          const newNode = {
            id: nodeId,
            label: nodeLabel,
            type: nodeType,
            position_x: pointer.canvas.x,
            position_y: pointer.canvas.y,
            attributes: {}
          };

          const newData = {
            ...currentGraphData,
            nodes: [...(currentGraphData.nodes || []), newNode]
          };

          await handleStateChange(newData);
        },
        {
          description: `Добавление узла: ${nodeLabel}`,
          actionType: 'add_node'
        }
      );
    });

    // Обработчик удаления узла (клавиша Delete)
    network.on('selectNode', (params) => {
      const handleDelete = async () => {
        const selectedNodes = network.getSelectedNodes();
        if (selectedNodes.length === 0) return;

        await execute(
          async () => {
            const newData = {
              ...currentGraphData,
              nodes: currentGraphData.nodes?.filter(node => !selectedNodes.includes(node.id)) || [],
              edges: currentGraphData.edges?.filter(edge => 
                !selectedNodes.includes(edge.from) && !selectedNodes.includes(edge.to)
              ) || []
            };

            await handleStateChange(newData);
          },
          {
            description: `Удаление ${selectedNodes.length} узлов`,
            actionType: 'delete_node'
          }
        );
      };

      // Добавляем обработчик клавиши Delete
      const keyHandler = (e: KeyboardEvent) => {
        if (e.key === 'Delete' || e.key === 'Del') {
          e.preventDefault();
          handleDelete();
        }
      };

      window.addEventListener('keydown', keyHandler);
      return () => window.removeEventListener('keydown', keyHandler);
    });

    // Cleanup
    return () => {
      network.destroy();
      if (moveTimeoutRef.current) {
        clearTimeout(moveTimeoutRef.current);
      }
    };
  }, [currentGraphData]); // Пересоздаем при изменении данных

  // ==========================================================================
  // Обновление данных при изменении currentGraphData
  // ==========================================================================
  
  useEffect(() => {
    if (!networkRef.current || !nodesDataSetRef.current || !edgesDataSetRef.current) return;

    // Обновляем узлы
    const nodesData = currentGraphData.nodes?.map(node => ({
      id: node.id,
      label: node.label,
      x: node.position_x,
      y: node.position_y,
      group: node.type,
      ...node
    })) || [];

    nodesDataSetRef.current.clear();
    nodesDataSetRef.current.add(nodesData);

    // Обновляем ребра
    const edgesData = currentGraphData.edges?.map(edge => ({
      id: edge.id,
      from: edge.from,
      to: edge.to,
      label: edge.type,
      ...edge
    })) || [];

    edgesDataSetRef.current.clear();
    edgesDataSetRef.current.add(edgesData);

  }, [currentGraphData]);

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
            ↩️ Undo
          </button>
          <button 
            onClick={redo}
            disabled={!canRedo}
            title="Повторить (Ctrl+Y / Ctrl+Shift+Z)"
            className="toolbar-btn"
          >
            ↪️ Redo
          </button>
        </div>
        
        <div className="toolbar-group">
          <button 
            onClick={() => {
              // Сохранить
            }}
            title="Сохранить (Ctrl+S)"
            className="toolbar-btn"
          >
            💾 Save
          </button>
          <button 
            onClick={() => {
              // Экспорт
            }}
            title="Экспорт"
            className="toolbar-btn"
          >
            📤 Export
          </button>
        </div>
        
        <div className="toolbar-status">
          {pendingMoves && Object.keys(pendingMoves).length > 0 && (
            <span className="status-badge">
              Группировка... {Object.keys(pendingMoves).length}
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
        graphId={artifact.id}
        onJump={(state) => {
          // При прыжке по истории обновляем состояние
          handleStateChange(state);
        }}
      />
    </div>
  );
};
