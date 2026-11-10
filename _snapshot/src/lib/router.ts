// ============================================================
// Маршрутизация: уличный A*, внутренний A* и сквозной маршрут
// "улица + помещение".
// ============================================================

import type { Building, RouteResult, RouteSegment, PlaceRef, NavNode } from '../data/types';
import { outdoorCampus, extraOutdoorPois } from '../data/campusOutdoor';
import { buildIndoorGraph, buildOutdoorGraph } from './graph';
import { astar } from './astar';
import { nodeToWorld } from './geometry';
import { generateSteps } from './instructions';

export const WALK_SPEED = 1.3; // м/с

const outdoorAdj = buildOutdoorGraph(outdoorCampus.edges);
const outdoorNodeById = new Map(outdoorCampus.nodes.map((n) => [n.id, n]));

/** Эвристика для улицы — расстояние между узлами */
function outdoorHeuristic(a: string, b: string): number {
  const na = outdoorNodeById.get(a);
  const nb = outdoorNodeById.get(b);
  if (!na || !nb) return 0;
  return Math.hypot(na.pos[0] - nb.pos[0], na.pos[1] - nb.pos[1]);
}

/** Уличный путь между узлами */
export function outdoorPath(from: string, to: string): { path: string[]; edgeTypes: string[] } | null {
  const res = astar(outdoorAdj, from, to, outdoorHeuristic);
  if (!res) return null;
  return { path: res.path, edgeTypes: res.edgeTypes };
}

/** Позиция уличного узла (или дополнительного POI) в плане */
export function outdoorNodePos(id: string): [number, number] | null {
  const n = outdoorNodeById.get(id);
  if (n) return n.pos;
  const p = extraOutdoorPois.find((x) => x.id === id);
  return p ? p.pos : null;
}

export function outdoorLabel(id: string): string | undefined {
  return outdoorNodeById.get(id)?.label ?? extraOutdoorPois.find((p) => p.id === id)?.label;
}

/** Внутренний путь в здании */
function indoorPath(building: Building, from: string, to: string, noStairs: boolean) {
  const adj = buildIndoorGraph(building, { noStairs });
  const nodeMap = new Map<string, NavNode>(building.nodes.map((n) => [n.id, n]));
  const h = (a: string, b: string) => {
    const na = nodeMap.get(a), nb = nodeMap.get(b);
    if (!na || !nb) return 0;
    return Math.hypot(na.x - nb.x, na.z - nb.z) + Math.abs(na.floorLevel - nb.floorLevel) * 4;
  };
  const res = astar(adj, from, to, h);
  if (!res) return null;
  return { result: res, nodeMap };
}

/** Разрешение точки выбора пользователя во внутренние узлы */
export function resolvePlaceToNodes(place: PlaceRef, building: Building): { entryNodeId: string; exitNodeId: string; roomDoorNodeId?: string } | null {
  if (place.kind === 'indoor') {
    return { entryNodeId: place.nodeId, exitNodeId: place.nodeId };
  }
  if (place.kind === 'room') {
    const room = building.rooms.find((r) => r.id === place.roomId);
    if (!room) return null;
    if (room.doors.length === 0) {
      // комнаты без дверей (коридор/холл) — ближайший узел по позиции подписи
      let best: NavNode | null = null;
      let bd = Infinity;
      for (const n of building.nodes) {
        if (n.floorLevel !== room.floorLevel) continue;
        const d = Math.hypot(n.x - room.labelPosition[0], n.z - room.labelPosition[1]);
        if (d < bd) { bd = d; best = n; }
      }
      return best ? { entryNodeId: best.id, exitNodeId: best.id } : null;
    }
    const door = room.doors[0];
    return { entryNodeId: door.nodeId, exitNodeId: door.nodeId, roomDoorNodeId: door.nodeId };
  }
  return null;
}

interface BuildArgs {
  building: Building;
  from: PlaceRef;
  to: PlaceRef;
  noStairs?: boolean;
}

/**
 * Сквозной маршрут: улица + помещение.
 * Логика:
 *  - если обе точки внутри одного здания — только внутренний путь;
 *  - если одна точка уличная или здания разные — уличный участок до входа
 *    целевого здания + внутренний путь от входа к комнате;
 *  - ДК (b2) <-> корпус 1 (b1): внутренний переход passageTo вместо улицы.
 */
export function buildRoute({ building, from, to, noStairs }: BuildArgs): RouteResult | null {
  const points: [number, number, number][] = [];
  const nodeIds: string[] = [];
  const segments: RouteSegment[] = [];
  // типы перемещений между точками i и i+1
  const moveTypes: ('walk' | 'door' | 'stairs' | 'elevator' | 'outdoor' | 'enter' | 'exit' | 'passage')[] = [];
  // этаж каждой точки (null = улица)
  const floorAt: (number)[] = [];

  const pushPoint = (p: [number, number, number], id: string, floor: number | null) => {
    if (nodeIds.length > 0) {
      // тип перехода определяется ниже вызывающим кодом
    }
    points.push(p);
    nodeIds.push(id);
    floorAt.push(floor);
  };

  const entranceNode = building.outdoorEntranceNodeId; // n_k8 для демо-корпуса
  const sameBuildingIndoor = from.kind !== 'outdoor' && to.kind !== 'outdoor';

  // ---- Случай: оба конца внутри одного здания ----
  if (sameBuildingIndoor) {
    const a = resolvePlaceToNodes(from, building);
    const b = resolvePlaceToNodes(to, building);
    if (!a || !b) return null;
    const ip = indoorPath(building, a.entryNodeId, b.exitNodeId, !!noStairs);
    if (!ip) return null;
    appendIndoor(ip.result.path, ip.nodeMap, building, pushPoint, moveTypes, floorAt, true);
    return finalize(points, nodeIds, segments, moveTypes, floorAt, building, to, b);
  }

  // ---- Сквозной случай ----
  // Стартовая позиция: уличный узел (или выход из текущего здания на улицу)
  let startOutdoorId: string | null = null;
  if (from.kind === 'outdoor') startOutdoorId = from.nodeId;
  else {
    // старт внутри здания -> выходим через вход этого здания
    const srcBuildingId = (from as { buildingId: string }).buildingId;
    startOutdoorId = srcBuildingId === building.id ? entranceNode ?? null : null;
    if (!startOutdoorId) return null;
  }

  // Финиш: уличный узел или комната/узел внутри выбранного здания
  let endOutdoorId: string | null = null;
  let targetIndoor: { place: PlaceRef } | null = null;
  if (to.kind === 'outdoor') endOutdoorId = to.nodeId;
  else targetIndoor = { place: to };

  if (!targetIndoor && endOutdoorId && startOutdoorId) {
    // чисто уличный маршрут
    const op = outdoorPath(startOutdoorId, endOutdoorId);
    if (!op) return null;
    const segStart = points.length;
    for (const id of op.path) {
      const pos = outdoorNodePos(id);
      if (!pos) continue;
      pushPoint([pos[0], 0.6, pos[1]], id, null);
      moveTypes.push('outdoor');
    }
    moveTypes.pop();
    segments.push({ kind: 'outdoor', startPointIndex: segStart, endPointIndex: points.length - 1 });
    return finalize(points, nodeIds, segments, moveTypes, floorAt, building, to, null);
  }

  if (!targetIndoor || !entranceNode) return null;
  const b = resolvePlaceToNodes(targetIndoor.place, building);
  if (!b) return null;

  // Уличный участок: startOutdoor -> entranceNode здания
  if (startOutdoorId !== entranceNode) {
    const op = outdoorPath(startOutdoorId, entranceNode);
    if (!op) return null;
    const segStart = points.length;
    for (let k = 0; k < op.path.length; k++) {
      const id = op.path[k];
      const pos = outdoorNodePos(id);
      if (!pos) continue;
      pushPoint([pos[0], 0.6, pos[1]], id, null);
      if (k > 0) moveTypes.push('outdoor');
    }
    segments.push({ kind: 'outdoor', startPointIndex: segStart, endPointIndex: points.length - 1 });
    // вход в здание
    const f1entrance = building.nodes.find((n) => n.type === 'entrance');
    if (!f1entrance) return null;
    const w = nodeToWorld(f1entrance, building.floors, 3.2);
    pushPoint(w, f1entrance.id, f1entrance.floorLevel);
    moveTypes.push('enter');
  } else {
    // старт уже у входа здания — начинаем со входа внутрь
    const f1entrance = building.nodes.find((n) => n.type === 'entrance');
    if (!f1entrance) return null;
    const w = nodeToWorld(f1entrance, building.floors, 3.2);
    pushPoint(w, f1entrance.id, f1entrance.floorLevel);
  }

  // Внутренний участок: от текущего узла до цели
  const currentId = nodeIds[nodeIds.length - 1];
  const ip = indoorPath(building, currentId, b.exitNodeId, !!noStairs);
  if (!ip) return null;
  const segStart = points.length;
  appendIndoorTail(ip.result.path, ip.nodeMap, building, pushPoint, moveTypes, floorAt);
  segments.push({ kind: 'indoor', buildingId: building.id, startPointIndex: segStart, endPointIndex: points.length - 1 });

  return finalize(points, nodeIds, segments, moveTypes, floorAt, building, to, b);
}

/** Добавляет полный внутренний путь (первая точка тоже добавляется) */
function appendIndoor(
  path: string[],
  nodeMap: Map<string, NavNode>,
  building: Building,
  pushPoint: (p: [number, number, number], id: string, floor: number | null) => void,
  moveTypes: ReturnType<typeof getMoveArr>,
  floorAt: ReturnType<typeof getFloorArr>,
  withFirst: boolean,
) {
  const arr = getMoveArrType(path, nodeMap, building);
  for (let k = 0; k < path.length; k++) {
    if (!withFirst && k === 0) continue;
    const n = nodeMap.get(path[k])!;
    pushPoint(nodeToWorld(n, building.floors, 3.2), n.id, n.floorLevel);
    if (k > 0) moveTypes.push(arr[k - 1]);
  }
}

/** Добавляет внутренний путь, пропуская первую точку (она уже есть) */
function appendIndoorTail(
  path: string[],
  nodeMap: Map<string, NavNode>,
  building: Building,
  pushPoint: (p: [number, number, number], id: string, floor: number | null) => void,
  moveTypes: ReturnType<typeof getMoveArr>,
  floorAt: ReturnType<typeof getFloorArr>,
) {
  appendIndoor(path, nodeMap, building, pushPoint, moveTypes, floorAt, false);
}

type MoveKind = 'walk' | 'door' | 'stairs' | 'elevator' | 'outdoor' | 'enter' | 'exit' | 'passage';
type FloorKind = number | null;
function getMoveArr() { return [] as MoveKind[]; }
function getFloorArr() { return [] as FloorKind[]; }

/** Определяет тип перемещения между последовательными узлами внутреннего пути */
function getMoveArrType(path: string[], nodeMap: Map<string, NavNode>, building: Building): MoveKind[] {
  const out: MoveKind[] = [];
  for (let k = 1; k < path.length; k++) {
    const a = nodeMap.get(path[k - 1])!;
    const b = nodeMap.get(path[k])!;
    if (a.floorLevel !== b.floorLevel) {
      const e = building.edges.find(
        (ed) => (ed.from === a.id && ed.to === b.id) || (ed.from === b.id && ed.to === a.id),
      );
      out.push(e?.type === 'elevator' ? 'elevator' : 'stairs');
    } else if (b.type === 'door') out.push('door');
    else if (a.type === 'door') out.push('door');
    else out.push('walk');
  }
  return out;
}

/** Сборка итогового RouteResult: длина, время, шаги */
function finalize(
  points: [number, number, number][],
  nodeIds: string[],
  segments: RouteSegment[],
  moveTypes: MoveKind[],
  floorAt: FloorKind[],
  building: Building,
  to: PlaceRef,
  resolvedTarget: { entryNodeId: string; exitNodeId: string; roomDoorNodeId?: string } | null,
): RouteResult | null {
  if (points.length < 2) return null;

  // длина маршрута (по 3D, с вертикалью лестницы)
  let length = 0;
  for (let i = 1; i < points.length; i++) {
    length += Math.hypot(
      points[i][0] - points[i - 1][0],
      points[i][1] - points[i - 1][1],
      points[i][2] - points[i - 2 + 2][2],
    );
  }

  const floors = Array.from(new Set(floorAt.filter((f): f is number => f !== null))).sort();

  // карта "узел двери -> имя комнаты"
  const roomNameByNode = new Map<string, string>();
  for (const r of building.rooms) {
    for (const d of r.doors) roomNameByNode.set(d.nodeId, r.name);
  }

  const planPoints: [number, number][] = points.map((p) => [p[0], p[2]]);

  const steps = generateSteps({
    planPoints,
    heights: points.map((p) => p[1]),
    floorAt: (i) => floorAt[i],
    moveType: (i) => moveTypes[i] ?? 'walk',
    roomNameByNode,
    nodeIds,
    building,
    outdoorLabel,
  });

  // целевая дверь
  let targetDoorId: string | undefined;
  let targetRoomId: string | undefined;
  if (to.kind === 'room') {
    targetRoomId = to.roomId;
    const room = building.rooms.find((r) => r.id === to.roomId);
    targetDoorId = room?.doors[0]?.id;
  }

  return {
    points,
    nodeIds,
    floors,
    steps,
    length,
    timeSeconds: length / WALK_SPEED,
    segments,
    targetRoomId,
    targetDoorId,
  };
}

/** Проверка доступности перехода ДК <-> корпус 1 (для UI-подсказки) */
export function hasPassage(fromBuildingId: string, toBuildingId: string): boolean {
  const b = outdoorCampus.buildings.find((x) => x.id === fromBuildingId);
  return !!b?.passageTo && b.passageTo === toBuildingId;
}
