import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { sound, Puffs } from '/engine/fx.js';
import { loadAvatar, loadName, randomAvatar } from '/engine/avatar.js';
import { buildCharacter } from '/engine/character.js';
import { makeMango } from '/engine/props.js';
import { createBoard, createToken, createDie, TILE_COUNT, FORK } from './board.js';
import { RIVER, SEA, MAP_BOUNDS, beachMask } from './island.js';
import atrapa from './minigames/atrapa.js';
import caigas from './minigames/caigas.js';
import { SKY_MODES } from './atmosphere.js';

// every tile, sign and bubble is drawn on a canvas in the cartoon font, so
// load it before building anything (but never hang on it)
await Promise.race([document.fonts.load('64px "Luckiest Guy"'), new Promise((r) => setTimeout(r, 1500))]);

const $ = (id) => document.getElementById(id);
const rand = (a, b) => a + Math.random() * (b - a);
const pick = (list) => list[Math.floor(Math.random() * list.length)];

// test switches: ?auto lets the AI play for you, ?speed=4 fast-forwards,
// ?rounds=2 shortens the game, ?mini=caigas forces a minigame,
// ?play=caigas skips the board and plays just that minigame
const QS = new URLSearchParams(location.search);
const AUTO = QS.has('auto');
const SPEED = Number(QS.get('speed')) || 1;
const ROUNDS = Math.max(1, Math.min(20, Number(QS.get('rounds')) || 10));
const DEBUG = QS.has('debug');
const MINIGAMES = [atrapa, caigas];
const FORCED = MINIGAMES.find((m) => m.id === QS.get('mini'));
const ONLY = MINIGAMES.find((m) => m.id === QS.get('play'));
let savedSky = 'day';
try { savedSky = localStorage.getItem('pana.bululu.sky') || 'day'; } catch { /* Storage can be disabled. */ }
const skyMode = QS.get('sky') || savedSky;

const COLORS = ['#ff4b4b', '#3d7bf2', '#ffc629', '#2fbf4a'];
const RIVALS = ['Don Pancho', 'La Chama', 'El Gocho', 'Tía Carmen', 'El Catire', 'Yoli', 'Chuchú', 'La Nena'];
const START_COINS = 10;
const PRICE = 20;

// ---------- players ----------
const players = (() => {
  const names = [...RIVALS].sort(() => Math.random() - 0.5);
  return COLORS.map((color, i) => {
    let avatar;
    if (i === 0) avatar = loadAvatar();
    else {
      // rivals wear their player color on their hats, like on the box art
      avatar = randomAvatar();
      if (avatar.hat === 'none' || avatar.hat === 'corona') avatar.hat = 'gorra';
      avatar.hatColor = color;
    }
    return {
      i, color, avatar, human: i === 0,
      name: i === 0 ? loadName() : names[i - 1],
      coins: START_COINS, mangos: 0, tile: 0, token: null,
    };
  });
})();
const me = players[0];
const isHuman = (p) => p.human && !AUTO;

// ---------- renderer ----------
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.setSize(innerWidth, innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
document.body.prepend(renderer.domElement);

// ---------- board scene ----------
const boardScene = new THREE.Scene();
const boardCam = new THREE.PerspectiveCamera(50, innerWidth / innerHeight, 0.1, 1800);
const board = createBoard(boardScene, { skyMode });
const skyButtons = [...document.querySelectorAll('[data-sky]')];
function selectSky(mode, save = true) {
  if (!SKY_MODES.includes(mode)) return;
  board.atmosphere.setMode(mode);
  for (const button of skyButtons) button.setAttribute('aria-pressed', String(button.dataset.sky === mode));
  if (save) try { localStorage.setItem('pana.bululu.sky', mode); } catch { /* Keep the selection for this session. */ }
}
for (const button of skyButtons) button.addEventListener('click', () => selectSky(button.dataset.sky));
selectSky(board.atmosphere.mode, false);
const puffs = new Puffs(boardScene);
// two dice, plus a floating counter for the steps left once they're rolled
const dice = [createDie(), createDie()];
for (const d of dice) {
  d.mesh.visible = false;
  boardScene.add(d.mesh);
}
const counter = (() => {
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, depthTest: false }));
  sprite.scale.set(1.7, 1.7, 1);
  sprite.renderOrder = 11;
  sprite.visible = false;
  return {
    sprite,
    set(n) {
      const g = c.getContext('2d');
      g.clearRect(0, 0, 128, 128);
      g.fillStyle = '#ffc629';
      g.strokeStyle = '#16161a';
      g.lineWidth = 8;
      g.beginPath();
      g.arc(64, 64, 56, 0, Math.PI * 2);
      g.fill();
      g.stroke();
      g.fillStyle = '#16161a';
      g.font = '72px "Luckiest Guy", system-ui, sans-serif';
      g.textAlign = 'center';
      g.textBaseline = 'middle';
      g.fillText(String(n), 64, 72);
      tex.needsUpdate = true;
      sprite.visible = true;
    },
  };
})();
boardScene.add(counter.sprite);
board.setStand(7);   // close to the start, so the first mango is up for grabs early

for (const p of players) {
  p.token = createToken(p, p.i);
  p.token.dizzy = 0;
  p.token.cheer = 0;
  boardScene.add(p.token.group);
}

// where a token rests on its tile, sharing space with whoever else is there
function restSpot(p) {
  const crowd = players.filter((o) => o.tile === p.tile);
  return board.spot(p.tile, crowd.indexOf(p), crowd.length);
}
function layoutTokens(skip) {
  for (const p of players) {
    if (p === skip) continue;
    const s = restSpot(p);
    p.token.rest = new THREE.Vector3(s.x, s.y, s.z);
  }
}
layoutTokens();
for (const p of players) p.token.group.position.copy(p.token.rest);

// The camera always looks from the front (+Z) at a 3/4 angle, like the box
// art, so the board keeps one orientation: the plateau and hill rise at the
// back and nothing tall stands between the camera and the path.
const cam = { pos: new THREE.Vector3(), look: new THREE.Vector3(), wantPos: new THREE.Vector3(), wantLook: new THREE.Vector3() };
const SHOTS = {
  far: [0, 30, 36],        // a big chunk of the island (the minimap shows all of it)
  mid: [0, 14, 17],        // a pana and its neighborhood
  close: [0, 8, 10.5],     // buying, events, the winner
};
function focus(at, kind = 'mid') {
  const o = SHOTS[kind];
  cam.kind = kind;
  cam.wantLook.set(at.x, at.y + 1, at.z);
  cam.wantPos.set(at.x + o[0], at.y + o[1], at.z + o[2]);
}
// pull back for the start of a round, around whoever goes first
function overview(at = players[0].token.rest) {
  focus(at, 'far');
}
overview();
cam.pos.copy(cam.wantPos);
cam.look.copy(cam.wantLook);

// "Ver tablero": drag to orbit, scroll to zoom, Tab or the button to return
const looker = new OrbitControls(boardCam, renderer.domElement);
Object.assign(looker, { enabled: false, enableDamping: true, maxPolarAngle: 1.42, minDistance: 6, maxDistance: 360 });
let freeLook = false;
function setFreeLook(on) {
  if (on && view !== boardView) return;
  freeLook = on;
  looker.enabled = on;
  if (on) looker.target.copy(cam.look);
  else {
    cam.pos.copy(boardCam.position);
    cam.look.copy(looker.target);
  }
  $('look').classList.toggle('on', on);
  $('look').innerHTML = on ? 'Volver <kbd>Tab</kbd>' : 'Ver tablero <kbd>Tab</kbd>';
  if (!on) $('places').value = '';
}
$('look').onclick = () => setFreeLook(!freeLook);
const SCENIC_SPOTS = {
  island: { target: [0, 12, -12], camera: [0, 156, 285] },
  beach: { target: [12, 2, 90], camera: [34, 24, 137] },
  waterfall: { target: [130, 64, -310], camera: [245, 115, 15] },
  harbor: { target: [123, 3, 24], camera: [162, 26, 66] },
};
$('places').addEventListener('change', (event) => {
  const spot = SCENIC_SPOTS[event.target.value];
  if (!spot || view !== boardView) return;
  setFreeLook(true);
  looker.target.set(...spot.target);
  boardCam.position.set(...spot.camera);
  looker.update();
});

const boardView = {
  scene: boardScene,
  camera: boardCam,
  update(dt, t) {
    board.update(t, dt);
    for (const p of players) {
      const tk = p.token;
      if (!tk.hopping) tk.group.position.lerp(tk.rest, Math.min(1, dt * 8));
      tk.dizzy = Math.max(0, tk.dizzy - dt);
      tk.cheer = Math.max(0, tk.cheer - dt);
      tk.pana.group.position.y = 0.32 + (tk.cheer > 0 ? Math.abs(Math.sin(t * 9)) * 0.6 : 0);
      const up = tk.cheer > 0 ? 2.2 : 0;
      tk.pana.armL.rotation.x = -0.55 - up;
      tk.pana.armR.rotation.x = -0.55 - up;
      tk.pana.update(dt, { open: tk.cheer > 0 || tk.bubble.t > 0, dizzy: tk.dizzy > 0, look: Math.sin(t * 0.6 + p.i) });
      tk.bubble.update(dt);
      // pins grow with distance so you can find every pana from the overview
      const s = Math.max(1, Math.min(2.6, boardCam.position.distanceTo(tk.group.position) / 20));
      tk.pin.scale.set(0.95 * s, 1.04 * s, 1);
      tk.pin.position.y = 3.1 + s * 0.4 + Math.sin(t * 2.5 + p.i) * 0.1;
    }
    for (const die of dice) {
      if (!die.mesh.visible) continue;
      if (die.rolling) die.spin(dt);
      else {
        // settle with the shown face toward the camera
        const q = new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().lookAt(boardCam.position, die.mesh.position, new THREE.Vector3(0, 1, 0)));
        q.multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), Math.PI));
        die.mesh.quaternion.slerp(q, Math.min(1, dt * 12));
      }
    }
    puffs.update(dt);
    if (freeLook) looker.update();
    else {
      cam.pos.lerp(cam.wantPos, Math.min(1, dt * 2.2));
      cam.look.lerp(cam.wantLook, Math.min(1, dt * 2.8));
      boardCam.position.copy(cam.pos);
      boardCam.lookAt(cam.look);
    }
    // in the overview every tile counts; up close just the panas and the target
    const spots = [cam.look, ...players.map((p) => p.token.group.position)];
    if (cam.kind === 'far' || freeLook) for (const tl of board.tiles) spots.push(tl.mesh.position);
    board.seeThrough(boardCam.position, spots, dt);
    board.follow(freeLook ? looker.target : cam.look);
    drawMap(dt, t);
  },
};

// ======================================================================
// time: waits and tweens run on game time (so ?speed and pauses work)
// ======================================================================
let jobs = [];
const wait = (s) => new Promise((r) => jobs.push({ t: s, r }));
const tween = (dur, fn) => new Promise((r) => jobs.push({ t: dur, dur, fn, r }));
function stepJobs(dt) {
  const done = [];
  for (const j of jobs) {
    j.t -= dt;
    if (j.fn) j.fn(Math.min(1, 1 - j.t / j.dur));
    if (j.t <= 0) done.push(j);
  }
  if (done.length) {
    jobs = jobs.filter((j) => !done.includes(j));
    for (const j of done) j.r();
  }
}
const ease = (k) => k * k * (3 - 2 * k);

// ======================================================================
// input
// ======================================================================
const held = {};
let jumpPressed = false;
let actionWaiters = [];
addEventListener('keydown', (e) => {
  // Let the atmosphere buttons retain native Space/Enter/Tab behavior.
  if (e.target.closest?.('.sky-controls, .places')) return;
  const k = e.key.toLowerCase();
  if (k === ' ' || k.startsWith('arrow')) e.preventDefault();
  held[k] = true;
  if (!e.repeat && (k === ' ' || k === 'w' || k === 'arrowup')) jumpPressed = true;
  if (k === 'm') sound.muted = !sound.muted;
  if (k === 'l' && !e.repeat && view === boardView) {
    selectSky(SKY_MODES[(SKY_MODES.indexOf(board.atmosphere.mode) + 1) % SKY_MODES.length]);
  }
  if (k === 'tab') {
    e.preventDefault();
    if (!e.repeat) setFreeLook(!freeLook);
  }
  if (!e.repeat) for (const w of actionWaiters) w(k);
});
addEventListener('keyup', (e) => (held[e.key.toLowerCase()] = false));
addEventListener('pointerdown', () => sound.unlock(), { once: false });

// on-screen buttons for touch screens during minigames
for (const [id, key] of [['t-left', 'a'], ['t-right', 'd'], ['t-jump', ' ']]) {
  const el = $(id);
  el.addEventListener('pointerdown', (e) => { e.preventDefault(); held[key] = true; if (key === ' ') jumpPressed = true; });
  for (const ev of ['pointerup', 'pointerleave', 'pointercancel']) el.addEventListener(ev, () => (held[key] = false));
}

function minigameInput() {
  const x = (held.d || held.arrowright ? 1 : 0) - (held.a || held.arrowleft ? 1 : 0);
  const jump = jumpPressed;
  jumpPressed = false;
  return { x, jump };
}

// ======================================================================
// UI kit
// ======================================================================
const MANGO_SVG = '<svg viewBox="0 0 40 40" class="ico"><path d="M8 24c0-10 9-17 18-15 6 1 8 7 7 13-2 9-11 13-18 11-4-1-7-4-7-9z" fill="#ffc629" stroke="#9a6400" stroke-width="3"/><path d="M27 9c1-3 4-5 7-5-1 3-3 5-7 5z" fill="#3a9d3a"/><path d="M14 17c2-3 5-4 8-4" stroke="#fff3b0" stroke-width="3" fill="none" stroke-linecap="round"/></svg>';
const ICONS = {
  coin: '<i class="ico coin"></i>',
  mango: MANGO_SVG,
  jump: '<i class="ico jump">⤒</i>',
};

let cardMode = 'board';
let miniScores = [0, 0, 0, 0];
let miniIcon = 'mango';
let turnOf = -1;
let lastCards = '';

function standings() {
  return [...players].sort((a, b) => b.mangos - a.mangos || b.coins - a.coins);
}
function ranks() {
  const order = standings();
  const out = {};
  order.forEach((p, k) => {
    const prev = order[k - 1];
    out[p.i] = prev && prev.mangos === p.mangos && prev.coins === p.coins ? out[prev.i] : k + 1;
  });
  return out;
}

function renderCards() {
  const r = ranks();
  const best = Math.max(...miniScores);
  const key = JSON.stringify([cardMode, turnOf, miniScores, players.map((p) => [p.coins, p.mangos])]);
  if (key === lastCards) return;
  lastCards = key;
  $('cards').innerHTML = players.map((p) => {
    const crown = cardMode === 'board' ? r[p.i] === 1 && (p.mangos || p.coins !== START_COINS) : best > 0 && miniScores[p.i] === best;
    const stats = cardMode === 'board'
      ? `<span>${ICONS.mango}<b>${p.mangos}</b></span><span>${ICONS.coin}<b>${p.coins}</b></span>`
      : `<span class="big">${ICONS[miniIcon]}<b>${miniScores[p.i]}</b></span>`;
    return `<div class="pcard${turnOf === p.i ? ' turn' : ''}" style="--c:${p.color}">
      ${cardMode === 'board' ? `<span class="medal m${r[p.i]}">${r[p.i]}</span>` : ''}
      ${crown ? '<span class="crown">👑</span>' : ''}
      <img src="${p.portrait || ''}" alt="">
      <div class="info"><small>P${p.i + 1} · ${escapeHtml(p.name)}</small><div class="vals">${stats}</div></div>
    </div>`;
  }).join('');
}
const escapeHtml = (s) => s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

function setPlank(text) { $('plank').textContent = text; }
function setSign(text) {
  $('sign').textContent = text || '';
  $('sign').classList.toggle('hidden', !text);
}
function setTimer(n) {
  $('timer').classList.toggle('hidden', n == null);
  if (n != null) $('timer-n').textContent = n;
}

async function toast(title, sub = '', secs = 1.4, kind = '') {
  const el = $('toast');
  el.className = `toast ${kind}`;
  el.innerHTML = `<b>${title}</b>${sub ? `<span>${sub}</span>` : ''}`;
  await wait(secs);
  el.className = 'toast hidden';
}

// A choice with buttons + keys. The AI (or ?auto) answers on its own.
function ask(text, options, { auto = 0, delay = 0.5 } = {}) {
  const el = $('prompt');
  el.innerHTML = `<p>${text}</p><div class="row">${options.map((o, i) =>
    `<button data-i="${i}" class="${i === 0 ? 'primary' : ''}">${o.label}${o.key ? ` <kbd>${o.key === ' ' ? 'Espacio' : o.key.toUpperCase()}</kbd>` : ''}</button>`).join('')}</div>`;
  el.classList.remove('hidden');
  return new Promise((resolve) => {
    const done = (i) => {
      el.classList.add('hidden');
      actionWaiters = actionWaiters.filter((w) => w !== onKey);
      sound.unlock();
      resolve(i);
    };
    const onKey = (k) => {
      const i = options.findIndex((o) => o.key === k || (o.key === ' ' && k === 'enter'));
      if (i >= 0) done(i);
    };
    el.querySelectorAll('button').forEach((b) => (b.onclick = () => done(Number(b.dataset.i))));
    if (AUTO) wait(delay).then(() => done(auto));
    else actionWaiters.push(onKey);
  });
}

// ---------- portraits for the player cards ----------
function makePortraits() {
  const pr = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true });
  pr.setSize(128, 128);
  const scene = new THREE.Scene();
  scene.add(new THREE.HemisphereLight(0xffffff, 0x8a6a4a, 2.2));
  const key = new THREE.DirectionalLight(0xffffff, 1.4);
  key.position.set(2, 3, 4);
  scene.add(key);
  const pcam = new THREE.PerspectiveCamera(28, 1, 0.1, 20);
  pcam.position.set(0.9, 1.55, 2.9);
  pcam.lookAt(0, 1.38, 0);
  for (const p of players) {
    const c = buildCharacter(p.avatar);
    c.group.rotation.y = 0.35;
    c.update(0, { look: 0 });
    scene.add(c.group);
    pr.render(scene, pcam);
    p.portrait = pr.domElement.toDataURL();
    c.dispose();
  }
  pr.dispose();
  pr.forceContextLoss();
}

// ======================================================================
// minimap: the whole island at a glance; tap it to look there
// ======================================================================
const MAP = MAP_BOUNDS;
const mapEl = $('minimap');
const mapCtx = mapEl.getContext('2d');
const mapBase = document.createElement('canvas');
mapBase.width = mapEl.width;
mapBase.height = mapEl.height;
const toMap = (x, z) => [(x - MAP.x0) / (MAP.x1 - MAP.x0) * mapEl.width, (z - MAP.z0) / (MAP.z1 - MAP.z0) * mapEl.height];
const TILE_COLORS = { blue: '#3d7bf2', red: '#ff4b4b', event: '#ffd23f', start: '#2ad1b2', tree: '#8e4de8' };
function drawMapBase() {
  const g = mapBase.getContext('2d');
  const W = mapBase.width, H = mapBase.height, step = 4;
  for (let py = 0; py < H; py += step) {
    for (let px = 0; px < W; px += step) {
      const x = MAP.x0 + (px / W) * (MAP.x1 - MAP.x0), z = MAP.z0 + (py / H) * (MAP.z1 - MAP.z0);
      const h = board.groundAt(x, z);
      let c;
      if (h < SEA - 2) c = '#1d4f80';
      else if (h < SEA + 0.2) c = '#3a8fb0';
      else if (h < 0.4 || beachMask(x, z) > 0.45) c = '#e6c88c';
      else if (h > 24) c = '#b4adbb';
      else if (h > 9) c = '#3f7f4a';
      else c = h > 4 ? '#55a04c' : '#66b356';
      g.fillStyle = c;
      g.fillRect(px, py, step, step);
    }
  }
  g.strokeStyle = '#45bde0';
  g.lineWidth = 5;
  g.lineJoin = g.lineCap = 'round';
  g.beginPath();
  RIVER.forEach(([x, z], i) => (i ? g.lineTo(...toMap(x, z)) : g.moveTo(...toMap(x, z))));
  g.stroke();
  // the path, then the tiles on it
  g.strokeStyle = 'rgba(255, 240, 210, 0.7)';
  g.lineWidth = 4;
  for (const t of board.tiles) for (const n of t.next) {
    const u = board.tiles[n];
    g.beginPath();
    g.moveTo(...toMap(t.x, t.z));
    g.lineTo(...toMap(u.x, u.z));
    g.stroke();
  }
  for (const t of board.tiles) {
    const [x, y] = toMap(t.x, t.z);
    g.fillStyle = TILE_COLORS[t.kind];
    g.fillRect(x - 4, y - 4, 8, 8);
  }
}
drawMapBase();
let mapT = 0;
function drawMap(dt, t) {
  mapT -= dt;
  if (mapT > 0) return;
  mapT = 0.1;
  const g = mapCtx;
  g.drawImage(mapBase, 0, 0);
  // where the camera is looking
  const [cx, cy] = toMap(cam.look.x, cam.look.z);
  g.strokeStyle = 'rgba(255, 255, 255, 0.6)';
  g.lineWidth = 3;
  g.strokeRect(cx - 34, cy - 24, 68, 48);
  // the cart: a pulsing gold star
  const sp = board.stand.group.position;
  const [sx, sy] = toMap(sp.x, sp.z);
  const pulse = 1 + Math.sin(t * 6) * 0.15;
  g.fillStyle = '#ffc629';
  g.strokeStyle = '#6b4200';
  g.lineWidth = 3;
  g.beginPath();
  for (let k = 0; k < 10; k++) {
    const r = (k % 2 ? 6 : 14) * pulse, a = (k / 10) * Math.PI * 2 - Math.PI / 2;
    g.lineTo(sx + Math.cos(a) * r, sy + Math.sin(a) * r);
  }
  g.closePath();
  g.fill();
  g.stroke();
  // the panas
  for (const p of players) {
    const pos = p.token.group.position;
    const [x, y] = toMap(pos.x, pos.z);
    const r = turnOf === p.i ? 11 + Math.sin(t * 8) * 2 : 9;
    g.fillStyle = p.color;
    g.strokeStyle = '#fff';
    g.lineWidth = 3;
    g.beginPath();
    g.arc(x, y, r, 0, Math.PI * 2);
    g.fill();
    g.stroke();
    g.fillStyle = '#fff';
    g.font = '14px "Luckiest Guy", system-ui, sans-serif';
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.fillText(String(p.i + 1), x, y + 1);
  }
}
mapEl.addEventListener('click', (e) => {
  const r = mapEl.getBoundingClientRect();
  const x = MAP.x0 + ((e.clientX - r.left) / r.width) * (MAP.x1 - MAP.x0);
  const z = MAP.z0 + ((e.clientY - r.top) / r.height) * (MAP.z1 - MAP.z0);
  if (!freeLook) setFreeLook(true);
  const y = board.groundAt(x, z);
  looker.target.set(x, y, z);
  boardCam.position.set(x, y + 34, z + 40);
});

// ======================================================================
// board turns
// ======================================================================
let round = 1;

async function hop(p, to) {
  const tk = p.token;
  const from = tk.group.position.clone();
  p.tile = to;
  layoutTokens(p);
  const s = restSpot(p);
  const dest = new THREE.Vector3(s.x, s.y, s.z);
  tk.rest = dest;
  tk.hopping = true;
  tk.group.rotation.y = Math.atan2(dest.x - from.x, dest.z - from.z);
  focus(dest);
  sound.tone(520 + (p.tile % 5) * 60, 0, 0.06, 'square', 0.05);
  await tween(0.3, (k) => {
    tk.group.position.lerpVectors(from, dest, ease(k));
    tk.group.position.y = from.y + (dest.y - from.y) * ease(k) + Math.sin(k * Math.PI) * 1.3;
    counter.sprite.position.set(tk.group.position.x, tk.group.position.y + 4.6, tk.group.position.z);
  });
  tk.hopping = false;
  puffs.spawn(dest.clone().setY(dest.y + 0.2), { color: 0xffffff, count: 2, spread: 0.8, size: 0.4, rise: 0.6, life: 0.4 });
}

async function moveSteps(p, n, { counted = false } = {}) {
  for (let left = n; left > 0; left--) {
    if (counted) counter.set(left);
    const next = board.tiles[p.tile].next;
    const to = next.length > 1 ? await chooseRoute(p, next) : next[0];
    await hop(p, to);
    if (p.tile === board.standTile) await visitStand(p, left === 1);
  }
}

// steps from a tile to another, along the shortest route
function stepsTo(from, goal) {
  const seen = new Map([[from, 0]]);
  const queue = [from];
  while (queue.length) {
    const t = queue.shift();
    if (t === goal) return seen.get(t);
    for (const n of board.tiles[t].next) {
      if (!seen.has(n)) { seen.set(n, seen.get(t) + 1); queue.push(n); }
    }
  }
  return Infinity;
}

// At the fork: stay on the shore, or pay the toll and take the hill shortcut.
async function chooseRoute(p, [shore, hill]) {
  if (p.coins < FORK.toll) {
    p.token.bubble.say('No me alcanza…', 1);
    await wait(0.6);
    return shore;
  }
  board.highlight = [shore, hill];
  focus(p.token.rest.clone().lerp(board.tiles[hill].mesh.position, 0.4), 'mid');
  let take;
  if (isHuman(p)) {
    take = await ask(`¿Por dónde vas? El <b>Atajo del cerro</b> es más corto, pero cuesta ${FORK.toll} monedas y es más peligroso.`,
      [{ label: 'Por la orilla', key: '1' }, { label: `Atajo (−${FORK.toll})`, key: '2' }]);
  } else {
    // head for the cart: take the hill if it gets there sooner, sometimes just for fun
    const viaHill = stepsTo(hill, board.standTile), viaShore = stepsTo(shore, board.standTile);
    take = (p.coins >= PRICE + FORK.toll && viaHill < viaShore) || Math.random() < 0.3 ? 1 : 0;
    await wait(0.8);
  }
  board.highlight = [];
  if (take !== 1) return shore;
  await give(p, -FORK.toll, '¡Peaje!');
  return hill;
}

async function give(p, n, line) {
  const before = p.coins;
  p.coins = Math.max(0, p.coins + n);
  const real = p.coins - before;
  p.token.bubble.say(line || (n >= 0 ? `+${n}` : `${n}`), 1);
  if (n >= 0) {
    sound.pickup();
    p.token.cheer = 0.5;
    puffs.spawn(p.token.group.position.clone().setY(2.5), { color: 0xffc629, count: 6, spread: 1.2, size: 0.4, rise: 2, life: 0.7 });
  } else {
    sound.bonk(0.6);
    p.token.dizzy = real < 0 ? 0.8 : 0;
  }
  renderCards();
  await wait(0.9);
}

async function visitStand(p, landed) {
  const st = board.stand;
  focus(p.token.rest.clone().lerp(st.group.position, 0.5), 'close');
  if (p.coins < PRICE) {
    st.bubble.say(p.human ? `¡Trae ${PRICE} monedas!` : '¡Sigue, sigue!', 1.3);
    await wait(landed ? 1.1 : 0.6);
    return;
  }
  st.bubble.say('¿Un Mango de oro?', 1.6);
  await wait(0.5);
  const buy = isHuman(p)
    ? await ask(`¿Compras un <b>Mango de oro</b> por ${PRICE} monedas? Tienes ${p.coins}.`, [{ label: '¡Dale!', key: 's' }, { label: 'Ahorita no', key: 'n' }])
    : 0;
  if (buy !== 0) {
    st.bubble.say('¡Tú te lo pierdes!', 1.1);
    await wait(0.9);
    return;
  }
  p.coins -= PRICE;
  p.mangos += 1;
  renderCards();
  // the golden mango arcs from the stand into the pana's arms
  const mg = makeMango({ gold: true });
  boardScene.add(mg);
  const from = st.group.position.clone().setY(4);
  const to = p.token.group.position.clone().setY(3);
  sound.horn('fiesta');
  await tween(0.9, (k) => {
    mg.position.lerpVectors(from, to, k);
    mg.position.y += Math.sin(k * Math.PI) * 4;
    mg.rotation.y += 0.3;
  });
  boardScene.remove(mg);
  puffs.spawn(to, { color: 0xffd23f, count: 12, spread: 2, size: 0.6, rise: 3, life: 1 });
  p.token.cheer = 1.6;
  p.token.bubble.say('¡MANGO DE ORO!', 1.5);
  await toast(`¡${escapeHtml(p.name)} tiene un Mango de oro!`, `Ya van ${p.mangos}`, 1.6, 'gold');
  await moveStand(p);
}

async function moveStand(p) {
  const st = board.stand;
  const taken = new Set(players.map((o) => o.tile));
  // somewhere the panas will reach soon: ahead of them on average, but not
  // right under anyone's nose (the board is big; behind them is a whole lap)
  const options = [], fallback = [];
  for (let i = 0; i < TILE_COUNT; i++) {
    if (i === board.standTile || taken.has(i) || board.standSpot(i).bad >= 30) continue;
    const steps = players.map((o) => stepsTo(o.tile, i));
    const avg = steps.reduce((a, b) => a + b, 0) / steps.length;
    fallback.push(i);
    if (Math.min(...steps) >= 4 && avg >= 8 && avg <= 24) options.push(i);
  }
  const next = pick(options.length ? options : fallback);
  puffs.spawn(st.group.position.clone().setY(2), { color: 0xffffff, count: 14, spread: 4, size: 1.2, rise: 2, life: 1 });
  sound.whoosh();
  await tween(0.4, (k) => st.group.scale.setScalar(Math.max(0.01, 1 - k)));
  board.setStand(next);
  const s = board.standSpot(next);
  focus(s, 'mid');
  await wait(0.5);
  await tween(0.5, (k) => st.group.scale.setScalar(Math.max(0.01, ease(k))));
  puffs.spawn(st.group.position.clone().setY(2), { color: 0xffd23f, count: 10, spread: 3, size: 0.9, rise: 2, life: 1 });
  st.bubble.say('¡Nos mudamos!', 1.4);
  await toast('¡El puesto se mudó!', 'Búscalo en otra parte de la isla', 1.4);
  focus(p.token.rest);
}

const EVENTS = [
  { title: '¡Arepa de la suerte!', text: 'Encontraste una arepa rellena de monedas.', run: (p) => give(p, 6, '¡Qué rica!') },
  { title: '¡Ay, la cartera!', text: 'Se te cayó la cartera en el río.', run: (p) => give(p, -5, '¡Mi plata!') },
  {
    title: '¡Mangazo!', text: 'Te cayó un mango en la cabeza y se te regaron 2 monedas.',
    run: async (p) => { p.token.dizzy = 2.5; await give(p, -2, '¡Mi coco!'); },
  },
  { title: '¡Brisa a favor!', text: 'El viento te empuja 3 casillas.', run: (p) => moveSteps(p, 3) },
  {
    title: '¡Brindan los panas!', text: 'Cada pana te regala 2 monedas.',
    run: async (p) => {
      for (const o of players) {
        if (o === p) continue;
        const n = Math.min(2, o.coins);
        o.coins -= n;
        p.coins += n;
      }
      await give(p, 0, '¡Gracias, panas!');
    },
  },
  {
    title: '¡Intercambio loco!', text: 'Cambias de casilla con otro pana.',
    run: async (p) => {
      const o = pick(players.filter((x) => x !== p));
      for (const who of [p, o]) puffs.spawn(who.token.group.position.clone().setY(1.5), { color: 0xc8a8ff, count: 10, spread: 1.5, size: 0.7, rise: 2, life: 0.8 });
      sound.whoosh();
      [p.tile, o.tile] = [o.tile, p.tile];
      layoutTokens();
      for (const who of [p, o]) who.token.group.position.copy(who.token.rest);
      o.token.bubble.say('¿Ah?', 1);
      focus(p.token.rest);
      await wait(1.2);
    },
  },
];

// The ÁRBOL tile under the big mango tree: give it a shake and see what falls.
async function shakeTree(p) {
  await toast('¡Sacude el árbol!', '¿Qué caerá?', 1.4, 'event');
  sound.whoosh();
  p.token.cheer = 0.8;
  await wait(0.6);
  const r = Math.random();
  if (r < 0.1) {
    p.mangos += 1;
    renderCards();
    sound.horn('fiesta');
    p.token.cheer = 1.6;
    puffs.spawn(p.token.group.position.clone().setY(p.token.rest.y + 3), { color: 0xffd23f, count: 14, spread: 2, size: 0.7, rise: 3, life: 1 });
    await toast('¡Cayó un Mango de oro!', `¡Gratis para ${escapeHtml(p.name)}!`, 1.8, 'gold');
  } else if (r < 0.4) {
    p.token.dizzy = 2;
    await give(p, -4, '¡Un coco!');
  } else {
    await give(p, 8, '¡Llovieron monedas!');
  }
}

async function landOn(p) {
  const kind = board.tiles[p.tile].kind;
  if (kind === 'blue' || kind === 'start') return give(p, 3);
  if (kind === 'tree') return shakeTree(p);
  if (kind === 'red') return give(p, -3, pick(['¡Ay!', '¡Qué pava!', '-3']));
  const ev = pick(EVENTS);
  sound.tone(660, 0, 0.12, 'triangle', 0.08);
  sound.tone(880, 0.12, 0.18, 'triangle', 0.08);
  await toast(ev.title, ev.text, 1.9, 'event');
  await ev.run(p);
}

async function takeTurn(p) {
  turnOf = p.i;
  renderCards();
  const tk = p.token;
  focus(tk.rest);
  await toast(p.human ? '¡Tu turno!' : `Turno de ${escapeHtml(p.name)}`, '', 1, `p${p.i}`);

  // two dice spin over the pana's head
  dice.forEach((d, k) => {
    d.mesh.visible = true;
    d.rolling = true;
    d.mesh.position.set(tk.rest.x + (k ? 0.95 : -0.95), tk.rest.y + 4.8, tk.rest.z);
  });
  tk.pin.visible = false;
  sound.unlock();
  if (isHuman(p)) await ask('¡Tira los dados!', [{ label: '¡Tirar!', key: ' ' }]);
  else await wait(0.9);
  const roll = () => 1 + Math.floor(Math.random() * 6);
  const a = roll(), b = roll(), n = a + b;
  dice[0].rolling = false;
  dice[0].show(a);
  sound.boing();
  await wait(0.35);
  dice[1].rolling = false;
  dice[1].show(b);
  sound.boing();
  const doubles = a === b;
  tk.bubble.say(doubles ? '¡DOBLES!' : n >= 10 ? pick(['¡Epa!', '¡Dale!', `¡${n}!`]) : n <= 3 ? pick(['¿Nada más?', '¡Qué pava!']) : `¡${n}!`, 0.9);
  await wait(0.9);
  if (doubles) {
    sound.horn('fiesta');
    await toast('¡Dobles!', '+5 monedas de premio', 1.2, 'gold');
    await give(p, 5);
  }
  for (const d of dice) d.mesh.visible = false;
  counter.sprite.position.set(tk.rest.x, tk.rest.y + 4.6, tk.rest.z);
  await moveSteps(p, n, { counted: true });
  counter.sprite.visible = false;
  tk.pin.visible = true;
  focus(tk.rest);
  await landOn(p);
  await wait(0.3);
}

// ======================================================================
// minigames
// ======================================================================
let view = boardView;
let mini = null;   // { game, state: 'wait'|'run'|'outro', left, winners }

async function playMinigame(def) {
  setFreeLook(false);
  turnOf = -1;
  setPlank('MINIJUEGO');
  setSign(def.title);
  $('mini-title').textContent = def.title;
  $('mini-howto').textContent = def.howto;
  $('mini-keys').innerHTML = def.keys.map(([k, what]) => `<span><kbd>${k}</kbd> ${what}</span>`).join('');
  $('mini-intro').classList.remove('hidden');
  if (isHuman(me)) await ask('', [{ label: '¡Listo!', key: ' ' }]);
  else await wait(2);
  $('mini-intro').classList.add('hidden');

  const game = def.create({ players, auto: AUTO });
  game.camera.aspect = innerWidth / innerHeight;
  game.camera.updateProjectionMatrix();
  miniScores = [0, 0, 0, 0];
  miniIcon = def.icon;
  cardMode = 'mini';
  renderCards();
  mini = { game, state: 'wait', left: def.time };
  game.update(0.0001, { x: 0, jump: false });
  view = { scene: game.scene, camera: game.camera, update: () => {} };
  document.body.classList.add('in-mini');
  setTimer(def.time);

  for (const n of ['3', '2', '1']) {
    $('count').textContent = n;
    sound.tone(440, 0, 0.12, 'square', 0.08);
    await wait(0.7);
  }
  $('count').textContent = '¡YA!';
  sound.tone(880, 0, 0.3, 'square', 0.08);
  wait(0.6).then(() => ($('count').textContent = ''));
  jumpPressed = false;
  mini.state = 'run';
  await new Promise((r) => (mini.finish = r));

  // who won?
  const scores = game.scores();
  let winners = game.winners ? game.winners() : [];
  if (!winners.length) {
    const best = Math.max(...scores);
    winners = best > 0 ? scores.map((s, i) => (s === best ? i : -1)).filter((i) => i >= 0) : [];
  }
  mini.state = 'outro';
  mini.winners = winners;
  setTimer(null);
  sound.horn('fiesta');
  $('winner').innerHTML = winners.length
    ? `<span class="crown">👑</span><small>${winners.length > 1 ? 'GANADORES' : 'GANADOR'}</small><b>${winners.map((i) => escapeHtml(players[i].name)).join(' · ')}</b><em>+10 MONEDAS</em>`
    : '<small>NADIE GANÓ</small><b>¡Qué pena, panas!</b>';
  $('winner').classList.remove('hidden');
  await wait(3);
  $('winner').classList.add('hidden');
  for (const i of winners) players[i].coins += 10;

  mini = null;
  view = boardView;
  document.body.classList.remove('in-mini');
  cardMode = 'board';
  setSign('');
  renderCards();
  // prizes on the board
  for (const i of winners) {
    players[i].token.cheer = 1.2;
    players[i].token.bubble.say('+10', 1.2);
  }
}

function updateMini(dt) {
  const { game } = mini;
  if (mini.state === 'run') {
    game.update(dt, minigameInput());
    mini.left -= dt;
    setTimer(Math.max(0, Math.ceil(mini.left)));
    miniScores = game.scores();
    renderCards();
    if (mini.left <= 0 || game.over?.()) {
      mini.state = 'done';
      mini.finish();
    }
  } else if (mini.state === 'outro') {
    game.outro(dt, mini.winners);
  }
}

// ======================================================================
// start and end
// ======================================================================
async function intro() {
  $('intro-players').innerHTML = players.map((p) =>
    `<div class="ip" style="--c:${p.color}"><img src="${p.portrait}" alt=""><b>P${p.i + 1}</b><span>${escapeHtml(p.name)}</span></div>`).join('');
  $('intro-rounds').textContent = ROUNDS;
  $('intro').classList.remove('hidden');
  await new Promise((r) => {
    $('start').onclick = r;
    const onKey = (k) => { if (k === ' ' || k === 'enter') r(); };
    actionWaiters.push(onKey);
    if (AUTO) wait(1).then(r);
  });
  actionWaiters = [];
  sound.unlock();
  $('intro').classList.add('hidden');
  $('hud').classList.remove('hidden');
}

async function results() {
  turnOf = -1;
  setPlank('¡FIN!');
  overview();
  const order = standings();
  const r = ranks();
  const champ = order[0];
  focus(champ.token.rest, 'close');
  champ.token.cheer = 99;
  sound.horn('fiesta');
  await wait(1.2);
  const tied = order.filter((p) => r[p.i] === 1);
  $('res-title').textContent = tied.length > 1 ? `¡Empate entre ${tied.map((p) => p.name).join(' y ')}!`
    : champ.human ? `¡Ganaste, ${champ.name}!` : `¡${champ.name} es el pana más pana!`;
  $('res-rows').innerHTML = order.map((p) => `
    <div class="rrow" style="--c:${p.color}">
      ${r[p.i] === 1 ? '<span class="crown">👑</span>' : ''}
      <span class="medal m${r[p.i]}">${r[p.i]}</span>
      <img src="${p.portrait}" alt="">
      <span class="rname">${escapeHtml(p.name)}</span>
      <span class="rv">${ICONS.mango}<b>${p.mangos}</b></span>
      <span class="rv">${ICONS.coin}<b>${p.coins}</b></span>
    </div>`).join('');
  $('results').classList.remove('hidden');
  $('again').onclick = () => location.reload();
}

async function main() {
  makePortraits();
  renderCards();
  await intro();
  if (ONLY) {
    for (;;) await playMinigame(ONLY);
  }
  for (round = 1; round <= ROUNDS; round++) {
    setPlank(`RONDA ${round}/${ROUNDS}`);
    overview();
    await toast(`Ronda ${round}`, round === ROUNDS ? '¡Última ronda!' : `de ${ROUNDS}`, 1.5, 'round');
    for (const p of players) await takeTurn(p);
    await playMinigame(FORCED || MINIGAMES[(round - 1) % MINIGAMES.length]);
  }
  await results();
}

// ======================================================================
const clock = new THREE.Clock();
let t = 0;
function frame() {
  const dt = Math.min(clock.getDelta(), 0.1) * SPEED;
  t += dt;
  stepJobs(dt);
  if (mini) updateMini(dt);
  view.update(dt, t);
  renderer.render(view.scene, view.camera);
  requestAnimationFrame(frame);
}

addEventListener('resize', () => {
  for (const c of [boardCam, mini?.game.camera].filter(Boolean)) {
    c.aspect = innerWidth / innerHeight;
    c.updateProjectionMatrix();
  }
  renderer.setSize(innerWidth, innerHeight);
});
boardCam.aspect = innerWidth / innerHeight;
boardCam.updateProjectionMatrix();

// ?debug: fastForward(60) runs a minute of game time without rendering
// (background tabs barely tick, so this is how to test a whole game)
async function fastForward(seconds, dt = 1 / 30) {
  for (let s = 0; s < seconds; s += dt) {
    t += dt;
    stepJobs(dt);
    if (mini) updateMini(dt);
    view.update(dt, t);
    await null;   // let the turn logic's awaits run
  }
}
if (DEBUG) Object.assign(window, { players, board, MINIGAMES, layoutTokens, fastForward, renderer, boardScene, boardCam });

frame();
main();
