import * as THREE from 'three';
import { M, mesh, box, tube } from '../core/primitives.js';
import { rounded, archPanel, archFrame } from '../core/architecture-kit.js';
import { windowJoinery } from './colonial-house-windows.js';
import { alternativeRoof } from './colonial-house-roofs.js';
import { finishWall } from './colonial-house-finish.js';

export const timber = M(0x683c24, { roughness: 0.9 });
const woodLight = M(0x8e5330, { roughness: 0.9 }), iron = M(0x253739, { roughness: 0.65, metalness: 0.4 });
const recess = M(0x252e2d), brass = M(0xbc8936, { metalness: 0.5, roughness: 0.5 });

// Low detail is the street build every map clones by the dozen: square
// trim instead of rounded, no door knobs, coarser arches.
export function opening(group, slot, colors, detail) {
  const { x, bottom: y, width: w, height: h, kind, arch } = slot, low = detail === 'low';
  const trimBox = (w, h, d, m, x, y, z, r) => low ? box(w, h, d, m, x, y, z) : rounded(w, h, d, m, x, y, z, r);
  const trim = M(colors.trim, { roughness: 0.9 }), joinery = M(colors.joinery, { roughness: 0.9 });
  const shape = arch ? archPanel(w, h, 0.06, recess, x, y, -0.18) : box(w, h, 0.06, recess, x, y + h / 2, -0.18);
  group.add(shape);
  if (arch) group.add(archFrame(w, h, 0.18, trim, x, y, 0.05));
  else {
    for (const s of [-1, 1]) group.add(box(0.16, h, 0.24, trim, x + s * (w + 0.16) / 2, y + h / 2, 0.025));
    group.add(trimBox(w + 0.44, 0.22, 0.32, trim, x, y + h + 0.07, 0.045, 0.025));
  }
  if (kind === 'door') {
    const panelHeight = arch ? h - w / 2 : h;
    group.add(arch ? archPanel(w - 0.09, h - 0.045, 0.055, joinery, x, y, -0.115) : box(w - 0.09, h - 0.035, 0.055, joinery, x, y + h / 2, -0.115));
    for (const s of [-1, 1]) for (const [offset, height] of [[0.38, 0.58], [panelHeight * 0.67, panelHeight * 0.5]]) {
      group.add(box(w * 0.35, height, 0.035, timber, x + s * w * 0.225, y + offset, -0.072));
      group.add(box(w * 0.29, height - 0.08, 0.035, joinery, x + s * w * 0.225, y + offset, -0.05));
    }
    group.add(box(0.035, panelHeight, 0.035, timber, x, y + panelHeight / 2, -0.065));
    if (!low) for (const s of [-1, 1]) group.add(mesh(new THREE.SphereGeometry(0.048, 7, 5), brass, x + s * 0.13, y + 1.15, -0.005));
    group.add(box(w + 0.2, 0.07, 0.36, trim, x, y + 0.015, 0.02));
  } else {
    group.add(trimBox(w + 0.45, 0.15, 0.47, trim, x, y - 0.07, 0.12, 0.025));
    windowJoinery(group, slot, colors, detail);
  }
}

// Actual wall holes give the shutters and doors a visible reveal from every angle.
export function facade(group, face, spec, colors, detail) {
  const frame = new THREE.Group(); frame.position.set(...face.position); frame.rotation.y = face.angle; group.add(frame);
  for (let floor = 0; floor < spec.floors; floor++) {
    const y = spec.base + floor * spec.floorHeight, h = spec.floorHeight, w = face.span;
    const shape = new THREE.Shape(); shape.moveTo(-w / 2, y); shape.lineTo(w / 2, y); shape.lineTo(w / 2, y + h); shape.lineTo(-w / 2, y + h); shape.closePath();
    // The low street build leaves the rear wall plain (no map shows it) and
    // paints the side windows on as a framed panel instead of cutting holes.
    const flat = detail === 'low' && face.id !== 'front';
    if (flat && face.id !== 'rear') for (const slot of face.openings.filter(o => o.floor === floor)) {
      frame.add(box(slot.width + 0.3, slot.height + 0.3, 0.06, M(colors.trim, { roughness: 0.9 }), slot.x, slot.bottom + slot.height / 2, 0.03));
      frame.add(box(slot.width, slot.height, 0.08, M(colors.joinery, { roughness: 0.9 }), slot.x, slot.bottom + slot.height / 2, 0.04));
    }
    for (const slot of face.openings.filter(o => o.floor === floor && !flat)) {
      // Door holes begin a hair above the bottom to retain a valid closed polygon.
      const hole = new THREE.Path(), left = slot.x - slot.width / 2, right = slot.x + slot.width / 2, low = slot.bottom + 0.01, high = slot.bottom + slot.height;
      hole.moveTo(left, low); hole.lineTo(left, slot.arch ? high - slot.width / 2 : high);
      if (slot.arch) hole.absarc(slot.x, high - slot.width / 2, slot.width / 2, Math.PI, 0, true);
      else hole.lineTo(right, high);
      hole.lineTo(right, low); hole.closePath(); shape.holes.push(hole);
      opening(frame, slot, colors, detail);
    }
    const geometry = new THREE.ExtrudeGeometry(shape, { depth: 0.23, bevelEnabled: false, curveSegments: detail === 'low' ? 5 : 12 }); geometry.translate(0, 0, -0.23);
    frame.add(mesh(geometry, M(floor ? colors.upper : colors.wall, { roughness: 0.9 })));
    finishWall(frame, face, floor, spec, floor ? colors.upper : colors.wall, detail);
    // Plinth strips stop at the door, leaving the threshold unobstructed.
    const doors = face.openings.filter(o => o.floor === floor && o.kind === 'door').sort((a, b) => a.x - b.x);
    if (!floor) {
      let start = -w / 2;
      for (const door of [...doors, { x: w / 2, width: 0 }]) {
        const end = door.x - door.width / 2;
        if (end > start) frame.add(box(end - start, 0.58, 0.075, M(colors.base), (start + end) / 2, spec.base + 0.29, 0.025));
        start = door.x + door.width / 2;
      }
    }
  }
  for (const x of [-face.span / 2 + 0.12, face.span / 2 - 0.12]) frame.add(box(0.24, spec.floors * spec.floorHeight, 0.08, M(colors.trim), x, spec.base + spec.floors * spec.floorHeight / 2, 0.04));
  if (spec.floors === 2) frame.add(box(face.span + 0.05, 0.16, 0.14, M(colors.trim), 0, spec.base + spec.floorHeight - 0.09, 0.04));
}

export function roof(group, spec, colors, detail) {
  if (spec.roof !== 'tejas') { alternativeRoof(group, spec, colors, detail); return; }
  const w = spec.width, d = spec.depth, top = spec.base + spec.floors * spec.floorHeight, rise = 1.12;
  const eaveLeft = spec.partyWalls.includes('left') ? 0 : 0.4, eaveRight = spec.partyWalls.includes('right') ? 0 : 0.4;
  const roofWidth = w + eaveLeft + eaveRight, centerX = (eaveRight - eaveLeft) / 2;
  const tiles = [0xc95830, 0xdc6839, 0xb94d2a].map(c => M(c, { roughness: 0.9, side: THREE.DoubleSide }));
  const slope = Math.atan2(rise, d / 2);
  for (const side of [-1, 1]) {
    const overhang = side > 0 ? spec.balcony ? 1.28 : 0.43 : spec.partyWalls.includes('rear') ? 0 : 0.4;
    const half = d / 2 + overhang, length = half / Math.cos(slope);
    const panel = new THREE.Group(); panel.position.set(centerX, top + rise - half * Math.tan(slope) / 2, side * half / 2); panel.rotation.x = side * slope;
    panel.add(box(roofWidth, 0.13, length, timber));
    const columns = Math.ceil(roofWidth / (detail === 'low' ? 0.42 : 0.3)), spacing = roofWidth / columns, rows = detail === 'low' ? 1 : Math.ceil(length / 0.55);
    for (let i = 0; i < columns; i++) for (let j = 0; j < rows; j++) {
      const tile = mesh(new THREE.CylinderGeometry(spacing * 0.53, spacing * 0.46, length / rows + 0.07, 6, 1, true, 0, Math.PI), tiles[(i + j + spec.seed) % 3], -roofWidth / 2 + (i + 0.5) * spacing, 0.08, -length / 2 + (j + 0.5) * length / rows);
      tile.rotation.set(Math.PI / 2, Math.PI / 2, 0); panel.add(tile);
    }
    if (detail !== 'low') for (let x = -w / 2 + 0.15; x < w / 2; x += 0.58) panel.add(box(0.12, 0.17, 0.5, woodLight, x - centerX, -0.12, side * (length / 2 - 0.22)));
    group.add(panel);
  }
  // Low detail caps the ridge with one square piece instead of round tiles.
  if (detail === 'low') group.add(box(roofWidth, 0.2, 0.36, tiles[1], centerX, top + rise + 0.06, 0));
  else for (let x = -roofWidth / 2; x < roofWidth / 2; x += 0.43) {
    const cap = mesh(new THREE.CylinderGeometry(0.2, 0.19, 0.47, 8, 1, true, 0, Math.PI), tiles[1], x + centerX + 0.2, top + rise + 0.09, 0);
    cap.rotation.set(0, 0, Math.PI / 2); group.add(cap);
  }
  for (const side of [-1, 1]) {
    const shape = new THREE.Shape(); shape.moveTo(-d / 2, 0); shape.lineTo(d / 2, 0); shape.lineTo(0, rise); shape.closePath();
    const gable = mesh(new THREE.ShapeGeometry(shape), M(spec.floors === 2 ? colors.upper : colors.wall, { side: THREE.DoubleSide }), side * w / 2, top, 0);
    gable.rotation.y = Math.PI / 2; group.add(gable);
  }
}

export function lantern(group, x, y, z) {
  const g = new THREE.Group(); g.position.set(x, y, z); group.add(g);
  g.add(box(0.1, 0.4, 0.07, iron, 0, 0.2, 0), box(0.06, 0.07, 0.31, iron, 0, 0.38, 0.13));
  const glass = M(0xffd16c, { emissive: 0xffb632, emissiveIntensity: 0.65, roughness: 0.4 });
  g.add(box(0.21, 0.33, 0.21, glass, 0, 0.04, 0.3));
  for (const a of [-1, 1]) for (const b of [-1, 1]) g.add(box(0.025, 0.4, 0.025, iron, a * 0.13, 0.04, 0.3 + b * 0.13));
  const cap = mesh(new THREE.ConeGeometry(0.24, 0.21, 4), iron, 0, 0.34, 0.3); cap.rotation.y = Math.PI / 4;
  g.add(cap, box(0.31, 0.045, 0.31, iron, 0, -0.17, 0.3), mesh(new THREE.SphereGeometry(0.045, 6, 4), iron, 0, 0.46, 0.3));
}

export function balcony(group, spec, detail = 'game') {
  const low = detail === 'low';
  const w = spec.width - 0.36, front = spec.depth / 2, y = spec.base + spec.floorHeight;
  group.add(box(w, 0.17, 1.12, timber, 0, y - 0.085, front + 0.47));
  for (let x = -w / 2 + 0.15; x <= w / 2; x += 0.64) {
    group.add(box(0.13, 0.21, 1.17, woodLight, x, y - 0.23, front + 0.45));
    if (!low) group.add(tube([x, y - 0.72, front + 0.04], [x, y - 0.18, front + 0.74], 0.07, timber));
  }
  const rail = (a, b) => {
    const count = Math.ceil(Math.hypot(b[0] - a[0], b[1] - a[1]) / 0.27);
    for (let i = 0; i <= count; i++) {
      const x = a[0] + (b[0] - a[0]) * i / count, z = a[1] + (b[1] - a[1]) * i / count;
      group.add(box(0.055, 0.8, 0.055, timber, x, y + 0.48, z));
      if (!low) group.add(mesh(new THREE.CylinderGeometry(0.055, 0.038, 0.28, 6), woodLight, x, y + 0.48, z));
    }
    for (const lift of [0.08, 0.9]) group.add(box(Math.abs(b[0] - a[0]) + 0.11, 0.1, Math.abs(b[1] - a[1]) + 0.11, timber, (a[0] + b[0]) / 2, y + lift, (a[1] + b[1]) / 2));
  };
  rail([-w / 2, front + 1], [w / 2, front + 1]);
  for (const side of [-1, 1]) rail([side * w / 2, front + 0.08], [side * w / 2, front + 1]);
  const postTop = spec.base + spec.floorHeight * 2 - (spec.roof === 'tejas' ? 1.12 / (spec.depth / 2) : 0) - 0.08;
  for (const x of [-w / 2, w / 2]) {
    group.add(box(0.17, postTop - y, 0.17, timber, x, (postTop + y) / 2, front + 1));
    group.add(box(0.28, 0.16, 0.28, woodLight, x, postTop - 0.16, front + 1));
  }
  group.add(box(w + 0.2, 0.18, 0.2, timber, 0, postTop, front + 1));
}

export function crest(group, spec, colors) {
  const w = Math.min(3.7, spec.width * 0.55), y = spec.base + spec.floors * spec.floorHeight + 0.12;
  const outline = (width, lift) => {
    const shape = new THREE.Shape(); shape.moveTo(-width / 2, 0); shape.lineTo(width / 2, 0); shape.lineTo(width / 2, 0.38 + lift);
    shape.lineTo(width * 0.26, 0.38 + lift); shape.quadraticCurveTo(width * 0.2, 0.43 + lift, width * 0.18, 0.65 + lift);
    shape.quadraticCurveTo(0, 1.3 + lift, -width * 0.18, 0.65 + lift); shape.quadraticCurveTo(-width * 0.2, 0.43 + lift, -width * 0.26, 0.38 + lift);
    shape.lineTo(-width / 2, 0.38 + lift); shape.closePath(); return shape;
  };
  const back = new THREE.ExtrudeGeometry(outline(w, 0.08), { depth: 0.19, bevelEnabled: false, curveSegments: 16 });
  group.add(mesh(back, M(colors.trim), 0, y, spec.depth / 2 - 0.18));
  group.add(mesh(new THREE.ShapeGeometry(outline(w - 0.24, 0)), M(colors.wall), 0, y + 0.06, spec.depth / 2 + 0.02));
}
