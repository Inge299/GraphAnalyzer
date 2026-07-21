import React from 'react';

interface CellTowerReferenceSectionProps {
  referencePath: string;
  onReferencePathChange: (value: string) => void;
  onLoadReference: () => void;
  onRefreshStats: () => void;
  cellLoadLoading: boolean;
  cellStatsLoading: boolean;
  cellLoadReport: unknown | null;
  cellStats: {
    cell_tower_reference_count?: number;
    last_loaded_at?: unknown;
  } | null;
  cellStatsError: string | null;
  formatDateTime: (value: unknown) => string;
}

const CellTowerReferenceSection: React.FC<CellTowerReferenceSectionProps> = ({
  referencePath,
  onReferencePathChange,
  onLoadReference,
  onRefreshStats,
  cellLoadLoading,
  cellStatsLoading,
  cellLoadReport,
  cellStats,
  cellStatsError,
  formatDateTime,
}) => (
  <div className="service-card">
    <h3>Загрузка справочника базовых станций</h3>
    <p className="service-card-hint">
      Загрузка полностью заменяет текущий справочник БС. Он используется при определении координат по MCC/MNC/LAC/CID и fallback LAC/CID.
    </p>

    <label className="service-label">Путь к CSV (относительно /app/data)</label>
    <div className="service-row">
      <input
        className="service-input"
        type="text"
        value={referencePath}
        onChange={(event) => onReferencePathChange(event.target.value)}
        placeholder="reference/cell_towers_full.csv"
      />
      <button
        type="button"
        className="service-btn primary"
        onClick={onLoadReference}
        disabled={cellLoadLoading}
      >
        {cellLoadLoading ? 'Загрузка...' : 'Загрузить'}
      </button>
      <button
        type="button"
        className="service-btn"
        onClick={onRefreshStats}
        disabled={cellStatsLoading}
      >
        {cellStatsLoading ? 'Обновление...' : 'Обновить статистику'}
      </button>
    </div>

    {cellStatsError ? <p className="service-inline-error">{cellStatsError}</p> : null}

    <div className="service-report-grid">
      <div className="service-report-item">
        <span>Записей в справочнике</span>
        <strong>{cellStats?.cell_tower_reference_count ?? 0}</strong>
      </div>
      <div className="service-report-item">
        <span>Последняя загрузка</span>
        <strong>{formatDateTime(cellStats?.last_loaded_at)}</strong>
      </div>
    </div>

    {cellLoadReport != null && (
      <pre className="service-json">{JSON.stringify(cellLoadReport, null, 2)}</pre>
    )}
  </div>
);

export default CellTowerReferenceSection;
