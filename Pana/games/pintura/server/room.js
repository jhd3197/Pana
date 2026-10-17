import { PanaRoom, roomState } from '../../../server/src/room-kit.js';
import { randomAvatar } from '../../../engine/avatar.js';
import { Arena, cleanInput } from '../public/rules.js';
export default class PaintRoom extends PanaRoom {
  state = new (roomState({}, undefined, 'PaintRoomState'))();
  onCreate(options) {
    super.onCreate(options); this.game = new Arena(); this.inputs = new Map();
    this.onMessage('input', (client, data) => {
      const id = this.state.players.get(client.sessionId)?.seat;
      if (id != null) this.inputs.set(id, { value: cleanInput(data), at: Date.now() });
    });
    this.onMessage('start', client => {
      if (!this.isHost(client) || this.game.phase === 'playing') return;
      this.game.players = this.game.players.filter(p => !p.bot && p.connected);
      if (this.game.players.length === 1) for (let i = 0; i < 3; i++) this.game.add(1000 + i, { name: ['Coco', 'Lola', 'Cheo'][i], avatar: randomAvatar(), bot: true });
      this.inputs.clear(); this.game.start(); this.publish();
    });
    this.clock.setInterval(() => {
      const inputs = new Map(); for (const [id, input] of this.inputs) if (Date.now() - input.at < 350) inputs.set(id, input.value);
      this.game.step(.05, inputs); this.publish();
    }, 50);
  }
  joined(client, member) {
    if (this.game.players.filter(p => p.connected).length >= 8) { const bot = this.game.players.find(p => p.bot); if (bot) this.game.players.splice(this.game.players.indexOf(bot), 1); }
    this.game.add(member.seat, { name: member.name, avatar: JSON.parse(member.avatar), bot: false }); this.publish();
  }
  dropped(client, member) { if (member) { const p = this.game.players.find(p => p.id === member.seat); if (p) p.connected = false; this.inputs.delete(member.seat); } this.publish(); }
  returned(client, member) { this.joined(client, member); }
  left(client, member) { this.dropped(client, member); }
  publish() { this.broadcast('view', this.game.view()); }
}
