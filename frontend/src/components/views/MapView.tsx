// frontend/src/components/views/MapView.tsx
import React from 'react';
import { Artifact } from '../../store/slices/artifactsSlice';

interface MapViewProps {
  artifact: Artifact;
  onUpdate: (updates: Partial<Artifact>) => void;
}

const MapView: React.FC<MapViewProps> = ({ artifact, onUpdate }) => {
  console.log('[MapView] Rendering map:', artifact.id);

  return (
    <div className="h-full flex items-center justify-center bg-gray-900">
      <div className="text-center text-gray-400">
        <svg className="w-16 h-16 mx-auto mb-4 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
        </svg>
        <p className="text-lg">Map View</p>
        <p className="text-sm">Integration with mapping libraries coming soon</p>
        <p className="text-xs mt-4 text-gray-600">Points: {artifact.data.points?.length || 0}</p>
      </div>
    </div>
  );
};

export default MapView;