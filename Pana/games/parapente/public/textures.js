// Textures painted with Canvas 2D for Parapente's meshes and sprites: name
// tags, the diana, a soft puff and the beacon column's fade.
import * as THREE from 'three';

function paint(w, h, draw) {
  const c = document.createElement('canvas'); c.width = w; c.height = h; draw(c.getContext('2d'), w, h);
  return new THREE.CanvasTexture(c);
}
const once = make => { let t = null; return () => t ??= make(); };

// A square tag that always faces the camera; `scale` is its height in metres.
export function label(text, { color = '#fff', bg = 'rgba(20,24,40,.72)', scale = 6 } = {}) {
  const map = paint(512, 128, (g, w, h) => {
    g.fillStyle = bg; g.fillRect(8, 16, w - 16, h - 32);
    g.font = '700 54px Nunito, system-ui, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillStyle = color; g.fillText(text, w / 2, h / 2 + 2);
  });
  map.colorSpace = THREE.SRGBColorSpace;
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map, transparent: true, depthWrite: false, fog: false }));
  sprite.scale.set(scale * 4, scale, 1); return sprite;
}

// Red and white rings with a gold centre.
export function dianaTexture() {
  const map = paint(512, 512, g => {
    [['#e8443a', 1], ['#faf6ec', .8], ['#e8443a', .6], ['#faf6ec', .4], ['#ffc629', .2]].forEach(([fill, r]) => { g.fillStyle = fill; g.beginPath(); g.arc(256, 256, 250 * r, 0, Math.PI * 2); g.fill(); });
  });
  map.colorSpace = THREE.SRGBColorSpace; return map;
}

// A round soft puff for dust and cloud sprites (shared).
export const softTexture = once(() => paint(64, 64, g => {
  const r = g.createRadialGradient(32, 32, 0, 32, 32, 32); r.addColorStop(0, 'rgba(255,255,255,1)'); r.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = r; g.fillRect(0, 0, 64, 64);
}));

// Opaque at the bottom, gone at the top: a beacon's column as an alpha map (shared).
export const fadeTexture = once(() => paint(4, 128, g => {
  const r = g.createLinearGradient(0, 128, 0, 0); r.addColorStop(0, '#fff'); r.addColorStop(.5, '#555'); r.addColorStop(1, '#000'); g.fillStyle = r; g.fillRect(0, 0, 4, 128);
}));
