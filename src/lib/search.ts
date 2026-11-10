/** Нечёткий поиск локаций -> Place (id = узел графа, до которого строим путь). */
import Fuse from 'fuse.js';
import type { CampusData, Place } from '../data/types';
import { formatFloor } from './format';

export function buildSearchIndex(campus: CampusData): Place[] {
  const out: Place[] = [];
  const bName = (id?: string) => campus.buildings.find((b) => b.id === id)?.shortName ?? '';

  for (const room of campus.rooms) {
    const anchor = room.doorNodes[0];
    if (!anchor) continue;
    out.push({
      id: anchor, name: room.name, category: 'room',
      floor: room.floor, buildingId: room.buildingId,
      description: `${bName(room.buildingId)}, каб. ${room.number}, ${formatFloor(room.floor)}`,
    });
  }
  for (const b of campus.buildings) {
    const door = campus.doors.find((d) => d.buildingId === b.id);
    if (!door) continue;
    out.push({ id: door.outdoorNode, name: b.shortName, category: 'building', description: 'вход в здание' });
  }
  for (const n of campus.nodes) {
    if (!n.label || n.type === 'room') continue;
    out.push({
      id: n.id, name: n.label, category: 'outdoor',
      description: (n.type === 'street' || n.type === 'plaza') ? 'на улице' : 'внутри здания',
    });
  }
  return out;
}

export function createSearcher(items: Place[]): Fuse<Place> {
  return new Fuse(items, {
    keys: [{ name: 'name', weight: 0.7 }, { name: 'description', weight: 0.3 }],
    threshold: 0.4, ignoreLocation: true,
  });
}

export function searchLocations(searcher: Fuse<Place>, query: string, limit = 8): Place[] {
  const q = query.trim();
  if (!q) return [];
  return searcher.search(q, { limit }).map((r) => r.item);
}