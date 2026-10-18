import * as THREE from 'three';
import { buildCharacter } from '/engine/models/characters/pana/avatar-model.js';
const $ = id => document.getElementById(id);

// ---------- portraits for the player cards ----------
export function makePortraits(players) {
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

// Aim minigames draw a reticle per pana over the canvas: { x, y } in NDC, its
// color, how far the china is pulled (0..1), and for you the stones left.
export function drawReticles(list) {
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
