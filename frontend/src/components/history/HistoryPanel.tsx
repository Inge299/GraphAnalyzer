// frontend/src/components/history/HistoryPanel.tsx
import React, { useState } from 'react';
import { useAppDispatch, useAppSelector } from '../../store';
import { jumpTo, undo, redo, clearHistory } from '../../store/slices/historySlice';
import './HistoryPanel.css';

interface HistoryPanelProps {
  graphId: number;
  onJump: (state: any) => void;
}

export const HistoryPanel: React.FC<HistoryPanelProps> = ({ graphId, onJump }) => {
  const dispatch = useAppDispatch();
  const { actions, currentIndex } = useAppSelector(state => state.history);
  const [isOpen, setIsOpen] = useState(true);

  const handleUndo = () => {
    dispatch(undo());
    if (currentIndex > 0) {
      onJump(actions[currentIndex - 1].afterState);
    } else if (currentIndex === 0) {
      // Если отменяем первое действие, переходим к пустому состоянию
      onJump(null);
    }
  };

  const handleRedo = () => {
    dispatch(redo());
    if (currentIndex < actions.length - 1) {
      onJump(actions[currentIndex + 1].afterState);
    }
  };

  const handleJump = (index: number) => {
    dispatch(jumpTo(index));
    onJump(actions[index].afterState);
  };

  const handleClear = () => {
    dispatch(clearHistory());
  };

  const getIcon = (type: string) => {
    const icons: Record<string, string> = {
      'move_node': '↗️',
      'add_node': '➕',
      'delete_node': '➖',
      'add_edge': '🔗',
      'delete_edge': '✂️',
      'edit_attribute': '✏️',
      'batch_move': '🔄',
      'plugin_run': '🤖'
    };
    return icons[type] || '📌';
  };

  const formatTime = (timestamp: string) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    
    if (diffMins < 1) return 'только что';
    if (diffMins < 60) return `${diffMins} мин назад`;
    if (diffMins < 1440) return `${Math.floor(diffMins / 60)} ч назад`;
    return date.toLocaleDateString();
  };

  if (!isOpen) {
    return (
      <button className="history-toggle" onClick={() => setIsOpen(true)} title="История действий">
        📋 {actions.length}
      </button>
    );
  }

  return (
    <div className="history-panel">
      <div className="history-header">
        <h3>История действий</h3>
        <div className="history-controls">
          <button 
            onClick={handleUndo} 
            disabled={currentIndex < 0}
            title="Отменить (Ctrl+Z)"
          >
            ↩️
          </button>
          <button 
            onClick={handleRedo} 
            disabled={currentIndex >= actions.length - 1}
            title="Повторить (Ctrl+Y)"
          >
            ↪️
          </button>
          <button 
            onClick={handleClear} 
            disabled={actions.length === 0}
            title="Очистить историю"
          >
            🗑️
          </button>
          <button onClick={() => setIsOpen(false)} title="Свернуть">
            ▶
          </button>
        </div>
      </div>
      
      <div className="history-list">
        {actions.length === 0 ? (
          <div className="history-empty">
            Нет действий
          </div>
        ) : (
          [...actions].reverse().map((action, idx) => {
            const originalIndex = actions.length - 1 - idx;
            const isCurrent = originalIndex === currentIndex;
            
            return (
              <div
                key={action.id}
                className={`history-item ${isCurrent ? 'current' : ''}`}
                onClick={() => handleJump(originalIndex)}
                title={action.description}
              >
                <span className="history-icon">{getIcon(action.actionType)}</span>
                <span className="history-desc">{action.description}</span>
                <span className="history-time">
                  {formatTime(action.timestamp)}
                </span>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
