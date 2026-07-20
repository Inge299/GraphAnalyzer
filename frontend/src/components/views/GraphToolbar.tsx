import React from 'react';

interface GraphToolbarProps {
  canUndo?: boolean;
  canRedo?: boolean;
  canCopySelection?: boolean;
  canCopyLabels?: boolean;
  canPasteSelection?: boolean;
  canExportPng?: boolean;
  hasGraphContent?: boolean;
  labelsHidden?: boolean;
  selectedCount?: number;
  nodesCount?: number;
  edgesCount?: number;
  onUndo: () => void;
  onRedo: () => void;
  onCopySelection: () => void;
  onCopyLabels: () => void;
  onPasteSelection: () => void;
  onAutoLayout: () => void;
  onBalancedLayout: () => void;
  onFit: () => void;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onResetView: () => void;
  onToggleLabels: () => void;
  onExportPng: () => void;
  version: number | string;
}

type ToolbarButtonProps = {
  label: string;
  title: string;
  onClick: () => void;
  disabled?: boolean;
  active?: boolean;
};

const ToolbarButton: React.FC<ToolbarButtonProps> = ({
  label,
  title,
  onClick,
  disabled = false,
  active = false,
}) => (
  <button
    type="button"
    className={`graph-toolbar-button${active ? ' active' : ''}`}
    onClick={onClick}
    disabled={disabled}
    title={title}
  >
    {label}
  </button>
);

export const GraphToolbar: React.FC<GraphToolbarProps> = ({
  canUndo = false,
  canRedo = false,
  canCopySelection = false,
  canCopyLabels = false,
  canPasteSelection = false,
  canExportPng = false,
  hasGraphContent = false,
  labelsHidden = false,
  selectedCount = 0,
  nodesCount = 0,
  edgesCount = 0,
  onUndo,
  onRedo,
  onCopySelection,
  onCopyLabels,
  onPasteSelection,
  onAutoLayout,
  onBalancedLayout,
  onFit,
  onZoomIn,
  onZoomOut,
  onResetView,
  onToggleLabels,
  onExportPng,
  version,
}) => {
  return (
    <div className="graph-toolbar">
      <div className="graph-toolbar-group">
        <ToolbarButton
          label="Отменить"
          title="Отменить последнее изменение (Ctrl+Z)"
          onClick={onUndo}
          disabled={!canUndo}
        />
        <ToolbarButton
          label="Повторить"
          title="Повторить отменённое изменение (Ctrl+Y)"
          onClick={onRedo}
          disabled={!canRedo}
        />
      </div>

      <div className="graph-toolbar-divider" />

      <div className="graph-toolbar-group">
        <ToolbarButton
          label="Копировать"
          title="Скопировать выделенные объекты графа"
          onClick={onCopySelection}
          disabled={!canCopySelection}
        />
        <ToolbarButton
          label="Подписи"
          title="Скопировать подписи выделенных объектов"
          onClick={onCopyLabels}
          disabled={!canCopyLabels}
        />
        <ToolbarButton
          label="Вставить"
          title="Вставить ранее скопированные объекты графа"
          onClick={onPasteSelection}
          disabled={!canPasteSelection}
        />
      </div>

      <div className="graph-toolbar-divider" />

      <div className="graph-toolbar-group">
        <ToolbarButton
          label="Авто"
          title="Автоматически разложить граф"
          onClick={onAutoLayout}
          disabled={!hasGraphContent}
        />
        <ToolbarButton
          label="Баланс"
          title="Сбалансированная раскладка графа"
          onClick={onBalancedLayout}
          disabled={!hasGraphContent}
        />
        <ToolbarButton
          label="Вписать"
          title="Показать весь граф"
          onClick={onFit}
          disabled={!hasGraphContent}
        />
        <ToolbarButton
          label="+"
          title="Увеличить масштаб"
          onClick={onZoomIn}
          disabled={!hasGraphContent}
        />
        <ToolbarButton
          label="-"
          title="Уменьшить масштаб"
          onClick={onZoomOut}
          disabled={!hasGraphContent}
        />
        <ToolbarButton
          label="Сброс"
          title="Сбросить положение и масштаб"
          onClick={onResetView}
          disabled={!hasGraphContent}
        />
        <ToolbarButton
          label="Метки"
          title="Показать или скрыть подписи на графе"
          onClick={onToggleLabels}
          disabled={!hasGraphContent}
          active={!labelsHidden}
        />
      </div>

      <div className="graph-toolbar-divider" />

      <div className="graph-toolbar-group">
        <ToolbarButton
          label="PNG"
          title="Сохранить текущее изображение графа"
          onClick={onExportPng}
          disabled={!canExportPng}
        />
      </div>

      <div className="graph-toolbar-spacer" />

      <div className="graph-toolbar-status" aria-label="Статус графа">
        <span className="graph-toolbar-chip">Выделено: {selectedCount}</span>
        <span className="graph-toolbar-chip">Узлов: {nodesCount}</span>
        <span className="graph-toolbar-chip">Связей: {edgesCount}</span>
        <span className="graph-toolbar-version">v{version}</span>
      </div>
    </div>
  );
};

export default GraphToolbar;
