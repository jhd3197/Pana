import * as THREE from 'three';
import { M, box, tube, mesh } from '../core/primitives.js';
import { archPanel } from '../core/architecture-kit.js';

const timber = M(0x683c24, { roughness: 0.9 });
const iron = M(0x253739, { roughness: 0.65, metalness: 0.4 });
const glass = M(0x3e656e, { roughness: 0.3, metalness: 0.15 });

// Every style changes the joinery geometry; all share the same real wall reveal.
export function windowJoinery(group, slot, colors, detail) {
  const { x, bottom: y, width: w, height: h, windowStyle: style } = slot;
  const paint = M(colors.joinery, { roughness: 0.9 });
  const g = new THREE.Group(); g.position.set(x, y, 0); group.add(g);
  if (style === 'postigos') {
    g.add(box(w - 0.08, h - 0.08, 0.05, glass, 0, h / 2, -0.13));
    for (const offset of [0, h / 2, h]) g.add(box(w, 0.07, 0.08, timber, 0, offset, -0.08));
    g.add(box(0.07, h, 0.08, timber, 0, h / 2, -0.08));
    for (const s of [-1, 1]) {
      const hinge = new THREE.Group(); hinge.position.set(s * w / 2, h / 2, 0.08); hinge.rotation.y = -s * 1.15;
      hinge.add(box(w * 0.45, h - 0.06, 0.075, paint, s * w * 0.225, 0, 0));
      for (const offset of [-h * 0.25, h * 0.25]) hinge.add(box(w * 0.34, h * 0.36, 0.04, timber, s * w * 0.225, offset, 0.055));
      g.add(hinge);
    }
    return;
  }
  if (style === 'celosia') {
    for (const s of [-1, 1]) {
      const cx = s * w * 0.245;
      for (const dx of [-w * 0.22, w * 0.22]) g.add(box(0.065, h, 0.13, paint, cx + dx, h / 2, 0.02));
      for (const dy of [0.04, h * 0.5, h - 0.04]) g.add(box(w * 0.45, 0.09, 0.15, timber, cx, dy, 0.02));
      const count = detail === 'low' ? 10 : 16;
      for (let i = 0; i < count; i++) {
        const slat = box(w * 0.39, h / count * 0.8, 0.045, paint, cx, 0.1 + i * (h - 0.2) / (count - 1), 0.04);
        slat.rotation.x = -0.55; g.add(slat);
      }
    }
    return;
  }
  if (style === 'arco') {
    g.add(archPanel(w - 0.08, h - 0.04, 0.055, glass, 0, 0, -0.12));
    const radius = w / 2, spring = h - radius;
    g.add(box(0.07, spring, 0.08, timber, 0, spring / 2, -0.065), box(w, 0.07, 0.08, timber, 0, spring, -0.065));
    for (let i = -2; i <= 2; i++) {
      const dx = i * w / 5, high = spring + Math.sqrt(radius * radius - dx * dx) - 0.035;
      g.add(box(0.035, high - 0.05, 0.05, iron, dx, (high + 0.05) / 2, 0.2));
    }
    for (const dy of [0.12, spring * 0.5, spring]) g.add(box(w, 0.04, 0.06, iron, 0, dy, 0.21));
    for (const a of [Math.PI / 4, Math.PI / 2, Math.PI * 3 / 4]) g.add(tube([0, spring, -0.06], [Math.cos(a) * radius * 0.9, spring + Math.sin(a) * radius * 0.9, -0.06], 0.025, timber));
    return;
  }
  const wide = style === 'doble', panes = wide ? 4 : 2;
  for (let i = 0; i < panes; i++) {
    const cx = (i - (panes - 1) / 2) * w / panes;
    g.add(box(w / panes - 0.045, h - 0.1, 0.055, paint, cx, h / 2, -0.12));
    for (const dy of [h * 0.25, h * 0.72]) g.add(box(w / panes - 0.12, h * 0.35, 0.035, timber, cx, dy, -0.075));
  }
  if (wide) g.add(box(0.13, h + 0.12, 0.26, M(colors.trim), 0, h / 2, 0.09));
  const count = wide ? 8 : 5, curved = style === 'reja-curva';
  for (let i = 0; i < count; i++) {
    const dx = (i / (count - 1) - 0.5) * w * 0.87;
    if (curved) {
      const points = [[dx, 0, 0.18], [dx, h * 0.17, 0.46], [dx, h * 0.4, 0.46], [dx, h * 0.58, 0.2], [dx, h, 0.2]];
      for (let j = 1; j < points.length; j++) g.add(tube(points[j - 1], points[j], 0.023, iron));
    } else g.add(box(0.037, h + 0.1, 0.045, iron, dx, h / 2, 0.23));
  }
  for (const t of [0.09, 0.42, 0.9]) {
    const z = !curved ? 0.25 : t < 0.17 ? 0.18 + 0.28 * t / 0.17 : t < 0.4 ? 0.46 : t < 0.58 ? 0.46 - 0.26 * (t - 0.4) / 0.18 : 0.2;
    g.add(box(w + 0.1, 0.04, 0.05, iron, 0, h * t, z));
  }
  if (curved) {
    for (const s of [-1, 1]) {
      const curl = mesh(new THREE.TorusGeometry(w * 0.14, 0.022, 5, 16, Math.PI * 1.7), iron, s * w * 0.2, h + 0.07, 0.23);
      curl.rotation.y = s < 0 ? Math.PI : 0; g.add(curl);
    }
    g.add(tube([0, h - 0.05, 0.23], [0, h + 0.3, 0.23], 0.028, iron));
  }
}
