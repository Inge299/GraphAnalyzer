import React, { useMemo, useState } from 'react';
import type { ApiArtifact } from '../../types/api';
import { formatDateTime } from '../../utils/formatters';
import './MapView.css';

interface MapViewProps {
  artifact: ApiArtifact;
  _onUpdate: (updates: Partial<ApiArtifact>) => void;
}

type MapPoint = {
  id: string;
  sequence?: number;
  msisdn?: string;
  event_time?: string;
  latitude: number;
  longitude: number;
  address?: string;
  lac?: string;
  bs?: string;
};

const palette = ['#2563eb', '#dc2626', '#059669', '#7c3aed', '#b45309', '#0f766e'];

const MapView: React.FC<MapViewProps> = ({ artifact }) => {
  const points = useMemo(() => {
    const raw: unknown[] = Array.isArray(artifact.data?.points) ? artifact.data.points : [];
    return raw
      .filter((item: unknown): item is MapPoint => Boolean(item && typeof item === 'object' && Number.isFinite(Number((item as MapPoint).latitude)) && Number.isFinite(Number((item as MapPoint).longitude))))
      .map((item: MapPoint) => ({ ...item, latitude: Number(item.latitude), longitude: Number(item.longitude) }));
  }, [artifact.data]);
  const [selectedId, setSelectedId] = useState<string | null>(points[0]?.id || null);
  const selected = points.find((point) => point.id === selectedId) || points[0] || null;

  const viewport = useMemo(() => {
    if (!points.length) return null;
    const latitudes = points.map((point: MapPoint) => point.latitude);
    const longitudes = points.map((point: MapPoint) => point.longitude);
    const minLat = Math.min(...latitudes);
    const maxLat = Math.max(...latitudes);
    const minLng = Math.min(...longitudes);
    const maxLng = Math.max(...longitudes);
    const latSpan = Math.max(maxLat - minLat, 0.01);
    const lngSpan = Math.max(maxLng - minLng, 0.01);
    const padding = 0.12;
    const width = 960;
    const height = 600;
    const viewportMinLat = minLat - latSpan * padding;
    const viewportMaxLat = maxLat + latSpan * padding;
    const viewportMinLng = minLng - lngSpan * padding;
    const viewportMaxLng = maxLng + lngSpan * padding;
    return {
      width,
      height,
      point: (point: MapPoint) => ({
        x: 54 + ((point.longitude - viewportMinLng) / (viewportMaxLng - viewportMinLng)) * (width - 108),
        y: height - 46 - ((point.latitude - viewportMinLat) / (viewportMaxLat - viewportMinLat)) * (height - 92),
      }),
      minLat: viewportMinLat,
      maxLat: viewportMaxLat,
      minLng: viewportMinLng,
      maxLng: viewportMaxLng,
    };
  }, [points]);

  const coordinateCounts = useMemo(() => {
    const counts = new Map<string, number>();
    points.forEach((point) => {
      const key = `${point.latitude.toFixed(6)},${point.longitude.toFixed(6)}`;
      counts.set(key, (counts.get(key) || 0) + 1);
    });
    return counts;
  }, [points]);
  const groups = useMemo(() => {
    const next = new Map<string, MapPoint[]>();
    points.forEach((point: MapPoint) => {
      const key = point.msisdn || 'Не указан';
      next.set(key, [...(next.get(key) || []), point]);
    });
    return [...next.entries()];
  }, [points]);

  if (!viewport) {
    return (
      <div className="map-view">
        <div className="map-empty">
          <h2>{artifact.name}</h2>
          <p>В этом результате пока нет событий с координатами. Загрузите справочник базовых станций или уточните исходные LAC и БС.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="map-view">
      <header className="map-header">
        <div>
          <h2>{artifact.name}</h2>
          <p>{artifact.description || 'Маршрут строится по известным координатам базовых станций.'}</p>
        </div>
        <div className="map-summary">Точек: {points.length} · Абонентов: {groups.length}</div>
      </header>
      <div className="map-layout">
        <section className="map-canvas-wrap" aria-label="Схема маршрута">
          <svg className="map-canvas" viewBox={`0 0 ${viewport.width} ${viewport.height}`} role="img" aria-label="Карта событий локаций">
            <defs>
              <pattern id="map-grid" width="44" height="44" patternUnits="userSpaceOnUse">
                <path d="M 44 0 L 0 0 0 44" fill="none" stroke="#d9e2ef" strokeWidth="1" />
              </pattern>
            </defs>
            <rect width={viewport.width} height={viewport.height} fill="#f8fbff" />
            <rect width={viewport.width} height={viewport.height} fill="url(#map-grid)" />
            {groups.map(([msisdn, group], index) => {
              const color = palette[index % palette.length];
              const path = group.map((point) => viewport.point(point)).map((position, pointIndex) => `${pointIndex ? 'L' : 'M'} ${position.x} ${position.y}`).join(' ');
              return <path key={msisdn} d={path} fill="none" stroke={color} strokeWidth="2.5" strokeOpacity="0.72" />;
            })}
            {groups.map(([_msisdn, group], index) => group.map((point) => {
              const position = viewport.point(point);
              const selectedPoint = selected?.id === point.id;
              const coordinateKey = `${point.latitude.toFixed(6)},${point.longitude.toFixed(6)}`;
              const locationCount = coordinateCounts.get(coordinateKey) || 1;
              return (
                <g key={point.id} className="map-point" onClick={() => setSelectedId(point.id)}>
                  <circle cx={position.x} cy={position.y} r={selectedPoint ? 11 : 8} fill="#ffffff" stroke={palette[index % palette.length]} strokeWidth={selectedPoint ? 4 : 3} />
                  <text x={position.x} y={position.y + 4} textAnchor="middle">{locationCount > 1 ? locationCount : point.sequence || ''}</text>
                </g>
              );
            }))}
            <text x="20" y="28" className="map-axis">С: {viewport.maxLat.toFixed(4)} · З: {viewport.minLng.toFixed(4)}</text>
            <text x="20" y={viewport.height - 18} className="map-axis">Ю: {viewport.minLat.toFixed(4)} · В: {viewport.maxLng.toFixed(4)}</text>
          </svg>
          <p className="map-attribution">Схема координат. Источник: {artifact.data?.provider === 'cell_tower_reference' ? 'справочник базовых станций проекта' : 'данные артефакта'}.</p>
        </section>
        <aside className="map-details">
          <h3>Событие</h3>
          {selected ? <>
            <dl>
              <dt>MSISDN</dt><dd>{selected.msisdn || '-'}</dd>
              <dt>Время</dt><dd>{selected.event_time ? formatDateTime(selected.event_time) : '-'}</dd>
              <dt>Адрес</dt><dd>{selected.address || '-'}</dd>
              <dt>Координаты</dt><dd>{selected.latitude.toFixed(6)}, {selected.longitude.toFixed(6)}</dd>
              <dt>LAC / БС</dt><dd>{selected.lac || '-'} / {selected.bs || '-'}</dd>
            </dl>
          </> : <p>Выберите точку на карте.</p>}
          <div className="map-legend">
            <h3>Маршруты</h3>
            {groups.map(([msisdn], index) => <div key={msisdn}><span style={{ backgroundColor: palette[index % palette.length] }} />{msisdn}</div>)}
          </div>
        </aside>
      </div>
    </div>
  );
};

export default MapView;
