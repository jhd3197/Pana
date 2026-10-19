import { DEFAULT_OPTIONS, validOptions } from './options.js';
import { propDefinition } from '/engine/models/props/plaza-definitions.js';
import { huntLayout, nextLayoutSeed } from './layout.js';
import { validArena, arenaInfo } from '../../../engine/worlds/arena-layouts.js';

export const HIDE_TIMES = Object.freeze([15, 20, 30, 45, 60]);
export const RULES = Object.freeze({ changes: 3, hideSeconds: 30, huntSeconds: 180, rounds: 4, checkRange: 3.5, aimRange: 7, checkCooldown: 1.6 });
const distance = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);
export const playerRadius = p => propDefinition(p.prop)?.radius || 0.5;

export class HuntRound {
  constructor(mapId = 'plaza', { layoutSeed = 1, hideSeconds = RULES.hideSeconds, options = {} } = {}) {
    this.mapId = arenaInfo(mapId).id;
    this.layoutSeed = layoutSeed >>> 0 || 1;
    this.hideSeconds = HIDE_TIMES.includes(hideSeconds) ? hideSeconds : RULES.hideSeconds;
    this.options = { ...DEFAULT_OPTIONS, hideSeconds: this.hideSeconds, ...(validOptions(options) ? options : {}) };
    this.hideSeconds = this.options.hideSeconds;
    this.seekers = []; this.hintAt = 0; this.hint = null;
    this.players = [];
    this.phase = 'lobby';
    this.remaining = 0;
    this.round = 0;
    this.totalRounds = RULES.rounds;
    this.seeker = null;
    this.winner = null;
    this.events = [];
    this.elapsed = 0;
    this.revision = 0;
  }
  get layout() { return huntLayout(this.mapId, this.layoutSeed); }
  configure(options) {
    if (this.phase !== 'lobby' || !validOptions(options)) return false;
    Object.assign(this.options, options); this.hideSeconds = this.options.hideSeconds; return true;
  }
  isSeeker(id) { return this.seekers.includes(id); }

  selectMap(id) {
    if (this.phase !== 'lobby' || !validArena(id)) return false;
    this.mapId = id;
    for (const p of this.players) Object.assign(p, this.layout.safeSpot(p.x, p.z));
    return true;
  }
  addPlayer(id, name, avatar, bot = false) {
    if (this.players.some(p => p.id === id)) return;
    this.players.push({ id, name, avatar, bot, ...this.layout.safeSpot(-4, 13), h: Math.PI,
      prop: null, changes: RULES.changes, caught: false, score: 0,
      spectator: !['lobby', 'results', 'finished'].includes(this.phase), moving: false, suspicion: 0, cooldown: 0 });
  }
  removePlayer(id) {
    const wasSeeker = this.isSeeker(id);
    this.players = this.players.filter(p => p.id !== id);
    this.seekers = this.seekers.filter(seeker => seeker !== id); this.seeker = this.seekers[0] ?? null;
    if (wasSeeker && !this.seekers.length && ['hide', 'hunt'].includes(this.phase)) this.finish('hiders', 'El buscador salió de la sala.');
    else this.checkEnd();
  }
  event(text, found = null) {
    this.events.push({ id: ++this.revision, text, ...(found ? { found } : {}) });
    this.events = this.events.slice(-4);
  }
  start(hostId, preference = 'hide') {
    if (!['lobby', 'results', 'finished'].includes(this.phase)) return false;
    this.layoutSeed = nextLayoutSeed(this.layoutSeed);
    if (this.phase === 'finished') { this.round = 0; for (const p of this.players) p.score = 0; }
    const botScores = new Map(this.players.filter(p => p.bot).map(p => [p.id, p.score]));
    this.players = this.players.filter(p => !p.bot);
    const names = ['Coco', 'Mango', 'Pepita'];
    while (this.players.length < 4) {
      const i = this.players.length;
      this.addPlayer(-i, names[i - 1] || 'Coco', { hat: i % 2 ? 'llanero' : 'gorra', hatColor: '#ffc629', outfitColor: '#2ad1b2' }, true);
      this.players.at(-1).score = botScores.get(-i) || 0;
    }
    if (!this.round) {
      this.firstSeeker = preference === 'seek' ? hostId : this.players.find(p => p.id !== hostId).id;
    }
    this.totalRounds = this.options.rounds;
    const first = Math.max(0, this.players.findIndex(p => p.id === this.firstSeeker));
    this.seeker = this.players[(first + this.round) % this.players.length].id;
    this.seekers = Array.from({ length: this.options.seekers }, (_, i) => this.players[(first + this.round + i) % this.players.length].id);
    this.hint = null; this.hintAt = this.elapsed + 12;
    this.round++;
    this.phase = 'hide'; this.remaining = this.hideSeconds; this.winner = null;
    for (const [i, p] of this.players.entries()) {
      p.prop = null; p.changes = RULES.changes; p.caught = false; p.spectator = false;
      p.suspicion = 0; p.cooldown = 0; p.moving = false; p.h = Math.PI;
      p.path = []; p.navAt = 0; p.target = null;
      Object.assign(p, this.layout.safeSpot(this.isSeeker(p.id) ? 0 : -5 + i * 3, this.isSeeker(p.id) ? -10 : 13));
      if (p.bot && !this.isSeeker(p.id)) {
        const prop = this.layout.props[(i * 9 + this.round * 7) % this.layout.props.length];
        const spot = this.layout.safeSpot(prop.x + 1.9, prop.z + 1.5, propDefinition(prop.type).radius);
        Object.assign(p, spot);
        this.transform(p.id, this.options.disguises === 'barrels' ? 'barrel' : prop.type);
      }
    }
    this.event(`¡A esconderse! El buscador sale en ${this.hideSeconds} segundos.`);
    return true;
  }
  transform(id, type) {
    const p = this.players.find(p => p.id === id), def = propDefinition(type);
    if (!p || this.isSeeker(p.id) || p.caught || p.spectator || !['hide', 'hunt'].includes(this.phase)) return 'Ahora no puedes cambiar.';
    if (type === p.prop) return 'Ya tienes esa forma.';
    if (type === null) { p.prop = null; return null; }
    if (this.options.disguises === 'barrels' && type !== 'barrel') return 'Solo barriles en esta partida.';
    if (!def) return 'Ese objeto no existe.';
    if (p.changes <= 0) return 'No te quedan cambios en esta ronda.';
    if (this.layout.blocked(p.x, p.z, def.radius)) return 'Busca un poco más de espacio para ese objeto.';
    p.prop = type; p.changes--;
    return null;
  }
  // First person: `aim` is the seeker's heading and the check hits whatever
  // sits under the crosshair within 7 m. One hit and the hider is found.
  // Without an aim (old clients, tests) it searches 3.5 m around the seeker.
  check(id, aim) {
    const p = this.players.find(p => p.id === id);
    if (!p || !this.isSeeker(id) || this.phase !== 'hunt' || p.cooldown > 0) return false;
    p.cooldown = RULES.checkCooldown;
    const aimed = Number.isFinite(aim), fx = Math.sin(aim), fz = Math.cos(aim);
    const inReach = t => {
      if (!aimed) return distance(p, t) <= RULES.checkRange;
      const dx = t.x - p.x, dz = t.z - p.z, along = dx * fx + dz * fz;
      return along > 0 && along <= RULES.aimRange + playerRadius(t) && Math.abs(dx * fz - dz * fx) <= playerRadius(t) + .35;
    };
    const target = this.players.filter(t => !t.spectator && !t.caught && !this.isSeeker(t.id) && inReach(t) && this.layout.clearSight(p, t))
      .sort((a, b) => distance(p, a) - distance(p, b))[0];
    if (target) { this.capture(target, id); return true; }
    return false;
  }
  capture(p, seekerId = this.seeker) {
    if (p.caught) return;
    p.caught = true; p.moving = false; p.suspicion = 0;
    const seeker = this.players.find(s => s.id === seekerId);
    if (seeker) seeker.score += 1;
    this.event(`¡Encontraron a ${p.name}!`, { seeker: seekerId, hider: p.id, distance: seeker ? Math.round(distance(seeker, p) * 10) / 10 : 0 });
    this.checkEnd();
  }
  checkEnd() {
    if (['hide', 'hunt'].includes(this.phase) && !this.players.some(p => !p.spectator && !p.caught && !this.isSeeker(p.id))) this.finish('seeker', '¡El buscador encontró a todos!');
  }
  finish(team, message) {
    if (!['hide', 'hunt'].includes(this.phase)) return;
    this.winner = team; this.remaining = 0;
    this.phase = this.round >= this.totalRounds ? 'finished' : 'results';
    for (const p of this.players) {
      p.moving = false;
      if (team === 'hiders' && !this.isSeeker(p.id) && !p.spectator && !p.caught) p.score += 3;
    }
    this.event(message);
  }
  update(dt, inputs = new Map()) {
    this.elapsed += dt;
    if (!['hide', 'hunt'].includes(this.phase)) return;
    this.remaining -= dt;
    if (this.remaining <= 0) {
      if (this.phase === 'hide') { this.phase = 'hunt'; this.remaining = this.options.huntSeconds; this.event('¡Salió el buscador! Quédate quieto para camuflarte.'); }
      else { this.finish('hiders', '¡Se acabó el tiempo! Ganaron los escondidos.'); return; }
    }
    for (const p of this.players) {
      p.cooldown = Math.max(0, p.cooldown - dt);
      if (p.caught || p.spectator || (this.isSeeker(p.id) && this.phase === 'hide')) { p.moving = false; continue; }
      let input = inputs.get(p.id) || {};
      if (p.bot) input = this.botInput(p);
      let dx = Number.isFinite(input.x) ? input.x : 0, dz = Number.isFinite(input.z) ? input.z : 0;
      const length = Math.hypot(dx, dz);
      if (length > 1) { dx /= length; dz /= length; }
      const speed = p.prop && !this.options.moveDisguised ? 0 : p.prop ? 3.1 : input.sprint ? 6.2 : 4.6;
      const before = { x: p.x, z: p.z };
      this.layout.move(p, dx * speed * dt, dz * speed * dt, playerRadius(p));
      p.moving = distance(before, p) > 0.001;
      // Panas face where they look; a disguise only turns when it moves, so
      // glancing around never spins a suspicious barrel.
      if (!p.prop && Number.isFinite(input.look)) p.h = input.look;
      else if (p.moving) p.h = Math.atan2(dx, dz);
    }
    if (this.phase !== 'hunt') return;
    if (this.options.hints !== 'none' && this.elapsed >= this.hintAt) {
      const targets = this.players.filter(p => !this.isSeeker(p.id) && !p.caught && !p.spectator);
      const p = targets[Math.floor(this.elapsed / 12) % targets.length];
      if (p) this.hint = { id: ++this.revision, x: p.x, z: p.z, until: this.elapsed + (this.options.hints === 'whistle' ? 3 : 1), kind: this.options.hints };
      this.hintAt = this.elapsed + (this.options.hints === 'whistle' ? 10 : 20);
    }
    if (this.hint && this.elapsed > this.hint.until) this.hint = null;
    const botSeekers = this.players.filter(p => this.isSeeker(p.id) && p.bot);
    for (const p of this.players) {
      if (this.isSeeker(p.id) || p.caught || p.spectator) continue;
      const rates = botSeekers.map(seeker => {
        const d = distance(p, seeker), seen = d < 13 && this.layout.clearSight(seeker, p);
        return !seen ? -35 : !p.prop ? 70 : p.moving ? 48 : d < 3 ? 38 : -25;
      });
      p.suspicion = Math.max(0, Math.min(100, p.suspicion + Math.max(-70, ...rates) * dt));
      const capturer = p.suspicion >= 100 && botSeekers.find(seeker => distance(p, seeker) < RULES.checkRange && this.layout.clearSight(seeker, p));
      if (capturer) this.capture(p, capturer.id);
    }
  }

  botInput(p) {
    if (!this.isSeeker(p.id)) return {};
    const exposed = this.players.filter(q => !this.isSeeker(q.id) && !q.caught && !q.spectator && (q.moving || !q.prop || q.suspicion > 10)
      && distance(p, q) < 14 && this.layout.clearSight(p, q)).sort((a, b) => distance(p, a) - distance(p, b))[0];
    if (exposed && distance(p, exposed) < 3) return {};
    if (exposed) p.target = { x: exposed.x, z: exposed.z };
    if (!p.target || distance(p, p.target) < 1.3 || this.elapsed > (p.targetUntil || 0)) {
      const at = Math.floor(this.elapsed / 7 + this.round * 11) % this.layout.props.length;
      const prop = this.layout.props[at];
      p.target = this.layout.safeSpot(prop.x + 1.3, prop.z + 1.3);
      p.targetUntil = this.elapsed + 9;
    }
    if (this.elapsed > p.navAt || !p.path?.length) {
      p.path = this.layout.route(p, p.target); p.navAt = this.elapsed + 1.2;
    }
    while (p.path.length && distance(p, p.path[0]) < 0.55) p.path.shift();
    const to = p.path[0] || p.target, d = distance(p, to);
    return { x: (to.x - p.x) / Math.max(d, 1), z: (to.z - p.z) / Math.max(d, 1) };
  }
  snapshot() {
    return { options: { ...this.options }, seekers: this.seekers, hint: this.hint, mapId: this.mapId, layoutSeed: this.layoutSeed, hideSeconds: this.hideSeconds, phase: this.phase, remaining: this.remaining, round: this.round, totalRounds: this.totalRounds, seeker: this.seeker,
      winner: this.winner, events: this.events, revision: this.revision,
      players: this.players.map(({ path, target, navAt, targetUntil, ...p }) => p) };
  }
}
