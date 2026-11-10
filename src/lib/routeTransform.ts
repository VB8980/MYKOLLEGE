// Преобразование точек маршрута в мировые координаты 3D-сцены.
// Внутренняя схема демо-корпуса имеет свои локальные координаты;
// в режиме "Кампус" она размещается у корпуса b8 со смещением и масштабом.
import type { Route, RoutePoint } from '../data/types';
import { COLLEGE_WORLD_OFFSET } from './router';

/** Масштаб внутренней схемы относительно уличных метров (демо-корпус меньше реального b8) */
export const INDOOR_SCALE = 1.6;

/** Перевести внутреннюю точку в мировые координаты кампуса */
export function indoorToWorld(p: { x: number; z: number }): [number, number] {
  return [COLLEGE_WORLD_OFFSET[0] + p.x * INDOOR_SCALE, COLLEGE_WORLD_OFFSET[1] + p.z * INDOOR_SCALE];
}

/**
 * Подготовить маршрут для отображения/анимации.
 * mode 'campus' — внутренние точки маппятся в мир кампуса,
 *   стык улица↔вход соединяется коротким вертикальным участком у двери.
 * mode 'indoor' — только внутренние точки в локальных координатах здания.
 */
export function prepareRouteForDisplay(route: Route, mode: 'campus' | 'indoor'): RoutePoint[] {
  if (mode === 'indoor') {
    return route.points.filter((p) => p.floorId !== null);
  }
  const out: RoutePoint[] = [];
  for (const p of route.points) {
    if (p.floorId === null) {
      out.push({ ...p });
    } else {
      const [wx, wz] = indoorToWorld(p);
      out.push({ ...p, x: wx, z: wz });
    }
  }
  // Сглаживание стыков: если соседние точки — улица и помещение, вставляем промежуточную на входе
  const res: RoutePoint[] = [];
  for (let i = 0; i < out.length; i++) {
    const cur = out[i];
    res.push(cur);
    const next = out[i + 1];
    if (next && ((cur.floorId === null) !== (next.floorId === null))) {
      const midY = (cur.y + next.y) / 2;
      res.push({ ...cur, x: (cur.x + next.x) / 2, z: (cur.z + next.z) / 2, y: midY, nodeId: `${cur.nodeId}>${next.nodeId}` });
    }
  }
  return res;
}
