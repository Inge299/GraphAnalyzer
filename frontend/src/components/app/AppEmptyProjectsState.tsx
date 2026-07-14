import React from 'react';

type AppEmptyProjectsStateProps = {
  labels: Record<string, string>;
  newProjectName: string;
  setNewProjectName: (value: string) => void;
  creatingProject: boolean;
  createProjectError: string | null;
  onCreateProject: () => void;
};

export const AppEmptyProjectsState: React.FC<AppEmptyProjectsStateProps> = ({
  labels,
  newProjectName,
  setNewProjectName,
  creatingProject,
  createProjectError,
  onCreateProject,
}) => {
  return (
    <div className="loading-screen" style={{ display: 'flex', flexDirection: 'column', gap: '12px', alignItems: 'center' }}>
      <div style={{ fontSize: '18px', color: '#ffffff' }}>{labels.noProjectsTitle}</div>
      <div style={{ color: '#9ca3af', fontSize: '13px' }}>{labels.noProjectsHint}</div>
      <div style={{ display: 'flex', gap: '8px', marginTop: '8px' }}>
        <input
          type="text"
          value={newProjectName}
          onChange={(e) => setNewProjectName(e.target.value)}
          placeholder={labels.projectNamePlaceholder}
          style={{
            padding: '8px 10px',
            borderRadius: '6px',
            border: '1px solid #374151',
            background: '#111827',
            color: '#e5e7eb',
            minWidth: '260px'
          }}
        />
        <button
          onClick={onCreateProject}
          disabled={creatingProject}
          style={{
            padding: '8px 12px',
            borderRadius: '6px',
            border: '1px solid #2563eb',
            background: '#2563eb',
            color: '#ffffff',
            cursor: 'pointer'
          }}
        >
          {creatingProject ? labels.creating : labels.create}
        </button>
      </div>
      {createProjectError && (
        <div style={{ color: '#f87171', fontSize: '12px' }}>{createProjectError}</div>
      )}
    </div>
  );
};

export default AppEmptyProjectsState;
