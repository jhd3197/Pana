import { LiveRoom } from '/engine/live-room.js';
import { Bash, cleanInput } from './rules.js';
import { loc, locKey } from '/engine/i18n.js';

// Host simulation on the shared live room (engine/live-room.js): the host
// steps the round with everyone's latest input and publishes each tick; a new
// host continues from the last snapshot.
export class BochincheRoom extends LiveRoom {
  constructor(options) {
    super({ ...options, game: 'bochinche', protocol: 'bochinche-v1' }, { valid: (state) => Array.isArray(state?.players) });
    this.state = new Bash().snapshot();
  }
  cleanInput(raw) { return cleanInput(raw); }
  takeOver(previous) {
    super.takeOver(previous);
    this.game = Bash.restore(this.state, this.members);
    for (const m of this.members.values()) this.game.addPlayer(m.id, m.name, m.id === this.id ? this.avatar : m.avatar || {});
    this.publish();
    if (previous != null) this.onNotice(locKey('Cambió el anfitrión. La ronda sigue.'));
  }
  memberJoined(m) { if (this.isHost) { this.game.addPlayer(m.id, m.name, m.avatar || {}); this.publish(); } }
  memberHello(id, m) { this.memberJoined(m); }
  memberLeft(id) { super.memberLeft(id); if (this.isHost) { this.game.removePlayer(id); this.publish(); } }
  handle(id, data) {
    if (data.action === 'style' && this.game.choose(id, data.style)) this.publish();
    if (data.action === 'lobby' && id === this.hostId) { this.game.lobby(); this.syncRoster(); this.publish(); }
    if (data.action === 'options' && id === this.hostId && this.game.configure(data.options)) this.publish();
    if (data.action === 'start' && id === this.hostId && this.game.phase !== 'playing') { this.game.phase = 'lobby'; this.syncRoster(); this.game.start(); this.publish(); }
  }
  syncRoster() {
    if (this.game.phase !== 'lobby') return;
    this.game.players = this.game.players.filter(p => !p.bot);
    for (const m of this.members.values()) this.game.addPlayer(m.id, m.name, m.avatar || {});
  }
  practice() { this.state = { ...new Bash().snapshot(), options: { ...this.state.options } }; super.practice(loc('Ronda local · tú y los bots')); }
}

