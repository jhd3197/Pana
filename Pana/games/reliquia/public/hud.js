// Reliquia's HUD: plain DOM over the canvas, refreshed from the state.
import { ICONS as SVG } from '/engine/icons.js';
import { fillRoster } from '/engine/results.js';
import { setBar } from '/engine/kit.js';
import { ARTIFACT_AURA } from '/engine/models/props/reliquia-treasure.js';
import { interaction, compassTarget, titles, tier, holds, alive } from './rules.js';
import { layoutFor, distance } from './layout.js';
import { FLOOR_NAMES, TRUCK, floorOf, inRect } from './deck.js';
import { ITEMS, BAG_SIZE, valueOf } from './items.js';
import { COLORS } from './view.js';

const $ = id => document.getElementById(id);
const GREED = ['tranquila', 'despierta', 'molesta', 'furiosa', '¡maldita!'];
export const money = n => `Bs. ${Math.round(n).toLocaleString('es-VE')}`;
const clock = s => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
const hearts = hp => { const n = Math.ceil(Math.max(0, hp) / 34); return SVG.heart.repeat(n) + SVG.heartEmpty.repeat(3 - n); };

export function createHud() {
  let rosterKey = '', mapAt = 0;
  const votes = new Map(), compassNodes = new Map(), map = $('minimap').getContext('2d');
  function vote(player, line, time) { if (line === 0 || line === 1) votes.set(player, { line, time }); }

  function slot(i, held, p, state) {
    const node = $(`hand-${i}`), label = node.querySelector('b'), gripping = p.grip != null;
    const big = gripping && state.items.find(x => x.id === p.grip);
    node.classList.toggle('is-empty', !held && !gripping); node.classList.toggle('is-gripping', gripping);
    node.classList.toggle('is-artifact', !!held && !!ITEMS[held.kind].artifact);
    if (held && ITEMS[held.kind].artifact) node.style.setProperty('--aura', `#${ARTIFACT_AURA[held.kind].toString(16).padStart(6, '0')}`);
    const text = gripping && big ? `${ITEMS[big.kind].name} · ${big.carriers.length}/${ITEMS[big.kind].need}` : held ? `${ITEMS[held.kind].name}${held.kind === 'miche' ? ` ×${held.uses}` : ''}` : i ? 'Mano izquierda' : 'Mano derecha';
    if (label.textContent !== text) label.textContent = text;
    node.title = held && ITEMS[held.kind].artifact ? `${ITEMS[held.kind].good} · ${ITEMS[held.kind].bad}` : '';
  }

  function compass(state, p, heading) {
    const L = layoutFor(state.seed, state.options?.floors), f = floorOf(p.x), tags = [];
    if (f === 0) tags.push(['truck', 'CAMIÓN', TRUCK], ['down', 'LA MINA', { x: 0, z: -6 }]);
    else {
      const up = L.run.portals.find(q => q.floor === f && q.dir === 'up'), down = L.run.portals.find(q => q.floor === f && q.dir === 'down');
      if (up) tags.push(['truck', 'SALIDA', { x: (up.rect[0] + up.rect[2]) / 2, z: (up.rect[1] + up.rect[3]) / 2 }]);
      const seal = L.run.seals.find(s => s.floor === f);
      if (down && seal && state.open[seal.id]) tags.push(['down', 'BAJADA', { x: (down.rect[0] + down.rect[2]) / 2, z: down.rect[3] }]);
    }
    if (holds(p, 'compass')) { const t = compassTarget(state, p); if (t) tags.push([t.boss ? 'boss' : 'goal', t.boss ? '¿TESORO?' : 'TESORO', t]); }
    const place = (node, bearing, pin) => {
      const rel = Math.atan2(Math.sin(bearing - heading), Math.cos(bearing - heading)), x = 50 - rel / Math.PI * 100;
      node.hidden = !pin && Math.abs(rel) > Math.PI / 2; node.style.left = `${pin ? Math.max(10, Math.min(90, x)) : x}%`;
    };
    const node = (key, text, className) => {
      let n = compassNodes.get(key);
      if (!n) { n = Object.assign(document.createElement('span'), { className }); $('compass-strip').append(n); compassNodes.set(key, n); }
      if (n.textContent !== text) n.textContent = text; if (n.className !== className) n.className = className; return n;
    };
    ['N', 'NE', 'E', 'SE', 'S', 'SO', 'O', 'NO'].forEach((text, i) => place(node(text, text, `compass-mark${text === 'N' ? ' is-north' : ''}`), Math.PI - i * Math.PI / 4));
    const used = new Set();
    for (const [kind, text, at] of tags) { used.add(kind); place(node(`tag-${kind}`, text, `compass-tag is-${kind}`), Math.atan2(at.x - p.x, at.z - p.z), true); }
    for (const kind of ['truck', 'down', 'goal', 'boss']) if (!used.has(kind) && compassNodes.has(`tag-${kind}`)) compassNodes.get(`tag-${kind}`).hidden = true;
  }

  function minimap(state, p) {
    const L = layoutFor(state.seed, state.options?.floors), f = floorOf(p.x), c = map;
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
    const L = layoutFor(state.seed, state.options?.floors), f = floorOf(p.x), playing = state.phase === 'playing';
    $('floor-name').textContent = f === 0 ? 'Superficie' : `Piso ${f} · ${FLOOR_NAMES[f] || 'El oro profundo'}`;
    $('room-name').textContent = f === 0 ? 'El campamento' : L.regionAt(p)?.name || 'Los pasillos';
    const t = tier(state); setBar($('greed-fill'), state.codicia / 100); $('greed-label').textContent = GREED[t];
    for (let i = 0; i <= 4; i++) document.body.classList.toggle(`greed-${i}`, t === i);
    $('haul').textContent = money(state.haul);
    $('health').textContent = Math.ceil(p.hp); setBar($('health-fill'), p.hp / 100);
    $('stamina-fill').parentElement.style.setProperty('--left', String(p.stamina ?? 1));
    p.hands.forEach((held, i) => slot(i, held, p, state));
    $('bag-count').textContent = `${p.bag.length}/${BAG_SIZE}`; $('bag-value').textContent = money(p.bag.reduce((n, k) => n + valueOf(k), 0));
    const effects = [];
    if (p.reversed > 0) effects.push(`Miche: controles al revés ${Math.ceil(p.reversed)} s`);
    for (const h of p.hands) if (h && ITEMS[h.kind].artifact) effects.push(`${ITEMS[h.kind].name}: ${ITEMS[h.kind].good.toLowerCase()}, ${ITEMS[h.kind].bad.toLowerCase()}`);
    const text = effects.join(' · '); if ($('effects').textContent !== text) $('effects').textContent = text;
    document.body.classList.toggle('reversed', p.reversed > 0); document.body.classList.toggle('downed', !!p.downed);
    document.body.classList.toggle('hurt', p.hit > 0);
    // E prompt.
    const target = playing && !paused ? interaction(state, p) : null;
    $('prompt').classList.toggle('hidden', !target);
    document.body.classList.toggle('can-act', !!target);
    if (target) { $('prompt-label').textContent = target.text; $('prompt-fill').style.width = `${Math.min(1, target.progress || 0) * 100}%`; }
    // The choice: an open way down within sight.
    const seal = L.run.seals.find(s => s.floor === f && state.open[s.id]);
    const choosing = playing && !!seal && distance(p, seal) < 16 && state.deepest <= f;
    $('choice').classList.toggle('hidden', !choosing);
    if (choosing) {
      const recent = [...votes.entries()].filter(([, v]) => state.time - v.time < 30);
      const leave = recent.filter(([, v]) => v.line === 0).length, more = recent.filter(([, v]) => v.line === 1).length;
      $('choice-votes').textContent = `1 · ¿Nos vamos ya? (${leave})   2 · ¡Una sala más! (${more})`;
    }
    // Boss bar: the nearest awake boss on this floor.
    const boss = state.enemies.filter(e => ['guardian', 'jaguar', 'stalker'].includes(e.kind) && e.awake && floorOf(e.x) === f && distance(e, p) < 32).sort((a, b) => distance(a, p) - distance(b, p))[0];
    $('boss').classList.toggle('hidden', !boss);
    if (boss) { $('boss-name').textContent = { guardian: 'El guardián del sol', jaguar: 'El jaguar de oro', stalker: 'El jaguar negro' }[boss.kind]; setBar($('boss-fill'), boss.hp / boss.maxHp); }
    // Team.
    const key = state.players.map(q => `${q.id}:${q.name}`).join('|');
    if (key !== rosterKey) {
      rosterKey = key; $('team').replaceChildren(); $('lobby-team').replaceChildren();
      for (const q of state.players) {
        const chip = document.createElement('span'), dot = document.createElement('i'); chip.className = 'pk-chip'; dot.className = 'pk-dot'; dot.style.background = COLORS[q.seat % 8];
        chip.append(dot, document.createTextNode(q.id === room.id ? `${q.name} · tú` : q.name)); $('lobby-team').append(chip);
        const row = document.createElement('li'); row.className = `pk-row teammate${q.id === room.id ? ' is-me' : ''}`; row.dataset.player = q.id;
        const face = document.createElement('span'); face.className = 'pk-avatar'; face.style.background = COLORS[q.seat % 8]; face.textContent = q.name.slice(0, 1).toUpperCase();
        const name = document.createElement('span'); name.className = 'teammate-name'; name.textContent = q.name;
        const floor = document.createElement('span'); floor.className = 'teammate-floor';
        const value = document.createElement('b'); value.className = 'pk-row-end'; row.append(face, name, floor, value); $('team').append(row);
      }
    }
    for (const q of state.players) {
      const row = $('team').querySelector(`[data-player="${q.id}"]`); if (!row) continue;
      const value = row.querySelector('b'), floor = row.querySelector('.teammate-floor');
      const fl = floorOf(q.x), tag = fl === 0 ? 'Camp.' : `P${fl}`; if (floor.textContent !== tag) floor.textContent = tag;
      if (q.downed || q.spectator) value.textContent = q.downed ? state.options?.revive === false ? 'FUERA' : 'AYUDA' : 'ESPERA';
      else { const html = hearts(q.hp); if (value.dataset.html !== html) { value.innerHTML = html; value.dataset.html = html; } }
      row.classList.toggle('fallen', !!q.downed);
    }
    $('downed').classList.toggle('hidden', !(playing && p.downed));
    if (p.downed) $('downed-copy').textContent = state.options?.revive === false ? 'Te quedas fuera. Tus panas todavía pueden llegar al camión.' : p.draggedBy != null ? 'Te van arrastrando al camión…' : 'Un pana puede levantarte (E) o arrastrarte al camión (R).';
    compass(state, p, heading);
    $('minimap').parentElement.hidden = state.options?.map === false;
    mapAt -= 1; if (mapAt <= 0 && state.options?.map !== false) { minimap(state, p); mapAt = 3; }
  }

  function board(open, state, room) {
    $('board').hidden = !open; if (!open) return;
    fillRoster($('board-list'), state.players.filter(q => !q.spectator).map((q, i) => ({ rank: i + 1, name: q.name, me: q.id === room.id,
      detail: `${floorOf(q.x) === 0 ? 'En el campamento' : `Piso ${floorOf(q.x)}`} · morral ${money(q.bag.reduce((n, k) => n + valueOf(k), 0))}`, end: money(q.stats.banked), score: true })));
  }

  function results(state, room) {
    const win = state.outcome === 'extracted';
    $('result-eyebrow').textContent = win ? 'Expedición completada' : 'La ruina se quedó con todo';
    $('result-title').textContent = win ? '¡Nos vamos!' : 'Una vuelta más.';
    $('result-copy').textContent = win ? `Subieron ${money(state.haul)} al camión. ${state.deepest >= (state.options?.floors || 3) ? 'Llegaron hasta la bóveda.' : '¿Y si la próxima bajan un piso más?'}`
      : `Cayeron todos. Del camión solo se salvó ${state.options?.wipeShare ?? 20} %. ${state.events.at(-1)?.text || ''}`;
    $('result-payout').textContent = money(state.payout); $('result-depth').textContent = state.deepest; $('result-time').textContent = clock(state.time);
    const list = titles(state);
    $('titles').replaceChildren(...list.map(t => {
      const li = document.createElement('li'); li.className = 'pk-row';
      const name = document.createElement('span'); name.className = 'title-name'; name.textContent = t.title;
      const who = document.createElement('span'); who.textContent = t.name; const small = document.createElement('small'); small.textContent = t.detail; who.append(small);
      li.append(name, who); return li;
    }));
    $('again').disabled = !room.connected || !room.isHost; $('again').textContent = room.isHost ? '¡Otra expedición!' : 'Esperando al anfitrión…';
  }
  return { update, board, results, vote, alive };
}
