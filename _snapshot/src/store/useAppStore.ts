// ============================================================
// Глобальное состояние приложения (Zustand)
// ============================================================
import { create } from 'zustand';
import type { PlaceRef, Route } from '../data/types';
import { demoCampus } from '../data/demoCampus';
import { buildRoute, type RouteResult } from '../lib/router';
import { prepareRouteForDisplay } from '../lib/routeTransform';

export type ViewMode = 'campus' | 'indoor';
export type CameraMode = 'overview' | 'fly' | 'fpv';
export type AnimState = 'idle' | 'playing' | 'paused' | 'done';

interface AppState {
  // Данные
  campus: typeof demoCampus;
  buildingId: string;
  floorId: string;

  // Режим отображения
  viewMode: ViewMode;
  darkTheme: boolean;
  showAllFloors: boolean;
  isolateFloor: boolean;
  showGraph: boolean;
  avoidStairs: boolean;

  // Маршрут
  from: PlaceRef | null;
  to: PlaceRef | null;
  route: Route | null;
  routeError: string | null;
  activeStep: number;          // активный шаг анимации
  animProgress: number;        // 0..1 прогресс вдоль маршрута

  // Камера/анимация
  cameraMode: CameraMode;
  animState: AnimState;
  animSpeed: number;           // множитель скорости
  cameraResetTick: number;     // счётчик для команды "сбросить камеру"
  arrived: boolean;            // показывать "Вы прибыли"

  // Действия
  setBuilding: (id: string) => void;
  setFloor: (id: string) => void;
  setViewMode: (m: ViewMode) => void;
  setFrom: (p: PlaceRef | null) => void;
  setTo: (p: PlaceRef | null) => void;
  swapPoints: () => void;
  clearRoute: () => void;
  computeRoute: () => void;
  setCameraMode: (m: CameraMode) => void;
  play: () => void;
  pause: () => void;
  resume: () => void;
  resetAnim: () => void;
  setAnimSpeed: (s: number) => void;
  setAnimProgress: (t: number, distance: number) => void;
  toggleDark: () => void;
  setShowAllFloors: (v: boolean) => void;
  setIsolateFloor: (v: boolean) => void;
  setShowGraph: (v: boolean) => void;
  setAvoidStairs: (v: boolean) => void;
  resetCamera: () => void;
  demoRun: () => void;
}

export const useAppStore = create<AppState>((set, get) => ({
  campus: demoCampus,
  buildingId: demoCampus.buildings[0].id,
  floorId: demoCampus.buildings[0].floors[0].id,

  viewMode: 'campus',
  darkTheme: true,
  showAllFloors: false,
  isolateFloor: true,
  showGraph: false,
  avoidStairs: false,

  from: null,
  to: null,
  route: null,
  routeError: null,
  activeStep: -1,
  animProgress: 0,

  cameraMode: 'overview',
  animState: 'idle',
  animSpeed: 1,
  cameraResetTick: 0,
  arrived: false,

  setBuilding: (id) => {
    const b = get().campus.buildings.find((x) => x.id === id);
    set({ buildingId: id, floorId: b?.floors[0]?.id ?? get().floorId });
  },
  setFloor: (id) => set({ floorId: id }),
  setViewMode: (m) => set({ viewMode: m }),
  setFrom: (p) => set({ from: p }),
  setTo: (p) => set({ to: p }),
  swapPoints: () => {
    const { from, to } = get();
    set({ from: to, to: from });
    get().computeRoute();
  },
  clearRoute: () => set({ route: null, routeError: null, animState: 'idle', animProgress: 0, activeStep: -1, arrived: false, cameraMode: 'overview' }),
  computeRoute: () => {
    const { from, to, avoidStairs } = get();
    if (!from || !to) {
      set({ routeError: 'Выберите начальную и конечную точку.' });
      return;
    }
    const res: RouteResult = buildRoute(from, to, avoidStairs);
    if ('error' in res) {
      set({ route: null, routeError: res.error, animState: 'idle', arrived: false });
      return;
    }
    const r = res.route;
    // автовыбор этажа: первый внутренний этаж маршрута
    const firstFloor = r.floorsInvolved[0];
    set({
      route: r,
      routeError: null,
      animProgress: 0,
      activeStep: -1,
      arrived: false,
      animState: 'idle',
      ...(firstFloor ? { floorId: firstFloor, viewMode: 'indoor' } : {}),
    });
  },
  setCameraMode: (m) => set({ cameraMode: m, ...(m === 'fly' || m === 'fpv' ? { animState: get().route ? 'playing' : 'idle' } : {}) }),
  play: () => {
    if (!get().route) { get().computeRoute(); if (!get().route) return; }
    if (get().animState === 'done') set({ animProgress: 0, arrived: false, activeStep: -1 });
    set({ animState: 'playing', cameraMode: get().cameraMode === 'overview' ? 'fly' : get().cameraMode });
  },
  pause: () => set({ animState: 'paused' }),
  resume: () => set({ animState: 'playing' }),
  resetAnim: () => set({ animProgress: 0, activeStep: -1, arrived: false, animState: 'idle', cameraMode: 'overview', cameraResetTick: get().cameraResetTick + 1 }),
  setAnimSpeed: (s) => set({ animSpeed: s }),
  setAnimProgress: (t, distance) => {
    const st = get();
    const r = st.route;
    if (!r) return;
    let step = -1;
    for (let i = 0; i < r.steps.length; i++) if (distance >= r.steps[i].atDistance) step = i;
    const arrived = t >= 0.995;
    // автопереключение этажа по активной точке маршрута
    let newFloor = st.floorId;
    let newView = st.viewMode;
    const idx = Math.min(r.points.length - 1, Math.round(t * (r.points.length - 1)));
    const activePt = r.points[idx];
    if (activePt) {
      if (activePt.floorId === null) newView = 'campus';
      else { newFloor = activePt.floorId; newView = 'indoor'; }
    }
    set({
      animProgress: t,
      activeStep: step,
      arrived: arrived || st.arrived,
      floorId: newFloor,
      viewMode: newView,
      ...(arrived ? { animState: 'done' as AnimState } : {}),
    });
  },
  toggleDark: () => set({ darkTheme: !get().darkTheme }),
  setShowAllFloors: (v) => set({ showAllFloors: v, ...(v ? { isolateFloor: false } : {}) }),
  setIsolateFloor: (v) => set({ isolateFloor: v, ...(v ? { showAllFloors: false } : {}) }),
  setShowGraph: (v) => set({ showGraph: v }),
  setAvoidStairs: (v) => { set({ avoidStairs: v }); if (get().route) get().computeRoute(); },
  resetCamera: () => set({ cameraResetTick: get().cameraResetTick + 1, animState: 'idle', cameraMode: 'overview' }),

  // Демонстрационный режим: сам строит и проигрывает маршрут от входа колледжа до лаборатории 204
  demoRun: () => {
    set({
      from: { kind: 'outdoor', id: 'n_bus_stop', name: 'Остановка «МИЭТ»' },
      to: { kind: 'room', id: 'lab_204', buildingId: 'college', name: 'Лаборатория 204' },
      viewMode: 'campus',
    });
    get().computeRoute();
    set({ animProgress: 0, arrived: false, activeStep: -1, cameraMode: 'fly', animState: 'playing' });
  },
}));

/** Точки маршрута в мировых координатах для текущей камеры/линии */
export function displayedRoutePoints(): ReturnType<typeof prepareRouteForDisplay> {
  const { route, viewMode } = useAppStore.getState();
  if (!route) return [];
  return prepareRouteForDisplay(route, viewMode);
}
