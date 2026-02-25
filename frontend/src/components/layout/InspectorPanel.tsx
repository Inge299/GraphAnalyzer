// src/components/layout/InspectorPanel.tsx
import React from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { 
  faChevronLeft, 
  faChevronRight,
  faUser,
  faPhone,
  faEnvelope,
  faMapMarkerAlt,
  faCircle
} from '@fortawesome/free-solid-svg-icons';
import { useAppDispatch, useAppSelector } from '../../store';
import { toggleInspector } from '../../store/slices/uiSlice';

const getNodeIcon = (type: string) => {
  const icons: Record<string, any> = {
    person: faUser,
    phone: faPhone,
    message: faEnvelope,
    location: faMapMarkerAlt,
    default: faCircle
  };
  return icons[type] || icons.default;
};

const getNodeColor = (type: string) => {
  const colors: Record<string, string> = {
    person: '#4F46E5',
    phone: '#10B981',
    message: '#F59E0B',
    location: '#EF4444',
    default: '#94A3B8'
  };
  return colors[type] || colors.default;
};

export const InspectorPanel: React.FC = () => {
  const dispatch = useAppDispatch();
  const expanded = useAppSelector((state) => state.ui.inspectorExpanded);
  const selectedNodeId = useAppSelector((state) => state.ui.selectedNodeId);
  const selectedEdgeId = useAppSelector((state) => state.ui.selectedEdgeId);
  const nodes = useAppSelector((state) => state.graph.nodes);
  const edges = useAppSelector((state) => state.graph.edges);

  console.log('Inspector state:', { selectedNodeId, selectedEdgeId, nodes, edges }); // Отладка

  const selectedObject = selectedNodeId
    ? nodes.find((n) => n.id === selectedNodeId)
    : selectedEdgeId
    ? edges.find((e) => e.id === selectedEdgeId)
    : null;

  if (!expanded) {
    return (
      <div style={styles.collapsed}>
        <button onClick={() => dispatch(toggleInspector())} style={styles.toggleButton}>
          <FontAwesomeIcon icon={faChevronLeft} />
        </button>
      </div>
    );
  }

  const renderNodeDetails = (node: any) => (
    <div>
      <div style={styles.objectHeader}>
        <div style={styles.objectTitle}>
          <FontAwesomeIcon 
            icon={getNodeIcon(node.type)} 
            style={{ ...styles.objectIcon, color: getNodeColor(node.type) }} 
          />
          <strong>{node.type === 'person' ? 'Узел' : 'Сущность'}</strong>
        </div>
        <span style={styles.objectId}>{node.id}</span>
      </div>

      <div style={styles.section}>
        <h4 style={styles.sectionTitle}>Тип</h4>
        <div style={styles.type}>
          <FontAwesomeIcon 
            icon={getNodeIcon(node.type)} 
            style={{ ...styles.typeIcon, color: getNodeColor(node.type) }} 
          />
          {node.type}
        </div>
      </div>

      <div style={styles.section}>
        <h4 style={styles.sectionTitle}>Атрибуты</h4>
        {node.attributes && Object.entries(node.attributes).map(([key, value]) => (
          <div key={key} style={styles.attribute}>
            <span style={styles.attributeKey}>{key}:</span>
            <span style={styles.attributeValue}>
              {typeof value === 'object' ? JSON.stringify(value) : String(value)}
            </span>
          </div>
        ))}
        {(!node.attributes || Object.keys(node.attributes).length === 0) && (
          <div style={styles.emptyState}>Нет атрибутов</div>
        )}
      </div>
    </div>
  );

  const renderEdgeDetails = (edge: any) => (
    <div>
      <div style={styles.objectHeader}>
        <div style={styles.objectTitle}>
          <FontAwesomeIcon icon={faCircle} style={styles.objectIcon} />
          <strong>Ребро</strong>
        </div>
        <span style={styles.objectId}>{edge.id}</span>
      </div>

      <div style={styles.section}>
        <h4 style={styles.sectionTitle}>Связь</h4>
        <div style={styles.edgeInfo}>
          <div style={styles.edgeNode}>{edge.from} → {edge.to}</div>
          <div style={styles.edgeType}>{edge.type}</div>
        </div>
      </div>

      <div style={styles.section}>
        <h4 style={styles.sectionTitle}>Атрибуты</h4>
        {edge.attributes && Object.entries(edge.attributes).map(([key, value]) => (
          <div key={key} style={styles.attribute}>
            <span style={styles.attributeKey}>{key}:</span>
            <span style={styles.attributeValue}>
              {typeof value === 'object' ? JSON.stringify(value) : String(value)}
            </span>
          </div>
        ))}
        {(!edge.attributes || Object.keys(edge.attributes).length === 0) && (
          <div style={styles.emptyState}>Нет атрибутов</div>
        )}
      </div>
    </div>
  );

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <h4 style={styles.title}>
          Свойства
          {selectedObject && (
            <span style={styles.titleBadge}>
              {selectedNodeId ? 'Узел' : 'Ребро'}
            </span>
          )}
        </h4>
        <button onClick={() => dispatch(toggleInspector())} style={styles.toggleButton}>
          <FontAwesomeIcon icon={faChevronRight} />
        </button>
      </div>

      <div style={styles.content}>
        {!selectedObject ? (
          <div style={styles.placeholder}>
            <FontAwesomeIcon icon={faCircle} style={styles.placeholderIcon} />
            <p>Выберите узел или ребро для просмотра свойств</p>
          </div>
        ) : (
          selectedNodeId ? renderNodeDetails(selectedObject) : renderEdgeDetails(selectedObject)
        )}
      </div>
    </div>
  );
};

const styles = {
  container: {
    width: '320px',
    height: '100%',
    backgroundColor: 'var(--bg-secondary)',
    borderLeft: '1px solid var(--border-light)',
    display: 'flex',
    flexDirection: 'column' as const,
    boxShadow: 'var(--shadow-md)',
    animation: 'slideIn var(--transition-base)',
  },
  collapsed: {
    width: '48px',
    height: '100%',
    backgroundColor: 'var(--bg-secondary)',
    borderLeft: '1px solid var(--border-light)',
    display: 'flex',
    justifyContent: 'center',
    paddingTop: '12px',
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '12px 16px',
    borderBottom: '1px solid var(--border-light)',
  },
  title: {
    margin: 0,
    fontSize: '14px',
    fontWeight: 600,
    color: 'var(--text-primary)',
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
  },
  titleBadge: {
    padding: '2px 8px',
    backgroundColor: 'var(--bg-tertiary)',
    borderRadius: '12px',
    fontSize: '11px',
    fontWeight: 500,
    color: 'var(--text-secondary)',
  },
  toggleButton: {
    padding: '8px',
    border: 'none',
    backgroundColor: 'var(--bg-tertiary)',
    color: 'var(--text-secondary)',
    borderRadius: '6px',
    cursor: 'pointer',
    fontSize: '14px',
    transition: 'all var(--transition-fast)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    ':hover': {
      color: 'var(--text-primary)',
      backgroundColor: 'var(--border-light)',
    },
  },
  content: {
    flex: 1,
    overflowY: 'auto' as const,
    padding: '16px',
  },
  placeholder: {
    color: 'var(--text-secondary)',
    textAlign: 'center' as const,
    padding: '32px 16px',
    display: 'flex',
    flexDirection: 'column' as const,
    alignItems: 'center',
    gap: '12px',
  },
  placeholderIcon: {
    fontSize: '32px',
    color: 'var(--border-light)',
  },
  objectHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '16px',
    padding: '8px 12px',
    backgroundColor: 'var(--bg-tertiary)',
    borderRadius: '8px',
  },
  objectTitle: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    color: 'var(--text-primary)',
  },
  objectIcon: {
    fontSize: '14px',
  },
  objectId: {
    fontSize: '11px',
    color: 'var(--text-disabled)',
    fontFamily: 'JetBrains Mono, monospace',
  },
  section: {
    marginBottom: '20px',
  },
  sectionTitle: {
    fontSize: '12px',
    fontWeight: 600,
    color: 'var(--text-secondary)',
    textTransform: 'uppercase' as const,
    letterSpacing: '0.05em',
    marginBottom: '8px',
  },
  type: {
    padding: '8px 12px',
    backgroundColor: 'var(--bg-tertiary)',
    border: '1px solid var(--border-light)',
    borderRadius: '6px',
    fontSize: '13px',
    color: 'var(--text-primary)',
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
  },
  typeIcon: {
    fontSize: '12px',
  },
  attribute: {
    display: 'flex',
    marginBottom: '4px',
    padding: '6px 8px',
    fontSize: '13px',
    backgroundColor: 'var(--bg-primary)',
    borderRadius: '4px',
    transition: 'all var(--transition-fast)',
    ':hover': {
      backgroundColor: 'var(--bg-tertiary)',
    },
  },
  attributeKey: {
    width: '100px',
    color: 'var(--text-secondary)',
    fontSize: '12px',
  },
  attributeValue: {
    flex: 1,
    color: 'var(--text-primary)',
    wordBreak: 'break-word' as const,
    fontFamily: 'JetBrains Mono, monospace',
    fontSize: '12px',
  },
  emptyState: {
    padding: '12px',
    textAlign: 'center' as const,
    color: 'var(--text-disabled)',
    fontSize: '12px',
    fontStyle: 'italic',
    backgroundColor: 'var(--bg-primary)',
    borderRadius: '6px',
    border: '1px dashed var(--border-light)',
  },
  edgeInfo: {
    padding: '8px 12px',
    backgroundColor: 'var(--bg-tertiary)',
    border: '1px solid var(--border-light)',
    borderRadius: '6px',
  },
  edgeNode: {
    color: 'var(--text-primary)',
    fontSize: '13px',
    marginBottom: '4px',
  },
  edgeType: {
    color: 'var(--accent-primary)',
    fontSize: '12px',
    fontWeight: 500,
  },
} as const;
