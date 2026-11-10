// Сглаживание маршрута для камеры: CatmullRom + равномерная выборка по длине
import * as THREE from 'three';
import type { RoutePoint } from '../data/types';

export interface CameraPath {
  curve: THREE.CatmullRomCurve3;
  /** длины сегментов кривой (сэмплированной) */
  lengths: number[];
  total: number;
  /** точка по нормализованной длине [0..1] */
  at: (t: number) => THREE.Vector3;
  /** направление в точке t */
  tangentAt: (t: number) => THREE.Vector3;
}

/** Удалить последовательные дубликаты точек (<0.2 м), иначе CatmullRom ломается */
export function dedupePoints(pts: RoutePoint[]): THREE.Vector3[] {
  const out: THREE.Vector3[] = [];
  for (const p of pts) {
    const v = new THREE.Vector3(p.x, p.y, p.z);
    if (out.length === 0 || out[out.length - 1].distanceTo(v) > 0.2) out.push(v);
  }
  if (out.length < 2) {
    // добавим искусственное смещение, чтобы кривая не выродилась
    const a = out[0] ?? new THREE.Vector3();
    out.push(a.clone().add(new THREE.Vector3(0.5, 0, 0)));
  }
  return out;
}

export function buildCameraPath(pts: RoutePoint[], samples = 400): CameraPath {
  const curve = new THREE.CatmullRomCurve3(dedupePoints(pts), false, 'catmullrom', 0.25);
  const arc = curve.getLengths(samples);
  const lengths: number[] = [];
  let total = 0;
  for (let i = 1; i < arc.length; i++) { lengths.push(arc[i]); total = arc[i]; }
  const at = (t: number) => curve.getPointAt(Math.min(1, Math.max(0, t)));
  const tangentAt = (t: number) => {
    const tt = Math.min(1, Math.max(0, t));
    const a = curve.getPointAt(Math.max(0, tt - 0.004));
    const b = curve.getPointAt(Math.min(1, tt + 0.004));
    return b.sub(a).normalize();
  };
  return { curve, lengths, total, at, tangentAt };
}
