/**
 * geometry.ts — мелкие геометрические утилиты для навигации.
 *
 * Всё работает в плоскости XZ (план кампуса); Y — только высота этажа.
 * Внешних зависимостей нет: чистая математика.
 */

import type { NavNode } from '../data/types';

/** Скорость пешехода, м/с (используется для оценки времени пути). */
const WALK_SPEED_MPS = 1.3;

/** Длина одного сегмента между двумя позициями узлов (3D-евклидова). */
export function segmentDistance(p1: NavNode, p2: NavNode): number {
  const dx = p1.position.x - p2.position.x;
  const dy = p1.position.y - p2.position.y;
  const dz = p1.position.z - p2.position.z;
  return Math.sqrt(dx * dx + dy * dy + dz * dz);
}

/** Суммарная длина пути по последовательности узлов (сумма всех сегментов). */
export function totalPathLength(nodes: NavNode[]): number {
  let sum = 0;
  for (let i = 1; i < nodes.length; i++) {
    sum += segmentDistance(nodes[i - 1], nodes[i]);
  }
  return sum;
}

/** Позиции узлов как массив [x, y, z] — для отрисовки линии маршрута в Three.js. */
export function pathToPoints3D(nodes: NavNode[]): [number, number, number][] {
  return nodes.map((n) => [n.position.x, n.position.y, n.position.z]);
}

/** Оценка времени пешком, сек (скорость 1.3 м/с). */
export function estimateWalkTime(meters: number): number {
  return meters / WALK_SPEED_MPS;
}

/**
 * Определяет поворот в точке b относительно направления a -> b -> c.
 * Возвращает 'straight' | 'left' | 'right'.
 *
 * Работаем в плане XZ. Угол считаем через векторное произведение:
 * знак Z-компоненты (dx1*dz2 - dz1*dx2) говорит о стороне поворота,
 * а косинус угла между векторами — насколько сильный поворот.
 * Малые углы и вырожденные (нулевые) векторы считаются 'straight'.
 */
export function angleBetween(a: NavNode, b: NavNode, c: NavNode): 'straight' | 'left' | 'right' {
  const dx1 = b.position.x - a.position.x;
  const dz1 = b.position.z - a.position.z;
  const dx2 = c.position.x - b.position.x;
  const dz2 = c.position.z - b.position.z;

  const len1 = Math.hypot(dx1, dz1);
  const len2 = Math.hypot(dx2, dz2);
  if (len1 === 0 || len2 === 0) return 'straight'; // нет направления — поворот неопределён

  const cos = (dx1 * dx2 + dz1 * dz2) / (len1 * len2);
  // Порог ~25 градусов: всё, что отклоняется меньше, считаем движением прямо.
  if (cos > Math.cos((25 * Math.PI) / 180)) return 'straight';

  // Знак «псевдо-кросса»: > 0 — поворот налево, < 0 — направо (ось Y вверх).
  const cross = dx1 * dz2 - dz1 * dx2;
  if (cross > 0) return 'left';
  if (cross < 0) return 'right';
  return 'straight'; // разворот на 180° вдоль одной оси — формально без стороны
}
