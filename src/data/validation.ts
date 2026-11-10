/**
 * Валидация данных кампуса: целостность графа, ссылки, геометрия.
 * Ошибки собираются в плоский список строк (удобно для dev-панели),
 * а в DEV-режиме дополнительно печатаются в консоль.
 */

import type { CampusData, NavEdge, NavNode } from './types';
import { DEMO_CAMPUS } from './demoCampus';

export interface ValidationResult {
  errors: string[];
  warnings: string[];
  ok: boolean;
}

export function validateCampus(data: CampusData = DEMO_CAMPUS): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  /* --- уникальность id --- */
  const nodeIds = new Set<string>();
  for (const nd of data.nodes) {
    if (nodeIds.has(nd.id)) errors.push(`Дубликат узла графа: ${nd.id}`);
    nodeIds.add(nd.id);
  }
  const buildingIds = new Set(data.buildings.map((b) => b.id));
  if (buildingIds.size !== data.buildings.length) errors.push('Дубликат id здания');
  const roomIds = new Set<string>();
  for (const r of data.rooms) {
    if (roomIds.has(r.id)) errors.push(`Дубликат комнаты: ${r.id}`);
    roomIds.add(r.id);
  }

  /* --- рёбра ссылаются на существующие узлы --- */
  for (const e of data.edges) {
    if (!nodeIds.has(e.from)) errors.push(`Ребро из несуществующего узла: ${e.from}`);
    if (!nodeIds.has(e.to)) errors.push(`Ребро в несуществующий узел: ${e.to}`);
  }

  /* --- двери --- */
  for (const d of data.doors) {
    if (!buildingIds.has(d.buildingId)) errors.push(`Дверь ${d.id}: нет здания ${d.buildingId}`);
    if (!nodeIds.has(d.outdoorNode)) errors.push(`Дверь ${d.id}: нет узла ${d.outdoorNode}`);
    if (!nodeIds.has(d.indoorNode)) errors.push(`Дверь ${d.id}: нет узла ${d.indoorNode}`);
    const hasEdge = data.edges.some(
      (e) =>
        (e.from === d.outdoorNode && e.to === d.indoorNode) ||
        (e.from === d.indoorNode && e.to === d.outdoorNode),
    );
    if (!hasEdge) errors.push(`Дверь ${d.id}: нет through-door ребра`);
  }

  /* --- вертикальные переходы --- */
  for (const v of data.verticals) {
    for (const nid of [v.fromNode, v.toNode]) {
      if (!nodeIds.has(nid)) errors.push(`Вертикаль ${v.id}: нет узла ${nid}`);
    }
  }

  /* --- комнаты/этажи/здания --- */
  for (const b of data.buildings) {
    for (const f of b.floors) {
      if (!b.levels.includes(f.level)) {
        errors.push(`${b.id}: этаж ${f.level} отсутствует в levels`);
      }
      for (const rid of f.roomIds) {
        if (!roomIds.has(rid)) errors.push(`${b.id}: этаж ${f.level} ссылается на несуществующую комнату ${rid}`);
      }
    }
    for (const r of data.rooms.filter((x) => x.buildingId === b.id)) {
      if (!b.levels.includes(r.floor)) errors.push(`Комната ${r.id}: этаж ${r.floor} вне levels здания`);
      // комната должна лежать внутри footprint
      const fp = b.footprint;
      if (
        r.rect.minX < fp.minX - 0.01 ||
        r.rect.maxX > fp.maxX + 0.01 ||
        r.rect.minZ < fp.minZ - 0.01 ||
        r.rect.maxZ > fp.maxZ + 0.01
      ) {
        warnings.push(`Комната ${r.id} выходит за контур здания ${b.id}`);
      }
      // якорь комнаты существует
      if (!nodeIds.has(`r.${r.id}`)) errors.push(`Комната ${r.id}: нет узла-якоря r.${r.id}`);
      for (const dn of r.doorNodes) {
        if (!nodeIds.has(dn)) errors.push(`Комната ${r.id}: нет узла двери ${dn}`);
      }
    }
  }

  /* --- дорожки ссылаются на узлы --- */
  for (const pth of data.paths) {
    for (const nid of pth.nodeIds) {
      if (!nodeIds.has(nid)) errors.push(`Дорожка ${pth.id}: нет узла ${nid}`);
    }
  }

  /* --- связность графа (undirected BFS от первой уличной точки) --- */
  const adj = buildAdjacency(data.edges);
  const start = data.nodes.find((nd) => nd.type === 'street') ?? data.nodes[0];
  if (start) {
    const seen = new Set<string>([start.id]);
    const queue: string[] = [start.id];
    while (queue.length) {
      const cur = queue.shift()!;
      for (const nb of adj.get(cur) ?? []) {
        if (!seen.has(nb)) {
          seen.add(nb);
          queue.push(nb);
        }
      }
    }
    const isolated = data.nodes.filter((nd) => !seen.has(nd.id)).map((nd) => nd.id);
    if (isolated.length) {
      errors.push(`Узлы оторваны от графа (${isolated.length}): ${isolated.slice(0, 12).join(', ')}${isolated.length > 12 ? ', …' : ''}`);
    }
  }

  /* --- предупреждения: узлы без рёбер по типу room могут быть, но door — нет --- */
  for (const nd of data.nodes) {
    if (nd.type === 'door-outdoor' || nd.type === 'door-indoor') {
      if (!adj.has(nd.id)) warnings.push(`Дверной узел без рёбер: ${nd.id}`);
    }
  }

  const res: ValidationResult = { errors, warnings, ok: errors.length === 0 };
  if (import.meta.env.DEV && (errors.length || warnings.length)) {
    console.groupCollapsed(
      `%c[campus/validation] ${errors.length} ошибок, ${warnings.length} предупреждений`,
      errors.length ? 'color:#ff5d5d' : 'color:#f5c542',
    );
    errors.forEach((e) => console.error(e));
    warnings.forEach((w) => console.warn(w));
    console.groupEnd();
  }
  return res;
}

function buildAdjacency(edges: NavEdge[]): Map<string, string[]> {
  const adj = new Map<string, string[]>();
  const push = (a: string, b: string) => {
    const arr = adj.get(a);
    if (arr) arr.push(b);
    else adj.set(a, [b]);
  };
  for (const e of edges) {
    push(e.from, e.to);
    if (e.bidirectional !== false) push(e.to, e.from);
  }
  return adj;
}

/** Быстрая сводка для отладки. */
export function campusStats(data: CampusData = DEMO_CAMPUS): Record<string, number> {
  const byType = (t: NavNode['type']) => data.nodes.filter((n) => n.type === t).length;
  return {
    buildings: data.buildings.length,
    floors: data.buildings.reduce((s, b) => s + b.floors.length, 0),
    rooms: data.rooms.length,
    doors: data.doors.length,
    verticals: data.verticals.length,
    nodes: data.nodes.length,
    edges: data.edges.length,
    streetNodes: byType('street'),
    corridorNodes: byType('corridor'),
  };
}
