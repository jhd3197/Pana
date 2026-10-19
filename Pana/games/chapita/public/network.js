import { TableRoom } from '/engine/table-room.js';
import { ChapitaGame } from './rules.js';

// Host simulation on the shared table room (engine/table-room.js): empty seats
// are bots, snapshots are event-driven and migrate with the host. The host's
// advance(dt) runs bots, the pitch clock and the flights; it publishes only
// when something changed.
export class ChapitaRoom extends TableRoom {
  constructor(options) {
    super({ ...options, game: 'chapita', protocol: 'chapita-v1', texts: { practice: 'Calle local · tú y siete bots' } }, {
      fresh: prev => ({ ...new ChapitaGame().snapshot(), ...(prev?.options ? { options: { ...prev.options } } : {}) }),
      restore: (state, members) => ChapitaGame.restore(state, members),
      snapshot: (game) => game.snapshot(),
      accept: (game, id, data, hostId) => game.accept(id, data, hostId),
      valid: (state) => Array.isArray(state?.players) && Array.isArray(state?.teams),
    });
  }
  seatMembers() { for (const m of this.members.values()) this.game.addPlayer(m.id, m.name, m.avatar || {}); }
  unseat(id) { this.game.removePlayer(id); }
  // The shell ticks about every 100 ms (once a second in a background tab):
  // step in short slices so no swing or catch window is jumped over.
  step(dt) {
    let changed = false;
    for (let left = Math.min(dt, 2); left > 1e-6; left -= .05) changed = this.game.advance(Math.min(.05, left)) || changed;
    return changed;
  }
}
