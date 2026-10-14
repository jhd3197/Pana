import { Kitchen } from './rules.js';

// The oldest peer owns the kitchen. The relay and server protocol stay unchanged.
export class KitchenRoom {
  constructor({ code, name, avatar, onState, onStatus, onNotice }) {
    Object.assign(this, { code, name, avatar, onState, onStatus, onNotice });
    this.members = new Map(); this.inputs = new Map(); this.actions = new Map();
    this.state = new Kitchen().snapshot(); this.seq = 0; this.hostId = null; this.id = null;
    this.connected = false; this.offline = false; this.attempts = 0;
  }
  get isHost() { return this.id != null && this.id === this.hostId; }
  connect() {
    this.stopped = false; this.onStatus('Conectando con tus panas…');
    const ws = this.socket = new WebSocket(`${location.protocol === 'https:' ? 'wss:' : 'ws:'}//${location.host}/ws`);
    ws.onopen = () => ws.send(JSON.stringify({ t: 'join', game: 'cocina', room: this.code, name: this.name }));
    ws.onmessage = e => {
      let m; try { m = JSON.parse(e.data); } catch { return; }
      if (m.t === 'full') { this.stopped = true; this.connected = false; this.onStatus('Sala llena. Puedes abrir tu propia cocina.', true); ws.close(); return; }
      if (m.t === 'welcome') {
        this.id = m.id; this.connected = true; this.attempts = 0;
        this.members = new Map([...m.players, { id: m.id, name: this.name, avatar: this.avatar }].map(p => [p.id, p]));
        this.elect(); this.send({ kind: 'hello', avatar: this.avatar }); this.status();
      } else if (m.t === 'joined') {
        this.members.set(m.id, { id: m.id, name: m.name });
        if (this.isHost) this.game.addPlayer(m.id, m.name);
        this.send({ kind: 'hello', avatar: this.avatar }); this.status(); this.onNotice(`${m.name} se sumó a la cocina.`);
      } else if (m.t === 'left') {
        this.members.delete(m.id); this.inputs.delete(m.id); this.actions.delete(m.id);
        if (this.isHost) { this.game.removePlayer(m.id); this.game.fillBots(); }
        this.elect(); this.status();
      } else if (m.t === 'state' && m.v?.game === 'cocina-v1' && this.members.has(m.id)) this.receive(m.id, m.v);
    };
    ws.onclose = () => {
      if (this.stopped || this.offline) return;
      this.connected = false; this.onStatus('Se cortó la conexión. Reconectando…', true);
      if (++this.attempts <= 3) this.retry = setTimeout(() => this.connect(), 1500);
      else this.onStatus('Sin conexión. Puedes seguir en una cocina local.', true);
    };
    ws.onerror = () => this.onStatus('No se pudo conectar con la sala.', true);
  }
  status() { this.onStatus(`Sala ${this.code} · ${this.members.size} pana${this.members.size === 1 ? '' : 's'} conectado${this.members.size === 1 ? '' : 's'}`); }
  elect() {
    const next = Math.min(...this.members.keys()); if (next === this.hostId && this.game) return;
    const previous = this.hostId; this.hostId = next;
    if (this.isHost) {
      this.game = new Kitchen(); this.inputs.clear(); this.actions.clear();
      if (previous != null && this.state.phase !== 'lobby') this.game.restore(this.state, this.members);
      for (const p of this.members.values()) if (!this.game.players.some(q => q.id === p.id)) this.game.addPlayer(p.id, p.name, p.id === this.id ? this.avatar : p.avatar || {});
      this.publish();
      if (previous != null) this.onNotice('Cambió el anfitrión. ¡La cocina sigue abierta!');
    }
  }
  send(data) { if (this.socket?.readyState === WebSocket.OPEN) this.socket.send(JSON.stringify({ t: 'state', v: { game: 'cocina-v1', ...data } })); }
  receive(id, data) {
    if (data.kind === 'hello') {
      const member = this.members.get(id); member.avatar = data.avatar || {};
      if (this.isHost) this.game.addPlayer(id, member.name, member.avatar);
    } else if (data.kind === 'snapshot' && id === this.hostId && !this.isHost) {
      this.state = data.state; this.onState(this.state);
    } else if (data.kind === 'input' && this.isHost) {
      this.inputs.set(id, { x: Number.isFinite(data.x) ? Math.max(-1, Math.min(1, data.x)) : 0, z: Number.isFinite(data.z) ? Math.max(-1, Math.min(1, data.z)) : 0, dash: !!data.dash, at: performance.now() });
    } else if (data.kind === 'action' && this.isHost && Number.isSafeInteger(data.seq)) {
      if (data.seq <= (this.actions.get(id) || 0)) return;
      this.actions.set(id, data.seq); this.handle(id, data);
    } else if (data.kind === 'notice' && id === this.hostId && data.to === this.id) this.onNotice(data.text);
  }
  handle(id, data) {
    let message;
    if (data.action === 'start' && id === this.hostId && this.game.phase !== 'playing') this.game.start(data.helpers !== false);
    else if (data.action === 'interact') message = this.game.interact(id, data.station);
    if (message) { if (id === this.id) this.onNotice(message); else this.send({ kind: 'notice', to: id, text: message }); }
    this.publish();
  }
  action(action, extra = {}) {
    if (!this.connected) { this.onNotice('Espera a reconectar o abre una cocina local.'); return; }
    const data = { kind: 'action', seq: ++this.seq, action, ...extra };
    if (this.isHost) this.handle(this.id, data); else this.send(data);
  }
  publish() { this.state = this.game.snapshot(); this.onState(this.state); if (!this.offline) this.send({ kind: 'snapshot', state: this.state }); }
  tick(dt, input, paused = false) {
    if (!this.connected) return;
    if (this.isHost) {
      this.inputs.set(this.id, input);
      for (const [id, i] of this.inputs) if (id !== this.id && performance.now() - i.at > 600) this.inputs.delete(id);
      if (!paused) this.game.update(dt, this.inputs);
      this.publish();
    } else this.send({ kind: 'input', ...input });
  }
  practice() {
    this.stopped = true; this.offline = true; clearTimeout(this.retry); this.socket?.close();
    this.hostId = null; this.state = new Kitchen().snapshot(); this.id = 1;
    this.members = new Map([[1, { id: 1, name: this.name, avatar: this.avatar }]]); this.connected = true;
    this.elect(); this.onStatus('Cocina local · tú y los ayudantes');
  }
  dispose() { this.stopped = true; clearTimeout(this.retry); this.socket?.close(); }
}
