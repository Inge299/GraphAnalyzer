import type { ConsoleProcedureColumn } from '../types/api';

export interface RawConsoleTab {
  id?: string;
  name?: string;
  columns?: Array<string | ConsoleProcedureColumn>;
  rows?: Record<string, unknown>[];
  row_count?: number;
}

export interface RawConsoleArtifactData {
  tabs?: RawConsoleTab[];
  columns?: Array<string | ConsoleProcedureColumn>;
  rows?: Record<string, unknown>[];
}

export interface NormalizedConsoleColumn extends ConsoleProcedureColumn {
  key: string;
}

export interface NormalizedConsoleTab {
  id: string;
  name: string;
  columns: NormalizedConsoleColumn[];
  rows: Record<string, unknown>[];
  row_count: number;
}

const normalizeText = (value: unknown): string => {
  if (value === null || value === undefined) return '';
  if (Array.isArray(value)) return value.map(normalizeText).filter(Boolean).join(', ');
  if (typeof value === 'object') return '';
  return String(value).trim();
};

export const normalizeConsoleColumn = (value: string | ConsoleProcedureColumn): NormalizedConsoleColumn => {
  if (typeof value === 'string') {
    return {
      key: value,
      original_name: value,
      label: value,
      type: 'string',
      width: null,
      visible: true,
    };
  }

  const key = String(value.key || value.original_name || '').trim();
  return {
    ...value,
    key,
    original_name: String(value.original_name || key).trim() || key,
    label: String(value.label || value.original_name || key).trim() || key,
    type: String(value.type || 'string'),
    width: typeof value.width === 'number' ? value.width : null,
    visible: value.visible !== false,
  };
};

const extractNameFromRow = (row: Record<string, unknown>): string => {
  const preferredKeys = ['table_name', 'tablename', 'tab_name', 'result_name', 'display_name', 'name', 'title'];
  for (const key of preferredKeys) {
    const value = normalizeText(row[key]);
    if (value) return value;
  }
  for (const value of Object.values(row)) {
    const normalized = normalizeText(value);
    if (normalized) return normalized;
  }
  return '';
};

const tryExtractFollowingTabNames = (tabs: NormalizedConsoleTab[]): string[] => {
  if (tabs.length <= 1) return [];
  const metadataTab = tabs[0];
  const names = metadataTab.rows.map(extractNameFromRow).filter(Boolean);
  return names.length >= tabs.length - 1 ? names.slice(0, tabs.length - 1) : [];
};

export const normalizeConsoleTabs = (data: RawConsoleArtifactData): NormalizedConsoleTab[] => {
  const rawTabs = Array.isArray(data.tabs) && data.tabs.length > 0
    ? data.tabs
    : [{
        id: 'main',
        name: 'Основная',
        columns: Array.isArray(data.columns) ? data.columns : [],
        rows: Array.isArray(data.rows) ? data.rows : [],
        row_count: Array.isArray(data.rows) ? data.rows.length : 0,
      }];

  const tabs = rawTabs
    .filter((tab): tab is RawConsoleTab => Boolean(tab && typeof tab === 'object'))
    .map((tab, index) => {
      const rows = Array.isArray(tab.rows)
        ? tab.rows.filter((item): item is Record<string, unknown> => Boolean(item && typeof item === 'object'))
        : [];
      const columns = Array.isArray(tab.columns) && tab.columns.length > 0
        ? tab.columns.map(normalizeConsoleColumn).filter((column) => column.visible !== false && column.key)
        : Object.keys(rows[0] || {}).map((key) => normalizeConsoleColumn(key));

      return {
        id: String(tab.id || `tab_${index + 1}`),
        name: String(tab.name || tab.id || `Вкладка ${index + 1}`),
        columns,
        rows,
        row_count: typeof tab.row_count === 'number' ? tab.row_count : rows.length,
      };
    });

  const followingTabNames = tryExtractFollowingTabNames(tabs);
  if (followingTabNames.length > 0) {
    return tabs.slice(1).map((tab, index) => ({
      ...tab,
      name: followingTabNames[index] || tab.name,
    }));
  }

  return tabs;
};
