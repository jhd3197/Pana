import { Race, cleanInput } from './rules.js';
import { HostRoom } from '/engine/net.js';

const now = () => performance.now() / 1000;

// Host simulation on the shared host room (engine/net.js), with snapshot
// migration. Strokes carry the pana's own clock so rhythm survives jitter:
// the host maps each guest's clock onto race time with the smallest offset
// seen (clock difference plus the quickest delivery).
export class RiverRoom extends HostRoom {
  constructor({ code, name, avatar, seat = null, onState = () => {}, onStatus = () => {} }) {
    super({ game: 'curiara', protocol: 'curiara-v1', code, name, avatar, onState, onStatus, texts: {
      connecting: 'Remando hacia la sala…', full: 'Sala llena. Abre una carrera local.',
      lost: 'Se perdió la conexión. Reconectando…', offline: 'Sin conexión. Puedes remar en local.' } });
    this.seat = seat; this.inputs = new Map(); this.clocks = new Map(); this.state = new Race().snapshot();
  }
  hello() { return { seat: this.seat }; }
  statusText() { return `${this.members.size}/8 panas · ${this.isHost ? 'tú das la salida' : 'el anfitrión da la salida'}`; }
  takeOver() {
    this.game = Race.restore(this.state, this.members);
    for (const m of this.members.values()) if (!this.game.players.some(p => p.id === m.id)) this.game.addPlayer(m.id, m.name, m.avatar || {}, m.seat);
    this.publish();
  }
  memberJoined(m) { if (this.isHost) { this.game.addPlayer(m.id, m.name, m.avatar, m.seat); this.publish(); } }
  memberLeft(id) { this.inputs.delete(id); this.clocks.delete(id); if (this.isHost) { this.game.removePlayer(id); this.publish(); } }
  memberHello(id, m) { if (this.isHost) { this.game.addPlayer(id, m.name, m.avatar, m.seat ?? null); this.publish(); } }
  // Guest clock → race time, at the host's current moment.
  toRace(id, input) {
    const off = this.clocks.get(id) ?? 0, t = now();
    return { ...input, strokes: input.strokes.map(([seq, side, at]) => [seq, side, this.game.time - (t - (at + off))]) };
  }
  receive(id, data) {
    if (data.kind === 'snapshot' && id === this.hostId && !this.isHost && Array.isArray(data.state?.boats)) { this.state = data.state; this.onState(this.state); }
    else if (data.kind === 'input' && this.isHost && Number.isFinite(data.now)) {
      const sample = now() - data.now, old = this.clocks.get(id);
      // Let the floor creep up slowly so a clock that drifts is followed.
      this.clocks.set(id, old == null ? sample : Math.min(old + .002, sample));
      this.inputs.set(id, { ...this.toRace(id, cleanInput(data.input)), at: performance.now() });
    } else if (data.kind === 'seat' && this.isHost) { this.game.chooseSeat(id, data.seat); this.publish(); }
  }
  chooseSeat(seat) {
    this.seat = seat; const m = this.members.get(this.id); if (m) m.seat = seat;
    if (this.isHost) { this.game.chooseSeat(this.id, seat); this.publish(); } else this.send({ kind: 'seat', seat });
  }
  setFormat(format) { if (this.isHost && this.game) { this.game.setFormat(format); this.seat = null; this.publish(); } }
  start(bots = true) { if (this.isHost && this.connected && ['lobby', 'finished'].includes(this.game.phase)) { this.game.start(bots); this.publish(); } }
  publish() { this.state = this.game.snapshot(); this.onState(this.state); this.send({ kind: 'snapshot', state: this.state }); }
  tick(dt, input, paused = false) {
    if (!this.connected) return;
    if (this.isHost) {
      this.inputs.set(this.id, this.toRace(this.id, cleanInput(input)));
      // A quiet guest stops holding keys, but its strokes are events: a slow
      // host tick must never drop them before the race has read them.
      for (const [id, i] of this.inputs) if (id !== this.id && performance.now() - i.at > 600 && (i.back || i.steer)) this.inputs.set(id, { ...i, back: false, steer: 0 });
      // Catch up fixed steps when rendering delays a tick; publish once.
      if (!paused) for (let left = Math.min(1, dt); left > 1e-6; left -= .05) this.game.update(Math.min(.05, left), this.inputs);
      this.publish();
    } else this.send({ kind: 'input', input: cleanInput(input), now: now() });
  }
  practice() { this.state = new Race().snapshot(); this.inputs.clear(); this.clocks.clear(); super.practice('Carrera local · tú y los remeros del río'); }
}
