import { automaticMoveDelay } from './dice-timing.js';
import { TableRoom } from '/engine/table-room.js';
import { LudoGame, chooseMove } from './rules.js';

export class LudoRoom extends TableRoom {
  constructor(options) {
    super({ ...options, game: 'ludo', protocol: 'ludo-v5' }, {
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
    if (game.phase === 'starter') return game.stepStarter(dt);
    if (game.turnPause) { this.botElapsed = 0; return game.stepPause(dt); }
    if (game.autoMove) return game.stepAutomatic(dt);
    if (!this.botReady(dt, game.phase === 'playing' && game.players[game.turn].id === null, game.die ? automaticMoveDelay(game.toss.power) : 1.15)) return false;
    game.die ? game.move(chooseMove(game)) : game.roll();
    return true;
  }
}
