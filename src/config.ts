/**
 * Глобальная конфигурация приложения Campus Navigator 3D.
 */

export const CONFIG = {
  /** Скорость пешехода для оценки времени маршрута, м/с (~5 км/ч) */
  walkSpeed: 1.35,
  /** Надбавка на проход через дверь, сек */
  doorPenaltySec: 3,
  /** Надбавка на ожидание лифта, сек */
  elevatorWaitSec: 20,
  /** Стоимость подъёма/спуска по лестнице за этаж, сек */
  floorStairsSec: 18,

  /** Сцены/камера */
  scene: {
    /** Размер «пол» кампуса, м */
    groundSize: 420,
    fogNear: 160,
    fogFar: 420,
    skyColor: '#0b0d12',
    gridColor: '#1c2333',
    gridSubdivision: 42,
    /** Высота камеры в свободном режиме */
    defaultCameraY: 90,
    maxPixelRatio: 2,
  },

  /** Полёт камеры вдоль маршрута */
  flight: {
    /** Множитель скорости реального времени (1 = как идёшь пешком; для облёта ускоряем) */
    timeScale: 6,
    /** Смещение камеры вверх от точки маршрута, м */
    cameraHeight: 7.5,
    /** Задержка камеры позади точки маршрута, м */
    cameraBack: 9,
    /** Сглаживание позиции камеры (0..1, выше = резче) */
    positionLerp: 0.12,
    /** Сглаживание точки взгляда */
    lookAtLerp: 0.16,
    /** Пауза на каждом шаге инструкции, сек (реального времени полёта) */
    pausePerStep: 0.9,
    /** Минимальная длительность сегмента полёта, сек */
    minSegmentSec: 0.8,
  },

  /** Стилизация 3D (low-poly / neon, не фотореализм) */
  style: {
    buildingBaseColor: '#1a2130',
    buildingRoofColor: '#141a26',
    buildingEdgeColor: '#38e1ff',
    roomColors: {
      classroom: '#243447',
      lab: '#1f3a4d',
      office: '#2b3a55',
      'lecture-hall': '#27405c',
      'assembly-hall': '#2c4a63',
      'cafeteria-seating': '#3a3350',
      kitchen: '#423a52',
      storage: '#20262f',
      restroom: '#22303a',
      gym: '#2e4460',
      pool: '#1e4a5f',
      'reading-room': '#2a3f57',
      ward: '#31465c',
      corridor: '#161c26',
      lobby: '#1d2836',
      other: '#1a2130',
    } as Record<string, string>,
    outdoorPathColor: '#232a38',
    routeColor: '#38e1ff',
    routeGlowColor: '#f5c542',
    startColor: '#3ddc84',
    finishColor: '#ff5d5d',
    /** Выдавливание этажей друг над другом в режиме «разрез» */
    explodeStep: 5.2,
    /** Прозрачность перекрытий соседних этажей */
    dimmedOpacity: 0.12,
  },

  /** UI */
  ui: {
    /** Максимум результатов поиска */
    searchLimit: 8,
    /** Меток маршрута-стрелок на 100 м */
    arrowsPer100m: 6,
  },

  /** Локаль — все подсказки на русском */
  locale: 'ru-RU',
} as const;

export type Config = typeof CONFIG;
