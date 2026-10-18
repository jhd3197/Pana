import { DEFAULT_OPTIONS, validOptions } from './options.js';
// Plain simulation, shared by the host, UI and Node tests. No browser globals.
export const RECIPES = [
  { id: 'arepa', name: 'Arepa', ingredients: 'Masa + queso', cook: 6, points: 80, color: '#e7ad4d' },
  { id: 'cachapa', name: 'Cachapa', ingredients: 'Maíz + queso', cook: 7, points: 100, color: '#f4bf2e' },
  { id: 'tequenos', name: 'Tequeños', ingredients: 'Masa + queso', cook: 5, points: 70, color: '#dc8a35' },
  { id: 'empanada', name: 'Empanada', ingredients: 'Masa + carne', cook: 8, points: 110, color: '#e99c3a' },
];
export const recipe = id => RECIPES.find(r => r.id === id) || RECIPES[0];
export const DURATION = 180, PREP_TIME = 2.4, BURN_TIME = 12;
export const STATIONS = [
  ...RECIPES.map((r, i) => ({ id: `supply-${r.id}`, type: 'supply', recipe: r.id, label: r.name, x: -9 + i * 3, z: -3, w: 2.6, d: 2.2 })),
  { id: 'prep-1', type: 'prep', label: 'Preparar', x: -9, z: 3, w: 3, d: 2.2 },
  { id: 'prep-2', type: 'prep', label: 'Preparar', x: -3, z: 3, w: 3, d: 2.2 },
  { id: 'stove-1', type: 'stove', label: 'Cocinar', x: 5, z: -3, w: 2.7, d: 2.2 },
  { id: 'stove-2', type: 'stove', label: 'Cocinar', x: 8, z: -3, w: 2.7, d: 2.2 },
  { id: 'stove-3', type: 'stove', label: 'Cocinar', x: 7, z: 3, w: 3, d: 2.2 },
  { id: 'counter-1', type: 'counter', label: 'Pasar plato', x: -3, z: 8.8, w: 3, d: 2 },
  { id: 'serve', type: 'serve', label: 'Servir pedido', x: 4, z: 9.5, w: 6, d: 2.2 },
  { id: 'trash', type: 'trash', label: 'Descartar', x: -10, z: 9, w: 1.6, d: 1.6 },
];
export const BOUNDS = { minX: -12, maxX: 11, minZ: -5, maxZ: 12 };
export function blocked(x, z, r = 0.48) {
  return x < BOUNDS.minX + r || x > BOUNDS.maxX - r || z < BOUNDS.minZ + r || z > BOUNDS.maxZ - r ||
    STATIONS.some(s => Math.abs(x - s.x) < s.w / 2 + r && Math.abs(z - s.z) < s.d / 2 + r);
}
export function move(p, dx, dz) {
  const n = Math.max(1, Math.ceil(Math.hypot(dx, dz) / 0.2));
  for (let i = 0; i < n; i++) {
    if (!blocked(p.x + dx / n, p.z)) p.x += dx / n;
    if (!blocked(p.x, p.z + dz / n)) p.z += dz / n;
  }
}
export function distance(p, s) { return Math.hypot(Math.max(0, Math.abs(p.x - s.x) - s.w / 2), Math.max(0, Math.abs(p.z - s.z) - s.d / 2)); }
export function nearestStation(p) {
  return STATIONS.filter(s => distance(p, s) < 1.15).sort((a, b) => distance(p, a) - distance(p, b))[0];
}
// A one-unit navigation grid keeps helpers out of counters, including corners.
const nodes = [];
for (let z = -4; z <= 11; z++) for (let x = -11; x <= 10; x++) if (!blocked(x, z, 0.58)) nodes.push({ x, z });
const edges = nodes.map(a => nodes.flatMap((b, i) => Math.hypot(a.x - b.x, a.z - b.z) === 1 ? [i] : []));
function route(from, target) {
  const nearest = p => nodes.reduce((best, n, i) => Math.hypot(n.x - p.x, n.z - p.z) < Math.hypot(nodes[best].x - p.x, nodes[best].z - p.z) ? i : best, 0);
  const start = nearest(from), goals = new Set(nodes.flatMap((p, i) => distance(p, target) < 1.05 ? [i] : []));
  const queue = [start], previous = new Map([[start, -1]]); let end;
  for (let k = 0; k < queue.length; k++) {
    const current = queue[k]; if (goals.has(current)) { end = current; break; }
    for (const i of edges[current]) if (!previous.has(i)) { previous.set(i, current); queue.push(i); }
  }
  if (end == null) return [];
  const path = []; for (let i = end; i !== -1; i = previous.get(i)) path.unshift(nodes[i]); return path;
}
const clone = value => JSON.parse(JSON.stringify(value));
const SPAWNS = [[-6, 6], [-3.5, 6], [-1, 6], [1.5, 6], [-6, 9.5], [-0.5, 10.8], [8.5, 7], [9, 10]];
export class Kitchen {
  constructor(options = {}) {
    this.options = { ...DEFAULT_OPTIONS, ...(validOptions(options) ? options : {}) }; this.switched = false; this.kitchen = this.options.kitchen;
    this.phase = 'lobby'; this.remaining = this.options.duration; this.players = []; this.orders = [];
    this.stations = STATIONS.map(s => ({ id: s.id, item: null, progress: 0, fire: 0 }));
    this.score = 0; this.served = 0; this.missed = 0; this.burnt = 0; this.combo = 0;
    this.orderId = 0; this.eventId = 0; this.events = []; this.helpers = true; this.botPaths = new Map();
  }
  configure(options) { if (this.phase === 'playing' || !validOptions(options)) return false; Object.assign(this.options, options); this.kitchen = this.options.kitchen; this.remaining = this.options.duration; return true; }
  get burnTime() { return this.options.fire === 'fast' ? 5 : BURN_TIME; }
  addPlayer(id, name, avatar = {}) {
    const existing = this.players.find(p => p.id === id);
    if (existing) { existing.avatar = avatar; return; }
    if (this.players.filter(p => !p.bot).length >= 8) return;
    // New humans replace helpers, returning any held food to the supply chain.
    const bot = this.players.find(p => p.bot); if (bot) this.removePlayer(bot.id);
    const [x, z] = SPAWNS.find(([x, z]) => !this.players.some(p => Math.hypot(p.x - x, p.z - z) < 1)) || SPAWNS[0];
    this.players.push({ id, name: String(name).slice(0, 24), avatar, bot: false, x, z, h: 0, held: null, moving: false, dash: 0, cooldown: 0, deliveries: 0 });
    this.fillBots();
  }
  removePlayer(id) {
    this.players = this.players.filter(p => p.id !== id); this.botPaths.delete(id);
    for (const s of this.stations) if (s.owner === id) s.owner = null;
  }
  fillBots() {
    if (!this.helpers || this.phase === 'lobby') return;
    const names = ['Coco', 'Lola', 'Pipo'], colors = ['#3d7bf2', '#2eaa70', '#ffc629'];
    for (let i = 0; this.players.length < 3 && i < 3; i++) {
      const id = -i - 1; if (this.players.some(p => p.id === id)) continue;
      this.players.push({ id, name: names[i], avatar: { fur: '#dfa460', outfitColor: colors[i], glasses: 'none', face: i === 1 ? 'lengua' : 'ojazos' }, bot: true, x: -2 + i * 2, z: 6, h: 0, held: null, moving: false, dash: 0, cooldown: 0, deliveries: 0 });
    }
  }
  start(helpers = this.options.helpers) {
    const people = this.players.filter(p => !p.bot).map(p => ({ id: p.id, name: p.name, avatar: p.avatar }));
    Object.assign(this, new Kitchen({ ...this.options, helpers })); this.helpers = helpers;
    for (const p of people) this.addPlayer(p.id, p.name, p.avatar);
    this.phase = 'playing'; this.fillBots();
    for (let i = 0; i < ({ easy: 3, normal: 4, chaos: 5 }[this.options.difficulty]); i++) this.addOrder(i % RECIPES.length);
    this.event('¡Abierta la cocina! Primero busca los ingredientes.', 'start');
  }
  event(text, kind = 'notice') { this.events = [{ id: ++this.eventId, text, kind }]; }
  addOrder(index) {
    const id = ++this.orderId, r = this.options.orders === 'arepa' ? RECIPES[0] : RECIPES[index ?? ((id * 7 + Math.floor(id / 4)) % 4)];
    const patience = (65 + this.orders.length * 9) * ({ easy: 1.5, normal: 1, chaos: .65 }[this.options.difficulty]);
    this.orders.push({ id, recipe: r.id, remaining: patience, total: patience });
  }
  interact(id, stationId) {
    if (this.phase !== 'playing') return '';
    const p = this.players.find(p => p.id === id); if (!p || p.cooldown > 0) return '';
    const def = stationId ? STATIONS.find(s => s.id === stationId) : nearestStation(p);
    if (!def || distance(p, def) >= 1.15) return 'Acércate a una mesa o a un fogón.';
    p.cooldown = 0.2;
    const s = this.stations.find(s => s.id === def.id), held = p.held;
    if (s.fire > 0) { s.fire = Math.max(0, s.fire - 1); if (!s.fire) { s.item = null; s.progress = 0; s.owner = null; } return s.fire ? '¡Otra vez para apagar el fuego!' : '¡Fuego apagado! Fogón listo.'; }
    if (def.type === 'supply') {
      if (held) return 'Tienes las manos ocupadas. Deja el plato en una mesa.';
      p.held = { recipe: def.recipe, stage: 'raw' }; return `${recipe(def.recipe).ingredients}: llévalos a preparar.`;
    }
    if (def.type === 'trash') { p.held = null; return held ? 'Listo, manos libres.' : 'Aquí puedes descartar comida.'; }
    if (def.type === 'serve') {
      if (!held || held.stage !== 'cooked') return 'Trae un plato cocinado para servir.';
      const order = this.orders.find(o => o.recipe === held.recipe);
      if (!order) return 'No hay un pedido de ese plato. Déjalo en la mesa.';
      this.combo = Math.min(5, this.combo + 1);
      const points = recipe(held.recipe).points + (this.options.tips ? (this.combo - 1) * 10 : 0);
      this.score += points; this.served++; p.deliveries++; p.held = null;
      this.orders = this.orders.filter(o => o.id !== order.id); this.addOrder();
      this.event(`¡${recipe(held.recipe).name} servida! +${points}`, 'serve'); return '';
    }
    if (def.type === 'counter') {
      const old = s.item; s.item = held; p.held = old; return p.held ? '¡Plato en mano!' : 'Plato listo para otro pana.';
    }
    if (s.item) {
      if (held) return 'Tienes las manos ocupadas.';
      if (s.item.stage === 'raw' || s.item.stage === 'prepared' && def.type === 'stove') return def.type === 'prep' ? 'Un momentico, estamos preparando…' : 'Todavía se está cocinando…';
      p.held = s.item; s.item = null; s.progress = 0; s.owner = null;
      return p.held.stage === 'prepared' ? '¡Al fogón!' : '¡A servir antes de que se enfríe!';
    }
    if (!held) return def.type === 'prep' ? 'Busca ingredientes en los cajones del fondo.' : 'Primero prepara los ingredientes en una tabla.';
    if (def.type === 'prep' && held.stage !== 'raw') return 'Ese plato ya está preparado.';
    if (def.type === 'stove' && held.stage !== 'prepared') return 'Primero pasa por una tabla de preparar.';
    s.item = held; s.progress = 0; s.owner = id; p.held = null;
    return def.type === 'prep' ? 'Preparando… Recoge cuando esté listo.' : '¡Al fuego! Recoge cuando la barra esté verde.';
  }
  botTarget(p) {
    const owned = this.stations.find(s => s.owner === p.id && s.item);
    if (owned) return STATIONS.find(d => d.id === owned.id);
    const available = type => STATIONS.find(d => d.type === type && !this.stations.find(s => s.id === d.id).item && !this.stations.find(s => s.id === d.id).fire && !this.players.some(other => other.bot && other.id !== p.id && other.target === d.id));
    if (p.held?.stage === 'raw') return available('prep');
    if (p.held?.stage === 'prepared') return available('stove');
    if (p.held?.stage === 'cooked') return STATIONS.find(s => s.id === (this.orders.some(o => o.recipe === p.held.recipe) ? 'serve' : 'trash'));
    if (p.held) return STATIONS.find(s => s.id === 'trash');
    const fire = this.stations.find(s => s.fire); if (fire) return STATIONS.find(d => d.id === fire.id);
    const abandoned = this.stations.find(s => s.item && !this.players.some(other => other.id === s.owner));
    if (abandoned) { abandoned.owner = p.id; return STATIONS.find(d => d.id === abandoned.id); }
    const busy = new Set([...this.players.filter(o => o.id !== p.id && o.held).map(o => o.held.recipe), ...this.stations.filter(s => s.item).map(s => s.item.recipe)]);
    const order = this.orders.find(o => !busy.has(o.recipe)) || this.orders[Math.abs(p.id) % this.orders.length];
    return order && STATIONS.find(s => s.recipe === order.recipe);
  }
  update(dt, inputs = new Map()) {
    if (this.phase !== 'playing') return;
    dt = Math.max(0, Math.min(dt, 0.1)); this.remaining = Math.max(0, this.remaining - dt);
    if (!this.remaining) { this.phase = 'results'; this.players.forEach(p => { p.moving = false; }); return; }
    if (this.options.switchKitchen && !this.switched && this.remaining <= this.options.duration / 2) { this.switched = true; this.kitchen = this.kitchen === 'mercado' ? 'playa' : 'mercado'; this.event('¡Mudanza! La cocina sigue en ' + (this.kitchen === 'playa' ? 'la playa.' : 'el mercado.')); }
    for (const order of [...this.orders]) {
      if (this.options.impatient) order.remaining -= dt;
      if (order.remaining <= 0) { this.orders = this.orders.filter(o => o.id !== order.id); this.missed++; this.combo = 0; this.event(`Se fue un pedido de ${recipe(order.recipe).name.toLowerCase()}.`, 'miss'); this.addOrder(); }
    }
    for (const s of this.stations) {
      if (!s.item || s.fire) continue;
      const def = STATIONS.find(d => d.id === s.id);
      if (def.type !== 'prep' && def.type !== 'stove') continue;
      s.progress += dt;
      if (def.type === 'prep' && s.progress >= PREP_TIME) s.item.stage = 'prepared';
      if (def.type === 'stove') {
        const done = recipe(s.item.recipe).cook;
        if (s.progress >= done) s.item.stage = 'cooked';
        if (s.progress >= done + this.burnTime) { s.item.stage = 'burnt'; s.fire = 2; this.burnt++; this.combo = 0; this.event('¡Se quemó! Acércate al fogón y pulsa E dos veces.', 'fire'); }
      }
    }
    for (const p of this.players) {
      p.cooldown = Math.max(0, p.cooldown - dt); p.dash = Math.max(0, p.dash - dt);
      let input = inputs.get(p.id) || { x: 0, z: 0 }, speed = 5;
      if (p.bot) {
        const target = this.botTarget(p); p.target = target?.id;
        if (target && distance(p, target) < 1.13) { this.interact(p.id, target.id); input = { x: 0, z: 0 }; this.botPaths.delete(p.id); }
        else if (target) {
          let nav = this.botPaths.get(p.id);
          if (!nav || nav.target !== target.id || !nav.path.length) { nav = { target: target.id, path: route(p, target) }; this.botPaths.set(p.id, nav); }
          while (nav.path.length && Math.hypot(p.x - nav.path[0].x, p.z - nav.path[0].z) < 0.08) nav.path.shift();
          const next = nav.path[0]; input = next ? { x: next.x - p.x, z: next.z - p.z } : { x: 0, z: 0 }; speed = 3.6;
        }
      }
      let dx = Number.isFinite(input.x) ? input.x : 0, dz = Number.isFinite(input.z) ? input.z : 0;
      const len = Math.hypot(dx, dz); if (len > 0) { dx /= Math.max(1, len); dz /= Math.max(1, len); }
      if (input.dash && p.dash === 0) p.dash = 2;
      if (p.dash > 1.7) speed *= 1.9;
      const before = { x: p.x, z: p.z }; move(p, dx * dt * speed, dz * dt * speed);
      p.moving = Math.hypot(before.x - p.x, before.z - p.z) > 0.001;
      if (p.moving) p.h = Math.atan2(dx, dz);
    }
  }
  snapshot() { return clone({ options: this.options, kitchen: this.kitchen, switched: this.switched, phase: this.phase, remaining: this.remaining, players: this.players, stations: this.stations, orders: this.orders, score: this.score, served: this.served, missed: this.missed, burnt: this.burnt, combo: this.combo, helpers: this.helpers, orderId: this.orderId, eventId: this.eventId, events: this.events }); }
  restore(state, members) {
    Object.assign(this, clone(state)); this.botPaths = new Map();
    for (const p of [...this.players]) if (!p.bot && !members.has(p.id)) this.removePlayer(p.id);
    this.fillBots();
  }
}
