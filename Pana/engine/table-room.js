// TableRoom: a host-simulated game whose whole state is one snapshot (Dominó,
// Caída, Ludo, Billar, Bolas Criollas). The host restores the game from the
// last snapshot when it takes over, seats members, applies actions and
// publishes; guests send actions and render snapshots. Bots act on the host.
//
//   class DominoRoom extends TableRoom {
//     constructor(options) {
//       super({ ...options, game: 'domino', protocol: 'domino-v1' }, {
//         fresh: (prev) => ({ ...new DominoGame(Date.now()).snapshot(), mapId: prev?.mapId }),
//         restore: (state, members) => DominoGame.restore(state, members),
//         snapshot: (game) => game.snapshot(),
//         accept: (game, id, data, hostId) => game.accept(id, data, hostId),
//         valid: (state) => state?.players?.length === 4,   // optional
//         practice: (prev) => …,                            // optional, defaults to fresh
//       });
//     }
//     seatMembers() { … }          // put this.members into this.game's seats
//     unseat(id) { … }             // optional: free a departed member's seat
//     step(dt) { … return changed } // optional: bots or physics, host only
//   }
//
// Subclass hooks: seatMembers() (required), unseat(id), step(dt), accepted(),
// rest(). texts.handoff is the notice shown when the host changes.
import { HostRoom } from './net.js';

const TABLE_TEXTS = {
  connecting: 'Conectando con la mesa…',
  full: 'Sala llena. Puedes jugar una partida local.',
  lost: 'Sin conexión. Reconectando…',
  offline: 'No pudimos conectar. Puedes jugar en local.',
  handoff: 'Cambió el anfitrión. La partida continúa.',
  practice: 'Mesa local · tú y tres bots',
  waiting: 'Espera a reconectar o abre una mesa local.',
};

export class TableRoom extends HostRoom {
  constructor(options, { fresh, restore, snapshot, accept, valid = () => true, practice = fresh }) {
    super({ ...options, texts: { ...TABLE_TEXTS, ...options.texts } });
    this.table = { fresh, restore, snapshot, accept, valid, practice };
    this.state = fresh(); this.seq = 0; this.botElapsed = 0; this.snapshotHost = null;
  }

  get seat() { return this.state.players.findIndex(p => p.id === this.id); }

  // A new room never resurrects stale state from an earlier connection.
  entered(alone) { if (alone) this.state = this.table.fresh(this.state); }

  takeOver(previous) {
    this.game = this.table.restore(this.state, this.members); this.botElapsed = 0; this.rest?.();
    this.seatMembers(); this.publish();
    if (previous !== null && this.texts.handoff) this.onNotice(this.texts.handoff);
  }

  memberJoined() { if (this.isHost) { this.seatMembers(); this.publish(); } }
  memberHello() { this.memberJoined(); }
  memberLeft(id) { if (this.isHost) { this.unseat?.(id); this.seatMembers(); this.publish(); } }

  receive(id, data) {
    if (data.kind === 'snapshot' && id === this.hostId && !this.isHost && this.table.valid(data.state)) {
      // The same host never moves backwards; a new host may restart the count.
      if (id === this.snapshotHost && data.state.revision < this.state.revision) return;
      this.snapshotHost = id; this.state = data.state; this.onState(this.state);
    } else if (data.kind === 'action' && this.isHost) {
      // Publish even a refused action, so the sender sees the table as it is.
      if (this.table.accept(this.game, id, data, this.hostId)) { this.botElapsed = 0; this.accepted?.(); }
      this.publish();
    }
  }

  action(action, values = {}) {
    if (!this.connected) { if (this.texts.waiting) this.onNotice(this.texts.waiting); return false; }
    // Continue from the room's ledger, so a reload or a new host never sees a repeated seq.
    this.seq = Math.max(this.seq, this.state.ledger?.[this.id] || 0) + 1;
    const data = { kind: 'action', action, ...values, seq: this.seq, revision: this.state.revision };
    if (!this.isHost) { this.send(data); return true; }
    const ok = this.table.accept(this.game, this.id, data, this.hostId);
    if (ok) { this.botElapsed = 0; this.accepted?.(); }
    this.publish(); return ok;
  }

  publish() { this.state = this.table.snapshot(this.game); this.onState(this.state); this.send({ kind: 'snapshot', state: this.state }); }

  // Call on a timer (game-shell's tick): runs step(dt) on the host and publishes
  // when it reports a change. Paused, offline or a guest: nothing advances.
  tick(dt, paused = false) {
    if (!this.connected || !this.isHost || paused || !this.game) { this.botElapsed = 0; this.rest?.(); return; }
    if (this.step?.(dt)) this.publish();
  }

  // True once a bot's turn has waited `delay` seconds; resets on human turns.
  botReady(dt, botTurn, delay = 1.15) {
    if (!botTurn) { this.botElapsed = 0; return false; }
    this.botElapsed += dt;
    if (this.botElapsed < delay) return false;
    this.botElapsed = 0; return true;
  }

  practice(text = this.texts.practice) {
    this.seq = 0; this.game = null; this.snapshotHost = null; this.state = this.table.practice(this.state);
    super.practice(text);
  }
}
