/**
 * campusLayout.ts — ЕДИНЫЙ ИСТОЧНИК уличной геометрии кампуса (layout-файл).
 *
 * Система координат layout: X — восток, Y — СЕВЕР (как на исходном плане корпуса 1),
 * единицы — метры. В мир Three.js преобразуется так: worldX = x, worldZ = -y.
 *
 * Значения получены из аэрофототопосъёмки и уточняются трассировкой
 * (режим «Трассировка» поверх спутниковой подложки /satellite.jpg).
 */

/* ----------------------------- примитивы ----------------------------- */

/** Точка в плане layout: x — восток, y — север (метры). */
export type LPoint = [number, number];

/** Прямоугольник footprint: [x, y, w, h], где (x, y) — юго-западный угол. */
export type FootprintRect = [number, number, number, number];

/* ----------------------------- типы слоя ----------------------------- */

export interface BuildingFootprint {
  id: string;
  /** отображаемое название (для подписей на карте) */
  label: string;
  /** число этажей — высота экструзии = levels * LEVEL_HEIGHT */
  levels: number;
  rect: FootprintRect;
  /** true — рисовать только бледный контур-ориентир (без целей навигации) */
  outlineOnly?: boolean;
}

export interface RoadSegment {
  id: string;
  name: string;
  width: number;
  points: LPoint[];
  kind: 'road' | 'alley' | 'bridge';
}

export interface DoorNode {
  id: string;
  buildingId: string;
  pos: LPoint;
  /** сторона света, куда смотрит дверь */
  faces: 'N' | 'S' | 'E' | 'W';
}

export interface StadiumSpec {
  center: LPoint;
  rx: number;
  ry: number;
  fieldW: number;
  fieldH: number;
}

export interface RectBox {
  min: LPoint;
  max: LPoint;
}

/* ----------------------------- константы ----------------------------- */

/** Высота одного этажа в метрах (экструзия зданий). */
export const LEVEL_HEIGHT = 3.2;

/** Границы спутниковой подложки /satellite.jpg в координатах layout (метры). */
export const SAT_BOUNDS: RectBox = { min: [-400, -250], max: [400, 450] };

/** Путь к файлу подложки (относительно public/). */
export const SATELLITE_URL = '/satellite.jpg';

/* ----------------------------- здания ----------------------------- */

export const FOOTPRINTS: BuildingFootprint[] = [
  { id: 'b1', label: 'Корпус 1', levels: 4, rect: [0, 0, 108.4, 98] }, // размер ТОЧНЫЙ из плана
  { id: 'dk', label: 'Корпус 2 / ДК', levels: 2, rect: [30, 110, 70, 55] }, // севернее b1, проход 12 м
  { id: 'uk3', label: 'Корпус 3', levels: 3, rect: [-125, 15, 95, 60] },
  { id: 'uk4', label: 'Корпус 4', levels: 1, rect: [-125, 110, 90, 55] },
  { id: 'sport', label: 'Корпус 5 / Спорткомплекс', levels: 2, rect: [130, 110, 110, 60] },
  { id: 'college', label: 'Корпус 8 / Колледж', levels: 2, rect: [-190, -95, 80, 45] }, // СЕВЕРНОЙ стеной к Солнечной аллее... (см. примечание ниже)
  { id: 'proton', label: 'Корпус 6 / Протон', levels: 3, rect: [-250, 0, 120, 90] },
  { id: 'lab', label: 'Корпус 7', levels: 3, rect: [-250, 110, 110, 80], outlineOnly: true }, // только бледный контур-ориентир
];

/* ----------------------------- стадион ----------------------------- */

export const STADIUM: StadiumSpec = {
  center: [80, 245],
  rx: 90,
  ry: 55,
  fieldW: 105,
  fieldH: 68,
};

/* ----------------------------- площадь ----------------------------- */

/** Площадь Шокина — светлое пятно (полигон). */
export const PLAZA: { id: string; label: string; polygon: LPoint[] } = {
  id: 'plaza.shokina',
  label: 'Площадь Шокина',
  polygon: [[110, 20], [190, 20], [190, 90], [110, 90]],
};

/* ----------------------------- дороги ----------------------------- */

export const ROADS: RoadSegment[] = [
  {
    id: 'road.solnechnaya',
    name: 'Солнечная аллея',
    width: 8,
    kind: 'alley',
    points: [[-300, -115], [-200, -108], [-100, -103], [0, -100], [100, -104], [200, -112], [280, -120]],
  },
  {
    id: 'road.central',
    name: 'Центральный проспект',
    width: 6,
    kind: 'road',
    points: [[215, -120], [215, -40], [215, 40], [215, 120], [215, 200]],
  },
  {
    id: 'alley.plaza',
    name: 'Аллея площади',
    width: 5,
    kind: 'alley',
    points: [[215, 40], [170, 45], [140, 49], [109, 42]],
  },
  {
    id: 'road.west',
    name: 'Западная аллея',
    width: 4,
    kind: 'alley',
    points: [[-100, -103], [-105, -40], [-108, 20], [-105, 80], [-100, 140]],
  },
  {
    id: 'road.northring',
    name: 'Северное кольцо',
    width: 4,
    kind: 'road',
    points: [[-100, 140], [-20, 150], [60, 150], [130, 140]],
  },
  {
    id: 'bridge.b1.dk',
    name: 'Мост b1→ДК',
    width: 4,
    kind: 'bridge',
    points: [[55, 98], [55, 110]],
  },
];

/* ----------------------------- двери (уличные узлы) ----------------------------- */

export const DOORS: DoorNode[] = [
  { id: 'do.b1', buildingId: 'b1', pos: [108.4, 42], faces: 'E' },
  { id: 'do.dk', buildingId: 'dk', pos: [65, 110], faces: 'S' },
  { id: 'do.uk3', buildingId: 'uk3', pos: [-30, 45], faces: 'E' },
  { id: 'do.uk4', buildingId: 'uk4', pos: [-80, 110], faces: 'S' },
  { id: 'do.sport', buildingId: 'sport', pos: [185, 110], faces: 'S' },
  { id: 'do.college', buildingId: 'college', pos: [-150, -50], faces: 'S' }, // смотрит на Солнечную аллею
  { id: 'do.proton', buildingId: 'proton', pos: [-130, 45], faces: 'E' },
];

/* ----------------------------- вспомогательные функции ----------------------------- */

/** Преобразование точки layout (x — восток, y — север) в мир Three.js (worldZ = -y). */
export function layoutToWorld(p: LPoint): { x: number; z: number } {
  return { x: p[0], z: -p[1] };
}

/** Центр footprint в координатах layout. */
export function footprintCenter(rect: FootprintRect): LPoint {
  return [rect[0] + rect[2] / 2, rect[1] + rect[3] / 2];
}

/** Найти footprint по id. */
export function getFootprint(id: string): BuildingFootprint | undefined {
  return FOOTPRINTS.find((f) => f.id === id);
}

/** Найти дорогу по id. */
export function getRoad(id: string): RoadSegment | undefined {
  return ROADS.find((r) => r.id === id);
}

/** Найти дверь по id. */
export function getDoor(id: string): DoorNode | undefined {
  return DOORS.find((d) => d.id === id);
}

/** Двери конкретного здания. */
export function doorsOfBuilding(buildingId: string): DoorNode[] {
  return DOORS.filter((d) => d.buildingId === buildingId);
}
