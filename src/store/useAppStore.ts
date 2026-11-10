// ============================================================
// Глобальное состояние (Zustand) — Модель А + активное здание для indoor
// ============================================================
import { create } from 'zustand';
import type { Place, Route } from '../data/types';
import { DEMO_CAMPUS } from '../data/demoCampus';
import { buildGraph, type Graph } from '../lib/graph';
import { findPath } from '../lib/astar';
import { transformRoute } from '../lib/routeTransform';
import { buildSearchIndex, createSearcher, searchLocations } from '../lib/search';

export type ViewMode = 'campus' | 'indoor';
export type CameraMode = 'overview' | 'fly' | 'fpv';
export type AnimState = 'idle' | 'playing' | 'paused' | 'done';

const campus = DEMO_CAMPUS;
const graph: Graph = buildGraph(campus);
const searchIndex = buildSearchIndex(campus);
export const searcher = createSearcher(searchIndex);

interface AppState {
  campus: typeof DEMO_CAMPUS;
  graph: Graph;
  searchIndex: Place[];

  viewMode: ViewMode;
  darkTheme: boolean;
  showAllFloors: boolean;
  isolateFloor: boolean;
  showGraph: boolean;
  avoidStairs: boolean;
  activeFloor: number | null;
  activeBuilding: string | null;

  from: Place | null;
  to: Place | null;
  route: Route | null;
  routeError: string | null;

  cameraMode: CameraMode;
  animState: AnimState;
  animSpeed: number;
  animTime: number;
  activeStep: number;
  arrived: boolean;
  cameraResetTick: number;

  // Сигнатуры методов (только типы, без реализаций)
  setFrom: (p: Place | null) => void;
  setTo: (p: Place | null) => void;
  swapPoints: () => void;
  clearRoute: () => void;
  computeRoute: () => void;
  setViewMode: (m: ViewMode) => void;
  setActiveFloor: (f: number | null) => void;
  setActiveBuilding: (id: string | null) => void;
  setCameraMode: (m: CameraMode) => void;
  play: () => void;
  pause: () => void;
  resume: () => void;
  resetAnim: () => void;
  setAnimSpeed: (s: number) => void;
  tickAnim: (dt: number) => void;
  toggleDark: () => void;
  setShowAllFloors: (v: boolean) => void;
  setIsolateFloor: (v: boolean) => void;
  setShowGraph: (v: boolean) => void;
  setAvoidStairs: (v: boolean) => void;
  resetCamera: () => void;
  search: (q: string) => Place[];
  demoRun: () => void;
}

export const useAppStore = create<AppState>((set, get) => ({
  campus, graph, searchIndex,

  viewMode: 'campus',
  darkTheme: true,
  showAllFloors: false,
  isolateFloor: true,
  showGraph: false,
  avoidStairs: false,
  activeFloor: 0,
  activeBuilding: null,

  from: null, to: null, route: null, routeError: null,

  cameraMode: 'overview',
  animState: 'idle',
  animSpeed: 1,
  animTime: 0,
  activeStep: -1,
  arrived: false,
  cameraResetTick: 0,

  // Реализации методов
  setFrom: (p) => set({ from: p, route: null, routeError: null }),
  setTo: (p) => set({ to: p, route: null, routeError: null }),
  swapPoints: () => { const { from, to } = get(); set({ from: to, to: from, route: null }); get().computeRoute(); },
  clearRoute: () => set({ route: null, routeError: null, animState: 'idle', animTime: 0, activeStep: -1, arrived: false, cameraMode: 'overview', activeBuilding: null }),

  computeRoute: () => {
    const { from, to } = get();
    if (!from || !to) { set({ routeError: 'Выберите начальную и конечную точку.' }); return; }
    if (from.id === to.id) { set({ routeError: 'Начало и конец совпадают.' }); return; }
    const found = findPath(get().graph, from.id, to.id);
    if (!found) { set({ route: null, routeError: 'Маршрут между точками не найден.' }); return; }
    const route = transformRoute(found.path, found.edges, from, to);
    const firstFloor = route.floorsVisited[0] ?? null;
    const ab = to.category === 'room' ? to.buildingId ?? null : from.category === 'room' ? from.buildingId ?? null : null;
    set({
      route, routeError: null, animTime: 0, activeStep: -1, arrived: false, animState: 'idle',
      activeBuilding: ab,
      ...(firstFloor != null ? { activeFloor: firstFloor, viewMode: 'indoor' as ViewMode } : {}),
    });
  },

  setViewMode: (m) => set({ viewMode: m }),
  setActiveFloor: (f) => set({ activeFloor: f }),
  setActiveBuilding: (id) => set({ activeBuilding: id, viewMode: id ? 'indoor' : 'campus' }),
  setCameraMode: (m) => set({ cameraMode: m }),
  play: () => {
    if (!get().route) { get().computeRoute(); if (!get().route) return; }
    if (get().animState === 'done') set({ animTime: 0, arrived: false, activeStep: -1 });
    set({ animState: 'playing', cameraMode: get().cameraMode === 'overview' ? 'fly' : get().cameraMode });
  },
  pause: () => set({ animState: 'paused' }),
  resume: () => set({ animState: 'playing' }),
  resetAnim: () => set({ animTime: 0, activeStep: -1, arrived: false, animState: 'idle', cameraMode: 'overview', cameraResetTick: get().cameraResetTick + 1 }),
  setAnimSpeed: (s) => set({ animSpeed: s }),

  tickAnim: (dt) => {
    const st = get(); const r = st.route;
    if (!r || st.animState !== 'playing') return;
    const t = st.animTime + dt;
    const end = r.durationSec;
    let step = -1;
    for (let i = 0; i < r.steps.length; i++) if (t >= r.steps[i].tStart) step = i;
    const cur = r.steps[step];
    const newFloor = cur?.floor ?? st.activeFloor;
    const newView: ViewMode = cur?.buildingId ? 'indoor' : 'campus';
    const arrived = t >= end;
    set({
      animTime: Math.min(t, end), activeStep: step, arrived: arrived || st.arrived,
      activeFloor: newFloor, viewMode: newView,
      ...(cur?.buildingId ? { activeBuilding: cur.buildingId } : {}),
      ...(arrived ? { animState: 'done' as AnimState } : {}),
    });
  },

  toggleDark: () => set({ darkTheme: !get().darkTheme }),
  setShowAllFloors: (v) => set({ showAllFloors: v, ...(v ? { isolateFloor: false } : {}) }),
  setIsolateFloor: (v) => set({ isolateFloor: v, ...(v ? { showAllFloors: false } : {}) }),
  setShowGraph: (v) => set({ showGraph: v }),
  setAvoidStairs: (v) => { set({ avoidStairs: v }); if (get().route) get().computeRoute(); },
  resetCamera: () => set({ cameraResetTick: get().cameraResetTick + 1, animState: 'idle', cameraMode: 'overview' }),
  search: (q) => searchLocations(searcher, q),

  // Сквозное демо по РЕАЛЬНОМУ плану корпуса 1
  demoRun: () => {
    set({
      from: { id: 'sun4', name: 'Остановка «Главный вход»', category: 'outdoor' },
      to: { id: 'si.b1.room.rectorate', name: 'Ректорат (ауд. 1222)', category: 'room', buildingId: 'b1', floor: 1 },
      viewMode: 'campus',
    });
    get().computeRoute();
    set({ animTime: 0, arrived: false, activeStep: -1, cameraMode: 'fly', animState: 'playing' });
  },
}));