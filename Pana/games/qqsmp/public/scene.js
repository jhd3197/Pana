// The TV studio in the plaza at night: a round stage, a podium per pana that
// rises with their ladder, the host at his desk, the big screen with the
// question, and spotlights that sweep during "¿Esa es su respuesta final?".
import * as THREE from 'three';
import { createTableWorld } from '/engine/worlds/table-world.js';
import { buildCharacter } from '/engine/models/characters/pana/avatar-model.js';
import { normalizeAvatar } from '/engine/avatar.js';
import { createSeatBubbles } from '/engine/play/seat-bubbles.js';
import { makeMango } from '/engine/models/props/mango.js';
import { disposeModel } from '/engine/models/props/game-table.js';
import { createQuizStage, createQuizPodium, createHostDesk, createQuizScreen, createStageSpotlight, GOLD, NIGHT } from './studio-set.js';
import { SEATS, LETTERS, TOP, score, mangos, resolveAnswer, ranking, participants } from './rules.js';

export const SEAT_COLORS = ['#ff4b4b', '#2ad1b2', '#ffc629', '#3d7bf2', '#ff8a1f', '#8e4de8'];
const BOT_LOOKS = [
  { hat: 'gorra', hatColor: '#ff4b4b', outfitColor: '#ff4b4b', face: 'feliz' },
  { hat: 'pesca', hatColor: '#2ad1b2', outfitColor: '#2ad1b2', glasses: 'redondos' },
  { hat: 'llanero', outfitColor: '#ffc629', face: 'cool' },
  { hat: 'band', hatColor: '#3d7bf2', outfitColor: '#3d7bf2', face: 'wow' },
  { hat: 'gorra-atras', hatColor: '#ff8a1f', outfitColor: '#ff8a1f', outfit: 'deportivo', face: 'lengua' },
  { hat: 'lana', hatColor: '#8e4de8', outfitColor: '#8e4de8', outfit: 'hoodie', face: 'ojazos' },
];
const HOST_LOOK = { outfit: 'hoodie', outfitColor: '#d9a21b', glasses: 'sol', extra: 'cadena', face: 'wow', hat: 'none' };
const HOST = SEATS;
const podiumHeight = (step) => .45 + step * .13;

function wrap(ctx, text, maxWidth) {
  const lines = []; let line = '';
  for (const word of text.split(' ')) {
    const next = line ? `${line} ${word}` : word;
    if (ctx.measureText(next).width > maxWidth && line) { lines.push(line); line = word; } else line = next;
  }
  return [...lines, line];
}
function box(ctx, x, y, w, h, r, fill, stroke) {
  ctx.beginPath(); ctx.roundRect(x, y, w, h, r); ctx.fillStyle = fill; ctx.fill();
  if (stroke) { ctx.lineWidth = 5; ctx.strokeStyle = stroke; ctx.stroke(); }
}

// Paints the big screen for the current state.
function paintScreen(ctx, w, h, s) {
  const bg = ctx.createLinearGradient(0, 0, 0, h); bg.addColorStop(0, '#2a1a6e'); bg.addColorStop(1, '#0d0a2a');
  ctx.fillStyle = bg; ctx.fillRect(0, 0, w, h);
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  const title = (text, y, size, color = '#fff') => { ctx.font = `900 ${size}px "Luckiest Guy", system-ui, sans-serif`; ctx.fillStyle = color; ctx.fillText(text, w / 2, y); };
  if (s.phase === 'lobby' || !s.question) {
    title('¿Quién quiere', h * .36, 120, GOLD); title('ser mi pana?', h * .54, 120, GOLD);
    title('Esperando al anfitrión…', h * .78, 44, '#c9c2ff'); return;
  }
  if (s.phase === 'finished') {
    const order = ranking(s);
    title('¡MANGO DE ORO!', h * .2, 96, GOLD); title(order[0].name, h * .38, 110);
    order.slice(0, 4).forEach((p, i) => title(`${i + 1}. ${p.name} · ${mangos(score(p))} mangos`, h * (.56 + i * .1), 46, i ? '#c9c2ff' : '#fff'));
    return;
  }
  box(ctx, 40, 30, w - 80, 70, 35, '#120c38', GOLD);
  ctx.font = '700 40px system-ui, sans-serif'; ctx.fillStyle = GOLD;
  ctx.fillText(s.final ? `PREGUNTA FINAL · ${s.question.category}` : `${s.question.category} · Pregunta ${s.index + 1} de ${s.total}`, w / 2, 66);
  if (s.phase === 'bet') {
    title('¿Cuántos mangos', h * .36, 100); title('te juegas?', h * .52, 100);
    title(`${participants(s).filter(p => p.betLocked).length} de ${participants(s).length} ya apostaron`, h * .74, 48, '#c9c2ff');
    return;
  }
  ctx.font = '800 58px system-ui, sans-serif';
  const lines = wrap(ctx, s.question.text, w - 160).slice(0, 3);
  lines.forEach((line, i) => { ctx.fillStyle = '#fff'; ctx.fillText(line, w / 2, 170 + i * 66 + (3 - lines.length) * 33); });
  const reveal = s.phase === 'reveal' ? s.reveal : null, done = reveal?.done;
  const shown = reveal ? reveal.order.slice(0, reveal.shown) : [];
  const bw = (w - 120) / 2, bh = 112;
  s.question.answers.forEach((answer, i) => {
    const x = 40 + (i % 2) * (bw + 40), y = 380 + Math.floor(i / 2) * (bh + 30), right = done && i === s.question.correct;
    box(ctx, x, y, bw, bh, 56, right ? '#1f9d55' : done ? '#1a1440' : '#21185a', right ? '#7dffb0' : GOLD);
    ctx.globalAlpha = done && !right ? .45 : 1;
    ctx.font = '900 44px system-ui, sans-serif'; ctx.fillStyle = right ? '#fff' : GOLD; ctx.textAlign = 'left'; ctx.fillText(`${LETTERS[i]}:`, x + 44, y + bh / 2 - (shown.length ? 14 : 0));
    ctx.font = '700 40px system-ui, sans-serif'; ctx.fillStyle = '#fff';
    let text = answer; while (ctx.measureText(text).width > bw - 150 && text.length > 4) text = `${text.slice(0, -2)}…`;
    ctx.fillText(text, x + 112, y + bh / 2 - (shown.length ? 14 : 0));
    const who = shown.filter(seat => resolveAnswer(s.players, seat) === i).map(seat => s.players[seat].name);
    if (who.length) { ctx.font = '600 28px system-ui, sans-serif'; ctx.fillStyle = '#ffe7a1'; ctx.fillText(who.join(' · '), x + 112, y + bh / 2 + 30); }
    ctx.globalAlpha = 1; ctx.textAlign = 'center';
  });
  if (s.phase === 'question') {
    const left = s.timeLeft / s.options.seconds;
    box(ctx, 40, h - 34, w - 80, 16, 8, '#120c38');
    box(ctx, 40, h - 34, Math.max(16, (w - 80) * left), 16, 8, left < .3 ? '#ff4040' : GOLD);
  }
}

// Paints one podium's plate: name, what they did, and their mangos.
function paintPlate(ctx, w, h, s, p, color) {
  ctx.fillStyle = NIGHT; ctx.fillRect(0, 0, w, h);
  ctx.fillStyle = color; ctx.fillRect(0, h - 16, w, 16);
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.font = '800 34px system-ui, sans-serif'; ctx.fillStyle = '#fff'; ctx.fillText(p.name.slice(0, 14), w / 2, 30);
  const r = s.reveal, idx = r ? r.order.indexOf(p.seat) : -1, revealed = s.phase === 'reveal' && idx >= 0 && idx < r.shown;
  let big = '', tone = '#fff', note = '';
  if (revealed) {
    const got = resolveAnswer(s.players, p.seat);
    big = got === null ? '—' : LETTERS[got]; note = p.copy !== null ? `copió a ${s.players[p.copy].name}` : '';
    if (r.done) tone = p.outcome?.right ? '#5dff9e' : '#ff6b6b';
  } else if (s.phase === 'question' || s.phase === 'pause') {
    big = p.locked ? 'LISTO' : '…'; tone = p.locked ? '#ffc629' : '#8c86c9';
  } else if (s.phase === 'bet') {
    big = p.betLocked ? 'APOSTÓ' : '…'; tone = p.betLocked ? '#ffc629' : '#8c86c9';
  } else big = p.step >= TOP ? 'ORO' : `${p.step}/${TOP}`;
  ctx.font = `900 ${big.length > 2 ? 58 : 92}px system-ui, sans-serif`; ctx.fillStyle = tone; ctx.fillText(big, w / 2, h / 2 + 4);
  ctx.font = '600 24px system-ui, sans-serif'; ctx.fillStyle = '#ffe7a1';
  ctx.fillText(note || `${mangos(score(p))} mangos${p.planted ? ' · plantado' : ''}`, w / 2, h - 40);
}

export function createQqsmpScene(canvas) {
  const stage = createTableWorld(canvas, { fit: 'window', exposure: .95, background: '#0b0820', fog: [34, 90], sky: false, fov: 40, plazaScale: .9,
    hemi: ['#7a78e0', '#1a1030', 1.1], sun: { color: '#a9b8ff', intensity: .9, position: [-10, 20, 14], box: 14, far: 60, bias: -.0002 } });
  const { renderer, scene, camera } = stage, own = new THREE.Group(); scene.add(own);
  const hemi = scene.children.find(o => o.isHemisphereLight), hemiBase = hemi?.intensity ?? 1;
  const set = createQuizStage(); set.position.set(0, 0, -.5); own.add(set);
  const screen = createQuizScreen({ width: 9.6, y: 5.1 }); screen.position.set(0, .3, -5.2); own.add(screen);
  const fill = new THREE.PointLight('#ffd9a0', 30, 18, 1.6); fill.position.set(0, 6, 5); own.add(fill);
  const podiums = Array.from({ length: SEATS }, (_, seat) => {
    const podium = createQuizPodium({ color: SEAT_COLORS[seat] }), x = (seat - (SEATS - 1) / 2) * 2.45;
    podium.position.set(x, .3, -.6 - Math.abs(x) * .14); podium.rotation.y = -x * .035; own.add(podium);
    return { podium, character: null, key: '', plate: '', height: podiumHeight(0), mood: 'idle' };
  });
  const desk = createHostDesk(); desk.position.set(-7, .3, 1.9); desk.rotation.y = .85; own.add(desk);
  const host = buildCharacter(normalizeAvatar(HOST_LOOK));
  host.group.position.set(-7.5, .3, 1.45); host.group.rotation.y = .85; own.add(host.group);
  host.group.traverse(o => { if (o.material?.color?.getHexString?.() === 'd9a21b') { o.material = o.material.clone(); o.material.metalness = .75; o.material.roughness = .22; } });
  const spots = [[-9.8, -3.6], [9.8, -3.6], [-10.4, 4.6], [10.4, 4.6]].map(([x, z], i) => {
    const spot = createStageSpotlight({ color: i % 2 ? '#fff1c9' : '#d8e4ff', light: i < 2 }); spot.position.set(x, 0, z); own.add(spot); return spot;
  });
  const goldMango = makeMango({ gold: true }); goldMango.scale.setScalar(.32); goldMango.position.set(0, 8.55, -5.2); own.add(goldMango);
  const labels = document.getElementById('world-labels');
  const tags = podiums.map(() => { const el = document.createElement('div'); el.className = 'world-label'; labels.append(el); return el; });
  const bubbles = createSeatBubbles(labels, SEATS + 1);
  const bounds = new THREE.Box3(new THREE.Vector3(-8.6, .3, -5.3), new THREE.Vector3(8.6, 8.4, 2.6));
  const projected = new THREE.Vector3(), aim = new THREE.Vector3();
  let current = null, time = 0, screenKey = '', bottom = 220, measured = 0, pointing = -1, hostTalk = 0;

  function syncCharacter(seat, p) {
    const look = normalizeAvatar(p.id === null ? BOT_LOOKS[seat] : p.avatar), key = JSON.stringify(look), slot = podiums[seat];
    if (slot.key === key) return;
    slot.character?.dispose(); slot.character = buildCharacter(look); slot.key = key; own.add(slot.character.group);
  }

  function update(state) {
    const previous = current; current = state;
    const active = participants(state);
    for (const p of state.players) {
      const visible = active.includes(p), slot = podiums[p.seat];
      slot.podium.visible = visible; tags[p.seat].hidden = !visible;
      if (slot.character) slot.character.group.visible = visible;
      if (!visible) { bubbles.hide(p.seat); continue; }
      const x = (active.indexOf(p) - (active.length - 1) / 2) * 2.45;
      slot.podium.position.set(x, .3, -.6 - Math.abs(x) * .14); slot.podium.rotation.y = -x * .035;
      syncCharacter(p.seat, p);
      slot.character.group.visible = true;
      const plate = JSON.stringify([state.phase, p.name, p.step, p.bonus, p.finalDelta, p.locked, p.betLocked, p.planted, state.reveal, p.copy, p.answer, p.outcome?.right]);
      if (plate !== slot.plate) { slot.plate = plate; slot.podium.userData.paint((ctx, w, h) => paintPlate(ctx, w, h, state, p, SEAT_COLORS[p.seat])); }
      const r = state.reveal, idx = r ? r.order.indexOf(p.seat) : -1;
      slot.podium.userData.setLight(state.gold === p.seat ? 'gold'
        : state.phase === 'reveal' && r.done ? (p.outcome?.right ? 'right' : 'wrong')
        : state.phase === 'reveal' && idx < r.shown ? 'locked'
        : state.phase === 'question' && p.locked || state.phase === 'bet' && p.betLocked ? 'locked' : 'off');
      slot.mood = state.phase === 'finished' ? (state.winner === p.seat ? 'win' : 'idle')
        : state.phase === 'reveal' && r.done ? (p.outcome?.right ? 'win' : 'lose') : state.phase === 'pause' ? 'tense' : 'idle';
    }
    const key = JSON.stringify([state.phase, state.index, Math.ceil(state.timeLeft), state.reveal, state.question?.text, state.players.map(p => [p.name, p.betLocked, score(p)])]);
    if (key !== screenKey) { screenKey = key; screen.userData.paint((ctx, w, h) => paintScreen(ctx, w, h, state)); }
    pointing = state.phase === 'reveal' && !state.reveal.done ? state.reveal.order[state.reveal.shown - 1] ?? -1 : state.phase === 'finished' ? state.winner : -1;
    if (state.hostLine && state.hostLine !== previous?.hostLine && state.phase !== 'lobby') { bubbles.say(HOST, state.hostLine, Math.min(4, 1.6 + state.hostLine.length * .035)); hostTalk = 1.2; }
    goldMango.visible = state.gold === null || state.phase === 'lobby';
  }

  function placeTag(el, position, seat) {
    projected.copy(position).project(camera);
    const x = (projected.x * .5 + .5) * innerWidth, y = (-projected.y * .5 + .5) * innerHeight;
    if (el) { const half = el.offsetWidth / 2; el.style.left = `${THREE.MathUtils.clamp(x, half + 8, innerWidth - half - 8)}px`; el.style.top = `${y}px`; }
    bubbles.place(seat, x, y);
  }

  function frame(dt) {
    time += dt; bubbles.tick(dt); hostTalk = Math.max(0, hostTalk - dt);
    // Keep the stage clear of the question panel (the HUD's children are fixed,
    // so the panel itself is measured).
    if ((measured -= dt) <= 0) { measured = .5; const panel = document.querySelector('#hud:not([hidden]) .quiz-panel'); bottom = panel ? Math.min(innerHeight * .55, innerHeight - panel.getBoundingClientRect().top + 8) : 40; }
    const { w, h } = stage.resize(), margin = Math.min(24, w * .03), top = 64;
    stage.frameCamera(bounds, [0, .34, 1], { x: margin, y: top, width: Math.max(160, w - margin * 2), height: Math.max(140, h - top - bottom) });
    const phase = current?.phase, tense = phase === 'pause';
    if (hemi) hemi.intensity = THREE.MathUtils.lerp(hemi.intensity, hemiBase * (tense ? .35 : 1), 1 - Math.exp(-dt * 3));
    fill.intensity = THREE.MathUtils.lerp(fill.intensity, tense ? 6 : 30, 1 - Math.exp(-dt * 3));
    spots.forEach((spot, i) => {
      if (tense) aim.set(Math.sin(time * 1.6 + i * 1.7) * 7, .3, Math.cos(time * 1.1 + i) * 3 - .5);
      else if (pointing >= 0) aim.copy(podiums[pointing].podium.position).setY(podiums[pointing].height + 1.2);
      else aim.set(i % 2 ? 3 : -3, .3, i < 2 ? .5 : -1.5);
      spot.userData.aim(aim.x, aim.y, aim.z); spot.userData.setPower(phase === 'lobby' ? .5 : 1);
    });
    goldMango.rotation.y += dt * .8; goldMango.position.y = 8.55 + Math.sin(time * 2) * .08;
    podiums.forEach((slot, seat) => {
      if (!slot.podium.visible) return;
      const p = current?.players[seat], target = podiumHeight(p ? (current.phase === 'reveal' && !current.reveal.done ? p.outcome?.from ?? p.step : p.step) : 0);
      slot.height = THREE.MathUtils.lerp(slot.height, target, 1 - Math.exp(-dt * 2.5)); slot.podium.userData.setHeight(slot.height);
      const c = slot.character; if (!c) return;
      c.group.position.copy(slot.podium.position); c.group.position.y += slot.height + .08; c.group.rotation.y = slot.podium.rotation.y;
      c.update(dt, {});
      const wave = Math.sin(time * 8 + seat), [left, right] = c.arms;
      if (slot.mood === 'win') { left.rotation.set(-2.6 + wave * .2, 0, .4); right.rotation.set(-2.6 - wave * .2, 0, -.4); }
      else if (slot.mood === 'lose') { left.rotation.set(-2.2, 0, -.9); right.rotation.set(-.1, 0, -.15); }
      else if (slot.mood === 'tense') { left.rotation.set(-1.1, 0, -.5); right.rotation.set(-1.1, 0, .5); }
      else { left.rotation.set(-.15, 0, .14); right.rotation.set(-.15, 0, -.14); }
      c.neck.rotation.y = Math.sin(time * .5 + seat * 2) * .15; c.neck.rotation.x = slot.mood === 'lose' ? .3 : 0;
      const head = c.group.position.clone(); head.y += 2.25; placeTag(tags[seat], head, seat);
      if (p) tags[seat].textContent = `${p.name}${p.seat === current.gold ? ' · Mango de oro' : ''}`;
    });
    host.update(dt, {});
    const [hl, hr] = host.arms, talk = hostTalk > 0 ? Math.sin(time * 9) * .25 : 0;
    hr.rotation.set(pointing >= 0 ? -1.6 : -.5 + talk, 0, pointing >= 0 ? -.3 : -.2); hl.rotation.set(-.6 - talk, 0, .25);
    host.neck.rotation.y = pointing >= 0 ? THREE.MathUtils.clamp(Math.atan2(podiums[pointing].podium.position.x - host.group.position.x, podiums[pointing].podium.position.z - host.group.position.z) - host.group.rotation.y, -.8, .8) : Math.sin(time * .7) * .2;
    const hostHead = host.group.position.clone(); hostHead.y += 2.3; placeTag(null, hostHead, HOST);
    stage.draw(dt);
  }

  function dispose() {
    podiums.forEach(slot => slot.character?.dispose()); host.dispose(); tags.forEach(t => t.remove()); bubbles.dispose();
    disposeModel(goldMango); disposeModel(own); stage.dispose();
  }
  return { renderer, scene, camera, update, frame, dispose, say: bubbles.say, podiums };
}
