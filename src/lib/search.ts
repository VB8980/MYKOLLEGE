// Нечёткий поиск комнат, узлов и уличных объектов через fuse.js
import Fuse from 'fuse.js';
import { demoCampus } from '../data/demoCampus';
import { getOutdoorData, buildingEntranceNode } from '../data/campusOutdoor';
import type { PlaceRef } from '../data/types';

export interface SearchResult {
  place: PlaceRef;
  subtitle: string;
  group: 'Помещения' | 'Корпуса и вход' | 'Улица';
}

function buildIndex(): SearchResult[] {
  const items: SearchResult[] = [];
  // Комнаты внутренних зданий
  for (const b of demoCampus.buildings) {
    for (const r of b.rooms) {
      if (r.type === 'corridor') continue; // коридоры не ищем как цели — они и так часть пути
      const floor = b.floors.find((f) => f.id === r.floorId);
      items.push({
        place: { kind: 'room', id: r.id, buildingId: b.id, name: r.name },
        subtitle: `${b.name} · ${floor?.name ?? ''}`,
        group: 'Помещения',
      });
    }
    for (const n of b.nodes) {
      if (n.type === 'entrance' || n.type === 'stairs' || n.type === 'poi') {
        items.push({
          place: { kind: 'node', id: n.id, buildingId: b.id, name: n.label ?? n.id },
          subtitle: b.name,
          group: 'Помещения',
        });
      }
    }
  }
  // Уличные здания (входы)
  const outdoor = getOutdoorData();
  for (const ob of outdoor.buildings) {
    if (ob.id === 'stadium') continue;
    items.push({
      place: { kind: 'building-entrance', id: buildingEntranceNode[ob.id] ?? ob.id, buildingId: ob.id, name: `Вход: ${ob.name}` },
      subtitle: ob.address ?? '',
      group: 'Корпуса и вход',
    });
  }
  // Уличные узлы
  for (const n of outdoor.nodes) {
    items.push({
      place: { kind: 'outdoor', id: n.id, name: n.label },
      subtitle: 'Уличный маршрут',
      group: 'Улица',
    });
  }
  return items;
}

const allItems = buildIndex();
const fuse = new Fuse(allItems, {
  keys: [{ name: 'place.name', weight: 2 }, { name: 'subtitle', weight: 0.5 }],
  threshold: 0.42,
  ignoreLocation: true,
  minMatchCharLength: 1,
});

/** Поиск с учётом русского языка: "лаборатория", "204", "туалет", "лестница", "вход" */
export function searchPlaces(query: string, limit = 8): SearchResult[] {
  const q = query.trim().toLowerCase();
  if (!q) return [];
  const res = fuse.search(q, { limit });
  return res.map((r) => r.item);
}

/** Все уличные точки для выпадающего списка "Кампус" */
export function outdoorPlaces(): SearchResult[] {
  return allItems.filter((i) => i.group !== 'Помещения');
}
