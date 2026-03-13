// frontend/src/components/history/HistoryPanel.tsx
import React, { useState, useEffect, useRef } from 'react';
import { useAppDispatch, useAppSelector } from '../../store';
import { jumpToAction, undo, redo, fetchHistory } from '../../store/slices/historySlice';
import { formatDistanceToNow } from 'date-fns';
import { ru } from 'date-fns/locale';
import './HistoryPanel.css';

interface HistoryPanelProps {
  graphId: number;
  onJump: (state: any) => void;
  className?: string;
}

export const HistoryPanel: React.FC<HistoryPanelProps> = ({ 
  graphId, 
  onJump,
  className = '' 
}) => {
  const dispatch = useAppDispatch();
  const { actions, currentIndex, isLoading } = useAppSelector(state => state.history);
  const [isExpanded, setIsExpanded] = useState(true);
  const [filter, setFilter] = useState<string>('');
  const listRef = useRef<HTMLDivElement>(null);

  // Загружаем историю при монтировании
  useEffect(() => {
    dispatch(fetchHistory(graphId));
  }, [graphId, dispatch]);

  // Скроллим к текущему элементу при изменении currentIndex
  useEffect(() => {
    if (listRef.current && currentIndex >= 0) {
      const items = listRef.current.children;
      if (items[currentIndex]) {
        items[currentIndex].scrollIntoView({
          behavior: 'smooth',
          block: 'nearest'
        });
      }
    }
  }, [currentIndex]);

  const handleUndo = () => {
    dispatch(undo());
    if (currentIndex > 0) {
      onJump(actions[currentIndex - 1].afterState);
    }
  };

  const handleRedo = () => {
    dispatch(redo());
    if (currentIndex < actions.length - 1) {
      onJump(actions[currentIndex + 1].afterState);
    }
  };

  const handleJump = (index: number) => {
    dispatch(jumpToAction(index));
    onJump(actions[index].afterState);
  };

  const getActionIcon = (type: string): string => {
    const icons: Record<string, string> = {
      'add_node': '➕',
      'delete_node': '➖',
      'move_node': '↗️',
      'batch_move': '🔄',
      'add_edge': '🔗',
      'delete_edge': '✂️',
      'edit_attribute': '✏️',
      'plugin_run': '🤖',
      'batch': '📦',
      'import': '📥',
      'export': '📤',
      'clear': '🧹'
    };
    return icons[type] || '📌';
  };

  const getActionColor = (type: string): string => {
    const colors: Record<string, string> = {
      'add_node': '#4caf50',
      'delete_node': '#f44336',
      'move_node': '#ff9800',
      'add_edge': '#2196f3',
      'delete_edge': '#f44336',
      'plugin_run': '#9c27b0'
    };
    return colors[type] || '#757575';
  };

  const filteredActions = filter
    ? actions.filter(a => 
        a.description.toLowerCase().includes(filter.toLowerCase()) ||
        a.actionType.toLowerCase().includes(filter.toLowerCase())
      )
    : actions;

  if (!isExpanded) {
    return (
      <button 
        className="history-toggle"
        onClick={() => setIsExpanded(true)}
        title="Открыть историю"
      >
        📋 <span className="history-count">{actions.length}</span>
      </button>
    );
  }

  return (
    <div className={`history-panel ${className}`}>
      {/* Заголовок */}
      <div className="history-header">
        <h3>
          История действий
          {actions.length > 0 && (
            <span className="history-position">
              {currentIndex + 1} / {actions.length}
            </span>
          )}
        </h3>
        <div className="history-controls">
          <button 
            onClick={handleUndo} 
            disabled={currentIndex < 0 || isLoading}
            title="Отменить (Ctrl+Z)"
            className="history-btn"
          >
            ↩️
          </button>
          <button 
            onClick={handleRedo} 
            disabled={currentIndex >= actions.length - 1 || isLoading}
            title="Повторить (Ctrl+Y / Ctrl+Shift+Z)"
            className="history-btn"
          >
            ↪️
          </button>
          <button 
            onClick={() => setIsExpanded(false)}
            title="Свернуть"
            className="history-btn"
          >
            ▼
          </button>
        </div>
      </div>

      {/* Поиск */}
      {actions.length > 5 && (
        <div className="history-search">
          <input
            type="text"
            placeholder="🔍 Поиск в истории..."
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            className="history-search-input"
          />
        </div>
      )}

      {/* Список действий */}
      <div className="history-list" ref={listRef}>
        {isLoading && actions.length === 0 ? (
          <div className="history-loading">Загрузка истории...</div>
        ) : filteredActions.length === 0 ? (
          <div className="history-empty">
            {filter ? 'Ничего не найдено' : 'История пуста'}
          </div>
        ) : (
          [...filteredActions].reverse().map((action, idx) => {
            const originalIndex = actions.length - 1 - idx;
            const isCurrent = originalIndex === currentIndex;
            const icon = getActionIcon(action.actionType);
            const color = getActionColor(action.actionType);

            return (
              <div
                key={action.id}
                className={`history-item ${isCurrent ? 'current' : ''}`}
                onClick={() => handleJump(originalIndex)}
                style={{ borderLeftColor: color }}
              >
                <span className="history-icon" style={{ color }}>
                  {icon}
                </span>
                
                <div className="history-content">
                  <div className="history-description">
                    {action.description}
                  </div>
                  <div className="history-meta">
                    <span className="history-time">
                      {formatDistanceToNow(new Date(action.timestamp), { 
                        addSuffix: true,
                        locale: ru 
                      })}
                    </span>
                    {action.userType === 'plugin' && (
                      <span className="history-plugin" title={`Плагин: ${action.pluginId}`}>
                        🤖
                      </span>
                    )}
                    {action.groupId && (
                      <span className="history-group" title="Групповое действие">
                        📦
                      </span>
                    )}
                  </div>
                </div>

                {isCurrent && (
                  <span className="history-current-badge">←</span>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* Футер со статистикой */}
      {actions.length > 0 && (
        <div className="history-footer">
          <span>Всего действий: {actions.length}</span>
          {currentIndex >= 0 && (
            <span>
              Текущая позиция: {currentIndex + 1}
            </span>
          )}
        </div>
      )}
    </div>
  );
};
