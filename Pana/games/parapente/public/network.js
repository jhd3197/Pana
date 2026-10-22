import { LiveRoom } from '/engine/live-room.js';
import { Race, fly, cleanInput } from './rules.js';
import { galipanCourse } from './galipan.js';

// Host simulation on the shared live room (engine/live-room.js): the host
// steps the race with everyone's held controls and publishes each tick; a new
// host continues from the last snapshot. Every client builds the same course
// from the Galipán map, so it never travels in a snapshot.
export class ParapenteRoom extends LiveRoom {
  constructor(options) {
    super({ ...options, game: 'parapente', protocol: 'parapente-v1', texts: {
      connecting: 'Subiendo a la rampa…', full: 'Sala llena. Abre un vuelo local.',
      lost: 'Se perdió la conexión. Reconectando…', offline: 'Sin conexión. Puedes volar en local.' } }, {
      valid: (state) => Array.isArray(state?.pilots),
      // Your own wing answers the brakes at once; the host corrects it.
      predict: {
        body: (state, id) => state.phase === 'racing' ? state.pilots.find(p => p.id === id && p.finish === null) : null,
        step: (pilot, input, dt, state) => fly(galipanCourse(state.options), pilot, dt, cleanInput(input), state.time),
      },
    });
    this.state = new Race().snapshot();
  }
  cleanInput(raw) { return cleanInput(raw); }
  statusText() { return `${this.members.size}/8 panas · ${this.isHost ? 'tú das la salida' : 'el anfitrión da la salida'}`; }
  takeOver(previous) {
    super.takeOver(previous);
    this.game = Race.restore(this.state, this.members, galipanCourse(this.state.options));
    for (const m of this.members.values()) this.game.addPlayer(m.id, m.name, m.id === this.id ? this.avatar : m.avatar || {});
    this.publish();
    if (previous != null) this.onNotice('Cambió el anfitrión. El vuelo sigue.');
  }
  memberJoined(m) { if (this.isHost) { this.game.addPlayer(m.id, m.name, m.avatar || {}); this.publish(); } }
  memberHello(id, m) { if (this.isHost) { this.game.addPlayer(id, m.name, m.avatar || {}); this.publish(); } }
  memberLeft(id) { super.memberLeft(id); if (this.isHost) { this.game.removePlayer(id); this.publish(); } }
  handle(id, data) {
    if (id !== this.hostId) return;
    if (data.action === 'options' && this.game.configure(data.options)) { this.game.course = galipanCourse(this.game.options); this.publish(); }
    if (data.action === 'start' && ['lobby', 'finished'].includes(this.game.phase) && this.game.start()) this.publish();
  }
  practice() { const local = new Race(); local.configure(this.state.options); this.state = local.snapshot(); super.practice('Vuelo local · tú y los pilotos del cerro'); }
}
