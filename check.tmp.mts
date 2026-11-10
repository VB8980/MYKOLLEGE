import { DEMO_CAMPUS } from './src/data/demoCampus';
import { buildGraph } from './src/lib/graph';
import { findPath } from './src/lib/astar';
const g = buildGraph(DEMO_CAMPUS);
const dkx = DEMO_CAMPUS.nodes.filter(n=>n.id==='si.dk.f1.c0'||n.id==='si.b1.f1.c6').map(n=>({id:n.id,x:n.position.x,y:n.position.y,z:n.position.z}));
console.log('bridge ends:', JSON.stringify(dkx));
// rectorate via bridge (should NOT be shorter, but path must exist both ways)
console.log('do.dk -> 1222:', (()=>{const r=findPath(g,'do.dk','si.b1.room.rectorate');return r?r.path.map(p=>p.id).join(' -> '):'NOT FOUND';})());
// parametric buildings reachable
for (const [door,num] of [['do.college','5801'],['do.sport','5101'],['do.uk3','3101'],['do.uk4','4101'],['do.dk','2101']] as [string,string][]) {
  const room = DEMO_CAMPUS.rooms.find(r=>r.number===num);
  if(!room){console.log(num,'ROOM MISSING');continue;}
  const r = findPath(g, door, `si.${room.buildingId}.room.${room.id}`);
  console.log(`${door} -> ${num}:`, r?`${r.path.length} nodes`:'NOT FOUND');
}
