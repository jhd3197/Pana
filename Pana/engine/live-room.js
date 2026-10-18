// LiveRoom: a real-time host-simulated game (Cocina, Escondidas, Reliquia,
// Galope, Curiara). The host steps the simulation on a timer with everyone's
// latest input and publishes a snapshot each tick; guests send inputs and
// actions and render the snapshots.
//
//   class KitchenRoom extends LiveRoom {
//     constructor(options) { super({ ...options, game: 'cocina', protocol: 'cocina-v1' }); }
//     cleanInput(raw) { return { x: axis(raw?.x), z: axis(raw?.z), dash: !!raw?.dash }; }
//     takeOver(previous) { super.takeOver(previous); this.game = …; this.publish(); }
//     handle(id, data) { … }       // an action that passed the seq check
//   }
//   const clock = elapsedClock();
//   setInterval(() => room.tick(clock(), input(), paused), 50);
//
// Subclass hooks: cleanInput(raw), handle(id, data), message(id, data) for any
// other kind, expire(id, input) for an input older than inputTtl (default: drop
// it), ownInput(input) for the host's own, inputMessage(input) and
// takeInput(id, data) to change the wire format.
// Call super.takeOver(previous) and super.memberLeft(id) when overriding them.
import { HostRoom } from './net.js';

export const STEP = .05;
// -1…1, anything else (NaN, strings, absent) is a released stick.
export const axis = (v) => Number.isFinite(v) ? Math.max(-1, Math.min(1, v)) : 0;

// Seconds since the previous call: the host's real elapsed time. A background
// tab fires timers about once a second; this keeps the game at real speed.
export function elapsedClock(now = () => performance.now()) {
  let last = now();
  return () => { const t = now(), dt = (t - last) / 1000; last = t; return dt; };
}

export class LiveRoom extends HostRoom {
  constructor(options, { valid = (state) => !!state, inputTtl = 600, maxCatchUp = 1 } = {}) {
    super(options);
    this.live = { valid, inputTtl, maxCatchUp };
    this.inputs = new Map(); this.lastAction = new Map(); this.seq = 0;
  }

  cleanInput(raw) { return raw ?? {}; }

  takeOver() { this.inputs.clear(); this.lastAction.clear(); }
  memberLeft(id) { this.inputs.delete(id); this.lastAction.delete(id); }

  receive(id, data) {
    if (data.kind === 'snapshot') {
      if (id === this.hostId && !this.isHost && this.live.valid(data.state)) { this.state = data.state; this.onState(this.state); }
    } else if (data.kind === 'input') {
      if (this.isHost) this.takeInput(id, data);
    } else if (data.kind === 'action') {
      // Actions arrive once each: a repeated or older seq is a resend.
      if (!this.isHost || !Number.isSafeInteger(data.seq) || data.seq <= (this.lastAction.get(id) || 0)) return;
      this.lastAction.set(id, data.seq); this.handle?.(id, data);
    } else if (data.kind === 'notice') {
      if (id === this.hostId && data.to === this.id) this.onNotice(data.text);
    } else this.message?.(id, data);
  }

  ownInput(input) { return this.cleanInput(input); }
  takeInput(id, data) { this.inputs.set(id, { ...this.cleanInput(data.input), at: performance.now() }); }
  inputMessage(input) { return { kind: 'input', input: this.cleanInput(input) }; }
  expire(id) { this.inputs.delete(id); }

  // A message for one member: shown here when it's you, sent when it's a guest.
  notice(id, text) {
    if (id === this.id) this.onNotice(text);
    else this.send({ kind: 'notice', to: id, text });
  }

  action(action, extra = {}) {
    if (!this.connected) { if (this.texts.waiting) this.onNotice(this.texts.waiting); return false; }
    const data = { kind: 'action', seq: ++this.seq, action, ...extra };
    if (this.isHost) { this.lastAction.set(this.id, data.seq); this.handle?.(this.id, data); } else this.send(data);
    return true;
  }

  publish() { this.state = this.game.snapshot(); this.onState(this.state); this.send({ kind: 'snapshot', state: this.state }); }

  // Host: step the game in fixed STEP slices (catching up at most maxCatchUp
  // seconds after a hitch) and publish once. Guest: send this tick's input.
  tick(dt, input, paused = false) {
    if (!this.connected) return;
    if (!this.isHost) { this.send(this.inputMessage(input)); return; }
    this.inputs.set(this.id, { ...this.ownInput(input), at: performance.now() });
    const now = performance.now();
    for (const [id, value] of this.inputs) if (id !== this.id && now - value.at > this.live.inputTtl) this.expire(id, value);
    if (!paused) for (let left = Math.min(this.live.maxCatchUp, dt); left > 1e-6; left -= STEP) this.game.update(Math.min(STEP, left), this.inputs);
    this.publish();
  }

  practice(text) {
    this.inputs.clear(); this.lastAction.clear(); this.seq = 0;
    super.practice(text);
  }
}
