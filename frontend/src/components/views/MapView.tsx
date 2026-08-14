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
  visiblePointIds?: string[];
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
  weight?: number;
  first_event?: string;
  last_event?: string;
  location_method?: string;
  location_probability?: number;
  location_distance_m?: number;
  azimuth?: number;
  base_station_latitude?: number;
  base_station_longitude?: number;
};

type MapData = {
  points?: unknown[];
  provider?: string;
  pmtiles_url?: string;
  map_style_url?: string;
  source?: { provider_label?: string };
  render_mode?: 'heatmap';
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

const updateMapOverlays = (map: MapLibreMap, groups: Array<[string, MapPoint[]]>, heatmap: boolean, fitToRoute = false) => {
  if (!map.getSource('locations') || !map.getSource('routes') || !map.getSource('heat-points')) return;

  const pointFeatures: GeoJSON.Feature<GeoJSON.Point>[] = [];
  const heatFeatures: GeoJSON.Feature<GeoJSON.Point>[] = [];
  const routeFeatures: GeoJSON.Feature<GeoJSON.LineString>[] = [];
  const bounds = new LngLatBounds();

  groups.forEach(([msisdn, group], groupIndex) => {
    const color = palette[groupIndex % palette.length];
    group.forEach((point) => {
      bounds.extend([point.longitude, point.latitude]);
      if (heatmap) {
        heatFeatures.push({
          type: 'Feature',
          properties: { weight: Math.max(0.05, Number((point as MapPoint & { heat_weight?: number }).heat_weight || 0.05)), ids: point.id, msisdn, address: point.address || '' },
          geometry: { type: 'Point', coordinates: [point.longitude, point.latitude] },
        });
      }
    });
    if (!heatmap && group.length > 1) {
      routeFeatures.push({
        type: 'Feature',
        properties: { color },
        geometry: { type: 'LineString', coordinates: group.map((point) => [point.longitude, point.latitude]) },
      });
    }
    if (heatmap) return;
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
  (map.getSource('heat-points') as maplibregl.GeoJSONSource).setData({ type: 'FeatureCollection', features: heatFeatures });
  if (map.getLayer('routes-line')) map.setLayoutProperty('routes-line', 'visibility', heatmap ? 'none' : 'visible');
  if (map.getLayer('locations-point')) map.setLayoutProperty('locations-point', 'visibility', heatmap ? 'none' : 'visible');
  if (map.getLayer('heatmap-layer')) map.setLayoutProperty('heatmap-layer', 'visibility', 'none');
  if (fitToRoute && !bounds.isEmpty()) map.fitBounds(bounds, { padding: 32, maxZoom: heatmap ? 14 : 15, duration: 0 });
};

const MapView: React.FC<MapViewProps> = ({ artifact, dataOverride, titleOverride, descriptionOverride, selectedPointId, visiblePointIds, onSelectPointIds, showRouteTable = true }) => {
  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const markerRefs = useRef<maplibregl.Marker[]>([]);
  const routeOverlayRef = useRef<SVGSVGElement | null>(null);
  const routeOverlayCleanupRef = useRef<(() => void) | null>(null);
  const heatOverlayRef = useRef<HTMLCanvasElement | null>(null);
  const heatOverlayCleanupRef = useRef<(() => void) | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [mapError, setMapError] = useState<string | null>(null);
  const data = (dataOverride || artifact.data || {}) as MapData;
  const isHeatmap = data.render_mode === 'heatmap';

  const points = useMemo(() => {
    const raw = Array.isArray(data.points) ? data.points : [];
    return raw
      .filter((item: unknown): item is MapPoint => Boolean(item && typeof item === 'object' && Number.isFinite(Number((item as MapPoint).latitude)) && Number.isFinite(Number((item as MapPoint).longitude))))
      .map((item: MapPoint) => ({
        ...item,
        latitude: Number(item.latitude),
        longitude: Number(item.longitude),
        azimuth: Number.isFinite(Number(item.azimuth)) ? Number(item.azimuth) : undefined,
        base_station_latitude: Number.isFinite(Number(item.base_station_latitude)) ? Number(item.base_station_latitude) : undefined,
        base_station_longitude: Number.isFinite(Number(item.base_station_longitude)) ? Number(item.base_station_longitude) : undefined,
      }));
  }, [data.points]);

  const hasPointFilter = visiblePointIds !== undefined;
  const visiblePoints = useMemo(() => (
    hasPointFilter ? points.filter((point) => visiblePointIds.includes(point.id)) : points
  ), [hasPointFilter, points, visiblePointIds]);

  const groups = useMemo(() => {
    const next = new Map<string, MapPoint[]>();
    visiblePoints.forEach((point) => {
      const key = point.msisdn || '-';
      next.set(key, [...(next.get(key) || []), point]);
    });
    return [...next.entries()];
  }, [visiblePoints]);

  const syncLocationMarkers = (map: MapLibreMap) => {
    markerRefs.current.forEach((marker) => marker.remove());
    if (isHeatmap) {
      markerRefs.current = [];
      return;
    }
    markerRefs.current = visiblePoints.map((point) => {
      const element = document.createElement('button');
      element.type = 'button';
      const isAzimuthEstimate = point.location_method === 'azimuth_projection';
      element.className = `map-location-marker${isAzimuthEstimate ? ' is-azimuth-estimate' : ''}${point.id === selectedId ? ' is-selected' : ''}`;
      if (isAzimuthEstimate) element.style.setProperty('--marker-angle', `${point.azimuth || 0}deg`);
      const estimateDetail = isAzimuthEstimate
        ? ` \u00b7 азимут ${Math.round(point.azimuth || 0)}\u00b0, ${Math.round(point.location_distance_m || 0)} м`
        : '';
      element.title = `${point.msisdn || 'MSISDN'} \u00b7 ${point.event_time ? formatDateTime(point.event_time) : '\u0432\u0440\u0435\u043c\u044f \u043d\u0435 \u0443\u043a\u0430\u0437\u0430\u043d\u043e'}${estimateDetail}`;
      element.textContent = isAzimuthEstimate ? '\u25b2' : (point.sequence ? String(point.sequence) : '\u2022');
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

  const syncHeatOverlay = (map: MapLibreMap) => {
    heatOverlayCleanupRef.current?.();
    if (!isHeatmap) {
      heatOverlayRef.current?.remove();
      heatOverlayRef.current = null;
      return;
    }
    const container = map.getContainer();
    let canvas = heatOverlayRef.current;
    if (!canvas) {
      canvas = document.createElement('canvas');
      canvas.className = 'map-heat-overlay';
      canvas.setAttribute('aria-hidden', 'true');
      container.appendChild(canvas);
      heatOverlayRef.current = canvas;
    }
    const mask = document.createElement('canvas');
    let frame = 0;
    const colorAt = (value: number): [number, number, number] => {
      const stops: Array<[number, [number, number, number]]> = [[0, [14,165,233]], [0.22, [34,197,94]], [0.46, [250,204,21]], [0.7, [249,115,22]], [1, [185,28,28]]];
      const current = Math.max(0, Math.min(1, value));
      const index = stops.findIndex(([stop]) => current <= stop);
      const upper = stops[index < 0 ? stops.length - 1 : Math.max(1, index)];
      const lower = stops[Math.max(0, (index < 0 ? stops.length - 1 : index) - 1)];
      const factor = upper[0] === lower[0] ? 0 : (current - lower[0]) / (upper[0] - lower[0]);
      return lower[1].map((channel, channelIndex) => Math.round(channel + (upper[1][channelIndex] - channel) * factor)) as [number, number, number];
    };
    const redraw = () => {
      frame = 0;
      if (!canvas) return;
      const rect = container.getBoundingClientRect();
      const ratio = Math.min(window.devicePixelRatio || 1, 2);
      const width = Math.max(1, Math.round(rect.width * ratio));
      const height = Math.max(1, Math.round(rect.height * ratio));
      if (canvas.width !== width || canvas.height !== height) {
        canvas.width = width;
        canvas.height = height;
        canvas.style.width = String(rect.width) + 'px';
        canvas.style.height = String(rect.height) + 'px';
      }
      mask.width = width;
      mask.height = height;
      const maskContext = mask.getContext('2d');
      const context = canvas.getContext('2d');
      if (!maskContext || !context) return;
      maskContext.setTransform(ratio, 0, 0, ratio, 0, 0);
      const maxWeight = Math.max(...visiblePoints.map((point) => Number(point.weight) || 1), 1);
      const zoom = map.getZoom();
      const closeZoomBoost = Math.max(0, Math.min(1, (zoom - 11) / 6));
      const radius = Math.max(28, Math.min(108, 16 + zoom * 4.8));
      visiblePoints.forEach((point) => {
        const projected = map.project([point.longitude, point.latitude]);
        const strength = 0.14 + closeZoomBoost * 0.14
          + Math.log1p(Number(point.weight) || 1) / Math.log1p(maxWeight) * (0.62 + closeZoomBoost * 0.12);
        const gradient = maskContext.createRadialGradient(projected.x, projected.y, 0, projected.x, projected.y, radius);
        gradient.addColorStop(0, 'rgba(255,255,255,' + strength + ')');
        gradient.addColorStop(0.25, 'rgba(255,255,255,' + strength * 0.9 + ')');
        gradient.addColorStop(0.64, 'rgba(255,255,255,' + strength * 0.3 + ')');
        gradient.addColorStop(1, 'rgba(255,255,255,0)');
        maskContext.fillStyle = gradient;
        maskContext.fillRect(projected.x - radius, projected.y - radius, radius * 2, radius * 2);
      });
      const maskPixels = maskContext.getImageData(0, 0, width, height);
      const output = context.createImageData(width, height);
      for (let offset = 0; offset < maskPixels.data.length; offset += 4) {
        const density = maskPixels.data[offset + 3] / 255;
        const visibleDensity = Math.pow(density, 0.92 - closeZoomBoost * 0.18);
        if (visibleDensity <= 0.009) continue;
        const [red, green, blue] = colorAt(Math.min(1, visibleDensity * (1.12 + closeZoomBoost * 0.14)));
        output.data[offset] = red;
        output.data[offset + 1] = green;
        output.data[offset + 2] = blue;
        output.data[offset + 3] = Math.min(232, Math.round((visibleDensity * 0.86 + closeZoomBoost * 0.1) * 255));
      }
      context.putImageData(output, 0, 0);
    };
    const scheduleRedraw = () => { if (!frame) frame = window.requestAnimationFrame(redraw); };
    redraw();
    map.on('move', scheduleRedraw);
    map.on('resize', scheduleRedraw);
    heatOverlayCleanupRef.current = () => {
      if (frame) window.cancelAnimationFrame(frame);
      map.off('move', scheduleRedraw);
      map.off('resize', scheduleRedraw);
    };
  };
  const syncRouteOverlay = (map: MapLibreMap) => {
    routeOverlayCleanupRef.current?.();
    if (isHeatmap) {
      routeOverlayRef.current?.replaceChildren();
      return;
    }
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
      visiblePoints.forEach((point) => {
        if (point.location_method !== 'azimuth_projection' || point.base_station_latitude === undefined || point.base_station_longitude === undefined) return;
        const base = map.project([point.base_station_longitude, point.base_station_latitude]);
        const estimate = map.project([point.longitude, point.latitude]);
        const link = document.createElementNS('http://www.w3.org/2000/svg', 'line');
        link.setAttribute('x1', String(base.x));
        link.setAttribute('y1', String(base.y));
        link.setAttribute('x2', String(estimate.x));
        link.setAttribute('y2', String(estimate.y));
        link.setAttribute('stroke', '#d97706');
        link.setAttribute('stroke-width', '1.5');
        link.setAttribute('stroke-dasharray', '3 3');
        link.setAttribute('opacity', '0.8');
        svg.appendChild(link);
        const tower = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
        tower.setAttribute('cx', String(base.x));
        tower.setAttribute('cy', String(base.y));
        tower.setAttribute('r', '3');
        tower.setAttribute('fill', '#64748b');
        tower.setAttribute('stroke', '#ffffff');
        tower.setAttribute('stroke-width', '1.2');
        svg.appendChild(tower);
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
  const selected = visiblePoints.find((point) => point.id === selectedId) || visiblePoints[0] || null;
  const selectedEvents = useMemo(() => {
    if (!selected) return [] as MapPoint[];
    return visiblePoints.filter((point) => point.latitude.toFixed(6) === selected.latitude.toFixed(6) && point.longitude.toFixed(6) === selected.longitude.toFixed(6));
  }, [visiblePoints, selected]);

  const pmtilesUrl = data.pmtiles_url || defaultPmtilesUrl;
  const style = defaultStyleUrl || (mapMode === 'online' ? data.map_style_url : '') || makeFallbackStyle(pmtilesUrl);

  useEffect(() => {
    if (!visiblePoints.length) {
      setSelectedId(null);
      return;
    }
    setSelectedId((current) => selectedPointId && visiblePoints.some((point) => point.id === selectedPointId)
      ? selectedPointId
      : visiblePoints.some((point) => point.id === current)
        ? current
        : visiblePoints[0].id);
  }, [selectedPointId, visiblePoints]);

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
      map.addSource('heat-points', { type: 'geojson', data: { type: 'FeatureCollection', features: [] } });
      map.addLayer({ id: 'routes-line', type: 'line', source: 'routes', paint: { 'line-color': '#1d4ed8', 'line-width': 5, 'line-opacity': 0.9 } });
      map.addLayer({ id: 'locations-point', type: 'circle', source: 'locations', paint: { 'circle-radius': 8, 'circle-color': '#ffffff', 'circle-stroke-color': '#1d4ed8', 'circle-stroke-width': 3 } });
      map.addLayer({
        id: 'heatmap-layer',
        type: 'heatmap',
        source: 'heat-points',
        layout: { visibility: 'none' },
        paint: {
          'heatmap-weight': ['coalesce', ['get', 'weight'], 0.05],
          'heatmap-intensity': ['interpolate', ['linear'], ['zoom'], 5, 2.8, 9, 2.2, 13, 1.65, 17, 1.1],
          'heatmap-radius': ['interpolate', ['linear'], ['zoom'], 5, 58, 9, 80, 13, 104, 17, 128],
          'heatmap-opacity': 0.96,
          'heatmap-color': ['interpolate', ['linear'], ['heatmap-density'],
            0, 'rgba(30,64,175,0)',
            0.01, 'rgba(14,165,233,0.4)',
            0.08, 'rgba(34,197,94,0.58)',
            0.22, 'rgba(250,204,21,0.72)',
            0.42, 'rgba(249,115,22,0.88)',
            0.65, 'rgba(220,38,38,0.96)',
            1, 'rgba(127,29,29,1)'
          ]
        }
      });
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
      updateMapOverlays(map, groups, isHeatmap, true);
      syncLocationMarkers(map);
      syncRouteOverlay(map);
      syncHeatOverlay(map);
      map.once('idle', () => updateMapOverlays(map, groups, isHeatmap, true));
      requestAnimationFrame(() => map.resize());
    });

    mapRef.current = map;
    return () => {
      routeOverlayCleanupRef.current?.();
      routeOverlayCleanupRef.current = null;
      heatOverlayCleanupRef.current?.();
      heatOverlayCleanupRef.current = null;
      heatOverlayRef.current?.remove();
      heatOverlayRef.current = null;
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
    updateMapOverlays(map, groups, isHeatmap);
    syncLocationMarkers(map);
    syncRouteOverlay(map);
    syncHeatOverlay(map);
  }, [groups, selectedId, isHeatmap]);

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
          <p>{descriptionOverride || (isHeatmap ? '\u0418\u043d\u0442\u0435\u043d\u0441\u0438\u0432\u043d\u043e\u0441\u0442\u044c \u043f\u043e\u043a\u0430\u0437\u044b\u0432\u0430\u0435\u0442 \u0447\u0438\u0441\u043b\u043e \u0440\u0435\u0433\u0438\u0441\u0442\u0440\u0430\u0446\u0438\u0439 \u0432 \u043a\u0430\u0436\u0434\u043e\u0439 \u043a\u043e\u043e\u0440\u0434\u0438\u043d\u0430\u0442\u043d\u043e\u0439 \u0442\u043e\u0447\u043a\u0435.' : artifact.description || '\u041c\u0430\u0440\u0448\u0440\u0443\u0442 \u043f\u043e \u043a\u043e\u043e\u0440\u0434\u0438\u043d\u0430\u0442\u0430\u043c \u0431\u0430\u0437\u043e\u0432\u044b\u0445 \u0441\u0442\u0430\u043d\u0446\u0438\u0439.')}</p>
        </div>
        <div className="map-summary">{(isHeatmap ? '\u0422\u043e\u0447\u0435\u043a \u0442\u0435\u043f\u043b\u0430: ' : '\u0422\u043e\u0447\u0435\u043a: ') + visiblePoints.length + (hasPointFilter ? ' \u0438\u0437 ' + points.length : '') + (isHeatmap ? ' \u00b7 \u0441\u043e\u0431\u044b\u0442\u0438\u0439: ' + visiblePoints.reduce((total, point) => total + Number(point.weight || 1), 0) : ' \u00b7 \u0410\u0431\u043e\u043d\u0435\u043d\u0442\u043e\u0432: ' + groups.length)}</div>
      </header>
      <div className="map-layout">
        <section className="map-canvas-wrap" aria-label="location map">
          <div className="map-stage" ref={mapContainerRef} />
          {hasPointFilter && visiblePoints.length === 0 ? (
            <div className="map-selection-hint">{'\u0412\u044b\u0431\u0435\u0440\u0438\u0442\u0435 \u0441\u0442\u0440\u043e\u043a\u0443 \u0441\u0442\u043e\u044f\u043d\u043a\u0438 \u0438\u043b\u0438 \u043f\u0435\u0440\u0435\u043c\u0435\u0449\u0435\u043d\u0438\u044f, \u0447\u0442\u043e\u0431\u044b \u043f\u043e\u043a\u0430\u0437\u0430\u0442\u044c \u0435\u0451 \u043d\u0430 \u043a\u0430\u0440\u0442\u0435.'}</div>
          ) : null}
          {isHeatmap ? <div className="map-heat-legend"><strong>{'\u0418\u043d\u0442\u0435\u043d\u0441\u0438\u0432\u043d\u043e\u0441\u0442\u044c: \u0447\u0438\u0441\u043b\u043e \u0440\u0435\u0433\u0438\u0441\u0442\u0440\u0430\u0446\u0438\u0439'}</strong><span>{'\u041c\u0435\u043d\u044c\u0448\u0435'}</span><i /><span>{'\u0411\u043e\u043b\u044c\u0448\u0435'}</span></div> : null}
          {mapError ? <div className="map-load-error">{'\u041d\u0435 \u0443\u0434\u0430\u043b\u043e\u0441\u044c \u0437\u0430\u0433\u0440\u0443\u0437\u0438\u0442\u044c \u043a\u0430\u0440\u0442\u043e\u0433\u0440\u0430\u0444\u0438\u0447\u0435\u0441\u043a\u0438\u0439 \u0441\u043b\u043e\u0439'}: {mapError}</div> : null}
          <p className="map-attribution">
            {'\u041a\u0430\u0440\u0442\u043e\u0433\u0440\u0430\u0444\u0438\u0447\u0435\u0441\u043a\u0430\u044f \u043e\u0441\u043d\u043e\u0432\u0430: '}
            {pmtilesUrl ? '\u0432\u043d\u0443\u0442\u0440\u0435\u043d\u043d\u0438\u0439 PMTiles' : mapMode === 'online' ? '\u043e\u043d\u043b\u0430\u0439\u043d OpenStreetMap' : '\u043d\u0435 \u043d\u0430\u0441\u0442\u0440\u043e\u0435\u043d\u0430'}.
            {' \u0418\u0441\u0442\u043e\u0447\u043d\u0438\u043a: '}
            {data.provider === 'external_cell_tower_reference' ? (data.source?.provider_label || '\u0432\u043d\u0435\u0448\u043d\u0438\u0439 \u0441\u043f\u0440\u0430\u0432\u043e\u0447\u043d\u0438\u043a \u0431\u0430\u0437\u043e\u0432\u044b\u0445 \u0441\u0442\u0430\u043d\u0446\u0438\u0439') : data.provider === 'local_cell_tower_reference' || data.provider === 'cell_tower_reference' ? '\u043b\u043e\u043a\u0430\u043b\u044c\u043d\u044b\u0439 \u0441\u043f\u0440\u0430\u0432\u043e\u0447\u043d\u0438\u043a \u0431\u0430\u0437\u043e\u0432\u044b\u0445 \u0441\u0442\u0430\u043d\u0446\u0438\u0439' : data.provider === 'project_cell_tower_geocoding' ? '\u043f\u0440\u043e\u0435\u043a\u0442\u043d\u043e\u0435 \u043e\u0431\u043e\u0433\u0430\u0449\u0435\u043d\u0438\u0435 \u0430\u0434\u0440\u0435\u0441\u043e\u0432 \u0411\u0421' : '\u0434\u0430\u043d\u043d\u044b\u0435 \u0430\u0440\u0442\u0435\u0444\u0430\u043a\u0442\u0430'}.
          </p>
        </section>
        <aside className="map-details">
          <h3>{isHeatmap ? '\u0412\u044b\u0431\u0440\u0430\u043d\u043d\u0430\u044f \u0442\u043e\u0447\u043a\u0430' : '\u0421\u043e\u0431\u044b\u0442\u0438\u0435'}</h3>
          {selected ? <dl>
            <dt>MSISDN</dt><dd>{selected.msisdn || '-'}</dd>
            <dt>{'\u0410\u0434\u0440\u0435\u0441'}</dt><dd>{selected.address || '-'}</dd>
            <dt>{'\u041a\u043e\u043e\u0440\u0434\u0438\u043d\u0430\u0442\u044b'}</dt><dd>{selected.latitude.toFixed(6)}, {selected.longitude.toFixed(6)}</dd>
            <dt>LAC / {'\u0411\u0421'}</dt><dd>{selected.lac || '-'} / {selected.bs || '-'}</dd>
            {isHeatmap ? <><dt>{'\u0412\u043a\u043b\u0430\u0434 \u0432 \u0442\u0435\u043f\u043b\u043e\u0432\u043e\u0439 \u0441\u043b\u043e\u0439'}</dt><dd>{'\u0420\u0435\u0433\u0438\u0441\u0442\u0440\u0430\u0446\u0438\u0439: '} {selected.weight || 0}</dd><dt>{'\u041f\u0435\u0440\u0438\u043e\u0434 \u0440\u0435\u0433\u0438\u0441\u0442\u0440\u0430\u0446\u0438\u0439'}</dt><dd>{[formatDateTime(selected.first_event), formatDateTime(selected.last_event)].filter(Boolean).join(' \u2014 ') || '-'}</dd></> : null}
          </dl> : null}
          {!isHeatmap ? <div className="map-point-events">
            <h4>{'\u0421\u043e\u0431\u044b\u0442\u0438\u044f \u0432 \u0442\u043e\u0447\u043a\u0435 (' + selectedEvents.length + ')'}</h4>
            <div className="map-point-event-times">
              {selectedEvents.map((event) => <button type="button" key={event.id} onClick={() => { setSelectedId(event.id); onSelectPointIds?.([event.id]); }}>{event.event_time ? formatDateTime(event.event_time) : '-'}</button>)}
            </div>
          </div> : null}
          {!isHeatmap ? <div className="map-legend">
            <h3>{'\u041c\u0430\u0440\u0448\u0440\u0443\u0442\u044b'}</h3>
            {groups.map(([msisdn], index) => <div key={msisdn}><span style={{ backgroundColor: palette[index % palette.length] }} />{msisdn}</div>)}
          </div> : null}
        </aside>
      </div>
      {showRouteTable && (
      <section className="map-route-table">
        <header><h3>{'\u0421\u043e\u0431\u044b\u0442\u0438\u044f \u043c\u0430\u0440\u0448\u0440\u0443\u0442\u0430'}</h3><span>{points.length}</span></header>
        <div className="map-route-table-scroll">
          <table>
            <thead><tr><th>#</th><th>{'\u0414\u0430\u0442\u0430 \u0438 \u0432\u0440\u0435\u043c\u044f'}</th><th>MSISDN</th><th>LAC / {'\u0411\u0421'}</th><th>{'\u041a\u043e\u043e\u0440\u0434\u0438\u043d\u0430\u0442\u044b'}</th><th>{'\u0410\u0434\u0440\u0435\u0441'}</th></tr></thead>
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

