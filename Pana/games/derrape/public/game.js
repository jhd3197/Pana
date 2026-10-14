import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { CARS } from './cars.js';
import { sound, Puffs, Debris, makeBubble } from './fx.js';
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
// Track: a stadium oval with two jump ramps
// ======================================================================
const S = 45;        // half length of the straights
const R = 30;        // centerline radius of the bends
const HW = 9;        // half track width
const A = 2 * S;
const B = Math.PI * R;
const TOTAL = 2 * A + 2 * B;
const LINE = 30;     // start/finish line position along the track

function pointAt(s) {
  s = ((s % TOTAL) + TOTAL) % TOTAL;
  if (s < A) return new THREE.Vector2(-S + s, R);
  s -= A;
  if (s < B) { const t = Math.PI / 2 - s / R; return new THREE.Vector2(S + R * Math.cos(t), R * Math.sin(t)); }
  s -= B;
  if (s < A) return new THREE.Vector2(S - s, -R);
  s -= A;
  const t = -Math.PI / 2 - s / R;
  return new THREE.Vector2(-S + R * Math.cos(t), R * Math.sin(t));
}

function paramOf(x, z) {
  if (Math.abs(x) <= S) return z > 0 ? x + S : A + B + (S - x);
  if (x > S) return A + (Math.PI / 2 - Math.atan2(z, x - S)) * R;
  let t = Math.atan2(z, x + S);
  if (t > 0) t -= Math.PI * 2;
  return 2 * A + B + (-Math.PI / 2 - t) * R;
}

// signed distance from the centerline (positive = outside)
function offsetOf(x, z) {
  const cx = Math.max(-S, Math.min(S, x));
  return Math.hypot(x - cx, z) - R;
}

const RAMPS = [
  { s0: 56, len: 9, h: 1.7, hw: 4.2 },
  { s0: A + B + 40, len: 9, h: 2.2, hw: 4.2 },
];

function groundAt(x, z) {
  const off = offsetOf(x, z);
  if (Math.abs(off) > 5) return 0;
  const s = paramOf(x, z);
  for (const r of RAMPS) {
    if (s >= r.s0 && s <= r.s0 + r.len && Math.abs(off) < r.hw) return r.h * (s - r.s0) / r.len;
  }
  return 0;
}

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
  const horizon = new THREE.Color(0xffd6a0);
  s.background = horizon;
  s.fog = new THREE.Fog(horizon, 80, 260);
  // sky dome: warm at the horizon, blue overhead
  const domeGeo = new THREE.SphereGeometry(420, 24, 12);
  const top = new THREE.Color(0x6fb7e8);
  const dc = [];
  const dp = domeGeo.attributes.position;
  for (let i = 0; i < dp.count; i++) {
    const c = horizon.clone().lerp(top, Math.pow(Math.max(0, dp.getY(i) / 420), 0.6));
    dc.push(c.r, c.g, c.b);
  }
  domeGeo.setAttribute('color', new THREE.Float32BufferAttribute(dc, 3));
  s.add(new THREE.Mesh(domeGeo, new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.BackSide, fog: false })));
  s.add(new THREE.HemisphereLight(0xfff1d6, 0xc08a5a, 1.6));
  const sun = new THREE.DirectionalLight(0xffd9a0, 2.4);
  sun.position.set(-30, 40, 25);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  Object.assign(sun.shadow.camera, { left: -40, right: 40, top: 40, bottom: -40, near: 1, far: 160 });
  sun.shadow.bias = -0.0006;
  s.add(sun, sun.target);
  race.sun = sun;

  // low-poly sand with gentle dunes away from the track
  const hash = (x, z) => {
    const v = Math.sin(x * 12.9898 + z * 78.233) * 43758.5453;
    return v - Math.floor(v);
  };
  let ground = new THREE.PlaneGeometry(520, 520, 90, 90);
  ground.rotateX(-Math.PI / 2);
  const gp = ground.attributes.position;
  for (let i = 0; i < gp.count; i++) {
    const x = gp.getX(i), z = gp.getZ(i);
    const far = Math.max(0, Math.abs(offsetOf(x, z)) - HW - 4);
    gp.setY(i, Math.min(1, far / 12) * (Math.sin(x * 0.07) * Math.cos(z * 0.05) * 2.2 + hash(x, z) * 1.2) - 0.05);
  }
  ground = ground.toNonIndexed();
  const colors = [];
  const base = new THREE.Color(0xe8b57a);
  for (let i = 0; i < ground.attributes.position.count; i += 3) {
    const c = base.clone().offsetHSL(0, 0, (hash(i, 1) - 0.5) * 0.06);
    for (let k = 0; k < 3; k++) colors.push(c.r, c.g, c.b);
  }
  ground.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  ground.computeVertexNormals();
  const groundMesh = new THREE.Mesh(ground, new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: 1 }));
  groundMesh.receiveShadow = true;
  s.add(groundMesh);

  // packed dirt track
  const shape = new THREE.Shape();
  shape.absarc(S, 0, R + HW, -Math.PI / 2, Math.PI / 2, false);
  shape.absarc(-S, 0, R + HW, Math.PI / 2, Math.PI * 1.5, false);
  const hole = new THREE.Path();
  hole.absarc(S, 0, R - HW, -Math.PI / 2, Math.PI / 2, false);
  hole.absarc(-S, 0, R - HW, Math.PI / 2, Math.PI * 1.5, false);
  shape.holes.push(hole);
  const track = new THREE.Mesh(new THREE.ShapeGeometry(shape, 24),
    new THREE.MeshStandardMaterial({ color: 0x9c5b33, roughness: 1, flatShading: true }));
  track.rotation.x = -Math.PI / 2;   // face up (the oval is symmetric, so the flip is harmless)
  track.position.y = 0.03;
  track.receiveShadow = true;
  s.add(track);

  // checkered start line
  const lc = document.createElement('canvas');
  lc.width = 16; lc.height = 144;
  const g = lc.getContext('2d');
  for (let y = 0; y < 18; y++) for (let x = 0; x < 2; x++) {
    g.fillStyle = (x + y) % 2 ? '#16161a' : '#f6f1e4';
    g.fillRect(x * 8, y * 8, 8, 8);
  }
  const lineTex = new THREE.CanvasTexture(lc);
  lineTex.magFilter = THREE.NearestFilter;
  lineTex.colorSpace = THREE.SRGBColorSpace;
  const line = new THREE.Mesh(new THREE.PlaneGeometry(2, HW * 2), new THREE.MeshStandardMaterial({ map: lineTex }));
  const lp = pointAt(LINE);
  line.rotation.x = -Math.PI / 2;
  line.position.set(lp.x, 0.05, lp.y);
  line.receiveShadow = true;
  s.add(line);

  // stacked tire walls, alternating red and white
  const spots = [];
  for (const off of [HW + 0.8, -HW - 0.8]) {
    let acc = 0;
    let n = 0;
    for (let s0 = 0; s0 < TOTAL; s0 += 0.1) {
      const p = pointAt(s0);
      acc += Math.abs(p.x) > S + 0.01 ? 0.1 * (R + off) / R : 0.1;
      if (acc < 1.32) continue;
      acc = 0;
      const p2 = pointAt(s0 + 0.2);
      const tx = p2.x - p.x, tz = p2.y - p.y;
      const l = Math.hypot(tx, tz);
      spots.push([p.x - tz / l * off, p.y + tx / l * off, n++]);
    }
  }
  const tireGeo = new THREE.CylinderGeometry(0.66, 0.66, 0.52, 9);
  const holeGeo = new THREE.CylinderGeometry(0.3, 0.3, 0.54, 9);
  const red = new THREE.InstancedMesh(tireGeo, new THREE.MeshStandardMaterial({ color: 0xe63946, flatShading: true, roughness: 0.8 }), spots.length);
  const white = new THREE.InstancedMesh(tireGeo, new THREE.MeshStandardMaterial({ color: 0xf6f1e4, flatShading: true, roughness: 0.8 }), spots.length);
  const holes = new THREE.InstancedMesh(holeGeo, new THREE.MeshStandardMaterial({ color: 0x1c1c22, flatShading: true }), spots.length * 2);
  spots.forEach(([x, z, n], i) => {
    const low = new THREE.Matrix4().makeTranslation(x, 0.26, z);
    const top = new THREE.Matrix4().makeTranslation(x, 0.78, z);
    const lowRed = n % 2 === 0;
    red.setMatrixAt(i, lowRed ? low : top);
    white.setMatrixAt(i, lowRed ? top : low);
    holes.setMatrixAt(i * 2, low);
    holes.setMatrixAt(i * 2 + 1, top);
  });
  for (const im of [red, white, holes]) {
    im.castShadow = true;
    im.receiveShadow = true;
    s.add(im);
  }

  // jump ramps: yellow slope, black sides
  for (const r of RAMPS) {
    const tri = new THREE.Shape([new THREE.Vector2(0, 0), new THREE.Vector2(r.len, 0), new THREE.Vector2(r.len, r.h)]);
    const ramp = new THREE.Mesh(new THREE.ExtrudeGeometry(tri, { depth: r.hw * 2, bevelEnabled: false }), [
      new THREE.MeshStandardMaterial({ color: 0x16161a, flatShading: true }),
      new THREE.MeshStandardMaterial({ color: 0xffd23f, flatShading: true }),
    ]);
    const p = pointAt(r.s0), p2 = pointAt(r.s0 + 1);
    const dir = Math.atan2(-(p2.y - p.y), p2.x - p.x);
    ramp.rotation.y = dir;
    // the extrusion runs along local +Z: center it across the track
    ramp.position.set(p.x - Math.sin(dir) * r.hw, 0.02, p.y - Math.cos(dir) * r.hw);
    ramp.castShadow = true;
    ramp.receiveShadow = true;
    s.add(ramp);
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
  };
}

function placeRacer(c, lane, row) {
  const p = pointAt(LINE - 9 - row * 8);
  Object.assign(c, { lane, x: p.x, z: p.y + lane, y: 0, h: Math.PI / 2, vx: 0, vz: 0, vy: 0, vf: 0, lap: 0, done: false, time: 0 });
  c.prog = progressOf(c);
}

function progressOf(c) {
  return (paramOf(c.x, c.z) - LINE + TOTAL) % TOTAL;
}

function clearRace() {
  for (const c of race.cars) {
    race.scene.remove(c.car.root);
    race.scene.remove(c.bubble.sprite);
  }
  race.cars = [];
  race.puffs.clear();
  race.debris.clear();
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
  const gap = (c.lap * TOTAL + c.prog) - (race.player.lap * TOTAL + race.player.prog);
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
  const top = t.top * c.skill;
  let fx = Math.sin(c.h), fz = Math.cos(c.h);
  let rx = -Math.cos(c.h), rz = Math.sin(c.h);
  let vf = c.vx * fx + c.vz * fz;
  let vr = c.vx * rx + c.vz * rz;
  const prevVf = vf;

  if (c.onGround) {
    if (input.throttle > 0) vf += t.accel * input.throttle * dt;
    else if (input.throttle < 0) vf -= (vf > 0 ? t.accel * 2.2 : t.accel * 0.6) * dt;
    else vf -= Math.sign(vf) * Math.min(Math.abs(vf), 6 * dt);
    vf = Math.max(-top * 0.4, Math.min(top, vf));
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
  const cx = Math.max(-S, Math.min(S, c.x));
  const d = Math.hypot(c.x - cx, c.z) || 1;
  const nx = (c.x - cx) / d, nz = c.z / d;   // points to the outside
  const off = d - R;
  const limit = HW - 1.6;
  if (Math.abs(off) > limit) {
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
  if (c.prog > TOTAL * 0.75 && prog < TOTAL * 0.25) c.lap++;
  else if (c.prog < TOTAL * 0.25 && prog > TOTAL * 0.75) c.lap--;
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
  car.root.rotation.y = c.h;
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
  for (const c of race.cars) syncCar(c, dt);
  race.puffs.update(dt);
  race.debris.update(dt);
  sound.setEngine(race.player.vf);

  // HUD
  const p = race.player;
  const order = standings();
  const place = order.indexOf(p);
  $('lap').textContent = `${Math.min(LAPS, Math.max(1, p.lap))}/${LAPS}`;
  $('pos').textContent = `${place + 1}º/${order.length}`;
  $('rival').textContent = place > 0 ? order[place - 1].name : '¡Nadie!';
  $('time').textContent = (p.done ? p.time : race.clock).toFixed(1);

  // chase camera with a bit of shake
  const fx = Math.sin(p.h), fz = Math.cos(p.h);
  const want = new THREE.Vector3(p.x - fx * 11, Math.max(5, p.y + 5), p.z - fz * 11);
  if (!race.camPos) race.camPos = want.clone();
  race.camPos.lerp(want, Math.min(1, dt * 4));
  race.shake = Math.max(0, race.shake - dt * 2);
  const sh = race.shake * 0.6;
  race.camera.position.set(race.camPos.x + rand(-sh, sh), race.camPos.y + rand(-sh, sh), race.camPos.z + rand(-sh, sh));
  race.camera.lookAt(p.x + fx * 4, p.y + 1.4, p.z + fz * 4);
  race.sun.position.set(p.x - 30, 40, p.z + 25);
  race.sun.target.position.set(p.x, 0, p.z);
}

// Finished cars by time, then everyone else by how far along they are.
function standings() {
  return [...race.cars].sort((a, b) => {
    if (a.done && b.done) return a.time - b.time;
    if (a.done !== b.done) return a.done ? -1 : 1;
    return (b.lap * TOTAL + b.prog) - (a.lap * TOTAL + a.prog);
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

if (DEBUG) Object.assign(window, { race, garage, crash, startRace });

// bubbles use the cartoon font, so wait for it (but never block on it)
Promise.race([document.fonts.ready, new Promise((r) => setTimeout(r, 1500))]).then(() => {
  showCar(0);
  frame();
});
