import { Expedition, stepExplorer, alive } from './rules.js';
import { LiveRoom, axis } from '/engine/live-room.js';
import { loc, locn } from '/engine/i18n.js';

const ACTIONS = new Set(['use', 'throw', 'drop', 'drag', 'bark', 'interact']);
const angle = v => Number.isFinite(v) ? Math.atan2(Math.sin(v), Math.cos(v)) : undefined;

// Host-simulated expedition on the shared live room (engine/live-room.js), with snapshot migration.
export class ExpeditionRoom extends LiveRoom {
  constructor(options) {
    super({ ...options, game: 'reliquia', protocol: 'reliquia-v3', texts: {
      connecting: loc('Conectando con la expedición…'), full: loc('Sala llena. Abre otra expedición desde Pana.'),
      lost: loc('Se cortó la conexión. Reconectando…'), offline: loc('Sin conexión. Puedes abrir una expedición local.'),
      waiting: loc('Espera a reconectar o abre una expedición local.') } }, {
      valid: (state) => !!state?.players,
      // Your own explorer moves the moment you press a key; the host corrects it.
      // Carrying a big treasure or being dragged is the host's call alone.
      predict: {
        body: (state, id) => state.phase === 'playing' ? state.players.find(p => p.id === id && alive(p) && p.grip == null && p.push == null && !p.riding && p.draggedBy == null) : null,
        step: stepExplorer,
      },
    });
    this.state = new Expedition().snapshot();
  }
  statusText() { return locn(this.members.size, 'Sala {code} · {n} pana', 'Sala {code} · {n} panas', { code: this.code }); }
  cleanInput(raw) { return { x: axis(raw?.x), z: axis(raw?.z), h: angle(raw?.h), pitch: Number.isFinite(raw?.pitch) ? Math.max(-1.2, Math.min(1.2, raw.pitch)) : 0, jump: Number.isInteger(raw?.jump) ? raw.jump & 255 : 0, hold: !!raw?.hold, sprint: !!raw?.sprint }; }
  ownInput(input) { return { ...this.cleanInput(input), jumpDelay: this.jumpDelay || 0 }; }
  tick(dt, input, paused = false) {
    // A background host may catch up a whole second. A newly received jump
    // belongs near the end of that interval, not a second before it arrived.
    const span = Math.min(this.live.maxCatchUp, dt), now = performance.now();
    this.jumpDelay = Math.max(0, span - .05);
    if (this.isHost) for (const [id, value] of this.inputs) if (id !== this.id)
      value.jumpDelay = Math.max(0, span - Math.max(.05, (now - value.at) / 1000));
    super.tick(dt, input, paused);
  }
  // A new identity does not resurrect a stale expedition from a deleted room.
  entered(alone) { if (alone) this.state = new Expedition().snapshot(); }
  takeOver(previous) {
    super.takeOver(previous);
    this.game = new Expedition(this.state.seed || 1, this.state.options);
    if (this.state.phase !== 'lobby') this.game.restore(this.state, this.members);
    for (const p of this.members.values()) this.game.addPlayer(p.id, p.name, p.id === this.id ? this.avatar : p.avatar || this.state.players.find(q => q.id === p.id)?.avatar || {});
    this.publish(); if (previous != null) this.onNotice(loc('Cambió el anfitrión. La expedición continúa.'));
  }
  memberJoined(m) { if (this.isHost) { this.game.addPlayer(m.id, m.name, m.avatar); this.publish(); } }
  memberLeft(id) { super.memberLeft(id); if (this.isHost) { this.game.removePlayer(id); this.publish(); } }
  memberHello(id, m) { if (this.isHost) { this.game.addPlayer(id, m.name, m.avatar); this.publish(); } }
  // The expedition's own ledger also travels in snapshots, so a new host never
  // replays an action the old one already applied.
  handle(id, data) {
    if (data.seq <= (this.game.ledger[id] || 0)) return;
    if (data.action === 'configure') { if (id !== this.hostId || !this.game.configure(data.options)) return; this.game.ledger[id] = data.seq; }
    else if (data.action === 'start') {
      if (id !== this.hostId || this.game.phase === 'playing') return;
      this.game.ledger[id] = data.seq;
      this.game.start((Date.now() ^ Math.floor(Math.random() * 0xffffffff)) >>> 0 || 1);
    } else if (ACTIONS.has(data.action)) this.game.accept(id, data.seq, data.action, { hand: data.hand, line: data.line });
    this.publish();
  }
  practice() {
    this.state = new Expedition(1, this.state.options).snapshot(); this.game = null;
    super.practice(loc('Expedición local · el botín cuenta cuando llega al camión'));
  }
}
