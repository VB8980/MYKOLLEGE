// Универсальный A* по взвешенному графу
import type { WeightedGraph } from './graph';

export interface AStarResult {
  path: string[];       // id узлов
  cost: number;         // суммарная стоимость
  found: boolean;
}

/**
 * A*: эвристика — евклидово расстояние между узлами (координаты x/z или pos).
 * graph.getPos возвращает [x, z] для эвристики.
 */
export function astar(
  graph: WeightedGraph<any>,
  startId: string,
  goalId: string,
  getPos: (id: string) => [number, number] | null,
): AStarResult {
  if (!graph.nodes.has(startId) || !graph.nodes.has(goalId)) {
    return { path: [], cost: Infinity, found: false };
  }
  if (startId === goalId) return { path: [startId], cost: 0, found: true };

  const goalPos = getPos(goalId);
  const h = (id: string) => {
    const p = getPos(id);
    if (!p || !goalPos) return 0;
    return Math.hypot(p[0] - goalPos[0], p[1] - goalPos[1]);
  };

  const gScore = new Map<string, number>();
  const cameFrom = new Map<string, string>();
  const open = new Set<string>([startId]);
  const fScore = new Map<string, number>([[startId, h(startId)]]);
  gScore.set(startId, 0);

  while (open.size > 0) {
    // выбор узла с минимальным f
    let current = '';
    let best = Infinity;
    for (const id of open) {
      const f = fScore.get(id) ?? Infinity;
      if (f < best) { best = f; current = id; }
    }
    if (current === goalId) {
      const path = [current];
      let c = current;
      while (cameFrom.has(c)) { c = cameFrom.get(c)!; path.unshift(c); }
      return { path, cost: gScore.get(goalId) ?? Infinity, found: true };
    }
    open.delete(current);
    const neighbors = graph.adj.get(current) ?? [];
    for (const nb of neighbors) {
      const tentative = (gScore.get(current) ?? Infinity) + nb.cost;
      if (tentative < (gScore.get(nb.to) ?? Infinity)) {
        cameFrom.set(nb.to, current);
        gScore.set(nb.to, tentative);
        fScore.set(nb.to, tentative + h(nb.to));
        open.add(nb.to);
      }
    }
  }
  return { path: [], cost: Infinity, found: false };
}
