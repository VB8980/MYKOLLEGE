// Геометрические утилиты: полигоны, расстояния, центры
import type { Polygon2D } from '../data/types';

export function dist2(a: [number, number], b: [number, number]): number {
  return Math.hypot(a[0] - b[0], a[1] - b[1]);
}

/** Центр полигона (среднее вершин — достаточно для прямоугольных демо-полигонов) */
export function polygonCentroid(poly: Polygon2D): [number, number] {
  let sx = 0, sz = 0;
  for (const p of poly) { sx += p[0]; sz += p[1]; }
  return [sx / poly.length, sz / poly.length];
}

/** Ориентированная площадь полигона (знак — направление обхода) */
export function polygonArea(poly: Polygon2D): number {
  let s = 0;
  for (let i = 0; i < poly.length; i++) {
    const [x1, z1] = poly[i];
    const [x2, z2] = poly[(i + 1) % poly.length];
    s += x1 * z2 - x2 * z1;
  }
  return s / 2;
}

/** Привести полигон к нужной ориентации (для ShapeGeometry в R3F нужен CCW сверху) */
export function ensureOrientation(poly: Polygon2D, ccw: boolean): Polygon2D {
  const area = polygonArea(poly);
  const isCCW = area > 0; // при XZ->XY отображении знак может инвертироваться, вызывающий нормализует
  return isCCW === ccw ? poly : [...poly].reverse();
}

/** Угол между двумя векторами на плоскости, градусы [-180..180]. Положительный — поворот направо (по часовой в XZ с Z вниз) */
export function signedAngleDeg(ax: number, az: number, bx: number, bz: number): number {
  const cross = ax * bz - az * bx;
  const dot = ax * bx + az * bz;
  return (Math.atan2(cross, dot) * 180) / Math.PI;
}

/** Формат расстояния "12 м" / "0.5 км" */
export function formatDistance(m: number): string {
  if (m >= 1000) return `${(m / 1000).toFixed(2)} км`;
  return `${Math.round(m)} м`;
}

/** Время пешком при 1.3 м/с -> "3 мин" */
export const WALK_SPEED = 1.3;
export function formatDuration(sec: number): string {
  const min = Math.max(1, Math.round(sec / 60));
  if (min < 60) return `~${min} мин`;
  return `~${Math.floor(min / 60)} ч ${min % 60} мин`;
}
