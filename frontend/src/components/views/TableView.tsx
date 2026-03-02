// frontend/src/components/views/TableView.tsx
import React from 'react';
import { Artifact } from '../../store/slices/artifactsSlice';

interface TableViewProps {
  artifact: Artifact;
  onUpdate: (updates: Partial<Artifact>) => void;
}

const TableView: React.FC<TableViewProps> = ({ artifact, onUpdate }) => {
  const columns = artifact.data.columns || [];
  const rows = artifact.data.rows || [];

  console.log('[TableView] Rendering table:', artifact.id);

  return (
    <div className="h-full overflow-auto p-4">
      <div className="bg-gray-800 rounded-lg overflow-hidden">
        <table className="w-full text-sm text-left text-gray-300">
          <thead className="text-xs uppercase bg-gray-700 text-gray-400">
            <tr>
              {columns.map((col: any) => (
                <th key={col.key} className="px-6 py-3">
                  {col.label || col.key}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row: any, idx: number) => (
              <tr key={idx} className="border-b border-gray-700 hover:bg-gray-600">
                {columns.map((col: any) => (
                  <td key={col.key} className="px-6 py-4">
                    {row[col.key]?.toString() || '-'}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
        {rows.length === 0 && (
          <div className="text-center py-8 text-gray-500">
            No data available
          </div>
        )}
      </div>
    </div>
  );
};

export default TableView;