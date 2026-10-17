import { PanaRoom, roomState } from '../../../server/src/room-kit.js';
import { randomAvatar } from '../../../engine/avatar.js';
import { Poker } from '../public/rules.js';

export default class PokerRoom extends PanaRoom {
  maxClients = 6;
  state = new (roomState({}, undefined, 'PokerRoomState'))();
  onCreate(options) {
    super.onCreate(options); this.game = new Poker(); this.deadline = 0; this.lastTurn = '';
    this.onMessage('map', (client,data) => {
      if(this.isHost(client) && data?.revision === this.game.revision && this.game.setMap(data.mapId)) this.publish();
    });
    this.onMessage('start', client => {
      if (!this.isHost(client) || !['lobby', 'finished'].includes(this.game.phase)) return;
      const humans = [...this.state.players.values()].filter(p => p.connected);
      this.game.players = this.game.players.filter(p => !p.bot || humans.length === 1);
      if (humans.length === 1) for (let i = 0; i < 3; i++) this.game.add(1000 + i, { name: ['Coco', 'Lola', 'Cheo'][i], avatar: randomAvatar(), bot: true });
      this.game.start(); this.publish();
    });
    this.onMessage('act', (client, data) => {
      if (data && Number.isInteger(data.revision) && this.game.act(this.state.players.get(client.sessionId)?.seat, data.action, data.amount, data.revision)) this.publish();
    });
    this.clock.setInterval(() => this.tick(), 200);
  }
  joined(client, member) { this.game.add(member.seat, { name: member.name, avatar: JSON.parse(member.avatar), bot: false }); this.publish(); }
  dropped(client, member) { if (member) this.game.drop(member.seat); this.publish(); }
  returned(client, member) { this.game.add(member.seat, { name: member.name, avatar: JSON.parse(member.avatar), bot: false }); this.publish(); }
  left(client, member) { if (member) this.game.drop(member.seat); this.publish(); }
  tick() {
    const p = this.game.players.find(p => p.id === this.game.turn);
    if (p && Date.now() >= this.deadline) {
      if (p.bot) this.game.botAction(); else this.game.act(p.id, this.game.legal(p.id)?.call ? 'fold' : 'call');
    }
    this.publish();
  }
  publish() {
    const key = `${this.game.hand}:${this.game.revision}:${this.game.turn}`;
    if (key !== this.lastTurn) { this.lastTurn = key; this.deadline = Date.now() + (this.game.players.find(p => p.id === this.game.turn)?.bot ? 1100 : 30000); }
    for (const client of this.clients) {
      const id = this.state.players.get(client.sessionId)?.seat;
      if (id != null) client.send('view', { ...this.game.view(id), deadline: this.deadline });
    }
  }
}
