/**
 * Уличная (outdoor) часть кампуса: дорожки, площади, ориентиры.
 *
 * Сетка координат: X — восток (+), Z — юг (+). Северный «главный вход»
 * кампуса — внизу по -Z. Все outdoor-узлы имеют Y = 0.
 *
 * Имена узлов: so.<area>.<n>  (street outdoor), sp.<name> (plaza).
 * Узлы дверей зданий добавляет demoCampus.ts (so.d<NN>, si.d<NN>).
 */

import type { Landmark, NavEdge, NavNode, OutdoorPath, Vec2 } from './types';

/* ----------------------------- геометрия ----------------------------- */

export const OUTDOOR_NODES: NavNode[] = [
  // Главная аллея (север -> юг, x = 0)
  n('so.main.0', 'street', 0, -165, 'Главный вход'),
  n('so.main.1', 'street', 0, -140),
  n('so.main.2', 'street', 0, -115),
  n('so.main.3', 'street', 0, -90),
  n('so.main.4', 'street', 0, -65),
  n('so.main.5', 'street', 0, -40),
  n('so.main.6', 'street', 0, -15),
  n('so.main.7', 'street', 0, 10),
  n('so.main.8', 'street', 0, 35),
  n('so.main.9', 'street', 0, 60),
  n('so.main.10', 'street', 0, 85),
  n('so.main.11', 'street', 0, 110),
  n('so.main.12', 'street', 0, 135),

  // Площади
  n('sp.fountain', 'plaza', 0, -20, 'Фонтан'),
  n('sp.central', 'plaza', 0, 45, 'Центральная площадь'),
  n('sp.sports', 'plaza', 85, 110, 'Площадка у спорта'),

  // Восточная поперечная улица (z = -40)
  n('se.east.0', 'street', 25, -40),
  n('se.east.1', 'street', 50, -40),
  n('se.east.2', 'street', 75, -40),
  n('se.east.3', 'street', 100, -40),
  n('se.east.4', 'street', 125, -40),
  n('se.east.5', 'street', 150, -40),

  // Южная поперечная улица (x = 0 -> восток, z = 85)
  n('se.south.0', 'street', 25, 85),
  n('se.south.1', 'street', 50, 85),
  n('se.south.2', 'street', 75, 85),
  n('se.south.3', 'street', 100, 85),
  n('se.south.4', 'street', 125, 85),
  n('se.south.5', 'street', 150, 85),

  // Западная поперечная улица (z = -40)
  n('se.west.0', 'street', -25, -40),
  n('se.west.1', 'street', -50, -40),
  n('se.west.2', 'street', -75, -40),
  n('se.west.3', 'street', -100, -40),
  n('se.west.4', 'street', -125, -40),

  // Южная поперечная на запад (z = 85)
  n('sw.south.0', 'street', -25, 85),
  n('sw.south.1', 'street', -50, 85),
  n('sw.south.2', 'street', -75, 85),
  n('sw.south.3', 'street', -100, 85),

  // Западный траверс к корпусу 2 (z = -115)
  n('sw.mid.0', 'street', -25, -115),
  n('sw.mid.1', 'street', -50, -115),
  n('sw.mid.2', 'street', -75, -115),
  n('sw.mid.3', 'street', -100, -115),

  // Северное кольцо (z = -140)
  n('sn.w.0', 'street', -25, -140),
  n('sn.w.1', 'street', -50, -140),
  n('sn.w.2', 'street', -75, -140),
  n('sn.e.0', 'street', 25, -140),
  n('sn.e.1', 'street', 50, -140),
  n('sn.e.2', 'street', 75, -140),

  // Траверсы к северным входам библиотеки и корпуса 1
  n('tr.lib.0', 'street', -100, -125), // узел двери b1-north
  n('tr.b1.0', 'street', 150, -25), // узел двери b1-north2

  // Тупики к входам общежитий/столовой/спорта/медпункта
  n('d.d3.0', 'street', -100, 108),
  n('d.can.0', 'street', 75, 63),
  n('d.spr.0', 'street', 100, 88),
  n('d.med.0', 'street', 125, -58),

  // Автобусная остановка (тупик от главного входа)
  n('so.bus.0', 'street', 25, -165),
];

/* ----------------------------- дорожки ----------------------------- */

export const OUTDOOR_PATHS: OutdoorPath[] = [
  p('path.main', 'Главная аллея', ['so.main.0', 'so.main.1', 'so.main.2', 'so.main.3', 'so.main.4', 'so.main.5', 'so.main.6', 'so.main.7', 'so.main.8', 'so.main.9', 'so.main.10', 'so.main.11', 'so.main.12'], 6, 'paving'),
  p('path.east', 'Восточная улица', ['so.main.4', 'se.east.0', 'se.east.1', 'se.east.2', 'se.east.3', 'se.east.4', 'se.east.5'], 4, 'paving'),
  p('path.south', 'Южная улица', ['so.main.10', 'se.south.0', 'se.south.1', 'se.south.2', 'se.south.3', 'se.south.4', 'se.south.5'], 4, 'paving'),
  p('path.west', 'Западная улица', ['so.main.4', 'se.west.0', 'se.west.1', 'se.west.2', 'se.west.3', 'se.west.4'], 4, 'asphalt'),
  p('path.southwest', 'Южная улица (запад)', ['so.main.10', 'sw.south.0', 'sw.south.1', 'sw.south.2', 'sw.south.3'], 4, 'paving'),
  p('path.midwest', 'Северный траверс', ['so.main.2', 'sw.mid.0', 'sw.mid.1', 'sw.mid.2', 'sw.mid.3'], 3, 'grass-path'),
  p('path.northring', 'Северное кольцо', ['so.main.1', 'sn.w.0', 'sn.w.1', 'sn.w.2'], 3, 'paving'),
  p('path.northeast', 'Северо-восточная дорожка', ['so.main.1', 'sn.e.0', 'sn.e.1', 'sn.e.2'], 3, 'paving'),
  p('path.library', 'Дорожка к библиотеке', ['sn.w.2', 'tr.lib.0'], 2.5, 'paving'),
  p('path.b1north', 'Траверс корпуса 1', ['se.east.5', 'tr.b1.0'], 2.5, 'paving'),
  p('path.dorm3', 'Подход к общежитию №3', ['sw.south.3', 'd.d3.0'], 2.5, 'grass-path'),
  p('path.canteen', 'Подход к столовой', ['so.main.9', 'd.can.0'], 2.5, 'paving'),
  p('path.sports', 'Подход к спорткомплексу', ['so.main.11', 'd.spr.0'], 2.5, 'paving'),
  p('path.med', 'Подход к медпункту', ['se.east.4', 'd.med.0'], 2, 'grass-path'),
  p('path.bus', 'Автобусная остановка', ['so.main.0', 'so.bus.0'], 3, 'asphalt'),
];

/* ----------------------------- ориентиры ----------------------------- */

export const LANDMARKS: Landmark[] = [
  { id: 'lm.fountain', name: 'Фонтан', position: v(0, -20), icon: '⛲' },
  { id: 'lm.tree', name: 'Сквер', position: v(-15, 55), icon: '🌳' },
  { id: 'lm.monument', name: 'Памятник выпускнику', position: v(15, 125), icon: '🗿' },
  { id: 'lm.bus', name: 'Остановка «Колледж»', position: v(32, -165), icon: '🚌' },
  { id: 'lm.gate', name: 'Главный вход кампуса', position: v(0, -168), icon: '🚪' },
  { id: 'lm.parking', name: 'Парковка', position: v(150, 110), icon: '🅿️' },
];

/* ----------------------------- рёбра ----------------------------- */

/** Строим уличные рёбра из цепочек дорожек (соседние узлы). */
function streetEdges(): NavEdge[] {
  const seen = new Set<string>();
  const edges: NavEdge[] = [];
  for (const path of OUTDOOR_PATHS) {
    for (let i = 0; i + 1 < path.nodeIds.length; i++) {
      const a = path.nodeIds[i];
      const b = path.nodeIds[i + 1];
      const key = a < b ? `${a}|${b}` : `${b}|${a}`;
      if (seen.has(key)) continue;
      seen.add(key);
      edges.push({ from: a, to: b, kind: 'street', bidirectional: true });
    }
  }
  return edges;
}

/**
 * Позиции наружных точек у входных дверей зданий (id двери = `d.<key>`).
 * Ключ совпадает с `${buildingId}-${side}`, который использует demoCampus.ts.
 * demoCampus создаёт узел `d.<key>` (тип door-outdoor) точно на этой позиции
 * и соединяет его street-ребром с узлом `anchor` из таблицы ANCHORS ниже.
 */
export const DOOR_OUTDOOR_POS: Record<string, Vec2> = {
  'b1-north': v(150, -25), // на траверсе path.b1north
  'b1-east': v(185, 5), // тупик от se.east.5
  'b1-south': v(120, 35), // тупик от se.south.1
  'b2-north': v(-100, -125), // конец path.library (tr.lib.0)
  'b2-west': v(-135, -95), // тупик от se.west.3
  'b3-north': v(-100, -55), // тупик от sw.mid.3
  'b3-south': v(-100, 8), // тупик от so.main.3
  'b4-west': v(-125, 85), // конец sw.south.3 (тупик)
  'b4-south': v(-100, 108), // конец path.dorm3 (d.d3.0)
  'b5-canteen': v(75, 63), // конец path.canteen (d.can.0)
  'b6-south': v(100, 88), // конец path.sports (d.spr.0)
  'b7-medical': v(125, -58), // конец path.med (d.med.0)
};

/** До какой уличной точки «доводим» каждую дверь (создаётся отдельное street-ребро). */
export const DOOR_ANCHORS: Record<string, string> = {
  'b1-north': 'tr.b1.0',
  'b1-east': 'se.east.5',
  'b1-south': 'se.south.1',
  'b2-north': 'tr.lib.0',
  'b2-west': 'se.west.3',
  'b3-north': 'sw.mid.3',
  'b3-south': 'so.main.3',
  'b4-west': 'sw.south.3',
  'b4-south': 'd.d3.0',
  'b5-canteen': 'd.can.0',
  'b6-south': 'd.spr.0',
  'b7-medical': 'd.med.0',
};

/** Уличные рёбра: цепочки дорожек + срезы через площади + подходы к дверям. */
function outdoorEdges(): NavEdge[] {
  const edges = streetEdges();
  const extra: NavEdge[] = [
    // центральная площадь стоит на аллее между so.main.8 и so.main.9
    { from: 'so.main.8', to: 'sp.central', kind: 'street', bidirectional: true },
    { from: 'sp.central', to: 'so.main.9', kind: 'street', bidirectional: true },
    // фонтан — срез аллеи
    { from: 'so.main.6', to: 'sp.fountain', kind: 'street', bidirectional: true },
    { from: 'sp.fountain', to: 'so.main.7', kind: 'street', bidirectional: true },
    // площадка у спорта связана с южной улицей и подходом
    { from: 'se.south.4', to: 'sp.sports', kind: 'street', bidirectional: true },
    { from: 'd.spr.0', to: 'sp.sports', kind: 'street', bidirectional: true },
    // срез от западной улицы к северному кольцу
    { from: 'se.west.3', to: 'sn.w.1', kind: 'street', bidirectional: true },
  ];
  // короткие подходы «уличная сеть -> наружная точка двери»
  for (const [key, pos] of Object.entries(DOOR_OUTDOOR_POS)) {
    const anchor = DOOR_ANCHORS[key];
    const doorNodeId = `d.${key}`;
    const a = nodeById(anchor);
    if (!a) continue;
    const dist = Math.hypot(a.position.x - pos.x, a.position.z - pos.z);
    // если дверь стоит прямо на уличном узле — отдельный тупик не нужен
    if (dist < 0.5) {
      // наружный узел двери = сам якорь; demoCampus переиспользует его id
      continue;
    }
    extra.push({ from: anchor, to: doorNodeId, kind: 'street', bidirectional: true });
  }
  return [...edges, ...extra];
}

function nodeById(id: string): NavNode | undefined {
  return OUTDOOR_NODES.find((nd) => nd.id === id);
}

export const OUTDOOR_EDGES: NavEdge[] = outdoorEdges();

/* ----------------------------- helpers ----------------------------- */

function v(x: number, z: number): Vec2 {
  return { x, z };
}

function n(id: string, type: NavNode['type'], x: number, z: number, label?: string): NavNode {
  return { id, type, position: { x, y: 0, z }, ...(label ? { label } : {}) };
}

function p(
  id: string,
  name: string,
  nodeIds: string[],
  width: number,
  surface: OutdoorPath['surface'],
): OutdoorPath {
  return { id, name, nodeIds, width, surface };
}
