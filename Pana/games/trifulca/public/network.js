import { LiveRoom } from '/engine/live-room.js';
import { Trifulca, cleanInput } from './rules.js';
import { loc, locKey } from '/engine/i18n.js';

// Host simulation on the shared live room (engine/live-room.js): the host
// runs the night (fights, ring, bets) with everyone's latest input and
// publishes each tick; a new host continues from the last snapshot. Late
// joiners land in the crowd and at the back of the queue.
export class TrifulcaRoom extends LiveRoom {
  constructor(options) {
    // A one-second catch-up can hide an entire windup and strike between
    // snapshots. Two ticks keep combat tells observable after a rendering hitch.
    super({ ...options, game: 'trifulca', protocol: 'trifulca-v1' }, { maxCatchUp: .1, valid: (state) => Array.isArray(state?.players) && Array.isArray(state?.events) });
    this.state = new Trifulca().snapshot();
  }
  cleanInput(raw) { return cleanInput(raw); }
  takeOver(previous) {
    super.takeOver(previous);
    this.game = Trifulca.restore(this.state, this.members);
    for (const m of this.members.values()) this.game.addPlayer(m.id, m.name, m.id === this.id ? this.avatar : m.avatar || {});
    this.publish();
    if (previous != null) this.onNotice(locKey('Cambió el anfitrión. La trifulca sigue.'));
  }
  memberJoined(m) { if (this.isHost) { this.game.addPlayer(m.id, m.name, m.avatar || {}); this.publish(); } }
  memberHello(id, m) { this.memberJoined(m); }
  memberLeft(id) { super.memberLeft(id); if (this.isHost) { this.game.removePlayer(id); this.publish(); } }
  handle(id, data) {
    if (data.action === 'options' && id === this.hostId && this.game.configure(data.options)) this.publish();
    // A finished night goes back to the lobby first ('lobby', handled by LiveRoom).
    const free = this.game.phase === 'lobby' || !!this.game.tutorial;
    if (data.action === 'start' && id === this.hostId && free) { this.game.tutorial = null; this.game.start(data.bots !== false); this.publish(); }
    if (data.action === 'tutorial' && id === this.hostId && free && this.game.startTutorial(id)) this.publish();
    if (data.action === 'bet' && this.game.bet(id, data.corner)) this.publish();
  }
  practice() { this.state = { ...new Trifulca().snapshot(), options: { ...this.state.options } }; super.practice(loc('Noche local · tú y los bots')); }
}
