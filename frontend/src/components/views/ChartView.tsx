// frontend/src/components/views/ChartView.tsx
import React from 'react';
import { Artifact } from '../../store/slices/artifactsSlice';

interface ChartViewProps {
  artifact: Artifact;
  onUpdate: (updates: Partial<Artifact>) => void;
}

const ChartView: React.FC<ChartViewProps> = ({ artifact, onUpdate }) => {
  console.log('[ChartView] Rendering chart:', artifact.id);

  return (
    <div className="h-full flex items-center justify-center bg-gray-900">
      <div className="text-center text-gray-400">
        <svg className="w-16 h-16 mx-auto mb-4 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
        </svg>
        <p className="text-lg">Chart View</p>
        <p className="text-sm">Integration with charting libraries coming soon</p>
        <p className="text-xs mt-4 text-gray-600">Series: {artifact.data.series?.length || 0}</p>
      </div>
    </div>
  );
};

export default ChartView;