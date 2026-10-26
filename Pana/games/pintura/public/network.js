import { joinRoom, leadFromUrl } from '/engine/net.js';
import { randomAvatar } from '/engine/avatar.js';
import { Arena, cleanInput } from './rules.js';
import { FIELDS } from './options.js';
import { normalizeRoomOptions } from '/engine/room-options-rules.js';
import { loc } from '/engine/i18n.js';

export class PaintConnection {
  constructor(options) { Object.assign(this, options); this.state = new Arena().view(); this.connected = false; this.local = false; this.current = cleanInput(); this.accumulator = 0; }
  get id() { return this.local ? 1 : this.link?.me?.seat; }
  get isHost() { return this.local || !!this.link?.isHost; }
  async connect() {
    this.onStatus(loc('Conectando con tus panas…'));
    try {
      const link = await joinRoom('pintura', { code: this.code, name: this.name, avatar: this.avatar, lead: leadFromUrl() });
      if (this.local || this.disposed) { link.leave(); return; } this.link = link; this.connected = true;
      link.on('view', state => { if (!this.local) { this.state = { ...state, options: normalizeRoomOptions(FIELDS, state.options), flags: state.flags || [], teamScores: state.teamScores || [0, 0], winners: state.winners || [] }; this.onState(this.state); } });
      link.on('state', () => { if (!this.local) this.onState(this.state); });
      link.on('status', (text, failed) => { if (!this.local) { this.connected = !failed; this.onStatus(text || loc('En línea con tus panas'), !!failed); this.onState(this.state); } });
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
  selectKit(kit) { this.kit=kit; if(this.local) { if(this.game.selectKit(this.id,kit)) this.publish(); } else if(this.connected) this.link.send('kit',kit); }
  start() { if (this.local) { this.game.start(); this.publish(); } else if (this.connected) this.link.send('start'); }
  input(value) { this.current = cleanInput(value); if (!this.local && this.connected) this.link.send('input', this.current); }
  practice() {
    this.local = true; this.link?.leave(); this.connected = true; this.game = new Arena(this.state.mapId, this.state.difficulty, this.state.options);
    this.game.add(1, { name: this.name, avatar: this.avatar, bot: false });
    if(this.kit) this.game.selectKit(1,this.kit);
    ['Coco', 'Lola', 'Cheo'].forEach((name, i) => this.game.add(1000 + i, { name, avatar: randomAvatar(), bot: true }));
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
