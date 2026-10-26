import { TableRoom } from '/engine/table-room.js';
import { StopGame } from './rules.js';

// Host simulation on the shared table room (engine/table-room.js): empty
// chairs are bots, the host runs the clock, and sheets stay off the wire
// until pencils-down (rules.js snapshot()).
export class StopRoom extends TableRoom {
  constructor(options) {
    super({ ...options, game: 'stop', protocol: 'stop-v1',
      texts: { connecting: 'Conectando con la mesa…', practice: 'Mesa local · tú y siete bots', handoff: 'Cambió el anfitrión. La libreta sigue.' } }, {
      fresh: prev => ({ ...new StopGame().snapshot(), ...(prev?.options ? { options: { ...prev.options } } : {}), ...(Array.isArray(prev?.custom) ? { custom: [...prev.custom] } : {}) }),
      restore: (state, members) => StopGame.restore(state, members),
      snapshot: (game) => game.snapshot(),
      accept: (game, id, data, hostId) => game.accept(id, data, hostId),
      valid: (state) => Array.isArray(state?.players),
    });
  }
  seatMembers() { for (const m of this.members.values()) this.game.addPlayer(m.id, m.name, m.avatar || {}); }
  unseat(id) { this.game.removePlayer(id); }
  // The host's clock: the wheel, the writing timer, bots, votes and the review.
  step(dt) { return this.game.tick(dt); }
}
