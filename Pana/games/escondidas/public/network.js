// Round authority stays with the oldest connected player. All gameplay data
// rides inside the relay's existing `v` field; no server protocol changes.
import { HuntRound } from './rules.js';

export class HuntRoom {
  constructor({ code, name, avatar, onState, onStatus, onNotice }) {
    Object.assign(this, { code, name, avatar, onState, onStatus, onNotice });
    this.members = new Map(); this.inputs = new Map(); this.seq = 0;
    this.lastAction = new Map(); this.id = null; this.hostId = null;
    this.connected = false; this.offline = false; this.attempts = 0;
    this.state = new HuntRound().snapshot();
  }
  get isHost() { return this.id != null && this.id === this.hostId; }
  connect() {
    this.stopped = false;
    this.onStatus('Conectando con tus panas…');
    const ws = this.socket = new WebSocket(`${location.protocol === 'https:' ? 'wss:' : 'ws:'}//${location.host}/ws`);
    ws.onopen = () => ws.send(JSON.stringify({ t: 'join', game: 'escondidas', room: this.code, name: this.name }));
    ws.onmessage = event => {
      let msg; try { msg = JSON.parse(event.data); } catch { return; }
      if (msg.t === 'full') {
        this.stopped = true; this.connected = false;
        this.onStatus('La sala está llena (8 panas). Puedes practicar sin conexión.', true); ws.close(); return;
      }
      if (msg.t === 'welcome') {
        this.connected = true; this.attempts = 0; this.id = msg.id;
        this.members = new Map([...msg.players, { id: msg.id, name: this.name }].map(p => [p.id, p]));
        this.elect(); this.send({ kind: 'hello', avatar: this.avatar });
        this.onStatus(`Sala ${this.code} · ${this.members.size} pana${this.members.size === 1 ? '' : 's'} conectado${this.members.size === 1 ? '' : 's'}`);
      } else if (msg.t === 'joined') {
        this.members.set(msg.id, { id: msg.id, name: msg.name });
        this.elect();
        if (this.isHost) this.game.addPlayer(msg.id, msg.name, {});
        this.send({ kind: 'hello', avatar: this.avatar });
        this.onNotice(`${msg.name} llegó a la plaza.`);
      } else if (msg.t === 'left') {
        this.members.delete(msg.id); this.inputs.delete(msg.id); this.lastAction.delete(msg.id);
        if (this.isHost) this.game.removePlayer(msg.id);
        this.elect();
      } else if (msg.t === 'state' && msg.v?.game === 'hunt-v1' && this.members.has(msg.id)) {
        this.receive(msg.id, msg.v);
      }
    };
    ws.onclose = () => {
      if (this.stopped || this.offline) return;
      this.connected = false;
      this.onStatus('Se cortó la conexión. Reconectando…', true);
      if (++this.attempts <= 3) this.retry = setTimeout(() => this.connect(), 1800);
      else this.onStatus('No pudimos conectar. Puedes practicar sin conexión.', true);
    };
    ws.onerror = () => this.onStatus('No se pudo conectar con la sala.', true);
  }
  elect() {
    const next = Math.min(...this.members.keys());
    if (next === this.hostId) return;
    const previous = this.hostId; this.hostId = next;
    if (this.isHost) {
      this.game = new HuntRound(); this.inputs.clear();
      for (const p of this.members.values()) this.game.addPlayer(p.id, p.name, p.id === this.id ? this.avatar : p.avatar || {});
      this.state = this.game.snapshot(); this.onState(this.state);
      if (previous != null) this.onNotice('Cambió el anfitrión. Preparen una nueva partida.');
    }
  }
  receive(id, data) {
    if (data.kind === 'hello') {
      const member = this.members.get(id); member.avatar = data.avatar;
      if (this.isHost) {
        this.game.addPlayer(id, member.name, data.avatar);
        const p = this.game.players.find(p => p.id === id); if (p) p.avatar = data.avatar;
      }
    } else if (data.kind === 'snapshot' && id === this.hostId && !this.isHost) {
      this.state = data.state; this.onState(this.state);
    } else if (data.kind === 'input' && this.isHost) {
      this.inputs.set(id, { x: Number.isFinite(data.x) ? Math.max(-1, Math.min(1, data.x)) : 0,
        z: Number.isFinite(data.z) ? Math.max(-1, Math.min(1, data.z)) : 0, sprint: !!data.sprint, at: performance.now() });
    } else if (data.kind === 'action' && this.isHost && Number.isSafeInteger(data.seq)) {
      if (data.seq <= (this.lastAction.get(id) || 0)) return;
      this.lastAction.set(id, data.seq); this.handleAction(id, data);
    } else if (data.kind === 'notice' && id === this.hostId && data.to === this.id) this.onNotice(data.text);
  }
  send(data) {
    if (this.socket?.readyState === WebSocket.OPEN) this.socket.send(JSON.stringify({ t: 'state', v: { game: 'hunt-v1', ...data } }));
  }
  notice(id, text) {
    if (id === this.id) this.onNotice(text);
    else this.send({ kind: 'notice', to: id, text });
  }
  handleAction(id, action) {
    if (action.action === 'start' && id === this.hostId) this.game.start(id, action.preference);
    else if (action.action === 'transform') {
      const error = this.game.transform(id, action.prop);
      this.notice(id, error || (action.prop ? '¡Listo! Quédate quieto y pasa desapercibido.' : 'Volviste a ser pana.'));
    } else if (action.action === 'check') {
      const p = this.game.players.find(p => p.id === id);
      if (!p || p.cooldown > 0 || this.game.phase !== 'hunt' || id !== this.game.seeker) return;
      this.notice(id, this.game.check(id) ? '¡Ajá! Aquí había un pana.' : 'Nada por aquí… Prueba con otro objeto.');
    }
    this.state = this.game.snapshot(); this.onState(this.state);
  }
  action(action, extra = {}) {
    if (!this.connected && !this.offline) { this.onNotice('Espera a reconectar o entra a practicar.'); return; }
    const data = { kind: 'action', seq: ++this.seq, action, ...extra };
    if (this.isHost) this.handleAction(this.id, data); else this.send(data);
  }
  tick(dt, input, paused = false) {
    if (!this.connected && !this.offline) return;
    if (this.isHost) {
      this.inputs.set(this.id, input);
      for (const [id, i] of this.inputs) if (id !== this.id && performance.now() - i.at > 600) this.inputs.delete(id);
      if (!paused) this.game.update(dt, this.inputs);
      this.state = this.game.snapshot(); this.onState(this.state);
      if (!this.offline) this.send({ kind: 'snapshot', state: this.state });
    } else this.send({ kind: 'input', ...input });
  }
  practice() {
    this.stopped = true; this.offline = true; clearTimeout(this.retry); this.socket?.close();
    this.id = 1; this.hostId = null; this.members = new Map([[1, { id: 1, name: this.name }]]);
    this.connected = true; this.elect(); this.onStatus('Práctica con 3 panas de la máquina.');
  }
  dispose() { this.stopped = true; clearTimeout(this.retry); this.socket?.close(); }
}
