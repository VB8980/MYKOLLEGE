/**
 * Campus Navigator 3D — предметная модель данных кампуса.
 *
 * Единый 3D-граф навигации: улицы кампуса (outdoor) -> входные двери зданий ->
 * внутренние этажи (rooms/corridors) -> лестницы/лифты между этажами.
 * Все координаты — в метрах, плоскость XZ; Y — вверх (высота этажа).
 */

/* ============================= Примитивы ============================= */

/** Двумерная точка в плане (XZ), метры. */
export interface Vec2 {
  x: number;
  z: number;
}

/** Точка в 3D (для камеры/маршрута), метры. Y — высота. */
export interface Vec3 {
  x: number;
  y: number;
  z: number;
}

/* ============================= Геометрия ============================= */

/** Простой прямоугольник в плане (здания, комнаты, коридоры). */
export interface Rect {
  /** левый нижний угол по X */
  minX: number;
  minZ: number;
  maxX: number;
  maxZ: number;
}

/** Форма этажа здания — набор прямоугольников (Г- и Т-образные корпуса). */
export type FloorShape = Rect[];

/* ============================= Здания и этажи ============================= */

/** Тип здания — влияет на стиль и иконки. */
export type BuildingKind =
  | 'academic' // учебный корпус
  | 'dormitory' // общежитие
  | 'canteen' // столовая
  | 'sports' // спорткомплекс
  | 'library' // библиотека
  | 'admin' // администрация
  | 'medical' // медпункт
  | 'other';

/** Комната / помещение на этаже. */
export interface Room {
  id: string;
  /** Отображаемый номер («123», «Актовый зал») */
  number: string;
  name: string;
  kind: RoomKind;
  buildingId: string;
  floor: number;
  rect: Rect;
  /** Двери комнаты (точки графа внутри комнаты у стены) */
  doorNodes: string[];
}

export type RoomKind =
  | 'classroom'
  | 'lab'
  | 'office'
  | 'lecture-hall'
  | 'assembly-hall'
  | 'cafeteria-seating'
  | 'kitchen'
  | 'storage'
  | 'restroom'
  | 'gym'
  | 'pool'
  | 'reading-room'
  | 'ward'
  | 'corridor'
  | 'lobby'
  | 'other';

/** Этаж здания. */
export interface Floor {
  level: number; // ..., -1, 0, 1, 2 ...
  name: string; // «1 этаж», «Подземный уровень»
  height: number; // абсолютная Y пола, м
  ceiling: number; // высота потолка, м
  shape: FloorShape; // footprint этажа
  roomIds: string[];
}

/** Здание кампуса. */
export interface Building {
  id: string;
  name: string;
  shortName: string; // «Корпус 1», «Общага №3»
  kind: BuildingKind;
  /** Внешний контур (для 3D-коробки) */
  footprint: Rect;
  levels: number[]; // этажи, включая цоколь (-1)
  floors: Floor[];
  color?: string; // акцентный цвет фасада
}

/* ============================= Двери и переходы ============================= */

/** Входная дверь здания с улицы. */
export interface EntranceDoor {
  id: string;
  buildingId: string;
  /** позиция на улице (XZ) */
  position: Vec2;
  /** наружная точка графа (на тротуаре у двери) */
  outdoorNode: string;
  /** внутренняя точка графа (в холле за дверью) */
  indoorNode: string;
  /** сторона фасада для подсказки «дверь справа/слева» */
  side: 'north' | 'south' | 'east' | 'west';
  locked?: boolean;
  label?: string; // «Главный вход», «Торцы»
}

/** Вертикальный переход между этажами. */
export type VerticalKind = 'stairs' | 'elevator' | 'escalator';

export interface VerticalConnection {
  id: string;
  buildingId: string;
  kind: VerticalKind;
  position: Vec2; // плановое положение
  fromFloor: number;
  toFloor: number;
  fromNode: string;
  toNode: string;
  label?: string; // «Лестница А», «Лифт у входа»
}

/* ============================= Граф ============================= */

/** Тип узла графа навигации. */
export type NavNodeType =
  | 'street' // точка на улице/площадке кампуса
  | 'plaza' // площадь, сквер, остановка
  | 'door-outdoor' // снаружи у двери
  | 'door-indoor' // внутри за дверью
  | 'corridor' // точка в коридоре
  | 'room' // представительство комнаты (её «центр»)
  | 'stairs' // площадка лестницы
  | 'elevator'; // кабина/холфт лифта

/** Узел графа (единственный источник правды для маршрутов). */
export interface NavNode {
  id: string;
  type: NavNodeType;
  position: Vec3; // уже с учётом высоты этажа
  buildingId?: string; // если внутри здания
  floor?: number;
  roomId?: string; // если это «якорь» комнаты
  /** Человекочитаемое имя для подсказок/поиска */
  label?: string;
}

/** Ребро графа. */
export interface NavEdge {
  from: string;
  to: string;
  /** Проходимое? (locked двери, служебные проходы) */
  bidirectional?: boolean;
  /** Вес = длина (вычисляется из геометрии), сек/метры */
  cost?: number;
  kind: EdgeKind;
}

export type EdgeKind =
  | 'street' // пешком по улице
  | 'through-door' // пройти сквозь дверь (меняет indoor/outdoor)
  | 'indoor' // перемещение внутри здания по коридору
  | 'vertical' // лестница/лифт (меняет этаж)
  | 'enter-room' // войти в комнату из коридора
  | 'exit-building';

/* ============================= Кампус (сборный корень) ============================= */

/** Улица/тропинка кампуса — полилиния узлов. */
export interface OutdoorPath {
  id: string;
  name: string;
  nodeIds: string[]; // цепочка street/plaza узлов по порядку
  width: number; // ширина дорожки для отрисовки, м
  surface: 'asphalt' | 'paving' | 'grass-path' | 'bridge';
}

/** Ориентир на карте (памятник, остановка, турникет). */
export interface Landmark {
  id: string;
  name: string;
  position: Vec2;
  icon: string;
}

/** Полный набор данных кампуса. */
export interface CampusData {
  name: string;
  buildings: Building[];
  rooms: Room[];
  doors: EntranceDoor[];
  verticals: VerticalConnection[];
  nodes: NavNode[];
  edges: NavEdge[];
  paths: OutdoorPath[];
  landmarks: Landmark[];
}

/* ============================= Маршрут и шаги ============================= */

/** Сегмент маршрута — часть пути одного типа. */
export interface RouteSegment {
  kind: EdgeKind | 'wait';
  nodeIds: string[]; // последовательность узлов сегмента
  distance: number; // метры
  fromFloor?: number;
  toFloor?: number;
  buildingId?: string;
}

/** Тип шага инструкции. */
export type InstructionKind =
  | 'start'
  | 'straight'
  | 'turn-left'
  | 'turn-right'
  | 'slight-left'
  | 'slight-right'
  | 'sharp-left'
  | 'sharp-right'
  | 'uturn'
  | 'enter-building'
  | 'exit-building'
  | 'door-left'
  | 'door-right'
  | 'stairs-up'
  | 'stairs-down'
  | 'elevator-up'
  | 'elevator-down'
  | 'arrive-room'
  | 'arrive-outdoor'
  | 'finish';

/** Иконка манёвра (для UI/подсказок). */
export type ManeuverIcon =
  | 'arrow-straight'
  | 'arrow-left'
  | 'arrow-right'
  | 'arrow-slight-left'
  | 'arrow-slight-right'
  | 'door'
  | 'stairs-up'
  | 'stairs-down'
  | 'elevator'
  | 'flag-start'
  | 'flag-finish'
  | 'building';

/** Пошаговая инструкция на русском. */
export interface RouteStep {
  index: number;
  kind: InstructionKind;
  icon: ManeuverIcon;
  /** Основной текст («Поверните налево») */
  text: string;
  /** Уточнение («…и продолжайте движение к лестнице А») */
  detail?: string;
  /** Позиция начала шага */
  at: Vec3;
  /** Позиция конца шага */
  to: Vec3;
  /** Длина шага, м */
  distance: number;
  /** Направление движения на входе в шаг (градусы, 0 = +X, по часовой) */
  headingIn: number;
  /** Направление на выходе */
  headingOut: number;
  segmentIndex: number;
  floor?: number;
  buildingId?: string;
  /** Временная отметка для полёта камеры, сек от старта */
  tStart: number;
  tEnd: number;
}

/** Построенный маршрут целиком. */
export interface Route {
  id: string;
  fromLabel: string;
  toLabel: string;
  nodeIds: string[]; // полный путь по узлам
  points: Vec3[]; // сглаженная полилиния для 3D/камеры
  segments: RouteSegment[];
  steps: RouteStep[];
  distance: number; // метры
  durationSec: number; // оценка времени пешком
  floorsVisited: number[];
}

/** Точка выбора «откуда/куда». */
export interface Place {
  id: string; // = nodeId или roomId
  name: string;
  category: 'building' | 'room' | 'outdoor' | 'landmark';
  floor?: number;
  buildingId?: string;
  description?: string;
}

