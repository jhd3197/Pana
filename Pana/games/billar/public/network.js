import { TableRoom } from '/engine/table-room.js';
import { createGame, acceptAction, step, STEP, snapshot } from './rules.js';

const keepMap = (prev) => prev?.mapId ? { mapId: prev.mapId } : {};

export class PoolRoom extends TableRoom {
  constructor(options) {
    super({ ...options, game: 'billar', protocol: 'billar-v1', texts: {
      handoff: 'Cambió el anfitrión. La mesa continúa.', practice: 'Mesa de práctica · juega a tu ritmo', ...options.texts } }, {
      fresh: (prev) => ({ ...createGame(), ...keepMap(prev) }),
      practice: (prev) => ({ ...createGame(true), ...keepMap(prev) }),
      restore: (state) => snapshot(state),
      snapshot,
      accept: acceptAction,
      valid: (state) => state?.balls?.length === 16,
    });
    this.accumulator = 0; this.broadcastElapsed = 0;
  }
  seatMembers() {
    for (const p of this.game.players) if (!this.members.has(p.id)) { p.id = null; p.name = 'Esperando pana'; }
    for (const m of this.members.values()) {
      const p = this.game.players.find(p => p.id === m.id) || this.game.players.find(p => p.id === null);
      if (p) Object.assign(p, { id: m.id, name: m.name, avatar: m.avatar || {} });
    }
  }
  // Fixed physics steps while the balls roll; ~20 snapshots a second.
  step(dt) {
    if (this.game.phase !== 'rolling') { this.accumulator = 0; return false; }
    this.accumulator += Math.min(.1, dt); this.broadcastElapsed += dt;
    let ended = false;
    while (this.accumulator >= STEP && this.game.phase === 'rolling') { ended = step(this.game) || ended; this.accumulator -= STEP; }
    if (!ended && this.broadcastElapsed < .05) return false;
    this.broadcastElapsed = 0; return true;
  }
  rest() { this.accumulator = 0; }
  practice() { super.practice(); this.action('start'); }
}
