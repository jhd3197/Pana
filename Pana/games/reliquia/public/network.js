import { Expedition } from './rules.js';
import { LiveRoom, axis } from '/engine/live-room.js';

// Host-simulated expedition on the shared live room (engine/live-room.js), with snapshot migration.
export class ExpeditionRoom extends LiveRoom {
  constructor(options) {
    super({ ...options, game: 'reliquia', protocol: 'reliquia-v2', texts: {
      connecting: 'Conectando con la expedición…', full: 'Sala llena. Abre otra expedición desde Pana.',
      lost: 'Se cortó la conexión. Reconectando…', offline: 'Sin conexión. Puedes abrir una expedición local.',
      waiting: 'Espera a reconectar o abre una expedición local.' } }, { valid: (state) => !!state?.players });
    this.state = new Expedition().snapshot();
  }
  statusText() { return `Sala ${this.code} · ${this.members.size} pana${this.members.size === 1 ? '' : 's'}`; }
  cleanInput(raw) { return { x: axis(raw?.x), z: axis(raw?.z), hold: !!raw?.hold, sprint: !!raw?.sprint }; }
  // A new identity does not resurrect a stale expedition from a deleted room.
  entered(alone) { if (alone) this.state = new Expedition().snapshot(); }
  takeOver(previous) {
    super.takeOver(previous);
    this.game = new Expedition(1, this.state.options);
    if (this.state.phase !== 'lobby') this.game.restore(this.state, this.members);
    for (const p of this.members.values()) this.game.addPlayer(p.id, p.name, p.id === this.id ? this.avatar : p.avatar || this.state.players.find(q => q.id === p.id)?.avatar || {});
    this.publish(); if (previous != null) this.onNotice('Cambió el anfitrión. La expedición continúa.');
  }
  memberJoined(m) { if (this.isHost) { this.game.addPlayer(m.id, m.name, m.avatar); this.publish(); } }
  memberLeft(id) { super.memberLeft(id); if (this.isHost) { this.game.removePlayer(id); this.publish(); } }
  memberHello(id, m) { if (this.isHost) { this.game.addPlayer(id, m.name, m.avatar); this.publish(); } }
  // The expedition's own ledger also travels in snapshots, so a new host never
  // replays an action the old one already applied.
  handle(id, data) {
    if (data.seq <= (this.game.ledger[id] || 0)) return;
    if (data.action === 'configure') { if (id !== this.hostId || !this.game.configure(data.options)) return; this.game.ledger[id] = data.seq; }
    else if (data.action === 'start') {
      if (id !== this.hostId || this.game.phase === 'playing') return;
      this.game.ledger[id] = data.seq;
      this.game.start((Date.now() ^ Math.floor(Math.random() * 0xffffffff)) >>> 0 || 1);
    } else this.game.accept(id, data.seq, data.action);
    this.publish();
  }
  practice() {
    this.state = new Expedition(1, this.state.options).snapshot(); this.game = null;
    super.practice('Expedición local · puedes activar las dos ruedas a tiempo');
  }
}
