// src/components/views/GraphView.tsx
import React, { useEffect, useRef, useCallback, useState } from 'react';
import { Network, DataSet } from 'vis-network/standalone';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { 
  faSpinner,
  faPlus,
  faMinus,
  faExpand
} from '@fortawesome/free-solid-svg-icons';
import { useAppDispatch, useAppSelector } from '../../store';
import { setGraphData, setNetworkInstance } from '../../store/slices/graphSlice';
import { setSelectedNode, setSelectedEdge } from '../../store/slices/uiSlice';

interface GraphViewProps {
  graphId?: number;
}

export const GraphView: React.FC<GraphViewProps> = ({ graphId }) => {
  const dispatch = useAppDispatch();
  
  const [isReady, setIsReady] = useState(false);
  
  const nodes = useAppSelector((state) => state.graph.nodes);
  const edges = useAppSelector((state) => state.graph.edges);
  const isLoading = useAppSelector((state) => state.graph.isLoading);
  const selectedNodeId = useAppSelector((state) => state.ui.selectedNodeId);
  const selectedEdgeId = useAppSelector((state) => state.ui.selectedEdgeId);

  const containerRef = useRef<HTMLDivElement>(null);
  const networkRef = useRef<Network | null>(null);
  const viewStateRef = useRef({ scale: 1, offset: { x: 0, y: 0 } });
  const nodesRef = useRef(nodes);
  const edgesRef = useRef(edges);
  const isUpdatingRef = useRef(false);
  const isDraggingNodeRef = useRef(false);
  const isDraggingViewRef = useRef(false);
  const viewportBeforeDragRef = useRef<{ scale: number; position: { x: number; y: number } } | null>(null);

  // Обновляем рефы при изменении данных
  useEffect(() => {
    nodesRef.current = nodes;
    edgesRef.current = edges;
  }, [nodes, edges]);

  // Загрузка тестовых данных
  useEffect(() => {
    const mockNodes = [
      { id: '1', type: 'person', attributes: { full_name: 'Иван Петров', age: 35, city: 'Москва' } },
      { id: '2', type: 'person', attributes: { full_name: 'Мария Сидорова', age: 32, city: 'СПб' } },
      { id: '3', type: 'phone', attributes: { number: '+79161234567', operator: 'МТС' } },
      { id: '4', type: 'location', attributes: { address: 'ул. Тверская, 1', city: 'Москва' } },
    ];
    const mockEdges = [
      { id: 'e1', from: '1', to: '2', type: 'knows', attributes: { since: '2020' } },
      { id: 'e2', from: '1', to: '3', type: 'uses', attributes: { frequency: 'daily' } },
      { id: 'e3', from: '2', to: '3', type: 'uses', attributes: { frequency: 'weekly' } },
      { id: 'e4', from: '1', to: '4', type: 'visited', attributes: { last: '2024-01-15' } },
    ];
    dispatch(setGraphData({ nodes: mockNodes, edges: mockEdges }));
  }, []);

  // Функции для кастомных кнопок навигации
  const handleZoomIn = () => {
    if (networkRef.current) {
      const scale = networkRef.current.getScale();
      networkRef.current.moveTo({
        scale: scale * 1.2,
        animation: {
          duration: 200,
          easingFunction: 'easeInOutQuad'
        }
      });
      // Обновляем сохраненное состояние после анимации
      setTimeout(() => {
        if (networkRef.current) {
          viewStateRef.current = {
            scale: networkRef.current.getScale(),
            offset: networkRef.current.getViewPosition()
          };
        }
      }, 200);
    }
  };

  const handleZoomOut = () => {
    if (networkRef.current) {
      const scale = networkRef.current.getScale();
      networkRef.current.moveTo({
        scale: scale * 0.8,
        animation: {
          duration: 200,
          easingFunction: 'easeInOutQuad'
        }
      });
      setTimeout(() => {
        if (networkRef.current) {
          viewStateRef.current = {
            scale: networkRef.current.getScale(),
            offset: networkRef.current.getViewPosition()
          };
        }
      }, 200);
    }
  };

  const handleFit = () => {
    if (networkRef.current) {
      networkRef.current.fit({
        animation: {
          duration: 500,
          easingFunction: 'easeInOutQuad'
        }
      });
      setTimeout(() => {
        if (networkRef.current) {
          viewStateRef.current = {
            scale: networkRef.current.getScale(),
            offset: networkRef.current.getViewPosition()
          };
        }
      }, 500);
    }
  };

  // Функция для обновления данных сети
  const updateNetworkData = useCallback(() => {
    if (!networkRef.current || isUpdatingRef.current || nodesRef.current.length === 0) return;
    
    isUpdatingRef.current = true;

    const getNodeColor = (type: string) => {
      const colors: Record<string, any> = {
        person: {
          border: '#4F46E5',
          background: '#1E293B',
          highlight: { border: '#7C3AED', background: '#2D3A4F' },
          hover: { border: '#4F46E5', background: '#2D3A4F' }
        },
        phone: {
          border: '#10B981',
          background: '#1E293B',
          highlight: { border: '#34D399', background: '#2D3A4F' },
          hover: { border: '#10B981', background: '#2D3A4F' }
        },
        location: {
          border: '#EF4444',
          background: '#1E293B',
          highlight: { border: '#F87171', background: '#2D3A4F' },
          hover: { border: '#EF4444', background: '#2D3A4F' }
        },
        message: {
          border: '#F59E0B',
          background: '#1E293B',
          highlight: { border: '#FBBF24', background: '#2D3A4F' },
          hover: { border: '#F59E0B', background: '#2D3A4F' }
        },
        default: {
          border: '#4F46E5',
          background: '#1E293B',
          highlight: { border: '#7C3AED', background: '#2D3A4F' },
          hover: { border: '#4F46E5', background: '#2D3A4F' }
        }
      };
      return colors[type] || colors.default;
    };

    let existingPositions = {};
    try {
      existingPositions = networkRef.current.getPositions() || {};
    } catch (e) {
      console.warn('Could not get positions', e);
    }

    const nodesDataSet = new DataSet();
    nodesRef.current.forEach((node) => {
      const existingPos = existingPositions[node.id];
      const x = existingPos?.x ?? node.x ?? 100 + Math.random() * 800;
      const y = existingPos?.y ?? node.y ?? 100 + Math.random() * 400;
      
      nodesDataSet.add({
        id: node.id,
        label: node.attributes?.full_name || node.attributes?.name || node.id,
        title: `Type: ${node.type}`,
        color: getNodeColor(node.type),
        x: x,
        y: y,
        shape: 'dot',
        size: 25,
        borderWidth: 2,
        borderWidthSelected: 3,
        font: {
          color: '#F1F5F9',
          size: 14,
          face: 'Inter, system-ui, sans-serif',
          strokeWidth: 2,
          strokeColor: '#0B1120'
        },
        shadow: {
          enabled: true,
          color: 'rgba(0,0,0,0.5)',
          size: 10,
          x: 0,
          y: 4
        },
        fixed: false
      });
    });

    const edgesDataSet = new DataSet();
    edgesRef.current.forEach((edge) => {
      edgesDataSet.add({
        id: edge.id,
        from: edge.from,
        to: edge.to,
        label: edge.type,
        title: `Type: ${edge.type}`,
        color: {
          color: '#4F46E5',
          highlight: '#7C3AED',
          hover: '#4F46E5',
          opacity: 0.8
        },
        font: {
          color: '#94A3B8',
          size: 11,
          face: 'Inter, system-ui, sans-serif',
          background: '#1E293B',
          strokeWidth: 0
        },
        width: 2,
        smooth: {
          type: 'continuous',
          forceDirection: 'none',
          roundness: 0.5
        },
        arrows: {
          to: {
            enabled: true,
            scaleFactor: 1,
            type: 'arrow'
          }
        }
      });
    });

    networkRef.current.setData({ nodes: nodesDataSet, edges: edgesDataSet });
    
    networkRef.current.moveTo({
      scale: viewStateRef.current.scale,
      position: viewStateRef.current.offset,
      animation: false
    });

    setTimeout(() => {
      if (networkRef.current) {
        const newPositions = networkRef.current.getPositions();
        const updatedNodes = nodesRef.current.map(node => {
          if (newPositions[node.id]) {
            return {
              ...node,
              x: newPositions[node.id].x,
              y: newPositions[node.id].y
            };
          }
          return node;
        });
        
        const hasChanges = updatedNodes.some((node, index) => {
          const oldNode = nodesRef.current[index];
          return oldNode && (oldNode.x !== node.x || oldNode.y !== node.y);
        });
        
        if (hasChanges) {
          dispatch(setGraphData({
            nodes: updatedNodes,
            edges: edgesRef.current
          }));
        }
      }
      isUpdatingRef.current = false;
    }, 100);

  }, [dispatch]);

  // Инициализация vis-network
  useEffect(() => {
    if (!containerRef.current) return;

    const options = {
      nodes: {
        shape: 'dot',
        size: 25,
        borderWidth: 2,
        borderWidthSelected: 3,
        font: {
          color: '#F1F5F9',
          size: 14,
          face: 'Inter, system-ui, sans-serif',
          strokeWidth: 2,
          strokeColor: '#0B1120'
        },
        shadow: {
          enabled: true,
          color: 'rgba(0,0,0,0.5)',
          size: 10,
          x: 0,
          y: 4
        }
      },
      edges: {
        width: 2,
        smooth: {
          type: 'continuous',
          forceDirection: 'none',
          roundness: 0.5
        },
        font: {
          color: '#94A3B8',
          size: 11,
          face: 'Inter, system-ui, sans-serif',
          background: '#1E293B',
          strokeWidth: 0
        },
        arrows: {
          to: {
            enabled: true,
            scaleFactor: 1,
            type: 'arrow'
          }
        }
      },
      physics: {
        enabled: false,
        stabilization: false
      },
      interaction: {
        hover: true,
        tooltipDelay: 200,
        hideEdgesOnDrag: false,
        hideEdgesOnZoom: false,
        navigationButtons: false,
        keyboard: true,
        zoomView: true,
        dragNodes: true,
        dragView: true,
      },
      layout: {
        improvedLayout: true,
        randomSeed: 42,
      },
    };

    const network = new Network(
      containerRef.current,
      { nodes: new DataSet(), edges: new DataSet() },
      options
    );

    networkRef.current = network;
    dispatch(setNetworkInstance(network));

    // Сохраняем состояние просмотра
    network.on('zoom', (params) => {
      viewStateRef.current.scale = params.scale;
      viewStateRef.current.offset = network.getViewPosition();
    });

    // Сохраняем состояние просмотра при начале любого перетаскивания
    network.on('dragStart', (params) => {
      // Сохраняем текущий viewport перед любым перетаскиванием
      viewportBeforeDragRef.current = {
        scale: network.getScale(),
        position: network.getViewPosition()
      };
      
      if (params.nodes.length > 0) {
        // Перетаскивание узла
        isDraggingNodeRef.current = true;
        isDraggingViewRef.current = false;
      } else {
        // Перетаскивание вида (фона)
        isDraggingViewRef.current = true;
        isDraggingNodeRef.current = false;
      }
    });

    // Отслеживаем окончание перетаскивания
    network.on('dragEnd', (params) => {
      if (isDraggingNodeRef.current && params.nodes.length > 0 && !isUpdatingRef.current) {
        // Перетаскивали узел - обновляем его позицию
        const nodeId = params.nodes[0];
        const newPos = network.getPosition(nodeId);
        
        const updatedNodes = nodesRef.current.map(node => {
          if (node.id === nodeId) {
            return {
              ...node,
              x: newPos.x,
              y: newPos.y
            };
          }
          return node;
        });
        
        dispatch(setGraphData({
          nodes: updatedNodes,
          edges: edgesRef.current
        }));
        
        // ТОЛЬКО для перетаскивания узла - восстанавливаем viewport
        if (viewportBeforeDragRef.current) {
          network.moveTo({
            scale: viewportBeforeDragRef.current.scale,
            position: viewportBeforeDragRef.current.position,
            animation: false
          });
        }
      } else {
        // Перетаскивали граф - сохраняем новую позицию viewport
        viewStateRef.current = {
          scale: network.getScale(),
          offset: network.getViewPosition()
        };
      }
      
      // Сбрасываем флаги
      isDraggingNodeRef.current = false;
      isDraggingViewRef.current = false;
      viewportBeforeDragRef.current = null;
    });

    // Обработчик кликов
    network.on('click', (params) => {
      if (params.nodes.length > 0) {
        dispatch(setSelectedNode(params.nodes[0]));
      } else if (params.edges.length > 0) {
        dispatch(setSelectedEdge(params.edges[0]));
      } else {
        dispatch(setSelectedNode(null));
        dispatch(setSelectedEdge(null));
      }
    });

    return () => {
      network.destroy();
      networkRef.current = null;
    };
  }, []);

  // Обновляем данные при изменении nodes/edges
  useEffect(() => {
    if (networkRef.current && nodes.length > 0 && !isUpdatingRef.current) {
      updateNetworkData();
    }
  }, [nodes, edges, updateNetworkData]);

  // Центрируем граф при первой загрузке
  useEffect(() => {
    if (networkRef.current && nodes.length > 0 && !isReady) {
      setTimeout(() => {
        if (networkRef.current) {
          networkRef.current.fit({
            animation: {
              duration: 500,
              easingFunction: 'easeInOutQuad'
            }
          });
          viewStateRef.current.scale = networkRef.current.getScale();
          viewStateRef.current.offset = networkRef.current.getViewPosition();
          setIsReady(true);
        }
      }, 200);
    }
  }, [nodes.length, isReady]);

  // Выделение узла/ребра из store
  useEffect(() => {
    if (!networkRef.current || isUpdatingRef.current) return;

    if (selectedNodeId) {
      networkRef.current.selectNodes([selectedNodeId]);
    } else if (selectedEdgeId) {
      networkRef.current.selectEdges([selectedEdgeId]);
    } else {
      networkRef.current.unselectAll();
    }
  }, [selectedNodeId, selectedEdgeId]);

  return (
    <div style={styles.container}>
      {isLoading && (
        <div style={styles.loadingOverlay}>
          <div style={styles.spinner}>
            <FontAwesomeIcon icon={faSpinner} spin size="2x" />
          </div>
          <div style={styles.loadingText}>Загрузка графа...</div>
        </div>
      )}
      <div ref={containerRef} style={styles.graph} />
      
      {isReady && (
        <div style={styles.navigationButtons}>
          <button 
            style={styles.navButton} 
            onClick={handleZoomIn}
            title="Приблизить"
            className="nav-button"
          >
            <FontAwesomeIcon icon={faPlus} />
          </button>
          <button 
            style={styles.navButton} 
            onClick={handleZoomOut}
            title="Отдалить"
            className="nav-button"
          >
            <FontAwesomeIcon icon={faMinus} />
          </button>
          <button 
            style={styles.navButton} 
            onClick={handleFit}
            title="По размеру экрана"
            className="nav-button"
          >
            <FontAwesomeIcon icon={faExpand} />
          </button>
        </div>
      )}
    </div>
  );
};

const styles = {
  container: {
    width: '100%',
    height: '100%',
    position: 'relative' as const,
    backgroundColor: 'var(--bg-primary)',
  },
  graph: {
    width: '100%',
    height: '100%',
    backgroundColor: 'var(--bg-primary)',
  },
  loadingOverlay: {
    position: 'absolute' as const,
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(11, 18, 32, 0.9)',
    backdropFilter: 'blur(8px)',
    display: 'flex',
    flexDirection: 'column' as const,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1000,
    gap: '16px',
  },
  spinner: {
    color: 'var(--accent-primary)',
  },
  loadingText: {
    color: 'var(--text-primary)',
    fontSize: '16px',
    fontWeight: 500,
  },
  navigationButtons: {
    position: 'absolute' as const,
    bottom: '24px',
    right: '24px',
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '8px',
    zIndex: 100,
  },
  navButton: {
    width: '40px',
    height: '40px',
    backgroundColor: 'rgba(11, 18, 32, 0.6)',
    border: '1px solid #4F46E5',
    borderRadius: '8px',
    color: '#4F46E5',
    fontSize: '16px',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
    backdropFilter: 'blur(5px)',
    WebkitBackdropFilter: 'blur(5px)',
    boxShadow: '0 0 10px rgba(79, 70, 229, 0.2)',
    outline: 'none',
    ':hover': {
      backgroundColor: '#4F46E5',
      color: 'white',
      boxShadow: '0 0 25px rgba(79, 70, 229, 0.6)',
      transform: 'scale(1.1)',
      borderColor: '#4F46E5',
    },
    ':active': {
      transform: 'scale(0.95)',
      boxShadow: '0 0 15px rgba(79, 70, 229, 0.4)',
    },
  },
} as const;

const style = document.createElement('style');
style.textContent = `
  @keyframes navButtonPulse {
    0% {
      box-shadow: 0 0 10px rgba(79, 70, 229, 0.2);
    }
    50% {
      box-shadow: 0 0 20px rgba(79, 70, 229, 0.4);
    }
    100% {
      box-shadow: 0 0 10px rgba(79, 70, 229, 0.2);
    }
  }

  .nav-button {
    animation: navButtonPulse 3s infinite ease-in-out;
  }

  .nav-button:hover {
    animation: none;
  }
`;
document.head.appendChild(style);
