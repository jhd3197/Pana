// The room for Capis a Pintazos with friends (engine/live-room.js): the host
// runs the match (online.js CapisTable) with the latest keys of whoever's turn
// it is and publishes it; guests send keys and shots and keep a copy of the
// match (online.js mirror) for the scene. A new host continues from its copy.
import { LiveRoom } from '/engine/live-room.js';
import { loc, locn } from '/engine/i18n.js';
import { CapisTable, cleanInput, mirror } from './online.js';

export class CapisRoom extends LiveRoom {
  constructor(options) {
    super({ ...options, game: 'capis', protocol: 'capis-v1', texts: {
      connecting: loc('Conectando con tus panas…'), full: loc('Sala llena. Puedes jugar solo.'),
      lost: loc('Se cortó la conexión. Reconectando…'), offline: loc('Sin conexión. Puedes jugar solo.'),
      waiting: loc('Espera a reconectar.'), ...options.texts } }, { valid: state => Array.isArray(state?.players), inputTtl: 900 });
    this.state = new CapisTable().snapshot();
    // This client's own match: the host's table's, or a guest's mirror of it,
    // brought level before the game sees the snapshot.
    this.view = null;
    const show = this.onState;
    this.onState = state => { if (!this.isHost) this.follow(state); show(state); };
  }
  // A new room never carries an old room's table on.
  entered(alone) { if (alone) { this.state = new CapisTable(this.state).snapshot(); this.view = null; } }
  get match() { return this.isHost ? this.game?.match ?? null : this.view; }
  statusText() { return locn(this.members.size, 'Sala {code} · {n} pana', 'Sala {code} · {n} panas', { code: this.code }); }
  cleanInput(raw) { return cleanInput(raw); }

  takeOver(previous) {
    super.takeOver(previous);
    this.game = previous == null && this.state.phase === 'lobby' ? new CapisTable(this.state) : CapisTable.restore(this.state, this.view);
    this.game.setHost(this.id);
    this.seat();
    this.publish();
    if (previous != null) this.onNotice(loc('Cambió el anfitrión. La partida sigue.'));
  }
  // Everyone in the room on a team; whoever left is gone (their turns go to a teammate or the machine).
  seat() {
    for (const p of [...this.game.players]) if (!this.members.has(p.id)) this.game.removePlayer(p.id);
    for (const m of this.members.values()) this.game.addPlayer(m.id, m.name, m.id === this.id ? this.avatar : m.avatar || {});
  }
  memberJoined(m, already) {
    if (this.isHost) { this.seat(); this.publish(); }
    if (!already) this.onNotice(loc('{name} llegó.', { name: m.name }));
  }
  memberHello() { if (this.isHost) { this.seat(); this.publish(); } }
  memberLeft(id, m) {
    super.memberLeft(id);
    if (this.isHost) { this.seat(); this.publish(); }
    if (m?.name) this.onNotice(loc('{name} se fue.', { name: m.name }));
  }

  handle(id, data) {
    const g = this.game, host = id === this.hostId;
    if (data.action === 'start' && host) g.start();
    else if (data.action === 'options' && host) g.configure(data.options);
    else if (data.action === 'seed' && host) g.setSeed(data.seed);
    else if (data.action === 'tomb') g.setTomb(id, data.shape);
    else if (data.action === 'team') g.setTeam(host && data.id != null ? data.id : id, data.team);
    else if (data.action === 'fire' || data.action === 'weapon') g.act(id, data.action, data);
    else if (data.action === 'setup') g.setupAct(id, data.step, data);
    else if (data.action === 'resync') g.fullEdits = Math.max(g.fullEdits, 2);
    else return;
    this.publish();
  }

  // A missed edit asks the host for the whole list.
  follow(state) {
    const { view, gap } = mirror(this.view, state);
    this.view = view;
    if (gap && !this.resyncing && this.connected) { this.resyncing = true; this.action('resync'); setTimeout(() => { this.resyncing = false; }, 500); }
  }

  // Offline play is not this room's: the game falls back to its own single player.
  practice() { super.practice(loc('Sin sala · juegas solo')); }
}
