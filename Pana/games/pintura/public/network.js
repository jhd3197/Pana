import { joinRoom, leadFromUrl } from '/engine/net.js';
import { randomAvatar } from '/engine/avatar.js';
import { Arena, cleanInput } from './rules.js';
import { FIELDS } from './options.js';
import { normalizeRoomOptions } from '/engine/room-options-rules.js';
import { loc } from '/engine/i18n.js';
// The server's bot names (room-kit BOT_NAMES), in the same order.
const PRACTICE_BOTS = ['Coco', 'Lola', 'Cheo', 'Nena', 'Toño', 'Mari', 'Pepe']; // i18n-ignore: names

export class PaintConnection {
  constructor(options) { Object.assign(this, options); this.state = new Arena().view(); this.connected = false; this.local = false; this.current = cleanInput(); this.accumulator = 0; }
  get id() { return this.local ? 1 : this.link?.me?.seat; }
  get isHost() { return this.local || !!this.link?.isHost; }
  async connect() {
    this.onStatus(loc('Conectando con tus panas…'));
    try {
      const link = await joinRoom('pintura', { code: this.code, name: this.name, avatar: this.avatar, lead: leadFromUrl() });
      if (this.local || this.disposed) { link.leave(); return; } this.link = link; this.connected = true; this.camosSynced = undefined;
      link.on('view', state => { if (!this.local) { this.state = { ...state, options: normalizeRoomOptions(FIELDS, state.options), flags: state.flags || [], flagEvents: state.flagEvents || [], outcome: state.outcome || null, teamScores: state.teamScores || [0, 0], winners: state.winners || [] }; this.onState(this.state); } });
      link.on('state', () => { if (!this.local) this.onState(this.state); });
      link.on('status', (text, failed) => { if (!this.local) { this.connected = !failed; this.onStatus(text || loc('En línea con tus panas'), !!failed); this.onState(this.state); } });
      // The room refused a kit (mid-round): the armory says why.
      link.on('kit-rejected', data => { if (!this.local) this.onKitRejected?.(data || {}); });
      link.on('left', () => { if (!this.local) { this.connected = false; this.onStatus(loc('Se cortó la conexión. Recarga para volver o practica con bots.'), true); this.onState(this.state); } });
      this.onStatus(loc('En línea con tus panas')); if(this.kit) this.selectKit(this.kit); this.onState(this.state);
    } catch (error) { if (!this.local && !this.disposed) { this.connected = false; this.onStatus(error.full ? loc('Sala llena. Abre otra cancha desde Pana.') : loc('Sin conexión. Puedes practicar con bots.'), true); this.onState(this.state); } }
  }
  moveSeat(from, to) {
    if (!this.connected) return;
    if (this.local) { if (this.game.moveSeat(this.id, from, to, this.id)) this.publish(); }
    else this.link.send('move-seat', { from, to });
  }
  configure(options) { if (!this.isHost || !this.connected) return; if (this.local) { if (this.game.configure(options)) this.publish(); } else this.link.send('configure', { options }); }
  selectMap(mapId) {
    if (!this.isHost || !this.connected) return;
    if (this.local) { if (this.game.selectMap(mapId)) this.publish(); }
    else this.link.send('map', { mapId });
  }
  selectDifficulty(difficulty) {
    if (!this.isHost || !this.connected) return;
    if (this.local) { if (this.game.selectDifficulty(difficulty)) this.publish(); }
    else this.link.send('difficulty', { difficulty });
  }
  // The camos this pana owns beyond the solid ones (the armory reads them from pana.sh).
  // Online the server only trusts lists pana.sh signed; practice trusts this one.
  // sign(nonce): camo-store's `signed`, or null when pana.sh cannot sign. Resolves true
  // once the room wears the same list (practice at once).
  setCamos(owned, sign) {
    this.camos = [...(owned || [])];
    if (this.local) { this.game.setCamos(this.id, this.camos); return Promise.resolve(true); }
    const key = [...this.camos].sort().join(',');
    if (key === this.camosSynced) return Promise.resolve(true);
    if (!sign || !this.connected || !this.link) return Promise.resolve(false);
    // One refresh at a time: nonce from the room, pana.sh's signature, the room's verdict.
    return this.camoSync = (this.camoSync || Promise.resolve()).then(async () => {
      if (key === this.camosSynced) return true;
      if (!this.connected || this.local) return false;
      const { nonce } = await this.ask('camos-nonce', 'camos-nonce');
      const signed = nonce && await sign(nonce);
      if (!signed) return false;
      const { ok } = await this.ask('camos-refresh', 'camos-refreshed', signed);
      if (ok) this.camosSynced = key;
      return !!ok;
    }).catch(() => false);
  }
  // One message and the room's answer ({} after 5 s).
  ask(type, reply, data) {
    return new Promise(resolve => {
      const off = this.link.on(reply, m => { clearTimeout(timer); off(); resolve(m || {}); });
      const timer = setTimeout(() => { off(); resolve({}); }, 5000);
      this.link.send(type, data);
    });
  }
  selectKit(kit) {
    this.kit=kit;
    if(this.local) { const camo=this.game.camoRefusal(this.id,kit); if(this.game.selectKit(this.id,kit)) { this.publish(); if(camo) this.onKitRejected?.({ reason: 'camo', camo }); } else this.onKitRejected?.({ reason: this.game.kitRejection(this.id) || 'invalid' }); }
    // A camo refresh in flight lands first, so a camo just got is not swapped for a solid one.
    else if(this.connected) (this.camoSync || Promise.resolve()).then(() => { if (this.connected && !this.local && this.kit === kit) this.link.send('kit', kit); });
  }
  // Practice seats its bots like the server does, from the room's `bots` option.
  start() {
    if (this.local) { this.game.seatBots(i => ({ name: PRACTICE_BOTS[i % PRACTICE_BOTS.length], avatar: randomAvatar() })); this.game.start(); this.publish(); }
    else if (this.connected) this.link.send('start');
  }
  // Results → lobby to pick the next map. Practice keeps its bots on the lobby
  // cards; start re-seats them from the `bots` option.
  toLobby() {
    if (!this.isHost || !this.connected) return;
    if (this.local) { if (this.game.toLobby({ keepBots: true })) this.publish(); } else this.link.send('lobby');
  }
  // This client has the round's court on screen and can play.
  ready(round) { if (this.local) { if (this.game.markReady(this.id, round)) this.publish(); } else if (this.connected) this.link.send('ready', { round }); }
  input(value) { this.current = cleanInput(value); if (!this.local && this.connected) this.link.send('input', this.current); }
  practice() {
    this.local = true; this.link?.leave(); this.connected = true; this.game = new Arena(this.state.mapId, this.state.difficulty, this.state.options);
    this.game.add(1, { name: this.name, avatar: this.avatar, bot: false }); this.game.setCamos(1, this.camos);
    if(this.kit) this.game.selectKit(1,this.kit);
    this.onStatus(loc('Práctica con bots · a tu ritmo')); this.start();
  }
  publish() { this.state = this.game.view(); this.onState(this.state); }
  tick(dt, paused) {
    if (!this.local || paused) { this.accumulator = 0; return; }
    this.accumulator += Math.min(.15, dt);
    while (this.accumulator >= .05) { this.game.step(.05, new Map([[1, this.current]])); this.accumulator -= .05; }
    this.publish();
  }
  dispose() { this.disposed = true; this.link?.leave(); }
}
