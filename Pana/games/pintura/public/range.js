// The armory's shooting range (the Probar button): a covered lane in first
// person with the equipped kit. range-sim.js runs the real rules, so cadence,
// spread, falloff, magazines, reloads, grenades and melee are the round's;
// range-scene.js draws it. Input is the game's: pointer-lock look (drag on
// touch, right stick on a controller), click or RT fires, right click / F / LT
// aims, R / X reloads, G / RB charges a grenade, T / Y resets the targets and
// Esc / B (or Volver) goes back to the armory exactly as it was.
import { ICONS } from '/engine/icons.js';
import { loc, locn } from '/engine/i18n.js';
import { sound } from '/engine/fx.js';
import { holdButton } from '/engine/touch.js';
import { createLookControls } from '/engine/play/first-person.js';
import { createScopeOverlay } from '/engine/play/scope.js';
import { createShotCharge } from '/engine/play/shot-charge.js';
import { EYE } from './rules.js';
import { sfx } from './sounds.js';
import { createRangeSim } from './range-sim.js';
import { createRangeScene } from './range-scene.js';

const pepazos = n => n === Infinity ? loc('K.O.') : locn(n, '{n} pepazo', '{n} pepazos', { n: String(Math.round(n * 100) / 100) });
let css = null;
function loadCss() { if (css?.isConnected) return; css = document.createElement('link'); css.rel = 'stylesheet'; css.href = new URL('./range.css', import.meta.url).href; document.head.append(css); }
const button = (id, icon, label, text = '') => `<button id="${id}" type="button" class="pk-btn" aria-label="${label}">${ICONS[icon]}${text ? `<span>${text}</span>` : ''}</button>`;

// dialog: the armory <dialog> (the range lives in its top layer); kit: the saved kit;
// options: the room's; onExit: called once the range is gone.
export function openRange({ dialog, kit, options, onExit = () => {} }) {
  loadCss();
  const root = document.createElement('section'); root.id = 'range'; root.setAttribute('aria-label', loc('Polígono de tiro'));
  root.innerHTML = `<canvas id="range-view"></canvas><div id="range-cross" aria-hidden="true"><i></i><b></b></div>
<div id="range-read" data-hud-transient hidden><b></b><span></span></div>
${button('range-back', 'back', loc('Volver'), loc('Volver'))}${button('range-reset', 'whirl', loc('Reponer blancos'))}
<div id="range-ammo"><b></b><span></span><i class="range-nade">${ICONS.kitGrenade}</i></div>
<div id="range-pad">${button('range-grenade', 'kitGrenade', loc('Lanzar granada'))}${button('range-reload', 'kitHopper', loc('Recargar'))}${button('range-aim', 'kitOptic', loc('Apuntar'))}${button('range-fire', 'kitPaint', loc('Disparar'))}</div>`;
  dialog.append(root);
  const $ = id => root.querySelector(`#${id}`), canvas = $('range-view');
  const sim = createRangeSim(kit, options), view = createRangeScene(canvas), scopeView = createScopeOverlay(document, { parent: root });
  sim.targets.forEach(view.addTarget);
  { const a = sim.aimAt(sim.targets[sim.melee ? 0 : 3]); view.face(Math.atan2(-a.ax, -a.az), 0); }
  let closed = false, firing = false, queuedFire = false, queuedReload = false, mouseAim = false, keyAim = false, touchAim = false, touchFire = false, throwSends = 0, grenadeSends = 0, queuedGrenade = null;
  let lastFired = 0, lastReload = 0, lastSwings = 0, hitFlash = 0, readFor = 0, script = null;
  const aiming = () => mouseAim || keyAim || touchAim || padAim;
  const grenade = createShotCharge({ min: 0, ready: () => !closed && !!sim.me.grenadeReady, revision: () => 0,
    change: power => { root.classList.toggle('charging', power !== null); root.style.setProperty('--charge', String(power ?? 0)); },
    shoot: power => { queuedGrenade = power; grenadeSends = 3; } });
  const charge = source => { sound.unlock(); if (grenade.begin(source)) sfx.pin(); };
  const throwable = () => !!sim.stats.throwable;
  const look = createLookControls(canvas, { enabled: () => !closed, look: (y, p) => { const k = view.sensitivity(); view.look(y * k, p * k); },
    press(event) { sound.unlock(); if (event.button === 0) firing = queuedFire = true; if (event.button === 2) { if (throwable()) throwSends = 3; else mouseAim = true; } },
    release(event) { if (event.button === 0 || event.type === 'pointercancel') firing = false; if (event.button === 2 || event.type === 'pointercancel') mouseAim = false; },
    unlocked: () => close() });
  const pads = [
    holdButton($('range-fire'), { down: () => { sound.unlock(); touchFire = queuedFire = true; }, up: () => { touchFire = false; } }),
    holdButton($('range-aim'), { down: () => { if (throwable()) { throwSends = 3; return; } touchAim = !touchAim; $('range-aim').setAttribute('aria-pressed', String(touchAim)); }, up: () => {} }),
    holdButton($('range-reload'), { down: () => { queuedReload = true; }, up: () => {} }),
    holdButton($('range-grenade'), { down: () => charge('pointer'), up: () => grenade.release('pointer') }),
  ];
  $('range-back').onclick = () => close(); $('range-reset').onclick = () => reset();
  // Keys while the range is up; the game behind never sees them.
  const KEYS = new Set(['r', 'g', 'f', 'v', 't', 'enter']);
  function onKey(event) {
    const key = event.key.toLowerCase(), down = event.type === 'keydown';
    if (!KEYS.has(key) || event.target.closest?.('input, textarea, select')) return;
    event.preventDefault(); event.stopImmediatePropagation(); sound.unlock();
    if (key === 'enter') firing = down;
    if (key === 'f') { if (down && throwable()) throwSends = 3; else keyAim = down; }
    if (!down) { if (key === 'g') grenade.release('g'); return; }
    if (event.repeat) return;
    if (key === 'r') queuedReload = true; if (key === 'g') charge('g'); if (key === 'v' && throwable()) throwSends = 3; if (key === 't') reset();
  }
  // Esc out of pointer lock is `unlocked`; Esc otherwise would close the armory: it closes only the range.
  const onCancel = event => { event.preventDefault(); close(); };
  addEventListener('keydown', onKey, true); addEventListener('keyup', onKey, true); dialog.addEventListener('cancel', onCancel);
  // A controller: RT fires, LT aims, X reloads, RB holds the grenade, Y resets, B goes back (the right stick looks).
  let padAim = false, padWas = [];
  function pollPad() {
    const pad = [...(navigator.getGamepads?.() || [])].find(Boolean); if (!pad) { padAim = false; return; }
    const on = i => (pad.buttons[i]?.value ?? 0) > .4, edge = i => on(i) && !padWas[i];
    padAim = on(6); if (on(7)) { if (!padWas[7]) { sound.unlock(); queuedFire = true; } firing = true; } else if (padWas[7]) firing = false;
    if (edge(2)) queuedReload = true; if (edge(5)) charge('pad'); if (!on(5) && padWas[5]) grenade.release('pad'); if (edge(3)) reset(); if (edge(11) && throwable()) throwSends = 3;
    const back = edge(1); padWas = pad.buttons.map((_, i) => on(i)); if (back) close();
  }
  // Touch aim assist, as in a round: the raised target closest to the crosshair within 20°.
  function assist(ax, az) {
    let best = null, off = .35;
    for (const t of sim.targets) if (t.raised) { const a = sim.aimAt(t), d = Math.acos(Math.max(-1, Math.min(1, a.ax * ax + a.az * az))); if (d < off) { off = d; best = a; } }
    return best;
  }
  // One tick's input, exactly what a round would send.
  function input() {
    let ax = -Math.sin(view.yaw), az = -Math.cos(view.yaw), pitch = view.pitch, fire = queuedFire || firing || touchFire;
    if (script) {
      if (sim.me.fired - script.from >= script.n && !sim.arena.balls.length) { script.list.shift(); script.from = sim.me.fired; }
      const t = sim.targets[script.list[0]];
      if (t) { const a = sim.aimAt(t); view.face(Math.atan2(-a.ax, -a.az), a.pitch); ax = a.ax; az = a.az; pitch = a.pitch; fire = sim.me.fired - script.from < script.n; } else script = null;
    } else if (touchFire) { const a = assist(ax, az); if (a) { ax = a.ax; az = a.az; } }
    if (fire && sim.me.reload > 0 && performance.now() - lastDry > 450) { lastDry = performance.now(); sfx.dry(); }
    const out = { ax, az, pitch, fire, aim: aiming(), reload: queuedReload, grenade: queuedGrenade !== null, charge: queuedGrenade ?? 0, alt: throwSends > 0 };
    queuedFire = queuedReload = false; if (throwSends) throwSends--; if (grenadeSends && !--grenadeSends) queuedGrenade = null;
    return out;
  }
  let lastDry = 0;
  const read = $('range-read');
  function show(distance, text, kind) { read.hidden = false; read.dataset.kind = kind; read.querySelector('b').textContent = `${distance} m`; read.querySelector('span').textContent = text; readFor = 2.6; }
  // How high up the face a ball landed: the eye plus its pitch over the distance, a little scatter for pellets.
  const heightAt = (pitch, distance, n) => EYE + Math.tan(pitch) * distance + Math.sin(n * 12.9898) * .08;
  let hitSerial = 0;
  function report(r) {
    for (const h of r.hits) {
      const t = h.target, along = h.at ? h.at.z - (t.z + t.offset) : 0;
      view.splatTarget(t, along, h.melee || h.blast ? 1.1 : heightAt(h.pitch, h.distance, ++hitSerial), sim.me.color, h.blast ? .75 : .42);
      show(h.distance, pepazos(h.damage), h.damage === Infinity ? 'ko' : 'hit'); hitFlash = .22; sfx.hitTick(); stats.hits++; stats.last = { distance: h.distance, damage: h.damage, target: t.d }; stats.on[t.d] = (stats.on[t.d] || 0) + 1;
    }
    for (const w of r.walls) { view.splatWorld(w.x, heightAt(w.pitch, w.travel, ++hitSerial), w.z, sim.me.color); sfx.impact(.6 / (1 + w.travel / 15)); }
    for (const s of r.shorts) { view.splatWorld(s.x, 0, s.z, sim.me.color, .35); if (!r.hits.length) show(Math.round(s.travel), loc('Corto'), 'short'); stats.short = Math.round(s.travel); }
    for (const b of r.booms) { view.boom(b); sfx.boom(b.kind, .9); }
  }
  const stats = { hits: 0, short: null, last: null, on: {} };
  function reset() { view.clear(); sim.reset(); stats.hits = 0; stats.last = null; stats.short = null; stats.on = {}; read.hidden = true; }
  const ammo = $('range-ammo');
  function hud(dt) {
    const me = sim.me, s = sim.stats;
    if (me.fired > lastFired) sfx.shot(1, me.weapon); lastFired = me.fired;
    if ((me.melee?.swings || 0) > lastSwings) sfx.swing(me.weapon); lastSwings = me.melee?.swings || 0;
    if (me.reload > 0 && !lastReload) sfx.reload(me.weapon, s.reload); if (!me.reload && lastReload > 0) sfx.reloaded(); lastReload = me.reload;
    ammo.querySelector('b').textContent = s.melee ? '' : String(me.ammo);
    ammo.querySelector('span').textContent = s.melee ? '' : s.reserve != null ? `/ ${me.reserve}` : `/ ${s.magazine}`;
    ammo.classList.toggle('melee', !!s.melee); ammo.classList.toggle('reloading', me.reload > 0); ammo.classList.toggle('nade', !!me.grenadeReady);
    ammo.style.setProperty('--reload', String(me.reload > 0 ? 1 - me.reload / s.reload : 0));
    hitFlash = Math.max(0, hitFlash - dt); root.classList.toggle('hit', hitFlash > 0);
    if (readFor > 0 && (readFor -= dt) <= 0) read.hidden = true;
    scopeView.set(view.scope.scoped ? view.scope.amount : 0); root.classList.toggle('scoped', view.scope.scoped);
  }
  function update(dt) {
    if (closed) return;
    pollPad(); grenade.update();
    report(sim.advance(dt, input));
    view.update(dt, sim, aiming());
    hud(dt);
  }
  function close() {
    if (closed) return; closed = true;
    look.dispose(); pads.forEach(p => p.release()); grenade.cancel();
    removeEventListener('keydown', onKey, true); removeEventListener('keyup', onKey, true); dialog.removeEventListener('cancel', onCancel);
    scopeView.dispose(); view.dispose(); root.remove(); onExit();
  }
  return { update, close, get closed() { return closed; },
    // For browser suites (?debug): fire n shots at each listed target (indices into sim.targets).
    debug: { ready: true, sim, view, stats, debugShoot(list, n = 3) { script = { list: [...list], n, from: sim.me.fired }; }, aimAt(i) { const a = sim.aimAt(sim.targets[i]); view.face(Math.atan2(-a.ax, -a.az), a.pitch); }, get busy() { return !!script; } } };
}
