/**
 * Campus Navigator 3D — сцена (Модель А).
 * Палитра «архитектурный макет в тёплом свете»: тёплый графит вместо голого
 * чёрного, приглушённое золото кантов, кремовый текст, мягкий объёмный свет,
 * виньетка по краям. Без кислотного неона.
 */
import { useMemo } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { OrbitControls, Html, Line } from '@react-three/drei';
import * as THREE from 'three';
import { useAppStore } from '../store/useAppStore';
import type { Building, NavEdge, NavNode, Room, Vec3 } from '../data/types';

/* ---------- палитра: тёплый графит + приглушённое золото ---------- */
const C = {
  bg: '#1b1b21',        // тёплый глубокий графит (не pure black)
  bgFar: '#23232b',     // дальний туман чуть светлее -> глубина
  ground: '#2a2a31',    // пол с синеватым подтоном
  groundLine: '#34343d',// едва заметная осевая дорог
  mass: '#33333b',      // тело корпуса — gunmetal
  massTop: '#3a3a43',   // верхняя грань чуть светлее (объём)
  edge: '#c9973f',      // приглушённое золото канта
  edgeSoft: '#8a6a2e',  // тусклый кант для неактивных
  label: '#f3e7cf',     // кремовый текст подписей
  labelBg: 'rgba(20,20,26,0.72)',
  road: '#3d3d46',      // асфальт тёплый серый
  roadLine: '#575760',  // светлая осевая
  route: '#ffcf6b',     // маршрут — мягкое золото со свечением
  routeGlow: '#ffe3a3',
  start: '#9fd8c0',     // мятный старт
  finish: '#ff9a76',    // коралловый финиш
  room: '#3a3a42',      // комната
  roomEdge: '#d8a94a',  // контур комнаты
  graph: '#6b5a33',     // отладочный граф — тусклый бронзовый
  field: '#3c4a39',     // стадион — приглушённый шалфей
  fieldLine: '#c9973f',
  plaza: '#30303a',     // площадь — чуть светлее пола
};

const toTuple = (v: Vec3): [number, number, number] => [v.x, v.y, v.z];
const dist2 = (a: Vec3, b: Vec3) => Math.hypot(b.x - a.x, b.z - a.z);

/* ---------- корпус: gunmetal-плита с золотым кантом ---------- */
function BuildingBox({ b }: { b: Building }) {
  const w = b.footprint.maxX - b.footprint.minX;
  const d = b.footprint.maxZ - b.footprint.minZ;
  const h = (b.levels.length || 1) * 3.2;
  const cx = (b.footprint.minX + b.footprint.maxX) / 2;
  const cz = (b.footprint.minZ + b.footprint.maxZ) / 2;
  const indoor = useAppStore((s) => s.viewMode === 'indoor');
  const active = useAppStore((s) => s.activeBuilding === b.id);
  const isLab = b.id === 'lab';
  const op = indoor ? (active ? 0.10 : 0.04) : (isLab ? 0.5 : 0.92);
  const eo = indoor ? (active ? 0.55 : 0.16) : (isLab ? 0.45 : 0.9);
  return (
    <group position={[cx, h / 2, cz]}>
      <mesh>
        <boxGeometry args={[w, h, d]} />
        <meshStandardMaterial color={C.mass} transparent opacity={op} roughness={0.78} metalness={0.12} />
      </mesh>
      {/* верхняя грань светлее — даёт ощущение объёма без额外 света */}
      <mesh position={[0, h / 2 - 0.02, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[w - 0.4, d - 0.4]} />
        <meshStandardMaterial color={C.massTop} transparent opacity={op * 0.9} roughness={0.7} />
      </mesh>
      <lineSegments>
        <edgesGeometry args={[new THREE.BoxGeometry(w, h, d)]} />
        <lineBasicMaterial color={active ? C.edge : C.edgeSoft} transparent opacity={eo} />
      </lineSegments>
      {!indoor && (
        <Html position={[0, h / 2 + 1.6, 0]} center distanceFactor={175} zIndexRange={[10, 0]}>
          <div
            className="pointer-events-none whitespace-nowrap rounded-md border px-2 py-0.5 text-[11px] font-medium backdrop-blur"
            style={{ borderColor: 'rgba(201,151,63,0.35)', background: C.labelBg, color: C.label }}
          >
            {b.shortName}
          </div>
        </Html>
      )}
    </group>
  );
}

function StadiumField() {
  return (
    <group position={[65, 0, -182]}>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.05, 0]}>
        <circleGeometry args={[60, 56]} />
        <meshStandardMaterial color={C.field} roughness={1} />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.06, 0]}>
        <ringGeometry args={[52, 55, 56]} />
        <meshBasicMaterial color={C.fieldLine} transparent opacity={0.45} />
      </mesh>
      <Html position={[0, 2, 0]} center distanceFactor={210} zIndexRange={[8, 0]}>
        <div className="pointer-events-none whitespace-nowrap rounded-md border px-2 py-0.5 text-[11px] font-medium backdrop-blur"
          style={{ borderColor: 'rgba(201,151,63,0.3)', background: C.labelBg, color: C.label }}>
          Стадион МИЭТ
        </div>
      </Html>
    </group>
  );
}

function PlazaSpot() {
  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[105, 0.04, -45]}>
      <circleGeometry args={[42, 48]} />
      <meshStandardMaterial color={C.plaza} roughness={0.95} />
    </mesh>
  );
}

/* ---------- дороги: полилинии-аллеи + тонкие отводы к дверям ---------- */
function Roads({ nodes, edges, paths }: { nodes: NavNode[]; edges: NavEdge[]; paths: { nodeIds: string[]; width: number }[] }) {
  const byId = useMemo(() => new Map(nodes.map((n) => [n.id, n])), [nodes]);
  const mains = useMemo(() => paths.map((pt) => {
    const pts: [number, number, number][] = [];
    for (const id of pt.nodeIds) { const n = byId.get(id); if (n) pts.push([n.position.x, 0.12, n.position.z]); }
    return pts;
  }), [byId, paths]);
  const taps = useMemo(() => {
    const out: [number, number, number][][] = [];
    for (const e of edges) {
      const a = byId.get(e.from), b = byId.get(e.to);
      if (!a || !b) continue;
      if (dist2(a.position, b.position) > 50) continue;
      if (a.type === 'door-outdoor' || b.type === 'door-outdoor')
        out.push([[a.position.x, 0.1, a.position.z], [b.position.x, 0.1, b.position.z]]);
    }
    return out;
  }, [byId, edges]);
  return (
    <group>
      {mains.map((s, i) => s.length > 1 && (
        <Line key={'m' + i} points={s} color={C.road} lineWidth={5} transparent opacity={0.9} />
      ))}
      {mains.map((s, i) => s.length > 1 && (
        <Line key={'ml' + i} points={s.map((p) => [p[0], p[1] + 0.02, p[2]] as [number, number, number])} color={C.roadLine} lineWidth={1} transparent opacity={0.5} />
      ))}
      {taps.map((s, i) => <Line key={'t' + i} points={s} color={C.road} lineWidth={2.5} transparent opacity={0.7} />)}
    </group>
  );
}

function IndoorRooms({ rooms, floor, buildingId }: { rooms: Room[]; floor: number; buildingId: string }) {
  const list = useMemo(() => rooms.filter((r) => r.floor === floor && r.buildingId === buildingId), [rooms, floor, buildingId]);
  return (
    <group>
      {list.map((r) => {
        const w = r.rect.maxX - r.rect.minX, d = r.rect.maxZ - r.rect.minZ;
        const cx = (r.rect.minX + r.rect.maxX) / 2, cz = (r.rect.minZ + r.rect.maxZ) / 2;
        const y = floor * 3.2 + 0.15;
        return (
          <group key={r.id} position={[cx, y, cz]}>
            <mesh rotation={[-Math.PI / 2, 0, 0]}>
              <planeGeometry args={[w, d]} />
              <meshStandardMaterial color={C.room} transparent opacity={0.62} side={THREE.DoubleSide} roughness={0.9} />
            </mesh>
            <lineSegments rotation={[-Math.PI / 2, 0, 0]}>
              <edgesGeometry args={[new THREE.PlaneGeometry(w, d)]} />
              <lineBasicMaterial color={C.roomEdge} transparent opacity={0.8} />
            </lineSegments>
            <Html center distanceFactor={72} zIndexRange={[5, 0]}>
              <div className="pointer-events-none whitespace-nowrap rounded px-1.5 py-0.5 text-[10px] font-semibold"
                style={{ background: 'rgba(216,169,74,0.18)', color: '#f3e7cf' }}>
                {r.number}
              </div>
            </Html>
          </group>
        );
      })}
    </group>
  );
}

function RouteLayer() {
  const route = useAppStore((s) => s.route);
  const showGraph = useAppStore((s) => s.showGraph);
  const campus = useAppStore((s) => s.campus);
  const pts = useMemo(() => (route ? route.points.map(toTuple) : []), [route]);
  const dbg = useMemo(() => {
    if (!showGraph) return [] as [number, number, number][][];
    const byId = new Map(campus.nodes.map((n) => [n.id, n]));
    const out: [number, number, number][][] = [];
    for (const e of campus.edges) {
      const a = byId.get(e.from), b = byId.get(e.to);
      if (!a || !b) continue;
      if (dist2(a.position, b.position) > 120) continue;
      out.push([toTuple(a.position), toTuple(b.position)]);
    }
    return out;
  }, [showGraph, campus]);
  if (!route) return null;
  const start = route.points[0], end = route.points[route.points.length - 1];
  return (
    <group>
      {/* внешнее свечение маршрута */}
      {pts.length > 1 && <Line points={pts} color={C.routeGlow} lineWidth={9} transparent opacity={0.18} />}
      {pts.length > 1 && <Line points={pts} color={C.route} lineWidth={4.5} transparent opacity={0.98} />}
      {dbg.map((s, i) => <Line key={'g' + i} points={s} color={C.graph} lineWidth={1} transparent opacity={0.4} />)}
      <mesh position={[start.x, start.y + 0.6, start.z]}>
        <sphereGeometry args={[0.9, 20, 20]} />
        <meshStandardMaterial color={C.start} emissive={C.start} emissiveIntensity={0.4} roughness={0.4} />
      </mesh>
      <mesh position={[end.x, end.y + 0.6, end.z]}>
        <sphereGeometry args={[1.2, 20, 20]} />
        <meshStandardMaterial color={C.finish} emissive={C.finish} emissiveIntensity={0.5} roughness={0.4} />
      </mesh>
      <Html position={[end.x, end.y + 3.2, end.z]} center distanceFactor={82} zIndexRange={[20, 0]}>
        <div className="pointer-events-none whitespace-nowrap rounded-lg border px-2 py-1 text-xs font-bold backdrop-blur"
          style={{ borderColor: 'rgba(255,154,118,0.4)', background: 'rgba(255,154,118,0.16)', color: '#ffe9df' }}>
          {route.toLabel}
        </div>
      </Html>
    </group>
  );
}

function FlightCamera() {
  const { camera } = useThree();
  useFrame((_, delta) => {
    const st = useAppStore.getState();
    if (st.animState !== 'playing' || !st.route) return;
    st.tickAnim(delta * st.animSpeed);
    const r = st.route, n = r.points.length;
    if (n < 2) return;
    const p = Math.min(1, st.animTime / Math.max(0.001, r.durationSec));
    const fi = p * (n - 1), i = Math.floor(fi), f = fi - i;
    const a = r.points[i], b = r.points[Math.min(i + 1, n - 1)], nx = r.points[Math.min(i + 2, n - 1)];
    camera.position.set(a.x + (b.x - a.x) * f, a.y + (b.y - a.y) * f + 3.0, a.z + (b.z - a.z) * f);
    camera.lookAt(nx.x, nx.y + 1.2, nx.z);
  });
  return null;
}

function Compass() {
  return (
    <div className="pointer-events-none absolute right-4 top-20 flex flex-col items-center gap-1">
      <svg width="46" height="46" viewBox="0 0 44 44" style={{ filter: 'drop-shadow(0 2px 6px rgba(0,0,0,0.5))' }}>
        <circle cx="22" cy="22" r="20" fill="rgba(20,20,26,0.7)" stroke="#c9973f" strokeWidth="1.2" />
        <polygon points="22,7 26,22 22,19 18,22" fill="#e0b050" />
        <polygon points="22,37 18,22 22,25 26,22" fill="#4a4a52" />
        <text x="22" y="6" textAnchor="middle" fontSize="6.5" fill="#f3e7cf" fontWeight="bold">С</text>
      </svg>
      <div className="flex items-center gap-1 rounded border px-1.5 py-0.5 text-[9px] backdrop-blur"
        style={{ borderColor: 'rgba(201,151,63,0.3)', background: 'rgba(20,20,26,0.7)', color: '#f3e7cf' }}>
        <span className="inline-block h-[2px] w-[28px]" style={{ background: '#c9973f' }} /> 100 м
      </div>
    </div>
  );
}

const DIVE = [['b1', 'Корп. 1'], ['uk3', 'Корп. 3'], ['uk4', 'Корп. 4'], ['proton', 'Протон'], ['college', 'Колледж']];

function Overlay() {
  const route = useAppStore((s) => s.route);
  const routeError = useAppStore((s) => s.routeError);
  const animState = useAppStore((s) => s.animState);
  const viewMode = useAppStore((s) => s.viewMode);
  const showGraph = useAppStore((s) => s.showGraph);
  const activeBuilding = useAppStore((s) => s.activeBuilding);
  const campus = useAppStore((s) => s.campus);
  const act = () => useAppStore.getState();
  const btn = 'rounded-lg border px-3 py-1.5 text-xs font-medium backdrop-blur transition active:scale-95';
  const btnStyle = { borderColor: 'rgba(201,151,63,0.28)', background: 'rgba(30,30,38,0.78)', color: '#f3e7cf' } as const;
  const btnHover = 'hover:border-amber-500/40 hover:text-amber-100';
  const abName = activeBuilding ? campus.buildings.find((b) => b.id === activeBuilding)?.shortName : null;
  return (
    <div className="pointer-events-none absolute inset-0 flex flex-col justify-between p-4">
      {/* виньетка по краям для глубины */}
      <div className="pointer-events-none absolute inset-0" style={{ boxShadow: 'inset 0 0 180px 40px rgba(0,0,0,0.55)' }} />
      <div className="relative flex items-start justify-between">
        <div className="pointer-events-auto rounded-xl border px-4 py-3 backdrop-blur" style={{ borderColor: 'rgba(201,151,63,0.25)', background: 'rgba(24,24,30,0.82)' }}>
          <div className="text-sm font-bold tracking-wide" style={{ color: '#e8c87a' }}>Campus Navigator 3D</div>
          <div className="mt-0.5 text-[11px]" style={{ color: '#9a9aa2' }}>НИУ МИЭТ · пл. Шокина, 1 · корп. 1 по реальному плану</div>
        </div>
        <div className="pointer-events-auto flex flex-col items-end gap-2">
          <div className="flex gap-2">
            <button className={`${btn} ${btnHover}`} style={btnStyle} onClick={() => act().setViewMode(viewMode === 'campus' ? 'indoor' : 'campus')}>{viewMode === 'campus' ? 'Внутри' : 'Кампус'}</button>
            <button className={`${btn} ${btnHover}`} style={btnStyle} onClick={() => act().setShowGraph(!showGraph)}>Граф</button>
            <button className={`${btn} ${btnHover}`} style={btnStyle} onClick={() => act().resetCamera()}>Сброс камеры</button>
          </div>
          <div className="flex gap-1.5">
            {DIVE.map(([id, lb]) => (
              <button key={id} className={`${btn} ${btnHover}`}
                style={{ ...btnStyle, ...(activeBuilding === id && viewMode === 'indoor' ? { borderColor: 'rgba(224,176,80,0.6)', color: '#ffe9b8' } : {}) }}
                onClick={() => act().setActiveBuilding(id)}>{lb}</button>
            ))}
          </div>
        </div>
      </div>
      <div className="relative flex items-end justify-between gap-3">
        <div className="pointer-events-auto max-w-md rounded-xl border px-4 py-3 text-xs backdrop-blur" style={{ borderColor: 'rgba(201,151,63,0.25)', background: 'rgba(24,24,30,0.82)', color: '#cfcfd6' }}>
          {routeError ? <span style={{ color: '#ff9a76' }}>{routeError}</span>
            : route ? <span><span style={{ color: '#e8c87a' }}>{route.fromLabel}</span> → <span style={{ color: '#e8c87a' }}>{route.toLabel}</span> · {Math.round(route.distance)} м · {Math.round(route.durationSec)} с · шагов: {route.steps.length}{abName ? <span style={{ color: '#8a8a92' }}> · внутри: {abName}</span> : null}</span>
            : <span style={{ color: '#8a8a92' }}>«Демо‑маршрут»: остановка у главного входа → площадь → портал корпуса 1 → пандус/лестница → ректорат 1222. Кнопки «Корп. 1/3/4/Протон/Колледж» ныряют внутрь.</span>}
        </div>
        <div className="pointer-events-auto flex gap-2">
          <button className={`${btn} ${btnHover}`} style={{ ...btnStyle, borderColor: 'rgba(224,176,80,0.45)', color: '#ffe9b8' }} onClick={() => act().demoRun()}>Демо‑маршрут</button>
          {animState === 'playing' ? <button className={`${btn} ${btnHover}`} style={btnStyle} onClick={() => act().pause()}>Пауза</button> : <button className={`${btn} ${btnHover}`} style={btnStyle} onClick={() => act().play()}>Полёт</button>}
          <button className={`${btn} ${btnHover}`} style={btnStyle} onClick={() => act().resetAnim()}>Стоп</button>
        </div>
      </div>
    </div>
  );
}

export function Scene() {
  const campus = useAppStore((s) => s.campus);
  const viewMode = useAppStore((s) => s.viewMode);
  const activeFloor = useAppStore((s) => s.activeFloor);
  const activeBuilding = useAppStore((s) => s.activeBuilding);
  const animState = useAppStore((s) => s.animState);
  const resetTick = useAppStore((s) => s.cameraResetTick);
  const shownBuilding = activeBuilding ?? 'b1';
  return (
    <div className="relative h-full w-full" style={{ background: `radial-gradient(120% 120% at 50% 0%, ${C.bgFar} 0%, ${C.bg} 60%)` }}>
      <Canvas camera={{ position: [120, 160, 220], fov: 50 }} dpr={[1, 2]} gl={{ antialias: true }}>
        <color attach="background" args={[C.bg]} />
        <fog attach="fog" args={[C.bg, 240, 880]} />
        {/* тёплый ключевой свет + холодный заполняющий сверху = объём */}
        <ambientLight intensity={0.55} color="#fff4e0" />
        <directionalLight position={[140, 220, 90]} intensity={1.05} color="#ffe9c7" />
        <directionalLight position={[-120, 140, -60]} intensity={0.35} color="#bcd2ff" />
        <hemisphereLight args={['#e8d6b0', C.bg, 0.4]} />
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.05, 0]}>
          <planeGeometry args={[1600, 1600]} />
          <meshStandardMaterial color={C.ground} roughness={1} />
        </mesh>
        <PlazaSpot />
        <StadiumField />
        {campus.buildings.map((b) => <BuildingBox key={b.id} b={b} />)}
        <Roads nodes={campus.nodes} edges={campus.edges} paths={campus.paths} />
        {viewMode === 'indoor' && activeFloor != null && <IndoorRooms rooms={campus.rooms} floor={activeFloor} buildingId={shownBuilding} />}
        <RouteLayer />
        <FlightCamera />
        <OrbitControls key={resetTick} enabled={animState !== 'playing'} makeDefault minDistance={20} maxDistance={760} maxPolarAngle={Math.PI / 2.05} />
      </Canvas>
      <Compass />
      <Overlay />
    </div>
  );
}
export default Scene;