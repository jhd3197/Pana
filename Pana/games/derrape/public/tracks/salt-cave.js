// A salt mine along part of a route: domed halls lit by hundreds of pulsing
// crystals, glowing salt pools, a waterfall, old mine timbers. Two settings:
// under a mountain (caveMountain, Selva) or under a flat, where the road
// dives down an open cut into a closed tunnel (undergroundGround and
// tunnelMouths, Salinas). Every prop comes from the shared model library.
// cave = { from, to, halls: [{ u, wide, tall }], skylights: [[a, b]] } in u.
import { THREE, M, finish, put, placeOnTrack, smooth, mix, rng } from './world-kit.js';
import { hollowGallery, hallProfile } from './water-world-kit.js';
import { riverSurface } from '/engine/models/effects/water-surface.js';
import { waterfall } from '/engine/models/effects/waterfall.js';
import { lightShaft, glowPool } from '/engine/models/effects/atmosphere.js';
import { mossRock } from '/engine/models/vegetation/moss-rock.js';
import { floatingMotes } from '/engine/models/effects/drifting-particles.js';
import { crystalField } from '/engine/models/props/crystals.js';
import { stalactiteCluster } from '/engine/models/props/caves.js';
import { stalagmites } from '/engine/models/props/ruins.js';
import { mineSupport, mineLanternPost, mineCart, mineTrack, mineGate } from '/engine/models/props/mine.js';
import { saltPool } from '/engine/models/props/saltworks.js';
import { rockArch } from '/engine/models/props/mountain.js';

export const SALT_CAVE = {
  salt: 0xffe6ef, rock: 0xe08fb8, rockDeep: 0xa65a9c, floor: 0xf0b0cc,
  crystals: [0xff4fa3, 0xff8ad0, 0x35e0d0, 0xb06cff, 0xffb3e0], pink: 0xff7fbf, teal: 0x3fd8d0,
};

// Half-width and height along u: a tunnel of `width`×`height` opening into halls.
export function caveProfile(cave, { width = 29, height = 24 } = {}) {
  return {
    widthAt: hallProfile(width, cave.halls.map(h => ({ u: h.u, add: h.wide, spread: .022 }))),
    heightAt: hallProfile(height, cave.halls.map(h => ({ u: h.u, add: h.tall, spread: .024 }))),
  };
}
// 0 outside, 1 inside, ramping over the mouths.
export const caveWeight = (cave, u) => smooth(u, cave.from - .03, cave.from + .004) * (1 - smooth(u, cave.to - .004, cave.to + .03));

// Terrain: flat floors under the halls, a mountain above and around the
// shell, the caller's own ground everywhere else.
export function caveMountain(T, cave, { widthAt }, ground, { peak = 82 } = {}) {
  return (x, z) => {
    const n = T.nearest(x, z), u = n.s / T.TOTAL, c = caveWeight(cave, u), land = ground(x, z);
    if (c <= 0) return land;
    const w = widthAt(u), floor = T.heightAtS(n.s) - .6;
    if (u > cave.from && u < cave.to && n.d < w + 3) return floor;
    const top = peak + 9 * Math.sin(x * .013) * Math.cos(z * .011) + 5 * Math.sin(x * .041 + z * .03);
    return mix(land, mix(floor, top, smooth(n.d, w + 3, w + 36)), c);
  };
}
// Under a flat: the open cut where the road is below the ground, the
// untouched flat above the tunnel, the usual road carve elsewhere. Build the
// terrain with carve: false and this as its base.
export function undergroundGround(T, cave, { widthAt }, ground) {
  return (x, z) => {
    const n = T.nearest(x, z), u = n.s / T.TOTAL, land = ground(x, z), road = T.surfaceAt(x, z) - .65;
    if (u >= cave.from && u <= cave.to && n.d < widthAt(u) + 40) return land;
    if (road < land - 1) return mix(road, land, smooth(n.d, T.HW + 3, T.HW + 14));
    return mix(road, land, smooth(n.d, T.HW + 9, T.HW + 35));
  };
}
// Ground for cars and tests: the cave floor under the tunnel's footprint.
export function caveFloorGround(T, cave, { widthAt }, groundAt) {
  return (x, z) => {
    const n = T.nearest(x, z), u = n.s / T.TOTAL;
    if (u >= cave.from && u <= cave.to && n.d < widthAt(u)) return T.heightAtS(n.s) - .6;
    // The 5 m terrain grid cannot follow the steep cut walls exactly; on the
    // road itself the ground is the carved bed under the deck.
    return n.d < T.HW + 1 ? Math.min(groundAt(x, z), T.heightAtS(n.s) - .65) : groundAt(x, z);
  };
}

// The tunnel mouths in an open cut. The heightfield cannot overhang, so the
// terrain triangles just inside each mouth are removed and replaced by a cut
// face with a tunnel-shaped hole, a lid at ground level over the first
// metres and an apron in front; a library mine gate frames the opening.
export function tunnelMouths(T, cave, { widthAt, heightAt }, land, ground, { name = 'salt-mine', material } = {}) {
  const group = new THREE.Group(), geo = land.geometry, p = geo.attributes.position, index = geo.index.array, kept = [];
  const reach = 12 / T.TOTAL, uOf = new Float32Array(p.count), dOf = new Float32Array(p.count);
  for (let i = 0; i < p.count; i++) { const n = T.nearest(p.getX(i), p.getZ(i)); uOf[i] = n.s / T.TOTAL; dOf[i] = n.d; }
  const inLid = i => dOf[i] < widthAt(uOf[i]) + 12 && ((uOf[i] >= cave.from && uOf[i] <= cave.from + reach) || (uOf[i] <= cave.to && uOf[i] >= cave.to - reach));
  for (let t = 0; t < index.length; t += 3) if (!(inLid(index[t]) || inLid(index[t + 1]) || inLid(index[t + 2]))) kept.push(index[t], index[t + 1], index[t + 2]);
  geo.setIndex(kept);
  const rock = material ?? M(0xf6e4ec, { roughness: .9, emissive: 0x7a3a65, emissiveIntensity: .3, side: THREE.DoubleSide });
  const ribbon = (u0, u1, height) => {
    const pos = [], idx = [], cols = 16, rows = 8;
    for (let r = 0; r <= rows; r++) for (let c = 0; c <= cols; c++) {
      const u = u0 + (u1 - u0) * r / rows, w = widthAt(u) + 14, q = placeOnTrack(T, u * T.TOTAL, -w + 2 * w * c / cols);
      pos.push(q.x, height(q, u), q.z);
      if (r < rows && c < cols) { const a = r * (cols + 1) + c; idx.push(a, a + cols + 1, a + 1, a + 1, a + cols + 1, a + cols + 2); }
    }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setIndex(idx); g.computeVertexNormals();
    const m = new THREE.Mesh(g, rock); m.receiveShadow = true; return m;
  };
  for (const [u, dir] of [[cave.from, 1], [cave.to, -1]]) {
    const q = placeOnTrack(T, u * T.TOTAL, 0), w = widthAt(u), h = heightAt(u), top = Math.max(...[-1, 0, 1].map(k => ground(q.x + Math.cos(q.h) * k * (w + 12), q.z - Math.sin(q.h) * k * (w + 12)))) + .4;
    // Face: the cut wall around the tunnel's opening profile.
    const outer = new THREE.Shape([[-(w + 14), -8], [w + 14, -8], [w + 14, top - q.y], [-(w + 14), top - q.y]].map(([x, y]) => new THREE.Vector2(x, y)));
    outer.holes.push(new THREE.Path([[-w, -5], [-w, 12], [-w * .78, h * .8], [0, h], [w * .78, h * .8], [w, 12], [w, -5]].reverse().map(([x, y]) => new THREE.Vector2(x, y))));
    const face = new THREE.Mesh(new THREE.ShapeGeometry(outer), rock); face.position.set(q.x, q.y, q.z); face.rotation.y = q.h + (dir > 0 ? Math.PI : 0); group.add(face);
    // Lid over the first metres of tunnel, apron in front of the face.
    group.add(ribbon(u, u + dir * reach * 1.1, (p) => ground(p.x, p.z) + .05));
    group.add(ribbon(u - dir * 9 / T.TOTAL, u, (p, uu) => { const n = T.nearest(p.x, p.z), road = T.heightAtS(uu * T.TOTAL) - .65; return mix(road, ground(p.x, p.z), smooth(n.d, T.HW + 3, T.HW + 14)) - .04; }));
    // A library rock arch in salt colours frames the opening in the cut face.
    const arch = rockArch({ span: w - 1, height: h + 1, depth: 6, seed: 211 + dir, color: 0xf1d3df });
    arch.position.set(q.x, q.y - .8, q.z); arch.rotation.y = q.h + (dir > 0 ? Math.PI : 0); group.add(arch);
    const gate = mineGate({ span: T.HW + 3, height: Math.min(11, h - 1) }); gate.position.set(q.x, q.y - .3, q.z); gate.rotation.y = q.h + (dir > 0 ? Math.PI : 0); gate.translateZ(.8); group.add(gate);
  }
  group.userData.tick = () => {};
  group.name = `${name}-mouths`; return group;
}

// Pink walls deepening to violet under the dome, with a soft emissive so the
// cave stays candy-coloured where no light reaches.
// Colour a hollowGallery shell by profile vertex (floor edge, wall top,
// shoulder, crown) and give it a soft glow so a cave never reads dark.
export function tintShell(shell, { ring, emissive, intensity = .5 }) {
  const m = shell.children[0], c = m.geometry.attributes.color, colours = [...ring, ...ring.slice(0, 3).reverse()].map(h => new THREE.Color(h));
  const tint = new THREE.Color();
  for (let i = 0; i < c.count; i++) { tint.copy(colours[i % 7]).multiplyScalar(.9 + .2 * Math.sin(i * 1.7) * Math.sin(i * .31)); c.setXYZ(i, tint.r, tint.g, tint.b); }
  m.material = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: .8, flatShading: true, side: THREE.DoubleSide, emissive, emissiveIntensity: intensity });
}
// `dim` is the mysterious deep mine: violet rock, a faint glow, crystals carry the light.
const SALT_SHELL = { ring: [SALT_CAVE.floor, SALT_CAVE.rock, 0xd070b0, 0xa66ad0], emissive: 0x7a2860, intensity: .6 };
const DIM_SHELL = { ring: [0x7a4a7a, 0x6a3f72, 0x4f3170, 0x3a2a66], emissive: 0x2a1040, intensity: .5 };

// Crystal formations anchored in the rock, grouped rather than sprinkled:
//  - boulder bumps along the wall base give the walls relief,
//  - crystal beds grow from rubble at the foot of the walls,
//  - ledges: a boulder half sunk in the wall carrying a chunky cluster,
//  - giants (2-4 times car height) on rubble beside the road, each with a
//    glow pool on the floor; only the first `lights` giants get a real light,
//  - a few dense chandeliers hanging from rock knobs in the crown.
// Every piece is a library model (mossRock, crystalField, glowPool).
export function caveFormations(T, cave, { widthAt }, shell, { palette, seed = 31, rock = null, moss = true, glow = 1.4,
  bedEvery = 30, ledgeEvery = 46, giantEvery = 150, bumpEvery = 11, chandeliers = 4, lights = 0, avoid = () => false, name = 'cave-formations' } = {}) {
  const group = new THREE.Group(), random = rng(seed), surface = shell.userData.corridor.surface, rocks = new THREE.Group();
  const clusters = [], giants = [], pools = [], colour = () => Math.floor(random() * palette.length);
  const span = cave.to - cave.from, length = span * T.TOTAL, road = u => T.heightAtS(u * T.TOTAL);
  const inward = (u, side) => { const p = placeOnTrack(T, u * T.TOTAL, 0); return [side * Math.cos(p.h), 0, -side * Math.sin(p.h)]; };
  const boulder = (x, y, z, size, turn = random() * 6) => put(rocks, mossRock({ seed: Math.floor(random() * 1e4), size, color: rock, moss }), x, z, y, turn);
  const along = (every, fn) => { for (let d = every * (.3 + random() * .5); d < length - 8; d += every * (.75 + random() * .5)) fn(cave.from + d / T.TOTAL); };
  // Wall relief.
  along(bumpEvery, u => { for (const side of [-1, 1]) { const w = widthAt(u), q = placeOnTrack(T, u * T.TOTAL, side * (w - .8)); if (!avoid(q.x, q.z)) boulder(q.x, road(u) - 1.2, q.z, 2.2 + random() * 2.6); } });
  // Beds at the wall base.
  let bedSide = 1;
  along(bedEvery, u => {
    const side = bedSide = -bedSide, w = widthAt(u), n = inward(u, side), c = placeOnTrack(T, u * T.TOTAL, side * (w - 4.5));
    if (avoid(c.x, c.z)) return;
    const y = road(u) - .6, tint = colour();
    for (let k = 0; k < 3; k++) boulder(c.x + (random() - .5) * 5, y - .4, c.z + (random() - .5) * 5, 1.1 + random() * 1.2);
    for (let k = 0; k < 4 + Math.floor(random() * 3); k++) clusters.push({ x: c.x + (random() - .5) * 5, y, z: c.z + (random() - .5) * 5, normal: [n[0] * .35 + (random() - .5) * .3, 1, n[2] * .35], size: 1.8 + random() * 1.6, color: random() < .7 ? tint : colour(), count: 8 });
  });
  // Ledges: big boulders against the wall, resting on the floor, a cluster on top.
  along(ledgeEvery, u => {
    const side = random() < .5 ? -1 : 1, w = widthAt(u), n = inward(u, side), q = placeOnTrack(T, u * T.TOTAL, side * (w - 1)), size = 3.8 + random() * 1.6, y = road(u) - .6 + size * .45;
    boulder(q.x, y - size * .45, q.z, size);
    const top = placeOnTrack(T, u * T.TOTAL, side * (w - size * .45));
    clusters.push({ x: top.x, y: y + size * .2, z: top.z, normal: [n[0] * .5, 1, n[2] * .5], size: 1.6 + random() * 1.2, color: colour(), count: 9 });
  });
  // Giants beside the road.
  let giantSide = 1;
  along(giantEvery, u => {
    const side = giantSide = -giantSide, n = inward(u, side), c = placeOnTrack(T, u * T.TOTAL, side * (T.HW + 8 + random() * 3));
    if (avoid(c.x, c.z)) return;
    const y = road(u) - .6, tint = colour();
    boulder(c.x, y - 1, c.z, 3.2); boulder(c.x + 2.5, y - .6, c.z - 2, 1.8); boulder(c.x - 2.2, y - .6, c.z + 2.4, 1.6);
    giants.push({ x: c.x, y: y + .8, z: c.z, normal: [n[0] * .2, 1, n[2] * .2], size: 4.5 + random() * 2, count: 13, color: tint });
    clusters.push({ x: c.x + 2.4, y: y + .3, z: c.z - 2, normal: [n[0] * .5, 1, n[2] * .5], size: 2.2, color: tint, count: 6 });
    pools.push([c.x, y + .02, c.z, palette[tint]]);
  });
  // Chandeliers: a rock knob in the crown with a dense cluster hanging down.
  for (let k = 0; k < chandeliers; k++) {
    const u = cave.from + span * (k + .5) / chandeliers + (random() - .5) * span * .05;
    if (cave.skylights.some(([a, b]) => u > a - .01 && u < b + .01)) continue;
    const off = (random() - .5) * widthAt(u) * .4, q = placeOnTrack(T, u * T.TOTAL, off), y = road(u) + surface(u, off), tint = colour();
    const knob = mossRock({ seed: 900 + k, size: 3, color: rock, moss: false }); knob.rotation.x = Math.PI; put(rocks, knob, q.x, q.z, y + 1.2, random() * 6);
    for (let i = 0; i < 9; i++) clusters.push({ x: q.x + (random() - .5) * 3.5, y: y - .3, z: q.z + (random() - .5) * 3.5, normal: [(random() - .5) * .5, -1, (random() - .5) * .5], size: 1.2 + random() * 1.4, color: random() < .75 ? tint : colour(), count: 6 });
  }
  group.add(finish(rocks));
  const field = crystalField(clusters, { palette, seed, glow, pulse: .3, brightest: 0 }); field.name = `${name}-crystals`; group.add(field);
  const big = crystalField(giants, { palette, seed: seed + 1, glow: glow + .2, pulse: .25, brightest: 0 }); big.name = `${name}-giants`; group.add(big);
  for (const [x, y, z, c] of pools) { const g = glowPool({ radius: 9, color: c, intensity: .5 }); g.position.set(x, y, z); group.add(g); }
  const lamps = giants.slice(0, lights).map(g => { const l = new THREE.PointLight(palette[g.color], 900, 70, 1.6); l.position.set(g.x, g.y + g.size, g.z); group.add(l); return l; });
  group.name = name;
  group.userData.giants = giants;
  group.userData.tick = t => { field.userData.tick(t); big.userData.tick(t); lamps.forEach((l, i) => { l.intensity = 900 * (.85 + .15 * Math.sin(t * 1.1 + i * 1.7)); }); };
  return group;
}

export function saltCave(T, cave, profile, { groundAt, seed = 207, name = 'salt-cave', dim = false, floor = false } = {}) {
  const group = new THREE.Group(), random = rng(seed), { widthAt, heightAt } = profile;
  group.name = name;
  const ticks = [], at = (u, off) => placeOnTrack(T, u * T.TOTAL, off), road = u => T.heightAtS(u * T.TOTAL);
  const inward = (p, side) => [side * Math.cos(p.h), 0, -side * Math.sin(p.h)];
  const skylit = u => cave.skylights.some(([a, b]) => u > a - .006 && u < b + .006);

  const shell = hollowGallery(T, { from: cave.from, to: cave.to, skylights: cave.skylights, widthAt, heightAt, color: SALT_CAVE.rock, name: `${name}-shell` });
  tintShell(shell, dim ? DIM_SHELL : SALT_SHELL); group.add(shell);
  // Under a flat there is no terrain below the shell: give it a salt floor.
  if (floor) {
    const pos = [], col = [], idx = [], n = Math.ceil((cave.to - cave.from) * T.TOTAL / 3), cols = 8, tint = new THREE.Color();
    for (let i = 0; i <= n; i++) for (let c = 0; c <= cols; c++) {
      const u = cave.from + (cave.to - cave.from) * i / n, w = widthAt(u) + 1, q = at(u, -w + 2 * w * c / cols);
      pos.push(q.x, road(u) - .6, q.z); tint.setHex(dim ? 0x8a5a8e : SALT_CAVE.floor).offsetHSL(0, 0, .04 * Math.sin(i * .7 + c)); col.push(tint.r, tint.g, tint.b);
      if (i < n && c < cols) { const a = i * (cols + 1) + c; idx.push(a, a + cols + 1, a + 1, a + 1, a + cols + 1, a + cols + 2); }
    }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3)); g.setIndex(idx); g.computeVertexNormals();
    const m = new THREE.Mesh(g, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: .9, side: THREE.DoubleSide, emissive: dim ? 0x241032 : 0x5a1a48, emissiveIntensity: .5 }));
    m.name = `${name}-floor`; m.receiveShadow = true; group.add(m);
  }

  // Pools beside the road in every hall, pink and turquoise behind salt crusts.
  const pools = [];
  const addPool = (x, z, y, rx, rz, rot, color, poolName) => {
    const pool = saltPool({ rx, rz, color, glow: dim ? .7 : .45 }); pool.name = poolName;
    pool.position.set(x, y, z); pool.rotation.y = rot; group.add(pool); ticks.push(pool.userData.tick);
    pools.push({ x, z, r: Math.max(rx, rz) + 3 });
  };
  cave.halls.forEach((hall, i) => {
    for (const side of hall.sides ?? [-1, 1]) {
      const u = hall.u + side * .01, p = at(u, side * (T.HW + 22));
      addPool(p.x, p.z, road(u) - .6, 11, 7, p.h + Math.PI / 2, (i + (side > 0 ? 1 : 0)) % 2 ? SALT_CAVE.teal : SALT_CAVE.pink, `${name}-pool-${i}${side > 0 ? 'r' : 'l'}`);
    }
  });
  for (const sc of T.shortcuts) {
    const mx = (sc.a.x + sc.b.x) / 2, mz = (sc.a.z + sc.b.z) / 2, n = T.nearest(mx, mz);
    if (!(n.s / T.TOTAL > cave.from && n.s / T.TOTAL < cave.to)) continue;
    const len = Math.hypot(sc.b.x - sc.a.x, sc.b.z - sc.a.z), rz = Math.max(4, Math.min(9, n.d - T.HW - 5));
    addPool(mx, mz, T.heightAtS(n.s) - .6, len * .3, rz, Math.atan2(sc.b.x - sc.a.x, sc.b.z - sc.a.z) + Math.PI / 2, SALT_CAVE.teal, `${name}-shortcut-pool`);
  }
  const nearPool = (x, z, m = 0) => pools.some(p => Math.hypot(p.x - x, p.z - z) < p.r + m);

  // Waterfall down the wall of the last hall, a pool at its foot and a stone
  // channel carrying the water along the floor.
  {
    const hall = cave.halls.at(-1), u = hall.u + .018, side = 1, w = widthAt(u), p = at(u, side * (w - 2.5)), y = road(u) - .6;
    const fall = waterfall({ width: 9, height: heightAt(u) * .62, run: 2, seed });
    const n = inward(p, side); fall.position.set(p.x, y, p.z); fall.rotation.y = Math.atan2(n[0], n[2]); group.add(fall);
    const foot = at(u, side * (w - 9));
    addPool(foot.x, foot.z, y, 6.5, 4.5, p.h, SALT_CAVE.teal, `${name}-waterfall-pool`);
    const chan = [];
    for (let k = 0; k <= 8; k++) { const q = at(u - .005 - k * .005, side * (w - 11)); chan.push([q.x, q.z]); }
    const stream = riverSurface(chan, 3.2, () => y + .3, { color: SALT_CAVE.teal, foam: k => k < .15 ? .8 : .1 });
    stream.name = `${name}-channel`; group.add(stream); ticks.push(t => stream.userData.tick(t));
    pools.push({ x: (chan[0][0] + chan.at(-1)[0]) / 2, z: (chan[0][1] + chan.at(-1)[1]) / 2, r: 24 });
  }

  // Crystals on walls, shoulders, crown and floor; giants in each hall carry
  // the only real lights.
  const crystals = caveFormations(T, cave, profile, shell, { palette: SALT_CAVE.crystals, seed, rock: dim ? 0x8a5a8e : 0xe7b3cb, moss: false, avoid: (x, z) => nearPool(x, z, 3), name: `${name}-formations` });
  group.add(crystals); ticks.push(crystals.userData.tick); const fields = 2;
  const giants = [];
  cave.halls.forEach((hall, i) => {
    for (const side of [-1, 1]) {
      const u = hall.u - side * .014, p = at(u, side * (T.HW + 13));
      giants.push({ x: p.x, y: road(u) - .6, z: p.z, normal: [0, 1, 0], size: 6 + random() * 2, count: 14, color: [0, 2, 3, 1, 2, 0][(i * 2 + (side > 0 ? 1 : 0)) % 6] });
    }
  });
  const giantField = crystalField(giants, { palette: SALT_CAVE.crystals, seed: seed + 50, glow: 1.5, pulse: .25 });
  giantField.name = `${name}-giant-crystals`; group.add(giantField); ticks.push(giantField.userData.tick);
  for (const g of giants) { const pool = glowPool({ radius: 11, color: SALT_CAVE.crystals[g.color], intensity: .55 }); pool.position.set(g.x, g.y + .03, g.z); group.add(pool); }
  const lights = giants.slice(0, 6).map(g => {
    const light = new THREE.PointLight(SALT_CAVE.crystals[g.color], 1100, 80, 1.6); light.position.set(g.x, g.y + g.size * 1.1, g.z);
    light.name = `${name}-crystal-light`; group.add(light); return light;
  });
  ticks.push(t => lights.forEach((l, i) => { l.intensity = 1100 * (.85 + .15 * Math.sin(t * 1.1 + i * 1.7)); }));

  // Stalactites hang from the dome; stalagmites rise along the walls.
  const formations = new THREE.Group(), saltRock = M(0xe09ac4, { roughness: .85, emissive: 0x5a1a48, emissiveIntensity: .45 });
  let hanging = 0, rising = 0;
  for (let u = cave.from + .01; u < cave.to - .01; u += 20 / T.TOTAL) {
    const side = hanging % 2 ? 1 : -1, w = widthAt(u), y0 = road(u);
    if (!skylit(u)) { const p = at(u, side * w * .35); put(formations, stalactiteCluster({ seed: seed + 500 + hanging, length: 5 + heightAt(u) * .12 }), p.x, p.z, y0 + shell.userData.corridor.surface(u, side * w * .35) + .3, p.h); hanging++; }
    const q = at(u + 5 / T.TOTAL, -side * (w - 5));
    if (!nearPool(q.x, q.z, 3)) { put(formations, stalagmites({ seed: seed + 560 + rising, count: 7, height: 3 + random() * 3 }), q.x, q.z, y0 - .6, random() * 6); rising++; }
  }
  formations.traverse(o => { if (o.isMesh) o.material = saltRock; });
  group.add(finish(formations));

  // Old salt-mine timbers: arches in the halls, lanterns along the road,
  // carts on rails beside the first hall, a portal at each mouth.
  const mine = new THREE.Group();
  for (const hall of cave.halls) {
    const u = hall.u + .028, p = at(u, 0); put(mine, mineSupport({ width: (T.HW + 3) * 2 / 3, height: 3.6, lantern: true }), p.x, p.z, road(u), p.h, 3);
  }
  let posts = 0;
  for (let u = cave.from + .015; u < cave.to; u += 40 / T.TOTAL) for (const side of [-1, 1]) {
    const p = at(u, side * (T.HW + 2.5)); put(mine, mineLanternPost({ light: false }), p.x, p.z, road(u) - .5, p.h + (side > 0 ? Math.PI : 0)); posts++;
  }
  {
    const u = cave.halls[0].u + .02, side = -1, w = widthAt(u), p = at(u, side * (w - 8)), y = road(u) - .6;
    put(mine, mineTrack({ length: 26 }), p.x, p.z, y, p.h);
    for (const k of [-6, 5]) { const q = at(u + k / T.TOTAL, side * (w - 8)); put(mine, mineCart({ seed: 41 + k, load: 'gold' }), q.x, q.z, y + .2, p.h, 1.3); }
  }
  group.add(finish(mine));

  // Skylights (if any): fresnel beams from the openings, dust drifting through.
  for (const [a, b] of cave.skylights) {
    const u = (a + b) / 2, p = at(u, 0);
    const beam = lightShaft({ radius: 6, height: heightAt(u) + 6, spread: 2.2, tilt: 0, fresnel: true, color: 0xffe2f0, opacity: .12, dustCount: 300, seed: Math.round(u * 100) });
    beam.position.set(p.x, road(u) - .6, p.z); group.add(beam); ticks.push(beam.userData.tick);
  }
  // Glowing salt motes through the whole cave.
  const points = [];
  for (let i = 0; i < 1400; i++) {
    const u = cave.from + random() * (cave.to - cave.from), p = at(u, (random() * 2 - 1) * widthAt(u) * .8);
    points.push([p.x, road(u) + 1 + random() * heightAt(u) * .6, p.z]);
  }
  const motes = floatingMotes({ kind: 'sparkle', color: 0xffa8dc, size: .45, points, seed });
  motes.name = `${name}-motes`; group.add(motes); ticks.push(motes.userData.tick);
  // Crystals crowd both mouths outside too.
  const mouth = [];
  for (const u of [cave.from - .01, cave.to + .01]) for (const side of [-1, 1]) {
    const p = at(u, side * (T.HW + 10)); mouth.push({ x: p.x, y: groundAt ? groundAt(p.x, p.z) : road(u), z: p.z, size: 3.5, count: 10, color: side > 0 ? 0 : 2 });
  }
  const mouthField = crystalField(mouth, { palette: SALT_CAVE.crystals, seed: seed + 90, glow: 1.2 });
  mouthField.name = `${name}-mouth-crystals`; group.add(mouthField); ticks.push(mouthField.userData.tick);
  group.traverse(o => { if (o.name === 'waterfall' && o.userData.tick) ticks.push(o.userData.tick); });

  group.userData.assetCounts = { crystalFields: fields, giants: giants.length, pools: pools.length, stalactites: hanging, stalagmites: rising, lanternPosts: posts };
  return { group, update: (t, dt) => ticks.forEach(tick => tick(t, dt)), pools };
}

// Inside the cave the fog turns rosy and closer. Hooked on a mesh that is
// always drawn (the terrain), it follows whichever camera is rendering.
// Weather stays outside: the race's rain lines hide while the camera is in.
export function caveFog(T, cave, mesh, { color = 0xe48ac4, near = 30, far = 420 } = {}) {
  const inside = new THREE.Color(color);
  let outside = null, outNear = 0, outFar = 0, written = null, raining = false;
  mesh.onBeforeRender = (renderer, scene, camera) => {
    const fog = scene.fog; if (!fog?.isFog) return;
    // A palette applied since the last frame wins: take it as the outside fog.
    const rain = scene.getObjectByName('rain');
    if (!outside || !fog.color.equals(written)) { outside = fog.color.clone(); outNear = fog.near; outFar = fog.far; raining = !!rain?.visible; }
    const n = T.nearest(camera.position.x, camera.position.z), u = n.s / T.TOTAL;
    const k = (1 - smooth(n.d, 40, 90)) * smooth(u, cave.from - .004, cave.from + .02) * (1 - smooth(u, cave.to - .02, cave.to + .004));
    fog.color.copy(outside).lerp(inside, k); written = fog.color.clone(); fog.near = mix(outNear, near, k); fog.far = mix(outFar, far, k);
    if (scene.background?.isColor) scene.background.copy(fog.color);
    if (rain && raining) rain.visible = k < .5;
  };
}
