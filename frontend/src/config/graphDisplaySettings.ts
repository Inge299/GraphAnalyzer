import { layoutConfig } from './layout';

export type GraphDisplaySettings = {
  bottomTableFontSizePx: number;
  nodeLabelMinScale: number;
  edgeLabelMinScale: number;
  maxGraphScale: number;
  nodeDistancePx: number;
};

const STORAGE_KEY = 'graph-display-settings-v1';

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

const sanitizeSettings = (candidate: Partial<GraphDisplaySettings>): GraphDisplaySettings => {
  const current = layoutConfig as any;
  return {
    bottomTableFontSizePx: clamp(
      Number(candidate.bottomTableFontSizePx ?? current?.ui?.bottomTableFontSizePx ?? 13) || 13,
      10,
      24,
    ),
    nodeLabelMinScale: clamp(
      Number(candidate.nodeLabelMinScale ?? current?.interaction?.nodeLabelMinScale ?? 0.55) || 0.55,
      0.05,
      3,
    ),
    edgeLabelMinScale: clamp(
      Number(candidate.edgeLabelMinScale ?? current?.interaction?.edgeLabelMinScale ?? 0.9) || 0.9,
      0.05,
      3,
    ),
    maxGraphScale: clamp(
      Number(candidate.maxGraphScale ?? current?.interaction?.maxGraphScale ?? 2) || 2,
      0.5,
      6,
    ),
    nodeDistancePx: clamp(
      Number(candidate.nodeDistancePx ?? current?.layoutSpacing?.nodeDistancePx ?? 260) || 260,
      80,
      1000,
    ),
  };
};

export const getDefaultGraphDisplaySettings = (): GraphDisplaySettings => {
  const current = layoutConfig as any;
  return sanitizeSettings({
    bottomTableFontSizePx: current?.ui?.bottomTableFontSizePx,
    nodeLabelMinScale: current?.interaction?.nodeLabelMinScale,
    edgeLabelMinScale: current?.interaction?.edgeLabelMinScale,
    maxGraphScale: current?.interaction?.maxGraphScale,
    nodeDistancePx: current?.layoutSpacing?.nodeDistancePx,
  });
};

export const readStoredGraphDisplaySettings = (): GraphDisplaySettings => {
  if (typeof window === 'undefined') return getDefaultGraphDisplaySettings();
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return getDefaultGraphDisplaySettings();
    return sanitizeSettings(JSON.parse(raw) as Partial<GraphDisplaySettings>);
  } catch {
    return getDefaultGraphDisplaySettings();
  }
};

export const applyGraphDisplaySettings = (
  nextSettings: Partial<GraphDisplaySettings>,
  options?: { persist?: boolean; notify?: boolean },
) => {
  const settings = sanitizeSettings(nextSettings);
  const cfg = layoutConfig as any;
  cfg.ui.bottomTableFontSizePx = settings.bottomTableFontSizePx;
  cfg.interaction.nodeLabelMinScale = settings.nodeLabelMinScale;
  cfg.interaction.edgeLabelMinScale = settings.edgeLabelMinScale;
  cfg.interaction.maxGraphScale = settings.maxGraphScale;
  cfg.layoutSpacing.nodeDistancePx = settings.nodeDistancePx;

  if (typeof document !== 'undefined') {
    document.documentElement.style.setProperty('--bottom-table-font-size', `${settings.bottomTableFontSizePx}px`);
  }

  if (typeof window !== 'undefined' && options?.persist !== false) {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
    } catch {
      // ignore storage issues
    }
  }

  if (typeof window !== 'undefined' && options?.notify !== false) {
    window.dispatchEvent(new CustomEvent('graph:settings-changed', { detail: settings }));
  }

  return settings;
};

export const initializeGraphDisplaySettings = () => {
  const settings = readStoredGraphDisplaySettings();
  applyGraphDisplaySettings(settings, { persist: false, notify: false });
  return settings;
};
