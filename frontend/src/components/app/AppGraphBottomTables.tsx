import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { GraphSortDirection } from './graphBottomPanelTypes';
import type { AppGraphEdgesTableProps, AppGraphNodesTableProps } from './graphBottomPanelTypes';
import {
  formatGraphTableCellValue,
  getGraphEdgeId,
  getGraphNodeId,
  graphBottomPanelLabels,
} from './graphBottomPanelUtils';

type ColumnDefinition = {
  key: string;
  label: string;
  sortKey: string;
  isActive: boolean;
  sortDir: GraphSortDirection;
  onSort: (key: string) => void;
  minWidth?: number;
  defaultWidth?: number;
};

const DEFAULT_COLUMN_WIDTH = 160;

const readStoredColumnWidths = (storageKey: string): Record<string, number> => {
  if (typeof window === 'undefined') return {};
  try {
    const raw = window.localStorage.getItem(storageKey);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    const widths: Record<string, number> = {};
    for (const [key, value] of Object.entries(parsed)) {
      if (typeof value === 'number' && Number.isFinite(value)) {
        widths[key] = value;
      }
    }
    return widths;
  } catch {
    return {};
  }
};

const normalizeColumnWidths = (
  columns: ColumnDefinition[],
  widths: Record<string, number>,
): Record<string, number> =>
  columns.reduce<Record<string, number>>((acc, column) => {
    const minWidth = column.minWidth ?? 90;
    const defaultWidth = column.defaultWidth ?? DEFAULT_COLUMN_WIDTH;
    const candidate = widths[column.key];
    acc[column.key] = Number.isFinite(candidate) ? Math.max(minWidth, candidate) : defaultWidth;
    return acc;
  }, {});

const useResizableColumns = (storageKey: string, columns: ColumnDefinition[]) => {
  const columnsRef = useRef(columns);
  columnsRef.current = columns;

  const [columnWidths, setColumnWidths] = useState<Record<string, number>>(() =>
    normalizeColumnWidths(columns, readStoredColumnWidths(storageKey)),
  );

  const columnSignature = useMemo(
    () => columns.map((column) => `${column.key}:${column.defaultWidth ?? DEFAULT_COLUMN_WIDTH}:${column.minWidth ?? 90}`).join('|'),
    [columns],
  );

  useEffect(() => {
    setColumnWidths((prev) => normalizeColumnWidths(columns, prev));
  }, [columnSignature, columns]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    window.localStorage.setItem(storageKey, JSON.stringify(columnWidths));
  }, [columnWidths, storageKey]);

  const handleResizeReset = useCallback((columnKey: string) => {
    const activeColumn = columnsRef.current.find((column) => column.key === columnKey);
    if (!activeColumn) return;
    const minWidth = activeColumn.minWidth ?? 90;
    const defaultWidth = activeColumn.defaultWidth ?? DEFAULT_COLUMN_WIDTH;
    setColumnWidths((prev) => ({
      ...prev,
      [columnKey]: Math.max(minWidth, defaultWidth),
    }));
  }, []);

  const handleResizeStart = useCallback((columnKey: string, event: React.MouseEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.stopPropagation();

    const startX = event.clientX;
    const startWidth = columnWidths[columnKey] ?? DEFAULT_COLUMN_WIDTH;
    const activeColumn = columnsRef.current.find((column) => column.key === columnKey);
    const minWidth = activeColumn?.minWidth ?? 90;

    document.body.classList.add('table-resizing');

    const onMouseMove = (moveEvent: MouseEvent) => {
      const delta = moveEvent.clientX - startX;
      const nextWidth = Math.max(minWidth, startWidth + delta);
      setColumnWidths((prev) => ({ ...prev, [columnKey]: nextWidth }));
    };

    const onMouseUp = () => {
      document.body.classList.remove('table-resizing');
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
    };

    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
  }, [columnWidths]);

  return { columnWidths, handleResizeStart, handleResizeReset };
};

type ResizableHeaderCellProps = {
  column: ColumnDefinition;
  width: number;
  onResizeStart: (columnKey: string, event: React.MouseEvent<HTMLDivElement>) => void;
  onResizeReset: (columnKey: string) => void;
  renderSortIndicator: (active: boolean, dir: GraphSortDirection) => React.ReactNode;
};

const ResizableHeaderCell = ({
  column,
  width,
  onResizeStart,
  onResizeReset,
  renderSortIndicator,
}: ResizableHeaderCellProps) => (
  <th style={{ width, minWidth: width }}>
    <div className="bottom-table-header-cell">
      <button
        type="button"
        className="bottom-sort-btn"
        onClick={() => column.onSort(column.sortKey)}
      >
        {column.label}
        {renderSortIndicator(column.isActive, column.sortDir)}
      </button>
      <div
        className="bottom-table-col-resizer"
        onMouseDown={(event) => onResizeStart(column.key, event)}
        onDoubleClick={() => onResizeReset(column.key)}
        title="Потяните, чтобы изменить ширину колонки"
      />
    </div>
  </th>
);

export const AppGraphNodesTable = ({
  toggleNodeSort,
  renderSortIndicator,
  nodeSortKey,
  nodeSortDir,
  nodeAttributeColumns,
  formatAttributeHeader,
  visibleGraphNodesForPanel,
  selectedNodeIds,
  handleNodeRowClick,
  nodeRowRefs,
  emptyMessage = 'Ничего не найдено',
}: AppGraphNodesTableProps) => {
  const columns = useMemo<ColumnDefinition[]>(
    () => [
      {
        key: 'type',
        label: graphBottomPanelLabels.type,
        sortKey: 'type',
        isActive: nodeSortKey === 'type',
        sortDir: nodeSortDir,
        onSort: toggleNodeSort,
        minWidth: 120,
        defaultWidth: 140,
      },
      {
        key: 'label',
        label: graphBottomPanelLabels.label,
        sortKey: 'label',
        isActive: nodeSortKey === 'label',
        sortDir: nodeSortDir,
        onSort: toggleNodeSort,
        minWidth: 180,
        defaultWidth: 260,
      },
      ...nodeAttributeColumns.map((key) => ({
        key: `attr:${key}`,
        label: formatAttributeHeader(key),
        sortKey: key,
        isActive: nodeSortKey === key,
        sortDir: nodeSortDir,
        onSort: toggleNodeSort,
        minWidth: 130,
        defaultWidth: 180,
      })),
    ],
    [formatAttributeHeader, nodeAttributeColumns, nodeSortDir, nodeSortKey, toggleNodeSort],
  );

  const { columnWidths, handleResizeStart, handleResizeReset } = useResizableColumns(
    'graph-bottom-table-widths-nodes-v1',
    columns,
  );

  return (
    <table className="bottom-table">
      <colgroup>
        {columns.map((column) => (
          <col key={column.key} style={{ width: `${columnWidths[column.key]}px` }} />
        ))}
      </colgroup>
      <thead>
        <tr>
          {columns.map((column) => (
            <ResizableHeaderCell
              key={column.key}
              column={column}
              width={columnWidths[column.key]}
              onResizeStart={handleResizeStart}
              onResizeReset={handleResizeReset}
              renderSortIndicator={renderSortIndicator}
            />
          ))}
        </tr>
      </thead>
      <tbody>
        {visibleGraphNodesForPanel.length === 0 ? (
          <tr>
            <td className="bottom-table-empty" colSpan={columns.length}>
              {emptyMessage}
            </td>
          </tr>
        ) : visibleGraphNodesForPanel.map((node, rowIndex) => {
          const nodeId = getGraphNodeId(node);
          const attrs = node?.attributes || {};
          const isSelected = selectedNodeIds.has(nodeId);
          return (
            <tr
              key={nodeId || `${rowIndex}`}
              className={isSelected ? 'selected-row' : ''}
              onClick={(event) => handleNodeRowClick(event, node, rowIndex)}
              ref={(el) => { if (nodeId) nodeRowRefs.current[nodeId] = el; }}
            >
              <td>{String(node?.type || '-')}</td>
              <td>{String(node?.label || node?.attributes?.label || nodeId)}</td>
              {nodeAttributeColumns.map((key) => (
                <td key={key}>{formatGraphTableCellValue(attrs[key])}</td>
              ))}
            </tr>
          );
        })}
      </tbody>
    </table>
  );
};

export const AppGraphEdgesTable = ({
  toggleEdgeSort,
  renderSortIndicator,
  edgeSortKey,
  edgeSortDir,
  edgeAttributeColumns,
  formatAttributeHeader,
  visibleGraphEdgesForPanel,
  selectedEdgeIds,
  handleEdgeRowClick,
  edgeRowRefs,
  getNormalizedEdgeAttributes,
  nodeLabelById,
  emptyMessage = 'Ничего не найдено',
}: AppGraphEdgesTableProps) => {
  const columns = useMemo<ColumnDefinition[]>(
    () => [
      {
        key: 'type',
        label: graphBottomPanelLabels.type,
        sortKey: 'type',
        isActive: edgeSortKey === 'type',
        sortDir: edgeSortDir,
        onSort: toggleEdgeSort,
        minWidth: 120,
        defaultWidth: 140,
      },
      {
        key: 'from',
        label: graphBottomPanelLabels.from,
        sortKey: 'from',
        isActive: edgeSortKey === 'from',
        sortDir: edgeSortDir,
        onSort: toggleEdgeSort,
        minWidth: 180,
        defaultWidth: 220,
      },
      {
        key: 'to',
        label: graphBottomPanelLabels.to,
        sortKey: 'to',
        isActive: edgeSortKey === 'to',
        sortDir: edgeSortDir,
        onSort: toggleEdgeSort,
        minWidth: 180,
        defaultWidth: 220,
      },
      {
        key: 'label',
        label: graphBottomPanelLabels.label,
        sortKey: 'label',
        isActive: edgeSortKey === 'label',
        sortDir: edgeSortDir,
        onSort: toggleEdgeSort,
        minWidth: 160,
        defaultWidth: 220,
      },
      ...edgeAttributeColumns.map((key) => ({
        key: `attr:${key}`,
        label: formatAttributeHeader(key),
        sortKey: key,
        isActive: edgeSortKey === key,
        sortDir: edgeSortDir,
        onSort: toggleEdgeSort,
        minWidth: 130,
        defaultWidth: 180,
      })),
    ],
    [edgeAttributeColumns, edgeSortDir, edgeSortKey, formatAttributeHeader, toggleEdgeSort],
  );

  const { columnWidths, handleResizeStart, handleResizeReset } = useResizableColumns(
    'graph-bottom-table-widths-edges-v1',
    columns,
  );

  return (
    <table className="bottom-table">
      <colgroup>
        {columns.map((column) => (
          <col key={column.key} style={{ width: `${columnWidths[column.key]}px` }} />
        ))}
      </colgroup>
      <thead>
        <tr>
          {columns.map((column) => (
            <ResizableHeaderCell
              key={column.key}
              column={column}
              width={columnWidths[column.key]}
              onResizeStart={handleResizeStart}
              onResizeReset={handleResizeReset}
              renderSortIndicator={renderSortIndicator}
            />
          ))}
        </tr>
      </thead>
      <tbody>
        {visibleGraphEdgesForPanel.length === 0 ? (
          <tr>
            <td className="bottom-table-empty" colSpan={columns.length}>
              {emptyMessage}
            </td>
          </tr>
        ) : visibleGraphEdgesForPanel.map((edge, rowIndex) => {
          const edgeId = getGraphEdgeId(edge);
          const fromId = String(edge?.from || edge?.source_node || '');
          const toId = String(edge?.to || edge?.target_node || '');
          const attrs = getNormalizedEdgeAttributes(edge);
          const isSelected = selectedEdgeIds.has(edgeId);
          return (
            <tr
              key={edgeId || `${rowIndex}`}
              className={isSelected ? 'selected-row' : ''}
              onClick={(event) => handleEdgeRowClick(event, edge, rowIndex)}
              ref={(el) => { if (edgeId) edgeRowRefs.current[edgeId] = el; }}
            >
              <td>{String(edge?.type || '-')}</td>
              <td>{nodeLabelById[fromId] || fromId}</td>
              <td>{nodeLabelById[toId] || toId}</td>
              <td>{String(edge?.label || '')}</td>
              {edgeAttributeColumns.map((key) => (
                <td key={key}>{formatGraphTableCellValue(attrs[key])}</td>
              ))}
            </tr>
          );
        })}
      </tbody>
    </table>
  );
};
