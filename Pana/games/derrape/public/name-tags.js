// Name tags over nearby racers: a plain DOM label per car, placed each drawn
// frame by projecting a point above its roof. No textures (the GPU budget
// and cup-lifetime stay untouched) and crisp text at any size. Tags show for
// cars within NEAR metres of the camera's car, fading with distance; the
// player's own car never gets one, and split screen hides them all.
import * as THREE from 'three';

const NEAR = 45, FADE = 15, LIFT = 2.9;
const STYLE = `
.pk-tags { position: fixed; inset: 0; pointer-events: none; z-index: 5; overflow: hidden; }
.pk-tag { position: absolute; left: 0; top: 0; transform: translate(-50%, -100%); padding: 2px 9px 3px;
  border-radius: 999px; background: rgba(18, 16, 40, .72); color: #fff; font: 700 13px/1.2 system-ui, sans-serif;
  white-space: nowrap; border: 2px solid var(--c, #fff); text-shadow: 0 1px 2px rgba(0,0,0,.6); will-change: transform, opacity; }
.pk-tag.ghost { background: rgba(70, 200, 255, .22); border-style: dashed; color: #dff6ff; }
`;

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
      tag = Object.assign(document.createElement('div'), { className: `pk-tag${c.ghost ? ' ghost' : ''}`, textContent: c.name || 'Pana' });
      tag.style.setProperty('--c', c.def?.color || '#fff');
      layer.append(tag);
      tags.set(c, tag);
    }
    return tag;
  };
  const hide = (tag) => { if (tag.style.display !== 'none') tag.style.display = 'none'; };
  return {
    // cars: everything that may get a tag; me: the camera's car.
    update(cars, camera, me, { show = true, width = innerWidth, height = innerHeight } = {}) {
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
        const x = (v.x + 1) / 2 * width, y = (1 - v.y) / 2 * height;
        const scale = Math.max(0.7, Math.min(1.15, 18 / Math.max(6, d)));
        tag.style.transform = `translate(${x.toFixed(1)}px, ${y.toFixed(1)}px) translate(-50%, -100%) scale(${scale.toFixed(2)})`;
        tag.style.opacity = String(Math.min(1, (NEAR - d) / FADE) * (c.ghost ? 0.85 : 1));
      }
    },
    clear() { for (const tag of tags.values()) tag.remove(); tags.clear(); },
  };
}
