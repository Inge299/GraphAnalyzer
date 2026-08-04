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
  showRouteTable?: boolean;
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
  source?: { provider_label?: string };
};

const palette = ['#2563eb', '#dc2626', '#059669', '#7c3aed', '#b45309', '#0f766e'];
const runtimeConfig = window.__NODEX_RUNTIME_CONFIG__ || {};
const defaultPmtilesUrl = runtimeConfig.pmtilesUrl || import.meta.env.VITE_PMTILES_URL || '';
const defaultStyleUrl = runtimeConfig.mapStyleUrl || import.meta.env.VITE_MAP_STYLE_URL || '';
const defaultGlyphsUrl = runtimeConfig.mapGlyphsUrl || import.meta.env.VITE_MAP_GLYPHS_URL || '';
const mapMode = runtimeConfig.mapMode || (defaultPmtilesUrl ? 'local' : 'online');
const pmtilesProtocol = new Protocol();
maplibregl.addProtocol('pmtiles', pmtilesProtocol.tile);

const makeFallbackStyle = (pmtilesUrl: string): maplibregl.StyleSpecification => ({
  version: 8,
  sources: pmtilesUrl
    ? { russia: { type: 'vector', url: 'pmtiles://' + pmtilesUrl } }
    : mapMode === 'online'
      ? { osm: { type: 'raster', tiles: ['https://tile.openstreetmap.org/{z}/{x}/{y}.png'], tileSize: 256, maxzoom: 19, attribution: '&copy; OpenStreetMap contributors' } }
      : {},
  ...(defaultGlyphsUrl ? { glyphs: defaultGlyphsUrl } : {}),
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
  ] : mapMode === 'online'
    ? [{ id: 'background', type: 'background', paint: { 'background-color': '#f2efe9' } }, { id: 'osm-raster', type: 'raster', source: 'osm' }]
    : [{ id: 'background', type: 'background', paint: { 'background-color': '#f2efe9' } }],
});

const updateMapOverlays = (map: MapLibreMap, groups: Array<[string, MapPoint[]]>, fitToRoute = false) => {
  if (!map.getSource('locations') || !map.getSource('routes')) return;

  const pointFeatures: GeoJSON.Feature<GeoJSON.Point>[] = [];
  const routeFeatures: GeoJSON.Feature<GeoJSON.LineString>[] = [];
  const bounds = new LngLatBounds();

  groups.forEach(([msisdn, group], groupIndex) => {
    const color = palette[groupIndex % palette.length];
    group.forEach((point) => bounds.extend([point.longitude, point.latitude]));
    if (group.length > 1) {
      routeFeatures.push({
        type: 'Feature',
        properties: { color },
        geometry: { type: 'LineString', coordinates: group.map((point) => [point.longitude, point.latitude]) },
      });
    }
    const places = new Map<string, MapPoint[]>();
    group.forEach((point) => {
      const key = [point.latitude.toFixed(6), point.longitude.toFixed(6)].join(',');
      places.set(key, [...(places.get(key) || []), point]);
    });
    places.forEach((samePlace) => {
      const point = samePlace[0];
      pointFeatures.push({
        type: 'Feature',
        properties: { color, msisdn, ids: samePlace.map((item) => item.id).join(',') },
        geometry: { type: 'Point', coordinates: [point.longitude, point.latitude] },
      });
    });
  });

  (map.getSource('routes') as maplibregl.GeoJSONSource).setData({ type: 'FeatureCollection', features: routeFeatures });
  (map.getSource('locations') as maplibregl.GeoJSONSource).setData({ type: 'FeatureCollection', features: pointFeatures });
  if (fitToRoute && !bounds.isEmpty()) map.fitBounds(bounds, { padding: 32, maxZoom: 15, duration: 0 });
};

const MapView: React.FC<MapViewProps> = ({ artifact, dataOverride, titleOverride, descriptionOverride, selectedPointId, onSelectPointIds, showRouteTable = true }) => {
  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const markerRefs = useRef<maplibregl.Marker[]>([]);
  const routeOverlayRef = useRef<SVGSVGElement | null>(null);
  const routeOverlayCleanupRef = useRef<(() => void) | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [mapError, setMapError] = useState<string | null>(null);
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

  const syncLocationMarkers = (map: MapLibreMap) => {
    markerRefs.current.forEach((marker) => marker.remove());
    markerRefs.current = points.map((point) => {
      const element = document.createElement('button');
      element.type = 'button';
      element.className = `map-location-marker${point.id === selectedId ? ' is-selected' : ''}`;
      element.title = `${point.msisdn || 'MSISDN'} · ${point.event_time ? formatDateTime(point.event_time) : 'время не указано'}`;
      element.textContent = point.sequence ? String(point.sequence) : '•';
      element.addEventListener('click', (event) => {
        event.preventDefault();
        event.stopPropagation();
        setSelectedId(point.id);
        onSelectPointIds?.([point.id]);
      });
      return new maplibregl.Marker({ element, anchor: 'center' })
        .setLngLat([point.longitude, point.latitude])
        .addTo(map);
    });
  };

  const syncRouteOverlay = (map: MapLibreMap) => {
    routeOverlayCleanupRef.current?.();
    const container = map.getContainer();
    let svg = routeOverlayRef.current;
    if (!svg) {
      svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
      svg.classList.add('map-route-overlay');
      container.appendChild(svg);
      routeOverlayRef.current = svg;
    }

    const redraw = () => {
      const rect = container.getBoundingClientRect();
      svg?.setAttribute('viewBox', `0 0 ${rect.width} ${rect.height}`);
      svg?.setAttribute('width', String(rect.width));
      svg?.setAttribute('height', String(rect.height));
      if (!svg) return;
      svg.replaceChildren();
      groups.forEach(([, group], groupIndex) => {
        const projected = group.map((point) => map.project([point.longitude, point.latitude]));
        const unique = projected.filter((point, index) => index === 0 || point.x !== projected[index - 1].x || point.y !== projected[index - 1].y);
        if (unique.length < 2) return;
        const polyline = document.createElementNS('http://www.w3.org/2000/svg', 'polyline');
        polyline.setAttribute('points', unique.map((point) => `${point.x},${point.y}`).join(' '));
        polyline.setAttribute('fill', 'none');
        polyline.setAttribute('stroke', palette[groupIndex % palette.length]);
        polyline.setAttribute('stroke-width', '4');
        polyline.setAttribute('stroke-linecap', 'round');
        polyline.setAttribute('stroke-linejoin', 'round');
        polyline.setAttribute('opacity', '0.9');
        svg.appendChild(polyline);
      });
    };

    redraw();
    map.on('move', redraw);
    map.on('resize', redraw);
    routeOverlayCleanupRef.current = () => {
      map.off('move', redraw);
      map.off('resize', redraw);
    };
  };
  const selected = points.find((point) => point.id === selectedId) || points[0] || null;
  const selectedEvents = useMemo(() => {
    if (!selected) return [] as MapPoint[];
    return points.filter((point) => point.latitude.toFixed(6) === selected.latitude.toFixed(6) && point.longitude.toFixed(6) === selected.longitude.toFixed(6));
  }, [points, selected]);

  const pmtilesUrl = data.pmtiles_url || defaultPmtilesUrl;
  const style = defaultStyleUrl || (mapMode === 'online' ? data.map_style_url : '') || makeFallbackStyle(pmtilesUrl);

  useEffect(() => {
    if (!points.length) return;
    setSelectedId((current) => selectedPointId && points.some((point) => point.id === selectedPointId) ? selectedPointId : points.some((point) => point.id === current) ? current : points[0].id);
  }, [points, selectedPointId]);

  useEffect(() => {
    const container = mapContainerRef.current;
    if (!container || mapRef.current || !points.length) return;

    const map = new maplibregl.Map({ container, style, zoom: 9, maxZoom: pmtilesUrl ? 22 : 19 });
    let overlaysInstalled = false;
    setMapError(null);
    map.addControl(new maplibregl.NavigationControl(), 'top-right');
    map.on('error', (event) => {
      const message = event.error?.message || '';
      if (message) setMapError(message);
    });
    map.on('load', () => {
      if (overlaysInstalled) return;
      overlaysInstalled = true;
      map.addSource('routes', { type: 'geojson', data: { type: 'FeatureCollection', features: [] } });
      map.addSource('locations', { type: 'geojson', data: { type: 'FeatureCollection', features: [] } });
      map.addLayer({ id: 'routes-line', type: 'line', source: 'routes', paint: { 'line-color': '#1d4ed8', 'line-width': 5, 'line-opacity': 0.9 } });
      map.addLayer({ id: 'locations-point', type: 'circle', source: 'locations', paint: { 'circle-radius': 8, 'circle-color': '#ffffff', 'circle-stroke-color': '#1d4ed8', 'circle-stroke-width': 3 } });
      map.on('click', 'locations-point', (event: MapLayerMouseEvent) => {
        const point = event.features?.[0]?.properties;
        const ids = String(point?.ids || '').split(',').filter(Boolean);
        if (ids.length) {
          setSelectedId(ids[0]);
          onSelectPointIds?.(ids);
        }
      });
      map.on('mouseenter', 'locations-point', () => { map.getCanvas().style.cursor = 'pointer'; });
      map.on('mouseleave', 'locations-point', () => { map.getCanvas().style.cursor = ''; });
      updateMapOverlays(map, groups, true);
      syncLocationMarkers(map);
      syncRouteOverlay(map);
      map.once('idle', () => updateMapOverlays(map, groups, true));
      requestAnimationFrame(() => map.resize());
    });

    mapRef.current = map;
    return () => {
      routeOverlayCleanupRef.current?.();
      routeOverlayCleanupRef.current = null;
      routeOverlayRef.current?.remove();
      routeOverlayRef.current = null;
      markerRefs.current.forEach((marker) => marker.remove());
      markerRefs.current = [];
      map.remove();
      mapRef.current = null;
    };
  }, [points.length, pmtilesUrl, data.map_style_url, defaultStyleUrl]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !points.length) return;
    updateMapOverlays(map, groups);
    syncLocationMarkers(map);
    syncRouteOverlay(map);
  }, [groups, selectedId]);

  useEffect(() => {
    const map = mapRef.current;
    if (map && selected) map.easeTo({ center: [selected.longitude, selected.latitude], zoom: map.getZoom(), duration: 280 });
  }, [selected]);

  if (!points.length) {
    return <div className="map-view"><div className="map-empty"><h2>{titleOverride || artifact.name}</h2><p>{'\u0412 \u044d\u0442\u043e\u043c \u0440\u0435\u0437\u0443\u043b\u044c\u0442\u0430\u0442\u0435 \u043f\u043e\u043a\u0430 \u043d\u0435\u0442 \u0441\u043e\u0431\u044b\u0442\u0438\u0439 \u0441 \u043a\u043e\u043e\u0440\u0434\u0438\u043d\u0430\u0442\u0430\u043c\u0438.'}</p></div></div>;
  }

  return (
    <div className="map-view">
      <header className="map-header">
        <div>
          <h2>{titleOverride || artifact.name}</h2>
          <p>{descriptionOverride || artifact.description || '\u041c\u0430\u0440\u0448\u0440\u0443\u0442 \u043f\u043e \u043a\u043e\u043e\u0440\u0434\u0438\u043d\u0430\u0442\u0430\u043c \u0431\u0430\u0437\u043e\u0432\u044b\u0445 \u0441\u0442\u0430\u043d\u0446\u0438\u0439.'}</p>
        </div>
        <div className="map-summary">{'\u0422\u043e\u0447\u0435\u043a: ' + points.length + ' \u00b7 \u0410\u0431\u043e\u043d\u0435\u043d\u0442\u043e\u0432: ' + groups.length}</div>
      </header>
      <div className="map-layout">
        <section className="map-canvas-wrap" aria-label="location map">
          <div className="map-stage" ref={mapContainerRef} />
          {mapError ? <div className="map-load-error">{'\u041d\u0435 \u0443\u0434\u0430\u043b\u043e\u0441\u044c \u0437\u0430\u0433\u0440\u0443\u0437\u0438\u0442\u044c \u043a\u0430\u0440\u0442\u043e\u0433\u0440\u0430\u0444\u0438\u0447\u0435\u0441\u043a\u0438\u0439 \u0441\u043b\u043e\u0439'}: {mapError}</div> : null}
          <p className="map-attribution">
            {'\u041a\u0430\u0440\u0442\u043e\u0433\u0440\u0430\u0444\u0438\u0447\u0435\u0441\u043a\u0430\u044f \u043e\u0441\u043d\u043e\u0432\u0430: '}
            {pmtilesUrl ? '\u0432\u043d\u0443\u0442\u0440\u0435\u043d\u043d\u0438\u0439 PMTiles' : mapMode === 'online' ? 'онлайн OpenStreetMap' : '\u043d\u0435 \u043d\u0430\u0441\u0442\u0440\u043e\u0435\u043d\u0430'}.
            {' \u0418\u0441\u0442\u043e\u0447\u043d\u0438\u043a: '}
            {data.provider === 'external_cell_tower_reference' ? (data.source?.provider_label || '\u0432\u043d\u0435\u0448\u043d\u0438\u0439 \u0441\u043f\u0440\u0430\u0432\u043e\u0447\u043d\u0438\u043a \u0431\u0430\u0437\u043e\u0432\u044b\u0445 \u0441\u0442\u0430\u043d\u0446\u0438\u0439') : data.provider === 'local_cell_tower_reference' || data.provider === 'cell_tower_reference' ? '\u043b\u043e\u043a\u0430\u043b\u044c\u043d\u044b\u0439 \u0441\u043f\u0440\u0430\u0432\u043e\u0447\u043d\u0438\u043a \u0431\u0430\u0437\u043e\u0432\u044b\u0445 \u0441\u0442\u0430\u043d\u0446\u0438\u0439' : data.provider === 'project_cell_tower_geocoding' ? '\u043f\u0440\u043e\u0435\u043a\u0442\u043d\u043e\u0435 \u043e\u0431\u043e\u0433\u0430\u0449\u0435\u043d\u0438\u0435 \u0430\u0434\u0440\u0435\u0441\u043e\u0432 \u0411\u0421' : '\u0434\u0430\u043d\u043d\u044b\u0435 \u0430\u0440\u0442\u0435\u0444\u0430\u043a\u0442\u0430'}.
          </p>
        </section>
        <aside className="map-details">
          <h3>{'\u0421\u043e\u0431\u044b\u0442\u0438\u0435'}</h3>
          {selected ? <dl>
            <dt>MSISDN</dt><dd>{selected.msisdn || '-'}</dd>
            <dt>{'\u0410\u0434\u0440\u0435\u0441'}</dt><dd>{selected.address || '-'}</dd>
            <dt>{'\u041a\u043e\u043e\u0440\u0434\u0438\u043d\u0430\u0442\u044b'}</dt><dd>{selected.latitude.toFixed(6)}, {selected.longitude.toFixed(6)}</dd>
            <dt>LAC / {'\u0411\u0421'}</dt><dd>{selected.lac || '-'} / {selected.bs || '-'}</dd>
          </dl> : null}
          <div className="map-point-events">
            <h4>{'\u0421\u043e\u0431\u044b\u0442\u0438\u044f \u0432 \u0442\u043e\u0447\u043a\u0435 (' + selectedEvents.length + ')'}</h4>
            <div className="map-point-event-times">
              {selectedEvents.map((event) => <button type="button" key={event.id} onClick={() => { setSelectedId(event.id); onSelectPointIds?.([event.id]); }}>{event.event_time ? formatDateTime(event.event_time) : '-'}</button>)}
            </div>
          </div>
          <div className="map-legend">
            <h3>{'\u041c\u0430\u0440\u0448\u0440\u0443\u0442\u044b'}</h3>
            {groups.map(([msisdn], index) => <div key={msisdn}><span style={{ backgroundColor: palette[index % palette.length] }} />{msisdn}</div>)}
          </div>
        </aside>
      </div>
      {showRouteTable && (
      <section className="map-route-table">
        <header><h3>События маршрута</h3><span>{points.length}</span></header>
        <div className="map-route-table-scroll">
          <table>
            <thead><tr><th>#</th><th>Дата и время</th><th>MSISDN</th><th>LAC / БС</th><th>Координаты</th><th>Адрес</th></tr></thead>
            <tbody>
              {points.map((point, index) => <tr key={point.id} className={point.id === selectedId ? 'is-selected' : ''} onClick={() => { setSelectedId(point.id); onSelectPointIds?.([point.id]); }}>
                <td>{point.sequence || index + 1}</td>
                <td>{point.event_time ? formatDateTime(point.event_time) : '-'}</td>
                <td>{point.msisdn || '-'}</td>
                <td>{point.lac || '-'} / {point.bs || '-'}</td>
                <td>{point.latitude.toFixed(6)}, {point.longitude.toFixed(6)}</td>
                <td>{point.address || '-'}</td>
              </tr>)}
            </tbody>
          </table>
        </div>
      </section>
      )}
    </div>
  );
};

export default MapView;
