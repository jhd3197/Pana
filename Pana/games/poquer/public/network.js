import { joinRoom, leadFromUrl } from '/engine/net.js';
import { randomAvatar } from '/engine/avatar.js';
import { Poker } from './rules.js';

export class PokerConnection {
  constructor(options) { Object.assign(this, options); this.state = new Poker().view(1); this.connected = false; this.local = false; this.elapsed = 0; }
  get id() { return this.local ? 1 : this.link?.me?.seat; }
  get isHost() { return this.local || !!this.link?.isHost; }
  async connect() {
    this.onStatus('Conectando con tus panas…');
    try {
      const link = await joinRoom('poquer', { code: this.code, name: this.name, avatar: this.avatar, lead: leadFromUrl() });
      if (this.local || this.disposed) { link.leave(); return; } this.link = link; this.connected = true;
      link.on('view', state => { if (!this.local) { this.state = state; this.onState(state); } });
      link.on('state', () => { if (!this.local) this.onState(this.state); });
      link.on('status', (text, failed) => { if (!this.local) { this.connected = !failed; this.onStatus(text || 'En línea con tus panas', !!failed); this.onState(this.state); } });
      link.on('left', () => { if (!this.local) { this.connected = false; this.onStatus('Se cortó la conexión. Recarga para volver o practica con bots.', true); this.onState(this.state); } });
      this.onStatus('En línea con tus panas'); this.onState(this.state);
    } catch (error) { if (!this.local && !this.disposed) this.onStatus(error.full ? 'Sala llena. Abre otra mesa desde Pana.' : 'Sin conexión. Puedes practicar con bots.', true); }
  }
  start() { if (this.local) { this.game.start(); this.publish(); } else if (this.connected) this.link.send('start'); }
  act(action, amount) {
    if (!this.connected) return;
    if (this.local) { if (this.game.act(1, action, amount)) this.publish(); }
    else this.link.send('act', { action, amount, revision: this.state.revision });
  }
  practice() {
    this.local = true; this.link?.leave(); this.connected = true; this.game = new Poker();
    this.game.add(1, { name: this.name, avatar: this.avatar, bot: false });
    ['Coco', 'Lola', 'Cheo'].forEach((name, i) => this.game.add(1000 + i, { name, avatar: randomAvatar(), bot: true }));
    this.onStatus('Práctica con bots · a tu ritmo'); this.start();
  }
  publish() { this.state = this.game.view(1); this.elapsed = 0; this.onState(this.state); }
  tick(dt, paused) {
    if (!this.local || paused) return; this.elapsed += dt;
    if (this.elapsed > 1.1 && this.game.players.find(p => p.id === this.game.turn)?.bot) { this.game.botAction(); this.publish(); }
  }
  dispose() { this.disposed = true; this.link?.leave(); }
}
