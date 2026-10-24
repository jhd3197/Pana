import { TableRoom } from '/engine/table-room.js';
import { createGame, acceptAction, step, STEP, snapshot, botShot, botPlacement, BOT_ID, advanceShotClock, stepPoolStarter } from './rules.js';

// The table setting (map, difficulty) survives new rooms and practice.
const keepMap = (prev) => ({ ...(prev?.mapId ? { mapId: prev.mapId } : {}), ...(prev?.difficulty ? { difficulty: prev.difficulty } : {}), ...(prev?.options ? { options: { ...prev.options } } : {}) });

export class PoolRoom extends TableRoom {
  constructor(options) {
    super({ ...options, game: 'billar', protocol: 'billar-v3', texts: {
      handoff: 'Cambió el anfitrión. La mesa continúa.', practice: 'Mesa de práctica · juega a tu ritmo', ...options.texts } }, {
      fresh: (prev) => ({ ...createGame(), ...keepMap(prev) }),
      // Solo practice clears the rack alone; versusBot() puts Pana Bot across the table.
      practice: (prev) => ({ ...createGame(true, { bot: this.opponent === 'bot' }), ...keepMap(prev) }),
      restore: (state) => snapshot(state),
      snapshot,
      accept: acceptAction,
      valid: (state) => state?.balls?.length === 16 && state.players?.length === 6 && !!state.options && Array.isArray(state.activeSeats),
    });
    this.accumulator = 0; this.broadcastElapsed = 0;
  }
  seatMembers() {
    for (const p of this.game.players) if (!p.bot && !this.members.has(p.id)) { p.id = null; p.name = 'Esperando pana'; }
    for (const m of this.members.values()) {
      const p = this.game.players.find(p => p.id === m.id)
        || this.game.activeSeats.map(i => this.game.players[i]).find(p => p.id === null)
        || this.game.players.slice(0, this.game.options.format === 'duel' ? 2 : 6).find(p => p.id === null);
      if (p) Object.assign(p, { id: m.id, name: m.name, avatar: m.avatar || {} });
    }
  }
  // Fixed physics steps while the balls roll; ~20 snapshots a second.
  step(dt) {
    const g = this.game;
    if (g.phase === 'starter') return stepPoolStarter(g, dt);
    if (advanceShotClock(g, dt)) return true;
    if (this.botReady(dt, g.phase === 'aiming' && !!g.players[g.turn].bot, g.ballInHand ? .7 : 1.4)) {
      // Ball in hand is its own visible step; the shot follows after another pause.
      if (g.ballInHand) return acceptAction(g, BOT_ID, { action: 'place', revision: g.revision, ...botPlacement(g) }, this.hostId);
      return acceptAction(g, BOT_ID, { action: 'shoot', revision: g.revision, ...botShot(g) }, this.hostId);
    }
    if (this.game.phase !== 'rolling') {
      this.accumulator = 0; this.broadcastElapsed += dt;
      if (g.phase === 'aiming' && g.options.shotSeconds && this.broadcastElapsed >= .2) { this.broadcastElapsed = 0; return true; }
      return false;
    }
    this.accumulator += Math.min(.1, dt); this.broadcastElapsed += dt;
    let ended = false;
    while (this.accumulator >= STEP && this.game.phase === 'rolling') { ended = step(this.game) || ended; this.accumulator -= STEP; }
    if (!ended && this.broadcastElapsed < .05) return false;
    this.broadcastElapsed = 0; return true;
  }
  rest() { this.accumulator = 0; }
  practice() { this.opponent = null; super.practice(); this.action('start'); }
  versusBot() { this.opponent = 'bot'; super.practice('Contra Pana Bot · cambia la dificultad en el menú.'); this.action('start'); }
}
