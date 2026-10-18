import { PanaRoom, roomState, memberAvatar, fillBots } from '../../../server/src/room-kit.js';
import { Poker } from '../public/rules.js';

export default class PokerRoom extends PanaRoom {
  state = new (roomState({}, undefined, 'PokerRoomState'))();
  onCreate(options) {
    super.onCreate(options); this.game = new Poker(); this.deadline = 0; this.lastTurn = '';
    const current = (fn) => (client, data) => { if (data?.revision === this.game.revision && fn(data)) this.publish(); };
    this.onHostMessage('options', current(data => this.game.configure(data.options, data.mapId)));
    this.onHostMessage('map', current(data => this.game.setMap(data.mapId)));
    this.onMessage('seat', (client, data) => {
      const id = this.seatOf(client);
      if (id != null && data?.revision === this.game.revision && this.game.reseat(data.from, data.to, id, this.isHost(client) ? id : null)) this.publish();
    });
    this.onHostMessage('setup', current(() => this.game.setup()));
    this.onHostMessage('start', () => {
      if (!['lobby', 'finished'].includes(this.game.phase)) return;
      const humans = this.connectedMembers().length;
      // Panas who left stay listed only until the next hand deals.
      this.game.players = this.game.players.filter(p => p.bot ? humans === 1 : p.connected);
      if (humans === 1) fillBots(3, (seat, info) => this.game.add(seat, info));
      this.game.start(); this.publish();
    });
    this.onMessage('act', (client, data) => {
      if (data && Number.isInteger(data.revision) && this.game.act(this.seatOf(client), data.action, data.amount, data.revision)) this.publish();
    });
    this.clock.setInterval(() => this.tick(), 200);
  }
  // A pana arriving at a full table takes a bot's chair while no hand is live.
  joined(client, member) {
    if (this.game.players.length >= this.maxClients && ['lobby', 'finished'].includes(this.game.phase)) {
      const bot = this.game.players.findIndex(p => p.bot);
      if (bot >= 0) this.game.players.splice(bot, 1);
    }
    this.game.add(member.seat, { name: member.name, avatar: memberAvatar(member), bot: false }); this.publish();
  }
  dropped(client, member) { if (member) this.game.drop(member.seat); this.publish(); }
  returned(client, member) { this.game.add(member.seat, { name: member.name, avatar: memberAvatar(member), bot: false }); this.publish(); }
  left(client, member) { if (member) this.game.drop(member.seat); this.publish(); }
  // Views carry the deadline, so clients count down on their own; the tick only
  // publishes when the deadline actually plays a turn.
  tick() {
    const p = this.game.players.find(p => p.id === this.game.turn);
    if (!p || Date.now() < this.deadline) return;
    if (p.bot) this.game.botAction(); else this.game.act(p.id, this.game.legal(p.id)?.call ? 'fold' : 'call');
    this.publish();
  }
  publish() {
    const key = `${this.game.hand}:${this.game.revision}:${this.game.turn}`;
    if (key !== this.lastTurn) { this.lastTurn = key; this.deadline = Date.now() + (this.game.players.find(p => p.id === this.game.turn)?.bot ? 1100 : this.game.options.turnSeconds * 1000); }
    for (const client of this.clients) {
      const id = this.seatOf(client);
      if (id != null) client.send('view', { ...this.game.view(id), deadline: this.deadline });
    }
  }
}
