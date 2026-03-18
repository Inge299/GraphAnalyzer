// frontend/src/components/views/TableView.tsx
import React from 'react';
import type { ApiArtifact } from '../../types/api';

interface TableViewProps {
  artifact: ApiArtifact;
  _onUpdate: (updates: Partial<ApiArtifact>) => void;
}

const TableView: React.FC<TableViewProps> = ({ artifact, _onUpdate }) => {
  console.log('[TableView] Rendering table:', artifact.id);
  // onUpdate пока не используется, будет в Phase 2.5
  _onUpdate && _onUpdate({});
  return (
    <div className="h-full overflow-auto p-8">
      <div className="max-w-4xl mx-auto bg-gray-800 rounded-lg p-8">
        <h1 className="text-2xl font-bold text-white mb-4">{artifact.name}</h1>
        {artifact.description && (
          <p className="text-gray-400 mb-6">{artifact.description}</p>
        )}
        <div className="text-center text-gray-500 italic">
          Table visualization coming in Phase 2.5
        </div>
      </div>
    </div>
  );
};

export default TableView;