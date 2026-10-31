// Things to smash: small clusters of the market kit's barrels and crates
// (engine/models/props/plaza.js) on the road edges. Drive through one and it
// flies off tumbling with a burst of wood chips; the car loses a little speed
// and the hit counts toward El Chocón (c.hits; the local player's reach the
// stats pipe as carreritas.smashes). Props stand again after RESPAWN seconds.
//
// Placement is seeded by the track id, so every client builds the same props.
// Each library model is merged once into one mesh per material and the
// geometry shared by every copy, keeping a cluster to a handful of draws. The
// props hang off the scene, not the track group, so a track switch (which
// disposes the track's geometry) never frees the shared templates.
// Hits are judged from position on every drawn frame for every car, remote
// ones included, so online rivals smash them on your screen too; only local
// cars lose speed.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { barrel, crate } from '/engine/models/props/plaza.js';
import { statCount } from '/engine/stats.js';
import { rng, seedOf } from '/engine/random.js';
import { gateRuns } from './transform-gates.js';
import { proxyInstances } from './items.js';

const RESPAWN = 25, SCRUB = 0.9, GRAVITY = 22;
const KINDS = {
  barrel: { build: barrel, scale: 0.75, radius: 0.6 },
  crate: { build: crate, scale: 0.6, radius: 0.55 },
};

// One library model merged into [{ geometry, material }] in its own frame.
function mergedParts(build, scale) {
  const g = build();
  g.scale.setScalar(scale);
  g.updateMatrixWorld(true);
  const byMaterial = new Map();
  g.traverse(o => {
    if (!o.isMesh || Array.isArray(o.material)) return;
    let geo = o.geometry.clone().applyMatrix4(o.matrixWorld);
    if (geo.index) geo = geo.toNonIndexed();
    for (const name of Object.keys(geo.attributes)) if (name !== 'position' && name !== 'normal') geo.deleteAttribute(name);
    (byMaterial.get(o.material) ?? byMaterial.set(o.material, []).get(o.material)).push(geo);
  });
  return [...byMaterial].map(([material, list]) => ({ geometry: mergeGeometries(list), material }));
}

let templates = null;
const template = (kind) => (templates ??= Object.fromEntries(Object.entries(KINDS).map(([k, d]) => [k, mergedParts(d.build, d.scale)])))[kind];

// The kind's parts, as the model each prop's proxy draws through.
function propModel(kind) {
  const group = new THREE.Group();
  for (const { geometry, material } of template(kind)) {
    const m = new THREE.Mesh(geometry, material);
    m.castShadow = true;
    group.add(m);
  }
  group.name = `breakable-${kind}`;
  return group;
}

// Seeded spots: clusters along the lap, alternating sides, never on the start
// straight or a river run.
export function placeProps(T) {
  const rand = rng(seedOf(`props:${T.id}`)), runs = gateRuns(T);
  const clusters = Math.max(6, Math.min(14, Math.round(T.TOTAL / 200)));
  const props = [];
  for (let k = 0; k < clusters; k++) {
    const u = 0.07 + (k + rand() * 0.6) / clusters * 0.86, s0 = u * T.TOTAL;
    if (runs.some(g => (s0 - g.s0 + T.TOTAL + 20) % T.TOTAL < g.len + 40)) continue;
    const side = k % 2 ? 1 : -1, kind = rand() < 0.5 ? 'barrel' : 'crate', count = 2 + Math.floor(rand() * 2);
    for (let i = 0; i < count; i++) {
      const s = s0 + i * 2.4;
      if(T.def.breakableAt && !T.def.breakableAt(s,T))continue;
      const p = T.pointAt(s), q = T.pointAt(s + 0.5);
      const tx = q.x - p.x, tz = q.y - p.y, l = Math.hypot(tx, tz) || 1, off = side * (T.HW - 1.4 - (i % 2) * 1.2);
      const x = p.x - tz / l * off, z = p.y + tx / l * off;
      props.push({ kind, x, z, y: T.groundAt(x, z,T.heightAtS(s)), h: rand() * Math.PI * 2, radius: KINDS[kind].radius });
    }
  }
  return props;
}

export function createBreakables({ race, sound, track }) {
  let props = [], group = null, batches = [];
  const flying = [];

  function smash(p, c) {
    p.down = RESPAWN;
    const speed = Math.max(8, Math.abs(c.vf || 0)), fx = Math.sin(c.h), fz = Math.cos(c.h);
    const away = Math.atan2(p.x - c.x, p.z - c.z);
    p.vel = new THREE.Vector3(fx * speed * 0.55 + Math.sin(away) * 4, 6 + Math.random() * 5, fz * speed * 0.55 + Math.cos(away) * 4);
    p.spin = new THREE.Vector3((Math.random() - 0.5) * 14, (Math.random() - 0.5) * 10, (Math.random() - 0.5) * 14);
    p.t = 0;
    flying.push(p);
    race.puffs.spawn(new THREE.Vector3(p.x, p.y + 0.6, p.z), { color: 0x9a6236, count: 8, size: 0.35, rise: 3, life: 0.6, spread: 1.4 });
    c.hits = (c.hits || 0) + 1;
    if (!c.remote) { c.vx *= SCRUB; c.vz *= SCRUB; c.vf = (c.vf || 0) * SCRUB; }
    if (c.isPlayer) { race.vsfx.crash(0.7, 'prop'); statCount('carreritas.smashes', 1); }
  }

  return {
    setTrack(T) {
      props = []; flying.length = 0;
      batches.forEach(b => b.dispose()); batches = [];
      group?.removeFromParent();
      group = new THREE.Group();
      group.name = 'breakables';
      if (T.def.breakables === false || T.def.oval) return;
      props = placeProps(T);
      // Props move, tumble and hide through proxies; each kind's parts draw
      // as instances (one draw per part instead of one per prop).
      for (const p of props) {
        p.mesh = new THREE.Object3D();
        p.mesh.position.set(p.x, p.y, p.z);
        p.mesh.rotation.y = p.h;
      }
      for (const kind of new Set(props.map(p => p.kind)))
        batches.push(proxyInstances(group, propModel(kind), props.filter(p => p.kind === kind).map(p => p.mesh)));
      race.scene.add(group);
    },
    get props() { return props; },
    // Every drawn frame, every car: smash what it drives through.
    sync(c) {
      if (c.ghost || c.retired || !props.length) return;
      for (const p of props) {
        if (p.down > 0) continue;
        const r = p.radius + 1.15;
        if (Math.abs(c.x - p.x) < r && Math.abs(c.z - p.z) < r && Math.abs(c.y - p.y) < 2.5 && Math.hypot(c.x - p.x, c.z - p.z) < r) smash(p, c);
      }
    },
    // Flying props tumble, bounce on the ground and stand again later.
    update(dt) {
      for (let i = flying.length - 1; i >= 0; i--) {
        const p = flying[i], m = p.mesh, t = track();
        p.t += dt;
        p.vel.y -= GRAVITY * dt;
        m.position.addScaledVector(p.vel, dt);
        m.rotation.x += p.spin.x * dt; m.rotation.y += p.spin.y * dt; m.rotation.z += p.spin.z * dt;
        const ground = t.groundAt(m.position.x, m.position.z,m.position.y);
        if (m.position.y < ground) { m.position.y = ground; p.vel.multiplyScalar(0.45); p.vel.y = Math.abs(p.vel.y); p.spin.multiplyScalar(0.5); }
        if (p.t > 2.5) m.visible = false;
        if (p.t > 2.5) flying.splice(i, 1);
      }
      for (const p of props) {
        if (!(p.down > 0)) continue;
        p.down -= dt;
        if (p.down <= 0) { p.mesh.position.set(p.x, p.y, p.z); p.mesh.rotation.set(0, p.h, 0); p.mesh.visible = true; }
      }
      batches.forEach(b => b.sync());
    },
  };
}
