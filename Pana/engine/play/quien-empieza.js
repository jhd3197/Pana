// ¿Quién empieza? on screen: a cacho and a die in front of every seat of a
// game's own table, the shake → slam → lift → ties loop, a spotlight on the
// highest, barks and the "1º Juan · 2º Ana" strip. The rules live in
// quien-empieza-rules.js inside the game's snapshot; this module only draws
// that state and turns the local pana's hold-and-release into 'shake'/'slam'.
//
//   const starter = createStarterStage({ root: own, camera, canvas,
//     spot: seat => ({ position: [x, tableY, z], out: [dx, dz] }),   // where the cup rests; out points at the pana
//     scale: .5, onInput: (kind, power) => room.action('starter', { kind, power }) });
//   starter.update(state.starter, { ownSeat, names });   // on every snapshot (null hides it)
//   starter.frame(dt);                                     // every frame
import * as THREE from 'three';
import { createCacho, createCachoDie, createMoneda, DIE_FACE_UP } from '/engine/models/props/cacho.js';
import { bindDiceThrow } from '/engine/play/dice-throw.js';
import { createSeatBubbles } from '/engine/play/seat-bubbles.js';
import { starterBarks, SHAKE_LIMIT, FLIP } from '/engine/play/quien-empieza-rules.js';
import { sound, Puffs, Shockwaves } from '/engine/fx.js';

if (!document.querySelector('link[href*="/engine/play/quien-empieza.css"]')) {
  const link = document.createElement('link'); link.rel = 'stylesheet'; link.href = new URL('quien-empieza.css', import.meta.url).pathname;
  document.head.append(link);
}

// Seconds into the lift when the cups come up (a drum roll before it).
const REVEAL = 1.05, SLAM = .13, RAISE = .38;
const UP = new THREE.Vector3(0, 1, 0);
const ease = k => k < .5 ? 2 * k * k : 1 - (-2 * k + 2) ** 2 / 2;
const place = (n, cls, parent, text) => { const e = document.createElement(n); e.className = cls; if (text != null) e.textContent = text; parent?.append(e); return e; };

export function createStarterStage({ root, camera, canvas, spot, scale = .5, onInput, names: initialNames = [] }) {
  const group = new THREE.Group(); group.name = '¿Quién empieza?'; group.visible = false; root.add(group);
  const puffs = new Puffs(group), waves = new Shockwaves(group);
  const glow = new THREE.MeshBasicMaterial({ color: 0xffd65c, transparent: true, opacity: .28, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide });
  const beam = new THREE.Mesh(new THREE.CylinderGeometry(scale * .25, scale * .9, scale * 6, 24, 1, true), glow);
  const halo = new THREE.Mesh(new THREE.RingGeometry(scale * .45, scale * .62, 32), glow); halo.rotation.x = -Math.PI / 2;
  beam.visible = halo.visible = false; group.add(beam, halo);
  let coin = null;

  // DOM: the heading, a hold-to-shake button, the clock and the order strip.
  const layer = place('div', 'pk-qe', document.body); layer.hidden = true;
  const head = place('div', 'pk-qe-head', layer);
  const ribbon = place('span', 'pk-ribbon', head, '¿Quién empieza?'), say = place('p', 'pk-qe-say', head);
  const clock = place('div', 'pk-bar pk-qe-clock', head); place('i', '', clock);
  const button = place('button', 'pk-btn pk-btn--primary pk-btn--lg pk-qe-shake', layer); button.type = 'button'; button.id = 'pana-starter-shake';
  const label = place('span', '', button, 'Sacude el cacho'); place('kbd', 'pk-kbd', button, 'Espacio').dataset.panaHint = '';
  const hint = place('p', 'pk-qe-hint', layer, 'Mantén para sacudir · suelta para tapar'); hint.dataset.panaHint = '';
  const strip = place('ol', 'pk-qe-order', layer); strip.setAttribute('aria-label', 'Orden de salida');
  say.setAttribute('aria-live', 'polite');
  let bubbles = null, bubbleCount = 0;

  const seats = new Map();
  let state = null, ownSeat = -1, names = initialNames, phaseKey = '', lt = 0, revealed = false, slammedLocal = '', shakeTick = 0;
  const thrower = bindDiceThrow({ button, surface: canvas, holdSurface: true,
    canThrow: () => mayThrow(), onStart: () => { sound.unlock(); onInput?.('shake'); }, onThrow: power => { slammedLocal = `${state.round}`; onInput?.('slam', power); } });

  function mayThrow() {
    return !!state && state.phase === 'shake' && state.contenders.includes(ownSeat) && !(ownSeat in state.slammed) && slammedLocal !== `${state.round}`;
  }
  function seatOf(seat) {
    if (seats.has(seat)) return seats.get(seat);
    const s = spot(seat), cup = createCacho(), die = createCachoDie();
    cup.scale.setScalar(scale); die.scale.setScalar(scale); group.add(cup, die);
    const base = new THREE.Vector3(...s.position), out = new THREE.Vector3(s.out[0], 0, s.out[1]).normalize();
    const side = new THREE.Vector3().crossVectors(UP, out).normalize();
    // The number over a revealed die, so it reads from across the table and on a phone.
    const chip = place('b', 'pk-qe-value', layer); chip.hidden = true;
    const entry = { seat, cup, die, chip, base, out, side, pose: '', from: null, to: null, k: 1, dur: 1, squash: 0, value: 0, yaw: (seat * 2.39) % (Math.PI * 2) };
    seats.set(seat, entry); return entry;
  }
  // Where the cup sits for each pose: on the table, in the hand, slammed, lifted aside.
  function pose(e, kind) {
    const p = e.base.clone(), q = new THREE.Quaternion();
    if (kind === 'hand') p.addScaledVector(e.out, scale * .45).addScaledVector(UP, scale * 1.15);
    else if (kind === 'down') { p.addScaledVector(UP, scale); q.setFromAxisAngle(e.side, Math.PI); }
    else if (kind === 'aside') { p.addScaledVector(e.side, scale * .85).addScaledVector(e.out, scale * .2); q.setFromAxisAngle(e.out, .12); }
    return { p, q };
  }
  function go(e, kind, dur) {
    if (e.pose === kind) return;
    e.from = { p: e.cup.position.clone(), q: e.cup.quaternion.clone() };
    e.to = pose(e, kind); e.k = e.pose ? 0 : 1; e.dur = dur; e.prev = e.pose; e.pose = kind;
    if (e.k === 1) { e.cup.position.copy(e.to.p); e.cup.quaternion.copy(e.to.q); }
  }
  function showDie(e, value, real = true) {
    e.value = value; e.die.visible = true; e.chip.hidden = !real;
    if (real && e.chip.textContent !== String(value)) { e.chip.textContent = value; e.chip.classList.remove('pop'); void e.chip.offsetWidth; e.chip.classList.add('pop'); }
    e.die.position.copy(e.base).addScaledVector(UP, scale * .19);
    e.die.quaternion.setFromEuler(new THREE.Euler(...DIE_FACE_UP[value])).premultiply(new THREE.Quaternion().setFromAxisAngle(UP, e.yaw));
  }
  const name = seat => names[seat] ?? `Pana ${seat + 1}`;
  const list = seats => seats.length < 2 ? seats.map(name).join('') : `${seats.slice(0, -1).map(name).join(', ')} y ${name(seats.at(-1))}`;
  const top = s => { const r = s.history.at(-1)?.rolls || {}, v = Math.max(...Object.values(r)); return Object.keys(r).map(Number).filter(k => r[k] === v); };

  function spotlight(seat) {
    const e = seat === undefined ? null : seats.get(seat);
    beam.visible = halo.visible = !!e;
    if (!e) return;
    beam.position.copy(e.base).addScaledVector(UP, scale * 3); halo.position.copy(e.base).addScaledVector(UP, .01);
  }

  function update(next, { ownSeat: own = ownSeat, names: n = names } = {}) {
    ownSeat = own; names = n;
    const was = state; state = next && next.phase !== 'done' ? next : null;
    group.visible = !!state; layer.hidden = !state;
    document.body.classList.toggle('pana-starter', !!state);
    if (!state) { thrower.cancel(); spotlight(); return; }
    if (!bubbles || bubbleCount < Math.max(...state.seats, ...state.late) + 1) {
      bubbles?.dispose(); bubbleCount = Math.max(...state.seats, ...state.late) + 1; bubbles = createSeatBubbles(layer, bubbleCount);
    }
    const key = `${state.round}:${state.phase}`;
    if (key !== phaseKey) {
      lt = state.t || 0; revealed = false; phaseKey = key;
      if (state.phase === 'shake') spotlight();
      if (state.phase === 'shake' && was && state.round > 1) sound.tone(330, 0, .12, 'triangle', .08);
    }
    if (state.flavour === 'moneda') { updateCoin(); return; }
    for (const seat of state.seats) {
      const e = seatOf(seat), contender = state.contenders.includes(seat);
      if (state.phase === 'shake' && contender) {
        const slammed = seat in state.slammed || (seat === ownSeat && slammedLocal === `${state.round}`);
        const shaking = state.shaking.includes(seat) || (seat === ownSeat && thrower.shaking);
        go(e, slammed ? 'down' : shaking ? 'hand' : 'rest', slammed ? SLAM : .22);
        e.die.visible = !slammed && !shaking; e.chip.hidden = true;
        if (e.die.visible) showDie(e, e.value || 1 + seat % 6, false);
      } else if (state.phase === 'lift' && contender && !revealed) { go(e, 'down', SLAM); e.die.visible = false; e.chip.hidden = true; }
      else if (state.rolls[seat]) { go(e, 'aside', RAISE); showDie(e, state.rolls[seat]); }
      else { go(e, 'rest', .2); e.die.visible = false; e.chip.hidden = true; }
    }
    if (state.phase === 'order') spotlight(state.order[0]);
    texts();
  }

  function texts() {
    const s = state, mine = s.contenders.includes(ownSeat);
    let line = '';
    if (s.phase === 'shake') line = s.round === 1 ? '¡A sacudir!' : `¡Empate! Otra vez: ${list(s.contenders)}`;
    else if (s.phase === 'lift') line = s.flavour === 'moneda' ? `Cara: ${name(s.contenders[0])} · Sello: ${name(s.contenders[1])}` : revealed ? '¡Arriba!' : 'Redoble…';
    else if (s.phase === 'order') line = `¡Empieza ${name(s.order[0])}!`;
    if (say.textContent !== line) say.textContent = line;
    ribbon.textContent = s.flavour === 'moneda' ? '¿Cara o sello?' : '¿Quién empieza?';
    const canShake = s.phase === 'shake' && mine && mayThrow();
    button.hidden = hint.hidden = !canShake; clock.hidden = s.phase !== 'shake';
    if (!canShake) thrower.cancel();
    label.textContent = thrower.shaking ? '¡Suelta para tapar!' : 'Sacude el cacho';
    strip.hidden = s.phase !== 'order';
    if (s.phase === 'order' && strip.dataset.key !== phaseKey) {
      strip.dataset.key = phaseKey;
      strip.replaceChildren(...s.order.map((seat, i) => {
        const li = place('li', seat === ownSeat ? 'is-me' : ''), b = place('b', '', li, `${i + 1}º`);
        li.append(b, ` ${name(seat)}`); if (s.rolls[seat] && s.flavour !== 'moneda') place('small', '', li, `${s.rolls[seat]}`);
        return li;
      }));
    }
  }

  function reveal() {
    revealed = true;
    sound.boing();
    for (const seat of state.contenders) { const e = seatOf(seat); go(e, 'aside', RAISE); showDie(e, state.rolls[seat]); e.squash = 1; }
    const best = top(state);
    spotlight(best.length === 1 ? best[0] : undefined);
    if (best.length === 1) { const e = seats.get(best[0]); waves.sparkle(e.base, { color: 0xffd65c, count: 10, spread: scale * .6, life: .6 }); }
    for (const { seat, text } of starterBarks(state)) bubbles.say(seat, text, 1.9);
    texts();
  }

  // The coin: thrown up from the middle of the table, spinning, lands on its face.
  function updateCoin() {
    if (!coin) {
      coin = createMoneda(); coin.scale.setScalar(scale * 1.3); group.add(coin);
      coin.userData.centre = state.seats.map(seat => new THREE.Vector3(...spot(seat).position)).reduce((a, b) => a.add(b), new THREE.Vector3()).divideScalar(state.seats.length);
    }
    if (state.phase === 'order') spotlight(state.order[0]);
    texts();
  }
  function coinFrame() {
    const c = coin.userData.centre, air = FLIP - .5, k = Math.min(1, lt / air);
    coin.position.copy(c).addScaledVector(UP, scale * .05 + Math.sin(k * Math.PI) * scale * 4);
    const face = state.coin === 'sello' ? Math.PI : 0, turns = Math.PI * 2 * 7;
    coin.rotation.set(state.phase === 'lift' && k < 1 ? face + turns * (1 - (1 - k) ** 2) : face, 0, 0);
    if (state.phase === 'lift' && k >= 1 && !revealed) { revealed = true; sound.bonk(.8); puffs.spawn(c, { color: 0xf3e9d7, count: 5, spread: scale * .5, size: scale * .4, rise: .6, life: .5 }); say.textContent = state.coin === 'cara' ? `¡Cara! Empieza ${name(state.contenders[0])}` : `¡Sello! Empieza ${name(state.contenders[1])}`; spotlight(state.coin === 'cara' ? state.contenders[0] : state.contenders[1]); }
  }

  const v = new THREE.Vector3();
  function frame(dt) {
    if (!state) return;
    lt += dt;
    if (state.flavour === 'moneda') coinFrame();
    else if (state.phase === 'lift' && !revealed) {
      // The drum roll: the slammed cups twitch on the table.
      if ((shakeTick += 1) % 3 === 0) sound.tone(88 + Math.random() * 18, 0, .05, 'triangle', .06);
      if (lt >= REVEAL) reveal();
    }
    for (const e of seats.values()) {
      if (e.k < 1) {
        e.k = Math.min(1, e.k + dt / e.dur); const k = e.pose === 'down' ? e.k * e.k : ease(e.k);
        e.cup.position.lerpVectors(e.from.p, e.to.p, k); e.cup.quaternion.slerpQuaternions(e.from.q, e.to.q, k);
        if (e.pose === 'aside') e.cup.position.addScaledVector(UP, Math.sin(e.k * Math.PI) * scale * .9);
        if (e.k === 1 && e.pose === 'down') {
          // The slam: a thump, dust and a little ring on the table.
          e.squash = 1; sound.bonk(.9);
          puffs.spawn(e.base, { color: 0xe8dcc0, count: 5, spread: scale * .4, size: scale * .35, rise: .5, life: .5 });
          waves.ring(e.base, { color: 0xffffff, startRadius: scale * .3, maxRadius: scale * 1.1, life: .35, yOffset: .02, opacity: .6 });
        }
      } else if (e.to) { e.cup.position.copy(e.to.p); e.cup.quaternion.copy(e.to.q); }
      if (e.pose === 'hand') {
        // Rattling in the hand: the longer the local pana shakes, the wilder.
        const power = e.seat === ownSeat && thrower.shaking ? thrower.power : .55, j = scale * (.04 + power * .1), t = lt * (30 + power * 25) + e.seat;
        e.cup.position.x += Math.sin(t * 1.7) * j; e.cup.position.y += Math.abs(Math.sin(t * 1.3)) * j; e.cup.position.z += Math.cos(t * 1.9) * j;
        e.cup.rotation.z += Math.sin(t) * .25 * power;
        if (e.seat === ownSeat && (shakeTick += 1) % Math.max(2, Math.round(7 - power * 5)) === 0) sound.tone(300 + Math.random() * 220, 0, .025, 'square', .02 + power * .04);
      } else if (e.pose === 'down' && state.phase === 'lift' && !revealed && e.k === 1) e.cup.position.y += Math.abs(Math.sin(lt * 38 + e.seat * 2)) * scale * .03;
      e.squash = Math.max(0, e.squash - dt * 5);
      const s = Math.sin(e.squash * Math.PI) * .18; e.cup.scale.set(scale * (1 + s), scale * (1 - s), scale * (1 + s));
      if (e.die.visible && revealed && beam.visible && seats.get(top(state)[0]) === e && state.phase !== 'shake')
        e.die.position.y = e.base.y + scale * (.19 + Math.abs(Math.sin(lt * 5)) * .12);
    }
    if (beam.visible) glow.opacity = .22 + Math.sin(lt * 4) * .06;
    puffs.update(dt); waves.update(dt);
    bubbles?.tick(dt);
    if (bubbles) {
      const r = canvas.getBoundingClientRect();
      for (const e of seats.values()) {
        v.copy(e.base).addScaledVector(UP, scale * 1.4).project(camera);
        if (v.z < 1) bubbles.place(e.seat, r.left + (v.x + 1) * r.width / 2, r.top + (1 - v.y) * r.height / 2, 8);
        if (e.chip.hidden) continue;
        v.copy(e.die.position).addScaledVector(UP, scale * .32).project(camera);
        e.chip.style.left = `${r.left + (v.x + 1) * r.width / 2}px`; e.chip.style.top = `${r.top + (1 - v.y) * r.height / 2}px`;
      }
    }
    if (state.phase === 'shake') clock.firstChild.style.width = `${Math.max(0, 1 - (lt) / SHAKE_LIMIT) * 100}%`;
    if (state.phase === 'shake') label.textContent = thrower.shaking ? '¡Suelta para tapar!' : 'Sacude el cacho';
  }

  function dispose() {
    thrower.dispose(); bubbles?.dispose(); layer.remove(); puffs.clear(); waves.clear();
    document.body.classList.remove('pana-starter');
    group.traverse(o => { o.geometry?.dispose(); for (const m of [o.material].flat().filter(Boolean)) { m.map?.dispose(); m.dispose(); } });
    group.removeFromParent();
  }
  return { update, frame, dispose, group, thrower,
    get active() { return !!state; }, get revealed() { return revealed; } };
}
