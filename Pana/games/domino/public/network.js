import { journalGame, verifyPacket, plainState } from './replay.js';
import { botDelay } from './bot-personas.js';
import { DominoGame, chooseMove } from './rules.js';
import { TableRoom } from '/engine/table-room.js';

const keepMap = (prev) => prev?.mapId ? { mapId: prev.mapId } : {};

// Host simulation on the shared table room (engine/table-room.js): empty seats
// are bots, snapshots are event-driven and migrate with the host.
export class DominoRoom extends TableRoom {
  constructor(options) {
    super({ ...options, game: 'domino', protocol: 'domino-v4' }, {
      fresh: (prev) => ({ ...new DominoGame(Date.now()).snapshot(), ...keepMap(prev) }),
      restore: (state) => Object.assign(new DominoGame(), plainState(state)),
      snapshot: (game) => game.snapshot(),
      accept: (game, id, data, hostId) => game.accept(id, data, hostId),
      valid: (state) => [4,6].includes(state?.players?.length),
    });
    this.epochCounter = 0;
  }

  takeOver(previous) {
    const state = plainState(this.state);
    this.journal = journalGame(state, `${this.id}:${this.state.revision}:${++this.epochCounter}`);
    this.game = this.journal.game; this.botElapsed = 0;
    for (const p of this.game.players) if (p.id !== null && !this.members.has(p.id)) this.game.removePlayer(p.id);
    this.seatMembers(); this.publish();
    if (previous !== null) this.onNotice(this.texts.handoff);
  }
  publish() {
    this.state = this.journal.packet(); this.onState(this.state);
    this.verified = { epoch:this.state.audit.epoch, seq:this.state.audit.base + this.state.audit.events.length, state:plainState(this.state) };
    this.send({ kind:'snapshot', state:this.state });
  }
  receive(id, data) {
    if (data.kind === 'replay-request' && this.isHost && this.members.has(id)) {
      this.send({kind:'snapshot', state:this.journal.packet(true), recovery:true},id); return;
    }
    if (data.kind === 'snapshot' && id === this.hostId && !this.isHost) {
      const verified = verifyPacket(this.verified, data.state, id, this.members, !this.verified);
      if (!verified) {
        this.auditFailures = (this.auditFailures || 0) + 1;
        if (!data.recovery && !this.recovering) { this.recovering = true; this.send({kind:'replay-request'},'host'); }
        if (data.recovery) { this.recovering = false; this.onNotice('No pudimos verificar la jugada. Reconecta para recuperar la mesa.'); }
        return;
      }
      this.recovering = false;
      this.verified = verified;
    }
    super.receive(id,data);
  }
  entered(alone) { this.verified = null; super.entered(alone); }
  practice(text) { this.verified = null; super.practice(text); }

  seatMembers() {
    for (const m of this.members.values()) this.game.addPlayer(m.id, m.name,
      m.avatar || this.game.players.find(p => p.id === m.id)?.avatar || {});
  }
  unseat(id) { this.game.removePlayer(id); }

  step(dt) {
    const game = this.game;
    if (game.phase === 'starter') return game.stepCachos(dt);
    const clockChanged=game.clock(dt);
    if (!this.botReady(dt, game.phase === 'playing' && game.players[game.turn].id === null, botDelay(game))) return clockChanged;
    const move = chooseMove(game);
    move ? game.play(game.turn, move.tile, move.end) : game.pass(game.turn);
    return true;
  }
}
