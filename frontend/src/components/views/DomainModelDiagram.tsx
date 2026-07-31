import React, { useMemo } from 'react';
import type { DomainEdgeType, DomainNodeType } from '../../types/api';
import { getNodeImage } from './graphViewUtils';

interface DomainModelDiagramProps {
  nodeTypes: DomainNodeType[];
  edgeTypes: DomainEdgeType[];
  selectedNodeTypeId: string;
  selectedEdgeTypeId: string;
  onSelectNodeType: (id: string) => void;
  onSelectEdgeType: (id: string) => void;
  previewEdge?: DomainEdgeType | null;
}

const width = 900;
const height = 290;

const attributeNames = (attributes: { key: string; label?: string }[]) => attributes.map((attribute) => attribute.label || attribute.key).filter(Boolean);

export function DomainModelDiagram({ nodeTypes, edgeTypes, selectedNodeTypeId, selectedEdgeTypeId, onSelectNodeType, previewEdge }: DomainModelDiagramProps): React.JSX.Element {
  const selectedEdge = edgeTypes.find((item) => item.id === selectedEdgeTypeId && !item.system);
  const selectedNode = nodeTypes.find((item) => item.id === selectedNodeTypeId);
  const edge = previewEdge && !previewEdge.system ? previewEdge : selectedEdge || edgeTypes.find((item) => !item.system);
  const fromType = edge?.from_type || edge?.allowed_from?.[0] || '';
  const toType = edge?.to_type || edge?.allowed_to?.[0] || '';
  const fromNode = nodeTypes.find((item) => item.id === fromType);
  const toNode = nodeTypes.find((item) => item.id === toType);
  const parallelCount = useMemo(() => edgeTypes.filter((item) => !item.system && item.from_type === fromType && item.to_type === toType).length, [edgeTypes, fromType, toType]);
  const left = { x: 225, y: 142 };
  const right = { x: width - 225, y: 142 };

  const renderNode = (node: DomainNodeType, role: string, point: { x: number; y: number }) => <g key={`${role}-${node.id}`} className={`domain-model-node ${node.id === selectedNodeTypeId ? 'is-selected' : ''}`} transform={`translate(${point.x} ${point.y})`} onClick={() => onSelectNodeType(node.id)}>
    <circle r="40" fill={node.default_visual?.color || '#475569'} /><circle r="34" fill="#ffffff" />
    {getNodeImage({ attributes: { visual: { icon: node.icon } } }) ? <image href={getNodeImage({ attributes: { visual: { icon: node.icon } } })} x="-18" y="-18" width="36" height="36" /> : <text y="4" textAnchor="middle" className="domain-model-node-icon">{node.icon?.slice(0, 2).toUpperCase() || '•'}</text>}
    <text y="-58" textAnchor="middle" className="domain-model-role">{role}</text>
    <text y="59" textAnchor="middle" className="domain-model-node-label">{node.label}</text>
    <text y="75" textAnchor="middle" className="domain-model-node-key">{node.id}</text>
  </g>;

  return <section className="domain-model-diagram">
    <header className="service-card-header"><div><h3>Схема выбранного типа связи</h3><p className="service-card-hint">Показана одна связь. Для одинаковых типов её роли А и Б остаются раздельными.</p></div><div className="domain-model-summary"><span>{nodeTypes.length} типов вершин</span><span>{edgeTypes.filter((item) => !item.system).length} типов связей</span></div></header>
    {!edge || !fromNode || !toNode ? <div className="service-empty">Выберите тип связи с двумя настроенными типами вершин.</div> : <>
      <div className="domain-model-canvas domain-model-focus-canvas"><svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label="Схема типа связи"><defs><marker id="domain-model-arrow" markerWidth="8" markerHeight="8" refX="7" refY="3.5" orient="auto-start-reverse"><path d="M0,0 L0,7 L7,3.5 z" fill={edge.default_visual?.color || '#64748b'} /></marker></defs>
        <line x1={left.x + 55} y1={left.y} x2={right.x - 55} y2={right.y} className="domain-model-edge is-selected" style={{ stroke: edge.default_visual?.color || '#2563eb' }} strokeDasharray={edge.default_visual?.dashed ? '8 6' : undefined} markerStart={edge.default_visual?.direction === 'both' ? 'url(#domain-model-arrow)' : undefined} markerEnd={(edge.directed || edge.default_visual?.direction === 'both') ? 'url(#domain-model-arrow)' : undefined} />
        <text x={width / 2} y={left.y - 52} textAnchor="middle" className="domain-model-edge-label">{edge.label}</text>
        <text x={width / 2} y={left.y - 30} textAnchor="middle" className="domain-model-edge-key">{edge.supports_reverse ? 'Доступна с обеих сторон' : edge.directed ? 'Направленная связь' : 'Двунаправленная связь'}{parallelCount > 1 ? ` · ещё типов для этой пары: ${parallelCount - 1}` : ''}</text>
        <text x={left.x} y="244" textAnchor="middle" className="domain-model-attribute-sample">{attributeNames(fromNode.attributes).slice(0, 3).join(' · ') || 'нет атрибутов'}</text>
        <text x={width / 2} y="198" textAnchor="middle" className="domain-model-attribute-sample">{attributeNames(edge.attributes).slice(0, 3).join(' · ') || 'нет атрибутов связи'}</text>
        <text x={right.x} y="244" textAnchor="middle" className="domain-model-attribute-sample">{attributeNames(toNode.attributes).slice(0, 3).join(' · ') || 'нет атрибутов'}</text>
        {renderNode(fromNode, 'Тип А', left)}
        {renderNode(toNode, 'Тип Б', right)}
      </svg></div>
      <div className="domain-model-details">
        <div><strong>Тип А: {fromNode.label}</strong><span>{attributeNames(fromNode.attributes).join(', ') || 'Без атрибутов'}</span></div>
        <div><strong>Связь: {edge.label}</strong><span>{attributeNames(edge.attributes).join(', ') || 'Без атрибутов'}</span></div>
        <div><strong>Тип Б: {toNode.label}</strong><span>{attributeNames(toNode.attributes).join(', ') || 'Без атрибутов'}</span></div>
      </div>
      {selectedNode && <div className="domain-model-selection">Выбрана вершина: <strong>{selectedNode.label}</strong></div>}
    </>}
  </section>;
}