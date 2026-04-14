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
      <div style={{
        position: 'absolute',
        top: 10,
        right: 10,
        zIndex: 10,
        display: 'flex',
        flexDirection: 'column',
        gap: '5px'
      }}>
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
            {`\u041a\u043b\u0438\u043a\u043d\u0438\u0442\u0435 \u043f\u043e \u0433\u0440\u0430\u0444\u0443 \u0434\u043b\u044f \u0434\u043e\u0431\u0430\u0432\u043b\u0435\u043d\u0438\u044f \u0443\u0437\u043b\u0430: ${nodeCreateSpec.label}`}
          </div>
        )}
        {connectType && (
          <div style={{ background: '#2563eb', color: 'white', padding: '4px 12px', borderRadius: '4px', fontSize: '12px' }}>
            {edgeSourceId
              ? '\u0412\u044b\u0431\u0435\u0440\u0438\u0442\u0435 \u043a\u043e\u043d\u0435\u0447\u043d\u044b\u0439 \u0443\u0437\u0435\u043b \u0434\u043b\u044f \u0441\u043e\u0437\u0434\u0430\u043d\u0438\u044f \u0441\u0432\u044f\u0437\u0438'
              : '\u0412\u044b\u0431\u0435\u0440\u0438\u0442\u0435 \u043d\u0430\u0447\u0430\u043b\u044c\u043d\u044b\u0439 \u0443\u0437\u0435\u043b \u0434\u043b\u044f \u0441\u043e\u0437\u0434\u0430\u043d\u0438\u044f \u0441\u0432\u044f\u0437\u0438'}
          </div>
        )}
      </div>

      {pluginExecutionMessage && (
        <div style={{
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
          boxShadow: '0 8px 18px rgba(15, 23, 42, 0.2)'
        }}>
          {pluginExecutionMessage}
        </div>
      )}
    </>
  );
};
