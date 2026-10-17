import { DominoGame, chooseMove } from './rules.js';
import { HostRoom } from '/engine/net.js';

// Host simulation on the shared host room (engine/net.js): empty seats are bots,
// snapshots are event-driven and migrate with the host.
export class DominoRoom extends HostRoom {
  constructor({ code, name, avatar, onState = () => {}, onStatus = () => {}, onNotice = () => {} }) {
    super({ game: 'domino', protocol: 'domino-v1', code, name, avatar, onState, onStatus, onNotice, texts: {
      connecting: 'Conectando con la mesa…', full: 'Sala llena. Puedes jugar una partida local.',
      lost: 'Sin conexión. Reconectando…', offline: 'No pudimos conectar. Puedes jugar en local.' } });
    this.state = new DominoGame(Date.now()).snapshot(); this.seq = 0; this.botElapsed = 0;
  }
  get seat() { return this.state.players.findIndex(p => p.id === this.id); }

  // A new room never resurrects stale state from an earlier connection.
  entered(alone) { if (alone) this.state = new DominoGame(Date.now()).snapshot(); }

  takeOver(previous) {
    this.game = DominoGame.restore(this.state, this.members); this.botElapsed = 0;
    this.publish();
    if (previous !== null) this.onNotice('Cambió el anfitrión. La partida continúa.');
  }

  memberJoined(m) {
    if (!this.isHost) return;
    this.game.addPlayer(m.id, m.name, m.avatar); this.publish();
  }

  memberLeft(id) { if (this.isHost) { this.game.removePlayer(id); this.fillSeats(); this.publish(); } }

  memberHello() { if (this.isHost) { this.fillSeats(); this.publish(); } }

  fillSeats() {
    for (const m of this.members.values()) this.game.addPlayer(m.id, m.name,
      m.avatar || this.game.players.find(p => p.id === m.id)?.avatar || {});
  }

  receive(id, data) {
    if (data.kind === 'snapshot' && id === this.hostId && !this.isHost && data.state?.players?.length === 4) {
      this.state = data.state; this.onState(this.state);
    } else if (data.kind === 'action' && this.isHost) {
      this.game.accept(id, data, this.hostId); this.botElapsed = 0; this.publish();
    }
  }

  action(action, values = {}) {
    if (!this.connected) { this.onNotice('Espera a reconectar o abre una mesa local.'); return false; }
    const data = { kind: 'action', action, ...values, seq: ++this.seq, revision: this.state.revision };
    if (this.isHost) {
      const ok = this.game.accept(this.id, data, this.hostId);
      this.botElapsed = 0; this.publish(); return ok;
    }
    this.send(data); return true;
  }

  publish() { this.state = this.game.snapshot(); this.onState(this.state); this.send({ kind: 'snapshot', state: this.state }); }

  tick(dt, paused = false) {
    if (!this.connected || !this.isHost || this.game.phase !== 'playing' || paused || this.game.players[this.game.turn].id !== null) {
      this.botElapsed = 0; return;
    }
    this.botElapsed += dt;
    if (this.botElapsed < 1.15) return;
    this.botElapsed = 0;
    const move = chooseMove(this.game);
    move ? this.game.play(this.game.turn, move.tile, move.end) : this.game.pass(this.game.turn);
    this.publish();
  }

  practice() {
    this.seq = 0; this.game = null; this.state = { ...new DominoGame(Date.now()).snapshot(), mapId: this.state.mapId };
    super.practice('Mesa local · tú y tres bots');
  }
}
