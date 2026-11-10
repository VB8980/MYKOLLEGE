/**
 * parametricFloor.ts — параметрический генератор семантических этажей
 * (корпуса 2, 3, 4, 5, 8): вход → холл у двери; центральный двусторонний
 * коридор шириной 3 м вдоль длинной оси; комнаты глубиной 7 м по обе стороны,
 * ширины равномерно; лестницы в торцах (по 2 узла); лифт если этажей > 2.
 * Все комнаты помечаются confidence 'recon'.
 *
 * Координаты — world XZ (как Rect в types.ts): worldX = layout.x, worldZ = -layout.y.
 */
import type { NavEdge, NavNode, Room, RoomKind } from '../data/types';

export interface SemanticRoom {
  name: string;
  kind: RoomKind;
}

export interface ParametricBuildingInput {
  buildingId: string;
  /** footprint здания в world-осях (Rect) */
  rect: { minX: number; minZ: number; maxX: number; maxZ: number };
  /** точки коридора одного этажа [x, z] (вдоль длинной оси), общие для всех этажей */
  corridorPts: [number, number][];
  /** точка холла/входа у двери [x, z] */
  hall: [number, number];
  /** семантика по этажам (индекс = level, 0-based) */
  floors: SemanticRoom[][];
  /** форматирование номера аудитории: (level, idx1based) => string */
  formatNumber: (level: number, roomIndex: number) => string;
}

export interface ParametricBuildingResult {
  nodes: NavNode[];
  edges: NavEdge[];
  rooms: Room[];
}

const FLOOR_H = 3.2, YOFF = 0.2;
const fy = (lvl: number): number => lvl * FLOOR_H + YOFF;
const ROOM_DEPTH = 7;

const node = (id: string, type: NavNode['type'], x: number, y: number, z: number, b: string, f: number, label?: string, roomId?: string): NavNode =>
  ({ id, type, position: { x, y, z }, buildingId: b, floor: f, ...(label ? { label } : {}), ...(roomId ? { roomId } : {}) });
const edge = (a: string, b: string, kind: NavEdge['kind']): NavEdge => ({ from: a, to: b, kind, bidirectional: true });

function nearest(pts: [number, number][], x: number, z: number): number {
  let bi = 0, bd = Infinity;
  pts.forEach(([px, pz], i) => { const d = Math.hypot(px - x, pz - z); if (d < bd) { bd = d; bi = i; } });
  return bi;
}

/**
 * Генерирует весь корпус: на каждом этаже — коридор из corridorPts, холл у двери,
 * комнаты раскладываются вдоль длинной оси по обе стороны (ширины равномерны),
 * лестницы в обоих торцах (соединяются вертикальными рёбрами между этажами),
 * лифт добавляется если этажей > 2.
 */
export function buildParametricBuilding(inp: ParametricBuildingInput): ParametricBuildingResult {
  const { buildingId, rect, corridorPts, hall, floors, formatNumber } = inp;
  const nodes: NavNode[] = [];
  const edges: NavEdge[] = [];
  const rooms: Room[] = [];

  // ориентация длинной оси
  const w = rect.maxX - rect.minX, d = rect.maxZ - rect.minZ;
  const horizontal = w >= d;                 // коридор вдоль X
  const axisLen = horizontal ? w : d;
  const perpLen = horizontal ? d : w;
  const cx = (rect.minX + rect.maxX) / 2;
  const cy = (rect.minZ + rect.maxZ) / 2;
  const useElevator = floors.length > 2;

  // раскладка комнат (одинаковая на всех этажах — стабильные планы)
  const maxN = Math.max(1, ...floors.map((f) => f.length));
  const sideSlots = Math.ceil(maxN / 2);
  const usable = Math.max(axisLen - 2 * 6, 6); // 6 м в каждом торце под лестницы
  const slotW = usable / sideSlots;
  const depth = Math.min(ROOM_DEPTH, Math.max(perpLen / 2 - 1.5, 3));

  const tag = (lvl: number): string => `si.${buildingId}.f${lvl}`;

  floors.forEach((floorRooms, level) => {
    const t = tag(level);
    // --- коридор ---
    const corIds: string[] = [];
    corridorPts.forEach(([x, z], k) => {
      const cid = `${t}.c${k}`;
      corIds.push(cid);
      nodes.push(node(cid, 'corridor', x, fy(level), z, buildingId, level));
      if (k > 0) edges.push(edge(corIds[k - 1], cid, 'indoor'));
    });
    // --- холл у двери ---
    const hid = `${t}.hall`;
    nodes.push(node(hid, 'door-indoor', hall[0], fy(level), hall[1], buildingId, level, 'Холл'));
    if (corIds.length) edges.push(edge(corIds[nearest(corridorPts, hall[0], hall[1])], hid, 'indoor'));

    // --- комнаты ---
    floorRooms.forEach((r, i) => {
      const side = i % 2 === 0 ? 1 : -1;   // чередуем стороны коридора
      const slot = Math.floor(i / 2);
      const alongStart = (horizontal ? rect.minX : rect.minZ) + 6 + slot * slotW;
      const alongCenter = alongStart + slotW / 2;
      const perpCenter = horizontal ? cy + side * (depth / 2 + 1.5) : cx + side * (depth / 2 + 1.5);
      const rx0 = horizontal ? alongStart : perpCenter - depth / 2;
      const rx1 = horizontal ? alongStart + slotW : perpCenter + depth / 2;
      const rz0 = horizontal ? perpCenter - depth / 2 : alongStart;
      const rz1 = horizontal ? perpCenter + depth / 2 : alongStart + slotW;
      const nid = `${t}.r${i}`;
      const rid = `${buildingId}_f${level}_r${i}`;
      nodes.push(node(nid, 'room', alongCenter, fy(level), perpCenter, buildingId, level, r.name, rid));
      const anchor = corIds.length ? corIds[nearest(corridorPts, alongCenter, perpCenter)] : hid;
      edges.push(edge(anchor, nid, 'enter-room'));
      rooms.push({
        id: rid, number: formatNumber(level, i + 1), name: r.name, kind: r.kind,
        buildingId, floor: level,
        rect: { minX: rx0, maxX: rx1, minZ: rz0, maxZ: rz1 },
        doorNodes: [nid], confidence: 'recon',
      });
    });

    // --- лестницы в торцах ---
    const axA = horizontal ? rect.minX + 4 : cx;
    const azA = horizontal ? cy : rect.minZ + 4;
    const axB = horizontal ? rect.maxX - 4 : cx;
    const azB = horizontal ? cy : rect.maxZ - 4;
    const stA = `${t}.stA`, stB = `${t}.stB`;
    nodes.push(node(stA, 'stairs', axA, fy(level), azA, buildingId, level, 'Лестница (торец A)'));
    nodes.push(node(stB, 'stairs', axB, fy(level), azB, buildingId, level, 'Лестница (торец B)'));
    if (corIds.length) {
      edges.push(edge(corIds[nearest(corridorPts, axA, azA)], stA, 'indoor'));
      edges.push(edge(corIds[nearest(corridorPts, axB, azB)], stB, 'indoor'));
    }
    // --- лифт, если этажей > 2 ---
    if (useElevator) {
      const el = `${t}.el`;
      const ex = horizontal ? cx : rect.minX + 4;
      const ez = horizontal ? rect.minZ + 3 : cy;
      nodes.push(node(el, 'elevator', ex, fy(level), ez, buildingId, level, 'Лифт'));
      if (corIds.length) edges.push(edge(corIds[nearest(corridorPts, ex, ez)], el, 'indoor'));
    }
  });

  // --- вертикальные связи между этажами ---
  for (let lvl = 0; lvl < floors.length - 1; lvl++) {
    edges.push(edge(`${tag(lvl)}.stA`, `${tag(lvl + 1)}.stA`, 'vertical'));
    edges.push(edge(`${tag(lvl)}.stB`, `${tag(lvl + 1)}.stB`, 'vertical'));
    if (useElevator) edges.push(edge(`${tag(lvl)}.el`, `${tag(lvl + 1)}.el`, 'vertical'));
  }

  return { nodes, edges, rooms };
}
