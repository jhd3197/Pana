// Reliquia's expedition, renderer-free: the host runs it at 20 Hz and guests
// render its snapshots. A run is camp → floor 1 → … → the vault; panas carry
// loot back to the truck to bank it, and la codicia rises with every
// treasure lifted from its resting place. See docs/knowledge/reliquia.md.
import { DEFAULT_OPTIONS, validOptions } from './options.js';
import { PACTO, hasPacto, calorOfOptions, payoutMult, pactoQuota, pactoTurno, pactoPrice, pactoGreed } from './pactos.js';
import { TRUCK, TRUCK_RADIUS, CAMP, floorOf, inRect, jornadaName, themeOf, CAGE, SPOTS, nookAt, nookFunnel } from './deck.js';
import { HOPPER, aimInto, overHopper, fitsIn, fillOf, overRim, bounceChance, placeTime, climbTime, throwPower, heftOf, stepWobble } from './carga.js';
import { searchStep, decaySearches } from '../../../engine/play/hiding-spots.js';
import { layoutFor, distance } from './layout.js';
import { ITEMS, HANDFUL, WEAPONS, SMALL, ARTIFACTS, valueOf, heldValue } from './items.js';
import { spawnEnemy, updateEnemies, holds, wound, stagger } from './enemies.js';
import { createNoiseBoard, emitNoise, pruneNoises } from '../../../engine/play/noise.js';
import { createDirector, updateDirector, random } from './director.js';
import { startSwarm, tickSwarm, swarmDue, swingAtSwarm, SWARM } from './swarm.js';
import { clamp } from '../../../engine/random.js';
import { resetJump } from '../../../engine/play/jump.js';
import { stepWalker } from '../../../engine/play/walker.js';
import { pickLine } from '../../../engine/play/frases.js';
import { locKey } from '../../../engine/i18n.js';
import { findSlot } from '../../../engine/save-game.js';
import { tickHazards, throwFlare, startClimb, endClimb, firstSucesoIn } from './sucesos.js';

const clone = value => JSON.parse(JSON.stringify(value));
export const alive = p => !p.downed && !p.spectator;
export { holds };
// Text in state and events is a Spanish key (locKey) plus `vars`; each client
// shows it in its own language with say() from items.js.
export const BARKS = [locKey('¿Nos vamos ya?'), locKey('¡Una sala más!'), locKey('¡Agárrala por el otro lado!'), locKey('¡No toques eso!'), locKey('¡Suelta, suelta, suelta!'), locKey('¡Pásame el farol!'), locKey('Ábrela.')];
const REACH = 2.5, GRAVITY = 14, REVIVE = 2.4, BOARD = 1.5, SHAFT = 14, CARGO = 3;
const GREED = { soft: .65, normal: 1, fierce: 1.5 };
// How far each noise carries (m), for what hunts by ear (El Lector). Walking,
// standing still and riding make none; running, landing a jump, a book or a
// treasure hitting the boards, searching and fighting do. `book` multiplies
// a falling book's reach.
// Seconds of holding E that clear a cave-in; state.rubble[id] counts up to it.
export const RUBBLE_HOLD = 5;
export const NOISE = { run: 10, land: 8, search: 7, open: 10, chest: 11, hit: 10, swing: 4, hurt: 8, shot: 6, splat: 6, cart: 8, dart: 9, laugh: 30, collapse: 30, drop: 5, book: 1.35, screech: 24 };
// What E says at each hiding spot, and where on it the crosshair aims.
export const SEARCH = {
  trunk: [locKey('Mantén E: abrir el baúl'), .45], drawer: [locKey('Mantén E: registrar los cajones'), .75], sheet: [locKey('Mantén E: quitar la sábana'), .7],
  wardrobe: [locKey('Mantén E: abrir el armario'), 1.1], debris: [locKey('Mantén E: escarbar entre los libros caídos'), .3], shelf: [locKey('Mantén E: correr el estante'), 1.1],
  ladder: [locKey('Mantén E: correr la escalera'), 1.2], lantern: [locKey('Mantén E: encender el candil'), 1.35],
};
// How far a spot reaches toward the crosshair, and where its contents land.
const spotSize = sp => SPOTS[sp.kind].wall ? (sp.len || SPOTS[sp.kind].wall[0]) / 2 : SPOTS[sp.kind].r + .1;
export const spotFront = sp => { const d = SPOTS[sp.kind].wall ? SPOTS[sp.kind].wall[1] / 2 + .45 : SPOTS[sp.kind].r + .4; return { x: sp.x + Math.sin(sp.h) * d, z: sp.z + Math.cos(sp.h) * d }; };

// One explorer's own movement for dt: the host's simulation and a guest's
// prediction (engine/predict.js). It only writes p; the state decides the rest.
export function stepExplorer(p, input, dt, world) {
  const L = layoutFor(world.seed, world.level, themeOf(world));
  if (Number.isFinite(input.h)) p.h = input.h;
  if (Number.isFinite(input.pitch)) p.pitch = clamp(input.pitch, -1.2, 1.2);
  if (p.grip != null || p.push != null || p.draggedBy != null || p.riding || p.rope || p.downed || p.spectator) { resetJump(p, input); if (!p.riding && !p.rope) p.y = L.groundAt(p.x,p.z); p.moving = false; return; }
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
    move: (q, dx, dz) => {
      const x = q.x, z = q.z, moved = L.moveBody(q, dx, dz, world, .42);
      // Stopped by a nook's slab, right beside its opening: slide in.
      if ((q.x - x) * dx + (q.z - z) * dz > (dx * dx + dz * dz) * .5) return moved;
      const slide = nookFunnel(L.run, q.x, q.z, dx, dz);
      return slide ? L.moveBody(q, slide.x, slide.z, world, .42) || moved : moved;
    }, jump: { gravity: GRAVITY, blocked: !(p.stun <= 0) }, ground: q => L.groundAt(q.x, q.z),
  }).moving;
}

// What E does right now: whatever the crosshair points at. Every target is a
// point with a size; the one closest to the line of sight wins. Something
// right at your feet in front of you counts too, so the floor is easy.
export function interaction(s, p) {
  if (!p || !alive(p) || p.rope) return null;
  if (p.grip != null) { const big = s.items.find(i => i.id === p.grip); return { kind: 'release', text: locKey('Soltar el tesoro'), press: true, progress: big?.climb ? big.climb / climbTime(big.kind) : 0 }; }
  if (p.push != null) return { kind: 'release', text: locKey('Soltar el carrito'), press: true };
  const L = layoutFor(s.seed, s.level, themeOf(s)), f = floorOf(p.x), pitch = p.pitch || 0, cp = Math.cos(pitch);
  const eye = { x: p.x, y: (p.y || 0) + 1.45, z: p.z }, look = { x: Math.sin(p.h) * cp, y: Math.sin(pitch), z: Math.cos(p.h) * cp };
  const options = [];
  const offer = (target, pt, r, reach = REACH) => {
    if (floorOf(pt.x) !== f) return;
    const dx = pt.x - eye.x, dy = (pt.y ?? .4) - L.lowAt(pt.x, pt.z) - eye.y, dz = pt.z - eye.z, d = Math.hypot(dx, dy, dz), flat = Math.hypot(dx, dz);
    if (d > reach + r) return;
    const angle = Math.acos(clamp((dx * look.x + dy * look.y + dz * look.z) / (d || 1), -1, 1)), allow = Math.atan2(r, d) + .08;
    if (angle <= allow) options.push({ ...target, score: angle / allow + d * .04 });
    else if (flat < 1.4 && (dx * Math.sin(p.h) + dz * Math.cos(p.h)) / (flat || 1) > .7) options.push({ ...target, score: 1.6 + flat });
  };
  for (const q of s.players) if (q.id !== p.id && q.downed && !q.spectator && q.draggedBy == null && s.options?.revive !== false)
    offer({ kind: 'revive', id: q.id, text: locKey('Mantén E para levantar a {name}'), vars: { name: q.name }, progress: q.revive / reviveTime(p), hold: true }, { x: q.x, y: .35, z: q.z }, .7, 2.8);
  for (const seal of L.run.seals) for (const w of seal.winches || []) if (!s.open[seal.id])
    offer({ kind: 'winch', id: w.id, text: s.winches[w.id]?.latched > 0 ? locKey('Rueda activa · ¡la otra!') : locKey('Mantén E para girar la rueda'), progress: (s.winches[w.id]?.progress || 0) / 1.6, hold: true }, { x: w.x, y: 1.55, z: w.z }, .9);
  for (const [id, progress] of Object.entries(s.rubble)) { const c = L.run.corridors.find(c => c.id === id); if (c) offer({ kind: 'rubble', id, text: locKey('Mantén E para quitar las piedras'), progress: progress / RUBBLE_HOLD, hold: true }, { x: clamp(p.x, c.rect[0], c.rect[2]), y: 1, z: clamp(p.z, c.rect[1], c.rect[3]) }, 1.6, 3); }
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
    for (const [i, [kind, list]] of SHOP.entries()) { const at = shopSpot(i), price = pactoPrice(s.options, list); offer({ kind: 'buy', item: kind, text: s.mangos >= price ? locKey('Comprar {item} · {price} mangos') : locKey('{Item} · {price} mangos (tienen {mangos})'), vars: { item: kind, price, mangos: String(Math.floor(s.mangos)) }, press: true }, at, .35, 3); }
  }
  for (const cart of s.carts || []) {
    if (cart.pushers.length >= 2 || cart.away) continue;
    const held = p.hands.find(h => h && !ITEMS[h.kind].tool), room = held && fitsIn(cart, held.pile ? held.pile.at(-1) : held.kind), place = held ? placeTime(held) : 0;
    // Into the opening: look into the hopper, and a heavy piece takes a moment.
    const target = room && aimInto(p, cart) === 'out' ? { kind: 'info', text: locKey('Apunta adentro') }
      : room ? { kind: 'cart-load', id: cart.id, text: !held.pile ? locKey('Echar {item} al carrito') : held.pile.length > 1 ? locKey('Echar {n} piezas al carrito') : locKey('Echar 1 pieza al carrito'), vars: { item: held.kind, n: held.pile?.length }, ...(place ? { hold: true, progress: (p.placing || 0) / place } : { press: true }) }
      : !p.hands.some(Boolean) ? { kind: 'cart-push', id: cart.id, text: locKey('Empujar el carrito · Bs. {value}'), vars: { value: cartValue(cart) }, press: true } : { kind: 'info', text: locKey('El carrito lleva Bs. {value} · suelta lo que tienes para empujarlo'), vars: { value: cartValue(cart) } };
    offer(target, { x: cart.x, y: .7, z: cart.z }, .95, 3);
  }
  // Rope work: a stake to tie, or a rope to go down or up. Each end answers on its own level.
  const tying = p.hands.some(h => h?.kind === 'cuerda');
  for (const r of L.run.ropes) {
    if (r.floor !== f) continue;
    if (r.needs && !s.strung?.[r.id]) { offer(tying ? { kind: 'tie', id: r.id, text: locKey('Amarrar la cuerda'), press: true } : { kind: 'info', text: locKey('Aquí se amarra una cuerda') }, { x: r.x, y: .6, z: r.z }, .7, 3); continue; }
    offer({ kind: 'rope', id: r.id, down: true, text: locKey('Bajar por la cuerda'), press: true }, { x: r.x, y: 1, z: r.z }, .7, 3);
    offer({ kind: 'rope', id: r.id, down: false, text: locKey('Subir por la cuerda'), press: true }, { x: r.bx, y: 1.4, z: r.bz }, .7, 3);
  }
  for (const b of L.run.bridges) if (b.needs && b.floor === f && !s.strung?.[b.id]) offer(tying ? { kind: 'tie', id: b.id, text: locKey('Amarrar el puente'), press: true } : { kind: 'info', text: locKey('Aquí se amarra un puente con una cuerda') }, { x: b.x, y: .6, z: b.z }, .7, 3);
  for (const c of L.run.chests) if (!s.chests[c.id]) offer({ kind: 'chest', id: c.id, text: locKey('Abrir el cofre'), press: true }, { x: c.x, y: .5, z: c.z }, .65);
  // Hiding spots: hold E a moment to search one.
  for (const sp of L.run.spots) if (!s.spots?.[sp.id] && sp.floor === f) offer({ kind: 'search', id: sp.id, text: SEARCH[sp.kind][0], progress: (s.searching?.[sp.id] || 0) / sp.need, hold: true }, { x: sp.x, y: SEARCH[sp.kind][1], z: sp.z }, spotSize(sp));
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
    offer({ kind: 'pick', id: item.id, text, vars, press: true }, { x: item.x, y: (item.y || 0) + (info.size === 'big' ? info.halo ? .45 : .8 : .2), z: item.z }, info.size === 'big' ? Math.max(.8, info.radius || 1) : .38);
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
export const SHOP = [['farol', 10], ['bengala', 8], ['cuerda', 12], ['botiquin', 15], ['machete', 20], ['honda', 25], ['marcadora', 45]];
export const SHOP_AT = { x: -12.5, z: 6, h: Math.PI / 2 };
export const shopSpot = i => ({ x: SHOP_AT.x + .9, y: 1.05, z: SHOP_AT.z - 1.8 + i * .6 });
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
  const run = layoutFor(s.seed, s.level, themeOf(s)).run;
  return [...run.loot.filter(l => !s.touched[l.id]).map(l => ({ ...l, state: 'ground', y: l.y || 0 })), ...s.items];
}
// Where the crooked compass points: the best treasure, or every third
// quarter-minute the nearest big enemy.
export function compassTarget(s, p) {
  const f = floorOf(p.x), boss = s.enemies.filter(e => floorOf(e.x) === f).sort((a, b) => b.maxHp - a.maxHp)[0];
  if (boss && (Math.floor(s.time / 15) + p.seat) % 3 === 2) return { x: boss.x, z: boss.z, boss: true };
  // Treasure still hidden in an unsearched spot counts too.
  const hidden = layoutFor(s.seed, s.level, themeOf(s)).run.spots.filter(sp => sp.floor === f && !s.spots?.[sp.id] && !sp.decoy && sp.content.length).map(sp => ({ x: sp.x, z: sp.z, value: sp.content.reduce((n, k) => n + valueOf(k), 0) }));
  const best = [...visibleItems(s).filter(i => floorOf(i.x) === f && i.state === 'ground').map(i => ({ x: i.x, z: i.z, value: valueOf(i.kind) })), ...hidden].sort((a, b) => b.value - a.value)[0];
  return best ? { x: best.x, z: best.z, boss: false } : null;
}
// Compass tags on a strip `width` px wide: each wants its centre at x and is w
// wide. Returns the centres, in the same order and left-to-right order kept,
// with `gap` px between neighbours and, while they fit, inside the strip.
export function spreadTags(tags, width, gap = 4) {
  const order = tags.map((_, i) => i).sort((a, b) => tags[a].x - tags[b].x), left = [];
  let edge = 0;
  for (const i of order) { left[i] = Math.max(edge, Math.min(width, tags[i].x) - tags[i].w / 2); edge = left[i] + tags[i].w + gap; }
  edge = width;
  for (const i of order.reverse()) { left[i] = Math.min(left[i], edge - tags[i].w); edge = left[i] - gap; }
  return left.map((l, i) => l + tags[i].w / 2);
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

// A save holds a whole state, so it is only written between floors: everyone at
// the camp and nothing on its way. Bump the version when a saved state stops loading.
export const SAVE_VERSION = 1;
export const saveable = s => s?.phase === 'playing' && !s.lift.moving && s.cargo.phase === 'idle' && s.players.every(p => p.spectator || (floorOf(p.x) === 0 && !p.riding && !p.rope));
export const validSave = d => !!d && d.phase === 'playing' && Array.isArray(d.players) && d.players.length > 0 && Number.isFinite(d.level) && Number.isFinite(d.origin);
// The record's rows (engine/records.js) for this expedition's panas.
export const recordRows = (s, myId) => s.players.filter(p => !p.spectator || p.held).map(p => ({ name: p.name, me: p.id === myId, values: { rounds: p.stats.rounds, comebacks: p.stats.comebacks } }));

// What a jornada asks the cargo lift to bring up: more each level and more
// with more panas.
export function quotaFor(level, roster) {
  return Math.round((400 + 300 * (level - 1)) * (.7 + .1 * Math.min(8, Math.max(1, roster))) / 50) * 50;
}
// What a jornada's floor holds: its loot in sight plus what its hiding spots keep.
export const floorWorth = run => [...run.loot.filter(l => l.floor > 0).map(l => l.kind), ...run.spots.filter(s => !s.decoy).flatMap(s => s.content)].reduce((n, kind) => n + valueOf(kind), 0);
// One extra job a jornada, on top of the quota: what it asks, and what it pays in mangos.
export const ENCARGO_TEXT = { pedido: locKey('Encargo: suban la cajita sellada.'), turno: locKey('Encargo: junten la cuota antes de que se acabe el turno.'), sinBajas: locKey('Encargo: que no caiga nadie.'), todos: locKey('Encargo: suban todos juntos en la jaula.') };
export const encargoPay = level => 20 + 5 * level;
export const turnoSeconds = level => 210 + 45 * level;
// Sobretiempo: bonus mangos for going past the quota, on top of the one per
// BS_PER_MANGO every banked bolívar already pays. A running turno clock adds for
// the time left, and letting it run out forfeits the bonus: that is the gamble.
// Never more than the jornada's encargo pays.
export const BS_PER_MANGO = 10;
export const SOBRETIEMPO = { bsPerMango: 50, secondsPerMango: 30 };
export function sobretiempoPay(level, delivered, quota, secondsLeft = 0) {
  if (!(quota > 0) || delivered < quota || secondsLeft < 0) return 0;
  return Math.min(encargoPay(level), Math.floor((delivered - quota) / SOBRETIEMPO.bsPerMango) + Math.floor(secondsLeft / SOBRETIEMPO.secondsPerMango));
}
// What this jornada's sobretiempo stands at now; the host pays it, the Tab panel shows it.
export const sobretiempoOf = s => sobretiempoPay(s.level, s.delivered || 0, s.quota, s.encargo?.kind === 'turno' && s.encargo.until ? s.encargo.until - s.time : 0);
const levelSeed = (seed, level) => level === 1 ? seed : ((seed ^ Math.imul(level, 2654435761)) >>> 0) || 1;
export class Expedition {
  constructor(seed = 1, options = {}) {
    this.options = { ...DEFAULT_OPTIONS, ...(validOptions(options) ? options : {}) };
    Object.assign(this, { phase: 'lobby', outcome: '', payout: 0, time: 0, seed: seed >>> 0 || 1, rng: seed >>> 0 || 1, players: [], enemies: [], items: [], darts: [], shots: [], splats: [],
      touched: {}, chests: {}, spots: {}, searching: {}, open: {}, revealed: {}, rubble: {}, winches: {}, woke: {}, plates: {}, carts: [], haul: 0,
      lift: { floor: 0, from: 0, to: 0, t: 0, duration: 0, moving: false, switched: false, riders: [], carts: [], items: [], hold: null }, truck: [], codicia: 0, deepest: 0, extraction: 0, wipe: 0,
      level: 1, mangos: 0, quota: 0, delivered: 0, cargo: { phase: 'idle', t: 0, cart: null }, origin: seed >>> 0 || 1,
      swarm: null, swarmSim: null, swarmAt: SWARM.firstAt, swarmId: 0, director: createDirector(), noise: createNoiseBoard(), kills: 0, enemyId: 0, itemId: 10000, shotId: 0, eventId: 0, events: [], ledger: {}, collapseIn: 30, seats: 0,
      strung: {}, puffed: {}, cracked: {}, rocks: [], flares: [], suceso: null, sucesoIn: 75, sucesoLast: '', twinHint: 0, encargo: null, encargosWon: 0, sobretiempo: 0, silbonAt: 0, daily: '', plainOptions: null });
    this.paths = new Map();
  }
  get layout() { return layoutFor(this.seed, this.level, themeOf(this)); }
  configure(options) { if (this.phase === 'playing' || this.resumed || !validOptions(options)) return false; Object.assign(this.options, options); return true; }
  addPlayer(id, name, avatar = {}) {
    let p = this.players.find(p => p.id === id); if (p) { p.avatar = avatar; return p; }
    const slot = this.phase !== 'results' && findSlot(this.players, name);
    if (slot) return this.claimSlot(slot, id, avatar);
    const index = this.players.length;
    p = { id, name: String(name).slice(0, 16), avatar, seat: this.seats++, x: CAMP.x + (index % 4 - 1.5) * 1.6, z: CAMP.z + 4 + Math.floor(index / 4) * 1.6, y: 0, h: Math.PI, pitch: 0,
      vx: 0, vz: 0, hp: 100, downed: false, spectator: this.phase === 'results', revive: 0, hands: [null, null], grip: null, drag: null, draggedBy: null,
      cooldown: 0, swing: 0, swingHand: 0, stamina: 1, stun: 0, reversed: 0, invulnerable: 0, hit: 0, interactCooldown: 0, barkAt: -9, moving: false, drain: 0,
      stats: { unaMas: 0, nosVamos: 0, dropped: 0, banked: 0, curses: 0, last: 0, revives: 0, kills: 0, rounds: 0, comebacks: 0 }, fell: false };
    this.players.push(p); return p;
  }
  removePlayer(id) {
    const p = this.players.find(p => p.id === id); if (!p) return;
    this.release(p); this.unpush(p); this.stopDrag(p);
    for (const q of this.players) if (q.drag === id) this.stopDrag(q);
    if (this.phase === 'playing') p.hands.forEach((h, i) => h && this.drop(p, i));
    this.players = this.players.filter(q => q.id !== id); delete this.ledger[id];
  }
  // A pana who leaves a running expedition keeps their slot (name, colour, numbers,
  // tools): a spectator at the camp until someone claims it. Treasure stays behind
  // for the team. Anywhere else leaving is leaving.
  leave(id) {
    const p = this.players.find(p => p.id === id); if (!p) return;
    if (this.phase !== 'playing' && !(this.resumed && p.saved)) return this.removePlayer(id);
    if (this.phase === 'playing') this.event('slot-held', locKey('{name} se fue. Su puesto queda guardado.'), { vars: { name: p.name } });
    this.holdSlot(p, this.phase === 'playing');
  }
  holdSlot(p, dropHands) {
    if (p.rope) endClimb(this, p);
    this.release(p); this.unpush(p); this.stopDrag(p);
    for (const q of this.players) if (q.drag === p.id) this.stopDrag(q);
    if (dropHands) p.hands.forEach((h, i) => h && !ITEMS[h.kind].tool && this.drop(p, i));
    this.lift.riders = this.lift.riders.filter(id => id !== p.id);
    delete this.ledger[p.id];
    // Room ids are seat numbers and come back: a slot must not answer to its old one.
    p.id = `held-${p.seat}`;
    if (floorOf(p.x) !== 0) Object.assign(p, { x: CAMP.x, z: CAMP.z + 4, y: 0 });
    Object.assign(p, { held: true, spectator: true, downed: false, revive: 0, riding: false, moving: false, hp: Math.max(1, p.hp), fell: false });
  }
  claimSlot(p, id, avatar) {
    Object.assign(p, { id, held: false, spectator: false, invulnerable: 2 });
    if (avatar && Object.keys(avatar).length) p.avatar = avatar;
    if (this.phase === 'playing') this.event('slot-back', locKey('{name} volvió a su puesto.'), { vars: { name: p.name } });
    return p;
  }
  // In the resumed lobby a pana whose name matches nothing can take a missing
  // pana's slot. A new diver goes away; a saved one is held for its owner.
  takeSlot(id, seat) {
    const me = this.players.find(p => p.id === id), slot = this.players.find(p => p.held && p.seat === seat);
    if (!this.resumed || !me || !slot) return false;
    if (me.saved) this.holdSlot(me, false); else this.removePlayer(id);
    slot.name = me.name;
    this.claimSlot(slot, id, me.avatar);
    return true;
  }
  // A saved session back in the lobby: everyone starts missing, and whoever is
  // here finds their slot by name. resume() goes back to the jornada.
  loadSave(data, members) {
    Object.assign(this, clone(data), { phase: 'lobby', resumed: true, events: [], ledger: {}, extraction: 0, wipe: 0 });
    this.paths = new Map(); this.noise = createNoiseBoard(); this.swarmSim = null;
    this.players = this.players.filter(p => !p.spectator || p.held);
    for (const p of this.players) { p.saved = true; this.holdSlot(p, false); }
    for (const m of members.values()) this.addPlayer(m.id, m.name, m.avatar || {});
  }
  resume() {
    this.phase = 'playing'; this.resumed = false;
    for (const p of this.players) delete p.saved;
    this.event('resume', locKey('Seguimos: jornada {level}.'), { vars: { level: this.level } });
  }
  // A noise where something loud happened (engine/play/noise.js): the host's
  // ears, never in a snapshot. `source` is the pana who made it, if any.
  noisy(kind, at, source = null, radius = NOISE[kind]) { emitNoise(this.noise, { x: at.x, z: at.z, floor: floorOf(at.x), radius, kind, source, time: this.time }); }
  event(kind, text = '', extra = {}) { this.events.push({ id: ++this.eventId, kind, text, ...extra }); this.events = this.events.slice(-16); }
  start(seed = this.seed) {
    const roster = this.players.map(p => ({ id: p.id, name: p.name, avatar: p.avatar }));
    const { ledger, eventId } = this;
    Object.assign(this, new Expedition(seed, this.options)); this.ledger = ledger; this.eventId = eventId;
    roster.forEach(p => this.addPlayer(p.id, p.name, p.avatar)); this.phase = 'playing';
    this.carts = this.layout.run.carts.map(c => ({ ...c, contents: [], big: null, pushers: [], vx: 0, vz: 0 }));
    this.quota = pactoQuota(this.options, quotaFor(1, this.players.length), floorWorth(this.layout.run)); this.placeStatues(); this.dealEncargo(); this.sucesoIn = firstSucesoIn(this);
    // Where the jornada happens is part of the first word everyone reads.
    this.event('start', locKey('Jornada 1 · {place}: bajen, llenen el carrito y súbanlo por la carga hasta juntar Bs. {quota}.'), { vars: { quota: this.quota, place: jornadaName(1, themeOf(this)) } });
  }
  accept(id, seq, action, data = {}) {
    if (!Number.isSafeInteger(seq) || seq <= (this.ledger[id] || 0) || !this.players.some(p => p.id === id)) return false;
    this.ledger[id] = seq; return this.action(id, action, data);
  }
  // ---------- El encargo ----------
  // Pact 'turno': every jornada's job is the timed one (the deck's parcel, if any, is just cheap loot).
  dealEncargo() { this.encargo = { kind: hasPacto(this.options, 'turno') ? 'turno' : this.layout.run.encargo, state: 'open', until: 0 }; }
  settleEncargo(won, text = '') {
    const job = this.encargo; if (!job || job.state !== 'open') return;
    job.state = won ? 'paid' : 'lost';
    const pay = encargoPay(this.level); if (won) this.mangos += pay;
    if (won) { this.encargosWon++; this.event('encargo-paid', locKey('¡Encargo cumplido! +{pay} mangos.'), { vars: { pay } }); }
    else this.event('encargo-lost', text);
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
    this.codicia = clamp(this.codicia + amount * (GREED[this.options.greed] || 1) * pactoGreed(this.options), 0, 100);
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
    const forward = { x: Math.sin(p.h), z: Math.cos(p.h) }, power = throwIt ? throwPower(held.kind, 10) : 0;
    // A handful leaves as separate pieces, fanned out a little.
    if (held.pile) {
      const pieces = held.pile.map((kind, i) => {
        const a = p.h + (i - (held.pile.length - 1) / 2) * .18, speed = throwIt ? throwPower(kind, 9 + i * .4) : 1.2;
        return this.spawnItem(kind, p.x + forward.x * .5, p.z + forward.z * .5, { state: 'air', y: 1.2 + (p.y || 0), vx: Math.sin(a) * speed, vz: Math.cos(a) * speed, vy: throwIt ? 3 + Math.sin(p.pitch || 0) * 6 : 1.5, thrower: p.id, thrownAt: this.time });
      });
      return pieces[0];
    }
    const item = { id: held.id, kind: held.kind, uses: held.uses, x: p.x + forward.x * .5, z: p.z + forward.z * .5, y: 1.2 + (p.y || 0), h: p.h, vx: forward.x * power + p.vx * .5, vz: forward.z * power + p.vz * .5,
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
  // Load a hand (a handful goes in piece by piece), or take the handle. A piece
  // can bounce back out: see bounceChance in carga.js.
  cartAction(p, target) {
    const cart = this.carts.find(c => c.id === target.id); if (!cart) return false;
    if (target.kind === 'cart-push') { cart.pushers.push(p.id); p.push = cart.id; this.event('cart-grab', '', { player: p.id }); return true; }
    if (target.kind === 'cart-load') {
      const hand = p.hands.findIndex(h => h && !ITEMS[h.kind].tool); if (hand < 0) return false;
      const held = p.hands[hand], aim = aimInto(p, cart), speed = Math.hypot(cart.vx || 0, cart.vz || 0);
      const settle = (kind, worth) => {
        if (random(this) < bounceChance({ heft: heftOf(kind), aim, fill: fillOf(cart), speed, wobble: cart.wobble || 0 })) { this.spill(cart, kind, worth); return; }
        cart.contents.push({ kind, worth });
      };
      if (held.pile) { while (held.pile.length && fitsIn(cart, held.pile.at(-1))) settle(held.pile.pop(), 1); if (!held.pile.length) p.hands[hand] = null; }
      else { settle(held.kind, held.worth ?? 1); p.hands[hand] = null; }
    }
    this.event('cart-load', '', { player: p.id, cart: cart.id, value: cartValue(cart) });
    return true;
  }
  // A piece leaves the cart over the side: real loot on the floor again, and it
  // does not fall straight back in.
  spill(cart, kind, worth = 1) {
    const a = random(this) * Math.PI * 2, speed = 2.4 + random(this);
    this.spawnItem(kind, cart.x, cart.z, { state: 'air', y: HOPPER.rim + .3, vx: Math.sin(a) * speed, vz: Math.cos(a) * speed, vy: 2.6, worth, spilled: cart.id });
    this.event('cart-spill', locKey('¡Se cayó {item}!'), { cart: cart.id, item: kind, vars: { item: kind } });
  }
  stopDrag(p) { if (p.drag == null) return; const q = this.players.find(q => q.id === p.drag); if (q) q.draggedBy = null; p.drag = null; }
  bank(kind, worth = 1, by = null, bonus = 1) {
    const value = Math.round(valueOf(kind) * worth * bonus); if (!value) return 0;
    this.haul += value; this.mangos += value / BS_PER_MANGO; this.truck.push(kind); this.truck = this.truck.slice(-40);
    if (kind === 'encomienda' && this.encargo?.kind === 'pedido') this.settleEncargo(true);
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
      if (target.kind === 'rope') { const rope = this.layout.run.ropes.find(r => r.id === target.id); if (!rope) return false; startClimb(this, p, rope, target.down); return true; }
      if (target.kind === 'tie') return this.tieRope(p, target.id);
      if (target.kind === 'pick') { const item = visibleItems(this).find(i => i.id === target.id); return !!item && this.pick(p, item); }
    }
    return false;
  }
  // A cuerda is spent on a stake: a hanging rope or a rope bridge, for everyone from then on.
  tieRope(p, id) {
    const hand = p.hands.findIndex(h => h?.kind === 'cuerda'); if (hand < 0 || this.strung[id]) return false;
    p.hands[hand] = null; this.strung[id] = 1; this.paths.clear();
    this.event('tied', locKey('{name} amarró la cuerda.'), { player: p.id, id, vars: { name: p.name } });
    return true;
  }
  openChest(p, id) {
    const chest = this.layout.run.chests.find(c => c.id === id); if (!chest || this.chests[id]) return false;
    this.chests[id] = 1;
    const lucky = holds(p, 'luckyCoin'), f = this.level, count = 2 + Math.floor(random(this) * 2) + (lucky ? 2 : 0);
    for (let i = 0; i < count; i++) {
      const roll = random(this);
      const kind = roll < (lucky ? .5 : .14) ? ARTIFACTS[Math.floor(random(this) * ARTIFACTS.length)] : roll < .38 ? ['machete', 'honda', 'botiquin', 'farol', 'bengala', 'cuerda'][Math.floor(random(this) * 6)] : roll < .5 ? 'mask' : SMALL[Math.min(3, Math.floor(random(this) * (2 + f)))];
      const a = chest.h + (i - count / 2) * .6;
      this.spawnItem(kind, chest.x, chest.z, { state: 'air', y: .9, vx: Math.sin(a) * 2.2, vz: Math.cos(a) * 2.2, vy: 4.5, cursed: !!ITEMS[kind].artifact });
    }
    this.greed(2); this.noisy('chest', chest, p.id); this.event('chest', '', { player: p.id, chest: id, lucky });
    return true;
  }
  // A searched spot gives up what it hides, once: treasure tumbles out toward
  // the pana, a lit lantern shows its corner (or the secret passage), and now
  // and then something nasty comes out instead.
  openSpot(p, sp) {
    if (this.spots[sp.id]) return false;
    this.spots[sp.id] = 1; delete this.searching[sp.id]; this.noisy('open', sp, p.id);
    const front = spotFront(sp), at = sp.reveal || front;
    sp.content.forEach((kind, i) => {
      if (sp.reveal) { this.spawnItem(kind, at.x + (i - (sp.content.length - 1) / 2) * .35, at.z, { state: 'ground', y: 0, cursed: !!ITEMS[kind].artifact }); return; }
      const a = sp.h + (i - (sp.content.length - 1) / 2) * .5, speed = 1.4 + i * .3;
      this.spawnItem(kind, front.x, front.z, { state: 'air', y: .9, vx: Math.sin(a) * speed, vz: Math.cos(a) * speed, vy: 3, cursed: !!ITEMS[kind].artifact });
    });
    if (sp.reveals && !this.revealed[sp.reveals]) { this.revealed[sp.reveals] = 1; this.paths.clear(); this.event('reveal', locKey('¡El candil alumbró un pasadizo detrás del estante!'), { wall: sp.reveals, player: p.id }); }
    if (sp.trap) { const e = spawnEnemy(this, sp.trap, front.x, front.z, { room: sp.room, born: this.time - 1 }); if (e) e.awake = true; }
    const first = sp.content[0], value = sp.content.reduce((n, k) => n + valueOf(k), 0);
    this.greed(sp.decoy || !value ? .3 : 1.5);
    const text = sp.trap ? locKey('¡Algo salió de ahí adentro!') : sp.reveals ? '' : !first ? (sp.kind === 'lantern' ? locKey('El candil alumbra un rincón vacío.') : locKey('Nada. Solo polvo.'))
      : sp.decoy ? locKey('{Item}. No vale casi nada.') : sp.content.length > 1 ? locKey('¡{name} encontró {item} y algo más!') : locKey('¡{name} encontró {item}!');
    this.event('search', text, { player: p.id, spot: sp.id, item: first, found: !!value && !sp.decoy, trap: sp.trap, vars: { name: p.name, item: first } });
    return true;
  }
  use(p, hand) {
    if (p.cooldown > 0 || p.grip != null || p.stun > 0) return false;
    const held = p.hands[hand], kind = held?.kind;
    if (kind === 'bengala') { throwFlare(this, p); p.hands[hand] = null; p.cooldown = .4; p.swing = .25; p.swingHand = hand; this.event('flare', locKey('¡{name} prendió una bengala!'), { player: p.id, vars: { name: p.name } }); return true; }
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
      this.noisy('shot', p, p.id); this.event('shot', '', { player: p.id }); return true;
    }
    // Everything else is a melee swing: fists, the machete, a gold mask…
    const heart = holds(p, 'jaguarHeart');
    const damage = (kind === 'machete' ? 30 : kind === 'jaguarHeart' ? 45 : kind ? 15 : 12) * (heart && kind !== 'jaguarHeart' ? 3 : 1);
    const range = kind === 'machete' ? 2.6 : 2;
    p.cooldown = kind === 'machete' ? .5 : .45; p.swing = .3; p.swingHand = hand;
    let hits = 0;
    for (const e of this.enemies) {
      if (e.hp <= 0 || floorOf(e.x) !== floorOf(p.x)) continue;
      const d = distance(p, e), reach = range + (e.kind === 'guardian' || e.kind === 'silbon' ? .9 : e.kind === 'jaguar' || e.kind === 'stalker' ? .7 : 0);
      if (d > reach) continue;
      const ahead = ((e.x - p.x) * Math.sin(p.h) + (e.z - p.z) * Math.cos(p.h)) / (d || 1);
      if (ahead < .35 || !this.layout.lineClear(p, e, this, .1)) continue;
      hits++; e.hit = .2; e.awake = true;
      // Stone only staggers, and so does the Silbón: no damage, it does not budge.
      if (!wound(e, damage)) stagger(e, .9);
      else if (!['guardian', 'jaguar', 'stalker'].includes(e.kind)) { e.stun = .3; this.layout.moveBody(e, Math.sin(p.h) * .6, Math.cos(p.h) * .6, this, .5); }
      if (e.hp <= 0) this.defeated(e, p);
      if (hits >= 3) break;
    }
    // Snakes do not die of it: they fly apart and pull themselves together (swarm.js).
    if (swingAtSwarm(this, p, kind)) hits++;
    this.noisy(hits ? 'hit' : 'swing', p, p.id); this.event(hits ? 'hit' : 'swing', '', { player: p.id, hand, item: kind || 'fist' });
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
    if (e.kind === 'silbon') {
      // Into the pit: the way down opens and what it carried lands on the rim.
      const f = floorOf(e.x), seal = this.layout.run.seals.find(s => s.floor === f), pit = this.layout.run.pits.find(q => q.floor === f);
      if (seal) this.openSeal(seal);
      const at = pit ? { x: (pit.rect[0] + pit.rect[2]) / 2, z: pit.rect[1] - 1.4 } : e;
      for (const [i, kind] of ['mask', 'cup', 'coins'].entries()) this.spawnItem(kind, at.x + (i - 1) * .9, at.z, { state: 'air', y: 1, vy: 4 });
      this.event('silbon-down', locKey('¡El Silbón se fue al abismo!'), { enemy: e.id });
    }
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
    // A blow from something is loud; poison and the heart's drain are not.
    if (source) this.noisy('hurt', p, p.id);
    if (source) this.event('hurt', '', { player: p.id, enemy: source.id ?? null });
    if (!p.hp) this.down(p);
  }
  down(p) {
    if (p.rope) endClimb(this, p);
    p.downed = true; p.fell = true; this.release(p); this.unpush(p); this.stopDrag(p);
    if (this.encargo?.kind === 'sinBajas' && floorOf(p.x) > 0) this.settleEncargo(false, locKey('Encargo perdido: cayó un pana.'));
    p.hands.forEach((h, i) => { if (h) { p.stats.dropped += heldValue(h); this.drop(p, i); } });
    this.event('down', this.options.revive ? locKey('{name} cayó. Levántenlo (E) o arrástrenlo al camión (R).') : locKey('{name} cayó. Esta expedición no permite revivir.'), { player: p.id, vars: { name: p.name } });
  }
  // ---------- The tick ----------
  update(dt, inputs = new Map()) {
    if (this.phase !== 'playing') return;
    dt = clamp(Number.isFinite(dt) ? dt : 0, 0, .05); this.time += dt; this.lastInputs = inputs;
    const L = this.layout, run = L.run, used = new Set(), reviving = new Set(), searched = new Set();
    let leaving = false;
    for (const p of this.players) {
      for (const key of ['cooldown', 'swing', 'invulnerable', 'hit', 'interactCooldown', 'stun', 'reversed']) p[key] = Math.max(0, p[key] - dt);
      p.slow = Math.max(0, (p.slow || 0) - dt);
      if (p.poison > 0 && alive(p)) { p.poison = Math.max(0, p.poison - dt); p.venom = (p.venom || 0) + dt; if (p.venom >= 1) { p.venom = 0; this.damage(p, 2); } }
      if (!alive(p)) { p.moving = false; if (p.downed && !reviving.has(p.id)) p.revive = Math.max(0, p.revive - dt * .5); continue; }
      const input = inputs.get(p.id) || {}, stamina = p.stamina, airborne = (p.jumpHeight || 0) > 0;
      stepExplorer(p, input, dt, this);
      // Rising water: wading through it, your breath does not come back. (Walking is the same as ever.)
      if (this.suceso?.kind === 'creciente' && p.stamina > stamina && floorOf(p.x) > 0) p.stamina = stamina;
      // Running (stamina draining) and landing a jump are loud; walking is not.
      if (p.moving && p.stamina < stamina - 1e-6) this.noisy('run', p, p.id);
      if (airborne && !(p.jumpHeight > 0) && !p.riding) this.noisy('land', p, p.id);
      if (holds(p, 'jaguarHeart')) { p.drain += dt; if (p.drain > .5) { p.drain = 0; this.damage(p, 1); if (p.downed) { this.event('heart', locKey('El corazón de jaguar consumió a {name}.'), { player: p.id, vars: { name: p.name } }); continue; } } }
      if (!input.hold) p.placing = 0;
      if (input.hold) {
        const target = interaction(this, p);
        if (target?.kind === 'cart-load' && target.hold) { p.placing = (p.placing || 0) + dt; if (p.placing >= placeTime(p.hands.find(h => h && !ITEMS[h.kind].tool))) { p.placing = 0; this.cartAction(p, target); } }
        else p.placing = 0;
        if (target?.kind === 'winch' && !used.has(target.id)) {
          used.add(target.id); const w = this.winches[target.id] ||= { progress: 0, latched: 0 };
          w.progress = Math.min(1.6, w.progress + dt); if (w.progress >= 1.6 && w.latched <= 0) { w.latched = 12; this.event('winch', locKey('Rueda activa por doce segundos. ¡La otra!'), { winch: target.id }); }
        }
        if (target?.kind === 'revive' && !reviving.has(target.id)) {
          const q = this.players.find(q => q.id === target.id); reviving.add(q.id); q.revive += dt;
          if (q.revive >= reviveTime(p)) { this.getUp(q, p); this.event('bark', '', { player: p.id, text: locKey('¡Párate, que no es pa\' tanto!') }); }
        }
        if (target?.kind === 'rubble') { this.rubble[target.id] += dt; if (this.rubble[target.id] >= RUBBLE_HOLD) { delete this.rubble[target.id]; this.event('cleared', locKey('¡Despejaron el túnel!')); } }
        if (target?.kind === 'search') { const sp = run.spots.find(q => q.id === target.id); searched.add(sp.id); this.noisy('search', sp, p.id); if (searchStep(this.searching, sp.id, dt, sp.need)) this.openSpot(p, sp); }
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
        // (Pact 'silbon': already up on its own, so it does not rise a second time here.)
        const risen = this.silbonAt < 0;
        for (const s of run.sleepers) if (s.room === room.id && s.kind !== 'estatua' && !(risen && s.kind === 'silbon') && spawnEnemy(this, s.kind, s.x, s.z, { room: room.id, born: this.time - (s.kind === 'mummy' ? 0 : 1), hanging: s.kind === 'spider' || s.kind === 'bat', ...(s.kind === 'silbon' ? { mode: 'wander', stun: 1.2 } : {}) }) && s.kind === 'mummy') woke++;
        if (!risen && run.sleepers.some(s => s.room === room.id && s.kind === 'silbon')) this.event('boss', locKey('El Silbón se levantó.'), { room: room.id, boss: 'silbon' });
        if (woke && room.kind !== 'guardian' && room.kind !== 'boveda') this.event('awaken', locKey('Las vendas se mueven. Prepárense.'), { room: room.id });
        if (room.kind === 'boveda') this.event('vault', locKey('La bóveda de oro. Algo grande respira en la oscuridad…'), { room: room.id });
      }
      if (p.floor !== floorOf(p.x)) p.floor = floorOf(p.x);
    }
    decaySearches(this.searching, searched, dt, { done: id => this.spots[id] });
    // Wheels latch for twelve seconds; both latched open the way down.
    for (const seal of run.seals) for (const w of seal.winches || []) {
      const s = this.winches[w.id] ||= { progress: 0, latched: 0 };
      s.latched = Math.max(0, s.latched - dt); if (!used.has(w.id) && s.latched <= 0) s.progress = Math.max(0, s.progress - dt * .5);
      if (seal.winches.every(q => this.winches[q.id]?.latched > 0)) this.openSeal(seal);
    }
    this.lifting(dt, used.has('lift')); this.cargoTick(dt); this.carry(dt); this.pushing(dt); this.dragging(dt); this.flying(dt); this.traps(dt); this.paint(dt); this.truckZone(dt); this.artifacts(dt); this.collapses(dt); tickHazards(this, dt);
    if (this.encargo?.kind === 'turno' && this.encargo.state === 'open') {
      if (this.delivered >= this.quota) this.settleEncargo(true);
      else if (this.encargo.until && this.time > this.encargo.until) this.settleEncargo(false, locKey('Se acabó el turno. Sin encargo esta vez.'));
    }
    // Inside a nook a pana is out of the Silbón's world, unless it just pulled them out.
    for (const p of this.players) { p.exposed = Math.max(0, (p.exposed || 0) - dt); const n = alive(p) && p.exposed <= 0 ? nookAt(run, p.x, p.z) : null; p.hidden = n ? n.id : null; }
    updateEnemies(this, dt); tickSwarm(this, dt); this.stalk(dt); pruneNoises(this.noise, this.time);
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
    this.riseSilbon();
    updateDirector(this, dt, (floor, count) => (swarmDue(this) && startSwarm(this, floor)) || this.wave(floor, count));
  }
  // Pact 'silbon': it gets up by itself soon after the first pana lands, instead
  // of waiting for someone to walk into the pit room. silbonAt: 0 nothing due,
  // above 0 when it rises, below 0 it has risen.
  riseSilbon() {
    if (!(this.silbonAt > 0) || this.time < this.silbonAt) return;
    const s = this.layout.run.sleepers.find(q => q.kind === 'silbon');
    this.silbonAt = 0; if (!s || this.woke[s.room]) return;
    if (!spawnEnemy(this, 'silbon', s.x, s.z, { room: s.room, born: this.time - 1, mode: 'wander', stun: 1.2 })) return;
    this.silbonAt = -1; this.event('boss', locKey('El Silbón se levantó.'), { room: s.room, boss: 'silbon' });
  }
  finish(outcome) {
    this.phase = 'results'; this.outcome = outcome;
    // Calor pays on both outcomes: a failed dive still gets its share, with the bonus.
    const bonus = payoutMult(calorOfOptions(this.options)), worth = this.haul + (this.sobretiempo || 0) * BS_PER_MANGO;
    this.payout = outcome === 'extracted' ? worth * bonus : Math.round(worth * (this.options.wipeShare ?? 20) / 100 * bonus);
    const crude = this.options.crude;
    this.event(outcome, outcome === 'extracted' ? locKey('¡Nos vamos! Bs. {value} en el camión.') : crude ? locKey('Por pajúos. La ruina se quedó con todo.')
      : pickLine([locKey('Por confiados. La ruina se quedó con todo.'), locKey('Por gafos. La ruina se quedó con todo.'), locKey('Te quedaste sin el chivo y sin el mecate. La ruina se quedó con todo.')], this.seed), { vars: { value: this.haul } });
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
      item.climb = cart ? (item.climb || 0) + dt : 0;
      if (cart && item.climb >= climbTime(item.kind)) {
        // It sits on the load: what stood above the rim goes over the side, and
        // coming in at speed rocks the cart.
        for (const piece of overRim(cart)) { cart.contents.splice(cart.contents.lastIndexOf(piece), 1); this.spill(cart, piece.kind, piece.worth ?? 1); }
        cart.big = { kind: item.kind, worth: item.worth ?? 1 }; item.loaded = true; item.climb = 0;
        if (length > .2) cart.wobble = Math.min(1, (cart.wobble || 0) + .4);
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
      if (!pushers.length) { cart.vx = cart.vz = 0; cart.wobble = stepWobble(cart.wobble, { dt }); continue; }
      let mx = 0, mz = 0; for (const p of pushers) { const input = this.inputFor(p); mx += input.x || 0; mz += input.z || 0; }
      mx /= pushers.length; mz /= pushers.length;
      const length = Math.hypot(mx, mz), load = Math.min(.4, cart.contents.length * .02 + (cart.big ? .22 : 0));
      const speed = 4.4 * (1 + .12 * (pushers.length - 1)) * (1 - load), ux = length > 1 ? mx / length : mx, uz = length > 1 ? mz / length : mz;
      const jerk = Math.hypot(ux * speed - (cart.vx || 0), uz * speed - (cart.vz || 0)), fromX = cart.x, fromZ = cart.z;
      cart.vx = ux * speed; cart.vz = uz * speed;
      this.layout.moveBody(cart, cart.vx * dt, cart.vz * dt, this, .6);
      // A rough ride rocks the load (the push itself is as fast as ever): a heap
      // loses its top piece, then settles.
      cart.wobble = stepWobble(cart.wobble, { jerk, bump: length > .5 && Math.hypot(cart.x - fromX, cart.z - fromZ) < speed * dt * .4, fill: fillOf(cart), big: !!cart.big, dt });
      if (cart.wobble >= 1) { cart.wobble = .5; const piece = cart.contents.pop(); if (piece) { this.spill(cart, piece.kind, piece.worth ?? 1); pushers[0].stats.dropped += valueOf(piece.kind); } }
      if (length > .2) this.noisy('cart', cart, pushers[0].id);
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
        this.event('descend', locKey('¡Bajaron al piso {floor}: {place}!'), { floor: lift.to, players: lift.riders, vars: { floor: lift.to, place: jornadaName(this.level, themeOf(this)) } });
        if (this.encargo) { if (this.encargo.kind === 'turno') this.encargo.until = this.time + pactoTurno(this.options, turnoSeconds(this.level)); this.event('encargo', ENCARGO_TEXT[this.encargo.kind], { encargo: this.encargo.kind }); }
        if (hasPacto(this.options, 'silbon')) this.silbonAt = this.time + PACTO.silbonAfter;
      }
      this.event('lift-arrive', riders.length ? '' : lift.to ? locKey('El montacargas llegó al piso {floor}.') : locKey('El montacargas llegó al campamento.'), { floor: lift.to, players: lift.riders, vars: { floor: lift.to } });
      const done = lift.to === 0 && lift.from === 1 && riders.length && this.delivered >= this.quota;
      lift.riders = []; lift.carts = []; lift.items = [];
      if (done) {
        if (this.encargo?.kind === 'sinBajas') this.settleEncargo(true);
        if (this.encargo?.kind === 'todos') { const all = this.players.filter(q => !q.spectator && !q.downed).every(q => riders.includes(q)); this.settleEncargo(all, locKey('Encargo perdido: alguien se quedó abajo.')); }
        this.completeLevel();
      }
    }
  }
  // Up with the quota delivered: the jornada is done. Whoever stayed below
  // is hauled up with 1 HP, and the next, deeper jornada is dealt.
  completeLevel() {
    this.tallyRound();
    const extra = sobretiempoOf(this); this.mangos += extra; this.sobretiempo = (this.sobretiempo || 0) + extra;
    const done = this.level, stop = this.layout.run.lifts.find(l => l.floor === 0), delivered = this.delivered;
    // A new deck for the next jornada; the camp's own pieces stay as they are.
    const campLoot = Object.fromEntries(Object.entries(this.touched).filter(([id]) => this.layout.run.loot.find(l => l.id === +id)?.floor === 0));
    this.level++; this.seed = levelSeed(this.origin, this.level);
    Object.assign(this, { touched: campLoot, chests: {}, spots: {}, searching: {}, open: {}, revealed: {}, rubble: {}, winches: {}, woke: {}, plates: {}, enemies: [], darts: [], shots: [], splats: [], swarm: null, swarmSim: null, swarmAt: this.time + SWARM.firstAt,
      codicia: 0, deepest: 0, silbonAt: 0, director: createDirector(), noise: createNoiseBoard(), collapseIn: 30, stalkerRest: 0, delivered: 0, cargo: { phase: 'idle', t: 0, cart: null },
      strung: {}, puffed: {}, cracked: {}, rocks: [], flares: [], suceso: null, sucesoIn: firstSucesoIn(this), twinHint: 0 });
    this.dealEncargo();
    this.items = this.items.filter(i => floorOf(i.x) === 0); this.paths.clear();
    this.carts = this.layout.run.carts.map(c => ({ ...c, contents: [], big: null, pushers: [], vx: 0, vz: 0 }));
    let left = 0;
    this.players.forEach((p, i) => {
      if (p.spectator || floorOf(p.x) === 0) return;
      left++; this.release(p); this.unpush(p); this.stopDrag(p); p.riding = false; p.rope = null;
      p.x = stop.x + (i % 3 - 1) * 1.2; p.z = 3 + Math.floor(i / 3) * 1.2; p.h = 0;
      p.downed = false; p.hp = 1; p.revive = 0; p.invulnerable = 2;
    });
    this.quota = pactoQuota(this.options, quotaFor(this.level, this.players.filter(p => !p.spectator).length), floorWorth(this.layout.run)); this.placeStatues();
    // The next jornada's place (Alternar swaps it) rides in the same line.
    const line = extra
      ? left ? locKey('¡Jornada {level} lista! Subieron Bs. {value}. Sobretiempo: +{extra} mangos. Los que se quedaron abajo llegaron con lo justo. Ahora toca {place}: Bs. {quota}.') : locKey('¡Jornada {level} lista! Subieron Bs. {value}. Sobretiempo: +{extra} mangos. Ahora toca {place}: Bs. {quota}.')
      : left ? locKey('¡Jornada {level} lista! Subieron Bs. {value}. Los que se quedaron abajo llegaron con lo justo. Ahora toca {place}: Bs. {quota}.') : locKey('¡Jornada {level} lista! Subieron Bs. {value}. Ahora toca {place}: Bs. {quota}.');
    this.event('level', line, { level: done, value: delivered, left, extra, vars: { level: done, value: delivered, extra, next: this.level, quota: this.quota, place: jornadaName(this.level, themeOf(this)) } });
  }
  // The record's numbers. A jornada counts for whoever is standing when it is
  // completed; a comeback is falling in it, getting back up and still standing
  // then, at most one per pana per jornada. Being hauled up fallen is neither.
  tallyRound() {
    for (const p of this.players) {
      if (p.spectator) continue;
      if (!p.downed) { p.stats.rounds++; if (p.fell) p.stats.comebacks++; }
      p.fell = false;
    }
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
    const offer = SHOP.find(([k]) => k === kind), price = offer && pactoPrice(this.options, offer[1]); if (!offer || this.mangos < price) return false;
    const weapon = WEAPONS.includes(kind) ? p.hands.findIndex(h => h && WEAPONS.includes(h.kind)) : -1;
    if (weapon >= 0) this.drop(p, weapon);
    const hand = weapon >= 0 ? weapon : p.hands.findIndex(h => !h); if (hand < 0) return false;
    this.mangos -= price; p.hands[hand] = { id: this.itemId++, kind, worth: 1 };
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
          p.stun = .6; this.damage(p, 6); this.noisy('hit', p); item.vx *= -.2; item.vz *= -.2; item.thrower = null;
          this.event('bonk', locKey('¡A {name} le cayó {item} en la cabeza!'), { player: p.id, item: item.kind, vars: { name: p.name, item: item.kind } });
        }
      }
      // A throw that drops into a carrito stays there: ¡encestó!
      const basket = !ITEMS[item.kind].tool && item.vy < 0 && item.y < HOPPER.rim + .4 && item.y > HOPPER.rim - .4 && this.carts.find(c => !c.away && c.id !== item.spilled && floorOf(c.x) === floorOf(item.x) && overHopper(item, c) && fitsIn(c, item.kind));
      // Thrown too hard, into a heap or a moving cart, it bounces back out.
      if (basket && random(this) < bounceChance({ heft: heftOf(item.kind), fill: fillOf(basket), speed: Math.hypot(basket.vx || 0, basket.vz || 0), wobble: basket.wobble || 0, impact: Math.hypot(item.vx, item.vy, item.vz) })) {
        item.spilled = basket.id; item.vy = Math.abs(item.vy) * .45 + 1; item.vx = item.vx * -.45; item.vz = item.vz * -.45;
        this.event('cart-bounce', '', { cart: basket.id });
      } else if (basket) {
        basket.contents.push({ kind: item.kind, worth: item.worth ?? 1 }); item.lost = true;
        this.event('cart-catch', item.thrower != null ? locKey('¡Encestó {item} en el carrito!') : '', { cart: basket.id, item: item.kind, value: cartValue(basket), vars: { item: item.kind } });
        continue;
      }
      const ground = this.layout.groundAt(item.x, item.z);
      if (this.layout.overPit(item.x, item.z) && item.y < -2.5 - this.layout.pitDepth(item.x, item.z)) {
        item.lost = true; const thrower = this.players.find(p => p.id === item.thrower);
        if (thrower) thrower.stats.dropped += valueOf(item.kind);
        this.event('lost', locKey('¡{Item} se fue al abismo!'), { item: item.kind, vars: { item: item.kind } });
      } else if (!this.layout.overPit(item.x, item.z) && item.y <= ground) {
        // It hits the boards: the harder it lands the farther it carries; a book thuds loudest.
        const impact = Math.hypot(item.vx, item.vy, item.vz), book = item.kind === 'oldBook';
        this.noisy(book ? 'book' : 'drop', item, item.thrower, (NOISE.drop + impact * .55) * (book ? NOISE.book : 1));
        // (A hanging platform's height is the deck's to add, as for loot that rests there.)
        item.y = this.layout.lowAt(item.x, item.z) ? 0 : ground; item.state = 'ground'; item.vx = item.vz = item.vy = 0; item.thrower = null; delete item.spilled;
      }
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
      this.noisy('dart', plate);
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
        if (enemy) { wound(enemy, s.marker ? 5 : 6); this.noisy('splat', { x: nx, z: nz }); stagger(enemy, (enemy.kind === 'mummy' || enemy.kind === 'phantom' ? 1.2 : .7) * (s.marker ? .5 : 1)); enemy.hit = .2; enemy.awake = true; if (enemy.hp <= 0) this.defeated(enemy, this.players.find(p => p.id === s.owner)); this.splat(s, nx, nz, 0, 0, true); s.life = 0; break; }
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
          this.noisy('laugh', p, p.id); this.event('laugh', locKey('¡JA, JA, JA! El ídolo se ríe a carcajadas.'), { player: p.id });
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
    this.caveIn();
  }
  caveIn() {
    const deepest = Math.max(0, ...this.players.filter(alive).map(p => floorOf(p.x)));
    const options = this.layout.run.corridors.filter(c => c.floor <= deepest && c.floor > 0 && !c.hidden && !this.rubble[c.id] && !Object.keys(this.rubble).some(id => this.layout.run.corridors.find(q => q.id === id)?.floor === c.floor)
      && !this.players.some(p => inRect(p.x, p.z, c.rect, 2)) && !this.items.some(i => inRect(i.x, i.z, c.rect, 1)));
    if (!options.length) return;
    const c = options[Math.floor(random(this) * options.length)];
    this.rubble[c.id] = 0; this.paths.clear(); this.noisy('collapse', { x: (c.rect[0] + c.rect[2]) / 2, z: (c.rect[1] + c.rect[3]) / 2 });
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
    // The Director's waves mix creatures by depth: bats come in flocks.
    // Deeper jornadas and each biome change who comes: spiders in the grove, cuaimas in the water, phantoms in the temple.
    if (!kind) {
      const roll = random(this), level = this.level || 1, theme = this.layout.run.theme, other = random(this);
      kind = roll < .3 ? 'bat' : (level > 1 || theme === 'hongos') && roll < .3 + .1 * Math.min(3, level) + (theme === 'hongos' ? .15 : 0) ? 'spider' : 'mummy';
      if (kind === 'mummy' && theme === 'inundada' && other < .3) { kind = 'snake'; count = Math.min(2, count); }
      if (kind === 'mummy' && theme === 'templo' && other < .2) kind = 'phantom';
      if (kind === 'bat') count = Math.min(6, count * 2 + 1);
    }
    // In the library, now and then a Lector comes instead (never past its cap).
    if (kind === 'mummy' && this.layout.run.theme === 'biblioteca' && random(this) < .12 + .02 * tier(this)) { kind = 'lector'; count = 1; }
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
    if (spawned && kind === 'bat') this.event('wave', locKey('¡Murciélagos! Alumbren con el farol.'), { floor });
    if (spawned && kind === 'spider') this.event('wave', locKey('Algo corre por el techo…'), { floor });
    if (spawned && kind === 'snake') this.event('wave', locKey('Algo se desliza por el agua…'), { floor });
    if (spawned && kind === 'phantom') this.event('wave', locKey('Las piedras murmuran…'), { floor });
    if (spawned && kind === 'lector') this.event('wave', locKey('Alguien pasa las páginas en la oscuridad…'), { floor });
    return spawned > 0;
  }
  snapshot() { const { paths, lastInputs, noise, swarmSim, ...state } = this; return clone(state); }
  // La Estatua stands in its room from the start of the jornada, asleep
  // (and, to anyone who looks, just a statue) until someone walks in.
  placeStatues() {
    for (const s of this.layout.run.sleepers) if (s.kind === 'estatua') { const e = spawnEnemy(this, 'estatua', s.x, s.z, { room: s.room, awake: false, h: s.h ?? 0, pose: s.pose ?? 0, born: this.time - 1 }); if (e) e.mode = 'still'; }
  }
  restore(snapshot, members) {
    Object.assign(this, clone(snapshot)); this.paths = new Map(); this.noise = createNoiseBoard(); this.swarmSim = null;
    for (const p of [...this.players]) if (!p.held && !members.has(p.id)) this.leave(p.id);
    for (const p of members.values()) if (!this.players.some(q => q.id === p.id)) this.addPlayer(p.id, p.name, p.avatar || {});
  }
}
