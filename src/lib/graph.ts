/**
 * graph.ts — построение графа навигации из данных кампуса.
 *
 * CampusData содержит плоские списки узлов (NavNode) и рёбер (NavEdge).
 * Здесь они превращаются в структуру, удобную для обходов (A*, BFS):
 *   - nodeById  — быстрый доступ к узлу по id;
 *   - adjacency — список смежности: для каждого узла массив {node, edge}.
 *
 * Рёбра с bidirectional !== false добавляются в обе стороны;
 * направленные (например, «только выход» из комнаты) — только from -> to.
 */

import type { CampusData, NavEdge, NavNode } from '../data/types';

/** Запись списка смежности: соседний узел и ведущее к нему ребро. */
export interface AdjacencyEntry {
  node: NavNode;
  edge: NavEdge;
}

/** Готовый граф навигации. */
export interface Graph {
  nodeById: Map<string, NavNode>;
  adjacency: Map<string, AdjacencyEntry[]>;
}

/**
 * Собирает граф из CampusData.
 * Пропущенные ссылки (ребро на несуществующий узел) игнорируются молча —
 * корректность данных проверяется отдельно в src/data/validation.ts.
 */
export function buildGraph(campus: CampusData): Graph {
  const nodeById = new Map<string, NavNode>();
  const adjacency = new Map<string, AdjacencyEntry[]>();

  // Индексируем узлы и заводим пустые списки смежности.
  for (const node of campus.nodes) {
    nodeById.set(node.id, node);
    adjacency.set(node.id, []);
  }

  const addArc = (edge: NavEdge) => {
    const to = nodeById.get(edge.to);
    if (!nodeById.has(edge.from) || !to) return; // битая ссылка — пропускаем
    adjacency.get(edge.from)!.push({ node: to, edge });
  };

  for (const edge of campus.edges) {
    // Направленными считаются только явно bidirectional === false.
    const directed = edge.bidirectional === false;
    addArc(edge);
    if (!directed) {
      // Обратная дуга: тот же тип ребра, но развёрнутые from/to.
      addArc({ ...edge, from: edge.to, to: edge.from });
    }
  }

  return { nodeById, adjacency };
}
