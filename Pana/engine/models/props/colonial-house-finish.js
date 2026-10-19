import * as THREE from 'three';
import { M, mesh } from '../core/primitives.js';
import { houseRandom } from './colonial-house-spec.js';
import { clamp } from '../../random.js';

// Vertex-colored paint and shallow brick accents survive the existing static bake.
// No textures, transparency, shader hooks or per-seed cached materials are needed.
const paint = M(0xffffff, { vertexColors: true, flatShading: true, roughness: 0.9 });
const clay = [0xb4573a, 0xc96a45, 0x9e4a31, 0xd27d52, 0xa85a3c].map(c => new THREE.Color(c));
const mortar = new THREE.Color(0xd9ccb2), chalk = new THREE.Color(0xf2e4c9);

function colored(geometry, color) {
  const position = geometry.attributes.position, values = new Float32Array(position.count * 3);
  for (let i = 0; i < position.count; i++) color.toArray(values, i * 3);
  geometry.setAttribute('color', new THREE.BufferAttribute(values, 3));
  return geometry;
}

function polygon(points, color, z, depth = 0) {
  const shape = new THREE.Shape(); points.forEach(([x, y], i) => i ? shape.lineTo(x, y) : shape.moveTo(x, y)); shape.closePath();
  const geometry = depth ? new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: false }) : new THREE.ShapeGeometry(shape);
  return mesh(colored(geometry, color), paint, 0, 0, z);
}

function noise(x, y, salt) {
  const hash = (a, b) => {
    let n = Math.imul(a, 374761393) ^ Math.imul(b, 668265263) ^ salt;
    n = Math.imul(n ^ (n >>> 13), 1274126177); return ((n ^ (n >>> 16)) >>> 0) / 4294967295;
  };
  const ix = Math.floor(x), iy = Math.floor(y), smooth = t => t * t * (3 - 2 * t);
  const tx = smooth(x - ix), ty = smooth(y - iy), mix = (a, b, t) => a + (b - a) * t;
  return mix(mix(hash(ix, iy), hash(ix + 1, iy), tx), mix(hash(ix, iy + 1), hash(ix + 1, iy + 1), tx), ty);
}

function regions(face, floor, spec) {
  const left = -face.span / 2 + 0.27, right = face.span / 2 - 0.27;
  const bottom = spec.base + floor * spec.floorHeight + (floor ? 0.12 : 0.65), top = spec.base + (floor + 1) * spec.floorHeight - 0.13;
  const reserved = face.openings.filter(o => o.floor === floor).map(o => ({
    left: o.x - o.width / 2 - 0.27, right: o.x + o.width / 2 + 0.27,
    bottom: o.bottom - 0.18, top: o.bottom + o.height + 0.29,
  }));
  const cuts = (lo, hi, keys) => [...new Set([lo, hi, ...reserved.flatMap(r => keys.map(k => clamp(r[k], lo, hi)))])].sort((a, b) => a - b);
  const xs = cuts(left, right, ['left', 'right']), ys = cuts(bottom, top, ['bottom', 'top']), result = [];
  for (let i = 1; i < xs.length; i++) for (let j = 1; j < ys.length; j++) {
    const x = (xs[i - 1] + xs[i]) / 2, y = (ys[j - 1] + ys[j]) / 2;
    if (reserved.some(r => x > r.left && x < r.right && y > r.bottom && y < r.top)) continue;
    const w = xs[i] - xs[i - 1], h = ys[j] - ys[j - 1];
    if (w > 0.05 && h > 0.05) result.push({ x, y, w, h });
  }
  return result;
}

function plaster(group, region, color, salt, detail) {
  const { x, y, w, h } = region, spacing = detail === 'low' ? 1 : 0.3;
  const geometry = new THREE.PlaneGeometry(w, h, Math.max(2, Math.ceil(w / spacing)), Math.max(2, Math.ceil(h / spacing)));
  const p = geometry.attributes.position, colors = new Float32Array(p.count * 3), shade = new THREE.Color();
  for (let i = 0; i < p.count; i++) {
    const px = p.getX(i) + x, py = p.getY(i) + y;
    const fade = clamp(Math.min(w / 2 - Math.abs(p.getX(i)), h / 2 - Math.abs(p.getY(i))) / 0.17);
    const broad = noise(px * 1.4, py * 1.7, salt), brush = noise(px * 3.8, py * 7, salt + 23);
    const tone = 0.68 + broad * 0.5 + brush * 0.14;
    shade.copy(color).multiplyScalar(1 + (tone - 1) * fade).toArray(colors, i * 3);
  }
  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  group.add(mesh(geometry, paint, x, y, 0.006));
}

// Patches are sized to read from a passing car: up to most of a wall
// panel, in rows of chunky toy bricks.
function brickPatch(group, region, color, random, exposed, detail) {
  const w = Math.min(region.w - 0.07, 1.3 + random() * 1.1), h = Math.min(region.h - 0.1, 0.9 + random() * 0.7);
  const cx = region.x + (random() - 0.5) * (region.w - w - 0.04);
  const cy = region.y + (random() - 0.5) * (region.h - h - 0.08);
  const count = Math.max(2, Math.round(h / 0.23)), rowHeight = h / count;
  const rows = Array.from({ length: count }, (_, i) => {
    const width = w * (i === 0 || i === count - 1 ? 0.64 + random() * 0.19 : 0.9 + random() * 0.1);
    const offset = (random() - 0.5) * (w - width) * 0.5;
    return { left: cx - width / 2 + offset, right: cx + width / 2 + offset, bottom: cy - h / 2 + i * rowHeight };
  });
  const outline = padding => {
    const left = rows.flatMap((r, i) => [[r.left - padding, r.bottom - (i === 0 ? padding : 0)], [r.left - padding, r.bottom + rowHeight + (i === count - 1 ? padding : 0)]]);
    const right = rows.map((r, i) => [[r.right + padding, r.bottom + rowHeight + (i === count - 1 ? padding : 0)], [r.right + padding, r.bottom - (i === 0 ? padding : 0)]]).reverse().flat();
    return [...left, ...right];
  };
  group.add(polygon(outline(0.025), color.clone().lerp(chalk, exposed ? 0.2 : 0.035), 0.009));
  group.add(polygon(outline(0), exposed ? mortar : color.clone().multiplyScalar(0.58), 0.012));
  rows.forEach((row, index) => {
    const unit = 0.5, offset = index % 2 * unit / 2;
    for (let start = cx - w / 2 - unit + offset; start < row.right; start += unit) {
      const left = Math.max(row.left, start) + 0.018, right = Math.min(row.right, start + unit) - 0.018;
      if (right - left < 0.055) continue;
      // Square-cornered bricks: at 0.5 m the chamfer never read and cost 2.3× the triangles.
      const low = row.bottom + 0.016, high = row.bottom + rowHeight - 0.016;
      const points = [[left, low], [right, low], [right, high], [left, high]];
      const shade = exposed ? clay[Math.floor(random() * clay.length)] : color.clone().lerp(chalk, 0.12 + random() * 0.14);
      group.add(polygon(points, shade, 0.014, detail === 'low' ? 0 : 0.03));
    }
  });
}

export function finishWall(parent, face, floor, spec, color, detail = 'game') {
  // The low street build finishes only the wall that faces the road.
  if (spec.wallFinish === 'lisa' || detail === 'low' && face.id !== 'front') return;
  const group = new THREE.Group(); group.name = `wall-finish-${face.id}-${floor}`; parent.add(group);
  const base = new THREE.Color(color), areas = regions(face, floor, spec);
  const random = houseRandom(spec.finishSeed, `finish-${face.id}-${floor}`), salt = Math.floor(random() * 0xffffffff);
  for (const area of areas) plaster(group, area, base, salt, detail);
  if (spec.wallFinish === 'cal') return;
  const candidates = areas.filter(r => r.w >= 0.34 && r.h >= 0.5).map(r => ({ ...r, score: Math.min(r.w, 1.7) * Math.min(r.h, 1.2) * (0.7 + random() * 0.6) })).sort((a, b) => b.score - a.score);
  const count = face.id === 'front' ? 2 : 1;
  for (const region of candidates.slice(0, count)) brickPatch(group, region, base, random, spec.wallFinish === 'ladrillo-visto', detail);
}
