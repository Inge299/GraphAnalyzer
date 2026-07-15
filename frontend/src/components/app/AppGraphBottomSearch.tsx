type SearchTab = 'nodes' | 'edges';

type AppGraphBottomSearchProps = {
  bottomTab: SearchTab;
  searchQuery: string;
  setSearchQuery: (value: string) => void;
  activeTypeFilter: string;
  typeOptions: string[];
  setTypeFilter: (value: string) => void;
  attributeKeyOptions: string[];
  activeAttributeKeyFilter: string;
  setAttributeKeyFilter: (value: string) => void;
  attributeValueOptions: string[];
  activeAttributeValueFilter: string;
  setAttributeValueFilter: (value: string) => void;
  formatAttributeLabel: (key: string) => string;
  showOnlySelected: boolean;
  setShowOnlySelected: (value: boolean) => void;
  hasActiveFilters: boolean;
  onClearFilters: () => void;
  filteredCount: number;
  totalCount: number;
};

const placeholders: Record<SearchTab, string> = {
  nodes: '\u041f\u043e\u0438\u0441\u043a \u043f\u043e \u0443\u0437\u043b\u0430\u043c, \u0442\u0438\u043f\u0430\u043c \u0438 \u0430\u0442\u0440\u0438\u0431\u0443\u0442\u0430\u043c',
  edges: '\u041f\u043e\u0438\u0441\u043a \u043f\u043e \u0441\u0432\u044f\u0437\u044f\u043c, \u0432\u0435\u0440\u0448\u0438\u043d\u0430\u043c \u0438 \u0430\u0442\u0440\u0438\u0431\u0443\u0442\u0430\u043c',
};

export const AppGraphBottomSearch = ({
  bottomTab,
  searchQuery,
  setSearchQuery,
  activeTypeFilter,
  typeOptions,
  setTypeFilter,
  attributeKeyOptions,
  activeAttributeKeyFilter,
  setAttributeKeyFilter,
  attributeValueOptions,
  activeAttributeValueFilter,
  setAttributeValueFilter,
  formatAttributeLabel,
  showOnlySelected,
  setShowOnlySelected,
  hasActiveFilters,
  onClearFilters,
  filteredCount,
  totalCount,
}: AppGraphBottomSearchProps) => {
  const typePlaceholder = bottomTab === 'nodes'
    ? '\u0412\u0441\u0435 \u0442\u0438\u043f\u044b \u0443\u0437\u043b\u043e\u0432'
    : '\u0412\u0441\u0435 \u0442\u0438\u043f\u044b \u0441\u0432\u044f\u0437\u0435\u0439';
  const fieldPlaceholder = bottomTab === 'nodes'
    ? '\u041b\u044e\u0431\u043e\u0435 \u043f\u043e\u043b\u0435 \u0443\u0437\u043b\u0430'
    : '\u041b\u044e\u0431\u043e\u0435 \u043f\u043e\u043b\u0435 \u0441\u0432\u044f\u0437\u0438';
  const valuePlaceholder = activeAttributeKeyFilter
    ? '\u041b\u044e\u0431\u043e\u0435 \u0437\u043d\u0430\u0447\u0435\u043d\u0438\u0435'
    : '\u0421\u043d\u0430\u0447\u0430\u043b\u0430 \u0432\u044b\u0431\u0435\u0440\u0438\u0442\u0435 \u043f\u043e\u043b\u0435';
  const selectedLabel = bottomTab === 'nodes'
    ? '\u0422\u043e\u043b\u044c\u043a\u043e \u0432\u044b\u0434\u0435\u043b\u0435\u043d\u043d\u044b\u0435 \u0443\u0437\u043b\u044b'
    : '\u0422\u043e\u043b\u044c\u043a\u043e \u0432\u044b\u0434\u0435\u043b\u0435\u043d\u043d\u044b\u0435 \u0441\u0432\u044f\u0437\u0438';

  return (
    <div className="bottom-panel-search">
      <input
        type="search"
        className="bottom-panel-search-input"
        value={searchQuery}
        onChange={(event) => setSearchQuery(event.target.value)}
        placeholder={placeholders[bottomTab]}
        aria-label={placeholders[bottomTab]}
      />
      <select
        className="bottom-panel-filter-select"
        value={activeTypeFilter}
        onChange={(event) => setTypeFilter(event.target.value)}
        aria-label={typePlaceholder}
      >
        <option value="">{typePlaceholder}</option>
        {typeOptions.map((type) => (
          <option key={type} value={type}>
            {type}
          </option>
        ))}
      </select>
      <select
        className="bottom-panel-filter-select"
        value={activeAttributeKeyFilter}
        onChange={(event) => setAttributeKeyFilter(event.target.value)}
        aria-label={fieldPlaceholder}
      >
        <option value="">{fieldPlaceholder}</option>
        {attributeKeyOptions.map((key) => (
          <option key={key} value={key}>
            {formatAttributeLabel(key)}
          </option>
        ))}
      </select>
      <select
        className="bottom-panel-filter-select"
        value={activeAttributeValueFilter}
        onChange={(event) => setAttributeValueFilter(event.target.value)}
        aria-label={valuePlaceholder}
        disabled={!activeAttributeKeyFilter}
      >
        <option value="">{valuePlaceholder}</option>
        {attributeValueOptions.map((value) => (
          <option key={value} value={value}>
            {value}
          </option>
        ))}
      </select>
      <label className="bottom-panel-filter-toggle">
        <input
          type="checkbox"
          checked={showOnlySelected}
          onChange={(event) => setShowOnlySelected(event.target.checked)}
        />
        <span>{selectedLabel}</span>
      </label>
      <div className="bottom-panel-search-meta">
        <span className="bottom-panel-search-count">
          {filteredCount === totalCount ? totalCount : `${filteredCount} \u0438\u0437 ${totalCount}`}
        </span>
        {hasActiveFilters ? (
          <button
            type="button"
            className="bottom-panel-search-clear"
            onClick={onClearFilters}
            aria-label="\u0421\u0431\u0440\u043e\u0441\u0438\u0442\u044c \u0444\u0438\u043b\u044c\u0442\u0440\u044b"
            title="\u0421\u0431\u0440\u043e\u0441\u0438\u0442\u044c \u0444\u0438\u043b\u044c\u0442\u0440\u044b"
          >
            \u0421\u0431\u0440\u043e\u0441\u0438\u0442\u044c
          </button>
        ) : null}
      </div>
    </div>
  );
};

export default AppGraphBottomSearch;
