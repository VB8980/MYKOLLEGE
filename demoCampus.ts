/**
 * Демонстрационный кампус колледжа: 7 зданий с внутренними этажами,
 * входные двери, лестницы/лифты и единый навигационный граф.
 *
 * Конвенции:
 *  - Y пола: этаж 1 = 0, каждый следующий +4 м (цоколь -1 = -4 м).
 *  - Коридоры идут вдоль Z («вдоль корпуса»), входы комнат — с западной стороны.
 *  - id узлов: c.<bld>.<floor>.<n> (коридор), r.<roomId> (комната),
 *    st/el.<bld>.<n>.<floor> (вертикальные), i.d.<key> (внутренняя точка двери).
 *  - Наружные точки дверей d.<key> и street-подходы объявлены в campusOutdoor.ts.
 */

import type {
  Building,
  CampusData,
  EntranceDoor,
  Floor,
  NavEdge,
  NavNode,
  Rect,
  Room,
  VerticalConnection,
} from './types';
import {
  DOOR_ANCHORS,
  DOOR_OUTDOOR_POS,
  LANDMARKS,
  OUTDOOR_EDGES,
  OUTDOOR_NODES,
  OUTDOOR_PATHS,
} from './campusOutdoor';

/* ============================= геометрия зданий ============================= */

export const BUILDINGS: Building[] = [
  {
    id: 'b1',
    name: 'Учебный корпус №1',
    shortName: 'Корпус 1',
    kind: 'academic',
    footprint: rect(100, -30, 180, 30),
    levels: [1, 2, 3],
    floors: [],
    color: '#1e2a3d',
  },
  {
    id: 'b2',
    name: 'Библиотека',
    shortName: 'Библиотека',
    kind: 'library',
    footprint: rect(-135, -120, -65, -70),
    levels: [1, 2],
    floors: [],
    color: '#20304a',
  },
  {
    id: 'b3',
    name: 'Учебный корпус №2',
    shortName: 'Корпус 2',
    kind: 'academic',
    footprint: rect(-135, -50, -65, 5),
    levels: [-1, 1, 2],
    floors: [],
    color: '#1c2739',
  },
  {
    id: 'b4',
    name: 'Общежитие №3',
    shortName: 'Общага №3',
    kind: 'dormitory',
    footprint: rect(-135, 60, -65, 110),
    levels: [1, 2, 3],
    floors: [],
    color: '#232c40',
  },
  {
    id: 'b5',
    name: 'Столовая «Академия»',
    shortName: 'Столовая',
    kind: 'canteen',
    footprint: rect(30, 30, 70, 60),
    levels: [1],
    floors: [],
    color: '#2a2740',
  },
  {
    id: 'b6',
    name: 'Спортивный комплекс',
    shortName: 'Спорткомплекс',
    kind: 'sports',
    footprint: rect(70, 60, 130, 110),
    levels: [1],
    floors: [],
    color: '#1f3347',
  },
  {
    id: 'b7',
    name: 'Медицинский центр',
    shortName: 'Медпункт',
    kind: 'medical',
    footprint: rect(130, -70, 180, -30),
    levels: [1],
    floors: [],
    color: '#274050',
  },
];

/* ============================= комнаты ============================= */

/** Буферы графа: наполняются при определении комнат и сборке (объявлены до использования). */
const navNodes: NavNode[] = [...OUTDOOR_NODES];
const edges: NavEdge[] = [...OUTDOOR_EDGES];

const ROOMS: Room[] = [];
const FLOOR_BY_BUILDING: Record<string, Floor[]> = { b1: [], b2: [], b3: [], b4: [], b5: [], b6: [], b7: [] };

/** Якорные точки комнат (nodeId) для связки corridor -> room. */
const roomAnchors: Record<string, string[]> = {};

function addRoom(
  buildingId: string,
  level: number,
  opts: {
    number: string;
    name: string;
    kind: Room['kind'];
    rect: Rect;
    /** координаты точек дверей на стене (обычно западная сторона коридора) */
    doors: Array<{ x: number; z: number }>;
  },
): Room {
  const id = `${buildingId}.${level}.${opts.number}`;
  const floorY = floorYOf(level);
  const doorNodes = opts.doors.map((d, i) => `rd.${id}.${i}`);
  const room: Room = {
    id,
    number: opts.number,
    name: opts.name,
    kind: opts.kind,
    buildingId,
    floor: level,
    rect: opts.rect,
    doorNodes,
  };
  ROOMS.push(room);
  // узел-представитель комнаты
  navNodes.push({
    id: `r.${id}`,
    type: 'room',
    position: mid3(opts.rect, floorY + 0.1),
    buildingId,
    floor: level,
    roomId: id,
    label: roomLabel(room),
  });
  // узлы дверей комнаты (стоят у стены, внутри комнаты)
  doorNodes.forEach((nid, i) => {
    const d = opts.doors[i];
    navNodes.push({
      id: nid,
      type: 'corridor',
      position: { x: d.x, y: floorY, z: d.z },
      buildingId,
      floor: level,
      roomId: id,
    });
  });
  roomAnchors[id] = doorNodes;
  return room;
}

function roomLabel(r: Room): string {
  return r.kind === 'classroom' || r.kind === 'lab' || r.kind === 'office'
    ? `${r.name} (${r.number})`
    : r.name;
}

/* ---------------- b1: учебный корпус №1 (3 этажа) ---------------- */

for (const level of [1, 2, 3]) {
  const fy = floorYOf(level);
  const prefix = String(level);
  addRoom('b1', level, {
    number: `${prefix}01`,
    name: 'Лекционный зал',
    kind: 'lecture-hall',
    rect: rect(134, -26, 176, -10),
    doors: [{ x: 135.5, z: -18 }],
  });
  addRoom('b1', level, {
    number: `${prefix}02`,
    name: 'Кабинет истории',
    kind: 'classroom',
    rect: rect(134, -8, 154, 6),
    doors: [{ x: 135.5, z: -1 }],
  });
  addRoom('b1', level, {
    number: `${prefix}03`,
    name: 'Кабинет физики',
    kind: 'lab',
    rect: rect(156, -8, 176, 6),
    doors: [{ x: 157.5, z: -1 }],
  });
  addRoom('b1', level, {
    number: `${prefix}04`,
    name: 'Кабинет математики',
    kind: 'classroom',
    rect: rect(134, 8, 154, 22),
    doors: [{ x: 135.5, z: 15 }],
  });
  addRoom('b1', level, {
    number: `${prefix}05`,
    name: 'Компьютерный класс',
    kind: 'lab',
    rect: rect(156, 8, 176, 22),
    doors: [{ x: 157.5, z: 15 }],
  });
  // коридорные узлы b1 (западная стена комнат x=134 => коридор 122..132)
  void fy;
}

/* ---------------- b2: библиотека (2 этажа) ---------------- */

addRoom('b2', 1, {
  number: 'Холл',
  name: 'Холл библиотеки',
  kind: 'lobby',
  rect: rect(-120, -118, -80, -100),
  doors: [{ x: -100, z: -117 }], // со стороны северной двери
});
addRoom('b2', 1, {
  number: '1.1',
  name: 'Зал выдачи',
  kind: 'reading-room',
  rect: rect(-120, -98, -80, -74),
  doors: [{ x: -100, z: -96.5 }],
});
addRoom('b2', 2, {
  number: '2.1',
  name: 'Читальный зал',
  kind: 'reading-room',
  rect: rect(-130, -118, -70, -98),
  doors: [{ x: -100, z: -96.5 }],
});
addRoom('b2', 2, {
  number: '2.2',
  name: 'Архив',
  kind: 'storage',
  rect: rect(-130, -96, -70, -74),
  doors: [{ x: -100, z: -97.5 }],
});

/* ---------------- b3: учебный корпус №2 (цоколь + 2 этажа) ---------------- */

addRoom('b3', -1, {
  number: '-101',
  name: 'Склад оборудования',
  kind: 'storage',
  rect: rect(-130, -46, -70, -28),
  doors: [{ x: -100, z: -26.5 }],
});
addRoom('b3', -1, {
  number: '-102',
  name: 'Серверная',
  kind: 'other',
  rect: rect(-130, -26, -70, -6),
  doors: [{ x: -100, z: -27.5 }],
});
addRoom('b3', 1, {
  number: '101',
  name: 'Кабинет химии',
  kind: 'lab',
  rect: rect(-130, -46, -70, -28),
  doors: [{ x: -100, z: -26.5 }],
});
addRoom('b3', 1, {
  number: '102',
  name: 'Кабинет биологии',
  kind: 'lab',
  rect: rect(-130, -26, -70, -6),
  doors: [{ x: -100, z: -27.5 }],
});
addRoom('b3', 2, {
  number: '201',
  name: 'Актовый зал',
  kind: 'assembly-hall',
  rect: rect(-130, -46, -70, -6),
  doors: [{ x: -100, z: -26.5 }],
});

/* ---------------- b4: общежитие №3 (3 этажа) ---------------- */

for (const level of [1, 2, 3]) {
  const p = String(level);
  addRoom('b4', level, {
    number: `${p}0`,
    name: 'Кофейня',
    kind: 'cafeteria-seating',
    rect: rect(-130, 64, -70, 76),
    doors: [{ x: -100, z: 77.5 }],
  });
  addRoom('b4', level, {
    number: `${p}1–${p}4`,
    name: `Жилое крыло ${p}-го этажа`,
    kind: 'other',
    rect: rect(-130, 78, -70, 96),
    doors: [{ x: -100, z: 89 }],
  });
  addRoom('b4', level, {
    number: `${p}5`,
    name: 'Санузел',
    kind: 'restroom',
    rect: rect(-130, 98, -70, 108),
    doors: [{ x: -100, z: 96.5 }],
  });
}

/* ---------------- b5: столовая ---------------- */

addRoom('b5', 1, {
  number: 'Зал',
  name: 'Основной зал',
  kind: 'cafeteria-seating',
  rect: rect(32, 32, 68, 50),
  doors: [{ x: 40, z: 61.5 }],
});
addRoom('b5', 1, {
  number: 'Кухня',
  name: 'Кухня',
  kind: 'kitchen',
  rect: rect(32, 52, 68, 58),
  doors: [{ x: 40, z: 50.5 }],
});

/* ---------------- b6: спорткомплекс ---------------- */

addRoom('b6', 1, {
  number: 'З1',
  name: 'Игровой зал',
  kind: 'gym',
  rect: rect(72, 62, 128, 92),
  doors: [{ x: 100, z: 88.5 }],
});
addRoom('b6', 1, {
  number: 'Б',
  name: 'Бассейн',
  kind: 'pool',
  rect: rect(72, 94, 128, 108),
  doors: [{ x: 100, z: 92.5 }],
});

/* ---------------- b7: медпункт ---------------- */

addRoom('b7', 1, {
  number: 'К1',
  name: 'Кабинет врача',
  kind: 'ward',
  rect: rect(132, -68, 178, -52),
  doors: [{ x: 126.5, z: -60 }],
});
addRoom('b7', 1, {
  number: 'П',
  name: 'Процедурная',
  kind: 'ward',
  rect: rect(132, -50, 178, -32),
  doors: [{ x: 126.5, z: -41 }],
});

/* ============================= этажи ============================= */

/** Формируем Floor для каждого здания из его прямоугольников-комнат. */
function buildFloors(): void {
  for (const b of BUILDINGS) {
    const byLevel = new Map<number, Room[]>();
    for (const r of ROOMS.filter((x) => x.buildingId === b.id)) {
      const arr = byLevel.get(r.floor) ?? [];
      arr.push(r);
      byLevel.set(r.floor, arr);
    }
    for (const level of b.levels) {
      const rooms = byLevel.get(level) ?? [];
      const shape: Rect[] = rooms.map((r) => r.rect);
      FLOOR_BY_BUILDING[b.id].push({
        level,
        name: levelName(level),
        height: floorYOf(level),
        ceiling: 3.4,
        shape,
        roomIds: rooms.map((r) => r.id),
      });
    }
    b.floors = FLOOR_BY_BUILDING[b.id];
  }
}

function levelName(level: number): string {
  if (level < 0) return `Подземный уровень (${level})`;
  if (level === 1) return '1 этаж';
  return `${level} этаж`;
}

function floorYOf(level: number): number {
  return (level - 1) * 4;
}

/* ============================= двери зданий ============================= */

export const DOORS: EntranceDoor[] = [
  door('b1', 'north', 'Главный вход корпуса 1'),
  door('b1', 'east', 'Восточный вход корпуса 1'),
  door('b1', 'south', 'Южный вход корпуса 1'),
  door('b2', 'north', 'Главный вход библиотеки'),
  door('b2', 'west', 'Западный вход библиотеки', true),
  door('b3', 'north', 'Северный вход корпуса 2'),
  door('b3', 'south', 'Южный вход корпуса 2'),
  door('b4', 'west', 'Западный вход общежития'),
  door('b4', 'south', 'Главный вход общежития'),
  door('b5', 'east', 'Вход в столовую'),
  door('b6', 'south', 'Вход в спорткомплекс'),
  door('b7', 'west', 'Вход в медпункт'),
];

function door(buildingId: string, side: EntranceDoor['side'], label: string, locked = false): EntranceDoor {
  const key = doorKey(buildingId, side);
  const pos = DOOR_OUTDOOR_POS[key];
  if (!pos) throw new Error(`Нет позиции двери ${key}`);
  const indoor = indoorDoorPos(buildingId, side);
  return {
    id: key,
    buildingId,
    position: pos,
    outdoorNode: `d.${key}`,
    indoorNode: `i.d.${key}`,
    side,
    locked,
    label,
  };
}

function doorKey(buildingId: string, side: string): string {
  // особые ключи совпадают с DOOR_OUTDOOR_POS
  if (buildingId === 'b5') return 'b5-canteen';
  if (buildingId === 'b7') return 'b7-medical';
  return `${buildingId}-${side}`;
}

/** Внутренняя точка каждой двери (в холле за дверью, Y = 0 — все входы на 1 этаже). */
function indoorDoorPos(buildingId: string, side: EntranceDoor['side']): { x: number; z: number } {
  const table: Record<string, { x: number; z: number }> = {
    'b1-north': { x: 150, z: -27 },
    'b1-east': { x: 177, z: 5 },
    'b1-south': { x: 125, z: 27 },
    'b2-north': { x: -100, z: -116 },
    'b2-west': { x: -117, z: -95 },
    'b3-north': { x: -100, z: -47 },
    'b3-south': { x: -100, z: 3 },
    'b4-west': { x: -117, z: 85 },
    'b4-south': { x: -100, z: 106 },
    'b5-canteen': { x: 67, z: 45 },
    'b6-south': { x: 100, z: 89 },
    'b7-medical': { x: 133, z: -60 },
  };
  const key = doorKey(buildingId, side);
  const p = table[key];
  if (!p) throw new Error(`Нет внутренней точки двери ${key}`);
  return p;
}

/* ============================= вертикальные переходы ============================= */

const VERTICALS_BUF: VerticalConnection[] = [];
export const VERTICALS: VerticalConnection[] = [
  // b1: лестница А и лифт
  v('b1', 'stairs', { x: 127, z: -22 }, 1, 2, 'Лестница А'),
  v('b1', 'stairs', { x: 127, z: -22 }, 2, 3, 'Лестница А'),
  v('b1', 'stairs', { x: 127, z: 18 }, 1, 2, 'Лестница Б'),
  v('b1', 'stairs', { x: 127, z: 18 }, 2, 3, 'Лестница Б'),
  v('b1', 'elevator', { x: 127, z: -2 }, 1, 2, 'Лифт'),
  v('b1', 'elevator', { x: 127, z: -2 }, 2, 3, 'Лифт'),
  // b2
  v('b2', 'stairs', { x: -112, z: -99 }, 1, 2, 'Лестница'),
  v('b2', 'elevator', { x: -88, z: -99 }, 1, 2, 'Лифт'),
  // b3 (цоколь <-> 1 <-> 2)
  v('b3', 'stairs', { x: -75, z: -26 }, -1, 1, 'Лестница у входа'),
  v('b3', 'stairs', { x: -75, z: -26 }, 1, 2, 'Лестница у входа'),
  // b4
  v('b4', 'stairs', { x: -75, z: 96 }, 1, 2, 'Лестница'),
  v('b4', 'stairs', { x: -75, z: 96 }, 2, 3, 'Лестница'),
  v('b4', 'elevator', { x: -125, z: 96 }, 1, 2, 'Лифт'),
  v('b4', 'elevator', { x: -125, z: 96 }, 2, 3, 'Лифт'),
];

function v(
  buildingId: string,
  kind: VerticalConnection['kind'],
  position: { x: number; z: number },
  fromFloor: number,
  toFloor: number,
  label: string,
): VerticalConnection {
  const idx = VERTICALS_BUF.length;
  const conn: VerticalConnection = {
    id: `${buildingId}.v${idx}`,
    buildingId,
    kind,
    position,
    fromFloor,
    toFloor,
    fromNode: vertNode(buildingId, kind, position, fromFloor),
    toNode: vertNode(buildingId, kind, position, toFloor),
    label,
  };
  VERTICALS_BUF.push(conn);
  return conn;
}

function vertNode(
  buildingId: string,
  kind: VerticalConnection['kind'],
  position: { x: number; z: number },
  level: number,
): string {
  const pre = kind === 'elevator' ? 'el' : 'st';
  return `${pre}.${buildingId}.${position.x}_${position.z}.${level}`;
}

/* ============================= коридоры (узлы графа) ============================= */

interface CorridorDef {
  buildingId: string;
  level: number;
  nodes: Array<{ x: number; z: number }>;
}

const CORRIDORS: CorridorDef[] = [
  // b1 — один продольный коридор на каждом этаже (x=127)
  ...[1, 2, 3].map<CorridorDef>((lvl) => ({
    buildingId: 'b1',
    level: lvl,
    nodes: [
      { x: 127, z: -27 }, // у северного вестибюля
      { x: 127, z: -22 }, // лестница А
      { x: 127, z: -18 }, // дверь 101
      { x: 127, z: -2 }, // лифт / поворот к южным дверям
      { x: 127, z: 15 }, // траверс к дверям 104/105
      { x: 127, z: 18 }, // лестница Б
      { x: 127, z: 27 }, // к южному тамбуру
      { x: 125, z: 27 }, // южный тамбур (у вост. конца)
      { x: 177, z: 5 }, // восточное крыло у двери b1-east
      { x: 177, z: -2 },
      { x: 150, z: -27 }, // северный тамбур
    ],
  })),
  // b2 — этаж 1: холл + зал выдачи; этаж 2: читальный + архив
  { buildingId: 'b2', level: 1, nodes: [{ x: -100, z: -116 }, { x: -100, z: -99 }, { x: -112, z: -99 }, { x: -88, z: -99 }, { x: -117, z: -95 }] },
  { buildingId: 'b2', level: 2, nodes: [{ x: -112, z: -99 }, { x: -100, z: -99 }, { x: -88, z: -99 }] },
  // b3 — цоколь / 1 / 2
  { buildingId: 'b3', level: -1, nodes: [{ x: -100, z: -47 }, { x: -100, z: -26 }, { x: -75, z: -26 }] },
  { buildingId: 'b3', level: 1, nodes: [{ x: -100, z: -47 }, { x: -100, z: -26 }, { x: -75, z: -26 }, { x: -100, z: -6 }, { x: -100, z: 3 }] },
  { buildingId: 'b3', level: 2, nodes: [{ x: -75, z: -26 }, { x: -100, z: -26 }] },
  // b4 — три одинаковых этажа
  ...[1, 2, 3].map<CorridorDef>((lvl) => ({
    buildingId: 'b4',
    level: lvl,
    nodes: [
      { x: -100, z: 106 }, // южный тамбур
      { x: -100, z: 96 }, // лестница/лифт зона
      { x: -75, z: 96 },
      { x: -125, z: 96 },
      { x: -100, z: 89 },
      { x: -100, z: 77 },
      { x: -100, z: 66 }, // к западному тамбуру
      { x: -117, z: 85 },
    ],
  })),
  // b5, b6, b7 — без выделенных коридоров (тамбуры у дверей)
];

/** Добавляем коридорные узлы и рёбра; возвращаем map nodeId -> index в navNodes. */
function buildCorridors(): void {
  for (const c of CORRIDORS) {
    const fy = floorYOf(c.level);
    const ids: string[] = [];
    c.nodes.forEach((p, i) => {
      const id = `c.${c.buildingId}.${c.level}.${i}`;
      ids.push(id);
      navNodes.push({
        id,
        type: 'corridor',
        position: { x: p.x, y: fy, z: p.z },
        buildingId: c.buildingId,
        floor: c.level,
      });
    });
    for (let i = 0; i + 1 < ids.length; i++) {
      edges.push({ from: ids[i], to: ids[i + 1], kind: 'indoor', bidirectional: true });
    }
  }
}

/* ============================= сборка графа ============================= */

buildGraph();

function buildGraph(): void {
  // 1. коридоры
  buildCorridors();

  // 2. наружные узлы дверей (d.<key>) + связка с якорем улицы уже в OUTDOOR_EDGES
  for (const dr of DOORS) {
    const pos = DOOR_OUTDOOR_POS[dr.id];
    navNodes.push({
      id: dr.outdoorNode,
      type: 'door-outdoor',
      position: { x: pos.x, y: 0, z: pos.z },
      buildingId: dr.buildingId,
      label: dr.label,
    });
    const inner = indoorDoorPos(dr.buildingId, dr.side);
    navNodes.push({
      id: dr.indoorNode,
      type: 'door-indoor',
      position: { x: inner.x, y: 0, z: inner.z },
      buildingId: dr.buildingId,
      floor: 1,
      label: dr.label,
    });
    edges.push({ from: dr.outdoorNode, to: dr.indoorNode, kind: 'through-door', bidirectional: true });
    // соединяем внутреннюю точку двери с ближайшим коридорным узлом этого этажа
    linkToNearestCorridor(dr.indoorNode, dr.buildingId, 1, inner);
  }

  // 3. вертикальные переходы: узлы + рёбра vertical + привязка к коридорам
  for (const vt of VERTICALS) {
    for (const [nodeId, level] of [
      [vt.fromNode, vt.fromFloor],
      [vt.toNode, vt.toFloor],
    ] as const) {
      if (navNodes.some((nd) => nd.id === nodeId)) continue; // уже создан парным ребром
      navNodes.push({
        id: nodeId,
        type: vt.kind === 'elevator' ? 'elevator' : 'stairs',
        position: { x: vt.position.x, y: floorYOf(level), z: vt.position.z },
        buildingId: vt.buildingId,
        floor: level,
        label: vt.label,
      });
      linkToNearestCorridor(nodeId, vt.buildingId, level, vt.position);
    }
    edges.push({ from: vt.fromNode, to: vt.toNode, kind: 'vertical', bidirectional: true });
  }

  // 4. комнаты: enter-room от ближайшего коридорного узла к якорю комнаты
  for (const r of ROOMS) {
    const anchorId = `r.${r.id}`;
    for (const dn of r.doorNodes) {
      // узел двери комнаты ставим рядом с якорем — соединяем их
      edges.push({ from: dn, to: anchorId, kind: 'enter-room', bidirectional: true });
      linkToNearestCorridor(dn, r.buildingId, r.floor, nodeById(dn)!.position);
    }
  }
}

function nodeById(id: string): NavNode | undefined {
  return navNodes.find((nd) => nd.id === id);
}

/** Соединяет узел с ближайшим коридорным узлом того же здания/этажа (если ещё не соединён). */
function linkToNearestCorridor(
  nodeId: string,
  buildingId: string,
  level: number,
  pos: { x: number; y?: number; z: number },
): void {
  let best: { id: string; d: number } | null = null;
  for (const nd of navNodes) {
    if (nd.type !== 'corridor' || nd.buildingId !== buildingId || nd.floor !== level) continue;
    const d = Math.hypot(nd.position.x - pos.x, nd.position.z - pos.z);
    if (!best || d < best.d) best = { id: nd.id, d };
  }
  if (!best || best.d > 14) return;
  const dup = edges.some(
    (e) => (e.from === nodeId && e.to === best!.id) || (e.to === nodeId && e.from === best!.id),
  );
  if (!dup) edges.push({ from: nodeId, to: best.id, kind: 'indoor', bidirectional: true });
}

/* ============================= публичные данные ============================= */

buildFloors();

export const NAV_NODES: NavNode[] = dedupeNodes(navNodes);
export const NAV_EDGES: NavEdge[] = dedupeEdges(edges);

export const DEMO_CAMPUS: CampusData = {
  name: 'Колледж «Политех»',
  buildings: BUILDINGS,
  rooms: ROOMS,
  doors: DOORS,
  verticals: VERTICALS,
  nodes: NAV_NODES,
  edges: NAV_EDGES,
  paths: OUTDOOR_PATHS,
  landmarks: LANDMARKS,
};

function dedupeNodes(list: NavNode[]): NavNode[] {
  const map = new Map<string, NavNode>();
  for (const nd of list) {
    const ex = map.get(nd.id);
    if (ex && !nd.label) continue;
    map.set(nd.id, nd);
  }
  return [...map.values()];
}

function dedupeEdges(list: NavEdge[]): NavEdge[] {
  const seen = new Set<string>();
  const out: NavEdge[] = [];
  for (const e of list) {
    const key = e.from < e.to ? `${e.from}|${e.to}|${e.kind}` : `${e.to}|${e.from}|${e.kind}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(e);
  }
  return out;
}

/* ============================= helpers ============================= */

function rect(minX: number, minZ: number, maxX: number, maxZ: number): Rect {
  return { minX, minZ, maxX, maxZ };
}

function mid3(r: Rect, y: number): { x: number; y: number; z: number } {
  return { x: (r.minX + r.maxX) / 2, y, z: (r.minZ + r.maxZ) / 2 };
}
