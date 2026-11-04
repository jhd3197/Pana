import { createCombatImpacts } from './combat-impact.js';
// Trifulca's 3D world: the chosen arena, every pana (the two fighters in
// gloves and helmets, the rest standing as the ring), NPC neighbours, the ref
// in his llanero hat, and the boxing-TV camera: side-on to the fighters,
// zooming on big hits, a walk-out shot for each fighter and a slow-motion
// replay of the knockdown that ended the fight.
import * as THREE from 'three';
import { createTableWorld } from '/engine/worlds/table-world.js';
import { AFTER } from './rules.js';
import { buildCharacter } from '/engine/models/characters/pana/avatar-model.js';
import { randomAvatar } from '/engine/avatar.js';
import { rng } from '/engine/random.js';
import { Puffs, Shockwaves } from '/engine/fx.js';
import { arenaOf, arenaIdOf, crowdSpot } from './fight-rules.js';
import { ringside, stepRingside } from './ringside.js';
import { arenaSteps } from './arenas.js';
import { fighterLook, HEAD_SIZE, ARM_LENGTH } from './fighter-look.js';
import { createPana } from './fighters.js';
import { motoHelmet, chancleta } from './set.js';
import { gazeAt, midOf, npcLife, animateNpc } from './crowd-life.js';
import { inkOutlines } from './toon.js';
import { plasticChair, produceCrates, woodenBat } from '/engine/models/props/barrio.js';

// The things lying around a trifulca libre, at the size a pana can swing.
const PROP_MODELS = {
  silla: () => { const m = plasticChair({ color: '#ff4b4b' }); m.scale.setScalar(.55); return m; },
  caja: () => produceCrates({ w: .6, d: .45, h: .34, seed: 4, detail: 'light' }),
  casco: () => { const m = motoHelmet({ color: '#2ad1b2' }); m.scale.setScalar(.5); m.position.y = .3; const g = new THREE.Group(); g.add(m); g.userData.dispose = m.userData.dispose; return g; },
  chancleta: () => { const m = chancleta({ color: '#ff6fae' }); m.scale.setScalar(1.8); return m; },
  bate: () => { const m = woodenBat({ length: 1.15 }); m.rotation.set(0, 0, Math.PI / 2); m.position.set(.55, .09, 0); const g = new THREE.Group(); g.add(m); g.userData.dispose = m.userData.dispose; return g; },
};
const ringOf = (bodies = []) => bodies.filter(b => !b.bench && !b.out);
const gapToFoe = (b, bodies) => { const foe = bodies.find(o => o.id === b.foe); return foe ? Math.hypot(foe.x - b.x, foe.z - b.z) : undefined; };
// How many point lights a scene has decides every material's shader, so a map
// with another count would recompile them all: every map shares this many.
const LAMP_POOL = 2;
// How long a frame may spend building the next map, and how many neighbours a
// map gets: a character costs far more triangles than any prop.
const BUILD_MS = 4, NPC_MAX = 14;


const REF_LOOK = { outfit: 'franela', outfitColor: '#f3e9d7', hat: 'llanero', hatColor: '#7a5230', face: 'cool' };
const v = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
// Camera-side candidates when an arena doesn't declare its own (camSides).
const CAM_SIDES = [v(0, 0, 1), v(0, 0, -1)];

export function createTrifulcaScene(canvas, { me = () => null } = {}) {
  const stage = createTableWorld(canvas, { fit: 'window', arena: false, fov: 40 }), { renderer, scene, camera, sun } = stage;
  const hemi = scene.children.find(o => o.isHemisphereLight);
  const sky = scene.children.find(o => o.material?.uniforms?.daylight);
  const own = new THREE.Group(); scene.add(own);
  const impacts = createCombatImpacts(scene);
  const puffs = new Puffs(scene), rings = new Shockwaves(scene);
  const panas = new Map(), props = new Map();
  let arena = null, arenaId = null, dressed = null, spare = null, npcs = [], ref = null, current = null, time = 0;
  const lampLights = Array.from({ length: LAMP_POOL }, () => { const light = new THREE.PointLight('#ffd89a', 0, 12, 1.6); scene.add(light); return light; });
  let hitStop = 0, cut = false;
  let camPerp = v(0, 0, 1), camPos = v(0, 4, 12), camLook = v(0, 1, 0), shake = 0, zoom = 1, zoomT = 0;
  let sideIndex = 0, sideWant = -1, sideTimer = 0;
  const frames = [], replay = { on: false, frames: [], clock: 0 };
  let lastCaida = -1;

  // A map and its neighbours, built a piece at a time: both take long enough
  // to stall a frame, the arena's houses most of all.
  function dress(id) { return { id, arena: null, steps: arenaSteps(id, arenaOf(id)), npcs: [], spots: [] }; }
  function buildMap(set, until) {
    while (!set.arena) {
      const step = set.steps.next();
      if (step.done) {
        set.arena = step.value;
        const all = set.arena.npcSpots;
        set.spots = all.filter((_, i) => all.length <= NPC_MAX || i % Math.ceil(all.length / NPC_MAX) === 0).slice(0, NPC_MAX);
      }
      if (performance.now() >= until) return;
    }
  }
  function addNeighbours(set, until) {
    while (set.arena && set.npcs.length < set.spots.length) {
      const i = set.npcs.length, spot = set.spots[i];
      const look = spot.senora ? { outfit: 'hawaiana', outfitColor: '#ff6fae', hat: 'none', glasses: 'redondos', face: 'feliz' } : randomAvatar(rng(i * 31 + 7));
      if (set.arena.hats && !spot.senora && i % 4 !== 3) Object.assign(look, { hat: 'llanero', hatColor: ['#7a5230', '#e9dcc0', '#3b2a1a'][i % 3] });
      const npc = buildCharacter(look, { seated: !!spot.seated, head: HEAD_SIZE });
      npc.arms.forEach(arm => { arm.scale.y = ARM_LENGTH; });
      npc.group.position.set(spot.x, spot.y ?? 0, spot.z); npc.group.rotation.y = spot.face;
      npc.phase = i * 1.7; npc.cheer = 0; npc.life = npcLife(i); set.arena.group.add(npc.group); set.npcs.push(npc);
      if (performance.now() >= until) return;
    }
  }
  function undress(set) { buildMap(set, Infinity); set.npcs.forEach(n => n.dispose()); set.arena.dispose(); }

  function setArena(id) {
    if (id === arenaId) return;
    const first = !dressed, next = spare?.id === id ? spare : dress(id);
    if (spare && spare !== next) undress(spare);
    spare = null;
    if (dressed) undress(dressed);
    buildMap(next, Infinity);
    dressed = next; arena = next.arena; npcs = next.npcs; arenaId = id; own.add(arena.group);
    if (first) addNeighbours(next, Infinity);
    const L = arena.light;
    sun.color.set(L.sun[0]); sun.intensity = L.sun[1]; sun.position.set(...L.sun[2]);
    if (hemi) { hemi.color.set(L.hemi[0]); hemi.groundColor.set(L.hemi[1]); hemi.intensity = L.hemi[2]; }
    renderer.toneMappingExposure = L.exposure;
    scene.background = new THREE.Color(L.background); scene.fog.color.set(L.background);
    scene.fog.near = id === 'motos' ? 22 : 45; scene.fog.far = id === 'motos' ? 70 : 150;
    if (sky) sky.material.uniforms.daylight.value = L.daylight;
    const lamps = [...arena.lamps].sort((a, b) => a.lengthSq() - b.lengthSq());
    lampLights.forEach((light, i) => {
      if (i === 0 && L.ringLight) { light.color.set('#ffe6b8'); light.intensity = L.ringLight; light.distance = 22; light.decay = 1.4; light.position.set(0, 7, 0); return; }
      const p = lamps.shift();
      light.color.set('#ffd89a'); light.intensity = p ? (id === 'motos' ? 22 : 10) : 0; light.distance = id === 'motos' ? 16 : 12; light.decay = 1.6;
      if (p) light.position.copy(p);
    });
    ref ||= Object.assign(buildCharacter(REF_LOOK, { head: HEAD_SIZE }), { pos: v(0, 0, -3) });
    own.add(ref.group);
    // The sides of the old map may not exist here, and its camera spot may be a wall.
    sideIndex = 0; sideWant = -1; sideTimer = 0; cut = true;
  }
  // During the verdict every client dresses the next map out of sight, so the
  // swap itself is only a cut: nothing to build or compile while panas walk in.
  function prepareNext() {
    const next = current?.phase === 'after' ? current.arenaNext : null;
    if (spare && spare.id !== next) { undress(spare); spare = null; }
    if (next && next !== arenaId && !spare && current.time < AFTER - .5) spare = dress(next);
    const until = performance.now() + BUILD_MS;
    if (spare && !spare.arena) {
      buildMap(spare, until);
      if (spare.arena) renderer.compileAsync?.(spare.arena.group, camera, scene).catch?.(() => {});
    }
    if (dressed) addNeighbours(dressed, until);
    if (spare) addNeighbours(spare, until);
  }

  function update(state) {
    current = state;
    setArena(arenaIdOf(state, arenaId || 'calle'));
    // Chairs, crates, helmets and chancletas of a trifulca libre.
    const liveProps = new Set((state.props || []).map(p => p.id));
    for (const p of state.props || []) if (!props.has(p.id)) { const model = inkOutlines(PROP_MODELS[p.kind]?.() || PROP_MODELS.caja()); own.add(model); props.set(p.id, { model, pos: v(p.x, 0, p.z), spin: 0 }); }
    for (const [id, entry] of props) if (!liveProps.has(id)) { entry.model.userData.dispose?.(); entry.model.removeFromParent(); props.delete(id); }
    const live = new Set();
    state.players.forEach((p, i) => {
      live.add(p.id);
      const look = fighterLook(p, i), key = JSON.stringify(look) + p.name;
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
    const entry = panas.get(e.id), who = entry?.pana, at = entry?.pos;
    if (at && ['hit', 'trompon', 'block'].includes(e.type)) {
      // On the side the blow came from, not inside the victim's head.
      const from = panas.get(e.by)?.pos, toward = from ? from.clone().sub(at).setY(0).normalize() : v();
      impacts.spawn(at.clone().addScaledVector(toward, .4).add(v(0, (e.move === 'sweep' ? .4 : 1.3) + floor(), 0)), e.type, e.move, e.chain || 0);
    }
    // The hit fighter flashes; a heavy blow also freezes the pose and shakes the camera.
    const heavy = e.type === 'trompon' || e.type === 'caida' || e.move === 'kick' || e.counter || e.contra || e.armed || e.chain >= 2;
    if (who && ['hit', 'trompon', 'shove', 'impacto', 'caida'].includes(e.type)) who.flash(heavy ? 1 : .7);
    if (heavy && ['hit', 'trompon', 'caida'].includes(e.type)) { hitStop = Math.max(hitStop, e.type === 'hit' ? .05 : .08); shake = Math.max(shake, .32); }
    // Which side the blow came from, in the victim's facing frame (for stagger).
    const side = (by) => {
      const from = panas.get(by)?.pos;
      if (!from || !at || !entry) return 0;
      return Math.sign(Math.sin(entry.h) * (from.z - at.z) - Math.cos(entry.h) * (from.x - at.x));
    };
    if (e.type === 'hit' && who) { who.hit(e.counter ? 1 : .6, false, side(e.by)); puffs.spawn(at.clone().add(v(0, 1.4 + floor(), 0)), { color: 0xfff1d0, count: 4, spread: .4, size: .5, rise: .6, life: .4 }); }
    if (e.type === 'trompon' && who) {
      who.hit(1.3, true, side(e.by)); zoomT = .45;
      rings.ring(at.clone().add(v(0, 1.4 + floor(), 0)), { color: 0xffd23f, maxRadius: 2.2, life: .35 });
      rings.sparkle(at.clone().add(v(0, 1.6 + floor(), 0)), { count: 8 });
    }
    if (e.type === 'block' && who) { who.blocked(); rings.sparkle(at.clone().add(v(0, 1.5 + floor(), 0)), { color: 0xffffff, count: 4, spread: .3 }); }
    if (e.type === 'caida') { zoomT = .5; lastCaida = time; if (at) puffs.spawn(at.clone().add(v(0, .2 + floor(), 0)), { color: 0xcab79a, count: 3, spread: .5, size: .45, rise: .4, life: .6 }); }
    if (e.type === 'rise' && who) who.character.bounce?.(.8);
    // A trompón connecting or a caída: the neighbours close by gasp.
    if ((e.type === 'trompon' || e.type === 'caida') && at) {
      for (const n of npcs) { const p = n.group.position; if (n.life && Math.abs(p.x - at.x) < 7 && Math.abs(p.z - at.z) < 7) n.life.gasp = 1; }
    }
    if (e.type === 'shove' && who) who.hit(.8);
    if ((e.type === 'empujon' || e.type === 'empuja-aire' || e.type === 'agua') && panas.get(e.by)) panas.get(e.by).pana.shove();
    if (e.type === 'cheer' && panas.get(e.by)) panas.get(e.by).pana.cheer();
    if (['trompon', 'caida', 'fin', 'mano', 'moto', 'vecino'].includes(e.type)) {
      for (const n of npcs) if (Math.random() < .7) n.cheer = 1.6;
      for (const entry of panas.values()) if (!isFighter(entry.player?.id)) entry.pana.cheer();
      // The end of a fight: everyone celebrates with a landing bounce.
      if (e.type === 'fin') {
        for (const n of npcs) n.bounce?.(.8);
        for (const entry of panas.values()) entry.pana.character.bounce?.(.8);
      }
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
    const shape = arenaOf(arenaId);
    const t0 = replay.frames[0]?.t ?? 0;
    const replayFrame = replay.on && replay.clock >= 0 ? replay.frames.find(f => f.t - t0 >= replay.clock) || replay.frames.at(-1) : null;
    const bodies = replayFrame ? replayFrame.bodies : state.phase === 'lobby' || state.phase === 'finished' ? [] : state.bodies;
    for (const b of bodies) out.set(b.id, { x: b.x, z: b.z, y: b.bench ? 0 : floor(), h: b.h, view: { act: b.bench ? 'bench' : b.act, at: b.at, moving: b.moving, dodgeDir: b.dodgeDir, holding: !!b.prop, tumbleKind: b.tumbleKind, stun: b.stun, motion: b.motion, gap: gapToFoe(b, bodies) }, corner: b.corner });
    // Mano de caballero: both fighters walk in for the glove bump and the hug.
    if (state.phase === 'after' && state.result?.mano && !replayFrame && state.bodies.length === 2) {
      const [a, b] = state.bodies, mx = (a.x + b.x) / 2, mz = (a.z + b.z) / 2;
      for (const body of state.bodies) {
        const t = out.get(body.id), dx = body.x - mx, dz = body.z - mz, d = Math.hypot(dx, dz) || 1;
        Object.assign(t, { x: mx + dx / d * .55, z: mz + dz / d * .55, view: { act: 'hug', at: 0, moving: 1 } });
      }
    }
    let k = 0;
    const mid = midOf(bodies); // the crowd faces the fight, not the centre mark
    for (const p of state.players) {
      if (out.has(p.id)) continue;
      const spot = ringside(shape, state.phase === 'lobby' || state.phase === 'finished' ? crowdSpot(shape, (k++ / Math.max(1, state.players.length)) * Math.PI * 2 + .4) : crowdSpot(shape, p.angle), bodies);
      const face = gazeAt(spot.x, spot.z, mid);
      out.set(p.id, { x: spot.x, z: spot.z, y: 0, h: face, view: { act: state.phase === 'finished' && state.winner === p.id ? 'win' : 'crowd' }, corner: null });
    }
    return out;
  }

  function frame(dt) {
    impacts.update(dt, camera);
    time += dt; zoomT = Math.max(0, zoomT - dt); shake = Math.max(0, shake - dt * 1.4);
    prepareNext();
    const frozen = hitStop > 0; hitStop = Math.max(0, hitStop - dt);
    if (replay.on && current?.phase === 'after') { replay.clock += dt * .4; if (replay.clock > replay.frames.at(-1).t - replay.frames[0].t) replay.on = false; }
    else if (current?.phase !== 'after') replay.on = false;
    const want = targets(), k = 1 - Math.exp(-dt * 14), shape = arenaOf(arenaId);
    const inPlay = current && ['intro', 'fight', 'after'].includes(current.phase) ? current.bodies : [];
    const inRingNow = current && ['intro', 'fight', 'after'].includes(current.phase) ? ringOf(current.bodies) : [];
    const fightMid = inRingNow.length ? { x: inRingNow.reduce((n, b) => n + b.x, 0) / inRingNow.length, z: inRingNow.reduce((n, b) => n + b.z, 0) / inRingNow.length } : null;
    for (const [id, entry] of panas) {
      const t = want.get(id); if (!t) continue;
      const goal = v(t.x, t.y, t.z);
      if (!entry.placed) { entry.pos.copy(goal); entry.h = t.h; entry.placed = true; }
      const moved = entry.pos.distanceTo(goal), still = frozen && !!t.corner;
      // Fighters go where the fight says; everyone else walks around the ring.
      if (!still && t.corner) entry.pos.lerp(goal, k);
      else if (!still) { stepRingside(entry.pos, goal, shape, inPlay, dt, { rate: 14, speed: 6 }); entry.pos.y += (goal.y - entry.pos.y) * k; }
      let dh = t.h - entry.h; dh = Math.atan2(Math.sin(dh), Math.cos(dh)); entry.h += dh * k;
      entry.pana.root.position.copy(entry.pos); entry.pana.root.rotation.y = entry.h;
      entry.pana.setCorner(t.corner);
      entry.pana.showTag(!t.corner);
      const view = { ...t.view };
      if (view.act === 'crowd') view.moving = moved / Math.max(dt, 1e-3) > .8 ? 1 : 0;
      entry.pana.update(still ? 0 : dt, view, dt);
      // TV framing: a pana of the crowd right between the camera and the fight ducks out of shot.
      if (!t.corner && fightMid) {
        const dx = entry.pos.x - fightMid.x, dz = entry.pos.z - fightMid.z, toward = dx * camPerp.x + dz * camPerp.z, side = Math.abs(dx * camPerp.z - dz * camPerp.x);
        entry.pana.root.visible = !(toward > 2.2 && side < 2.6);
      } else entry.pana.root.visible = true;
    }
    // Record the fight for the replay.
    if (current?.phase === 'fight') {
      frames.push({ t: time, bodies: current.bodies.map(b => ({ id: b.id, x: b.x, z: b.z, h: b.h, act: b.act, at: b.at, moving: b.moving, dodgeDir: b.dodgeDir, corner: b.corner, bench: b.bench, out: b.out, foe: b.foe, tumbleKind: b.tumbleKind, stun: b.stun, motion: b.motion })) });
      while (frames.length && frames[0].t < time - 6) frames.shift();
    }
    for (const n of npcs) {
      // TV framing: neighbours between the camera and the fight step out of shot.
      n.group.visible = n.group.position.x * camPerp.x + n.group.position.z * camPerp.z < 2.5 || !current || current.phase === 'lobby';
      n.cheer = Math.max(0, n.cheer - dt);
      n.update(dt, n.cheer > 0 ? { pose: 'wave' } : {});
      if (n.cheer > 0 && !n.seated) n.group.position.y = Math.abs(Math.sin(time * 9 + n.phase)) * .12;
      animateNpc(n, dt, time, fightMid);
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
      let goal, tilt = 0, raise = 0;
      if (holder) { const h = holder.h; goal = holder.pos.clone().add(v(Math.sin(h) * .55, 1.2, Math.cos(h) * .55)); tilt = .3; if (p.kind === 'bate') raise = 1.25; }
      else if (p.fly) { goal = v(p.x, floor() + 1.25, p.z); entry.spin += dt * 14; }
      else { goal = v(p.x, floor(), p.z); entry.spin = 0; }
      entry.pos.lerp(goal, p.fly ? 1 : 1 - Math.exp(-dt * 18));
      entry.model.position.copy(entry.pos); entry.model.rotation.set(tilt + entry.spin, p.h || 0, raise);
    }
    void want;
  }

  // The ref stays out of the way, counts over a pana who's down and raises the winner's arm.
  function updateRef(dt) {
    if (!ref || !current) return;
    const bodies = ringOf(current.bodies), fighting = current.phase === 'fight' || current.phase === 'after' || current.phase === 'intro';
    // The ref watches from outside the ring, on the far side, and walks around
    // the edge to whoever is down to count over them. Never through the ring.
    const shape = arenaOf(arenaId), outside = shape.shape === 'square' ? shape.half * 1.12 + 1 : shape.r + 1.1;
    let angle = Math.atan2(-camPerp.x, -camPerp.z) + 1.05, face = 0, pose = {};
    if (fighting && bodies.length >= 2) {
      const down = bodies.find(x => x.act === 'down');
      if (down) { angle = Math.atan2(down.x, down.z); pose = { pose: 'wave' }; }
      if (current.phase === 'after') { const w = bodies.find(x => x.id === current.result?.winner); if (w) { angle = Math.atan2(w.x, w.z) + .3; pose = { pose: 'wave' }; } }
    }
    const goal = v(Math.sin(angle) * outside, 0, Math.cos(angle) * outside);
    const near = current.phase === 'lobby' || current.phase === 'finished' ? [] : current.bodies;
    Object.assign(goal, ringside(shape, goal, near));
    if (cut) ref.pos.copy(goal);
    stepRingside(ref.pos, goal, shape, near, dt, { rate: 3, speed: 4 });
    face = Math.atan2(-ref.pos.x, -ref.pos.z);
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
      // Like a fighting game: a fixed side view (the fight runs along X, the
      // red corner on the left), so right on the stick is right on screen. A
      // chooser picks between the arena's candidate sides: each is scored by
      // the fighters' depth spread along it, how far a fighter drifts toward
      // the camera, and how far the camera position would overflow camBox.
      // A switch needs a clearly better score held for 1.5 s, so a 1v1 on the
      // z≈0 line never flips the screen; the chooser only earns its keep in
      // trifulca libre and when a caída flings a body outward.
      const sides = arena?.camSides?.length ? arena.camSides : CAM_SIDES;
      const dist0 = Math.min(12, Math.max(7.2, 5.4 + sep * 1.35));
      const scores = sides.map(s => {
        let mn = Infinity, mx = -Infinity;
        for (const p of fighters) { const d = (p.x - mid.x) * s.x + (p.z - mid.z) * s.z; if (d < mn) mn = d; if (d > mx) mx = d; }
        let score = mx - mn + Math.max(0, mx) * 1.4;
        if (arena?.camBox) { const [hx, hz] = arena.camBox; score += 2 * (Math.max(0, Math.abs(mid.x + s.x * dist0) - hx) + Math.max(0, Math.abs(mid.z + s.z * dist0) - hz)); }
        return score;
      });
      let best = 0;
      for (let i = 1; i < sides.length; i++) if (scores[i] < scores[best]) best = i;
      if (best !== sideIndex && scores[sideIndex] - scores[best] > 1.2) {
        if (sideWant !== best) { sideWant = best; sideTimer = 0; }
        sideTimer += dt;
        if (sideTimer > 1.5) { sideIndex = best; sideWant = -1; sideTimer = 0; }
      } else { sideWant = -1; sideTimer = 0; }
      const perp = sides[sideIndex];
      // Turn around the fight by the shortest way instead of cutting through it.
      const from = Math.atan2(camPerp.x, camPerp.z), to = Math.atan2(perp.x, perp.z);
      let turn = to - from; turn = Math.atan2(Math.sin(turn), Math.cos(turn));
      const angle = from + turn * (1 - Math.exp(-dt * (fighters.length === 2 ? 4 : .6)));
      camPerp.set(Math.sin(angle), 0, Math.cos(angle));
      zoom += ((zoomT > 0 ? .82 : 1) - zoom) * (1 - Math.exp(-dt * (zoomT > 0 ? 7 : 2.5)));
      const dist = Math.min(12, Math.max(7.2, 5.4 + sep * 1.35)) * zoom;
      pos = mid.clone().addScaledVector(camPerp, dist).add(v(0, (arena?.camHeight ?? 2.7) + f0, 0));
      look = mid.clone().add(v(0, 1.15 + f0, 0));
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
    const kc = cut ? 1 : 1 - Math.exp(-dt * (state?.phase === 'intro' ? 3 : 6));
    cut = false;
    camPos.lerp(pos, kc); camLook.lerp(look, kc);
    const { w, h } = stage.resize();
    camera.aspect = w / h; camera.fov = w < h ? 58 : 40; camera.position.copy(camPos); camera.lookAt(camLook);
    // ?debug close-ups: a fixed camera offset from your own pana.
    const close = api.debugCamera && panas.get(me())?.pos;
    if (close) { camera.position.copy(close).add(v(...api.debugCamera)); camera.lookAt(close.clone().add(v(0, 1.2, 0))); }
    camera.updateProjectionMatrix();
  }

  // Screen right and screen up as world directions on the ground, for the stick.
  function stickBasis() {
    const forward = v(); camera.getWorldDirection(forward); forward.y = 0; forward.normalize();
    const right = v(-forward.z, 0, forward.x);
    return { right, forward };
  }

  function dispose() {
    impacts.dispose();
    for (const entry of panas.values()) entry.pana.dispose();
    for (const entry of props.values()) entry.model.userData.dispose?.();
    if (spare) undress(spare);
    if (dressed) undress(dressed);
    ref?.dispose(); lampLights.forEach(l => l.removeFromParent());
    puffs.clear(); rings.clear(); stage.dispose();
  }
  const api = { renderer, scene, camera, update, react, frame, stickBasis, dispose, setArena, debugCamera: null, panas, get replaying() { return replay.on; }, get arenaId() { return arenaId; }, get cameraSide() { return sideIndex; }, get spareArena() { return spare?.id ?? null; }, get neighbours() { return npcs.length; }, get neighboursWanted() { return dressed?.spots.length ?? 0; } };
  return api;
}
