import { automaticMoveDelay, createLandingGate, hostTick, pauseTick, rollKey } from './dice-timing.js';
import { TableRoom } from '/engine/table-room.js';
import { loc } from '/engine/i18n.js';
import { LudoGame, SEAT_CHOICES, chooseMove } from './rules.js';

export class LudoRoom extends TableRoom {
  constructor(options) {
    super({ ...options, game: 'ludo', protocol: 'ludo-v7' }, {
      // A new table keeps the lobby's settings, its seat count included.
      fresh: prev => { const game = new LudoGame(Date.now(), prev?.options?.seats); if (prev?.options) game.options = { ...prev.options, seats: game.players.length }; return game.snapshot(); },
      restore: (state, members) => LudoGame.restore(state, members),
      snapshot: (game) => game.snapshot(),
      accept: (game, id, data, hostId) => game.accept(id, data, hostId),
      valid: (state) => SEAT_CHOICES.includes(state?.players?.length),
    });
    this.landings = createLandingGate(); this.reportedRoll = null;
  }
  receive(id, data) {
    if (data.kind !== 'landed') return super.receive(id, data);
    if (this.isHost && this.game && data.roll === rollKey(this.game)) this.landings.land(data.roll, id);
  }
  // This client's die is down: the host starts the result's beat once all of them are.
  dieLanded() {
    const roll = rollKey(this.state);
    if (roll === this.reportedRoll) return;
    this.reportedRoll = roll;
    if (this.isHost) this.landings.land(roll, this.id); else this.send({ kind: 'landed', roll }, 'host');
  }
  seatMembers() { for (const m of this.members.values()) this.game.addPlayer(m.id, m.name, m.avatar); }
  unseat(id) { this.game.removePlayer(id); }
  // A local table keeps the lobby's seat count: you and three to five bots.
  practice() { super.practice(loc('Mesa local · tú y {n} bots', { n: this.state.players.length - 1 })); }
  step(seconds) {
    const game = this.game, dt = hostTick(seconds);
    if (game.phase === 'starter') return game.stepStarter(dt);
    if (game.turnPause) { this.botElapsed = 0; return game.stepPause(this.landings.spend(rollKey(game), game.turnPause, this.members.keys(), seconds)); }
    if (game.autoMove) return game.stepAutomatic(pauseTick(game.autoMove.remaining, seconds));
    if (!this.offline && game.stepIdle(dt)) return true;   // local play waits for you
    if (!this.botReady(dt, game.phase === 'playing' && game.players[game.turn].id === null, game.die ? automaticMoveDelay(game.toss.power) : 1.15)) return false;
    game.die ? game.move(chooseMove(game)) : game.roll();
    return true;
  }
}
