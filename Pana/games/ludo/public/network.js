import { automaticMoveDelay } from './dice-timing.js';
import { TableRoom } from '/engine/table-room.js';
import { loc } from '/engine/i18n.js';
import { LudoGame, SEAT_CHOICES, chooseMove } from './rules.js';

export class LudoRoom extends TableRoom {
  constructor(options) {
    super({ ...options, game: 'ludo', protocol: 'ludo-v6' }, {
      // A new table keeps the lobby's settings, its seat count included.
      fresh: prev => { const game = new LudoGame(Date.now(), prev?.options?.seats); if (prev?.options) game.options = { ...prev.options, seats: game.players.length }; return game.snapshot(); },
      restore: (state, members) => LudoGame.restore(state, members),
      snapshot: (game) => game.snapshot(),
      accept: (game, id, data, hostId) => game.accept(id, data, hostId),
      valid: (state) => SEAT_CHOICES.includes(state?.players?.length),
    });
  }
  seatMembers() { for (const m of this.members.values()) this.game.addPlayer(m.id, m.name, m.avatar); }
  unseat(id) { this.game.removePlayer(id); }
  // A local table keeps the lobby's seat count: you and three to five bots.
  practice() { super.practice(loc('Mesa local · tú y {n} bots', { n: this.state.players.length - 1 })); }
  step(dt) {
    const game = this.game;
    if (game.phase === 'starter') return game.stepStarter(dt);
    if (game.turnPause) { this.botElapsed = 0; return game.stepPause(dt); }
    if (game.autoMove) return game.stepAutomatic(dt);
    if (!this.offline && game.stepIdle(dt)) return true;   // local play waits for you
    if (!this.botReady(dt, game.phase === 'playing' && game.players[game.turn].id === null, game.die ? automaticMoveDelay(game.toss.power) : 1.15)) return false;
    game.die ? game.move(chooseMove(game)) : game.roll();
    return true;
  }
}
