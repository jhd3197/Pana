import { Race, cleanInput } from './rules.js';
import { courseRiver } from './course.js';

// A private copy of the latest snapshot to drive your own lancha in
// (Race.drive also reads the river, the time and the hazards). One per
// snapshot; the river is rebuilt only when the course options change.
let ghost = null, ghostOf = null, river = null, riverKey = '';
function ghostRace(state) {
  if (ghostOf === state) return ghost;
  const key = `${state.options?.falls}:${state.options?.items}`;
  if (key !== riverKey) { riverKey = key; river = courseRiver(state.options || {}); }
  ghostOf = state;
  return (ghost = Object.assign(new Race(), structuredClone(state), { river }));
}
import { LiveRoom } from '/engine/live-room.js';
import { loc } from '/engine/i18n.js';

// Host simulation on the shared live room (engine/live-room.js): the host
// steps the race with everyone's held keys and publishes each tick; a new host
// continues from the last snapshot.
export class LanchaRoom extends LiveRoom {
  constructor(options) {
    super({ ...options, game: 'lancha', protocol: 'lancha-v1', texts: {
      connecting: loc('Arrancando hacia la sala…'), full: loc('Sala llena. Abre una carrera local.'),
      lost: loc('Se perdió la conexión. Reconectando…'), offline: loc('Sin conexión. Puedes correr en local.') } }, {
      valid: (state) => Array.isArray(state?.boats),
      // Your own lancha answers the throttle at once; the host corrects it.
      predict: {
        body: (state, id) => state.phase === 'racing' ? state.boats.find(b => b.driver.id === id && b.finish === null) : null,
        step: (boat, input, dt, state) => ghostRace(state).drive(boat, dt, cleanInput(input)),
      },
    });
    this.state = new Race().snapshot();
  }
  cleanInput(raw) { return cleanInput(raw); }
  statusText() { const n = this.members.size; return this.isHost ? loc('{n}/8 panas · tú das la salida', { n }) : loc('{n}/8 panas · el anfitrión da la salida', { n }); }
  takeOver(previous) {
    super.takeOver(previous);
    this.game = Race.restore(this.state, this.members);
    for (const m of this.members.values()) if (!this.game.players.some(p => p.id === m.id)) this.game.addPlayer(m.id, m.name, m.id === this.id ? this.avatar : m.avatar || {});
    this.publish();
    if (previous != null) this.onNotice(loc('Cambió el anfitrión. La carrera sigue.'));
  }
  memberJoined(m) { if (this.isHost) { this.game.addPlayer(m.id, m.name, m.avatar || {}); this.publish(); } }
  memberHello(id, m) { if (this.isHost) { this.game.addPlayer(id, m.name, m.avatar || {}); this.publish(); } }
  memberLeft(id) { super.memberLeft(id); if (this.isHost) { this.game.removePlayer(id); this.publish(); } }
  // A quiet guest lets go of the throttle and the tiller; its turbo count stays.
  expire(id, input) { this.inputs.set(id, { ...input, throttle: 0, steer: 0, back: false }); }
  handle(id, data) {
    if (id !== this.hostId) return;
    if (data.action === 'options' && this.game.configure(data.options)) this.publish();
    if (data.action === 'start' && ['lobby', 'finished'].includes(this.game.phase) && this.game.start()) this.publish();
  }
  practice() { const local = new Race(); local.configure(this.state.options); this.state = local.snapshot(); super.practice(loc('Carrera local')); }
}
