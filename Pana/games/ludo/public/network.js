import { TableRoom } from '/engine/table-room.js';
import { LudoGame, chooseMove } from './rules.js';

export class LudoRoom extends TableRoom {
  constructor(options) {
    super({ ...options, game: 'ludo', protocol: 'ludo-v3' }, {
      fresh: prev => ({ ...new LudoGame().snapshot(), ...(prev?.options ? { options: { ...prev.options } } : {}) }),
      restore: (state, members) => LudoGame.restore(state, members),
      snapshot: (game) => game.snapshot(),
      accept: (game, id, data, hostId) => game.accept(id, data, hostId),
      valid: (state) => state?.players?.length === 4,
    });
  }
  seatMembers() { for (const m of this.members.values()) this.game.addPlayer(m.id, m.name, m.avatar); }
  unseat(id) { this.game.removePlayer(id); }
  step(dt) {
    const game = this.game;
    if (!this.botReady(dt, ['playing', 'order'].includes(game.phase) && game.players[game.turn].id === null, .85)) return false;
    game.die ? game.move(chooseMove(game)) : game.roll();
    return true;
  }
}
