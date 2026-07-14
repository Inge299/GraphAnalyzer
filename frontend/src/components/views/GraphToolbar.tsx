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

const baseButtonStyle: React.CSSProperties = {
  width: 28,
  height: 28,
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  background: '#2563eb',
  border: '1px solid #2563eb',
  borderRadius: 6,
  color: '#ffffff',
  cursor: 'pointer',
  fontSize: 14,
  lineHeight: 1,
  padding: 0,
};

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
    <div
      style={{
        position: 'absolute',
        top: 8,
        right: 10,
        zIndex: 20,
        display: 'flex',
        alignItems: 'center',
        gap: 6,
        background: 'rgba(255, 255, 255, 0.94)',
        border: '1px solid #d7deea',
        padding: '5px 8px',
        borderRadius: 8,
        backdropFilter: 'blur(4px)',
        boxShadow: '0 4px 12px rgba(15, 23, 42, 0.12)',
      }}
    >
      <button
        onClick={onUndo}
        disabled={!canUndo}
        title="Отменить (Ctrl+Z)"
        style={{
          ...baseButtonStyle,
          cursor: canUndo ? 'pointer' : 'not-allowed',
          opacity: canUndo ? 1 : 0.45,
        }}
      >
        {'↶'}
      </button>
      <button
        onClick={onRedo}
        disabled={!canRedo}
        title="Повторить (Ctrl+Y)"
        style={{
          ...baseButtonStyle,
          cursor: canRedo ? 'pointer' : 'not-allowed',
          opacity: canRedo ? 1 : 0.45,
        }}
      >
        {'↷'}
      </button>
      <button onClick={onAutoLayout} title="Авторазмещение" style={baseButtonStyle}>
        {'✨'}
      </button>
      <button onClick={onBalancedLayout} title="Оптимальная раскладка" style={baseButtonStyle}>
        {'⚖'}
      </button>
      <button onClick={onFit} title="Показать весь граф" style={baseButtonStyle}>
        {'⧉'}
      </button>
      <button onClick={onFitSelection} title="Позиционировать по выделению" style={baseButtonStyle}>
        {'⌖'}
      </button>
      <button onClick={onInvertSelection} title="Инвертировать выделение" style={baseButtonStyle}>
        {'↔'}
      </button>
      <div style={{ fontSize: 11, color: '#475569', marginLeft: 4, minWidth: 28, textAlign: 'right' }}>
        v{version}
      </div>
    </div>
  );
};
