// frontend/src/config/nodeAttributePreview.ts

/**
 * Настройки вывода атрибутов узла на графе.
 *
 * enabled:
 *   true  - показывать атрибуты под подписью узла;
 *   false - показывать только подпись.
 *
 * defaultMarker:
 *   маркер для строки атрибута, если для поля не задан свой.
 *
 * fields:
 *   ключ атрибута -> правила вывода.
 *   visibleOnGraph:
 *     true  - по умолчанию виден на графе;
 *     false - по умолчанию скрыт (можно включить в панели свойств).
 */
export const nodeAttributePreviewConfig = {
  enabled: true,
  maxLinesPerField: 3,
  defaultMarker: '•',
  fields: {
    operator: {
      label: 'оператор',
      marker: '•',
      maxLines: 3,
      visibleOnGraph: false,
    },
    ownership: {
      label: 'оформлен',
      marker: '•',
      maxLines: 4,
      visibleOnGraph: true,
    },
  },
} as const;

