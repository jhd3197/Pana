import { CaidaGame, chooseMove, canto } from './rules.js';
import { TableRoom } from '/engine/table-room.js';
import { loc } from '/engine/i18n.js';

const freshGame = previous => { const game = new CaidaGame(Date.now()); if (previous?.options) { const { format, cantos, difficulty, starter } = previous.options; game.configure({ format: format || 'individual', cantos, difficulty, ...(starter ? { starter } : {}), mapId: previous.mapId || 'plaza' }); } return game.snapshot(); };

// Host simulation on the shared table room (engine/table-room.js), with snapshot migration.
export class CaidaRoom extends TableRoom {
  constructor(options) {
    super({ ...options, game: 'caida', protocol: 'caida-v4', texts: { practice: loc('Mesa local · juega con bots'), ...options.texts } }, {
      fresh: freshGame,
      restore: (state, members) => CaidaGame.restore(state, members),
      snapshot: (game) => game.snapshot(),
      accept: (game, id, data, hostId) => game.accept(id, data, hostId),
      valid: (state) => [2, 3, 4, 6].includes(state?.players?.length),
    });
  }

  seatMembers() {
    this.game.syncMembers([...this.members.values()]);
  }
  unseat(id) { this.game.removePlayer(id); }
  // Changing the table size reseats everyone.
  accepted() { this.seatMembers(); }

  step(dt) {
    if (this.game.phase === 'starter') return this.game.stepStarter(dt);
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
