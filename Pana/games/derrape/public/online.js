// Derrape's side of its Colyseus room (games/derrape/server/room.js). The
// shared link (joining, reconnect after reload, server clock, state copies)
// is engine/net.js; this adds the race's own messages.

import { joinRoom } from '/engine/net.js';

// opts: { code, lead, name, avatar, car, wheel }
export async function joinRace(opts) {
  return new RaceLink(await joinRoom('derrape', opts));
}

class RaceLink {
  constructor(link) {
    this.link = link;
    this.code = link.code;
    this.id = link.id;
    this.poseMemo = new Map();
    this.handlers = { pose: [], fx: [] };   // decoded race events; the rest pass through to the link
    link.on('p', (list) => {
      for (const [id, stamp, ...pose] of list) { this.poseMemo.set(id, pose); this.emit('pose', id, stamp, pose); }
    });
    link.on('poses', (all) => { for (const [id, pose] of Object.entries(all || {})) this.poseMemo.set(id, pose); });
    link.on('fx', (m) => this.emit('fx', m.id, m.k, m.d));
  }

  get state() { return this.link.state; }
  get isHost() { return this.link.isHost; }
  on(event, fn) {
    if (!this.handlers[event]) return this.link.on(event, fn);
    this.handlers[event].push(fn);
    return () => this.handlers[event].splice(this.handlers[event].indexOf(fn), 1);
  }
  emit(event, ...args) { for (const fn of this.handlers[event]) fn(...args); }
  until(test, progress) { return this.link.until(test, progress); }
  now() { return this.link.now(); }
  lastPose(id) { return this.poseMemo.get(id) || null; }

  send(type, data) { this.link.send(type, data); }
  pick(car, wheel) { this.send('pick', { car, wheel }); }
  track(id) { this.send('track', { id }); }
  bots(on) { this.send('bots', { on }); }
  start() { this.send('start'); }
  lobby() { this.send('lobby'); }
  loaded() { this.send('loaded', { raceId: this.state.raceId }); }
  poses(list) { if (list.length) this.send('p', list); }
  fx(id, k, d) { this.send('fx', { id, k, d }); }
  finish(id, time) { this.send('finish', { id, time }); }
  retire() { this.send('retire'); }
  leave() { return this.link.leave(); }
}
