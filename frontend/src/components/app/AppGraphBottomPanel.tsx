import { useEffect, useMemo, useState } from 'react';
import { artifactApi } from '../../services/api';
import { useAppDispatch } from '../../store';
import { fetchArtifacts } from '../../store/slices/artifactsSlice';
import { AppGraphEdgesTable, AppGraphNodesTable, ResizableHeaderCell, useResizableColumns } from './AppGraphBottomTables';
import AppGraphBottomSearch from './AppGraphBottomSearch';
import AppGraphBottomToolbar from './AppGraphBottomToolbar';
import type { AppGraphBottomPanelProps, GraphWorkbenchResultTab } from './graphBottomPanelTypes';
import { formatGraphTableCellValue, graphBottomPanelLabels } from './graphBottomPanelUtils';
import { formatDateTime } from '../../utils/formatters';
import type { ColumnDefinition } from './AppGraphBottomTables';

type ResultRunGroup = {
  sourceArtifactId: number;
  sourceArtifactName: string;
  sourceArtifactVersion: number;
  profileName: string;
  executedAt: string | null;
  createdAt: string | null;
  rowCount: number;
  tabCount: number;
  tabs: GraphWorkbenchResultTab[];
};

const formatResultTimestamp = (value: string | null): string => {
  if (!value) return 'Время запуска не указано';
  return formatDateTime(value);
};

const formatResultTimeShort = (value: string | null): string => {
  if (!value) return '--:--:--';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
};

const compareResultCellValues = (left: unknown, right: unknown): number =>
  formatGraphTableCellValue(left).localeCompare(
    formatGraphTableCellValue(right),
    'ru',
    { sensitivity: 'base', numeric: true },
  );

const escapeCsvCell = (value: unknown): string => {
  const text = formatGraphTableCellValue(value);
  return `"${text.replace(/"/g, '""')}"`;
};

const buildCsvContent = (
  columns: ColumnDefinition[],
  rows: Record<string, unknown>[],
): string => {
  const header = columns.map((column) => escapeCsvCell(column.label)).join(';');
  const body = rows.map((row) => columns.map((column) => escapeCsvCell(row[column.key])).join(';'));
  return [header, ...body].join('\r\n');
};

const sanitizeFileNamePart = (value: string): string =>
  value
    .replace(/[\\/:*?"<>|]+/g, '-')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 80) || 'result';

const readStoredHiddenColumns = (storageKey: string): string[] => {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(storageKey);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === 'string') : [];
  } catch {
    return [];
  }
};

export const AppGraphBottomPanel = ({
  projectId,
  artifactTitle,
  isOpen,
  setIsOpen,
  bottomPanelStyle,
  onResizerMouseDown,
  bottomTab,
  setBottomTab,
  graphNodesForPanel,
  graphEdgesForPanel,
  toggleNodeSort,
  toggleEdgeSort,
  renderSortIndicator,
  nodeSortKey,
  nodeSortDir,
  edgeSortKey,
  edgeSortDir,
  nodeAttributeColumns,
  edgeAttributeColumns,
  formatAttributeHeader,
  visibleGraphNodesForPanel,
  visibleGraphEdgesForPanel,
  selectedNodeIds,
  selectedEdgeIds,
  handleNodeRowClick,
  handleEdgeRowClick,
  nodeRowRefs,
  edgeRowRefs,
  getNormalizedEdgeAttributes,
  nodeLabelById,
  searchQuery,
  setSearchQuery,
  nodeTypeOptions,
  edgeTypeOptions,
  activeTypeFilter,
  setNodeTypeFilter,
  setEdgeTypeFilter,
  nodeAttributeKeyOptions,
  edgeAttributeKeyOptions,
  activeAttributeKeyFilter,
  setNodeAttributeKeyFilter,
  setEdgeAttributeKeyFilter,
  attributeValueOptions,
  activeAttributeValueFilter,
  setNodeAttributeValueFilter,
  setEdgeAttributeValueFilter,
  showOnlySelected,
  setShowOnlySelected,
  resultTabs,
}: AppGraphBottomPanelProps) => {
  const dispatch = useAppDispatch();
  const isResultsTab = bottomTab === 'results';
  const currentTypeOptions = bottomTab === 'nodes' ? nodeTypeOptions : edgeTypeOptions;
  const setCurrentTypeFilter = bottomTab === 'nodes' ? setNodeTypeFilter : setEdgeTypeFilter;
  const currentAttributeKeyOptions = bottomTab === 'nodes' ? nodeAttributeKeyOptions : edgeAttributeKeyOptions;
  const setCurrentAttributeKeyFilter = bottomTab === 'nodes' ? setNodeAttributeKeyFilter : setEdgeAttributeKeyFilter;
  const setCurrentAttributeValueFilter = bottomTab === 'nodes' ? setNodeAttributeValueFilter : setEdgeAttributeValueFilter;
  const currentFilteredCount = bottomTab === 'nodes'
    ? visibleGraphNodesForPanel.length
    : visibleGraphEdgesForPanel.length;
  const currentTotalCount = bottomTab === 'nodes'
    ? graphNodesForPanel.length
    : graphEdgesForPanel.length;
  const hasActiveFilters =
    searchQuery.trim().length > 0 ||
    activeTypeFilter.trim().length > 0 ||
    activeAttributeKeyFilter.trim().length > 0 ||
    activeAttributeValueFilter.trim().length > 0 ||
    showOnlySelected;

  const [activeResultId, setActiveResultId] = useState<string>('');
  const [resultSortKey, setResultSortKey] = useState<string>('');
  const [resultSortDir, setResultSortDir] = useState<'asc' | 'desc'>('asc');
  const [expandedRunIds, setExpandedRunIds] = useState<number[]>([]);
  const [deletingRunId, setDeletingRunId] = useState<number | null>(null);
  const [isDeletingAllResults, setIsDeletingAllResults] = useState(false);
  const [resultsSearchQuery, setResultsSearchQuery] = useState('');
  const [isResultColumnsOpen, setIsResultColumnsOpen] = useState(false);
  const [hiddenResultColumnKeys, setHiddenResultColumnKeys] = useState<string[]>([]);

  const clearFilters = () => {
    setSearchQuery('');
    setCurrentTypeFilter('');
    setCurrentAttributeKeyFilter('');
    setCurrentAttributeValueFilter('');
    setShowOnlySelected(false);
  };

  const panelTitle = 'Аналитическая панель графа';
  const panelDescription = bottomTab === 'nodes'
    ? 'Рабочая таблица для проверки узлов, их типов и атрибутов.'
    : bottomTab === 'edges'
      ? 'Рабочая таблица для проверки связей, направлений и атрибутов.'
      : 'Единая рабочая область для результатов анализа, связанных с текущим графом.';

  const resultRuns = useMemo<ResultRunGroup[]>(() => {
    const grouped = new Map<number, ResultRunGroup>();

    resultTabs.forEach((tab) => {
      const existing = grouped.get(tab.sourceArtifactId);
      if (existing) {
        existing.tabs.push(tab);
        existing.rowCount += tab.rowCount;
        existing.tabCount += 1;
        if ((tab.executedAt || '') > (existing.executedAt || '')) {
          existing.executedAt = tab.executedAt;
        }
        return;
      }

      grouped.set(tab.sourceArtifactId, {
        sourceArtifactId: tab.sourceArtifactId,
        sourceArtifactName: tab.sourceArtifactName,
        sourceArtifactVersion: tab.sourceArtifactVersion,
        profileName: tab.profileName,
        executedAt: tab.executedAt,
        createdAt: tab.sourceArtifactCreatedAt || null,
        rowCount: tab.rowCount,
        tabCount: 1,
        tabs: [tab],
      });
    });

    return Array.from(grouped.values())
      .map((run) => ({
        ...run,
        tabs: [...run.tabs].sort((left, right) => left.tabName.localeCompare(right.tabName, 'ru', { sensitivity: 'base', numeric: true })),
      }))
      .sort((left, right) => {
        const leftDate = left.executedAt ? Date.parse(left.executedAt) : 0;
        const rightDate = right.executedAt ? Date.parse(right.executedAt) : 0;
        return rightDate - leftDate;
      });
  }, [resultTabs]);

  const normalizedResultsSearchQuery = useMemo(
    () => resultsSearchQuery.trim().toLowerCase(),
    [resultsSearchQuery],
  );

  const filteredResultRuns = useMemo(() => {
    if (!normalizedResultsSearchQuery) return resultRuns;
    return resultRuns
      .map((run) => ({
        ...run,
        tabs: run.tabs.filter((tab) => (
          `${tab.sourceSearchText || ''} ${tab.tabName} ${tab.profileName} ${tab.sourceArtifactName}`.toLowerCase()
            .includes(normalizedResultsSearchQuery)
        )),
      }))
      .filter((run) => run.tabs.length > 0);
  }, [normalizedResultsSearchQuery, resultRuns]);

  const visibleResultTabs = useMemo(
    () => filteredResultRuns.flatMap((run) => run.tabs),
    [filteredResultRuns],
  );

  useEffect(() => {
    if (!isResultsTab) return;
    if (!visibleResultTabs.length) {
      setActiveResultId('');
      return;
    }

    const hasActive = visibleResultTabs.some((tab) => `${tab.sourceArtifactId}:${tab.tabId}` === activeResultId);
    if (!hasActive) {
      setActiveResultId(`${visibleResultTabs[0].sourceArtifactId}:${visibleResultTabs[0].tabId}`);
    }
  }, [activeResultId, isResultsTab, visibleResultTabs]);

  useEffect(() => {
    if (!filteredResultRuns.length) {
      setExpandedRunIds([]);
      return;
    }

    setExpandedRunIds((prev) => {
      const validIds = new Set(filteredResultRuns.map((run) => run.sourceArtifactId));
      const next = prev.filter((id) => validIds.has(id));
      if (next.length > 0) return next;
      return [filteredResultRuns[0].sourceArtifactId];
    });
  }, [filteredResultRuns]);

  useEffect(() => {
    setResultSortKey('');
    setResultSortDir('asc');
  }, [activeResultId]);

  const activeResultTab = useMemo<GraphWorkbenchResultTab | null>(
    () => visibleResultTabs.find((tab) => `${tab.sourceArtifactId}:${tab.tabId}` === activeResultId) || visibleResultTabs[0] || null,
    [activeResultId, visibleResultTabs],
  );

  const handleResultSort = (key: string) => {
    if (resultSortKey === key) {
      setResultSortDir((prev) => (prev === 'asc' ? 'desc' : 'asc'));
      return;
    }
    setResultSortKey(key);
    setResultSortDir('asc');
  };

  const resultColumns = useMemo<ColumnDefinition[]>(
    () => (activeResultTab?.columns || []).map((column) => ({
      key: column.key,
      label: column.label || column.key,
      sortKey: column.key,
      isActive: resultSortKey === column.key,
      sortDir: resultSortDir,
      onSort: handleResultSort,
      minWidth: 120,
      defaultWidth: column.width ?? 180,
    })),
    [activeResultTab?.columns, resultSortDir, resultSortKey],
  );

  const resultWidthsStorageKey = useMemo(
    () => activeResultTab
      ? `graph-bottom-table-widths-results-v1:${activeResultTab.sourceArtifactId}:${activeResultTab.tabId}`
      : 'graph-bottom-table-widths-results-v1:empty',
    [activeResultTab],
  );

  const resultHiddenColumnsStorageKey = useMemo(
    () => activeResultTab
      ? `graph-bottom-table-hidden-results-v1:${activeResultTab.sourceArtifactId}:${activeResultTab.tabId}`
      : 'graph-bottom-table-hidden-results-v1:empty',
    [activeResultTab],
  );

  useEffect(() => {
    setHiddenResultColumnKeys(readStoredHiddenColumns(resultHiddenColumnsStorageKey));
    setIsResultColumnsOpen(false);
  }, [resultHiddenColumnsStorageKey]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    window.localStorage.setItem(resultHiddenColumnsStorageKey, JSON.stringify(hiddenResultColumnKeys));
  }, [hiddenResultColumnKeys, resultHiddenColumnsStorageKey]);

  const visibleResultColumns = useMemo(
    () => resultColumns.filter((column) => !hiddenResultColumnKeys.includes(column.key)),
    [hiddenResultColumnKeys, resultColumns],
  );

  const {
    columnWidths: resultColumnWidths,
    handleResizeStart: handleResultResizeStart,
    handleResizeReset: handleResultResizeReset,
  } = useResizableColumns(resultWidthsStorageKey, resultColumns);

  const sortedResultRows = useMemo(() => {
    if (!activeResultTab) return [];
    if (!resultSortKey) return activeResultTab.rows;
    return [...activeResultTab.rows].sort((left, right) => {
      const result = compareResultCellValues(left[resultSortKey], right[resultSortKey]);
      return resultSortDir === 'asc' ? result : -result;
    });
  }, [activeResultTab, resultSortDir, resultSortKey]);

  const toggleResultColumnVisibility = (columnKey: string) => {
    setHiddenResultColumnKeys((prev) => (
      prev.includes(columnKey)
        ? prev.filter((item) => item !== columnKey)
        : [...prev, columnKey]
    ));
  };

  const toggleRunExpanded = (runId: number) => {
    setExpandedRunIds((prev) => (
      prev.includes(runId)
        ? prev.filter((value) => value !== runId)
        : [...prev, runId]
    ));
  };

  const handleDeleteRun = async (runId: number, runName: string) => {
    if (!projectId) return;
    const confirmed = window.confirm(`Удалить результаты запуска "${runName}"? Это удалит весь связанный console-артефакт.`);
    if (!confirmed) return;

    setDeletingRunId(runId);
    try {
      await artifactApi.delete(projectId, runId);
      await dispatch(fetchArtifacts(projectId));
    } finally {
      setDeletingRunId(null);
    }
  };

  const handleDeleteAllResults = async () => {
    if (!projectId || !resultRuns.length) return;
    const confirmed = window.confirm('Удалить все результаты, связанные с текущим графом?');
    if (!confirmed) return;

    setIsDeletingAllResults(true);
    try {
      await Promise.all(resultRuns.map((run) => artifactApi.delete(projectId, run.sourceArtifactId)));
      await dispatch(fetchArtifacts(projectId));
    } finally {
      setIsDeletingAllResults(false);
    }
  };

  const handleExportResultCsv = () => {
    if (!activeResultTab || visibleResultColumns.length === 0) return;

    const csvContent = buildCsvContent(visibleResultColumns, sortedResultRows);
    const blob = new Blob(['\ufeff', csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    const timePart = formatResultTimeShort(activeResultTab.executedAt).replace(/:/g, '-');
    const fileName = [
      sanitizeFileNamePart(activeResultTab.profileName),
      sanitizeFileNamePart(activeResultTab.tabName),
      timePart || 'export',
    ].join('_');

    link.href = url;
    link.download = `${fileName}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.URL.revokeObjectURL(url);
  };

  return (
    <div className={`bottom-panel ${isOpen ? 'open' : 'collapsed'}`} style={bottomPanelStyle}>
      <button
        type="button"
        className="bottom-panel-handle"
        onClick={() => setIsOpen((prev) => !prev)}
        title={isOpen ? graphBottomPanelLabels.hideLists : graphBottomPanelLabels.showLists}
      >
        {isOpen ? '\u25be' : '\u25b4'}
      </button>
      {isOpen && (
        <>
          <div
            className="bottom-panel-resizer"
            onMouseDown={onResizerMouseDown}
            title={graphBottomPanelLabels.resizePanel}
          />
          <div className="bottom-panel-body">
            <div className="bottom-panel-header">
              <div className="bottom-panel-header-copy">
                <div className="bottom-panel-header-title">{panelTitle}</div>
                <div className="bottom-panel-header-description">{panelDescription}</div>
              </div>
              <div className="bottom-panel-header-summary">
                <span className="bottom-panel-header-chip">{artifactTitle}</span>
                <span className="bottom-panel-header-chip">Узлы: {graphNodesForPanel.length}</span>
                <span className="bottom-panel-header-chip">Связи: {graphEdgesForPanel.length}</span>
                <span className="bottom-panel-header-chip">Выделено узлов: {selectedNodeIds.size}</span>
                <span className="bottom-panel-header-chip">Выделено связей: {selectedEdgeIds.size}</span>
              </div>
            </div>

            <AppGraphBottomToolbar
              artifactTitle={artifactTitle}
              bottomTab={bottomTab}
              setBottomTab={setBottomTab}
              graphNodesCount={graphNodesForPanel.length}
              graphEdgesCount={graphEdgesForPanel.length}
              resultsCount={resultTabs.length}
              filteredNodesCount={visibleGraphNodesForPanel.length}
              filteredEdgesCount={visibleGraphEdgesForPanel.length}
              selectedNodesCount={selectedNodeIds.size}
              selectedEdgesCount={selectedEdgeIds.size}
              hasActiveFilters={hasActiveFilters}
              actions={
                isResultsTab ? (
                  <div className="bottom-panel-results-toolbar">
                    <div className="bottom-panel-results-toolbar-note">
                      Здесь собраны console-результаты, выполненные по текущему графу. Они сгруппированы по запускам и отсортированы по времени.
                    </div>
                    <div className="bottom-panel-results-toolbar-actions">
                      <div className="bottom-panel-results-columns">
                        <button
                          type="button"
                          className="property-action secondary"
                          onClick={() => setIsResultColumnsOpen((prev) => !prev)}
                          disabled={!activeResultTab || resultColumns.length === 0}
                        >
                          Колонки
                        </button>
                        {isResultColumnsOpen && (
                          <div className="bottom-panel-results-columns-menu">
                            {resultColumns.map((column) => {
                              const checked = !hiddenResultColumnKeys.includes(column.key);
                              return (
                                <label key={column.key} className="bottom-panel-results-columns-option">
                                  <input
                                    type="checkbox"
                                    checked={checked}
                                    onChange={() => toggleResultColumnVisibility(column.key)}
                                  />
                                  <span>{column.label}</span>
                                </label>
                              );
                            })}
                          </div>
                        )}
                      </div>
                      <button
                        type="button"
                        className="property-action secondary"
                        onClick={handleExportResultCsv}
                        disabled={visibleResultColumns.length === 0}
                      >
                        Экспорт CSV
                      </button>
                      <button
                        type="button"
                        className="property-action secondary"
                        onClick={() => void handleDeleteAllResults()}
                        disabled={!resultRuns.length || isDeletingAllResults}
                      >
                        {isDeletingAllResults ? 'Удаление...' : 'Удалить все результаты'}
                      </button>
                    </div>
                  </div>
                ) : (
                  <AppGraphBottomSearch
                    bottomTab={bottomTab}
                    searchQuery={searchQuery}
                    setSearchQuery={setSearchQuery}
                    activeTypeFilter={activeTypeFilter}
                    typeOptions={currentTypeOptions}
                    setTypeFilter={setCurrentTypeFilter}
                    attributeKeyOptions={currentAttributeKeyOptions}
                    activeAttributeKeyFilter={activeAttributeKeyFilter}
                    setAttributeKeyFilter={(value) => {
                      setCurrentAttributeKeyFilter(value);
                      setCurrentAttributeValueFilter('');
                    }}
                    attributeValueOptions={attributeValueOptions}
                    activeAttributeValueFilter={activeAttributeValueFilter}
                    setAttributeValueFilter={setCurrentAttributeValueFilter}
                    formatAttributeLabel={formatAttributeHeader}
                    showOnlySelected={showOnlySelected}
                    setShowOnlySelected={setShowOnlySelected}
                    hasActiveFilters={hasActiveFilters}
                    onClearFilters={clearFilters}
                    filteredCount={currentFilteredCount}
                    totalCount={currentTotalCount}
                  />
                )
              }
            />

            <div className="bottom-panel-list">
              {bottomTab === 'nodes' ? (
                <AppGraphNodesTable
                  toggleNodeSort={toggleNodeSort}
                  renderSortIndicator={renderSortIndicator}
                  nodeSortKey={nodeSortKey}
                  nodeSortDir={nodeSortDir}
                  nodeAttributeColumns={nodeAttributeColumns}
                  formatAttributeHeader={formatAttributeHeader}
                  visibleGraphNodesForPanel={visibleGraphNodesForPanel}
                  selectedNodeIds={selectedNodeIds}
                  handleNodeRowClick={handleNodeRowClick}
                  nodeRowRefs={nodeRowRefs}
                  emptyMessage={hasActiveFilters ? 'По этим фильтрам узлы не найдены' : 'Узлы отсутствуют'}
                />
              ) : bottomTab === 'edges' ? (
                <AppGraphEdgesTable
                  toggleEdgeSort={toggleEdgeSort}
                  renderSortIndicator={renderSortIndicator}
                  edgeSortKey={edgeSortKey}
                  edgeSortDir={edgeSortDir}
                  edgeAttributeColumns={edgeAttributeColumns}
                  formatAttributeHeader={formatAttributeHeader}
                  visibleGraphEdgesForPanel={visibleGraphEdgesForPanel}
                  selectedEdgeIds={selectedEdgeIds}
                  handleEdgeRowClick={handleEdgeRowClick}
                  edgeRowRefs={edgeRowRefs}
                  getNormalizedEdgeAttributes={getNormalizedEdgeAttributes}
                  nodeLabelById={nodeLabelById}
                  emptyMessage={hasActiveFilters ? 'По этим фильтрам связи не найдены' : 'Связи отсутствуют'}
                />
              ) : resultTabs.length === 0 ? (
                <div className="bottom-panel-results-placeholder">
                  <div className="bottom-panel-results-placeholder-title">Пока нет связанных результатов</div>
                  <div className="bottom-panel-results-placeholder-copy">
                    После запуска console-процедуры по этому графу результат автоматически появится здесь и останется в одном рабочем контуре с узлами и связями.
                  </div>
                  <ul className="bottom-panel-results-placeholder-list">
                    <li>Выделите объекты на графе.</li>
                    <li>Запустите console-процедуру с этим графом как источником контекста.</li>
                    <li>Вернитесь сюда — результат будет доступен во вкладке workbench.</li>
                  </ul>
                </div>
              ) : (
                <div className="bottom-panel-results-layout">
                  <aside className="bottom-panel-results-sidebar">
                    <div className="bottom-panel-results-sidebar-title">Запуски анализа</div>
                    <div className="bottom-panel-results-sidebar-search">
                      <input
                        type="search"
                        className="bottom-panel-search-input"
                        value={resultsSearchQuery}
                        onChange={(event) => setResultsSearchQuery(event.target.value)}
                        placeholder="Поиск по запуску, входу или параметрам"
                      />
                    </div>
                    <div className="bottom-panel-results-sidebar-list">
                      {filteredResultRuns.length === 0 ? (
                        <div className="bottom-table-empty">По этому запросу запуски не найдены</div>
                      ) : filteredResultRuns.map((run) => {
                        const runIsExpanded = expandedRunIds.includes(run.sourceArtifactId);
                        const runIsActive = activeResultTab?.sourceArtifactId === run.sourceArtifactId;
                        return (
                          <div
                            key={run.sourceArtifactId}
                            className={`bottom-panel-results-run ${runIsActive ? 'active' : ''}`}
                          >
                            <div className="bottom-panel-results-run-header">
                              <button
                                type="button"
                                className="bottom-panel-results-run-toggle"
                                onClick={() => toggleRunExpanded(run.sourceArtifactId)}
                              >
                                <span className="bottom-panel-results-run-chevron" aria-hidden="true">
                                  {runIsExpanded ? '▾' : '▸'}
                                </span>
                                <span>
                                  <span className="bottom-panel-results-item-title">
                                    {run.profileName} {formatResultTimeShort(run.executedAt)} Объектов: {run.tabs[0]?.inputObjectCount ?? 0}
                                  </span>
                                </span>
                              </button>
                              <button
                                type="button"
                                className="bottom-panel-results-delete"
                                onClick={() => void handleDeleteRun(run.sourceArtifactId, run.sourceArtifactName)}
                                disabled={deletingRunId === run.sourceArtifactId || isDeletingAllResults}
                                title="Удалить запуск"
                              >
                                {deletingRunId === run.sourceArtifactId ? '...' : '×'}
                              </button>
                            </div>
                            {runIsExpanded && (
                              <div className="bottom-panel-results-run-tabs">
                                {run.tabs.map((tab) => {
                                  const resultId = `${tab.sourceArtifactId}:${tab.tabId}`;
                                  const isActive = resultId === (activeResultTab ? `${activeResultTab.sourceArtifactId}:${activeResultTab.tabId}` : '');
                                  return (
                                    <button
                                      key={resultId}
                                      type="button"
                                      className={`bottom-panel-results-item ${isActive ? 'active' : ''}`}
                                      onClick={() => setActiveResultId(resultId)}
                                    >
                                      <div className="bottom-panel-results-item-row">
                                        <div className="bottom-panel-results-item-title">{tab.tabName}</div>
                                        <div className="bottom-panel-results-item-count">{tab.rowCount}</div>
                                      </div>
                                    </button>
                                  );
                                })}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </aside>

                  <div className="bottom-panel-results-main">
                    {activeResultTab ? (
                      <>
                        <div className="bottom-panel-results-main-header">
                          <div>
                            <div className="bottom-panel-results-main-title">{activeResultTab.tabName}</div>
                            <div className="bottom-panel-results-main-meta">
                              {activeResultTab.profileName} • {activeResultTab.sourceArtifactName} • версия артефакта {activeResultTab.sourceArtifactVersion}
                            </div>
                            <div className="bottom-panel-results-main-meta">
                              {activeResultTab.inputSummary || 'Без краткой сводки входных данных'}
                            </div>
                          </div>
                          <div className="bottom-panel-results-main-meta">
                            {activeResultTab.rowCount} строк • {formatResultTimestamp(activeResultTab.executedAt)}
                          </div>
                        </div>

                        {visibleResultColumns.length === 0 ? (
                          <div className="bottom-panel-results-placeholder-copy">Все колонки скрыты. Покажите нужные через меню «Колонки».</div>
                        ) : activeResultTab.columns.length === 0 ? (
                          <div className="bottom-panel-results-placeholder-copy">У этого результата нет табличных данных для показа.</div>
                        ) : (
                          <div className="bottom-panel-results-table-wrap">
                            <table className="bottom-table bottom-table-results">
                              <colgroup>
                                {visibleResultColumns.map((column) => (
                                  <col key={column.key} style={{ width: `${resultColumnWidths[column.key]}px` }} />
                                ))}
                              </colgroup>
                              <thead>
                                <tr>
                                  {visibleResultColumns.map((column) => (
                                    <ResizableHeaderCell
                                      key={column.key}
                                      column={column}
                                      width={resultColumnWidths[column.key]}
                                      onResizeStart={handleResultResizeStart}
                                      onResizeReset={handleResultResizeReset}
                                      renderSortIndicator={renderSortIndicator}
                                    />
                                  ))}
                                </tr>
                              </thead>
                              <tbody>
                                {sortedResultRows.map((row, rowIndex) => (
                                  <tr key={`result-row-${rowIndex}`}>
                                    {visibleResultColumns.map((column) => (
                                      <td key={`${column.key}-${rowIndex}`}>{formatGraphTableCellValue(row[column.key])}</td>
                                    ))}
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        )}
                      </>
                    ) : null}
                  </div>
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default AppGraphBottomPanel;

