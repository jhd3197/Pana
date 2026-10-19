// Venezuelan Amazonas river pieces, first used by Curiara. Metres, +Y up,
// +Z front, grounded at y = 0 unless a factory says otherwise. Deterministic
// from their seed; each returns a baked static batch.
import * as THREE from 'three';
import { M, mesh, tube, rng } from '/engine/models/core/primitives.js';
import { finish, curve, sign } from '/engine/models/core/architecture-kit.js';
import { rural, dimension, cylinder } from '/engine/models/core/rural-kit.js';

const THATCH = [0xb89a5c, 0xa28449, 0xc9ae6e].map(c => M(c, { roughness: 1, side: THREE.DoubleSide }));
const POLE = M(0x6e5638, { roughness: 1 }), FROND = [0x5f8b3e, 0x76a04a, 0x4d7a34].map(c => M(c, { roughness: 1, side: THREE.DoubleSide }));
const TAU = Math.PI * 2;

// Vertex-coloured noise keeps a rock one material (one draw once baked).
function lumpy(geo, seed, scale, tint) {
  const p = geo.attributes.position, random = rng(seed), seen = new Map(), colors = [], c = new THREE.Color();
  for (let i = 0; i < p.count; i++) {
    const key = [p.getX(i), p.getY(i), p.getZ(i)].map(v => v.toFixed(3)).join();
    if (!seen.has(key)) seen.set(key, .8 + random() * .34);
    const k = seen.get(key), x = p.getX(i) * k * scale[0], y = p.getY(i) * k * scale[1], z = p.getZ(i) * k * scale[2];
    p.setXYZ(i, x, y, z);
    // Dark wet foot, pale weathered top, a few lichen streaks.
    const top = THREE.MathUtils.smoothstep(y, -scale[1] * .3, scale[1]);
    c.setHex(tint).multiplyScalar(.7 + .38 * top + .06 * Math.sin(x * 6 + z * 4));
    if (Math.sin(x * 3.1 - z * 2.3 + seed) > .82) c.lerp(new THREE.Color(0x9aa266), .45);
    colors.push(c.r, c.g, c.b);
  }
  geo.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  geo.computeVertexNormals(); geo.computeBoundingBox();
  return geo;
}

// Laja: a smooth, flattened granite slab of the Guayana shield.
// color tints the slab (granite by default; warm sandstone for deserts).
export function lajaRock({ seed = 1, radius = 2, flat = .42, color = 0x5a524a } = {}) {
  dimension(radius, .3, 12, 'radius');
  const g = new THREE.Group(), random = rng(seed);
  const main = lumpy(new THREE.IcosahedronGeometry(1, 2), seed, [radius, radius * flat, radius * (.75 + random() * .3)], color);
  g.add(mesh(main, M(0xffffff, { vertexColors: true, roughness: .92 }), 0, -main.boundingBox.min.y * .55, 0));
  // A smaller shoulder stone, as lajas break in plates.
  const side = lumpy(new THREE.IcosahedronGeometry(1, 1), seed + 7, [radius * .45, radius * flat * .7, radius * .4], color === 0x5a524a ? 0x625a50 : new THREE.Color(color).offsetHSL(0, 0, .03).getHex());
  g.add(mesh(side, M(0xffffff, { vertexColors: true, roughness: .92 }), radius * (.6 + random() * .3), -side.boundingBox.min.y * .5, radius * (random() - .5)));
  return finish(g, 'LajaRock');
}

// Igapó trunk: a flooded-forest tree. Origin at the waterline; the trunk
// carries on 2.5 m below it, stained dark where the flood season reaches.
export function igapoTrunk({ seed = 1, h = 9 } = {}) {
  dimension(h, 4, 18, 'h');
  const g = new THREE.Group(), random = rng(seed), lean = (random() - .5) * .5;
  const geo = new THREE.CylinderGeometry(.28, .5, h + 2.5, 9, 10), p = geo.attributes.position, colors = [], c = new THREE.Color();
  for (let i = 0; i < p.count; i++) {
    const y = p.getY(i) + (h + 2.5) / 2 - 2.5, t = (y + 2.5) / (h + 2.5);
    p.setXYZ(i, p.getX(i) * (1 + .08 * Math.sin(y * 3 + seed)) + lean * t * t * 2, y, p.getZ(i));
    c.setHex(y < 1.6 ? 0x3d3428 : 0x7b6e58).multiplyScalar(.9 + .1 * Math.sin(y * 7));
    colors.push(c.r, c.g, c.b);
  }
  geo.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3)); geo.computeVertexNormals();
  g.add(mesh(geo, M(0xffffff, { vertexColors: true, roughness: 1 })));
  // Buttress fins flare into the water.
  for (let i = 0; i < 4; i++) {
    const a = i * TAU / 4 + random(), fin = new THREE.Shape();
    fin.moveTo(0, -1.2); fin.lineTo(1.25, -1.2); fin.quadraticCurveTo(.25, -.4, .05, 1.8); fin.lineTo(0, 1.8);
    const m = mesh(new THREE.ExtrudeGeometry(fin, { depth: .1, bevelEnabled: false }), M(0x5b4f3e, { roughness: 1 }), 0, 0, 0);
    m.rotation.y = a; g.add(m);
  }
  // A sparse crown and a few hanging roots.
  for (let i = 0; i < 6; i++) {
    const a = i * 1.1 + random(), r = 1.2 + random() * 1.6;
    g.add(mesh(new THREE.IcosahedronGeometry(1.2 + random() * .8, 0), FROND[i % 3], lean * 2 + Math.cos(a) * r, h - .4 + random() * 1.2, Math.sin(a) * r));
  }
  for (let i = 0; i < 4; i++) { const a = random() * TAU; g.add(tube([lean * 1.5 + Math.cos(a) * 1.4, h - 1, Math.sin(a) * 1.4], [lean + Math.cos(a) * 1.6, .1, Math.sin(a) * 1.6], .03, M(0x5d5233))); }
  return finish(g, 'IgapoTrunk');
}

// Churuata: the round thatched house of the Amazonas, open between its posts.
export function churuata({ radius = 5.5, seed = 3 } = {}) {
  dimension(radius, 2.5, 12, 'radius');
  const g = new THREE.Group(), random = rng(seed), eave = 1.7, apex = radius * 1.35 + 2;
  const n = Math.max(10, Math.round(radius * 2.4));
  for (let i = 0; i < n; i++) { const a = i / n * TAU; g.add(cylinder(.09, .12, eave + .3, POLE, Math.cos(a) * radius * .9, (eave + .3) / 2, Math.sin(a) * radius * .9, 7)); }
  g.add(cylinder(.16, .2, apex - .4, POLE, 0, (apex - .4) / 2, 0, 8));
  // Layered cones, each a little ragged at its hem.
  for (let k = 0; k < 4; k++) {
    const r = radius * (1.08 - k * .2), y0 = eave + k * (apex - eave) * .2, geo = new THREE.ConeGeometry(r, apex - y0, 28, 3, true), p = geo.attributes.position;
    for (let i = 0; i < p.count; i++) if (p.getY(i) < -(apex - y0) / 2 + .01) p.setY(i, p.getY(i) - .12 - .18 * Math.abs(Math.sin(i * 1.7 + random())));
    geo.computeVertexNormals();
    g.add(mesh(geo, THATCH[k % 3], 0, y0 + (apex - y0) / 2, 0));
  }
  g.add(mesh(new THREE.ConeGeometry(.5, 1.1, 10), THATCH[1], 0, apex + .4, 0), tube([0, apex + .6, 0], [0, apex + 1.6, 0], .04, POLE));
  // Hammock posts and a hearth ring inside.
  for (let i = 0; i < 7; i++) { const a = i / 7 * TAU; g.add(mesh(new THREE.DodecahedronGeometry(.18, 0), M(0x6b655c), Math.cos(a) * .6, .1, Math.sin(a) * .6)); }
  return finish(g, 'Churuata');
}

// Finish arch of moriche fronds over the landing. Spans X; banner faces +Z.
export function finishArch({ span = 14, label = 'META', secondary = 'LA CHURUATA' } = {}) {
  dimension(span, 6, 60, 'span');
  const g = new THREE.Group(), h = 5.6, half = span / 2;
  for (const s of [-1, 1]) {
    g.add(cylinder(.22, .3, h, M(0x8a7857, { roughness: 1 }), s * half, h / 2, 0, 9));
    // Leaf-scar rings, as on the moriche trunk.
    for (let i = 0; i < 9; i++) { const ring = mesh(new THREE.TorusGeometry(.27, .03, 4, 10), M(0xb39c70), s * half, .5 + i * .58, 0); ring.rotation.x = Math.PI / 2; g.add(ring); }
  }
  const top = [[-half, h - .2, 0], [-half * .5, h + 1.3, 0], [0, h + 1.7, 0], [half * .5, h + 1.3, 0], [half, h - .2, 0]];
  g.add(curve(top, .2, M(0x7a6544, { roughness: 1 }), 32));
  // Fronds hang off the arch, alternating front and back.
  const path = new THREE.CatmullRomCurve3(top.map(v => new THREE.Vector3(...v)));
  for (let i = 0; i <= 26; i++) {
    const p = path.getPoint(i / 26), leaf = new THREE.PlaneGeometry(.55, 1.9, 1, 3), q = leaf.attributes.position;
    for (let j = 0; j < q.count; j++) { const y = q.getY(j); q.setXYZ(j, q.getX(j) * (1 - Math.abs(y) * .3), y - .95, Math.abs(y + .95) * .25 * (i % 2 ? 1 : -1)); }
    leaf.computeVertexNormals();
    const m = mesh(leaf, FROND[i % 3], p.x, p.y, p.z); m.rotation.y = (i % 3 - 1) * .4; m.rotation.z = (i % 2 ? .25 : -.25); g.add(m);
  }
  const banner = sign([label, secondary], Math.min(span * .55, 7), 1.35, { background: '#2f6b4f', color: '#ffe8b0' });
  banner.position.set(0, h + .1, .12); g.add(banner);
  const back = banner.clone(); back.rotation.y = Math.PI; back.position.z = -.12; g.add(back);
  return finish(g, 'FinishArch');
}

// Plank dock with a moriche-thatched shelter at its far end. Long axis +Z,
// origin at the waterline: the deck stands .55 m above it on piles.
export function moricheDock({ length = 8 } = {}) {
  dimension(length, 4, 20, 'length');
  const g = new THREE.Group(), deck = .55, n = Math.ceil(length / .3);
  for (let i = 0; i < n; i++) g.add(mesh(new THREE.BoxGeometry(2.4, .09, length / n - .03), i % 5 ? rural.wood : M(0xa38c60, { roughness: 1 }), 0, deck, -length / 2 + (i + .5) * length / n));
  for (let z = -length / 2 + .3; z < length / 2; z += 2) for (const x of [-1.05, 1.05]) g.add(cylinder(.09, .11, 2.4, rural.darkWood, x, deck - 1.1, z, 8));
  // Shelter over the last 3 m.
  const z0 = length / 2 - 1.6;
  for (const x of [-1.15, 1.15]) for (const dz of [-1.3, 1.3]) g.add(cylinder(.07, .08, 2.3, POLE, x, deck + 1.15, z0 + dz, 7));
  for (const s of [-1, 1]) {
    const geo = new THREE.PlaneGeometry(1.75, 3.4, 4, 1); geo.rotateX(-Math.PI / 2);
    const roof = mesh(geo, THATCH[s > 0 ? 0 : 2], s * .72, deck + 2.62, z0); roof.rotation.z = -s * .62; g.add(roof);
  }
  g.add(tube([0, deck + 3.08, z0 - 1.75], [0, deck + 3.08, z0 + 1.75], .06, POLE));
  return finish(g, 'MoricheDock');
}
