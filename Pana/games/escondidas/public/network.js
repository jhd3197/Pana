// Round authority stays with the room's host (engine/live-room.js). All gameplay
// data rides the kit's relay messages under the 'hunt-v2' protocol.
import { HuntRound } from './rules.js';
import { LiveRoom, axis } from '/engine/live-room.js';

export class HuntRoom extends LiveRoom {
  constructor(options) {
    super({ ...options, game: 'escondidas', protocol: 'hunt-v2', texts: {
      full: 'La sala está llena (8 panas). Puedes practicar sin conexión.',
      offline: 'No pudimos conectar. Puedes practicar sin conexión.',
      waiting: 'Espera a reconectar o entra a practicar.' } });
    this.state = new HuntRound('plaza', { layoutSeed: crypto.getRandomValues(new Uint32Array(1))[0] }).snapshot();
  }
  cleanInput(raw) { return { x: axis(raw?.x), z: axis(raw?.z), sprint: !!raw?.sprint, ...(Number.isFinite(raw?.look) ? { look: raw.look } : {}) }; }
  takeOver(previous) {
    super.takeOver(previous);
    this.game = new HuntRound(this.state.mapId, this.state);
    for (const p of this.members.values()) this.game.addPlayer(p.id, p.name, p.id === this.id ? this.avatar : p.avatar || {});
    this.state = this.game.snapshot(); this.onState(this.state);
    if (previous != null) this.onNotice('Cambió el anfitrión. Preparen una nueva partida.');
  }
  memberJoined(m, already) {
    if (this.isHost) this.game.addPlayer(m.id, m.name, {});
    if (!already) this.onNotice(`${m.name} llegó a la sala.`);
  }
  memberLeft(id) {
    super.memberLeft(id);
    if (this.isHost) this.game.removePlayer(id);
  }
  memberHello(id, member) {
    if (!this.isHost) return;
    this.game.addPlayer(id, member.name, member.avatar);
    const p = this.game.players.find(p => p.id === id); if (p) p.avatar = member.avatar;
  }
  // The next tick publishes; actions only update the host's own view at once.
  handle(id, action) {
    if (action.action === 'map' && id === this.hostId) this.game.selectMap(action.mapId);
    else if (action.action === 'configure' && id === this.hostId) this.game.configure(action.options);
    else if (action.action === 'start' && id === this.hostId) this.game.start(id, action.preference);
    else if (action.action === 'transform') {
      const error = this.game.transform(id, action.prop);
      this.notice(id, error || (action.prop ? '¡Listo! Quédate quieto y pasa desapercibido.' : 'Volviste a ser pana.'));
    } else if (action.action === 'check') {
      const p = this.game.players.find(p => p.id === id);
      if (!p || p.cooldown > 0 || this.game.phase !== 'hunt' || !this.game.isSeeker(id)) return;
      this.notice(id, this.game.check(id, Number.isFinite(action.aim) ? action.aim : undefined) ? '¡Ajá! Aquí había un pana.' : 'Nada por aquí… Prueba con otro objeto.');
    }
    this.state = this.game.snapshot(); this.onState(this.state);
  }
  practice() {
    this.state = new HuntRound(this.state.mapId, this.state).snapshot();
    super.practice('Práctica con 3 panas de la máquina.');
  }
}
