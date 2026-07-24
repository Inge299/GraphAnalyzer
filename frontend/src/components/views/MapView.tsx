import React, { useEffect, useMemo, useRef, useState } from 'react';
import * as maplibregl from 'maplibre-gl';
import { LngLatBounds, type Map as MapLibreMap, type MapLayerMouseEvent } from 'maplibre-gl';
import { Protocol } from 'pmtiles';
import 'maplibre-gl/dist/maplibre-gl.css';
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
  pmtiles_url?: string;
  map_style_url?: string;
};

const palette = ['#2563eb', '#dc2626', '#059669', '#7c3aed', '#b45309', '#0f766e'];
const defaultPmtilesUrl = import.meta.env.VITE_PMTILES_URL || '';
const defaultStyleUrl = import.meta.env.VITE_MAP_STYLE_URL || '';
const defaultGlyphsUrl = import.meta.env.VITE_MAP_GLYPHS_URL || '';
const pmtilesProtocol = new Protocol();
maplibregl.addProtocol('pmtiles', pmtilesProtocol.tile);

const makeFallbackStyle = (pmtilesUrl: string): maplibregl.StyleSpecification => ({
  version: 8,
  sources: pmtilesUrl ? { russia: { type: 'vector', url: `pmtiles://${pmtilesUrl}` } } : { osm: { type: 'raster', tiles: ['https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png'], tileSize: 256, attribution: '&copy; OpenStreetMap contributors' } },
  glyphs: defaultGlyphsUrl || undefined,
  layers: pmtilesUrl ? [
    { id: 'background', type: 'background', paint: { 'background-color': '#f2efe9' } },
    { id: 'water', type: 'fill', source: 'russia', 'source-layer': 'water', paint: { 'fill-color': '#a0c8e0' } },
    { id: 'water-name', type: 'symbol', source: 'russia', 'source-layer': 'water_name', layout: { 'text-field': ['coalesce', ['get', 'name:ru'], ['get', 'name']], 'text-font': ['Open Sans Regular'], 'text-size': 11, 'symbol-placement': 'line' }, paint: { 'text-color': '#4c7899', 'text-halo-color': '#ffffff', 'text-halo-width': 1 } },
    { id: 'landuse', type: 'fill', source: 'russia', 'source-layer': 'landuse', paint: { 'fill-color': '#d0e0b0', 'fill-opacity': 0.72 } },
    { id: 'boundary', type: 'line', source: 'russia', 'source-layer': 'boundary', paint: { 'line-color': '#8b8b8b', 'line-width': 1, 'line-dasharray': [2, 2] } },
    { id: 'roads', type: 'line', source: 'russia', 'source-layer': 'transportation', paint: { 'line-color': '#888888', 'line-width': ['interpolate', ['linear'], ['zoom'], 5, 0.6, 12, 2.4, 17, 4] } },
    { id: 'roads-name', type: 'symbol', source: 'russia', 'source-layer': 'transportation_name', layout: { 'text-field': ['coalesce', ['get', 'name:ru'], ['get', 'name']], 'text-font': ['Open Sans Regular'], 'text-size': 11, 'symbol-placement': 'line' }, paint: { 'text-color': '#595959', 'text-halo-color': '#ffffff', 'text-halo-width': 1 } },
    { id: 'buildings', type: 'fill', source: 'russia', 'source-layer': 'building', minzoom: 13, paint: { 'fill-color': '#d4b28c', 'fill-opacity': 0.5, 'fill-outline-color': '#c39f79' } },
    { id: 'place-labels', type: 'symbol', source: 'russia', 'source-layer': 'place', layout: { 'text-field': ['coalesce', ['get', 'name:ru'], ['get', 'name']], 'text-font': ['Open Sans Regular'], 'text-size': ['interpolate', ['linear'], ['zoom'], 5, 11, 12, 16], 'text-max-width': 8 }, paint: { 'text-color': '#303030', 'text-halo-color': '#ffffff', 'text-halo-width': 1.4 } },
    { id: 'housenumbers', type: 'symbol', source: 'russia', 'source-layer': 'housenumber', minzoom: 17, layout: { 'text-field': ['get', 'housenumber'], 'text-font': ['Open Sans Regular'], 'text-size': 10 }, paint: { 'text-color': '#222222', 'text-halo-color': '#ffffff', 'text-halo-width': 1.2 } },
  ] : [{ id: 'background', type: 'background', paint: { 'background-color': '#f2efe9' } }, { id: 'osm-raster', type: 'raster', source: 'osm' }],
});

const MapView: React.FC<MapViewProps> = ({ artifact, dataOverride, titleOverride, descriptionOverride, selectedPointId, onSelectPointIds }) => {
  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
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
    return points.filter((point) => point.latitude.toFixed(6) === selected.latitude.toFixed(6) && point.longitude.toFixed(6) === selected.longitude.toFixed(6));
  }, [points, selected]);
  const pmtilesUrl = data.pmtiles_url || defaultPmtilesUrl;
  const style = data.map_style_url || defaultStyleUrl || makeFallbackStyle(pmtilesUrl);

  useEffect(() => {
    if (!points.length) return;
    setSelectedId((current) => selectedPointId && points.some((point) => point.id === selectedPointId) ? selectedPointId : points.some((point) => point.id === current) ? current : points[0].id);
  }, [points, selectedPointId]);

  useEffect(() => {
    const container = mapContainerRef.current;
    if (!container || mapRef.current || !points.length) return;
    const map = new maplibregl.Map({ container, style, zoom: 9 });
    map.addControl(new maplibregl.NavigationControl(), 'top-right');
    map.on('load', () => {
      map.addSource('routes', { type: 'geojson', data: { type: 'FeatureCollection', features: [] } });
      map.addSource('locations', { type: 'geojson', data: { type: 'FeatureCollection', features: [] } });
      map.addLayer({ id: 'routes-line', type: 'line', source: 'routes', paint: { 'line-color': ['get', 'color'], 'line-width': 3, 'line-opacity': 0.78 } });
      map.addLayer({ id: 'locations-point', type: 'circle', source: 'locations', paint: { 'circle-radius': 7, 'circle-color': '#ffffff', 'circle-stroke-color': ['get', 'color'], 'circle-stroke-width': 3 } });
      map.on('click', 'locations-point', (event: MapLayerMouseEvent) => {
        const point = event.features?.[0]?.properties;
        const ids = String(point?.ids || '').split(',').filter(Boolean);
        if (ids.length) { setSelectedId(ids[0]); onSelectPointIds?.(ids); }
      });
      map.on('mouseenter', 'locations-point', () => { map.getCanvas().style.cursor = 'pointer'; });
      map.on('mouseleave', 'locations-point', () => { map.getCanvas().style.cursor = ''; });
    });
    mapRef.current = map;
    return () => { map.remove(); mapRef.current = null; };
  }, [points.length, pmtilesUrl, data.map_style_url, defaultStyleUrl]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !map.isStyleLoaded() || !points.length || !map.getSource('locations')) return;
    const pointFeatures: GeoJSON.Feature<GeoJSON.Point>[] = [];
    const routeFeatures: GeoJSON.Feature<GeoJSON.LineString>[] = [];
    const bounds = new LngLatBounds();
    groups.forEach(([msisdn, group], groupIndex) => {
      const color = palette[groupIndex % palette.length];
      group.forEach((point) => bounds.extend([point.longitude, point.latitude]));
      if (group.length > 1) routeFeatures.push({ type: 'Feature', properties: { color }, geometry: { type: 'LineString', coordinates: group.map((point) => [point.longitude, point.latitude]) } });
      const places = new Map<string, MapPoint[]>();
      group.forEach((point) => { const key = `${point.latitude.toFixed(6)},${point.longitude.toFixed(6)}`; places.set(key, [...(places.get(key) || []), point]); });
      places.forEach((samePlace) => {
        const point = samePlace[0];
        pointFeatures.push({ type: 'Feature', properties: { color, msisdn, ids: samePlace.map((item) => item.id).join(',') }, geometry: { type: 'Point', coordinates: [point.longitude, point.latitude] } });
      });
    });
    (map.getSource('routes') as maplibregl.GeoJSONSource).setData({ type: 'FeatureCollection', features: routeFeatures });
    (map.getSource('locations') as maplibregl.GeoJSONSource).setData({ type: 'FeatureCollection', features: pointFeatures });
    if (!bounds.isEmpty()) map.fitBounds(bounds, { padding: 32, maxZoom: 15, duration: 0 });
  }, [groups, points]);

  useEffect(() => {
    const map = mapRef.current;
    if (map && selected) map.flyTo({ center: [selected.longitude, selected.latitude], duration: 280 });
  }, [selected]);

  if (!points.length) return <div className="map-view"><div className="map-empty"><h2>{titleOverride || artifact.name}</h2><p>В этом результате пока нет событий с координатами.</p></div></div>;

  return (
    <div className="map-view">
      <header className="map-header"><div><h2>{titleOverride || artifact.name}</h2><p>{descriptionOverride || artifact.description || 'Маршрут по координатам базовых станций.'}</p></div><div className="map-summary">{`Точек: ${points.length} · Абонентов: ${groups.length}`}</div></header>
      <div className="map-layout">
        <section className="map-canvas-wrap" aria-label="location map"><div className="map-stage" ref={mapContainerRef} /><p className="map-attribution">Картографическая основа: {pmtilesUrl ? 'внутренний PMTiles' : 'не настроена'}. Источник: {data.provider === 'cell_tower_reference' ? 'справочник базовых станций проекта' : 'данные артефакта'}.</p></section>
        <aside className="map-details"><h3>Событие</h3>{selected ? <dl><dt>MSISDN</dt><dd>{selected.msisdn || '-'}</dd><dt>Адрес</dt><dd>{selected.address || '-'}</dd><dt>Координаты</dt><dd>{selected.latitude.toFixed(6)}, {selected.longitude.toFixed(6)}</dd><dt>LAC / БС</dt><dd>{selected.lac || '-'} / {selected.bs || '-'}</dd></dl> : null}
          <div className="map-point-events"><h4>{`События в точке (${selectedEvents.length})`}</h4><div className="map-point-event-times">{selectedEvents.map((event) => <button type="button" key={event.id} onClick={() => { setSelectedId(event.id); onSelectPointIds?.([event.id]); }}>{event.event_time ? formatDateTime(event.event_time) : '-'}</button>)}</div></div>
          <div className="map-legend"><h3>Маршруты</h3>{groups.map(([msisdn], index) => <div key={msisdn}><span style={{ backgroundColor: palette[index % palette.length] }} />{msisdn}</div>)}</div>
        </aside>
      </div>
    </div>
  );
};

export default MapView;
