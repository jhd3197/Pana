import { TableRoom } from '/engine/table-room.js';
import { createGame, acceptAction, step, STEP, copy, botPlayer } from './rules.js';
import { loc, locn } from '/engine/i18n.js';

// The table setting (goal, place, difficulty) survives new rooms and practice.
const keepTarget = (prev) => prev ? { ...createGame(), target: prev.target, ballsPerPlayer: prev.ballsPerPlayer || 4, remaining: Array(6).fill(prev.ballsPerPlayer || 4), mapId: prev.mapId || 'plaza', difficulty: prev.difficulty || 'normal', opener: prev.opener || 'cacho' } : createGame();

export class CriollasRoom extends TableRoom {
  constructor(options) {
    super({ ...options, game: 'criollas', protocol: 'criollas-v3', texts: {
      handoff: loc('Cambió el anfitrión. La mano continúa.'),
      practice: loc('Jugando con bots · tus panas pueden entrar por invitación en una sala online.'), ...options.texts } }, {
      fresh: keepTarget,
      practice: (prev) => ({ ...keepTarget(prev), local: true }),
      restore: (state) => copy(state),
      snapshot: copy,
      accept: acceptAction,
      valid: (state) => state?.players?.length === 6,
    });
    this.accumulator = 0; this.broadcastElapsed = 0;
  }
  statusText() { const n = this.members.size; return locn(n, '{n} pana conectado · {bots}', '{n} panas conectados · {bots}', { bots: locn(6 - n, '{n} puesto con bots', '{n} puestos con bots') }); }
  seatMembers() {
    this.game.players.forEach((p, i) => { if (p.id !== null && !this.members.has(p.id)) this.game.players[i] = botPlayer(i); });
    for (const m of this.members.values()) {
      const p = this.game.players.find(p => p.id === m.id) || this.game.players.find(p => p.id === null);
      if (p) Object.assign(p, { id: m.id, name: m.name, avatar: m.avatar || {} });
    }
    this.game.revision++;
  }
  // Fixed physics steps (bots aim inside rules.step); ~20 snapshots a second while rolling.
  step(dt) {
    this.accumulator += Math.min(.1, dt); this.broadcastElapsed += dt;
    let changed = false;
    while (this.accumulator >= STEP) { changed = step(this.game) || changed; this.accumulator -= STEP; }
    if (!changed && !(this.game.phase === 'rolling' && this.broadcastElapsed >= .05)) return false;
    this.broadcastElapsed = 0; return true;
  }
  rest() { this.accumulator = 0; }
  practice() { super.practice(); this.action('start'); }
}
