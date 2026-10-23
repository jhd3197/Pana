// Small road-level cues, shared by the twelve circuits. No collision geometry,
// images or network payload: the same seeded batches are built on every client.
import { THREE, clear } from './world-kit.js';
import { instancePlacements } from '/engine/models/core/static-batch.js';
import { fiestaFlags } from '/engine/models/props/fiesta.js';
import { roadStyle } from './road-material.js';
import { reflectorPost } from '/engine/models/props/wood-sign.js';

const EARTH = new Set(['selva', 'llanos', 'desierto', 'bululu', 'delta', 'salto']);
const COLORS = {
  // Bright festival pairs: a sunny light and a saturated accent per circuit.
  estadio: [0xffc93c, 0xff4f5e], plaza: [0xffd060, 0x2fb5c8],
  selva: [0xc18e4d, 0x599661], llanos: [0xffcf4a, 0xe8513a],
  desierto: [0xff9a4a, 0x3ec1ff], paramo: [0xffe066, 0x8f6ff0],
  chichi: [0xffd23f, 0x2fa8d8], bululu: [0xffe27a, 0xff6fb5],
  salinas: [0xf0ddd3, 0xcb858f], delta: [0xffc24a, 0xff4a3d],
  cuevas: [0xb6f0e0, 0x2fc4b0], salto: [0xffd060, 0xff5a4a],
  puerto: [0xffd23f, 0x2f8fe0],
};

export function raceDetails(T) {
  const root = new THREE.Group(); root.name = 'race-details';
  const [light, accent] = COLORS[T.id] || COLORS.estadio;
  // Edge lines and centre lines are painted into the road texture (road-material.js).
  const positions = [], colors = [];
  // Marks are a darker shade of the painted surface, never a grey band on earth.
  const style = roadStyle(T), ink = style.surface === 'asphalt' || !style.base ? new THREE.Color(0x323a3b) : new THREE.Color(style.base).multiplyScalar(.45);
  function point(s, off) {
    const p = T.pointAt(s), q = T.pointAt(s + 0.5), h = Math.atan2(q.x - p.x, q.y - p.y);
    const x = p.x - Math.cos(h) * off, z = p.y + Math.sin(h) * off;
    return [x, T.surfaceAt(x, z,T.heightAtS(s)) + 0.145, z];
  }
  function stripe(s, off, len, width, color) {
    const a = point(s, off-width/2), b = point(s, off+width/2);
    const c = point(s+len, off-width/2), d = point(s+len, off+width/2);
    for (const v of [a,b,c,b,d,c]) { positions.push(...v); colors.push(color.r,color.g,color.b); }
  }
  for (let s = 20; s < T.TOTAL; s += 12) {
    if(T.gapAt?.(s)||T.gapAt?.(s+7))continue;
    const a = T.pointAt(s-8), b = T.pointAt(s), c = T.pointAt(s+8);
    const turn = Math.atan2((b.x-a.x)*(c.y-b.y)-(b.y-a.y)*(c.x-b.x), (b.x-a.x)*(c.x-b.x)+(b.y-a.y)*(c.y-b.y));
    // Paired brake marks and compacted ruts follow bends, not a straight decal.
    if (Math.abs(turn) > 0.055 && Math.sin(s*1.7)>-.6) {
      const line = -Math.sign(turn) * T.HW * 0.18;
      for (const off of [-1.0, 1.0]) stripe(s, line+off, 3.5+3*Math.abs(Math.sin(s)), EARTH.has(T.id) ? 0.2 : 0.13, ink);
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions,3));
  geo.setAttribute('color', new THREE.Float32BufferAttribute(colors,3)); geo.computeVertexNormals();
  const material = new THREE.MeshBasicMaterial({vertexColors:true, side:THREE.DoubleSide, transparent:true, opacity:0.48, depthWrite:false});
  const wear = new THREE.Mesh(geo,material); wear.name='road-wear'; wear.userData.detailLevel=1;
  wear.userData.dispose=()=>material.dispose(); root.add(wear);

  // Clusters of library feather flags frame sectors and braking zones. Both
  // sides stay outside road and shortcut clearance and follow the terrain.
  const sites = [], signs = [], seen = new THREE.Vector3();
  T.group?.traverse(o => { if (o.name === 'sign-board') { o.getWorldPosition(seen); signs.push([seen.x, seen.z, (o.geometry.parameters?.width || 6) / 2 + 5]); } });
  for (const [u] of T.def.sectors || []) for (const ds of [0, 22, -22]) { const a = T.pointAt(T.TOTAL * u + ds); signs.push([a.x, a.y, T.HW + 16]); }
  // No fiesta pennants underground (def.indoors lists [from, to] cave
  // stretches in u) or out on a lagoon (T.openWater).
  const indoors = s => (T.def.indoors || []).some(([a, b]) => s / T.TOTAL > a - .01 && s / T.TOTAL < b + .01);
  for (let s = 35; s < T.TOTAL; s += 105) for (const side of [-1, 1]) {
    if (indoors(s)) continue;
    const p=point(s, side*(T.HW+10)), y=T.terrainAt(p[0],p[2]);
    if (!clear(T,p[0],p[2],1) || Math.abs(y-p[1])>3 || (T.def.waterAt?.(p[0],p[2],0,T)||0)>0.1 || T.openWater?.surfaceAt(p[0],p[2]) != null) continue;
    const q=T.pointAt(s+1), a=T.pointAt(s), h=Math.atan2(q.x-a.x,q.y-a.y);
    const x=p[0]+Math.sin(h)*4.4, z=p[2]+Math.cos(h)*4.4;
    if (!clear(T,x,z,1) || Math.abs(T.terrainAt(x,z)-y)>1.5) continue;
    if (signs.some(([sx, sz, r]) => Math.hypot(sx - p[0], sz - p[2]) < r || Math.hypot(sx - x, sz - z) < r)) continue;
    sites.push({ x: p[0], y, z: p[2], rot: h });
  }
  const flags = new THREE.Group(); flags.name = 'sector-pennants'; flags.userData.detailLevel = 2;
  if (sites.length) instancePlacements(flags, fiestaFlags({ seed: T.TOTAL | 0, colors: [light, accent, 0xfffaf0] }), sites, { name: 'sector-pennants', cellSize: Infinity });
  root.add(flags); root.userData.pennants = sites.length * 3;

  // Mountain asphalt gets delineators outside its rails, where the verge is
  // level with the road and nothing else stands.
  if (style.posts) {
    const posts = [];
    for (let s = 9; s < T.TOTAL; s += 18) for (const side of [-1, 1]) {
      if (indoors(s) || T.gapAt?.(s)) continue;
      const p = point(s, side * (T.HW + 2.2)), y = T.terrainAt(p[0], p[2]);
      if (Math.abs(y - (p[1] - .145)) > .9 || !clear(T, p[0], p[2], -3) || (T.def.waterAt?.(p[0], p[2], 0, T) || 0) > .05) continue;
      if (signs.some(([sx, sz, r]) => Math.hypot(sx - p[0], sz - p[2]) < r - 3)) continue;
      const a = T.pointAt(s), q = T.pointAt(s + 1);
      posts.push({ x: p[0], y, z: p[2], rot: Math.atan2(q.x - a.x, q.y - a.y) });
    }
    const group = new THREE.Group(); group.name = 'reflector-posts'; group.userData.detailLevel = 2;
    if (posts.length) instancePlacements(group, reflectorPost(), posts, { name: 'reflector-posts', cellSize: Infinity });
    root.add(group); root.userData.posts = posts.length;
  }
  return root;
}
