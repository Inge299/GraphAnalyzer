import React, { useEffect, useMemo, useState } from 'react';
import type { ApiArtifact } from '../../types/api';

type SortDir = 'asc' | 'desc';

interface ConsoleViewProps {
  artifact: ApiArtifact;
}

interface ConsoleTabData {
  id: string;
  name: string;
  columns: string[];
  rows: Record<string, unknown>[];
  row_count?: number;
}

interface ConsoleArtifactData {
  profile_id?: string;
  profile_name?: string;
  tabs?: ConsoleTabData[];
  active_tab_id?: string | null;
  columns?: string[];
  rows?: Record<string, unknown>[];
}

const normalize = (value: unknown): string => {
  if (value === null || value === undefined) return '';
  if (Array.isArray(value)) return value.join(', ');
  if (typeof value === 'object') return JSON.stringify(value);
  return String(value);
};

const toTabList = (data: ConsoleArtifactData): ConsoleTabData[] => {
  if (Array.isArray(data.tabs) && data.tabs.length > 0) {
    return data.tabs
      .filter((tab): tab is ConsoleTabData => Boolean(tab && typeof tab === 'object'))
      .map((tab, index) => ({
        id: String(tab.id || `tab_${index + 1}`),
        name: String(tab.name || tab.id || `Вкладка ${index + 1}`),
        columns: Array.isArray(tab.columns) ? tab.columns.map((item) => String(item)) : [],
        rows: Array.isArray(tab.rows) ? tab.rows.filter((item): item is Record<string, unknown> => Boolean(item && typeof item === 'object')) : [],
        row_count: typeof tab.row_count === 'number' ? tab.row_count : undefined,
      }));
  }

  const fallbackColumns = Array.isArray(data.columns) ? data.columns.map((item) => String(item)) : [];
  const fallbackRows = Array.isArray(data.rows)
    ? data.rows.filter((item): item is Record<string, unknown> => Boolean(item && typeof item === 'object'))
    : [];

  return [{
    id: 'main',
    name: 'Основная',
    columns: fallbackColumns,
    rows: fallbackRows,
    row_count: fallbackRows.length,
  }];
};

const ConsoleView: React.FC<ConsoleViewProps> = ({ artifact }) => {
  const data = (artifact.data || {}) as ConsoleArtifactData;
  const tabs = useMemo(() => toTabList(data), [data]);

  const initialTabId = useMemo(() => {
    const active = String(data.active_tab_id || '').trim();
    if (active && tabs.some((tab) => tab.id === active)) return active;
    return tabs[0]?.id || '';
  }, [data.active_tab_id, tabs]);

  const [activeTabId, setActiveTabId] = useState<string>(initialTabId);
  const [sortKey, setSortKey] = useState<string>('');
  const [sortDir, setSortDir] = useState<SortDir>('asc');
  const [filters, setFilters] = useState<Record<string, string>>({});

  useEffect(() => {
    setActiveTabId(initialTabId);
  }, [initialTabId]);

  useEffect(() => {
    setSortKey('');
    setSortDir('asc');
    setFilters({});
  }, [activeTabId]);

  const activeTab = useMemo(
    () => tabs.find((tab) => tab.id === activeTabId) || tabs[0],
    [tabs, activeTabId],
  );

  const columns: string[] = useMemo(() => {
    if (!activeTab) return [];
    if (activeTab.columns.length > 0) return activeTab.columns;
    const first = activeTab.rows[0];
    if (first && typeof first === 'object') return Object.keys(first);
    return [];
  }, [activeTab]);

  const rows = useMemo(() => activeTab?.rows || [], [activeTab]);

  const filteredRows = useMemo(() => {
    const activeFilters = Object.entries(filters)
      .filter(([, value]) => String(value || '').trim() !== '')
      .map(([key, value]) => [key, String(value).trim().toLowerCase()] as const);

    let nextRows = rows;
    if (activeFilters.length > 0) {
      nextRows = nextRows.filter((row) => activeFilters.every(([key, value]) => normalize(row[key]).toLowerCase().includes(value)));
    }

    if (!sortKey) return nextRows;

    return [...nextRows].sort((a, b) => {
      const av = normalize(a[sortKey]);
      const bv = normalize(b[sortKey]);
      const result = av.localeCompare(bv, 'ru', { sensitivity: 'base', numeric: true });
      return sortDir === 'asc' ? result : -result;
    });
  }, [rows, filters, sortKey, sortDir]);

  const handleSort = (key: string) => {
    if (sortKey === key) {
      setSortDir((prev) => (prev === 'asc' ? 'desc' : 'asc'));
      return;
    }
    setSortKey(key);
    setSortDir('asc');
  };

  return (
    <div className="console-view" style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <div style={{ padding: '10px 12px', borderBottom: '1px solid #dbe3f0', fontSize: 12, color: '#475569' }}>
        Профиль: <strong>{String(data.profile_name || data.profile_id || '-')}</strong>
        <span style={{ marginLeft: 12 }}>Вкладок: <strong>{tabs.length}</strong></span>
        <span style={{ marginLeft: 12 }}>Строк: <strong>{filteredRows.length}</strong></span>
      </div>

      {tabs.length > 1 && (
        <div style={{ display: 'flex', gap: 8, padding: '8px 12px', borderBottom: '1px solid #dbe3f0', overflowX: 'auto' }}>
          {tabs.map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTabId(tab.id)}
              style={{
                border: activeTabId === tab.id ? '1px solid #2563eb' : '1px solid #cbd5e1',
                background: activeTabId === tab.id ? '#eff6ff' : '#fff',
                borderRadius: 6,
                padding: '4px 10px',
                fontSize: 12,
                cursor: 'pointer',
                whiteSpace: 'nowrap',
              }}
            >
              {tab.name}
              <span style={{ marginLeft: 6, color: '#64748b' }}>({tab.row_count ?? tab.rows.length})</span>
            </button>
          ))}
        </div>
      )}

      <div style={{ flex: 1, overflow: 'auto' }}>
        {columns.length === 0 ? (
          <div style={{ padding: 16, color: '#64748b' }}>Нет данных в активной вкладке. Обновите консоль или запустите плагин.</div>
        ) : (
          <table className="bottom-table" style={{ minWidth: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                {columns.map((column) => (
                  <th key={`head-${column}`}>
                    <button type="button" className="bottom-sort-btn" onClick={() => handleSort(column)}>
                      {column}
                      {sortKey === column ? (sortDir === 'asc' ? ' ▲' : ' ▼') : ''}
                    </button>
                  </th>
                ))}
              </tr>
              <tr>
                {columns.map((column) => (
                  <th key={`flt-${column}`}>
                    <input
                      value={filters[column] || ''}
                      onChange={(e) => setFilters((prev) => ({ ...prev, [column]: e.target.value }))}
                      placeholder="Фильтр"
                      style={{ width: '100%', padding: '2px 6px', border: '1px solid #cbd5e1', borderRadius: 4, fontSize: 11 }}
                    />
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filteredRows.map((row, index) => (
                <tr key={`row-${index}`}>
                  {columns.map((column) => (
                    <td key={`row-${index}-${column}`}>{normalize(row[column])}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
};

export default ConsoleView;
