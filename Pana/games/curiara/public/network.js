import { Race, cleanInput } from './rules.js';
import { LiveRoom } from '/engine/live-room.js';

const now = () => performance.now() / 1000;

// Host simulation on the shared live room (engine/live-room.js), with snapshot
// migration. Strokes carry the pana's own clock so rhythm survives jitter:
// the host maps each guest's clock onto race time with the smallest offset
// seen (clock difference plus the quickest delivery).
export class RiverRoom extends LiveRoom {
  constructor({ seat = null, ...options }) {
    super({ ...options, game: 'curiara', protocol: 'curiara-v2', texts: {
      connecting: 'Remando hacia la sala…', full: 'Sala llena. Abre una carrera local.',
      lost: 'Se perdió la conexión. Reconectando…', offline: 'Sin conexión. Puedes remar en local.' } }, { valid: (state) => Array.isArray(state?.boats) });
    this.seat = seat; this.clocks = new Map(); this.state = new Race().snapshot();
  }
  cleanInput(raw) { return cleanInput(raw); }
  hello() { return { seat: this.seat }; }
  statusText() { return `${this.members.size}/8 panas · ${this.isHost ? 'tú das la salida' : 'el anfitrión da la salida'}`; }
  takeOver(previous) {
    super.takeOver(previous);
    this.game = Race.restore(this.state, this.members);
    for (const m of this.members.values()) if (!this.game.players.some(p => p.id === m.id)) this.game.addPlayer(m.id, m.name, m.avatar || {}, m.seat);
    this.publish();
  }
  memberJoined(m) { if (this.isHost) { this.game.addPlayer(m.id, m.name, m.avatar, m.seat); this.publish(); } }
  memberLeft(id) { super.memberLeft(id); this.clocks.delete(id); if (this.isHost) { this.game.removePlayer(id); this.publish(); } }
  memberHello(id, m) { if (this.isHost) { this.game.addPlayer(id, m.name, m.avatar, m.seat ?? null); this.publish(); } }
  // Guest clock → race time, at the host's current moment.
  toRace(id, input) {
    const off = this.clocks.get(id) ?? 0, t = now();
    return { ...input, strokes: input.strokes.map(([seq, side, at]) => [seq, side, this.game.time - (t - (at + off))]) };
  }
  // The host's own strokes go through the same clock mapping as a guest's.
  ownInput(input) { return this.toRace(this.id, cleanInput(input)); }
  inputMessage(input) { return { kind: 'input', input: cleanInput(input), now: now() }; }
  takeInput(id, data) {
    if (!Number.isFinite(data.now)) return;
    const sample = now() - data.now, old = this.clocks.get(id);
    // Let the floor creep up slowly so a clock that drifts is followed.
    this.clocks.set(id, old == null ? sample : Math.min(old + .002, sample));
    this.inputs.set(id, { ...this.toRace(id, cleanInput(data.input)), at: performance.now() });
  }
  // A quiet guest stops holding keys, but its strokes are events: a slow host
  // tick must never drop them before the race has read them.
  expire(id, input) { if (input.back || input.steer || input.auto) this.inputs.set(id, { ...input, back: false, steer: 0, auto: false }); }
  message(id, data) {
    if (!this.isHost) return;
    if (data.kind === 'move-seat' && this.game.moveSeat(id, data.from, data.to, this.hostId)) this.publish();
    else if (data.kind === 'seat' && this.game.chooseSeat(id, data.seat)) this.publish();
  }
  moveSeat(from, to) {
    if (!this.connected) return;
    if (this.isHost) { if (this.game.moveSeat(this.id, from, to, this.hostId)) this.publish(); }
    else this.send({ kind: 'move-seat', from, to }, 'host');
  }
  chooseSeat(seat) {
    this.seat = seat; const m = this.members.get(this.id); if (m) m.seat = seat;
    if (this.isHost) { this.game.chooseSeat(this.id, seat); this.publish(); } else this.send({ kind: 'seat', seat }, 'host');
  }
  configure(patch) { if(this.isHost && this.game?.configure(patch))this.publish(); }
  setFormat(format) { if (this.isHost && this.game) { this.game.setFormat(format); this.seat = null; this.publish(); } }
  start(bots = this.state.options.bots) { if (this.isHost && this.connected && ['lobby', 'finished'].includes(this.game.phase)) { if(!this.game.canStart()){this.onNotice('Hay más panas que puestos. Elige cuatro parejas o Individual.');return;}this.game.start(bots); this.publish(); } }
  practice() { const local = new Race(); local.configure(this.state.options); this.state = local.snapshot(); this.clocks.clear(); super.practice('Carrera local'); }
}
