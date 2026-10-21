// Name tags over nearby racers: a plain DOM pennant per car, placed each drawn
// frame by projecting a point above its roof. No textures (the GPU budget
// and cup-lifetime stay untouched) and crisp text at any size. The tag gets
// simpler with distance from the camera's car: place and name up to FULL
// metres, only the place number up to NEAR, nothing beyond. The player's own
// car never gets one, and split screen hides them all.
import * as THREE from 'three';

const NEAR = 45, FULL = 30, FADE = 15, LIFT = 2.9;
const STYLE = `
.pk-tags { position: fixed; inset: 0; pointer-events: none; z-index: 5; overflow: hidden; }
.pk-tag { position: absolute; left: 0; top: 0; display: flex; white-space: nowrap; transform-origin: 50% 100%;
  font: 400 18px/1 var(--pk-display, sans-serif); letter-spacing: .03em; will-change: transform, opacity;
  clip-path: polygon(6% 0, 100% 0, 94% 70%, 57% 70%, 50% 100%, 43% 70%, 0 70%);
  filter: drop-shadow(0 3px 0 rgba(14, 11, 36, .85)); }
.pk-tag b { font-weight: 400; padding: 5px 9px 15px 15px; background: #16161a; color: #f3e9d7; }
.pk-tag span { padding: 5px 15px 15px 10px; background: var(--c); color: #fff; }
.pk-tag.light span { color: #16161a; }
.pk-tag.far b { padding: 5px 13px 15px; background: var(--c); color: #fff; }
.pk-tag.far.light b { color: #16161a; }
.pk-tag.far span { display: none; }
.pk-tag.ghost b { display: none; }
.pk-tag.ghost span { padding-left: 15px; background: rgba(70, 200, 255, .45); color: #dff6ff; }
`;

// Light car colours (yellow, lime) read better with dark letters.
function isLight(hex) {
  const n = parseInt(String(hex).replace('#', ''), 16);
  if (!Number.isFinite(n)) return false;
  const r = n >> 16 & 255, g = n >> 8 & 255, b = n & 255;
  return 0.299 * r + 0.587 * g + 0.114 * b > 160;
}

export function createNameTags(parent = document.body) {
  if (!document.getElementById('pk-tags-style')) {
    parent.ownerDocument.head.append(Object.assign(document.createElement('style'), { id: 'pk-tags-style', textContent: STYLE }));
  }
  const layer = Object.assign(document.createElement('div'), { className: 'pk-tags' });
  parent.append(layer);
  const tags = new Map();
  const v = new THREE.Vector3();
  const tagFor = (c) => {
    let tag = tags.get(c);
    if (!tag) {
      const color = c.def?.color || '#fff';
      tag = Object.assign(document.createElement('div'), { className: `pk-tag${c.ghost ? ' ghost' : ''}${isLight(color) ? ' light' : ''}` });
      tag.append(document.createElement('b'), Object.assign(document.createElement('span'), { textContent: c.name || 'Pana' }));
      tag.style.setProperty('--c', color);
      layer.append(tag);
      tags.set(c, tag);
    }
    return tag;
  };
  const hide = (tag) => { if (tag.style.display !== 'none') tag.style.display = 'none'; };
  return {
    // cars: everything that may get a tag; me: the camera's car; order: the
    // standings, for the place number (cars outside it, like the ghost, get none).
    update(cars, camera, me, { show = true, order = [], width = innerWidth, height = innerHeight } = {}) {
      const live = new Set(cars);
      for (const [c, tag] of tags) if (!live.has(c)) { tag.remove(); tags.delete(c); }
      for (const c of cars) {
        if (c === me) continue;
        const tag = tagFor(c);
        const d = me ? Math.hypot(c.x - me.x, c.z - me.z) : Infinity;
        if (!show || c.retired || d > NEAR) { hide(tag); continue; }
        v.set(c.x, c.y + LIFT, c.z).project(camera);
        if (v.z > 1 || Math.abs(v.x) > 1.1 || Math.abs(v.y) > 1.1) { hide(tag); continue; }
        if (tag.style.display === 'none') tag.style.display = '';
        const place = String(order.indexOf(c) + 1 || '');
        if (tag.firstChild.textContent !== place) tag.firstChild.textContent = place;
        const far = d > FULL && !c.ghost;
        if (tag.classList.contains('far') !== far) tag.classList.toggle('far', far);
        const x = (v.x + 1) / 2 * width, y = (1 - v.y) / 2 * height;
        const scale = Math.max(0.75, Math.min(1.1, 14 / Math.max(6, d)));
        tag.style.transform = `translate(${x.toFixed(1)}px, ${y.toFixed(1)}px) translate(-50%, -100%) scale(${scale.toFixed(2)})`;
        tag.style.opacity = String(Math.min(1, (NEAR - d) / FADE) * (c.ghost ? 0.85 : 1));
      }
    },
    clear() { for (const tag of tags.values()) tag.remove(); tags.clear(); },
  };
}
