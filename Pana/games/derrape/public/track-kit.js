// Shared building blocks for Derrape's tracks: fences, signs, bridges, water,
// rocks, vegetation and critters. Same toy style as car-kit.js: flat-shaded
// low-poly geometry and canvas textures, no asset files.
// Props sit on y = 0 and face +Z unless they take an explicit transform.
// Anything with userData.tick(t, dt) gets collected by makeTrack and
// animated during the race. Generic props live in /engine/props.js;
// all trees and leafy plants use the current /engine/flora.js builders.

import * as THREE from 'three';
import { M, mesh, box, tube, canvasMat } from './car-kit.js';
import { rng, woodSign as mapSign, watchtower, flagPole, rock } from '/engine/props.js';
import * as flora from '/engine/flora.js';
import { waterPool,riverSurface } from '/engine/water-surface.js';

// Use the canonical foliage and batch its many leaflets before placement.
// Cloning the source geometry in bake keeps shared assets safe on map switches.
const { bake } = flora;
const palm = options => bake(flora.palm(options));
const mangoTree = options => bake(flora.mangoTree(options));
const ceiba = options => bake(flora.ceiba(options));
const pine = options => bake(flora.pine(options));
const banana = options => bake(flora.banana(options));
const bush = options => bake(flora.bush(options));

// ---------- placement helpers ----------
// A point on the track plus the heading along it. Positive off is the
// (-tz, tx) side — same convention as items.js.
function placeOnTrack(T, s, off = 0) {
  const p = T.pointAt(s), p2 = T.pointAt(s + 0.5);
  const tx = p2.x - p.x, tz = p2.y - p.y, l = Math.hypot(tx, tz) || 1;
  return { x: p.x - tz / l * off, y: T.heightAtS(s), z: p.y + tx / l * off, h: Math.atan2(tx, tz) };
}

// Random spots beside the track, clear of the asphalt corridor.
function scatter(T, { seed = 1, count, min = T.HW + 4, max = T.HW + 30, sides = [1, -1], avoid = [] }) {
  const r = rng(seed);
  const out = [];
  let guard = count * 30;
  while (out.length < count && guard-- > 0) {
    const s = r() * T.TOTAL;
    const side = sides[Math.floor(r() * sides.length)];
    const off = side * (min + r() * (max - min));
    const p = placeOnTrack(T, s, off);
    if (Math.abs(T.offsetOf(p.x, p.z)) < T.HW + 2.5) continue;   // never on the road
    if (avoid.some((a) => Math.hypot(p.x - a.x, p.z - a.z) < a.r)) continue;
    out.push({ ...p, y: T.terrainAt(p.x, p.z), s, rot: r() * Math.PI * 2, k: r() });
  }
  return out;
}

function at(group, obj, p, rotY = null) {
  obj.position.set(p.x, p.y ?? group.userData.groundAt?.(p.x, p.z) ?? 0, p.z);
  obj.rotation.y = rotY ?? p.h ?? 0;
  group.add(obj);
  return obj;
}

// ---------- track furniture ----------
// Stacked tire walls along both edges, alternating red and white.
function tireWall(group, T, { step = 1.32 } = {}) {
  const spots = [];
  for (const side of [1, -1]) {
    const off = side * (T.HW + 0.8);
    let acc = 0, prev = null, n = 0;
    for (let s = 0; s < T.TOTAL; s += 0.4) {
      const p = placeOnTrack(T, s, off);
      if (prev) acc += Math.hypot(p.x - prev.x, p.z - prev.z);
      prev = p;
      if (acc < step) continue;
      acc = 0;
      spots.push([p.x, p.y, p.z, n++]);
    }
  }
  const tireGeo = new THREE.CylinderGeometry(0.66, 0.66, 0.52, 9);
  const holeGeo = new THREE.CylinderGeometry(0.3, 0.3, 0.54, 9);
  const red = new THREE.InstancedMesh(tireGeo, M(0xe63946, { roughness: 0.8 }), spots.length);
  const white = new THREE.InstancedMesh(tireGeo, M(0xf6f1e4, { roughness: 0.8 }), spots.length);
  const holes = new THREE.InstancedMesh(holeGeo, M(0x1c1c22), spots.length * 2);
  spots.forEach(([x, y, z, n], i) => {
    const low = new THREE.Matrix4().makeTranslation(x, y + 0.26, z);
    const top = new THREE.Matrix4().makeTranslation(x, y + 0.78, z);
    const lowRed = n % 2 === 0;
    red.setMatrixAt(i, lowRed ? low : top);
    white.setMatrixAt(i, lowRed ? top : low);
    holes.setMatrixAt(i * 2, low);
    holes.setMatrixAt(i * 2 + 1, top);
  });
  for (const im of [red, white, holes]) {
    im.castShadow = true;
    im.receiveShadow = true;
    group.add(im);
  }
}

// Wooden fence: posts + two rails, marching along both sides of the track.
function fenceRing(group, T, { off = T.HW + 3, every = 4.4, skip = [] } = {}) {
  const posts = [];
  const rails = [];
  for (const side of [1, -1]) {
    const o = side * off;
    let last = null;
    for (let s = 0; s <= T.TOTAL; s += 0.5) {
      const sw = s % T.TOTAL;
      if (skip.some(([a, b]) => sw > a && sw < b)) { last = null; continue; }
      const p = placeOnTrack(T, s, o);
      if (!last) { posts.push(p); last = p; continue; }
      if (Math.hypot(p.x - last.x, p.z - last.z) >= every) {
        rails.push([last, p]);
        posts.push(p);
        last = p;
      }
    }
  }
  const postGeo = new THREE.BoxGeometry(0.22, 1.15, 0.22);
  const postIM = new THREE.InstancedMesh(postGeo, M(0x8a5a33, { roughness: 0.9 }), posts.length);
  posts.forEach((p, i) => postIM.setMatrixAt(i, new THREE.Matrix4().makeTranslation(p.x, p.y + 0.55, p.z)));
  postIM.castShadow = true;
  postIM.receiveShadow = true;
  group.add(postIM);

  const railGeo = new THREE.BoxGeometry(1, 0.12, 0.09);
  const railIM = new THREE.InstancedMesh(railGeo, M(0xa06a3d, { roughness: 0.9 }), rails.length * 2);
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), sc = new THREE.Vector3();
  rails.forEach(([a, b], i) => {
    const len = Math.hypot(b.x - a.x, b.z - a.z);
    const ang = Math.atan2(b.x - a.x, b.z - a.z);
    q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), ang - Math.PI / 2);
    for (const [j, y] of [0.55, 0.92].entries()) {
      sc.set(len, 1, 1);
      m4.compose(new THREE.Vector3((a.x + b.x) / 2, (a.y + b.y) / 2 + y, (a.z + b.z) / 2), q, sc);
      railIM.setMatrixAt(i * 2 + j, m4);
    }
  });
  railIM.castShadow = true;
  group.add(railIM);
}

// Yellow/black chevron boards on the outside of bends, facing the driver.
function chevrons(group, T, { minCurve = 0.017 } = {}) {
  const N = Math.round(T.TOTAL / 2);
  const heads = [];
  for (let i = 0; i < N; i++) {
    const s = (i / N) * T.TOTAL;
    heads.push(placeOnTrack(T, s, 0).h);
  }
  // group consecutive samples with high curvature into bends
  const bends = [];
  let run = null;
  for (let i = 0; i < N; i++) {
    const h0 = heads[i], h1 = heads[(i + 1) % N];
    let d = h1 - h0;
    d = Math.atan2(Math.sin(d), Math.cos(d));
    const k = d / (T.TOTAL / N);
    if (Math.abs(k) > minCurve) {
      if (!run) run = { s0: (i / N) * T.TOTAL, k };
      run.k = run.k * 0.9 + k * 0.1;
    } else if (run) {
      bends.push(run);
      run = null;
    }
  }
  if (run) bends.push(run);
  const texCache = new Map();
  const board = (dir) => {
    if (!texCache.has(dir)) {
      texCache.set(dir, canvasMat(192, 96, (g) => {
        g.fillStyle = '#ffd23f';
        g.fillRect(0, 0, 192, 96);
        g.fillStyle = '#16161a';
        for (const x of [8, 68, 128]) {
          g.beginPath();
          const s = dir;
          g.moveTo(x + 44 * (s < 0 ? 1 : 0), 12);
          g.lineTo(x + 44 * (s < 0 ? 0 : 1), 48);
          g.lineTo(x + 44 * (s < 0 ? 1 : 0), 84);
          g.lineTo(x + 24 + 44 * (s < 0 ? 1 : 0), 84);
          g.lineTo(x + 24 + 44 * (s < 0 ? 0 : 1), 48);
          g.lineTo(x + 24 + 44 * (s < 0 ? 1 : 0), 12);
          g.fill();
        }
      }));
    }
    const g = new THREE.Group();
    g.add(box(0.14, 1.5, 0.14, M(0x3a3a44), -0.9, 0.75, 0));
    g.add(box(0.14, 1.5, 0.14, M(0x3a3a44), 0.9, 0.75, 0));
    const b = mesh(new THREE.BoxGeometry(2.6, 1.15, 0.1), texCache.get(dir), 0, 1.9, 0);
    g.add(b);
    return g;
  };
  for (const bend of bends.slice(0, 10)) {
    const dir = bend.k > 0 ? 1 : -1;   // turn direction = where the arrows point
    const outside = dir > 0 ? -(T.HW + 2.6) : T.HW + 2.6;
    for (let j = 0; j < 3; j++) {
      const p = placeOnTrack(T, bend.s0 - 10 + j * 4.5, outside);
      at(group, board(dir), p, p.h + Math.PI);
    }
  }
}

// Checkered start/finish line across the track.
function startLine(group, T) {
  const c = document.createElement('canvas');
  c.width = 16; c.height = 144;
  const g = c.getContext('2d');
  for (let y = 0; y < 18; y++) for (let x = 0; x < 2; x++) {
    g.fillStyle = (x + y) % 2 ? '#16161a' : '#f6f1e4';
    g.fillRect(x * 8, y * 8, 8, 8);
  }
  const tex = new THREE.CanvasTexture(c);
  tex.magFilter = THREE.NearestFilter;
  tex.colorSpace = THREE.SRGBColorSpace;
  const line = new THREE.Mesh(new THREE.PlaneGeometry(2, T.HW * 2, 2, 16),
    new THREE.MeshStandardMaterial({ map: tex }));
  const pos = line.geometry.attributes.position;
  // Local X is distance along the road; local Y spans its full width.
  // Construct in world coordinates so no Euler rotation can turn it lengthwise.
  for (let i = 0; i < pos.count; i++) {
    const p = placeOnTrack(T, T.LINE + pos.getX(i), -pos.getY(i));
    pos.setXYZ(i, p.x, p.y + (T.def.environment ? 0.17 : 0.07), p.z);
  }
  line.geometry.computeVertexNormals();
  line.name = 'finish-stripe';
  line.receiveShadow = true;
  group.add(line);
  const p = placeOnTrack(T, T.LINE);
  const gantry = new THREE.Group();
  for (const side of [-1, 1]) gantry.add(box(0.55, 7, 0.55, M(0x384d50), side * (T.HW + 2), 3.5, 0));
  const banner = canvasMat(1024, 128, ctx => {
    ctx.fillStyle = '#f8df9b'; ctx.fillRect(0, 0, 1024, 128);
    ctx.fillStyle = '#263b40'; ctx.font = '900 85px sans-serif';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('META', 512, 68);
    for (let x = 0; x < 6; x++) for (let y = 0; y < 4; y++) if ((x + y) % 2) {
      ctx.fillRect(x * 32, y * 32, 32, 32); ctx.fillRect(832 + x * 32, y * 32, 32, 32);
    }
  });
  gantry.add(mesh(new THREE.BoxGeometry(T.HW * 2 + 4.6, 1.4, 0.3), banner, 0, 7, 0));
  at(group, gantry, p, p.h);
}

// Jump ramps: yellow wedge, black sides.
function buildRamps(group, T) {
  for (const r of T.ramps) {
    const tri = new THREE.Shape([new THREE.Vector2(0, 0), new THREE.Vector2(r.len, 0), new THREE.Vector2(r.len, r.h)]);
    const ramp = new THREE.Mesh(new THREE.ExtrudeGeometry(tri, { depth: r.hw * 2, bevelEnabled: false }), [
      M(0x16161a),
      M(0xffd23f),
    ]);
    const p = T.pointAt(r.s0), p2 = T.pointAt(r.s0 + 1);
    const dir = Math.atan2(-(p2.y - p.y), p2.x - p.x);
    ramp.rotation.y = dir;
    ramp.position.set(p.x - Math.sin(dir) * r.hw, T.heightAtS(r.s0) + 0.02, p.y - Math.cos(dir) * r.hw);
    ramp.castShadow = true;
    ramp.receiveShadow = true;
    group.add(ramp);
  }
}

// ---------- water ----------
function waterPond(rx, rz, { color = 0x2e9db5, y = 0.04 } = {}) {
  const group=new THREE.Group(),water=waterPool(rx,rz,{color});water.position.y=y;group.add(water);return group;
}

// A strip of water (river, stream) along control points.
function waterRibbon(points, w, { color = 0x2e9db5, y = 0.03, closed = false } = {}) {
  return riverSurface(points,w,()=>y,{color,closed});
}

// Waterfall sheet with scrolling stripes + foam at the base.
function waterfall(w, h, { color = 0xbfe8f2 } = {}) {
  const g = new THREE.Group();
  const tex = new THREE.CanvasTexture(Object.assign(document.createElement('canvas'), { width: 32, height: 64 }));
  const ctx = tex.image.getContext('2d');
  ctx.fillStyle = '#bfe8f2'; ctx.fillRect(0, 0, 32, 64);
  ctx.fillStyle = '#ffffff';
  for (let i = 0; i < 5; i++) ctx.fillRect(3 + i * 6, 0, 2, 64);
  tex.wrapT = THREE.RepeatWrapping;
  tex.colorSpace = THREE.SRGBColorSpace;
  const sheet = new THREE.Mesh(new THREE.PlaneGeometry(w, h),
    new THREE.MeshStandardMaterial({ map: tex, transparent: true, opacity: 0.9, roughness: 0.3, side: THREE.DoubleSide }));
  sheet.position.y = h / 2;
  g.add(sheet);
  const foam = new THREE.Mesh(new THREE.CircleGeometry(w * 0.7, 14),
    new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.65 }));
  foam.rotation.x = -Math.PI / 2;
  foam.position.y = 0.06;
  g.add(foam);
  g.userData.tick = t => { sheet.material.map.offset.y = -t * 1.4; };
  g.userData.dispose=()=>{tex.dispose();if(sheet.material.map!==tex)sheet.material.map.dispose();};
  return g;
}

// ---------- bridges ----------
// Plank bridge spanning a pond. rope=true gives sagging rope rails.
function bridge({ len = 12, w = 4, rope = false } = {}) {
  const g = new THREE.Group();
  const wood = M(0x8a5a33, { roughness: 0.9 });
  const dark = M(0x5c3a20, { roughness: 0.9 });
  const planks = Math.floor(len / 0.85);
  for (let i = 0; i < planks; i++) {
    g.add(box(0.7, 0.14, w, wood, -len / 2 + (i + 0.5) * (len / planks), 0.5, 0));
  }
  for (const s of [1, -1]) {
    g.add(box(len, 0.16, 0.2, dark, 0, 0.32, s * (w / 2 - 0.1)));
    for (let i = 0; i <= 3; i++) {
      const x = -len / 2 + (i / 3) * len;
      g.add(box(0.18, 1.5, 0.18, dark, x, 0.75, s * (w / 2 + 0.05)));
    }
    if (rope) {
      for (const y of [1.1, 1.45]) {
        for (let i = 0; i < 3; i++) {
          const x0 = -len / 2 + (i / 3) * len, x1 = -len / 2 + ((i + 1) / 3) * len;
          const curve = new THREE.QuadraticBezierCurve3(
            new THREE.Vector3(x0, y + 0.35, s * (w / 2 + 0.05)),
            new THREE.Vector3((x0 + x1) / 2, y, s * (w / 2 + 0.05)),
            new THREE.Vector3(x1, y + 0.35, s * (w / 2 + 0.05)),
          );
          g.add(mesh(new THREE.TubeGeometry(curve, 8, 0.035, 5), M(0xd8c49a, { roughness: 1 })));
        }
      }
    } else {
      g.add(box(len, 0.1, 0.1, dark, 0, 1.45, s * (w / 2 + 0.05)));
    }
  }
  return g;
}

// Turn a stretch of the track into a causeway: posts and rails flank the
// ribbon between s0 and s1 (put water underneath).
function flankBridge(group, T, s0, s1) {
  const wood = M(0x5c3a20, { roughness: 0.9 });
  for (const side of [1, -1]) {
    const off = side * (T.HW + 0.5);
    let prev = null;
    for (let s = s0; s <= s1; s += 2.6) {
      const p = placeOnTrack(T, s, off);
      group.add(box(0.22, 1.6, 0.22, wood, p.x, p.y + 0.8, p.z));
      if (prev) {
        const len = Math.hypot(p.x - prev.x, p.z - prev.z);
        const rail = box(len, 0.12, 0.1, M(0x8a5a33, { roughness: 0.9 }),
          (p.x + prev.x) / 2, (p.y + prev.y) / 2 + 1.35, (p.z + prev.z) / 2);
        rail.rotation.y = Math.atan2(p.x - prev.x, p.z - prev.z) - Math.PI / 2;
        group.add(rail);
      }
      prev = p;
    }
  }
}

// Aermotor-style ranch windmill; the rotor spins.
function windmill({ h = 10 } = {}) {
  const g = new THREE.Group();
  const steel = M(0x9a9aa4, { metalness: 0.5, roughness: 0.5 });
  for (const [sx, sz] of [[1, 1], [1, -1], [-1, 1], [-1, -1]]) {
    g.add(tube([sx * 1.6, 0, sz * 1.6], [sx * 0.3, h, sz * 0.3], 0.09, steel));
  }
  for (const y of [h * 0.33, h * 0.66]) {
    const w = 1.6 - y * 0.13;
    g.add(box(w * 2, 0.07, 0.07, steel, 0, y, w));
    g.add(box(w * 2, 0.07, 0.07, steel, 0, y, -w));
    g.add(box(0.07, 0.07, w * 2, steel, w, y, 0));
    g.add(box(0.07, 0.07, w * 2, steel, -w, y, 0));
  }
  const rotor = new THREE.Group();
  rotor.position.set(0, h + 0.6, 0.5);
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    const blade = box(0.28, 1.5, 0.04, steel, Math.cos(a) * 1.1, Math.sin(a) * 1.1, 0);
    blade.rotation.z = a - Math.PI / 2;
    blade.rotation.y = 0.25;
    rotor.add(blade);
  }
  rotor.add(mesh(new THREE.SphereGeometry(0.2, 8, 6), steel));
  rotor.userData.tick = (t, dt) => { rotor.rotation.z += dt * 1.8; };
  g.add(rotor);
  g.add(box(0.06, 1, 0.9, steel, 0, h + 0.6, -0.6));   // tail vane
  return g;
}

// Roadside arepa kiosk with striped awning.
function arepaStand({ color = '#e8452c', label = 'AREPAS' } = {}) {
  const g = new THREE.Group();
  const wood = M(0x8a5a33, { roughness: 0.9 });
  g.add(box(3.4, 1.15, 1.6, wood, 0, 0.58, 0));                        // counter
  g.add(box(3.6, 0.1, 1.8, M(0x5c3a20, { roughness: 0.9 }), 0, 1.2, 0));
  for (const s of [1, -1]) g.add(box(0.14, 2.6, 0.14, wood, s * 1.6, 1.3, -0.7));
  const awning = canvasMat(256, 64, (ctx) => {
    for (let i = 0; i < 8; i++) {
      ctx.fillStyle = i % 2 ? '#fdf6e3' : color;
      ctx.fillRect(i * 32, 0, 32, 64);
    }
  });
  const roof = mesh(new THREE.BoxGeometry(3.9, 0.08, 2.2), awning, 0, 2.65, 0);
  roof.rotation.x = 0.12;
  g.add(roof);
  const sign = canvasMat(256, 64, (ctx) => {
    ctx.fillStyle = '#fdf6e3';
    ctx.fillRect(0, 0, 256, 64);
    ctx.fillStyle = '#16161a';
    ctx.font = '44px "Luckiest Guy", system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(label, 128, 36);
  });
  g.add(mesh(new THREE.BoxGeometry(2.4, 0.6, 0.08), sign, 0, 2.2, 0.95));
  for (const s of [1, -1]) g.add(mesh(new THREE.CylinderGeometry(0.35, 0.35, 0.5, 9), wood, s * 2.6, 0.25, 1.2));
  return g;
}

// Wooden dock over water + optional tied-up rowboat.
function dock({ len = 7, w = 2.2 } = {}) {
  const g = new THREE.Group();
  const wood = M(0x8a5a33, { roughness: 0.9 });
  const planks = Math.floor(len / 0.8);
  for (let i = 0; i < planks; i++) {
    g.add(box(0.66, 0.12, w, wood, -len / 2 + (i + 0.5) * (len / planks), 0.55, 0));
  }
  for (const [x, z] of [[-len / 2 + 0.4, w / 2], [-len / 2 + 0.4, -w / 2], [len / 2 - 0.4, w / 2], [len / 2 - 0.4, -w / 2], [0, w / 2], [0, -w / 2]]) {
    g.add(box(0.2, 1.4, 0.2, M(0x5c3a20, { roughness: 0.9 }), x, 0.2, z * 0.85));
  }
  return g;
}

function rowboat({ color = 0xb5462f } = {}) {
  const g = new THREE.Group();
  const hull = mesh(new THREE.SphereGeometry(1.6, 10, 6, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2), M(color, { roughness: 0.7, side: THREE.DoubleSide }));
  hull.scale.set(0.55, 0.5, 1.4);
  hull.rotation.x = Math.PI;
  hull.position.y = 0.55;
  g.add(hull);
  g.add(box(0.9, 0.08, 0.3, M(0xd8c49a, { roughness: 1 }), 0, 0.5, 0));
  g.add(box(0.9, 0.08, 0.3, M(0xd8c49a, { roughness: 1 }), 0, 0.5, -0.9));
  return g;
}

function sailboat() {
  const g = new THREE.Group();
  g.add(rowboat({ color: 0xf6f1e4 }));
  g.add(mesh(new THREE.CylinderGeometry(0.06, 0.06, 4.4, 6), M(0x5c3a20, { roughness: 0.9 }), 0, 2.6, 0));
  const sail = canvasMat(128, 128, (ctx) => {
    ctx.fillStyle = '#fdf6e3';
    ctx.beginPath();
    ctx.moveTo(10, 120); ctx.lineTo(118, 120); ctx.lineTo(10, 8);
    ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#e8452c';
    ctx.fillRect(10, 96, 108, 24);
  });
  const tri = new THREE.Mesh(new THREE.PlaneGeometry(2.6, 2.6), sail);
  tri.position.set(0.06, 2.6, 0);
  g.add(tri);
  return g;
}

// Distant mountain ring (backdrop; fog does the blending).
function distantMountains({ r = 210, count = 10, color = 0x7a6a8a, snow = false, seed = 5, hMin = 30, hMax = 70 } = {}) {
  const rand = rng(seed);
  const g = new THREE.Group();
  for (let i = 0; i < count; i++) {
    const a = (i / count) * Math.PI * 2 + rand() * 0.5;
    const h = hMin + rand() * (hMax - hMin);
    const rad = 18 + rand() * 26;
    const m = mesh(new THREE.ConeGeometry(rad, h, 5), M(color, { roughness: 1 }), Math.cos(a) * r, h / 2 - 2, Math.sin(a) * r);
    m.castShadow = false;
    m.receiveShadow = false;
    g.add(m);
    if (snow) {
      const cap = mesh(new THREE.ConeGeometry(rad * 0.42, h * 0.34, 5), M(0xf6f6f8, { roughness: 0.9 }),
        Math.cos(a) * r, h - h * 0.17 - 2, Math.sin(a) * r);
      cap.castShadow = false;
      g.add(cap);
    }
  }
  return g;
}

function sectorSigns(group, T) {
  for (const [u, name] of T.def.sectors || []) {
    const p = placeOnTrack(T, T.TOTAL * u, T.HW + 6);
    at(group, mapSign(name.toUpperCase().split(' ').reduce((lines, word) => {
      if (!lines.length || (lines[lines.length-1] + word).length > 15) lines.push(word);
      else lines[lines.length-1] += ' ' + word;
      return lines;
    }, [])), p, p.h + Math.PI);
  }
}

// Landscape along extended stretches, placed relative to the road rather
// than confined to the center of the old small maps.
function routeLandscape(group, T, { seed = 91, color = 0x67854e, tree = 'mango', height = 26, snow = false } = {}) {
  const terrain = new THREE.Group();
  for (const p of scatter(T, { seed, count: 20, min: T.HW+55, max: T.HW+110 })) {
    const radius = 24+p.k*18;
    if (Math.abs(T.offsetOf(p.x,p.z)) < T.HW+radius+8) continue;
    const hill = mesh(new THREE.IcosahedronGeometry(1, 1), M(color,{roughness:1}));
    hill.scale.set(radius,height*(0.7+p.k),radius*0.85);
    at(terrain,hill,{...p,y:p.y-6},p.rot);
    if (snow) {
      const cap=mesh(new THREE.IcosahedronGeometry(1,1),M(0xe3e6de));
      cap.scale.set(radius*0.5,height*0.26,radius*0.42);
      at(terrain,cap,{...p,y:p.y+height*(0.7+p.k)*0.72},p.rot);
    }
  }
  const make = tree==='pine' ? pine : tree==='palm' ? palm : tree==='ceiba' ? ceiba : mangoTree;
  if (tree) for(const p of scatter(T,{seed:seed+1,count:100,min:T.HW+12,max:T.HW+42})) {
    at(terrain,make({seed:Math.floor(p.s),h:6+p.k*7}),p,p.rot);
  }
  group.add(bake(terrain,{cellSize:100}));
}

export {
  sectorSigns, routeLandscape,
  rng, placeOnTrack, scatter, at,
  tireWall, fenceRing, chevrons, startLine, buildRamps, mapSign,
  watchtower, flagPole, rock,
  waterPond, waterRibbon, waterfall,
  bridge, flankBridge,
  palm, mangoTree, ceiba, pine, banana, bush, bake, windmill, arepaStand, dock, rowboat, sailboat, distantMountains,
};
