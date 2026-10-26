import { LiveRoom } from '/engine/live-room.js';
import { Race, fly, cleanInput } from './rules.js';
import { galipanCourse } from './galipan.js';
import { loc } from '/engine/i18n.js';

// Host simulation on the shared live room (engine/live-room.js): the host
// steps the race with everyone's held controls and publishes each tick; a new
// host continues from the last snapshot. Every client builds the same course
// from the Galipán map, so it never travels in a snapshot.
export class ParapenteRoom extends LiveRoom {
  constructor(options) {
    super({ ...options, game: 'parapente', protocol: 'parapente-v1', texts: {
      connecting: loc('Subiendo a la rampa…'), full: loc('Sala llena. Abre un vuelo local.'),
      lost: loc('Se perdió la conexión. Reconectando…'), offline: loc('Sin conexión. Puedes volar en local.') } }, {
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
  statusText() { const n = this.members.size; return this.isHost ? loc('{n}/8 panas · tú das la salida', { n }) : loc('{n}/8 panas · el anfitrión da la salida', { n }); }
  takeOver(previous) {
    super.takeOver(previous);
    this.game = Race.restore(this.state, this.members, galipanCourse(this.state.options));
    for (const m of this.members.values()) this.game.addPlayer(m.id, m.name, m.id === this.id ? this.avatar : m.avatar || {});
    this.publish();
    if (previous != null) this.onNotice(loc('Cambió el anfitrión. El vuelo sigue.'));
  }
  memberJoined(m) { if (this.isHost) { this.game.addPlayer(m.id, m.name, m.avatar || {}); this.publish(); } }
  memberHello(id, m) { if (this.isHost) { this.game.addPlayer(id, m.name, m.avatar || {}); this.publish(); } }
  memberLeft(id) { super.memberLeft(id); if (this.isHost) { this.game.removePlayer(id); this.publish(); } }
  handle(id, data) {
    if (id !== this.hostId) return;
    if (data.action === 'options' && this.game.configure(data.options)) { this.game.course = galipanCourse(this.game.options); this.publish(); }
    if (data.action === 'start' && ['lobby', 'finished'].includes(this.game.phase) && this.game.start()) this.publish();
  }
  practice() { const local = new Race(); local.configure(this.state.options); this.state = local.snapshot(); super.practice(loc('Vuelo local')); }
}
