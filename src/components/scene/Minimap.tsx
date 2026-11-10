// 2D мини-карта: в режиме "Кампус" — весь кампус; в режиме здания — текущий этаж.
import React, { useMemo } from 'react';
import { useAppStore } from '../store/useAppStore';
import { getOutdoorData, buildingEntranceNode } from '../data/campusOutdoor';
import { prepareRouteForDisplay } from '../lib/routeTransform';
import { COLLEGE_WORLD_OFFSET } from '../lib/router';
import { INDOOR_SCALE } from '../lib/routeTransform';
import { demoCampus } from '../data/demoCampus';

const ROOM_COLORS: Record<string, string> = {
  classroom: '#5eead4', lab: '#a78bfa', hall: '#93c5fd', corridor: '#334155',
  stairs: '#fbbf24', toilet: '#6ee7b7', wardrobe: '#f0abfc', entrance: '#38bdf8', other: '#64748b',
};

export function Minimap() {
  const viewMode = useAppStore((s) => s.viewMode);
  const floorId = useAppStore((s) => s.floorId);
  const route = useAppStore((s) => s.route);
  const progress = useAppStore((s) => s.animProgress);

  const pts = useMemo(() => (route ? prepareRouteForDisplay(route, viewMode) : []), [route, viewMode]);
  const cur = pts.length ? pts[Math.min(pts.length - 1, Math.round(progress * (pts.length - 1)))] : null;

  // ---------- Кампус ----------
  if (viewMode === 'campus') {
    const data = getOutdoorData();
    const W = 260, H = 260;
    const bounds = { minX: -420, maxX: 400, minZ: -460, maxZ: 420 };
    const sx = W / (bounds.maxX - bounds.minX);
    const sz = H / (bounds.maxZ - bounds.minZ);
    const px = (x: number) => (x - bounds.minX) * sx;
    const pz = (z: number) => (z - bounds.minZ) * sz;
    return (
      <div className="absolute bottom-4 right-4 rounded-2xl bg-slate-900/80 backdrop-blur border border-slate-700/60 shadow-2xl p-2">
        <div className="text-[10px] text-slate-400 px-1 pb-1">Кампус МИЭТ</div>
        <svg width={W} height={H} className="rounded-lg">
          <rect width={W} height={H} fill="#0b1322" />
          {/* дороги */}
          <line x1={px(-390)} y1={pz(415)} x2={px(160)} y2={pz(115)} stroke="#334155" strokeWidth={5} strokeDasharray="6 4" />
          <line x1={px(345)} y1={pz(-400)} x2={px(345)} y2={pz(360)} stroke="#334155" strokeWidth={5} strokeDasharray="6 4" />
          {/* дорожки графа */}
          {data.edges.map(([a, b], i) => {
            const na = data.nodes.find((n) => n.id === a), nb = data.nodes.find((n) => n.id === b);
            if (!na || !nb) return null;
            return <line key={i} x1={px(na.pos[0])} y1={pz(na.pos[1])} x2={px(nb.pos[0])} y2={pz(nb.pos[1])} stroke="#155e75" strokeWidth={1.4} strokeDasharray="3 2" />;
          })}
          {/* здания */}
          {data.buildings.map((b) =>
            b.id === 'stadium' ? (
              <ellipse key={b.id} cx={px(b.center[0])} cy={pz(b.center[1])} rx={(b.size[0] / 2) * sx} ry={(b.size[1] / 2) * sz} fill="#14532d" stroke="#22c55e" strokeWidth={1} />
            ) : (
              <rect key={b.id} x={px(b.center[0] - b.size[0] / 2)} y={pz(b.center[1] - b.size[1] / 2)}
                width={b.size[0] * sx} height={b.size[1] * sz}
                fill={b.id === 'b1' ? '#7f3f31' : b.id === 'b8' ? '#2f6b52' : '#3b4a63'}
                stroke="#64748b" strokeWidth={0.8} rx={2} />
            ),
          )}
          {/* вход колледжа — рамка внутренней схемы */}
          <rect x={px(COLLEGE_WORLD_OFFSET[0] - 36 * INDOOR_SCALE)} y={pz(COLLEGE_WORLD_OFFSET[1] - 31 * INDOOR_SCALE)}
            width={72 * INDOOR_SCALE * sx} height={33 * INDOOR_SCALE * sz} fill="none" stroke="#a7f3d0" strokeWidth={0.8} strokeDasharray="2 2" />
          {/* маршрут */}
          {pts.length > 1 && (
            <polyline points={pts.map((p) => `${px(p.x)},${pz(p.z)}`).join(' ')} fill="none" stroke="#22d3ee" strokeWidth={2.4} strokeLinejoin="round" opacity={0.9} />
          )}
          {pts.length > 0 && <circle cx={px(pts[0].x)} cy={pz(pts[0].z)} r={4} fill="#34d399" />}
          {pts.length > 0 && <circle cx={px(pts[pts.length - 1].x)} cy={pz(pts[pts.length - 1].z)} r={4} fill="#f87171" />}
          {cur && <circle cx={px(cur.x)} cy={pz(cur.z)} r={3} fill="#fff" stroke="#22d3ee" />}
        </svg>
        <div className="flex gap-2 text-[9px] text-slate-400 px-1 pt-1 flex-wrap w-[260px]">
          <span><span className="inline-block w-2 h-2 rounded-full bg-green-700 mr-1" />стадион</span>
          <span><span className="inline-block w-2 h-2 bg-[#3b4a63] mr-1" />уч. корпус</span>
          <span><span className="inline-block w-2 h-0.5 bg-cyan-800 mr-1" />дорожки</span>
          <span><span className="inline-block w-2 h-0.5 bg-cyan-400 mr-1" />маршрут</span>
        </div>
      </div>
    );
  }

  // ---------- Внутренний этаж ----------
  const building = demoCampus.buildings.find((b) => b.id === useAppStore.getState().buildingId) ?? demoCampus.buildings[0];
  const rooms = building.rooms.filter((r) => r.floorId === floorId);
  const W = 240, H = 240;
  const bounds = { minX: -42, maxX: 42, minZ: -36, maxZ: 8 };
  const sx = W / (bounds.maxX - bounds.minX);
  const px = (x: number) => (x - bounds.minX) * sx;
  const pz = (z: number) => (z - bounds.minZ) * sx;

  return (
    <div className="absolute bottom-4 right-4 rounded-2xl bg-slate-900/80 backdrop-blur border border-slate-700/60 shadow-2xl p-2">
      <div className="text-[10px] text-slate-400 px-1 pb-1">{building.floors.find((f) => f.id === floorId)?.name ?? ''} · мини-карта</div>
      <svg width={W} height={H} className="rounded-lg">
        <rect width={W} height={H} fill="#0b1322" />
        {rooms.map((r) => (
          <polygon key={r.id} points={r.polygon.map(([x, z]) => `${px(x)},${pz(z)}`).join(' ')}
            fill={ROOM_COLORS[r.type] ?? '#475569'} fillOpacity={0.35} stroke={ROOM_COLORS[r.type] ?? '#64748b'} strokeWidth={1} />
        ))}
        {pts.length > 1 && (
          <polyline points={pts.map((p) => `${px(p.x)},${pz(p.z)}`).join(' ')} fill="none" stroke="#22d3ee" strokeWidth={2.2} opacity={0.9} />
        )}
        {pts.length > 0 && <circle cx={px(pts[0].x)} cy={pz(pts[0].z)} r={4} fill="#34d399" />}
        {pts.length > 0 && <circle cx={px(pts[pts.length - 1].x)} cy={pz(pts[pts.length - 1].z)} r={4} fill="#f87171" />}
        {cur && <circle cx={px(cur.x)} cy={pz(cur.z)} r={3} fill="#fff" stroke="#22d3ee" />}
      </svg>
    </div>
  );
}
