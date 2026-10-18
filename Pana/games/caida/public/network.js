import { CaidaGame, chooseMove, canto } from './rules.js';
import { TableRoom } from '/engine/table-room.js';

const keepMap = (prev) => prev?.mapId ? { mapId: prev.mapId } : {};

// Host simulation on the shared table room (engine/table-room.js), with snapshot migration.
export class CaidaRoom extends TableRoom {
  constructor(options) {
    super({ ...options, game: 'caida', protocol: 'caida-v1', texts: { practice: 'Mesa local · juega con bots', ...options.texts } }, {
      fresh: (prev) => ({ ...new CaidaGame(Date.now()).snapshot(), ...keepMap(prev) }),
      restore: (state, members) => CaidaGame.restore(state, members),
      snapshot: (game) => game.snapshot(),
      accept: (game, id, data, hostId) => game.accept(id, data, hostId),
      valid: (state) => [2, 3, 4].includes(state?.players?.length),
    });
  }

  seatMembers() {
    for (const m of this.members.values()) this.game.addPlayer(m.id, m.name,
      m.avatar || this.game.players.find(p => p.id === m.id)?.avatar || {});
  }
  unseat(id) { this.game.removePlayer(id); }
  // Changing the table size reseats everyone.
  accepted() { this.seatMembers(); }

  step(dt) {
    const game = this.game, preparing = game.phase === 'dealing', seat = preparing ? game.dealer : game.turn;
    if (!this.botReady(dt, ['playing', 'dealing'].includes(game.phase) && game.players[seat].id === null)) return false;
    if (preparing) {
      if (!game.dealCall) game.setCall(seat, game.random() < .5 ? 'up' : 'down');
      if (game.cutAt === null) game.cutDeck(seat, 1 + Math.floor(game.random() * 39));
      else game.dealOpening(seat);
      return true;
    }
    const player = game.players[game.turn];
    if (game.options.cantos && !player.announced && canto(player.hand)) game.chant(game.turn);
    else { const move = chooseMove(game); if (move) game.play(game.turn, move.card); }
    return true;
  }
}
