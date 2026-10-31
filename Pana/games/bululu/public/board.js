// The board: a tropical island (landform in island.js, plants in
// flora.js, the world around it in scenery.js) with a looping path of tiles,
// the hill shortcut, the Mango de oro cart, the panas and the dice.

import * as THREE from 'three';
import { buildCharacter } from '/engine/models/characters/pana/avatar-model.js';
import { makeBubble } from '/engine/fx.js';
import { M, mesh, box, canvasMat } from '/engine/models/core/primitives.js';
import { makeMango } from '/engine/models/props/mango.js';
import { woodSign } from '/engine/models/props/wood-sign.js';
import { buildIsland, baseHeight, riverDist, landMask, beachMask, HILL } from './island.js';
import { bake } from '/engine/models/core/static-batch.js';
import { createIslandEnvironment, ISLAND_LOOP } from '/engine/worlds/island-environment.js';
import { createAtmosphere } from './atmosphere.js';
import { createHarborBoard } from './harbor-board.js';
import { configuredTileKind } from './options.js';

export const TILE_COUNT = 80;        // the coastal loop; the shortcut's tiles come after
// the Atajo del cerro: leaves the loop near `start`, climbs over the hill
// right under the big tree and rejoins it near `end`, up by the mountain.
// from/to (tile indices) get filled in when the board is built.
export const FORK = {
  toll: 5,
  start: [-92, 48], end: [24, -36],
  via: [[-65, 44], [-38, 25], [-18, 10], [-4.5, -2.5], [1, -14], [8, -26]],
  kinds: ['red', 'event', 'blue', 'event', 'red', 'blue'],
};
const TILE = 3.3;

// tile kinds: blue +3, red -3, '?' random event
function tileKind(i) {
  if (i === 0) return 'start';
  if (i % 5 === 3) return 'event';
  if (i % 6 === 5) return 'red';
  return 'blue';
}

// ---------- canvas art ----------
function coin(g, x, y, r) {
  g.fillStyle = '#ffc629';
  g.strokeStyle = '#9a6400';
  g.lineWidth = r * 0.22;
  g.beginPath();
  g.arc(x, y, r, 0, Math.PI * 2);
  g.fill();
  g.stroke();
  g.fillStyle = '#ffe58a';
  g.beginPath();
  g.arc(x - r * 0.25, y - r * 0.25, r * 0.35, 0, Math.PI * 2);
  g.fill();
}

const TILE_ART = {
  blue: { fill: '#3d7bf2', edge: '#2453b8', text: '+3', coin: true },
  red: { fill: '#ff4b4b', edge: '#b5121b', text: '-3', coin: true },
  event: { fill: '#ffd23f', edge: '#c48b00', text: '?', coin: false },
  start: { fill: '#2ad1b2', edge: '#14806c', text: 'SALIDA', coin: false },   // i18n-ignore: painted on the tile
  tree: { fill: '#8e4de8', edge: '#5a2aa8', text: 'ÁRBOL', coin: false },   // i18n-ignore: painted on the tile
};

const tileMats = {};
function tileTop(kind) {
  if (tileMats[kind]) return tileMats[kind];
  const art = TILE_ART[kind];
  tileMats[kind] = canvasMat(256, 256, (g) => {
    g.fillStyle = art.edge;
    g.fillRect(0, 0, 256, 256);
    g.fillStyle = art.fill;
    g.beginPath();
    g.roundRect(14, 14, 228, 228, 30);
    g.fill();
    g.fillStyle = 'rgba(255,255,255,0.18)';
    g.beginPath();
    g.roundRect(26, 24, 204, 70, 24);
    g.fill();
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.lineWidth = 12;
    g.strokeStyle = '#16161a';
    g.fillStyle = kind === 'event' ? '#16161a' : '#ffffff';
    if (kind === 'tree') {
      // a golden mango and the word, for the shake-the-tree tile
      g.save();
      g.translate(128, 112);
      g.rotate(-0.4);
      g.fillStyle = '#ffc629';
      g.strokeStyle = '#9a6400';
      g.lineWidth = 8;
      g.beginPath();
      g.ellipse(0, 0, 46, 60, 0, 0, Math.PI * 2);
      g.fill();
      g.stroke();
      g.fillStyle = '#3a9d3a';
      g.beginPath();
      g.ellipse(26, -62, 26, 11, -0.5, 0, Math.PI * 2);
      g.fill();
      g.restore();
      g.font = '50px "Luckiest Guy", system-ui, sans-serif';
      g.lineWidth = 10;
      g.strokeText(art.text, 128, 210);
      g.fillText(art.text, 128, 210);
    } else if (art.coin) {
      coin(g, 78, 130, 40);
      g.font = '104px "Luckiest Guy", system-ui, sans-serif';
      g.strokeText(art.text, 168, 138);
      g.fillText(art.text, 168, 138);
    } else {
      const size = art.text.length > 2 ? 58 : 170;
      g.font = `${size}px "Luckiest Guy", system-ui, sans-serif`;
      if (kind !== 'event') g.strokeText(art.text, 128, 140);
      g.fillText(art.text, 128, 140);
    }
  });
  tileMats[kind].transparent = false;
  return tileMats[kind];
}

// a P1..P4 pin that floats over each pana
function pinSprite(label, color) {
  const c = document.createElement('canvas');
  c.width = 128; c.height = 140;
  const g = c.getContext('2d');
  g.fillStyle = color;
  g.strokeStyle = '#ffffff';
  g.lineWidth = 8;
  g.beginPath();
  g.arc(64, 58, 50, 0, Math.PI * 2);
  g.moveTo(40, 98); g.lineTo(64, 134); g.lineTo(88, 98);
  g.fill();
  g.stroke();
  g.fillStyle = color;
  g.fillRect(44, 88, 40, 16);
  g.fillStyle = '#ffffff';
  g.font = '54px "Luckiest Guy", system-ui, sans-serif';
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.lineWidth = 6;
  g.strokeStyle = '#16161a';
  g.strokeText(label, 64, 62);
  g.fillText(label, 64, 62);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, depthTest: false }));
  s.scale.set(0.95, 1.04, 1);
  s.renderOrder = 9;
  return s;
}

// ---------- the die ----------
const PIPS = {
  1: [[0, 0]], 2: [[-1, -1], [1, 1]], 3: [[-1, -1], [0, 0], [1, 1]],
  4: [[-1, -1], [1, -1], [-1, 1], [1, 1]], 5: [[-1, -1], [1, -1], [0, 0], [-1, 1], [1, 1]],
  6: [[-1, -1], [1, -1], [-1, 0], [1, 0], [-1, 1], [1, 1]],
};
const faceMats = {};
function dieFace(n) {
  faceMats[n] ||= canvasMat(128, 128, (g) => {
    g.fillStyle = '#c9c2b8';
    g.fillRect(0, 0, 128, 128);
    g.fillStyle = '#fbf8f2';
    g.beginPath();
    g.roundRect(6, 6, 116, 116, 22);
    g.fill();
    g.fillStyle = n === 1 ? '#e63946' : '#16161a';
    for (const [x, y] of PIPS[n]) {
      g.beginPath();
      g.arc(64 + x * 32, 64 + y * 32, n === 1 ? 17 : 12, 0, Math.PI * 2);
      g.fill();
    }
  });
  faceMats[n].transparent = false;
  return faceMats[n];
}

export function createDie() {
  const mats = [1, 6, 2, 5, 3, 4].map(dieFace);   // +x -x +y -y +z -z
  const m = new THREE.Mesh(new THREE.BoxGeometry(1.4, 1.4, 1.4), mats);
  m.castShadow = true;
  const die = {
    mesh: m,
    rolling: false,
    show(n) { mats[4] = dieFace(n); m.material = mats; },
    spin(dt) {
      m.rotation.x += dt * 9.1;
      m.rotation.y += dt * 7.3;
      m.rotation.z += dt * 5.2;
      if (Math.random() < dt * 12) die.show(1 + Math.floor(Math.random() * 6));
    },
  };
  return die;
}

// ---------- the Mango de oro stand: a cart that moves around ----------
function stripes(colors, n = 8) {
  return canvasMat(256, 32, (c) => {
    for (let i = 0; i < n; i++) {
      c.fillStyle = colors[i % colors.length];
      c.fillRect((i / n) * 256, 0, 256 / n + 1, 32);
    }
  });
}

function buildStand() {
  const g = new THREE.Group();
  const wood = M(0x8a5a33, { roughness: 0.9 });
  const dark = M(0x5c3a20, { roughness: 0.9 });

  // cart: counter on two big wheels, a handle out back
  g.add(box(3.6, 1.1, 1.7, wood, 0, 1.05, 0));
  g.add(box(3.8, 0.16, 1.9, dark, 0, 1.68, 0));
  for (const x of [-1.5, 1.5]) {
    const wheel = mesh(new THREE.CylinderGeometry(0.62, 0.62, 0.22, 12), dark, x, 0.62, 0.95);
    wheel.rotation.x = Math.PI / 2;
    g.add(wheel);
    const hub = mesh(new THREE.CylinderGeometry(0.2, 0.2, 0.26, 8), M(0xffc629), x, 0.62, 0.95);
    hub.rotation.x = Math.PI / 2;
    g.add(hub);
  }
  const pole = mesh(new THREE.CylinderGeometry(0.07, 0.07, 3.4, 6), dark, 0, 3, -0.3);
  g.add(pole);
  const umbrellaMat = stripes(['#ff4b4b', '#fdf6e3', '#ffc629', '#fdf6e3']);
  umbrellaMat.side = THREE.DoubleSide;
  umbrellaMat.transparent = false;
  const umbrella = mesh(new THREE.ConeGeometry(2.7, 1.1, 8, 1, true), umbrellaMat, 0, 4.55, -0.3);
  g.add(umbrella);

  const sign = mesh(new THREE.BoxGeometry(3.2, 1.4, 0.15), canvasMat(384, 170, (c) => {
    c.fillStyle = '#7a4a2b';
    c.fillRect(0, 0, 384, 170);
    c.strokeStyle = '#4a2c17';
    c.lineWidth = 8;
    c.strokeRect(4, 4, 376, 162);
    c.textAlign = 'center';
    c.textBaseline = 'middle';
    c.fillStyle = '#fdf6e3';
    c.font = '54px "Luckiest Guy", system-ui, sans-serif';
    c.fillText('MANGO DE ORO', 192, 50);
    c.fillStyle = '#16161a';
    c.beginPath();
    c.roundRect(112, 88, 160, 66, 18);
    c.fill();
    coin(c, 152, 121, 22);
    c.fillStyle = '#ffd23f';
    c.font = '58px "Luckiest Guy", system-ui, sans-serif';
    c.fillText('20', 214, 126);
  }), 0, 0.95, 0.9);
  g.add(sign);

  // crates of golden mangos on the counter
  for (const x of [-1.2, 1.2]) {
    g.add(box(1, 0.36, 0.8, dark, x, 1.92, 0.15));
    for (let i = 0; i < 3; i++) {
      const mg = makeMango({ gold: true });
      mg.scale.setScalar(0.32);
      mg.position.set(x - 0.28 + i * 0.28, 2.2, 0.15 + (i % 2) * 0.1);
      mg.rotation.y = i;
      g.add(mg);
    }
  }

  // the shopkeeper
  const keeper = buildCharacter({ fur: '#c47f42', hat: 'pesca', hatColor: '#e8c27a', glasses: 'sol', outfit: 'hawaiana', outfitColor: '#2ad1b2', face: 'feliz' });
  keeper.group.position.set(0, 0, -1.2);
  keeper.group.scale.setScalar(1.15);
  g.add(keeper.group);

  // chalkboard joke
  const chalk = new THREE.Group();
  chalk.add(mesh(new THREE.BoxGeometry(1.7, 1.3, 0.1), canvasMat(256, 200, (c) => {
    c.fillStyle = '#5c3a20';
    c.fillRect(0, 0, 256, 200);
    c.fillStyle = '#26322b';
    c.fillRect(12, 12, 232, 176);
    c.fillStyle = '#f3e9d7';
    c.textAlign = 'center';
    c.font = '30px "Luckiest Guy", system-ui, sans-serif';
    ['EL MANGO HACE', 'TODO MÁS', 'BONITO'].forEach((t, i) => c.fillText(t, 128, 66 + i * 40));   // i18n-ignore: a chalkboard sign
  }), 0, 0.95, 0));
  chalk.add(box(0.08, 0.8, 0.08, dark, -0.6, 0.3, -0.1));
  chalk.add(box(0.08, 0.8, 0.08, dark, 0.6, 0.3, -0.1));
  chalk.position.set(2.7, 0, 0.9);
  chalk.rotation.y = -0.35;
  g.add(chalk);

  // a column of golden light so you can spot the cart from anywhere
  // (it fades out toward the top so it never walls off the view)
  const fade = document.createElement('canvas');
  fade.width = 4; fade.height = 128;
  const fg = fade.getContext('2d');
  const grad = fg.createLinearGradient(0, 0, 0, 128);
  grad.addColorStop(0, 'rgba(255,255,255,0)');
  grad.addColorStop(1, 'rgba(255,255,255,1)');
  fg.fillStyle = grad;
  fg.fillRect(0, 0, 4, 128);
  const beam = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 1.1, 16, 16, 1, true), new THREE.MeshBasicMaterial({
    color: 0xffd23f, alphaMap: new THREE.CanvasTexture(fade), transparent: true, opacity: 0.5,
    blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, fog: false,
  }));
  beam.position.y = 8;
  g.add(beam);
  const sparkles = new THREE.Group();
  const sparkMat = new THREE.MeshBasicMaterial({ color: 0xffe58a, blending: THREE.AdditiveBlending, transparent: true, depthWrite: false });
  for (let i = 0; i < 14; i++) {
    const s = new THREE.Mesh(new THREE.OctahedronGeometry(0.16, 0), sparkMat);
    s.userData = { a: (i / 14) * Math.PI * 2, y: 1 + (i % 7) * 1.6, r: 1.4 + (i % 3) * 0.4 };
    sparkles.add(s);
  }
  g.add(sparkles);
  const glow = new THREE.PointLight(0xffc04a, 30, 14, 1.6);
  glow.position.set(0, 3.2, 1.2);
  g.add(glow);

  const bubble = makeBubble();
  bubble.sprite.position.set(0, 5.6, 0);
  g.add(bubble.sprite);
  return { group: g, keeper, bubble, beam, sparkles, umbrella };
}

// ---------- the island ----------
export function createBoard(scene, { skyMode = 'day' } = {}) {
  // ---- the path follows the land ----
  // Start on the beach, follow the western river into the jungle, pass the
  // tepui foothills, then return through the fishing harbor and coconut bay.
  const ctrl = ISLAND_LOOP
    .map(([x, z]) => new THREE.Vector3(x, 0, z));
  const curve = new THREE.CatmullRomCurve3(ctrl, true, 'centripetal');
  const spaced = curve.getSpacedPoints(TILE_COUNT);
  const tiles = [];
  for (let i = 0; i < TILE_COUNT; i++) {
    const p = spaced[i];
    const t = curve.getTangentAt(i / TILE_COUNT);
    let inX = -t.z, inZ = t.x;
    if (inX * (HILL.x - p.x) + inZ * (HILL.z - p.z) < 0) { inX = -inX; inZ = -inZ; }
    const ground = baseHeight(p.x, p.z);
    tiles.push({ i, kind: tileKind(i), x: p.x, z: p.z, inX, inZ, ground, y: ground + 0.6, beach: beachMask(p.x, p.z) > 0.65, bridge: riverDist(p.x, p.z) < 3.4, next: [(i + 1) % TILE_COUNT] });
  }
  // the shortcut: from the front-left shore over the hill (right under the big
  // tree) to the back of the loop; tiles spaced evenly along it
  const nearest = (x, z) => tiles.reduce((b, t) => (Math.hypot(t.x - x, t.z - z) < Math.hypot(b.x - x, b.z - z) ? t : b));
  const a0 = nearest(...FORK.start), a1 = nearest(...FORK.end);
  FORK.from = a0.i;
  FORK.to = a1.i;
  const forkCurve = new THREE.CatmullRomCurve3([[a0.x, a0.z], ...FORK.via, [a1.x, a1.z]].map(([x, z]) => new THREE.Vector3(x, 0, z)), false, 'centripetal');
  const n = Math.round(forkCurve.getLength() / (curve.getLength() / TILE_COUNT));
  const forkPts = forkCurve.getSpacedPoints(n);
  let treeTile = null;
  for (let k = 1; k < n; k++) {
    const p = forkPts[k];
    const i = tiles.length;
    const ground = baseHeight(p.x, p.z);
    const t = { i, kind: FORK.kinds[(k - 1) % FORK.kinds.length], x: p.x, z: p.z, inX: HILL.x - p.x, inZ: HILL.z - p.z, ground, y: ground + 0.6, bridge: riverDist(p.x, p.z) < 3.4, next: [i + 1], fork: true };
    if (!treeTile || Math.hypot(p.x - HILL.x, p.z - HILL.z) < Math.hypot(treeTile.x - HILL.x, treeTile.z - HILL.z)) treeTile = t;
    tiles.push(t);
  }
  treeTile.kind = 'tree';
  tiles[tiles.length - 1].next = [FORK.to];
  FORK.first = TILE_COUNT;
  tiles[FORK.from].next.push(FORK.first);
  const edges = tiles.flatMap((t) => t.next.map((i) => [t, tiles[i]]));
  const island = buildIsland(tiles, edges);
  scene.add(island.group);
  const groundAt = island.groundAt;

  // static stuff collects here and gets merged into a few meshes at the end
  const statics = new THREE.Group();
  const stone = M(0x9a8f86, { roughness: 1 });
  const stoneDark = M(0x7a7068, { roughness: 1 });
  const dirt = M(0xd9b77a, { roughness: 1 });
  const plank = M(0x9a6539, { roughness: 0.9 });
  const post = M(0x5c3a20, { roughness: 0.9 });
  for (const t of tiles) {
    const top = tileTop(t.kind);
    const m = new THREE.Mesh(new THREE.BoxGeometry(TILE, 0.4, TILE), [stoneDark, stoneDark, top, stoneDark, stoneDark, stoneDark]);
    m.position.set(t.x, t.y - 0.2, t.z);   // text reads from the front, where the camera is
    m.receiveShadow = true;
    m.castShadow = true;
    scene.add(m);
    t.mesh = m;
    // a stone slab under each tile, like the art
    statics.add(mesh(new THREE.BoxGeometry(TILE + 0.5, 0.45, TILE + 0.5), t.beach ? plank : stone, t.x, t.y - 0.5, t.z));
    if (t.bridge) {
      // stilts down into the river, and a little rail
      const floor = groundAt(t.x, t.z);
      const h = t.y - 0.7 - (floor - 0.6);
      for (const [sx, sz] of [[1, 1], [1, -1], [-1, 1], [-1, -1]]) {
        statics.add(mesh(new THREE.CylinderGeometry(0.16, 0.18, h, 6), post, t.x + sx * 1.7, floor - 0.6 + h / 2, t.z + sz * 1.7));
        statics.add(box(0.14, 0.9, 0.14, post, t.x + sx * 1.85, t.y + 0.25, t.z + sz * 1.85));
      }
    }
  }

  // the bits of road between tiles: dirt, stone steps when it climbs, planks over water
  for (const [a, b] of edges) {
    const dx = b.x - a.x, dz = b.z - a.z, L = Math.hypot(dx, dz);
    const ux = dx / L, uz = dz / L;
    const x0 = a.x + ux * TILE / 2, z0 = a.z + uz * TILE / 2;
    const gap = L - TILE;
    const yaw = Math.atan2(dx, dz);
    const dy = b.y - a.y;
    const overWater = a.bridge || b.bridge;
    if (a.beach && b.beach && Math.abs(dy) < 0.6) {
      const boards = Math.ceil(gap / 0.55);
      for (let k = 0; k < boards; k++) {
        const f = (k + 0.5) / boards;
        const board = box(2.65, 0.18, gap / boards - 0.035, plank, x0 + ux * gap * f, a.y + dy * f - 0.15, z0 + uz * gap * f);
        board.rotation.y = yaw; statics.add(board);
      }
      continue;
    }
    const steps = Math.abs(dy) > 0.3 && !overWater ? Math.max(2, Math.round(Math.abs(dy) / 0.28)) : 1;
    for (let k = 0; k < steps; k++) {
      const f = (k + 0.5) / steps;
      const topY = steps === 1 ? (a.y + b.y) / 2 - 0.08 : a.y + dy * f - 0.05;
      const bottom = steps === 1 ? topY - 0.25 : Math.min(a.y, b.y) - 0.8;
      const s = mesh(new THREE.BoxGeometry(2.2, topY - bottom, gap / steps + (steps === 1 ? 0.6 : 0.02)), overWater ? plank : steps > 1 ? stone : dirt,
        x0 + ux * gap * f, (topY + bottom) / 2, z0 + uz * gap * f);
      s.rotation.y = yaw;
      if (steps === 1 && !overWater) s.rotation.x = -Math.atan2(dy, L);
      statics.add(s);
    }
  }

  const pathDist = (x, z) => Math.min(...tiles.map(t => Math.hypot(t.x - x, t.z - z)));
  const environment = createIslandEnvironment(scene, { island, pathDist,
    inShot: (x, z) => tiles.some(t => z > t.z - 2 && z - t.z < 26 && Math.abs(x - t.x) < 9),
  });
  const atmosphere = createAtmosphere(scene, environment.sea.material, skyMode);
  const decor = environment.decor;
  const fs = tiles[FORK.first];
  const shortcutSign = woodSign(['ATAJO', 'DEL CERRO', `PEAJE ${FORK.toll}`], { w: 3.4, h: 2.6 });
  shortcutSign.position.set(fs.x + 5, groundAt(fs.x + 5, fs.z + 3.5), fs.z + 3.5);
  shortcutSign.rotation.y = 0.15;
  const roads = bake(statics);
  scene.add(shortcutSign, roads);
  decor.push({ x: shortcutSign.position.x, z: shortcutSign.position.z, obj: shortcutSign });

  // ---- stand ----
  const stand = buildStand();
  scene.add(stand.group);
  const islandTiles = [...tiles];
  for (const tile of tiles) tile.baseKind = tile.kind;
  let harbor = null;
  const board = {
    mode: 'isla', mainCount: TILE_COUNT,
    configure(options) {
      if (options.board === 'muelle' && !harbor) harbor = createHarborBoard(scene, tileTop, groundAt);
      board.mode = options.board;
      const onIsland = options.board === 'isla';
      for (const tile of islandTiles) tile.mesh.visible = onIsland;
      roads.visible = shortcutSign.visible = onIsland;
      if (harbor) harbor.group.visible = !onIsland;
      tiles.splice(0, tiles.length, ...(onIsland ? islandTiles : harbor.tiles));
      board.mainCount = onIsland ? TILE_COUNT : harbor.tiles.length;
      for (const tile of tiles) {
        tile.kind = configuredTileKind(tile.i, tile.baseKind, options.surprises);
        tile.mesh.material[2] = tileTop(tile.kind);
      }
    },
    tiles, curve, stand, standTile: 0, groundAt, highlight: [], atmosphere,
    // beside tile i, on whichever side is further from the camera (so the
    // tile doesn't hide it), and never in the river or on another tile
    standSpot(i) {
      const t = tiles[i];
      if (board.mode === 'muelle') {
        const length = Math.hypot(t.inX, t.inZ);
        const x = t.x + t.inX / length * 4.6, z = t.z + t.inZ / length * 4.6;
        return { x, y: harbor.deck, z, h: Math.atan2(t.x - x, t.z - z), bad: 0 };
      }
      const l = Math.hypot(t.inX, t.inZ) || 1;
      let best = null;
      for (const side of [1, -1]) {
        const x = t.x + t.inX / l * 5.4 * side, z = t.z + t.inZ / l * 5.4 * side;
        const bad = (riverDist(x, z) < 3.8 ? 100 : 0) + (pathDist(x, z) < 4.5 ? 100 : 0) + (landMask(x, z) < 0.8 ? 100 : 0)
          + (Math.hypot(x - HILL.x, z - HILL.z) < 9 ? 100 : 0) + decor.filter((d) => Math.hypot(d.x - x, d.z - z) < 3.6).length * 30;
        const score = z + bad;
        if (!best || score < best.score) best = { x, z, score, bad };
      }
      return { x: best.x, y: groundAt(best.x, best.z), z: best.z, h: Math.atan2(t.x - best.x, t.z - best.z), bad: best.bad };
    },
    setStand(i) {
      board.standTile = i;
      const s = board.standSpot(i);
      stand.group.position.set(s.x, s.y, s.z);
      stand.group.rotation.y = s.h;
    },
    pressTile(i) {
      const tl = tiles[i];
      if (tl) tl.pressT = 0.36;
    },
    // a spot on a tile for pana number `slot`, so several fit together
    spot(i, slot, crowd) {
      const t = tiles[i];
      if (crowd <= 1) return { x: t.x, y: t.y, z: t.z };
      const a = (slot / crowd) * Math.PI * 2 + Math.PI / 4;
      return { x: t.x + Math.cos(a) * (crowd > 4 ? 1.2 : .85), y: t.y, z: t.z + Math.sin(a) * (crowd > 4 ? 1.2 : .85) };
    },
    // fade the big tree while it stands between the camera and any of `spots`
    seeThrough: environment.seeThrough,
    // keep the sun/moon's shadow box centered on what the camera looks at
    follow(target) {
      atmosphere.follow(target);
    },
    // for the minimap
    pathDist, groundAt, landMask,
    update(t, dt) {
      atmosphere.update(dt,t);
      environment.update(t, dt, atmosphere.daylight);
      // tiles you can pick at a fork bob up and down; stepped-on tiles squash and bounce
      for (const tl of tiles) {
        let pressY = 0;
        if (tl.pressT > 0) {
          tl.pressT = Math.max(0, tl.pressT - dt);
          const u = 1 - tl.pressT / 0.36;
          const depress = Math.sin(u * Math.PI * 1.35) * (1 - u);
          pressY = -depress * 0.14;
          const sy = Math.max(0.68, 1 - depress * 0.28);
          const sxz = 1 + (1 - sy) * 0.45;
          tl.mesh.scale.set(sxz, sy, sxz);
        } else {
          tl.mesh.scale.set(1, 1, 1);
        }
        tl.mesh.position.y = tl.y - 0.2 + pressY + (board.highlight.includes(tl.i) ? 0.25 + Math.sin(t * 7) * 0.2 : 0);
      }
      stand.keeper.update(dt, { look: Math.sin(t * 0.7) });
      stand.bubble.update(dt);
      stand.beam.material.opacity = 0.22 + Math.sin(t * 3) * 0.06;
      stand.umbrella.rotation.y = Math.sin(t * 0.8) * 0.08;
      for (const s of stand.sparkles.children) {
        const u = s.userData;
        const a = u.a + t * 1.2;
        s.position.set(Math.cos(a) * u.r, u.y + ((t * 0.8 + u.y) % 6), Math.sin(a) * u.r);
        s.rotation.y = t * 3;
      }
    },
  };
  board.follow(new THREE.Vector3());
  return board;
}

// ---------- a pana on its pedestal ----------
export function createToken(player, index) {
  const g = new THREE.Group();
  const base = new THREE.Mesh(new THREE.CylinderGeometry(0.95, 1.05, 0.32, 20), M(player.color, { roughness: 0.5 }));
  base.position.y = 0.16;
  base.castShadow = true;
  base.receiveShadow = true;
  const rim = new THREE.Mesh(new THREE.TorusGeometry(0.95, 0.07, 6, 24), M('#ffffff', { roughness: 0.4 }));
  rim.rotation.x = Math.PI / 2;
  rim.position.y = 0.32;
  g.add(base, rim);
  const pana = buildCharacter(player.avatar);
  pana.group.position.y = 0.32;
  g.add(pana.group);
  const pin = pinSprite(`P${index + 1}`, player.color);
  pin.position.y = 3.3;
  g.add(pin);
  const bubble = makeBubble();
  bubble.sprite.position.y = 4.4;
  g.add(bubble.sprite);
  return { group: g, pana, pin, bubble };
}
