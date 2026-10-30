import { PanaRoom, roomState, memberAvatar, fillBots, InputBuffer } from '../../../server/src/room-kit.js';
import { Arena, cleanInput } from '../public/rules.js';
export default class PaintRoom extends PanaRoom {
  state = new (roomState({}, undefined, 'PaintRoomState'))();
  onCreate(options) {
    super.onCreate(options); this.game = new Arena(); this.inputs = new InputBuffer(350);
    this.onMessage('move-seat', (client, data) => { const actor = this.seatOf(client); if (this.game.moveSeat(actor, data?.from, data?.to, this.isHost(client) ? actor : null)) this.publish(); });
    this.onMessage('kit', (client,data) => { if(this.game.selectKit(this.seatOf(client),data)) this.publish(); });
    // A client finished loading this round's court; stale rounds and bots are ignored.
    this.onMessage('ready', (client, data) => { if (this.game.markReady(this.seatOf(client), data?.round)) this.publish(); });
    this.onMessage('input', (client, data) => this.inputs.set(this.seatOf(client), cleanInput(data)));
    this.onHostMessage('configure', (client, data) => { if (this.game.configure(data?.options)) this.publish(); });
    this.onHostMessage('map', (client, data) => { if (this.game.selectMap(data?.mapId)) this.publish(); });
    this.onHostMessage('difficulty', (client, data) => { if (this.game.selectDifficulty(data?.difficulty)) this.publish(); });
    this.onHostMessage('start', () => {
      if (this.game.phase === 'playing') return;
      this.game.players = this.game.players.filter(p => !p.bot && p.connected);
      if (this.game.players.length === 1) fillBots(3, (seat, info) => this.game.add(seat, info));
      this.inputs.clear(); this.game.start(); this.publish();
    });
    // Only a running round changes on its own; the lobby publishes on events.
    this.clock.setInterval(() => {
      const running = this.game.phase === 'playing';
      this.game.step(.05, this.inputs.fresh());
      if (running) this.publish();
    }, 50);
  }
  joined(client, member) {
    if (this.game.players.filter(p => p.connected).length >= this.maxClients) { const bot = this.game.players.find(p => p.bot); if (bot) this.game.players.splice(this.game.players.indexOf(bot), 1); }
    this.game.add(member.seat, { name: member.name, avatar: memberAvatar(member), bot: false }); this.publish();
  }
  dropped(client, member) { if (member) { const p = this.game.players.find(p => p.id === member.seat); if (p) p.connected = false; this.inputs.delete(member.seat); } this.publish(); }
  returned(client, member) { this.joined(client, member); }
  left(client, member) { this.dropped(client, member); }
  publish() { this.broadcast('view', this.game.view()); }
}
