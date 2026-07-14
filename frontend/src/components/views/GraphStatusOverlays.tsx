import React from 'react';

interface GraphStatusOverlaysProps {
  isRecording?: boolean;
  lastError?: Error | null;
  pendingMoveCount: number;
  nodeCreateSpec?: { typeId: string; label: string } | null;
  connectType?: string | null;
  edgeSourceId?: string | null;
  pluginExecutionMessage: string | null;
  toolbarHeight: number;
}

export const GraphStatusOverlays: React.FC<GraphStatusOverlaysProps> = ({
  isRecording,
  lastError,
  pendingMoveCount,
  nodeCreateSpec,
  connectType,
  edgeSourceId,
  pluginExecutionMessage,
  toolbarHeight,
}) => {
  return (
    <>
      <div
        style={{
          position: 'absolute',
          top: 10,
          left: 10,
          zIndex: 10,
          display: 'flex',
          flexDirection: 'column',
          gap: '5px',
        }}
      >
        {isRecording && (
          <div style={{ background: '#f59e0b', color: 'white', padding: '4px 12px', borderRadius: '4px', fontSize: '12px' }}>
            Recording...
          </div>
        )}
        {lastError && (
          <div style={{ background: '#ef4444', color: 'white', padding: '4px 12px', borderRadius: '4px', fontSize: '12px' }}>
            Error: {lastError.message}
          </div>
        )}
        {pendingMoveCount > 0 && (
          <div style={{ background: '#3b82f6', color: 'white', padding: '4px 12px', borderRadius: '4px', fontSize: '12px' }}>
            Grouping {pendingMoveCount} nodes...
          </div>
        )}
        {nodeCreateSpec && (
          <div style={{ background: '#16a34a', color: 'white', padding: '4px 12px', borderRadius: '4px', fontSize: '12px' }}>
            {`Кликните по графу для добавления узла: ${nodeCreateSpec.label}`}
          </div>
        )}
        {connectType && (
          <div style={{ background: '#2563eb', color: 'white', padding: '4px 12px', borderRadius: '4px', fontSize: '12px' }}>
            {edgeSourceId
              ? 'Выберите конечный узел для создания связи'
              : 'Выберите начальный узел для создания связи'}
          </div>
        )}
      </div>

      {pluginExecutionMessage && (
        <div
          style={{
            position: 'absolute',
            top: toolbarHeight + 10,
            left: '50%',
            transform: 'translateX(-50%)',
            zIndex: 1100,
            background: 'rgba(37, 99, 235, 0.95)',
            color: '#ffffff',
            border: '1px solid #1d4ed8',
            borderRadius: 8,
            padding: '8px 12px',
            fontSize: 12,
            boxShadow: '0 8px 18px rgba(15, 23, 42, 0.2)',
          }}
        >
          {pluginExecutionMessage}
        </div>
      )}
    </>
  );
};
