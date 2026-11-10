/**
 * layoutIO.ts — чистые функции сериализации/десериализации геометрии кампуса
 * (campusLayout) для редактора трассировки: экспорт в campusLayout.json,
 * импорт с валидацией, калибровка SAT_BOUNDS по двум точкам.
 *
 * Формат JSON = сериализуемое представление CampusLayout (без функций).
 */

import type { DoorPoint, Footprint, Plaza, Pt, Road, Stadium } from '../data/campusLayout';

/** Полное сериализуемое состояние layout (то, что дампит кнопка «Скачать»). */
export interface LayoutSnapshot {
  footprints: Record<string, Footprint>;
  buildingLevels: Record<string, number>;
  roads: Road[];
  plaza: Plaza;
  stadium: Stadium;
  doors: DoorPoint[];
  /** Границы подложки [minX, minY, maxX, maxY] в координатах layout, м. */
  satBounds: readonly [number, number, number, number];
  /** Метров на 1 пиксель подложки (калибровка). */
  metersPerPixel: number;
}

/* ============================ Сериализация ============================ */

export function snapshotToJson(s: LayoutSnapshot): string {
  return JSON.stringify(s, null, 2);
}

/** Скачивание файла в браузере (без зависимостей). */
export function downloadJson(filename: string, json: string): void {
  const blob = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 0);
}

/* ============================ Валидация / импорт ============================ */

const isNum = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);
const isPt = (v: unknown): v is Pt =>
  Array.isArray(v) && v.length >= 2 && isNum(v[0]) && isNum(v[1]);

function fail(msg: string): never {
  throw new Error(`campusLayout.json: ${msg}`);
}

export function parseLayoutSnapshot(text: string): LayoutSnapshot {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch (e) {
    fail(`некорректный JSON (${(e as Error).message})`);
  }
  const o = raw as Record<string, unknown>;
  if (!o || typeof o !== 'object') fail('ожидался объект верхнего уровня');

  // footprints
  const fpRaw = o.footprints;
  if (!fpRaw || typeof fpRaw !== 'object') fail('нет поля footprints');
  const footprints: Record<string, Footprint> = {};
  for (const [id, v] of Object.entries(fpRaw as Record<string, unknown>)) {
    const f = v as Record<string, unknown>;
    if (!f || !isNum(f.x) || !isNum(f.y) || !isNum(f.w) || !isNum(f.h)) {
      fail(`footprint "${id}": ожидаются числа x,y,w,h`);
    }
    if (f.w <= 0 || f.h <= 0) fail(`footprint "${id}": неверные размеры`);
    footprints[id] = { id: String(f.id ?? id), x: f.x, y: f.y, w: f.w, h: f.h };
  }

  const blRaw = o.buildingLevels;
  const buildingLevels: Record<string, number> = {};
  if (blRaw && typeof blRaw === 'object') {
    for (const [id, v] of Object.entries(blRaw as Record<string, unknown>)) {
      if (isNum(v) && v > 0) buildingLevels[id] = Math.round(v);
    }
  }

  // roads
  if (!Array.isArray(o.roads)) fail('нет массива roads');
  const roads: Road[] = (o.roads as unknown[]).map((v, i) => {
    const r = v as Record<string, unknown>;
    if (!r || typeof r.id !== 'string' || !Array.isArray(r.pts) || !isNum(r.width)) {
      fail(`road #${i}: ожидаются id, pts[], width`);
    }
    const pts = r.pts as unknown[];
    if (pts.length < 2 || !pts.every(isPt)) fail(`road "${r.id}": pts — массив точек [x,y], минимум 2`);
    const surface = r.surface === 'asphalt' || r.surface === 'paving' || r.surface === 'bridge'
      ? r.surface : 'paving';
    return {
      id: r.id, name: typeof r.name === 'string' ? r.name : r.id,
      pts: pts.map((p) => [Number((p as Pt)[0]), Number((p as Pt)[1])] as Pt),
      width: r.width, surface,
    };
  });

  // plaza
  const plz = o.plaza as Record<string, unknown> | undefined;
  if (!plz || !Array.isArray(plz.polygon) || plz.polygon.length < 3 || !plz.polygon.every(isPt)) {
    fail('plaza: ожидается polygon из >=3 точек [x,y]');
  }
  const plaza: Plaza = {
    id: typeof plz.id === 'string' ? plz.id : 'plaza',
    name: typeof plz.name === 'string' ? plz.name : 'Площадь',
    polygon: (plz.polygon as unknown[]).map((p) => [Number((p as Pt)[0]), Number((p as Pt)[1])] as Pt),
  };

  // stadium
  const st = o.stadium as Record<string, unknown> | undefined;
  if (!st || !isPt(st.center) || !isNum(st.rx) || !isNum(st.ry) || !isNum(st.fieldW) || !isNum(st.fieldH)) {
    fail('stadium: ожидаются center[x,y], rx, ry, fieldW, fieldH');
  }
  const stadium: Stadium = {
    center: st.center as Pt, rx: st.rx, ry: st.ry, fieldW: st.fieldW, fieldH: st.fieldH,
    name: typeof st.name === 'string' ? st.name : 'Стадион',
  };

  // doors
  if (!Array.isArray(o.doors)) fail('нет массива doors');
  const doors: DoorPoint[] = (o.doors as unknown[]).map((v, i) => {
    const d = v as Record<string, unknown>;
    if (!d || typeof d.id !== 'string' || !isPt(d.pos)) fail(`door #${i}: ожидаются id, pos[x,y]`);
    return { id: d.id, label: typeof d.label === 'string' ? d.label : d.id, pos: d.pos as Pt };
  });

  // satBounds + metersPerPixel
  const sb = o.satBounds;
  let satBounds: LayoutSnapshot['satBounds'] = [-320, -160, 320, 340];
  if (Array.isArray(sb) && sb.length === 4 && sb.every(isNum)) {
    satBounds = [sb[0] as number, sb[1] as number, sb[2] as number, sb[3] as number];
  }
  const mpp = isNum(o.metersPerPixel) && (o.metersPerPixel as number) > 0
    ? (o.metersPerPixel as number) : 1;

  return { footprints, buildingLevels, roads, plaza, stadium, doors, satBounds, metersPerPixel: mpp };
}

/* ============================ Калибровка подложки ============================ */

/**
 * Калибровка: пользователь кликнул две точки на подложке (в world-координатах XZ
 * плоскости земли) и ввёл реальное расстояние между ними в метрах.
 * Возвращает новый SAT_BOUNDS, центрированный вокруг старой середины, при
 * фиксированном размере изображения в пикселях (mpp = метров/пиксель).
 */
export interface CalibInput {
  /** мировые XZ двух опорных кликов: [(x1,z1),(x2,z2)] */
  p1: [number, number];
  p2: [number, number];
  /** реальное расстояние, м */
  realMeters: number;
  /** текущие границы layout [minX,minY,maxX,maxY] */
  bounds: readonly [number, number, number, number];
  /** размер текстуры подложки в пикселях */
  imagePx: [number, number];
}

export interface CalibResult {
  bounds: [number, number, number, number];
  metersPerPixel: number;
}

/** world -> layout: x = worldX, y = -worldZ. */
export const worldToLayout = (x: number, z: number): Pt => [x, -z];

export function calibrateSatBounds(c: CalibInput): CalibResult {
  const a = worldToLayout(c.p1[0], c.p1[1]);
  const b = worldToLayout(c.p2[0], c.p2[1]);
  const px = Math.hypot(b[0] - a[0], b[1] - a[1]); // расстояние в layout-метрах (старая шкала)
  if (px < 1e-6 || !(c.realMeters > 0)) {
    return { bounds: [c.bounds[0], c.bounds[1], c.bounds[2], c.bounds[3]], metersPerPixel: 1 };
  }
  const scale = c.realMeters / px; // множитель: новые метры на старый layout-метр
  const [minX, minY, maxX, maxY] = c.bounds;
  // середина калибровочного отрезка остаётся на месте: bounds масштабируются вокруг неё
  const mx = (a[0] + b[0]) / 2;
  const my = (a[1] + b[1]) / 2;
  const nb: [number, number, number, number] = [
    mx + (minX - mx) * scale,
    my + (minY - my) * scale,
    mx + (maxX - mx) * scale,
    my + (maxY - my) * scale,
  ];
  const oldMpp = (maxX - minX) / Math.max(1, c.imagePx[0]);
  return { bounds: nb, metersPerPixel: oldMpp * scale };
}

/* ============================ Snap ============================ */

/** Округление к сетке (snap 1 м по ТЗ). */
export const snapM = (v: number, step = 1): number => Math.round(v / step) * step;

export function snapPt(p: Pt, step = 1): Pt {
  return [snapM(p[0], step), snapM(p[1], step)];
}
