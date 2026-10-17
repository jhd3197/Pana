// Small road-level cues, shared by the twelve circuits. No collision geometry,
// images or network payload: the same seeded batches are built on every client.
import { THREE, M, box, finish, clear } from './world-kit.js';

const EARTH = new Set(['selva', 'llanos', 'desierto', 'bululu', 'delta', 'salto']);
const COLORS = {
  estadio: [0xe5bd49, 0xc45543], plaza: [0xe4bd69, 0x418b92],
  selva: [0xc18e4d, 0x599661], llanos: [0xd2b076, 0x8a5841],
  desierto: [0xd98b51, 0xcdb37a], paramo: [0xe7dfc4, 0x7294a8],
  chichi: [0xe8c468, 0x458998], bululu: [0xf0d580, 0x53a7a5],
  salinas: [0xf0ddd3, 0xcb858f], delta: [0xd5ab69, 0x408a7a],
  cuevas: [0xc0c9c0, 0x6faaa3], salto: [0xd2bd8c, 0x6b9b87],
};

export function raceDetails(T) {
  const root = new THREE.Group(); root.name = 'race-details';
  const [light, accent] = COLORS[T.id] || COLORS.estadio;
  const positions = [], colors = [];
  const ink = new THREE.Color(EARTH.has(T.id) ? 0x715a39 : 0x323a3b);
  function point(s, off) {
    const p = T.pointAt(s), q = T.pointAt(s + 0.5), h = Math.atan2(q.x - p.x, q.y - p.y);
    const x = p.x - Math.cos(h) * off, z = p.y + Math.sin(h) * off;
    return [x, T.surfaceAt(x, z) + 0.145, z];
  }
  function stripe(s, off, len, width, color) {
    const a = point(s, off-width/2), b = point(s, off+width/2);
    const c = point(s+len, off-width/2), d = point(s+len, off+width/2);
    for (const v of [a,b,c,b,d,c]) { positions.push(...v); colors.push(color.r,color.g,color.b); }
  }
  for (let s = 20; s < T.TOTAL; s += 12) {
    const a = T.pointAt(s-8), b = T.pointAt(s), c = T.pointAt(s+8);
    const turn = Math.atan2((b.x-a.x)*(c.y-b.y)-(b.y-a.y)*(c.x-b.x), (b.x-a.x)*(c.x-b.x)+(b.y-a.y)*(c.y-b.y));
    // Paired brake marks and compacted ruts follow bends, not a straight decal.
    if (Math.abs(turn) > 0.055 && Math.sin(s*1.7)>-.6) {
      const line = -Math.sign(turn) * T.HW * 0.18;
      for (const off of [-1.0, 1.0]) stripe(s, line+off, 3.5+3*Math.abs(Math.sin(s)), EARTH.has(T.id) ? 0.2 : 0.13, ink);
    }
    // Short painted edge blocks add speed cues without covering the driving line.
    if (!EARTH.has(T.id)) for (const side of [-1, 1]) stripe(s, side*(T.HW-0.55), 3, 0.3, new THREE.Color(light));
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions,3));
  geo.setAttribute('color', new THREE.Float32BufferAttribute(colors,3)); geo.computeVertexNormals();
  const material = new THREE.MeshBasicMaterial({vertexColors:true, side:THREE.DoubleSide, transparent:true, opacity:0.48, depthWrite:false});
  const wear = new THREE.Mesh(geo,material); wear.name='road-wear'; wear.userData.detailLevel=1;
  wear.userData.dispose=()=>material.dispose(); root.add(wear);

  const props = new THREE.Group();
  const pole = M(0x77674f), cloth = [M(light), M(accent), M(0xe8dcc1)];
  let count = 0;
  // Clusters of trackside pennants frame sectors and braking zones. Both sides
  // stay outside road and shortcut clearance, and follow the actual terrain.
  for (let s = 35; s < T.TOTAL; s += 105) for (const side of [-1, 1]) {
    const p=point(s, side*(T.HW+10)), y=T.terrainAt(p[0],p[2]);
    if (!clear(T,p[0],p[2],1) || Math.abs(y-p[1])>3 || (T.def.waterAt?.(p[0],p[2],0,T)||0)>0.1) continue;
    const q=T.pointAt(s+1), a=T.pointAt(s), h=Math.atan2(q.x-a.x,q.y-a.y);
    for (let k=0;k<3;k++) {
      const x=p[0]+Math.sin(h)*k*2.6, z=p[2]+Math.cos(h)*k*2.6, ground=T.terrainAt(x,z);
      if (!clear(T,x,z,1) || Math.abs(ground-y)>1.5) continue;
      props.add(box(.12,3.8,.12,pole,x,ground+1.9,z));
      const flag=box(1.0,1.6,.035,cloth[(count+k)%3],x,ground+2.8,z);
      flag.rotation.y=h; props.add(flag);
      count++;
    }
  }
  // These low-poly accents total only a few thousand triangles. Four global
  // material batches cost less than dozens of tiny spatial/shadow draws.
  const flags=finish(props,Infinity); flags.name='sector-pennants'; flags.userData.detailLevel=2;
  root.add(flags); root.userData.pennants=count;
  return root;
}
