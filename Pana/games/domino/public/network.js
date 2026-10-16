import { DominoGame, chooseMove } from './rules.js';
import { normalizeAvatar } from '/engine/avatar.js';

export class DominoRoom {
  constructor({ code, name, avatar, onState = () => {}, onStatus = () => {}, onNotice = () => {} }) {
    Object.assign(this, { code, name, avatar, onState, onStatus, onNotice });
    this.members = new Map(); this.state = new DominoGame(Date.now()).snapshot();
    this.id = null; this.hostId = null; this.seq = 0; this.connected = false;
    this.offline = false; this.attempts = 0; this.botElapsed = 0;
  }
  get isHost() { return this.id !== null && this.id === this.hostId; }
  get seat() { return this.state.players.findIndex(p => p.id === this.id); }

  connect() {
    this.stopped = false; this.onStatus('Conectando con la mesa…');
    const ws = this.socket = new WebSocket(`${location.protocol === 'https:' ? 'wss:' : 'ws:'}//${location.host}/ws`);
    ws.onopen = () => ws.send(JSON.stringify({ t: 'join', game: 'domino', room: this.code, name: this.name }));
    ws.onmessage = event => {
      if (ws !== this.socket || this.offline) return;
      let m; try { m = JSON.parse(event.data); } catch { return; }
      if (m.t === 'full') {
        this.stopped = true; this.connected = false; ws.close();
        this.onStatus('Sala llena. Puedes jugar una partida local.', true); return;
      }
      if (m.t === 'welcome') {
        this.id = m.id; this.hostId = null; this.game = null; this.connected = true; this.attempts = 0;
        this.members = new Map([...m.players, { id: m.id, name: this.name, avatar: this.avatar }].map(p => [p.id, p]));
        // A new room never resurrects stale state from an earlier connection.
        if (!m.players.length) this.state = new DominoGame(Date.now()).snapshot();
        this.elect(); this.send({ kind: 'hello', avatar: this.avatar }); this.status();
      } else if (m.t === 'joined') {
        this.members.set(m.id, { id: m.id, name: m.name });
        if (this.isHost) { this.game.addPlayer(m.id, m.name); this.publish(); }
        this.send({ kind: 'hello', avatar: this.avatar }); this.status();
      } else if (m.t === 'left') {
        this.members.delete(m.id);
        if (this.isHost) { this.game.removePlayer(m.id); this.fillSeats(); this.publish(); }
        this.elect(); this.status();
      } else if (m.t === 'state' && m.v?.game === 'domino-v1' && this.members.has(m.id)) this.receive(m.id, m.v);
    };
    ws.onerror = () => {};
    ws.onclose = () => {
      if (ws !== this.socket || this.stopped || this.offline) return;
      this.connected = false; this.onStatus('Sin conexión. Reconectando…', true);
      if (++this.attempts <= 3) this.retry = setTimeout(() => this.connect(), 1500);
      else this.onStatus('No pudimos conectar. Puedes jugar en local.', true);
    };
  }

  elect() {
    const next = Math.min(...this.members.keys()), previous = this.hostId;
    this.hostId = next;
    if (this.isHost && (previous !== next || !this.game)) {
      this.game = DominoGame.restore(this.state, this.members); this.botElapsed = 0;
      this.publish();
      if (previous !== null) this.onNotice('Cambió el anfitrión. La partida continúa.');
    }
  }

  fillSeats() {
    for (const m of this.members.values()) this.game.addPlayer(m.id, m.name,
      m.avatar || this.game.players.find(p => p.id === m.id)?.avatar || {});
  }

  status() {
    this.onStatus(this.offline ? 'Mesa local · tú y tres bots' :
      `Sala ${this.code} · ${this.members.size} ${this.members.size === 1 ? 'pana' : 'panas'} conectado${this.members.size === 1 ? '' : 's'}`);
  }

  send(data) {
    if (!this.offline && this.socket?.readyState === WebSocket.OPEN)
      this.socket.send(JSON.stringify({ t: 'state', v: { game: 'domino-v1', ...data } }));
  }

  receive(id, data) {
    if (data.kind === 'hello') {
      this.members.get(id).avatar = normalizeAvatar(data.avatar);
      if (this.isHost) { this.fillSeats(); this.publish(); }
    } else if (data.kind === 'snapshot' && id === this.hostId && !this.isHost && data.state?.players?.length === 4) {
      this.state = data.state; this.onState(this.state);
    } else if (data.kind === 'action' && this.isHost) {
      this.game.accept(id, data, this.hostId); this.botElapsed = 0; this.publish();
    }
  }

  action(action, values = {}) {
    if (!this.connected) { this.onNotice('Espera a reconectar o abre una mesa local.'); return false; }
    const data = { kind: 'action', action, ...values, seq: ++this.seq, revision: this.state.revision };
    if (this.isHost) {
      const ok = this.game.accept(this.id, data, this.hostId);
      this.botElapsed = 0; this.publish(); return ok;
    }
    this.send(data); return true;
  }

  publish() { this.state = this.game.snapshot(); this.onState(this.state); this.send({ kind: 'snapshot', state: this.state }); }

  tick(dt, paused = false) {
    if (!this.connected || !this.isHost || this.game.phase !== 'playing' || paused || this.game.players[this.game.turn].id !== null) {
      this.botElapsed = 0; return;
    }
    this.botElapsed += dt;
    if (this.botElapsed < 1.15) return;
    this.botElapsed = 0;
    const move = chooseMove(this.game);
    move ? this.game.play(this.game.turn, move.tile, move.end) : this.game.pass(this.game.turn);
    this.publish();
  }

  practice() {
    this.stopped = true; this.offline = true; clearTimeout(this.retry); this.socket?.close();
    this.id = 1; this.hostId = null; this.seq = 0; this.game = null;
    this.state = new DominoGame(Date.now()).snapshot();
    this.members = new Map([[1, { id: 1, name: this.name, avatar: this.avatar }]]);
    this.connected = true; this.elect(); this.status();
  }

  dispose() { this.stopped = true; clearTimeout(this.retry); this.socket?.close(); }
}
