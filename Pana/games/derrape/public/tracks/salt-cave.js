// A candy-pink salt mine hollowed into a mountain along part of a route:
// domed halls lit by hundreds of pulsing crystals, salt-rimmed pools, a
// waterfall, skylights, old mine timbers and a portal at each mouth.
// cave = { from, to, halls: [{ u, wide, tall }], skylights: [[a, b]] } in u.
import { THREE, M, mesh, box, finish, put, placeOnTrack, smooth, mix, rng, sign } from './world-kit.js';
import { hollowGallery, hallProfile } from './water-world-kit.js';
import { waterPool, riverSurface } from '/engine/models/effects/water-surface.js';
import { waterfall } from '/engine/models/effects/waterfall.js';
import { lightShaft } from '/engine/models/effects/atmosphere.js';
import { floatingMotes } from '/engine/models/effects/drifting-particles.js';
import { crystalField } from '/engine/models/props/crystals.js';
import { stalactiteCluster } from '/engine/models/props/caves.js';
import { stalagmites } from '/engine/models/props/ruins.js';
import { mineSupport, mineLanternPost, mineCart, mineTrack, mineLantern } from '/engine/models/props/mine.js';

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
export function caveColor(T, cave, { widthAt }, colour) {
  const rock = new THREE.Color(SALT_CAVE.rock), deep = new THREE.Color(SALT_CAVE.rockDeep), floor = new THREE.Color(SALT_CAVE.floor);
  return (x, z, y) => {
    const n = T.nearest(x, z), u = n.s / T.TOTAL, c = caveWeight(cave, u);
    if (c <= 0) return colour(x, z, y);
    if (y > T.heightAtS(n.s) + 5) return rock.clone().lerp(deep, smooth(y, 20, 90) * .55).getHex();
    return new THREE.Color(colour(x, z, y)).lerp(floor, c).getHex();
  };
}

// Pink walls deepening to violet under the dome, with a soft emissive so the
// cave stays candy-coloured where no light reaches.
function tintShell(shell) {
  const m = shell.children[0], c = m.geometry.attributes.color;
  const ring = [SALT_CAVE.floor, SALT_CAVE.rock, 0xd070b0, 0xa66ad0, 0xd070b0, SALT_CAVE.rock, SALT_CAVE.floor].map(h => new THREE.Color(h));
  const tint = new THREE.Color();
  for (let i = 0; i < c.count; i++) { tint.copy(ring[i % 7]).multiplyScalar(.9 + .2 * Math.sin(i * 1.7) * Math.sin(i * .31)); c.setXYZ(i, tint.r, tint.g, tint.b); }
  m.material = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: .8, flatShading: true, side: THREE.DoubleSide, emissive: 0x7a2860, emissiveIntensity: .6 });
}

// A salt crust ring around a pool: a flat ellipse band, glowing faintly.
function saltRim(rx, rz, material) {
  const outer = new THREE.Shape(), inner = new THREE.Path();
  outer.absellipse(0, 0, rx + 1.8, rz + 1.8, 0, Math.PI * 2, false); inner.absellipse(0, 0, rx - .3, rz - .3, 0, Math.PI * 2, true);
  outer.holes.push(inner);
  const geo = new THREE.ExtrudeGeometry(outer, { depth: .35, bevelEnabled: true, bevelThickness: .15, bevelSize: .3, bevelSegments: 2, curveSegments: 36 });
  geo.rotateX(-Math.PI / 2);
  const m = mesh(geo, material); m.castShadow = false; return m;
}

// The mine portal: a pink rock arch round a braced timber frame with a sign
// and lanterns, crystals crowding its feet.
function minePortal(T, s, inwardSign, text) {
  const g = new THREE.Group(), p = placeOnTrack(T, s, 0), span = T.HW + 4, tall = 12;
  const wood = M(0x9a6236, { roughness: .9 }), dark = M(0x6e4226, { roughness: .9 }), rockMat = M(SALT_CAVE.rock, { roughness: .85, emissive: 0x5a1a48, emissiveIntensity: .35 });
  for (const x of [-span, span]) {
    g.add(box(1.4, tall, 1.4, wood, x, tall / 2, 0));
    const brace = box(.6, 6, .6, dark, x - Math.sign(x) * 2, tall - 2.6, 0); brace.rotation.z = Math.sign(x) * .7; g.add(brace);
  }
  g.add(box(span * 2 + 3.5, 1.6, 1.8, wood, 0, tall + .4, 0), box(span * 2 + 1, .7, 1.3, dark, 0, tall - .8, .1));
  const arch = new THREE.TorusGeometry(span + 4.5, 3.6, 7, 18, Math.PI); arch.scale(1, .95, 1.1);
  const rock = mesh(arch, rockMat, 0, 0, -1); g.add(rock);
  const board = sign(text, 13, 2.4, { background: '#7a3f2a', color: '#ffe9c4' }); board.position.set(0, tall - 2.4, 1.1); g.add(board);
  for (const x of [-span + 1.6, span - 1.6]) { const l = mineLantern({ light: false }); l.position.set(x, tall - 2, .9); l.scale.setScalar(2.2); g.add(l); }
  g.position.set(p.x, p.y - .2, p.z); // The sign faces the cars driving in.
  g.rotation.y = p.h + (inwardSign > 0 ? Math.PI : 0);
  g.name = 'salt-mine-portal'; return g;
}

export function saltCave(T, cave, profile, { groundAt, seed = 207, name = 'salt-cave' } = {}) {
  const group = new THREE.Group(), random = rng(seed), { widthAt, heightAt } = profile;
  group.name = name;
  const ticks = [], at = (u, off) => placeOnTrack(T, u * T.TOTAL, off), road = u => T.heightAtS(u * T.TOTAL);
  const inward = (p, side) => [side * Math.cos(p.h), 0, -side * Math.sin(p.h)];
  const skylit = u => cave.skylights.some(([a, b]) => u > a - .006 && u < b + .006);

  const shell = hollowGallery(T, { from: cave.from, to: cave.to, skylights: cave.skylights, widthAt, heightAt, color: SALT_CAVE.rock, name: `${name}-shell` });
  tintShell(shell); group.add(shell);

  // Pools beside the road in every hall, pink and turquoise behind salt crusts.
  const crust = M(SALT_CAVE.salt, { emissive: 0xffc4dc, emissiveIntensity: .45, roughness: .6 });
  const pools = [];
  const addPool = (x, z, y, rx, rz, rot, color, poolName) => {
    const water = waterPool(rx, rz, { color, depth: 2 }); water.name = poolName;
    water.position.set(x, y + .1, z); water.rotation.y = rot; group.add(water);
    const rim = saltRim(rx, rz, crust); rim.position.set(x, y - .05, z); rim.rotation.y = rot; group.add(rim);
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
    const chan = [], curbs = new THREE.Group(), stone = M(0xd59ab8, { roughness: .9 });
    for (let k = 0; k <= 8; k++) { const q = at(u - .005 - k * .005, side * (w - 11)); chan.push([q.x, q.z]); }
    const stream = riverSurface(chan, 3.2, () => y + .3, { color: SALT_CAVE.teal, foam: k => k < .15 ? .8 : .1 });
    stream.name = `${name}-channel`; group.add(stream);
    for (let k = 0; k < chan.length - 1; k++) {
      const [ax, az] = chan[k], [bx, bz] = chan[k + 1], len = Math.hypot(bx - ax, bz - az), h = Math.atan2(bx - ax, bz - az);
      for (const s of [-1, 1]) { const c = box(.7, .55, len + .2, stone, (ax + bx) / 2 + Math.cos(h) * s * 2, y + .27, (az + bz) / 2 - Math.sin(h) * s * 2); c.rotation.y = h; curbs.add(c); }
    }
    group.add(finish(curbs));
    pools.push({ x: (chan[0][0] + chan.at(-1)[0]) / 2, z: (chan[0][1] + chan.at(-1)[1]) / 2, r: 24 });
  }

  // Crystals on walls, dome and floor: one instanced field per stretch so
  // far halls cull. Giants in each hall carry the only real lights.
  const stretch = .05; let fields = 0;
  for (let u0 = cave.from; u0 < cave.to; u0 += stretch) {
    const clusters = [];
    for (let u = u0 + .002; u < Math.min(u0 + stretch, cave.to - .004); u += 6 / T.TOTAL) for (const side of [-1, 1]) {
      const w = widthAt(u), h = heightAt(u), y0 = road(u), n = inward(at(u, 0), side);
      for (let k = 0; k < 2; k++) {
        const wall = at(u + (random() - .5) * .002, side * (w - 1.2)), big = random() < .25;
        clusters.push({ x: wall.x, y: y0 + .3 + random() * (k ? 11 : 4), z: wall.z, normal: [n[0], .3 + random() * .5, n[2]], size: big ? 2.6 + random() * 1.6 : 1.1 + random() * 1.5, color: Math.floor(random() * 5) });
      }
      if (random() < .55 && !skylit(u)) {
        const top = at(u, side * w * (.25 + random() * .3));
        clusters.push({ x: top.x, y: y0 + h * .88, z: top.z, normal: [n[0] * .3, -1, n[2] * .3], size: 1 + random() * 1.6, color: Math.floor(random() * 5) });
      }
      if (random() < .5) {
        const q = at(u, side * (T.HW + 5 + random() * Math.max(2, w - T.HW - 12)));
        if (!nearPool(q.x, q.z, 2)) clusters.push({ x: q.x, y: y0 - .6, z: q.z, normal: [n[0] * .3 + (random() - .5) * .4, 1, n[2] * .3], size: .9 + random() * 2.2, color: Math.floor(random() * 5) });
      }
    }
    const field = crystalField(clusters, { palette: SALT_CAVE.crystals, seed: seed + fields, glow: 1.4, pulse: .3, brightest: 0 });
    field.name = `${name}-crystals`; group.add(field); ticks.push(field.userData.tick); fields++;
  }
  const giants = [];
  cave.halls.forEach((hall, i) => {
    for (const side of [-1, 1]) {
      const u = hall.u - side * .014, p = at(u, side * (T.HW + 13));
      giants.push({ x: p.x, y: road(u) - .6, z: p.z, normal: [0, 1, 0], size: 6 + random() * 2, count: 14, color: [0, 2, 3, 1, 2, 0][(i * 2 + (side > 0 ? 1 : 0)) % 6] });
    }
  });
  const giantField = crystalField(giants, { palette: SALT_CAVE.crystals, seed: seed + 50, glow: 1.5, pulse: .25 });
  giantField.name = `${name}-giant-crystals`; group.add(giantField); ticks.push(giantField.userData.tick);
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
    if (!skylit(u)) { const p = at(u, side * w * .35); put(formations, stalactiteCluster({ seed: seed + 500 + hanging, length: 5 + heightAt(u) * .12 }), p.x, p.z, y0 + heightAt(u) * .9, p.h); hanging++; }
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
  group.add(minePortal(T, cave.from * T.TOTAL, 1, 'MINA DE SAL'), minePortal(T, cave.to * T.TOTAL, -1, 'MINA DE SAL'));

  // Skylights: fresnel beams from the openings, dust drifting through.
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
export function caveFog(T, cave, mesh, { color = 0xe48ac4, near = 30, far = 420 } = {}) {
  const inside = new THREE.Color(color);
  let outside = null, outNear = 0, outFar = 0, written = null;
  mesh.onBeforeRender = (renderer, scene, camera) => {
    const fog = scene.fog; if (!fog?.isFog) return;
    // A palette applied since the last frame wins: take it as the outside fog.
    if (!outside || !fog.color.equals(written)) { outside = fog.color.clone(); outNear = fog.near; outFar = fog.far; }
    const n = T.nearest(camera.position.x, camera.position.z), u = n.s / T.TOTAL;
    const k = (1 - smooth(n.d, 40, 90)) * smooth(u, cave.from - .004, cave.from + .02) * (1 - smooth(u, cave.to - .02, cave.to + .004));
    fog.color.copy(outside).lerp(inside, k); written = fog.color.clone(); fog.near = mix(outNear, near, k); fog.far = mix(outFar, far, k);
    if (scene.background?.isColor) scene.background.copy(fog.color);
  };
}
