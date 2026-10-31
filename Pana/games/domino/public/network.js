import { joinRoom, leadFromUrl } from '/engine/net.js';
import { DominoGame } from './rules.js';
import { loc, locn } from '/engine/i18n.js';

// Dominó online runs on its own room (server/room.js): the server deals,
// plays the bots and sends each seat its own view, so no browser ever holds
// another pana's tiles. Local play runs the same DominoGame in the page.
// Members are their room seat numbers; local play is seat 1.
export class DominoRoom {
  constructor({ code, name, avatar, onState = () => {}, onStatus = () => {}, onNotice = () => {} }) {
    Object.assign(this, { code, name, avatar, onState, onStatus, onNotice });
    this.state = new DominoGame().view(-1); this.connected = false; this.offline = false; this.link = null;
  }
  get id() { return this.offline ? 1 : this.link?.me?.seat ?? null; }
  get hostId() { return this.offline ? 1 : this.link?.state.players.find(p => p.id === this.link.state.host)?.seat ?? null; }
  get isHost() { return this.offline || !!this.link?.isHost; }
  get seat() { return this.state.players.findIndex(p => p.id === this.id); }
  get members() { return new Map(this.offline ? [[1, { id: 1 }]] : (this.link?.state.players || []).filter(p => p.connected).map(p => [p.seat, p])); }

  async connect() {
    this.onStatus(loc('Conectando con la mesa…'));
    try {
      const link = await joinRoom('domino', { code: this.code, name: this.name, avatar: this.avatar, lead: leadFromUrl() });
      if (this.offline || this.disposed) { link.leave(); return; }
      this.link = link; this.connected = true;
      link.on('view', state => { if (!this.offline) { this.state = state; this.onState(state); } });
      link.on('state', () => { if (!this.offline) { this.status(); this.onState(this.state); } });
      link.on('status', (text, failed) => { if (this.offline) return; this.connected = !failed; failed ? this.onStatus(loc('Sin conexión. Reconectando…'), true) : this.status(); });
      link.on('left', () => { if (this.offline) return; this.connected = false; this.onStatus(loc('No pudimos conectar. Puedes jugar en local.'), true); this.onState(this.state); });
      this.status();
    } catch (error) {
      if (!this.offline && !this.disposed) this.onStatus(error.full ? loc('Sala llena. Puedes jugar una partida local.') : loc('No pudimos conectar. Puedes jugar en local.'), true);
    }
  }
  status() { const n = this.members.size; this.onStatus(locn(n, 'Sala {code} · {n} pana conectado', 'Sala {code} · {n} panas conectados', { code: this.code })); }

  // Online the server answers with a new view; locally the game runs here.
  action(action, values = {}) {
    if (!this.connected) { this.onNotice(loc('Espera a reconectar o abre una mesa local.')); return false; }
    const data = { action, ...values, revision: this.state.revision };
    if (this.offline) {
      const ok = this.game.accept(1, { ...data, seq: (this.game.ledger[1] || 0) + 1 }, 1);
      this.publish(); return ok;
    }
    // A smaller table can't drop seated panas; say so now rather than after a round trip.
    if (action === 'options' && values.patch?.seats && this.state.players.slice(values.patch.seats).some(p => p.id !== null)) return false;
    this.link.send('action', data); return true;
  }
  // paused: the menu is open with nobody else at the table. Online the server
  // holds the bots while every pana there has paused.
  tick(dt, paused = false) {
    if (this.offline) { if (!paused && this.game.tick(dt)) this.publish(); return; }
    if (this.link && paused !== this.pausedSent) { this.pausedSent = paused; this.link.send('pause', { on: paused }); }
  }

  practice() {
    const mapId = this.state.mapId;
    this.offline = true; this.connected = true; this.link?.leave(); this.link = null;
    this.game = new DominoGame(Date.now()); this.game.mapId = mapId;
    this.game.addPlayer(1, this.name, this.avatar);
    this.onStatus(loc('Mesa local · tú y tres bots')); this.publish();
  }
  publish() { this.state = this.game.view(this.game.players.findIndex(p => p.id === 1)); this.onState(this.state); }
  // Lose the connection for good (suites reach the local fallback this way).
  cut() { const room = this.link?.room; if (!room) return; room.reconnection.enabled = false; room.leave(false); }
  dispose() { this.disposed = true; this.link?.leave(); }
}
