import { PanaRoom, roomState, memberAvatar, BOT_NAMES, InputBuffer } from '../../../server/src/room-kit.js';
import { randomAvatar } from '../../../engine/avatar.js';
import { Arena, cleanInput } from '../public/rules.js';
import { parseOwned, parseSub, newNonce, verifyRefresh } from '../../../server/src/camo-trust.js';
export default class PaintRoom extends PanaRoom {
  state = new (roomState({}, undefined, 'PaintRoomState'))();
  onCreate(options) {
    super.onCreate(options); this.game = new Arena(); this.inputs = new InputBuffer(350);
    this.onMessage('move-seat', (client, data) => { const actor = this.seatOf(client); if (this.game.moveSeat(actor, data?.from, data?.to, this.isHost(client) ? actor : null)) this.publish(); });
    // A refused kit (mid-round) is answered, so the armory can say why nothing changed.
    // A camo the pana does not own is swapped for a solid one, and they are told.
    this.onMessage('kit', (client,data) => { const seat=this.seatOf(client), camo=this.game.camoRefusal(seat,data); if(this.game.selectKit(seat,data)) { this.publish(); if(camo) client.send('kit-rejected', { reason: 'camo', camo }); } else client.send('kit-rejected', { reason: this.game.kitRejection(seat) || 'invalid' }); });
    // A camo bought or unlocked mid-session: the client asks for a nonce, has pana.sh sign
    // its owned ids for it (bound to the account signed at connect) and forwards that.
    // Only a valid signature replaces the seat's list; anything else changes nothing.
    this.camoSubs = new Map(); this.camoNonces = new Map();
    this.onMessage('camos-nonce', client => {
      const seat = this.seatOf(client), sub = this.camoSubs.get(seat) || '';
      const nonce = sub || process.env.PANA_UNLOCK_ALL_CAMOS === '1' ? newNonce() : '';
      if (nonce) this.camoNonces.set(client.sessionId, { nonce, issuedAt: Date.now() }); else this.camoNonces.delete(client.sessionId);
      client.send('camos-nonce', { nonce });
    });
    this.onMessage('camos-refresh', (client, data) => {
      const seat = this.seatOf(client), issued = this.camoNonces.get(client.sessionId);
      this.camoNonces.delete(client.sessionId);
      const owned = seat != null && issued && verifyRefresh(data, { sub: this.camoSubs.get(seat) || '', ...issued });
      if (owned) { this.game.setCamos(seat, [...owned]); if (client.auth) client.auth.camos = [...owned]; }
      client.send('camos-refreshed', { ok: !!owned });
    });
    // A client finished loading this round's court; stale rounds and bots are ignored.
    this.onMessage('ready', (client, data) => { if (this.game.markReady(this.seatOf(client), data?.round)) this.publish(); });
    this.onMessage('input', (client, data) => this.inputs.set(this.seatOf(client), cleanInput(data)));
    this.onHostMessage('configure', (client, data) => { if (this.game.configure(data?.options)) this.publish(); });
    this.onHostMessage('map', (client, data) => { if (this.game.selectMap(data?.mapId)) this.publish(); });
    this.onHostMessage('difficulty', (client, data) => { if (this.game.selectDifficulty(data?.difficulty)) this.publish(); });
    // Results → lobby: the host picks the next map before anyone plays again.
    this.onHostMessage('lobby', () => { if (this.game.toLobby()) { this.inputs.clear(); this.publish(); } });
    this.onHostMessage('start', () => {
      if (this.game.phase !== 'lobby') return;
      // The room's `bots` option decides how many join (Auto: three for a pana alone).
      this.game.seatBots(i => ({ name: BOT_NAMES[i % BOT_NAMES.length], avatar: randomAvatar() }));
      // A refused start (teams without a rival) leaves no bots behind in the lobby.
      if (!this.game.start()) this.game.players = this.game.players.filter(p => !p.bot);
      this.inputs.clear(); this.publish();
    });
    // Only a running round changes on its own; the lobby publishes on events.
    this.clock.setInterval(() => {
      const running = this.game.phase === 'playing';
      this.game.step(.05, this.inputs.fresh());
      if (running) this.publish();
    }, 50);
  }
  // The room socket's upgrade headers (Colyseus 0.18 passes them here): the camos the
  // pana.sh gateway signed for this pana. Always admits; unsigned means solid camos only.
  // `sub` is the account handle a mid-session refresh must match ('' when not signed).
  onAuth(client, options, context) { return { camos: [...parseOwned(context?.headers)], sub: parseSub(context?.headers) }; }
  joined(client, member) {
    // A reconnect has no new auth: the seat keeps what it was vouched for (refreshes included).
    if (Array.isArray(client.auth?.camos)) { this.game.setCamos(member.seat, client.auth.camos); this.camoSubs.set(member.seat, client.auth.sub || ''); }
    if (this.game.players.filter(p => p.connected).length >= this.maxClients) { const bot = this.game.players.find(p => p.bot); if (bot) this.game.players.splice(this.game.players.indexOf(bot), 1); }
    this.game.add(member.seat, { name: member.name, avatar: memberAvatar(member), bot: false }); this.publish();
  }
  dropped(client, member) { this.camoNonces.delete(client.sessionId); if (member) { const p = this.game.players.find(p => p.id === member.seat); if (p) p.connected = false; this.inputs.delete(member.seat); } this.publish(); }
  returned(client, member) { this.joined(client, member); }
  left(client, member) { this.dropped(client, member); }
  publish() { this.broadcast('view', this.game.view()); }
}
