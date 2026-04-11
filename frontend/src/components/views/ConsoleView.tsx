import React, { useMemo, useState } from 'react';
import type { ApiArtifact } from '../../types/api';

type SortDir = 'asc' | 'desc';

interface ConsoleViewProps {
  artifact: ApiArtifact;
}

const normalize = (value: any): string => {
  if (value === null || value === undefined) return '';
  if (Array.isArray(value)) return value.join(', ');
  return String(value);
};

const ConsoleView: React.FC<ConsoleViewProps> = ({ artifact }) => {
  const columns: string[] = useMemo(() => {
    if (Array.isArray(artifact.data?.columns) && artifact.data.columns.length > 0) {
      return artifact.data.columns.map((item: any) => String(item));
    }
    const first = Array.isArray(artifact.data?.rows) ? artifact.data.rows[0] : null;
    if (first && typeof first === 'object') return Object.keys(first);
    return [];
  }, [artifact.data]);

  const rows: Record<string, any>[] = useMemo(() => {
    if (!Array.isArray(artifact.data?.rows)) return [];
    return artifact.data.rows.filter((item: any) => item && typeof item === 'object');
  }, [artifact.data]);

  const [sortKey, setSortKey] = useState<string>('');
  const [sortDir, setSortDir] = useState<SortDir>('asc');
  const [filters, setFilters] = useState<Record<string, string>>({});

  const filteredRows = useMemo(() => {
    const activeFilters = Object.entries(filters)
      .filter(([, value]) => String(value || '').trim() !== '')
      .map(([key, value]) => [key, String(value).trim().toLowerCase()] as const);

    let data = rows;
    if (activeFilters.length > 0) {
      data = data.filter((row) => activeFilters.every(([key, value]) => normalize(row[key]).toLowerCase().includes(value)));
    }

    if (!sortKey) return data;

    return [...data].sort((a, b) => {
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
        Профиль: <strong>{String(artifact.data?.profile_name || artifact.data?.profile_id || '-')}</strong>
        <span style={{ marginLeft: 12 }}>Строк: <strong>{filteredRows.length}</strong></span>
      </div>
      <div style={{ flex: 1, overflow: 'auto' }}>
        {columns.length === 0 ? (
          <div style={{ padding: 16, color: '#64748b' }}>Нет данных консоли. Нажмите «Обновить» в инспекторе.</div>
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
