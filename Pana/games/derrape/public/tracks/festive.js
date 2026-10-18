// Fiesta roadside dressing shared by the circuits. Every object placed here
// is a Pana Studio library model (engine/models): blooming trees and shrubs
// in their low-detail variants, fiesta props, kiosks, library rocks, instanced
// bird flocks and morpho fields. This file only decides where they go, plus
// the distant terrain silhouettes (hills, peaks, mesas) that widen each vista.
// Seeded: every client builds the same scene.
import * as THREE from 'three';
import { rng } from '/engine/models/core/primitives.js';
import { instancePlacements } from '/engine/models/core/static-batch.js';
import { araguaney } from '/engine/models/vegetation/araguaney.js';
import { palm } from '/engine/models/vegetation/palm.js';
import { trinitaria } from '/engine/models/vegetation/trinitaria.js';
import { hibiscus } from '/engine/models/vegetation/hibiscus.js';
import { heliconia } from '/engine/models/vegetation/heliconia.js';
import { bromeliad } from '/engine/models/vegetation/bromeliad.js';
import { banana } from '/engine/models/vegetation/banana.js';
import { agave } from '/engine/models/vegetation/agave.js';
import { mossRock } from '/engine/models/vegetation/moss-rock.js';
import { gardenRosette } from '/engine/models/vegetation/garden-rosette.js';
import { lajaRock } from '/engine/models/props/amazonas.js';
import { iceCreamCart } from '/engine/models/props/ice-cream-cart.js';
import { beachShade } from '/engine/models/props/beach.js';
import { balloonBunch, fiestaFlags, buntingLine, checkeredBanner, hotAirBalloon, FIESTA_COLORS } from '/engine/models/props/fiesta.js';
import { scarletMacaw } from '/engine/models/fauna/birds/scarlet-macaw.js';
import { scarletIbis } from '/engine/models/fauna/birds/scarlet-ibis.js';
import { soaringVulture } from '/engine/models/fauna/birds/soaring-vulture.js';
import { birdFlock } from '/engine/models/animation/bird-flock.js';
import { morphoField } from '/engine/models/fauna/morpho.js';
import { clear } from './world-kit.js';

export { FIESTA_COLORS as FESTIVE };

// Library factories by theme name; dense roadside use takes the low variants.
const MODELS = {
  araguaney: s => araguaney({ seed: s, detail: 'low' }),
  apamate: s => araguaney({ seed: s, detail: 'low', bloom: 'pink' }),
  bucare: s => araguaney({ seed: s, detail: 'low', bloom: 'coral' }),
  palm: s => palm({ seed: s, h: 8, detail: 'low' }),
  trinitaria: s => trinitaria({ seed: s, detail: 'low', height: 3.4 }),
  hibiscus: s => hibiscus({ seed: s, detail: 'low' }),
  heliconia: s => heliconia({ seed: s, detail: 'low' }),
  bromeliad: s => bromeliad({ seed: s }),
  banana: s => banana({ seed: s }),
  agave: s => agave({ seed: s }),
  rosette: s => gardenRosette({ seed: s, detail: 'low' }),
  mossRock: s => mossRock({ seed: s }),
  laja: s => lajaRock({ seed: s, radius: 1.6 }),
};
const BIRDS = { macaw: scarletMacaw, ibis: scarletIbis, vulture: soaringVulture };

function sampler(T, ground, { maxDrop = 3.5, minY = .3, accept = () => true, skip = () => false }) {
  return (s, off, radius) => {
    s = ((s % T.TOTAL) + T.TOTAL) % T.TOTAL;
    if (T.gapAt?.(s) || skip(s)) return null;
    const p = T.pointAt(s), q = T.pointAt(s + .5), h = Math.atan2(q.x - p.x, q.y - p.y);
    const x = p.x - Math.cos(h) * off, z = p.y + Math.sin(h) * off;
    if (!clear(T, x, z, radius)) return null;
    const y = ground(x, z), road = T.heightAtS(s);
    if (!Number.isFinite(y) || y < minY || Math.abs(y - road) > maxDrop) return null;
    if ((T.def.waterAt?.(x, z, 0, T) || 0) > .05) return null;
    if (!accept(x, z, y, s)) return null;
    return { x, y: y - .04, z, h, s, side: Math.sign(off) };
  };
}

export function festive(group, T, theme = {}) {
  const { seed = 1, colors = FIESTA_COLORS, cell = Infinity } = theme;
  const ground = group.userData.groundAt || T.terrainAt, r = rng(seed), at = sampler(T, ground, theme);
  const root = new THREE.Group(); root.name = 'festive-roadside';
  // Respect footprints already claimed by landmarks and buildings.
  const placed = [...(theme.avoid || [])], counts = {}, seen = new THREE.Vector3();
  T.group?.updateMatrixWorld(true);
  T.group?.traverse(o => { const fr = o.userData.footprintRadius; if (fr && o !== T.group) { o.getWorldPosition(seen); placed.push({ x: seen.x, z: seen.z, r: fr * (o.scale.x || 1) }); } });
  // Never hide a sign: painted boards already built, and the sector signs
  // the runtime adds after scenery (both sides, either side of the mark).
  T.group?.traverse(o => { if (o.name === 'sign-board') { o.getWorldPosition(seen); placed.push({ x: seen.x, z: seen.z, r: (o.geometry.parameters?.width || 6) / 2 + 4 }); } });
  for (const [u] of T.def.sectors || []) for (const ds of [0, 22, -22]) for (const side of [-1, 1]) {
    const s = T.TOTAL * u + ds, p = T.pointAt(s), q = T.pointAt(s + .5), h = Math.atan2(q.x - p.x, q.y - p.y), off = side * (T.HW + 6);
    placed.push({ x: p.x - Math.cos(h) * off, z: p.y + Math.sin(h) * off, r: 8 });
  }
  const free = (p, rad) => !placed.some(q => Math.hypot(q.x - p.x, q.z - p.z) < q.r + rad);
  // band: metres beyond the clearance clear() already enforces (HW + 5 + rad).
  const spot = (s, band, rad, sides = [-1, 1], space = rad) => {
    for (let tries = 0; tries < 6; tries++) {
      const side = sides[Math.floor(r() * sides.length)], off = side * (T.HW + 5.2 + rad + band[0] + r() * (band[1] - band[0]));
      const p = at(s + (tries ? (r() - .5) * 14 : 0), off, rad);
      if (p && free(p, space)) { placed.push({ x: p.x, z: p.z, r: space }); return p; }
    }
    return null;
  };
  const lists = new Map();
  // Only trees and stands cast shadows; low shrubs, props and rocks skip the
  // shadow pass (it would double their draws for little visible gain).
  const add = (key, make, p, rot = r() * Math.PI * 2, scale = 1, shadow = false) => {
    if (!lists.has(key)) lists.set(key, { make, points: [], shadow });
    lists.get(key).points.push({ x: p.x, y: p.y, z: p.z, rot, scale }); counts[key] = (counts[key] || 0) + 1;
  };
  const every = (step, fn) => { if (!step) return; for (let s = r() * step; s < T.TOTAL; s += step * (.75 + r() * .5)) fn(s); };
  // Order matters: big things claim room first.
  every(theme.stands, s => { if ((counts[theme.stand || 'cart'] || 0) >= (theme.maxStands ?? 5)) return; const p = spot(s, [0, 3], 1.5, undefined, 3.5); if (p) add(theme.stand || 'cart', null, p, p.h + Math.PI / 2 * p.side, 1, true); });
  every(theme.banners, s => { const p = spot(s, [0, 2], 1, undefined, 4); if (p) add('banner', null, p, p.h); });
  every(theme.bunting, s => { const p = spot(s, [0, 1.5], .5, undefined, 11); if (p) add('bunting', null, p, p.h); });
  for (const [kind, n, band = [1, 18], size = 1] of theme.trees || []) for (let i = 0; i < n; i++) {
    const p = spot(r() * T.TOTAL, band, 2.4 * size, undefined, 3.2 * size); if (p) add(kind, MODELS[kind], p, undefined, size * 1.35 * (.85 + r() * .4), true);
  }
  every(theme.balloons, s => { const p = spot(s, [0, 3], .8, undefined, 1.5); if (p) add('balloons', null, p); });
  every(theme.flags, s => { for (const side of [-1, 1]) { const p = spot(s, [0, 1], .5, [side], 4); if (p) add('flags', null, p, p.h); } });
  for (const [kind, n, band = [0, 9], size = 1] of theme.plants || []) for (let i = 0; i < n; i++) {
    const p = spot(r() * T.TOTAL, band, .9 * size, undefined, 1.4 * size); if (p) add(kind, MODELS[kind], p, undefined, size * 1.3 * (.8 + r() * .5));
  }
  const props = {
    cart: () => iceCreamCart(), shade: () => beachShade(), banner: () => checkeredBanner({ accent: colors[0] }),
    bunting: () => buntingLine({ seed, colors, span: 18 }), balloons: () => balloonBunch({ seed, colors }), flags: () => fiestaFlags({ seed, colors }),
  };
  for (const [key, { make, points, shadow }] of lists) {
    const source = (make || props[key])(seed + key.length);
    instancePlacements(root, source, points, { name: `festive-${key}`, cellSize: cell, castShadow: shadow });
  }

  // Grand vistas: rolling hills, rounded peaks or tepuy mesas past the
  // playable area, inside the fog so they read as soft silhouettes, with a
  // few library hot-air balloons drifting above.
  const ticks = [];
  if (theme.vista) {
    let lo = [Infinity, Infinity], hi = [-Infinity, -Infinity];
    for (let s = 0; s < T.TOTAL; s += 10) { const p = T.pointAt(s); lo = [Math.min(lo[0], p.x), Math.min(lo[1], p.y)]; hi = [Math.max(hi[0], p.x), Math.max(hi[1], p.y)]; }
    const mid = [(lo[0] + hi[0]) / 2, (lo[1] + hi[1]) / 2], reach = Math.hypot(hi[0] - lo[0], hi[1] - lo[1]) / 2, fogFar = T.def.palette?.fog?.[1] ?? 1500;
    const { radius = Math.max(reach * 1.25 + 150, fogFar * .72), hills = 0, colors: hillColors = [0x7cc56a], height = [40, 110], balloons: hot = 0, center = mid, y = 0, shape = 'hill', top = 0x5fae4a, snow = false } = theme.vista;
    root.add(horizon({ r, hills, radius, center, height, hillColors, y, shape, top, snow }));
    const floats = [];
    for (let i = 0; i < hot; i++) { const a = r() * 6.28, d = radius * (.4 + r() * .4); floats.push({ x: center[0] + Math.cos(a) * d, z: center[1] + Math.sin(a) * d, y: y + 60 + r() * 70, rot: r() * 6, scale: 1 + r() * .5 }); }
    if (floats.length) { const mesh = instancePlacements(root, hotAirBalloon({ seed, colors }), floats, { name: 'festive-hot-air', cellSize: Infinity, castShadow: false }); counts.hotAir = floats.length;
      // A slow bob keeps them alive without per-balloon draws.
      const base = mesh.map(m => m.position.y); ticks.push(t => mesh.forEach((m, i) => { m.position.y = base[i] + Math.sin(t * .25) * 4; })); }
  }
  for (const spec of theme.birds || []) {
    const routes = Array.from({ length: spec.flocks || 1 }, () => {
      const s = r() * T.TOTAL, p = T.pointAt(s), q = T.pointAt(s + 1), h = Math.atan2(q.x - p.x, q.y - p.y), off = (r() < .5 ? -1 : 1) * (T.HW + 25 + r() * 30);
      const cx = p.x - Math.cos(h) * off, cz = p.y + Math.sin(h) * off, [h0, h1] = spec.height || [16, 30];
      return { cx, cz, cy: ground(cx, cz) + h0 + r() * (h1 - h0), r: 25 + r() * 35, speed: (.16 + r() * .1) * (r() < .5 ? -1 : 1), phase: r() * 6.28 };
    });
    const flock = birdFlock(BIRDS[spec.kind]({ seed: seed + 3, detail: 'low' }), { routes, size: spec.size || 5, seed, scale: spec.scale || 1.2 });
    flock.userData.detailLevel = 1; root.add(flock); counts[`flock-${spec.kind}`] = routes.length * (spec.size || 5);
  }
  if (theme.butterflies) {
    const points = [];
    for (let i = 0; i < theme.butterflies * 3 && points.length < theme.butterflies; i++) { const p = at(r() * T.TOTAL, (r() < .5 ? -1 : 1) * (T.HW + 2 + r() * 8), 0); if (p) points.push(p); }
    const field = morphoField({ points, seed, scale: 2.2 }); field.userData.detailLevel = 1; root.add(field); counts.morphos = points.length;
  }
  if (ticks.length) root.userData.tick = (t, dt) => ticks.forEach(f => f(t, dt));
  root.userData.counts = counts;
  group.add(root);
  return root;
}

// Distant silhouettes: one merged, smooth vertex-coloured mesh (one draw).
const hillShape = new THREE.IcosahedronGeometry(1, 2), mesaShape = new THREE.CylinderGeometry(.62, 1, 1, 9, 1);
function horizon({ r, hills, radius, center, height, hillColors, y, shape, top, snow }) {
  const positions = [], colors = [], m = new THREE.Matrix4(), q = new THREE.Quaternion(), c = new THREE.Color();
  const put = (geo, x, py, z, sx, sy, sz, ry, hex) => {
    const g = geo.index ? geo.toNonIndexed() : geo.clone(); m.compose(new THREE.Vector3(x, py, z), q.setFromEuler(new THREE.Euler(0, ry, 0)), new THREE.Vector3(sx, sy, sz)); g.applyMatrix4(m);
    const p = g.attributes.position; c.setHex(hex);
    for (let i = 0; i < p.count; i++) { positions.push(p.getX(i), p.getY(i), p.getZ(i)); const k = .82 + .22 * THREE.MathUtils.clamp((p.getY(i) - py) / sy + .5, 0, 1); colors.push(c.r * k, c.g * k, c.b * k); }
    g.dispose();
  };
  for (let i = 0; i < hills; i++) {
    const a = i / hills * 6.28 + r() * .3, d = radius * (.9 + r() * .35), x = center[0] + Math.cos(a) * d, z = center[1] + Math.sin(a) * d;
    const hh = height[0] + r() * (height[1] - height[0]), w = hh * (shape === 'peak' ? 1.1 : 1.6) * (.8 + r() * .5), depth = w * (.7 + r() * .5), ry = r() * 6, hex = hillColors[i % hillColors.length];
    if (shape === 'mesa') { put(mesaShape, x, y + hh / 2 - 6, z, w * .75, hh, w * .55, ry, hex); put(hillShape, x, y + hh - 6, z, w * .5, hh * .07, w * .37, ry, top); }
    else if (shape === 'peak') {
      put(hillShape, x, y - hh * .12, z, w * .55, hh * 1.12, depth * .55, ry, hex);
      put(hillShape, x + w * .35, y - hh * .2, z, w * .4, hh * .7, depth * .4, ry, hillColors[(i + 1) % hillColors.length]);
      if (snow) put(hillShape, x, y + hh * .78, z, w * .3, hh * .24, depth * .3, ry, 0xf6f8ff);
    } else put(hillShape, x, y - hh * .25, z, w, hh, depth, ry, hex);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3)); geo.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3)); geo.computeVertexNormals();
  const mesh = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1 }));
  mesh.name = 'festive-horizon'; mesh.userData.dispose = () => { geo.dispose(); mesh.material.dispose(); };
  return mesh;
}

// Warmer, varied ground colour: broad meadow patches drift between a base
// green, a sunny yellow-green and a deeper green, with sparse flower tints.
const meadowA = new THREE.Color(), meadowB = new THREE.Color();
export function meadow(x, z, base = 0x6cbf4c, { warm = 0x9fcf4a, deep = 0x3f9e4f, bloom = 0 } = {}) {
  const n = Math.sin(x * .021 + Math.sin(z * .017) * 1.7) * .5 + Math.sin(z * .029 - x * .011 + 1.3) * .35 + Math.sin((x + z) * .047) * .15;
  meadowA.setHex(base).lerp(meadowB.setHex(n > 0 ? warm : deep), Math.min(1, Math.abs(n) * .9));
  if (bloom && Math.sin(x * .13) * Math.sin(z * .11) > .82) meadowA.lerp(meadowB.setHex(bloom), .35);
  return meadowA.getHex();
}
