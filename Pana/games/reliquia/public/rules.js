import { DEFAULT_OPTIONS, validOptions } from './options.js';
import { CAMP, GATE, WINCHES, ALTAR, SUPPLIES, SPAWNS, distance, lineClear, moveBody, walkable, findPath } from './layout.js';
import { createDirector, updateDirector, random } from './director.js';
import { clamp } from '../../../engine/random.js';
const clone = value => JSON.parse(JSON.stringify(value));
export const alive = p => !p.downed && !p.spectator;
// One explorer's movement for dt: the host's simulation, and a guest's
// prediction of its own explorer (engine/predict.js). It writes only p; the
// world decides the gate, the shortcut and who carries the relic.
export function stepExplorer(p, input, dt, world) {
  const ix = Number.isFinite(input.x) ? clamp(input.x, -1, 1) : 0, iz = Number.isFinite(input.z) ? clamp(input.z, -1, 1) : 0;
  const length = Math.hypot(ix, iz), ux = length > 0 ? ix / Math.max(1, length) : 0, uz = length > 0 ? iz / Math.max(1, length) : 0;
  p.moving = length > 0.1;
  if (p.moving) p.h = Math.atan2(ux, uz);
  const speed = p.dodge > 0 ? 13 : world.carrier === p.id ? 4.6 : input.sprint ? 7.2 : 5.8;
  moveBody(p, p.dodge > 0 ? Math.sin(p.h) * speed * dt : ux * speed * dt, p.dodge > 0 ? Math.cos(p.h) * speed * dt : uz * speed * dt, world);
  p.dodge = Math.max(0, p.dodge - dt);
}
export function objective(s) {
  if (s.relicTaken) return 'Regresen juntos al campamento con la reliquia';
  if (!s.gateOpen) return 'Activen las dos ruedas para abrir el templo';
  if (!s.guardianDefeated) return 'Encuentren y derroten al guardián de la reliquia';
  return 'Recojan la reliquia en el altar';
}
export function interaction(s, p) {
  if (!p || !alive(p)) return null;
  const fallen = s.players.find(q => q.id !== p.id && q.downed && !q.spectator && distance(p, q) < 2.6 && lineClear(p, q, s));
  if (fallen && s.options?.revive !== false) return { kind: 'revive', id: fallen.id, text: `Mantén para levantar a ${fallen.name}`, progress: fallen.revive / 2.4 };
  if (!s.gateOpen) {
    const w = WINCHES.find(w => distance(p, w) < 2.8);
    if (w) return { kind: 'winch', id: w.id, text: s.winches[w.id].latched > 0 ? 'Rueda activa · busca la otra' : 'Mantén para girar la rueda', progress: s.winches[w.id].progress / 1.6 };
  }
  const supply = SUPPLIES.find(q => !s.supplies.includes(q.id) && distance(p, q) < 2.4);
  if (supply) return { kind: 'supply', id: supply.id, text: 'Recoger botiquines para el grupo', progress: 0 };
  if (s.guardianDefeated && s.carrier == null && distance(p, s.relic) < 2.8) return { kind: 'relic', text: 'Recoger la reliquia', progress: 0 };
  if (s.relicTaken && distance(p, CAMP) < 5) return { kind: 'escape', text: s.options?.revive !== false && s.players.some(q => q.downed && !q.spectator) ? 'Levanten a todos los panas antes de salir' : 'Reúne al equipo y mantén para salir', progress: s.extraction / 3 };
  if (s.carrier === p.id) return { kind: 'drop', text: 'Dejar la reliquia para un pana', progress: 0 };
  return null;
}

export class Expedition {
  constructor(seed = 1, options = {}) {
    this.options = { ...DEFAULT_OPTIONS, ...(validOptions(options) ? options : {}) };
    Object.assign(this, { phase: 'lobby', outcome: '', time: 0, seed: seed >>> 0 || 1, rng: seed >>> 0 || 1, players: [], enemies: [],
      director: createDirector(), gateOpen: false, relicTaken: false, guardianDefeated: false, carrier: null,
      relic: { ...ALTAR }, winches: { west: { progress: 0, latched: 0 }, east: { progress: 0, latched: 0 } },
      supplies: [], triggered: [], kills: 0, extraction: 0, wipe: 0, enemyId: 0, eventId: 0, events: [], ledger: {} });
    this.paths = new Map();
  }
  configure(options) { if (this.phase === 'playing' || !validOptions(options)) return false; Object.assign(this.options, options); return true; }
  get traps() { return trapPositions(this.options); }
  addPlayer(id, name, avatar = {}) {
    let p = this.players.find(p => p.id === id); if (p) { p.avatar = avatar; return p; }
    const point = this.phase === 'playing' && this.gateOpen && !this.relicTaken ? { x: 40, z: -54 } : CAMP;
    const index = this.players.length;
    p = { id, name: String(name).slice(0, 16), avatar, x: point.x + (index % 4 - 1.5) * 1.5, z: point.z + Math.floor(index / 4) * 1.5,
      h: Math.PI, hp: 100, downed: false, spectator: false, revive: 0, heals: 2, cooldown: 0, dodge: 0, dodgeCooldown: 0,
      invulnerable: 0, intensity: 0, moving: false, attack: 0, kills: 0, revives: 0, hit: 0, interactCooldown: 0 };
    if (this.phase === 'results') p.spectator = true;
    this.players.push(p); return p;
  }
  removePlayer(id) {
    if (this.carrier === id) this.drop(this.players.find(p => p.id === id));
    this.players = this.players.filter(p => p.id !== id); delete this.ledger[id];
  }
  event(kind, text, extra = {}) { this.events.push({ id: ++this.eventId, kind, text, ...extra }); this.events = this.events.slice(-12); }
  start(seed = this.seed) {
    const roster = this.players.map(p => ({ id: p.id, name: p.name, avatar: p.avatar }));
    const ledger = this.ledger, eventId = this.eventId;
    Object.assign(this, new Expedition(seed, this.options)); this.ledger = ledger; this.eventId = eventId;
    roster.forEach(p => this.addPlayer(p.id, p.name, p.avatar)); this.phase = 'playing';
    this.event('start', this.options.revive ? 'Encuentren las dos ruedas. Nadie se queda atrás.' : 'Encuentren las dos ruedas. Esta expedición no permite revivir.');
  }
  accept(id, seq, action) {
    if (!Number.isSafeInteger(seq) || seq <= (this.ledger[id] || 0) || !this.players.some(p => p.id === id)) return false;
    this.ledger[id] = seq; return this.action(id, action);
  }
  action(id, action) {
    const p = this.players.find(p => p.id === id);
    if (this.phase !== 'playing' || !p || !alive(p)) return false;
    if (action === 'attack' && p.cooldown <= 0) {
      p.cooldown = 0.55; p.attack = 0.3;
      const candidates = this.enemies.filter(e => e.hp > 0 && distance(p, e) < 3.1 && lineClear(p, e, this));
      // Assisted facing makes melee usable on touch; hits remain host validated.
      candidates.sort((a, b) => distance(p, a) - distance(p, b));
      if (candidates[0]) p.h = Math.atan2(candidates[0].x - p.x, candidates[0].z - p.z);
      let hits = 0;
      for (const e of candidates) {
        const angle = Math.atan2(e.x - p.x, e.z - p.z) - p.h;
        if (Math.cos(angle) < 0.15 || hits >= 3) continue;
        hits++; e.hp -= 30; e.hit = 0.18;
        if (e.kind !== 'guardian') { e.stun = 0.28; moveBody(e, Math.sin(p.h) * 0.5, Math.cos(p.h) * 0.5, this, 0.55); }
        if (e.hp <= 0) {
          this.kills++; p.kills++; this.paths.delete(e.id);
          for (const q of this.players) if (distance(q, e) < 7) q.intensity = clamp(q.intensity + 0.13, 0, 1);
          if (e.kind === 'guardian') { this.guardianDefeated = true; this.event('guardian', 'El guardián cayó. ¡La reliquia es suya!'); }
        }
      }
      this.event(hits ? 'hit' : 'swing', '', { player: id }); return true;
    }
    if (action === 'dodge' && p.dodgeCooldown <= 0) { p.dodge = 0.24; p.invulnerable = 0.4; p.dodgeCooldown = 2; return true; }
    if (action === 'heal' && p.heals > 0 && p.hp < 100) { p.heals--; p.hp = Math.min(100, p.hp + 45); this.event('heal', `${p.name} usó un botiquín.`); return true; }
    if (action === 'interact' && p.interactCooldown <= 0) {
      const target = interaction(this, p); if (!target) return false; p.interactCooldown = 0.5;
      if (target.kind === 'supply') { this.supplies.push(target.id); this.players.forEach(q => { q.heals = Math.min(3, q.heals + 1); }); this.event('supply', 'Un botiquín más para cada pana.'); }
      if (target.kind === 'relic') { this.carrier = id; this.relicTaken = true; this.event('relic', `${p.name} lleva la reliquia. ¡Vuelvan al campamento!`); this.director.phase = 'rest'; this.director.time = 0; this.director.duration = 8; }
      if (target.kind === 'drop') this.drop(p);
      return true;
    }
    return false;
  }
  drop(p) { if (!p) return; this.carrier = null; this.relic = { x: p.x, z: p.z }; this.event('drop', 'La reliquia está en el suelo. Recójanla.'); }
  damage(p, amount) {
    if (!alive(p) || p.invulnerable > 0) return;
    amount *= { easy: .65, normal: 1, hard: 1.5 }[this.options.difficulty];
    p.hp = Math.max(0, p.hp - amount); p.hit = 0.35; p.intensity = clamp(p.intensity + amount / 70, 0, 1); p.revive = 0;
    if (!p.hp) { p.downed = true; p.intensity = 1; if (this.carrier === p.id) this.drop(p); this.event('down', this.options.revive ? `${p.name} necesita una mano. Mantén E a su lado.` : `${p.name} cayó. Los demás pueden completar la expedición.`); }
  }
  spawn(x, z, kind = 'mummy') {
    if (kind === 'mummy' && this.enemies.filter(e => e.kind === 'mummy' && e.hp > 0).length >= this.options.mummies) return null;
    if (!walkable(x, z, this, 0.6) || this.enemies.filter(e => e.hp > 0).length >= 14) return null;
    const hp = (kind === 'guardian' ? 240 + Math.max(0, this.players.length - 1) * 70 : 60) * ({ easy: .75, normal: 1, hard: 1.35 }[this.options.difficulty]);
    const e = { id: ++this.enemyId, x, z, kind, hp, maxHp: hp, h: 0, cooldown: 0.8, windup: 0, stun: 0, hit: 0, awake: kind !== 'guardian', born: this.time, attackX: x, attackZ: z };
    this.enemies.push(e); return e;
  }
  wave(count) {
    const live = this.players.filter(alive); if (!live.some(p => p.z < -5)) return false;
    const spots = SPAWNS.filter(s => walkable(s.x, s.z, this, 0.6) && live.some(p => distance(p, s) < 29) && live.every(p => distance(p, s) > 10 && !lineClear(p, s, this, 0.05)));
    if (!spots.length) return false;
    const spot = spots[Math.floor(random(this) * spots.length)]; let spawned = 0;
    for (let i = 0; i < count; i++) {
      const point = { x: spot.x + (i % 2) * 1.2, z: spot.z + Math.floor(i / 2) * 1.2 };
      // Check every offset, not only the group's anchor: a doorway can expose
      // one member of a wave or put it on the other side of a locked gate.
      if (!live.every(p => distance(p, point) > 10 && !lineClear(p, point, this, 0.05))) continue;
      if (!live.some(p => findPath(point, p, this).length)) continue;
      if (this.spawn(point.x, point.z)) spawned++;
    }
    if (spawned) this.event('wave', 'Se oyen pasos entre las piedras…'); return !!spawned;
  }
  update(dt, inputs = new Map()) {
    if (this.phase !== 'playing') return; dt = clamp(Number.isFinite(dt) ? dt : 0, 0, 0.05); this.time += dt;
    const active = this.players.filter(alive), usedWinches = new Set(), reviving = new Set();
    let extracting = false;
    for (const p of this.players) {
      for (const key of ['cooldown', 'attack', 'dodgeCooldown', 'invulnerable', 'hit', 'interactCooldown']) p[key] = Math.max(0, p[key] - dt);
      p.moving = false; if (!alive(p)) continue;
      const trap = this.traps.find(trap => distance(p, trap) < 1.1 && trapActive(this.time, trap));
      if (trap && (p.trapCooldown || 0) <= this.time) { this.damage(p, 18); p.trapCooldown = this.time + 1.2; this.event('trap', '¡Cuidado con las losas rojas!'); }
      const input = inputs.get(p.id) || {};
      stepExplorer(p, input, dt, this);
      if (input.hold) {
        const target = interaction(this, p);
        if (target?.kind === 'winch' && !usedWinches.has(target.id)) {
          const w = this.winches[target.id]; usedWinches.add(target.id); w.progress = Math.min(1.6, w.progress + dt);
          if (w.progress >= 1.6) w.latched = 12;
        }
        if (target?.kind === 'revive' && !reviving.has(target.id)) {
          const q = this.players.find(q => q.id === target.id); reviving.add(q.id); q.revive += dt;
          if (q.revive >= 2.4) { q.hp = 55; q.downed = false; q.revive = 0; q.invulnerable = 2; q.intensity = 0.5; p.revives++; this.event('revive', `${p.name} levantó a ${q.name}.`); }
        }
        if (target?.kind === 'escape' && this.carrier != null && this.players.filter(q => !q.spectator && (this.options.revive || !q.downed)).every(q => !q.downed && distance(q, CAMP) < 7) && distance(this.players.find(q => q.id === this.carrier), CAMP) < 5) extracting = true;
      }
      const engaged = this.enemies.some(e => e.hp > 0 && e.awake && distance(p, e) < 7);
      if (!engaged) p.intensity = Math.max(0, p.intensity - dt * 0.075);
    }
    for (const [id, w] of Object.entries(this.winches)) { w.latched = Math.max(0, w.latched - dt); if (!usedWinches.has(id) && w.latched <= 0) w.progress = Math.max(0, w.progress - dt * 0.5); }
    if (!this.gateOpen && Object.values(this.winches).every(w => w.latched > 0)) {
      this.gateOpen = true; this.event('gate', '¡Las dos ruedas! El templo está abierto.'); this.players.filter(alive).forEach(p => { p.hp = Math.max(p.hp, 70); });
    }
    for (const p of this.players) if (p.downed && !reviving.has(p.id)) p.revive = Math.max(0, p.revive - dt);
    // Authored awakenings are visible, telegraphed encounters, unlike ambient spawns.
    for (const trigger of [
      { id: 'mine', test: p => p.z < -9, points: [[-3, -20], [3, -20]] },
      { id: 'gallery', test: p => p.z < -25, points: [[-8, -40], [8, -39]] },
      { id: 'crypt', test: p => p.z < -55, points: [[34, -70], [46, -70], [40, -76]] },
    ]) if (!this.triggered.includes(trigger.id) && active.some(trigger.test)) { this.triggered.push(trigger.id); trigger.points.forEach(([x, z]) => this.spawn(x, z)); this.event('awaken', 'Las vendas se mueven. Prepárense.'); }
    if (this.gateOpen && !this.triggered.includes('guardian') && active.some(p => p.z < -90)) { this.triggered.push('guardian'); this.spawn(40, -104, 'guardian'); this.event('boss', 'El guardián del sol ha despertado.'); }
    for (const e of this.enemies) {
      if (e.hp <= 0) continue;
      e.hit = Math.max(0, e.hit - dt); e.stun = Math.max(0, e.stun - dt); e.cooldown -= dt;
      const targets = active.filter(p => distance(p, e) < (e.kind === 'guardian' ? 28 : 38)).sort((a, b) => distance(a, e) - distance(b, e));
      const target = targets[0]; if (!target || this.time - e.born < 1 || e.stun > 0) continue;
      if (e.kind === 'guardian' && distance(target, e) < 20) e.awake = true;
      if (!e.awake) continue;
      if (e.windup > 0) {
        e.windup -= dt;
        if (e.windup <= 0) {
          for (const p of active) if (distance(p, { x: e.attackX, z: e.attackZ }) < (e.kind === 'guardian' ? 3.8 : 2.2) && lineClear(e, p, this)) this.damage(p, e.kind === 'guardian' ? 28 : 12);
          e.cooldown = e.kind === 'guardian' ? 1.8 : 1.15;
        }
        continue;
      }
      e.h = Math.atan2(target.x - e.x, target.z - e.z);
      if (distance(e, target) < (e.kind === 'guardian' ? 3.5 : 1.7) && lineClear(e, target, this) && e.cooldown <= 0) {
        e.windup = e.kind === 'guardian' ? 1.15 : 0.65; e.attackX = e.x; e.attackZ = e.z; continue;
      }
      let nav = this.paths.get(e.id);
      if (!nav || nav.until < this.time || distance(nav.goal, target) > 3) { nav = { path: findPath(e, target, this), goal: { x: target.x, z: target.z }, until: this.time + 1.1 }; this.paths.set(e.id, nav); }
      while (nav.path.length && distance(e, nav.path[0]) < 0.6) nav.path.shift();
      const goal = nav.path[0];
      if (goal && distance(e, target) > 1.3) {
        const d = distance(e, goal), speed = (e.kind === 'guardian' ? 2.5 : 2.8) * ({ easy: .85, normal: 1, hard: 1.18 }[this.options.difficulty]);
        if (d) moveBody(e, (goal.x - e.x) / d * speed * dt, (goal.z - e.z) / d * speed * dt, this, 0.55);
      }
    }
    this.enemies = this.enemies.filter(e => e.hp > 0);
    if (this.carrier != null) { const p = this.players.find(p => p.id === this.carrier); if (p) this.relic = { x: p.x, z: p.z }; }
    this.extraction = extracting ? this.extraction + dt : Math.max(0, this.extraction - dt);
    if (this.extraction >= 3) { this.phase = 'results'; this.outcome = 'win'; this.event('win', '¡La reliquia llegó a casa!'); }
    this.wipe = this.players.length && !this.players.some(alive) ? this.wipe + dt : 0;
    if (this.wipe >= 3) { this.phase = 'results'; this.outcome = 'loss'; this.event('loss', 'La expedición cayó. La próxima salimos juntos.'); }
    if (this.phase === 'playing') updateDirector(this, dt, count => this.wave(count));
  }
  snapshot() { const { paths, ...state } = this; return clone(state); }
  restore(snapshot, members) {
    Object.assign(this, clone(snapshot)); this.paths = new Map();
    for (const p of [...this.players]) if (!members.has(p.id)) this.removePlayer(p.id);
    for (const p of members.values()) if (!this.players.some(q => q.id === p.id)) this.addPlayer(p.id, p.name, p.avatar || {});
  }
}

// Both simulation and meshes use these pressure-plate coordinates and phases.
export function trapPositions(options = DEFAULT_OPTIONS) {
  const positions = [[0, -15], [-4, -29], [6, -36], [37, -25], [43, -57], [35, -68], [40, -84], [45, -98], [32, -106]];
  const count = { few: 3, normal: 6, many: 9 }[options.traps] || 6;
  return positions.slice(0, count).map(([x, z], id) => ({ id, x: x + (options.temple === 'tepuy' ? 1.5 : 0), z, phase: id * .7 }));
}
export const trapActive = (time, trap) => (time + trap.phase) % 5 >= 3;
