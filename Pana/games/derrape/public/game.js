import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { CARS } from './cars.js';
import { sound, Puffs, Debris, makeBubble } from '/engine/fx.js';
import { createItems, ITEMS, SPIN } from './items.js';
import { TRACKS, getTrack, makeTrack } from './tracks.js';
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
renderer.toneMapping = THREE.NoToneMapping;   // keep the toy colors saturated
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
};
{
  const s = garage.scene;
  s.background = new THREE.Color(0x1b1430);
  s.fog = new THREE.Fog(0x1b1430, 20, 45);
  s.add(new THREE.HemisphereLight(0xfff4e6, 0x6a4a8a, 1.9));
  const fill = new THREE.DirectionalLight(0xfff1e0, 1.1);   // soft front fill so faces stay bright
  fill.position.set(4, 3, 10);
  s.add(fill);
  const key = new THREE.SpotLight(0xfff0d8, 320, 45, Math.PI / 5, 0.5, 1.6);
  key.position.set(6, 13, 8);
  key.castShadow = true;
  key.shadow.mapSize.set(2048, 2048);
  key.shadow.bias = -0.0004;
  s.add(key);
  const rim = new THREE.DirectionalLight(0x9fb7ff, 1.6);
  rim.position.set(-8, 5, -10);
  s.add(rim);

  const floor = new THREE.Mesh(new THREE.CircleGeometry(40, 48),
    new THREE.MeshStandardMaterial({ color: 0x2a2045, roughness: 0.95, flatShading: true }));
  floor.rotation.x = -Math.PI / 2;
  floor.receiveShadow = true;
  s.add(floor);
  const table = new THREE.Mesh(new THREE.CylinderGeometry(4.6, 4.9, 0.4, 16),
    new THREE.MeshStandardMaterial({ color: 0x3b2f63, roughness: 0.6, flatShading: true }));
  table.position.y = 0.2;
  table.receiveShadow = true;
  s.add(table);
  garage.ring = new THREE.Mesh(new THREE.TorusGeometry(4.75, 0.09, 6, 32), new THREE.MeshBasicMaterial({ color: 0xe63946 }));
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

function showCar(i) {
  garage.index = (i + CARS.length) % CARS.length;
  const def = CARS[garage.index];
  garage.turn.clear();
  garage.car = def.build(ME.avatar);
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
  camera: new THREE.PerspectiveCamera(60, innerWidth / innerHeight, 0.1, 600),
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
  const domeGeo = new THREE.SphereGeometry(420, 24, 12);
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
    const c = horizon.clone().lerp(top, Math.pow(Math.max(0, dp.getY(i) / 420), 0.6));
    col.push(c.r, c.g, c.b);
  }
  race.dome.geometry.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
}

// Swap the active track: rebuild all track-owned visuals and the items.
let trackIndex = 0;
function buildTrack(id) {
  const def = getTrack(id);
  trackIndex = TRACKS.indexOf(def);
  try { localStorage.setItem('derrape:track', def.id); } catch { /* private mode */ }
  if (race.trackGroup) {
    race.scene.remove(race.trackGroup);
    race.trackGroup.traverse((o) => o.geometry?.dispose());
  }
  T = makeTrack(def);
  race.trackGroup = T.build();
  race.scene.add(race.trackGroup);
  applyPalette(def.palette);
  race.items = createItems({
    scene: race.trackGroup, puffs: race.puffs, sound, G, track: T,
    crash: (c, power, side) => crash(c, power, side),
    say: (c, lines, time) => say(c, lines, time),
    standings: () => standings(),
  });
  $('track-name').textContent = def.name;
  $('track-blurb').textContent = def.blurb;
  $('mm-track').textContent = def.name;
  $('mm-sub').textContent = `Circuito ${trackIndex + 1}`;
  buildMinimap();
}

function switchTrack(i) {
  sound.unlock();
  buildTrack(TRACKS[(i + TRACKS.length) % TRACKS.length].id);
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
  const scale = Math.min((mm.width - margin * 2) / (T.bounds.x * 2), (mm.height - margin * 2) / (T.bounds.z * 2));
  mmPts = raw.map((p) => [mm.width / 2 + p.x * scale, mm.height / 2 + p.y * scale]);
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
    item: null, rolling: 0, useT: 0, boost: 0, spin: 0,
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
  c.prog = progressOf(c);
}

function progressOf(c) {
  return (paramOf(c.x, c.z) - T.LINE + T.TOTAL) % T.TOTAL;
}

function clearRace() {
  for (const c of race.cars) {
    race.scene.remove(c.car.root);
    race.scene.remove(c.bubble.sprite);
  }
  race.cars = [];
  race.puffs.clear();
  race.debris.clear();
  race.items.clear();
}

function startRace(playerIndex) {
  clearRace();
  const others = CARS.map((_, i) => i).filter((i) => i !== playerIndex).sort(() => Math.random() - 0.5);
  const names = [...RIVALS].sort(() => Math.random() - 0.5);
  race.cars = [makeRacer(playerIndex, true)];
  for (let i = 1; i < RACERS; i++) race.cars.push(makeRacer(others[i - 1], false, names[i - 1]));
  // a two-by-two grid; you start at the back so there's someone to pass
  race.cars.forEach((c, i) => placeRacer(c, i % 2 ? -3.5 : 3.5, Math.floor((RACERS - 1 - i) / 2)));
  race.player = race.cars[0];
  race.playerIndex = playerIndex;
  race.clock = 0;
  race.count = 3.999;
  race.boardT = 0;
  race.state = 'count';
  race.camPos = null;
  $('garage').classList.add('hidden');
  $('race').classList.remove('hidden');
  $('result').classList.add('hidden');
  garage.controls.enabled = false;
  sound.startEngine();
  mode = 'race';
}

function toGarage() {
  race.state = 'off';
  clearRace();
  sound.stopEngine();
  $('race').classList.add('hidden');
  $('garage').classList.remove('hidden');
  garage.controls.enabled = true;
  mode = 'garage';
}

$('again').onclick = () => startRace(race.playerIndex);
$('back').onclick = toGarage;
addEventListener('keydown', (e) => {
  const k = e.key.toLowerCase();
  race.keys[k] = true;
  if (k === 'escape' && mode === 'race') toGarage();
  if (k === 'h' && !e.repeat) {
    if (mode === 'race' && race.player) honk(race.player);
    else if (mode === 'garage') garageHonk();
  }
  if (k === 'm') sound.muted = !sound.muted;
  if ((k === ' ' || k === 'e') && mode === 'race' && race.state === 'go' && race.player) {
    e.preventDefault();
    if (!e.repeat) race.items.use(race.player);
  }
  if (e.key.startsWith('Arrow') && mode === 'race') e.preventDefault();
});
addEventListener('keyup', (e) => (race.keys[e.key.toLowerCase()] = false));

function playerInput() {
  const k = race.keys;
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
  const top = t.top * c.skill;
  if (c.spin > 0) input = { throttle: 0, steer: 0 };   // skidding on a peel: no control
  let fx = Math.sin(c.h), fz = Math.cos(c.h);
  let rx = -Math.cos(c.h), rz = Math.sin(c.h);
  let vf = c.vx * fx + c.vz * fz;
  let vr = c.vx * rx + c.vz * rz;
  const prevVf = vf;

  if (c.onGround) {
    if (boosting) vf += t.accel * 2.5 * dt;
    else if (input.throttle > 0) vf += t.accel * input.throttle * dt;
    else if (input.throttle < 0) vf -= (vf > 0 ? t.accel * 2.2 : t.accel * 0.6) * dt;
    else vf -= Math.sign(vf) * Math.min(Math.abs(vf), 6 * dt);
    // a turbo lifts the cap; when it ends the extra speed bleeds off instead of snapping
    const cap = boosting ? top * 1.5 : Math.max(top, prevVf - 20 * dt);
    vf = Math.max(-top * 0.4, Math.min(cap, vf));
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

  // ---- vertical: ramps, jumps, tumbles ----
  const g = groundAt(c.x, c.z);
  if (c.onGround) {
    if (g >= c.y - 0.08) {
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
        race.puffs.spawn(new THREE.Vector3(c.x, 0.3, c.z), { color: 0xe0b07a, count: 7, spread: 2.5, rise: 0.8 });
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
  if (Math.abs(off) > limit) {
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
      race.puffs.spawn(new THREE.Vector3(c.x - fx * 1.6, 0.25, c.z - fz * 1.6), { color: 0xe7bd8a, count: 1, size: 0.7, rise: 0.6, life: 0.7 });
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
  race.sun.position.set(p.x - 30, 40, p.z + 25);
  race.sun.target.position.set(p.x, 0, p.z);
}

// Item slot: spins through icons while rolling, then shows what you got.
const ICONS = Object.values(ITEMS).map((i) => i.icon);
let lastItem = '';
function showItem(p) {
  let icon = '', label = 'Agarra una caja', n = 0;
  if (p.rolling > 0) {
    icon = ICONS[Math.floor(p.rolling * 14) % ICONS.length];
    label = '¿Qué será?';
  } else if (p.item) {
    icon = ITEMS[p.item.kind].icon;
    label = ITEMS[p.item.kind].name;
    n = p.item.n;
  }
  const key = icon + label + n;
  if (key === lastItem) return;
  lastItem = key;
  $('item-icon').innerHTML = icon;
  $('item-n').textContent = n > 1 ? `×${n}` : '';
  $('item-name').textContent = label;
  $('item').classList.toggle('ready', !!p.item && !(p.rolling > 0));
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
}

// ======================================================================
let mode = 'garage';
const clock = new THREE.Clock();
const STEP = 1 / 60;
let acc = 0;

function frame() {
  const dt = Math.min(clock.getDelta(), 0.25);
  if (mode === 'garage') {
    updateGarage(dt);
    renderer.render(garage.scene, garage.camera);
  } else {
    // fixed physics steps: same race speed at any frame rate
    acc += dt * SPEED;
    while (acc >= STEP && mode === 'race') {
      updateRace(STEP);
      acc -= STEP;
    }
    renderer.render(race.scene, race.camera);
  }
  requestAnimationFrame(frame);
}

addEventListener('resize', () => {
  for (const cam of [garage.camera, race.camera]) {
    cam.aspect = innerWidth / innerHeight;
    cam.updateProjectionMatrix();
  }
  renderer.setSize(innerWidth, innerHeight);
});

if (DEBUG) Object.assign(window, { race, garage, crash, startRace, ITEMS, TRACKS, buildTrack });

// ?track=desierto wins; otherwise the last pick, otherwise the estadio
let savedTrack = 'estadio';
try { savedTrack = localStorage.getItem('derrape:track') || savedTrack; } catch { /* private mode */ }
buildTrack(QS.get('track') || savedTrack);

// bubbles use the cartoon font, so wait for it (but never block on it)
Promise.race([document.fonts.ready, new Promise((r) => setTimeout(r, 1500))]).then(() => {
  showCar(0);
  frame();
});
