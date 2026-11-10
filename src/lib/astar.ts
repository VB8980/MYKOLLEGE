/**
 * astar.ts — поиск кратчайшего маршрута по графу кампуса (A*).
 *
 * Эвристика — евклидово расстояние между позициями узлов (Vec3).
 * Вес ребра: edge.cost, если задан; иначе геометрическая длина ребра.
 * Вертикальные переходы (лестницы/лифты) дополнительно «удорожаются»,
 * чтобы маршрут учитывал неудобство подъёма.
 *
 * Учитываются все типы рёбер: indoor, through-door, vertical,
 * enter-room, street (уличные), exit-building.
 */

import type { NavEdge, NavNode } from '../data/types';
import type { Graph } from './graph';

/** Результат поиска пути. */
export interface PathResult {
  path: NavNode[]; // узлы от start до finish включительно
  edges: NavEdge[]; // рёбра между соседними узлами (length = path.length - 1)
  length: number; // суммарная геометрическая длина, метры
}

// Штраф за вертикальный переход: лифт «дороже» лестницы по времени ожидания.
const STAIRS_PENALTY = 5;
const ELEVATOR_PENALTY = 8;

/** Евклидово расстояние между позициями двух узлов. */
function dist(a: NavNode, b: NavNode): number {
  const dx = a.position.x - b.position.x;
  const dy = a.position.y - b.position.y;
  const dz = a.position.z - b.position.z;
  return Math.sqrt(dx * dx + dy * dy + dz * dz);
}

/** Геометрическая длина ребра по позициям его концов. */
function edgeLength(graph: Graph, edge: NavEdge): number {
  const a = graph.nodeById.get(edge.from);
  const b = graph.nodeById.get(edge.to);
  if (!a || !b) return Infinity;
  return dist(a, b);
}

/** Стоимость прохода ребра для A*: базовая длина + штраф за тип перехода. */
function edgeCost(graph: Graph, edge: NavEdge): number {
  const base = edge.cost ?? edgeLength(graph, edge);
  if (edge.kind !== 'vertical') return base;
  const node = graph.nodeById.get(edge.to);
  return base + (node?.type === 'elevator' ? ELEVATOR_PENALTY : STAIRS_PENALTY);
}

/** Эвристика A*: прямое евклидово расстояние до цели (не переоценивает — допустима). */
function heuristic(from: NavNode, goal: NavNode): number {
  return dist(from, goal);
}

interface QueueItem {
  id: string;
  f: number; // g + h
}

/**
 * Простейшая очередь с приоритетом: извлечение минимума за O(n) линейным
 * сканом. Граф кампуса небольшой, этого достаточно (без внешних зависимостей).
 */
class PQueue {
  private items: QueueItem[] = [];
  get size(): number { return this.items.length; }
  push(item: QueueItem): void { this.items.push(item); }
  /** Извлекает элемент с минимальной f-оценкой. */
  pop(): QueueItem | undefined {
    let best = 0;
    for (let i = 1; i < this.items.length; i++) {
      if (this.items[i].f < this.items[best].f) best = i;
    }
    return this.items.length === 0 ? undefined : this.items.splice(best, 1)[0];
  }
}

/**
 * Ищет путь от fromId до toId. Возвращает null, если узла нет в графе
 * или маршрут между ними невозможен.
 */
export function findPath(graph: Graph, fromId: string, toId: string): PathResult | null {
  const start = graph.nodeById.get(fromId);
  const goal = graph.nodeById.get(toId);
  if (!start || !goal) return null;
  if (fromId === toId) return { path: [start], edges: [], length: 0 };

  const gScore = new Map<string, number>([[fromId, 0]]);
  const cameFrom = new Map<string, { nodeId: string; edge: NavEdge }>();
  const closed = new Set<string>();
  const open = new PQueue();
  open.push({ id: fromId, f: heuristic(start, goal) });

  while (open.size > 0) {
    const current = open.pop()!;
    if (current.id === toId) {
      // Восстановление пути по цепочке предшественников.
      const path: NavNode[] = [];
      const edges: NavEdge[] = [];
      let id = toId;
      while (id !== fromId) {
        const step = cameFrom.get(id)!;
        path.unshift(graph.nodeById.get(id)!);
        edges.unshift(step.edge);
        id = step.nodeId;
      }
      path.unshift(start);
      // Итоговая длина — честная геометрия без эвристических штрафов.
      let length = 0;
      for (const e of edges) length += edgeLength(graph, e);
      return { path, edges, length };
    }
    if (closed.has(current.id)) continue; // устаревшая запись в очереди — пропускаем
    closed.add(current.id);

    const g = gScore.get(current.id)!;
    for (const { node, edge } of graph.adjacency.get(current.id) ?? []) {
      if (closed.has(node.id)) continue;
      const tentative = g + edgeCost(graph, edge);
      if (tentative < (gScore.get(node.id) ?? Infinity)) {
        gScore.set(node.id, tentative);
        cameFrom.set(node.id, { nodeId: current.id, edge });
        open.push({ id: node.id, f: tentative + heuristic(node, goal) });
      }
    }
  }
  return null; // цель недостижима
}
