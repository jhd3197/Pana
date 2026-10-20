// Trifulca's 3D world: the chosen arena, every pana (the two fighters in
// gloves and helmets, the rest standing as the ring), NPC neighbours, the ref
// in his llanero hat, and the boxing-TV camera: side-on to the fighters,
// zooming on big hits, a walk-out shot for each fighter and a slow-motion
// replay of the knockdown that ended the fight.
import * as THREE from 'three';
import { createTableWorld } from '/engine/worlds/table-world.js';
import { buildCharacter } from '/engine/models/characters/pana/avatar-model.js';
import { randomAvatar } from '/engine/avatar.js';
import { rng } from '/engine/random.js';
import { Puffs, Shockwaves } from '/engine/fx.js';
import { arenaOf, crowdSpot } from './fight-rules.js';
import { createArena } from './arenas.js';
import { createPana } from './fighters.js';
import { motoHelmet, chancleta } from './set.js';
import { plasticChair, produceCrates } from '/engine/models/props/barrio.js';

// The things lying around a trifulca libre, at the size a pana can swing.
const PROP_MODELS = {
  silla: () => { const m = plasticChair({ color: '#ff4b4b' }); m.scale.setScalar(.55); return m; },
  caja: () => produceCrates({ w: .6, d: .45, h: .34, seed: 4, detail: 'light' }),
  casco: () => { const m = motoHelmet({ color: '#2ad1b2' }); m.scale.setScalar(.5); m.position.y = .3; const g = new THREE.Group(); g.add(m); return g; },
  chancleta: () => { const m = chancleta({ color: '#ff6fae' }); m.scale.setScalar(1.8); return m; },
};
const ringOf = (bodies = []) => bodies.filter(b => !b.bench && !b.out);

const BOT_LOOKS = ['#2ad1b2', '#ffc629', '#3d7bf2', '#ff8a3d', '#9b5de5', '#6bbf59', '#ff6fae', '#ee3024'];
const REF_LOOK = { outfit: 'franela', outfitColor: '#f3e9d7', hat: 'llanero', hatColor: '#7a5230', face: 'cool' };
const v = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);

export function createTrifulcaScene(canvas, { me = () => null } = {}) {
  const stage = createTableWorld(canvas, { fit: 'window', arena: false, fov: 40 }), { renderer, scene, camera, sun } = stage;
  const hemi = scene.children.find(o => o.isHemisphereLight);
  const sky = scene.children.find(o => o.material?.uniforms?.daylight);
  const own = new THREE.Group(); scene.add(own);
  const puffs = new Puffs(scene), rings = new Shockwaves(scene);
  const panas = new Map(), props = new Map();
  let arena = null, arenaId = null, npcs = [], lampLights = [], ref = null, current = null, time = 0;
  let camPerp = v(0, 0, 1), camPos = v(0, 4, 12), camLook = v(0, 1, 0), shake = 0, zoom = 1, zoomT = 0;
  const frames = [], replay = { on: false, frames: [], clock: 0 };
  let lastCaida = -1;

  function setArena(id) {
    if (id === arenaId) return;
    arena?.dispose(); npcs.forEach(n => n.dispose()); npcs = []; lampLights.forEach(l => l.removeFromParent()); lampLights = [];
    arenaId = id; arena = createArena(id, arenaOf(id)); own.add(arena.group);
    const L = arena.light;
    sun.color.set(L.sun[0]); sun.intensity = L.sun[1]; sun.position.set(...L.sun[2]);
    if (hemi) { hemi.color.set(L.hemi[0]); hemi.groundColor.set(L.hemi[1]); hemi.intensity = L.hemi[2]; }
    renderer.toneMappingExposure = L.exposure;
    scene.background = new THREE.Color(L.background); scene.fog.color.set(L.background);
    scene.fog.near = id === 'motos' ? 22 : 45; scene.fog.far = id === 'motos' ? 70 : 150;
    if (sky) sky.material.uniforms.daylight.value = L.daylight;
    if (L.ringLight) { const light = new THREE.PointLight('#ffe6b8', L.ringLight, 22, 1.4); light.position.set(0, 7, 0); scene.add(light); lampLights.push(light); }
    for (const p of arena.lamps) {
      const light = new THREE.PointLight('#ffd89a', id === 'motos' ? 22 : 10, id === 'motos' ? 16 : 12, 1.6);
      light.position.copy(p); scene.add(light); lampLights.push(light);
    }
    // Neighbours who came to watch: seated ones on the chairs.
    arena.npcSpots.forEach((spot, i) => {
      const look = spot.senora ? { outfit: 'hawaiana', outfitColor: '#ff6fae', hat: 'none', glasses: 'redondos', face: 'feliz' } : randomAvatar(rng(i * 31 + 7));
      if (arena.hats && !spot.senora && i % 4 !== 3) Object.assign(look, { hat: 'llanero', hatColor: ['#7a5230', '#e9dcc0', '#3b2a1a'][i % 3] });
      const npc = buildCharacter(look, { seated: !!spot.seated });
      npc.group.position.set(spot.x, spot.y ?? 0, spot.z); npc.group.rotation.y = spot.face;
      npc.phase = i * 1.7; npc.cheer = 0; own.add(npc.group); npcs.push(npc);
    });
    ref ||= Object.assign(buildCharacter(REF_LOOK), { pos: v(0, 0, -3) });
    own.add(ref.group);
  }

  function lookFor(p, i) {
    if (!p.bot) return p.avatar;
    return { outfitColor: BOT_LOOKS[i % BOT_LOOKS.length], face: 'feliz', fur: ['#cf7d22', '#d4914f', '#b06d3b', '#e0a463'][i % 4], hat: 'none', outfit: ['franela', 'deportivo', 'hoodie'][i % 3] };
  }

  function update(state) {
    current = state;
    setArena(state.arenaNow || state.options?.arena || 'calle');
    // Chairs, crates, helmets and chancletas of a trifulca libre.
    const liveProps = new Set((state.props || []).map(p => p.id));
    for (const p of state.props || []) if (!props.has(p.id)) { const model = PROP_MODELS[p.kind]?.() || PROP_MODELS.caja(); own.add(model); props.set(p.id, { model, pos: v(p.x, 0, p.z), spin: 0 }); }
    for (const [id, entry] of props) if (!liveProps.has(id)) { entry.model.userData.dispose?.(); entry.model.removeFromParent(); props.delete(id); }
    const live = new Set();
    state.players.forEach((p, i) => {
      live.add(p.id);
      const look = lookFor(p, i), key = JSON.stringify(look) + p.name;
      let entry = panas.get(p.id);
      if (entry?.key !== key) {
        const pos = entry?.pos;
        entry?.pana.dispose();
        const pana = createPana(look, { seed: p.id, name: p.name, me: p.id === me() });
        own.add(pana.root);
        entry = { pana, key, pos: pos || v(), h: 0, placed: !!pos }; panas.set(p.id, entry);
      }
      entry.player = p;
    });
    for (const [id, entry] of panas) if (!live.has(id)) { entry.pana.dispose(); panas.delete(id); }
  }

  // The fight's events: hits rock heads, the camera punches in, the arena answers.
  function react(e) {
    const who = panas.get(e.id)?.pana, at = panas.get(e.id)?.pos;
    if (e.type === 'hit' && who) { who.hit(e.counter ? 1 : .6); puffs.spawn(at.clone().add(v(0, 1.4 + floor(), 0)), { color: 0xfff1d0, count: 4, spread: .4, size: .5, rise: .6, life: .4 }); }
    if (e.type === 'trompon' && who) {
      who.hit(1.6, true); shake = .35; zoomT = .9;
      rings.ring(at.clone().add(v(0, 1.4 + floor(), 0)), { color: 0xffd23f, maxRadius: 2.2, life: .35 });
      rings.sparkle(at.clone().add(v(0, 1.6 + floor(), 0)), { count: 8 });
    }
    if (e.type === 'block' && who) rings.sparkle(at.clone().add(v(0, 1.5 + floor(), 0)), { color: 0xffffff, count: 4, spread: .3 });
    if (e.type === 'caida') { shake = .5; zoomT = 1.4; lastCaida = time; if (at) puffs.spawn(at.clone().add(v(0, .2 + floor(), 0)), { color: 0xcab79a, count: 10, spread: 1.2, rise: .8 }); }
    if (e.type === 'shove' && who) who.hit(.8);
    if ((e.type === 'empujon' || e.type === 'empuja-aire' || e.type === 'agua') && panas.get(e.by)) panas.get(e.by).pana.shove();
    if (e.type === 'cheer' && panas.get(e.by)) panas.get(e.by).pana.cheer();
    if (['trompon', 'caida', 'fin', 'mano', 'moto', 'vecino'].includes(e.type)) {
      for (const n of npcs) if (Math.random() < .7) n.cheer = 1.6;
      for (const entry of panas.values()) if (!isFighter(entry.player?.id)) entry.pana.cheer();
    }
    if (e.type === 'intro') { arena?.reset(); frames.length = 0; replay.on = false; lastCaida = -1; for (const entry of panas.values()) entry.placed = false; }
    if (e.type === 'fin' && (e.how === 'ko' || e.how === 'cuenta') && lastCaida >= 0) {
      // The replay: from just before the last caída until the flop.
      const from = frames.findIndex(f => f.t >= lastCaida - 1.5), to = frames.findIndex(f => f.t >= lastCaida + .5);
      if (from >= 0) { replay.frames = frames.slice(from, to < 0 ? undefined : to); replay.on = replay.frames.length > 4; replay.clock = -.25; }
    }
    return arena?.react(e) || null;
  }
  const floor = () => arena?.floor || 0;
  const isFighter = (id) => current && current.phase !== 'lobby' && current.bodies?.some(b => b.id === id);

  // Where each pana should be and how it stands, from the state (or the replay).
  function targets() {
    const state = current, out = new Map();
    if (!state) return out;
    const shape = arenaOf(state.arenaNow || state.options?.arena);
    const t0 = replay.frames[0]?.t ?? 0;
    const replayFrame = replay.on && replay.clock >= 0 ? replay.frames.find(f => f.t - t0 >= replay.clock) || replay.frames.at(-1) : null;
    const bodies = replayFrame ? replayFrame.bodies : state.phase === 'lobby' || state.phase === 'finished' ? [] : state.bodies;
    for (const b of bodies) out.set(b.id, { x: b.x, z: b.z, y: b.bench ? 0 : floor(), h: b.h, view: { act: b.bench ? 'bench' : b.act, at: b.at, moving: b.moving, dodgeDir: b.dodgeDir, holding: !!b.prop }, corner: b.corner });
    // Mano de caballero: both fighters walk in for the glove bump and the hug.
    if (state.phase === 'after' && state.result?.mano && !replayFrame && state.bodies.length === 2) {
      const [a, b] = state.bodies, mx = (a.x + b.x) / 2, mz = (a.z + b.z) / 2;
      for (const body of state.bodies) {
        const t = out.get(body.id), dx = body.x - mx, dz = body.z - mz, d = Math.hypot(dx, dz) || 1;
        Object.assign(t, { x: mx + dx / d * .55, z: mz + dz / d * .55, view: { act: 'hug', at: 0, moving: 1 } });
      }
    }
    let k = 0;
    for (const p of state.players) {
      if (out.has(p.id)) continue;
      const spot = state.phase === 'lobby' || state.phase === 'finished' ? crowdSpot(shape, (k++ / Math.max(1, state.players.length)) * Math.PI * 2 + .4) : crowdSpot(shape, p.angle);
      const face = Math.atan2(-spot.x, -spot.z);
      out.set(p.id, { x: spot.x, z: spot.z, y: 0, h: face, view: { act: state.phase === 'finished' && state.winner === p.id ? 'win' : 'crowd' }, corner: null });
    }
    return out;
  }

  function frame(dt) {
    time += dt; zoomT = Math.max(0, zoomT - dt); shake = Math.max(0, shake - dt * 1.4);
    if (replay.on && current?.phase === 'after') { replay.clock += dt * .4; if (replay.clock > replay.frames.at(-1).t - replay.frames[0].t) replay.on = false; }
    else if (current?.phase !== 'after') replay.on = false;
    const want = targets(), k = 1 - Math.exp(-dt * 14);
    const inRingNow = current && ['intro', 'fight', 'after'].includes(current.phase) ? ringOf(current.bodies) : [];
    const fightMid = inRingNow.length ? { x: inRingNow.reduce((n, b) => n + b.x, 0) / inRingNow.length, z: inRingNow.reduce((n, b) => n + b.z, 0) / inRingNow.length } : null;
    for (const [id, entry] of panas) {
      const t = want.get(id); if (!t) continue;
      const goal = v(t.x, t.y, t.z);
      if (!entry.placed) { entry.pos.copy(goal); entry.h = t.h; entry.placed = true; }
      const moved = entry.pos.distanceTo(goal);
      entry.pos.lerp(goal, k);
      let dh = t.h - entry.h; dh = Math.atan2(Math.sin(dh), Math.cos(dh)); entry.h += dh * k;
      entry.pana.root.position.copy(entry.pos); entry.pana.root.rotation.y = entry.h;
      entry.pana.setCorner(t.corner);
      entry.pana.showTag(!t.corner);
      const view = { ...t.view };
      if (view.act === 'crowd') view.moving = moved / Math.max(dt, 1e-3) > .8 ? 1 : 0;
      entry.pana.update(dt, view);
      // TV framing: a pana of the crowd right between the camera and the fight ducks out of shot.
      if (!t.corner && fightMid) {
        const dx = entry.pos.x - fightMid.x, dz = entry.pos.z - fightMid.z, toward = dx * camPerp.x + dz * camPerp.z, side = Math.abs(dx * camPerp.z - dz * camPerp.x);
        entry.pana.root.visible = !(toward > 2.2 && side < 2.6);
      } else entry.pana.root.visible = true;
    }
    // Record the fight for the replay.
    if (current?.phase === 'fight') {
      frames.push({ t: time, bodies: current.bodies.map(b => ({ id: b.id, x: b.x, z: b.z, h: b.h, act: b.act, at: b.at, moving: b.moving, dodgeDir: b.dodgeDir, corner: b.corner, bench: b.bench, out: b.out })) });
      while (frames.length && frames[0].t < time - 6) frames.shift();
    }
    for (const n of npcs) {
      // TV framing: neighbours between the camera and the fight step out of shot.
      n.group.visible = n.group.position.x * camPerp.x + n.group.position.z * camPerp.z < 2.5 || !current || current.phase === 'lobby';
      n.cheer = Math.max(0, n.cheer - dt);
      n.update(dt, n.cheer > 0 ? { pose: 'wave' } : {});
      if (n.cheer > 0 && !n.seated) n.group.position.y = Math.abs(Math.sin(time * 9 + n.phase)) * .12;
    }
    updateRef(dt);
    placeProps(dt, want);
    arena?.update(time, dt);
    puffs.update(dt); rings.update(dt);
    direct(dt, want);
    stage.draw(dt);
  }

  function placeProps(dt, want) {
    for (const p of current?.props || []) {
      const entry = props.get(p.id); if (!entry) continue;
      const holder = p.held != null ? panas.get(p.held) : null;
      let goal, tilt = 0;
      if (holder) { const h = holder.h; goal = holder.pos.clone().add(v(Math.sin(h) * .55, 1.2, Math.cos(h) * .55)); tilt = .3; }
      else if (p.fly) { goal = v(p.x, floor() + 1.25, p.z); entry.spin += dt * 14; }
      else { goal = v(p.x, floor(), p.z); entry.spin = 0; }
      entry.pos.lerp(goal, p.fly ? 1 : 1 - Math.exp(-dt * 18));
      entry.model.position.copy(entry.pos); entry.model.rotation.set(tilt + entry.spin, p.h || 0, 0);
    }
    void want;
  }

  // The ref stays out of the way, counts over a pana who's down and raises the winner's arm.
  function updateRef(dt) {
    if (!ref || !current) return;
    const bodies = ringOf(current.bodies), fighting = current.phase === 'fight' || current.phase === 'after' || current.phase === 'intro';
    let goal = v(0, floor(), -3.4), face = 0, pose = {};
    if (fighting && bodies.length >= 2) {
      const mx = bodies.reduce((n, b) => n + b.x, 0) / bodies.length, mz = bodies.reduce((n, b) => n + b.z, 0) / bodies.length;
      goal = v(mx - camPerp.x * 2.2, floor(), mz - camPerp.z * 2.2);
      const down = bodies.find(x => x.act === 'down');
      if (down) { goal = v(down.x - camPerp.x * 1.3 + .6, floor(), down.z - camPerp.z * 1.3); pose = { pose: 'wave' }; }
      if (current.phase === 'after') { const w = bodies.find(x => x.id === current.result?.winner); if (w) { goal = v(w.x - camPerp.x * .2 + .7, floor(), w.z - camPerp.z * .2); pose = { pose: 'wave' }; } }
      face = Math.atan2(camPerp.x, camPerp.z);
    }
    const shape = arenaOf(current.arenaNow || current.options?.arena);
    if (shape.shape === 'circle') { const d = Math.hypot(goal.x, goal.z); if (d > shape.r - .4) goal.multiplyScalar((shape.r - .4) / d).setY(floor()); }
    else { goal.x = Math.max(-2.6, Math.min(2.6, goal.x)); goal.z = Math.max(-2.6, Math.min(2.6, goal.z)); }
    ref.pos.lerp(goal, 1 - Math.exp(-dt * 3));
    ref.group.position.copy(ref.pos); ref.group.rotation.y = face;
    ref.update(dt, { walk: ref.pos.distanceTo(goal) > .3 ? 1 : 0, ...pose });
  }

  // The boxing-TV camera.
  function direct(dt, want) {
    const state = current, f0 = floor();
    let pos, look;
    const ring = state && state.phase !== 'lobby' && state.phase !== 'finished' ? ringOf(state.bodies) : [];
    const fighters = ring.map(b => panas.get(b.id)?.pos).filter(Boolean);
    if (fighters.length >= 2) {
      // Two: side-on to their line. More: frame them all, drifting slowly around.
      const [a, b] = fighters, mid = fighters.reduce((m, p) => m.add(p), v()).multiplyScalar(1 / fighters.length);
      const axis = b.clone().sub(a); axis.y = 0;
      const sep = fighters.length === 2 ? axis.length() : Math.max(...fighters.map(p => p.distanceTo(mid))) * 2;
      axis.normalize();
      const perp = fighters.length === 2 ? v(-axis.z, 0, axis.x) : v(Math.sin(time * .05), 0, Math.cos(time * .05));
      if (perp.dot(camPerp) < 0) perp.negate();
      camPerp.lerp(perp, 1 - Math.exp(-dt * (fighters.length === 2 ? 5 : .6))).normalize();
      zoom += ((zoomT > 0 ? .68 : 1) - zoom) * (1 - Math.exp(-dt * (zoomT > 0 ? 9 : 2.5)));
      const dist = Math.min(13.5, Math.max(8.4, 6.2 + sep * 1.3)) * zoom;
      pos = mid.clone().addScaledVector(camPerp, dist).add(v(0, (arena?.camHeight ?? 3.7) + f0 - (1 - zoom) * 1.6, 0));
      look = mid.clone().add(v(0, 1.05 + f0, 0));
      if (state.phase === 'intro') {
        // Walk-out: each fighter in close-up, then the wide shot.
        const t = 6.5 - state.time, slot = Math.min(fighters.length - 1, Math.floor(t / (5.2 / fighters.length)));
        const b0 = ring[slot], who = fighters[slot];
        if (t < 5.2 && fighters.length === 2) {
          const fx = Math.sin(b0.h), fz = Math.cos(b0.h), side = slot % 2 ? .35 : -.35;
          pos = who.clone().add(v(fx * 5.4 + camPerp.x * side * 4.4, 2.3, fz * 5.4 + camPerp.z * side * 4.4));
          look = who.clone().add(v(0, 1.35, 0));
        }
      }
      if (replay.on && replay.clock >= 0) {
        const down = state.bodies.find(x => x.id === state.result?.loser), target = down ? want.get(down.id) : null;
        if (target) { const p = v(target.x, f0, target.z); pos = p.clone().addScaledVector(camPerp, 3.6).add(v(1.4, 1.2, 0)); look = p.clone().add(v(0, .9, 0)); }
      }
    } else {
      // Lobby and the end of the night: a slow orbit over the ring.
      const a = time * .12;
      pos = v(Math.sin(a) * 10.5, 4.6 + f0, Math.cos(a) * 10.5); look = v(0, 1 + f0, 0);
    }
    if (arena?.camBox) { const [hx, hz] = arena.camBox; pos.x = Math.max(-hx, Math.min(hx, pos.x)); pos.z = Math.max(-hz, Math.min(hz, pos.z)); }
    if (shake > 0) pos.add(v((Math.random() - .5) * shake * .5, (Math.random() - .5) * shake * .4, (Math.random() - .5) * shake * .5));
    const kc = 1 - Math.exp(-dt * (state?.phase === 'intro' ? 3 : 6));
    camPos.lerp(pos, kc); camLook.lerp(look, kc);
    const { w, h } = stage.resize();
    camera.aspect = w / h; camera.fov = w < h ? 58 : 40; camera.position.copy(camPos); camera.lookAt(camLook); camera.updateProjectionMatrix();
  }

  // Screen right and screen up as world directions on the ground, for the stick.
  function stickBasis() {
    const forward = v(); camera.getWorldDirection(forward); forward.y = 0; forward.normalize();
    const right = v(-forward.z, 0, forward.x);
    return { right, forward };
  }

  function dispose() {
    for (const entry of panas.values()) entry.pana.dispose();
    for (const entry of props.values()) entry.model.userData.dispose?.();
    npcs.forEach(n => n.dispose()); ref?.dispose(); arena?.dispose(); lampLights.forEach(l => l.removeFromParent());
    puffs.clear(); rings.clear(); stage.dispose();
  }
  return { renderer, scene, camera, update, react, frame, stickBasis, dispose, get replaying() { return replay.on; }, get arenaId() { return arenaId; } };
}
