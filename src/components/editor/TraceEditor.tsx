/**
 * TraceEditor.tsx — режим трассировки поверх спутниковой подложки (этап 3).
 *
 * Открывается кнопкой «Трассировка» в оверлее. Показывает:
 *  - подложку /satellite.jpg (если файла нет — серый фон + подсказка куда положить);
 *  - слайдер прозрачности подложки 0..1;
 *  - векторный слой из campusLayout (или layoutOverride после «Применить»):
 *    контуры зданий тянутся за углы и центр, дороги — за вершины, snap 1 м;
 *  - калибровка: клик по двум точкам + ввод реального расстояния в метрах
 *    -> пересчёт SAT_BOUNDS (layoutIO.calibrateSatBounds);
 *  - «Скачать campusLayout.json» (полный дамп) и «Применить» (hot-reload в store).
 *
 * Рендер — SVG-план сверху (layout-координаты: x восток, y север), без three.
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import type { JSX } from 'react';
import { useAppStore } from '../../store/useAppStore';
import {
  BUILDING_LEVELS, DOORS, FOOTPRINTS, PLAZA, ROADS, SAT_BOUNDS, SAT_OPACITY,
  SAT_URL, STADIUM, type Footprint, type Plaza, type Pt, type Road, type Stadium,
} from '../../data/campusLayout';
import {
  calibrateSatBounds, downloadJson, parseLayoutSnapshot, snapPt, snapshotToJson,
  type LayoutSnapshot,
} from '../../lib/layoutIO';

type DragTarget =
  | { kind: 'fp-move'; id: string; grab: Pt; orig: Footprint }
  | { kind: 'fp-corner'; id: string; corner: number; orig: Footprint }
  | { kind: 'road-pt'; id: string; idx: number }
  | { kind: 'plaza-pt'; idx: number }
  | { kind: 'stadium-center' }
  | null;

interface EditorGeom {
  footprints: Record<string, Footprint>;
  roads: Road[];
  plaza: Plaza;
  stadium: Stadium;
  satBounds: [number, number, number, number];
}

const clone = <T,>(v: T): T => JSON.parse(JSON.stringify(v)) as T;

function geomFromSnapshot(s: LayoutSnapshot): EditorGeom {
  return {
    footprints: clone(s.footprints), roads: clone(s.roads), plaza: clone(s.plaza),
    stadium: clone(s.stadium), satBounds: [...s.satBounds] as [number, number, number, number],
  };
}

function defaultGeom(): EditorGeom {
  return {
    footprints: clone(FOOTPRINTS), roads: clone(ROADS), plaza: clone(PLAZA),
    stadium: clone(STADIUM), satBounds: [...SAT_BOUNDS] as [number, number, number, number],
  };
}

function baseSnapshot(mpp: number): LayoutSnapshot {
  return {
    footprints: clone(FOOTPRINTS), buildingLevels: { ...BUILDING_LEVELS },
    roads: clone(ROADS), plaza: clone(PLAZA), stadium: clone(STADIUM),
    doors: clone(DOORS), satBounds: [...SAT_BOUNDS] as [number, number, number, number],
    metersPerPixel: mpp,
  };
}

function snapshotFromGeom(g: EditorGeom, mpp: number, doors: LayoutSnapshot['doors'], levels: Record<string, number>): LayoutSnapshot {
  return {
    footprints: g.footprints, buildingLevels: levels, roads: g.roads,
    plaza: g.plaza, stadium: g.stadium, doors, satBounds: g.satBounds, metersPerPixel: mpp,
  };
}

export function TraceEditor() {
  const editorOpen = useAppStore((s) => s.editorOpen);
  const setEditorOpen = useAppStore((s) => s.setEditorOpen);
  const layoutOverride = useAppStore((s) => s.layoutOverride);
  const applyLayoutOverride = useAppStore((s) => s.applyLayoutOverride);
  const satOpacity = useAppStore((s) => s.satOpacity);
  const setSatOpacity = useAppStore((s) => s.setSatOpacity);

  const [geom, setGeom] = useState<EditorGeom>(() =>
    layoutOverride ? geomFromSnapshot(layoutOverride) : defaultGeom());
  const [mpp, setMpp] = useState(layoutOverride?.metersPerPixel ?? 1);
  const [satOk, setSatOk] = useState<boolean | null>(null);
  const [drag, setDrag] = useState<DragTarget>(null);
  const [calibPts, setCalibPts] = useState<Pt[]>([]);
  const [calibMeters, setCalibMeters] = useState('100');
  const [msg, setMsg] = useState<string | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const imgSize = useRef<[number, number]>([2048, 2048]);

  // проверка наличия подложки + её пиксельного размера
  useEffect(() => {
    if (!editorOpen) return;
    let alive = true;
    const img = new Image();
    img.onload = () => { if (alive) { imgSize.current = [img.naturalWidth || 2048, img.naturalHeight || 2048]; setSatOk(true); } };
    img.onerror = () => alive && setSatOk(false);
    img.src = SAT_URL;
    return () => { alive = false; };
  }, [editorOpen]);

  // границы вида: весь layout + bounds подложки с запасом
  const view = useMemo(() => {
    let minX = geom.satBounds[0], minY = geom.satBounds[1];
    let maxX = geom.satBounds[2], maxY = geom.satBounds[3];
    for (const f of Object.values(geom.footprints)) {
      minX = Math.min(minX, f.x - 40); minY = Math.min(minY, f.y - 40);
      maxX = Math.max(maxX, f.x + f.w + 40); maxY = Math.max(maxY, f.y + f.h + 40);
    }
    return { minX, minY, maxX, maxY, w: maxX - minX, h: maxY - minY };
  }, [geom]);

  /** SVG-координата Y (вниз) из layout-Y (север вверх). */
  const sy = (y: number): number => view.maxY - y;

  /** экранные координаты -> layout (метры), до snap. */
  const toLayout = (clientX: number, clientY: number): Pt | null => {
    const svg = svgRef.current;
    if (!svg) return null;
    const r = svg.getBoundingClientRect();
    const x = view.minX + ((clientX - r.left) / r.width) * view.w;
    const y = view.maxY - ((clientY - r.top) / r.height) * view.h;
    return [x, y];
  };

  if (!editorOpen) return null;

  const handleMove = (e: React.PointerEvent) => {
    if (!drag) return;
    const p = toLayout(e.clientX, e.clientY);
    if (!p) return;
    const sp = snapPt(p); // snap 1 м
    setGeom((g) => {
      const ng: EditorGeom = {
        ...g,
        footprints: { ...g.footprints },
        roads: g.roads.map((r) => ({ ...r, pts: [...r.pts] })),
      };
      if (drag.kind === 'fp-move') {
        const o = drag.orig;
        ng.footprints[drag.id] = {
          ...o,
          x: snapPt([sp[0] - drag.grab[0], 0])[0],
          y: snapPt([0, sp[1] - drag.grab[1]])[1],
        };
      } else if (drag.kind === 'fp-corner') {
        const f = { ...ng.footprints[drag.id] };
        const o = drag.orig;
        // corner: 0 SW(x,y) 1 SE(x+w,y) 2 NE(x+w,y+h) 3 NW(x,y+h)
        if (drag.corner === 0) {
          const nx = Math.min(sp[0], o.x + o.w - 4), ny = Math.min(sp[1], o.y + o.h - 4);
          f.x = nx; f.y = ny; f.w = o.x + o.w - nx; f.h = o.y + o.h - ny;
        } else if (drag.corner === 1) {
          f.w = Math.max(sp[0], o.x + 4) - o.x;
          f.y = Math.min(sp[1], o.y + o.h - 4); f.h = o.y + o.h - f.y;
        } else if (drag.corner === 2) {
          f.w = Math.max(sp[0], o.x + 4) - o.x;
          f.h = Math.max(sp[1], o.y + 4) - o.y;
        } else {
          const nx = Math.min(sp[0], o.x + o.w - 4);
          f.x = nx; f.w = o.x + o.w - nx;
          f.h = Math.max(sp[1], o.y + 4) - o.y;
        }
        ng.footprints[drag.id] = f;
      } else if (drag.kind === 'road-pt') {
        const r = ng.roads.find((rr) => rr.id === drag.id);
        if (r) r.pts[drag.idx] = sp;
      } else if (drag.kind === 'plaza-pt') {
        ng.plaza = { ...ng.plaza, polygon: ng.plaza.polygon.map((q, i) => (i === drag.idx ? sp : q)) };
      } else if (drag.kind === 'stadium-center') {
        ng.stadium = { ...ng.stadium, center: sp };
      }
      return ng;
    });
  };

  const onSvgClick = (e: React.MouseEvent) => {
    if (drag) return;
    const p = toLayout(e.clientX, e.clientY);
    if (!p) return;
    setCalibPts((c) => (c.length >= 2 ? [snapPt(p)] : [...c, snapPt(p)]));
  };

  const doCalibrate = () => {
    if (calibPts.length < 2) { setMsg('Калибровка: кликните на карте две точки.'); return; }
    const real = Number(calibMeters);
    if (!(real > 0)) { setMsg('Введите положительное расстояние в метрах.'); return; }
    // calibrateSatBounds ожидает world XZ: worldX = x, worldZ = -y
    const res = calibrateSatBounds({
      p1: [calibPts[0][0], -calibPts[0][1]],
      p2: [calibPts[1][0], -calibPts[1][1]],
      realMeters: real, bounds: geom.satBounds, imagePx: imgSize.current,
    });
    const oldDist = Math.hypot(calibPts[1][0] - calibPts[0][0], calibPts[1][1] - calibPts[0][1]);
    const scale = oldDist > 1e-6 ? real / oldDist : 1;
    const cx = (calibPts[0][0] + calibPts[1][0]) / 2;
    const cy = (calibPts[0][1] + calibPts[1][1]) / 2;
    const sc = (p: Pt): Pt => [cx + (p[0] - cx) * scale, cy + (p[1] - cy) * scale];
    setGeom((g) => ({
      footprints: Object.fromEntries(Object.entries(g.footprints).map(([id, f]) => {
        const a = sc([f.x, f.y]);
        return [id, { ...f, x: a[0], y: a[1], w: f.w * scale, h: f.h * scale }];
      })),
      roads: g.roads.map((r) => ({ ...r, pts: r.pts.map(sc), width: r.width * scale })),
      plaza: { ...g.plaza, polygon: g.plaza.polygon.map(sc) },
      stadium: {
        ...g.stadium, center: sc(g.stadium.center), rx: g.stadium.rx * scale, ry: g.stadium.ry * scale,
        fieldW: g.stadium.fieldW * scale, fieldH: g.stadium.fieldH * scale,
      },
      satBounds: res.bounds,
    }));
    setMpp(res.metersPerPixel);
    setCalibPts([]);
    setMsg(`Калибровка: масштаб ×${scale.toFixed(4)} · SAT_BOUNDS ≈ [${res.bounds.map((v) => Math.round(v)).join(', ')}] · ${res.metersPerPixel.toFixed(3)} м/px`);
  };

  const currentSnapshot = (): LayoutSnapshot => {
    const base = layoutOverride ?? baseSnapshot(mpp);
    return snapshotFromGeom(geom, mpp, base.doors, base.buildingLevels);
  };

  const doDownload = () => {
    downloadJson('campusLayout.json', snapshotToJson(currentSnapshot()));
    setMsg('Файл campusLayout.json скачан (полный дамп геометрии).');
  };

  const doApply = () => {
    applyLayoutOverride(currentSnapshot());
    setMsg('Геометрия применена к сцене (hot-reload через store).');
  };

  const doReset = () => {
    setGeom(layoutOverride ? geomFromSnapshot(layoutOverride) : defaultGeom());
    setMpp(layoutOverride?.metersPerPixel ?? 1);
    setMsg('Черновик сброшен.');
  };

  const doImport = async (file: File) => {
    try {
      const snap = parseLayoutSnapshot(await file.text());
      setGeom(geomFromSnapshot(snap));
      setMpp(snap.metersPerPixel);
      setMsg(`Импортирован ${file.name}.`);
    } catch (err) {
      setMsg((err as Error).message);
    }
  };

  const grid: JSX.Element[] = [];
  for (let gx = Math.ceil(view.minX / 50) * 50; gx <= view.maxX; gx += 50) {
    grid.push(<line key={'gx' + gx} x1={gx} y1={sy(view.minY)} x2={gx} y2={sy(view.maxY)} stroke="#ffffff" strokeOpacity={0.05} />);
  }
  for (let gy = Math.ceil(view.minY / 50) * 50; gy <= view.maxY; gy += 50) {
    grid.push(<line key={'gy' + gy} x1={view.minX} y1={sy(gy)} x2={view.maxX} y2={sy(gy)} stroke="#ffffff" strokeOpacity={0.05} />);
  }

  const btn = 'rounded border px-2 py-0.5 text-xs hover:border-amber-400 transition';
  const btnSt = { borderColor: 'rgba(201,151,63,0.4)', color: '#f3e7cf' } as const;

  return (
    <div className="absolute inset-0 z-40 flex flex-col" style={{ background: 'rgba(14,14,18,0.97)' }}>
      {/* toolbar */}
      <div className="flex flex-wrap items-center gap-3 border-b px-4 py-2 text-xs"
        style={{ borderColor: 'rgba(201,151,63,0.25)', color: '#f3e7cf' }}>
        <span className="font-bold" style={{ color: '#e8c87a' }}>Трассировка кампуса</span>
        <label className="flex items-center gap-2">
          Подложка
          <input type="range" min={0} max={1} step={0.05} value={satOpacity}
            onChange={(e) => setSatOpacity(Number(e.target.value))} className="accent-amber-500" />
          <span className="w-8 tabular-nums">{satOpacity.toFixed(2)}</span>
        </label>
        <span className="text-[10px]" style={{ color: satOk === false ? '#ff9a76' : '#9a9aa2' }}>
          {satOk === false ? `нет файла ${SAT_URL} — положите снимок в public/` : satOk === true ? `${SAT_URL} загружена` : 'проверка подложки…'}
        </span>
        <span className="opacity-30">|</span>
        <span>Калибровка:</span>
        <button className={btn} style={btnSt} onClick={() => setCalibPts([])} title="Сбросить точки калибровки">
          точек {calibPts.length}/2
        </button>
        <input type="number" min={1} value={calibMeters} onChange={(e) => setCalibMeters(e.target.value)}
          className="w-20 rounded border bg-transparent px-1.5 py-0.5 text-xs"
          style={{ borderColor: 'rgba(201,151,63,0.4)', color: '#f3e7cf' }}
          title="Реальное расстояние между двумя кликами, метры" />
        <span>м</span>
        <button className={btn} style={btnSt} onClick={doCalibrate}>Откалибровать</button>
        <span className="opacity-30">|</span>
        <button className={btn} style={btnSt} onClick={doDownload}>Скачать campusLayout.json</button>
        <button className={`${btn} font-semibold`} style={{ borderColor: 'rgba(224,176,80,0.6)', color: '#ffe9b8' }} onClick={doApply}>Применить</button>
        <button className={btn} style={btnSt} onClick={doReset}>Сброс черновика</button>
        <label className={`${btn} cursor-pointer`} style={btnSt}>
          Импорт JSON…
          <input type="file" accept=".json,application/json" className="hidden"
            onChange={(e) => { const f = e.target.files?.[0]; if (f) void doImport(f); e.currentTarget.value = ''; }} />
        </label>
        <button className={`${btn} ml-auto`} style={btnSt} onClick={() => setEditorOpen(false)}>Закрыть ✕</button>
      </div>
      {msg && (
        <div className="border-b px-4 py-1 text-[11px]" style={{ borderColor: 'rgba(201,151,63,0.15)', color: '#9fd8c0' }}>
          {msg}
        </div>
      )}

      {/* карта */}
      <div className="relative min-h-0 flex-1">
        <svg
          ref={svgRef}
          className="h-full w-full touch-none select-none"
          viewBox={`${view.minX} ${sy(view.maxY)} ${view.w} ${view.h}`}
          style={{ background: satOk ? '#1c1c22' : '#26262c', cursor: drag ? 'grabbing' : 'crosshair' }}
          onPointerMove={handleMove}
          onPointerUp={() => setDrag(null)}
          onPointerLeave={() => setDrag(null)}
          onClick={onSvgClick}
        >
          {/* подложка */}
          {satOk && (
            <image href={SAT_URL}
              x={geom.satBounds[0]} y={sy(geom.satBounds[3])}
              width={geom.satBounds[2] - geom.satBounds[0]}
              height={geom.satBounds[3] - geom.satBounds[1]}
              preserveAspectRatio="none" opacity={Math.max(satOpacity, 0.001)} />
          )}
          {!satOk && (
            <rect x={geom.satBounds[0]} y={sy(geom.satBounds[3])}
              width={geom.satBounds[2] - geom.satBounds[0]} height={geom.satBounds[3] - geom.satBounds[1]}
              fill="#2e2e35" fillOpacity={0.6} stroke="#575760" strokeDasharray="6 6" />
          )}
          {grid}

          {/* площадь Шокина */}
          <polygon points={geom.plaza.polygon.map((p) => `${p[0]},${sy(p[1])}`).join(' ')}
            fill="#3a3a45" fillOpacity={0.8} stroke="#8a6a2e" strokeWidth={1} />
          {geom.plaza.polygon.map((p, i) => (
            <rect key={'plz' + i} x={p[0] - 3} y={sy(p[1]) - 3} width={6} height={6} fill="#c9973f"
              style={{ cursor: 'grab' }}
              onPointerDown={(e) => { e.stopPropagation(); setDrag({ kind: 'plaza-pt', idx: i }); }} />
          ))}

          {/* стадион */}
          <ellipse cx={geom.stadium.center[0]} cy={sy(geom.stadium.center[1])}
            rx={geom.stadium.rx} ry={geom.stadium.ry}
            fill="#3c4a39" fillOpacity={0.7} stroke="#8a6a2e" strokeWidth={1.2} />
          <rect x={geom.stadium.center[0] - geom.stadium.fieldW / 2}
            y={sy(geom.stadium.center[1] + geom.stadium.fieldH / 2)}
            width={geom.stadium.fieldW} height={geom.stadium.fieldH}
            fill="none" stroke="#c9973f" strokeOpacity={0.6} />
          <circle cx={geom.stadium.center[0]} cy={sy(geom.stadium.center[1])} r={5} fill="#c9973f"
            style={{ cursor: 'move' }}
            onPointerDown={(e) => { e.stopPropagation(); setDrag({ kind: 'stadium-center' }); }} />

          {/* дороги: ленты + тонкая осевая + вершины */}
          {geom.roads.map((r) => (
            <g key={r.id}>
              <polyline points={r.pts.map((p) => `${p[0]},${sy(p[1])}`).join(' ')}
                fill="none" stroke={r.surface === 'asphalt' ? '#4a4a52' : '#575760'}
                strokeWidth={Math.max(r.width, 2)} strokeOpacity={0.85}
                strokeLinecap="round" strokeLinejoin="round" />
              <polyline points={r.pts.map((p) => `${p[0]},${sy(p[1])}`).join(' ')}
                fill="none" stroke="#6b6b74" strokeWidth={0.6} strokeDasharray="4 4" />
              {r.pts.map((p, i) => (
                <circle key={i} cx={p[0]} cy={sy(p[1])} r={3.2} fill="#e0b050" style={{ cursor: 'grab' }}
                  onPointerDown={(e) => { e.stopPropagation(); setDrag({ kind: 'road-pt', id: r.id, idx: i }); }} />
              ))}
            </g>
          ))}

          {/* здания: тело + подпись + ручки углов */}
          {Object.values(geom.footprints).map((f) => (
            <g key={f.id}>
              <rect x={f.x} y={sy(f.y + f.h)} width={f.w} height={f.h}
                fill={f.id === 'lab' ? '#33333b' : '#3d3d46'}
                fillOpacity={f.id === 'lab' ? 0.35 : 0.75}
                stroke={f.id === 'lab' ? '#575760' : '#c9973f'} strokeWidth={1.4}
                style={{ cursor: 'move' }}
                onPointerDown={(e) => {
                  e.stopPropagation();
                  const p = toLayout(e.clientX, e.clientY);
                  if (p) setDrag({ kind: 'fp-move', id: f.id, grab: [p[0] - f.x, p[1] - f.y], orig: { ...f } });
                }} />
              <text x={f.x + f.w / 2} y={sy(f.y + f.h / 2) + 3} textAnchor="middle" fontSize={9}
                fill="#f3e7cf" pointerEvents="none">
                {f.id} · {BUILDING_LEVELS[f.id] ?? 1} эт. · {Math.round(f.w)}×{Math.round(f.h)} м
              </text>
              {[[f.x, f.y], [f.x + f.w, f.y], [f.x + f.w, f.y + f.h], [f.x, f.y + f.h]].map((c, ci) => (
                <rect key={ci} x={c[0] - 3} y={sy(c[1]) - 3} width={6} height={6} fill="#ffcf6b"
                  style={{ cursor: 'nwse-resize' }}
                  onPointerDown={(e) => { e.stopPropagation(); setDrag({ kind: 'fp-corner', id: f.id, corner: ci, orig: { ...f } }); }} />
              ))}
            </g>
          ))}

          {/* двери (ориентир, не редактируются) */}
          {DOORS.map((d) => (
            <g key={d.id} pointerEvents="none">
              <circle cx={d.pos[0]} cy={sy(d.pos[1])} r={2.6} fill="#9fd8c0" />
              <text x={d.pos[0] + 4} y={sy(d.pos[1]) + 2} fontSize={6} fill="#9fd8c0">{d.id.replace('do.', '')}</text>
            </g>
          ))}

          {/* точки калибровки */}
          {calibPts.map((p, i) => (
            <g key={'cal' + i} pointerEvents="none">
              <circle cx={p[0]} cy={sy(p[1])} r={4} fill="none" stroke="#ff9a76" strokeWidth={1.4} />
              <text x={p[0] + 6} y={sy(p[1]) - 4} fontSize={8} fill="#ff9a76">{i + 1}</text>
            </g>
          ))}
          {calibPts.length === 2 && (
            <line x1={calibPts[0][0]} y1={sy(calibPts[0][1])} x2={calibPts[1][0]} y2={sy(calibPts[1][1])}
              stroke="#ff9a76" strokeWidth={1} strokeDasharray="3 3" pointerEvents="none" />
          )}
        </svg>
      </div>
      <div className="border-t px-4 py-1.5 text-[10px]" style={{ borderColor: 'rgba(201,151,63,0.2)', color: '#8a8a92' }}>
        Здания тяните за тело (центр) или золотые уголки; дороги и площадь — за вершины; snap 1&nbsp;м.
        Калибровка: 2 клика по характерным точкам снимка → расстояние в метрах → «Откалибровать»
        (пересчёт SAT_BOUNDS, дефолт прозрачности {SAT_OPACITY}). «Применить» — hot-reload сцены,
        «Скачать» — полный JSON-дамп геометрии для коммита в campusLayout.ts.
      </div>
    </div>
  );
}
