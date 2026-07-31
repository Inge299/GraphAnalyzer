import type { ApiPlugin } from '../types/api';

export const PLUGIN_MENU_FALLBACK_LABEL = '\u041f\u0440\u043e\u0447\u0435\u0435';

const TOP_LEVEL_ORDER = [
  '\u0421\u043e\u0437\u0434\u0430\u0442\u044c',
  '\u0421\u0432\u044f\u0437\u0438',
  '\u0422\u0435\u043b\u0435\u0444\u043e\u043d\u0438\u044f',
  '\u0410\u043d\u0430\u043b\u0438\u0437',
  '\u0412\u0438\u0437\u0443\u0430\u043b\u0438\u0437\u0430\u0446\u0438\u044f',
  PLUGIN_MENU_FALLBACK_LABEL,
];

const normalizeSegment = (segment: string) => segment.trim().replace(/\s+/g, ' ');

export const isPluginVisible = (plugin: ApiPlugin) => !plugin?.hidden_from_menu;

export const filterVisiblePlugins = (plugins: ApiPlugin[]) => plugins.filter(isPluginVisible);

export const normalizePluginMenuPath = (rawPath?: string | null) => {
  const segments = String(rawPath || '')
    .split('/')
    .map(normalizeSegment)
    .filter(Boolean);
  return segments.length > 0 ? segments.join('/') : PLUGIN_MENU_FALLBACK_LABEL;
};

const getTopLevelOrder = (path: string) => {
  const index = TOP_LEVEL_ORDER.indexOf(path.split('/')[0] || PLUGIN_MENU_FALLBACK_LABEL);
  return index === -1 ? TOP_LEVEL_ORDER.length : index;
};

export const comparePluginMenuPaths = (left: string, right: string) => {
  const leftPath = normalizePluginMenuPath(left);
  const rightPath = normalizePluginMenuPath(right);
  const orderDiff = getTopLevelOrder(leftPath) - getTopLevelOrder(rightPath);
  return orderDiff !== 0 ? orderDiff : leftPath.localeCompare(rightPath, 'ru');
};

export const getPluginDisplayName = (plugin: ApiPlugin) => String(plugin.name || plugin.id).trim();

export const getPluginDisplayDescription = (plugin: ApiPlugin) => String(plugin.description || '').trim();

export const sortPluginsByName = (plugins: ApiPlugin[]) => {
  return [...filterVisiblePlugins(plugins)].sort((a, b) => {
    const orderDiff = Number(a?.menu_order || 0) - Number(b?.menu_order || 0);
    return orderDiff !== 0 ? orderDiff : getPluginDisplayName(a).localeCompare(getPluginDisplayName(b), 'ru');
  });
};
