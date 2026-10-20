// Derrape's side of its Colyseus room (games/derrape/server/room.js). The
// shared link (joining, reconnect after reload, server clock, state copies)
// is engine/net.js; this adds the race's own messages and Grand Prix context.

import { joinRoom } from '/engine/net.js';
import { GP_PROTOCOL } from './online-rules.js';

// opts: { code, lead, name, avatar, car, wheel, mode, difficulty, track }
export async function joinRace(opts) {
  return new RaceLink(await joinRoom('derrape', { protocol: GP_PROTOCOL, ...opts }));
}

class RaceLink {
  constructor(link) {
    this.link = link;
    this.code = link.code;
    this.id = link.id;
    this.poseMemo = new Map();
    this.lastRaceId = 0;
    this.lastCupJson = '';
    this.cup = null;
    this.handlers = { pose: [], fx: [], state: [] };
    this.syncState(link.state);
    link.on('state', (s) => {
      this.syncState(s);
      this.emit('state', s);
    });
    link.on('p', (payload) => {
      const list = Array.isArray(payload) ? payload : payload?.list;
      if (!Array.isArray(list)) return;
      if (this.cup && Array.isArray(payload)) return;
      if (!Array.isArray(payload) && !this.matchesContext(payload)) return;
      for (const [id, stamp, ...pose] of list) {
        this.poseMemo.set(id, pose);
        this.emit('pose', id, stamp, pose);
      }
    });
    link.on('poses', (all) => {
      if (!this.matchesContext(all)) return;
      for (const [id, pose] of Object.entries(all?.poses || {})) {
        this.poseMemo.set(id, pose);
        this.emit('pose', id, this.now(), pose);
      }
    });
    link.on('fx', (m) => {
      if (!m || !this.matchesContext(m)) return;
      this.emit('fx', m.id, m.k, m.d);
    });
  }

  matchesContext(m) {
    if (!m || typeof m !== 'object') return false;
    if (m.raceId != null && m.raceId !== this.state.raceId) return false;
    if (!this.cup) return true;
    const stageIndex = this.cup.stageIndex;
    const attempt = this.cup.attempts?.[stageIndex] ?? 1;
    return m.raceId === this.state.raceId && m.sessionId === this.cup.sessionId
      && m.stage === stageIndex && m.attempt === attempt;
  }

  syncState(s) {
    if (!s) return;
    const raw = s.cupJson || '';
    if (raw !== this.lastCupJson) {
      this.lastCupJson = raw;
      try { this.cup = raw ? JSON.parse(raw) : null; } catch { this.cup = null; }
    }
    const ctxKey = `${s.raceId || 0}:${this.cup?.sessionId || ''}:${this.cup?.stageIndex ?? ''}:${this.cup?.attempts?.[this.cup?.stageIndex] ?? ''}`;
    if (ctxKey !== this.lastCtxKey) {
      this.lastCtxKey = ctxKey;
      this.poseMemo.clear();
    }
    // Pongs read while a map loads arrive late and skew the server-clock
    // estimate by hundreds of ms. Every client has loaded once the countdown
    // starts: measure again then, so start times and item stamps agree.
    if (s.phase === 'count' && this.lastPhase !== 'count') this.link.sync();
    this.lastPhase = s.phase;
  }

  get state() {
    this.syncState(this.link.state);
    return this.link.state;
  }
  get isHost() { return this.link.isHost; }
  on(event, fn) {
    if (!this.handlers[event]) return this.link.on(event, fn);
    this.handlers[event].push(fn);
    return () => this.handlers[event].splice(this.handlers[event].indexOf(fn), 1);
  }
  emit(event, ...args) { for (const fn of this.handlers[event]) fn(...args); }
  until(test, progress) {
    return this.link.until((s) => {
      this.syncState(s);
      return test(s);
    }, progress);
  }
  now() { return this.link.now(); }
  lastPose(id) { return this.poseMemo.get(id) || null; }

  context() {
    const ctx = { raceId: this.state.raceId };
    if (this.cup) {
      ctx.sessionId = this.cup.sessionId;
      ctx.stage = this.cup.stageIndex;
      ctx.attempt = this.cup.attempts?.[this.cup.stageIndex] ?? 1;
    }
    return ctx;
  }

  send(type, data) { this.link.send(type, data); }
  pick(car, wheel, cosmetics) { this.send('pick', { car, wheel, cosmetics }); }
  track(id) { this.send('track', { id }); }
  bots(on) { this.send('bots', { on }); }
  mode(mode) { this.send('mode', { mode }); }
  difficulty(id) { this.send('difficulty', { id }); }
  start() { this.send('start'); }
  next() { this.send('next', this.context()); }
  lobby() { this.send('lobby'); }
  loaded() { this.send('loaded', this.context()); }
  poses(list) { if (list.length) this.send('p', { ...this.context(), list }); }
  fx(id, k, d) { this.send('fx', { ...this.context(), id, k, d }); }
  finish(id, time) { this.send('finish', { ...this.context(), id, time }); }
  retire() { this.send('retire', this.context()); }
  leave() { return this.link.leave(); }
}
