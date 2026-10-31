// Reliquia's HUD: plain DOM over the canvas, refreshed from the state.
import { ICONS as SVG } from '/engine/icons.js';
import { loc, locn, formatNumber } from '/engine/i18n.js';
import { fillRoster } from '/engine/results.js';
import { setBar } from '/engine/kit.js';
import { ARTIFACT_AURA } from '/engine/models/props/reliquia-treasure.js';
import { interaction, compassTarget, titles, tier, holds, alive, cartValue } from './rules.js';
import { layoutFor, distance } from './layout.js';
import { FLOOR_NAMES, TRUCK, floorOf, inRect } from './deck.js';
import { ITEMS, heldValue, itemName, say } from './items.js';
import { COLORS } from './view.js';

const $ = id => document.getElementById(id);
const GREED = [loc('tranquila'), loc('despierta'), loc('molesta'), loc('furiosa'), loc('¡maldita!')];
export const money = n => `Bs. ${formatNumber(Math.round(n))}`;
// Compass points: only the Spanish SO, O and NO change (to SW, W, NW).
const MARKS = ['N', 'NE', 'E', 'SE', 'S', loc('SO', { $ctx: 'compass' }), loc('O', { $ctx: 'compass' }), loc('NO', { $ctx: 'compass' })];
const clock = s => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
const hearts = hp => { const n = Math.ceil(Math.max(0, hp) / 34); return SVG.heart.repeat(n) + SVG.heartEmpty.repeat(3 - n); };

export function createHud() {
  let rosterKey = '', mapAt = 0;
  const votes = new Map(), compassNodes = new Map(), map = $('minimap').getContext('2d');
  function vote(player, line, time) { if (line === 0 || line === 1) votes.set(player, { line, time }); }

  function slot(i, held, p, state) {
    const node = $(`hand-${i}`), label = node.querySelector('b'), gripping = p.grip != null || p.push != null;
    const big = gripping && state.items.find(x => x.id === p.grip);
    node.classList.toggle('is-empty', !held && !gripping); node.classList.toggle('is-gripping', gripping);
    node.classList.toggle('is-artifact', !!held && !!ITEMS[held.kind].artifact);
    if (held && ITEMS[held.kind].artifact) node.style.setProperty('--aura', `#${ARTIFACT_AURA[held.kind].toString(16).padStart(6, '0')}`);
    const pushing = p.push != null && state.carts.find(c => c.id === p.push);
    const text = pushing ? (i ? money(cartValue(pushing)) : loc('Empujando el carrito')) : gripping && big ? `${itemName(big.kind)} · ${big.carriers.length}/${ITEMS[big.kind].need}` : held?.pile ? loc('Un puñado · {n}/4', { n: held.pile.length }) : held ? `${itemName(held.kind)}${held.kind === 'miche' ? ` ×${held.uses}` : ''}` : i ? loc('Mano izquierda') : loc('Mano derecha');
    if (label.textContent !== text) label.textContent = text;
    node.title = held && ITEMS[held.kind].artifact ? `${loc(ITEMS[held.kind].good)} · ${loc(ITEMS[held.kind].bad)}` : '';
  }

  function compass(state, p, heading) {
    const L = layoutFor(state.seed, state.level), f = floorOf(p.x), tags = [];
    const stop = L.run.lifts.find(l => l.floor === f);
    if (f === 0) tags.push(['truck', loc('CAMIÓN'), TRUCK]);
    if (stop) tags.push(['down', loc('MONTACARGAS'), stop]);
    const pad = L.run.cargo.find(c => c.floor === f && f > 0); if (pad) tags.push(['boss', loc('CARGA'), pad]);
    const seal = L.run.seals.find(s => s.floor === f);
    if (seal && !state.open[seal.id]) tags.push(['goal', loc('SELLO'), seal]);
    if (holds(p, 'compass')) { const t = compassTarget(state, p); if (t) tags.push([t.boss ? 'boss' : 'goal', t.boss ? loc('¿TESORO?') : loc('TESORO'), t]); }
    const place = (node, bearing, pin) => {
      const rel = Math.atan2(Math.sin(bearing - heading), Math.cos(bearing - heading)), x = 50 - rel / Math.PI * 100;
      node.hidden = !pin && Math.abs(rel) > Math.PI / 2; node.style.left = `${pin ? Math.max(10, Math.min(90, x)) : x}%`;
    };
    const node = (key, text, className) => {
      let n = compassNodes.get(key);
      if (!n) { n = Object.assign(document.createElement('span'), { className }); $('compass-strip').append(n); compassNodes.set(key, n); }
      if (n.textContent !== text) n.textContent = text; if (n.className !== className) n.className = className; return n;
    };
    MARKS.forEach((text, i) => place(node(text, text, `compass-mark${text === 'N' ? ' is-north' : ''}`), Math.PI - i * Math.PI / 4));
    const used = new Set();
    for (const [kind, text, at] of tags) { used.add(kind); place(node(`tag-${kind}`, text, `compass-tag is-${kind}`), Math.atan2(at.x - p.x, at.z - p.z), true); }
    for (const kind of ['truck', 'down', 'goal', 'boss']) if (!used.has(kind) && compassNodes.has(`tag-${kind}`)) compassNodes.get(`tag-${kind}`).hidden = true;
  }

  function minimap(state, p) {
    const L = layoutFor(state.seed, state.level), f = floorOf(p.x), c = map;
    c.clearRect(0, 0, 180, 180);
    const scale = f === 0 ? 3 : 1.5, sx = x => 90 + (x - p.x) * scale, sz = z => 90 + (z - p.z) * scale;
    const known = r => f === 0 || state.woke[r.id] || r.index === 0;
    c.fillStyle = '#4a3f80';
    for (const r of L.run.rooms) if (r.floor === f && known(r) && (!r.hidden || state.revealed[r.hidden])) c.fillRect(sx(r.rect[0]), sz(r.rect[1]), r.w * scale, r.d * scale);
    c.fillStyle = '#3a2f68';
    for (const k of L.run.corridors) if (k.floor === f && (!k.hidden || state.revealed[k.hidden]) && (state.woke[k.a] || state.woke[k.b])) c.fillRect(sx(k.rect[0]), sz(k.rect[1]), (k.rect[2] - k.rect[0]) * scale, (k.rect[3] - k.rect[1]) * scale);
    c.fillStyle = '#ff6a3d';
    for (const id of Object.keys(state.rubble)) { const k = L.run.corridors.find(q => q.id === id); if (k?.floor === f) c.fillRect(sx(k.rect[0]), sz(k.rect[1]), (k.rect[2] - k.rect[0]) * scale, (k.rect[3] - k.rect[1]) * scale); }
    if (f === 0) { c.fillStyle = '#ffc23d'; c.beginPath(); c.arc(sx(TRUCK.x), sz(TRUCK.z), 6, 0, 7); c.fill(); }
    for (const q of state.players) if (floorOf(q.x) === f) { c.fillStyle = q.downed ? '#ff4b4b' : COLORS[q.seat % 8]; c.beginPath(); c.arc(sx(q.x), sz(q.z), q.id === p.id ? 4 : 3, 0, 7); c.fill(); }
    c.save(); c.translate(90, 90); c.rotate(Math.PI - p.h); c.fillStyle = '#fff'; c.beginPath(); c.moveTo(0, -9); c.lineTo(4, -2); c.lineTo(-4, -2); c.fill(); c.restore();
  }

  function update(state, p, room, { heading = 0, paused = false } = {}) {
    if (!p) return;
    const L = layoutFor(state.seed, state.level), f = floorOf(p.x), playing = state.phase === 'playing';
    $('floor-name').textContent = loc('Jornada {n} · {place}', { n: state.level, place: f === 0 ? loc('Superficie') : loc(FLOOR_NAMES[Math.min(FLOOR_NAMES.length - 1, state.level)]) });
    const load = state.delivered || 0;
    $('quota-label').textContent = `${money(load)} / ${money(state.quota)}`; setBar($('quota-fill'), state.quota ? load / state.quota : 0);
    document.body.classList.toggle('quota-met', load >= state.quota); $('mangos').textContent = Math.floor(state.mangos);
    const region = L.regionAt(p)?.name;
    $('room-name').textContent = f === 0 ? loc('El campamento') : region ? loc(region) : loc('Los pasillos');
    const t = tier(state); setBar($('greed-fill'), state.codicia / 100); $('greed-label').textContent = GREED[t];
    for (let i = 0; i <= 4; i++) document.body.classList.toggle(`greed-${i}`, t === i);
    $('haul').textContent = loc('{value} en el camión', { value: money(state.haul) });
    const lift = state.lift, n = lift.moving ? lift.to : lift.floor, full = lift.riders.length > 0;
    const status = !lift.moving ? n ? loc('en el piso {n}', { n }) : loc('en el campamento')
      : lift.to > lift.from ? full ? loc('bajando al piso {n}', { n }) : loc('bajando al piso {n} (vacío)', { n })
      : n ? full ? loc('subiendo al piso {n}', { n }) : loc('subiendo al piso {n} (vacío)', { n })
      : full ? loc('subiendo al campamento') : loc('subiendo al campamento (vacío)');
    if ($('lift-status').textContent !== status) $('lift-status').textContent = status;
    $('health').textContent = Math.ceil(p.hp); setBar($('health-fill'), p.hp / 100);
    $('stamina-fill').parentElement.style.setProperty('--left', String(p.stamina ?? 1));
    p.hands.forEach((held, i) => slot(i, held, p, state));
    $('carry-value').textContent = money(p.hands.reduce((n, h) => n + (h && !ITEMS[h.kind].tool ? heldValue(h) : 0), 0));
    const effects = [];
    if (p.reversed > 0) effects.push(loc('Miche: controles al revés {n} s', { n: Math.ceil(p.reversed) }));
    for (const h of p.hands) if (h && ITEMS[h.kind].artifact) effects.push(`${itemName(h.kind)}: ${loc(ITEMS[h.kind].good).toLowerCase()}, ${loc(ITEMS[h.kind].bad).toLowerCase()}`);
    const text = effects.join(' · '); if ($('effects').textContent !== text) $('effects').textContent = text;
    document.body.classList.toggle('reversed', p.reversed > 0); document.body.classList.toggle('is-down', !!p.downed);
    document.body.classList.toggle('hurt', p.hit > 0);
    // E prompt.
    const target = playing && !paused ? interaction(state, p) : null;
    $('prompt').classList.toggle('hidden', !target);
    document.body.classList.toggle('can-act', !!target);
    if (target) { $('prompt-label').textContent = say(target.text, target.vars); $('prompt-fill').style.width = `${Math.min(1, target.progress || 0) * 100}%`; }
    // The choice: an open way down within sight.
    // The choice: standing at the montacargas with the way down open.
    const stop = L.run.lifts.find(l => l.floor === f);
    const choosing = playing && f > 0 && !!stop && distance(p, stop) < 5 && state.delivered >= state.quota;
    $('choice').classList.toggle('hidden', !choosing);
    if (choosing) {
      const recent = [...votes.entries()].filter(([, v]) => state.time - v.time < 30);
      const leave = recent.filter(([, v]) => v.line === 0).length, more = recent.filter(([, v]) => v.line === 1).length;
      $('choice-votes').textContent = loc('1 · ¿Nos vamos ya? ({leave})   2 · ¡Una sala más! ({more})', { leave, more });
    }
    // Boss bar: the nearest awake boss on this floor.
    const boss = state.enemies.filter(e => ['guardian', 'jaguar', 'stalker'].includes(e.kind) && e.awake && floorOf(e.x) === f && distance(e, p) < 32).sort((a, b) => distance(a, p) - distance(b, p))[0];
    $('boss').classList.toggle('hidden', !boss);
    if (boss) { $('boss-name').textContent = { guardian: loc('El guardián del sol'), jaguar: loc('El jaguar de oro'), stalker: loc('El jaguar negro') }[boss.kind]; setBar($('boss-fill'), boss.hp / boss.maxHp); }
    // Team.
    const key = state.players.map(q => `${q.id}:${q.name}`).join('|');
    if (key !== rosterKey) {
      rosterKey = key; $('team').replaceChildren(); $('lobby-team').replaceChildren();
      for (const q of state.players) {
        const chip = document.createElement('span'), dot = document.createElement('i'); chip.className = 'pk-chip'; chip.translate = false; dot.className = 'pk-dot'; dot.style.background = COLORS[q.seat % 8];
        chip.append(dot, document.createTextNode(q.id === room.id ? loc('{name} · tú', { name: q.name }) : q.name)); $('lobby-team').append(chip);
        const row = document.createElement('li'); row.className = `pk-row teammate${q.id === room.id ? ' is-me' : ''}`; row.dataset.player = q.id;
        const face = document.createElement('span'); face.className = 'pk-avatar'; face.style.background = COLORS[q.seat % 8]; face.textContent = q.name.slice(0, 1).toUpperCase();
        const name = document.createElement('span'); name.className = 'teammate-name'; name.textContent = q.name; name.translate = false;
        const floor = document.createElement('span'); floor.className = 'teammate-floor';
        const value = document.createElement('b'); value.className = 'pk-row-end'; row.append(face, name, floor, value); $('team').append(row);
      }
    }
    for (const q of state.players) {
      const row = $('team').querySelector(`[data-player="${q.id}"]`); if (!row) continue;
      const value = row.querySelector('b'), floor = row.querySelector('.teammate-floor');
      const fl = floorOf(q.x), tag = fl === 0 ? loc('Camp.') : loc('P{n}', { n: fl }); if (floor.textContent !== tag) floor.textContent = tag;
      if (q.downed || q.spectator) value.textContent = q.downed ? state.options?.revive === false ? loc('FUERA') : loc('AYUDA') : loc('ESPERA');
      else { const html = hearts(q.hp); if (value.dataset.html !== html) { value.innerHTML = html; value.dataset.html = html; } }
      row.classList.toggle('fallen', !!q.downed);
    }
    $('downed').classList.toggle('hidden', !(playing && p.downed));
    if (p.downed) $('downed-copy').textContent = state.options?.revive === false ? loc('Te quedas fuera. Tus panas todavía pueden llegar al camión.') : p.draggedBy != null ? loc('Te van arrastrando al camión…') : loc('Un pana puede levantarte (E) o arrastrarte al camión (R).');
    compass(state, p, heading);
    $('minimap').parentElement.hidden = state.options?.map === false;
    mapAt -= 1; if (mapAt <= 0 && state.options?.map !== false) { minimap(state, p); mapAt = 3; }
  }

  const carried = q => money(q.hands.reduce((n, h) => n + (h && !ITEMS[h.kind].tool ? heldValue(h) : 0), 0));
  function board(open, state, room) {
    $('board').hidden = !open; if (!open) return;
    fillRoster($('board-list'), state.players.filter(q => !q.spectator).map((q, i) => ({ rank: i + 1, name: q.name, me: q.id === room.id,
      detail: floorOf(q.x) === 0 ? loc('En el campamento · en las manos {value}', { value: carried(q) }) : loc('Piso {n} · en las manos {value}', { n: floorOf(q.x), value: carried(q) }), end: money(q.stats.banked), score: true })));
  }

  function results(state, room) {
    const win = state.outcome === 'extracted';
    $('result-eyebrow').textContent = win ? loc('Expedición completada') : loc('La ruina se quedó con todo');
    $('result-title').textContent = win ? loc('¡Nos vamos!') : loc('Una vuelta más.');
    const value = money(state.haul), last = state.events.at(-1);
    $('result-copy').textContent = !win ? loc('Cayeron todos. Del camión solo se salvó {share} %. {why}', { share: state.options?.wipeShare ?? 20, why: say(last?.text, last?.vars) })
      : state.level > 1 ? locn(state.level - 1, 'Subieron {value} al camión. Completaron {n} jornada.', 'Subieron {value} al camión. Completaron {n} jornadas.', { value })
      : loc('Subieron {value} al camión. ¿Y si la próxima completan una jornada?', { value });
    $('result-payout').textContent = formatNumber(Math.round(state.payout)); $('result-depth').textContent = state.level - 1; $('result-time').textContent = clock(state.time);
    const list = titles(state);
    $('titles').replaceChildren(...list.map(t => {
      const li = document.createElement('li'); li.className = 'pk-row';
      const name = document.createElement('span'); name.className = 'title-name'; name.textContent = loc(t.title);
      const who = document.createElement('span'); who.textContent = t.name; who.translate = false; const small = document.createElement('small'); small.textContent = loc(t.detail); who.append(small);
      li.append(name, who); return li;
    }));
    $('again').disabled = !room.connected || !room.isHost; $('again').textContent = room.isHost ? loc('¡Otra expedición!') : loc('Esperando al anfitrión…');
  }
  return { update, board, results, vote, alive };
}
