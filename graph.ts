// Построение графов: внутренний (здание) и уличный (кампус)
import type { Building, NavEdge, NavNode } from '../data/types';
import type { OutdoorCampusData, OutdoorEdge, OutdoorNode } from '../data/campusOutdoor';
import { dist2 } from './geometry';

export interface WeightedGraph<N extends { id: string }> {
  nodes: Map<string, N>;
  adj: Map<string, { to: string; cost: number; edgeType: string }[]>;
}

export interface GraphBuildOptions {
  avoidStairs?: boolean;      // режим "без лестниц"
  stairsPenalty?: number;     // штраф за лестницу (метры экв.)
}

/** Внутренний граф здания: стоимость walk-рёбра = расстояние, stairs/door — расстояние + штраф */
export function buildIndoorGraph(b: Building, opts: GraphBuildOptions = {}): WeightedGraph<NavNode> {
  const nodes = new Map<string, NavNode>(b.nodes.map((n) => [n.id, n]));
  const adj = new Map<string, { to: string; cost: number; edgeType: string }[]>();
  const floorById = new Map(b.floors.map((f) => [f.id, f]));
  const fh = b.floorHeight;

  const addEdge = (e: NavEdge) => {
    const a = nodes.get(e.from), c = nodes.get(e.to);
    if (!a || !c) return;
    const flatDist = dist2(a.pos, c.pos);
    const dy = Math.abs((floorById.get(a.floorId)?.level ?? 0) - (floorById.get(c.floorId)?.level ?? 0)) * fh;
    let cost = Math.max(flatDist, 0.01);
    if (e.type === 'stairs') {
      if (opts.avoidStairs) return; // исключаем лестницы из графа
      cost = Math.hypot(flatDist, dy) + (opts.stairsPenalty ?? 15);
    } else if (e.type === 'door') {
      cost += 2; // небольшой штраф на вход в дверь
    } else if (e.type === 'elevator') {
      cost += 10;
    }
    if (!adj.has(e.from)) adj.set(e.from, []);
    if (!adj.has(e.to)) adj.set(e.to, []);
    adj.get(e.from)!.push({ to: e.to, cost, edgeType: e.type });
    adj.get(e.to)!.push({ to: e.from, cost, edgeType: e.type });
  };
  for (const e of b.edges) addEdge(e);
  return { nodes, adj };
}

/** Уличный граф кампуса: стоимость ребра = расстояние в метрах из данных */
export function buildOutdoorGraph(data: OutdoorCampusData): WeightedGraph<OutdoorNode> {
  const nodes = new Map<string, OutdoorNode>(data.nodes.map((n) => [n.id, n]));
  const adj = new Map<string, { to: string; cost: number; edgeType: string }[]>();
  for (const [from, to, dist] of data.edges as OutdoorEdge[]) {
    if (!nodes.has(from) || !nodes.has(to)) continue;
    if (!adj.has(from)) adj.set(from, []);
    if (!adj.has(to)) adj.set(to, []);
    adj.get(from)!.push({ to, cost: dist, edgeType: 'walk' });
    adj.get(to)!.push({ to: from, cost: dist, edgeType: 'walk' });
  }
  return { nodes, adj };
}
