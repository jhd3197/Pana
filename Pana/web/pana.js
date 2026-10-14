// "Tu pana": the capybara stage and creator on the hub. Saves to
// localStorage so every game (see /engine/avatar.js) plays as this pana, and
// fires a `pana:avatar` event so game cards can redraw.

import * as THREE from 'three';
import { buildCharacter } from '/engine/character.js';
import { COLORS, FURS, OPTIONS, loadAvatar, randomAvatar, saveAvatar } from '/engine/avatar.js';

// colorless: option ids where the color swatches don't apply
const TABS = [
  { key: 'fur', label: 'Pelaje', colors: FURS },
  { key: 'hat', label: 'Gorro', options: OPTIONS.hat, colorKey: 'hatColor', colors: COLORS, colorless: ['none', 'corona'] },
  { key: 'glasses', label: 'Lentes', options: OPTIONS.glasses },
  { key: 'outfit', label: 'Ropa', options: OPTIONS.outfit, colorKey: 'outfitColor', colors: COLORS, colorless: ['nada'] },
  { key: 'face', label: 'Cara', options: OPTIONS.face },
  { key: 'extra', label: 'Extra', options: OPTIONS.extra },
];

let avatar = loadAvatar();
let tab = TABS[1];
const canvas = document.getElementById('pana-preview');
const tabsEl = document.getElementById('pana-tabs');
const controlsEl = document.getElementById('pana-controls');

// ---------- 3D stage ----------
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(30, 1, 0.1, 50);
camera.position.set(0, 1.55, 5.2);
camera.lookAt(0, 1.0, 0);
// bright, soft studio light so the fur reads warm caramel, not dark brown
scene.add(new THREE.HemisphereLight(0xffffff, 0xd9b48a, 2.2));
scene.add(new THREE.AmbientLight(0xffffff, 0.5));
const front = new THREE.DirectionalLight(0xfff4e6, 1.4);
front.position.set(0, 2, 6);
scene.add(front);
const key = new THREE.SpotLight(0xffffff, 30, 20, Math.PI / 6, 0.6, 1.2);
key.position.set(2, 6, 4);
key.castShadow = true;
key.shadow.mapSize.set(1024, 1024);
scene.add(key);
const rim = new THREE.DirectionalLight(0xffc0e8, 1.0);
rim.position.set(-3, 2, -3);
scene.add(rim);
const pedestal = new THREE.Mesh(new THREE.CylinderGeometry(1.0, 1.1, 0.22, 12),
  new THREE.MeshStandardMaterial({ color: 0x3b2c7a, flatShading: true, roughness: 0.7 }));
pedestal.position.y = -0.11;
pedestal.receiveShadow = true;
scene.add(pedestal);
const ring = new THREE.Mesh(new THREE.TorusGeometry(1.06, 0.035, 4, 24), new THREE.MeshBasicMaterial({ color: 0xffc629 }));
ring.rotation.x = Math.PI / 2;
scene.add(ring);
const turn = new THREE.Group();
scene.add(turn);

let pana = null;
function rebuild() {
  turn.clear();
  pana = buildCharacter(avatar);
  turn.add(pana.group);
}

function resize() {
  const w = canvas.clientWidth, h = canvas.clientHeight;
  const pw = Math.round(w * renderer.getPixelRatio());
  if (canvas.width !== pw || canvas.height !== Math.round(h * renderer.getPixelRatio())) {
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  }
}

// drag to spin, tap to make them yell and hop
let dragging = false, lastX = 0, spinV = 0.4, yell = 0, moved = 0;
canvas.addEventListener('pointerdown', (e) => {
  dragging = true;
  lastX = e.clientX;
  moved = 0;
  canvas.setPointerCapture(e.pointerId);
});
canvas.addEventListener('pointermove', (e) => {
  if (!dragging) return;
  const dx = e.clientX - lastX;
  lastX = e.clientX;
  moved += Math.abs(dx);
  turn.rotation.y += dx * 0.012;
  spinV = dx * 0.6;
});
canvas.addEventListener('pointerup', () => {
  dragging = false;
  if (moved < 4) yell = 0.9;
});

const clock = new THREE.Clock();
let t = 0;
let wave = 3;   // seconds until the next wave
function frame() {
  const dt = Math.min(clock.getDelta(), 0.1);
  t += dt;
  resize();
  if (!dragging) {
    spinV += (0.35 - spinV) * Math.min(1, dt * 2);
    turn.rotation.y += spinV * dt;
  }
  yell = Math.max(0, yell - dt);
  wave -= dt;
  if (wave < -1.6) wave = 5 + Math.random() * 4;
  const waving = wave < 0;
  // right arm (on the -x side) swings up and waves
  pana.armR.rotation.z += ((waving ? -2.5 + Math.sin(t * 14) * 0.35 : -0.25) - pana.armR.rotation.z) * Math.min(1, dt * 10);
  pana.armL.rotation.z += ((yell > 0 ? 2.3 : 0.25) - pana.armL.rotation.z) * Math.min(1, dt * 10);
  pana.neck.rotation.z = Math.sin(t * 1.6) * 0.06 + (waving ? 0.12 : 0);
  pana.group.position.y = yell > 0 ? Math.abs(Math.sin(t * 16)) * 0.12 : 0;
  pana.update(dt, { open: yell > 0, look: Math.sin(t * 0.8) });
  renderer.render(scene, camera);
  requestAnimationFrame(frame);
}

// ---------- creator ----------
function changed() {
  saveAvatar(avatar);
  rebuild();
  render();
  window.dispatchEvent(new CustomEvent('pana:avatar', { detail: avatar }));
}

function button(cls, label, pressed, onClick) {
  const b = document.createElement('button');
  b.type = 'button';
  b.className = cls;
  b.setAttribute('aria-pressed', String(pressed));
  b.textContent = label;
  b.onclick = onClick;
  return b;
}

function render() {
  tabsEl.innerHTML = '';
  for (const tb of TABS) {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'tab';
    b.setAttribute('role', 'tab');
    b.setAttribute('aria-selected', String(tb === tab));
    b.textContent = tb.label;
    b.onclick = () => { tab = tb; render(); };
    tabsEl.appendChild(b);
  }

  controlsEl.innerHTML = '';
  if (tab.options) {
    const chips = document.createElement('div');
    chips.className = 'chips';
    for (const o of tab.options) {
      chips.appendChild(button('chip', o.label, avatar[tab.key] === o.id, () => {
        avatar[tab.key] = o.id;
        changed();
      }));
    }
    controlsEl.appendChild(chips);
  }
  const colorKey = tab.colorKey || tab.key;
  if (tab.colors && !(tab.colorless || []).includes(avatar[tab.key])) {
    const sw = document.createElement('div');
    sw.className = 'swatches';
    for (const c of tab.colors) {
      const b = button('swatch', '', avatar[colorKey] === c, () => {
        avatar[colorKey] = c;
        changed();
      });
      b.style.background = c;
      b.setAttribute('aria-label', `${tab.label} ${c}`);
      sw.appendChild(b);
    }
    controlsEl.appendChild(sw);
  }
}

document.getElementById('pana-random').onclick = () => {
  avatar = randomAvatar();
  yell = 0.9;
  changed();
};

rebuild();
render();
frame();
