// Páramo 052–060. Ground origins at y=0, front +Z. Linear modules span X.
// Vegetation 051/057 is built in flora-species.js and re-exported by flora.js.
import * as THREE from 'three';
import { M, mesh, box, tube, rng } from '/engine/models/core/primitives.js';
import { finish, rounded, sign, curve, tiledRoof, shutterWindow, railing, stoneCourses, palette as P } from '/engine/models/core/architecture-kit.js';

const red = M(0xa6523e, { roughness: 0.85 }), green = M(0x477168, { roughness: 0.8 });
const steel = M(0xaeb9b4, { metalness: 0.65, roughness: 0.45 }), cable = M(0x4c5555, { metalness: 0.5, roughness: 0.7 });

function spanOption(span, min, max, label) {
  if (!Number.isFinite(span) || span < min || span > max) throw new RangeError(`${label} must be between ${min} and ${max}`);
}

function rock(g, [x, y, z], [sx, sy, sz], seed) {
  const geo = new THREE.IcosahedronGeometry(1, 1), pos = geo.attributes.position, colors = [];
  const dark = new THREE.Color(0x626f6b), light = new THREE.Color(0x9eaa9a);
  for (let i = 0; i < pos.count; i++) {
    const px = pos.getX(i), py = pos.getY(i), pz = pos.getZ(i);
    const noise = 1 + Math.sin(px * 6 + pz * 8 + seed) * 0.09;
    pos.setXYZ(i, px * sx * noise, py * sy * noise, pz * sz * noise);
    colors.push(...dark.clone().lerp(light, 0.5 + py * 0.3).toArray());
  }
  geo.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3)); geo.computeVertexNormals(); geo.computeBoundingBox();
  const m = mesh(geo, M(0xffffff, { vertexColors: true, roughness: 1 }), x, Math.max(y, -geo.boundingBox.min.y), z); g.add(m); return m;
}

// 052 · Stone foundation, timber gable, deep porch and a capped chimney.
export function mountainCabin({ seed = 52 } = {}) {
  const g = new THREE.Group();
  stoneCourses(g, { w: 5.7, d: 4.8, h: 0.85, seed });
  g.add(rounded(5.5, 2.9, 4.6, P.wood, 0, 2.28, 0));
  for (let i = 0; i < 14; i++) {
    const x = -2.6 + i * 0.4;
    for (const z of [-2.32, 2.32]) g.add(box(0.028, 2.77, 0.025, P.timber, x, 2.28, z));
  }
  for (const x of [-2.66, 2.66]) for (const z of [-2.22, 2.22]) g.add(box(0.18, 2.98, 0.18, P.timber, x, 2.31, z));
  tiledRoof(g, { w: 5.5, d: 4.6, y: 3.78, rise: 1.75, wall: P.wood, seed });
  stoneCourses(g, { w: 0.8, d: 0.8, h: 2.0, x: 1.7, y: 3.6, z: -0.9, seed });
  g.add(box(1.0, 0.12, 1.0, P.stone, 1.7, 5.68, -0.9));
  for (const x of [1.37, 2.03]) for (const z of [-1.23, -0.57]) g.add(box(0.08, 0.28, 0.08, P.iron, x, 5.89, z));
  g.add(box(1.05, 0.1, 1.05, P.iron, 1.7, 6.08, -0.9));
  for (const x of [-1.7, 1.7]) shutterWindow(g, x, 2.25, 2.34, { w: 0.78, h: 1.1, color: 0x477168, bars: false });
  g.add(rounded(1.18, 2.3, 0.12, green, 0, 2.0, 2.4));
  for (let i = 0; i < 5; i++) g.add(box(0.018, 2.15, 0.025, P.timber, -0.44 + i * 0.22, 2.0, 2.48));
  g.add(mesh(new THREE.SphereGeometry(0.045, 8, 6), P.brass, 0.38, 1.94, 2.51));
  g.add(box(5.8, 0.16, 1.4, P.wood, 0, 0.86, 2.94));
  for (const x of [-2.64, 2.64]) g.add(box(0.15, 2.75, 0.15, P.timber, x, 2.24, 3.48));
  const porch = box(6.0, 0.13, 1.7, red, 0, 3.54, 3.02); porch.rotation.x = 0.18; g.add(porch);
  for (const s of [-1, 1]) railing(g, [s * 0.85, 0.96, 3.5], [s * 2.62, 0.96, 3.5], { height: 0.8, material: P.timber });
  for (let i = 0; i < 4; i++) g.add(rounded(1.65, 0.22 * (i + 1), 0.36, P.stone, 0, 0.11 * (i + 1), 4.64 - i * 0.34));
  const plaque = sign('REFUGIO EL FRAILEJÓN', 2.6, 0.32); plaque.position.set(0, 3.32, 2.43); g.add(plaque);
  return finish(g, 'mountainCabin');
}

// 053 · Open terminal with boarding platform, sheaves and a moving gondola.
export function cableCarStation() {
  const g = new THREE.Group();
  stoneCourses(g, { w: 8, d: 4.7, h: 1.1, seed: 53 });
  g.add(box(8.2, 0.16, 4.9, P.cream, 0, 1.17, 0));
  for (const x of [-3.4, 3.4]) for (const z of [-1.8, 1.8]) {
    g.add(rounded(0.22, 4.5, 0.22, green, x, 3.47, z));
    g.add(tube([x, 4.8, z], [x * 0.82, 5.7, z], 0.07, green));
  }
  for (const x of [-3.4, 3.4]) g.add(box(0.2, 0.22, 4.0, green, x, 5.71, 0));
  tiledRoof(g, { w: 8.1, d: 4.3, y: 5.85, rise: 1.0, wall: green, seed: 53 });
  for (const x of [-3.3, 3.3]) {
    const wheel = mesh(new THREE.TorusGeometry(0.42, 0.07, 8, 24), steel, x, 4.92, 0.7); g.add(wheel);
    for (let i = 0; i < 6; i++) { const a = i * Math.PI / 3; g.add(tube([x, 4.92, 0.7], [x + Math.cos(a) * 0.39, 4.92 + Math.sin(a) * 0.39, 0.7], 0.025, steel)); }
  }
  for (const y of [4.5, 5.34]) g.add(tube([-5, y, 0.7], [5, y, 0.7], 0.026, cable));
  // Ticket hut at the rear leaves the gondola's travel corridor clear.
  g.add(rounded(2.6, 2.4, 1.15, P.cream, -1.8, 2.45, -1.65));
  g.add(box(1.6, 0.75, 0.03, P.dark, -1.8, 2.75, -1.05), box(1.75, 0.1, 0.42, P.wood, -1.8, 2.31, -0.9));
  const ticket = sign('BOLETERÍA', 1.6, 0.3); ticket.position.set(-1.8, 3.32, -1.055); g.add(ticket);
  const title = sign(['TELEFÉRICO PANA', 'estación de montaña'], 4.0, 0.7); title.position.set(0, 5.18, 2.03); g.add(title);
  railing(g, [-3.9, 1.25, 2.3], [-1.3, 1.25, 2.3], { material: green });
  railing(g, [1.3, 1.25, 2.3], [3.9, 1.25, 2.3], { material: green });
  for (let i = 0; i < 5; i++) g.add(rounded(2.25, 0.24 * (i + 1), 0.35, P.stone, 0, 0.12 * (i + 1), 3.95 - i * 0.34));
  const out = finish(g, 'cableCarStation'), car = new THREE.Group();
  car.add(rounded(1.7, 0.7, 1.45, red, 0, 2.13, 0), rounded(1.8, 0.14, 1.55, P.cream, 0, 1.82, 0));
  const glass = M(0x467582, { metalness: 0.25, roughness: 0.3 });
  car.add(rounded(1.62, 1.05, 1.37, glass, 0, 2.98, 0));
  for (const x of [-0.8, 0, 0.8]) for (const z of [-0.7, 0.7]) car.add(box(0.055, 1.1, 0.06, P.cream, x, 2.99, z));
  car.add(rounded(1.82, 0.15, 1.58, red, 0, 3.6, 0));
  car.add(curve([[0, 3.65, 0], [0, 4.15, 0.05], [0, 4.5, 0]], 0.06, steel));
  const badge = sign('PANA', 0.7, 0.23, { border: false }); badge.position.set(0, 2.13, 0.735); car.add(badge);
  // Swing around the cable attachment, keeping the hanger pinned to the wire.
  car.position.y = -4.5;
  const cabin = finish(car, 'Gondola'); cabin.position.set(0, 4.5, 0.7); out.add(cabin);
  out.userData.tick = t => { cabin.position.x = Math.sin(t * 0.28) * 2.2; cabin.rotation.x = Math.sin(t * 0.7) * 0.012; };
  out.userData.tick(0); return out;
}

// 054 · Closed, repeatable cliff volume. Its X end profiles match across seeds.
export function rockyCliff({ seed = 54, width = 8, height = 5, depth = 3 } = {}) {
  spanOption(width, 3, 20, 'Cliff width'); spanOption(height, 2, 12, 'Cliff height'); spanOption(depth, 1, 8, 'Cliff depth');
  const g = new THREE.Group(), vertices = [], colors = [], indices = [], nx = Math.ceil(width / 0.7), ny = 10;
  const dark = new THREE.Color(0x616d69), light = new THREE.Color(0x9ca392), moss = new THREE.Color(0x6c805a);
  // Shared end profile yields an actual modular connection, not random endcaps.
  const zAt = (u, v) => depth / 2 + Math.sin(v * 22) * 0.2 + Math.sin(Math.PI * u) * (Math.sin(u * 21 + v * 9 + seed) * 0.48 + Math.sin(v * 39) * 0.25);
  const yAt = (u, v) => v * height + Math.sin(Math.PI * u) * (Math.sin(u * 31 + v * 16 + seed) * 0.2 * v);
  for (let j = 0; j <= ny; j++) for (let i = 0; i <= nx; i++) {
    const u = i / nx, v = j / ny;
    vertices.push((u - 0.5) * width, yAt(u, v), zAt(u, v));
    const c = dark.clone().lerp(light, 0.3 + v * 0.3 + Math.sin(v * 25 + u * 6) * 0.17);
    if (j === ny) c.lerp(moss, 0.45); colors.push(...c.toArray());
    if (i < nx && j < ny) { const a = j * (nx + 1) + i; indices.push(a, a + 1, a + nx + 1, a + 1, a + nx + 2, a + nx + 1); }
  }
  const quad = (a, b, c, d, tint) => {
    const n = vertices.length / 3; for (const p of [a, b, c, d]) { vertices.push(...p); colors.push(...tint.toArray()); }
    indices.push(n, n + 1, n + 2, n, n + 2, n + 3);
  };
  for (let i = 0; i < nx; i++) {
    const u = i / nx, v = (i + 1) / nx, a = (u - 0.5) * width, b = (v - 0.5) * width;
    quad([a, yAt(u, 1), zAt(u, 1)], [b, yAt(v, 1), zAt(v, 1)], [b, height, -depth / 2], [a, height, -depth / 2], moss);
    quad([a, 0, -depth / 2], [b, 0, -depth / 2], [b, 0, zAt(v, 0)], [a, 0, zAt(u, 0)], dark);
  }
  for (const u of [0, 1]) for (let j = 0; j < ny; j++) {
    const a = j / ny, b = (j + 1) / ny, x = (u - 0.5) * width;
    const points = [[x, a * height, zAt(u, a)], [x, b * height, zAt(u, b)], [x, b * height, -depth / 2], [x, a * height, -depth / 2]];
    if (u === 1) points.reverse(); quad(...points, dark);
  }
  quad([-width / 2, 0, -depth / 2], [-width / 2, height, -depth / 2], [width / 2, height, -depth / 2], [width / 2, 0, -depth / 2], dark);
  const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3)); geo.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3)); geo.setIndex(indices); geo.computeVertexNormals();
  g.add(mesh(geo, M(0xffffff, { vertexColors: true, roughness: 1 })));
  // Embedded outcrops interrupt the grid while keeping both module ends flush.
  for(let i=0;i<7;i++){
    const u=.16+i*.11,v=.18+((i*3)%5)*.15;
    rock(g,[(u-.5)*width,yAt(u,v),zAt(u,v)-.16],[width*.075,height*.09,.42],seed+i*7);
  }
  const out = finish(g, 'rockyCliff'); out.userData.module = { axis: 'x', width, height, depth }; return out;
}

// 055 · Corrugated steel W-beam with bolted posts and amber reflectors.
export function mountainGuardrail({ span = 8 } = {}) {
  spanOption(span, 2, 30, 'Guardrail span');
  const g = new THREE.Group(), n = Math.ceil(span / 2), half = span / 2;
  const profile = [[-0.23, 0], [-0.16, 0.07], [-0.08, -0.045], [0, 0], [0.08, -0.045], [0.16, 0.07], [0.23, 0]];
  const positions = [], indices = [];
  for (const x of [-half, half]) profile.forEach(([y, z]) => positions.push(x, 0.85 + y, z));
  for (let i = 0; i < profile.length - 1; i++) indices.push(i, i + 7, i + 1, i + 1, i + 7, i + 8);
  const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3)); geo.setIndex(indices); geo.computeVertexNormals();
  g.add(mesh(geo, M(0xaeb9b4, { metalness: 0.65, roughness: 0.45, side: THREE.DoubleSide })));
  for (let i = 0; i <= n; i++) {
    const x = -half + span * i / n;
    g.add(box(0.12, 1.0, 0.12, steel, x, 0.5, -0.17), box(0.23, 0.06, 0.28, P.stone, x, 0.03, -0.17));
    for (const y of [0.7, 1.0]) g.add(mesh(new THREE.SphereGeometry(0.026, 6, 4), P.iron, x, y, 0.075));
    g.add(rounded(0.11, 0.16, 0.03, M(0xe7b346, { emissive: 0x775018, emissiveIntensity: 0.15 }), x, 1.16, -0.1));
  }
  for (const s of [-1, 1]) g.add(curve([[s * half, 0.85, 0], [s * (half + 0.16), 0.85, -0.04], [s * (half + 0.18), 0.85, -0.2]], 0.12, steel, 8));
  return finish(g, 'mountainGuardrail');
}

// 056 · Stone terrace with a safe perimeter and a stepped entrance at +Z.
export function stoneLookout() {
  const g = new THREE.Group();
  stoneCourses(g, { w: 6.8, d: 4.9, h: 1.0, seed: 56 });
  g.add(rounded(7.0, 0.15, 5.1, P.cream, 0, 1.08, 0));
  for (let i = 0; i < 7; i++) for (let j = 0; j < 5; j++) g.add(box(0.94, 0.025, 0.94, i % 2 ? P.stone : M(0xa6aa97), -2.91 + i * 0.97, 1.17, -1.95 + j * 0.97));
  railing(g, [-3.25, 1.17, -2.25], [3.25, 1.17, -2.25]);
  for (const s of [-1, 1]) {
    railing(g, [s * 3.25, 1.17, -2.25], [s * 3.25, 1.17, 2.25]);
    railing(g, [s * 3.25, 1.17, 2.25], [s * 1.0, 1.17, 2.25]);
  }
  for (let i = 0; i < 5; i++) g.add(rounded(1.9, 0.23 * (i + 1), 0.35, P.stone, 0, 0.115 * (i + 1), 3.91 - i * 0.34));
  // Viewing telescope, with a recognizable eyepiece and paired front barrels.
  g.add(mesh(new THREE.CylinderGeometry(0.08, 0.13, 1.0, 12), P.iron, 0, 1.69, -1.55));
  g.add(rounded(0.52, 0.28, 0.45, green, 0, 2.25, -1.55));
  for (const x of [-0.16, 0.16]) {
    const lens = mesh(new THREE.CylinderGeometry(0.1, 0.13, 0.42, 14), steel, x, 2.29, -1.8); lens.rotation.x = Math.PI / 2; g.add(lens);
    g.add(mesh(new THREE.CircleGeometry(0.085, 14), P.dark, x, 2.29, -2.015)); g.children[g.children.length - 1].rotation.y = Math.PI;
  }
  const name = sign('MIRADOR DE LOS PANAS', 2.2, 0.34); name.position.set(0, 0.6, 2.465); g.add(name);
  return finish(g, 'stoneLookout');
}

// 058 · Open A-frame tent with a fitted groundsheet, bedrolls and guy ropes.
export function mountainTent({ color = 0xba7049 } = {}) {
  const g = new THREE.Group(), fabric = M(color, { roughness: 1, side: THREE.DoubleSide }), lining = M(0x4b5b4d, { roughness: 1, side: THREE.DoubleSide });
  g.add(rounded(3.4, 0.07, 4.1, lining, 0, 0.035, 0));
  for (const s of [-1, 1]) {
    const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.Float32BufferAttribute([0, 2.25, -1.8, s * 1.55, 0.13, -1.8, s * 1.55, 0.13, 1.8, 0, 2.25, 1.8], 3)); geo.setIndex([0, 1, 2, 0, 2, 3]); geo.computeVertexNormals(); g.add(mesh(geo, fabric));
    g.add(tube([0, 2.25, 1.81], [s * 1.55, 0.13, 1.81], 0.022, P.cream));
    g.add(tube([s * 1.55, 0.13, -1.8], [s * 1.55, 0.13, 1.8], 0.022, P.cream));
    // Tied-back front flap, preserving an open central doorway.
    const flap = new THREE.BufferGeometry(); flap.setAttribute('position', new THREE.Float32BufferAttribute([0, 2.22, 1.8, s * 1.5, 0.14, 1.8, s * 0.82, 0.85, 1.92], 3)); flap.computeVertexNormals(); g.add(mesh(flap, lining));
    for (const z of [-1.5, 1.5]) {
      g.add(tube([s * 1.0, 0.9, z], [s * 2.35, 0.05, z * 1.3], 0.013, P.cream));
      g.add(tube([s * 2.35, 0.02, z * 1.3], [s * 2.35, 0.19, z * 1.3], 0.02, steel));
    }
  }
  const back = new THREE.BufferGeometry(); back.setAttribute('position', new THREE.Float32BufferAttribute([-1.55, 0.13, -1.8, 0, 2.25, -1.8, 1.55, 0.13, -1.8], 3)); back.computeVertexNormals(); g.add(mesh(back, fabric));
  for (const z of [-1.81, 1.81]) g.add(tube([0, 0.08, z], [0, 2.34, z], 0.035, steel));
  for (const x of [-0.55, 0.55]) {
    g.add(rounded(0.72, 0.12, 2.3, green, x, 0.15, -0.1, 0.05));
    const roll = mesh(new THREE.CylinderGeometry(0.18, 0.18, 0.68, 12), red, x, 0.28, -1.0); roll.rotation.z = Math.PI / 2; g.add(roll);
  }
  const out = finish(g, 'mountainTent'); return out;
}

// 059 · Engineered suspension crossing; complete deck, anchor blocks and cables.
export function mountainSuspensionBridge({ span = 16, seed = 59 } = {}) {
  spanOption(span, 6, 40, 'Mountain bridge span');
  const g = new THREE.Group(), r = rng(seed), half = span / 2, deck = 1.2, sag = 0.25;
  const yAt = x => deck - sag * (1 - (x / half) ** 2), handAt = x => yAt(x) + 1.05;
  for (const s of [-1, 1]) {
    stoneCourses(g, { w: 2.1, d: 3.2, h: deck - 0.05, x: s * (half + 1.05), seed: seed + 2 });
    for (const z of [-1.25, 1.25]) {
      g.add(rounded(0.18, 4.0, 0.18, green, s * half, 3.15, z));
      g.add(tube([s * half, 5.15, z], [s * (half + 2.0), 1.17, z], 0.045, cable));
      g.add(mesh(new THREE.SphereGeometry(0.1, 10, 6), steel, s * half, 5.17, z));
    }
    g.add(box(0.2, 0.17, 2.7, green, s * half, 5.08, 0));
    for (let i = 0; i < 4; i++) g.add(rounded(0.38, 0.285 * (i + 1), 2.3, P.stone, s * (half + 3.44 - i * 0.37), 0.1425 * (i + 1), 0));
  }
  const n = Math.ceil(span / 0.3);
  for (let i = 0; i < n; i++) {
    const x = -half + (i + 0.5) * span / n;
    const plank = rounded(span / n - 0.025, 0.09, 2.25, r() > 0.5 ? P.wood : M(0xa0794f), x, yAt(x), 0, 0.012);
    plank.rotation.z = Math.atan(2 * sag * x / half ** 2); g.add(plank);
  }
  for (const z of [-1.15, 1.15]) {
    const main = x => 2.5 + 2.5 * (x / half) ** 2;
    g.add(curve(Array.from({ length: 21 }, (_, i) => { const x = -half + span * i / 20; return [x, main(x), z]; }), 0.05, cable, 48));
    g.add(curve(Array.from({ length: 21 }, (_, i) => { const x = -half + span * i / 20; return [x, handAt(x), z]; }), 0.035, steel, 40));
    const count = Math.ceil(span / 0.8);
    for (let i = 0; i <= count; i++) {
      const x = -half + span * i / count;
      g.add(tube([x, yAt(x) - 0.04, z], [x, main(x), z], 0.02, cable));
      if (i < count) { const next = -half + span * (i + 1) / count; g.add(tube([x, yAt(x) + 0.1, z], [next, handAt(next), z], 0.011, cable)); }
    }
    g.add(curve(Array.from({ length: 21 }, (_, i) => { const x = -half + span * i / 20; return [x, yAt(x) - 0.13, z]; }), 0.065, P.iron, 40));
  }
  return finish(g, 'mountainSuspensionBridge');
}

// 060 · Trail arrows, painted blaze and a tiny route plaque in a rock footing.
export function mountainSignpost({ seed = 60 } = {}) {
  const g = new THREE.Group();
  for (let i = 0; i < 5; i++) { const a = i * Math.PI * 0.4; rock(g, [Math.cos(a) * 0.32, 0, Math.sin(a) * 0.32], [0.28, 0.2, 0.23], seed + i); }
  g.add(rounded(0.19, 3.1, 0.19, P.timber, 0, 1.55, 0));
  for (const [i, words] of ['AL MIRADOR', 'LAGUNA VERDE', 'REFUGIO'].entries()) {
    const side = i % 2 ? -1 : 1, w = i === 1 ? 2.1 : 1.85, shape = new THREE.Shape();
    shape.moveTo(-w / 2, -0.19); shape.lineTo(w / 2 - 0.28, -0.19); shape.lineTo(w / 2, 0); shape.lineTo(w / 2 - 0.28, 0.19); shape.lineTo(-w / 2, 0.19); shape.closePath();
    const board = new THREE.Group(); board.position.set(side * 0.3, 2.75 - i * 0.52, 0.17); board.rotation.z = i === 1 ? -0.035 : 0.025;
    const geo = new THREE.ExtrudeGeometry(shape, { depth: 0.1, bevelEnabled: true, bevelSize: 0.015, bevelThickness: 0.015, bevelSegments: 1 });
    const plank = mesh(geo, i === 1 ? P.wood : green);
    if (side < 0) { plank.rotation.y = Math.PI; plank.position.z = 0.1; }
    board.add(plank);
    const label = sign(words, w - 0.5, 0.25, { background: i === 1 ? '#90613e' : '#477168', border: false }); label.position.set(-side * 0.1, 0, 0.12); board.add(label);
    for (const x of [-0.09, 0.09]) board.add(mesh(new THREE.SphereGeometry(0.022, 6, 4), P.brass, x - side * 0.3, 0, 0.13));
    g.add(board);
  }
  for (const [y, material] of [[1.02, P.cream], [0.84, red]]) g.add(box(0.2, 0.13, 0.02, material, 0, y, 0.105));
  const plaque = sign(['SENDERO PANA', 'cuida la montaña'], 0.68, 0.46); plaque.position.set(0, 1.37, 0.14); g.add(plaque);
  return finish(g, 'mountainSignpost');
}

// A natural rock arch for cave mouths: rounded boulders stacked along a
// half-ellipse, mossy on top, wide enough for a road. Opening `span`
// half-wide and `height` tall, centred on x = 0, facing +Z, `depth` deep.
export function rockArch({ span = 14, height = 13, depth = 8, seed = 57, color = 0xb59a78 } = {}) {
  const g = new THREE.Group(), r = rng(seed), base = new THREE.Color(color), light = base.clone().offsetHSL(0, .02, .12), moss = new THREE.Color(0x67a84a);
  const material = M(0xffffff, { vertexColors: true, roughness: 1 });
  const stone = (x, y, z, sx, sy, sz, top) => {
    const geo = new THREE.IcosahedronGeometry(1, 2), p = geo.attributes.position, colors = [];
    for (let i = 0; i < p.count; i++) {
      const px = p.getX(i), py = p.getY(i), pz = p.getZ(i), k = 1 + Math.sin(px * 3 + pz * 4 + seed) * .07;
      p.setXYZ(i, px * sx * k, py * sy * k, pz * sz * k);
      const c = base.clone().lerp(light, .5 + py * .35); if (top && py > .45) c.lerp(moss, .75); colors.push(c.r, c.g, c.b);
    }
    geo.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3)); geo.computeVertexNormals();
    g.add(mesh(geo, material, x, y, z));
  };
  const n = 15;
  for (let i = 0; i <= n; i++) {
    const a = Math.PI * i / n, x = -Math.cos(a) * (span + 3), y = Math.sin(a) * height, size = 3.4 + r() * 1.2;
    for (let k = 0; k < Math.ceil(depth / 4); k++) stone(x + (r() - .5), Math.max(size * .6, y + (r() - .5)), -k * 3.6 + (r() - .5), size, size * (.8 + r() * .3), 2.6 + r(), y > height * .6);
  }
  // Buttress boulders bury the feet in the slope.
  for (const s of [-1, 1]) for (let k = 0; k < 4; k++) stone(s * (span + 6 + r() * 4), 2 + r() * 3, -k * 2.5, 4 + r() * 2, 4 + r() * 2, 3.5, true);
  g.name = 'rock-arch'; g.userData.previewBounds = [[-span - 12, 0, -depth - 3], [span + 12, height + 5, 4]];
  return g;
}

// One timber trestle bent: two battered posts, a cap and an X brace, from
// the ground up to `height`, `width` across. Origin at the ground, centred.
export function timberTrestle({ height = 8, width = 3 } = {}) {
  const g = new THREE.Group(), wood = M(0x8a5a32, { roughness: 1 }), dark = M(0x6a4326, { roughness: 1 });
  for (const s of [-1, 1]) { const post = box(.5, height, .5, wood, s * width / 2, height / 2, 0); post.rotation.z = s * .05; g.add(post); }
  g.add(box(width + 1, .5, .7, dark, 0, height + .1, 0));
  if (height > 3) for (const s of [-1, 1]) { const brace = box(.25, Math.hypot(width, height * .8), .25, dark, 0, height * .45, .3); brace.rotation.z = s * Math.atan2(width, height * .8); g.add(brace); }
  g.name = 'timber-trestle'; g.userData.previewBounds = [[-width, 0, -1], [width, height + 1, 1]];
  return g;
}
