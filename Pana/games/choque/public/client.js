import * as THREE from 'three';

const params = new URLSearchParams(location.search);
const ROOM = params.get('room') || 'lobby';
const NAME = params.get('name') || 'pana' + Math.floor(Math.random() * 100);
document.getElementById('room').textContent = ROOM;

// ---------- scene ----------
const ARENA = 60;
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x1a1a2e);
scene.fog = new THREE.Fog(0x1a1a2e, 60, 140);

const camera = new THREE.PerspectiveCamera(60, innerWidth / innerHeight, 0.1, 300);
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(innerWidth, innerHeight);
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
document.body.appendChild(renderer.domElement);

scene.add(new THREE.HemisphereLight(0xffffff, 0x223344, 1.1));
const sun = new THREE.DirectionalLight(0xffffff, 1.4);
sun.position.set(30, 60, 20);
scene.add(sun);

const ground = new THREE.Mesh(
  new THREE.PlaneGeometry(ARENA * 2, ARENA * 2),
  new THREE.MeshStandardMaterial({ color: 0x2b2d42 })
);
ground.rotation.x = -Math.PI / 2;
scene.add(ground);

const grid = new THREE.GridHelper(ARENA * 2, ARENA / 2, 0x44475a, 0x353748);
grid.position.y = 0.01;
scene.add(grid);

const wallMat = new THREE.MeshStandardMaterial({ color: 0xef233c });
for (const [x, z, w, d] of [
  [0, -ARENA, ARENA * 2, 1], [0, ARENA, ARENA * 2, 1],
  [-ARENA, 0, 1, ARENA * 2], [ARENA, 0, 1, ARENA * 2],
]) {
  const wall = new THREE.Mesh(new THREE.BoxGeometry(w, 2, d), wallMat);
  wall.position.set(x, 1, z);
  scene.add(wall);
}

function makeCar(color) {
  const car = new THREE.Group();
  const body = new THREE.Mesh(
    new THREE.BoxGeometry(2, 0.8, 4),
    new THREE.MeshStandardMaterial({ color })
  );
  body.position.y = 0.7;
  car.add(body);
  const cabin = new THREE.Mesh(
    new THREE.BoxGeometry(1.6, 0.7, 1.8),
    new THREE.MeshStandardMaterial({ color: 0x222831 })
  );
  cabin.position.set(0, 1.35, -0.3);
  car.add(cabin);
  const wheelGeo = new THREE.CylinderGeometry(0.45, 0.45, 0.4, 16);
  wheelGeo.rotateZ(Math.PI / 2);
  const wheelMat = new THREE.MeshStandardMaterial({ color: 0x111111 });
  for (const [x, z] of [[-1.05, 1.3], [1.05, 1.3], [-1.05, -1.3], [1.05, -1.3]]) {
    const wheel = new THREE.Mesh(wheelGeo, wheelMat);
    wheel.position.set(x, 0.45, z);
    car.add(wheel);
  }
  scene.add(car);
  return car;
}

// ---------- networking ----------
const proto = location.protocol === 'https:' ? 'wss' : 'ws';
const ws = new WebSocket(`${proto}://${location.host}/ws`);
const remotes = new Map(); // id -> { mesh, name, target: {x,z,h} }
let myId = null;
let myColor = '#e63946';
let me = null;

const playersEl = document.getElementById('players');
function renderPlayers() {
  const rows = [`<span class="dot" style="background:${myColor}"></span>${NAME} (tú)`];
  for (const r of remotes.values()) {
    rows.push(`<span class="dot" style="background:#${r.color.getHexString()}"></span>${r.name}`);
  }
  playersEl.innerHTML = rows.join('<br>');
}

function addRemote(p) {
  const mesh = makeCar(p.color);
  remotes.set(p.id, { mesh, name: p.name, color: new THREE.Color(p.color), target: { x: 0, z: 0, h: 0 } });
  renderPlayers();
}

ws.onopen = () => ws.send(JSON.stringify({ t: 'join', game: 'choque', room: ROOM, name: NAME }));
ws.onmessage = (ev) => {
  const msg = JSON.parse(ev.data);
  if (msg.t === 'welcome') {
    myId = msg.id;
    myColor = msg.color;
    me = makeCar(msg.color);
    for (const p of msg.players) addRemote(p);
    renderPlayers();
  } else if (msg.t === 'joined') {
    addRemote(msg);
  } else if (msg.t === 'state') {
    const r = remotes.get(msg.id);
    if (r) r.target = { x: msg.x, z: msg.z, h: msg.h };
  } else if (msg.t === 'left') {
    const r = remotes.get(msg.id);
    if (r) { scene.remove(r.mesh); remotes.delete(msg.id); renderPlayers(); }
  } else if (msg.t === 'full') {
    playersEl.innerHTML = 'Sala llena (máx 8 panas)';
  }
};

// ---------- driving ----------
const keys = {};
addEventListener('keydown', (e) => (keys[e.key.toLowerCase()] = true));
addEventListener('keyup', (e) => (keys[e.key.toLowerCase()] = false));

const car = { x: 0, z: 0, h: 0, v: 0 };
const MAX_SPEED = 28, ACCEL = 22, TURN = 2.2;
let shake = 0;

function step(dt) {
  const fwd = keys['w'] || keys['arrowup'];
  const back = keys['s'] || keys['arrowdown'];
  const left = keys['a'] || keys['arrowleft'];
  const right = keys['d'] || keys['arrowright'];

  if (fwd) car.v += ACCEL * dt;
  else if (back) car.v -= ACCEL * 0.6 * dt;
  else car.v *= 1 - Math.min(1, 1.5 * dt);
  car.v = Math.max(-MAX_SPEED * 0.4, Math.min(MAX_SPEED, car.v));

  const steer = (left ? 1 : 0) - (right ? 1 : 0);
  car.h += steer * TURN * dt * Math.min(1, Math.abs(car.v) / 8) * Math.sign(car.v || 1);

  car.x += Math.sin(car.h) * car.v * dt;
  car.z += Math.cos(car.h) * car.v * dt;

  // walls
  const lim = ARENA - 2.2;
  if (Math.abs(car.x) > lim) { car.x = Math.sign(car.x) * lim; car.v *= -0.4; shake = 0.4; }
  if (Math.abs(car.z) > lim) { car.z = Math.sign(car.z) * lim; car.v *= -0.4; shake = 0.4; }

  // crash into panas
  for (const r of remotes.values()) {
    const dx = car.x - r.target.x, dz = car.z - r.target.z;
    const d = Math.hypot(dx, dz);
    if (d < 3 && d > 0.001) {
      const push = (3 - d);
      car.x += (dx / d) * push;
      car.z += (dz / d) * push;
      car.v *= -0.5;
      shake = 0.6;
    }
  }
}

// ---------- loop ----------
let last = performance.now(), sendAcc = 0;
function tick(now) {
  requestAnimationFrame(tick);
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  step(dt);

  if (me) {
    me.position.set(car.x, 0, car.z);
    me.rotation.y = car.h;
  }
  for (const r of remotes.values()) {
    r.mesh.position.lerp(new THREE.Vector3(r.target.x, 0, r.target.z), 0.2);
    r.mesh.rotation.y += (r.target.h - r.mesh.rotation.y) * 0.2;
  }

  sendAcc += dt;
  if (ws.readyState === 1 && sendAcc > 0.05) {
    sendAcc = 0;
    ws.send(JSON.stringify({ t: 'state', x: +car.x.toFixed(2), z: +car.z.toFixed(2), h: +car.h.toFixed(3), v: +car.v.toFixed(2) }));
  }

  shake = Math.max(0, shake - dt);
  const behind = new THREE.Vector3(car.x - Math.sin(car.h) * 10, 6, car.z - Math.cos(car.h) * 10);
  if (shake > 0) {
    behind.x += (Math.random() - 0.5) * shake;
    behind.y += (Math.random() - 0.5) * shake;
  }
  camera.position.lerp(behind, 0.15);
  camera.lookAt(car.x, 1, car.z);

  renderer.render(scene, camera);
}
requestAnimationFrame(tick);

addEventListener('resize', () => {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
});
