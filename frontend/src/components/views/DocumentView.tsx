// frontend/src/components/views/DocumentView.tsx
import React from 'react';
import { Artifact } from '../../store/slices/artifactsSlice';

interface DocumentViewProps {
  artifact: Artifact;
  onUpdate: (updates: Partial<Artifact>) => void;
}

const DocumentView: React.FC<DocumentViewProps> = ({ artifact, onUpdate }) => {
  console.log('[DocumentView] Rendering document:', artifact.id);

  return (
    <div className="h-full overflow-auto p-8">
      <div className="max-w-4xl mx-auto bg-gray-800 rounded-lg p-8">
        <h1 className="text-2xl font-bold text-white mb-4">{artifact.name}</h1>
        {artifact.description && (
          <p className="text-gray-400 mb-6">{artifact.description}</p>
        )}
        <div className="prose prose-invert max-w-none">
          {artifact.data.content ? (
            <div className="whitespace-pre-wrap text-gray-300">
              {artifact.data.content}
            </div>
          ) : (
            <p className="text-gray-500 italic">No content available</p>
          )}
        </div>
      </div>
    </div>
  );
};

export default DocumentView;