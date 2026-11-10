/**
 * Улицы МИЭТ по топологии Яндекс-карты (пл. Шокина, 1). Север = -Z, восток = +X, метры.
 * Магистрали = полилинии близких узлов (шаг 25-35 м) -> рисуются как дороги, не паутина.
 * Каждое ребро <= ~45 м (соседство в polyline + короткие отводы к дверям).
 * Door-узлы do.* стоят в тротуаре у фасада и подключены к ближайшей магистрали.
 */
import type { Landmark, NavEdge, NavNode, OutdoorPath, Vec2 } from './types';

const v = (x: number, z: number): Vec2 => ({ x, z });
const n = (id: string, type: NavNode['type'], x: number, z: number, label?: string): NavNode =>
  ({ id, type, position: { x, y: 0, z }, ...(label ? { label } : {}) });
const e = (from: string, to: string): NavEdge => ({ from, to, kind: 'street', bidirectional: true });
const p = (id: string, name: string, nodeIds: string[], width: number, surface: OutdoorPath['surface']): OutdoorPath =>
  ({ id, name, nodeIds, width, surface });

export const OUTDOOR_NODES: NavNode[] = [
  // Солнечная аллея — диагональ юг (запад-юг -> восток)
  n('sun0','street',-235,125), n('sun1','street',-180,118,'Остановка «Запад»'),
  n('sun2','street',-125,112), n('sun3','street',-70,108), n('sun4','street',-15,105,'Остановка «Главный вход»'),
  n('sun5','street',40,104), n('sun6','street',95,106), n('sun7','street',150,112), n('sun8','street',178,120),
  // Центральный проспект — вертикаль восток
  n('cen0','street',178,-150), n('cen1','street',178,-105), n('cen2','street',178,-60),
  n('cen3','street',178,-15), n('cen4','street',178,30), n('cen5','street',178,75),
  // Площадь Шокина / аллея к порталу 1 и ДК
  n('pla1','street',140,-30), n('pla2','plaza',105,-45,'Плац / площадь Шокина'), n('pla3','street',78,-70),
  // Западная аллея (Протон / 3 / 4) в зазоре x=-130
  n('wes1','street',-130,80), n('wes2','street',-130,45), n('wes3','street',-130,10),
  n('wes4','street',-130,-25), n('wes5','street',-130,-60),
  // Двери (тротуар у фасада)
  n('do.b1','door-outdoor',73,-85,'Главный вход (портал)'),
  n('do.dk','door-outdoor',77,-85,'Вход ДК МИЭТ'),
  n('do.uk3','door-outdoor',-128,12,'Вход корпуса 3'),
  n('do.uk4','door-outdoor',-133,-80,'Вход корпуса 4'),
  n('do.proton','door-outdoor',-122,10,'Вход Протон (учебный)'),
  n('do.college','door-outdoor',-150,108,'Вход колледжа'),
];

export const OUTDOOR_EDGES: NavEdge[] = [
  // SUN
  e('sun0','sun1'), e('sun1','sun2'), e('sun2','sun3'), e('sun3','sun4'), e('sun4','sun5'),
  e('sun5','sun6'), e('sun6','sun7'), e('sun7','sun8'),
  // CENTRAL (cen6 = sun8 общий узел через координату -> связываем явно)
  e('cen0','cen1'), e('cen1','cen2'), e('cen2','cen3'), e('cen3','cen4'), e('cen4','cen5'), e('cen5','sun8'),
  // PLAZA (cen3 -> pla1 -> pla2 -> pla3 -> do.b1 ; pla3 -> do.dk)
  e('cen3','pla1'), e('pla1','pla2'), e('pla2','pla3'), e('pla3','do.b1'), e('pla3','do.dk'),
  // WEST (sun2 -> wes1..wes5)
  e('sun2','wes1'), e('wes1','wes2'), e('wes2','wes3'), e('wes3','wes4'), e('wes4','wes5'),
  // отводы дверей к магистралям
  e('wes3','do.proton'), e('wes3','do.uk3'), e('wes5','do.uk4'), e('sun1','do.college'),
];

export const OUTDOOR_PATHS: OutdoorPath[] = [
  p('path.sun','Солнечная аллея',['sun0','sun1','sun2','sun3','sun4','sun5','sun6','sun7','sun8'],8,'asphalt'),
  p('path.central','Центральный проспект',['cen0','cen1','cen2','cen3','cen4','cen5','sun8'],6,'asphalt'),
  p('path.plaza','Аллея площади Шокина',['cen3','pla1','pla2','pla3','do.b1'],5,'paving'),
  p('path.west','Западная аллея',['sun2','wes1','wes2','wes3','wes4','wes5'],4,'paving'),
];

export const OUTDOOR_LANDMARKS: Landmark[] = [
  { id:'lm.plaza', name:'Площадь Шокина', position:v(105,-45), icon:'🟫' },
  { id:'lm.busw', name:'Остановка «Запад»', position:v(-180,118), icon:'🚌' },
  { id:'lm.busc', name:'Остановка «Главный вход»', position:v(-15,105), icon:'🚌' },
  { id:'lm.gate', name:'Главный вход кампуса', position:v(73,-85), icon:'🚪' },
];