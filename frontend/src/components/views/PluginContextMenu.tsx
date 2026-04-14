import React from 'react';
import type { ApiPlugin, PluginExecutionContext } from '../../types/api';
import type { PluginContextMenuState, PluginMenuEntry, PluginMenuNode } from './graphPluginMenu';
interface PluginContextMenuProps {
  pluginMenu: PluginContextMenuState | null;
  pluginMenuRef: React.MutableRefObject<HTMLDivElement | null>;
  pluginMenuLeft: number;
  pluginMenuTop: number;
  pluginMenuTree: PluginMenuNode[];
  pluginExecutionMessage: string | null;
  getPluginMenuEntries: (node: PluginMenuNode | null) => PluginMenuEntry[];
  onRunPlugin: (plugin: ApiPlugin, context: PluginExecutionContext) => void;
  onSelectLinks: () => void;
  onSelectEndpoints: () => void;
  onClose: () => void;
}

export const PluginContextMenu: React.FC<PluginContextMenuProps> = ({
  pluginMenu,
  pluginMenuRef,
  pluginMenuLeft,
  pluginMenuTop,
  pluginMenuTree,
  pluginExecutionMessage,
  getPluginMenuEntries,
  onRunPlugin,
  onSelectLinks,
  onSelectEndpoints,
  onClose,
}) => {
  if (!pluginMenu) return null;

  const hasSelectedNodes = !!pluginMenu.context.selected_nodes && pluginMenu.context.selected_nodes.length > 0;

  const renderPluginMenuRows = (entries: PluginMenuEntry[], depth = 0): React.ReactNode => (
    <>
      {entries.map((entry) => {
        const rowBaseStyle: React.CSSProperties = {
          width: '100%',
          textAlign: 'left',
          border: 'none',
          background: 'transparent',
          color: '#0f172a',
          borderRadius: 4,
          padding: '4px 8px',
          cursor: 'pointer',
          fontSize: 12,
          lineHeight: '16px',
          display: 'block',
          whiteSpace: 'nowrap',
          paddingLeft: `${8 + depth * 14}px`,
        };

        if (entry.kind === 'plugin' && entry.plugin) {
          return (
            <button
              key={entry.key}
              type='button'
              onClick={() => onRunPlugin(entry.plugin!, pluginMenu.context || {})}
              style={rowBaseStyle}
            >
              {entry.label}
            </button>
          );
        }

        const folderNode = entry.node;
        if (!folderNode) return null;

        return (
          <React.Fragment key={entry.key}>
            <div
              style={{
                ...rowBaseStyle,
                cursor: 'default',
                color: '#475569',
                fontWeight: 600,
              }}
            >
              {entry.label}
            </div>
            {renderPluginMenuRows(getPluginMenuEntries(folderNode), depth + 1)}
          </React.Fragment>
        );
      })}
    </>
  );

  return (
    <div
      ref={pluginMenuRef}
      style={{
        position: 'absolute',
        left: pluginMenuLeft,
        top: pluginMenuTop,
        zIndex: 30,
        minWidth: 260,
        maxWidth: 360,
        maxHeight: 440,
        overflow: 'auto',
        border: '1px solid #d7deea',
        borderRadius: 6,
        background: '#ffffff',
        boxShadow: '0 8px 24px rgba(15, 23, 42, 0.18)',
        padding: 6,
      }}
      onClick={(event) => event.stopPropagation()}
      onContextMenu={(event) => event.preventDefault()}
    >
      <button
        type='button'
        onClick={() => {
          onSelectLinks();
          onClose();
        }}
        disabled={!hasSelectedNodes}
        style={{
          width: '100%',
          textAlign: 'left',
          border: 'none',
          background: 'transparent',
          color: '#0f172a',
          borderRadius: 4,
          padding: '5px 8px',
          cursor: hasSelectedNodes ? 'pointer' : 'not-allowed',
          opacity: hasSelectedNodes ? 1 : 0.5,
          fontSize: 12,
          lineHeight: '16px',
        }}
      >
        {'Выделить связи'}
      </button>

      <button
        type='button'
        onClick={() => {
          onSelectEndpoints();
          onClose();
        }}
        disabled={!hasSelectedNodes}
        style={{
          width: '100%',
          textAlign: 'left',
          border: 'none',
          background: 'transparent',
          color: '#0f172a',
          borderRadius: 4,
          padding: '5px 8px',
          cursor: hasSelectedNodes ? 'pointer' : 'not-allowed',
          opacity: hasSelectedNodes ? 1 : 0.5,
          fontSize: 12,
          lineHeight: '16px',
        }}
      >
        {'Выделить окончания'}
      </button>

      <div style={{ height: 1, background: '#eef2f7', margin: '4px 0 6px 0' }} />

      {pluginMenu.loading && (
        <div style={{ fontSize: 12, color: '#334155', padding: '6px 8px' }}>{'Загрузка...'}</div>
      )}
      {!pluginMenu.loading && pluginMenuTree.length === 0 && (
        <div style={{ fontSize: 12, color: '#64748b', padding: '6px 8px' }}>{'Нет доступных плагинов'}</div>
      )}
      {!pluginMenu.loading && pluginExecutionMessage && (
        <div style={{ fontSize: 12, color: '#2563eb', padding: '6px 8px' }}>
          Идет выполнение плагина. Запуск новых плагинов временно заблокирован.
        </div>
      )}
      {!pluginMenu.loading && renderPluginMenuRows(getPluginMenuEntries(null))}
    </div>
  );
};


