import { LiveRoom } from '/engine/live-room.js';
import { Rueda, cleanInput } from './rules.js';

// Host simulation on the shared live room (engine/live-room.js). The host
// steps the rueda with everyone's latest counters and publishes each tick; a
// new host continues from the last snapshot. Everyone shares the server
// clock (`clock()`), so a song's start time means the same beat everywhere.
export class TamborRoom extends LiveRoom {
  constructor(options) {
    super({ ...options, game: 'tambor', protocol: 'tambor-v1' }, { valid: (state) => Array.isArray(state?.players) });
    this.state = new Rueda().snapshot();
  }
  clock() { return this.link?.now?.() ?? Date.now(); }
  cleanInput(raw) { return cleanInput(raw); }
  takeOver(previous) {
    super.takeOver(previous);
    this.game = Rueda.restore(this.state, this.members);
    this.game.now = this.clock();
    for (const m of this.members.values()) this.game.addPlayer(m.id, m.name, m.id === this.id ? this.avatar : m.avatar || {});
    this.publish();
    if (previous != null) this.onNotice('Cambió el anfitrión. La rueda sigue.');
  }
  memberJoined(m) { if (this.isHost) { this.game.addPlayer(m.id, m.name, m.avatar || {}); this.publish(); } }
  memberHello(id, m) { this.memberJoined(m); }
  memberLeft(id) { super.memberLeft(id); if (this.isHost) { this.game.now = this.clock(); this.game.removePlayer(id); this.publish(); } }
  handle(id, data) {
    const game = this.game;
    game.now = this.clock();
    if (data.action === 'options' && id === this.hostId && game.configure(data.options)) this.publish();
    if (data.action === 'start' && id === this.hostId && !['song', 'break'].includes(game.phase)) { game.start(); this.publish(); }
    if (data.action === 'dicho' && game.dicho(id, data.i)) this.publish();
    if (data.action === 'entrar' && game.wantIn(id)) this.publish();
    if (data.action === 'jump' && game.jump(id, data.beat, data.ok === true)) this.publish();
  }
  // A paused solo game holds the song: its start slides forward with the pause.
  // `held` (browser suites) stops the song clock but keeps taking inputs.
  tick(dt, input, paused = false) {
    if (this.isHost && this.game) {
      this.game.now = this.clock();
      if ((paused || this.held) && this.game.song && this.game.phase === 'song') this.game.song.startAt += dt * 1000;
    }
    super.tick(dt, input, paused);
  }
  practice() { this.state = { ...new Rueda().snapshot(), options: { ...this.state.options } }; super.practice('Rueda local · tú y los bots'); }
}
