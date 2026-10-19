import * as THREE from 'three';
import { M, box, mesh, tube } from '../core/primitives.js';
import { ZINC_PITCH } from './colonial-house-definitions.js';

const timber = M(0x683c24, { roughness: 0.9, side: THREE.DoubleSide });
const tiles = [0xc95830, 0xdc6839, 0xb94d2a].map(c => M(c, { roughness: 0.9, side: THREE.DoubleSide }));

function ridgeBox(a, b, material) {
  const m = box(0.24, a.distanceTo(b), 0.2, material);
  m.position.copy(a).add(b).multiplyScalar(0.5);
  m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), b.clone().sub(a).normalize());
  return m;
}

export function alternativeRoof(group, spec, colors, detail) {
  const { width: w, depth: d } = spec, top = spec.base + spec.floors * spec.floorHeight;
  const left = -w / 2 - (spec.partyWalls.includes('left') ? 0 : 0.4), right = w / 2 + (spec.partyWalls.includes('right') ? 0 : 0.4);
  const rear = -d / 2 - (spec.partyWalls.includes('rear') ? 0 : 0.4), front = d / 2 + (spec.balcony ? 1.28 : 0.43);
  if (spec.roof === 'zinc') {
    // One corrugated sheet from the front eave up to the back, with the side
    // walls carried up underneath it (turned 90°, shape x = +d/2 is the back).
    const rise = d * ZINC_PITCH, wall = M(spec.floors === 2 ? colors.upper : colors.wall, { side: THREE.DoubleSide });
    for (const x of [-w / 2, w / 2]) {
      const shape = new THREE.Shape(); shape.moveTo(-d / 2, 0); shape.lineTo(d / 2, 0); shape.lineTo(d / 2, rise); shape.closePath();
      const side = mesh(new THREE.ShapeGeometry(shape), wall, x, top, 0); side.rotation.y = Math.PI / 2; group.add(side);
    }
    group.add(box(w, rise, 0.2, wall, 0, top + rise / 2, -d / 2 + 0.1));
    const eave = 0.35, run = d + eave * 2, length = Math.hypot(run, run * ZINC_PITCH);
    const sheet = new THREE.PlaneGeometry(right - left, length, detail === 'low' ? 16 : 48, 1), p = sheet.attributes.position;
    for (let i = 0; i < p.count; i++) p.setZ(i, Math.sin(p.getX(i) * 9) * 0.04);
    sheet.computeVertexNormals();
    const zinc = mesh(sheet, M(0xc9d2d4, { metalness: 0.35, roughness: 0.5, side: THREE.DoubleSide }), (left + right) / 2, top + rise / 2 + 0.05, 0);
    zinc.rotation.x = -Math.PI / 2 + Math.atan(ZINC_PITCH); group.add(zinc);
    return;
  }
  if (spec.roof === 'azotea') {
    const trim = M(colors.trim), wall = M(spec.floors === 2 ? colors.upper : colors.wall);
    group.add(box(right - left, 0.18, front - rear, trim, (left + right) / 2, top, (front + rear) / 2));
    group.add(box(w - 0.2, 0.035, d - 0.2, M(0xb99173), 0, top + 0.1, 0));
    for (const s of [-1, 1]) {
      group.add(box(w, 0.46, 0.2, wall, 0, top + 0.32, s * (d / 2 - 0.1)), box(w + 0.05, 0.1, 0.27, trim, 0, top + 0.59, s * (d / 2 - 0.1)));
      group.add(box(0.2, 0.46, d, wall, s * (w / 2 - 0.1), top + 0.32, 0), box(0.27, 0.1, d, trim, s * (w / 2 - 0.1), top + 0.59, 0));
    }
    return;
  }
  // A soffit closes the space above the walls; four tiled planes meet a short ridge.
  group.add(box(right - left, 0.13, front - rear, timber, (left + right) / 2, top - 0.04, (front + rear) / 2));
  const ridgeHalf = Math.max(0.2, (w - d) / 2), ridgeY = top + 1.12;
  const p = (x, y, z) => new THREE.Vector3(x, y, z);
  const a = p(left, top, front), b = p(right, top, front), c = p(right, top, rear), e = p(left, top, rear);
  const r = p(ridgeHalf, ridgeY, 0), l = p(-ridgeHalf, ridgeY, 0);
  for (const [start, end, upperEnd, upperStart] of [[a, b, r, l], [c, e, l, r], [e, a, l, l], [b, c, r, r]]) {
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute([start, end, upperEnd, start, upperEnd, upperStart].flatMap(v => v.toArray()), 3)); geometry.computeVertexNormals();
    group.add(mesh(geometry, timber));
    const down = start.clone().add(end).sub(upperStart).sub(upperEnd).multiplyScalar(0.5), length = down.length(); down.normalize();
    const u = end.clone().sub(start).normalize(), normal = down.clone().cross(u).normalize();
    const basis = new THREE.Matrix4().makeBasis(u, normal, down), rows = detail === 'low' ? 2 : Math.ceil(length / 0.55);
    for (let row = 0; row < rows; row++) {
      const t = (row + 0.5) / rows, from = start.clone().lerp(upperStart, t), to = end.clone().lerp(upperEnd, t);
      const width = from.distanceTo(to), columns = Math.max(1, Math.ceil(width / (detail === 'low' ? 0.42 : 0.3))), step = width / columns;
      for (let col = 0; col < columns; col++) {
        const tile = mesh(new THREE.CylinderGeometry(step * 0.51, step * 0.44, length / rows + 0.035, 6, 1, true, 0, Math.PI), tiles[(row + col + spec.seed) % 3]);
        tile.geometry.rotateX(Math.PI / 2); tile.geometry.rotateZ(Math.PI / 2);
        tile.quaternion.setFromRotationMatrix(basis); tile.position.copy(from).lerp(to, (col + 0.5) / columns).addScaledVector(normal, 0.055); group.add(tile);
      }
    }
  }
  for (const [from, to] of [[a, l], [e, l], [b, r], [c, r], [l, r]]) {
    // Low detail lays each hip as one square capping instead of round tiles.
    if (detail === 'low') { group.add(ridgeBox(from.clone().add(p(0, 0.09, 0)), to.clone().add(p(0, 0.09, 0)), tiles[1])); continue; }
    const count = Math.ceil(from.distanceTo(to) / 0.43);
    for (let i = 0; i < count; i++) {
      const start = from.clone().lerp(to, i / count).add(p(0, 0.09, 0)), end = from.clone().lerp(to, (i + 1) / count).add(p(0, 0.09, 0));
      group.add(tube(start.toArray(), end.toArray(), 0.115, tiles[(i + 1) % 3]));
    }
  }
}
