/**
 * Кампус МИЭТ: layout по квадрантам Яндекс-карты (зазоры >=10 м, наездов нет).
 * Корпус 1 — реальный план из JSON (affine-маппинг). Протон(6) — учебные аудитории.
 * Колледж(8) — демо-интерьер (данных нет, честно). Лабораторный(7) — ориентир без
 * интерьеров. Стадион — поле (render в Scene), не коробка. Удалены: 5-коробка,
 * автохоз, энерго, пожарная, Saffron, технодеревни, ИЦНТ, ГНЦ-коробка.
 * Мост 1<->ДК = passage edge на уровне 2 этажа. Модель А: FLOOR_H=3.2.
 */
import type {
  Building, CampusData, EntranceDoor, Floor, NavEdge, NavNode, Rect, Room, VerticalConnection,
} from './types';
import { OUTDOOR_EDGES, OUTDOOR_LANDMARKS, OUTDOOR_NODES, OUTDOOR_PATHS } from './campusOutdoor';
import { DOORS, FOOTPRINTS, footprintToWorldRect, lx, ly, type Footprint, type Pt } from './campusLayout';
import { buildParametricBuilding, type SemanticRoom } from '../lib/parametricFloor';

/** Позиции уличных дверей (layout) по id узла — из campusLayout. */
const DOOR_POS: Record<string, Pt> = Object.fromEntries(DOORS.map((d) => [d.id, d.pos]));
import { BUILDING_NUMBER, formatRoomCode } from '../lib/roomCode';

/** Footprint из campusLayout -> world Rect (worldX = x, worldZ = -y). */
const L = (id: string): [number, number, number, number] => {
  const f: Footprint = FOOTPRINTS[id]; const r = footprintToWorldRect(f);
  return [r.minX, r.minZ, r.maxX, r.maxZ];
};

const FLOOR_H = 3.2, CEIL = 3.0, YOFF = 0.2;
const fy = (lvl: number): number => lvl * FLOOR_H + YOFF;
const rc = (b: string, lvl: number, idx: number, suf?: string): string =>
  formatRoomCode({ building: BUILDING_NUMBER[b] ?? 0, floor: lvl + 1, room: idx, suffix: suf });

/* affine JSON(0,0)=ЮЗ, X=восток 0..108, Y=север 0..98 -> world b1 X[-25,65] Z[-130,-40] */
const mx = (jx: number): number => jx;
const mz = (jy: number): number => -jy;
type Conv = 'wh' | 'xy';
function pr(poly: number[], conv: Conv): Rect {
  if (conv === 'wh') return { minX: mx(poly[0]), maxX: mx(poly[0]+poly[2]), minZ: mz(poly[1]+poly[3]), maxZ: mz(poly[1]) };
  return { minX: mx(poly[0]), maxX: mx(poly[2]), minZ: mz(poly[3]), maxZ: mz(poly[1]) };
}
const pr4 = (poly: number[], conv: Conv): [number,number,number,number] => { const r=pr(poly,conv); return [r.minX,r.minZ,r.maxX,r.maxZ]; };
const pc = (poly: number[], conv: Conv): [number,number] => { const r=pr(poly,conv); return [(r.minX+r.maxX)/2,(r.minZ+r.maxZ)/2]; };
/** 8 узлов кольца по центральной линии: Ю-углы/середина, З-середина, С-углы/середина, В-середина. */
function ringPts(o: Rect): [number,number][] {
  const {minX:a,maxX:b,minZ:c,maxZ:d}=o, hx=(a+b)/2, hz=(c+d)/2;
  return [[b,c],[hx,c],[a,c],[a,hz],[a,d],[hx,d],[b,d],[b,hz]];
}
const R1 = pr([29,17,79,67],'xy');
/** Северная грань кольца (для крепления моста b1→ДК): узлы c4(СЗ), c5(С-центр), c6(СВ). */
const B1_NORTH_RING = ['si.b1.f1.c4', 'si.b1.f1.c5', 'si.b1.f1.c6'];

const inNode=(id:string,type:NavNode['type'],x:number,y:number,z:number,b:string,f:number,label?:string,roomId?:string):NavNode=>
  ({id,type,position:{x,y,z},buildingId:b,floor:f,...(label?{label}:{}),...(roomId?{roomId}:{})});
const ie=(a:string,b:string):NavEdge=>({from:a,to:b,kind:'indoor',bidirectional:true});
const re_=(a:string,b:string):NavEdge=>({from:a,to:b,kind:'enter-room',bidirectional:true});
const de=(a:string,b:string):NavEdge=>({from:a,to:b,kind:'through-door',bidirectional:true});
const ve=(a:string,b:string):NavEdge=>({from:a,to:b,kind:'vertical',bidirectional:true});
const iChain=(ids:string[]):NavEdge[]=>{const o:NavEdge[]=[];for(let i=0;i<ids.length-1;i++)o.push(ie(ids[i],ids[i+1]));return o;};

interface RoomCfg{id:string;num:string;name:string;kind:Room['kind'];rect:[number,number,number,number];}
interface VertCfg{kind:'stairs'|'elevator';x:number;z:number;from:number;to:number;label:string;}
interface FloorCfg{lvl:number;name:string;cor:[number,number][];rooms:RoomCfg[];verticals:VertCfg[];hall?:[number,number];}
interface BldCfg{id:string;name:string;short:string;kind:Building['kind'];color:string;
  foot:[number,number,number,number];levels:number[];floors:FloorCfg[];
  door?:{outdoorNode:string;pos:[number,number];side:EntranceDoor['side'];label:string};}

function nearCor(ids:string[],pos:Map<string,[number,number]>,x:number,z:number):string{
  let best=ids[0],bd=Infinity; for(const c of ids){const[cx,cz]=pos.get(c)!;const d=Math.hypot(cx-x,cz-z);if(d<bd){bd=d;best=c;}} return best;
}
function build(cfg:BldCfg){
  const nodes:NavNode[]=[],edges:NavEdge[]=[],rooms:Room[]=[],verticals:VerticalConnection[]=[],doors:EntranceDoor[]=[],floors:Floor[]=[];
  const foot:Rect={minX:cfg.foot[0],minZ:cfg.foot[1],maxX:cfg.foot[2],maxZ:cfg.foot[3]};
  const pos=new Map<string,[number,number]>(); const byLvl=new Map<number,string[]>();
  for(const f of cfg.floors){ const ids:string[]=[];
    f.cor.forEach(([x,z],k)=>{const cid=`si.${cfg.id}.f${f.lvl}.c${k}`;ids.push(cid);pos.set(cid,[x,z]);nodes.push(inNode(cid,'corridor',x,fy(f.lvl),z,cfg.id,f.lvl));});
    byLvl.set(f.lvl,ids); edges.push(...iChain(ids)); if(ids.length>2)edges.push(ie(ids[ids.length-1],ids[0]));
  }
  for(const f of cfg.floors){ const ids=byLvl.get(f.lvl)!; const rids:string[]=[];
    if(f.hall){const hid=`si.${cfg.id}.f${f.lvl}.hall`;nodes.push(inNode(hid,'door-indoor',f.hall[0],fy(f.lvl),f.hall[1],cfg.id,f.lvl,'Холл'));edges.push(ie(nearCor(ids,pos,f.hall[0],f.hall[1]),hid));}
    for(const r of f.rooms){const aid=`si.${cfg.id}.room.${r.id}`;const cx=(r.rect[0]+r.rect[2])/2,cz=(r.rect[1]+r.rect[3])/2;
      nodes.push(inNode(aid,'room',cx,fy(f.lvl),cz,cfg.id,f.lvl,r.name,r.id));edges.push(re_(nearCor(ids,pos,cx,cz),aid));
      rooms.push({id:r.id,number:r.num,name:r.name,kind:r.kind,buildingId:cfg.id,floor:f.lvl,rect:{minX:r.rect[0],minZ:r.rect[1],maxX:r.rect[2],maxZ:r.rect[3]},doorNodes:[aid]});rids.push(r.id);}
    for(const vv of f.verticals){const s=vv.kind==='elevator'?'el':'st';const a=`si.${cfg.id}.f${vv.from}.${s}`,b=`si.${cfg.id}.f${vv.to}.${s}`;
      if(!nodes.some(n=>n.id===a))nodes.push(inNode(a,vv.kind,vv.x,fy(vv.from),vv.z,cfg.id,vv.from,vv.label));
      if(!nodes.some(n=>n.id===b))nodes.push(inNode(b,vv.kind,vv.x,fy(vv.to),vv.z,cfg.id,vv.to,vv.label));
      edges.push(ve(a,b));edges.push(ie(nearCor(byLvl.get(vv.from)!,pos,vv.x,vv.z),a));edges.push(ie(nearCor(byLvl.get(vv.to)!,pos,vv.x,vv.z),b));
      verticals.push({id:`v.${cfg.id}.${s}.${vv.from}-${vv.to}`,buildingId:cfg.id,kind:vv.kind,position:{x:vv.x,z:vv.z},fromFloor:vv.from,toFloor:vv.to,fromNode:a,toNode:b,label:vv.label});}
    floors.push({level:f.lvl,name:f.name,height:f.lvl*FLOOR_H,ceiling:CEIL,shape:[foot],roomIds:rids});
  }
  if(cfg.door){const hid=`si.${cfg.id}.f0.hall`;doors.push({id:`door.${cfg.id}`,buildingId:cfg.id,position:{x:cfg.door.pos[0],z:cfg.door.pos[1]},outdoorNode:cfg.door.outdoorNode,indoorNode:hid,side:cfg.door.side,label:cfg.door.label});edges.push(de(cfg.door.outdoorNode,hid));}
  const building:Building={id:cfg.id,name:cfg.name,shortName:cfg.short,kind:cfg.kind,footprint:foot,levels:cfg.levels,floors,color:cfg.color};
  return{building,nodes,edges,rooms,verticals,doors};
}

const B1:BldCfg={id:'b1',name:'Административный корпус (1)',short:'Корпус 1',kind:'admin',color:'#f59e0b',
  foot:L('b1'),levels:[0,1],
  door:{outdoorNode:'do.b1',pos:[lx(DOOR_POS['do.b1']),ly(DOOR_POS['do.b1'])],side:'east',label:'Главный вход (портал)'},
  floors:[
    {lvl:0,name:'1 этаж',hall:pc([80,40,27.5,21],'wh'),cor:ringPts(R1),
      rooms:[
        {id:'lib_f1',num:'Библ.',name:'Библиотека: читальный зал, абонемент (барельеф Э. Неизвестного)',kind:'reading-room',rect:pr4([39,27,30,30],'wh')},
        {id:'vestibule_e',num:'Вест.',name:'Вестибюль (восточный неф)',kind:'lobby',rect:pr4([80,40,27.5,21],'wh')},
        {id:'wardrobe',num:'Гард.',name:'Гардероб; магазин канцелярии',kind:'other',rect:pr4([80,19,27.5,20],'wh')},
        {id:'bakery',num:'Буфет',name:'Пекарня / буфет',kind:'cafeteria-seating',rect:pr4([80,62,27.5,21],'wh')},
        {id:'k1107',num:'1107',name:'Канцелярия (ауд. 1107)',kind:'office',rect:pr4([80,0.5,27.5,17.5],'wh')},
        {id:'miet_tv',num:'ТВ',name:'Студия и съёмочный павильон МИЭТ-ТВ',kind:'other',rect:pr4([71,0.5,36.5,16],'wh')},
        {id:'kadr',num:'КАДР',name:'Отдел кадров',kind:'office',rect:pr4([0.5,43.5,27,22],'wh')},
        {id:'aud01',num:rc('b1',0,1),name:'Поточная №1 (200–250 мест)',kind:'lecture-hall',rect:pr4([3,0.5,33,16],'wh')},
        {id:'aud02',num:rc('b1',0,2),name:'Поточная №2 (200–250 мест)',kind:'lecture-hall',rect:pr4([37,0.5,33,16],'wh')},
        {id:'aud03',num:rc('b1',0,3),name:'Поточная №3 (200–250 мест)',kind:'lecture-hall',rect:pr4([3,67.5,33,16],'wh')},
        {id:'aud04',num:rc('b1',0,4),name:'Поточная №4 (200–250 мест)',kind:'lecture-hall',rect:pr4([37,67.5,33,16],'wh')},
        {id:'aud05',num:rc('b1',0,5),name:'Поточная №5 (200–250 мест)',kind:'lecture-hall',rect:pr4([0.5,20,27,22],'wh')},
      ],
      verticals:[
        {kind:'stairs',x:pc([88,33.5,12,25],'wh')[0],z:pc([88,33.5,12,25],'wh')[1],from:0,to:1,label:'Парадная лестница'},
        {kind:'stairs',x:pc([31,19.5,46,5.5],'wh')[0],z:pc([31,19.5,46,5.5],'wh')[1],from:0,to:1,label:'Пандус — подъём без ступеней'},
        {kind:'stairs',x:pc([31.5,33.5,12,22],'wh')[0],z:pc([31.5,33.5,12,22],'wh')[1],from:0,to:1,label:'Лестница в обход куба'},
      ]},
    {lvl:1,name:'2 этаж',cor:ringPts(R1),
      rooms:[
        {id:'lib_f2',num:'Библ.2',name:'Библиотека: 2-й ярус, портретная галерея',kind:'reading-room',rect:pr4([39,27,30,30],'wh')},
        {id:'rectorate',num:'1222',name:'Ректорат (галерея), ауд. 1222 — ректор',kind:'office',rect:pr4([0.5,20,27,46.5],'wh')},
        {id:'k1206',num:'1206',name:'Профком (ауд. 1206)',kind:'office',rect:pr4([0.5,43.5,27,12.5],'wh')},
        {id:'balcony',num:'Балк.',name:'Балкон вестибюля над восточным нефом',kind:'other',rect:pr4([80,40,27.5,21],'wh')},
        {id:'aud01_u',num:rc('b1',1,1),name:'Поточная №1–2 (верхний ярус)',kind:'lecture-hall',rect:pr4([3,0.5,33,16],'wh')},
        {id:'aud03_u',num:rc('b1',1,3),name:'Поточная №3 (верхний ярус)',kind:'lecture-hall',rect:pr4([3,67.5,33,16],'wh')},
        {id:'aud04_u',num:rc('b1',1,4),name:'Поточная №4 (верхний ярус)',kind:'lecture-hall',rect:pr4([37,67.5,33,16],'wh')},
        {id:'aud05_u',num:rc('b1',1,5),name:'Поточная №5 (верхний ярус)',kind:'lecture-hall',rect:pr4([0.5,67.5,27,16],'wh')},
      ],
      verticals:[
        {kind:'stairs',x:pc([88,33.5,12,25],'wh')[0],z:pc([88,33.5,12,25],'wh')[1],from:1,to:0,label:'Парадная лестница'},
        {kind:'stairs',x:pc([31,19.5,46,5.5],'wh')[0],z:pc([31,19.5,46,5.5],'wh')[1],from:1,to:0,label:'Пандус — верхняя площадка'},
      ]},
  ]};

const CONFIGS:BldCfg[]=[
  B1,
  // лабораторный (7) — ориентир без интерьеров/целей
  {id:'lab',name:'Лабораторный корпус (7, не для учёбы)',short:'Лабораторный',kind:'academic',color:'#d97706',foot:L('lab'),levels:[0],floors:[]},
];

/* ================= 2Б. Параметрические корпуса 2,3,4,5,8 (все recon) ================= */

interface ParamCfg {
  id: string; name: string; short: string; kind: Building['kind']; color: string;
  /** дверь с улицы (layout-позиция из DOORS) и сторона фасада */
  doorNode: string; side: EntranceDoor['side']; doorLabel: string;
  levels: number[]; floors: SemanticRoom[][];
}

const PARAM_CFG: ParamCfg[] = [
  { id: 'dk', name: 'Дом культуры МИЭТ (2)', short: 'Корпус 2 · ДК', kind: 'other', color: '#fbbf24',
    doorNode: 'do.dk', side: 'south', doorLabel: 'Вход ДК', levels: [0, 1],
    floors: [
      [{ name: 'Актовый зал ДК', kind: 'assembly-hall' }, { name: 'Фойе', kind: 'lobby' }, { name: 'Костюмерная', kind: 'other' }],
      [{ name: 'Столовая', kind: 'cafeteria-seating' }, { name: 'Приёмная комиссия', kind: 'office' }, { name: 'Кружковая', kind: 'other' }],
    ] },
  { id: 'uk3', name: 'Учебный корпус 3', short: 'Корпус 3', kind: 'academic', color: '#f59e0b',
    doorNode: 'do.uk3', side: 'east', doorLabel: 'Вход 3 корпуса', levels: [0, 1, 2],
    floors: [
      [{ name: 'Столовая', kind: 'cafeteria-seating' }, { name: 'Здравпункт', kind: 'ward' }, { name: 'Фойе', kind: 'lobby' }],
      [{ name: 'Центр экономики учебного процесса', kind: 'office' }, { name: 'Военно-учётный стол', kind: 'office' }],
      [{ name: 'Студенческий совет', kind: 'office' }, { name: 'Молодёжный центр', kind: 'other' }],
    ] },
  { id: 'uk4', name: 'Учебный корпус 4', short: 'Корпус 4', kind: 'academic', color: '#f59e0b',
    doorNode: 'do.uk4', side: 'south', doorLabel: 'Вход 4 корпуса', levels: [0],
    floors: [
      [{ name: 'Информационно-аналитический центр', kind: 'office' }, { name: 'Читальня', kind: 'reading-room' }, { name: 'Серверная', kind: 'other' }],
    ] },
  { id: 'sport', name: 'Спортивный комплекс (5)', short: 'Корпус 5 · Спорт', kind: 'sports', color: '#f59e0b',
    doorNode: 'do.sport', side: 'south', doorLabel: 'Вход спорткомплекса', levels: [0, 1],
    floors: [
      [{ name: 'Игровой зал', kind: 'gym' }, { name: 'Раздевалка М', kind: 'restroom' }, { name: 'Раздевалка Ж', kind: 'restroom' }, { name: 'Тренерская', kind: 'office' }],
      [{ name: 'Бассейн 25 м', kind: 'pool' }, { name: 'Трибуны', kind: 'other' }],
    ] },
  { id: 'college', name: 'Колледж электроники и информатики (8)', short: 'Колледж', kind: 'academic', color: '#fbbf24',
    doorNode: 'do.college', side: 'north', doorLabel: 'Главный вход колледжа', levels: [0, 1],
    floors: [
      [{ name: 'Фойе', kind: 'lobby' }, { name: 'Аудитория 101', kind: 'classroom' }, { name: 'Аудитория 102', kind: 'classroom' }, { name: 'Преподавательская', kind: 'office' }],
      [{ name: 'Компьютерный класс 201', kind: 'lab' }, { name: 'Лаборатория сетей 202', kind: 'lab' }, { name: 'Аудитория 203', kind: 'classroom' }],
    ] },
];

/** Холл у двери: в 6 м от дверной точки внутрь footprint (по нормали стороны). */
const hallInside = (doorPt: Pt, f: Footprint, side: EntranceDoor['side']): [number, number] => {
  const wx = lx(doorPt), wz = ly(doorPt);
  const r = footprintToWorldRect(f);
  const cx = (r.minX + r.maxX) / 2, cz = (r.minZ + r.maxZ) / 2;
  let hx = wx, hz = wz;
  switch (side) {
    case 'west': hx = Math.min(wx + 6, cx); break;   // дверь на западном фасаде → идём на восток
    case 'east': hx = Math.max(wx - 6, cx); break;
    case 'south': hz = Math.max(wz - 6, cz); break;  // юг (worldZ больше) → идём к центру
    case 'north': hz = Math.min(wz + 6, cz); break;
  }
  return [hx, hz];
};

function buildParametric(cfg: ParamCfg) {
  const f = FOOTPRINTS[cfg.id];
  const rect = footprintToWorldRect(f);
  const doorPt = DOOR_POS[cfg.doorNode];
  const hall = hallInside(doorPt, f, cfg.side);
  const horizontal = (rect.maxX - rect.minX) >= (rect.maxZ - rect.minZ);
  // коридор вдоль длинной оси: узлы каждые ~12 м
  const corPts: [number, number][] = [];
  if (horizontal) {
    const z = (rect.minZ + rect.maxZ) / 2;
    for (let x = rect.minX + 6; x <= rect.maxX - 6; x += 12) corPts.push([x, z]);
  } else {
    const x = (rect.minX + rect.maxX) / 2;
    for (let z = rect.minZ + 6; z <= rect.maxZ - 6; z += 12) corPts.push([x, z]);
  }
  const gen = buildParametricBuilding({
    buildingId: cfg.id, rect, corridorPts: corPts, hall, floors: cfg.floors,
    formatNumber: (lvl, idx) => rc(cfg.id, lvl, idx),
  });
  const doors: EntranceDoor[] = [{
    id: `door.${cfg.id}`, buildingId: cfg.id, position: { x: lx(doorPt), z: ly(doorPt) },
    outdoorNode: cfg.doorNode, indoorNode: `si.${cfg.id}.f0.hall`, side: cfg.side, label: cfg.doorLabel,
  }];
  const doorEdges: NavEdge[] = [{ from: cfg.doorNode, to: `si.${cfg.id}.f0.hall`, kind: 'through-door', bidirectional: true }];
  const verticals: VerticalConnection[] = [];
  for (let lvl = 0; lvl < cfg.levels.length - 1; lvl++) {
    const t = (l: number): string => `si.${cfg.id}.f${l}`;
    verticals.push({ id: `v.${cfg.id}.stA.${lvl}-${lvl + 1}`, buildingId: cfg.id, kind: 'stairs', position: { x: horizontal ? rect.minX + 4 : (rect.minX + rect.maxX) / 2, z: horizontal ? (rect.minZ + rect.maxZ) / 2 : rect.minZ + 4 }, fromFloor: lvl, toFloor: lvl + 1, fromNode: `${t(lvl)}.stA`, toNode: `${t(lvl + 1)}.stA`, label: 'Лестница (торец A)' });
    verticals.push({ id: `v.${cfg.id}.stB.${lvl}-${lvl + 1}`, buildingId: cfg.id, kind: 'stairs', position: { x: horizontal ? rect.maxX - 4 : (rect.minX + rect.maxX) / 2, z: horizontal ? (rect.minZ + rect.maxZ) / 2 : rect.maxZ - 4 }, fromFloor: lvl, toFloor: lvl + 1, fromNode: `${t(lvl)}.stB`, toNode: `${t(lvl + 1)}.stB`, label: 'Лестница (торец B)' });
    if (cfg.levels.length > 2) verticals.push({ id: `v.${cfg.id}.el.${lvl}-${lvl + 1}`, buildingId: cfg.id, kind: 'elevator', position: { x: horizontal ? (rect.minX + rect.maxX) / 2 : rect.minX + 4, z: horizontal ? rect.minZ + 3 : (rect.minZ + rect.maxZ) / 2 }, fromFloor: lvl, toFloor: lvl + 1, fromNode: `${t(lvl)}.el`, toNode: `${t(lvl + 1)}.el`, label: 'Лифт' });
  }
  const floorsOut: Floor[] = cfg.levels.map((lvl) => ({
    level: lvl, name: `${lvl + 1} этаж`, height: lvl * FLOOR_H, ceiling: CEIL, shape: [rect],
    roomIds: gen.rooms.filter((r) => r.floor === lvl).map((r) => r.id),
  }));
  const building: Building = { id: cfg.id, name: cfg.name, shortName: cfg.short, kind: cfg.kind, footprint: rect, levels: cfg.levels, floors: floorsOut, color: cfg.color };
  return { building, nodes: gen.nodes, edges: [...gen.edges, ...doorEdges], rooms: gen.rooms, verticals, doors };
}

const paramBuilt = PARAM_CFG.map(buildParametric);

const built=[...CONFIGS.map(build), ...paramBuilt];
export const DEMO_BUILDINGS:Building[]=built.map(b=>b.building);
export const DEMO_ROOMS:Room[]=built.flatMap(b=>b.rooms);
export const DEMO_DOORS:EntranceDoor[]=built.flatMap(b=>b.doors);
export const DEMO_VERTICALS:VerticalConnection[]=built.flatMap(b=>b.verticals);
export const DEMO_INDOOR_NODES:NavNode[]=built.flatMap(b=>b.nodes);
/** Мост 1<->ДК (стеклянный, уровень 2 этажа): passage edge, Y ровный. */
const PASSAGE:NavEdge[]=[ie('si.b1.f1.c6','si.dk.f1.c0')];
export const DEMO_INDOOR_EDGES:NavEdge[]=[...built.flatMap(b=>b.edges),...PASSAGE];

export const DEMO_CAMPUS:CampusData={
  name:'Кампус МИЭТ — пл. Шокина, 1 (layout по Яндекс-карте, корпус 1 по реальному плану)',
  buildings:DEMO_BUILDINGS,rooms:DEMO_ROOMS,doors:DEMO_DOORS,verticals:DEMO_VERTICALS,
  nodes:[...OUTDOOR_NODES,...DEMO_INDOOR_NODES],edges:[...OUTDOOR_EDGES,...DEMO_INDOOR_EDGES],
  paths:OUTDOOR_PATHS,landmarks:OUTDOOR_LANDMARKS,
};