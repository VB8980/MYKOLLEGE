/**
 * Сборка итогового Route (Модель А) из найденного пути.
 * points уже мировые Vec3 — камера и линия берут их напрямую.
 */
import type { NavEdge, NavNode, Place, Route } from '../data/types';
import { totalPathLength } from './geometry';
import { buildSegments, generateSteps, WALK_SPEED } from './instructions';

let _seq = 0;

export function transformRoute(
  path: NavNode[], edges: NavEdge[], from: Place, to: Place,
): Route {
  const segments = buildSegments(path, edges);
  const steps = generateSteps(path, edges, segments, from.name, to.name);
  const distance = totalPathLength(path);
  const floorsVisited = Array.from(
    new Set(path.map((n) => n.floor).filter((f): f is number => f != null)),
  ).sort((a, b) => a - b);
  return {
    id: `route_${++_seq}`,
    fromLabel: from.name, toLabel: to.name,
    nodeIds: path.map((n) => n.id),
    points: path.map((n) => n.position),
    segments, steps, distance,
    durationSec: distance / WALK_SPEED,
    floorsVisited,
  };
}

/** Точки маршрута для линии/камеры/миникарты (будущий шаг 8). */
export function prepareRouteForDisplay(route: Route): [number, number, number][] {
  return route.points.map((p) => [p.x, p.y, p.z]);
}