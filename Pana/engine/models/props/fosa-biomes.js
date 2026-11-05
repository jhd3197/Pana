// Fosa's biomes: what the flooded tunnels, the mushroom grove and the fallen
// temple add to a floor, plus the rope work and two small tools. Few segments
// and shared materials, so a floor's worth bakes into a couple of draws. Metres,
// +Y up, origin on the ground (a hanging piece: on its top end).
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { M, mesh, rng } from '/engine/models/core/primitives.js';
import { MUSHROOM_GLOW } from '/engine/models/props/glow-mushrooms.js';

const ROPE = 0xb99a62, WOOD = 0x5e4630, IRON = 0x3c3a3a;

// A thicket of roots from a ceiling `height` above, thick enough to stand behind:
// gnarled strands that stop short of the floor and a tangle at the bottom. One
// draw, nothing to collide with. Origin on the ground.
export function rootThicket({ seed = 1, radius = 1.6, height = 4.6, strands } = {}) {
  const r = rng(seed), n = strands ?? Math.round(16 + radius * 10), parts = [], up = new THREE.Vector3(0, 1, 0), a = new THREE.Vector3(), b = new THREE.Vector3(), dir = new THREE.Vector3();
  const limb = (x0, y0, z0, x1, y1, z1, r0, r1) => {
    a.set(x0, y0, z0); b.set(x1, y1, z1); dir.subVectors(b, a); const len = dir.length();
    const piece = new THREE.CylinderGeometry(r0, r1, len, 5, 1, true);
    piece.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(up, dir.normalize())); piece.translate((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2);
    parts.push(piece);
  };
  for (let i = 0; i < n; i++) {
    const t = r() * Math.PI * 2, d = radius * Math.sqrt(r()); let x = Math.cos(t) * d, z = Math.sin(t) * d, y = height, w = .05 + r() * .08;
    const end = r() < .55 ? .05 + r() * .25 : .7 + r() * 1.3, steps = 4;
    for (let s = 1; s <= steps; s++) {
      const nx = x + (r() - .5) * .34, nz = z + (r() - .5) * .34, ny = height + (end - height) * s / steps, tip = w * (1 - .16 * s);
      limb(x, y, z, nx, ny, nz, w, tip); x = nx; z = nz; y = ny; w = tip;
    }
    // Where it reaches the floor it runs along it a little.
    if (end < .35) { const h = r() * Math.PI * 2, far = .3 + r() * .5; limb(x, y, z, x + Math.cos(h) * far, .03, z + Math.sin(h) * far, w, w * .4); }
  }
  const flat = parts.map(p => p.toNonIndexed()), geometry = mergeGeometries(flat, false);
  parts.forEach(p => p.dispose()); flat.forEach(p => p.dispose()); geometry.computeVertexNormals();
  const g = new THREE.Group(); g.name = 'rootThicket';
  g.add(new THREE.Mesh(geometry, M(0x7a5c3e, { roughness: .95 })));
  return g;
}

// A mushroom as tall as a pana or more. userData.glow is where it shines from,
// for a halo or a borrowed pool light; a light of its own is the consumer's call.
export function giantMushroom({ seed = 1, height, color } = {}) {
  const r = rng(seed), g = new THREE.Group(), h = height ?? 2.2 + r() * 1.5, w = .7 + h * .28;
  const tint = MUSHROOM_GLOW[color] ?? (r() < .5 ? MUSHROOM_GLOW.blue : MUSHROOM_GLOW.purple);
  const cap = M(tint, { emissive: tint, emissiveIntensity: .9, roughness: .55, flatShading: true });
  const gills = M(new THREE.Color(tint).lerp(new THREE.Color(0xe8eeff), .35).getHex(), { emissive: tint, emissiveIntensity: .55, roughness: .8 });
  const stem = M(0xcfc8d8, { emissive: tint, emissiveIntensity: .12, roughness: .9, flatShading: true });
  g.add(mesh(new THREE.CylinderGeometry(h * .055, h * .1, h, 7), stem, 0, h / 2, 0));
  const dome = mesh(new THREE.SphereGeometry(w, 9, 4, 0, Math.PI * 2, 0, Math.PI / 2), cap, 0, h - .05, 0); dome.scale.y = .62; dome.rotation.z = (r() - .5) * .16; g.add(dome);
  g.add(mesh(new THREE.CylinderGeometry(w * .98, h * .07, .16, 9), gills, 0, h - .1, 0));
  // Pale spots on the cap, a ring on the stem.
  const spot = M(0xe8eeff, { emissive: 0xbcd0ff, emissiveIntensity: .5, roughness: .7 });
  for (let i = 0; i < 5; i++) { const a = r() * Math.PI * 2, d = w * (.25 + r() * .5), s = mesh(new THREE.SphereGeometry(.06 + r() * .05, 5, 3), spot, Math.cos(a) * d, h - .03 + Math.sqrt(Math.max(0, w * w - d * d)) * .62, Math.sin(a) * d); s.scale.y = .4; g.add(s); }
  g.add(mesh(new THREE.CylinderGeometry(h * .1, h * .08, .1, 7), gills, 0, h * .68, 0));
  g.userData.glow = { y: h - .25, z: 0, color: tint };
  return g;
}

// A fat puffball on the floor, swollen with spores: step near and it bursts.
export function puffball({ seed = 1, size = .42 } = {}) {
  const r = rng(seed), g = new THREE.Group(), tint = 0x8fd14f;
  const skin = M(0xb7c68a, { emissive: tint, emissiveIntensity: .35, roughness: .95, flatShading: true });
  for (let i = 0; i < 3; i++) {
    const a = r() * Math.PI * 2, d = i ? size * 1.3 : 0, s = i ? size * (.45 + r() * .25) : size, ball = mesh(new THREE.IcosahedronGeometry(s, 1), skin, Math.cos(a) * d, s * .78, Math.sin(a) * d);
    ball.scale.y = .8; g.add(ball);
  }
  g.userData.glow = { y: size, z: 0, color: tint };
  return g;
}

// A rope tied to an iron ring and hanging `length` metres down from the origin.
export function hangingRope({ length = 4.4, seed = 1 } = {}) {
  const r = rng(seed), g = new THREE.Group(), rope = M(ROPE, { roughness: 1 }), iron = M(IRON, { roughness: .6, metalness: .5 });
  // Knots every 80 cm: what a hand finds on the way.
  const line = new THREE.CylinderGeometry(.025, .025, length, 5).toNonIndexed(); line.translate(0, -length / 2, 0);
  const parts = [line];
  for (let y = -.5; y > -length; y -= .8) { const k = new THREE.SphereGeometry(.05, 5, 3).toNonIndexed(); k.scale(1, .7, 1); k.translate((r() - .5) * .01, y, 0); parts.push(k); }
  g.add(new THREE.Mesh(mergeGeometries(parts), rope));
  parts.forEach(p => p.dispose());
  g.add(mesh(new THREE.TorusGeometry(.12, .025, 5, 10), iron, 0, .02, 0));
  return g;
}

// The iron stake a rope gets tied to; with `tied`, a few turns of rope on it.
export function ropeAnchor({ tied = false } = {}) {
  const g = new THREE.Group(), iron = M(IRON, { roughness: .6, metalness: .5 });
  g.add(mesh(new THREE.CylinderGeometry(.05, .07, .7, 6), iron, 0, .35, 0));
  g.add(mesh(new THREE.TorusGeometry(.13, .03, 5, 10), iron, 0, .72, 0));
  if (tied) { const rope = M(ROPE, { roughness: 1 }); for (const y of [.3, .38, .46]) { const turn = mesh(new THREE.TorusGeometry(.085, .028, 5, 10), rope, 0, y, 0); turn.rotation.x = Math.PI / 2; g.add(turn); } }
  return g;
}

// A plank walkway over a drop: `span` long on z, `width` wide, a rope rail to
// hold on one side. Deck top on y = 0.
export function narrowBeam({ span = 5, width = 1.1, seed = 1 } = {}) {
  const r = rng(seed), g = new THREE.Group(), wood = M(WOOD, { roughness: .95, flatShading: true }), rope = M(ROPE, { roughness: 1 }), parts = [];
  for (let z = -span / 2 + .18; z < span / 2; z += .38) { const p = new THREE.BoxGeometry(width * (.92 + r() * .08), .07, .33); p.rotateY((r() - .5) * .05); p.translate((r() - .5) * .03, -.035 - r() * .012, z); parts.push(p); }
  for (const s of [-1, 1]) { const b = new THREE.BoxGeometry(.1, .1, span); b.translate(s * width * .32, -.12, 0); parts.push(b); }
  for (const z of [-span / 2 + .1, span / 2 - .1]) { const p = new THREE.BoxGeometry(.08, 1, .08); p.translate(-width / 2 + .05, .42, z); parts.push(p); }
  g.add(new THREE.Mesh(mergeGeometries(parts), wood)); parts.forEach(p => p.dispose());
  const rail = mesh(new THREE.CylinderGeometry(.018, .018, span - .2, 4), rope, -width / 2 + .05, .88, 0); rail.rotation.x = Math.PI / 2; g.add(rail);
  return g;
}

// A coil of rope with a tied end: the cuerda a pana carries.
export function coiledRope({ size = .22 } = {}) {
  const g = new THREE.Group(), rope = M(ROPE, { roughness: 1 });
  for (const [i, y] of [.03, .08, .13].entries()) { const turn = mesh(new THREE.TorusGeometry(size - i * .012, .03, 5, 12), rope, 0, y, 0); turn.rotation.x = Math.PI / 2; g.add(turn); }
  const end = mesh(new THREE.CylinderGeometry(.024, .024, size * 1.1, 4), rope, size * .9, .05, size * .3); end.rotation.set(Math.PI / 2, 0, .3); g.add(end);
  return g;
}

// A road flare: red paper, a dark cap and a bright tip.
export function flareStick({ lit = true } = {}) {
  const g = new THREE.Group();
  g.add(mesh(new THREE.CylinderGeometry(.028, .028, .3, 6), M(0xc8281e, { roughness: .7 }), 0, .15, 0));
  g.add(mesh(new THREE.CylinderGeometry(.03, .03, .03, 6), M(0x222026, { roughness: .8 }), 0, .015, 0));
  g.add(mesh(new THREE.SphereGeometry(.035, 6, 4), lit ? M(0xffd0c0, { emissive: 0xff3a22, emissiveIntensity: 2.4 }) : M(0x8a8078, { roughness: 1 }), 0, .31, 0));
  return g;
}

// El encargo: a small crate roped shut, with a wax seal.
export function sealedParcel({ seed = 3 } = {}) {
  const r = rng(seed), g = new THREE.Group(), s = .34;
  const box = mesh(new THREE.BoxGeometry(s, s * .72, s * .8), M(0x7a5a38, { roughness: .9, flatShading: true }), 0, s * .36, 0); box.rotation.y = (r() - .5) * .1;
  const rope = M(ROPE, { roughness: 1 });
  g.add(box, mesh(new THREE.BoxGeometry(s + .015, s * .74, .03), rope, 0, s * .36, 0), mesh(new THREE.BoxGeometry(.03, s * .74, s * .82), rope, 0, s * .36, 0));
  g.add(mesh(new THREE.CylinderGeometry(.05, .05, .018, 8), M(0xc22f3a, { emissive: 0x7a1820, emissiveIntensity: .6, roughness: .4 }), 0, s * .73, 0));
  return g;
}

// The floor under a failing ceiling: a star of cracks and a little fallen grit,
// so a watchful pana can step around it. Flat on y = 0.
export function ceilingCrackMark({ seed = 1, size = 1.1 } = {}) {
  const r = rng(seed), g = new THREE.Group(), dark = M(0x18120e, { roughness: 1 }), grit = M(0x8a7a64, { roughness: 1, flatShading: true }), parts = [], stones = [];
  for (let i = 0; i < 6; i++) { const a = i / 6 * Math.PI * 2 + r() * .4, l = size * (.5 + r() * .5), c = new THREE.BoxGeometry(l, .006, .035 + r() * .03); c.translate(l / 2, 0, 0); c.rotateY(a); c.translate(0, .012, 0); parts.push(c); }
  for (let i = 0; i < 7; i++) { const a = r() * Math.PI * 2, d = r() * size * .6, s = new THREE.IcosahedronGeometry(.03 + r() * .05, 0); s.translate(Math.cos(a) * d, .03, Math.sin(a) * d); stones.push(s); }
  g.add(new THREE.Mesh(mergeGeometries(parts), dark), new THREE.Mesh(mergeGeometries(stones), grit));
  parts.forEach(p => p.dispose()); stones.forEach(p => p.dispose());
  return g;
}

// Shallow standing water over the given floor rectangles ([x0, z0, x1, z1]), one
// mesh and one draw for a whole floor. Its ripples scroll on one painted normal
// map; userData.tick(t) moves them, userData.level(y) raises the water, and
// userData.dispose() frees what it owns.
function rippleNormals() {
  const n = 128, canvas = document.createElement('canvas'); canvas.width = canvas.height = n;
  const ctx = canvas.getContext('2d'), img = ctx.createImageData(n, n), r = rng(41), waves = Array.from({ length: 7 }, () => ({ fx: 1 + Math.floor(r() * 4), fz: 1 + Math.floor(r() * 4), p: r() * 6.28, a: .3 + r() * .7 }));
  const height = (x, z) => waves.reduce((s, w) => s + w.a * Math.sin((x * w.fx + z * w.fz) * Math.PI * 2 + w.p), 0);
  for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) {
    const x = i / n, z = j / n, dx = height(x + 1 / n, z) - height(x - 1 / n, z), dz = height(x, z + 1 / n) - height(x, z - 1 / n), k = (j * n + i) * 4;
    img.data[k] = 128 + dx * 150; img.data[k + 1] = 128 + dz * 150; img.data[k + 2] = 255; img.data[k + 3] = 255;
  }
  ctx.putImageData(img, 0, 0);
  const texture = new THREE.CanvasTexture(canvas); texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  return texture;
}
export function floodSurface({ rects = [[-4, -4, 4, 4]], y = .13, color = 0x1f5560, opacity = .62 } = {}) {
  const planes = rects.map(([a, b, c, d]) => {
    const p = new THREE.PlaneGeometry(c - a, d - b).rotateX(-Math.PI / 2); p.translate((a + c) / 2, 0, (b + d) / 2);
    // World-sized UVs, so ripples keep their scale across rooms and corridors.
    const at = p.attributes.position, uv = p.attributes.uv; for (let i = 0; i < at.count; i++) uv.setXY(i, at.getX(i) / 7, at.getZ(i) / 7);
    return p;
  });
  const normalMap = rippleNormals();
  const material = new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: .35, transparent: true, opacity, roughness: .14, metalness: .35, normalMap, normalScale: new THREE.Vector2(.9, .9), depthWrite: false });
  const water = new THREE.Mesh(mergeGeometries(planes), material); planes.forEach(p => p.dispose());
  water.position.y = y; water.renderOrder = 1; water.name = 'Agua';
  water.userData.tick = t => normalMap.offset.set(t * .018, t * .011);
  water.userData.level = next => { water.position.y = next; };
  water.userData.dispose = () => { water.geometry.dispose(); material.dispose(); normalMap.dispose(); };
  return water;
}
