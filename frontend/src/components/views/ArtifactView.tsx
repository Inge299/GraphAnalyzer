// frontend/src/components/views/ArtifactView.tsx
import React, { Suspense, lazy, memo } from 'react';
import { Artifact } from '../../store/slices/artifactsSlice';

const GraphView = lazy(() => import('./GraphView'));

interface ArtifactViewProps {
  artifact: Artifact;
  onClose: () => void;
  onUpdate: (updates: Partial<Artifact>) => void;
  onNodeMove?: (nodeId: string, x: number, y: number) => void;
}

const LoadingFallback = () => (
  <div className="flex items-center justify-center h-full">
    <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-500" />
  </div>
);

const PlaceholderView = ({ icon, text }: { icon: string; text: string }) => (
  <div className="flex items-center justify-center h-full text-gray-400">
    <div className="text-center">
      <div className="text-3xl mb-3">{icon}</div>
      <div className="text-sm opacity-75">{text}</div>
    </div>
  </div>
);

const ArtifactView: React.FC<ArtifactViewProps> = memo(({
  artifact,
  onClose,
  onUpdate,
  onNodeMove,
}) => {
  console.log('[ArtifactView] Rendering', artifact.type, 'artifact:', artifact.id);

  const renderView = () => {
    switch (artifact.type) {
      case 'graph':
        return (
          <Suspense fallback={<LoadingFallback />}>
            <GraphView
              artifact={artifact}
              onNodeMove={onNodeMove}
            />
          </Suspense>
        );
      case 'table':
        return <PlaceholderView icon="📋" text="Таблицы будут в Этапе 2.5" />;
      case 'map':
        return <PlaceholderView icon="🗺️" text="Карты будут в Этапе 2.5" />;
      case 'chart':
        return <PlaceholderView icon="📈" text="Диаграммы будут в Этапе 2.5" />;
      case 'document':
        return <PlaceholderView icon="📄" text="Документы будут в Этапе 2.5" />;
      default:
        return <PlaceholderView icon="❓" text="Неизвестный тип артефакта" />;
    }
  };

  return (
    <div className="artifact-view" style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      {/* Компактный заголовок */}
      <div style={{
        padding: '8px 12px',
        borderBottom: '1px solid #374151',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        backgroundColor: '#1f2937',
        flexShrink: 0
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ fontSize: '16px' }}>
            {artifact.type === 'graph' && '📊'}
            {artifact.type === 'table' && '📋'}
            {artifact.type === 'map' && '🗺️'}
            {artifact.type === 'chart' && '📈'}
            {artifact.type === 'document' && '📄'}
          </span>
          <span style={{ color: '#ffffff', fontSize: '13px', fontWeight: 500 }}>
            {artifact.name}
          </span>
          <span style={{ color: '#6b7280', fontSize: '11px' }}>
            v{artifact.version}
          </span>
        </div>
        <button
          onClick={onClose}
          style={{
            background: 'none',
            border: 'none',
            color: '#9ca3af',
            cursor: 'pointer',
            fontSize: '16px',
            padding: '4px'
          }}
          title="Закрыть"
        >
          ✕
        </button>
      </div>
      
      <div style={{ flex: 1, overflow: 'hidden' }}>
        {renderView()}
      </div>
    </div>
  );
});

export default ArtifactView;