// The river world (Curiara, Lancha): terrain and water built from river.js,
// plus lights and sky.
// Scenery dressing lives in landscape.js; this file owns only the ground truth
// shared with the simulation (banks, bed, levels, raudal faces).
import * as THREE from 'three';
import { createSky } from '/engine/worlds/sky.js';
import { waterSurface, waterAnimator } from '/engine/models/effects/water-surface.js';
import { smooth } from './river.js';
import { shadowSize } from '/engine/settings.js';

export const DAYLIGHT = { horizon: 0xc9dccf, skyTop: 0x3f8fc4, cloudCover: .46, skySeed: 31, hemiSky: 0xe6f4ff, hemiGround: 0x4a6a3a, hemiInt: 1.45, sun: 0xfff0d2, sunInt: 2.4, fog: [90, 1100] };

// Water per tramo: caño green-brown, raudal amber whitewater, Río Negro tea-black.
const TINTS = [
  { shallow: 0x56703c, deep: 0x26331a, sky: 0x8a9c86, foam: 0xd8e0c8 },
  { shallow: 0x8a6c3c, deep: 0x3d2a14, sky: 0xa3ada2, foam: 0xf4f1e4 },
  { shallow: 0x4a3420, deep: 0x110b05, sky: 0x58666b, foam: 0xc9b18a },
];

function ribbon(path, river, { from = 0, to = path.length, extra = 1.6, half, step = 1.4, columns = 18, level, fine = [] }) {
  const rows = [];
  for (let s = from; s < to; s += step) {
    rows.push(s);
    for (const f of fine) if (f > s && f < s + step) for (let k = -6; k <= 6; k++) rows.push(f + k * .13);
  }
  rows.push(to); rows.sort((a, b) => a - b);
  const ps = [], depth = [], flow = [], ix = [];
  rows.forEach((s, i) => {
    const w = half(s) + extra;
    for (let j = 0; j <= columns; j++) {
      const off = (j / columns * 2 - 1) * w, p = path.at(s, off), y = level(s, off);
      ps.push(p.x, y, p.z); depth.push(y - river.groundAt(p.x, p.z)); flow.push(off, s);
      if (i < rows.length - 1 && j < columns) { const n = i * (columns + 1) + j; ix.push(n, n + columns + 1, n + 1, n + 1, n + columns + 1, n + columns + 2); }
    }
  });
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(ps, 3));
  geo.setAttribute('waterDepth', new THREE.Float32BufferAttribute(depth, 1));
  geo.setAttribute('waterFlow', new THREE.Float32BufferAttribute(flow, 2));
  geo.setIndex(ix); geo.computeVertexNormals();
  return geo;
}

export function createRiverWorld(river, { dress } = {}) {
  const group = new THREE.Group(); group.name = 'El río';
  group.userData.assetCounts = {};
  // Terrain grid over the river's bounds.
  const all = [...river.main.samples, ...(river.branch?.path.samples || [])];
  const margin = 90, minX = Math.min(...all.map(p => p.x)) - margin, maxX = Math.max(...all.map(p => p.x)) + margin;
  const minZ = Math.min(...all.map(p => p.z)) - margin, maxZ = Math.max(...all.map(p => p.z)) + margin, cell = 2.6;
  const nx = Math.ceil((maxX - minX) / cell), nz = Math.ceil((maxZ - minZ) / cell);
  const ps = [], colors = [], ix = [], c = new THREE.Color();
  const mud = new THREE.Color(0x4a3d2a), sand = new THREE.Color(0xcdb487), floor = new THREE.Color(0x3e5a2c), moss = new THREE.Color(0x56763a), rock = new THREE.Color(0x6d665a);
  for (let j = 0; j <= nz; j++) for (let i = 0; i <= nx; i++) {
    const x = minX + i * cell, z = minZ + j * cell, w = river.locate(x, z), y = river.groundAt(x, z), q = w.edge;
    ps.push(x, y, z);
    const look = river.def.look?.(w.s, w.offset) || {};
    if (q < 0) c.copy(mud).lerp(sand, (look.sand || 0) * smooth(-4, 0, q));
    else c.copy(look.sand ? sand : moss).lerp(floor, smooth(1, 9, q) * (1 - (look.sand || 0) * (1 - smooth(6, 14, q))));
    if (look.rock) c.lerp(rock, look.rock * (1 - smooth(4, 16, q)));
    c.multiplyScalar(.92 + .08 * Math.sin(x * .21 + Math.cos(z * .17) * 2) * Math.cos(z * .13));
    colors.push(c.r, c.g, c.b);
    if (i < nx && j < nz) { const a = j * (nx + 1) + i; ix.push(a, a + nx + 1, a + 1, a + 1, a + nx + 1, a + nx + 2); }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(ps, 3));
  geo.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  geo.setIndex(ix); geo.computeVertexNormals();
  const land = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1 }));
  land.name = 'Riberas'; land.receiveShadow = true; group.add(land);
  group.userData.bounds = { minX, maxX, minZ, maxZ };

  // Water, one mesh per tramo so each keeps its own colour. Raudal faces are
  // sampled finely so the drop reads as a sheet, not a ramp.
  const fine = river.drops.flatMap(d => d.lanes.flatMap(l => l.steps.map(([ds]) => d.s + ds)));
  const cuts = [0, ...(river.def.tints || []), river.LENGTH];
  const water = [];
  for (let k = 0; k < cuts.length - 1; k++) {
    const tint = TINTS[Math.min(k, 2)];
    const g = ribbon(river.main, river, { from: cuts[k], to: cuts[k + 1] + (k < cuts.length - 2 ? .7 : 0), half: river.halfWidth, level: river.levelAt, fine });
    const m = waterSurface(g, { kind: 'river', color: tint.shallow, amplitude: .02, opacity: .95 });
    m.material.uniforms.deep.value.setHex(tint.deep); m.material.uniforms.sky.value.setHex(tint.sky); m.material.uniforms.foam.value.setHex(tint.foam);
    m.name = `Agua · tramo ${k + 1}`; group.add(m); water.push(m);
  }
  if (river.branch) {
    const b = river.branch, g = ribbon(b.path, river, { half: () => b.half, level: (s) => river.levelAt(b.from + b.mainLength * s / b.length), step: 1.2, columns: 10 });
    const m = waterSurface(g, { kind: 'river', color: 0x4e6a3c, amplitude: .012, opacity: .92 });
    m.material.uniforms.deep.value.setHex(0x22301a); m.material.uniforms.sky.value.setHex(0x7d907a); m.name = 'Agua · igapó'; group.add(m); water.push(m);
  }
  const moving = [], racers = [];
  dress?.({ group, river, moving, racers });
  const animateWater = waterAnimator(group);
  // Planted cells past the fog's thick part are skipped outright.
  const far = []; group.traverse(o => { if (o.userData.farCull) far.push(o); });
  let disposed = false;
  return {
    group, water, river,
    cull(camera, distance = 200) {
      for (const o of far) { const b = o.boundingSphere; o.visible = !b || camera.position.distanceTo(b.center) - b.radius < distance; }
    },
    update(t, dt = 0) { animateWater(t); for (const o of moving) o.userData.tick?.(t, dt); },
    // Creatures that follow the race clock (toninas, caimanes) so every screen agrees.
    race(state, time) { for (const f of racers) f(state, time); },
    dispose() {
      if (disposed) return; disposed = true;
      const ds = [], gs = new Set(), ms = new Set(), ts = new Set();
      group.traverse(o => {
        if (o.userData.dispose) ds.push(o.userData.dispose);
        if (o.geometry) gs.add(o.geometry);
        for (const m of Array.isArray(o.material) ? o.material : o.material ? [o.material] : []) { ms.add(m); for (const v of Object.values(m)) if (v?.isTexture) ts.add(v); }
      });
      ds.forEach(f => f()); gs.forEach(g => g.dispose()); ms.forEach(m => m.dispose()); ts.forEach(t => t.dispose());
      group.removeFromParent();
    },
  };
}

export function createRaceScene(canvas, river, options = {}) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  renderer.setClearColor(DAYLIGHT.horizon); renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.outputColorSpace = THREE.SRGBColorSpace; renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1;
  // A longer course can push the fog out with `def.fog`.
  const fog = river.def.fog || DAYLIGHT.fog, scene = new THREE.Scene(); scene.fog = new THREE.Fog(DAYLIGHT.horizon, ...fog);
  const sky = createSky(DAYLIGHT); scene.add(sky.mesh);
  scene.add(new THREE.HemisphereLight(DAYLIGHT.hemiSky, DAYLIGHT.hemiGround, DAYLIGHT.hemiInt));
  const sun = new THREE.DirectionalLight(DAYLIGHT.sun, DAYLIGHT.sunInt);
  sun.position.set(-40, 70, 30); sun.castShadow = true; sun.shadow.mapSize.setScalar(shadowSize(1024));
  Object.assign(sun.shadow.camera, { left: -26, right: 26, top: 26, bottom: -26, far: 180 });
  sun.shadow.bias = -.0003; sun.shadow.normalBias = .035; scene.add(sun, sun.target);
  const world = createRiverWorld(river, options); scene.add(world.group);
  const camera = new THREE.PerspectiveCamera(55, 1, .1, Math.max(1600, fog[1] + 500));
  return { renderer, scene, camera, sun, world, sky };
}
