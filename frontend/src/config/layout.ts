// frontend/src/config/layout.ts

/**
 * Параметры раскладки графа.
 *
 * Меняйте эти значения, чтобы быстро регулировать "плотность" и характер
 * размещения без правок алгоритма в GraphView.
 */
export const layoutConfig = {
  hybrid: {
    /**
     * Общий множитель расстояний между узлами.
     * 1.0 = базовая плотность,
     * 2.5 = заметно более свободная раскладка.
     */
    spacingMultiplier: 2.5,

    /**
     * Длительность force-этапа (мс) перед anti-overlap.
     * Типичный рабочий диапазон: 800..1500.
     */
    forceDurationMs: 1100,

    /**
     * Базовый отступ в anti-overlap (до умножения на spacingMultiplier).
     * Используется для разведения узлов и их подписей.
     */
    antiOverlapPaddingBase: 20,

    /**
     * Базовые коэффициенты physics для force-этапа.
     * Часть параметров масштабируется через spacingMultiplier.
     */
    physics: {
      gravitationalConstantBase: -42,
      centralGravityBase: 0.005,
      springLengthBase: 180,
      springConstant: 0.04,
      avoidOverlap: 0.9,
      minVelocity: 0.75,
      timestep: 0.4
    }
  },

  balanced: {
    /**
     * Общий множитель масштаба расстояний в Balanced-режиме.
     */
    spacingMultiplier: 2.5,

    /**
     * Количество итераций локальной оптимизации.
     * Больше итераций = качественнее, но медленнее.
     */
    iterations: 65,

    /**
     * Базовый шаг обновления позиции на итерации.
     */
    step: 0.28,

    /**
     * Насколько сильно раздвигаем узлы при близком расположении.
     */
    repulsionWeight: 1.25,

    /**
     * Насколько сильно стягиваем связанные узлы.
     */
    edgeWeight: 0.065,

    /**
     * Целевая длина связи (до умножения на spacingMultiplier).
     */
    preferredEdgeLengthBase: 170,

    /**
     * Минимальный отступ между визуальными областями узлов
     * (узел + подпись), до умножения на spacingMultiplier.
     */
    minNodeGapBase: 12,

    /**
     * Мягкая граница вокруг центра раскладки. Узлы стараются
     * не выходить за этот радиус.
     */
    maxRadiusBase: 620,

    /**
     * Сила возврата узла внутрь допустимого радиуса.
     */
    boundaryWeight: 0.08,

    /**
     * Дополнительный отступ от "неподвижных" узлов при раскладке
     * только выделенной группы.
     */
    blockerGapBase: 14
  },

  physicsEngine: {
    /**
     * Параметры встроенной физики vis-network.
     * Используются в режиме "Physics" (кнопка с весами).
     */
    solver: 'forceAtlas2Based',

    /**
     * Физика между узлами и ребрами.
     */
    gravitationalConstant: -102,
    centralGravity: 0.006,
    springLength: 285,
    springConstant: 0.038,
    damping: 0.42,
    avoidOverlap: 1,

    /**
     * Численная устойчивость симуляции.
     */
    minVelocity: 0.65,
    timestep: 0.4,

    /**
     * Стабилизация: максимум итераций и аварийный таймаут.
     */
    iterations: 900,
    maxDurationMs: 1800
  }
} as const;
