// Round authority stays with the room's host (engine/net.js). All gameplay
// data rides the kit's relay messages under the 'hunt-v1' protocol.
import { HuntRound } from './rules.js';
import { HostRoom } from '/engine/net.js';

export class HuntRoom extends HostRoom {
  constructor({ code, name, avatar, onState, onStatus, onNotice }) {
    super({ game: 'escondidas', protocol: 'hunt-v1', code, name, avatar, onState, onStatus, onNotice, texts: {
      full: 'La sala está llena (8 panas). Puedes practicar sin conexión.',
      offline: 'No pudimos conectar. Puedes practicar sin conexión.' } });
    this.inputs = new Map(); this.seq = 0; this.lastAction = new Map();
    this.state = new HuntRound().snapshot();
  }
  takeOver(previous) {
    this.game = new HuntRound(); this.inputs.clear();
    for (const p of this.members.values()) this.game.addPlayer(p.id, p.name, p.id === this.id ? this.avatar : p.avatar || {});
    this.state = this.game.snapshot(); this.onState(this.state);
    if (previous != null) this.onNotice('Cambió el anfitrión. Preparen una nueva partida.');
  }
  memberJoined(m, already) {
    if (this.isHost) this.game.addPlayer(m.id, m.name, {});
    if (!already) this.onNotice(`${m.name} llegó a la plaza.`);
  }
  memberLeft(id) {
    this.inputs.delete(id); this.lastAction.delete(id);
    if (this.isHost) this.game.removePlayer(id);
  }
  memberHello(id, member) {
    if (!this.isHost) return;
    this.game.addPlayer(id, member.name, member.avatar);
    const p = this.game.players.find(p => p.id === id); if (p) p.avatar = member.avatar;
  }
  receive(id, data) {
    if (data.kind === 'snapshot' && id === this.hostId && !this.isHost) {
      this.state = data.state; this.onState(this.state);
    } else if (data.kind === 'input' && this.isHost) {
      this.inputs.set(id, { x: Number.isFinite(data.x) ? Math.max(-1, Math.min(1, data.x)) : 0,
        z: Number.isFinite(data.z) ? Math.max(-1, Math.min(1, data.z)) : 0, sprint: !!data.sprint, at: performance.now() });
    } else if (data.kind === 'action' && this.isHost && Number.isSafeInteger(data.seq)) {
      if (data.seq <= (this.lastAction.get(id) || 0)) return;
      this.lastAction.set(id, data.seq); this.handleAction(id, data);
    } else if (data.kind === 'notice' && id === this.hostId && data.to === this.id) this.onNotice(data.text);
  }
  notice(id, text) {
    if (id === this.id) this.onNotice(text);
    else this.send({ kind: 'notice', to: id, text });
  }
  handleAction(id, action) {
    if (action.action === 'start' && id === this.hostId) this.game.start(id, action.preference);
    else if (action.action === 'transform') {
      const error = this.game.transform(id, action.prop);
      this.notice(id, error || (action.prop ? '¡Listo! Quédate quieto y pasa desapercibido.' : 'Volviste a ser pana.'));
    } else if (action.action === 'check') {
      const p = this.game.players.find(p => p.id === id);
      if (!p || p.cooldown > 0 || this.game.phase !== 'hunt' || id !== this.game.seeker) return;
      this.notice(id, this.game.check(id) ? '¡Ajá! Aquí había un pana.' : 'Nada por aquí… Prueba con otro objeto.');
    }
    this.state = this.game.snapshot(); this.onState(this.state);
  }
  action(action, extra = {}) {
    if (!this.connected && !this.offline) { this.onNotice('Espera a reconectar o entra a practicar.'); return; }
    const data = { kind: 'action', seq: ++this.seq, action, ...extra };
    if (this.isHost) this.handleAction(this.id, data); else this.send(data);
  }
  tick(dt, input, paused = false) {
    if (!this.connected && !this.offline) return;
    if (this.isHost) {
      this.inputs.set(this.id, input);
      for (const [id, i] of this.inputs) if (id !== this.id && performance.now() - i.at > 600) this.inputs.delete(id);
      if (!paused) this.game.update(dt, this.inputs);
      this.state = this.game.snapshot(); this.onState(this.state);
      this.send({ kind: 'snapshot', state: this.state });
    } else this.send({ kind: 'input', ...input });
  }
  practice() {
    this.state = new HuntRound().snapshot(); this.inputs.clear(); this.lastAction.clear();
    super.practice('Práctica con 3 panas de la máquina.');
  }
}
