// The camp's chores as small panels over the world. Each one is
// `(body, done, step) → dispose`: it builds inside `body`, calls done() once
// solved and cleans up when disposed. Pointer events work for mouse and touch;
// Space and Enter cover the hold-and-press tasks on a keyboard.

import { sound } from '/engine/fx.js';

const el = (tag, props = {}, ...children) => { const n = Object.assign(document.createElement(tag), props); n.append(...children); return n; };
function canvas(body, w, h) { const c = el('canvas', { width: w, height: h }); body.append(c); return [c, c.getContext('2d')]; }
// Pointer position in canvas pixels.
const at = (c, e) => { const r = c.getBoundingClientRect(); return { x: (e.clientX - r.left) * c.width / r.width, y: (e.clientY - r.top) * c.height / r.height }; };
const COL = { night: '#0e0b24', deep: '#16123a', line: '#3a3270', text: '#f3ead7', muted: '#a49cc8', ember: '#ffb36b', yellow: '#ffc629', teal: '#2ad1b2', coral: '#ff4b4b', wood: '#7a5536', water: '#3fb4b8', gold: '#e6b65d', sand: '#c9a86b' };

// A hold control: pointer on the button, or Space/Enter anywhere.
function holder(button, onChange) {
  let down = false;
  const set = v => { if (down !== v) { down = v; button.classList.toggle('is-held', v); v ? sound.clickDown() : sound.clickUp(); onChange(v); } };
  button.addEventListener('pointerdown', e => { e.preventDefault(); button.setPointerCapture?.(e.pointerId); set(true); });
  for (const t of ['pointerup', 'pointercancel', 'lostpointercapture']) button.addEventListener(t, () => set(false));
  const key = v => e => { if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); if (!e.repeat) set(v); } };
  const kd = key(true), ku = key(false);
  addEventListener('keydown', kd); addEventListener('keyup', ku);
  return () => { removeEventListener('keydown', kd); removeEventListener('keyup', ku); };
}
function press(button, fn) {
  button.addEventListener('pointerdown', e => { e.preventDefault(); sound.clickDown(); fn(); });
  const k = e => { if ((e.key === ' ' || e.key === 'Enter') && !e.repeat) { e.preventDefault(); sound.clickDown(); fn(); } };
  addEventListener('keydown', k); return () => removeEventListener('keydown', k);
}
function loop(fn) {
  let last = performance.now(), id = 0, alive = true;
  const frame = now => { if (!alive) return; const dt = Math.min(0.05, (now - last) / 1000); last = now; fn(dt, now / 1000); id = requestAnimationFrame(frame); };
  id = requestAnimationFrame(frame);
  return () => { alive = false; cancelAnimationFrame(id); };
}

// ---- Girar el malacate: hold to crank three full turns ----
function malacate(body, done) {
  const [c, x] = canvas(body, 360, 240), btn = el('button', { className: 'pk-btn pk-btn--primary task-big', textContent: 'Mantén para girar' });
  body.append(el('div', { className: 'task-row' }, btn));
  let held = false, turn = 0, finished = false;
  const unhold = holder(btn, v => { held = v; });
  const stop = loop(dt => {
    if (held && !finished) turn += dt / 1.1;
    if (turn >= 3 && !finished) { finished = true; done(); }
    x.fillStyle = COL.deep; x.fillRect(0, 0, 360, 240);
    x.save(); x.translate(130, 120); x.rotate(turn * Math.PI * 2);
    x.strokeStyle = COL.gold; x.lineWidth = 10; x.beginPath(); x.arc(0, 0, 70, 0, Math.PI * 2); x.stroke();
    for (let i = 0; i < 6; i++) { x.rotate(Math.PI / 3); x.fillStyle = COL.wood; x.fillRect(-5, 0, 10, 68); }
    x.restore();
    x.fillStyle = COL.line; x.fillRect(250, 30, 40, 180); x.fillStyle = COL.ember; const h = Math.min(1, turn / 3) * 180; x.fillRect(250, 210 - h, 40, h);
    x.fillStyle = COL.text; x.font = '800 16px Nunito, sans-serif'; x.textAlign = 'center'; x.fillText(`${Math.min(3, Math.floor(turn))}/3 vueltas`, 270, 230);
  });
  return () => { stop(); unhold(); };
}

// ---- Encender faroles: repeat the order they flash ----
function faroles(body, done, step, rand) {
  const row = el('div', { className: 'task-row' }), status = el('p', { className: 'task-hint', textContent: 'Mira el orden…' });
  const lamps = [0, 1, 2, 3].map(i => el('button', { className: 'lantern-btn', ariaLabel: `Farol ${i + 1}` }));
  row.append(...lamps); body.append(row, status);
  const order = Array.from({ length: 4 }, () => Math.floor(rand() * 4));
  let input = [], showing = true, timers = [];
  const flash = (i, ms = 380) => { lamps[i].classList.add('is-flash'); timers.push(setTimeout(() => lamps[i].classList.remove('is-flash'), ms)); };
  function show() {
    showing = true; input = []; status.textContent = 'Mira el orden…'; lamps.forEach(l => l.classList.remove('is-lit'));
    order.forEach((i, k) => timers.push(setTimeout(() => flash(i), 500 + k * 600)));
    timers.push(setTimeout(() => { showing = false; status.textContent = 'Ahora enciéndelos en ese orden.'; }, 500 + order.length * 600));
  }
  lamps.forEach((l, i) => l.addEventListener('pointerdown', e => {
    e.preventDefault(); if (showing) return;
    flash(i, 200);
    if (order[input.length] !== i) { status.textContent = '¡Ese no era! Otra vez.'; timers.push(setTimeout(show, 700)); showing = true; return; }
    input.push(i); l.classList.add('is-lit');
    if (input.length === order.length) { status.textContent = '¡Todos prendidos!'; showing = true; done(); }
  }));
  show();
  return () => timers.forEach(clearTimeout);
}

// ---- Armar la reliquia: drag each fragment into its slot ----
function reliquia(body, done, step, rand) {
  const [c, x] = canvas(body, 400, 260);
  const slots = [0, 1, 2, 3].map(i => { const a = i * Math.PI / 2 - Math.PI / 4; return { x: 120 + Math.cos(a) * 52, y: 130 + Math.sin(a) * 52, a }; });
  const pieces = slots.map((s, i) => ({ i, x: 290 + (i % 2) * 60 + rand() * 10, y: 60 + Math.floor(i / 2) * 90 + rand() * 20, placed: false }));
  let drag = null, finished = false;
  const shape = (cx, cy, a, fill) => { x.save(); x.translate(cx, cy); x.rotate(a); x.fillStyle = fill; x.beginPath(); x.moveTo(0, -30); x.lineTo(26, 0); x.lineTo(0, 30); x.lineTo(-26, 0); x.closePath(); x.fill(); x.restore(); };
  c.addEventListener('pointerdown', e => { const p = at(c, e); drag = pieces.find(q => !q.placed && Math.hypot(q.x - p.x, q.y - p.y) < 34) || null; if (drag) c.setPointerCapture(e.pointerId); });
  c.addEventListener('pointermove', e => { if (!drag) return; const p = at(c, e); drag.x = p.x; drag.y = p.y; });
  c.addEventListener('pointerup', () => {
    if (!drag) return; const s = slots[drag.i];
    if (Math.hypot(drag.x - s.x, drag.y - s.y) < 30) { drag.placed = true; drag.x = s.x; drag.y = s.y; }
    drag = null;
    if (!finished && pieces.every(q => q.placed)) { finished = true; done(); }
  });
  const stop = loop((dt, t) => {
    x.fillStyle = COL.deep; x.fillRect(0, 0, 400, 260);
    x.strokeStyle = COL.gold; x.lineWidth = 6; x.beginPath(); x.arc(120, 130, 100, 0, Math.PI * 2); x.stroke();
    slots.forEach((s, i) => shape(s.x, s.y, s.a, pieces[i].placed ? COL.gold : COL.line));
    for (const q of pieces) if (!q.placed) { shape(q.x, q.y, slots[q.i].a, COL.ember); }
    x.fillStyle = COL.teal; x.beginPath(); x.arc(120, 130, 14 + (finished ? Math.sin(t * 6) * 4 : 0), 0, Math.PI * 2); x.fill();
  });
  return stop;
}

// ---- Arreglar la tabla: nail when the marker crosses the beam ----
function tabla(body, done) {
  const [c, x] = canvas(body, 400, 200), btn = el('button', { className: 'pk-btn pk-btn--primary task-big', textContent: '¡Clavar!' });
  const status = el('p', { className: 'task-hint', textContent: 'Clava cuando la marca esté sobre la viga.' });
  body.append(el('div', { className: 'task-row' }, btn), status);
  const beams = [90, 200, 310]; let nails = 0, pos = 0, dir = 1, flash = 0, finished = false;
  const unpress = press(btn, () => {
    if (finished) return;
    const target = beams[nails];
    if (Math.abs(pos - target) < 22) { nails++; flash = 0.3; status.textContent = nails < 3 ? '¡Bien! Otro clavo.' : '¡Tabla firme!'; if (nails === 3) { finished = true; done(); } }
    else status.textContent = 'Fallaste. Espera la marca.';
  });
  const stop = loop(dt => {
    if (!finished) { pos += dir * dt * 260; if (pos > 380) { pos = 380; dir = -1; } if (pos < 20) { pos = 20; dir = 1; } }
    flash = Math.max(0, flash - dt);
    x.fillStyle = COL.deep; x.fillRect(0, 0, 400, 200);
    x.fillStyle = COL.wood; x.fillRect(10, 80, 380, 50);
    beams.forEach((b, i) => { x.fillStyle = i < nails ? COL.teal : i === nails ? COL.ember : COL.line; x.fillRect(b - 6, 130, 12, 60); if (i < nails) { x.fillStyle = COL.text; x.beginPath(); x.arc(b, 105, 7, 0, Math.PI * 2); x.fill(); } });
    x.fillStyle = flash > 0 ? COL.teal : COL.yellow; x.beginPath(); x.moveTo(pos, 74); x.lineTo(pos - 12, 50); x.lineTo(pos + 12, 50); x.fill();
  });
  return () => { stop(); unpress(); };
}

// ---- Llenar agua: hold to fill, let go in the green band ----
function agua(body, done) {
  const [c, x] = canvas(body, 360, 240), btn = el('button', { className: 'pk-btn pk-btn--primary task-big', textContent: 'Mantén para llenar' });
  const status = el('p', { className: 'task-hint', textContent: 'Suelta cuando el agua llegue a la franja verde.' });
  body.append(el('div', { className: 'task-row' }, btn), status);
  let level = 0, held = false, finished = false;
  const unhold = holder(btn, v => {
    held = v;
    if (!v && !finished && level > 0) {
      if (level >= 0.72 && level <= 0.9) { finished = true; status.textContent = '¡Justo!'; done(); }
      else if (level < 0.72) status.textContent = 'Le falta. Sigue llenando.';
    }
  });
  const stop = loop(dt => {
    if (held && !finished) level += dt * 0.42;
    if (level > 1) { level = 0; status.textContent = '¡Se desbordó! Otra vez.'; }
    x.fillStyle = COL.deep; x.fillRect(0, 0, 360, 240);
    x.fillStyle = COL.line; x.fillRect(130, 20, 100, 200);
    x.fillStyle = COL.water; x.fillRect(130, 220 - level * 200, 100, level * 200);
    x.fillStyle = 'rgba(42,209,178,.45)'; x.fillRect(122, 220 - 0.9 * 200, 116, 0.18 * 200);
    if (held) { x.fillStyle = COL.water; x.fillRect(176, 0, 8, 220 - level * 200); }
  });
  return () => { stop(); unhold(); };
}

// ---- Hacer arepas: flip each side when it turns golden ----
function arepas(body, done) {
  const [c, x] = canvas(body, 360, 240), btn = el('button', { className: 'pk-btn pk-btn--primary task-big', textContent: '¡Voltear!' });
  const status = el('p', { className: 'task-hint', textContent: 'Voltea cuando esté dorada, ni antes ni después.' });
  body.append(el('div', { className: 'task-row' }, btn), status);
  let cook = 0, side = 0, finished = false;
  const unpress = press(btn, () => {
    if (finished) return;
    if (cook >= 0.6 && cook <= 0.85) { side++; cook = 0; status.textContent = side < 2 ? '¡Eso! Ahora el otro lado.' : '¡Arepa lista!'; if (side === 2) { finished = true; done(); } }
    else status.textContent = cook < 0.6 ? 'Todavía está cruda.' : 'Se quemó un poquito…';
  });
  const stop = loop(dt => {
    if (!finished) cook += dt * 0.32;
    if (cook > 1) { cook = 0; status.textContent = '¡Se quemó! Otra arepa.'; }
    x.fillStyle = COL.deep; x.fillRect(0, 0, 360, 240);
    x.fillStyle = '#2a2b2e'; x.beginPath(); x.ellipse(180, 130, 130, 60, 0, 0, Math.PI * 2); x.fill();
    const k = Math.min(1, cook), r = 240 - k * 110, g = 220 - k * 120, b = 170 - k * 120;
    x.fillStyle = `rgb(${r},${g},${b})`; x.beginPath(); x.ellipse(180, 122, 70, 30, 0, 0, Math.PI * 2); x.fill();
    x.fillStyle = COL.line; x.fillRect(40, 210, 280, 12); x.fillStyle = 'rgba(42,209,178,.6)'; x.fillRect(40 + 280 * 0.6, 210, 280 * 0.25, 12);
    x.fillStyle = COL.ember; x.fillRect(40 + 280 * Math.min(1, cook) - 2, 204, 4, 24);
    x.fillStyle = COL.text; x.font = '800 15px Nunito, sans-serif'; x.textAlign = 'center'; x.fillText(`Lado ${Math.min(2, side + 1)} de 2`, 180, 40);
  });
  return () => { stop(); unpress(); };
}

// ---- Sintonizar la radio: match the wave with the dial ----
function radio(body, done, step, rand) {
  const [c, x] = canvas(body, 400, 200), slider = el('input', { type: 'range', min: 0, max: 100, value: 10, className: 'task-slider', ariaLabel: 'Dial de la radio' });
  const status = el('p', { className: 'task-hint', textContent: 'Gira el dial hasta que las dos ondas coincidan.' });
  body.append(el('div', { className: 'task-row' }, slider), status);
  const target = 30 + rand() * 60; let lock = 0, finished = false;
  const stop = loop((dt, t) => {
    const v = Number(slider.value), close = Math.abs(v - target) < 5;
    lock = close ? lock + dt : 0;
    if (lock > 0.9 && !finished) { finished = true; status.textContent = '¡Se escucha el bote!'; done(); }
    x.fillStyle = COL.deep; x.fillRect(0, 0, 400, 200);
    const wave = (f, color, w) => { x.strokeStyle = color; x.lineWidth = w; x.beginPath(); for (let i = 0; i <= 400; i += 4) { const y = 100 + Math.sin(i * f / 900 + t * 3) * 50; if (i) x.lineTo(i, y); else x.moveTo(i, y); } x.stroke(); };
    wave(target / 10 + 2, COL.line, 6); wave(v / 10 + 2, close ? COL.teal : COL.ember, 3);
  });
  return stop;
}

// ---- Limpiar jeroglíficos: rub the sand away ----
function jeroglificos(body, done, step, rand) {
  const [c, x] = canvas(body, 400, 260), status = el('p', { className: 'task-hint', textContent: 'Frota la arena con el dedo o el ratón.' });
  body.append(status);
  const sand = document.createElement('canvas'); sand.width = 400; sand.height = 260; const s = sand.getContext('2d');
  s.fillStyle = COL.sand; s.fillRect(0, 0, 400, 260);
  for (let i = 0; i < 400; i++) { s.fillStyle = `rgba(90,70,40,${rand() * 0.25})`; s.fillRect(rand() * 400, rand() * 260, 3, 3); }
  let rubbing = false, finished = false, check = 0;
  const rub = e => { const p = at(c, e); s.globalCompositeOperation = 'destination-out'; s.beginPath(); s.arc(p.x, p.y, 26, 0, Math.PI * 2); s.fill(); s.globalCompositeOperation = 'source-over'; };
  c.addEventListener('pointerdown', e => { rubbing = true; c.setPointerCapture(e.pointerId); rub(e); });
  c.addEventListener('pointermove', e => { if (rubbing) rub(e); });
  c.addEventListener('pointerup', () => { rubbing = false; });
  const glyph = Math.floor(rand() * 3);
  const stop = loop(dt => {
    x.fillStyle = '#6f6a52'; x.fillRect(0, 0, 400, 260);
    x.strokeStyle = COL.teal; x.lineWidth = 12; x.lineCap = 'round';
    x.beginPath();
    if (glyph === 0) { x.arc(200, 130, 70, 0, Math.PI * 2); x.moveTo(200, 60); x.lineTo(200, 200); x.moveTo(130, 130); x.lineTo(270, 130); }
    else if (glyph === 1) { x.moveTo(120, 200); x.lineTo(200, 50); x.lineTo(280, 200); x.closePath(); x.moveTo(200, 120); x.arc(200, 150, 20, 0, Math.PI * 2); }
    else { for (let i = 0; i < 3; i++) { x.moveTo(110 + i * 70, 60); x.quadraticCurveTo(160 + i * 70, 130, 110 + i * 70, 200); } }
    x.stroke();
    x.drawImage(sand, 0, 0);
    check -= dt;
    if (check <= 0 && !finished) {
      check = 0.3;
      const data = s.getImageData(0, 0, 400, 260).data; let clear = 0;
      for (let i = 3; i < data.length; i += 64) if (data[i] < 40) clear++;
      if (clear / (data.length / 64) > 0.62) { finished = true; status.textContent = '¡El símbolo del sol!'; done(); }
    }
  });
  return stop;
}

// ---- Subir provisiones: three crates out of the curiara, then onto the shelf ----
function provisiones(body, done, step) {
  const loading = step === 0;
  const status = el('p', { className: 'task-hint', textContent: loading ? 'Saca las tres cajas de la curiara.' : 'Acomoda las tres cajas en la despensa.' });
  const row = el('div', { className: 'task-row' });
  let left = 3;
  for (let i = 0; i < 3; i++) {
    const b = el('button', { className: 'pk-btn task-big', textContent: loading ? `Caja ${i + 1}` : `Guardar caja ${i + 1}` });
    b.addEventListener('pointerdown', e => { e.preventDefault(); if (b.disabled) return; b.disabled = true; b.textContent = loading ? 'Cargada' : 'Guardada'; if (--left === 0) { status.textContent = loading ? 'Ahora llévalas a la despensa de la cocina.' : '¡Despensa llena!'; done(); } });
    row.append(b);
  }
  body.append(row, status);
  return () => {};
}

export const TASK_UI = { malacate, faroles, reliquia, tabla, agua, arepas, radio, jeroglificos, provisiones };
export const HINTS = {
  malacate: 'Mantén pulsado para subir el balde de la mina.', faroles: 'Fíjate en el orden en que se prenden.', reliquia: 'Arrastra cada pedazo a su lugar.',
  tabla: 'Tres clavos, cada uno sobre su viga.', agua: 'Llena el balde sin que se desborde.', arepas: 'Dos lados, bien doraditas.',
  radio: 'El bote llama por la radio. Sintonízalo.', jeroglificos: 'Debajo de la arena hay un símbolo.', provisiones: 'Una tarea larga: la curiara y luego la cocina.',
};

// Opens a task in `body`. Returns dispose().
export function openTask(id, body, { step = 0, done, rand = Math.random }) {
  body.replaceChildren();
  let fired = false;
  const finish = () => {
    if (fired) return; fired = true;
    sound.pickup(1);
    body.append(el('div', { className: 'task-done', textContent: '¡Listo!' }));
    setTimeout(done, 450);
  };
  const dispose = TASK_UI[id]?.(body, finish, step, rand) || (() => {});
  return () => { dispose(); body.replaceChildren(); };
}
