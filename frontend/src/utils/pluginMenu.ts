import type { ApiPlugin } from '../types/api';

export const PLUGIN_MENU_FALLBACK_LABEL = 'РџСЂРѕС‡РµРµ';

const TOP_LEVEL_ORDER = ['РЎРІСЏР·Рё', 'РЎРѕР·РґР°С‚СЊ РѕР±СЉРµРєС‚', 'РђРЅР°Р»РёР·', 'РџСЂРµРѕР±СЂР°Р·РѕРІР°РЅРёСЏ', 'AI', PLUGIN_MENU_FALLBACK_LABEL];

const HIDDEN_PLUGIN_IDS = new Set([
  'graph_styler',
  'graph_expander_report',
]);

const normalizeRawSegment = (segment: string) => segment.trim().replace(/\s+/g, ' ');

const normalizeTopLevelSegment = (segment: string) => {
  const normalized = normalizeRawSegment(segment);
  const lower = normalized.toLowerCase();

  if (!normalized) return PLUGIN_MENU_FALLBACK_LABEL;
  if (normalized === 'РЎРІСЏР·Рё') return 'РЎРІСЏР·Рё';
  if (lower === 'analysis' || normalized === 'РђРЅР°Р»РёС‚РёРєР°') return 'РђРЅР°Р»РёР·';
  if (lower === 'transform') return 'РџСЂРµРѕР±СЂР°Р·РѕРІР°РЅРёСЏ';
  if (lower === 'graph') return 'Р“СЂР°С„';
  if (lower === 'document') return 'Р”РѕРєСѓРјРµРЅС‚С‹';
  return normalized;
};

const normalizeNestedSegment = (segment: string) => {
  const normalized = normalizeRawSegment(segment);
  const lower = normalized.toLowerCase();

  if (!normalized) return PLUGIN_MENU_FALLBACK_LABEL;
  if (lower === 'graph') return 'Р“СЂР°С„';
  if (lower === 'document') return 'Р”РѕРєСѓРјРµРЅС‚С‹';
  return normalized;
};

const PLUGIN_DISPLAY_OVERRIDES: Record<string, { name?: string; description?: string }> = {
  abonent_period_report: {
    name: 'РЎРІСЏР·Рё Р°Р±РѕРЅРµРЅС‚Р° Р·Р° РїРµСЂРёРѕРґ',
    description: 'Р¤РѕСЂРјРёСЂСѓРµС‚ Р°РЅР°Р»РёС‚РёС‡РµСЃРєРёР№ РґРѕРєСѓРјРµРЅС‚ РїРѕ РІС‹Р±СЂР°РЅРЅС‹Рј Р°Р±РѕРЅРµРЅС‚СЃРєРёРј РЅРѕРјРµСЂР°Рј Р·Р° СѓРєР°Р·Р°РЅРЅС‹Р№ РїРµСЂРёРѕРґ.',
  },
  graph_expander_report: {
    name: 'Р Р°СЃС€РёСЂРёС‚СЊ РіСЂР°С„ Рё РѕС‚С‡С‘С‚',
    description: 'Р”РѕР±Р°РІР»СЏРµС‚ СЃРІСЏР·Р°РЅРЅС‹Рµ РѕР±СЉРµРєС‚С‹ РЅР° РіСЂР°С„ Рё С„РѕСЂРјРёСЂСѓРµС‚ РєСЂР°С‚РєРёР№ РѕС‚С‡С‘С‚ РїРѕ РЅР°Р№РґРµРЅРЅС‹Рј СЃРІСЏР·СЏРј.',
  },
  graph_styler: {
    name: 'РћС„РѕСЂРјРёС‚СЊ РіСЂР°С„',
    description: 'РџСЂРёРІРѕРґРёС‚ РїРѕРґРїРёСЃРё, РёРєРѕРЅРєРё Рё С†РІРµС‚Р° РіСЂР°С„Р° Рє Р±РѕР»РµРµ С‡РёС‚Р°РµРјРѕРјСѓ РІРёРґСѓ.',
  },
  document_llm_pipeline: {
    name: 'Р”РѕРєСѓРјРµРЅС‚ РїРѕ С€Р°РіР°Рј',
    description: 'РЎРѕР±РёСЂР°РµС‚ РґРѕРєСѓРјРµРЅС‚ РІ РЅРµСЃРєРѕР»СЊРєРѕ LLM-С€Р°РіРѕРІ: РїР»Р°РЅ, Р±Р»РѕРєРё Рё С„РёРЅР°Р»СЊРЅР°СЏ РїРѕР»РёСЂРѕРІРєР°.',
  },
  document_llm_compose: {
    name: 'РЎС„РѕСЂРјРёСЂРѕРІР°С‚СЊ РґРѕРєСѓРјРµРЅС‚',
    description: 'РЎРѕР·РґР°С‘С‚ РЅРѕРІС‹Р№ РґРѕРєСѓРјРµРЅС‚ РїРѕ С‚РµРєСѓС‰РёРј РґР°РЅРЅС‹Рј СЃ РїРѕРјРѕС‰СЊСЋ LLM.',
  },
  document_llm_rewrite: {
    name: 'РџСЂР°РІРєР° РґРѕРєСѓРјРµРЅС‚Р°',
    description: 'Р РµРґР°РєС‚РёСЂСѓРµС‚ С‚РµРєСѓС‰РёР№ РґРѕРєСѓРјРµРЅС‚ С‡РµСЂРµР· LLM Р±РµР· СЃРѕР·РґР°РЅРёСЏ РѕС‚РґРµР»СЊРЅРѕР№ РєРѕРїРёРё.',
  },
};

export const isPluginVisible = (plugin: ApiPlugin) =>
  !plugin?.hidden_from_menu && !HIDDEN_PLUGIN_IDS.has(String(plugin?.id || '').trim());

export const filterVisiblePlugins = (plugins: ApiPlugin[]) => plugins.filter(isPluginVisible);

export const normalizePluginMenuPath = (rawPath?: string | null) => {
  const value = String(rawPath || '').trim();
  if (!value) return PLUGIN_MENU_FALLBACK_LABEL;

  const sourceSegments = value
    .split('/')
    .map((segment) => segment.trim())
    .filter(Boolean);

  if (sourceSegments.length === 0) return PLUGIN_MENU_FALLBACK_LABEL;

  const [first, ...rest] = sourceSegments;
  const normalizedFirst = normalizeTopLevelSegment(first);

  if (normalizedFirst === 'РЎРІСЏР·Рё') {
    if (rest.length === 0) return 'РЎРІСЏР·Рё';
    return ['РЎРІСЏР·Рё', ...rest.map(normalizeNestedSegment)].join('/');
  }

  if (normalizedFirst === 'РђРЅР°Р»РёР·') {
    if (rest.length === 0) return 'РђРЅР°Р»РёР·';
    return ['РђРЅР°Р»РёР·', ...rest.map(normalizeNestedSegment)].join('/');
  }

  if (normalizedFirst === 'РџСЂРµРѕР±СЂР°Р·РѕРІР°РЅРёСЏ') {
    if (rest.length === 0) return 'РџСЂРµРѕР±СЂР°Р·РѕРІР°РЅРёСЏ';
    return ['РџСЂРµРѕР±СЂР°Р·РѕРІР°РЅРёСЏ', ...rest.map(normalizeNestedSegment)].join('/');
  }

  if (normalizedFirst === 'AI') {
    const normalizedRest = rest.length > 0 ? rest.map(normalizeNestedSegment) : ['Р”РѕРєСѓРјРµРЅС‚С‹'];
    return ['AI', ...normalizedRest].join('/');
  }

  if (normalizedFirst === 'Р”РѕРєСѓРјРµРЅС‚С‹') {
    return 'AI/Р”РѕРєСѓРјРµРЅС‚С‹';
  }

  return [normalizedFirst, ...rest.map(normalizeNestedSegment)].join('/');
};

const getTopLevelOrder = (path: string) => {
  const topLevel = path.split('/')[0] || PLUGIN_MENU_FALLBACK_LABEL;
  const index = TOP_LEVEL_ORDER.indexOf(topLevel);
  return index === -1 ? TOP_LEVEL_ORDER.length : index;
};

export const comparePluginMenuPaths = (left: string, right: string) => {
  const leftPath = normalizePluginMenuPath(left);
  const rightPath = normalizePluginMenuPath(right);
  const orderDiff = getTopLevelOrder(leftPath) - getTopLevelOrder(rightPath);
  if (orderDiff !== 0) return orderDiff;
  return leftPath.localeCompare(rightPath, 'ru');
};

export const getPluginDisplayName = (plugin: ApiPlugin) => {
  const override = PLUGIN_DISPLAY_OVERRIDES[plugin.id];
  return String(override?.name || plugin.name || plugin.id).trim();
};

export const getPluginDisplayDescription = (plugin: ApiPlugin) => {
  const override = PLUGIN_DISPLAY_OVERRIDES[plugin.id];
  return String(override?.description || plugin.description || '').trim();
};

export const sortPluginsByName = (plugins: ApiPlugin[]) => {
  return [...filterVisiblePlugins(plugins)].sort((a, b) => {
    const orderDiff = Number(a?.menu_order || 0) - Number(b?.menu_order || 0);
    if (orderDiff !== 0) return orderDiff;
    return getPluginDisplayName(a).localeCompare(getPluginDisplayName(b), 'ru');
  });
};
