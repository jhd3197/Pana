// LiveRoom: a real-time host-simulated game (Cocina, Escondidas, Reliquia,
// Galope, Curiara). The host steps the simulation on a timer with everyone's
// latest input and publishes a snapshot each tick; guests send inputs and
// actions and render the snapshots.
//
//   class KitchenRoom extends LiveRoom {
//     constructor(options) { super({ ...options, game: 'cocina', protocol: 'cocina-v2' }); }
//     cleanInput(raw) { return { x: axis(raw?.x), z: axis(raw?.z), dash: !!raw?.dash }; }
//     takeOver(previous) { super.takeOver(previous); this.game = …; this.publish(); }
//     handle(id, data) { … }       // an action that passed the seq check
//   }
//   const clock = elapsedClock();
//   setInterval(() => room.tick(clock(), input(), paused), 50);
//
// A game with toLobby() answers the host's 'lobby' action without a handle()
// line (engine/play/round-lobby.js).
// Subclass hooks: cleanInput(raw), handle(id, data), message(id, data) for any
// other kind, expire(id, input) for an input older than inputTtl (default: drop
// it), ownInput(input) for the host's own, inputMessage(input) and
// takeInput(id, data) to change the wire format.
// Pass `predict: { body(state, id), step(body, input, dt) }` to move a guest's
// own character at once (engine/predict.js); read it from room.predicted.
// Call super.takeOver(previous) and super.memberLeft(id) when overriding them.
import { HostRoom } from './net.js';
import { createPrediction } from './predict.js';

export const STEP = .05;
// A guest resends an unchanged input this often, so the host never expires it
// (inputTtl) and a new host gets it soon after taking over.
const INPUT_HEARTBEAT = 200;
// -1…1, anything else (NaN, strings, absent) is a released stick.
export const axis = (v) => Number.isFinite(v) ? Math.max(-1, Math.min(1, v)) : 0;

// Seconds since the previous call: the host's real elapsed time. A background
// tab fires timers about once a second; this keeps the game at real speed.
export function elapsedClock(now = () => performance.now()) {
  let last = now();
  return () => { const t = now(), dt = (t - last) / 1000; last = t; return dt; };
}

export class LiveRoom extends HostRoom {
  constructor(options, { valid = (state) => !!state, inputTtl = 600, maxCatchUp = 1, predict = null } = {}) {
    super(options);
    this.live = { valid, inputTtl, maxCatchUp };
    this.inputs = new Map(); this.lastAction = new Map(); this.seq = 0;
    // Prediction numbers every input; the host echoes the last one it applied per guest.
    this.prediction = predict && createPrediction({ ...predict, slice: STEP });
    this.inputSeq = 0; this.acks = new Map();
  }

  // Your own body as you predict it (a guest with `predict`), else null.
  get predicted() { return !this.isHost && this.connected && !this.offline ? this.prediction?.body ?? null : null; }

  cleanInput(raw) { return raw ?? {}; }

  takeOver() { this.inputs.clear(); this.lastAction.clear(); this.acks.clear(); this.prediction?.reset(); }
  memberLeft(id) { this.inputs.delete(id); this.lastAction.delete(id); this.acks.delete(id); }

  receive(id, data) {
    if (data.kind === 'snapshot') {
      if (id === this.hostId && !this.isHost && this.live.valid(data.state)) {
        this.state = data.state;
        this.prediction?.snapshot(this.state, this.id, data.acks?.[this.id]);
        this.onState(this.state);
      }
    } else if (data.kind === 'input') {
      if (this.isHost) this.takeInput(id, data);
    } else if (data.kind === 'action') {
      // Actions arrive once each: a repeated or older seq is a resend.
      if (!this.isHost || !Number.isSafeInteger(data.seq) || data.seq <= (this.lastAction.get(id) || 0)) return;
      this.lastAction.set(id, data.seq); this.dispatch(id, data);
    } else if (data.kind === 'notice') {
      if (id === this.hostId && data.to === this.id) this.onNotice(data.text);
    } else this.message?.(id, data);
  }

  ownInput(input) { return this.cleanInput(input); }
  takeInput(id, data) {
    this.inputs.set(id, { ...this.cleanInput(data.input), at: performance.now() });
    if (Number.isSafeInteger(data.seq)) this.acks.set(id, data.seq);
  }
  inputMessage(input) { return { kind: 'input', input: this.cleanInput(input) }; }
  expire(id) { this.inputs.delete(id); }

  // A message for one member: shown here when it's you, sent when it's a guest.
  notice(id, text) {
    if (id === this.id) this.onNotice(text);
    else this.send({ kind: 'notice', to: id, text }, id);
  }

  action(action, extra = {}) {
    if (!this.connected) { if (this.texts.waiting) this.onNotice(this.texts.waiting); return false; }
    const data = { kind: 'action', seq: ++this.seq, action, ...extra };
    if (this.isHost) { this.lastAction.set(this.id, data.seq); this.dispatch(this.id, data); } else this.send(data, 'host');
    return true;
  }

  // A game with toLobby() (engine/play/round-lobby.js) gets the host's 'lobby'
  // action here: the results screen takes everyone back to pick the next map.
  dispatch(id, data) {
    if (data.action === 'lobby' && typeof this.game?.toLobby === 'function') {
      if (id === this.hostId && this.game.toLobby()) this.publish();
      return;
    }
    this.handle?.(id, data);
  }

  publish() {
    this.state = this.game.snapshot(); this.onState(this.state);
    this.send(this.acks.size ? { kind: 'snapshot', state: this.state, acks: Object.fromEntries(this.acks) } : { kind: 'snapshot', state: this.state });
  }

  // A guest's input goes to the host only when it changed, or as a heartbeat.
  // A predicting guest numbers and sends every tick's input: the host's echo
  // of the last number tells it which of its own steps to replay.
  sendInput(input, dt) {
    if (this.prediction) {
      const seq = ++this.inputSeq, message = this.inputMessage(input);
      this.send({ ...message, seq }, 'host');
      this.prediction.input(seq, message.input, Math.min(this.live.maxCatchUp, dt));
      return;
    }
    const message = this.inputMessage(input), key = JSON.stringify(message), now = performance.now();
    if (key === this.sentInput && now - this.sentAt < Math.min(INPUT_HEARTBEAT, this.live.inputTtl / 3)) return;
    this.sentInput = key; this.sentAt = now;
    this.send(message, 'host');
  }

  elect(next) {
    if (next !== this.hostId) this.sentInput = null;   // the new host has none of our input yet
    super.elect(next);
  }

  // Host: step the game in fixed STEP slices (catching up at most maxCatchUp
  // seconds after a hitch) and publish once. Guest: send this tick's input.
  tick(dt, input, paused = false) {
    if (!this.connected) return;
    if (!this.isHost) { this.sendInput(input, dt); return; }
    this.inputs.set(this.id, { ...this.ownInput(input), at: performance.now() });
    // A guest's input expires once it is older than inputTtl AND nothing came
    // since the previous tick. A host that ticks slowly (a busy phone, a tab in
    // the background firing timers about once a second) would otherwise drop a
    // held key on every tick, and the guest would freeze.
    const now = performance.now(), previous = this.lastTick ?? now;
    for (const [id, value] of this.inputs) if (id !== this.id && now - value.at > this.live.inputTtl && value.at < previous) this.expire(id, value);
    this.lastTick = now;
    if (!paused) for (let left = Math.min(this.live.maxCatchUp, dt); left > 1e-6; left -= STEP) this.game.update(Math.min(STEP, left), this.inputs);
    this.publish();
  }

  practice(text) {
    this.inputs.clear(); this.lastAction.clear(); this.seq = 0; this.acks.clear(); this.prediction?.reset();
    super.practice(text);
  }
}
