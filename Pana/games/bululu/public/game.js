import { prepareScene } from '/engine/game-load.js';
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { sound, Puffs, Shockwaves, popCounter } from '/engine/fx.js';
import { loadAvatar, loadName, randomAvatar } from '/engine/avatar.js';
import { buildCharacter } from '/engine/models/characters/pana/avatar-model.js';
import { makeMango } from '/engine/models/props/mango.js';
import { createBoard, createToken, createDie, TILE_COUNT, FORK } from './board.js';
import { RIVER, SEA, MAP_BOUNDS, beachMask } from './island.js';
import atrapa from './minigames/atrapa.js';
import caigas from './minigames/caigas.js';
import caida from './minigames/caida.js';
import momia from './minigames/momia.js';
import coleo from './minigames/coleo.js';
import choque from './minigames/choque.js';
import embuste from './minigames/embuste.js';
import remada from './minigames/remada.js';
import raudal from './minigames/raudal.js';
import remolino from './minigames/remolino.js';
import chinazo from './minigames/chinazo.js';
import criollas from './minigames/criollas.js';
import { SKY_MODES } from './atmosphere.js';
import * as rules from './rules.js';
import { ICONS as SVG } from '/engine/icons.js';
import { COLORS, RIVALS, START_COINS, PRICE, DOUBLES_BONUS, TREE_COINS } from './rules.js';
import { createGameMenu, toggleMute } from '/engine/ui.js';
import { holdButton } from '/engine/touch.js';
import { pixelRatio, bindRenderer } from '/engine/settings.js';
import { inviteUrl, newRoomCode, roomFromUrl } from '/engine/invite.js';
import { BululuRoom } from './network.js';
import { IDLE_INPUT, seeded, withRandom } from './online-rules.js';
import { readPresentation, writePresentation } from './online-view.js';

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
let ROUNDS = Math.max(1, Math.min(20, Number(QS.get('rounds')) || 10));   // the lobby can change it
const DEBUG = QS.has('debug');
const MINIGAMES = [atrapa, caigas, caida, momia, coleo, choque, embuste, remada, raudal, remolino, chinazo, criollas];
const nextMinigame = rules.minigameBag(MINIGAMES);
const FORCED = MINIGAMES.find((m) => m.id === QS.get('mini'));
const ONLY = MINIGAMES.find((m) => m.id === QS.get('play'));
const code = roomFromUrl() || newRoomCode();
// Direct visits can choose online or bots. Hub/invite links join immediately.
let online = !!roomFromUrl(), room = null, started = false, checkpoint = null;
let promptSerial = 0, pendingChoice = null, resolveChoice = null, rejectChoice = null;
let miniSerial = 0, miniFrame = 0, requestingFrames = false;
let authority = 0;
let savedSky = 'day';
try { savedSky = localStorage.getItem('pana.bululu.sky') || 'day'; } catch { /* Storage can be disabled. */ }
const skyMode = QS.get('sky') || savedSky;

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
let me = players[0];
const isHuman = (p) => p.human && !AUTO;

// ---------- renderer ----------
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(pixelRatio(2));
bindRenderer(renderer, 2);
renderer.setSize(innerWidth, innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
document.body.prepend(renderer.domElement);

// ---------- board scene ----------
const boardScene = new THREE.Scene();
const boardCam = new THREE.PerspectiveCamera(50, innerWidth / innerHeight, 0.1, 1800);
const board = createBoard(boardScene, { skyMode });
function selectSky(mode, save = true) {
  if (!SKY_MODES.includes(mode)) return;
  board.atmosphere.setMode(mode);
  for (const b of $('sky').children) b.setAttribute('aria-pressed', String(b.dataset.sky === mode));
  if (save) try { localStorage.setItem('pana.bululu.sky', mode); } catch { /* Keep the selection for this session. */ }
}

// Esc pauses on game time: turns, timers, tweens and minigames all wait.
let paused = false;
const menu = createGameMenu({
  title: 'Bululú', heading: 'Pausa', sound,
  note: () => online ? 'La partida online sigue mientras abres el menú.' : 'La partida está en pausa.',
  invite: () => inviteUrl(code),
  controls: [['Espacio', 'Tirar los dados / saltar'], ['A D / ← →', 'Moverte en los minijuegos'], ['Tab', 'Ver el tablero'],
    ['Clic / Espacio', 'Estirar y soltar la china'], ['L', 'Cambiar la luz'], ['M', 'Sonido'], ['Esc', 'Pausa']],
  tips: ['Junta 20 monedas y cómprale un Mango de oro al puesto del árbol. Gana el pana con más mangos de oro.'],
  options: [{ id: 'sky', label: 'Luz de la isla', choices: [['day', 'Día'], ['night', 'Noche'], ['cycle', 'Ciclo']],
    get: () => board.atmosphere.mode, set: mode => selectSky(mode) }],
  actions: [
    { id: 'restart', label: 'Empezar de nuevo', kind: 'secondary', visible: () => !online, run: () => location.reload() },
    { id: 'rejoin', label: 'Volver a entrar a la sala', kind: 'secondary', visible: () => online, run: () => location.reload() },
  ],
  onOpen() { paused = true; for (const k in held) held[k] = false; aim.pull = aim.keyPull = false; },
  onClose() { paused = false; },
});
$('top-actions').prepend(menu.createButton({ id: 'menu', className: 'pk-btn menu-button' }));
$('invite').append(menu.createInviteButton());
for (const b of $('sky').children) b.onclick = () => selectSky(b.dataset.sky);
selectSky(board.atmosphere.mode, false);
const puffs = new Puffs(boardScene);
const shockwaves = new Shockwaves(boardScene);
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
      this.value = n;
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
  $('look').innerHTML = `${on ? 'Volver' : 'Ver tablero'} <kbd class="pk-kbd" data-pana-hint>Tab</kbd>`;
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
        // lookAt's +Z points back toward the camera: this is the result face.
        const q = new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().lookAt(boardCam.position, die.mesh.position, new THREE.Vector3(0, 1, 0)));
        die.mesh.quaternion.slerp(q, Math.min(1, dt * 12));
      }
    }
    puffs.update(dt);
    shockwaves.update(dt);
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
const wait = (s) => new Promise((r, reject) => jobs.push({ t: s, r, reject }));
const tween = (dur, fn) => new Promise((r, reject) => jobs.push({ t: dur, dur, fn, r, reject }));
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
  if (e.target.closest?.('.places')) return;
  const k = e.key.toLowerCase();
  if (k === ' ' || k.startsWith('arrow')) e.preventDefault();
  held[k] = true;
  // in 2D and aim minigames W / ↑ move, so only Space is the action
  if (!e.repeat && (k === ' ' || (!mini2d() && !miniAim() && (k === 'w' || k === 'arrowup')))) jumpPressed = true;
  if (!e.repeat && k === ' ' && miniAim()) aim.keyPull = true;
  if (k === 'm' && !e.repeat) toggleMute();
  if (k === 'l' && !e.repeat && view === boardView) {
    selectSky(SKY_MODES[(SKY_MODES.indexOf(board.atmosphere.mode) + 1) % SKY_MODES.length]);
  }
  if (k === 'tab') {
    e.preventDefault();
    if (!e.repeat) setFreeLook(!freeLook);
  }
  if (!e.repeat) for (const w of actionWaiters) w(k);
});
addEventListener('keyup', (e) => {
  const k = e.key.toLowerCase();
  held[k] = false;
  // Space pulls the china while held; letting go fires
  if (k === ' ' && aim.keyPull) {
    aim.keyPull = false;
    aim.fire = true;
  }
});
addEventListener('pointerdown', () => sound.unlock(), { once: false });
addEventListener('blur', () => {
  for (const key in held) held[key] = false;
  jumpPressed = false;
  aim.pull = aim.keyPull = aim.fire = false;
});

// on-screen buttons for touch screens during minigames
// (engine/touch.js: a finger sliding off the button still lets go)
for (const [id, key] of [['t-left', 'a'], ['t-right', 'd'], ['t-jump', ' '], ['t2-up', 'w'], ['t2-down', 's'], ['t2-left', 'a'], ['t2-right', 'd'], ['t2-go', ' ']]) {
  holdButton($(id), { down: () => { held[key] = true; if (key === ' ') jumpPressed = true; }, up: () => { held[key] = false; } });
}

// Aim minigames (`input: 'aim'`) get a reticle in NDC (−1..1) instead. The mouse
// moves it and a press pulls; WASD / arrows steer it and Space pulls; on touch,
// dragging anywhere aims and lifting the finger fires. The handlers live on the
// canvas only while such a minigame runs, so the board and minimap never see them.
const aim = { x: 0, y: 0, pull: false, keyPull: false, fire: false, keyT: 0, pointer: null, touch: null };
const miniAim = () => mini?.def.input === 'aim';
const clampAim = (v) => Math.max(-1, Math.min(1, v));
const canvasEl = renderer.domElement;
function aimAtPointer(e) {
  const r = canvasEl.getBoundingClientRect();
  aim.x = clampAim(((e.clientX - r.left) / r.width) * 2 - 1);
  aim.y = clampAim(1 - ((e.clientY - r.top) / r.height) * 2);
}
const aimHandlers = {
  pointerdown(e) {
    if (paused || aim.pointer != null || (e.pointerType === 'mouse' && e.button !== 0)) return;
    e.preventDefault();
    sound.unlock();
    try { canvasEl.setPointerCapture(e.pointerId); } catch { /* synthetic or already gone */ }
    aim.pointer = e.pointerId;
    if (e.pointerType === 'mouse') aimAtPointer(e);
    else aim.touch = { x: e.clientX, y: e.clientY };
    aim.pull = true;
  },
  pointermove(e) {
    if (e.pointerType === 'mouse') return aimAtPointer(e);
    if (aim.pointer !== e.pointerId || !aim.touch) return;
    // a finger would hide the reticle, so touch drags it (a bit faster than the finger)
    const r = canvasEl.getBoundingClientRect();
    aim.x = clampAim(aim.x + ((e.clientX - aim.touch.x) / r.width) * 3);
    aim.y = clampAim(aim.y - ((e.clientY - aim.touch.y) / r.height) * 3);
    aim.touch = { x: e.clientX, y: e.clientY };
  },
  pointerup(e) {
    if (aim.pointer !== e.pointerId) return;
    aim.pointer = aim.touch = null;
    if (aim.pull) aim.fire = true;
    aim.pull = false;
  },
  pointercancel(e) {
    if (aim.pointer !== e.pointerId) return;
    aim.pointer = aim.touch = null;
    aim.pull = false;
  },
};
function bindAim(on) {
  for (const [type, fn] of Object.entries(aimHandlers)) canvasEl[on ? 'addEventListener' : 'removeEventListener'](type, fn);
  Object.assign(aim, { x: 0, y: 0, pull: false, keyPull: false, fire: false, keyT: 0, pointer: null, touch: null });
}
const IDLE_AIM = { aim: { x: 0, y: 0 }, pull: false, fire: false };

// 1D minigames get { x, jump }; a module with `input: '2d'` also gets z (W/S, ↑/↓)
const mini2d = () => mini?.def.input === '2d';
function minigameInput(dt = 0) {
  const x = (held.d || held.arrowright ? 1 : 0) - (held.a || held.arrowleft ? 1 : 0);
  const jump = jumpPressed;
  jumpPressed = false;
  if (miniAim()) {
    // keys steer the reticle, quick to start and faster the longer they're held
    const y = (held.w || held.arrowup ? 1 : 0) - (held.s || held.arrowdown ? 1 : 0);
    aim.keyT = x || y ? aim.keyT + dt : 0;
    const speed = 0.8 + Math.min(1, aim.keyT / 0.45) * 1.5;
    aim.x = clampAim(aim.x + x * speed * dt);
    aim.y = clampAim(aim.y + y * speed * dt);
    const fire = aim.fire;
    aim.fire = false;
    return { aim: { x: aim.x, y: aim.y }, pull: aim.pull || aim.keyPull, fire };
  }
  if (!mini2d()) return { x, jump };
  const z = (held.w || held.arrowup ? 1 : 0) - (held.s || held.arrowdown ? 1 : 0);
  return { x, z, jump };
}

// ======================================================================
// UI kit
// ======================================================================
const MANGO_SVG = '<svg viewBox="0 0 40 40" class="ico"><path d="M8 24c0-10 9-17 18-15 6 1 8 7 7 13-2 9-11 13-18 11-4-1-7-4-7-9z" fill="#ffc629" stroke="#9a6400" stroke-width="3"/><path d="M27 9c1-3 4-5 7-5-1 3-3 5-7 5z" fill="#3a9d3a"/><path d="M14 17c2-3 5-4 8-4" stroke="#fff3b0" stroke-width="3" fill="none" stroke-linecap="round"/></svg>';
const ICONS = {
  coin: '<i class="ico coin"></i>',
  mango: MANGO_SVG,
  jump: '<i class="ico jump">⤒</i>',
  card: SVG.card.replace('pk-ico', 'ico'),
  relic: SVG.relic.replace('pk-ico', 'ico'),
  bull: SVG.bull.replace('pk-ico', 'ico'),
  car: SVG.car.replace('pk-ico', 'ico'),
  mummy: SVG.mummy.replace('pk-ico', 'ico'),
  canoe: SVG.canoe.replace('pk-ico', 'ico'),
  whirl: SVG.whirl.replace('pk-ico', 'ico'),
  iguana: SVG.iguana.replace('pk-ico', 'ico'),
};

let cardMode = 'board';
let miniScores = [0, 0, 0, 0];
let miniIcon = 'mango';
let turnOf = -1;
let lastCards = '';

const standings = () => rules.standings(players);
const ranks = () => rules.ranks(players);

function renderCards() {
  const r = ranks();
  const best = Math.max(...miniScores);
  const key = JSON.stringify([cardMode, turnOf, miniScores, players.map((p) => [p.coins, p.mangos])]);
  if (key === lastCards) return;
  lastCards = key;
  $('cards').innerHTML = players.map((p) => {
    const crown = cardMode === 'board' ? r[p.i] === 1 && (p.mangos || p.coins !== START_COINS) : best > 0 && miniScores[p.i] === best;
    const stats = cardMode === 'board'
      ? `<span class="coins">${ICONS.coin}<b>${p.coins}</b></span><span class="mangos">${ICONS.mango}<b>${p.mangos}</b></span>`
      : `<span class="big">${ICONS[miniIcon]}<b>${miniScores[p.i]}</b></span>`;
    return `<div class="pcard${turnOf === p.i ? ' turn' : ''}" style="--c:${p.color}">
      ${cardMode === 'board' ? `<span class="medal m${r[p.i]}">${r[p.i]}</span>` : ''}
      ${crown ? `<span class="crown">${SVG.crown}</span>` : ''}
      ${turnOf === p.i ? `<span class="tag">${p === me ? 'Tu turno' : 'Turno'}</span>` : ''}
      <img src="${p.portrait || ''}" alt="">
      <div class="info"><small>${escapeHtml(p.name)}</small><div class="vals">${stats}</div></div>
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
  if (online) {
    const player = players[turnOf] || players.find(p => p.seat === room.hostId);
    pendingChoice = { id: `${room.id}:${++promptSerial}`, seat: player?.seat, text: text.replace(/<[^>]*>/g, ''), options, auto };
    room.prompt = pendingChoice;
    showOnlinePrompt(pendingChoice);
    room.publish(captureOnline());
    return new Promise((resolve, reject) => {
      resolveChoice = resolve; rejectChoice = reject;
      if (AUTO || !room.members.has(player?.seat)) wait(delay).then(() => finishChoice(auto)).catch(ignoreCancelled);
    });
  }
  const el = $('prompt');
  el.innerHTML = `<p>${text}</p><div class="row">${options.map((o, i) =>
    `<button data-i="${i}" class="pk-btn${i === 0 ? ' pk-btn--primary primary' : ''}">${o.label}${o.key ? ` <kbd class="pk-kbd" data-pana-hint>${o.key === ' ' ? 'Espacio' : o.key.toUpperCase()}</kbd>` : ''}</button>`).join('')}</div>`;
  el.classList.toggle('bare', !text);
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
  board.pressTile(to);
  shockwaves.ring(dest, { color: 0xffffff, maxRadius: 2.1, duration: 0.36, opacity: 0.65 });
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
const stepsTo = (from, goal) => rules.stepsTo(board.tiles, from, goal);

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
    take = rules.botTakesHill({ coins: p.coins, toll: FORK.toll, viaHill, viaShore, whim: Math.random() }) ? 1 : 0;
    await wait(0.8);
  }
  board.highlight = [];
  if (take !== 1) return shore;
  await give(p, -FORK.toll, '¡Peaje!');
  return hill;
}

async function give(p, n, line) {
  const real = rules.addCoins(p, n);
  p.token.bubble.say(line || (n >= 0 ? `+${n}` : `${n}`), 1);
  if (n >= 0) {
    sound.pickup(Math.min(5, Math.max(0, Math.floor(n / 2))));
    p.token.cheer = 0.5;
    puffs.spawn(p.token.group.position.clone().setY(2.5), { color: 0xffc629, count: 6, spread: 1.2, size: 0.4, rise: 2, life: 0.7 });
    shockwaves.sparkle(p.token.group.position.clone().setY(2.2), { color: 0xffd23f });
  } else {
    sound.bonk(0.6);
    p.token.dizzy = real < 0 ? 0.8 : 0;
  }
  renderCards();
  if (n > 0) popCounter($('cards')?.children[p.i]?.querySelector('.coins b'));
  await wait(0.9);
}

async function visitStand(p, landed) {
  const st = board.stand;
  focus(p.token.rest.clone().lerp(st.group.position, 0.5), 'close');
  if (!rules.canBuy(p)) {
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
  rules.buyMango(p);
  renderCards();
  popCounter($('cards')?.children[p.i]?.querySelector('.mangos b'));
  // the golden mango arcs from the stand into the pana's arms
  const mg = makeMango({ gold: true });
  boardScene.add(mg);
  const from = st.group.position.clone().setY(4);
  const to = p.token.group.position.clone().setY(3);
  sound.chestOpen('gold');
  sound.horn('fiesta');
  await tween(0.9, (k) => {
    mg.position.lerpVectors(from, to, k);
    mg.position.y += Math.sin(k * Math.PI) * 4;
    mg.rotation.y += 0.3;
  });
  boardScene.remove(mg);
  puffs.spawn(to, { color: 0xffd23f, count: 12, spread: 2, size: 0.6, rise: 3, life: 1 });
  shockwaves.ring(p.token.group.position, { color: 0xffe066, maxRadius: 4.2, duration: 0.65 });
  shockwaves.sparkle(to, { color: 0xffe066 });
  p.token.cheer = 1.6;
  p.token.bubble.say('¡MANGO DE ORO!', 1.5);
  await toast(`¡${escapeHtml(p.name)} tiene un Mango de oro!`, `Ya van ${p.mangos}`, 1.6, 'gold');
  await moveStand(p);
}

async function moveStand(p) {
  const st = board.stand;
  // somewhere the panas will reach soon: ahead of them on average, but not
  // right under anyone's nose (the board is big; behind them is a whole lap)
  const next = pick(rules.standCandidates({
    tileCount: TILE_COUNT, standTile: board.standTile, tiles: board.tiles, players,
    isBad: (i) => board.standSpot(i).bad >= 30,
  }));
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
      rules.brindis(players, p);
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
  const fall = rules.treeOutcome(Math.random());
  if (fall === 'mango') {
    p.mangos += 1;
    renderCards();
    sound.horn('fiesta');
    p.token.cheer = 1.6;
    puffs.spawn(p.token.group.position.clone().setY(p.token.rest.y + 3), { color: 0xffd23f, count: 14, spread: 2, size: 0.7, rise: 3, life: 1 });
    await toast('¡Cayó un Mango de oro!', `¡Gratis para ${escapeHtml(p.name)}!`, 1.8, 'gold');
  } else if (fall === 'coconut') {
    p.token.dizzy = 2;
    await give(p, TREE_COINS.coconut, '¡Un coco!');
  } else {
    await give(p, TREE_COINS.coins, '¡Llovieron monedas!');
  }
}

async function landOn(p) {
  const kind = board.tiles[p.tile].kind;
  const coins = rules.tileCoins(kind);
  if (coins > 0) return give(p, coins);
  if (coins < 0) return give(p, coins, pick(['¡Ay!', '¡Qué pava!', `${coins}`]));
  if (kind === 'tree') return shakeTree(p);
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
  await toast(online ? `Turno de ${escapeHtml(p.name)}` : p.human ? '¡Tu turno!' : `Turno de ${escapeHtml(p.name)}`, '', 1, `p${p.i}`);

  // two dice spin over the pana's head
  dice.forEach((d, k) => {
    d.mesh.visible = true;
    d.rolling = true;
    d.mesh.position.set(tk.rest.x + (k ? 0.95 : -0.95), tk.rest.y + 4.8, tk.rest.z);
  });
  tk.pin.visible = false;
  sound.unlock();
  if (isHuman(p)) await ask('', [{ label: '¡Tira los dados!', key: ' ' }]);
  else await wait(0.9);
  const { a, b, n, doubles } = rules.rollDice();
  dice[0].rolling = false;
  dice[0].value = a; dice[0].show(a);
  sound.boing();
  await wait(0.35);
  dice[1].rolling = false;
  dice[1].value = b; dice[1].show(b);
  sound.boing();
  tk.bubble.say(doubles ? '¡DOBLES!' : n >= 10 ? pick(['¡Epa!', '¡Dale!', `¡${n}!`]) : n <= 3 ? pick(['¿Nada más?', '¡Qué pava!']) : `¡${n}!`, 0.9);
  await wait(0.9);
  if (doubles) {
    sound.horn('fiesta');
    await toast('¡Dobles!', `+${DOUBLES_BONUS} monedas de premio`, 1.2, 'gold');
    await give(p, DOUBLES_BONUS);
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
  $('mini-keys').innerHTML = def.keys.map(([k, what]) => `<span><kbd class="pk-kbd">${k}</kbd> ${what}</span>`).join('');
  $('mini-intro').classList.remove('hidden');
  if (isHuman(me)) await ask('', [{ label: '¡Listo!', key: ' ' }]);
  else await wait(2);
  $('mini-intro').classList.add('hidden');

  const spec = online ? { serial: `${room.id}-${++miniSerial}-${Date.now()}`, seed: Math.floor(Math.random() * 2 ** 32),
    id: def.id, players: playerData(), auto: AUTO, aspect: 16 / 9 } : null;
  const game = createMini(def, spec);
  game.camera.aspect = spec?.aspect || innerWidth / innerHeight;
  game.camera.updateProjectionMatrix();
  miniScores = [0, 0, 0, 0];
  miniIcon = def.icon;
  cardMode = 'mini';
  renderCards();
  mini = { def, game, spec, authoritative: true, state: 'wait', left: def.time };
  if (online) { room.history = []; room.inputs.clear(); room.publish(captureOnline()); }
  game.update(0.0001, online ? players.map(() => IDLE_INPUT) : def.input === 'aim' ? IDLE_AIM : { x: 0, jump: false });
  view = { scene: game.scene, camera: game.camera, update: () => {} };
  document.body.classList.add('in-mini');
  document.body.classList.toggle('mini-2d', def.input === '2d');
  document.body.classList.toggle('mini-aim', def.input === 'aim');
  $('reticles').innerHTML = '';
  if (def.input === 'aim') bindAim(true);
  setTimer(def.time);

  for (const n of ['3', '2', '1']) {
    $('count').textContent = n;
    sound.tone(440, 0, 0.12, 'square', 0.08);
    await wait(0.7);
  }
  $('count').textContent = '¡YA!';
  sound.tone(880, 0, 0.3, 'square', 0.08);
  wait(0.6).then(() => ($('count').textContent = '')).catch(ignoreCancelled);
  jumpPressed = false;
  aim.fire = aim.keyPull = false;
  mini.state = 'run';
  await new Promise((r, reject) => { mini.finish = r; mini.abort = reject; });

  // who won?
  const scores = game.scores();
  let winners = game.winners ? game.winners() : [];
  if (!winners.length) {
    const best = Math.max(...scores);
    winners = best > 0 ? scores.map((s, i) => (s === best ? i : -1)).filter((i) => i >= 0) : [];
  }
  mini.state = 'outro';
  mini.winners = winners;
  // the pointer is the board's again (and the cursor comes back)
  if (def.input === 'aim') bindAim(false);
  document.body.classList.remove('mini-aim');
  setTimer(null);
  sound.horn('fiesta');
  $('winner').innerHTML = winners.length
    ? `<span class="crown">${SVG.crown}</span><small>${winners.length > 1 ? 'GANADORES' : 'GANADOR'}</small><b>${winners.map((i) => escapeHtml(players[i].name)).join(' · ')}</b><em>+10 MONEDAS</em>`
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

// Aim minigames draw a reticle per pana over the canvas: { x, y } in NDC, its
// color, how far the china is pulled (0..1), and for you the stones left.
function drawReticles(list) {
  const box = $('reticles');
  while (box.children.length < list.length) {
    const el = document.createElement('div');
    el.className = 'reticle';
    el.innerHTML = '<i></i><span class="ammo"></span>';
    box.append(el);
  }
  list.forEach((r, i) => {
    const el = box.children[i];
    el.style.setProperty('--c', r.color);
    el.style.setProperty('--pull', r.pull.toFixed(2));
    el.style.transform = `translate(${((r.x + 1) / 2) * innerWidth}px, ${((1 - r.y) / 2) * innerHeight}px)`;
    el.classList.toggle('me', !!r.me);
    el.classList.toggle('empty', r.ammo === 0);
    if (r.me) {
      const pips = r.ammo == null ? '' : '<b></b>'.repeat(r.ammo) + '<b class="used"></b>'.repeat(Math.max(0, (r.max || 3) - r.ammo));
      if (el.dataset.pips !== pips) el.querySelector('.ammo').innerHTML = el.dataset.pips = pips;
    }
  });
}

function updateMini(dt) {
  const { game } = mini;
  if (mini.state === 'run') {
    game.update(dt, online ? room.takeInputs(players) : minigameInput(dt));
    if (game.reticles) drawReticles(game.reticles());
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
    `<div class="ip" style="--c:${p.color}"><img src="${p.portrait}" alt=""><b>P${p.i + 1}</b><span>${p === me ? 'Tú' : escapeHtml(p.name)}</span></div>`).join('');
  const pickRounds = (n) => {
    if (online && !room?.isHost) return;
    ROUNDS = n;
    $('intro-rounds').textContent = $('intro-rounds-n').textContent = n;
    for (const b of $('intro-pick').children) b.setAttribute('aria-pressed', String(Number(b.dataset.rounds) === n));
  };
  for (const b of $('intro-pick').children) b.onclick = () => pickRounds(Number(b.dataset.rounds));
  pickRounds(ROUNDS);
  if (!online) lobbyRoster();
  $('intro').classList.remove('hidden');
  $('online').onclick = connectOnline;
  $('practice').onclick = () => { const url = new URL(location.href); url.searchParams.delete('room'); url.searchParams.delete('lead'); location.href = url.href; };
  if (online) connectOnline();
  await new Promise((r) => {
    const start = () => { if (online) { if (room?.isHost && !started) beginOnline(null); } else r(); };
    $('start').onclick = start;
    const onKey = (k) => { if (k === ' ' || k === 'enter') start(); };
    actionWaiters.push(onKey);
    if (AUTO && !online) wait(1).then(r);
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
  drawResults();
}

function drawResults() {
  const order = standings(), r = ranks(), champ = order[0];
  const tied = order.filter((p) => r[p.i] === 1);
  $('res-title').textContent = tied.length > 1 ? `¡Empate entre ${tied.map((p) => p.name).join(' y ')}!`
    : champ === me ? `¡Ganaste, ${champ.name}!` : `¡${champ.name} es el pana más pana!`;
  $('res-rows').innerHTML = order.map((p) => `
    <div class="rrow pk-row${p === me ? ' is-me' : ''}" style="--c:${p.color}">
      ${r[p.i] === 1 ? `<span class="crown">${SVG.crown}</span>` : ''}
      <span class="medal m${r[p.i]}">${r[p.i]}</span>
      <img src="${p.portrait}" alt="">
      <span class="rname">${escapeHtml(p.name)}</span>
      <span class="rv">${ICONS.mango}<b>${p.mangos}</b></span>
      <span class="rv">${ICONS.coin}<b>${p.coins}</b></span>
    </div>`).join('');
  $('results').classList.remove('hidden');
  $('again').disabled = online && !room.isHost;
  $('again').textContent = online && !room.isHost ? 'Esperando al anfitrión…' : 'Otra vez';
  $('again').onclick = () => online ? room.isHost && beginOnline(null) : location.reload();
}

async function main() {
  makePortraits();
  renderCards();
  await intro();
  started = true;
  await runBoard();
}

async function runBoard(resume) {
  const only = resume?.only || ONLY?.id;
  if (only) {
    for (;;) {
      saveCheckpoint('mini', 0, MINIGAMES.find(m => m.id === only), only);
      await playMinigame(MINIGAMES.find(m => m.id === only));
    }
  }
  for (round = resume?.round || 1; round <= ROUNDS; round++) {
    setPlank(`RONDA ${round} / ${ROUNDS}`);
    overview();
    await toast(`Ronda ${round}`, round === ROUNDS ? '¡Última ronda!' : `de ${ROUNDS}`, 1.5, 'round');
    const first = resume?.stage === 'mini' ? players.length : resume?.next || 0;
    for (let i = first; i < players.length; i++) {
      if (online) syncRoster();
      saveCheckpoint('turn', i);
      await takeTurn(players[i]);
    }
    const def = MINIGAMES.find(m => m.id === resume?.minigame) || FORCED || nextMinigame();
    saveCheckpoint('mini', players.length, def);
    await playMinigame(def);
    resume = null;
  }
  saveCheckpoint('done', 0);
  await results();
}

// Online board authority and presentation. Minigames replay the host's exact
// input steps with a game-only random stream, independent of rendering/sound.
const CANCELLED = new Error('Bululú host changed');
function ignoreCancelled(error) { if (error !== CANCELLED) { console.error(error); $('room-status').textContent = 'No se pudo continuar la partida. Vuelve a entrar a la sala.'; } }
function playerData() {
  return players.map(({ i, color, avatar, human, name, coins, mangos, tile, seat }) => ({ i, color, avatar, human, name, coins, mangos, tile, seat }));
}
function applyPlayers(data) {
  let changed = false;
  data.forEach((p, i) => {
    const old = players[i], rebuild = JSON.stringify([old.avatar, old.name]) !== JSON.stringify([p.avatar, p.name]);
    Object.assign(old, p);
    if (rebuild) {
      boardScene.remove(old.token.group); old.token.pana.dispose();
      old.token = createToken(old, i); old.token.dizzy = old.token.cheer = 0;
      boardScene.add(old.token.group); changed = true;
    }
  });
  me = players.find(p => p.seat === room?.id) || null;
  layoutTokens();
  if (changed) { makePortraits(); lastCards = ''; }
}
function lobbyRoster() {
  $('intro-players').innerHTML = players.map(p =>
    `<div class="ip" style="--c:${p.color}"><img src="${p.portrait}" alt=""><b>P${p.i + 1}</b><span>${escapeHtml(p.name)}${p === me ? ' · Tú' : p.human ? '' : ' · Bot'}</span></div>`).join('');
  $('intro-rounds').textContent = $('intro-rounds-n').textContent = ROUNDS;
  for (const b of $('intro-pick').children) {
    b.disabled = online && (!room?.isHost || started);
    b.setAttribute('aria-pressed', String(Number(b.dataset.rounds) === ROUNDS));
  }
  $('start').disabled = online && (!room?.isHost || started);
  $('start').textContent = online ? room?.isHost ? '¡A jugar!' : 'Esperando al anfitrión…' : 'Jugar con bots';
}
function syncRoster() {
  if (!room?.isHost) return;
  const next = playerData();
  for (const p of next) if (!room.members.has(p.seat)) p.human = false;
  for (const m of room.members.values()) {
    let p = next.find(p => p.seat === m.id);
    p ||= next.find(p => !p.human);
    if (p) Object.assign(p, { seat: m.id, name: m.name, avatar: m.avatar, human: true });
  }
  applyPlayers(next); lobbyRoster(); renderCards();
}
function finishChoice(choice) {
  if (!resolveChoice) return;
  const resolve = resolveChoice;
  resolveChoice = rejectChoice = null; pendingChoice = room.prompt = null;
  $('prompt').classList.add('hidden'); actionWaiters = [];
  resolve(choice);
}
let shownPrompt = '';
function showOnlinePrompt(prompt) {
  const key = JSON.stringify([prompt, room.id]);
  if (shownPrompt === key) return;
  shownPrompt = key; actionWaiters = [];
  const el = $('prompt'); el.replaceChildren(); el.classList.toggle('hidden', !prompt);
  if (!prompt) return;
  const mine = prompt.seat === room.id;
  const text = document.createElement('p');
  text.textContent = mine ? prompt.text : `Esperando a ${players.find(p => p.seat === prompt.seat)?.name || 'tu pana'}…`;
  el.append(text); el.classList.toggle('bare', mine && !prompt.text);
  if (!mine) return;
  const row = document.createElement('div'); row.className = 'row'; el.append(row);
  prompt.options.forEach((option, i) => {
    const b = document.createElement('button'); b.className = 'pk-btn' + (i === 0 ? ' pk-btn--primary' : '');
    b.textContent = option.label; b.onclick = () => room.choose(prompt.id, i); row.append(b);
  });
  actionWaiters.push(k => {
    const i = prompt.options.findIndex(o => o.key === k || (o.key === ' ' && k === 'enter'));
    if (i >= 0) room.choose(prompt.id, i);
  });
}
function saveCheckpoint(stage, next, def, only) {
  if (!online) return;
  if (!mini) syncRoster();
  checkpoint = { stage, next, round, rounds: ROUNDS, players: playerData(), stand: board.standTile, minigame: def?.id, only };
  room.publish(captureOnline());
}
function captureOnline() {
  return { started, rounds: ROUNDS, round, players: playerData(), checkpoint, prompt: pendingChoice,
    turnOf, cardMode, miniScores, miniIcon, stand: board.standTile, highlight: board.highlight,
    camera: { pos: cam.wantPos.toArray(), look: cam.wantLook.toArray() },
    tokens: players.map(p => ({ pos: p.token.group.position.toArray(), rest: p.token.rest.toArray(),
      rotation: p.token.group.rotation.y, cheer: p.token.cheer, dizzy: p.token.dizzy, pin: p.token.pin.visible })),
    dice: dice.map(d => ({ pos: d.mesh.position.toArray(), visible: d.mesh.visible, rolling: d.rolling, value: d.value })),
    counter: { pos: counter.sprite.position.toArray(), visible: counter.sprite.visible, value: counter.value },
    mini: mini?.spec ? { ...mini.spec, state: mini.state, left: mini.left, winners: mini.winners, frames: room.history.length } : null,
    presentation: readPresentation() };
}
function createMini(def, spec) {
  if (!spec) return def.create({ players, auto: AUTO });
  const rng = seeded(spec.seed);
  const game = withRandom(rng, () => def.create({ players: spec.players, auto: spec.auto, aspect: spec.aspect, localIndex: me?.i ?? -1 }));
  for (const method of ['update', 'outro']) {
    const run = game[method].bind(game);
    game[method] = (dt, input) => {
      withRandom(rng, () => run(dt, input));
      if (room.isHost) room.frame(spec.serial, { method, dt, input });
    };
  }
  return game;
}
function clearMini() {
  if (mini?.def.input === 'aim') bindAim(false);
  mini = null; view = boardView; miniFrame = 0; requestingFrames = false;
  document.body.classList.remove('in-mini', 'mini-2d', 'mini-aim');
  $('reticles').replaceChildren(); setTimer(null);
}
function applyOnline(state) {
  if (authority) stopAuthority();
  started = state.started; ROUNDS = state.rounds; round = state.round;
  checkpoint = state.checkpoint;
  applyPlayers(state.players); lobbyRoster();
  $('intro').classList.toggle('hidden', started); $('hud').classList.toggle('hidden', !started);
  turnOf = state.turnOf; cardMode = state.cardMode; miniScores = state.miniScores; miniIcon = state.miniIcon;
  if (board.standTile !== state.stand) board.setStand(state.stand);
  board.highlight = state.highlight || [];
  if (!freeLook) { cam.wantPos.fromArray(state.camera.pos); cam.wantLook.fromArray(state.camera.look); }
  state.tokens.forEach((v, i) => {
    const tk = players[i].token;
    tk.rest.fromArray(v.pos); tk.group.rotation.y = v.rotation; tk.cheer = v.cheer; tk.dizzy = v.dizzy; tk.pin.visible = v.pin;
  });
  state.dice.forEach((v, i) => {
    const d = dice[i]; d.mesh.position.fromArray(v.pos); d.mesh.visible = v.visible; d.rolling = v.rolling;
    if (v.value) {
      d.value = v.value;
      // Spinning changes the painted face even when consecutive results match.
      if (!v.rolling) d.show(v.value);
    }
  });
  if (state.counter.value && state.counter.value !== counter.value) counter.set(state.counter.value);
  counter.sprite.position.fromArray(state.counter.pos); counter.sprite.visible = state.counter.visible;
  if (!state.mini) { if (mini) clearMini(); }
  else {
    const spec = state.mini;
    if (mini?.spec?.serial !== spec.serial) {
      clearMini(); setFreeLook(false);
      const def = MINIGAMES.find(m => m.id === spec.id);
      mini = { def, spec, game: createMini(def, spec), authoritative: false, state: spec.state, left: spec.left };
      view = { scene: mini.game.scene, camera: mini.game.camera, update() {} };
      document.body.classList.add('in-mini');
      document.body.classList.toggle('mini-2d', def.input === '2d');
      document.body.classList.toggle('mini-aim', def.input === 'aim' && spec.state !== 'outro');
      if (def.input === 'aim') bindAim(true);
    }
    if (spec.state === 'outro' && mini.state !== 'outro') { bindAim(false); document.body.classList.remove('mini-aim'); }
    mini.state = spec.state; mini.left = spec.left;
    setTimer(spec.state === 'outro' ? null : Math.max(0, Math.ceil(spec.left)));
    if (miniFrame < spec.frames && !requestingFrames) { requestingFrames = true; room.catchup(spec.serial, miniFrame); }
  }
  renderCards(); writePresentation(state.presentation); showOnlinePrompt(state.prompt);
  const waiting = started && (!me || (mini && !mini.spec.players.some(p => p.seat === room.id)));
  if (waiting) {
    $('online-status').textContent = 'Estás viendo la partida. Te unes en el próximo turno o minijuego.';
    $('online-status').classList.remove('hidden');
  } else if (room.connected) $('online-status').classList.add('hidden');
  $('results').classList.toggle('hidden', !state.presentation.results);
  if (state.presentation.results) drawResults();
}
function applyFrames(message) {
  if (mini?.spec?.serial !== message.serial) return;
  if (message.from > miniFrame) {
    if (!requestingFrames) { requestingFrames = true; room.catchup(message.serial, miniFrame); }
    return;
  }
  requestingFrames = false;
  const muted = sound.muted;
  // Catch-up batches must not play a whole minute of effects at once.
  if (message.frames.length > 1) sound.muted = true;
  try {
    for (let i = Math.max(0, miniFrame - message.from); i < message.frames.length; i++) {
      const f = message.frames[i]; mini.game[f.method](f.dt, f.input); miniFrame++;
    }
  } finally { sound.muted = muted; }
  if (mini.game.reticles && mini.state !== 'outro') drawReticles(mini.game.reticles());
}
function stopAuthority() {
  authority = 0;
  for (const j of jobs) j.reject?.(CANCELLED);
  jobs = []; rejectChoice?.(CANCELLED); resolveChoice = rejectChoice = null;
  mini?.abort?.(CANCELLED); clearMini(); pendingChoice = null;
}
function beginOnline(resume) {
  stopAuthority(); authority = 1; started = true;
  if (resume) {
    applyPlayers(resume.players); ROUNDS = resume.rounds; round = resume.round;
    board.setStand(resume.stand);
  } else {
    round = 1;
    applyPlayers(playerData().map(p => ({ ...p, coins: START_COINS, mangos: 0, tile: 0 })));
    board.setStand(7);
  }
  syncRoster(); layoutTokens();
  for (const p of players) { p.token.group.position.copy(p.token.rest); p.token.hopping = false; p.token.pin.visible = true; }
  for (const d of dice) d.mesh.visible = false;
  counter.sprite.visible = false; board.stand.group.scale.setScalar(1);
  for (const id of ['intro', 'prompt', 'winner', 'results', 'toast', 'mini-intro']) $(id).classList.add('hidden');
  $('hud').classList.remove('hidden'); $('count').textContent = ''; cardMode = 'board'; setSign(''); actionWaiters = [];
  if (!resume) saveCheckpoint(ONLY ? 'mini' : 'turn', 0, ONLY, ONLY?.id);
  if (resume?.stage === 'done') { drawResults(); room.publish(captureOnline()); }
  else runBoard(resume).catch(ignoreCancelled);
}
function connectOnline() {
  if (room) return;
  online = true;
  const url = new URL(location.href); url.searchParams.set('room', code); history.replaceState(null, '', url);
  $('online').classList.add('hidden'); $('invite').classList.remove('hidden'); $('practice').classList.remove('hidden');
  room = new BululuRoom({ code, name: loadName(), avatar: loadAvatar(),
    onStatus(text, bad) {
      $('room-status').textContent = text;
      $('online-status').textContent = text;
      $('online-status').classList.toggle('hidden', !bad);
    },
    events: {
      host(state) {
        if (state?.started && state.checkpoint) beginOnline(state.checkpoint);
        else if (started) beginOnline(null); // A retry reached a fresh room: drop the stale game.
        else { syncRoster(); room.publish(captureOnline()); }
      },
      members() { if (room.isHost && !mini) syncRoster(); },
      state: applyOnline, choice: finishChoice, frames: applyFrames,
    },
  });
  lobbyRoster(); room.connect();
}
// Fixed simulation ticks keep background rendering from holding up the board.
// The shared HostRoom still owns connectivity, members and host election.
let onlineTicks = 0;
setInterval(() => {
  if (!online || !room?.connected) return;
  if (mini?.state === 'run') room.controls(paused ? IDLE_INPUT : minigameInput(0.05));
  if (!room.isHost) return;
  // A replay has no board-runner continuation. After an election, always
  // restore the checkpoint before a former guest can finish a minigame.
  if (mini && !mini.authoritative) {
    if (checkpoint) beginOnline(checkpoint);
    return;
  }
  stepJobs(0.05 * SPEED);
  if (mini) updateMini(0.05 * SPEED);
  if (pendingChoice && !room.members.has(pendingChoice.seat)) finishChoice(pendingChoice.auto);
  if (++onlineTicks % 2 === 0) { if (!started) lobbyRoster(); room.publish(captureOnline()); }
}, 50);

// ======================================================================
const clock = new THREE.Clock();
let t = 0;
function frame() {
  const dt = paused && !online ? 0 : Math.min(clock.getDelta(), 0.1) * SPEED;
  if (paused && !online) clock.getDelta();
  t += dt;
  if (!online) { stepJobs(dt); if (mini) updateMini(dt); }
  view.update(dt, t);
  renderer.render(view.scene, view.camera);
  requestAnimationFrame(frame);
}

addEventListener('resize', () => {
  for (const c of [boardCam, mini?.game.camera].filter(Boolean)) {
    c.aspect = online && c === mini?.game.camera ? mini.spec.aspect : innerWidth / innerHeight;
    c.updateProjectionMatrix();
  }
  renderer.setSize(innerWidth, innerHeight);
});
boardCam.aspect = innerWidth / innerHeight;
boardCam.updateProjectionMatrix();

// ?debug: fastForward(60) runs a minute of game time without rendering
// (background tabs barely tick, so this is how to test a whole game)
async function fastForward(seconds, dt = 1 / 30) {
  if (online) throw new Error('Online play uses the room clock.');
  for (let s = 0; s < seconds; s += dt) {
    t += dt;
    stepJobs(dt);
    if (mini) updateMini(dt);
    view.update(dt, t);
    await null;   // let the turn logic's awaits run
  }
}
if (DEBUG) Object.assign(window, { menu, players, board, dice, MINIGAMES, layoutTokens, fastForward, renderer, boardScene, boardCam, minigame: () => mini, onlineState: () => ({ room, checkpoint, pendingChoice, miniFrame, me: me?.i }) });

frame();
main().catch(ignoreCancelled);

await prepareScene({ renderer, scene: boardScene, camera: boardCam });
