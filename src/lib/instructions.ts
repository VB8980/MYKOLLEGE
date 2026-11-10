/**
 * Генерация богатых пошаговых инструкций (Модель А).
 * Каждый RouteStep несёт at/to (Vec3), headingIn/Out (градусы), tStart/tEnd (сек),
 * segmentIndex и icon — это то, что камера и UI используют напрямую.
 * segmentDistance вызывается УЗЛАМИ (не позициями) — так требует geometry.ts.
 */
import type {
  NavEdge, NavNode, RouteSegment, RouteStep, InstructionKind, ManeuverIcon, Vec3,
} from '../data/types';
import { segmentDistance } from './geometry';
import { formatDistance, formatFloor } from './format';

export const WALK_SPEED = 1.3; // м/с

/** Направление вектора (x,z) в градусах: 0 = +X, по часовой. */
function heading(a: Vec3, b: Vec3): number {
  const deg = (Math.atan2(b.z - a.z, b.x - a.x) * 180) / Math.PI;
  return (deg + 360) % 360;
}

/** Классификация поворота по разнице заходов. */
function turnKind(delta: number): InstructionKind {
  const d = ((delta + 540) % 360) - 180; // в диапазон -180..180
  const a = Math.abs(d);
  if (a < 15) return 'straight';
  if (a < 60) return d < 0 ? 'slight-left' : 'slight-right';
  if (a < 130) return d < 0 ? 'turn-left' : 'turn-right';
  if (a < 160) return d < 0 ? 'sharp-left' : 'sharp-right';
  return 'uturn';
}

function iconFor(kind: InstructionKind): ManeuverIcon {
  switch (kind) {
    case 'start': return 'flag-start';
    case 'straight': return 'arrow-straight';
    case 'turn-left': case 'slight-left': case 'sharp-left': return 'arrow-left';
    case 'turn-right': case 'slight-right': case 'sharp-right': return 'arrow-right';
    case 'uturn': return 'arrow-straight';
    case 'enter-building': case 'exit-building': return 'building';
    case 'door-left': case 'door-right': return 'door';
    case 'stairs-up': return 'stairs-up';
    case 'stairs-down': return 'stairs-down';
    case 'elevator-up': case 'elevator-down': return 'elevator';
    case 'arrive-room': case 'arrive-outdoor': case 'finish': return 'flag-finish';
  }
}

/** Группировка последовательных рёбер одного kind в сегменты. */
export function buildSegments(path: NavNode[], edges: NavEdge[]): RouteSegment[] {
  const segs: RouteSegment[] = [];
  let cur: RouteSegment | null = null;
  for (let i = 0; i < edges.length; i++) {
    const e = edges[i];
    const a = path[i], b = path[i + 1];
    const dist = segmentDistance(a, b);
    const sameKind = !!cur && cur.kind === e.kind &&
      (e.kind !== 'vertical' || cur.toFloor === b.floor);
    if (!sameKind) {
      cur = {
        kind: e.kind, nodeIds: [a.id, b.id], distance: dist,
        fromFloor: a.floor, toFloor: b.floor, buildingId: b.buildingId ?? a.buildingId,
      };
      segs.push(cur);
    } else {
      cur!.nodeIds.push(b.id);
      cur!.distance += dist;
      cur!.toFloor = b.floor;
    }
  }
  return segs;
}

/** Индекс сегмента, содержащего ребро i. */
function segIndexForEdge(segs: RouteSegment[], edges: NavEdge[], i: number): number {
  let acc = 0;
  for (let s = 0; s < segs.length; s++) {
    acc += segs[s].nodeIds.length - 1; // рёбер в сегменте
    if (i < acc) return s;
  }
  return Math.max(0, segs.length - 1);
}

/** Собирает шаги с накопленным временем tStart/tEnd для полёта камеры. */
export function generateSteps(
  path: NavNode[], edges: NavEdge[], segments: RouteSegment[],
  fromLabel: string, toLabel: string,
): RouteStep[] {
  const steps: RouteStep[] = [];
  if (path.length === 0) return steps;

  let cumDist = 0;
  const push = (
    kind: InstructionKind, text: string, at: Vec3, to: Vec3,
    dist: number, hIn: number, hOut: number, segIdx: number,
    node: NavNode, detail?: string,
  ) => {
    const tStart = cumDist / WALK_SPEED;
    cumDist += dist;
    const tEnd = cumDist / WALK_SPEED;
    steps.push({
      index: steps.length, kind, icon: iconFor(kind), text, detail,
      at, to, distance: dist, headingIn: hIn, headingOut: hOut,
      segmentIndex: segIdx, floor: node.floor, buildingId: node.buildingId,
      tStart, tEnd,
    });
  };

  const h0 = edges[0] ? heading(path[0].position, path[1].position) : 0;
  push('start', `Начните движение от ${fromLabel}`,
    path[0].position, path[0].position, 0, h0, h0, 0, path[0]);

  for (let i = 1; i < path.length; i++) {
    const prev = path[i - 1], cur = path[i], e = edges[i - 1];
    const segIdx = segIndexForEdge(segments, edges, i - 1);
    const hIn = heading(prev.position, cur.position);
    const next = path[i + 1];
    const hOut = next ? heading(cur.position, next.position) : hIn;
    const d = segmentDistance(prev, cur);

    if (e.kind === 'through-door') {
      push('enter-building', `Войдите через ${cur.label ?? 'дверь'}`,
        prev.position, cur.position, d, hIn, hOut, segIdx, cur);
    } else if (e.kind === 'vertical') {
      const up = (cur.floor ?? 0) > (prev.floor ?? 0);
      const isElev = cur.type === 'elevator' || prev.type === 'elevator';
      const lbl = cur.label ?? prev.label ?? '';
      const isRamp = /пандус/i.test(lbl);
      const kind: InstructionKind = isElev ? (up ? 'elevator-up' : 'elevator-down')
                                            : (up ? 'stairs-up' : 'stairs-down');
      const verb = isElev ? 'Воспользуйтесь лифтом'
                   : isRamp ? (up ? 'Поднимитесь по пандусу' : 'Спуститесь по пандусу')
                   : (up ? 'Поднимитесь по лестнице' : 'Спуститесь по лестнице');
      push(kind, `${verb} до ${formatFloor(cur.floor ?? 0)}`,
        prev.position, cur.position, d, hIn, hOut, segIdx, cur, cur.label);
    } else if (e.kind === 'enter-room') {
      push('arrive-room', `Войдите в ${cur.label ?? 'помещение'}`,
        prev.position, cur.position, d, hIn, hOut, segIdx, cur);
    } else if (e.kind === 'exit-building') {
      push('exit-building', 'Выйдите из здания',
        prev.position, cur.position, d, hIn, hOut, segIdx, cur);
    } else {
      const tk = turnKind(hOut - hIn);
      if (tk === 'straight') {
        push('straight', `Идите прямо ${formatDistance(d)}`,
          prev.position, cur.position, d, hIn, hOut, segIdx, cur);
      } else {
        const word = tk.includes('left') ? 'налево' : tk.includes('right') ? 'направо' : 'развернитесь';
        push(tk, `Поверните ${word}`, prev.position, cur.position, d, hIn, hOut, segIdx, cur);
      }
    }
  }

  const last = path[path.length - 1];
  const lastH = steps.length ? steps[steps.length - 1].headingOut : 0;
  push(last.buildingId ? 'finish' : 'arrive-outdoor', `Вы прибыли: ${toLabel}`,
    last.position, last.position, 0, lastH, lastH, Math.max(0, segments.length - 1), last);
  return steps;
}