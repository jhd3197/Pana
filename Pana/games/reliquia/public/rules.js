// Reliquia's expedition, renderer-free: the host runs it at 20 Hz and guests
// render its snapshots. A run is camp → floor 1 → … → the vault; panas carry
// loot back to the truck to bank it, and la codicia rises with every
// treasure lifted from its resting place. See docs/knowledge/reliquia.md.
import { DEFAULT_OPTIONS, validOptions } from './options.js';
import { TRUCK, TRUCK_RADIUS, CAMP, floorOf, inRect, FLOOR_NAMES, CAGE } from './deck.js';
import { layoutFor, distance } from './layout.js';
import { ITEMS, HANDFUL, WEAPONS, SMALL, ARTIFACTS, valueOf, heldValue } from './items.js';
import { spawnEnemy, updateEnemies, holds } from './enemies.js';
import { createDirector, updateDirector, random } from './director.js';
import { clamp } from '../../../engine/random.js';
import { resetJump } from '../../../engine/play/jump.js';
import { stepWalker } from '../../../engine/play/walker.js';
import { pickLine } from '../../../engine/play/frases.js';
import { locKey } from '../../../engine/i18n.js';

const clone = value => JSON.parse(JSON.stringify(value));
export const alive = p => !p.downed && !p.spectator;
export { holds };
// Text in state and events is a Spanish key (locKey) plus `vars`; each client
// shows it in its own language with say() from items.js.
export const BARKS = [locKey('¿Nos vamos ya?'), locKey('¡Una sala más!'), locKey('¡Agárrala por el otro lado!'), locKey('¡No toques eso!'), locKey('¡Suelta, suelta, suelta!'), locKey('¡Pásame el farol!'), locKey('Ábrela.')];
const REACH = 2.5, GRAVITY = 14, REVIVE = 2.4, CART_SIZE = 14, BOARD = 1.5, SHAFT = 14, CARGO = 3;
const GREED = { soft: .65, normal: 1, fierce: 1.5 };

// One explorer's own movement for dt: the host's simulation and a guest's
// prediction (engine/predict.js). It only writes p; the state decides the rest.
export function stepExplorer(p, input, dt, world) {
  const L = layoutFor(world.seed, world.level);
  if (Number.isFinite(input.h)) p.h = input.h;
  if (Number.isFinite(input.pitch)) p.pitch = clamp(input.pitch, -1.2, 1.2);
  if (p.grip != null || p.push != null || p.draggedBy != null || p.riding || p.downed || p.spectator) { resetJump(p, input); if (!p.riding) p.y = L.groundAt(p.x,p.z); p.moving = false; return; }
  // Sandals speed you up but you slide; a rope drags, a slow curse and a stun hold you back.
  const sandals = holds(p, 'sandals'), pace = base => {
    let speed = base;
    if (sandals) speed *= 1.55;
    if (p.drag != null) speed *= .55;
    if (p.slow > 0) speed *= .6;
    return p.stun > 0 ? 0 : speed;
  };
  p.moving = stepWalker(p, input, dt, {
    walk: pace(4.6), run: pace(6.6), minStamina: .05, deadzone: .1, reversed: p.reversed > 0, inertia: sandals ? 2.2 : 0, velocity: p,
    move: (q, dx, dz) => L.moveBody(q, dx, dz, world, .42), jump: { gravity: GRAVITY, blocked: !(p.stun <= 0) }, ground: q => L.groundAt(q.x, q.z),
  }).moving;
}

// What E does right now: whatever the crosshair points at. Every target is a
// point with a size; the one closest to the line of sight wins. Something
// right at your feet in front of you counts too, so the floor is easy.
export function interaction(s, p) {
  if (!p || !alive(p)) return null;
  if (p.grip != null) return { kind: 'release', text: locKey('Soltar el tesoro'), press: true };
  if (p.push != null) return { kind: 'release', text: locKey('Soltar el carrito'), press: true };
  const L = layoutFor(s.seed, s.level), f = floorOf(p.x), pitch = p.pitch || 0, cp = Math.cos(pitch);
  const eye = { x: p.x, y: (p.y || 0) + 1.45, z: p.z }, look = { x: Math.sin(p.h) * cp, y: Math.sin(pitch), z: Math.cos(p.h) * cp };
  const options = [];
  const offer = (target, pt, r, reach = REACH) => {
    if (floorOf(pt.x) !== f) return;
    const dx = pt.x - eye.x, dy = (pt.y ?? .4) - eye.y, dz = pt.z - eye.z, d = Math.hypot(dx, dy, dz), flat = Math.hypot(dx, dz);
    if (d > reach + r) return;
    const angle = Math.acos(clamp((dx * look.x + dy * look.y + dz * look.z) / (d || 1), -1, 1)), allow = Math.atan2(r, d) + .08;
    if (angle <= allow) options.push({ ...target, score: angle / allow + d * .04 });
    else if (flat < 1.4 && (dx * Math.sin(p.h) + dz * Math.cos(p.h)) / (flat || 1) > .7) options.push({ ...target, score: 1.6 + flat });
  };
  for (const q of s.players) if (q.id !== p.id && q.downed && !q.spectator && q.draggedBy == null && s.options?.revive !== false)
    offer({ kind: 'revive', id: q.id, text: locKey('Mantén E para levantar a {name}'), vars: { name: q.name }, progress: q.revive / reviveTime(p), hold: true }, { x: q.x, y: .35, z: q.z }, .7, 2.8);
  for (const seal of L.run.seals) for (const w of seal.winches || []) if (!s.open[seal.id])
    offer({ kind: 'winch', id: w.id, text: s.winches[w.id]?.latched > 0 ? locKey('Rueda activa · ¡la otra!') : locKey('Mantén E para girar la rueda'), progress: (s.winches[w.id]?.progress || 0) / 1.6, hold: true }, { x: w.x, y: 1.55, z: w.z }, .9);
  for (const [id, progress] of Object.entries(s.rubble)) { const c = L.run.corridors.find(c => c.id === id); if (c) offer({ kind: 'rubble', id, text: locKey('Mantén E para quitar las piedras'), progress: progress / 5, hold: true }, { x: clamp(p.x, c.rect[0], c.rect[2]), y: 1, z: clamp(p.z, c.rect[1], c.rect[3]) }, 1.6, 3); }
  // The montacargas: one button. Waiting here it rides; away, it is called.
  const stop = L.run.lifts.find(l => l.floor === f), lift = s.lift;
  if (stop && lift) {
    const progress = (lift.hold?.progress || 0) / BOARD;
    if (!lift.moving && lift.floor === f) {
      const go = liftButton(s, stop), at = liftPanel(stop);
      offer(go.to == null ? { kind: 'info', text: go.why, vars: go.vars } : { kind: 'ride', to: go.to, text: go.to === 0 ? locKey('Mantén E: subir al campamento') : locKey('Mantén E: bajar a la jornada {level}'), vars: { level: s.level }, progress, hold: true }, { x: at.x, y: 1.1, z: at.z }, .5, 3);
    }
    else offer(lift.moving ? { kind: 'info', text: !lift.riders.length ? locKey('El montacargas viene en camino…') : lift.to > lift.from ? locKey('El montacargas está ocupado · va bajando') : locKey('El montacargas está ocupado · va subiendo') }
      : { kind: 'call', text: lift.floor ? locKey('Mantén E: llamar el montacargas (está abajo)') : locKey('Mantén E: llamar el montacargas (está en el campamento)'), progress, hold: true }, { x: stop.x, y: 1.4, z: stop.z }, 1.8, 5);
  }
  // The cargo lift: the carrito rides it up alone and its load counts.
  for (const pad of L.run.cargo) {
    if (pad.floor === 0) continue;
    const cargo = s.cargo, cart = (s.carts || []).find(c => !c.away && Math.hypot(c.x - pad.x, c.z - pad.z) < 1.4);
    const target = cargo?.phase && cargo.phase !== 'idle' ? { kind: 'info', text: cargo.phase === 'up' ? locKey('El carrito va subiendo…') : locKey('El carrito vacío viene bajando…') }
      : cart ? { kind: 'cargo', text: locKey('Subir el carrito · Bs. {load} (van Bs. {delivered} de Bs. {quota})'), vars: { load: cartValue(cart), delivered: s.delivered || 0, quota: s.quota }, press: true }
      : { kind: 'info', text: locKey('Empuja el carrito a la plataforma de carga') };
    offer(target, { x: pad.bx, y: 1.1, z: pad.bz }, .5, 3);
  }
  if (f === 0) {
    offer({ kind: 'leave', text: s.extraction > 0 ? locKey('¡Nos vamos!') : locKey('Mantén E: terminar la expedición y repartir el botín'), progress: s.extraction / 3, hold: true }, { x: TRUCK.x, y: 1.2, z: TRUCK.z }, 2.6, 6);
    for (const [i, [kind, price]] of SHOP.entries()) { const at = shopSpot(i); offer({ kind: 'buy', item: kind, text: s.mangos >= price ? locKey('Comprar {item} · {price} mangos') : locKey('{Item} · {price} mangos (tienen {mangos})'), vars: { item: kind, price, mangos: String(Math.floor(s.mangos)) }, press: true }, at, .35, 3); }
  }
  for (const cart of s.carts || []) {
    if (cart.pushers.length >= 2 || cart.away) continue;
    const held = p.hands.find(h => h && !ITEMS[h.kind].tool), full = cart.contents.length >= CART_SIZE;
    const target = held && !full ? { kind: 'cart-load', id: cart.id, text: !held.pile ? locKey('Echar {item} al carrito') : held.pile.length > 1 ? locKey('Echar {n} piezas al carrito') : locKey('Echar 1 pieza al carrito'), vars: { item: held.kind, n: held.pile?.length }, press: true }
      : !p.hands.some(Boolean) ? { kind: 'cart-push', id: cart.id, text: locKey('Empujar el carrito · Bs. {value}'), vars: { value: cartValue(cart) }, press: true } : { kind: 'info', text: locKey('El carrito lleva Bs. {value} · suelta lo que tienes para empujarlo'), vars: { value: cartValue(cart) } };
    offer(target, { x: cart.x, y: .7, z: cart.z }, .95, 3);
  }
  for (const c of L.run.chests) if (!s.chests[c.id]) offer({ kind: 'chest', id: c.id, text: locKey('Abrir el cofre'), press: true }, { x: c.x, y: .5, z: c.z }, .65);
  for (const item of visibleItems(s)) {
    if (item.state === 'air') continue;
    const info = ITEMS[item.kind];
    if (info.size === 'big' && (item.carriers?.length || 0) >= info.need + 1) continue;
    let text = locKey('Agarrar {item}'), vars = { item: item.kind };
    const weapon = WEAPONS.includes(item.kind) && p.hands.find(h => h && WEAPONS.includes(h.kind));
    if (weapon) { text = locKey('Cambiar {item} por {other}'); vars = { item: weapon.kind, other: item.kind }; }
    else if (info.size === 'small' && !p.hands.some(h => !h || (h.pile && h.pile.length < HANDFUL))) text = locKey('Manos llenas · échalo al carrito');
    else if (info.size === 'hand' && p.hands.every(Boolean)) text = locKey('Manos llenas · suelta algo con Q');
    if (info.size === 'big' && p.hands.some(Boolean)) text = locKey('Necesitas las dos manos libres');
    offer({ kind: 'pick', id: item.id, text, vars, press: true }, { x: item.x, y: (item.y || 0) + (info.size === 'big' ? .8 : .2), z: item.z }, info.size === 'big' ? (info.radius || 1) : .38);
  }
  options.sort((a, b) => a.score - b.score);
  return options[0] || null;
}
// The montacargas: one cage in one shaft, one button on its right post.
export const liftPanel = stop => ({ x: stop.x - Math.cos(stop.h) * 1.15, z: stop.z + Math.sin(stop.h) * 1.15 });
// Down from the camp into the jornada; up only once the cargo lift has
// delivered the jornada's quota.
export function liftButton(s, stop) {
  if (stop.floor === 0) return { to: 1 };
  if ((s.delivered || 0) < s.quota) return { why: locKey('El montacargas sube cuando la carga haya subido Bs. {quota} · van Bs. {delivered}'), vars: { quota: s.quota, delivered: s.delivered || 0 } };
  return { to: 0 };
}
// What the camp's shop sells, in mangos, and where each piece sits on the counter.
export const SHOP = [['farol', 10], ['botiquin', 15], ['machete', 20], ['honda', 25], ['marcadora', 45]];
export const SHOP_AT = { x: -12.5, z: 6, h: Math.PI / 2 };
export const shopSpot = i => ({ x: SHOP_AT.x + .9, y: 1.05, z: SHOP_AT.z - 1.5 + i * .75 });
// Where the cage is drawn: during a trip it sinks out of one stop and rises into the next.
export function liftView(lift) {
  if (!lift?.moving) return { floor: lift?.floor ?? 0, y: 0 };
  const t = Math.min(1, lift.t / lift.duration), dir = Math.sign(lift.to - lift.from);
  return t < .5 ? { floor: lift.from, y: -dir * t * 2 * SHAFT } : { floor: lift.to, y: dir * (1 - (t - .5) * 2) * SHAFT };
}
export const cartValue = cart => cart.contents.reduce((n, c) => n + valueOf(c.kind) * (c.worth ?? 1), 0) + (cart.big ? valueOf(cart.big.kind) * (cart.big.worth ?? 1) : 0);
export const reviveTime = p => holds(p, 'botiquin') ? REVIVE / 2 : REVIVE;
// Every pickable item: the deck's untouched loot plus what moved this run.
export function visibleItems(s) {
  const run = layoutFor(s.seed, s.level).run;
  return [...run.loot.filter(l => !s.touched[l.id]).map(l => ({ ...l, state: 'ground', y: l.y || 0 })), ...s.items];
}
// Where the crooked compass points: the best treasure, or every third
// quarter-minute the nearest big enemy.
export function compassTarget(s, p) {
  const f = floorOf(p.x), boss = s.enemies.filter(e => floorOf(e.x) === f).sort((a, b) => b.maxHp - a.maxHp)[0];
  if (boss && (Math.floor(s.time / 15) + p.seat) % 3 === 2) return { x: boss.x, z: boss.z, boss: true };
  const best = visibleItems(s).filter(i => floorOf(i.x) === f && i.state === 'ground').sort((a, b) => valueOf(b.kind) - valueOf(a.kind))[0];
  return best ? { x: best.x, z: best.z, boss: false } : null;
}
export const tier = s => Math.min(4, Math.floor(s.codicia / 25));
const TITLES = [['unaMas', locKey('El codicioso'), locKey('pidió una sala más')], ['dropped', locKey('Manos de mantequilla'), locKey('soltó tesoro')], ['banked', locKey('El cargador'), locKey('subió al camión')],
  ['curses', locKey('El que tocó lo que no era'), locKey('despertó maldiciones')], ['last', locKey('El cobarde'), locKey('siempre de último')]];
export function titles(s) {
  const out = [];
  for (const [stat, title, detail] of TITLES) {
    const best = [...s.players].filter(p => !p.spectator).sort((a, b) => b.stats[stat] - a.stats[stat])[0];
    if (best && best.stats[stat] > (stat === 'last' ? 20 : 0)) out.push({ title, player: best.id, name: best.name, detail, value: Math.round(best.stats[stat]) });
  }
  return out;
}

// What a jornada asks the cargo lift to bring up: more each level and more
// with more panas.
export function quotaFor(level, roster) {
  return Math.round((400 + 300 * (level - 1)) * (.7 + .1 * Math.min(8, Math.max(1, roster))) / 50) * 50;
}
const levelSeed = (seed, level) => level === 1 ? seed : ((seed ^ Math.imul(level, 2654435761)) >>> 0) || 1;
export class Expedition {
  constructor(seed = 1, options = {}) {
    this.options = { ...DEFAULT_OPTIONS, ...(validOptions(options) ? options : {}) };
    Object.assign(this, { phase: 'lobby', outcome: '', payout: 0, time: 0, seed: seed >>> 0 || 1, rng: seed >>> 0 || 1, players: [], enemies: [], items: [], darts: [], shots: [], splats: [],
      touched: {}, chests: {}, open: {}, revealed: {}, rubble: {}, winches: {}, woke: {}, plates: {}, carts: [], haul: 0,
      lift: { floor: 0, from: 0, to: 0, t: 0, duration: 0, moving: false, switched: false, riders: [], carts: [], items: [], hold: null }, truck: [], codicia: 0, deepest: 0, extraction: 0, wipe: 0,
      level: 1, mangos: 0, quota: 0, delivered: 0, cargo: { phase: 'idle', t: 0, cart: null }, origin: seed >>> 0 || 1,
      director: createDirector(), kills: 0, enemyId: 0, itemId: 10000, shotId: 0, eventId: 0, events: [], ledger: {}, collapseIn: 30, seats: 0 });
    this.paths = new Map();
  }
  get layout() { return layoutFor(this.seed, this.level); }
  configure(options) { if (this.phase === 'playing' || !validOptions(options)) return false; Object.assign(this.options, options); return true; }
  addPlayer(id, name, avatar = {}) {
    let p = this.players.find(p => p.id === id); if (p) { p.avatar = avatar; return p; }
    const index = this.players.length;
    p = { id, name: String(name).slice(0, 16), avatar, seat: this.seats++, x: CAMP.x + (index % 4 - 1.5) * 1.6, z: CAMP.z + 4 + Math.floor(index / 4) * 1.6, y: 0, h: Math.PI, pitch: 0,
      vx: 0, vz: 0, hp: 100, downed: false, spectator: this.phase === 'results', revive: 0, hands: [null, null], grip: null, drag: null, draggedBy: null,
      cooldown: 0, swing: 0, swingHand: 0, stamina: 1, stun: 0, reversed: 0, invulnerable: 0, hit: 0, interactCooldown: 0, barkAt: -9, moving: false, drain: 0,
      stats: { unaMas: 0, nosVamos: 0, dropped: 0, banked: 0, curses: 0, last: 0, revives: 0, kills: 0 } };
    this.players.push(p); return p;
  }
  removePlayer(id) {
    const p = this.players.find(p => p.id === id); if (!p) return;
    this.release(p); this.unpush(p); this.stopDrag(p);
    for (const q of this.players) if (q.drag === id) this.stopDrag(q);
    if (this.phase === 'playing') p.hands.forEach((h, i) => h && this.drop(p, i));
    this.players = this.players.filter(q => q.id !== id); delete this.ledger[id];
  }
  event(kind, text = '', extra = {}) { this.events.push({ id: ++this.eventId, kind, text, ...extra }); this.events = this.events.slice(-16); }
  start(seed = this.seed) {
    const roster = this.players.map(p => ({ id: p.id, name: p.name, avatar: p.avatar }));
    const { ledger, eventId } = this;
    Object.assign(this, new Expedition(seed, this.options)); this.ledger = ledger; this.eventId = eventId;
    roster.forEach(p => this.addPlayer(p.id, p.name, p.avatar)); this.phase = 'playing';
    this.carts = this.layout.run.carts.map(c => ({ ...c, contents: [], big: null, pushers: [], vx: 0, vz: 0 }));
    this.quota = quotaFor(1, this.players.length);
    this.event('start', locKey('Jornada 1: bajen, llenen el carrito y súbanlo por la carga hasta juntar Bs. {quota}.'), { vars: { quota: this.quota } });
  }
  accept(id, seq, action, data = {}) {
    if (!Number.isSafeInteger(seq) || seq <= (this.ledger[id] || 0) || !this.players.some(p => p.id === id)) return false;
    this.ledger[id] = seq; return this.action(id, action, data);
  }
  // ---------- Items ----------
  // Lift an item off the map: the deck's copy becomes a moving item once.
  take(id) {
    let item = this.items.find(i => i.id === id);
    if (item) return item;
    const rest = this.layout.run.loot.find(l => l.id === id && !this.touched[id]); if (!rest) return null;
    this.touched[id] = 1;
    item = { id, kind: rest.kind, x: rest.x, z: rest.z, y: rest.y || 0, h: rest.h, vx: 0, vy: 0, vz: 0, state: 'ground', carriers: [], room: rest.room, worth: 1 };
    this.items.push(item);
    // Lifting treasure from where it rested is what wakes la codicia.
    const value = valueOf(rest.kind), roster = Math.max(1, this.players.filter(p => !p.spectator).length);
    if (value) this.greed(value / 45 * clamp(1.2 - .05 * (roster - 1), .85, 1.2));
    if (rest.cursed || ITEMS[rest.kind].artifact) this.curse(rest);
    if (this.layout.run.rooms.find(r => r.id === rest.room)?.kind === 'boveda') for (const e of this.enemies) if (e.kind === 'jaguar' && !e.awake) { e.awake = true; this.event('boss', locKey('¡El jaguar de oro despertó!'), { enemy: e.id, boss: 'jaguar' }); }
    return item;
  }
  greed(amount) {
    const before = tier(this);
    this.codicia = clamp(this.codicia + amount * (GREED[this.options.greed] || 1), 0, 100);
    const after = tier(this);
    if (after > before) this.event('greed', ['', locKey('La ruina se queja: cae polvo del techo.'), locKey('Las estatuas voltean la cabeza…'), locKey('¡La ruina se está cerrando! Los túneles se derrumban.'), locKey('¡TORMENTA DE MALDICIÓN! Salgan ya.')][after], { tier: after });
  }
  curse(rest) {
    const holder = this.players.find(p => alive(p) && distance(p, rest) < 4);
    if (holder) holder.stats.curses++;
    this.greed(5);
    const room = this.layout.run.rooms.find(r => r.id === rest.room);
    this.event('curse', holder ? locKey('{name} agarró {item}. Algo despertó.') : locKey('Alguien agarró {item}. Algo despertó.'), { player: holder?.id, item: rest.kind, vars: { name: holder?.name, item: rest.kind } });
    if (room && room.kind === 'idolo') for (const s of [-1, 1]) spawnEnemy(this, 'mummy', room.x + s * 3.5, room.z - 3);
  }
  spawnItem(kind, x, z, extra = {}) {
    const item = { id: this.itemId++, kind, x, z, y: .4, h: random(this) * 6.28, vx: 0, vy: 0, vz: 0, state: 'ground', carriers: [], worth: 1, ...extra };
    this.items.push(item); return item;
  }
  // A hand's item falls at the pana's feet (or flies, when thrown).
  drop(p, hand, throwIt = false) {
    const held = p.hands[hand]; if (!held) return null;
    p.hands[hand] = null;
    const forward = { x: Math.sin(p.h), z: Math.cos(p.h) }, power = throwIt ? 10 : 0;
    // A handful leaves as separate pieces, fanned out a little.
    if (held.pile) {
      const pieces = held.pile.map((kind, i) => {
        const a = p.h + (i - (held.pile.length - 1) / 2) * .18, speed = throwIt ? 9 + i * .4 : 1.2;
        return this.spawnItem(kind, p.x + forward.x * .5, p.z + forward.z * .5, { state: 'air', y: 1.2, vx: Math.sin(a) * speed, vz: Math.cos(a) * speed, vy: throwIt ? 3 + Math.sin(p.pitch || 0) * 6 : 1.5, thrower: p.id, thrownAt: this.time });
      });
      return pieces[0];
    }
    const item = { id: held.id, kind: held.kind, uses: held.uses, x: p.x + forward.x * .5, z: p.z + forward.z * .5, y: 1.2, h: p.h, vx: forward.x * power + p.vx * .5, vz: forward.z * power + p.vz * .5,
      vy: throwIt ? 3 + Math.sin(p.pitch || 0) * 6 : 0, state: 'air', carriers: [], thrower: p.id, thrownAt: this.time, worth: held.worth ?? 1 };
    if (!this.layout.walkable(item.x, item.z, this, .1)) { item.x = p.x; item.z = p.z; }
    this.items.push(item);
    return item;
  }
  pick(p, item) {
    const info = ITEMS[item.kind];
    if (info.size === 'small') {
      // Into a handful that has room, else an empty hand.
      let hand = p.hands.findIndex(h => h?.pile && h.pile.length < HANDFUL);
      if (hand < 0) hand = p.hands.findIndex(h => !h); if (hand < 0) return false;
      this.take(item.id); this.items = this.items.filter(i => i.id !== item.id);
      if (p.hands[hand]) p.hands[hand].pile.push(item.kind); else p.hands[hand] = { id: item.id, kind: item.kind, pile: [item.kind] };
      this.event('pick', '', { player: p.id, item: item.kind, hand }); return true;
    }
    if (info.size === 'hand') {
      // One weapon at a time: a new one takes the old one's hand.
      const weapon = WEAPONS.includes(item.kind) ? p.hands.findIndex(h => h && WEAPONS.includes(h.kind)) : -1;
      if (weapon >= 0) this.drop(p, weapon);
      const hand = weapon >= 0 ? weapon : p.hands[0] ? p.hands[1] ? -1 : 1 : 0; if (hand < 0) return false;
      const taken = this.take(item.id); this.items = this.items.filter(i => i.id !== item.id);
      p.hands[hand] = { id: item.id, kind: item.kind, uses: taken.uses ?? (item.kind === 'miche' ? 3 : undefined), worth: taken.worth ?? 1 };
      this.event('pick', '', { player: p.id, item: item.kind, hand }); return true;
    }
    if (p.hands.some(Boolean)) return false;
    const big = this.take(item.id), need = info.need;
    if (big.carriers.length >= need + 1) return false;
    big.state = 'big'; big.carriers.push(p.id); p.grip = big.id;
    this.event('grab', big.carriers.length < need ? locKey('{name} agarró {item}. Hacen falta {need} panas para llevarlo bien.') : '', { player: p.id, item: big.kind, vars: { name: p.name, item: big.kind, need } });
    return true;
  }
  release(p) {
    if (p.grip == null) return;
    const item = this.items.find(i => i.id === p.grip); p.grip = null;
    if (!item) return;
    item.carriers = item.carriers.filter(id => id !== p.id);
    if (!item.carriers.length) {
      // Let go while it moves and it tips over: a little of it chips off.
      if (Math.hypot(item.vx, item.vz) > .8) { item.worth = Math.max(.7, item.worth - .05); p.stats.dropped += valueOf(item.kind) * .05; item.tip = 1; this.event('tip', locKey('¡Se cayó {item}!'), { item: item.kind, player: p.id, vars: { item: item.kind } }); }
      item.state = 'ground'; item.vx = item.vz = 0;
    }
  }
  unpush(p) {
    if (p.push == null) return;
    const cart = this.carts.find(c => c.id === p.push); p.push = null;
    if (cart) cart.pushers = cart.pushers.filter(id => id !== p.id);
  }
  // Load a hand (a handful goes in piece by piece), or take the handle.
  cartAction(p, target) {
    const cart = this.carts.find(c => c.id === target.id); if (!cart) return false;
    if (target.kind === 'cart-push') { cart.pushers.push(p.id); p.push = cart.id; this.event('cart-grab', '', { player: p.id }); return true; }
    if (target.kind === 'cart-load') {
      const hand = p.hands.findIndex(h => h && !ITEMS[h.kind].tool); if (hand < 0) return false;
      const held = p.hands[hand];
      if (held.pile) { while (held.pile.length && cart.contents.length < CART_SIZE) cart.contents.push({ kind: held.pile.pop(), worth: 1 }); if (!held.pile.length) p.hands[hand] = null; }
      else { cart.contents.push({ kind: held.kind, worth: held.worth ?? 1 }); p.hands[hand] = null; }
    }
    this.event('cart-load', '', { player: p.id, cart: cart.id, value: cartValue(cart) });
    return true;
  }
  stopDrag(p) { if (p.drag == null) return; const q = this.players.find(q => q.id === p.drag); if (q) q.draggedBy = null; p.drag = null; }
  bank(kind, worth = 1, by = null, bonus = 1) {
    const value = Math.round(valueOf(kind) * worth * bonus); if (!value) return 0;
    this.haul += value; this.mangos += value / 10; this.truck.push(kind); this.truck = this.truck.slice(-40);
    if (by) by.stats.banked += value;
    return value;
  }
  // ---------- Actions ----------
  action(id, action, data = {}) {
    const p = this.players.find(p => p.id === id);
    if (this.phase !== 'playing' || !p || !alive(p)) return false;
    if (action === 'bark') {
      const line = Number(data.line); if (!Number.isInteger(line) || line < 0 || line >= BARKS.length || this.time - p.barkAt < .8) return false;
      p.barkAt = this.time; if (line === 0) p.stats.nosVamos++; if (line === 1) p.stats.unaMas++;
      this.event('bark', '', { player: id, line }); return true;
    }
    if (action === 'use') return this.use(p, data.hand === 1 ? 1 : 0);
    if (action === 'drop') { if (p.grip != null) { this.release(p); return true; } const hand = p.hands[0] ? 0 : p.hands[1] ? 1 : -1; if (hand < 0) return false; const item = this.drop(p, hand); this.event('drop', '', { player: id, item: item.kind }); return true; }
    if (action === 'throw') {
      if (p.grip != null) return false;
      const hand = data.hand === 1 && p.hands[1] ? 1 : p.hands[0] ? 0 : p.hands[1] ? 1 : -1; if (hand < 0) return false;
      const item = this.drop(p, hand, true); this.event('throw', '', { player: id, item: item.kind }); return true;
    }
    if (action === 'drag') {
      if (p.drag != null) { this.stopDrag(p); return true; }
      const q = this.players.find(q => q.id !== id && q.downed && !q.spectator && q.draggedBy == null && floorOf(q.x) === floorOf(p.x) && distance(p, q) < 2.6);
      if (!q || p.grip != null) return false;
      p.drag = q.id; q.draggedBy = p.id; this.event('drag', locKey('{name} arrastra a {target}.'), { player: id, vars: { name: p.name, target: q.name } }); return true;
    }
    if (action === 'interact' && p.interactCooldown <= 0) {
      const target = interaction(this, p); if (!target?.press) return false;
      p.interactCooldown = .25;
      if (target.kind === 'release') { if (p.push != null) this.unpush(p); else this.release(p); return true; }
      if (target.kind?.startsWith('cart-')) return this.cartAction(p, target);
      if (target.kind === 'buy') return this.buy(p, target.item);
      if (target.kind === 'cargo') return this.sendCargo(p);
      if (target.kind === 'chest') return this.openChest(p, target.id);
      if (target.kind === 'pick') { const item = visibleItems(this).find(i => i.id === target.id); return !!item && this.pick(p, item); }
    }
    return false;
  }
  openChest(p, id) {
    const chest = this.layout.run.chests.find(c => c.id === id); if (!chest || this.chests[id]) return false;
    this.chests[id] = 1;
    const lucky = holds(p, 'luckyCoin'), f = floorOf(chest.x), count = 2 + Math.floor(random(this) * 2) + (lucky ? 2 : 0);
    for (let i = 0; i < count; i++) {
      const roll = random(this);
      const kind = roll < (lucky ? .5 : .14) ? ARTIFACTS[Math.floor(random(this) * ARTIFACTS.length)] : roll < .38 ? ['machete', 'honda', 'botiquin', 'farol'][Math.floor(random(this) * 4)] : roll < .5 ? 'mask' : SMALL[Math.min(3, Math.floor(random(this) * (2 + f)))];
      const a = chest.h + (i - count / 2) * .6;
      this.spawnItem(kind, chest.x, chest.z, { state: 'air', y: .9, vx: Math.sin(a) * 2.2, vz: Math.cos(a) * 2.2, vy: 4.5, cursed: !!ITEMS[kind].artifact });
    }
    this.greed(2); this.event('chest', '', { player: p.id, chest: id, lucky });
    return true;
  }
  use(p, hand) {
    if (p.cooldown > 0 || p.grip != null || p.stun > 0) return false;
    const held = p.hands[hand], kind = held?.kind;
    if (kind === 'botiquin') {
      const fallen = this.players.find(q => q.id !== p.id && q.downed && !q.spectator && distance(p, q) < 2.4);
      if (fallen && this.options.revive !== false) { this.getUp(fallen, p, 70); }
      else if (p.hp < 100) p.hp = Math.min(100, p.hp + 50);
      else return false;
      p.hands[hand] = null; p.cooldown = .4; this.event('heal', locKey('{name} usó un botiquín.'), { player: p.id, vars: { name: p.name } }); return true;
    }
    if (kind === 'miche') {
      p.hp = Math.min(100, p.hp + 60); p.reversed = 9; held.uses = (held.uses ?? 3) - 1; if (held.uses <= 0) p.hands[hand] = null;
      p.cooldown = .8; this.event('miche', locKey('{name} se echó un palo de miche. ¡Los controles al revés!'), { player: p.id, vars: { name: p.name } }); return true;
    }
    if (kind === 'honda' || kind === 'marcadora') {
      const marker = kind === 'marcadora';
      p.cooldown = marker ? .16 : .55; p.swing = marker ? .1 : .25; p.swingHand = hand;
      const fx = Math.sin(p.h), fz = Math.cos(p.h), pitch = clamp(p.pitch || 0, -.6, .6);
      const speed = marker ? 32 : 26, spread = marker ? (random(this) - .5) * .06 : 0, sx = Math.sin(p.h + spread), sz = Math.cos(p.h + spread);
      this.shots.push({ id: ++this.shotId, owner: p.id, seat: p.seat, marker, x: p.x + fx * .6, z: p.z + fz * .6, y: 1.4 + (p.y || 0), vx: sx * speed * Math.cos(pitch), vz: sz * speed * Math.cos(pitch), vy: Math.sin(pitch) * speed, life: 1.2 });
      this.event('shot', '', { player: p.id }); return true;
    }
    // Everything else is a melee swing: fists, the machete, a gold mask…
    const heart = holds(p, 'jaguarHeart');
    const damage = (kind === 'machete' ? 30 : kind === 'jaguarHeart' ? 45 : kind ? 15 : 12) * (heart && kind !== 'jaguarHeart' ? 3 : 1);
    const range = kind === 'machete' ? 2.6 : 2;
    p.cooldown = kind === 'machete' ? .5 : .45; p.swing = .3; p.swingHand = hand;
    let hits = 0;
    for (const e of this.enemies) {
      if (e.hp <= 0 || floorOf(e.x) !== floorOf(p.x)) continue;
      const d = distance(p, e), reach = range + (e.kind === 'guardian' ? .9 : e.kind === 'jaguar' || e.kind === 'stalker' ? .7 : 0);
      if (d > reach) continue;
      const ahead = ((e.x - p.x) * Math.sin(p.h) + (e.z - p.z) * Math.cos(p.h)) / (d || 1);
      if (ahead < .35 || !this.layout.lineClear(p, e, this, .1)) continue;
      hits++; e.hp -= damage; e.hit = .2; e.awake = true;
      if (!['guardian', 'jaguar', 'stalker'].includes(e.kind)) { e.stun = .3; this.layout.moveBody(e, Math.sin(p.h) * .6, Math.cos(p.h) * .6, this, .5); }
      if (e.hp <= 0) this.defeated(e, p);
      if (hits >= 3) break;
    }
    this.event(hits ? 'hit' : 'swing', '', { player: p.id, hand, item: kind || 'fist' });
    return true;
  }
  defeated(e, p) {
    this.kills++; if (p) p.stats.kills++; this.paths.delete(e.id);
    if (e.kind === 'guardian') {
      const seal = this.layout.run.seals.find(s => s.room === e.room);
      if (seal) this.openSeal(seal);
      this.spawnItem('mask', e.x, e.z, { state: 'air', vy: 4 });
      this.event('guardian', locKey('¡El guardián cayó! El sello se abre.'), { enemy: e.id });
    }
    if (e.kind === 'jaguar') { this.spawnItem('jaguarHeart', e.x, e.z, { state: 'air', vy: 5 }); this.event('jaguar', locKey('¡Vencieron al jaguar de oro! Dejó su corazón.'), { enemy: e.id }); }
    if (e.kind === 'stalker') { this.stalkerRest = 60; this.event('stalker-down', locKey('El jaguar negro huyó a la oscuridad… por ahora.'), { enemy: e.id }); }
  }
  openSeal(seal) {
    if (this.open[seal.id]) return;
    this.open[seal.id] = 1;
    this.event('seal', locKey('¡Se abrió la bajada al piso {floor}! ¿Bajamos o nos vamos?'), { seal: seal.id, floor: seal.floor, vars: { floor: seal.floor + 1 } });
  }
  getUp(q, by, hp = 55) {
    q.hp = hp; q.downed = false; q.revive = 0; q.invulnerable = 2;
    if (q.draggedBy != null) { const d = this.players.find(d => d.id === q.draggedBy); if (d) d.drag = null; q.draggedBy = null; }
    if (by) by.stats.revives++;
    this.event('revive', by ? locKey('{name} levantó a {target}.') : locKey('{target} se levantó en el camión.'), { player: q.id, by: by?.id, vars: { name: by?.name, target: q.name } });
  }
  damage(p, amount, source = null) {
    if (!alive(p) || p.invulnerable > 0) return;
    p.hp = Math.max(0, p.hp - amount); p.hit = .35; p.revive = 0;
    if (source) this.event('hurt', '', { player: p.id, enemy: source.id ?? null });
    if (!p.hp) this.down(p);
  }
  down(p) {
    p.downed = true; this.release(p); this.unpush(p); this.stopDrag(p);
    p.hands.forEach((h, i) => { if (h) { p.stats.dropped += heldValue(h); this.drop(p, i); } });
    this.event('down', this.options.revive ? locKey('{name} cayó. Levántenlo (E) o arrástrenlo al camión (R).') : locKey('{name} cayó. Esta expedición no permite revivir.'), { player: p.id, vars: { name: p.name } });
  }
  // ---------- The tick ----------
  update(dt, inputs = new Map()) {
    if (this.phase !== 'playing') return;
    dt = clamp(Number.isFinite(dt) ? dt : 0, 0, .05); this.time += dt; this.lastInputs = inputs;
    const L = this.layout, run = L.run, used = new Set(), reviving = new Set();
    let leaving = false;
    for (const p of this.players) {
      for (const key of ['cooldown', 'swing', 'invulnerable', 'hit', 'interactCooldown', 'stun', 'reversed']) p[key] = Math.max(0, p[key] - dt);
      p.slow = Math.max(0, (p.slow || 0) - dt);
      if (p.poison > 0 && alive(p)) { p.poison = Math.max(0, p.poison - dt); p.venom = (p.venom || 0) + dt; if (p.venom >= 1) { p.venom = 0; this.damage(p, 2); } }
      if (!alive(p)) { p.moving = false; if (p.downed && !reviving.has(p.id)) p.revive = Math.max(0, p.revive - dt * .5); continue; }
      const input = inputs.get(p.id) || {};
      stepExplorer(p, input, dt, this);
      if (holds(p, 'jaguarHeart')) { p.drain += dt; if (p.drain > .5) { p.drain = 0; this.damage(p, 1); if (p.downed) { this.event('heart', locKey('El corazón de jaguar consumió a {name}.'), { player: p.id, vars: { name: p.name } }); continue; } } }
      if (input.hold) {
        const target = interaction(this, p);
        if (target?.kind === 'winch' && !used.has(target.id)) {
          used.add(target.id); const w = this.winches[target.id] ||= { progress: 0, latched: 0 };
          w.progress = Math.min(1.6, w.progress + dt); if (w.progress >= 1.6 && w.latched <= 0) { w.latched = 12; this.event('winch', locKey('Rueda activa por doce segundos. ¡La otra!'), { winch: target.id }); }
        }
        if (target?.kind === 'revive' && !reviving.has(target.id)) {
          const q = this.players.find(q => q.id === target.id); reviving.add(q.id); q.revive += dt;
          if (q.revive >= reviveTime(p)) { this.getUp(q, p); this.event('bark', '', { player: p.id, text: locKey('¡Párate, que no es pa\' tanto!') }); }
        }
        if (target?.kind === 'rubble') { this.rubble[target.id] += dt; if (this.rubble[target.id] >= 5) { delete this.rubble[target.id]; this.event('cleared', locKey('¡Despejaron el túnel!')); } }
        if (target?.kind === 'leave') leaving = true;
        if ((target?.kind === 'ride' || target?.kind === 'call') && !used.has('lift')) { used.add('lift'); const key = `${target.kind}:${target.to ?? floorOf(p.x)}`; if (this.lift.hold?.key !== key) this.lift.hold = { key, progress: 0 }; this.lift.hold.progress += dt; }
        // Hold E as something flies at you to catch it.
        if (p.hands.some(h => !h)) for (const item of this.items) if (item.state === 'air' && item.thrower !== p.id && ITEMS[item.kind].size === 'hand' && Math.hypot(item.x - p.x, item.z - p.z) < 1.1 && item.y > .4 && item.y < 2.4) {
          const hand = p.hands[0] ? 1 : 0; p.hands[hand] = { id: item.id, kind: item.kind, uses: item.uses, worth: item.worth }; item.caught = true;
          this.event('catch', locKey('¡{name} la atrapó en el aire!'), { player: p.id, item: item.kind, vars: { name: p.name } }); break;
        }
      }
      this.items = this.items.filter(i => !i.caught);
      // Echo mask: hidden rooms answer when the holder walks past.
      if (holds(p, 'echoMask')) for (const wall of run.hidden) if (!this.revealed[wall.id] && floorOf(wall.x) === floorOf(p.x) && distance(p, wall) < 9) { this.revealed[wall.id] = 1; this.event('reveal', locKey('¡La máscara oye un eco! Se abrió una sala escondida.'), { wall: wall.id }); }
      // Wake a room's sleepers the first time someone walks in.
      const room = L.regionAt(p);
      if (room && room.floor > 0 && !this.woke[room.id] && inRect(p.x, p.z, room.rect, -1.5)) {
        this.woke[room.id] = 1;
        let woke = 0;
        for (const s of run.sleepers) if (s.room === room.id && spawnEnemy(this, s.kind, s.x, s.z, { room: room.id, born: this.time - (s.kind === 'mummy' ? 0 : 1), hanging: s.kind === 'spider' }) && s.kind === 'mummy') woke++;
        if (woke && room.kind !== 'guardian' && room.kind !== 'boveda') this.event('awaken', locKey('Las vendas se mueven. Prepárense.'), { room: room.id });
        if (room.kind === 'boveda') this.event('vault', locKey('La bóveda de oro. Algo grande respira en la oscuridad…'), { room: room.id });
      }
      if (p.floor !== floorOf(p.x)) p.floor = floorOf(p.x);
    }
    // Wheels latch for twelve seconds; both latched open the way down.
    for (const seal of run.seals) for (const w of seal.winches || []) {
      const s = this.winches[w.id] ||= { progress: 0, latched: 0 };
      s.latched = Math.max(0, s.latched - dt); if (!used.has(w.id) && s.latched <= 0) s.progress = Math.max(0, s.progress - dt * .5);
      if (seal.winches.every(q => this.winches[q.id]?.latched > 0)) this.openSeal(seal);
    }
    this.lifting(dt, used.has('lift')); this.cargoTick(dt); this.carry(dt); this.pushing(dt); this.dragging(dt); this.flying(dt); this.traps(dt); this.paint(dt); this.truckZone(dt); this.artifacts(dt); this.collapses(dt);
    updateEnemies(this, dt); this.stalk(dt);
    // Who trails the expedition the most: "el cobarde".
    const standing = this.players.filter(alive);
    if (standing.length > 1 && standing.some(p => floorOf(p.x) > 0)) {
      const progress = p => floorOf(p.x) * 1000 - p.z;
      standing.reduce((a, b) => progress(a) <= progress(b) ? a : b).stats.last += dt;
    }
    this.extraction = leaving && this.players.filter(alive).every(p => floorOf(p.x) === 0 && distance(p, TRUCK) < 9) ? this.extraction + dt : Math.max(0, this.extraction - dt * 2);
    if (this.extraction >= 3) return this.finish('extracted');
    this.wipe = this.players.some(p => !p.spectator) && !this.players.some(alive) ? this.wipe + dt : 0;
    if (this.wipe >= 3) return this.finish('wipe');
    if (standing.some(p => floorOf(p.x) > 0)) this.greed(dt * .04 * Math.max(...standing.map(p => floorOf(p.x))));
    updateDirector(this, dt, (floor, count) => this.wave(floor, count));
  }
  finish(outcome) {
    this.phase = 'results'; this.outcome = outcome;
    this.payout = outcome === 'extracted' ? this.haul : Math.round(this.haul * (this.options.wipeShare ?? 20) / 100);
    const crude = this.options.crude;
    this.event(outcome, outcome === 'extracted' ? locKey('¡Nos vamos! Bs. {value} en el camión.') : crude ? locKey('Por pajúos. La ruina se quedó con todo.')
      : pickLine([locKey('Por confiados. La ruina se quedó con todo.'), locKey('Por gafos. La ruina se quedó con todo.'), locKey('Te quedaste sin el chivo y sin el mecate. La ruina se quedó con todo.')], this.seed), { vars: { value: this.payout } });
  }
  // Big treasures move with the average push of whoever carries them.
  carry(dt) {
    for (const item of this.items) {
      if (item.state !== 'big') continue;
      const info = ITEMS[item.kind], carriers = item.carriers.map(id => this.players.find(p => p.id === id)).filter(p => p && alive(p));
      item.carriers = carriers.map(p => p.id);
      if (!carriers.length) { item.state = 'ground'; continue; }
      let mx = 0, mz = 0;
      for (const p of carriers) { const input = this.inputFor(p); mx += input.x; mz += input.z; }
      mx /= carriers.length; mz /= carriers.length;
      const length = Math.hypot(mx, mz), strength = Math.min(1, carriers.length / info.need) ** 1.6, speed = 3.4 * strength * (1 - .08 * (info.need - 2));
      const ux = length > 1 ? mx / length : mx, uz = length > 1 ? mz / length : mz;
      item.vx = ux * speed; item.vz = uz * speed;
      this.layout.moveBody(item, item.vx * dt, item.vz * dt, this, (info.radius || 1) * .7);
      if (length > .2) { const want = Math.atan2(ux, uz), turn = Math.atan2(Math.sin(want - item.h), Math.cos(want - item.h)); item.h += clamp(turn, -dt * 1.5, dt * 1.5); }
      item.tip = Math.max(0, (item.tip || 0) - dt);
      // Walk a big treasure up to an empty carrito and it climbs in.
      const cart = this.carts.find(c => !c.big && !c.away && floorOf(c.x) === floorOf(item.x) && distance(c, item) < (info.radius || 1) + 1);
      if (cart) {
        cart.big = { kind: item.kind, worth: item.worth ?? 1 }; item.loaded = true;
        for (const p of carriers) p.grip = null;
        this.event('cart-big', locKey('¡{Item} al carrito!'), { cart: cart.id, item: item.kind, value: cartValue(cart), vars: { item: item.kind } });
        continue;
      }
      carriers.forEach((p, i) => {
        const a = item.h + i * Math.PI * 2 / Math.max(2, info.need), r = (info.radius || 1) + .55;
        const sx = item.x + Math.sin(a) * r, sz = item.z + Math.cos(a) * r;
        this.layout.moveBody(p, sx - p.x, sz - p.z, this, .42);
        if (Math.hypot(sx - p.x, sz - p.z) > 2.4) { this.release(p); this.event('slip', locKey('¡A {name} se le zafó!'), { player: p.id, vars: { name: p.name } }); }
      });
    }
    this.items = this.items.filter(i => !i.loaded);
  }
  // Carritos roll with whoever pushes them; a heavy load slows them down.
  pushing(dt) {
    for (const cart of this.carts) {
      if (cart.away) continue;
      const pushers = cart.pushers.map(id => this.players.find(p => p.id === id)).filter(p => p && alive(p));
      cart.pushers = pushers.map(p => p.id);
      if (!pushers.length) { cart.vx = cart.vz = 0; continue; }
      let mx = 0, mz = 0; for (const p of pushers) { const input = this.inputFor(p); mx += input.x || 0; mz += input.z || 0; }
      mx /= pushers.length; mz /= pushers.length;
      const length = Math.hypot(mx, mz), load = Math.min(.4, cart.contents.length * .02 + (cart.big ? .22 : 0));
      const speed = 4.4 * (1 + .12 * (pushers.length - 1)) * (1 - load), ux = length > 1 ? mx / length : mx, uz = length > 1 ? mz / length : mz;
      cart.vx = ux * speed; cart.vz = uz * speed;
      this.layout.moveBody(cart, cart.vx * dt, cart.vz * dt, this, .6);
      if (length > .2) { const want = Math.atan2(ux, uz), turn = Math.atan2(Math.sin(want - cart.h), Math.cos(want - cart.h)); cart.h += clamp(turn, -dt * 3, dt * 3); }
      pushers.forEach((p, i) => {
        const side = pushers.length > 1 ? (i ? .55 : -.55) : 0, back = cart.h + Math.PI;
        const sx = cart.x + Math.sin(back) * 1.9 + Math.cos(cart.h) * side, sz = cart.z + Math.cos(back) * 1.9 - Math.sin(cart.h) * side;
        this.layout.moveBody(p, sx - p.x, sz - p.z, this, .42);
        if (Math.hypot(sx - p.x, sz - p.z) > 3) { this.unpush(p); this.event('slip', locKey('¡A {name} se le fue el carrito!'), { player: p.id, vars: { name: p.name } }); }
      });
    }
  }
  // The montacargas: hold a lever and everything on the deck rides; hold E
  // at an empty shaft to call the cage. It takes time, and while it travels
  // nobody else can have it.
  lifting(dt, held) {
    const lift = this.lift, run = this.layout.run, stopOf = f => run.lifts.find(l => l.floor === f);
    if (!held && lift.hold) { lift.hold.progress -= dt * 2; if (lift.hold.progress <= 0) lift.hold = null; }
    if (!lift.moving && lift.hold?.progress >= BOARD) {
      const [kind, value] = lift.hold.key.split(':'), to = Number(value); lift.hold = null;
      if (kind === 'call' && to !== lift.floor) this.depart(to, false);
      if (kind === 'ride' && to !== lift.floor) this.depart(to, true);
    }
    if (!lift.moving) return;
    lift.t += dt;
    if (!lift.switched && lift.t >= lift.duration / 2) {
      // Halfway down the shaft the cage changes stops: so does its load.
      lift.switched = true;
      const a = stopOf(lift.from), b = stopOf(lift.to), turn = b.h - a.h;
      const move = body => { const ox = body.x - a.x, oz = body.z - a.z, c = Math.cos(turn), sn = Math.sin(turn); body.x = b.x + ox * c + oz * sn; body.z = b.z - ox * sn + oz * c; };
      for (const id of lift.riders) { const p = this.players.find(p => p.id === id); if (p) { move(p); p.h += turn; } }
      for (const id of lift.carts) { const c = this.carts.find(c => c.id === id); if (c) { move(c); c.h += turn; } }
      for (const id of lift.items) { const i = this.items.find(i => i.id === id); if (i) move(i); }
    }
    if (lift.t >= lift.duration) {
      lift.moving = false; lift.floor = lift.to; lift.t = 0;
      const riders = lift.riders.map(id => this.players.find(p => p.id === id)).filter(Boolean);
      riders.forEach(p => { p.riding = false; });
      if (lift.to > this.deepest) {
        this.deepest = lift.to; riders.forEach(p => { p.stats.unaMas++; });
        this.event('descend', locKey('¡Bajaron al piso {floor}: {place}!'), { floor: lift.to, players: lift.riders, vars: { floor: lift.to, place: FLOOR_NAMES[lift.to] || locKey('el oro profundo') } });
      }
      this.event('lift-arrive', riders.length ? '' : lift.to ? locKey('El montacargas llegó al piso {floor}.') : locKey('El montacargas llegó al campamento.'), { floor: lift.to, players: lift.riders, vars: { floor: lift.to } });
      const done = lift.to === 0 && lift.from === 1 && riders.length && this.delivered >= this.quota;
      lift.riders = []; lift.carts = []; lift.items = [];
      if (done) this.completeLevel();
    }
  }
  // Up with the quota delivered: the jornada is done. Whoever stayed below
  // is hauled up with 1 HP, and the next, deeper jornada is dealt.
  completeLevel() {
    const done = this.level, stop = this.layout.run.lifts.find(l => l.floor === 0), delivered = this.delivered;
    // A new deck for the next jornada; the camp's own pieces stay as they are.
    const campLoot = Object.fromEntries(Object.entries(this.touched).filter(([id]) => this.layout.run.loot.find(l => l.id === +id)?.floor === 0));
    this.level++; this.seed = levelSeed(this.origin, this.level);
    Object.assign(this, { touched: campLoot, chests: {}, open: {}, revealed: {}, rubble: {}, winches: {}, woke: {}, plates: {}, enemies: [], darts: [], shots: [], splats: [],
      codicia: 0, deepest: 0, director: createDirector(), collapseIn: 30, stalkerRest: 0, delivered: 0, cargo: { phase: 'idle', t: 0, cart: null } });
    this.items = this.items.filter(i => floorOf(i.x) === 0); this.paths.clear();
    this.carts = this.layout.run.carts.map(c => ({ ...c, contents: [], big: null, pushers: [], vx: 0, vz: 0 }));
    let left = 0;
    this.players.forEach((p, i) => {
      if (p.spectator || floorOf(p.x) === 0) return;
      left++; this.release(p); this.unpush(p); this.stopDrag(p); p.riding = false;
      p.x = stop.x + (i % 3 - 1) * 1.2; p.z = 3 + Math.floor(i / 3) * 1.2; p.h = 0;
      p.downed = false; p.hp = 1; p.revive = 0; p.invulnerable = 2;
    });
    this.quota = quotaFor(this.level, this.players.filter(p => !p.spectator).length);
    this.event('level', left ? locKey('¡Jornada {level} lista! Subieron Bs. {value}. Los que se quedaron abajo llegaron con lo justo. La jornada {next} pide Bs. {quota}.')
      : locKey('¡Jornada {level} lista! Subieron Bs. {value}. La jornada {next} pide Bs. {quota}.'), { level: done, value: delivered, left, vars: { level: done, value: delivered, next: this.level, quota: this.quota } });
  }
  // The cargo lift: the carrito on its pad rides up alone, its load banks
  // and counts for the quota, and it comes back down empty.
  sendCargo(p) {
    const pad = this.layout.run.cargo.find(c => c.floor === floorOf(p.x)); if (!pad || this.cargo.phase !== 'idle') return false;
    const cart = this.carts.find(c => !c.away && Math.hypot(c.x - pad.x, c.z - pad.z) < 1.4); if (!cart) return false;
    for (const id of cart.pushers) { const q = this.players.find(q => q.id === id); if (q) q.push = null; }
    cart.pushers = []; cart.away = true; cart.x = pad.x; cart.z = pad.z; cart.vx = cart.vz = 0;
    this.cargo = { phase: 'up', t: 0, cart: cart.id };
    this.event('cargo', locKey('{name} mandó el carrito para arriba · Bs. {value}.'), { player: p.id, value: cartValue(cart), vars: { name: p.name, value: cartValue(cart) } });
    return true;
  }
  cargoTick(dt) {
    const c = this.cargo; if (c.phase === 'idle') return;
    c.t += dt; if (c.t < CARGO) return;
    const cart = this.carts.find(k => k.id === c.cart);
    if (c.phase === 'up') {
      let total = 0;
      if (cart) { for (const x of [...cart.contents, ...(cart.big ? [cart.big] : [])]) total += this.bank(x.kind, x.worth ?? 1, null); cart.contents = []; cart.big = null; }
      const below = this.players.filter(p => !p.spectator && floorOf(p.x) > 0);
      below.forEach(p => { p.stats.banked += total / Math.max(1, below.length); });
      this.delivered += total;
      this.event('delivered', locKey('¡La carga llegó arriba! +Bs. {value} · van Bs. {delivered} de Bs. {quota}.'), { value: total, met: this.delivered >= this.quota, vars: { value: total, delivered: this.delivered, quota: this.quota } });
      this.cargo = { phase: 'down', t: 0, cart: c.cart };
    } else { if (cart) cart.away = false; this.cargo = { phase: 'idle', t: 0, cart: null }; }
  }
  buy(p, kind) {
    const offer = SHOP.find(([k]) => k === kind); if (!offer || this.mangos < offer[1]) return false;
    const weapon = WEAPONS.includes(kind) ? p.hands.findIndex(h => h && WEAPONS.includes(h.kind)) : -1;
    if (weapon >= 0) this.drop(p, weapon);
    const hand = weapon >= 0 ? weapon : p.hands.findIndex(h => !h); if (hand < 0) return false;
    this.mangos -= offer[1]; p.hands[hand] = { id: this.itemId++, kind, worth: 1 };
    this.event('buy', locKey('{name} compró {item}.'), { player: p.id, item: kind, vars: { name: p.name, item: kind } });
    return true;
  }
  depart(to, load) {
    const lift = this.lift, stop = this.layout.run.lifts.find(l => l.floor === lift.floor);
    const on = b => floorOf(b.x) === lift.floor && Math.abs(b.x - stop.x) < CAGE + .3 && Math.abs(b.z - stop.z) < CAGE + .3;
    const riders = load ? this.players.filter(p => !p.spectator && on(p)) : [];
    for (const p of riders) { p.riding = true; p.vx = p.vz = 0; p.moving = false; }
    Object.assign(lift, { from: lift.floor, to, t: 0, duration: 3 + 2.2 * Math.abs(to - lift.floor), moving: true, switched: false,
      riders: riders.map(p => p.id), carts: [], items: load ? this.items.filter(on).map(i => i.id) : [] });
    this.event('lift', riders.length ? to ? locKey('El montacargas baja a la jornada…') : locKey('El montacargas sube al campamento…')
      : to ? locKey('El montacargas va abajo…') : locKey('El montacargas va al campamento…'), { from: lift.from, to, players: lift.riders });
  }
  inputFor(p) { return this.lastInputs?.get(p.id) || {}; }
  dragging(dt) {
    for (const p of this.players) {
      if (p.drag == null) continue;
      const q = this.players.find(q => q.id === p.drag);
      if (!q || !q.downed || !alive(p)) { this.stopDrag(p); continue; }
      const bx = p.x - Math.sin(p.h) * 1.1, bz = p.z - Math.cos(p.h) * 1.1;
      if (floorOf(q.x) !== floorOf(p.x)) { q.x = p.x; q.z = p.z; }
      this.layout.moveBody(q, (bx - q.x) * Math.min(1, dt * 8), (bz - q.z) * Math.min(1, dt * 8), this, .35);
    }
  }
  // Thrown and spilled loot flies, bounces off walls, bonks heads, or falls in a pit.
  flying(dt) {
    for (const item of this.items) {
      if (item.state !== 'air') continue;
      item.vy -= GRAVITY * dt;
      const nx = item.x + item.vx * dt, nz = item.z + item.vz * dt;
      if (this.layout.walkable(nx, nz, this, .12) || this.layout.overPit(nx, nz)) { item.x = nx; item.z = nz; }
      else { item.vx *= -.3; item.vz *= -.3; }
      item.y += item.vy * dt;
      if (item.thrower != null && this.time - item.thrownAt > .2) for (const p of this.players) {
        if (p.id === item.thrower || !alive(p) || floorOf(p.x) !== floorOf(item.x)) continue;
        if (Math.hypot(p.x - item.x, p.z - item.z) < .6 && item.y > .6 && item.y < 1.9) {
          p.stun = .6; this.damage(p, 6); item.vx *= -.2; item.vz *= -.2; item.thrower = null;
          this.event('bonk', locKey('¡A {name} le cayó {item} en la cabeza!'), { player: p.id, item: item.kind, vars: { name: p.name, item: item.kind } });
        }
      }
      // A throw that drops into a carrito stays there: ¡encestó!
      const basket = !ITEMS[item.kind].tool && item.vy < 0 && item.y < 1.5 && this.carts.find(c => !c.away && c.contents.length < CART_SIZE && floorOf(c.x) === floorOf(item.x) && distance(c, item) < .85);
      if (basket) {
        basket.contents.push({ kind: item.kind, worth: item.worth ?? 1 }); item.lost = true;
        this.event('cart-catch', item.thrower != null ? locKey('¡Encestó {item} en el carrito!') : '', { cart: basket.id, item: item.kind, value: cartValue(basket), vars: { item: item.kind } });
        continue;
      }
      const ground = this.layout.groundAt(item.x, item.z);
      if (this.layout.overPit(item.x, item.z) && item.y < -2.5) {
        item.lost = true; const thrower = this.players.find(p => p.id === item.thrower);
        if (thrower) thrower.stats.dropped += valueOf(item.kind);
        this.event('lost', locKey('¡{Item} se fue al abismo!'), { item: item.kind, vars: { item: item.kind } });
      } else if (!this.layout.overPit(item.x, item.z) && item.y <= ground) { item.y = ground; item.state = 'ground'; item.vx = item.vz = item.vy = 0; item.thrower = null; }
    }
    this.items = this.items.filter(i => !i.lost);
  }
  // Pressure plates fire darts across the room from both walls.
  traps(dt) {
    const run = this.layout.run, t = tier(this);
    for (const plate of run.plates) {
      if ((this.plates[plate.id] || 0) > this.time) continue;
      const lucky = this.players.some(p => alive(p) && holds(p, 'luckyCoin') && this.layout.regionAt(p)?.id === plate.room);
      const pressed = this.players.find(p => alive(p) && Math.hypot(p.x - plate.x, p.z - plate.z) < (lucky ? 2.2 : .95));
      const restless = lucky && random(this) < dt / 3;
      if (!pressed && !restless) continue;
      this.plates[plate.id] = this.time + Math.max(1.2, 3 - t * .45) - (lucky ? 1 : 0);
      for (const d of plate.darts) this.darts.push({ id: ++this.shotId, x: d.x, z: d.z, vx: d.dx * 15, life: plate.len / 15, floor: plate.floor });
      this.event('trap', pressed ? locKey('¡Losa! ¡Dardos!') : '', { plate: plate.id, player: pressed?.id });
    }
    for (const d of this.darts) {
      d.x += d.vx * dt; d.life -= dt;
      for (const p of this.players) if (alive(p) && Math.abs(p.x - d.x) < .45 && Math.abs(p.z - d.z) < .5 && floorOf(p.x) === d.floor) { this.damage(p, 14); d.life = 0; }
    }
    this.darts = this.darts.filter(d => d.life > 0);
  }
  // Glowing paint from the honda: it splats on walls and stuns what it hits.
  paint(dt) {
    for (const s of this.shots) {
      const steps = 4;
      for (let i = 0; i < steps && s.life > 0; i++) {
        const nx = s.x + s.vx * dt / steps, nz = s.z + s.vz * dt / steps; s.y += s.vy * dt / steps; s.vy -= 4 * dt / steps;
        const enemy = this.enemies.find(e => e.hp > 0 && Math.hypot(e.x - nx, e.z - nz) < (e.kind === 'guardian' || e.kind === 'jaguar' ? 1.3 : .7) && s.y < 3.2);
        if (enemy) { enemy.hp -= s.marker ? 5 : 6; enemy.stun = Math.max(enemy.stun, (enemy.kind === 'mummy' || enemy.kind === 'phantom' ? 1.2 : .7) * (s.marker ? .5 : 1)); enemy.hit = .2; enemy.awake = true; if (enemy.hp <= 0) this.defeated(enemy, this.players.find(p => p.id === s.owner)); this.splat(s, nx, nz, 0, 0, true); s.life = 0; break; }
        if (!this.layout.walkable(nx, nz, this, .05) && !this.layout.overPit(nx, nz)) {
          const blockedX = !this.layout.walkable(nx, s.z, this, .05);
          this.splat(s, s.x, s.z, blockedX ? Math.sign(s.vx) : 0, blockedX ? 0 : Math.sign(s.vz)); s.life = 0; break;
        }
        if (s.y < this.layout.groundAt(nx, nz) + .05) { this.splat(s, nx, nz, 0, 0); s.life = 0; break; }
        s.x = nx; s.z = nz;
      }
      s.life -= dt;
    }
    this.shots = this.shots.filter(s => s.life > 0);
  }
  splat(s, x, z, nx, nz, onEnemy = false) {
    if (onEnemy) return;
    this.splats.push({ id: s.id, x, z, y: s.y, nx, nz, seat: s.seat });
    if (this.splats.length > 90) this.splats.shift();
  }
  // The truck banks whatever reaches it, and its botiquín gets panas up.
  truckZone(dt) {
    for (const p of this.players) {
      if (p.spectator || floorOf(p.x) !== 0 || distance(p, TRUCK) > TRUCK_RADIUS) { p.truckRest = 0; continue; }
      if (p.downed) { p.truckRest = (p.truckRest || 0) + dt; if (p.truckRest > 3) this.getUp(p, null, 60); continue; }
      const bonus = holds(p, 'laughingIdol') ? 1.5 : 1;
      let total = 0;
      p.hands.forEach((h, i) => {
        if (h?.pile) { for (const kind of h.pile) total += this.bank(kind, 1, p, bonus); p.hands[i] = null; }
        else if (h && !ITEMS[h.kind].tool && !ITEMS[h.kind].artifact) { total += this.bank(h.kind, h.worth ?? 1, p, bonus); p.hands[i] = null; }
      });
      if (total) this.event('bank', bonus > 1 ? locKey('{name} subió Bs. {value} al camión · ¡el ídolo se ríe!.') : locKey('{name} subió Bs. {value} al camión.'), { player: p.id, value: total, vars: { name: p.name, value: total } });
    }
    for (const cart of this.carts) {
      if (floorOf(cart.x) !== 0 || distance(cart, TRUCK) > TRUCK_RADIUS + .5 || (!cart.contents.length && !cart.big)) continue;
      const pushers = cart.pushers.map(id => this.players.find(p => p.id === id)).filter(Boolean);
      let total = 0;
      for (const c of [...cart.contents, ...(cart.big ? [cart.big] : [])]) total += this.bank(c.kind, c.worth ?? 1, null);
      pushers.forEach(p => { p.stats.banked += total / pushers.length; });
      cart.contents = []; cart.big = null;
      this.event('bank', locKey('¡El carrito llegó al camión! Bs. {value}.'), { value: total, big: true, cart: cart.id, vars: { value: total } });
    }
    for (const item of [...this.items]) {
      if (floorOf(item.x) !== 0 || Math.hypot(item.x - TRUCK.x, item.z - TRUCK.z) > TRUCK_RADIUS - (item.state === 'big' ? 0 : 1.5) || ITEMS[item.kind].tool || item.state === 'air') continue;
      const carriers = item.carriers.map(id => this.players.find(p => p.id === id)).filter(Boolean);
      for (const p of carriers) { p.grip = null; }
      const value = this.bank(item.kind, item.worth ?? 1, null);
      carriers.forEach(p => { p.stats.banked += value / carriers.length; });
      this.items = this.items.filter(i => i !== item);
      this.event('bank', locKey('¡{Item} al camión! Bs. {value}.'), { value, item: item.kind, big: ITEMS[item.kind].size === 'big', vars: { item: item.kind, value } });
    }
  }
  // Enchanted artifacts' catches that tick on their own.
  artifacts(dt) {
    for (const p of this.players) {
      if (!alive(p) || floorOf(p.x) === 0) continue;
      if (holds(p, 'laughingIdol')) {
        p.laughIn = (p.laughIn ?? 14) - dt;
        if (p.laughIn <= 0) {
          p.laughIn = 14 + random(this) * 8;
          for (const e of this.enemies) if (floorOf(e.x) === floorOf(p.x) && distance(e, p) < 30) { e.awake = true; e.called = p.id; }
          this.event('laugh', locKey('¡JA, JA, JA! El ídolo se ríe a carcajadas.'), { player: p.id });
          this.wave(floorOf(p.x), 2, p);
        }
      }
      if (holds(p, 'echoMask')) {
        p.echoIn = (p.echoIn ?? 20) - dt;
        if (p.echoIn <= 0) { p.echoIn = 20 + random(this) * 8; if (this.wave(floorOf(p.x), 1, p, 'phantom')) this.event('phantom', locKey('Un eco tomó forma…'), { player: p.id }); }
      }
    }
  }
  // At high greed the way out caves in; someone has to dig through.
  collapses(dt) {
    if (tier(this) < 3) return;
    this.collapseIn -= dt; if (this.collapseIn > 0) return;
    this.collapseIn = 26 + random(this) * 14;
    const deepest = Math.max(0, ...this.players.filter(alive).map(p => floorOf(p.x)));
    const options = this.layout.run.corridors.filter(c => c.floor <= deepest && c.floor > 0 && !c.hidden && !this.rubble[c.id] && !Object.keys(this.rubble).some(id => this.layout.run.corridors.find(q => q.id === id)?.floor === c.floor)
      && !this.players.some(p => inRect(p.x, p.z, c.rect, 2)) && !this.items.some(i => inRect(i.x, i.z, c.rect, 1)));
    if (!options.length) return;
    const c = options[Math.floor(random(this) * options.length)];
    this.rubble[c.id] = 0; this.paths.clear();
    this.event('collapse', locKey('¡Se derrumbó un túnel en el piso {floor}! Mantén E en las piedras para despejarlo.'), { corridor: c.id, floor: c.floor, vars: { floor: c.floor } });
  }
  // From la codicia's third quarter a black jaguar hunts the team, following
  // it from floor to floor; at the camp it waits in the dark.
  stalk(dt) {
    this.stalkerRest = Math.max(0, (this.stalkerRest || 0) - dt);
    const live = this.players.filter(p => alive(p) && floorOf(p.x) > 0);
    const stalker = this.enemies.find(e => e.kind === 'stalker');
    if (!stalker) {
      if (tier(this) >= 3 && !this.stalkerRest && live.length) {
        const floor = floorOf(live[Math.floor(random(this) * live.length)].x);
        if (this.wave(floor, 1, null, 'stalker')) this.event('stalker', locKey('¡Un jaguar negro los está cazando!'), { floor });
        else this.stalkerRest = 5;
      }
      return;
    }
    const hunted = live.filter(p => floorOf(p.x) === floorOf(stalker.x));
    stalker.lonely = hunted.length ? 0 : (stalker.lonely || 0) + dt;
    if (stalker.lonely > 8 && live.length) {
      // It climbs the shaft on its own and comes out by the entrance.
      const prey = live[0], stop = this.layout.run.lifts.find(q => q.floor === floorOf(prey.x)), out = stop && { x: stop.x - Math.sin(stop.h + Math.PI) * 4, z: stop.z - Math.cos(stop.h + Math.PI) * 4 };
      if (out && this.layout.walkable(out.x, out.z, this, .7)) {
        const up = floorOf(prey.x) < floorOf(stalker.x);
        stalker.x = out.x; stalker.z = out.z; stalker.lonely = 0; stalker.awake = true; this.paths.delete(stalker.id);
        this.event('stalker-move', up ? locKey('El jaguar negro subió por el pozo del montacargas…') : locKey('El jaguar negro bajó por el pozo del montacargas…'), { floor: stop.floor });
      }
    }
  }
  // Ambient waves arrive out of sight, somewhere they can reach a pana.
  wave(floor, count, near = null, kind = null) {
    if (floor <= 0) return false;
    // The Director's waves mix creatures by depth: guácharos come in flocks.
    if (!kind) { const roll = random(this); kind = roll < .3 ? 'bat' : floor > 1 && roll < .3 + .1 * Math.min(3, floor) ? 'spider' : 'mummy'; if (kind === 'bat') count = Math.min(6, count * 2 + 1); }
    const L = this.layout, live = this.players.filter(p => alive(p) && floorOf(p.x) === floor); if (!live.length) return false;
    const rooms = L.run.rooms.filter(r => r.floor === floor && (!r.hidden || this.revealed[r.hidden]));
    let spawned = 0;
    for (let tries = 0; tries < 24 && spawned < count; tries++) {
      const room = rooms[Math.floor(random(this) * rooms.length)];
      const x = room.rect[0] + 1.5 + random(this) * (room.w - 3), z = room.rect[1] + 1.5 + random(this) * (room.d - 3), point = { x, z };
      if (!L.walkable(x, z, this, .6) || live.some(p => distance(p, point) < 10 || L.lineClear(p, point, this, .05))) continue;
      if (near && distance(near, point) > 26) continue;
      if (!live.some(p => distance(p, point) < 30 && L.findPath(point, p, this).length)) continue;
      if (spawnEnemy(this, kind, x, z)) spawned++;
    }
    if (spawned && kind === 'mummy') this.event('wave', locKey('Se oyen pasos entre las piedras…'), { floor });
    if (spawned && kind === 'bat') this.event('wave', locKey('¡Guácharos! Alumbren con el farol.'), { floor });
    if (spawned && kind === 'spider') this.event('wave', locKey('Algo corre por el techo…'), { floor });
    return spawned > 0;
  }
  snapshot() { const { paths, lastInputs, ...state } = this; return clone(state); }
  restore(snapshot, members) {
    Object.assign(this, clone(snapshot)); this.paths = new Map();
    for (const p of [...this.players]) if (!members.has(p.id)) this.removePlayer(p.id);
    for (const p of members.values()) if (!this.players.some(q => q.id === p.id)) this.addPlayer(p.id, p.name, p.avatar || {});
  }
}
