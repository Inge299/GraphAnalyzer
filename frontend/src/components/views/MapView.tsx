import React, { useEffect, useMemo, useRef, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import type { ApiArtifact } from '../../types/api';
import { formatDateTime } from '../../utils/formatters';
import './MapView.css';

interface MapViewProps {
  artifact: ApiArtifact;
  _onUpdate: (updates: Partial<ApiArtifact>) => void;
  dataOverride?: Record<string, unknown>;
  titleOverride?: string;
  descriptionOverride?: string;
  selectedPointId?: string | null;
  onSelectPointIds?: (pointIds: string[]) => void;
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

type MapData = {
  points?: unknown[];
  provider?: string;
  tile_url?: string;
  tile_attribution?: string;
};

const palette = ['#2563eb', '#dc2626', '#059669', '#7c3aed', '#b45309', '#0f766e'];
const defaultTileUrl = 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png';
const defaultAttribution = '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors';

const MapView: React.FC<MapViewProps> = ({ artifact, dataOverride, titleOverride, descriptionOverride, selectedPointId, onSelectPointIds }) => {
  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<L.Map | null>(null);
  const layersRef = useRef<L.LayerGroup | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const data = (dataOverride || artifact.data || {}) as MapData;
  const points = useMemo(() => {
    const raw = Array.isArray(data.points) ? data.points : [];
    return raw
      .filter((item: unknown): item is MapPoint => Boolean(item && typeof item === 'object' && Number.isFinite(Number((item as MapPoint).latitude)) && Number.isFinite(Number((item as MapPoint).longitude))))
      .map((item: MapPoint) => ({ ...item, latitude: Number(item.latitude), longitude: Number(item.longitude) }));
  }, [data.points]);
  const groups = useMemo(() => {
    const next = new Map<string, MapPoint[]>();
    points.forEach((point) => {
      const key = point.msisdn || '-';
      next.set(key, [...(next.get(key) || []), point]);
    });
    return [...next.entries()];
  }, [points]);
  const selected = points.find((point) => point.id === selectedId) || points[0] || null;
  const selectedEvents = useMemo(() => {
    if (!selected) return [] as MapPoint[];
    return points.filter((point) =>
      point.latitude.toFixed(6) === selected.latitude.toFixed(6) &&
      point.longitude.toFixed(6) === selected.longitude.toFixed(6),
    );
  }, [points, selected]);

  useEffect(() => {
    if (!points.length) return;
    setSelectedId((current) => selectedPointId && points.some((point) => point.id === selectedPointId) ? selectedPointId : points.some((point) => point.id === current) ? current : points[0].id);
  }, [points, selectedPointId]);

  useEffect(() => {
    const map = mapRef.current;
    if (map && selected) map.panTo([selected.latitude, selected.longitude], { animate: true, duration: 0.25 });
  }, [selected]);

  useEffect(() => {
    const container = mapContainerRef.current;
    if (!container || mapRef.current || !points.length) return;

    const map = L.map(container, { zoomControl: true, attributionControl: true });
    L.tileLayer(data.tile_url || defaultTileUrl, {
      maxZoom: 19,
      attribution: data.tile_attribution || defaultAttribution,
    }).addTo(map);
    mapRef.current = map;
    layersRef.current = L.layerGroup().addTo(map);

    return () => {
      map.remove();
      mapRef.current = null;
      layersRef.current = null;
    };
  }, [points.length, data.tile_url, data.tile_attribution]);

  useEffect(() => {
    const map = mapRef.current;
    const layers = layersRef.current;
    if (!map || !layers || !points.length) return;

    layers.clearLayers();
    const bounds = L.latLngBounds([]);
    groups.forEach(([msisdn, group], groupIndex) => {
      const color = palette[groupIndex % palette.length];
      const path = group.map((point) => L.latLng(point.latitude, point.longitude));
      path.forEach((position) => bounds.extend(position));
      if (path.length > 1) {
        L.polyline(path, { color, weight: 3, opacity: 0.76 }).addTo(layers);
      }

      const coordinateGroups = new Map<string, MapPoint[]>();
      group.forEach((point) => {
        const key = `${point.latitude.toFixed(6)},${point.longitude.toFixed(6)}`;
        coordinateGroups.set(key, [...(coordinateGroups.get(key) || []), point]);
      });
      coordinateGroups.forEach((samePlace) => {
        const point = samePlace[0];
        const marker = L.circleMarker([point.latitude, point.longitude], {
          radius: 7,
          color,
          weight: 3,
          fillColor: '#ffffff',
          fillOpacity: 0.96,
        }).addTo(layers);
        marker.bindTooltip(`${msisdn}: ${samePlace.length}`, { direction: 'top' });
        marker.on('click', () => { setSelectedId(point.id); onSelectPointIds?.(samePlace.map((item) => item.id)); });
      });
    });

    if (bounds.isValid()) {
      if (points.length === 1) map.setView(bounds.getCenter(), 13);
      else map.fitBounds(bounds, { padding: [32, 32], maxZoom: 15 });
    }
    window.setTimeout(() => map.invalidateSize(), 0);
  }, [groups, points.length]);

  if (!points.length) {
    return (
      <div className="map-view">
        <div className="map-empty">
          <h2>{titleOverride || artifact.name}</h2>
          <p>{'\u0412 \u044d\u0442\u043e\u043c \u0440\u0435\u0437\u0443\u043b\u044c\u0442\u0430\u0442\u0435 \u043f\u043e\u043a\u0430 \u043d\u0435\u0442 \u0441\u043e\u0431\u044b\u0442\u0438\u0439 \u0441 \u043a\u043e\u043e\u0440\u0434\u0438\u043d\u0430\u0442\u0430\u043c\u0438.'}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="map-view">
      <header className="map-header">
        <div>
          <h2>{titleOverride || artifact.name}</h2>
          <p>{descriptionOverride || artifact.description || '\u041c\u0430\u0440\u0448\u0440\u0443\u0442 \u043f\u043e \u043a\u043e\u043e\u0440\u0434\u0438\u043d\u0430\u0442\u0430\u043c \u0431\u0430\u0437\u043e\u0432\u044b\u0445 \u0441\u0442\u0430\u043d\u0446\u0438\u0439.'}</p>
        </div>
        <div className="map-summary">{`\u0422\u043e\u0447\u0435\u043a: ${points.length} \u00b7 \u0410\u0431\u043e\u043d\u0435\u043d\u0442\u043e\u0432: ${groups.length}`}</div>
      </header>
      <div className="map-layout">
        <section className="map-canvas-wrap" aria-label="location map">
          <div className="map-stage" ref={mapContainerRef} />
          <p className="map-attribution">{'\u041a\u0430\u0440\u0442\u043e\u0433\u0440\u0430\u0444\u0438\u0447\u0435\u0441\u043a\u0430\u044f \u043e\u0441\u043d\u043e\u0432\u0430 OpenStreetMap. \u0418\u0441\u0442\u043e\u0447\u043d\u0438\u043a: '} {data.provider === 'cell_tower_reference' ? '\u0441\u043f\u0440\u0430\u0432\u043e\u0447\u043d\u0438\u043a \u0431\u0430\u0437\u043e\u0432\u044b\u0445 \u0441\u0442\u0430\u043d\u0446\u0438\u0439 \u043f\u0440\u043e\u0435\u043a\u0442\u0430' : '\u0434\u0430\u043d\u043d\u044b\u0435 \u0430\u0440\u0442\u0435\u0444\u0430\u043a\u0442\u0430'}.</p>
        </section>
        <aside className="map-details">
          <h3>{'\u0421\u043e\u0431\u044b\u0442\u0438\u0435'}</h3>
          {selected ? (
            <dl>
              <dt>MSISDN</dt><dd>{selected.msisdn || '-'}</dd>
              <dt>{'\u0412\u0440\u0435\u043c\u044f'}</dt><dd>{selected.event_time ? formatDateTime(selected.event_time) : '-'}</dd>
              <dt>{'\u0410\u0434\u0440\u0435\u0441'}</dt><dd>{selected.address || '-'}</dd>
              <dt>{'\u041a\u043e\u043e\u0440\u0434\u0438\u043d\u0430\u0442\u044b'}</dt><dd>{selected.latitude.toFixed(6)}, {selected.longitude.toFixed(6)}</dd>
              <dt>LAC / {'\u0411\u0421'}</dt><dd>{selected.lac || '-'} / {selected.bs || '-'}</dd>
            </dl>
                    ) : null}
          {selectedEvents.length > 1 && (
            <div className="map-point-events">
              <h4>{`\u0421\u043e\u0431\u044b\u0442\u0438\u044f \u0432 \u0442\u043e\u0447\u043a\u0435 (${selectedEvents.length})`}</h4>
              <div className="map-point-event-times">
                {selectedEvents.map((event) => (
                  <button type="button" key={event.id} onClick={() => { setSelectedId(event.id); onSelectPointIds?.([event.id]); }}>
                    {event.event_time ? formatDateTime(event.event_time) : '-'}
                  </button>
                ))}
              </div>
            </div>
          )}
          <div className="map-legend">
            <h3>{'\u041c\u0430\u0440\u0448\u0440\u0443\u0442\u044b'}</h3>
            {groups.map(([msisdn], index) => <div key={msisdn}><span style={{ backgroundColor: palette[index % palette.length] }} />{msisdn}</div>)}
          </div>
        </aside>
      </div>
    </div>
  );
};

export default MapView;