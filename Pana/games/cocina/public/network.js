import { Kitchen } from './rules.js';
import { HostRoom } from '/engine/net.js';

// The room's host owns the kitchen (engine/net.js); a new host restores the last snapshot.
export class KitchenRoom extends HostRoom {
  constructor({ code, name, avatar, onState, onStatus, onNotice }) {
    super({ game: 'cocina', protocol: 'cocina-v1', code, name, avatar, onState, onStatus, onNotice, texts: {
      connecting: 'Conectando con tus panas…', full: 'Sala llena. Puedes abrir tu propia cocina.',
      lost: 'Se cortó la conexión. Reconectando…', offline: 'Sin conexión. Puedes seguir en una cocina local.' } });
    this.inputs = new Map(); this.actions = new Map(); this.state = new Kitchen().snapshot(); this.seq = 0;
  }
  takeOver(previous) {
    this.game = new Kitchen(); this.inputs.clear(); this.actions.clear();
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
    this.inputs.delete(id); this.actions.delete(id);
    if (this.isHost) { this.game.removePlayer(id); this.game.fillBots(); }
  }
  memberHello(id, m) { if (this.isHost) this.game.addPlayer(id, m.name, m.avatar); }
  receive(id, data) {
    if (data.kind === 'snapshot' && id === this.hostId && !this.isHost) {
      this.state = data.state; this.onState(this.state);
    } else if (data.kind === 'input' && this.isHost) {
      this.inputs.set(id, { x: Number.isFinite(data.x) ? Math.max(-1, Math.min(1, data.x)) : 0, z: Number.isFinite(data.z) ? Math.max(-1, Math.min(1, data.z)) : 0, dash: !!data.dash, at: performance.now() });
    } else if (data.kind === 'action' && this.isHost && Number.isSafeInteger(data.seq)) {
      if (data.seq <= (this.actions.get(id) || 0)) return;
      this.actions.set(id, data.seq); this.handle(id, data);
    } else if (data.kind === 'notice' && id === this.hostId && data.to === this.id) this.onNotice(data.text);
  }
  handle(id, data) {
    let message;
    if (data.action === 'start' && id === this.hostId && this.game.phase !== 'playing') this.game.start(data.helpers !== false);
    else if (data.action === 'interact') message = this.game.interact(id, data.station);
    if (message) { if (id === this.id) this.onNotice(message); else this.send({ kind: 'notice', to: id, text: message }); }
    this.publish();
  }
  action(action, extra = {}) {
    if (!this.connected) { this.onNotice('Espera a reconectar o abre una cocina local.'); return; }
    const data = { kind: 'action', seq: ++this.seq, action, ...extra };
    if (this.isHost) this.handle(this.id, data); else this.send(data);
  }
  publish() { this.state = this.game.snapshot(); this.onState(this.state); this.send({ kind: 'snapshot', state: this.state }); }
  tick(dt, input, paused = false) {
    if (!this.connected) return;
    if (this.isHost) {
      this.inputs.set(this.id, input);
      for (const [id, i] of this.inputs) if (id !== this.id && performance.now() - i.at > 600) this.inputs.delete(id);
      if (!paused) this.game.update(dt, this.inputs);
      this.publish();
    } else this.send({ kind: 'input', ...input });
  }
  practice() { this.state = new Kitchen().snapshot(); super.practice('Cocina local · tú y los ayudantes'); }
}
