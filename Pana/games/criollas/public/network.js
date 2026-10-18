import { HostRoom } from '/engine/net.js';
import { createGame, acceptAction, step, STEP, copy, botPlayer } from './rules.js';

export class CriollasRoom extends HostRoom {
  constructor(options) {
    super({ ...options, game: 'criollas', protocol: 'criollas-v1' });
    this.state = createGame(); this.accumulator = 0; this.broadcastElapsed = 0;
  }
  get seat() { return this.state.players.findIndex(p => p.id === this.id); }
  statusText() { const n = this.members.size; return `${n} pana${n === 1 ? '' : 's'} conectado${n === 1 ? '' : 's'} · ${4 - n} puesto${4 - n === 1 ? '' : 's'} con bots`; }
  entered(alone) { if (alone) this.state = { ...createGame(), target: this.state.target }; }
  takeOver(previous) {
    this.game = copy(this.state); this.accumulator = 0; this.syncPlayers(); this.publish();
    if (previous !== null) this.onNotice('Cambió el anfitrión. La mano continúa.');
  }
  syncPlayers() {
    this.game.players.forEach((p, i) => { if (p.id !== null && !this.members.has(p.id)) this.game.players[i] = botPlayer(i); });
    for (const m of this.members.values()) {
      const p = this.game.players.find(p => p.id === m.id) || this.game.players.find(p => p.id === null);
      if (p) Object.assign(p, { id: m.id, name: m.name, avatar: m.avatar || {} });
    }
    this.game.revision++;
  }
  memberJoined() { if (this.isHost) { this.syncPlayers(); this.publish(); } }
  memberLeft() { if (this.isHost) { this.syncPlayers(); this.publish(); } }
  memberHello() { if (this.isHost) { this.syncPlayers(); this.publish(); } }
  receive(id, data) {
    if (data.kind === 'snapshot' && id === this.hostId && !this.isHost && data.state?.players?.length === 4) {
      this.state = data.state; this.onState(this.state);
    } else if (data.kind === 'action' && this.isHost && acceptAction(this.game, id, data, this.hostId)) this.publish();
  }
  action(action, values = {}) {
    if (!this.connected) return false;
    const data = { kind: 'action', action, ...values, revision: this.state.revision };
    if (!this.isHost) { this.send(data); return true; }
    const ok = acceptAction(this.game, this.id, data, this.hostId);
    if (ok) this.publish(); return ok;
  }
  publish() { this.state = copy(this.game); this.onState(this.state); this.send({ kind: 'snapshot', state: this.state }); }
  tick(dt, paused = false) {
    if (!this.connected || !this.isHost || paused) { this.accumulator = 0; return; }
    this.accumulator += Math.min(.1, dt); this.broadcastElapsed += dt;
    let changed = false;
    while (this.accumulator >= STEP) { changed = step(this.game) || changed; this.accumulator -= STEP; }
    if (changed || (this.game.phase === 'rolling' && this.broadcastElapsed >= .05)) { this.broadcastElapsed = 0; this.publish(); }
  }
  practice() {
    this.state = { ...createGame(), target: this.state.target };
    super.practice('Jugando con bots · tus panas pueden entrar por invitación en una sala online.');
    this.action('start');
  }
}
