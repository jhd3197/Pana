import { DominoGame, chooseMove } from './rules.js';
import { TableRoom } from '/engine/table-room.js';

const keepMap = (prev) => prev?.mapId ? { mapId: prev.mapId } : {};

// Host simulation on the shared table room (engine/table-room.js): empty seats
// are bots, snapshots are event-driven and migrate with the host.
export class DominoRoom extends TableRoom {
  constructor(options) {
    super({ ...options, game: 'domino', protocol: 'domino-v2' }, {
      fresh: (prev) => ({ ...new DominoGame(Date.now()).snapshot(), ...keepMap(prev) }),
      restore: (state, members) => DominoGame.restore(state, members),
      snapshot: (game) => game.snapshot(),
      accept: (game, id, data, hostId) => game.accept(id, data, hostId),
      valid: (state) => [4,6].includes(state?.players?.length),
    });
  }

  seatMembers() {
    for (const m of this.members.values()) this.game.addPlayer(m.id, m.name,
      m.avatar || this.game.players.find(p => p.id === m.id)?.avatar || {});
  }
  unseat(id) { this.game.removePlayer(id); }

  step(dt) {
    const game = this.game;
    const clockChanged=game.clock(dt);
    if (!this.botReady(dt, game.phase === 'playing' && game.players[game.turn].id === null)) return clockChanged;
    const move = chooseMove(game);
    move ? game.play(game.turn, move.tile, move.end) : game.pass(game.turn);
    return true;
  }
}
