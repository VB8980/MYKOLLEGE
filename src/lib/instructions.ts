// Генерация пошаговых инструкций на русском языке
import type { Building, RoutePoint, RouteStep } from '../data/types';
import type { OutdoorNode } from '../data/campusOutdoor';
import { signedAngleDeg } from './geometry';

const num = (n: number) => Math.round(n);

/**
 * Инструкции по внутренней части маршрута.
 * points — 3D-точки маршрута (уже с учётом этажей), nodeIds — id узлов.
 */
export function indoorInstructions(
  b: Building,
  pts: RoutePoint[],
  startLabel: string,
  endLabel: string,
): RouteStep[] {
  const steps: RouteStep[] = [];
  if (pts.length < 2) return [{ text: `Вы уже на месте: ${endLabel}`, floorId: pts[0]?.floorId ?? null, atDistance: 0 }];

  const nodeById = new Map(b.nodes.map((n) => [n.id, n]));
  const roomByNodeId = new Map<string, string>(); // nodeId -> имя комнаты через дверь
  for (const d of b.doors) {
    const room = b.rooms.find((r) => r.id === d.roomId);
    if (room) roomByNodeId.set(d.nodeId, room.name);
  }

  steps.push({ text: `Начните движение: ${startLabel}`, floorId: pts[0].floorId, atDistance: 0 });

  let acc = 0;
  let prevDir: [number, number] | null = null;

  for (let i = 1; i < pts.length; i++) {
    const a = pts[i - 1], c = pts[i];
    const segLen = Math.hypot(c.x - a.x, c.z - a.z, c.y - a.y);
    acc += segLen;

    // Переход между этажами (лестница)
    if (a.floorId !== c.floorId && a.floorId != null && c.floorId != null) {
      const fl = b.floors.find((f) => f.id === c.floorId);
      const goingUp = (fl?.level ?? 0) > (b.floors.find((f) => f.id === a.floorId)?.level ?? 0);
      steps.push({
        text: `${goingUp ? 'Поднимитесь' : 'Спуститесь'} по лестнице на ${fl?.name ?? 'другой этаж'}`,
        floorId: c.floorId, atDistance: acc,
      });
      prevDir = null;
      continue;
    }

    const dx = c.x - a.x, dz = c.z - a.z;
    if (Math.hypot(dx, dz) < 0.05) continue;
    const dir: [number, number] = [dx, dz];

    // Поворот?
    if (prevDir) {
      const ang = signedAngleDeg(prevDir[0], prevDir[1], dir[0], dir[1]);
      if (Math.abs(ang) > 45) {
        steps.push({ text: ang > 0 ? 'Поверните направо' : 'Поверните налево', floorId: c.floorId, atDistance: acc });
      }
    }

    // Ориентир-комната рядом с узлом (дверь)
    const landmark = roomByNodeId.get(c.nodeId);
    // Тип узла назначения
    const node = nodeById.get(c.nodeId);
    const isLast = i === pts.length - 1;

    if (isLast) {
      if (node?.type === 'door') {
        const rm = roomByNodeId.get(c.nodeId);
        steps.push({ text: `Войдите через дверь${rm ? ` — ${rm}` : ''}`, floorId: c.floorId, atDistance: acc });
      } else {
        steps.push({ text: `Вы прибыли: ${endLabel}`, floorId: c.floorId, atDistance: acc });
      }
    } else if (landmark && node?.type === 'door') {
      steps.push({ text: `Пройдите мимо кабинета «${landmark}»`, floorId: c.floorId, atDistance: acc });
    } else if (segLen > 6) {
      const corrName = b.rooms.find((r) => r.floorId === c.floorId && r.type === 'corridor')?.name;
      steps.push({
        text: `Идите прямо${corrName ? ` по ${corrName.toLowerCase()}` : ''} ${num(segLen)} метров`,
        floorId: c.floorId, atDistance: acc,
      });
    }
    prevDir = dir;
  }

  // Финальный шаг "X будет справа/слева" — упрощённо добавляем к последнему сегменту
  const last = pts[pts.length - 1], secondLast = pts[pts.length - 2];
  if (secondLast && last.floorId != null) {
    const dx = last.x - secondLast.x, dz = last.z - secondLast.z;
    const side = dz >= 0 ? 'справа' : 'слева'; // для движения вдоль коридора с Z=-12 на север
    if (Math.hypot(dx, dz) > 1) {
      steps.push({ text: `${endLabel} находится ${side} от вас`, floorId: last.floorId, atDistance: acc });
    }
  }
  return steps;
}

/** Инструкции для уличной части маршрута */
export function outdoorInstructions(
  pathIds: string[],
  nodeById: Map<string, OutdoorNode>,
  edgeDist: (a: string, b: string) => number,
  startLabel: string,
  targetBuildingName?: string,
): RouteStep[] {
  const steps: RouteStep[] = [];
  if (pathIds.length === 0) return steps;
  steps.push({ text: `Начните движение: ${startLabel}`, floorId: null, atDistance: 0 });

  let acc = 0;
  let prevDir: [number, number] | null = null;
  for (let i = 1; i < pathIds.length; i++) {
    const a = nodeById.get(pathIds[i - 1])!, c = nodeById.get(pathIds[i])!;
    const len = edgeDist(a.id, c.id);
    acc += len;
    const dir: [number, number] = [c.pos[0] - a.pos[0], c.pos[1] - a.pos[1]];
    if (prevDir) {
      const ang = signedAngleDeg(prevDir[0], prevDir[1], dir[0], dir[1]);
      if (Math.abs(ang) > 45) steps.push({ text: ang > 0 ? 'На улице поверните направо' : 'На улице поверните налево', floorId: null, atDistance: acc });
    }
    // Особые узлы
    if (c.id === 'n_alley') {
      steps.push({ text: 'Перейдите Солнечную аллею по пешеходному переходу', floorId: null, atDistance: acc });
    } else if (c.id === 'n_square') {
      steps.push({ text: `Пройдите по Площади Шокина (${num(len)} м)`, floorId: null, atDistance: acc });
    } else if (i === pathIds.length - 1 && targetBuildingName) {
      steps.push({ text: `Войдите в ${targetBuildingName}`, floorId: null, atDistance: acc });
    } else {
      steps.push({ text: `Идите по дорожке ${num(len)} м → ${c.label}`, floorId: null, atDistance: acc });
    }
    prevDir = dir;
  }
  return steps;
}
