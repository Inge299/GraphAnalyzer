import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { projectDataApi } from '../../services/api';
import './ServiceFunctionsView.css';

type ServiceCategory = 'cell_towers' | 'project_data';

interface ServiceFunctionsViewProps {
  projectId: number | null;
}

const categoryLabels: Record<ServiceCategory, string> = {
  cell_towers: 'Справочник БС',
  project_data: 'Данные проекта',
};

const defaultReferencePath = 'reference/cell_towers_full.csv';

const formatDateTime = (value: unknown): string => {
  if (!value) return '—';
  const dt = new Date(String(value));
  if (Number.isNaN(dt.getTime())) return String(value);
  return dt.toLocaleString('ru-RU');
};

const ServiceFunctionsView: React.FC<ServiceFunctionsViewProps> = ({ projectId }) => {
  const [activeCategory, setActiveCategory] = useState<ServiceCategory>('cell_towers');

  const [referencePath, setReferencePath] = useState(defaultReferencePath);
  const [cellStats, setCellStats] = useState<any | null>(null);
  const [cellStatsLoading, setCellStatsLoading] = useState(false);
  const [cellLoadLoading, setCellLoadLoading] = useState(false);
  const [cellLoadReport, setCellLoadReport] = useState<any | null>(null);

  const [projectStats, setProjectStats] = useState<any | null>(null);
  const [projectStatsLoading, setProjectStatsLoading] = useState(false);
  const [enrichLoading, setEnrichLoading] = useState(false);
  const [enrichReport, setEnrichReport] = useState<any | null>(null);

  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const fetchCellStats = useCallback(async () => {
    setCellStatsLoading(true);
    setError(null);
    try {
      const stats = await projectDataApi.cellTowerStats();
      setCellStats(stats);
    } catch (err: any) {
      setError(String(err?.response?.data?.detail || err?.message || 'Не удалось получить статистику справочника БС'));
    } finally {
      setCellStatsLoading(false);
    }
  }, []);

  const fetchProjectStats = useCallback(async () => {
    if (!projectId) {
      setProjectStats(null);
      return;
    }
    setProjectStatsLoading(true);
    setError(null);
    try {
      const stats = await projectDataApi.stats(projectId);
      setProjectStats(stats);
    } catch (err: any) {
      setError(String(err?.response?.data?.detail || err?.message || 'Не удалось получить статистику проекта'));
    } finally {
      setProjectStatsLoading(false);
    }
  }, [projectId]);
  const handleEnrichCellTowersByAddress = useCallback(async () => {
    if (!projectId) {
      setError('Сначала выбери проект');
      return;
    }
    setEnrichLoading(true);
    setEnrichReport(null);
    setMessage(null);
    setError(null);
    try {
      const report = await projectDataApi.enrichCellTowersByProjectAddresses(projectId);
      setEnrichReport(report);
      setMessage('Справочник БС обогащён по адресам из данных проекта');
      await fetchCellStats();
      await fetchProjectStats();
    } catch (err: any) {
      setError(String(err?.response?.data?.detail || err?.message || 'Не удалось обогатить справочник по адресам'));
    } finally {
      setEnrichLoading(false);
    }
  }, [projectId, fetchCellStats, fetchProjectStats]);

  useEffect(() => {
    void fetchCellStats();
  }, [fetchCellStats]);

  useEffect(() => {
    void fetchProjectStats();
  }, [fetchProjectStats]);

  const handleLoadReference = useCallback(async () => {
    const path = referencePath.trim();
    if (!path) {
      setError('Укажи путь к CSV справочника БС');
      return;
    }
    setCellLoadLoading(true);
    setMessage(null);
    setError(null);
    try {
      const report = await projectDataApi.loadCellTowers(path);
      setCellLoadReport(report);
      setMessage('Справочник БС успешно загружен');
      await fetchCellStats();
    } catch (err: any) {
      setError(String(err?.response?.data?.detail || err?.message || 'Не удалось загрузить справочник БС'));
    } finally {
      setCellLoadLoading(false);
    }
  }, [referencePath, fetchCellStats]);

  const categories = useMemo(() => (Object.keys(categoryLabels) as ServiceCategory[]), []);

  const locationCoverage = useMemo(() => {
    const total = Number(projectStats?.location_timeline_count || 0);
    const geocoded = Number(projectStats?.location_timeline_geocoded_count || 0);
    if (!total) return '0%';
    return `${((geocoded / total) * 100).toFixed(1)}%`;
  }, [projectStats]);

  return (
    <div className="service-screen">
      <aside className="service-screen-sidebar">
        <div className="service-screen-title">Сервисные функции</div>
        {categories.map((category) => (
          <button
            key={category}
            type="button"
            className={`service-screen-category ${activeCategory === category ? 'active' : ''}`}
            onClick={() => {
              setActiveCategory(category);
              setMessage(null);
              setError(null);
            }}
          >
            {categoryLabels[category]}
          </button>
        ))}
      </aside>

      <section className="service-screen-content">
        {message && <div className="service-screen-banner success">{message}</div>}
        {error && <div className="service-screen-banner error">{error}</div>}

        {activeCategory === 'cell_towers' && (
          <div className="service-card">
            <h3>Загрузка справочника базовых станций</h3>
            <p className="service-card-hint">
              Загрузка полностью заменяет текущий справочник БС. Используется при определении координат по MCC/MNC/LAC/CID и fallback LAC/CID.
            </p>

            <label className="service-label">Путь к CSV (относительно /app/data)</label>
            <div className="service-row">
              <input
                className="service-input"
                type="text"
                value={referencePath}
                onChange={(e) => setReferencePath(e.target.value)}
                placeholder="reference/cell_towers_full.csv"
              />
              <button
                type="button"
                className="service-btn primary"
                onClick={() => void handleLoadReference()}
                disabled={cellLoadLoading}
              >
                {cellLoadLoading ? 'Загрузка...' : 'Загрузить'}
              </button>
              <button
                type="button"
                className="service-btn"
                onClick={() => void fetchCellStats()}
                disabled={cellStatsLoading}
              >
                {cellStatsLoading ? 'Обновление...' : 'Обновить статистику'}
              </button>
            </div>

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

            {cellLoadReport && (
              <pre className="service-json">{JSON.stringify(cellLoadReport, null, 2)}</pre>
            )}
          </div>
        )}

        {activeCategory === 'project_data' && (
          <div className="service-card">
            <h3>Состояние данных проекта</h3>
            <p className="service-card-hint">
              Сводная статистика загруженных данных и производных таблиц по активному проекту.
            </p>

            <div className="service-row">
              <button
                type="button"
                className="service-btn"
                onClick={() => void fetchProjectStats()}
                disabled={!projectId || projectStatsLoading}
              >
                {projectStatsLoading ? 'Обновление...' : 'Обновить статистику проекта'}
              </button>
              <button
                type="button"
                className="service-btn primary"
                onClick={() => void handleEnrichCellTowersByAddress()}
                disabled={!projectId || enrichLoading}
                title="Добавить в справочник БС координаты по совпадающим адресам из данных проекта"
              >
                {enrichLoading ? 'Обогащение...' : 'Обогатить БС по адресам'}
              </button>
            </div>

            {!projectId ? (
              <div className="service-empty">Выбери проект в левой панели, чтобы увидеть статистику.</div>
            ) : (
              <>
                <div className="service-report-grid">
                  <div className="service-report-item">
                    <span>Периодов локаций (всего)</span>
                    <strong>{projectStats?.location_timeline_count ?? 0}</strong>
                  </div>
                  <div className="service-report-item">
                    <span>Периодов с координатами</span>
                    <strong>{projectStats?.location_timeline_geocoded_count ?? 0}</strong>
                  </div>
                  <div className="service-report-item">
                    <span>Покрытие геокодирования</span>
                    <strong>{locationCoverage}</strong>
                  </div>
                  <div className="service-report-item">
                    <span>Загружено записей БС</span>
                    <strong>{projectStats?.cell_tower_reference_count ?? 0}</strong>
                  </div>
                </div>
                <pre className="service-json">{JSON.stringify(projectStats ?? {}, null, 2)}</pre>
                {enrichReport && (
                  <pre className="service-json">{JSON.stringify(enrichReport, null, 2)}</pre>
                )}
              </>
            )}
          </div>
        )}
      </section>
    </div>
  );
};

export default ServiceFunctionsView;








