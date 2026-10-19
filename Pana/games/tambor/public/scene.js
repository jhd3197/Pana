// La Rueda de Tambor's 3D world: the rueda on the beach (or the malecón), the
// drum stations at the back with the MCP between them, two dancers face to
// face in the middle and la gente around. Every pana moves to the beat of the
// local music: dancers perform the MCP's calls, drummers strike their notes,
// the crowd claps. Snapshots set where everyone stands; the beat drives how
// they move.
import * as THREE from 'three';
import { createSky } from '/engine/sky.js';
import { bindRenderer, shadowSize } from '/engine/settings.js';
import { buildCharacter } from '/engine/models/characters/pana/avatar-model.js';
import { normalizeAvatar, randomAvatar } from '/engine/avatar.js';
import { disposeModel } from '/engine/models/props/game-table.js';
import { tickWind } from '/engine/models/vegetation/plant-kit.js';
import { makeBubble } from '/engine/fx.js';
import { rng } from '/engine/random.js';
import { buildPlace, LIGHTS, RING } from './place.js';
import { createCuloEPuyaSet, createMina, createCharrasca, createCaracol, createMaraca, createPanuelo, createViolinCloud, createNameTag } from './rueda-set.js';
import { chart, songFor, STATIONS } from './songs.js';
import { MOVES, DICHOS } from './rules.js';

const BOT_LOOKS = [
  { outfit: 'hawaiana', outfitColor: '#ffc629', hat: 'llanero', face: 'feliz' }, { outfit: 'franela', outfitColor: '#2ad1b2', hat: 'none', face: 'wow' },
  { outfit: 'hawaiana', outfitColor: '#f15bb5', hat: 'band', hatColor: '#ffc629', face: 'feliz' }, { outfit: 'deportivo', outfitColor: '#3d7bf2', hat: 'gorra-atras', face: 'cool' },
  { outfit: 'franela', outfitColor: '#ff8a1f', hat: 'pesca', face: 'lengua' }, { outfit: 'hawaiana', outfitColor: '#5fc93a', hat: 'none', face: 'feliz' },
  { outfit: 'hoodie', outfitColor: '#8e4de8', hat: 'lana', face: 'ojazos' }, { outfit: 'franela', outfitColor: '#ff4b4b', hat: 'corona', face: 'wow' },
];
// The MCP: shirtless (a top in his own fur colour), black durag, gold chain.
const MCP_LOOK = { fur: '#9a6038', outfit: 'franela', outfitColor: '#9a6038', hat: 'band', hatColor: '#2b2d42', glasses: 'sol', extra: 'cadena', face: 'lengua' };
const STATION_SPOT = { palo: [-1.35, -4.15], mano: [-3.55, -2.95], charrasca: [1.35, -4.15], caracol: [3.55, -2.95] };
const MCP_SPOT = [0, -5.25];
const SLOTS = { 2: [[-1.15, .35], [1.15, .35]], 1: [[0, .35]] };
const CROWD = [[-4.5, 3.1], [4.5, 3.1], [-5.4, 1.6], [5.4, 1.6], [-5.7, -.1], [5.7, -.1], [-5.4, -1.8], [5.4, -1.8], [-6.9, .8], [6.9, .8], [-6.8, -1.2], [6.8, -1.2]];
const EXTRAS = [[-7.6, -4.6, 3], [7.8, -4.4, 9], [-8.2, 3.6, 4], [8.4, 3.2, 12]];
const HAND = new THREE.Vector3(0, -.95, .06);
const damp = (k, dt) => 1 - Math.exp(-k * dt);
const facing = (x, z, tx = 0, tz = 0) => Math.atan2(tx - x, tz - z);
const wrap = (a) => Math.atan2(Math.sin(a), Math.cos(a));

export function createTamborScene(canvas) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
  renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap; renderer.toneMapping = THREE.ACESFilmicToneMapping;
  const unbind = bindRenderer(renderer, 1.5, { fit: 'window' });
  const scene = new THREE.Scene(), camera = new THREE.PerspectiveCamera(40, 1, .1, 260);
  const sky = createSky(); scene.add(sky.mesh);
  const hemi = new THREE.HemisphereLight(); scene.add(hemi);
  const key = new THREE.DirectionalLight(); key.castShadow = true; key.shadow.mapSize.setScalar(shadowSize(2048));
  Object.assign(key.shadow.camera, { left: -14, right: 14, top: 14, bottom: -14, near: .5, far: 60 }); key.shadow.normalBias = .025; key.shadow.bias = -.0001;
  scene.add(key);
  const rueda = new THREE.Group(); scene.add(rueda);
  let placeId = null, world = null, current = null, me = null, time = 0, beat = 0, shake = 0, safe = { bottom: 40, right: 12 }, wall = performance.now(), real = 0;

  // ---------- instruments ----------
  const yawIn = ([x, z]) => facing(x, z);
  const instruments = {};
  function station(id, model) {
    const [x, z] = STATION_SPOT[id]; model.position.set(x, 0, z); model.rotation.y = yawIn(STATION_SPOT[id]);
    rueda.add(model); instruments[id] = model; return model;
  }
  station('mano', createCuloEPuyaSet()); station('palo', createMina()); station('charrasca', createCharrasca());
  const caracolStand = station('caracol', new THREE.Group());
  const shellCrate = new THREE.Mesh(new THREE.BoxGeometry(.6, .55, .45), new THREE.MeshStandardMaterial({ color: '#c8a06a', roughness: .95 }));
  shellCrate.position.y = .275; shellCrate.castShadow = shellCrate.receiveShadow = true; caracolStand.add(shellCrate);
  const restingShell = createCaracol(); restingShell.position.set(0, .56, 0); caracolStand.add(restingShell);
  // Extra culo e' puya sets for ¡Golpe!, where every pana gets a drum.
  const golpeDrums = [];

  // ---------- the panas ----------
  const panas = new Map();
  function lookFor(p, i) { return normalizeAvatar(p.bot ? BOT_LOOKS[(p.id - 1000 + 8) % 8] ?? BOT_LOOKS[i % 8] : p.avatar); }
  function makeEntry(look, name, color) {
    const character = buildCharacter(look); rueda.add(character.group);
    const entry = { character, x: 0, z: 0, yaw: 0, tx: 0, tz: 0, tyaw: 0, hop: 0, dizzy: 0, spin: 0, clapAt: -9, hits: [-9, -9], holding: false,
      pose: { lx: -.04, lz: .4, rx: -.04, rz: -.4 }, bubble: makeBubble() };
    entry.bubble.sprite.position.y = 2.85; character.group.add(entry.bubble.sprite);
    if (name) { entry.tag = createNameTag(name, color); entry.tag.position.y = 2.25; character.group.add(entry.tag); }
    return entry;
  }
  function dropEntry(entry) {
    entry.tag?.userData.dispose(); entry.bubble.sprite.material.map?.dispose(); entry.bubble.sprite.material.dispose();
    entry.cloud && disposeModel(entry.cloud);
    entry.character.dispose();
  }
  // The MCP and a few neighbours who came to watch.
  const mcp = makeEntry(normalizeAvatar(MCP_LOOK), 'El MCP', '#ffc83d');
  Object.assign(mcp, { x: MCP_SPOT[0], z: MCP_SPOT[1], tx: MCP_SPOT[0], tz: MCP_SPOT[1], yaw: 0, tyaw: 0 });
  const maraca = createMaraca(); maraca.position.copy(HAND); maraca.rotation.x = Math.PI; mcp.character.arms[1].add(maraca);
  // In ¡Golpe! the MCP plays the patterns on his own culo e' puya.
  const mcpDrums = createCuloEPuyaSet(); mcpDrums.position.set(MCP_SPOT[0], .3, MCP_SPOT[1] + .55); mcpDrums.scale.setScalar(.8); mcpDrums.visible = false; rueda.add(mcpDrums);
  const crate = new THREE.Mesh(new THREE.BoxGeometry(.9, .3, .7), new THREE.MeshStandardMaterial({ color: '#c8a06a', roughness: .95 }));
  crate.position.set(MCP_SPOT[0], .15, MCP_SPOT[1]); crate.castShadow = crate.receiveShadow = true; rueda.add(crate);
  const extras = EXTRAS.map(([x, z, seed]) => {
    const entry = makeEntry(normalizeAvatar(randomAvatar(rng(seed))));
    Object.assign(entry, { x, z, tx: x, tz: z, yaw: facing(x, z), tyaw: facing(x, z), seed }); return entry;
  });
  const myRing = new THREE.Mesh(new THREE.TorusGeometry(.62, .05, 8, 40), new THREE.MeshStandardMaterial({ color: '#ffc83d', emissive: '#ffb000', emissiveIntensity: .9 }));
  myRing.rotation.x = Math.PI / 2; myRing.position.y = .04; myRing.visible = false; rueda.add(myRing);

  function setPlace(id) {
    if (id === placeId) return;
    placeId = id; world?.dispose(); world = buildPlace(id); scene.add(world.group);
    const L = LIGHTS[id] || LIGHTS.playa;
    scene.background = new THREE.Color(L.background); scene.fog = new THREE.Fog(L.background, ...L.fog);
    hemi.color.set(L.hemi[0]); hemi.groundColor.set(L.hemi[1]); hemi.intensity = L.hemi[2];
    key.color.set(L.key[0]); key.intensity = L.key[1]; key.position.set(...L.keyAt);
    sky.setPalette(L.sky); renderer.toneMappingExposure = L.exposure;
  }
  setPlace('playa');

  // Where each pana stands for their role: [x, z, yaw].
  function spots(state) {
    const out = new Map(), golpe = state.options?.mode === 'golpe', slots = SLOTS[Math.max(1, state.slots?.length || 2)] || SLOTS[2];
    const crowd = [];
    const drummers = state.players.filter(p => p.role === 'drum');
    if (golpe) {
      drummers.forEach((p, i) => {
        const n = drummers.length, phi = n > 1 ? (-118 + 236 * i / (n - 1)) * Math.PI / 180 : 0;
        const x = Math.sin(phi) * 4.5, z = -Math.cos(phi) * 4.5, yaw = facing(x, z);
        out.set(p.id, [x - Math.sin(yaw) * .75, z - Math.cos(yaw) * .75, yaw, { x, z, yaw }]);
      });
    } else {
      const seen = {};
      for (const p of drummers) {
        const [sx, sz] = STATION_SPOT[p.station] || STATION_SPOT.palo, yaw = yawIn([sx, sz]), k = seen[p.station] = (seen[p.station] ?? -1) + 1;
        const side = k ? (k % 2 ? 1 : -1) * Math.ceil(k / 2) * 1 : 0;
        out.set(p.id, [sx - Math.sin(yaw) * .8 + Math.cos(yaw) * side, sz - Math.cos(yaw) * .8 - Math.sin(yaw) * side, yaw]);
      }
    }
    for (const p of state.players) {
      if (p.role === 'dancer' && p.slot != null) {
        const [x, z] = slots[p.slot] || slots[0], partner = slots.length > 1 ? slots[1 - p.slot] : null;
        out.set(p.id, [x, z, partner ? facing(x, z, partner[0], partner[1]) + Math.sign(x) * .5 : 0]);
      }
    }
    const order = [...(state.line || []), ...state.players.filter(p => !out.has(p.id) && !(state.line || []).includes(p.id)).map(p => p.id)];
    for (const e of state.entering || []) { const i = order.indexOf(e.id); if (i >= 0) order.splice(i, 1); order.unshift(e.id); }
    order.forEach((id, i) => { if (!out.has(id)) { const [x, z] = CROWD[i % CROWD.length]; crowd.push(id); out.set(id, [x, z, facing(x, z)]); } });
    return out;
  }

  function update(state, myId) {
    current = state; me = myId;
    setPlace(state.options?.place || 'playa');
    const live = new Set(), where = spots(state);
    state.players.forEach((p, i) => {
      live.add(p.id);
      const look = lookFor(p, i), keyText = JSON.stringify(look) + p.name;
      let entry = panas.get(p.id);
      if (entry?.key !== keyText) {
        const old = entry;
        entry = makeEntry(look, p.id === myId ? `${p.name} · tú` : p.name, p.bot ? '#9aa3b5' : p.id === myId ? '#ffc83d' : '#ff5a3d');
        entry.key = keyText;
        entry.dichoN = p.dicho?.n ?? null;
        if (old) { Object.assign(entry, { x: old.x, z: old.z, yaw: old.yaw }); dropEntry(old); }
        else { const s = where.get(p.id) || [0, 6]; entry.x = s[0]; entry.z = s[1] + 1.5; }
        panas.set(p.id, entry);
      }
      const spot = where.get(p.id) || [0, 6, 0];
      Object.assign(entry, { tx: spot[0], tz: spot[1], tyaw: spot[2], p });
      // Props that come with the role.
      const dancing = p.role === 'dancer', palo = p.role === 'drum' && p.station === 'palo' && state.options?.mode !== 'golpe';
      const shell = p.role === 'drum' && p.station === 'caracol' && state.options?.mode !== 'golpe';
      if (dancing && !entry.panuelo) { entry.panuelo = createPanuelo(); entry.panuelo.position.copy(HAND); entry.character.arms[1].add(entry.panuelo); }
      if (entry.panuelo) entry.panuelo.visible = dancing;
      if (palo && !entry.sticks) {
        entry.sticks = entry.character.arms.map(arm => { const s = new THREE.Mesh(new THREE.CylinderGeometry(.02, .025, .55, 6), new THREE.MeshStandardMaterial({ color: '#d9b98c' })); s.position.copy(HAND); s.rotation.x = Math.PI / 2; arm.add(s); return s; });
      }
      entry.sticks?.forEach(s => { s.visible = palo; });
      if (shell && !entry.shell) { entry.shell = createCaracol(); entry.shell.position.copy(HAND); entry.shell.rotation.set(0, Math.PI / 2, Math.PI / 2); entry.character.arms[1].add(entry.shell); }
      if (entry.shell) entry.shell.visible = shell;
      if (p.sweaty && !entry.cloud) { entry.cloud = createViolinCloud(); entry.cloud.position.y = 2.55; entry.character.group.add(entry.cloud); }
      if (entry.cloud) entry.cloud.visible = !!p.sweaty;
      if (p.dicho && p.dicho.n !== entry.dichoN) { entry.bubble.say(DICHOS[p.dicho.i], 2.2); entry.dichoN = p.dicho.n; }
    });
    for (const [id, entry] of panas) if (!live.has(id)) { dropEntry(entry); panas.delete(id); }
    restingShell.visible = !state.players.some(p => p.role === 'drum' && p.station === 'caracol') || state.options?.mode === 'golpe';
    // ¡Golpe!: a culo e' puya set in front of every pana in the game.
    const golpe = state.options?.mode === 'golpe' && state.phase !== 'lobby';
    for (const id of STATIONS) instruments[id].visible = !golpe;
    mcpDrums.visible = golpe;
    const needed = golpe ? [...where.values()].filter(s => s[3]).map(s => s[3]) : [];
    while (golpeDrums.length < needed.length) { const set = createCuloEPuyaSet(); rueda.add(set); golpeDrums.push(set); }
    golpeDrums.forEach((set, i) => { set.visible = i < needed.length; if (needed[i]) { set.position.set(needed[i].x, 0, needed[i].z); set.rotation.y = needed[i].yaw; } });
  }

  // Something happened: the MCP reacts and the panas involved too.
  function event(e) {
    const who = panas.get(e.id);
    if (e.kind === 'kick') { mcp.bubble.say('¡Sal de la rueda!', 2); mcp.point = { id: e.id, until: time + 1.6 }; if (who) { who.dizzy = 1.6; who.hop = 1; } shake = .35; }
    if (e.kind === 'enter' || e.kind === 'relevo') {
      mcp.bubble.say(e.text.replace(/!.*$/, '!'), 1.8);
      if (who) who.hop = 1;
      const crowd = [...panas.values()].filter(x => x.p?.role === 'crowd' && x !== who);
      crowd.slice(0, 2).forEach((x, i) => setTimeout(() => x.bubble.say('¡Palo!', 1.3), 180 * i));
    }
    if (e.kind === 'mcp') mcp.bubble.say(e.text, 1.4);
    if (e.kind === 'miss' && who) { who.dizzy = .9; if (Math.random() < .5) mcp.bubble.say(e.text, 1.6); }
    if (e.kind === 'duelo') mcp.bubble.say('¡Duelo!', 1.6);
    if (e.kind === 'golpe') mcp.bubble.say('¡Escucha!', 1.5);
    if (e.kind === 'song') mcp.bubble.say('¡Golpe!', 1.5);
    if (e.kind === 'final' && who) who.hop = 1;
  }
  // A call was announced: the MCP shouts it and points at the dancer.
  function announce(call) { mcp.bubble.say(MOVES[call.move].name, 1.4); mcp.point = { id: call.to, until: time + .8 }; }
  // My own hits and claps, the instant they happen.
  function mine(kind, lane = 0) {
    const entry = panas.get(me);
    if (!entry) return;
    if (kind === 'drum' || kind === 'tap') entry.hits[lane ? 1 : 0] = beat;
    if (kind === 'clap') entry.clapAt = beat;
    if (kind === 'hold') entry.holding = true;
    if (kind === 'release') entry.holding = false;
    if (kind === 'miss') entry.dizzy = .8;
  }

  // ---------- animation ----------
  const pulse = (since, k = 7) => since < 0 ? 0 : Math.exp(-since * k);
  function lastNote(notes, b, lane = null) {
    let best = null;
    for (const n of notes) { if (n.beat > b) break; if (lane == null || n.lane === lane) best = n; }
    return best;
  }
  function holdingNote(notes, b) { return notes.some(n => n.len > 0 && b >= n.beat && b <= n.beat + n.len); }

  function animate(entry, dt, isMe) {
    const { character, p } = entry, pose = entry.pose, b = beat, sw = Math.sin(b * Math.PI);
    const dx = entry.tx - entry.x, dz = entry.tz - entry.z, far = Math.hypot(dx, dz), moving = far > .08;
    if (moving) { const step = Math.min(far, real * (far > 2 ? 4.2 : 2.6)); entry.x += dx / far * step; entry.z += dz / far * step; }
    const want = moving && far > .3 ? Math.atan2(dx, dz) : entry.tyaw;
    entry.yaw += wrap(want - entry.yaw) * damp(9, dt);
    entry.hop = Math.max(0, entry.hop - dt * 1.6); entry.dizzy = Math.max(0, entry.dizzy - dt);
    const target = { lx: -.04, lz: .4, rx: -.04, rz: -.4 };
    let bodyY = 0, bodyZ = 0, bodyX = 0, offX = 0, spin = 0, lean = 0, legs = 0;
    const role = p?.role ?? (entry === mcp ? 'mcp' : 'crowd'), song = current?.song ? songFor(current.song.track) : null;
    const playing = current?.phase === 'song' && b >= 0;
    if (entry === mcp) {
      bodyY = .05 * Math.abs(sw); bodyZ = .1 * sw;
      Object.assign(target, { rx: -1.7 + .25 * Math.sin(b * Math.PI * 4), rz: -.25, lx: -.2, lz: .5 + .2 * Math.abs(sw) });
      const hit = mcpPattern();
      if (hit != null) { const pp = pulse(b - hit, 6); Object.assign(target, { lx: -.9 - .6 * (1 - pp), rx: -.9 - .6 * (1 - pp), lz: .3, rz: -.3 }); }
      if (entry.point && time < entry.point.until) {
        const t = panas.get(entry.point.id);
        if (t) entry.yaw += wrap(facing(entry.x, entry.z, t.x, t.z) - entry.yaw) * damp(10, dt);
        Object.assign(target, { lx: -1.55, lz: .15 });
      }
    } else if (role === 'dancer' && !moving) {
      // The groove, then whatever the MCP called.
      bodyY = .06 * Math.abs(sw); bodyZ = .14 * sw; legs = .25;
      Object.assign(target, { lx: -.35, lz: .95 + .25 * sw, rx: -.35, rz: -.95 + .25 * sw });
      const call = (current?.calls || []).filter(c => c.to === p.id && b >= c.beat - .3 && b <= c.beat + Math.max(1, c.len) + .4).at(-1);
      const missed = call && (call.res === 'miss' || (isMe && entry.missed?.has(call.id)));
      if (call && !missed) {
        const u = Math.max(0, Math.min(1, (b - call.beat) / Math.max(1, call.len))), bell = Math.sin(u * Math.PI);
        if (call.move === 'cadera') { bodyZ = .38 * Math.sin(u * Math.PI * 2); offX = .16 * Math.sin(u * Math.PI * 2); Object.assign(target, { lx: .35, lz: .35, rx: .35, rz: -.35 }); }
        if (call.move === 'vuelta') { spin = (call.dir === 'left' ? 1 : -1) * Math.PI * 2 * smooth(Math.min(1, (b - call.beat + .3) / 1.1)); Object.assign(target, { lz: 1.45, rz: -1.45 }); }
        if (call.move === 'panuelo') Object.assign(target, { rx: -.25, rz: -2.45 + .3 * Math.sin(time * 9), lx: .3, lz: .35 });
        if (call.move === 'pegate') { lean = .55 * bell; Object.assign(target, { lx: -1.2, rx: -1.2, lz: .3, rz: -.3 }); }
        if (call.move === 'abajo') { bodyY = -.22 * bell - .02; bodyX = .35 * bell; Object.assign(target, { lx: -1.15, rx: -1.15, lz: .6, rz: -.6 }); }
        if (call.move === 'golpe') { bodyY = b >= call.beat ? .05 * pulse(b - call.beat, 5) : 0; bodyZ = 0; legs = 0; Object.assign(target, { lx: -.2, lz: 2.35, rx: -.2, rz: -2.35 }); }
      }
      if (missed || entry.dizzy > 0) { bodyZ = .28 * Math.sin(time * 13); }
    } else if (role === 'drum' && !moving) {
      bodyY = .02 * Math.abs(sw);
      const golpe = current?.options?.mode === 'golpe', st = golpe ? 'mano' : p.station;
      const notes = song && !golpe ? chart(song, st) : [];
      // My pana follows my real hits; everyone else plays their chart.
      const hitL = isMe ? entry.hits[0] : golpeHit(p, 0) ?? (lastNote(notes, b, st === 'mano' ? 0 : null)?.beat ?? -9);
      const hitR = isMe ? entry.hits[1] : golpeHit(p, 1) ?? (st === 'mano' ? lastNote(notes, b, 1)?.beat ?? -9 : hitL);
      const pl = playing || isMe ? pulse(b - hitL, 6) : 0, pr = playing || isMe ? pulse(b - hitR, 6) : 0;
      if (st === 'mano' || st === 'palo') Object.assign(target, { lx: -.85 - .65 * (1 - pl), lz: .28, rx: -.85 - .65 * (1 - pr), rz: -.28 });
      if (st === 'charrasca') {
        const held = isMe ? entry.holding : playing && holdingNote(notes, b);
        Object.assign(target, { lx: -1.15, lz: .35, rx: -1 + (held ? .3 * Math.sin(time * 38) : 0), rz: -.15 });
      }
      if (st === 'caracol') {
        const held = isMe ? entry.holding : playing && holdingNote(notes, b);
        Object.assign(target, held ? { rx: -2.55, rz: .35, lx: -2.3, lz: -.15 } : { rx: -1.15, rz: -.1, lx: -.9, lz: .3 });
        bodyX = held ? -.12 : 0;
      }
    } else if (!moving) {
      // La gente: claps on the beat, louder when the Bulla is up.
      bodyY = .04 * Math.abs(sw);
      const hash = ((p?.id ?? entry.seed ?? 1) * 7 + Math.floor(b)) % 5, bulla = current?.bulla ?? 0;
      const clap = isMe ? entry.clapAt : playing && hash < 1 + bulla * 4 ? Math.floor(b) : -9;
      const pc = pulse(b - clap, 9);
      Object.assign(target, { lx: -1.25, rx: -1.25, lz: .08 + .38 * (1 - pc), rz: -.08 - .38 * (1 - pc) });
      if (current?.phase === 'finished' && current.winner === p?.id) Object.assign(target, { lx: -.2, lz: 2.4, rx: -.2, rz: -2.4 });
    }
    if (entry.hop > 0) bodyY += Math.sin((1 - entry.hop) * Math.PI) * .45;
    const k = damp(18, dt);
    for (const key of ['lx', 'lz', 'rx', 'rz']) pose[key] += (target[key] - pose[key]) * k;
    if (!moving) {
      character.arms[0].rotation.x = pose.lx; character.arms[0].rotation.z = pose.lz;
      character.arms[1].rotation.x = pose.rx; character.arms[1].rotation.z = pose.rz;
    }
    character.update(dt, moving ? { walk: 1, run: far > 2 } : { open: entry.bubble.t > 0 || role === 'mcp' && Math.abs(sw) > .8, dizzy: entry.dizzy > 0 });
    if (!moving) {
      character.body.position.y += bodyY; character.body.rotation.z = bodyZ; character.body.rotation.x = bodyX; character.body.position.x = offX;
      character.legs.forEach((leg, i) => { leg.rotation.x = legs * Math.sin(b * Math.PI + i * Math.PI); });
    }
    const forward = lean ? [Math.sin(entry.yaw) * lean, Math.cos(entry.yaw) * lean] : [0, 0];
    character.group.position.set(entry.x + forward[0], 0, entry.z + forward[1]);
    character.group.rotation.y = entry.yaw + spin;
    entry.bubble.update(dt);
    entry.panuelo?.userData.update(time);
    entry.cloud?.userData.update(time);
  }
  const smooth = (t) => t * t * (3 - 2 * t);
  // ¡Golpe!: bots in the rueda answer the MCP's pattern on their drums.
  function golpeHit(p, lane) {
    const g = current?.golpe;
    if (current?.options?.mode !== 'golpe' || !g?.notes || !g.alive.includes(p.id)) return null;
    const from = g.start + g.len, best = g.notes.filter(([off, l]) => l === lane && from + off <= beat).at(-1);
    return best && beat < from + g.len + 1 ? from + best[0] : -9;
  }
  // ¡Golpe!: the MCP plays the pattern first, on his own drum.
  function mcpPattern() {
    const g = current?.golpe;
    if (current?.options?.mode !== 'golpe' || !g?.notes || beat >= g.start + g.len + .5) return null;
    const hit = g.notes.filter(([off]) => g.start + off <= beat).at(-1);
    return hit ? g.start + hit[0] : null;
  }

  const bounds = new THREE.Box3(new THREE.Vector3(-6.6, 0, -6), new THREE.Vector3(6.6, 2.6, 3.6));
  const target = new THREE.Vector3(), dir = new THREE.Vector3(), right = new THREE.Vector3(), up = new THREE.Vector3(), point = new THREE.Vector3();
  function resize() {
    const rect = canvas.getBoundingClientRect(), w = Math.max(1, rect.width), h = Math.max(1, rect.height);
    if (canvas.width !== Math.round(w * renderer.getPixelRatio()) || canvas.height !== Math.round(h * renderer.getPixelRatio())) renderer.setSize(w, h, false);
    return { w, h };
  }
  // Fit the rueda into the space the HUD leaves free (same math as table-world).
  function frameCamera() {
    const { w, h } = resize(), area = { x: 12, y: 150, width: Math.max(160, w - 12 - safe.right), height: Math.max(140, h - 150 - safe.bottom) };
    target.copy(bounds.getCenter(point)); dir.set(0, .8, 1).normalize();
    right.crossVectors(new THREE.Vector3(0, 1, 0), dir).normalize(); up.crossVectors(dir, right);
    const tan = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));
    let distance = 1;
    for (const x of [bounds.min.x, bounds.max.x]) for (const y of [bounds.min.y, bounds.max.y]) for (const z of [bounds.min.z, bounds.max.z]) {
      point.set(x, y, z).sub(target);
      distance = Math.max(distance, point.dot(dir) + Math.max(Math.abs(point.dot(right)) / (tan * area.width / h), Math.abs(point.dot(up)) / (tan * area.height / h)));
    }
    camera.aspect = w / h; camera.position.copy(target).addScaledVector(dir, distance * 1.02);
    if (shake > 0) camera.position.x += Math.sin(time * 60) * shake * .25;
    camera.lookAt(target);
    camera.setViewOffset(w, h, w / 2 - area.x - area.width / 2, h / 2 - area.y - area.height / 2, w, h);
    camera.updateProjectionMatrix(); camera.updateMatrixWorld();
  }

  function frame(dt, songBeat) {
    // Walking uses real time: a slow frame rate must not leave panas behind.
    const now = performance.now(); real = Math.min(.5, (now - wall) / 1000); wall = now;
    time += dt; shake = Math.max(0, shake - dt);
    // Between songs the rueda keeps a gentle 100 bpm groove.
    beat = songBeat ?? time * 100 / 60;
    frameCamera();
    for (const entry of panas.values()) animate(entry, dt, entry.p?.id === me);
    animate(mcp, dt, false);
    for (const entry of extras) animate(entry, dt, false);
    const mine = panas.get(me);
    myRing.visible = !!mine;
    if (mine) { myRing.position.x = mine.x; myRing.position.z = mine.z; myRing.scale.setScalar(1 + .08 * Math.abs(Math.sin(beat * Math.PI))); }
    world?.tick(time); tickWind(time); sky.update(time, LIGHTS[placeId]?.daylight ?? 1);
    renderer.render(scene, camera);
  }

  function markMiss(id) { const entry = panas.get(me); if (entry) (entry.missed ??= new Set()).add(id); }
  function setSafe(next) { safe = { ...safe, ...next }; }
  function dispose() {
    unbind(); panas.forEach(dropEntry); dropEntry(mcp); extras.forEach(dropEntry); world?.dispose(); sky.dispose();
    disposeModel(rueda); renderer.dispose();
  }
  return { renderer, scene, camera, update, frame, event, announce, mine, markMiss, setSafe, dispose, RING };
}
