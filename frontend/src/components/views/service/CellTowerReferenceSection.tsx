import React from 'react';

interface CellTowerReferenceSectionProps {
  cellStats: { provider_enabled?: boolean; provider_label?: string; provider_detail?: string } | null;
  cellStatsLoading: boolean;
  cellStatsError: string | null;
  onRefreshStats: () => void;
}

const CellTowerReferenceSection: React.FC<CellTowerReferenceSectionProps> = ({ cellStats, cellStatsLoading, cellStatsError, onRefreshStats }) => (
  <div className="service-card">
    <h3>Внешний справочник базовых станций</h3>
    <p className="service-card-hint">Каталог БС не хранится в базе проектов Nodex. Гео-плагины получают координаты пакетными запросами к отдельному источнику PostgreSQL.</p>
    <div className="service-report-grid">
      <div className="service-report-item"><span>Провайдер</span><strong>{cellStats?.provider_label || 'Внешний справочник БС'}</strong></div>
      <div className="service-report-item"><span>Состояние</span><strong>{cellStats?.provider_enabled ? 'Подключён' : 'Не настроен'}</strong></div>
      <div className="service-report-item"><span>Источник</span><strong>{cellStats?.provider_detail || '—'}</strong></div>
    </div>
    <div className="service-row"><button type="button" className="service-btn" onClick={onRefreshStats} disabled={cellStatsLoading}>{cellStatsLoading ? 'Проверка...' : 'Проверить подключение'}</button></div>
    <p className="service-card-hint">Настройка: <code>CELL_TOWER_REFERENCE_DSN</code>, <code>CELL_TOWER_REFERENCE_TABLE</code>. CSV загружается и обслуживается вне Nodex.</p>
    {cellStatsError ? <p className="service-inline-error">{cellStatsError}</p> : null}
  </div>
);

export default CellTowerReferenceSection;