import React from 'react';

export const GraphEmptyState: React.FC = () => {
  return (
    <div style={{
      position: 'absolute',
      top: '50%',
      left: '50%',
      transform: 'translate(-50%, -50%)',
      textAlign: 'center',
      color: '#64748b',
      pointerEvents: 'none',
      zIndex: 2,
    }}>
      <h3 style={{ margin: '0 0 8px 0' }}>{'\u041f\u0443\u0441\u0442\u043e\u0439 \u0433\u0440\u0430\u0444'}</h3>
      <p style={{ margin: 0 }}>{'\u041a\u043b\u0438\u043a\u043d\u0438\u0442\u0435 \u043f\u043e \u043f\u043e\u043b\u044e, \u0447\u0442\u043e\u0431\u044b \u0441\u043e\u0437\u0434\u0430\u0442\u044c \u043f\u0435\u0440\u0432\u0443\u044e \u0432\u0435\u0440\u0448\u0438\u043d\u0443'}</p>
    </div>
  );
};
