/**
 * Кодирование/декодирование номеров аудиторий МИЭТ.
 * 1-я цифра = номер корпуса, 2-я = этаж (1-based), далее 2 цифры = аудитория,
 * возможен суффикс «а»/«б». Примеры: 4203 -> корп.4, этаж2, ауд.03;
 * 1222 -> корп.1, этаж2, ауд.22 (ректорат, подтверждено miet.ru).
 */
export const BUILDING_NUMBER: Record<string, number> = {
  b1: 1, dk: 2, uk3: 3, uk4: 4, sport: 5, proton: 6, college: 8,
  // lab (лабораторный, =корп.7) и gnc НЕ в нумерации аудиторий: не учебные цели.
};

export interface RoomCode { building: number; floor: number; room: number; suffix?: string; }

export function formatRoomCode(c: RoomCode): string {
  const base = `${c.building}${c.floor}${String(c.room).padStart(2, '0')}`;
  return c.suffix ? base + c.suffix : base;
}
export function parseRoomCode(code: string): RoomCode | null {
  const m = /^([1-9])(\d)(\d{2})([а-яa-z]?)$/i.exec(code.trim());
  if (!m) return null;
  return { building: +m[1], floor: +m[2], room: +m[3], suffix: m[4] ? m[4].toLowerCase() : undefined };
}
export function describeRoomCode(code: string): string {
  const c = parseRoomCode(code);
  if (!c) return code;
  return `Корпус ${c.building}, ${c.floor} этаж, ауд. ${String(c.room).padStart(2, '0')}${c.suffix ?? ''}`;
}