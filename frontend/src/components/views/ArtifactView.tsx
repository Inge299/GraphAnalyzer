// frontend/src/components/views/ArtifactView.tsx
import React, { Suspense, lazy, memo } from 'react';
import { Artifact } from '../../store/slices/artifactsSlice';

const GraphView = lazy(() => import('./GraphView'));
const TableView = lazy(() => import('./TableView'));
const MapView = lazy(() => import('./MapView'));
const ChartView = lazy(() => import('./ChartView'));
const DocumentView = lazy(() => import('./DocumentView'));

interface ArtifactViewProps {
  artifact: Artifact;
  onClose: () => void;
  onUpdate: (updates: Partial<Artifact>) => void;
  onNodeMove?: (nodeId: string, x: number, y: number) => void;
}

const LoadingFallback = () => (
  <div className="flex items-center justify-center h-full">
    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500" />
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
        return (
          <Suspense fallback={<LoadingFallback />}>
            <TableView artifact={artifact} onUpdate={onUpdate} />
          </Suspense>
        );
      case 'map':
        return (
          <Suspense fallback={<LoadingFallback />}>
            <MapView artifact={artifact} onUpdate={onUpdate} />
          </Suspense>
        );
      case 'chart':
        return (
          <Suspense fallback={<LoadingFallback />}>
            <ChartView artifact={artifact} onUpdate={onUpdate} />
          </Suspense>
        );
      case 'document':
        return (
          <Suspense fallback={<LoadingFallback />}>
            <DocumentView artifact={artifact} onUpdate={onUpdate} />
          </Suspense>
        );
      default:
        return <div>Unknown artifact type: {artifact.type}</div>;
    }
  };

  return (
    <div className="artifact-view">
      <div className="artifact-view-header">
        <div className="flex items-center space-x-4">
          <span className="text-lg font-medium text-white">{artifact.name}</span>
          <span className="text-sm text-gray-400">
            v{artifact.version} • {new Date(artifact.updated_at).toLocaleString()}
          </span>
          {artifact.source_artifact_id && (
            <span className="text-xs bg-blue-900 text-blue-200 px-2 py-1 rounded">
              Derived
            </span>
          )}
        </div>
        <button
          onClick={onClose}
          className="text-gray-400 hover:text-white transition-colors"
          title="Close"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>
      
      <div className="artifact-view-content">
        {renderView()}
      </div>
    </div>
  );
});

export default ArtifactView;