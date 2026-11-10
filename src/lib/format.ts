/**
 * format.ts — функции форматирования величин для интерфейса.
 * Русские подписи: расстояния, время, этажи. Без внешних зависимостей.
 */

/** Форматирование расстояния: < 1000 м → «150 м», >= 1000 м → «1.2 км». */
export function formatDistance(meters: number): string {
  if (!Number.isFinite(meters) || meters < 0) return '0 м';
  if (meters < 1000) {
    // Короткие отрезки показываем целыми метрами (округление до 1 м).
    return `${Math.max(1, Math.round(meters))} м`;
  }
  // Километры — с одним знаком после точки.
  const km = meters / 1000;
  return `${km.toFixed(1)} км`;
}

/** Форматирование времени: < 60 сек → «30 сек», 60–119 → «1 мин», >= 120 → «N мин». */
export function formatTime(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return '0 сек';
  if (seconds < 60) return `${Math.max(1, Math.round(seconds))} сек`;
  // Меньше двух минут всегда называем «1 мин» (как принято в навигаторах).
  if (seconds < 120) return '1 мин';
  return `${Math.round(seconds / 60)} мин`;
}

/** Подпись этажа по его уровню: 1 → «1 этаж», -1 → «Подземный этаж». */
export function formatFloor(level: number): string {
  if (level < 0) return 'Подземный этаж';
  return `${level} этаж`;
}
