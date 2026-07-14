import { AppGraphEdgesTable, AppGraphNodesTable } from './AppGraphBottomTables';
import AppGraphBottomSearch from './AppGraphBottomSearch';
import AppGraphBottomToolbar from './AppGraphBottomToolbar';
import type { AppGraphBottomPanelProps } from './graphBottomPanelTypes';
import { graphBottomPanelLabels } from './graphBottomPanelUtils';

export const AppGraphBottomPanel = ({
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
}: AppGraphBottomPanelProps) => {
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

  const clearFilters = () => {
    setSearchQuery('');
    setCurrentTypeFilter('');
    setCurrentAttributeKeyFilter('');
    setCurrentAttributeValueFilter('');
    setShowOnlySelected(false);
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
            <AppGraphBottomToolbar
              bottomTab={bottomTab}
              setBottomTab={setBottomTab}
              graphNodesCount={graphNodesForPanel.length}
              graphEdgesCount={graphEdgesForPanel.length}
              filteredNodesCount={visibleGraphNodesForPanel.length}
              filteredEdgesCount={visibleGraphEdgesForPanel.length}
              searchQuery={searchQuery}
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
              actions={
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
                  emptyMessage={hasActiveFilters
                    ? '\u041f\u043e \u044d\u0442\u0438\u043c \u0444\u0438\u043b\u044c\u0442\u0440\u0430\u043c \u0443\u0437\u043b\u044b \u043d\u0435 \u043d\u0430\u0439\u0434\u0435\u043d\u044b'
                    : '\u0423\u0437\u043b\u044b \u043e\u0442\u0441\u0443\u0442\u0441\u0442\u0432\u0443\u044e\u0442'}
                />
              ) : (
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
                  emptyMessage={hasActiveFilters
                    ? '\u041f\u043e \u044d\u0442\u0438\u043c \u0444\u0438\u043b\u044c\u0442\u0440\u0430\u043c \u0441\u0432\u044f\u0437\u0438 \u043d\u0435 \u043d\u0430\u0439\u0434\u0435\u043d\u044b'
                    : '\u0421\u0432\u044f\u0437\u0438 \u043e\u0442\u0441\u0443\u0442\u0441\u0442\u0432\u0443\u044e\u0442'}
                />
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default AppGraphBottomPanel;
