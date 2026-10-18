import { HostRoom } from '/engine/net.js';
import { createGame, acceptAction, step, STEP, snapshot } from './rules.js';

export class PoolRoom extends HostRoom {
  constructor(options) {
    super({ ...options, game: 'billar', protocol: 'billar-v1' });
    this.state = createGame(); this.accumulator = 0; this.broadcastElapsed = 0;
  }
  get seat() { return this.state.players.findIndex(p => p.id === this.id); }
  entered(alone) { if (alone) this.state = createGame(); }
  takeOver(previous) {
    this.game = snapshot(this.state); this.accumulator = 0; this.syncPlayers(); this.publish();
    if (previous !== null) this.onNotice('Cambió el anfitrión. La mesa continúa.');
  }
  syncPlayers() {
    for (const p of this.game.players) if (!this.members.has(p.id)) { p.id = null; p.name = 'Esperando pana'; }
    for (const m of this.members.values()) {
      const p = this.game.players.find(p => p.id === m.id) || this.game.players.find(p => p.id === null);
      if (p) Object.assign(p, { id: m.id, name: m.name, avatar: m.avatar || {} });
    }
  }
  memberJoined() { if (this.isHost) { this.syncPlayers(); this.publish(); } }
  memberLeft() { if (this.isHost) { this.syncPlayers(); this.publish(); } }
  memberHello() { if (this.isHost) { this.syncPlayers(); this.publish(); } }
  receive(id, data) {
    if (data.kind === 'snapshot' && id === this.hostId && !this.isHost && data.state?.balls?.length === 16) {
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
  publish() { this.state = snapshot(this.game); this.onState(this.state); this.send({ kind: 'snapshot', state: this.state }); }
  tick(dt, paused = false) {
    if (!this.connected || !this.isHost || paused || this.game.phase !== 'rolling') { this.accumulator = 0; return; }
    this.accumulator += Math.min(.1, dt); this.broadcastElapsed += dt;
    let ended = false;
    while (this.accumulator >= STEP && this.game.phase === 'rolling') { ended = step(this.game) || ended; this.accumulator -= STEP; }
    if (ended || this.broadcastElapsed >= .05) { this.broadcastElapsed = 0; this.publish(); }
  }
  practice() {
    this.state = { ...createGame(true), mapId: this.state.mapId }; super.practice('Mesa de práctica · juega a tu ritmo');
    this.action('start');
  }
}
