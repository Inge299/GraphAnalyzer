import type { ApiPlugin } from '../types/api';

export const PLUGIN_MENU_FALLBACK_LABEL = 'Прочее';

const TOP_LEVEL_ORDER = ['Связи', 'Создать объект', 'Анализ', 'Преобразования', 'AI', PLUGIN_MENU_FALLBACK_LABEL];

const HIDDEN_PLUGIN_IDS = new Set([
  'graph_styler',
  'graph_expander_report',
]);

const normalizeRawSegment = (segment: string) => segment.trim().replace(/\s+/g, ' ');

const normalizeTopLevelSegment = (segment: string) => {
  const normalized = normalizeRawSegment(segment);
  const lower = normalized.toLowerCase();

  if (!normalized) return PLUGIN_MENU_FALLBACK_LABEL;
  if (normalized === 'Связи') return 'Связи';
  if (lower === 'analysis' || normalized === 'Аналитика') return 'Анализ';
  if (lower === 'transform') return 'Преобразования';
  if (lower === 'graph') return 'Граф';
  if (lower === 'document') return 'Документы';
  return normalized;
};

const normalizeNestedSegment = (segment: string) => {
  const normalized = normalizeRawSegment(segment);
  const lower = normalized.toLowerCase();

  if (!normalized) return PLUGIN_MENU_FALLBACK_LABEL;
  if (lower === 'graph') return 'Граф';
  if (lower === 'document') return 'Документы';
  return normalized;
};

const PLUGIN_DISPLAY_OVERRIDES: Record<string, { name?: string; description?: string }> = {
  abonent_period_report: {
    name: 'Связи абонента за период',
    description: 'Формирует аналитический документ по выбранным абонентским номерам за указанный период.',
  },
  location_timeline_report: {
    name: 'Последовательность локаций',
    description: 'Показывает последовательность локаций выбранных средств связи за указанный период.',
  },
  graph_expander_report: {
    name: 'Расширить граф и отчёт',
    description: 'Добавляет связанные объекты на граф и формирует краткий отчёт по найденным связям.',
  },
  graph_styler: {
    name: 'Оформить граф',
    description: 'Приводит подписи, иконки и цвета графа к более читаемому виду.',
  },
  document_llm_pipeline: {
    name: 'Документ по шагам',
    description: 'Собирает документ в несколько LLM-шагов: план, блоки и финальная полировка.',
  },
  document_llm_compose: {
    name: 'Сформировать документ',
    description: 'Создаёт новый документ по текущим данным с помощью LLM.',
  },
  document_llm_rewrite: {
    name: 'Правка документа',
    description: 'Редактирует текущий документ через LLM без создания отдельной копии.',
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

  if (normalizedFirst === 'Связи') {
    if (rest.length === 0) return 'Связи';
    return ['Связи', ...rest.map(normalizeNestedSegment)].join('/');
  }

  if (normalizedFirst === 'Анализ') {
    if (rest.length === 0) return 'Анализ';
    return ['Анализ', ...rest.map(normalizeNestedSegment)].join('/');
  }

  if (normalizedFirst === 'Преобразования') {
    if (rest.length === 0) return 'Преобразования';
    return ['Преобразования', ...rest.map(normalizeNestedSegment)].join('/');
  }

  if (normalizedFirst === 'AI') {
    const normalizedRest = rest.length > 0 ? rest.map(normalizeNestedSegment) : ['Документы'];
    return ['AI', ...normalizedRest].join('/');
  }

  if (normalizedFirst === 'Документы') {
    return 'AI/Документы';
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
