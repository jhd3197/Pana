import { TableRoom } from '/engine/table-room.js';
import { QuizGame } from './rules.js';

// Host simulation on the shared table room (engine/table-room.js): empty
// podiums are bots, the host runs the clock and keeps every answer secret
// until the reveal (rules.js snapshot()).
export class QqsmpRoom extends TableRoom {
  constructor(options) {
    super({ ...options, game: 'qqsmp', protocol: 'qqsmp-v1',
      texts: { connecting: 'Conectando con el estudio…', practice: 'Estudio local · tú y cinco bots', handoff: 'Cambió el anfitrión. El concurso sigue.' } }, {
      fresh: prev => ({ ...new QuizGame().snapshot(), ...(prev?.options ? { options: { ...prev.options } } : {}) }),
      restore: (state, members) => QuizGame.restore(state, members),
      snapshot: (game) => game.snapshot(),
      accept: (game, id, data, hostId) => game.accept(id, data, hostId),
      valid: (state) => Array.isArray(state?.players),
    });
  }
  seatMembers() { for (const m of this.members.values()) this.game.addPlayer(m.id, m.name, m.avatar || {}); }
  unseat(id) { this.game.removePlayer(id); }
  // The host's clock: bots, the timer, the pause and the reveal all advance here.
  step(dt) { return this.game.tick(dt); }
}
