import React, { useEffect, useMemo, useState } from 'react';
import type { ApiPlugin, ConsoleProfile, PluginExecutionContext } from '../../types/api';
import type { PluginContextMenuState, PluginMenuEntry, PluginMenuNode } from './graphPluginMenu';

interface PluginContextMenuProps {
  pluginMenu: PluginContextMenuState | null;
  pluginMenuRef: React.MutableRefObject<HTMLDivElement | null>;
  pluginMenuLeft: number;
  pluginMenuTop: number;
  pluginMenuTree: PluginMenuNode[];
  analysisProfiles: ConsoleProfile[];
  pluginExecutionMessage: string | null;
  getPluginMenuEntries: (node: PluginMenuNode | null) => PluginMenuEntry[];
  onRunPlugin: (plugin: ApiPlugin, context: PluginExecutionContext) => void;
  onRunAnalysis: (profile: ConsoleProfile, context: PluginExecutionContext) => void;
  onSelectLinks: () => void;
  onSelectConnected: () => void;
  onClose: () => void;
}

type MenuLeaf =
  | { key: string; label: string; kind: 'plugin'; plugin: ApiPlugin }
  | { key: string; label: string; kind: 'analysis'; profile: ConsoleProfile };

interface MenuSubsection {
  key: string;
  label: string;
  leaves: MenuLeaf[];
}

interface MenuSection {
  key: string;
  label: string;
  directLeaves: MenuLeaf[];
  subsections: MenuSubsection[];
}

const menuButtonStyle: React.CSSProperties = {
  width: '100%',
  minWidth: 0,
  textAlign: 'left',
  border: 'none',
  background: 'transparent',
  color: '#0f172a',
  borderRadius: 6,
  padding: '6px 8px',
  fontSize: 12,
  lineHeight: '16px',
  cursor: 'pointer',
};

const normalizeAnalysisPath = (profile: ConsoleProfile): string[] => {
  const segments = String(profile.menu_path || 'Анализ')
    .split('/')
    .map((segment) => segment.trim())
    .filter(Boolean);
  if (segments.length === 0) return ['Анализ'];
  if (segments[0].toLowerCase() === 'console') segments[0] = 'Анализ';
  return segments;
};

const appendSection = (
  sections: Map<string, MenuSection>,
  topLabel: string,
  directLeaves: MenuLeaf[],
  subsections: MenuSubsection[],
) => {
  const key = topLabel.toLocaleLowerCase('ru');
  const existing = sections.get(key);
  if (existing) {
    existing.directLeaves.push(...directLeaves);
    subsections.forEach((subsection) => {
      const current = existing.subsections.find((item) => item.label === subsection.label);
      if (current) current.leaves.push(...subsection.leaves);
      else existing.subsections.push(subsection);
    });
    return;
  }
  sections.set(key, { key, label: topLabel, directLeaves, subsections });
};

const collectPluginLeaves = (
  node: PluginMenuNode,
  getEntries: (node: PluginMenuNode | null) => PluginMenuEntry[],
  prefix: string[] = [],
): MenuLeaf[] => {
  const leaves: MenuLeaf[] = [];
  getEntries(node).forEach((entry) => {
    if (entry.kind === 'plugin' && entry.plugin) {
      leaves.push({
        key: entry.key,
        label: prefix.length ? prefix.join(' / ') + ' / ' + entry.label : entry.label,
        kind: 'plugin',
        plugin: entry.plugin,
      });
    } else if (entry.node) {
      leaves.push(...collectPluginLeaves(entry.node, getEntries, [...prefix, entry.label]));
    }
  });
  return leaves;
};

const buildMenuSections = (
  pluginTree: PluginMenuNode[],
  profiles: ConsoleProfile[],
  getEntries: (node: PluginMenuNode | null) => PluginMenuEntry[],
  hasSelectedNodes: boolean,
): MenuSection[] => {
  const sections = new Map<string, MenuSection>();

  pluginTree.forEach((root) => {
    const rootEntries = getEntries(root);
    const directLeaves: MenuLeaf[] = rootEntries
      .filter((entry) => entry.kind === 'plugin' && entry.plugin)
      .map((entry) => ({
        key: entry.key,
        label: entry.label,
        kind: 'plugin' as const,
        plugin: entry.plugin!,
      }));
    const subsections = root.children
      .map((child) => ({
        key: child.key,
        label: child.label,
        leaves: collectPluginLeaves(child, getEntries),
      }))
      .filter((item) => item.leaves.length > 0);
    appendSection(sections, root.label, directLeaves, subsections);
  });

  {
    const analysisGroups = new Map<string, { top: string; subsection: string | null; leaves: MenuLeaf[] }>();
    profiles
      .filter((profile) =>
        profile.is_active !== false &&
        profile.hidden_from_menu !== true &&
        (hasSelectedNodes || profile.supports_graph_selection !== true))
      .forEach((profile) => {
        const path = normalizeAnalysisPath(profile);
        const top = path[0] || 'Анализ';
        const subsection = path.length > 1 ? path.slice(1).join(' / ') : null;
        const groupKey = top + '::' + String(subsection || '');
        const group = analysisGroups.get(groupKey) || { top, subsection, leaves: [] };
        group.leaves.push({
          key: 'analysis:' + String(profile.key || profile.id),
          label: profile.name,
          kind: 'analysis',
          profile,
        });
        analysisGroups.set(groupKey, group);
      });

    Array.from(analysisGroups.values()).forEach((group) => {
      appendSection(
        sections,
        group.top,
        group.subsection ? [] : group.leaves,
        group.subsection
          ? [{ key: group.top + '/' + group.subsection, label: group.subsection, leaves: group.leaves }]
          : [],
      );
    });
  }

  const preferredOrder = ['Связи', 'Создать объект', 'Анализ', 'Преобразования', 'AI', 'Документы'];
  const orderOf = (label: string) => {
    const index = preferredOrder.indexOf(label);
    return index < 0 ? preferredOrder.length : index;
  };

  return Array.from(sections.values())
    .map((section) => ({
      ...section,
      directLeaves: [...section.directLeaves].sort((left, right) => left.label.localeCompare(right.label, 'ru')),
      subsections: [...section.subsections]
        .map((subsection) => ({
          ...subsection,
          leaves: [...subsection.leaves].sort((left, right) => left.label.localeCompare(right.label, 'ru')),
        }))
        .sort((left, right) => left.label.localeCompare(right.label, 'ru')),
    }))
    .filter((section) => section.directLeaves.length > 0 || section.subsections.length > 0)
    .sort((left, right) => {
      const orderDiff = orderOf(left.label) - orderOf(right.label);
      return orderDiff || left.label.localeCompare(right.label, 'ru');
    });
};

export const PluginContextMenu: React.FC<PluginContextMenuProps> = ({
  pluginMenu,
  pluginMenuRef,
  pluginMenuLeft,
  pluginMenuTop,
  pluginMenuTree,
  analysisProfiles,
  pluginExecutionMessage,
  getPluginMenuEntries,
  onRunPlugin,
  onRunAnalysis,
  onSelectLinks,
  onSelectConnected,
  onClose,
}) => {
  const [openSectionKey, setOpenSectionKey] = useState<string | null>(null);
  const [openSubsectionKey, setOpenSubsectionKey] = useState<string | null>(null);

  const hasSelectedNodes = Boolean(pluginMenu?.context.selected_nodes?.length);
  const hasSelectedEdges = Boolean(pluginMenu?.context.selected_edges?.length);
  const hasSelection = hasSelectedNodes || hasSelectedEdges;

  const sections = useMemo(
    () => buildMenuSections(pluginMenuTree, analysisProfiles, getPluginMenuEntries, hasSelectedNodes),
    [analysisProfiles, getPluginMenuEntries, hasSelectedNodes, pluginMenuTree],
  );
  const sectionSignature = sections.map((section) => section.key).join('|');

  useEffect(() => {
    if (!pluginMenu) {
      setOpenSectionKey(null);
      setOpenSubsectionKey(null);
      return;
    }
    const analysisSection = sections.find((section) => section.label === 'Анализ');
    setOpenSectionKey(analysisSection?.key || sections[0]?.key || null);
    setOpenSubsectionKey(null);
  }, [pluginMenu?.x, pluginMenu?.y, sectionSignature]);

  if (!pluginMenu) return null;

  const runLeaf = (leaf: MenuLeaf) => {
    if (leaf.kind === 'plugin') onRunPlugin(leaf.plugin, pluginMenu.context || {});
    else onRunAnalysis(leaf.profile, pluginMenu.context || {});
  };

  const renderLeaf = (leaf: MenuLeaf) => (
    <button
      key={leaf.key}
      type="button"
      onClick={() => runLeaf(leaf)}
      title={leaf.label}
      style={{
        ...menuButtonStyle,
        paddingLeft: 24,
        display: 'block',
        whiteSpace: 'nowrap',
        overflow: 'hidden',
        textOverflow: 'ellipsis',
      }}
    >
      {leaf.label}
    </button>
  );

  return (
    <div
      ref={pluginMenuRef}
      style={{
        position: 'absolute',
        left: pluginMenuLeft,
        top: pluginMenuTop,
        zIndex: 30,
        width: 300,
        maxWidth: 'calc(100% - 16px)',
        border: '1px solid #d7deea',
        borderRadius: 8,
        background: '#ffffff',
        boxShadow: '0 10px 28px rgba(15, 23, 42, 0.2)',
        overflow: 'hidden',
      }}
      onClick={(event) => event.stopPropagation()}
      onContextMenu={(event) => event.preventDefault()}
    >
      {hasSelection && (
        <div style={{ padding: 6, borderBottom: '1px solid #eef2f7', background: '#f8fafc' }}>
          {hasSelectedNodes && (
            <button
              type="button"
              onClick={() => {
                onSelectLinks();
                onClose();
              }}
              style={menuButtonStyle}
            >
              Выделить связи
            </button>
          )}
          <button
            type="button"
            onClick={() => {
              onSelectConnected();
              onClose();
            }}
            style={menuButtonStyle}
          >
            Выделить связанные
          </button>
        </div>
      )}

      <div style={{ maxHeight: 360, overflowY: 'auto', overflowX: 'hidden', padding: 6 }}>
        {pluginMenu.loading && (
          <div style={{ fontSize: 12, color: '#334155', padding: '7px 8px' }}>Загрузка команд...</div>
        )}

        {!pluginMenu.loading && pluginExecutionMessage && (
          <div style={{ fontSize: 12, color: '#2563eb', padding: '7px 8px', lineHeight: 1.35 }}>
            Выполняется плагин. Запуск других команд временно недоступен.
          </div>
        )}

        {!pluginMenu.loading && sections.length === 0 && (
          <div style={{ fontSize: 12, color: '#64748b', padding: '7px 8px' }}>
            Для текущего выделения нет доступных команд.
          </div>
        )}

        {!pluginMenu.loading && sections.map((section) => {
          const isOpen = openSectionKey === section.key;
          return (
            <div key={section.key} style={{ borderBottom: '1px solid #f1f5f9' }}>
              <button
                type="button"
                onClick={() => {
                  setOpenSectionKey(isOpen ? null : section.key);
                  setOpenSubsectionKey(null);
                }}
                style={{
                  ...menuButtonStyle,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: 8,
                  padding: '7px 8px',
                  fontWeight: 700,
                  color: isOpen ? '#1d4ed8' : '#334155',
                  background: isOpen ? '#eff6ff' : 'transparent',
                }}
              >
                <span>{section.label}</span>
                <span aria-hidden="true" style={{ color: '#64748b' }}>{isOpen ? '▾' : '▸'}</span>
              </button>

              {isOpen && (
                <div style={{ padding: '2px 0 5px' }}>
                  {section.directLeaves.map(renderLeaf)}
                  {section.subsections.map((subsection) => {
                    const isSubsectionOpen = openSubsectionKey === subsection.key;
                    return (
                      <div key={subsection.key}>
                        <button
                          type="button"
                          onClick={() => setOpenSubsectionKey(isSubsectionOpen ? null : subsection.key)}
                          style={{
                            ...menuButtonStyle,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            paddingLeft: 18,
                            color: '#475569',
                            fontWeight: 600,
                          }}
                        >
                          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {subsection.label}
                          </span>
                          <span aria-hidden="true" style={{ color: '#94a3b8' }}>{isSubsectionOpen ? '▾' : '▸'}</span>
                        </button>
                        {isSubsectionOpen && subsection.leaves.map(renderLeaf)}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default PluginContextMenu;
