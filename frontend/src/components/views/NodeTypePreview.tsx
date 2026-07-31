import React from 'react';
import type { DomainNodeType } from '../../types/api';
import { getNodeImage } from './graphViewUtils';

interface NodeTypePreviewProps { nodeType: DomainNodeType; }
const names = (nodeType: DomainNodeType) => nodeType.attributes.map((attribute) => attribute.label || attribute.key).filter(Boolean);

export function NodeTypePreview({ nodeType }: NodeTypePreviewProps): React.JSX.Element {
  const image = getNodeImage({ attributes: { visual: { icon: nodeType.icon } } });
  const attributes = names(nodeType);
  const color = nodeType.default_visual?.color || '#475569';
  return <section className="node-type-preview service-card">
    <header className="service-card-header"><div><h3>Предпросмотр типа объекта</h3><p className="service-card-hint">Так вершина будет выглядеть на графе по умолчанию.</p></div></header>
    <div className="node-type-preview-canvas"><div className="node-type-preview-node" style={{ '--node-preview-color': color } as React.CSSProperties}><div className={`node-type-preview-ring ${nodeType.default_visual?.ringEnabled ? 'enabled' : ''}`} style={{ borderWidth: `${nodeType.default_visual?.ringWidth || 1.5}px` }} /><div className="node-type-preview-core">{image ? <img src={image} alt="" /> : <span>{nodeType.icon?.slice(0, 2).toUpperCase() || '•'}</span>}</div></div><strong>{nodeType.label || 'Новый тип объекта'}</strong><code>{nodeType.id || 'node_type'}</code><div className="node-type-preview-attributes">{attributes.length ? <span>{attributes.join(' · ')}</span> : <em>Атрибуты ещё не заданы</em>}</div></div>
  </section>;
}