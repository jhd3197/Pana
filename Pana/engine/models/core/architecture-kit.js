// Construction details shared by the Pueblo and Páramo model packs.
// Factories own geometry; cached untextured materials are safe to batch.
import { letter, whenFont } from '/engine/models/core/lettering.js';
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { M, mesh, box, tube, canvasMat } from '/engine/models/core/primitives.js';
import { bake, finish } from '/engine/models/core/static-batch.js';
export { finish } from '/engine/models/core/static-batch.js';

export const palette = {
  cream: M(0xf0dfb9, { roughness: 0.9 }), iron: M(0x354d4d, { metalness: 0.35, roughness: 0.65 }),
  wood: M(0x90613e, { roughness: 0.9 }), timber: M(0x573e30, { roughness: 1 }),
  stone: M(0x8d9488, { roughness: 1 }), dark: M(0x263c3c, { roughness: 0.85 }),
  brass: M(0xc5a35a, { metalness: 0.6, roughness: 0.4 }),
};

export function paintFinish(group, name) {
  group.traverse(o => {
    if (!o.isMesh || o.material.map || o.material.bumpMap || Array.isArray(o.material) || o.material.transparent || o.material.emissive?.getHex()) return;
    const m = o.material;
    if (!m.vertexColors && !o.geometry.attributes.color) {
      const prev = o.geometry, c = m.color, colors = new Float32Array(prev.attributes.position.count * 3);
      for (let i = 0; i < colors.length; i += 3) { colors[i] = c.r; colors[i + 1] = c.g; colors[i + 2] = c.b; }
      o.geometry = prev.clone();
      o.geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
      prev.dispose();
    }
    const metallic = (m.metalness || 0) >= 0.25;
    o.material = M(0xffffff, {
      vertexColors: true,
      flatShading: !!m.flatShading,
      roughness: metallic ? 0.42 : 0.9,
      metalness: metallic ? 0.45 : 0,
      side: m.side,
    });
  });
  return finish(group, name);
}

export function rounded(w, h, d, material, x = 0, y = 0, z = 0, radius = 0.045) {
  return mesh(new RoundedBoxGeometry(w, h, d, 1, Math.min(radius, w / 4, h / 4, d / 4)), material, x, y, z);
}

export function sign(text, w, h, { background = '#285b58', color = '#f9e7bd', border = true } = {}) {
  const list = Array.isArray(text) ? text : [text], ch = Math.max(96, Math.round(768 * h / w));
  const paint = ctx => {
    ctx.fillStyle = background; ctx.fillRect(0, 0, 768, ch);
    if (border) { ctx.strokeStyle = color; ctx.lineWidth = 3; ctx.strokeRect(12, 12, 744, ch - 24); }
    // Cartoon lettering that shrinks each line to fit (core/lettering.js).
    letter(ctx, list.map(String), 768, ch, { top: ch * .08, bottom: ch * .92, margin: .06, cream: color, gold: color });
  };
  const material = canvasMat(768, ch, paint);
  whenFont(material, paint);
  // Opaque, front-facing panels avoid unnecessary transparent sorting.
  material.transparent = false;
  return mesh(new THREE.PlaneGeometry(w, h), material);
}

export function curve(points, radius, material, segments = 16) {
  return mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points.map(p => new THREE.Vector3(...p))), segments, radius, 6, false), material);
}

export function archShape(w, h) {
  const s = new THREE.Shape(), r = w / 2;
  s.moveTo(-r, 0); s.lineTo(r, 0); s.lineTo(r, h - r);
  s.absarc(0, h - r, r, 0, Math.PI, false); s.lineTo(-r, 0); return s;
}

export function archPanel(w, h, depth, material, x = 0, y = 0, z = 0) {
  const geo = new THREE.ExtrudeGeometry(archShape(w, h), { depth, bevelEnabled: false, curveSegments: 16 });
  geo.translate(0, 0, -depth / 2); return mesh(geo, material, x, y, z);
}

export function archFrame(w, h, thickness, material, x = 0, y = 0, z = 0) {
  const g = new THREE.Group(); g.position.set(x, y, z);
  const spring = h - w / 2;
  for (const s of [-1, 1]) g.add(rounded(thickness, spring, 0.2, material, s * (w + thickness) / 2, spring / 2, 0));
  const shape = new THREE.Shape();
  shape.absarc(0, spring, w / 2 + thickness, 0, Math.PI, false);
  shape.absarc(0, spring, w / 2, Math.PI, 0, true); shape.closePath();
  const geo = new THREE.ExtrudeGeometry(shape, { depth: 0.2, bevelEnabled: true, bevelSize: 0.015, bevelThickness: 0.015, bevelSegments: 1, curveSegments: 16 });
  geo.translate(0, 0, -0.1); g.add(mesh(geo, material)); return g;
}

// Complete pitched roof: end gables, overlapping clay channels and ridge caps.
export function tiledRoof(group, { w, d, y, rise = 1.1, wall = palette.cream, seed = 1 }) {
  const tile = [0xb76141, 0xc77850, 0xa95139].map(c => M(c, { roughness: 0.95, side: THREE.DoubleSide }));
  const half = d / 2 + 0.3, slope = Math.atan2(rise, half), run = Math.hypot(half, rise);
  // Keep the roof touching the walls; the eaves extend below their top.
  const eaveY = y - rise * 0.3 / half;
  for (const x of [-w / 2, w / 2]) {
    const shape = new THREE.Shape(); shape.moveTo(-d / 2, 0); shape.lineTo(d / 2, 0); shape.lineTo(0, rise * d / (d + 0.6)); shape.closePath();
    const gable = mesh(new THREE.ShapeGeometry(shape), wall, x, y, 0); gable.rotation.y = x < 0 ? -Math.PI / 2 : Math.PI / 2; group.add(gable);
  }
  for (const s of [-1, 1]) {
    const panel = new THREE.Group(); panel.position.set(0, eaveY + rise / 2, s * half / 2); panel.rotation.x = s * slope;
    panel.add(box(w + 0.6, 0.1, run + 0.12, tile[0]));
    const columns = Math.ceil((w + 0.6) / 0.3), rows = Math.ceil(run / 0.65);
    for (let i = 0; i < columns; i++) for (let j = 0; j < rows; j++) {
      const channel = mesh(new THREE.CylinderGeometry(0.15, 0.125, run / rows + 0.06, 6, 1, true, 0, Math.PI), tile[(i + j + seed) % 3], -w / 2 - 0.15 + i * (w + 0.3) / (columns - 1), 0.065, -run / 2 + (j + 0.5) * run / rows);
      channel.rotation.set(Math.PI / 2, Math.PI / 2, 0); panel.add(channel);
    }
    group.add(panel);
  }
  for (let x = -w / 2 - 0.15; x < w / 2 + 0.3; x += 0.46) {
    const cap = mesh(new THREE.CylinderGeometry(0.19, 0.19, 0.5, 8, 1, true, 0, Math.PI), tile[1], x, eaveY + rise + 0.06, 0);
    cap.rotation.z = Math.PI / 2; group.add(cap);
  }
}

export function shutterWindow(group, x, y, z, { w = 1.0, h = 1.45, color = 0x3b7c7a, bars = true } = {}) {
  const paint = M(color, { roughness: 0.8 });
  group.add(rounded(w + 0.25, h + 0.23, 0.18, palette.cream, x, y, z));
  group.add(box(w, h, 0.04, palette.dark, x, y, z + 0.105));
  for (const side of [-1, 1]) {
    const shutter = new THREE.Group(); shutter.position.set(x + side * (w / 2 + 0.19), y, z + 0.16); shutter.rotation.y = side * 0.32;
    shutter.add(rounded(w * 0.37, h, 0.07, paint));
    for (let i = 0; i < 7; i++) shutter.add(box(w * 0.3, 0.04, 0.055, palette.cream, 0, -h * 0.39 + i * h * 0.13, 0.05));
    group.add(shutter);
  }
  if (bars) {
    for (let i = -2; i <= 2; i++) group.add(tube([x + i * w / 5, y - h / 2, z + 0.2], [x + i * w / 5, y + h / 2, z + 0.2], 0.018, palette.iron));
    for (const s of [-1, 1]) group.add(box(w + 0.06, 0.035, 0.035, palette.iron, x, y + s * h * 0.24, z + 0.2));
  }
  group.add(rounded(w + 0.35, 0.12, 0.42, palette.cream, x, y - h / 2 - 0.11, z + 0.11));
}

export function railing(group, from, to, { height = 0.95, material = palette.iron, spacing = 0.32 } = {}) {
  const a = new THREE.Vector3(...from), b = new THREE.Vector3(...to), n = Math.ceil(a.distanceTo(b) / spacing);
  for (let i = 0; i <= n; i++) {
    const p = a.clone().lerp(b, i / n); group.add(tube(p.toArray(), [p.x, p.y + height, p.z], 0.026, material));
  }
  for (const lift of [0.12, height]) group.add(tube([a.x, a.y + lift, a.z], [b.x, b.y + lift, b.z], 0.035, material));
}

export function stoneCourses(group, { w, d, h, x = 0, y = 0, z = 0, seed = 1 }) {
  const mats = [0x8b9184, 0xa0a18d, 0x777e75].map(c => M(c, { roughness: 1 })), rows = Math.ceil(h / 0.35);
  group.add(box(w - 0.08, h, d - 0.08, palette.dark, x, y + h / 2, z));
  for (let row = 0; row < rows; row++) {
    const height = h / rows;
    for (const front of [-1, 1]) {
      const n = Math.ceil(w / 0.65), width = w / n;
      for (let i = 0; i < n; i++) group.add(rounded(width - 0.035, height - 0.025, 0.14, mats[(i + row + seed) % 3], x - w / 2 + (i + 0.5) * width, y + (row + 0.5) * height, z + front * (d / 2 - 0.06), 0.035));
    }
    for (const side of [-1, 1]) {
      const n = Math.ceil(d / 0.65), depth = d / n;
      for (let i = 0; i < n; i++) group.add(rounded(0.14, height - 0.025, depth - 0.035, mats[(i + row + seed + 1) % 3], x + side * (w / 2 - 0.06), y + (row + 0.5) * height, z - d / 2 + (i + 0.5) * depth, 0.035));
    }
  }
}
