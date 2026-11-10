/**
 * campusLayout.ts — ЕДИНЫЙ ИСТОЧНИК УЛИЧНОЙ ГЕОМЕТРИИ кампуса МИЭТ.
 *
 * Система координат layout: X — восток, Y — СЕВЕР (как в исходном плане
 * корпуса 1), метры. Перевод в world-координаты сцены (Three.js, XZ):
 *   worldX = x,  worldZ = -y   (см. lx()/ly() ниже).
 *
 * Значения взяты из аэрофототопологии; редактор трассировки (этап 3)
 * позволит уточнять их по спутниковой подложке /satellite.jpg.
 */

/* ============================= Типы layout ============================= */

/** Точка плана layout [x, y], метры (x — восток, y — север). */
export type Pt = readonly [number, number];

/** Прямоугольный контур здания: [x, y, w, h] — левый нижний угол + размеры. */
export type FootprintTuple = readonly [number, number, number, number];

export interface Footprint {
  id: string;
  /** левая нижняя точка (юго-запад) */
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface Road {
  id: string;
  name: string;
  /** полилиния [x, y] в координатах layout */
  pts: Pt[];
  /** ширина, м */
  width: number;
  surface: 'asphalt' | 'paving' | 'bridge';
}

export interface Stadium {
  center: Pt;
  rx: number;
  ry: number;
  /** внутреннее поле (разметка линиями) */
  fieldW: number;
  fieldH: number;
  name: string;
}

export interface Plaza {
  id: string;
  name: string;
  polygon: Pt[];
}

export interface DoorPoint {
  id: string;      // сохраняем старые id уличных узлов do.*
  label: string;
  pos: Pt;         // точка на тротуаре у фасада (layout)
}

/* ============================= Конвертеры layout -> world ============================= */

/** layout.x -> world X (восток). */
export const lx = (p: Pt): number => p[0];
/** layout.y (СЕВЕР) -> world Z: worldZ = -y. */
export const ly = (p: Pt): number => -p[1];

/* ============================= FOOTPRINTS ============================= */

const T = (id: string, t: FootprintTuple): Footprint =>
  ({ id, x: t[0], y: t[1], w: t[2], h: t[3] });

export const FOOTPRINTS: Record<string, Footprint> = {
  b1:      T('b1', [0, 0, 108.4, 98]),        // главный корпус, размер ТОЧНЫЙ из плана
  dk:      T('dk', [30, 110, 70, 55]),        // корпус 2 / ДК, севернее b1 через проход 12 м
  uk3:     T('uk3', [-125, 15, 95, 60]),      // корпус 3
  uk4:     T('uk4', [-125, 110, 90, 55]),     // корпус 4
  sport:   T('sport', [130, 110, 110, 60]),   // корпус 5 / спорткомплекс
  college: T('college', [-190, -95, 80, 45]), // корпус 8 / колледж, СЕВЕРНОЙ стеной к Солнечной аллее
  proton:  T('proton', [-250, 0, 120, 90]),   // корпус 6 / Протон
  lab:     T('lab', [-250, 110, 110, 80]),    // корпус 7, только бледный контур-ориентир
};

/** Число этажей для экструзии (высота = levels * 3.2). */
export const BUILDING_LEVELS: Record<string, number> = {
  b1: 2, dk: 2, uk3: 3, uk4: 1, sport: 2, college: 2, proton: 2, lab: 1,
};

/** Отображаемые короткие имена (для подписей на карте). */
export const BUILDING_SHORT: Record<string, string> = {
  b1: 'Корпус 1', dk: 'Корпус 2 · ДК', uk3: 'Корпус 3', uk4: 'Корпус 4',
  sport: 'Корпус 5 · Спорт', college: 'Колледж', proton: 'Протон', lab: 'Лабораторный',
};

/* ============================= STADIUM / PLAZA ============================= */

export const STADIUM: Stadium = {
  center: [80, 245], rx: 90, ry: 55, fieldW: 105, fieldH: 68, name: 'Стадион МИЭТ',
};

export const PLAZA: Plaza = {
  id: 'plaza.shokina', name: 'Площадь Шокина',
  polygon: [[110, 20], [190, 20], [190, 90], [110, 90]],
};

/* ============================= ROADS ============================= */

const R = (id: string, name: string, width: number, surface: Road['surface'], pts: Pt[]): Road =>
  ({ id, name, width, surface, pts });

export const ROADS: Road[] = [
  R('road.sun', 'Солнечная аллея', 8, 'asphalt',
    [[-300, -115], [-200, -108], [-100, -103], [0, -100], [100, -104], [200, -112], [280, -120]]),
  R('road.central', 'Центральный проспект', 6, 'asphalt',
    [[215, -120], [215, -40], [215, 40], [215, 120], [215, 200]]),
  R('road.plaza', 'Аллея площади', 5, 'paving',
    [[215, 40], [170, 45], [140, 49], [109, 42]]),
  R('road.west', 'Западная аллея', 4, 'paving',
    [[-100, -103], [-105, -40], [-108, 20], [-105, 80], [-100, 140]]),
  R('road.north', 'Северное кольцо', 4, 'paving',
    [[-100, 140], [-20, 150], [60, 150], [130, 140]]),
  R('road.bridge', 'Мост корпус 1 → ДК', 4, 'bridge',
    [[55, 98], [55, 110]]),
];

/* ============================= DOORS ============================= */

/** Уличные узлы дверей; id сохраняем старые (do.*). */
export const DOORS: DoorPoint[] = [
  { id: 'do.b1',     label: 'Главный вход (портал)', pos: [108.4, 42] },
  { id: 'do.dk',     label: 'Вход ДК МИЭТ',          pos: [65, 110] },
  { id: 'do.uk3',    label: 'Вход корпуса 3',        pos: [-30, 45] },
  { id: 'do.uk4',    label: 'Вход корпуса 4',        pos: [-80, 110] },
  { id: 'do.sport',  label: 'Вход спорткомплекса',   pos: [185, 110] },
  { id: 'do.college',label: 'Вход колледжа',         pos: [-150, -50] },
  { id: 'do.proton', label: 'Вход Протон (учебный)', pos: [-130, 45] },
];

/* ============================= SAT UNDERLAY ============================= */

/** URL спутниковой подложки (класть в public/). */
export const SAT_URL = '/satellite.jpg';
/** Прозрачность подложки под вектором. */
export const SAT_OPACITY = 0.55;
/** Границы подложки в координатах layout: minX, minY (ЮЗ), maxX, maxY (СЕВ). */
export const SAT_BOUNDS: readonly [number, number, number, number] = [-320, -160, 320, 340];

/* ============================= Вспомогательные преобразования ============================= */

/** Прямоугольник footprint в world-осях (XZ, как Rect в types.ts). */
export function footprintToWorldRect(f: Footprint): { minX: number; minZ: number; maxX: number; maxZ: number } {
  return { minX: f.x, maxX: f.x + f.w, minZ: -(f.y + f.h), maxZ: -f.y };
}

/** Полилиния layout -> точки world [x, 0, z]. */
export function roadToWorldPoints(pts: Pt[], y = 0.12): [number, number, number][] {
  return pts.map((p) => [lx(p), y, ly(p)]);
}
