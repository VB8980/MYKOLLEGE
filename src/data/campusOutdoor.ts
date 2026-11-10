/**
 * Уличный граф кампуса МИЭТ — ГЕНЕРИРУЕТСЯ ИЗ campusLayout.ts
 * (единый источник уличной геометрии: footprints, roads-полилинии, doors).
 *
 * Layout: X — восток, Y — СЕВЕР; world: worldX = x, worldZ = -y.
 * Вершины road-полилиний становятся узлами сети (sun*, cen*, pla*, wes*),
 * длинные сегменты (>50 м) режутся промежуточными узлами, двери do.*
 * подключаются отводом к ближайшему узлу. Старые id сохранены там, где
 * на них завязаны маршруты (do.b1, sun4 -> переименован в sunN по индексу).
 */
import type { Landmark, NavEdge, NavNode, OutdoorPath, Vec2 } from './types';
import { DOORS, ROADS, lx, ly, type Pt, type Road } from './campusLayout';

const v = (x: number, z: number): Vec2 => ({ x, z });
const n = (id: string, type: NavNode['type'], x: number, z: number, label?: string): NavNode =>
  ({ id, type, position: { x, y: 0, z }, ...(label ? { label } : {}) });
const e = (from: string, to: string): NavEdge => ({ from, to, kind: 'street', bidirectional: true });
const p = (id: string, name: string, nodeIds: string[], width: number, surface: OutdoorPath['surface']): OutdoorPath =>
  ({ id, name, nodeIds, width, surface });

/* ---------- полилиния дороги -> цепочка узлов/рёбер ---------- */

const MAX_EDGE = 50; // метры; более длинные сегменты делятся пополам

interface Chain { nodes: NavNode[]; edges: NavEdge[]; path: OutdoorPath }

function chainFromRoad(road: Road, prefix: string): Chain {
  const pts = road.pts as Pt[];
  const ids: string[] = [];
  const nodes: NavNode[] = [];
  for (let i = 0; i < pts.length; i++) {
    const id = `${prefix}${i}`;
    ids.push(id);
    nodes.push(n(id, 'street', lx(pts[i]), ly(pts[i])));
  }
  // режем слишком длинные рёбра серединой сегмента (шаг навигации <= ~45 м)
  for (let i = 0; i < pts.length - 1; i++) {
    const a = pts[i], b = pts[i + 1];
    if (Math.hypot(b[0] - a[0], b[1] - a[1]) > MAX_EDGE) {
      const mid: Pt = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
      const midId = `${ids[i]}m`;
      ids.splice(i + 1, 0, midId);
      nodes.push(n(midId, 'street', lx(mid), ly(mid)));
    }
  }
  const edges: NavEdge[] = [];
  for (let i = 0; i < ids.length - 1; i++) edges.push(e(ids[i], ids[i + 1]));
  return { nodes, edges, path: p(`path.${prefix}`, road.name, ids, road.width, road.surface) };
}

const roadOf = (rid: string): Road => ROADS.find((r) => r.id === rid)!;

const sun = chainFromRoad(roadOf('road.sun'), 'sun');
const cen = chainFromRoad(roadOf('road.central'), 'cen');
const pla = chainFromRoad(roadOf('road.plaza'), 'pla');
const wes = chainFromRoad(roadOf('road.west'), 'wes');
// «Северное кольцо» и «Мост b1→dk» из layout — визуальные ленты; в уличный
// граф не входят (мост — indoor passage edge в demoCampus, этап 2).

export const OUTDOOR_NODES: NavNode[] = [
  ...sun.nodes, ...cen.nodes, ...pla.nodes, ...wes.nodes,
  // остановки на Солнечной аллее (сохранён прежний id sun4 для демо-маршрута)
  n('sun4', 'plaza', -200, 108, 'Остановка «Запад»'),
  n('stop.main', 'plaza', lx([0, -100]), ly([0, -100]), 'Остановка «Главный вход»'),
  // двери — позиции из layout.DOORS (id сохранены)
  ...DOORS.map((d) => n(d.id, 'door-outdoor', lx(d.pos), ly(d.pos), d.label)),
];

function nearestNode(nodes: NavNode[], pt: Pt): string | null {
  let best: string | null = null, bd = Infinity;
  for (const nd of nodes) {
    const d = Math.hypot(nd.position.x - lx(pt), nd.position.z - ly(pt));
    if (d < bd) { bd = d; best = nd.id; }
  }
  return best;
}

export const OUTDOOR_EDGES: NavEdge[] = (() => {
  const edges: NavEdge[] = [...sun.edges, ...cen.edges, ...pla.edges, ...wes.edges];
  const junctions = [...sun.nodes, ...cen.nodes, ...pla.nodes, ...wes.nodes];
  // остановка «Главный вход» и спец-узел sun4 («Запад») — к ближайшей вершине SUN
  for (const s of [{ id: 'sun4', pos: [-200, -108] as Pt }, { id: 'stop.main', pos: [0, -100] as Pt }]) {
    const j = nearestNode(sun.nodes, s.pos);
    if (j) edges.push(e(j, s.id));
  }
  // конец Аллеи площади (109,42) примыкает к порталу do.b1 (108.4,42)
  edges.push(e(pla.path.nodeIds[pla.path.nodeIds.length - 1], 'do.b1'));
  // каждая дверь -> ближайший узел сети
  for (const d of DOORS) {
    if (d.id === 'do.b1') continue;
    const j = nearestNode(junctions, d.pos);
    if (j) edges.push(e(j, d.id));
  }
  return edges;
})();

export const OUTDOOR_PATHS: OutdoorPath[] = [sun.path, cen.path, pla.path, wes.path];

export const OUTDOOR_LANDMARKS: Landmark[] = [
  { id: 'lm.plaza', name: 'Площадь Шокина', position: v(150, -55), icon: '🟫' },
  { id: 'lm.busw', name: 'Остановка «Запад»', position: v(-200, 108), icon: '🚌' },
  { id: 'lm.busc', name: 'Остановка «Главный вход»', position: v(0, 100), icon: '🚌' },
  { id: 'lm.gate', name: 'Главный вход кампуса', position: v(108.4, -42), icon: '🚪' },
];
