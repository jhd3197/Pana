import { createSky } from '/engine/sky.js';
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { CARS } from './cars.js';
import { WHEEL_DEFINITIONS, wheelById, composeTune } from './wheel-definitions.js';
import { garageCards, wheelCards } from './garage-cards.js';
import { paintNext } from './loading.js';
import { sound, Puffs, Debris, makeBubble } from '/engine/fx.js';
import { createItems, ITEMS, SPIN } from './items.js';
import { activeItem, canBlock, coinMultiplier, COIN_SPEED, MAX_COINS } from './item-rules.js';
import { TRACKS, getTrack, makeTrack } from './tracks.js';
import { roughnessAt,roadGripAt,roadWaterAt } from './offroad.js';
import { loadAvatar, loadName, randomAvatar } from '/engine/avatar.js';
import { createGameMenu, toggleMute } from '/engine/ui.js';
import { inviteUrl, newRoomCode, roomFromUrl } from '/engine/invite.js';
import { fillRoster } from '/engine/results.js';
import { ICONS as SVG } from '/engine/icons.js';
import { holdButton } from '/engine/touch.js';
import { pixelRatio, bindRenderer } from '/engine/settings.js';
import { shout } from '/engine/kit.js';
import { LAPS, RIVALS, AI_WHEELS, POSE_HZ, FLAG, DRIFT_SHIFT, packPose, gridSlot } from './online-rules.js';
import { clockText, wrapAngle, raceOrder, aiPedals, resolveContact } from './rules.js';
import { DRIFT_MIN_SPEED, DRIFT_BOOST, HOP_SPEED, DRAFT_TIME, DRAFT_BOOST, driftLevel, driftSteer, driftCharge, startBoost, trickBoost, inSlipstream, loseCoins } from './drive-rules.js';

const $ = (id) => document.getElementById(id);
const esc = (text) => String(text).replace(/[&<>"]/g, (ch) => `&#${ch.charCodeAt(0)};`);
const rand = (a, b) => a + Math.random() * (b - a);
const pick = (list) => list[Math.floor(Math.random() * list.length)];

const G = 30;   // cartoon gravity: snappy jumps
// test switches: ?auto lets the AI drive your car, ?speed=4 fast-forwards
const QS = new URLSearchParams(location.search);
const AUTO = QS.has('auto');
const SPEED = Number(QS.get('speed')) || 1;
const DEBUG = QS.has('debug');

// You drive as the pana you made in the hub; the rivals are random ones.
const ME = { name: loadName(), avatar: loadAvatar() };
// ?room=<code> races online with panas (online.js); without it the race is local.
// ?lead=1 marks the party's Pana Mayor, who hosts the room.
const ROOM = roomFromUrl();
let net = null;

const LINES = {
  crash: ['¡AY!', '¡UEPA!', '¡Ñooo!', '¡Mi carro!', '¡Epa, chamo!', '¡Qué molleja!'],
  air: ['¡Wiii!', '¡Ayayay!', '¡Me fui!'],
  wall: ['¡Ups!', '¡Pum!', '¡Mi pintura!'],
  trick: ['¡Truco!', '¡Qué vacilón!', '¡Mírame!'],
  rocket: ['¡Arranque cohete!', '¡Fiuuu!', '¡Me fui!'],
  stall: ['¡Se me ahogó!', '¡Ay no, el motor!'],
  honk: { meep: '¡MEEP MEEP!', cucaracha: '♪ Cucaracha ♪', grave: '¡PAAAAN!', fiesta: '♪ ¡Rumba! ♪' },
};

class Spring {
  constructor() { this.x = 0; this.v = 0; }
  step(target, k, c, dt) {
    this.v += (k * (target - this.x) - c * this.v) * dt;
    this.x += this.v * dt;
    return this.x;
  }
}

// ---------- renderer ----------
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(pixelRatio(2));
bindRenderer(renderer, 2);
renderer.setSize(innerWidth, innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.22;
document.body.prepend(renderer.domElement);

// ======================================================================
// Garage
// ======================================================================
const garage = {
  scene: new THREE.Scene(),
  camera: new THREE.PerspectiveCamera(40, innerWidth / innerHeight, 0.1, 200),
  index: 0,
  wheel: 'calle',
  spin: true,
  hop: new Spring(),
  honkT: 0,
  t: 0,
  focus: false,
  glide: 0,
  cars: new Map(),
};
{
  const s = garage.scene;
  s.background = new THREE.Color(0x1b1430);
  s.fog = new THREE.Fog(0x1b1430, 20, 45);
  s.add(new THREE.HemisphereLight(0xfff4e6, 0x4b3669, 1.35));
  const fill = new THREE.DirectionalLight(0xfff1e0, 1.1);   // soft front fill so faces stay bright
  fill.position.set(4, 3, 10);
  s.add(fill);
  const key = new THREE.SpotLight(0xfff0d8, 220, 45, Math.PI / 5, 0.5, 1.6);
  key.position.set(6, 13, 8);
  key.castShadow = true;
  // The small turntable needs a quarter of the previous shadow texels.
  key.shadow.mapSize.set(1024, 1024);
  key.shadow.bias = -0.0004;
  s.add(key);
  const rim = new THREE.DirectionalLight(0x9fb7ff, 1.6);
  rim.position.set(-8, 5, -10);
  s.add(rim);

  const floor = new THREE.Mesh(new THREE.CircleGeometry(40, 48),
    new THREE.MeshStandardMaterial({ color: 0x191326, roughness: 0.95, flatShading: true }));
  floor.rotation.x = -Math.PI / 2;
  floor.receiveShadow = true;
  s.add(floor);
  const table = new THREE.Mesh(new THREE.CylinderGeometry(3.55, 3.8, 0.4, 16),
    new THREE.MeshStandardMaterial({ color: 0x302340, roughness: 0.85, flatShading: true }));
  table.position.y = 0.2;
  table.receiveShadow = true;
  s.add(table);
  garage.ring = new THREE.Mesh(new THREE.TorusGeometry(3.58, 0.06, 6, 32), new THREE.MeshBasicMaterial({ color: 0xe63946 }));
  garage.ring.rotation.x = Math.PI / 2;
  garage.ring.position.y = 0.4;
  s.add(garage.ring);
  garage.turn = new THREE.Group();
  garage.turn.position.y = 0.4;
  s.add(garage.turn);
  garage.bubble = makeBubble();
  s.add(garage.bubble.sprite);

  garage.camera.position.set(8, 4.5, 9.5);
  garage.controls = new OrbitControls(garage.camera, renderer.domElement);
  garage.controls.target.set(0, 1.5, 0);
  garage.controls.enableDamping = true;
  garage.controls.enablePan = false;
  garage.controls.minDistance = 5;
  garage.controls.maxDistance = 18;
  garage.controls.maxPolarAngle = Math.PI * 0.49;
}

function garageCar(index) {
  // Cache key includes the cauchos: the same car wears different wheels.
  const key = `${index}:${garage.wheel}`;
  if (!garage.cars.has(key)) {
    if (garage.cars.size >= 16) garage.cars.delete(garage.cars.keys().next().value);
    garage.cars.set(key, CARS[index].build(ME.avatar, wheelById(garage.wheel).wheel ?? undefined));
  }
  return garage.cars.get(key);
}

function showCar(i) {
  garage.index = (i + CARS.length) % CARS.length;
  const def = CARS[garage.index];
  garage.turn.clear();
  // Bounded garage models; thumbnails borrow these same instances.
  // Race models stay independent because their parts can break off.
  garage.car = garageCar(garage.index);
  garage.turn.add(garage.car.root);
  garage.ring.material.color.set(def.color);

  document.documentElement.style.setProperty('--car', def.color);
  $('car-num').textContent = def.num;
  $('car-of').textContent = `Carro ${garage.index + 1} de ${CARS.length}`;
  $('car-name').textContent = def.name;
  $('car-blurb').textContent = def.blurb;
  // Stats bars reflect the car + cauchos combo, recomputed from the composed tune.
  const tune = composeTune(def.tune, wheelById(garage.wheel).profile);
  const bar = (base, ratio) => Math.max(0.04, Math.min(1, base * ratio));
  const stats = {
    Velocidad: bar(def.stats.Velocidad, tune.top / def.tune.top),
    'Aceleración': bar(def.stats['Aceleración'], tune.accel / def.tune.accel),
    Manejo: bar(def.stats.Manejo, Math.sqrt((tune.turn / def.tune.turn) * (tune.grip / def.tune.grip))),
    Peso: def.stats.Peso,
  };
  $('stats').innerHTML = Object.entries(stats)
    .map(([k, v]) => `<div><dt>${k}</dt><dd><i style="width:${Math.round(v * 100)}%"></i></dd></div>`)
    .join('');
  $('driver-name').textContent = ME.name;
  $('dots').innerHTML = CARS.map((_, j) => `<span class="${j === garage.index ? 'on' : ''}"></span>`).join('');
  for (const [j, button] of [...$('car-lineup').children].entries()) button.setAttribute('aria-pressed', String(j === garage.index));
  net?.pick(garage.index, garage.wheel);
}

// Step 2: pick the cauchos. Rebuilds the turntable car and the stats bars,
// and persists the choice for the next visit.
function showWheel(id) {
  const def = wheelById(id);
  garage.wheel = def.id;
  try { localStorage.setItem('derrape:wheels', def.id); } catch { /* private mode */ }
  $('wheel-name').textContent = def.name;
  $('wheel-blurb').textContent = def.blurb;
  for (const [j, button] of [...$('wheel-lineup').children].entries()) {
    button.setAttribute('aria-pressed', String(WHEEL_DEFINITIONS[j].id === def.id));
  }
  showCar(garage.index);
}

function garageHonk() {
  sound.unlock();
  const def = CARS[garage.index];
  garage.honkT = sound.horn(def.horn);
  garage.bubble.say(LINES.honk[def.horn], garage.honkT + 0.2);
  garage.hop.v += 6;
}

function updateGarage(dt) {
  garage.t += dt;
  if (garage.spin) garage.turn.rotation.y += dt * 0.35;
  const car = garage.car;
  const hop = garage.hop.step(0, 180, 9, dt);
  car.chassis.position.y = hop * 0.12 + Math.sin(garage.t * 2) * 0.02;
  car.chassis.rotation.x = -hop * 0.03;
  const d = car.driver;
  // in close-up the driver turns to look at you through the open window
  const look = garage.focus ? 0 : Math.sin(garage.t * 0.9);
  const turnTo = garage.focus ? 1.1 : look * 0.6;
  d.neck.rotation.y += (turnTo - d.neck.rotation.y) * Math.min(1, dt * 4);
  d.neck.rotation.z = Math.sin(garage.t * 1.7) * 0.08;
  garage.honkT = Math.max(0, garage.honkT - dt);
  d.update(dt, { open: garage.honkT > 0, look: -look });
  for (const p of car.danglers) p.rotation.z = Math.sin(garage.t * 2.4) * 0.25;
  if (car.flag) car.flag.rotation.x = Math.sin(garage.t * 3) * 0.15;
  garage.bubble.sprite.position.set(0, 4.8, 0);
  garage.bubble.update(dt);
  updateGarageCamera(dt);
  garage.controls.update();
}

// "Ver piloto": glide up to the driver's open window, then orbit around them.
const GARAGE_TARGET = new THREE.Vector3(0, 1.5, 0);
const GARAGE_CAM = new THREE.Vector3(8, 4.5, 9.5);
function updateGarageCamera(dt) {
  if (garage.glide <= 0) return;
  garage.glide = Math.max(0, garage.glide - dt);
  const k = Math.min(1, dt * 5);
  if (garage.focus) {
    const head = garage.car.driver.head.getWorldPosition(new THREE.Vector3());
    const out = new THREE.Vector3(2.5, -0.12, 0.45).applyAxisAngle(new THREE.Vector3(0, 1, 0), garage.turn.rotation.y);
    garage.controls.target.lerp(head, k);
    garage.camera.position.lerp(head.clone().add(out), k);
  } else {
    garage.controls.target.lerp(GARAGE_TARGET, k);
    garage.camera.position.lerp(GARAGE_CAM, k);
  }
}

function setFocus(on) {
  garage.focus = on;
  garage.glide = 1.2;
  $('cam').classList.toggle('on', on);
  $('cam').textContent = on ? 'Ver carro' : 'Ver piloto';
  garage.controls.minDistance = on ? 1.4 : 5;
  if (on) {
    garage.spin = false;
    $('spin').classList.remove('on');
  }
}

$('prev').onclick = () => showCar(garage.index - 1);
$('next').onclick = () => showCar(garage.index + 1);
$('t-prev').onclick = () => switchTrack(trackIndex - 1);
$('t-next').onclick = () => switchTrack(trackIndex + 1);
$('spin').onclick = (e) => {
  garage.spin = !garage.spin;
  e.target.classList.toggle('on', garage.spin);
};
$('honk').onclick = garageHonk;
$('cam').onclick = () => setFocus(!garage.focus);
$('play').onclick = () => {
  sound.unlock();
  if (net) { if (net.isHost) net.start(); return; }
  if (!joining) startRace(garage.index, garage.wheel);
};
$('go-online').onclick = () => { sound.unlock(); goOnline(newRoomCode(), true); };
$('lobby-invite').onclick = () => menu.share();
$('lobby-bots').onchange = (e) => net?.bots(e.target.checked);
$('lobby-solo').onclick = () => { location.href = location.pathname; };
// Step pills jump to the car strip, the cauchos strip or the track picker.
for (const step of document.querySelectorAll('.step')) {
  step.onclick = () => {
    const target = step.dataset.step === 'car'
      ? $('car-lineup').querySelector('[aria-pressed="true"]') ?? $('next')
      : step.dataset.step === 'wheels'
        ? $('wheel-lineup').querySelector('[aria-pressed="true"]') ?? $('wheel-lineup').firstElementChild
        : $('t-next');
    target?.focus();
  };
}

// ======================================================================
// Track: data-driven. Definitions live in tracks.js + tracks/*.js; the
// active track runtime is T. These wrappers keep the rest of the game
// untouched when the track changes.
// ======================================================================
let T = null;

const pointAt = (s) => T.pointAt(s);
const paramOf = (x, z) => T.paramOf(x, z);
const offsetOf = (x, z) => T.offsetOf(x, z);
const groundAt = (x, z) => T.groundAt(x, z);

const race = {
  scene: new THREE.Scene(),
  camera: new THREE.PerspectiveCamera(60, innerWidth / innerHeight, 0.1, 1800),
  cars: [],
  state: 'off',
  keys: {},
  shake: 0,
};
race.puffs = new Puffs(race.scene);
race.debris = new Debris(race.scene);
{
  const s = race.scene;
  s.background = new THREE.Color(0xffd6a0);
  s.fog = new THREE.Fog(0xffd6a0, 80, 260);
  race.sky = createSky();s.add(race.sky.mesh);
  race.hemi = new THREE.HemisphereLight(0xfff1d6, 0xc08a5a, 1.6);
  s.add(race.hemi);
  const sun = new THREE.DirectionalLight(0xffd9a0, 2.4);
  sun.position.set(-30, 40, 25);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  Object.assign(sun.shadow.camera, { left: -40, right: 40, top: 40, bottom: -40, near: 1, far: 160 });
  sun.shadow.bias = -0.0006;
  s.add(sun, sun.target);
  race.sun = sun;
}

// Sky, fog and lights follow the track's palette.
function applyPalette(pal) {
  race.scene.background.set(pal.horizon);
  race.scene.fog.color.set(pal.horizon);
  race.scene.fog.near = pal.fog?.[0] ?? 80;
  race.scene.fog.far = pal.fog?.[1] ?? 260;
  race.hemi.color.set(pal.hemiSky);
  race.hemi.groundColor.set(pal.hemiGround);
  race.hemi.intensity = pal.hemiInt ?? 1.6;
  race.sun.color.set(pal.sun);
  race.sun.intensity = pal.sunInt ?? 2.4;
  race.sky.setPalette(pal);race.sky.update(0);
}

// Browsing needs only route metadata. Keep the last built map for replay;
// construct a different environment only after the player presses Play.
let trackIndex = 0;
const trackRoutes = new Map();
function selectTrack(id) {
  const def = getTrack(id);
  trackIndex = TRACKS.indexOf(def);
  try { localStorage.setItem('derrape:track', def.id); } catch { /* private mode */ }
  if (!trackRoutes.has(def.id)) trackRoutes.set(def.id, makeTrack(def));
  const route = trackRoutes.get(def.id);
  $('track-name').textContent = def.name;
  $('track-blurb').textContent = `${(route.TOTAL / 1000).toFixed(2)} km por vuelta · ${LAPS} vueltas. ${def.blurb}`;
  $('track-of').textContent = `Pista ${trackIndex + 1}/${TRACKS.length}`;
  drawTrackPreview(route);
  return route;
}

function beginTrack(id) {
  let route = selectTrack(id);
  if (race.trackReady && T === route) return false;
  // A cancelled environment may have installed ground/collision closures.
  // Retry with a fresh runtime instead of retaining those partial callbacks.
  if (T === route) route = makeTrack(route.def);
  if (race.trackGroup) {
    race.items?.dispose();
    race.scene.remove(race.trackGroup);
    // Character disposal detaches children. Collect first so cleanup cannot
    // mutate Three's active traversal when switching away from Los Llanos.
    const disposers=[],geometries=new Set();
    race.trackGroup.traverse(o=>{if(o.userData.dispose)disposers.push(o.userData.dispose);if(o.geometry)geometries.add(o.geometry);});
    disposers.forEach(dispose=>dispose());geometries.forEach(geometry=>geometry.dispose());
    // Built runtimes retain environment animation/terrain closures. Evict the
    // old runtime too, so metadata caching cannot retain eight whole worlds.
    trackRoutes.delete(T.id);
    T.group = null;
  }
  race.items = null;
  race.trackGroup = null;
  race.trackReady = false;
  T = route;
  trackRoutes.set(route.id, route);
  return true;
}

function finishTrack() {
  race.trackGroup = T.group;
  race.scene.add(race.trackGroup);
  applyPalette(T.def.palette);
  race.items = createItems({
    scene: race.trackGroup, puffs: race.puffs, sound, G, track: T,
    crash: (c, power, side) => crash(c, power, side),
    say: (c, lines, time) => say(c, lines, time),
    standings: () => standings(),
    emit: (kind, c, data) => { if (race.netRace && !c.remote) net.fx(c.netId, kind, data); },
  });
  $('mm-track').textContent = T.name;
  $('mm-sub').textContent = `${(T.TOTAL / 1000).toFixed(2)} km por vuelta`;
  buildMinimap();
  race.trackReady = true;
}

function buildTrack(id) {
  if (!beginTrack(id)) return;
  race.trackGroup = T.build();
  finishTrack();
}

function switchTrack(i) {
  sound.unlock();
  if (net && !net.isHost) return;
  const def = selectTrack(TRACKS[(i + TRACKS.length) % TRACKS.length].id).def;
  net?.track(def.id);
}

// ---------- race HUD: standings board + minimap ----------
function renderBoard(order, player) {
  $('board').innerHTML = order.map((c, i) =>
    `<li class="pk-row${c === player ? ' me is-me' : ''}"><span class="pk-row-n">${i + 1}</span><span class="chip" style="--c:${c.def.color}"></span>${esc(c.name)}</li>`
  ).join('');
}

// Sample a route's centerline and fit it into a canvas with a margin.
function fitRoute(route, canvas, margin) {
  const N = 160;
  const raw = [];
  for (let i = 0; i < N; i++) raw.push(route.pointAt((i / N) * route.TOTAL));
  const minX = Math.min(...raw.map(p=>p.x)), maxX = Math.max(...raw.map(p=>p.x));
  const minZ = Math.min(...raw.map(p=>p.y)), maxZ = Math.max(...raw.map(p=>p.y));
  const scale = Math.min((canvas.width-margin*2)/(maxX-minX), (canvas.height-margin*2)/(maxZ-minZ));
  return raw.map(p=>[canvas.width/2+(p.x-(minX+maxX)/2)*scale,canvas.height/2+(p.y-(minZ+maxZ)/2)*scale]);
}
function strokeRoute(ctx, pts, width) {
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  ctx.beginPath();
  pts.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
  ctx.closePath();
  ctx.strokeStyle = '#0e0b24';
  ctx.lineWidth = width * 2;
  ctx.stroke();
  ctx.strokeStyle = '#f3e9d7';
  ctx.lineWidth = width;
  ctx.stroke();
}

// Garage preview of the selected circuit, with its start line.
function drawTrackPreview(route) {
  const canvas = $('track-map'), ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  try {
    const pts = fitRoute(route, canvas, 28);
    strokeRoute(ctx, pts, 7);
    const [x, y] = pts[Math.floor((route.LINE ?? 0) / route.TOTAL * pts.length) % pts.length];
    ctx.beginPath(); ctx.arc(x, y, 9, 0, Math.PI * 2);
    ctx.fillStyle = '#ffc629'; ctx.fill();
    ctx.lineWidth = 3; ctx.strokeStyle = '#0e0b24'; ctx.stroke();
  } catch { /* metadata without a centerline: keep the striped placeholder */ }
}

const mm = $('mm');
const mmCtx = mm.getContext('2d');
let mmPts = [];
function buildMinimap() {
  mmPts = fitRoute(T, mm, 16);
}

function drawMinimap() {
  mmCtx.clearRect(0, 0, mm.width, mm.height);
  strokeRoute(mmCtx, mmPts, 4);
  for (const c of race.cars) {
    const i = Math.floor((paramOf(c.x, c.z) / T.TOTAL) * mmPts.length) % mmPts.length;
    const [x, y] = mmPts[i];
    mmCtx.beginPath();
    mmCtx.arc(x, y, c.isPlayer ? 5.5 : 4, 0, Math.PI * 2);
    mmCtx.fillStyle = c.def.color;
    mmCtx.fill();
    if (c.isPlayer) {
      mmCtx.lineWidth = 2;
      mmCtx.strokeStyle = '#fff';
      mmCtx.stroke();
    }
  }
}

// ======================================================================
// Racers
// ======================================================================
const RACERS = 4;

function makeRacer(index, isPlayer, name, wheelId = 'calle', avatar = null) {
  const def = CARS[index];
  const wheel = wheelById(wheelId);
  const who = isPlayer ? ME : { name, avatar: avatar || randomAvatar() };
  const car = def.build(who.avatar, wheel.wheel ?? undefined);
  // Retain ownership even after a bumper detaches and expires from the scene.
  car.geometries = new Set();
  car.root.traverse(o => { if (o.geometry) car.geometries.add(o.geometry); });
  race.scene.add(car.root);
  const bubble = makeBubble();
  race.scene.add(bubble.sprite);
  return {
    def, car, bubble, isPlayer, name: who.name,
    wheel: wheel.id, tune: composeTune(def.tune, wheel.profile),   // stepCar drives with the composed tune
    skill: isPlayer ? 1 : rand(0.88, 0.97),   // rivals top out a bit below their car's max
    x: 0, z: 0, y: 0, h: Math.PI / 2, vx: 0, vz: 0, vy: 0, vf: 0, vr: 0, steer: 0, latAcc: 0, longAcc: 0,
    onGround: true, pitch: 0, roll: 0, pitchV: 0, rollV: 0,
    heave: new Spring(), sp: new Spring(), sr: new Spring(), headLag: new Spring(),
    lap: 0, prog: 0, done: false, time: 0,
    dizzy: 0, scream: 0, honkT: 0, lost: 0, puffT: 0, aiHonk: rand(3, 8), airTime: 0,
    inventory: [null, null], selected: 0, useT: 0, boost: 0, spin: 0,
    coins: 0, coinsCollected: 0, coinFlash: 0, itemMessage: '', itemMessageT: 0,
    // driving skills (drive-rules.js): drift dir ±1 and its charge, hop, trick, draft, stall
    drift: 0, driftT: 0, driftHeld: false, driftWindow: 0, driftYaw: 0, hopping: false,
    trick: false, trickT: 0, draft: 0, stall: 0, aiDrift: false,
  };
}

function placeRacer(c, lane, row) {
  const s = T.LINE - 9 - row * 8;
  const p = pointAt(s), p2 = pointAt(s + 0.5);
  const tx = p2.x - p.x, tz = p2.y - p.y, l = Math.hypot(tx, tz) || 1;
  // grid slot offset across the track, heading along it
  Object.assign(c, {
    lane, x: p.x - tz / l * lane, z: p.y + tx / l * lane, y: 0, h: Math.atan2(tx, tz),
    vx: 0, vz: 0, vy: 0, vf: 0, lap: 0, done: false, time: 0,
    drift: 0, driftT: 0, hopping: false, trick: false, draft: 0, stall: 0,
  });
  c.y = groundAt(c.x, c.z);
  c.prog = progressOf(c);
}

function progressOf(c) {
  return (paramOf(c.x, c.z) - T.LINE + T.TOTAL) % T.TOTAL;
}

function disposeRacer(c) {
  race.scene.remove(c.car.root);
  c.car.driver.dispose();
  race.scene.remove(c.bubble.sprite);
  c.car.geometries.forEach(g => g.dispose());
  c.bubble.sprite.material.map.dispose();
  c.bubble.sprite.material.dispose();
}

function clearRace() {
  resetInput();
  race.cars.forEach(disposeRacer);
  race.cars = [];
  race.puffs.clear();
  race.debris.clear();
  race.items?.clear();
  race.player = null;
}

// Loading-screen tips: real rules only.
const TIPS = [
  [SVG.mango, 'Lleva un mango equipado: bloquea el mango que te lancen.'],
  [SVG.coin, 'Cada moneda te da un poquito más de velocidad, hasta 10.'],
  [SVG.crate, 'Rompe cajas de madera para conseguir objetos. Guardas hasta 2.'],
  [SVG.juice, 'El jugo de mango te da un turbo: tómatelo en una recta.'],
  [SVG.back, 'Lanza hacia atrás con X para frenar al que te persigue.'],
  [SVG.coin, 'Derrapa con Shift: suelta con chispas moradas para el turbo más largo.'],
  [SVG.coin, 'En una rampa, pulsa Shift en el aire para hacer un truco y caer con turbo.'],
  [SVG.coin, 'Pégate detrás de otro carro en la recta: el rebufo te lanza hacia adelante.'],
  [SVG.coin, 'Si te pegan pierdes monedas. Cuídalas: cada una es velocidad.'],
];
let loadGeneration = 0;
// roster (online only): [{ id, kind, owner, name, avatar, car, wheel, slot }]
// from the room. Without one the race is the local player plus three bots.
async function startRace(playerIndex, wheelId = garage.wheel, roster = null) {
  if (mode === 'loading') return;
  const generation = ++loadGeneration;
  mode = 'loading';
  race.state = 'loading';
  garage.controls.enabled = false;
  $('loading').classList.remove('hidden');
  $('loading').setAttribute('aria-busy', 'true');
  $('garage').inert = $('race').inert = true;
  $('loading-back').focus();
  const def = TRACKS[trackIndex], tip = pick(TIPS);
  $('loading-title').textContent = def.name;
  $('loading-meta').textContent = `Derrape · Pista ${trackIndex + 1} de ${TRACKS.length} · ${LAPS} vueltas`;
  $('loading-blurb').textContent = def.blurb;
  $('loading-tip-icon').innerHTML = tip[0];
  $('loading-tip').textContent = tip[1];
  $('play').disabled = true;
  sound.stopEngine();
  const step = async (label, progress) => {
    $('loading-status').textContent = label;
    $('loading-progress').value = progress;
    $('loading-pct').textContent = `${Math.round(progress * 100)}%`;
    await paintNext();
    return generation === loadGeneration;
  };
  try {
    if (!await step('Preparando la pista…', 0.05)) return;
    clearRace();
    if (beginTrack(TRACKS[trackIndex].id)) {
      let progress = 0.12;
      for (const label of T.buildSteps()) {
        race.trackGroup = T.group;
        if (!await step(label, progress)) return;
        progress += 0.1;
      }
      finishTrack();
    }
    if (!await step('Preparando los carros…', 0.5)) return;
    if (roster) {
      for (const [i, r] of roster.entries()) {
        if (!await step(`Preparando los panas… ${i + 1}/${roster.length}`, 0.5 + (i + 1) / roster.length * 0.3)) return;
        const mine = r.id === net.id;
        const c = makeRacer(r.car, mine, r.name, r.wheel, mine ? null : r.avatar);
        Object.assign(c, { netId: r.id, bot: r.kind === 'bot', remote: r.owner !== net.id, buf: [], gap: 1000 / POSE_HZ, delay: 120 });
        const { lane, row } = gridSlot(r.slot);
        placeRacer(c, lane, row);
        race.cars.push(c);
      }
      // A reload mid-race puts this car back where the room last saw it.
      for (const c of race.cars) if (!c.remote) resumePose(c, net.lastPose(c.netId));
    } else {
      const others = CARS.map((_, i) => i).filter((i) => i !== playerIndex).sort(() => Math.random() - 0.5);
      const names = RIVALS.slice(0, 6).sort(() => Math.random() - 0.5);
      race.cars = [makeRacer(playerIndex, true, undefined, wheelId)];
      for (let i = 1; i < RACERS; i++) {
        if (!await step(`Preparando los panas… ${i}/${RACERS}`, 0.5 + i * 0.08)) return;
        race.cars.push(makeRacer(others[i - 1], false, names[i - 1], AI_WHEELS[CARS[others[i - 1]].id]));
      }
      // a two-by-two grid; you start at the back so there's someone to pass
      race.cars.forEach((c, i) => placeRacer(c, i % 2 ? -3.5 : 3.5, Math.floor((RACERS - 1 - i) / 2)));
    }
    race.player = race.cars.find(c => c.isPlayer);
    race.playerIndex = playerIndex;
    race.playerWheel = wheelId;
    race.clock = 0;
    race.count = 3.999;
    race.boardT = 0;
    race.poseAt = 0;
    race.camPos = null;
    race.netRace = roster ? net.state.raceId : 0;
    if (!await step('Todo listo. ¡A correr!', 0.9)) return;
    renderer.toneMapping = THREE.NoToneMapping;
    updateRace(0);
    await renderer.compileAsync(race.scene, race.camera);
    if (generation !== loadGeneration) return;
    // Upload geometry and draw once behind the loading panel. The countdown
    // starts only after this first frame, never while compilation is running.
    renderer.render(race.scene, race.camera);
    if (roster) {
      // Everyone counts down together once every pana has loaded.
      net.loaded();
      if (!await step('Esperando a los panas…', 1)) return;
      if (!await net.until(s => s.raceId !== race.netRace || s.startAt > 0, (s) => {
        const racing = s.players.filter(p => p.racing), ready = racing.filter(p => p.loaded).length;
        $('loading-status').textContent = `Esperando a los panas… ${ready}/${racing.length} listos`;
      }) || generation !== loadGeneration) return;
      if (net.state.raceId !== race.netRace) return;
    } else if (!await step('¡Listo!', 1)) return;
    race.state = 'count';
    $('count').textContent = '3';
    $('garage').classList.add('hidden');
    $('race').classList.remove('hidden');
    $('result').classList.add('hidden');
    garage.controls.enabled = false;
    sound.startEngine();
    acc = 0;
    clock.getDelta();
    mode = 'race';
    $('garage').inert = $('race').inert = false;
    $('loading').classList.add('hidden');
    renderer.domElement.tabIndex = -1;
    renderer.domElement.focus({ preventScroll: true });
  } catch (error) {
    console.error('Derrape loading failed', error);
    if (generation === loadGeneration) {
      if (!race.trackReady && T?.group) race.trackGroup = T.group;
      $('loading-status').textContent = 'No pudimos preparar la carrera. Vuelve al garaje e inténtalo otra vez.';
      race.state = 'off';
    }
  } finally {
    if (generation === loadGeneration) {
      $('play').disabled = false;
      $('loading').setAttribute('aria-busy', 'false');
    }
  }
}

function toGarage() {
  if (race.netRace && net.state.raceId === race.netRace && !race.player?.done && ['loading', 'count', 'race'].includes(net.state.phase)) net.retire();
  race.netRace = 0;
  ++loadGeneration;
  $('loading').classList.add('hidden');
  $('loading').setAttribute('aria-busy', 'false');
  $('garage').inert = $('race').inert = false;
  $('play').disabled = false;
  race.state = 'off';
  clearRace();
  sound.stopEngine();
  $('race').classList.add('hidden');
  $('garage').classList.remove('hidden');
  garage.controls.enabled = true;
  mode = 'garage';
  if (net) renderLobby(net.state);
  $('play').focus({ preventScroll: true });
}

// Esc pauses the race (or opens the settings in the garage). Paused races
// keep their clock, items and AI frozen until the menu closes.
let paused = false;
const menu = createGameMenu({
  title: 'Derrape', heading: 'Pausa', sound, orientation: 'horizontal',
  note: () => mode === 'race' ? (race.state === 'end' ? 'La carrera terminó.' : race.netRace ? 'Carrera online: no se detiene.' : 'La carrera está en pausa.') : 'Estás en el garaje.',
  controls: [['W / ↑', 'Acelerar'], ['S / ↓', 'Frenar'], ['A D / ← →', 'Girar'], ['Shift / K', 'Saltar y derrapar · truco en el aire'], ['Espacio / E', 'Lanzar objeto adelante'],
    ['X', 'Lanzar objeto atrás'], ['1 2', 'Elegir objeto'], ['Q', 'Cambiar objeto'], ['H', 'Claxon'], ['M', 'Sonido'], ['Esc', 'Pausa']],
  tips: ['Mantén Shift en una curva para derrapar: chispas azules, naranjas y moradas dan más turbo al soltar.',
    'Acelera justo al final del "1" para un arranque cohete. Si aceleras en el "3" se te ahoga el motor.',
    'Rompe cajas de madera para conseguir objetos. Cada moneda da un poquito más de velocidad.'],
  actions: [
    { id: 'restart', label: 'Reiniciar carrera', kind: 'secondary', visible: () => mode === 'race' && !race.netRace, run: () => startRace(race.playerIndex, race.playerWheel) },
    { id: 'to-garage', label: 'Volver al garaje', kind: 'secondary', visible: () => mode === 'race', run: () => toGarage() },
  ],
  invite: () => inviteLink(),
  canOpen: () => mode !== 'loading',
  onOpen() {
    resetInput();
    if (mode !== 'race' || race.netRace) return;
    paused = true;
    if (sound.engine) sound.engine.g.gain.setTargetAtTime(0, sound.ctx.currentTime, 0.05);
  },
  onClose() { paused = false; acc = 0; clock.getDelta(); },
});
$('race').querySelector('.hud-corner').append(menu.createButton({ id: 'pause', label: 'Pausa', className: 'pause-button pk-btn pk-btn--sm' }));
$('garage').querySelector('.tools').prepend(menu.createButton({ id: 'settings', label: 'Ajustes', className: 'toggle pk-btn pk-btn--sm' }));
for (const kbd of document.querySelectorAll('#pause kbd, #settings kbd')) kbd.classList.add('pk-kbd');

$('again').onclick = () => {
  if (!race.netRace) return startRace(race.playerIndex, race.playerWheel);
  if (net.isHost) net.start();
};
$('back').onclick = () => {
  if (race.netRace && net.isHost && net.state.phase === 'results') net.lobby();
  else toGarage();
};
$('loading-back').onclick = toGarage;
function itemAction(direction) {
  if (mode === 'race' && race.state === 'go') race.items.use(race.player, direction);
}
function selectSlot(slot) {
  if (mode === 'race' && race.state === 'go') race.items.select(race.player, slot);
}
$('throw-front').onclick = () => itemAction(1);
$('throw-back').onclick = () => itemAction(-1);
$('swap-item').onclick = () => selectSlot();
for (let i = 0; i < 2; i++) $('item-slot-' + i).onclick = () => selectSlot(i);

// Multi-touch keeps steering and throttle independent (engine/touch.js). Lost focus
// releases input, including a thumb dragged off a control or a cancelled touch.
const touchHeld = new Set();
const driveButtons = [...document.querySelectorAll('[data-drive]')].map(button => holdButton(button, {
  down: () => { sound.unlock(); touchHeld.add(button.dataset.drive); },
  up: () => touchHeld.delete(button.dataset.drive),
}));
function resetInput() { race.keys = {}; for (const b of driveButtons) b.release(); touchHeld.clear(); }
addEventListener('blur', resetInput);
document.addEventListener('visibilitychange', () => { if (document.hidden) resetInput(); });
addEventListener('keydown', (e) => {
  if (e.target.closest('input, textarea, select, [contenteditable="true"]')) return;
  const k = e.key.toLowerCase();
  race.keys[k] = true;
  if (k === 'escape' && mode === 'loading') toGarage();
  if (k === 'h' && !e.repeat) {
    if (mode === 'race' && race.player) honk(race.player);
    else if (mode === 'garage') garageHonk();
  }
  if (k === 'm' && !e.repeat) toggleMute();
  if ((k === ' ' || k === 'e') && mode === 'race' && race.state === 'go' && race.player) {
    e.preventDefault();
    if (!e.repeat) itemAction(race.keys.s || race.keys.arrowdown ? -1 : 1);
  }
  if (mode === 'race' && ['x', 'q', '1', '2'].includes(k)) {
    e.preventDefault();
    if (!e.repeat) {
      if (k === 'x') itemAction(-1);
      else selectSlot(k === 'q' ? undefined : Number(k) - 1);
    }
  }
  if (e.key.startsWith('Arrow') && mode === 'race') e.preventDefault();
});
addEventListener('keyup', (e) => (race.keys[e.key.toLowerCase()] = false));

function playerInput() {
  const k = { ...race.keys };
  for (const key of touchHeld) k[key] = true;
  return {
    throttle: (k.w || k.arrowup ? 1 : 0) - (k.s || k.arrowdown ? 1 : 0),
    steer: (k.a || k.arrowleft ? 1 : 0) - (k.d || k.arrowright ? 1 : 0),
    drift: !!(k.shift || k.k),
  };
}

function aiInput(c) {
  // aim ahead along the track, holding this car's own lane so the pack
  // doesn't pile into the middle (it still bumps when lanes cross)
  const s = paramOf(c.x, c.z) + 14 + Math.max(0, c.vf) * 0.25;
  const target = pointAt(s);
  const next = pointAt(s + 1);
  const tx = next.x - target.x, tz = next.y - target.y, tl = Math.hypot(tx, tz) || 1;
  target.x += -tz / tl * c.lane * 0.8;
  target.y += tx / tl * c.lane * 0.8;
  const diff = wrapAngle(Math.atan2(target.x - c.x, target.y - c.z) - c.h);
  const gap = (c.lap * T.TOTAL + c.prog) - (race.player.lap * T.TOTAL + race.player.prog);
  // Rivals drift through long bends and let go once the nose lines up.
  if (!c.aiDrift && Math.abs(diff) > 0.3 && c.vf > 20 && c.onGround) c.aiDrift = true;
  else if (c.aiDrift && (Math.abs(diff) < 0.08 || (c.drift && Math.sign(diff) !== c.drift) || c.driftT > 2.8)) c.aiDrift = false;
  return { ...aiPedals(diff, gap), drift: c.aiDrift };
}

function say(c, lines, time) {
  const text = typeof lines === 'string' ? lines : pick(lines);
  c.bubble.say(text, time);
  if (race.netRace && !c.remote) net.fx(c.netId, 'say', { text, time });
}

function honk(c) {
  if (c.honkT > 0) return;
  c.honkT = sound.horn(c.def.horn);
  c.bubble.say(LINES.honk[c.def.horn], c.honkT + 0.2);
  c.heave.v += 5;   // the whole car jumps when it honks
  if (race.netRace && !c.remote) net.fx(c.netId, 'honk', {});
}

function popPart(c, power) {
  const parts = c.car.detachables;
  if (!parts.length) return;
  const obj = parts.splice(Math.floor(Math.random() * parts.length), 1)[0];
  race.puffs.spawn(obj.getWorldPosition(new THREE.Vector3()), { color: 0x9a9aa2, count: 5, size: 0.8 });
  race.debris.launch(obj, new THREE.Vector3(c.vx * 0.5 + rand(-4, 4), 6 + power * 0.3 + rand(0, 4), c.vz * 0.5 + rand(-4, 4)));
  c.lost++;
}

// A hit knocks coins off the car: they burst out as golden puffs.
function spillCoins(c, n) {
  const lost = loseCoins(c, n);
  if (lost) race.puffs.spawn(new THREE.Vector3(c.x, c.y + 1.6, c.z), { color: 0xffc629, count: lost * 4, spread: 2.4, size: 0.5, rise: 3, life: 0.7 });
  return lost;
}

function crash(c, power, side) {
  c.vy = Math.max(c.vy, power * 0.38 / c.def.tune.mass);
  c.onGround = false;
  c.airTime = 0;
  c.rollV += side * power * 0.35 / c.def.tune.mass;
  c.pitchV += rand(-1, 1) * power * 0.12;
  c.dizzy = 1.4;
  c.scream = 1.2;
  c.drift = 0; c.driftT = 0;
  spillCoins(c, power >= 14 ? 2 : 1);
  say(c, LINES.crash);
  popPart(c, power);
  if (power > 14) popPart(c, power);
  race.puffs.spawn(new THREE.Vector3(c.x, c.y + 1, c.z), { color: 0xc8c8d0, count: 8, spread: 2 });
  if (c.isPlayer) race.shake = Math.min(1, race.shake + power * 0.05);
}

function stepCar(c, input, dt) {
  const t = c.tune;   // car tune composed with the racer's cauchos (makeRacer)
  const boosting = c.boost > 0;
  const top = t.top * c.skill * coinMultiplier(c);
  const terrain=T.def.offroad;
  // Wheel off-road resistance scales every roughness penalty below (accel,
  // speed cap, drag); slicks go negative and make rough ground worse.
  const rough=(c.onGround?roughnessAt(T,c.x,c.z):0)*(1-t.offroadResist);
  const water=c.onGround?roadWaterAt(T,c.x,c.z,race.clock):0;
  // Rain cauchos keep a grip floor where the road reports wet.
  const grip=Math.max(c.onGround?roadGripAt(T,c.x,c.z,race.clock):1,t.wetFloor);
  const acceleration=t.accel*(1-rough*(1-(terrain?.accel??1)))*(1-water*.28);
  const previous={x:c.x,z:c.z};
  if (c.spin > 0) input = { throttle: 0, steer: 0 };   // skidding on a peel: no control
  if (c.stall > 0) { c.stall -= dt; input = { ...input, throttle: 0 }; }   // flooded engine after a jumped start
  // Drift button: on the ground it hops (a drift starts on landing with the
  // stick held); in the air after a ramp it is a trick.
  const held = !!input.drift;
  if (held && !c.driftHeld && c.spin <= 0) {
    if (c.onGround && c.vf > 4) {
      c.vy = HOP_SPEED; c.onGround = false; c.airTime = 0; c.hopping = true;
    } else if (!c.onGround && !c.hopping && !c.trick && c.airTime > 0.06) {
      c.trick = true; c.trickT = 0;
      if (c.isPlayer) sound.tone(660, 0, 0.09, 'triangle', 0.1);
    }
  }
  c.driftHeld = held;
  c.driftWindow = Math.max(0, c.driftWindow - dt);
  if (!c.drift && held && c.onGround && c.driftWindow > 0 && Math.abs(input.steer) > 0.3 && c.vf > DRIFT_MIN_SPEED) {
    c.drift = Math.sign(input.steer); c.driftT = 0;
  }
  if (c.drift && (!held || c.vf < DRIFT_MIN_SPEED * 0.75 || c.spin > 0)) {
    // Letting go pays the charged turbo; a spin-out or stall loses it.
    const level = driftLevel(c.driftT);
    if (!held && level && c.spin <= 0) {
      c.boost = Math.max(c.boost, DRIFT_BOOST[level]);
      if (c.isPlayer) sound.turbo();
    }
    c.drift = 0; c.driftT = 0;
  }
  let fx = Math.sin(c.h), fz = Math.cos(c.h);
  let rx = -Math.cos(c.h), rz = Math.sin(c.h);
  let vf = c.vx * fx + c.vz * fz;
  let vr = c.vx * rx + c.vz * rz;
  const prevVf = vf;

  if (c.onGround) {
    if (boosting) vf += acceleration * 2.5 * dt;
    else if (input.throttle > 0) vf += acceleration * input.throttle * dt;
    else if (input.throttle < 0) vf -= (vf > 0 ? t.accel * 2.2 * (.75+.25*grip) : acceleration * 0.6) * dt;
    else vf -= Math.sign(vf) * Math.min(Math.abs(vf), 6 * dt);
    // a turbo lifts the cap; when it ends the extra speed bleeds off instead of snapping
    const surfaceTop=top*(1-rough*(1-(terrain?.speed??1)));
    // Rough ground bleeds speed progressively; turbo still helps but cannot
    // cancel the terrain penalty and turn the grass into the fastest route.
    const cap = rough>0?Math.max(surfaceTop*(boosting?1.5:1),prevVf-48*dt):boosting?top*1.5:Math.max(top,prevVf-20*dt);
    vf = Math.max(-surfaceTop * 0.4, Math.min(cap, vf));
    vf*=Math.exp(-rough*(terrain?.drag??0)*dt);
    vf*=Math.exp(-water*.7*dt); // shallow surf slows a kart without moving invisible walls
    // A drift loosens the rear: less lateral grip, so the car slides outward.
    vr *= Math.exp(-t.grip * grip * (c.drift ? 0.38 : 1) * dt);   // mineral runoff leaves more lateral slip
    const steerIn = c.drift ? driftSteer(c.drift, input.steer) * 1.18 : input.steer;
    c.steer += (steerIn - c.steer) * Math.min(1, dt * 8);
    if (c.drift) { c.driftT += dt * driftCharge(c.drift, input.steer); c.driftLvl = driftLevel(c.driftT); }
    const turn = c.steer * t.turn * Math.max(-1, Math.min(1, vf / 10)) * (1 - Math.abs(vf) / top * 0.3);
    c.h += turn * dt;
    c.latAcc = turn * vf;
  } else {
    c.steer += (input.steer - c.steer) * Math.min(1, dt * 3);
    c.h += c.steer * 0.6 * dt;             // a little air control
    c.latAcc = 0;
  }
  c.longAcc = (vf - prevVf) / dt;
  fx = Math.sin(c.h); fz = Math.cos(c.h);
  rx = -Math.cos(c.h); rz = Math.sin(c.h);
  c.vx = fx * vf + rx * vr;
  c.vz = fz * vf + rz * vr;
  c.vf = vf;
  c.vr = vr;
  c.x += c.vx * dt;
  c.z += c.vz * dt;
  T.constrainMotion?.(c,previous);
  c.vf=c.vx*fx+c.vz*fz;c.vr=c.vx*rx+c.vz*rz;

  // ---- vertical: ramps, jumps, tumbles ----
  const g = groundAt(c.x, c.z);
  if (c.onGround) {
    const previousGround=terrain&&Math.abs(offsetOf(previous.x,previous.z))>T.HW?groundAt(previous.x,previous.z):T.surfaceAt(previous.x,previous.z);
    const followingTerrain = Math.abs(c.y-previousGround)<0.15;
    if (g >= c.y - 0.08 || (followingTerrain && Math.abs(g - c.y) < 1.2)) {
      c.vy = (g - c.y) / dt;
      c.y = g;
      const ahead = groundAt(c.x + fx, c.z + fz), behind = groundAt(c.x - fx, c.z - fz);
      c.pitch += (-Math.atan2(ahead - behind, 2) - c.pitch) * Math.min(1, dt * 12);
      c.roll += (0 - c.roll) * Math.min(1, dt * 10);
    } else {
      c.onGround = false;   // drove off the ramp lip: fly!
      c.airTime = 0;
    }
  }
  if (!c.onGround) {
    c.airTime += dt;
    c.vy -= G * dt;
    c.y += c.vy * dt;
    c.pitch += c.pitchV * dt + 0.25 * dt;   // nose slowly drops
    c.roll += c.rollV * dt;
    if (c.airTime > 0.45 && c.scream <= 0 && c.y > 1.2) {
      c.scream = 0.8;
      say(c, LINES.air, 0.9);
    }
    if (c.y <= g) {
      c.y = g;
      const impact = -c.vy;
      const upright = Math.abs(wrapAngle(c.roll)) < 0.7 && Math.abs(wrapAngle(c.pitch)) < 0.7;
      if (upright) {
        c.onGround = true;
        c.vy = 0;
        c.roll = wrapAngle(c.roll);
        c.pitch = wrapAngle(c.pitch);
        c.rollV = c.pitchV = 0;
        c.heave.v -= impact * 0.5;
        if (c.hopping) { c.hopping = false; c.driftWindow = 0.3; }
        if (c.trick) {
          const bonus = trickBoost(c.airTime, true);
          if (bonus) {
            c.boost = Math.max(c.boost, bonus);
            say(c, LINES.trick, 0.9);
            if (c.isPlayer) sound.turbo();
          }
          c.trick = false;
        }
        if (impact > 9) {
          sound.boing();
          race.puffs.spawn(new THREE.Vector3(c.x, 0.2, c.z), { color: 0xe0b07a, count: 6, spread: 2.5, rise: 0.8 });
          if (c.isPlayer) race.shake = Math.min(1, race.shake + 0.25);
        }
      } else {
        // cartoon bounce that sets the car back on its wheels
        c.trick = false; c.hopping = false; c.drift = 0; c.driftT = 0;
        sound.bonk(1.2);
        race.puffs.spawn(new THREE.Vector3(c.x, g + 0.3, c.z), { color: 0xe0b07a, count: 7, spread: 2.5, rise: 0.8 });
        c.vy = 7.5;
        const flight = 2 * c.vy / G;
        c.rollV = (Math.round(c.roll / (Math.PI * 2)) * Math.PI * 2 - c.roll) / flight;
        c.pitchV = (Math.round(c.pitch / (Math.PI * 2)) * Math.PI * 2 - c.pitch) / flight;
        c.vx *= 0.6;
        c.vz *= 0.6;
        c.scream = 0.8;
      }
    }
  }

  // ---- tire walls ----
  // Works on any track shape: the wall normal is the gradient of offsetOf.
  const off = offsetOf(c.x, c.z);
  const limit = T.HW - 1.6;
  if (!terrain && Math.abs(off) > limit) {
    const e = 0.6;
    let nx = offsetOf(c.x + e, c.z) - offsetOf(c.x - e, c.z);
    let nz = offsetOf(c.x, c.z + e) - offsetOf(c.x, c.z - e);
    const nl = Math.hypot(nx, nz) || 1;
    nx /= nl; nz /= nl;   // points to the outside
    const side = Math.sign(off);
    c.x -= nx * (Math.abs(off) - limit) * side;
    c.z -= nz * (Math.abs(off) - limit) * side;
    const vn = (c.vx * nx + c.vz * nz) * side;   // speed into the wall
    if (vn > 0) {
      c.vx -= 1.4 * vn * nx * side;
      c.vz -= 1.4 * vn * nz * side;
      if (vn > 9) {
        c.drift = 0; c.driftT = 0;   // a hard wall hit throws the drift away
        sound.bonk(vn / 10);
        say(c, LINES.wall, 0.8);
        c.vy = Math.max(c.vy, 4);
        c.onGround = false;
        c.airTime = 0;
        c.rollV += (Math.random() < 0.5 ? -1 : 1) * vn * 0.12;
        if (Math.random() < 0.4) popPart(c, vn);
        if (c.isPlayer) race.shake = Math.min(1, race.shake + 0.2);
      }
    }
  }

  // laps
  const prog = progressOf(c);
  if (c.prog > T.TOTAL * 0.75 && prog < T.TOTAL * 0.25) c.lap++;
  else if (c.prog < T.TOTAL * 0.25 && prog > T.TOTAL * 0.75) c.lap--;
  c.prog = prog;

  // timers
  c.dizzy = Math.max(0, c.dizzy - dt);
  c.scream = Math.max(0, c.scream - dt);
  c.honkT = Math.max(0, c.honkT - dt);

  // Tire spray, dust and damage smoke share the bounded particle pool.
  c.puffT -= dt;
  if (c.puffT <= 0) {
    const kicking = c.onGround && ((input.throttle > 0 && Math.abs(vf) < top * 0.55) || Math.abs(c.vr) > 4);
    if (water>.15&&c.onGround&&Math.abs(vf)>7) {
      for(const side of [-1,1])race.puffs.spawn(new THREE.Vector3(c.x-fx*1.5+rx*side,c.y+.2,c.z-fz*1.5+rz*side),
        {color:0xc1e9e3,count:1,size:.45,rise:1.2,life:.35,spread:.8});
    } else if (kicking) {
      race.puffs.spawn(new THREE.Vector3(c.x - fx * 1.6, c.y+0.25, c.z - fz * 1.6), { color: rough>0.1?0x889263:0xe7bd8a, count: 1, size: 0.7, rise: 0.6, life: 0.7 });
    }
    if (boosting) {
      race.puffs.spawn(new THREE.Vector3(c.x - fx * 2.2, c.y + 0.5, c.z - fz * 2.2), { color: pick([0xff7b1c, 0xffd23f]), count: 2, size: 0.6, rise: 0.4, life: 0.35, spread: 0.4 });
    }
    if (c.lost >= 2) {
      race.puffs.spawn(new THREE.Vector3(c.x + fx * 1.4, c.y + 1.6, c.z + fz * 1.4), { color: 0x4a4a52, count: 1, size: 0.6, rise: 2, life: 1 });
    }
    c.puffT = 0.07;
  }
}

// "¡YA!": the player's timing decides a turbo or a stall; rivals sometimes
// nail it too.
function launchGrid() {
  for (const c of race.cars) {
    if (c.remote) continue;
    const timing = c.isPlayer && !AUTO ? startBoost(race.throttleAt) : Math.random() < 0.35 ? startBoost(1.3) : startBoost(2.2);
    if (timing.boost) {
      c.boost = Math.max(c.boost, timing.boost);
      if (c.isPlayer) { sound.turbo(); say(c, LINES.rocket, 1); }
    }
    if (timing.stall) { c.stall = timing.stall; say(c, LINES.stall, 1); }
  }
  race.throttleAt = null;
}

// Sitting in another car's wake builds draft; a full charge slingshots past.
function slipstreams(dt) {
  for (const c of race.cars) {
    if (c.remote || c.done) continue;
    const wake = race.cars.some(o => o !== c && inSlipstream(o, c));
    c.draft = wake ? c.draft + dt : Math.max(0, c.draft - dt * 2);
    if (c.draft >= DRAFT_TIME) {
      c.draft = 0;
      c.boost = Math.max(c.boost, DRAFT_BOOST);
      if (c.isPlayer) { sound.turbo(); c.itemMessage = '¡Rebufo!'; c.itemMessageT = 1; }
    }
  }
}

function collideCars() {
  for (let i = 0; i < race.cars.length; i++) {
    for (let j = i + 1; j < race.cars.length; j++) collidePair(race.cars[i], race.cars[j]);
  }
}

function collidePair(a, b) {
  const hit = resolveContact(a, b);
  if (hit?.kind === 'crash') {
    sound.bonk(hit.speed / 8);
    if (hit.a.hit) crash(a, hit.a.power, hit.a.side);
    if (hit.b.hit) crash(b, hit.b.power, hit.b.side);
  } else if (hit?.kind === 'bump') {
    sound.bonk(0.4);
  }
}

// Sparks under the rear wheels show the drift charge: dust, then blue,
// orange and purple. A stalled engine coughs black smoke instead.
const SPARKS = [0xd8c6a8, 0x4fb6ff, 0xff9a1f, 0xc45bff];
function driftSparks(c, dt) {
  c.sparkT = (c.sparkT || 0) - dt;
  if (c.sparkT > 0) return;
  c.sparkT = 0.05;
  const fx = Math.sin(c.h), fz = Math.cos(c.h), rx = -Math.cos(c.h), rz = Math.sin(c.h);
  if (c.drift && c.onGround) {
    const level = c.remote ? c.driftLvl || 0 : driftLevel(c.driftT);
    for (const side of [-1, 1]) {
      race.puffs.spawn(new THREE.Vector3(c.x - fx * 1.7 + rx * side * 1.1, c.y + 0.25, c.z - fz * 1.7 + rz * side * 1.1),
        { color: SPARKS[level], count: 1, size: level ? 0.42 : 0.6, rise: level ? 0.9 : 0.5, life: level ? 0.28 : 0.5, spread: 0.3 });
    }
  }
  if (c.stall > 0) race.puffs.spawn(new THREE.Vector3(c.x - fx * 2.2, c.y + 0.7, c.z - fz * 2.2), { color: 0x3a3a40, count: 1, size: 0.8, rise: 1.6, life: 0.8 });
  if (c.draft > 0.2 && c.isPlayer) {
    race.puffs.spawn(new THREE.Vector3(c.x + fx * 2 + rx * (Math.random() * 4 - 2), c.y + 1 + Math.random(), c.z + fz * 2 + rz * (Math.random() * 4 - 2)),
      { color: 0xf4f8ff, count: 1, size: 0.25, rise: 0, life: 0.25, spread: 0.2 });
  }
}

function syncCar(c, dt) {
  const car = c.car;
  car.root.position.set(c.x, c.y, c.z);
  // a peel spins the car around twice, easing out
  const k = 1 - c.spin / SPIN;
  // A drift swings the tail out; a trick spins the car once in the air.
  c.driftYaw += ((c.drift ? c.drift * 0.42 : 0) - c.driftYaw) * Math.min(1, dt * 9);
  if (c.trick) c.trickT += dt;
  const trickSpin = c.trick ? Math.min(1, c.trickT / 0.45) * Math.PI * 2 : 0;
  car.root.rotation.y = c.h + c.driftYaw + trickSpin + (c.spin > 0 ? (1 - (1 - k) ** 3) * Math.PI * 4 : 0);
  driftSparks(c, dt);
  car.tumble.rotation.set(c.pitch, 0, c.roll);

  // springy suspension: squat, dive and lean, exaggerated
  const lean = Math.max(-1, Math.min(1, c.latAcc / 60));
  const dive = Math.max(-1, Math.min(1, c.longAcc / 40));
  const heave = c.heave.step(0, 160, 7, dt);
  const sp = c.sp.step(c.onGround ? -dive * 0.12 : 0.05, 140, 6, dt);
  const sr = c.sr.step(c.onGround ? -lean * 0.16 : 0, 140, 6, dt);
  car.chassis.position.y = heave * 0.15 + (c.onGround ? Math.sin(race.clock * 22 + c.def.num) * 0.012 * Math.min(1, Math.abs(c.vf) / 8) : 0);
  car.chassis.rotation.x = sp;
  car.chassis.rotation.z = sr;

  for (const w of car.wheels) {
    w.spin.rotation.x += c.vf * dt / car.radius;
    if (w.front) w.steer.rotation.y = c.steer * 0.45;
  }
  if (car.flag) car.flag.rotation.x = Math.sin(race.clock * 14) * 0.3 * Math.min(1, Math.abs(c.vf) / 8);

  // the driver: big head lags behind every bump and turn
  const d = car.driver;
  d.neck.rotation.z = c.headLag.step(-lean * 0.5 + sr * 2, 90, 5, dt);
  d.neck.rotation.x = -dive * 0.25 + c.heave.v * 0.01;
  d.neck.rotation.y = c.steer * 0.45;
  const open = c.scream > 0 || c.honkT > 0 || (!c.onGround && c.airTime > 0.3);
  d.update(dt, { open, dizzy: c.dizzy > 0, look: c.steer });
  for (const p of car.danglers) {
    p.rotation.z = p.rotation.z * 0.92 + lean * 0.5 + Math.sin(race.clock * 7) * 0.02;
    p.rotation.x = p.rotation.x * 0.92 + dive * 0.4;
  }

  c.bubble.sprite.position.set(c.x, c.y + 4.4, c.z);
  c.bubble.update(dt);
}

function updateRace(dt) {
  if (race.state === 'count') {
    // Online, the room's start time drives every countdown at once.
    if (race.netRace) race.count = Math.min(3.999, 1 + (net.state.startAt - net.now()) / 1000);
    else race.count -= dt;
    const n = Math.ceil(race.count) - 1;
    $('count').textContent = n > 0 ? n : '¡YA!';
    // Rocket start: remember when the gas went down (and stayed down).
    if (playerInput().throttle > 0) race.throttleAt ??= race.count;
    else race.throttleAt = null;
    if (race.count <= 1) {
      race.state = 'go';
      if (race.netRace) race.clock = Math.max(0, (net.now() - net.state.startAt) / 1000);
      launchGrid();
    }
  } else if (race.state === 'go' || race.state === 'end') {
    race.clock += dt;
    if (race.count > 0) {
      race.count -= dt;
      if (race.count <= 0) $('count').textContent = '';
    }
    for (const c of race.cars) {
      if (c.remote) {
        applyRemote(c, dt);
        continue;
      }
      if (c.done) {
        stepCar(c, { throttle: 0, steer: 0 }, dt);
        continue;
      }
      stepCar(c, c.isPlayer && !AUTO ? playerInput() : aiInput(c), dt);
      if (!c.isPlayer) {
        c.aiHonk -= dt;
        const p = race.player;
        if (c.aiHonk <= 0 && Math.hypot(p.x - c.x, p.z - c.z) < 14) {
          honk(c);
          c.aiHonk = rand(5, 10);
        }
      }
      if (c.lap > LAPS) {
        c.done = true;
        c.time = race.clock;
        if (race.netRace) net.finish(c.netId, c.time);
        if (c.isPlayer) finish();
      }
    }
    collideCars();
    slipstreams(dt);
  } else if (race.netRace) {
    // Rivals already on the grid still settle into place during the countdown.
    for (const c of race.cars) if (c.remote) applyRemote(c, dt);
  }
  race.items.update(dt, race.cars, race.state === 'go' || race.state === 'end');
  for (const c of race.cars) syncCar(c, dt);
  race.puffs.update(dt);
  race.debris.update(dt);
  race.sky.update(race.clock);
  for (const o of T.animated) o.userData.tick(race.clock, dt);   // scenery: flags, windmills, birds…
  sound.setEngine(race.player.vf);

  // HUD
  const p = race.player;
  const order = standings();
  const place = order.indexOf(p);
  $('lap').textContent = `${Math.min(LAPS, Math.max(1, p.lap))}/${LAPS}`;
  if (race.shownPlace !== place) {
    race.shownPlace = place;
    $('pos').innerHTML = `${place + 1}<sup>º</sup>`;
    $('pos').setAttribute('aria-label', `Posición ${place + 1} de ${order.length}`);
  }
  $('leader').textContent = order[0] === p ? '¡Tú!' : order[0].name;
  $('time').textContent = clockText(p.done ? p.time : race.clock);
  if (p.lap === LAPS && !p.finalLap && !p.done) {
    p.finalLap = true;
    shout('¡Vuelta final!');
  }
  showItem(p);

  // speedometer + boost bar
  $('speed').textContent = Math.round(Math.abs(p.vf) * 4);
  const boost = $('boost');
  const ratio = Math.min(1, Math.abs(p.vf) / (p.tune.top * 1.5));
  const lit = Math.round(ratio * 8);
  boost.classList.toggle('turbo', p.boost > 0);
  const charge = p.drift ? String(driftLevel(p.driftT)) : '';
  if (boost.dataset.drift !== charge) boost.dataset.drift = charge;
  const segs = boost.children;
  for (let i = 0; i < segs.length; i++) segs[i].classList.toggle('on', i < lit);

  // standings board + minimap, throttled
  race.boardT -= dt;
  if (race.boardT <= 0) {
    race.boardT = 0.2;
    renderBoard(order, p);
    if (race.state === 'end') renderResults(order, p);
    const u = paramOf(p.x, p.z) / T.TOTAL;
    const sector = T.def.sectors?.filter(([start]) => u >= start).at(-1);
    if (sector) $('mm-sub').textContent = sector[1];
  }
  drawMinimap();

  // chase camera with a bit of shake
  const fx = Math.sin(p.h), fz = Math.cos(p.h);
  const want = new THREE.Vector3(p.x - fx * 11, Math.max(5, p.y + 5), p.z - fz * 11);
  if (!race.camPos) race.camPos = want.clone();
  race.camPos.lerp(want, Math.min(1, dt * 4));
  race.shake = Math.max(0, race.shake - dt * 2);
  const sh = race.shake * 0.6;
  race.camera.position.set(race.camPos.x + rand(-sh, sh), race.camPos.y + rand(-sh, sh), race.camPos.z + rand(-sh, sh));
  race.camera.lookAt(p.x + fx * 4, p.y + 1.4, p.z + fz * 4);
  const fov = p.boost > 0 ? 74 : 60;   // turbo stretches the view
  if (Math.abs(race.camera.fov - fov) > 0.05) {
    race.camera.fov += (fov - race.camera.fov) * Math.min(1, dt * 5);
    race.camera.updateProjectionMatrix();
  }
  race.sun.position.set(p.x - 30, p.y + 40, p.z + 25);
  race.sun.target.position.set(p.x, p.y, p.z);
}

// Each slot rolls independently: picking a reserve never locks the active item.
const ICONS = Object.values(ITEMS).map((i) => i.icon);
let lastItem = '';
function showItem(p) {
  const key = JSON.stringify([p.inventory.map(i => i && [i.kind, i.n, Math.ceil(i.rolling * 12)]),
    p.selected, p.itemMessageT > 0 ? p.itemMessage : '', p.coins, p.coinsCollected, p.coinFlash > 0, p.done, p.spin > 0]);
  if (key === lastItem) return;
  lastItem = key;
  p.inventory.forEach((item, i) => {
    const selected = i === p.selected;
    const label = item ? item.rolling > 0 ? 'Abriendo…' : ITEMS[item.kind].name : 'Vacío';
    $('item-icon-' + i).innerHTML = item ? item.rolling > 0 ? ICONS[Math.floor(item.rolling * 12) % ICONS.length] : ITEMS[item.kind].icon : '+';
    $('item-n-' + i).textContent = item?.n > 1 ? `×${item.n}` : '';
    $('item-label-' + i).textContent = label;
    const slot = $('item-slot-' + i);
    slot.classList.toggle('selected', selected);
    slot.setAttribute('aria-pressed', String(selected));
    slot.setAttribute('aria-label', `Objeto ${i + 1}: ${label}${selected ? ', equipado' : ', seleccionar'}`);
    slot.disabled = !item || p.done;
  });
  const item = activeItem(p), ready = item && item.rolling <= 0 && !p.done && p.spin <= 0;
  const status = p.itemMessageT > 0 ? p.itemMessage : canBlock(p) ? 'Mango equipado · bloquea un mangazo' :
    item ? 'Elige hacia dónde usarlo' : 'Rompe cajas de madera · guarda 2 objetos';
  if ($('item-status').textContent !== status) $('item-status').textContent = status;
  $('item').classList.toggle('protected', canBlock(p));
  $('throw-front').disabled = $('throw-back').disabled = !ready;
  $('throw-front').querySelector('span').textContent = item?.kind === 'jugo' ? 'Beber' : 'Adelante';
  $('throw-back').disabled = !ready || item.kind === 'jugo';
  $('swap-item').disabled = !p.inventory[1 - p.selected] || p.done;
  $('coin-count').textContent = String(p.coins).padStart(2, '0');
  $('coin-bonus').textContent = `+${Number((p.coins * COIN_SPEED * 100).toFixed(1)).toLocaleString('es-VE')}% velocidad`;
  $('coins').classList.toggle('picked', p.coinFlash > 0);
  $('coins').classList.toggle('full', p.coins === MAX_COINS);
}

// Finished cars by time, then everyone else by how far along they are.
function standings() {
  return raceOrder(race.cars, T.TOTAL);
}

function finish() {
  race.state = 'end';
  const p = race.player;
  // A racer the room timed out has no time of its own: everyone finished ahead.
  const ahead = (c) => c.done && (!p.done || c.time < p.time);
  const place = 1 + race.cars.filter((c) => c !== p && ahead(c)).length;
  const winner = race.cars.filter(ahead).sort((a, b) => a.time - b.time)[0];
  $('result-title').textContent = !p.done ? 'Se acabó el tiempo' : place === 1 ? '¡Ganaste!' : `${place}º lugar`;
  $('result-time').textContent = `${T.name} · ${LAPS} vueltas · ${p.done ? clockText(p.time) : 'sin terminar'} · ${p.def.name} · ${p.lost} piezas perdidas`
    + (winner && place > 1 ? ` · ganó ${winner.name}` : '');
  if (race.netRace) updateResultActions(net.state);
  else { $('again').textContent = 'Otra vez'; $('again').disabled = false; $('back').textContent = 'Garaje'; }
  race.resultKey = '';
  renderResults(standings(), p);
  $('result').classList.remove('hidden');
  $('result-coins').textContent = `${p.coinsCollected} monedas recogidas · +${Number((p.coins * COIN_SPEED * 100).toFixed(1)).toLocaleString('es-VE')}% de velocidad`;
  $('again').focus({ preventScroll: true });
}

// Podium (top three, with their car pictures) and the full classification.
// Rivals keep racing behind the results, so this refreshes as they finish.
const PODIUM = [['var(--pk-yellow)', 260, 124], ['var(--pk-teal)', 190, 96], ['var(--pk-coral)', 140, 86]];
function renderResults(order, player) {
  const key = order.map(c => `${c.name}:${c.done}`).join();
  if (key === race.resultKey) return;
  race.resultKey = key;
  const thumbs = $('car-lineup').querySelectorAll('img');
  const who = (c) => {
    const src = thumbs[CARS.indexOf(c.def)]?.getAttribute('src');
    return src ? `<img src="${src}" alt="">` : `<b style="--car:${c.def.color}">${c.def.num}</b>`;
  };
  // Second, first, third, like a real podium.
  $('podium').innerHTML = [1, 0, 2].filter(i => order[i]).map(i => {
    const c = order[i], [color, h, w] = PODIUM[i];
    return `<li style="--c:${color};--h:${h}px;--w:${w}px"><span class="who">${who(c)}</span>`
      + `<span class="name">${esc(c.name)}</span><b class="place">${i + 1}</b></li>`;
  }).join('');
  fillRoster($('result-board'), order.map((c, i) => {
    const chip = document.createElement('span');
    chip.className = 'chip';
    chip.style.setProperty('--c', c.def.color);
    return { rank: i + 1, lead: chip, name: c.name, me: c === player,
      end: c.done ? clockText(c.time) : `vuelta ${Math.min(LAPS, Math.max(1, c.lap))}/${LAPS}` };
  }));
}


// ======================================================================
// Online (online.js + server/room.js). Remote cars are kinematic: they
// follow their owner's poses about 110 ms behind, never local physics.
// ======================================================================
// Poses carry the sender's estimate of server time, so bursts from a slow
// frame still interpolate evenly. The delay follows each sender's own rate.
function sendPoses() {
  if (!race.netRace || !['go', 'end'].includes(race.state)) return;
  const now = performance.now();
  if (now - race.poseAt < 1000 / POSE_HZ) return;
  race.poseAt = now;
  const stamp = Math.round(net.now());
  net.poses(race.cars.filter(c => !c.remote).map(c => [c.netId, stamp, ...packPose(c)]));
}

function resumePose(c, p) {
  if (!p) return;
  [c.x, c.y, c.z, c.h, c.pitch, c.roll, c.vf, c.steer] = p;
  c.vx = Math.sin(c.h) * c.vf; c.vz = Math.cos(c.h) * c.vf;
  c.lap = p[11]; c.prog = p[12]; c.coins = p[14];
}

function applyRemote(c, dt) {
  const buf = c.buf;
  if (!buf.length) { c.vx = c.vz = 0; return; }   // still on its grid slot
  const at = net.now() - c.delay;
  while (buf.length > 2 && buf[1].t <= at) buf.shift();
  const a = buf[0], b = buf[1] || a;
  const k = b === a ? 0 : Math.max(0, Math.min(1, (at - a.t) / (b.t - a.t)));
  // Past the newest pose (a late packet), coast briefly along its heading.
  const ahead = buf.length < 2 || at > b.t ? Math.min(0.25, (at - b.t) / 1000) : 0;
  const P = a.p, Q = b.p;
  const lerp = (i) => P[i] + (Q[i] - P[i]) * k, turn = (i) => P[i] + wrapAngle(Q[i] - P[i]) * k;
  const h0 = c.h, vf0 = c.vf;
  c.x = lerp(0); c.y = lerp(1); c.z = lerp(2); c.h = turn(3); c.pitch = turn(4); c.roll = turn(5);
  c.vf = lerp(6); c.steer = lerp(7); c.spin = lerp(8); c.boost = Q[9];
  const f = Q[10];
  c.onGround = !!(f & FLAG.ground);
  c.dizzy = f & FLAG.dizzy ? 1 : 0;
  c.scream = f & FLAG.open ? 0.2 : 0;
  c.full = !!(f & FLAG.full);
  c.drift = f & FLAG.drift ? (f & FLAG.driftRight ? -1 : 1) : 0;
  c.driftLvl = (f >> DRIFT_SHIFT) & 3;
  c.shield = f & FLAG.shield ? 1 : 0;
  if (f & FLAG.done) c.done = true;
  c.lap = Q[11]; c.prog = Q[12]; c.coins = Q[14];
  // Parts that fell off on the owner's screen fall off here too.
  for (let n = Q[13] - c.lost; n > 0; n--) popPart(c, 10);
  c.lost = Math.max(c.lost, Q[13]);
  c.vx = Math.sin(c.h) * c.vf; c.vz = Math.cos(c.h) * c.vf;
  if (ahead > 0 && c.onGround) { c.x += c.vx * ahead; c.z += c.vz * ahead; }
  c.latAcc = wrapAngle(c.h - h0) / dt * c.vf;
  c.longAcc = (c.vf - vf0) / dt;
}

const racerById = (id) => race.cars.find(c => c.netId === id);

function onNetPose(id, stamp, pose) {
  const c = race.netRace && racerById(id);
  if (!c?.remote) return;
  const last = c.buf.at(-1);
  if (last && stamp <= last.t) return;   // stale or duplicate
  if (last) c.gap = c.gap * 0.8 + Math.min(1000, stamp - last.t) * 0.2;
  c.delay = Math.max(100, Math.min(450, c.gap * 1.6 + 40));
  c.buf.push({ t: stamp, p: pose });
  if (c.buf.length > 24) c.buf.shift();
}

function onNetFx(id, kind, d) {
  const c = race.netRace && racerById(id);
  if (!c || !race.items || !d) return;
  if (kind === 'throw') race.items.remoteThrow(c, d);
  else if (kind === 'peel') race.items.remotePeel(c, d);
  else if (kind === 'hit') race.items.remoteHit(c, d);
  else if (kind === 'slip') race.items.remoteSlip(d);
  else if (kind === 'honk' && c.honkT <= 0) {
    c.honkT = sound.horn(c.def.horn);
    c.bubble.say(LINES.honk[c.def.horn], c.honkT + 0.2);
    c.heave.v += 5;
  } else if (kind === 'say') c.bubble.say(String(d.text ?? '').slice(0, 40), Math.min(3, Number(d.time) || 1.2));
}

// Room state into the race: finishes, departures and bot control.
function syncRacers(s) {
  if (!race.netRace || s.raceId !== race.netRace) return;
  for (const r of s.racers) {
    const c = racerById(r.id);
    if (!c) continue;
    if (r.retired && !c.isPlayer) {
      disposeRacer(c);
      race.cars.splice(race.cars.indexOf(c), 1);
      continue;
    }
    if (r.done && c.remote) { c.done = true; c.time = r.time; }
    const owned = r.owner === net.id;
    if (owned && c.remote) {
      // The host left: this client now drives the bots from where they were.
      c.remote = false; c.buf = [];
      c.vx = Math.sin(c.h) * c.vf; c.vz = Math.cos(c.h) * c.vf;
      c.lane = gridSlot(r.slot).lane;
    } else if (!owned && !c.remote && !c.isPlayer) c.remote = true;
  }
}

function onNetState(s) {
  if (!s.racers) return;   // the room's first state has not arrived yet
  const me = s.players.find(p => p.id === net.id);
  const inRace = s.racers.some(r => r.id === net.id && !r.retired);
  if (s.phase === 'loading' && inRace && s.raceId !== race.netRace && mode !== 'loading') {
    selectTrack(s.track);
    startRace(garage.index, garage.wheel, s.racers);
  } else if (['count', 'race'].includes(s.phase) && inRace && !race.netRace && mode === 'garage' && me?.racing) {
    // Back from a reload: rejoin the race already under way.
    selectTrack(s.track);
    startRace(garage.index, garage.wheel, s.racers);
  } else if (s.phase === 'lobby' && race.netRace && mode !== 'garage') {
    toGarage();
  }
  syncRacers(s);
  if (s.phase === 'results' && race.netRace === s.raceId && mode === 'race' && race.player && !race.player.done && race.state !== 'end') finish();
  if (mode === 'race' && race.state === 'end') updateResultActions(s);
  if (mode === 'garage') {
    if (!net.isHost && s.track && TRACKS[trackIndex]?.id !== s.track) selectTrack(s.track);
    renderLobby(s);
  }
}

function renderLobby(s) {
  const host = net.isHost, live = !['lobby', 'results'].includes(s.phase);
  const racing = s.players.find(p => p.id === net.id)?.racing;
  $('lobby-code').textContent = net.code;
  $('lobby-roster').innerHTML = s.players.map((p, i) =>
    `<li class="pk-row${p.id === net.id ? ' is-me' : ''}${p.connected ? '' : ' away'}"><span class="pk-row-n">${p.id === s.host ? SVG.crown : i + 1}</span>`
    + `<span class="chip" style="--c:${CARS[p.car]?.color || '#fff'}"></span>${esc(p.name)}`
    + `<span class="pk-row-end">${p.connected ? esc(CARS[p.car]?.name || '') : 'reconectando…'}</span></li>`).join('');
  const bots = Math.max(0, (s.bots ? Math.max(4, s.players.length) : s.players.length) - s.players.length);
  $('launch-note').innerHTML = `<span class="pk-dot"></span>${s.players.length} ${s.players.length === 1 ? 'pana' : 'panas'}${bots ? ` + ${bots} ${bots === 1 ? 'rival' : 'rivales'}` : ''}`;
  $('lobby-bots').checked = s.bots;
  $('lobby-bots').disabled = !host || live;
  $('t-prev').disabled = $('t-next').disabled = !host || live;
  const hostName = s.players.find(p => p.id === s.host)?.name || 'el anfitrión';
  $('lobby-status').textContent = live
    ? (racing ? 'Tu carrera sigue en curso.' : 'Carrera en curso: entras en la próxima.')
    : host ? 'Tú eliges la pista y das la salida.' : `${hostName} elige la pista y da la salida.`;
  $('play').textContent = host ? (live ? 'Carrera en curso' : '¡ARRANCAR!') : live ? 'Carrera en curso' : `Esperando a ${hostName}`;
  $('play').disabled = live || !host || mode !== 'garage';
}

function updateResultActions(s) {
  const host = net.isHost;
  $('again').textContent = host ? 'Otra carrera' : 'Esperando al anfitrión';
  $('again').disabled = !host || s.phase !== 'results';
  $('back').textContent = host ? 'Sala' : 'Garaje';
}

function inviteLink() {
  return inviteUrl(net?.code || ROOM || newRoomCode());
}

let joining = null;
async function goOnline(code, lead) {
  if (net || joining) return joining;
  $('lobby').hidden = false;
  $('go-online').hidden = true;
  $('lobby-code').textContent = code;
  $('lobby-status').textContent = 'Conectando con la sala…';
  $('play').disabled = true;
  const url = new URL(location.href);
  url.searchParams.set('room', code);
  url.searchParams.delete('lead');
  history.replaceState(null, '', url);
  joining = (async () => {
    try {
      const { joinRace } = await import('./online.js');
      net = await joinRace({ code, lead, name: ME.name, avatar: ME.avatar, car: garage.index, wheel: garage.wheel });
    } catch (error) {
      console.warn('Derrape online unavailable', error);
      $('lobby-status').textContent = error?.full ? 'La sala está llena.' : 'No pudimos entrar a la sala. Puedes correr en local.';
      $('play').disabled = false;
      $('play').textContent = '¡JUGAR!';
      $('lobby-solo').hidden = false;
      return null;
    } finally { joining = null; }
    net.on('state', onNetState);
    net.on('pose', onNetPose);
    net.on('fx', onNetFx);
    net.on('status', (text, bad) => {
      $('net-status').textContent = text;
      $('net-status').hidden = !text;
      $('net-status').classList.toggle('bad', !!bad);
    });
    net.on('left', () => {
      $('lobby-status').textContent = 'Saliste de la sala. Recarga para volver a entrar.';
      $('lobby-solo').hidden = false;
    });
    $('lobby-solo').hidden = false;
    onNetState(net.state);
    return net;
  })();
  return joining;
}

// ======================================================================
let mode = 'garage';
const clock = new THREE.Clock();
const STEP = 1 / 60;
let acc = 0;

function frame() {
  const dt = Math.min(clock.getDelta(), 0.25);
  if (mode === 'garage') {
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.05;
    updateGarage(dt);
    renderer.render(garage.scene, garage.camera);
  } else if (mode === 'race') {
    renderer.toneMapping = THREE.NoToneMapping;
    // fixed physics steps: same race speed at any frame rate
    if (!paused) acc += dt * SPEED;
    while (acc >= STEP && mode === 'race') {
      updateRace(STEP);
      acc -= STEP;
    }
    sendPoses();
    renderer.render(race.scene, race.camera);
  }
  if (!(DEBUG && QS.has('manual'))) requestAnimationFrame(frame);
}

function resize() {
  for (const cam of [garage.camera, race.camera]) {
    cam.aspect = innerWidth / innerHeight;
    cam.updateProjectionMatrix();
  }
  renderer.setSize(innerWidth, innerHeight);
  // Make room for the information panel and the lineup, with a centered car
  // above the compact garage controls on a phone.
  const wide = innerWidth > 760;
  garage.camera.zoom = wide ? 1 : Math.min(0.86, innerWidth / innerHeight * 1.3);
  // The garage has a card on each side, so the car stays centered between them.
  garage.camera.setViewOffset(innerWidth, innerHeight, wide ? -10 : 0,
    wide ? 20 : innerHeight * 0.12, innerWidth, innerHeight);
}
addEventListener('resize', resize);
resize();

if (DEBUG) Object.assign(window, { menu, race, garage, renderer, crash, stepCar, startRace, updateRace, toGarage, showWheel, ITEMS, TRACKS, buildTrack, getActiveTrack: () => T, getNet: () => net });

// ?track=desierto wins; otherwise the last pick, otherwise the estadio
let savedTrack = 'estadio';
try { savedTrack = localStorage.getItem('derrape:track') || savedTrack; } catch { /* private mode */ }
// The cauchos from the last visit (fallback calle) dress the turntable car.
try { garage.wheel = wheelById(localStorage.getItem('derrape:wheels')).id; } catch { /* private mode */ }
selectTrack(QS.get('track') || savedTrack);
showCar(0);
frame();
performance.mark('derrape:garage-ready');
let lastGarageInput = performance.now();
for (const event of ['pointerdown', 'wheel', 'keydown']) {
  addEventListener(event, () => { lastGarageInput = performance.now(); }, { passive: true });
}
renderer.domElement.addEventListener('pointermove', event => {
  if (event.buttons) lastGarageInput = performance.now();
});
const cards = garageCards(CARS, garageCar, showCar,
  () => mode === 'garage' && performance.now() - lastGarageInput > 350);
$('car-lineup').append(cards.fragment);
cards.ready.catch(error => console.warn('Garage previews unavailable', error));
const wheelStrip = wheelCards(WHEEL_DEFINITIONS, showWheel,
  () => mode === 'garage' && performance.now() - lastGarageInput > 350);
$('wheel-lineup').append(wheelStrip.fragment);
wheelStrip.ready.catch(error => console.warn('Wheel previews unavailable', error));
showWheel(garage.wheel);
if (ROOM) goOnline(ROOM, QS.has('lead'));
