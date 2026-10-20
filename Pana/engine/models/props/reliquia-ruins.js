// Enclosed ruin galleries for first-person play: stone slab floors, brick
// walls that follow the walkable outline and a rough ceiling, so a corridor
// or chamber never shows the sky. One InstancedMesh per part keeps a whole
// floor at a handful of draw calls; plain boxes keep it at a few hundred
// thousand triangles, and the dark gaps between them read as mortar.
//
//   ruinShell({ inside(x, z), ground(x, z), solid(x, z), bounds: [x0, z0, x1, z1], palette, height })
//
// `inside` says whether a point is walkable; `ground` gives its floor height
// (stair ramps slope); `solid` leaves out the slabs over a pit, and `open`
// leaves a wall out where the gallery meets the open air (a mine mouth);
// `sky` opens the ceiling (a shaft a rope hangs down). Walls stand just outside every walkable 1 m cell, so
// collision code can use the same outline. Glyph inlays glow softly.
import * as THREE from 'three';
import { rng } from '/engine/models/core/primitives.js';

export const RUIN_PALETTES = {
  // La mina del sol, one look per floor: warm sandstone, mossy jade, cursed rose.
  sol: { floor: 0xd8b27a, bricks: [0xe0a85c, 0xcf8f4a, 0xeabd78], band: 0x3fbfa0, ceiling: 0x6b4a33, glyph: 0x5fffd0 },
  jade: { floor: 0x9cc8a0, bricks: [0x6fae8e, 0x5d9a7c, 0x82bf9c], band: 0xe8b04a, ceiling: 0x34503f, glyph: 0xffd36a },
  maldita: { floor: 0xc9a0b8, bricks: [0xa7769a, 0x936486, 0xb98bab], band: 0xffc23d, ceiling: 0x3c2840, glyph: 0xff7adf },
};

function instanced(geometry, material, items, place) {
  const mesh = new THREE.InstancedMesh(geometry, material, Math.max(1, items.length)), m = new THREE.Object3D(), c = new THREE.Color();
  items.forEach((item, i) => { place(m, c, item); m.updateMatrix(); mesh.setMatrixAt(i, m.matrix); mesh.setColorAt(i, c); });
  mesh.count = items.length; mesh.instanceMatrix.needsUpdate = true; if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  mesh.castShadow = false; mesh.receiveShadow = true; mesh.computeBoundingSphere?.();
  return mesh;
}

export function ruinShell({ inside, ground = () => 0, solid = () => true, open = () => false, sky = () => false, tile = .95, bounds, palette = RUIN_PALETTES.sol, height = 4.6, seed = 7, roof = true } = {}) {
  const r = rng(seed), [x0, z0, x1, z1] = bounds.map(Math.floor);
  const cell = (i, j) => inside(i + .5, j + .5);
  const cells = [];
  for (let i = x0; i <= x1; i++) for (let j = z0; j <= z1; j++) if (cell(i, j)) cells.push([i, j]);
  const group = new THREE.Group(); group.name = 'Galería en ruinas';
  const owned = [];
  const mat = (extra) => { const m = new THREE.MeshStandardMaterial({ roughness: .9, ...extra }); owned.push(m); return m; };
  // Floor: 1 m slabs, slightly bevelled, tilted along ramps.
  const slab = new THREE.BoxGeometry(tile, .3, tile), floorColor = new THREE.Color(palette.floor);
  group.add(instanced(slab, mat({ roughness: .85 }), cells.filter(([i, j]) => solid(i + .5, j + .5)), (m, c, [i, j]) => {
    const x = i + .5, z = j + .5, y = ground(x, z), dx = ground(x + .5, z) - ground(x - .5, z), dz = ground(x, z + .5) - ground(x, z - .5);
    m.position.set(x, y - .15 - r() * .03, z); m.rotation.set(Math.atan(dz), 0, -Math.atan(dx)); m.scale.set(1, 1, 1);
    c.copy(floorColor).multiplyScalar(.82 + r() * .3);
  }));
  // Dark grout under the slabs, so a seam seen end-on is mortar, not a hole.
  const grout = new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2), groutColor = new THREE.Color(palette.floor).multiplyScalar(.5);
  group.add(instanced(grout, mat({ roughness: 1 }), cells.filter(([i, j]) => solid(i + .5, j + .5)), (m, c, [i, j]) => {
    const x = i + .5, z = j + .5, dx = ground(x + .5, z) - ground(x - .5, z), dz = ground(x, z + .5) - ground(x, z - .5);
    m.position.set(x, ground(x, z) - .1, z); m.rotation.set(Math.atan(dz), 0, -Math.atan(dx)); c.copy(groutColor);
  }));
  // Walls: brick courses on every edge between a walkable cell and the outside.
  const edges = [];
  for (const [i, j] of cells) for (const [di, dj] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) if (!cell(i + di, j + dj) && !open(i + di + .5, j + dj + .5)) edges.push({ i, j, di, dj, y: ground(i + .5, j + .5) });
  const course = .58, rows = Math.ceil(height / course), bricks = [], glyphs = [];
  for (const e of edges) for (let k = 0; k < rows; k++) {
    bricks.push({ e, k, band: k === rows - 2 });
    if (k === rows - 2 && r() < .28) glyphs.push(e);
  }
  const brick = new THREE.BoxGeometry(1.12, course * .9, .7), colors = palette.bricks.map(c => new THREE.Color(c)), band = new THREE.Color(palette.band);
  const at = (m, e, along = 0, depth = .35) => {
    const cx = e.i + .5 + e.di * (.5 + depth) + (e.dj ? along : 0), cz = e.j + .5 + e.dj * (.5 + depth) + (e.di ? along : 0);
    m.position.set(cx, 0, cz); m.rotation.set(0, e.di ? Math.PI / 2 : 0, 0);
  };
  group.add(instanced(brick, mat({ roughness: .92 }), bricks, (m, c, { e, k, band: isBand }) => {
    at(m, e, (k % 2 ? .25 : -.25) + (r() - .5) * .04, .35 + (r() - .5) * .06);
    m.position.y = e.y + course * (k + .5); m.scale.set(1, 1, 1 + (r() - .5) * .1);
    c.copy(isBand ? band : colors[Math.floor(r() * colors.length)]).multiplyScalar(isBand ? 1 : .85 + r() * .25);
  }));
  const glyph = new THREE.OctahedronGeometry(.16);
  group.add(instanced(glyph, mat({ color: 0xffffff, emissive: palette.glyph, emissiveIntensity: 1.2, roughness: .4 }), glyphs, (m, c, e) => {
    at(m, e, 0, -.02); m.position.y = e.y + course * (rows - 1.5); m.scale.set(1, 1, .35); c.set(palette.glyph);
  }));
  // Ceiling: 2 m rough slabs just above the wall tops.
  const roofCells = new Map();
  if (roof) for (const [i, j] of cells) { const key = `${Math.floor(i / 2)},${Math.floor(j / 2)}`; if (!roofCells.has(key)) roofCells.set(key, [Math.floor(i / 2) * 2, Math.floor(j / 2) * 2]); }
  const slabRoof = new THREE.BoxGeometry(2.2, .6, 2.2), ceiling = new THREE.Color(palette.ceiling);
  group.add(instanced(slabRoof, mat({ roughness: 1 }), [...roofCells.values()].filter(([i, j]) => !sky(i + 1, j + 1)), (m, c, [i, j]) => {
    m.position.set(i + 1, ground(i + 1, j + 1) + height + .3 - r() * .25, j + 1); m.rotation.set((r() - .5) * .1, r() * 3, (r() - .5) * .1);
    c.copy(ceiling).multiplyScalar(.8 + r() * .35);
  }));
  group.userData = { cells: cells.length, edges: edges.length, dispose() { [slab, grout, brick, glyph, slabRoof].forEach(g => g.dispose()); owned.forEach(m => m.dispose()); } };
  return group;
}

// Studio preview: a chamber, a corridor and a ramp down to a second chamber,
// without its ceiling so the camera can look in.
export function ruinGallery({ palette = 'sol', roof = false } = {}) {
  const rects = [[-6, -5, 6, 5], [-1.5, 5, 1.5, 12], [-5, 12, 5, 20]];
  const inside = (x, z) => rects.some(([a, b, c, d]) => x > a && x < c && z > b && z < d);
  const ground = (x, z) => z < 6 ? 0 : z > 11 ? -1.5 : -(z - 6) / 5 * 1.5;
  const group = ruinShell({ inside, ground, bounds: [-7, -6, 7, 21], palette: RUIN_PALETTES[palette] || RUIN_PALETTES.sol, roof });
  group.userData.previewBounds = [[-7, -2, -6], [7, 5.5, 21]];
  return group;
}
