import { Kitchen } from './rules.js';
import { LiveRoom, axis } from '/engine/live-room.js';

// The room's host owns the kitchen (engine/live-room.js); a new host restores the last snapshot.
export class KitchenRoom extends LiveRoom {
  constructor(options) {
    super({ ...options, game: 'cocina', protocol: 'cocina-v2', texts: {
      connecting: 'Conectando con tus panas…', full: 'Sala llena. Puedes abrir tu propia cocina.',
      lost: 'Se cortó la conexión. Reconectando…', offline: 'Sin conexión. Puedes seguir en una cocina local.',
      waiting: 'Espera a reconectar o abre una cocina local.' } });
    this.state = new Kitchen().snapshot();
  }
  cleanInput(raw) { return { x: axis(raw?.x), z: axis(raw?.z), dash: !!raw?.dash }; }
  takeOver(previous) {
    super.takeOver(previous);
    this.game = new Kitchen(this.state.options);
    if (previous != null && this.state.phase !== 'lobby') this.game.restore(this.state, this.members);
    for (const p of this.members.values()) if (!this.game.players.some(q => q.id === p.id)) this.game.addPlayer(p.id, p.name, p.id === this.id ? this.avatar : p.avatar || {});
    this.publish();
    if (previous != null) this.onNotice('Cambió el anfitrión. ¡La cocina sigue abierta!');
  }
  memberJoined(m, already) {
    if (this.isHost) this.game.addPlayer(m.id, m.name, m.avatar);
    if (!already) this.onNotice(`${m.name} se sumó a la cocina.`);
  }
  memberLeft(id) {
    super.memberLeft(id);
    if (this.isHost) { this.game.removePlayer(id); this.game.fillBots(); }
  }
  memberHello(id, m) { if (this.isHost) this.game.addPlayer(id, m.name, m.avatar); }
  handle(id, data) {
    let message;
    if (data.action === 'configure' && id === this.hostId) this.game.configure(data.options);
    else if (data.action === 'start' && id === this.hostId && this.game.phase !== 'playing') this.game.start(typeof data.helpers === 'boolean' ? data.helpers : this.game.options.helpers);
    else if (data.action === 'interact') message = this.game.interact(id, data.station);
    if (message) this.notice(id, message);
    this.publish();
  }
  practice() { this.state = new Kitchen(this.state.options).snapshot(); super.practice('Cocina local · tú y los ayudantes'); }
}
