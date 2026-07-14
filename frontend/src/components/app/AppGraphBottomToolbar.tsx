import type { AppGraphBottomToolbarProps } from './graphBottomPanelTypes';
import { graphBottomPanelLabels } from './graphBottomPanelUtils';

export const AppGraphBottomToolbar = ({
  bottomTab,
  setBottomTab,
  graphNodesCount,
  graphEdgesCount,
  filteredNodesCount,
  filteredEdgesCount,
  hasActiveFilters,
  actions,
}: AppGraphBottomToolbarProps) => {
  const totalCount = bottomTab === 'nodes' ? graphNodesCount : graphEdgesCount;
  const filteredCount = bottomTab === 'nodes' ? filteredNodesCount : filteredEdgesCount;

  return (
    <div className="bottom-panel-tabs">
      <div className="bottom-panel-tab-group">
        <button
          type="button"
          className={`bottom-panel-tab ${bottomTab === 'nodes' ? 'active' : ''}`}
          onClick={() => setBottomTab('nodes')}
        >
          {graphBottomPanelLabels.nodes} ({graphNodesCount})
        </button>
        <button
          type="button"
          className={`bottom-panel-tab ${bottomTab === 'edges' ? 'active' : ''}`}
          onClick={() => setBottomTab('edges')}
        >
          {graphBottomPanelLabels.edges} ({graphEdgesCount})
        </button>
      </div>
      <div className="bottom-panel-toolbar-main">
        {actions}
        <div className="bottom-panel-toolbar-status" aria-live="polite">
          {hasActiveFilters
            ? `\u041d\u0430\u0439\u0434\u0435\u043d\u043e ${filteredCount} \u0438\u0437 ${totalCount}`
            : `${totalCount} \u0437\u0430\u043f\u0438\u0441\u0435\u0439`}
        </div>
      </div>
    </div>
  );
};

export default AppGraphBottomToolbar;
