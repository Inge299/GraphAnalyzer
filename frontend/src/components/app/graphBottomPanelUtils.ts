import { formatDateTime } from '../../utils/formatters';
import { getGraphEdgeId, getGraphNodeId } from '../../hooks/graphTableTypes';

export const graphBottomPanelLabels = {
  hideLists: '\u0421\u043a\u0440\u044b\u0442\u044c \u0441\u043f\u0438\u0441\u043a\u0438',
  showLists: '\u041f\u043e\u043a\u0430\u0437\u0430\u0442\u044c \u0441\u043f\u0438\u0441\u043a\u0438',
  resizePanel: '\u041f\u043e\u0442\u044f\u043d\u0438\u0442\u0435, \u0447\u0442\u043e\u0431\u044b \u0438\u0437\u043c\u0435\u043d\u0438\u0442\u044c \u0432\u044b\u0441\u043e\u0442\u0443',
  nodes: '\u0423\u0437\u043b\u044b',
  edges: '\u0421\u0432\u044f\u0437\u0438',
  type: '\u0422\u0438\u043f',
  label: '\u041f\u043e\u0434\u043f\u0438\u0441\u044c',
  from: '\u041e\u0442\u043a\u0443\u0434\u0430',
  to: '\u041a\u0443\u0434\u0430',
} as const;

export const formatGraphTableCellValue = (value: unknown): string => {
  if (Array.isArray(value)) return value.join(', ');
  if (value === null || value === undefined) return '';
  const text = String(value);
  return /^\d{4}-\d{2}-\d{2}(?:T|\s)\d{2}:\d{2}/.test(text) ? formatDateTime(text) : text;
};

export const buildSearchText = (parts: unknown[]): string =>
  parts
    .flatMap((part) => {
      if (Array.isArray(part)) return part.map((item) => formatGraphTableCellValue(item));
      return [formatGraphTableCellValue(part)];
    })
    .join(' ')
    .toLowerCase();

export { getGraphNodeId, getGraphEdgeId };
