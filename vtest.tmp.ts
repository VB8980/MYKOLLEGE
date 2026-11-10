import { DEMO_CAMPUS } from './src/data/demoCampus';

const ids = new Set(DEMO_CAMPUS.nodes.map(n=>n.id));
// find duplicate node id(s)
const seen = new Set<string>(); const dups: string[] = [];
for (const n of DEMO_CAMPUS.nodes) { if (seen.has(n.id)) dups.push(n.id); seen.add(n.id); }
console.log('duplicate node ids:', dups);
// also check dup between outdoor+indoor arrays already covered.

for (const num of ['1222', '1206', '1107']) {
  const room = DEMO_CAMPUS.rooms.find(r => r.number === num);
  console.log(num, room ? `room ok: ${room.name}` : 'ROOM NOT FOUND');
}

const adj = new Map<string, string[]>();
for (const e of DEMO_CAMPUS.edges) {
  if (!adj.has(e.from)) adj.set(e.from, []);
  if (!adj.has(e.to)) adj.set(e.to, []);
  adj.get(e.from)!.push(e.to);
  adj.get(e.to)!.push(e.from);
}
for (const door of ['do.b1','do.dk','do.uk3','do.uk4','do.sport','do.college','do.proton']) {
  const s = new Set<string>([door]); const q=[door];
  while(q.length){const c=q.shift()!;for(const nx of adj.get(c)??[])if(!s.has(nx)){s.add(nx);q.push(nx);}}
  const bset=new Set<string>(); for(const n of DEMO_CAMPUS.nodes) if(s.has(n.id)&&n.id.startsWith('si.'))bset.add(n.id.split('.')[1]);
  console.log(door,'reach:',s.size,'buildings:',[...bset].join(','));
}
const pe = DEMO_CAMPUS.edges.filter(e=>e.kind==='passage');
console.log('passage edges:', pe.map(e=>`${e.from}->${e.to}`));
for (const e of pe) {
  const a = DEMO_CAMPUS.nodes.find(n=>n.id===e.from), b = DEMO_CAMPUS.nodes.find(n=>n.id===e.to);
  if(!a||!b){console.log('MISSING NODE', e.from, e.to);continue;}
  console.log('Y:', a.position.y, b.position.y, a.position.y===b.position.y?'SAME-Y OK':'Y MISMATCH');
}
