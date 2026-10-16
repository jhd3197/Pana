// World dressing around the river. Every shape comes from the shared model
// library; this file only decides where things stand. The river (river.js)
// is the ground truth: nothing is planted in the water a canoe can reach.
import * as THREE from 'three';
import { M, rng } from '/engine/models/core/primitives.js';
import { instancePlacements, bake } from '/engine/models/core/static-batch.js';
import * as flora from '/engine/models/vegetation/index.js';
import { moriche } from '/engine/models/vegetation/moriche.js';
import { liana, vineArch, ropeBridge, waterfallRocks } from '/engine/models/props/jungle.js';
import { lajaRock, igapoTrunk, churuata, finishArch, moricheDock } from '/engine/models/props/amazonas.js';
import { scarletMacaw } from '/engine/models/fauna/birds/scarlet-macaw.js';
import { orbitBird } from '/engine/models/animation/orbit-bird.js';
import { morphoSwarm } from '/engine/models/fauna/morpho.js';
import { tonina } from '/engine/models/fauna/aquatic/tonina.js';
import { caiman } from '/engine/models/fauna/caiman.js';
import { buildCharacter } from '/engine/models/characters/pana/avatar-model.js';
import { randomAvatar } from '/engine/avatar.js';
import { driftwood } from '/engine/models/props/beach.js';
import { createTepui } from '/engine/island-landscape.js';
import { SEA } from '/engine/island-terrain.js';
import { smooth } from './river.js';

const TAU = Math.PI * 2;
// Straight downstream of the raudales, so it fills the view for the whole run.
export const TEPUI = { x: 10, z: -1150, width: 100, depth: 70, height: 175 };

export function addLandscape({ group, river, moving, racers = [] }) {
  const random = rng(5501), counts = group.userData.assetCounts, def = river.def;
  const [CANO, R1, R2, NEGRO] = [def.sectors[1][0], def.drops[0].s, def.drops[1].s, def.sectors[2][0]];
  const reserved = [];
  const count = (id, n = 1) => { counts[id] = (counts[id] || 0) + n; };
  const free = (x, z, r) => !reserved.some(p => Math.hypot(x - p.x, z - p.z) < p.r + r);
  // Land at least `gap` metres from any water a canoe can use.
  const onLand = (x, z, gap) => river.locate(x, z).edge > gap;
  const add = (id, model, x, z, { y, rot = 0, scale = 1, r = 2, animate = false } = {}) => {
    model.position.set(x, y ?? river.groundAt(x, z), z); model.rotation.y = rot; model.scale.setScalar(scale);
    model.userData.assetId = id; group.add(model); reserved.push({ x, z, r }); count(id); if (animate) moving.push(model); return model;
  };
  const place = (x, z, scale, y) => ({ x, z, y: y ?? river.groundAt(x, z) - .1, rot: random() * TAU, scale });
  // Only the caño's own canopy casts shadows; the rest would double the cost.
  const plant = (id, source, points, name, castShadow = false) => { for (const m of instancePlacements(group, source, points, { name, cellSize: 90, castShadow })) m.userData.farCull = true; count(id, points.length); };

  // ---- Landmarks first, so planting keeps out of their way.
  const at = (s, off) => river.at(s, off);
  {
    const q = at(72, 0), arch = vineArch({ seed: 41 }), half = river.halfWidth(72);
    add('vine-arch', arch, q.x, q.z, { y: river.levelAt(72) - .3, rot: q.h, scale: (half * 2 + 2) / 9.3, r: 0 });
    const b = at(262, 0), bridge = ropeBridge({ span: 14, seed: 44 }), banks = [-1, 1].map(side => { const p = at(262, side * (river.halfWidth(262) + 3)); return river.groundAt(p.x, p.z); });
    add('rope-bridge', bridge, b.x, b.z, { y: Math.max(...banks) - .3, rot: b.h, scale: (river.halfWidth(262) * 2 + 6) / 20, r: 0 });
    for (const [s, side] of [[R1 - 22, 1], [R2 - 24, -1], [R1 + 30, -1]]) {
      const half2 = river.halfWidth(s), p = at(s, side * (half2 + 4.5));
      add('waterfall-rocks', waterfallRocks({ seed: 50 + s }), p.x, p.z, { y: river.groundAt(p.x, p.z) - .6, rot: p.h + side * Math.PI / 2, scale: 1.3, r: 7, animate: true });
    }
  }
  // The finish: an arch over the water, the churuata, a dock and the start's dock.
  const L = river.LENGTH;
  {
    const q = at(L - 8, 0);
    add('finish-arch', finishArch({ span: river.halfWidth(L - 8) * 2 + 2 }), q.x, q.z, { y: river.levelAt(L - 8) - .2, rot: q.h, r: 0 });
    const c = at(L - 16, river.halfWidth(L - 16) + 13);
    add('churuata', churuata({ radius: 6.5 }), c.x, c.z, { r: 9 });
    const c2 = at(L + 2, -(river.halfWidth(L) + 12));
    add('churuata', churuata({ radius: 4.5, seed: 8 }), c2.x, c2.z, { r: 7 });
    for (const [s, sign, length] of [[L - 24, 1, 8], [4, -1, 5]]) {
      const half2 = river.halfWidth(s), d = at(s, sign * (half2 + 1.3 - length / 2));
      add('moriche-dock', moricheDock({ length }), d.x, d.z, { y: river.levelAt(s), rot: d.h + sign * Math.PI / 2, r: 0 });
    }
  }
  // ---- A crowd at the landing cheers the canoes home.
  {
    const crowd = [], seats = 9;
    for (let i = 0; i < seats; i++) {
      const s = L - 30 + i * 3.2 + random(), p = at(s, river.halfWidth(s) + 2.4 + random() * 2.5);
      const pana = buildCharacter(randomAvatar()); pana.group.scale.setScalar(.95);
      pana.group.position.set(p.x, river.groundAt(p.x, p.z), p.z); pana.group.rotation.y = p.h - Math.PI / 2 + (random() - .5) * .6;
      group.add(pana.group); crowd.push({ pana, base: pana.group.position.y, phase: random() * 6 });
    }
    count('crowd', crowd.length);
    let last = 0;
    racers.push((state, time) => {
      // They wave as canoes come into view and jump when one finishes.
      const near = (state.boats || []).some(b => L - (b.progress || 0) < 90), done = (state.boats || []).some(b => b.finish !== null && time - b.finish < 4);
      const dt = Math.min(.1, Math.max(0, time - last)); last = time;
      for (const c of crowd) {
        c.pana.update(dt, { look: 0 });
        const k = done ? 1 : near ? .55 : .1, beat = Math.sin(time * (done ? 11 : 7) + c.phase);
        c.pana.group.position.y = c.base + Math.max(0, beat) * .28 * k;
        c.pana.arms?.forEach((arm, j) => arm.rotation.set(-.6 - k * 2 + (j ? beat : -beat) * .4 * k, 0, (j ? -1 : 1) * .25 * k));
      }
    });
  }
  // ---- The tepui of the Autana fills the view over the raudales.
  {
    const tepui = createTepui({ width: TEPUI.width, depth: TEPUI.depth, height: TEPUI.height, seed: 4, waterfall: true });
    tepui.group.position.set(TEPUI.x, river.levelAt(NEGRO) - SEA - 3, TEPUI.z); tepui.group.rotation.y = .5;
    tepui.group.name = 'Tepui del Autana'; group.add(tepui.group); count('tepui');
    reserved.push({ x: TEPUI.x, z: TEPUI.z, r: 135 });
  }

  // ---- Rocks in the river (the same list the canoes collide with).
  const rocks = river.rocks.map(r => ({ x: r.x, z: r.z, y: river.levelAt(r.s, r.offset) - .35 * r.r, rot: random() * TAU, scale: r.r / 1.7 }));
  // Laja shelves on the raudal banks.
  for (let s = CANO - 10; s < NEGRO - 20; s += 4) for (const side of [-1, 1]) {
    if (random() < .35) continue;
    const half = river.halfWidth(s), p = at(s, side * (half + .5 + random() * 3.5));
    if (free(p.x, p.z, 1.5)) rocks.push({ x: p.x, z: p.z, y: river.groundAt(p.x, p.z) - .5, rot: random() * TAU, scale: .7 + random() * 1.1 });
  }
  plant('laja-rock', lajaRock({ seed: 3 }), rocks, 'Lajas del raudal', true);

  // ---- Vegetation by tramo.
  const canopyNear = [], giants = [], canopyFar = [], understory = { monstera: [], heliconia: [], fern: [], tropicalBush: [], banana: [] }, mangroves = [], reedBeds = [], lilies = [], palms = [], trunks = [];
  const zone = s => s < CANO + 5 ? 'cano' : s < NEGRO - 15 ? 'raudal' : 'negro';
  for (let s = -10; s < L + 30; s += 5.5) for (const side of [-1, 1]) {
    const z0 = zone(s), half = river.halfWidth(s);
    // The canopy tunnel: big crowns right at the caño's edge lean over it.
    if (z0 === 'cano') {
      const d = 3.2 + random() * 3, p = at(s + random() * 3, side * (half + d));
      if (onLand(p.x, p.z, 2.5) && free(p.x, p.z, 3)) {
        if (random() < .12) giants.push(place(p.x, p.z, 1 + random() * .3)); else canopyNear.push(place(p.x, p.z, 1.7 + random() * .7));
        reserved.push({ x: p.x, z: p.z, r: 2.5 });
      }
    }
    // Understory along every bank except the raudal's bare rock.
    for (let k = 0; k < (z0 === 'cano' ? 2 : 1); k++) {
      const d = .6 + random() * (z0 === 'negro' ? 14 : 8), p = at(s + random() * 5, side * (half + d));
      if (!onLand(p.x, p.z, .3) || !free(p.x, p.z, .8)) continue;
      const sand = def.look?.(s, side * half)?.sand > .5 && d < 10;
      if (sand) { if (random() < .12) reedBeds.push(place(p.x, p.z, .7 + random() * .5)); continue; }
      // Bananas are cheap; ferns and heliconias are the detailed accents.
      const kinds = z0 === 'cano' ? ['monstera', 'heliconia', 'fern', 'banana', 'banana', 'banana'] : ['heliconia', 'banana', 'monstera', 'banana'];
      understory[kinds[Math.floor(random() * kinds.length)]].push(place(p.x, p.z, .8 + random() * .6));
    }
    // Waterline: mangroves in the caño, reeds and lilies in the slow edges.
    if (z0 !== 'raudal' && random() < .38) {
      const p = at(s + random() * 5, side * (half + .2 + random() * 1.2));
      if (river.locate(p.x, p.z).edge > -.2 && free(p.x, p.z, 1)) (z0 === 'cano' && random() < .55 ? mangroves : reedBeds).push(place(p.x, p.z, .7 + random() * .5));
    }
    if (z0 !== 'raudal' && random() < .2) {
      const p = at(s + random() * 5, side * (half - .6 - random() * 1.4)), w = river.locate(p.x, p.z);
      if (w.edge < -.4 && w.edge > -2.6) lilies.push({ ...place(p.x, p.z, .6 + random() * .5), y: river.levelAt(w.s, w.offset) + .02 });
    }
  }
  // Deep forest behind, thinning where the Río Negro has playas.
  for (let s = -30; s < L + 60; s += 10) for (const side of [-1, 1]) for (let k = 0; k < 2; k++) {
    const half = river.halfWidth(s), d = 9 + random() * 58, p = at(s + random() * 9, side * (half + d));
    const sandy = def.look?.(s, side * half)?.sand > .5;
    // The raudal's banks are bare laja: keep the view to the tepui open.
    if ((sandy && d < 22) || (zone(s) === 'raudal' && d < 40) || !onLand(p.x, p.z, 7) || !free(p.x, p.z, 3)) continue;
    if (zone(s) === 'negro' && random() < .2) palms.push(place(p.x, p.z, .85 + random() * .5)); else canopyFar.push(place(p.x, p.z, 1.5 + random() * 1.2));
  }
  // Moriche stands by the Río Negro's playas and around the landing.
  for (let s = NEGRO; s < L + 20; s += 7) for (const side of [-1, 1]) {
    if (def.look?.(s, side * river.halfWidth(s))?.sand < .5 || random() < .6) continue;
    const p = at(s, side * (river.halfWidth(s) + 12 + random() * 12));
    if (onLand(p.x, p.z, 8) && free(p.x, p.z, 2)) palms.push(place(p.x, p.z, .8 + random() * .4));
  }
  // The igapó: trunks standing in the flood (the canoes snag on these).
  for (const sn of river.snags) trunks.push({ x: sn.x, z: sn.z, y: river.levelAt(river.branch.from + river.branch.mainLength * sn.u / river.branch.length), rot: random() * TAU, scale: .6 + random() * .25 });
  if (river.branch) for (let u = 4; u < river.branch.length - 4; u += 3) for (const side of [-1, 1]) {
    const p = river.branch.path.at(u, side * (river.branch.half + 1 + random() * 14));
    if (river.locate(p.x, p.z).edge > .5 && free(p.x, p.z, 1.5) && random() < .5) trunks.push({ x: p.x, z: p.z, y: river.groundAt(p.x, p.z) + .3, rot: random() * TAU, scale: .55 + random() * .35 });
  }
  plant('ceiba', flora.ceiba({ seed: 21 }), canopyNear, 'Dosel del caño', true);
  plant('jungle-giant', flora.jungleGiant({ seed: 9 }), giants, 'Gigantes del caño', true);
  plant('ceiba', flora.ceiba({ seed: 33, detail: 'distant' }), canopyFar, 'Selva');
  for (const [kind, points] of Object.entries(understory)) plant(kind.replace(/[A-Z]/g, c => `-${c.toLowerCase()}`), flora[kind]({ seed: 13 }), points, `Sotobosque · ${kind}`);
  plant('mangrove', flora.mangrove({ seed: 5 }), mangroves, 'Manglar del caño');
  plant('reeds', flora.reeds({ seed: 6 }), reedBeds, 'Juncos');
  plant('water-lily', flora.waterLily({ seed: 7 }), lilies, 'Lirios de agua');
  plant('moriche', moriche({ seed: 8, h: 11 }), palms, 'Morichales');
  plant('igapo-trunk', igapoTrunk({ seed: 2, h: 10 }), trunks, 'Igapó');

  // Lianas hang from the caño's canopy, clear of a seated pana's head.
  {
    const vines = new THREE.Group();
    for (let s = 30; s < CANO; s += 9) for (const side of [-1, 1]) {
      if (random() < .35) continue;
      const half = river.halfWidth(s), p = at(s, side * (half + .2 + random() * .8)), top = river.levelAt(s) + 8.5 + random() * 2;
      liana(vines, [p.x, top, p.z], 4.5 + random() * 2.5, Math.floor(random() * 99), .4);
    }
    const baked = bake(vines); vines.traverse(o => o.geometry?.dispose()); baked.name = 'Lianas'; group.add(baked); count('liana');
  }

  // ---- A canopy that never ends: a lumpy crown surface past the planted forest.
  {
    const b = group.userData.bounds, pad = 420, cell = 14;
    const x0 = b.minX - pad, x1 = b.maxX + pad, z0 = b.minZ - pad, z1 = b.maxZ + pad, nx = Math.ceil((x1 - x0) / cell), nz = Math.ceil((z1 - z0) / cell);
    const ps = [], cs = [], ix = [], c = new THREE.Color();
    for (let j = 0; j <= nz; j++) for (let i = 0; i <= nx; i++) {
      const x = x0 + i * cell, z = z0 + j * cell, w = river.locate(x, z);
      const lift = smooth(62, 105, w.edge);
      const y = river.levelAt(w.s) - 6 + lift * (21 + 6 * Math.sin(x * .05 + Math.cos(z * .043) * 2) + 3 * Math.sin(z * .11 - x * .07));
      ps.push(x, y, z);
      c.setHex(0x2f4a26).lerp(new THREE.Color(0x4f6e33), .5 + .5 * Math.sin(x * .09 + z * .07)); cs.push(c.r, c.g, c.b);
      if (i < nx && j < nz) { const a = j * (nx + 1) + i; ix.push(a, a + nx + 1, a + 1, a + 1, a + nx + 1, a + nx + 2); }
    }
    const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.Float32BufferAttribute(ps, 3)); geo.setAttribute('color', new THREE.Float32BufferAttribute(cs, 3)); geo.setIndex(ix); geo.computeVertexNormals();
    const canopy = new THREE.Mesh(geo, M(0xffffff, { vertexColors: true, roughness: 1, flatShading: true })); canopy.name = 'Selva lejana'; group.add(canopy);
  }

  // ---- Logs on the caño's banks. One in three is a babo that snaps.
  const babos = [];
  for (const log of river.logs) {
    const y = river.levelAt(log.s, log.offset) - .12, rot = log.h + log.side * (Math.PI / 2 - .35);
    if (log.caiman) { const m = caiman({ seed: 10 + log.id }); m.scale.setScalar(1.15); add('caiman', m, log.x, log.z, { y, rot, r: 2, animate: true }); babos.push({ log, m }); }
    else add('driftwood', driftwood(), log.x, log.z, { y: y - .05, rot: log.h + (random() - .5) * .6, r: 2 });
  }
  racers.push((state, time) => {
    for (const { log, m } of babos) { const age = time - (state.snaps?.[log.id] ?? -99); m.userData.snap(age < 0 ? 0 : age < .12 ? age / .12 : age < .7 ? 1 - (age - .12) / .58 : 0); }
  });
  // ---- Toninas: a small pool that follows the race clock.
  const pool = Array.from({ length: 6 }, (_, i) => { const t = tonina({ seed: i + 3 }); t.visible = false; group.add(t); return t; });
  count('tonina', pool.length);
  racers.push((state, time) => {
    let used = 0;
    if (state.phase === 'racing') for (const pod of river.toninasAt(time)) for (const k of [0, 1]) {
      const d = pool[used++]; if (!d) break;
      // Each dolphin arcs out of the water once, a beat apart.
      const u = (pod.age - k * .22) / 1.1;
      if (u < 0 || u > 1) { d.visible = false; continue; }
      const s = pod.s - 3 + u * 9 + k, off = pod.offset + (k ? .9 : -.6), p = river.at(s, off);
      d.visible = true; d.position.set(p.x, river.levelAt(s, off) - .45 + Math.sin(u * Math.PI) * 1.05, p.z);
      d.rotation.set(-Math.cos(u * Math.PI) * .9, p.h, 0, 'YXZ'); d.userData.swim(time * 1.6 + k);
    }
    for (let i = used; i < pool.length; i++) pool[i].visible = false;
  });

  // ---- Life: guacamayas over the water, morphos in the caño.
  for (let i = 0; i < 4; i++) {
    const s = [60, 210, 420, 700][i], q = at(s, 0);
    const bird = orbitBird(scarletMacaw({ seed: 30 + i }), { cx: q.x, cz: q.z, cy: river.levelAt(s) + 13 + i * 2, r: 18 + i * 5, speed: (i % 2 ? -1 : 1) * (.16 + i * .02), phase: i * 1.7 });
    group.add(bird); moving.push(bird); count('scarlet-macaw');
  }
  for (const s of [40, 120, 190, 245, 300]) {
    const q = at(s, (random() - .5) * 4), swarm = morphoSwarm({ seed: s, count: 5, radius: 3.5 });
    swarm.position.set(q.x, river.levelAt(s) + .3, q.z); group.add(swarm); moving.push(swarm); count('morpho');
  }
}
