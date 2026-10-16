import { propDefinition } from '/engine/models/props/plaza-definitions.js';
import { MAP_PROPS, move, blocked, safeSpot, clearSight, route } from './layout.js';

export const RULES = Object.freeze({ changes: 3, hideSeconds: 15, huntSeconds: 100, rounds: 4, checkRange: 3.5, checkCooldown: 1.6 });
const distance = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);
export const playerRadius = p => propDefinition(p.prop)?.radius || 0.5;

export class HuntRound {
  constructor() {
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
  addPlayer(id, name, avatar, bot = false) {
    if (this.players.some(p => p.id === id)) return;
    this.players.push({ id, name, avatar, bot, x: -4, z: 13, h: Math.PI,
      prop: null, changes: RULES.changes, caught: false, score: 0,
      spectator: !['lobby', 'results', 'finished'].includes(this.phase), moving: false, suspicion: 0, cooldown: 0 });
  }
  removePlayer(id) {
    this.players = this.players.filter(p => p.id !== id);
    if (id === this.seeker && ['hide', 'hunt'].includes(this.phase)) this.finish('hiders', 'El buscador salió de la sala.');
    else this.checkEnd();
  }
  event(text) {
    this.events.push({ id: ++this.revision, text });
    this.events = this.events.slice(-4);
  }
  start(hostId, preference = 'hide') {
    if (!['lobby', 'results', 'finished'].includes(this.phase)) return false;
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
    this.totalRounds = Math.max(RULES.rounds, this.players.length);
    const first = Math.max(0, this.players.findIndex(p => p.id === this.firstSeeker));
    this.seeker = this.players[(first + this.round) % this.players.length].id;
    this.round++;
    this.phase = 'hide'; this.remaining = RULES.hideSeconds; this.winner = null;
    for (const [i, p] of this.players.entries()) {
      p.prop = null; p.changes = RULES.changes; p.caught = false; p.spectator = false;
      p.suspicion = 0; p.cooldown = 0; p.moving = false; p.h = Math.PI;
      p.path = []; p.navAt = 0; p.target = null;
      Object.assign(p, safeSpot(p.id === this.seeker ? 0 : -5 + i * 3, p.id === this.seeker ? -10 : 13));
      if (p.bot && p.id !== this.seeker) {
        const prop = MAP_PROPS[(i * 9 + this.round * 7) % MAP_PROPS.length];
        const spot = safeSpot(prop.x + 1.9, prop.z + 1.5, propDefinition(prop.type).radius);
        Object.assign(p, spot);
        this.transform(p.id, prop.type);
      }
    }
    this.event('¡A esconderse! El buscador sale en 15 segundos.');
    return true;
  }
  transform(id, type) {
    const p = this.players.find(p => p.id === id), def = propDefinition(type);
    if (!p || p.id === this.seeker || p.caught || p.spectator || !['hide', 'hunt'].includes(this.phase)) return 'Ahora no puedes cambiar.';
    if (type === p.prop) return 'Ya tienes esa forma.';
    if (type === null) { p.prop = null; return null; }
    if (!def) return 'Ese objeto no existe.';
    if (p.changes <= 0) return 'No te quedan cambios en esta ronda.';
    if (blocked(p.x, p.z, def.radius)) return 'Busca un poco más de espacio para ese objeto.';
    p.prop = type; p.changes--;
    return null;
  }
  check(id) {
    const p = this.players.find(p => p.id === id);
    if (!p || id !== this.seeker || this.phase !== 'hunt' || p.cooldown > 0) return false;
    p.cooldown = RULES.checkCooldown;
    const target = this.players.filter(t => !t.spectator && !t.caught && t.id !== id && distance(p, t) <= RULES.checkRange && clearSight(p, t))
      .sort((a, b) => distance(p, a) - distance(p, b))[0];
    if (target) { this.capture(target); return true; }
    return false;
  }
  capture(p) {
    if (p.caught) return;
    p.caught = true; p.moving = false; p.suspicion = 0;
    const seeker = this.players.find(s => s.id === this.seeker);
    if (seeker) seeker.score += 1;
    this.event(`¡Encontraron a ${p.name}!`);
    this.checkEnd();
  }
  checkEnd() {
    if (['hide', 'hunt'].includes(this.phase) && !this.players.some(p => !p.spectator && !p.caught && p.id !== this.seeker)) this.finish('seeker', '¡El buscador encontró a todos!');
  }
  finish(team, message) {
    if (!['hide', 'hunt'].includes(this.phase)) return;
    this.winner = team; this.remaining = 0;
    this.phase = this.round >= this.totalRounds ? 'finished' : 'results';
    for (const p of this.players) {
      p.moving = false;
      if (team === 'hiders' && p.id !== this.seeker && !p.spectator && !p.caught) p.score += 3;
    }
    this.event(message);
  }
  update(dt, inputs = new Map()) {
    this.elapsed += dt;
    if (!['hide', 'hunt'].includes(this.phase)) return;
    this.remaining -= dt;
    if (this.remaining <= 0) {
      if (this.phase === 'hide') { this.phase = 'hunt'; this.remaining = RULES.huntSeconds; this.event('¡Salió el buscador! Quédate quieto para camuflarte.'); }
      else { this.finish('hiders', '¡Se acabó el tiempo! Ganaron los escondidos.'); return; }
    }
    for (const p of this.players) {
      p.cooldown = Math.max(0, p.cooldown - dt);
      if (p.caught || p.spectator || (p.id === this.seeker && this.phase === 'hide')) { p.moving = false; continue; }
      let input = inputs.get(p.id) || {};
      if (p.bot) input = this.botInput(p);
      let dx = Number.isFinite(input.x) ? input.x : 0, dz = Number.isFinite(input.z) ? input.z : 0;
      const length = Math.hypot(dx, dz);
      if (length > 1) { dx /= length; dz /= length; }
      const speed = p.prop ? 3.1 : input.sprint ? 6.2 : 4.6;
      const before = { x: p.x, z: p.z };
      move(p, dx * speed * dt, dz * speed * dt, playerRadius(p));
      p.moving = distance(before, p) > 0.001;
      if (p.moving) p.h = Math.atan2(dx, dz);
    }
    const seeker = this.players.find(p => p.id === this.seeker);
    if (!seeker || this.phase !== 'hunt') return;
    for (const p of this.players) {
      if (p.id === this.seeker || p.caught || p.spectator) continue;
      const d = distance(p, seeker), seen = d < 13 && clearSight(seeker, p);
      // Suspicion is a solo-bot mechanic; human seekers inspect with E.
      const rate = !seeker.bot ? -70 : !seen ? -35 : !p.prop ? 70 : p.moving ? 48 : d < 3 ? 38 : -25;
      p.suspicion = Math.max(0, Math.min(100, p.suspicion + rate * dt));
      if (seeker.bot && p.suspicion >= 100 && d < RULES.checkRange) this.capture(p);
    }
  }
  botInput(p) {
    if (p.id !== this.seeker) return {};
    const exposed = this.players.filter(q => q.id !== p.id && !q.caught && !q.spectator && (q.moving || !q.prop || q.suspicion > 10)
      && distance(p, q) < 14 && clearSight(p, q)).sort((a, b) => distance(p, a) - distance(p, b))[0];
    if (exposed && distance(p, exposed) < 3) return {};
    if (exposed) p.target = { x: exposed.x, z: exposed.z };
    if (!p.target || distance(p, p.target) < 1.3 || this.elapsed > (p.targetUntil || 0)) {
      const at = Math.floor(this.elapsed / 7 + this.round * 11) % MAP_PROPS.length;
      const prop = MAP_PROPS[at];
      p.target = safeSpot(prop.x + 1.3, prop.z + 1.3);
      p.targetUntil = this.elapsed + 9;
    }
    if (this.elapsed > p.navAt || !p.path?.length) {
      p.path = route(p, p.target); p.navAt = this.elapsed + 1.2;
    }
    while (p.path.length && distance(p, p.path[0]) < 0.55) p.path.shift();
    const to = p.path[0] || p.target, d = distance(p, to);
    return { x: (to.x - p.x) / Math.max(d, 1), z: (to.z - p.z) / Math.max(d, 1) };
  }
  snapshot() {
    return { phase: this.phase, remaining: this.remaining, round: this.round, totalRounds: this.totalRounds, seeker: this.seeker,
      winner: this.winner, events: this.events, revision: this.revision,
      players: this.players.map(({ path, target, navAt, targetUntil, ...p }) => p) };
  }
}
