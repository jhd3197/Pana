import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { CARS } from './cars.js';
import { garageCards } from './garage-cards.js';
import { paintNext } from './loading.js';
import { sound, Puffs, Debris, makeBubble } from '/engine/fx.js';
import { createItems, ITEMS, SPIN } from './items.js';
import { activeItem, canBlock, coinMultiplier, COIN_SPEED, MAX_COINS } from './item-rules.js';
import { TRACKS, getTrack, makeTrack } from './tracks.js';
import { roughnessAt } from './offroad.js';
import { loadAvatar, loadName, randomAvatar } from '/engine/avatar.js';

const $ = (id) => document.getElementById(id);
const rand = (a, b) => a + Math.random() * (b - a);
const pick = (list) => list[Math.floor(Math.random() * list.length)];
const wrapAngle = (a) => Math.atan2(Math.sin(a), Math.cos(a));

const LAPS = 3;
const G = 30;   // cartoon gravity: snappy jumps
// test switches: ?auto lets the AI drive your car, ?speed=4 fast-forwards
const QS = new URLSearchParams(location.search);
const AUTO = QS.has('auto');
const SPEED = Number(QS.get('speed')) || 1;
const DEBUG = QS.has('debug');

// You drive as the pana you made in the hub; the rival is a random one.
const ME = { name: loadName(), avatar: loadAvatar() };
const RIVALS = ['Don Pancho', 'La Chama', 'El Gocho', 'Tía Carmen', 'El Catire', 'Yoli'];

const LINES = {
  crash: ['¡AY!', '¡UEPA!', '¡Ñooo!', '¡Mi carro!', '¡Epa, chamo!', '¡Qué molleja!'],
  air: ['¡Wiii!', '¡Ayayay!', '¡Me fui!'],
  wall: ['¡Ups!', '¡Pum!', '¡Mi pintura!'],
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
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
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
  if (!garage.cars.has(index)) garage.cars.set(index, CARS[index].build(ME.avatar));
  return garage.cars.get(index);
}

function showCar(i) {
  garage.index = (i + CARS.length) % CARS.length;
  const def = CARS[garage.index];
  garage.turn.clear();
  // At most eight garage models; thumbnails borrow these same instances.
  // Race models stay independent because their parts can break off.
  garage.car = garageCar(garage.index);
  garage.turn.add(garage.car.root);
  garage.ring.material.color.set(def.color);

  document.documentElement.style.setProperty('--car', def.color);
  $('car-num').textContent = def.num;
  $('car-name').textContent = def.name;
  $('car-blurb').textContent = def.blurb;
  $('stats').innerHTML = Object.entries(def.stats)
    .map(([k, v]) => `<div><dt>${k}</dt><dd><i style="width:${Math.round(v * 100)}%"></i></dd></div>`)
    .join('');
  $('driver-name').textContent = ME.name;
  $('dots').innerHTML = CARS.map((_, j) => `<span class="${j === garage.index ? 'on' : ''}"></span>`).join('');
  for (const [j, button] of [...$('car-lineup').children].entries()) button.setAttribute('aria-pressed', String(j === garage.index));
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
  startRace(garage.index);
};

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
  // sky dome: warm at the horizon, blue overhead (recolored per track)
  const domeGeo = new THREE.SphereGeometry(1200, 24, 12);
  race.dome = new THREE.Mesh(domeGeo, new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.BackSide, fog: false }));
  s.add(race.dome);
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
  const dp = race.dome.geometry.attributes.position;
  const col = [];
  const horizon = new THREE.Color(pal.horizon), top = new THREE.Color(pal.skyTop);
  for (let i = 0; i < dp.count; i++) {
    const c = horizon.clone().lerp(top, Math.pow(Math.max(0, dp.getY(i) / 1200), 0.6));
    col.push(c.r, c.g, c.b);
  }
  race.dome.geometry.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
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
    race.trackGroup.traverse((o) => o.geometry?.dispose());
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
  selectTrack(TRACKS[(i + TRACKS.length) % TRACKS.length].id);
}

// ---------- race HUD: standings board + minimap ----------
function renderBoard(order, player) {
  $('board').innerHTML = order.map((c, i) =>
    `<li class="${c === player ? 'me' : ''}"><i>${i + 1}</i><span class="chip" style="--c:${c.def.color}"></span>${c.name}</li>`
  ).join('');
}

const mm = $('mm');
const mmCtx = mm.getContext('2d');
let mmPts = [];
function buildMinimap() {
  // sample the centerline and fit it into the canvas with a margin
  const N = 160;
  const raw = [];
  for (let i = 0; i < N; i++) raw.push(T.pointAt((i / N) * T.TOTAL));
  const margin = 16;
  const minX = Math.min(...raw.map(p=>p.x)), maxX = Math.max(...raw.map(p=>p.x));
  const minZ = Math.min(...raw.map(p=>p.y)), maxZ = Math.max(...raw.map(p=>p.y));
  const scale = Math.min((mm.width-margin*2)/(maxX-minX), (mm.height-margin*2)/(maxZ-minZ));
  mmPts = raw.map(p=>[mm.width/2+(p.x-(minX+maxX)/2)*scale,mm.height/2+(p.y-(minZ+maxZ)/2)*scale]);
}

function drawMinimap() {
  mmCtx.clearRect(0, 0, mm.width, mm.height);
  mmCtx.lineJoin = 'round';
  mmCtx.lineCap = 'round';
  mmCtx.beginPath();
  mmPts.forEach(([x, y], i) => (i ? mmCtx.lineTo(x, y) : mmCtx.moveTo(x, y)));
  mmCtx.closePath();
  mmCtx.strokeStyle = '#16161a';
  mmCtx.lineWidth = 8;
  mmCtx.stroke();
  mmCtx.strokeStyle = '#f6f1e4';
  mmCtx.lineWidth = 4;
  mmCtx.stroke();
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

function makeRacer(index, isPlayer, name) {
  const def = CARS[index];
  const who = isPlayer ? ME : { name, avatar: randomAvatar() };
  const car = def.build(who.avatar);
  // Retain ownership even after a bumper detaches and expires from the scene.
  car.geometries = new Set();
  car.root.traverse(o => { if (o.geometry) car.geometries.add(o.geometry); });
  race.scene.add(car.root);
  const bubble = makeBubble();
  race.scene.add(bubble.sprite);
  return {
    def, car, bubble, isPlayer, name: who.name,
    skill: isPlayer ? 1 : rand(0.88, 0.97),   // rivals top out a bit below their car's max
    x: 0, z: 0, y: 0, h: Math.PI / 2, vx: 0, vz: 0, vy: 0, vf: 0, vr: 0, steer: 0, latAcc: 0, longAcc: 0,
    onGround: true, pitch: 0, roll: 0, pitchV: 0, rollV: 0,
    heave: new Spring(), sp: new Spring(), sr: new Spring(), headLag: new Spring(),
    lap: 0, prog: 0, done: false, time: 0,
    dizzy: 0, scream: 0, honkT: 0, lost: 0, puffT: 0, aiHonk: rand(3, 8), airTime: 0,
    inventory: [null, null], selected: 0, useT: 0, boost: 0, spin: 0,
    coins: 0, coinsCollected: 0, coinFlash: 0, itemMessage: '', itemMessageT: 0,
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
  });
  c.y = groundAt(c.x, c.z);
  c.prog = progressOf(c);
}

function progressOf(c) {
  return (paramOf(c.x, c.z) - T.LINE + T.TOTAL) % T.TOTAL;
}

function clearRace() {
  resetInput();
  for (const c of race.cars) {
    race.scene.remove(c.car.root);
    c.car.driver.dispose();
    race.scene.remove(c.bubble.sprite);
    c.car.geometries.forEach(g => g.dispose());
    c.bubble.sprite.material.map.dispose();
    c.bubble.sprite.material.dispose();
  }
  race.cars = [];
  race.puffs.clear();
  race.debris.clear();
  race.items?.clear();
  race.player = null;
}

let loadGeneration = 0;
async function startRace(playerIndex) {
  if (mode === 'loading') return;
  const generation = ++loadGeneration;
  mode = 'loading';
  race.state = 'loading';
  garage.controls.enabled = false;
  $('loading').classList.remove('hidden');
  $('loading').setAttribute('aria-busy', 'true');
  $('garage').inert = $('race').inert = true;
  $('loading-back').focus();
  $('loading-title').textContent = TRACKS[trackIndex].name;
  $('play').disabled = true;
  sound.stopEngine();
  const step = async (label, progress) => {
    $('loading-status').textContent = label;
    $('loading-progress').value = progress;
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
    const others = CARS.map((_, i) => i).filter((i) => i !== playerIndex).sort(() => Math.random() - 0.5);
    const names = [...RIVALS].sort(() => Math.random() - 0.5);
    race.cars = [makeRacer(playerIndex, true)];
    for (let i = 1; i < RACERS; i++) {
      if (!await step(`Preparando los panas… ${i}/${RACERS}`, 0.5 + i * 0.08)) return;
      race.cars.push(makeRacer(others[i - 1], false, names[i - 1]));
    }
    // a two-by-two grid; you start at the back so there's someone to pass
    race.cars.forEach((c, i) => placeRacer(c, i % 2 ? -3.5 : 3.5, Math.floor((RACERS - 1 - i) / 2)));
    race.player = race.cars[0];
    race.playerIndex = playerIndex;
    race.clock = 0;
    race.count = 3.999;
    race.boardT = 0;
    race.camPos = null;
    if (!await step('Todo listo. ¡A correr!', 0.9)) return;
    renderer.toneMapping = THREE.NoToneMapping;
    updateRace(0);
    await renderer.compileAsync(race.scene, race.camera);
    if (generation !== loadGeneration) return;
    // Upload geometry and draw once behind the loading panel. The countdown
    // starts only after this first frame, never while compilation is running.
    renderer.render(race.scene, race.camera);
    if (!await step('¡Listo!', 1)) return;
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
  $('play').focus({ preventScroll: true });
}

$('again').onclick = () => startRace(race.playerIndex);
$('back').onclick = toGarage;
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

// Multi-touch keeps steering and throttle independent. Lost focus/capture
// releases input, including a thumb dragged off a control or a cancelled touch.
const pointers = new Map();
function resetInput() { race.keys = {}; pointers.clear(); }
for (const button of document.querySelectorAll('[data-drive]')) {
  button.onpointerdown = e => {
    e.preventDefault(); sound.unlock();
    pointers.set(e.pointerId, button.dataset.drive);
    button.setPointerCapture(e.pointerId);
  };
  button.onpointerup = button.onpointercancel = button.onlostpointercapture = e => pointers.delete(e.pointerId);
}
addEventListener('blur', resetInput);
document.addEventListener('visibilitychange', () => { if (document.hidden) resetInput(); });
addEventListener('keydown', (e) => {
  if (e.target.closest('input, textarea, select, [contenteditable="true"]')) return;
  const k = e.key.toLowerCase();
  race.keys[k] = true;
  if (k === 'escape' && (mode === 'race' || mode === 'loading')) toGarage();
  if (k === 'h' && !e.repeat) {
    if (mode === 'race' && race.player) honk(race.player);
    else if (mode === 'garage') garageHonk();
  }
  if (k === 'm') sound.muted = !sound.muted;
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
  for (const key of pointers.values()) k[key] = true;
  return {
    throttle: (k.w || k.arrowup ? 1 : 0) - (k.s || k.arrowdown ? 1 : 0),
    steer: (k.a || k.arrowleft ? 1 : 0) - (k.d || k.arrowright ? 1 : 0),
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
  const throttle = Math.abs(diff) > 0.6 ? 0.55 : gap > 40 ? 0.75 : 1;
  return { throttle, steer: Math.max(-1, Math.min(1, diff * 2.8)) };
}

function say(c, lines, time) {
  c.bubble.say(typeof lines === 'string' ? lines : pick(lines), time);
}

function honk(c) {
  if (c.honkT > 0) return;
  c.honkT = sound.horn(c.def.horn);
  say(c, LINES.honk[c.def.horn], c.honkT + 0.2);
  c.heave.v += 5;   // the whole car jumps when it honks
}

function popPart(c, power) {
  const parts = c.car.detachables;
  if (!parts.length) return;
  const obj = parts.splice(Math.floor(Math.random() * parts.length), 1)[0];
  race.puffs.spawn(obj.getWorldPosition(new THREE.Vector3()), { color: 0x9a9aa2, count: 5, size: 0.8 });
  race.debris.launch(obj, new THREE.Vector3(c.vx * 0.5 + rand(-4, 4), 6 + power * 0.3 + rand(0, 4), c.vz * 0.5 + rand(-4, 4)));
  c.lost++;
}

function crash(c, power, side) {
  c.vy = Math.max(c.vy, power * 0.38 / c.def.tune.mass);
  c.onGround = false;
  c.airTime = 0;
  c.rollV += side * power * 0.35 / c.def.tune.mass;
  c.pitchV += rand(-1, 1) * power * 0.12;
  c.dizzy = 2.6;
  c.scream = 1.2;
  say(c, LINES.crash);
  popPart(c, power);
  if (power > 14) popPart(c, power);
  race.puffs.spawn(new THREE.Vector3(c.x, c.y + 1, c.z), { color: 0xc8c8d0, count: 8, spread: 2 });
  if (c.isPlayer) race.shake = Math.min(1, race.shake + power * 0.05);
}

function stepCar(c, input, dt) {
  const t = c.def.tune;
  const boosting = c.boost > 0;
  const top = t.top * c.skill * coinMultiplier(c);
  const rough=c.onGround?roughnessAt(T,c.x,c.z):0,terrain=T.def.offroad;
  const acceleration=t.accel*(1-rough*(1-(terrain?.accel??1)));
  const previous={x:c.x,z:c.z};
  if (c.spin > 0) input = { throttle: 0, steer: 0 };   // skidding on a peel: no control
  let fx = Math.sin(c.h), fz = Math.cos(c.h);
  let rx = -Math.cos(c.h), rz = Math.sin(c.h);
  let vf = c.vx * fx + c.vz * fz;
  let vr = c.vx * rx + c.vz * rz;
  const prevVf = vf;

  if (c.onGround) {
    if (boosting) vf += acceleration * 2.5 * dt;
    else if (input.throttle > 0) vf += acceleration * input.throttle * dt;
    else if (input.throttle < 0) vf -= (vf > 0 ? t.accel * 2.2 : acceleration * 0.6) * dt;
    else vf -= Math.sign(vf) * Math.min(Math.abs(vf), 6 * dt);
    // a turbo lifts the cap; when it ends the extra speed bleeds off instead of snapping
    const surfaceTop=top*(1-rough*(1-(terrain?.speed??1)));
    // Rough ground bleeds speed progressively; turbo still helps but cannot
    // cancel the terrain penalty and turn the grass into the fastest route.
    const cap = rough>0?Math.max(surfaceTop*(boosting?1.5:1),prevVf-48*dt):boosting?top*1.5:Math.max(top,prevVf-20*dt);
    vf = Math.max(-surfaceTop * 0.4, Math.min(cap, vf));
    vf*=Math.exp(-rough*(terrain?.drag??0)*dt);
    vr *= Math.exp(-t.grip * dt);          // tires bite, a bit of slide remains
    c.steer += (input.steer - c.steer) * Math.min(1, dt * 8);
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
        if (impact > 9) {
          sound.boing();
          race.puffs.spawn(new THREE.Vector3(c.x, 0.2, c.z), { color: 0xe0b07a, count: 6, spread: 2.5, rise: 0.8 });
          if (c.isPlayer) race.shake = Math.min(1, race.shake + 0.25);
        }
      } else {
        // cartoon bounce that sets the car back on its wheels
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

  // dust and damage smoke
  c.puffT -= dt;
  if (c.puffT <= 0) {
    const kicking = c.onGround && ((input.throttle > 0 && Math.abs(vf) < top * 0.55) || Math.abs(c.vr) > 4);
    if (kicking) {
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

function collideCars() {
  for (let i = 0; i < race.cars.length; i++) {
    for (let j = i + 1; j < race.cars.length; j++) collidePair(race.cars[i], race.cars[j]);
  }
}

function collidePair(a, b) {
  if (Math.abs(a.y - b.y) > 1.6) return;
  const dx = b.x - a.x, dz = b.z - a.z;
  const d = Math.hypot(dx, dz);
  const min = 3.3;
  if (d <= 0 || d >= min) return;
  const nx = dx / d, nz = dz / d;
  const ma = a.def.tune.mass, mb = b.def.tune.mass;
  const push = min - d;
  a.x -= nx * push * mb / (ma + mb);
  a.z -= nz * push * mb / (ma + mb);
  b.x += nx * push * ma / (ma + mb);
  b.z += nz * push * ma / (ma + mb);
  const vrel = (a.vx - b.vx) * nx + (a.vz - b.vz) * nz;   // closing speed
  if (vrel <= 0) return;
  const j = 1.4 * vrel / (1 / ma + 1 / mb);
  a.vx -= j / ma * nx; a.vz -= j / ma * nz;
  b.vx += j / mb * nx; b.vz += j / mb * nz;
  if (vrel > 7) {
    sound.bonk(vrel / 8);
    // which side each car got hit on decides which way it rolls
    const sideA = Math.sign(nx * -Math.cos(a.h) + nz * Math.sin(a.h)) || 1;
    const sideB = Math.sign(nx * Math.cos(b.h) - nz * Math.sin(b.h)) || 1;
    crash(a, vrel * mb / (ma + mb) * 2, sideA);
    crash(b, vrel * ma / (ma + mb) * 2, sideB);
  } else if (vrel > 2) {
    sound.bonk(0.4);
  }
}

function syncCar(c, dt) {
  const car = c.car;
  car.root.position.set(c.x, c.y, c.z);
  // a peel spins the car around twice, easing out
  const k = 1 - c.spin / SPIN;
  car.root.rotation.y = c.h + (c.spin > 0 ? (1 - (1 - k) ** 3) * Math.PI * 4 : 0);
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
    race.count -= dt;
    const n = Math.ceil(race.count) - 1;
    $('count').textContent = n > 0 ? n : '¡YA!';
    if (race.count <= 1) race.state = 'go';
  } else if (race.state === 'go' || race.state === 'end') {
    race.clock += dt;
    if (race.count > 0) {
      race.count -= dt;
      if (race.count <= 0) $('count').textContent = '';
    }
    for (const c of race.cars) {
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
        if (c.isPlayer) finish();
      }
    }
    collideCars();
  }
  race.items.update(dt, race.cars, race.state === 'go' || race.state === 'end');
  for (const c of race.cars) syncCar(c, dt);
  race.puffs.update(dt);
  race.debris.update(dt);
  for (const o of T.animated) o.userData.tick(race.clock, dt);   // scenery: flags, windmills, birds…
  sound.setEngine(race.player.vf);

  // HUD
  const p = race.player;
  const order = standings();
  const place = order.indexOf(p);
  $('lap').textContent = `${Math.min(LAPS, Math.max(1, p.lap))}/${LAPS}`;
  $('pos').textContent = `${place + 1}/${order.length}`;
  $('leader').textContent = order[0] === p ? '¡Tú!' : order[0].name;
  $('time').textContent = (p.done ? p.time : race.clock).toFixed(1);
  showItem(p);

  // speedometer + boost bar
  $('speed').textContent = Math.round(Math.abs(p.vf) * 4);
  const boost = $('boost');
  const ratio = Math.min(1, Math.abs(p.vf) / (p.def.tune.top * 1.5));
  const lit = Math.round(ratio * 8);
  boost.classList.toggle('turbo', p.boost > 0);
  const segs = boost.children;
  for (let i = 0; i < segs.length; i++) segs[i].classList.toggle('on', i < lit);

  // standings board + minimap, throttled
  race.boardT -= dt;
  if (race.boardT <= 0) {
    race.boardT = 0.2;
    renderBoard(order, p);
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
  return [...race.cars].sort((a, b) => {
    if (a.done && b.done) return a.time - b.time;
    if (a.done !== b.done) return a.done ? -1 : 1;
    return (b.lap * T.TOTAL + b.prog) - (a.lap * T.TOTAL + a.prog);
  });
}

function finish() {
  race.state = 'end';
  const p = race.player;
  const place = 1 + race.cars.filter((c) => c !== p && c.done && c.time < p.time).length;
  const winner = race.cars.find((c) => c.done && c.time < p.time);
  $('result-title').textContent = place === 1 ? `¡Ganaste, ${p.name}!` : `${place}º lugar`;
  $('result-time').textContent = `${p.def.name} · ${p.time.toFixed(1)} s · ${p.lost} piezas perdidas`
    + (winner && place > 1 ? ` · ganó ${winner.name}` : '');
  $('result').classList.remove('hidden');
  $('result-coins').textContent = `${p.coinsCollected} monedas recogidas · +${Number((p.coins * COIN_SPEED * 100).toFixed(1)).toLocaleString('es-VE')}% de velocidad`;
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
    acc += dt * SPEED;
    while (acc >= STEP && mode === 'race') {
      updateRace(STEP);
      acc -= STEP;
    }
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
  garage.camera.setViewOffset(innerWidth, innerHeight, wide ? -150 : 0,
    wide ? 35 : innerHeight * 0.17, innerWidth, innerHeight);
}
addEventListener('resize', resize);
resize();

if (DEBUG) Object.assign(window, { race, garage, renderer, crash, stepCar, startRace, updateRace, toGarage, ITEMS, TRACKS, buildTrack, getActiveTrack: () => T });

// ?track=desierto wins; otherwise the last pick, otherwise the estadio
let savedTrack = 'estadio';
try { savedTrack = localStorage.getItem('derrape:track') || savedTrack; } catch { /* private mode */ }
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
