// ¡Stop!'s plaza table on the shared stage (engine/worlds/table-world.js): eight
// panas on plastic chairs around a round table, each with a notebook and a
// pencil, the letter wheel in the middle and the reel's slang wall behind.
// Panas write (faster when someone yells ¡STOP!), slam the pencil when they
// stop the round, and react to the votes: arms crossed, laughing, pleading.
import * as THREE from 'three';
import { createTableWorld } from '/engine/worlds/table-world.js';
import { buildCharacter } from '/engine/models/characters/pana/avatar-model.js';
import { normalizeAvatar } from '/engine/avatar.js';
import { createSeatBubbles } from '/engine/play/seat-bubbles.js';
import { disposeModel } from '/engine/models/props/game-table.js';
import { createStopTable, createLetterWheel, createNotebook, createPencil, createPlasticChair, createSlangWall } from './studio-set.js';
import { SEATS, lettersFor } from './rules.js';
import { SEAT_COLORS, BOT_LOOKS } from './seats.js';

export { SEAT_COLORS };

const CHAIR_R = 3.35, NOTE_R = 2.45, TOP = 1.42, UP = new THREE.Vector3(0, 1, 0);
const HAND = new THREE.Vector3(0, -.95, .06);
const seatAngle = (seat) => (seat + .5) / SEATS * Math.PI * 2;
const ease = (t) => 1 - (1 - t) ** 3;

export function createStopScene(canvas) {
  const stage = createTableWorld(canvas, { fit: 'window', plazaScale: .9 });
  const { renderer, scene, camera } = stage, own = new THREE.Group(); scene.add(own);
  own.add(createStopTable());
  const wheel = createLetterWheel(); wheel.position.y = TOP; own.add(wheel);
  const wall = createSlangWall(); own.add(wall);
  const seats = Array.from({ length: SEATS }, (_, seat) => {
    const a = seatAngle(seat), out = new THREE.Vector3(Math.sin(a), 0, Math.cos(a)), forward = out.clone().negate();
    const right = new THREE.Vector3(Math.cos(a), 0, -Math.sin(a));
    const chair = createPlasticChair({ color: SEAT_COLORS[seat] }); chair.position.copy(out).multiplyScalar(CHAIR_R); chair.rotation.y = a + Math.PI; own.add(chair);
    const notebook = createNotebook({ cover: SEAT_COLORS[seat] }); notebook.position.copy(out).multiplyScalar(NOTE_R).setY(TOP); notebook.rotation.y = a; own.add(notebook);
    const pencil = createPencil(); own.add(pencil);
    const rest = notebook.position.clone().addScaledVector(right, .62).addScaledVector(out, .05).setY(TOP + .035);
    const restQuat = new THREE.Quaternion().setFromUnitVectors(UP, forward.clone().addScaledVector(right, .25).normalize());
    pencil.position.copy(rest); pencil.quaternion.copy(restQuat);
    return { seat, a, out, forward, right, chair, notebook, pencil, rest, restQuat, character: null, key: '', mood: 'idle', moodTime: 0, expression: '' };
  });
  const labels = document.getElementById('world-labels');
  const tags = seats.map(() => { const el = document.createElement('div'); el.className = 'world-label'; labels?.append(el); return el; });
  const bubbles = createSeatBubbles(labels || document.body, SEATS);
  const wide = new THREE.Box3(new THREE.Vector3(-4.4, 0, -4.4), new THREE.Vector3(4.4, 2.6, 4.4));
  const table = new THREE.Box3(new THREE.Vector3(-3.6, .9, -3.6), new THREE.Vector3(3.6, 2.7, 3.6));
  const close = new THREE.Box3(new THREE.Vector3(-1.45, TOP, -1.45), new THREE.Vector3(1.45, TOP + .5, 1.55));
  const view = new THREE.Box3().copy(wide), viewDir = new THREE.Vector3(0, 1.3, 1);
  const hand = new THREE.Vector3(), tip = new THREE.Vector3(), dir = new THREE.Vector3(), projected = new THREE.Vector3();
  let current = null, meId = null, time = 0, lastBark = 0, ownSeat = 0, measured = 0, safe = null;
  // The spin-down runs on wall time, so a slow frame rate never leaves the
  // wheel short of its letter.
  const spin = { angle: 0, from: 0, to: 0, t: -1, start: 0, letter: null, press: 0 };

  function syncCharacter(slot, p) {
    const look = normalizeAvatar(p.id === null ? BOT_LOOKS[slot.seat] : p.avatar), key = JSON.stringify(look);
    if (slot.key === key) return;
    slot.character?.dispose(); slot.character = buildCharacter(look, { seated: true }); slot.key = key; slot.expression = '';
    slot.character.group.position.copy(slot.chair.position).setY(.76); slot.character.group.rotation.y = slot.chair.rotation.y;
    own.add(slot.character.group);
  }

  // What each pana is doing, from the state: write, panic, slam, done, down,
  // plead, laugh, cross, happy, win, sad, ready (the spinner) or idle.
  function moodOf(state, p) {
    const phase = state.phase, r = state.review;
    if (phase === 'spin') return p.seat === state.spinner ? 'ready' : 'idle';
    if (phase === 'write') return 'write';
    if (phase === 'basta') return p.seat === state.stopper ? 'done' : 'panic';
    if (phase === 'collect') return 'down';
    if (phase === 'review' && r) {
      const item = r.items[p.seat], group = item?.group !== null ? r.groups[item.group] : null;
      if (r.stage === 'vote') {
        if (group) return 'plead';
        const votes = r.groups.map(g => g.votes[p.seat]).filter(v => v !== undefined);
        return votes.includes(false) ? 'cross' : votes.includes(true) ? 'laugh' : 'idle';
      }
      if (item?.creative) return 'win';
      if (group && group.accepted === false) return 'sad';
      return item?.points ? 'happy' : 'idle';
    }
    if (phase === 'finished') return p.seat === state.winner ? 'win' : 'happy';
    return 'idle';
  }

  function update(state, me = null) {
    const previous = current; current = state; meId = me;
    const seatNow = state.players.findIndex(p => p.id !== null && p.id === me);
    for (const p of state.players) {
      const slot = seats[p.seat]; syncCharacter(slot, p);
      const mood = moodOf(state, p);
      if (mood !== slot.mood) { slot.mood = mood; slot.moodTime = 0; }
      if (state.phase === 'basta' && previous?.phase === 'write' && p.seat === state.stopper) { slot.mood = 'slam'; slot.moodTime = 0; }
      const writing = ['write', 'basta', 'collect'].includes(state.phase);
      slot.notebook.userData.setProgress(writing || state.phase === 'review' ? p.filled : 0, state.categories.length, p.seat + state.round * 3);
    }
    if (seatNow >= 0) ownSeat = seatNow;
    wheel.userData.setEnabled(lettersFor(state.options));
    if (state.phase === 'spin') { spin.letter = null; spin.t = -1; }
    if (state.letter && state.letter !== spin.letter && state.phase !== 'spin') {
      spin.letter = state.letter; spin.from = spin.angle; spin.press = 1;
      const base = wheel.userData.angleFor(state.letter), turn = Math.PI * 2;
      spin.to = base + Math.ceil((spin.angle - base) / turn) * turn + turn * (state.phase === 'letter' ? 3 : 0);
      spin.t = state.phase === 'letter' ? 0 : 1; spin.start = performance.now();
    }
    wheel.userData.setHub(state.phase === 'spin' || !state.letter || state.phase === 'lobby' ? '¡PARA!' : state.letter, state.phase === 'spin' || !state.letter || state.phase === 'lobby' ? 'para' : 'letter');
    for (const b of state.barks || []) if (b.id > lastBark) { lastBark = b.id; if (previous) bubbles.say(b.seat, b.text, 2.4); }
  }

  function poseArms(slot, dt) {
    const c = slot.character, [left, right] = c.arms, t = time + slot.seat * .7, m = slot.mood, k = slot.moodTime;
    const set = (arm, x, y, z) => { arm.rotation.x = THREE.MathUtils.lerp(arm.rotation.x, x, 1 - Math.exp(-dt * 14)); arm.rotation.y = y; arm.rotation.z = THREE.MathUtils.lerp(arm.rotation.z, z, 1 - Math.exp(-dt * 14)); };
    let lean = 0, bounce = 0;
    if (m === 'write' || m === 'panic') {
      const fast = m === 'panic' ? 26 : 9, amp = m === 'panic' ? .12 : .05;
      set(right, -1.38 + Math.sin(t * fast) * amp, 0, -.05 + Math.cos(t * fast * .7) * amp); set(left, -1.25, 0, .02); lean = m === 'panic' ? .5 : .38;
    } else if (m === 'slam') {
      if (k < .32) set(right, -2.8, 0, -.2); else set(right, -1.3, 0, -.05);
      set(left, -.4, 0, .3); lean = .1;
    } else if (m === 'done') { set(right, -.6, 0, -.7); set(left, -.6, 0, .7); lean = -.15; }
    else if (m === 'ready') { set(right, -1.9 + Math.sin(t * 6) * .1, 0, -.1); set(left, -.3, 0, .25); lean = .2; }
    else if (m === 'plead') { set(right, -1.7, 0, -.55 + Math.sin(t * 5) * .1); set(left, -1.7, 0, .55 - Math.sin(t * 5) * .1); }
    else if (m === 'cross') { set(right, -1.35, 0, .95); set(left, -1.35, 0, -.95); lean = -.12; }
    else if (m === 'laugh') { set(right, -.7, 0, .45); set(left, -.7, 0, -.45); lean = -.35 + Math.sin(t * 16) * .06; bounce = Math.abs(Math.sin(t * 16)) * .04; }
    else if (m === 'win') { set(right, -2.7 + Math.sin(t * 9) * .2, 0, -.3); set(left, -2.7 - Math.sin(t * 9) * .2, 0, .3); bounce = Math.abs(Math.sin(t * 9)) * .06; }
    else if (m === 'happy') { set(right, -1.0, 0, -.3); set(left, -1.0, 0, .3); bounce = Math.abs(Math.sin(t * 7)) * .02; }
    else if (m === 'sad') { set(right, -.2, 0, -.1); set(left, -.2, 0, .1); lean = .45; }
    else { set(right, -1.15, 0, -.08); set(left, -1.15, 0, .08); }
    c.neck.rotation.x = THREE.MathUtils.lerp(c.neck.rotation.x, lean, 1 - Math.exp(-dt * 8));
    c.neck.rotation.y = m === 'idle' ? Math.sin(time * .5 + slot.seat * 2) * .25 : 0;
    c.group.position.y = .76 + bounce;
    const expression = ['laugh', 'win'].includes(m) ? 'laugh' : ['happy', 'plead'].includes(m) ? 'smile' : m === 'panic' ? 'talk' : 'natural';
    if (expression !== slot.expression) { slot.expression = expression; c.setExpression?.(expression); }
  }

  // The pencil follows the right hand while writing, flies up on a slam and
  // otherwise lies next to the notebook.
  function placePencil(slot) {
    const c = slot.character, m = slot.mood, pencil = slot.pencil;
    c.arms[1].updateWorldMatrix(true, false); hand.copy(HAND); c.arms[1].localToWorld(hand);
    if (m === 'write' || m === 'panic' || (m === 'slam' && slot.moodTime < .32)) {
      const fast = m === 'panic' ? 24 : 8, t = time * fast + slot.seat;
      if (m === 'slam') tip.copy(hand).y -= .12;
      else tip.copy(slot.notebook.position).addScaledVector(slot.right, .2 + Math.sin(t) * .06).addScaledVector(slot.out, -.06 + Math.cos(t * .5) * .1).setY(TOP + .06 + Math.max(0, Math.sin(t * 2)) * .015);
      dir.copy(hand).y += .2; dir.sub(tip).normalize();
      pencil.position.copy(tip); pencil.quaternion.setFromUnitVectors(UP, dir);
    } else if (m === 'slam') {
      const k = Math.min(1, (slot.moodTime - .32) / .18);
      pencil.position.lerpVectors(tip.copy(hand), slot.rest, k); pencil.position.y = THREE.MathUtils.lerp(hand.y, TOP + .035, k) + (k >= 1 ? Math.abs(Math.sin((slot.moodTime - .5) * 18)) * .05 * Math.exp(-(slot.moodTime - .5) * 6) : 0);
      pencil.quaternion.slerp(slot.restQuat, k);
    } else { pencil.position.lerp(slot.rest, .2); pencil.quaternion.slerp(slot.restQuat, .2); }
  }

  function measureSafe(w, h) {
    const panel = [...document.querySelectorAll('#hud [data-scene-avoid]')].find(el => !el.closest('[hidden]') && el.getClientRects().length);
    const top = 70, margin = Math.min(20, w * .03);
    safe = { x: margin, y: top, width: Math.max(160, w - margin * 2), height: Math.max(140, h - top - 40) };
    if (!panel) return;
    const r = panel.getBoundingClientRect();
    if (r.left > w * .4 && r.height > h * .45) safe.width = Math.max(160, r.left - margin * 2);
    // The review may cover the near chairs: the faces across the table matter.
    else safe.height = Math.max(120, Math.min(h - top - 40, r.top - top - 8 + (panel.id === 'review' ? r.height * .35 : 0)));
  }

  function frame(dt) {
    time += dt; bubbles.tick(dt);
    const { w, h } = stage.resize();
    if ((measured -= dt) <= 0 || !safe) { measured = .4; measureSafe(w, h); }
    const phase = current?.phase || 'lobby', zoom = phase === 'spin' || phase === 'letter', faces = ['review', 'tally', 'finished'].includes(phase);
    const a = seatAngle(ownSeat), blend = 1 - Math.exp(-dt * 3);
    const box = zoom ? close : faces ? table : wide;
    view.min.lerp(box.min, blend); view.max.lerp(box.max, blend);
    viewDir.lerp(dir.set(Math.sin(a), zoom ? 2.1 : faces ? .8 : 1.25, Math.cos(a)), blend);
    stage.frameCamera(view, viewDir.toArray(), safe);
    wheel.rotation.y = a;
    wall.position.set(-Math.sin(a) * 9.5, 0, -Math.cos(a) * 9.5); wall.rotation.y = a;
    // The wheel: idles in the lobby, races while the turn pana waits, then
    // slows onto the letter.
    if (spin.t >= 0 && spin.t < 1) { spin.t = Math.min(1, (performance.now() - spin.start) / 2300); spin.angle = spin.from + (spin.to - spin.from) * ease(spin.t); }
    else if (phase === 'spin') spin.angle += dt * 7;
    else if (phase === 'lobby' || phase === 'finished') spin.angle += dt * .25;
    else if (spin.letter) spin.angle = spin.to;
    wheel.userData.setAngle(spin.angle); wheel.userData.tick(time, dt);
    spin.press = Math.max(0, spin.press - dt * 3); wheel.userData.press(Math.sin(spin.press * Math.PI));
    for (const slot of seats) {
      const c = slot.character; if (!c) continue;
      slot.moodTime += dt; c.update(dt, {}); poseArms(slot, dt); placePencil(slot);
      const p = current?.players[slot.seat], el = tags[slot.seat];
      projected.copy(c.group.position); projected.y += 2.1; projected.project(camera);
      const x = (projected.x * .5 + .5) * innerWidth, y = (-projected.y * .5 + .5) * innerHeight;
      if (el && p) {
        el.textContent = tagText(current, p); el.classList.toggle('is-me', p.id !== null && p.id === meId);
        const half = el.offsetWidth / 2; el.style.left = `${THREE.MathUtils.clamp(x, half + 6, innerWidth - half - 6)}px`; el.style.top = `${y}px`;
        el.hidden = projected.z > 1;
      }
      bubbles.place(slot.seat, x, y);
    }
    stage.draw(dt);
  }

  function dispose() {
    seats.forEach(slot => slot.character?.dispose()); tags.forEach(t => t.remove()); bubbles.dispose();
    disposeModel(own); stage.dispose();
  }
  return { renderer, scene, camera, update, frame, dispose, say: bubbles.say, wheel, seats };
}

// The name chip over each pana: progress while writing, points in the review.
function tagText(state, p) {
  const n = state.categories.length;
  if (['write', 'basta'].includes(state.phase)) return `${p.name} · ${p.filled}/${n}`;
  if (state.phase === 'review' && state.review?.items) { const item = state.review.items[p.seat]; return item?.points ? `${p.name} · +${item.points}` : p.name; }
  if (['tally', 'finished'].includes(state.phase)) return `${p.name} · ${p.total}`;
  return p.name;
}
