// frontend/src/config/nodeAttributePreview.ts

/**
 * Настройки вывода атрибутов узла прямо на графе.
 *
 * enabled:
 *   true  - показывать атрибуты под подписью узла;
 *   false - показывать только подпись узла.
 *
 * defaultMarker:
 *   маркер (микроиконка) по умолчанию для строк атрибута.
 *
 * fields:
 *   индивидуальные маркеры и лимит строк для конкретных атрибутов.
 */
export const nodeAttributePreviewConfig = {
  enabled: true,
  maxLinesPerField: 3,
  defaultMarker: '*',
  fields: {
    operator: {
      marker: '*',
      maxLines: 3,
    },
    ownership: {
      marker: '*',
      maxLines: 4,
    },
  },
} as const;
