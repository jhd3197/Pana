import { Expedition } from './rules.js';
export class ExpeditionRoom {
  constructor({ code, name, avatar, onState, onStatus, onNotice }) {
    Object.assign(this, { code, name, avatar, onState, onStatus, onNotice });
    this.members = new Map(); this.inputs = new Map(); this.state = new Expedition().snapshot();
    this.id = null; this.hostId = null; this.seq = 0; this.connected = false; this.offline = false; this.attempts = 0;
  }
  get isHost() { return this.id != null && this.id === this.hostId; }
  connect() {
    this.stopped = false; this.onStatus('Conectando con la expedición…');
    const ws = this.socket = new WebSocket(`${location.protocol === 'https:' ? 'wss:' : 'ws:'}//${location.host}/ws`);
    ws.onopen = () => ws.send(JSON.stringify({ t: 'join', game: 'reliquia', room: this.code, name: this.name }));
    ws.onmessage = event => {
      if (ws !== this.socket || this.offline) return;
      let m; try { m = JSON.parse(event.data); } catch { return; }
      if (m.t === 'full') { this.stopped = true; this.connected = false; this.onStatus('Sala llena. Abre otra expedición desde Pana.', true); ws.close(); return; }
      if (m.t === 'welcome') {
        this.id = m.id; this.hostId = null; this.game = null; this.connected = true; this.attempts = 0;
        this.members = new Map([...m.players, { id: this.id, name: this.name, avatar: this.avatar }].map(p => [p.id, p]));
        // A new identity does not resurrect a stale expedition from a deleted room.
        if (m.players.length === 0) this.state = new Expedition().snapshot();
        this.elect(); this.send({ kind: 'hello', avatar: this.avatar }); this.status();
      } else if (m.t === 'joined') {
        this.members.set(m.id, { id: m.id, name: m.name });
        if (this.isHost) { this.game.addPlayer(m.id, m.name); this.publish(); }
        this.send({ kind: 'hello', avatar: this.avatar }); this.status();
      } else if (m.t === 'left') {
        this.members.delete(m.id); this.inputs.delete(m.id);
        if (this.isHost) { this.game.removePlayer(m.id); this.publish(); }
        this.elect(); this.status();
      } else if (m.t === 'state' && m.v?.game === 'reliquia-v1' && this.members.has(m.id)) this.receive(m.id, m.v);
    };
    ws.onclose = () => {
      if (ws !== this.socket || this.stopped || this.offline) return;
      this.connected = false; this.onStatus('Se cortó la conexión. Reconectando…', true);
      if (++this.attempts <= 3) this.retry = setTimeout(() => this.connect(), 1500);
      else this.onStatus('Sin conexión. Puedes abrir una expedición local.', true);
    };
    ws.onerror = () => this.onStatus('No pudimos conectar con la sala.', true);
  }
  status() { this.onStatus(`Sala ${this.code} · ${this.members.size} pana${this.members.size === 1 ? '' : 's'}`); }
  elect() {
    const next = Math.min(...this.members.keys()); if (next === this.hostId && this.game) return;
    const previous = this.hostId; this.hostId = next;
    if (!this.isHost) return;
    this.game = new Expedition(); this.inputs.clear();
    if (this.state.phase !== 'lobby') this.game.restore(this.state, this.members);
    for (const p of this.members.values()) this.game.addPlayer(p.id, p.name, p.id === this.id ? this.avatar : p.avatar || this.state.players.find(q => q.id === p.id)?.avatar || {});
    this.publish(); if (previous != null) this.onNotice('Cambió el anfitrión. La expedición continúa.');
  }
  send(data) { if (this.socket?.readyState === WebSocket.OPEN && !this.offline) this.socket.send(JSON.stringify({ t: 'state', v: { game: 'reliquia-v1', ...data } })); }
  receive(id, data) {
    if (data.kind === 'hello') {
      const p = this.members.get(id); p.avatar = data.avatar || {};
      if (this.isHost) { this.game.addPlayer(id, p.name, p.avatar); this.publish(); }
    } else if (data.kind === 'snapshot' && id === this.hostId && !this.isHost && data.state?.players) {
      this.state = data.state; this.onState(this.state);
    } else if (data.kind === 'input' && this.isHost) {
      this.inputs.set(id, { x: Number.isFinite(data.x) ? Math.max(-1, Math.min(1, data.x)) : 0, z: Number.isFinite(data.z) ? Math.max(-1, Math.min(1, data.z)) : 0, hold: !!data.hold, sprint: !!data.sprint, at: performance.now() });
    } else if (data.kind === 'action' && this.isHost) this.handle(id, data);
  }
  handle(id, data) {
    if (!Number.isSafeInteger(data.seq) || data.seq <= (this.game.ledger[id] || 0)) return;
    if (data.action === 'start') {
      if (id !== this.hostId || this.game.phase === 'playing') return;
      this.game.ledger[id] = data.seq;
      this.game.start((Date.now() ^ Math.floor(Math.random() * 0xffffffff)) >>> 0 || 1);
    } else this.game.accept(id, data.seq, data.action);
    this.publish();
  }
  action(action) {
    if (!this.connected) { this.onNotice('Espera a reconectar o abre una expedición local.'); return; }
    const data = { kind: 'action', action, seq: ++this.seq };
    if (this.isHost) this.handle(this.id, data); else this.send(data);
  }
  publish() { this.state = this.game.snapshot(); this.onState(this.state); this.send({ kind: 'snapshot', state: this.state }); }
  tick(dt, input, paused = false) {
    if (!this.connected) return;
    if (this.isHost) {
      this.inputs.set(this.id, input);
      for (const [id, value] of this.inputs) if (id !== this.id && performance.now() - value.at > 600) this.inputs.delete(id);
      if (!paused) this.game.update(dt, this.inputs);
      this.publish();
    } else this.send({ kind: 'input', ...input });
  }
  practice() {
    this.stopped = true; this.offline = true; clearTimeout(this.retry); this.socket?.close();
    this.hostId = null; this.state = new Expedition().snapshot(); this.game = null; this.id = 1; this.seq = 0;
    this.members = new Map([[1, { id: 1, name: this.name, avatar: this.avatar }]]); this.connected = true;
    this.elect(); this.onStatus('Expedición local · puedes activar las dos ruedas a tiempo');
  }
  dispose() { this.stopped = true; clearTimeout(this.retry); this.socket?.close(); }
}
