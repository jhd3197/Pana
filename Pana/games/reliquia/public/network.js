import { Expedition } from './rules.js';
import { HostRoom } from '/engine/net.js';

// Host-simulated expedition on the shared host room (engine/net.js), with snapshot migration.
export class ExpeditionRoom extends HostRoom {
  constructor({ code, name, avatar, onState, onStatus, onNotice }) {
    super({ game: 'reliquia', protocol: 'reliquia-v1', code, name, avatar, onState, onStatus, onNotice, texts: {
      connecting: 'Conectando con la expedición…', full: 'Sala llena. Abre otra expedición desde Pana.',
      lost: 'Se cortó la conexión. Reconectando…', offline: 'Sin conexión. Puedes abrir una expedición local.' } });
    this.inputs = new Map(); this.state = new Expedition().snapshot(); this.seq = 0;
  }
  statusText() { return `Sala ${this.code} · ${this.members.size} pana${this.members.size === 1 ? '' : 's'}`; }
  // A new identity does not resurrect a stale expedition from a deleted room.
  entered(alone) { if (alone) this.state = new Expedition().snapshot(); }
  takeOver(previous) {
    this.game = new Expedition(); this.inputs.clear();
    if (this.state.phase !== 'lobby') this.game.restore(this.state, this.members);
    for (const p of this.members.values()) this.game.addPlayer(p.id, p.name, p.id === this.id ? this.avatar : p.avatar || this.state.players.find(q => q.id === p.id)?.avatar || {});
    this.publish(); if (previous != null) this.onNotice('Cambió el anfitrión. La expedición continúa.');
  }
  memberJoined(m) { if (this.isHost) { this.game.addPlayer(m.id, m.name, m.avatar); this.publish(); } }
  memberLeft(id) { this.inputs.delete(id); if (this.isHost) { this.game.removePlayer(id); this.publish(); } }
  memberHello(id, m) { if (this.isHost) { this.game.addPlayer(id, m.name, m.avatar); this.publish(); } }
  receive(id, data) {
    if (data.kind === 'snapshot' && id === this.hostId && !this.isHost && data.state?.players) {
      this.state = data.state; this.onState(this.state);
    } else if (data.kind === 'input' && this.isHost) {
      this.inputs.set(id, { x: Number.isFinite(data.x) ? Math.max(-1, Math.min(1, data.x)) : 0, z: Number.isFinite(data.z) ? Math.max(-1, Math.min(1, data.z)) : 0, hold: !!data.hold, sprint: !!data.sprint, at: performance.now() });
    } else if (data.kind === 'action' && this.isHost) this.handle(id, data);
  }
  handle(id, data) {
    if (!Number.isSafeInteger(data.seq) || data.seq <= (this.game.ledger[id] || 0)) return;
    if (data.action === 'start') {
      if (id !== this.hostId || this.game.phase === 'playing') return;
      this.game.ledger[id] = data.seq;
      this.game.start((Date.now() ^ Math.floor(Math.random() * 0xffffffff)) >>> 0 || 1);
    } else this.game.accept(id, data.seq, data.action);
    this.publish();
  }
  action(action) {
    if (!this.connected) { this.onNotice('Espera a reconectar o abre una expedición local.'); return; }
    const data = { kind: 'action', action, seq: ++this.seq };
    if (this.isHost) this.handle(this.id, data); else this.send(data);
  }
  publish() { this.state = this.game.snapshot(); this.onState(this.state); this.send({ kind: 'snapshot', state: this.state }); }
  tick(dt, input, paused = false) {
    if (!this.connected) return;
    if (this.isHost) {
      this.inputs.set(this.id, input);
      for (const [id, value] of this.inputs) if (id !== this.id && performance.now() - value.at > 600) this.inputs.delete(id);
      if (!paused) this.game.update(dt, this.inputs);
      this.publish();
    } else this.send({ kind: 'input', ...input });
  }
  practice() {
    this.state = new Expedition().snapshot(); this.game = null; this.seq = 0; this.inputs.clear();
    super.practice('Expedición local · puedes activar las dos ruedas a tiempo');
  }
}
