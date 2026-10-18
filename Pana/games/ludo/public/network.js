import { HostRoom } from '/engine/net.js';
import { LudoGame, chooseMove } from './rules.js';

export class LudoRoom extends HostRoom {
  constructor(options) {
    super({ ...options, game: 'ludo', protocol: 'ludo-v1' });
    this.state = new LudoGame().snapshot(); this.seq = 0; this.botElapsed = 0;
  }
  get seat() { return this.state.players.findIndex(p => p.id === this.id); }
  entered(alone) { if (alone) this.state = new LudoGame().snapshot(); }
  takeOver() { this.game = LudoGame.restore(this.state, this.members); this.botElapsed = 0; this.publish(); }
  memberJoined() { if (this.isHost) { this.fillSeats(); this.publish(); } }
  memberHello() { this.memberJoined(); }
  memberLeft(id) { if (this.isHost) { this.game.removePlayer(id); this.fillSeats(); this.publish(); } }
  fillSeats() { for (const m of this.members.values()) this.game.addPlayer(m.id, m.name, m.avatar); }
  publish() { this.state = this.game.snapshot(); this.onState(this.state); this.send({ kind: 'snapshot', state: this.state }); }
  receive(id, data) {
    if (data.kind === 'snapshot' && id === this.hostId && !this.isHost && data.state?.players?.length === 4) {
      if (data.state.revision < this.state.revision) return;
      this.state = data.state; this.onState(this.state);
    } else if (data.kind === 'action' && this.isHost) {
      if (this.game.accept(id, data, this.hostId)) this.botElapsed = 0;
      this.publish();
    }
  }
  action(action, values = {}) {
    if (!this.connected) return false;
    this.seq = Math.max(this.seq, this.state.ledger[this.id] || 0) + 1;
    const data = { kind: 'action', action, ...values, seq: this.seq, revision: this.state.revision };
    if (!this.isHost) { this.send(data); return true; }
    const ok = this.game.accept(this.id, data, this.hostId);
    if (ok) this.botElapsed = 0;
    this.publish(); return ok;
  }
  tick(dt, paused = false) {
    if (!this.connected || !this.isHost || paused || this.game.phase !== 'playing' || this.game.players[this.game.turn].id !== null) { this.botElapsed = 0; return; }
    this.botElapsed += dt;
    if (this.botElapsed < .85) return;
    this.botElapsed = 0;
    this.game.die ? this.game.move(chooseMove(this.game)) : this.game.roll();
    this.publish();
  }
  practice() { this.state = new LudoGame().snapshot(); this.seq = 0; super.practice('Mesa local · tú y tres bots'); }
}
