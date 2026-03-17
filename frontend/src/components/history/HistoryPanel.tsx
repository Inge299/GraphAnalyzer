// frontend/src/components/history/HistoryPanel.tsx
import React, { useState, useMemo } from 'react';
import { useAppDispatch, useAppSelector } from '../../store';
import { undo, redo, jumpTo } from '../../store/slices/historySlice';
import { formatDistanceToNow } from 'date-fns';
import { ru } from 'date-fns/locale';
import './HistoryPanel.css';

interface HistoryPanelProps {
  artifactId: number;
  onJump: (state: any) => void;
  onUndo?: () => void;
  onRedo?: () => void;
}

export const HistoryPanel: React.FC<HistoryPanelProps> = ({ 
  artifactId, 
  onJump,
  onUndo,
  onRedo
}) => {
  const dispatch = useAppDispatch();
  const { actions, currentActionId, isLoading } = useAppSelector(state => state.history);
  const [isOpen, setIsOpen] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  const getActionIcon = (type: string) => {
    const icons: Record<string, string> = {
      'add_node': '➕',
      'delete_node': '➖',
      'move_node': '↗️',
      'batch_move': '📦',
      'add_edge': '🔗',
      'delete_edge': '✂️',
      'edit_attribute': '✏️',
      'plugin_run': '🤖'
    };
    return icons[type] || '📌';
  };

  const handleUndo = async () => {
    if (onUndo) {
      onUndo();
    } else {
      const result = await dispatch(undo(artifactId)).unwrap();
      if (result?.state) {
        onJump(result.state);
      }
    }
  };

  const handleRedo = async () => {
    if (onRedo) {
      onRedo();
    } else {
      const result = await dispatch(redo(artifactId)).unwrap();
      if (result?.state) {
        onJump(result.state);
      }
    }
  };

  const handleJump = (action: HistoryAction) => {
    onJump(action.afterState);
  };

  // Фильтрация по поиску
  const filteredActions = useMemo(() => {
    if (!searchQuery.trim()) return actions;
    
    const query = searchQuery.toLowerCase();
    return actions.filter(action => 
      action.description.toLowerCase().includes(query) ||
      action.actionType.toLowerCase().includes(query)
    );
  }, [actions, searchQuery]);

  // Текущий индекс для подсветки
  const currentIndex = useMemo(() => {
    return actions.findIndex(a => a.id === currentActionId);
  }, [actions, currentActionId]);

  if (!isOpen) {
    return (
      <button 
        className="history-toggle" 
        onClick={() => setIsOpen(true)}
        title={`История (${actions.length} действий)`}
      >
        📋 {actions.length > 0 && <span className="history-count">{actions.length}</span>}
      </button>
    );
  }

  return (
    <div className="history-panel">
      <div className="history-header">
        <h3>
          История действий
          {isLoading && <span className="history-loading"> ⟳</span>}
        </h3>
        <div className="history-controls">
          <button 
            onClick={handleUndo} 
            disabled={currentIndex < 0 || isLoading}
            title="Отменить (Ctrl+Z)"
          >
            ↩️
          </button>
          <button 
            onClick={handleRedo} 
            disabled={currentIndex >= actions.length - 1 || isLoading}
            title="Повторить (Ctrl+Y)"
          >
            ↪️
          </button>
          <button onClick={() => setIsOpen(false)} title="Свернуть">
            ✕
          </button>
        </div>
      </div>
      
      {actions.length > 0 && (
        <div className="history-search">
          <input
            type="text"
            placeholder="🔍 Поиск в истории..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
      )}
      
      <div className="history-list">
        {filteredActions.length === 0 ? (
          <div className="history-empty">
            {searchQuery ? 'Ничего не найдено' : 'Нет действий'}
          </div>
        ) : (
          [...filteredActions].reverse().map((action, idx) => {
            const originalIndex = actions.length - 1 - idx;
            const isCurrent = originalIndex === currentIndex;
            
            return (
              <div
                key={action.id}
                className={`history-item ${isCurrent ? 'current' : ''}`}
                onClick={() => handleJump(action)}
                title={action.description}
              >
                <span className="history-icon">{getActionIcon(action.actionType)}</span>
                <div className="history-content">
                  <span className="history-desc">{action.description}</span>
                  <span className="history-time">
                    {formatDistanceToNow(new Date(action.timestamp), { 
                      addSuffix: true,
                      locale: ru 
                    })}
                  </span>
                </div>
                {action.userType === 'plugin' && (
                  <span className="history-plugin">🤖</span>
                )}
              </div>
            );
          })
        )}
      </div>
      
      {actions.length > 0 && (
        <div className="history-footer">
          Всего: {actions.length} действий
        </div>
      )}
    </div>
  );
};
