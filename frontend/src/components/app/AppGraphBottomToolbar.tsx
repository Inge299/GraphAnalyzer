import type { AppGraphBottomToolbarProps } from './graphBottomPanelTypes';
import { graphBottomPanelLabels } from './graphBottomPanelUtils';

export const AppGraphBottomToolbar = ({
  artifactTitle,
  bottomTab,
  setBottomTab,
  graphNodesCount,
  graphEdgesCount,
  resultsCount,
  filteredNodesCount,
  filteredEdgesCount,
  selectedNodesCount,
  selectedEdgesCount,
  hasActiveFilters,
  actions,
}: AppGraphBottomToolbarProps) => {
  const totalCount = bottomTab === 'nodes'
    ? graphNodesCount
    : bottomTab === 'edges'
      ? graphEdgesCount
      : resultsCount;

  const filteredCount = bottomTab === 'nodes' ? filteredNodesCount : filteredEdgesCount;
  const selectionCount = bottomTab === 'nodes'
    ? selectedNodesCount
    : bottomTab === 'edges'
      ? selectedEdgesCount
      : selectedNodesCount + selectedEdgesCount;

  const sectionTitle = bottomTab === 'nodes'
    ? 'Таблица узлов'
    : bottomTab === 'edges'
      ? 'Таблица связей'
      : 'Результаты анализа';

  const sectionDescription = bottomTab === 'nodes'
    ? 'Выделение и прокрутка синхронизированы с графом. Здесь удобно искать, сортировать и проверять атрибуты узлов.'
    : bottomTab === 'edges'
      ? 'Связи можно быстро фильтровать, сравнивать и сверять с выделением на схеме без потери контекста.'
      : 'Эта вкладка станет общей рабочей зоной для результатов процедур и других аналитических выборок по текущему графу.';

  return (
    <div className="bottom-panel-toolbar">
      <div className="bottom-panel-toolbar-top">
        <div className="bottom-panel-tab-group" role="tablist" aria-label="Вкладки аналитической панели">
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
          <button
            type="button"
            className={`bottom-panel-tab ${bottomTab === 'results' ? 'active' : ''}`}
            onClick={() => setBottomTab('results')}
          >
            Результаты ({resultsCount})
          </button>
        </div>

        <div className="bottom-panel-toolbar-context">
          <div className="bottom-panel-toolbar-title">{sectionTitle}</div>
          <div className="bottom-panel-toolbar-description">{sectionDescription}</div>
        </div>

        <div className="bottom-panel-toolbar-status" aria-live="polite">
          <span className="bottom-panel-status-pill">{artifactTitle}</span>
          <span className="bottom-panel-status-pill">
            {bottomTab === 'results'
              ? `${totalCount} вкладок результатов`
              : hasActiveFilters
                ? `Показано ${filteredCount} из ${totalCount}`
                : `${totalCount} записей`}
          </span>
          <span className="bottom-panel-status-pill">
            {selectionCount > 0 ? `Выделено ${selectionCount}` : 'Без выделения'}
          </span>
        </div>
      </div>

      <div className={`bottom-panel-toolbar-main ${bottomTab === 'results' ? 'results-mode' : ''}`}>
        {actions}
      </div>
    </div>
  );
};

export default AppGraphBottomToolbar;
