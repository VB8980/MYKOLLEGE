// Форматирование величин для интерфейса
export { formatDistance, formatDuration } from './geometry';

export function formatFloorName(floorId: string | null, floors: { id: string; name: string }[]): string {
  if (floorId == null) return 'Улица';
  return floors.find((f) => f.id === floorId)?.name ?? 'Этаж';
}

export function plural(n: number, one: string, few: string, many: string): string {
  const m10 = n % 10, m100 = n % 100;
  if (m10 === 1 && m100 !== 11) return one;
  if (m10 >= 2 && m10 <= 4 && (m100 < 12 || m100 > 14)) return few;
  return many;
}
