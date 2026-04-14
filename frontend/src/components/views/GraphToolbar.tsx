import React from 'react';

interface GraphToolbarProps {
  canUndo?: boolean;
  canRedo?: boolean;
  onUndo: () => void;
  onRedo: () => void;
  onAutoLayout: () => void;
  onBalancedLayout: () => void;
  onFit: () => void;
  onFitSelection: () => void;
  onInvertSelection: () => void;
  version: number | string;
}

export const GraphToolbar: React.FC<GraphToolbarProps> = ({
  canUndo,
  canRedo,
  onUndo,
  onRedo,
  onAutoLayout,
  onBalancedLayout,
  onFit,
  onFitSelection,
  onInvertSelection,
  version,
}) => {
  return (
    <div style={{
      position: 'absolute',
      top: 8,
      left: 8,
      zIndex: 10,
      display: 'flex',
      gap: '8px',
      background: 'rgba(255, 255, 255, 0.95)',
      border: '1px solid #d7deea',
      padding: '8px 12px',
      borderRadius: '6px',
      backdropFilter: 'blur(4px)'
    }}>
      <button
        onClick={onUndo}
        disabled={!canUndo}
        title="\u041e\u0442\u043c\u0435\u043d\u0438\u0442\u044c (Ctrl+Z)"
        style={{
          padding: '6px 12px',
          background: '#2563eb',
          border: '1px solid #2563eb',
          borderRadius: '4px',
          color: '#ffffff',
          cursor: canUndo ? 'pointer' : 'not-allowed',
          opacity: canUndo ? 1 : 0.5
        }}
      >
        {'\u21B6'}
      </button>
      <button
        onClick={onRedo}
        disabled={!canRedo}
        title="\u041f\u043e\u0432\u0442\u043e\u0440\u0438\u0442\u044c (Ctrl+Y)"
        style={{
          padding: '6px 12px',
          background: '#2563eb',
          border: '1px solid #2563eb',
          borderRadius: '4px',
          color: '#ffffff',
          cursor: canRedo ? 'pointer' : 'not-allowed',
          opacity: canRedo ? 1 : 0.5
        }}
      >
        {'\u21B7'}
      </button>
      <button
        onClick={onAutoLayout}
        title="\u0410\u0432\u0442\u043e\u0440\u0430\u0437\u043c\u0435\u0449\u0435\u043d\u0438\u0435"
        style={{
          padding: '6px 10px',
          background: '#2563eb',
          border: '1px solid #2563eb',
          borderRadius: '4px',
          color: '#ffffff',
          cursor: 'pointer'
        }}
      >
        {'\u2728'}
      </button>
      <button
        onClick={onBalancedLayout}
        title="\u041e\u043f\u0442\u0438\u043c\u0430\u043b\u044c\u043d\u0430\u044f \u0440\u0430\u0441\u043a\u043b\u0430\u0434\u043a\u0430"
        style={{
          padding: '6px 10px',
          background: '#2563eb',
          border: '1px solid #2563eb',
          borderRadius: '4px',
          color: '#ffffff',
          cursor: 'pointer'
        }}
      >
        {'\u2696'}
      </button>
      <button
        onClick={onFit}
        title="\u041f\u043e\u043a\u0430\u0437\u0430\u0442\u044c \u0432\u0435\u0441\u044c \u0433\u0440\u0430\u0444"
        style={{
          padding: '6px 10px',
          background: '#2563eb',
          border: '1px solid #2563eb',
          borderRadius: '4px',
          color: '#ffffff',
          cursor: 'pointer'
        }}
      >
        {'\u29c9'}
      </button>
      <button
        onClick={onFitSelection}
        title="\u041f\u043e\u0437\u0438\u0446\u0438\u043e\u043d\u0438\u0440\u043e\u0432\u0430\u0442\u044c \u044d\u043a\u0440\u0430\u043d \u043f\u043e \u0432\u044b\u0434\u0435\u043b\u0435\u043d\u043d\u044b\u043c \u044d\u043b\u0435\u043c\u0435\u043d\u0442\u0430\u043c"
        style={{
          padding: '6px 10px',
          background: '#2563eb',
          border: '1px solid #2563eb',
          borderRadius: '4px',
          color: '#ffffff',
          cursor: 'pointer'
        }}
      >
        {'\u2316'}
      </button>
      <button
        onClick={onInvertSelection}
        title="\u0418\u043d\u0432\u0435\u0440\u0442\u0438\u0440\u043e\u0432\u0430\u0442\u044c \u0432\u044b\u0434\u0435\u043b\u0435\u043d\u0438\u0435"
        style={{
          padding: '6px 10px',
          background: '#2563eb',
          border: '1px solid #2563eb',
          borderRadius: '4px',
          color: '#ffffff',
          cursor: 'pointer'
        }}
      >
        {'\u2194'}
      </button>
      <div style={{ fontSize: '12px', color: '#475569', marginLeft: '8px', padding: '6px 0' }}>
        v{version}
      </div>
    </div>
  );
};

