// Bolt-on garage parts that fit any v2 car: spoilers, roof cargo, front
// bars, a roll cage, engine dress-up (scoop, blower, exhausts), decals,
// stripes and the paint finish. Every part is placed from the
// car's fit (car-kit.js shellBody/cabin): nose and tail faces, the top line,
// the roof and the half width, so no car needs hand-tuned offsets.
// cfg slot values of 'fabrica' (or missing) keep the car's own stock part;
// each builder skips its stock part when a slot asks for something else.

import * as THREE from 'three';
import {
  M, S, DECAL, CHROME, DARK, mesh, box, rbox, tube, extrudeX, roundel, flower, canvasMat, bothSides, detachable, domeLamp, AMBER, makeWheel,
} from './car-kit.js';

export const stock = (cfg, slot) => !cfg?.[slot] || cfg[slot] === 'fabrica';
export const RIMS = { plata: '#c9ced8', negro: '#2a292f', dorado: '#d6a640', blanco: '#f1f0ec' };

const deckOf = (fit) => {
  const roomy = fit.cabin && fit.cabin.zR - fit.zR > 0.75;
  const z = roomy ? fit.zR + Math.min(0.45, (fit.cabin.zR - fit.zR) * 0.4) : fit.zR + 0.3;
  return { z, y: fit.topOf(z), roomy };
};

// A wing section: a cambered foil extruded across the span.
function foil(span, chord, thick, aoa, mat, y, z) {
  const s = new THREE.Shape();
  s.moveTo(chord / 2, 0);
  s.bezierCurveTo(chord * 0.2, thick, -chord * 0.3, thick * 0.9, -chord / 2, thick * 0.1);
  s.bezierCurveTo(-chord * 0.3, -thick * 0.2, chord * 0.2, -thick * 0.15, chord / 2, 0);
  const m = mesh(extrudeX(s, -span / 2, span / 2, { bevel: 0.02, segments: 6 }), mat);
  m.rotation.x = aoa;
  m.position.set(0, y, z);
  return m;
}

export function spoiler(car, kind, paint) {
  const fit = car.fit, g = new THREE.Group(), deck = deckOf(fit);
  if (kind === 'pato') {
    const s = new THREE.Shape();
    s.moveTo(0.3, 0); s.quadraticCurveTo(0.05, 0.03, -0.08, 0.2); s.lineTo(-0.14, 0.18); s.lineTo(-0.1, 0); s.closePath();
    const w = fit.halfW(fit.zR + 0.2) - 0.05, z = fit.zR + 0.2;
    const m = mesh(extrudeX(s, -w, w, { bevel: 0.025 }), paint, 0, fit.topOf(z) - 0.02, z);
    g.add(m);
  } else if (kind === 'gt') {
    const roof = fit.roof, onRoof = !deck.roomy && roof;
    const z = onRoof ? roof.zR + 0.05 : deck.z, y = onRoof ? roof.y(roof.zR + 0.2) : deck.y;
    const span = Math.min(fit.width + 0.05, 2 * fit.halfW(z) + 0.12), h = onRoof ? 0.32 : 0.55;
    g.add(foil(span, 0.6, 0.1, -0.12, paint, y + h, z - 0.05));
    for (const s of [1, -1]) {
      g.add(rbox(0.04, 0.34, 0.66, paint, s * span / 2, y + h + 0.04, z - 0.05, 0.015));
      const post = rbox(0.06, h + 0.04, 0.2, DARK(), s * span * 0.3, y + h / 2, z, 0.025);
      g.add(post);
    }
  } else if (kind === 'techo') {
    // a lip off the back edge of the roof
    const roof = fit.roof;
    if (!roof) return;
    const s = new THREE.Shape();
    s.moveTo(0.14, 0.03); s.lineTo(-0.3, 0.0); s.lineTo(-0.36, -0.07); s.lineTo(0.1, -0.03); s.closePath();
    g.add(mesh(extrudeX(s, -roof.half, roof.half, { bevel: 0.025 }), paint, 0, roof.y(roof.zR + 0.15) - 0.02, roof.zR));
  } else if (kind === 'cisne') {
    // swan neck: the wing hangs from curved posts that rise behind it
    // no rear deck (the cabin runs to the tail): hang it off the roof instead
    const roof = fit.roof, onRoof = !deck.roomy && roof;
    const z = onRoof ? roof.zR + 0.15 : deck.z, y = onRoof ? roof.y(roof.zR + 0.25) : fit.topOf(z), h = onRoof ? 0.4 : 0.6;
    const span = Math.min(fit.width + 0.05, 2 * fit.halfW(z) + 0.12);
    g.add(foil(span, 0.6, 0.1, -0.14, paint, y + h, z - 0.04));
    for (const s of [1, -1]) {
      g.add(rbox(0.04, 0.32, 0.62, paint, s * span / 2, y + h + 0.03, z - 0.04, 0.015));
      const x = s * span * 0.28;
      g.add(tube([x, y, z + 0.22], [x, y + h * 0.8, z + 0.28], 0.035, DARK()));
      g.add(tube([x, y + h * 0.8, z + 0.28], [x, y + h + 0.1, z + 0.04], 0.035, DARK()));
    }
  } else if (kind === 'rally') {
    const roof = fit.roof ?? { zR: deck.z + 0.4, y: () => deck.y + 0.2, half: fit.halfW(deck.z) };
    const z = roof.zR, y = roof.y(roof.zR + 0.25), span = Math.min(fit.width, roof.half * 2 + 0.2);
    g.add(foil(span, 0.62, 0.1, -0.1, paint, y + 0.16, z - 0.24));
    g.add(foil(span * 0.94, 0.34, 0.06, -0.3, paint, y + 0.34, z - 0.48));
    for (const s of [1, -1]) {
      g.add(rbox(0.04, 0.36, 0.62, DARK(), s * span / 2, y + 0.24, z - 0.36, 0.015));
      g.add(rbox(0.16, 0.16, 0.26, paint, s * span * 0.3, y + 0.06, z - 0.12, 0.04));
    }
  } else return;
  detachable(car, g);
}

function rack(g, z, y, len, half) {
  const bar = DARK();
  for (const s of [1, -1]) {
    g.add(rbox(0.07, 0.07, len, bar, s * half, y + 0.14, z, 0.025));
    for (const dz of [len / 2 - 0.08, -len / 2 + 0.08]) g.add(rbox(0.07, 0.14, 0.07, bar, s * half, y + 0.05, z + dz, 0.02));
  }
  for (let k = 0; k < 3; k++) g.add(rbox(half * 2, 0.05, 0.06, bar, 0, y + 0.15, z - len / 2 + 0.12 + k * (len - 0.24) / 2, 0.02));
  return y + 0.18;
}

function cooler(g, x, y, z) {
  g.add(rbox(0.92, 0.52, 0.64, S('#d8303a', { roughness: 0.45 }), x, y + 0.26, z, 0.08));
  g.add(rbox(0.96, 0.12, 0.68, S('#f3f0ea', { roughness: 0.45 }), x, y + 0.56, z, 0.05));
  for (const s of [1, -1]) g.add(rbox(0.06, 0.08, 0.28, DARK(), x + s * 0.5, y + 0.4, z, 0.02));
}

export function roofCargo(car, kind) {
  const fit = car.fit, g = new THREE.Group(), roof = fit.roof;
  // where cargo goes: the bed of a pickup, the deck of an open car, else the roof
  const spot = fit.cargo ?? (roof ? { z: (roof.zF + roof.zR) / 2, y: roof.y((roof.zF + roof.zR) / 2), half: roof.half, len: roof.zF - roof.zR, rack: true } : null);
  if (!spot) return;
  const { z, half = 0.8, len = 1.4 } = spot;
  let y = spot.y;
  if (kind === 'barra') {
    const fz = roof ? roof.zF - 0.15 : z, fy = roof ? roof.y(roof.zF - 0.25) : y, w = Math.min(half * 2 + 0.1, 2.1);
    g.add(rbox(w, 0.1, 0.18, DARK(), 0, fy + 0.1, fz, 0.035));
    for (const s of [1, -1]) g.add(rbox(0.07, 0.14, 0.09, DARK(), s * (w / 2 - 0.05), fy + 0.04, fz, 0.02));
    for (let k = 0; k < 4; k++) {
      const lamp = domeLamp(0.13, AMBER(), DARK(), 0.14);
      lamp.position.set(-w / 2 + (k + 0.5) * w / 4, fy + 0.3, fz + 0.03);
      g.add(lamp);
    }
  } else if (kind === 'cava') {
    if (spot.rack) y = rack(g, z, y, Math.min(len, 1.6), Math.min(half - 0.05, 0.8));
    cooler(g, 0, y, z);
  } else if (kind === 'maletas') {
    if (spot.rack) y = rack(g, z, y, Math.min(len, 1.6), Math.min(half - 0.05, 0.8));
    const bag = (w, h, d, color, x, yy, zz) => {
      g.add(rbox(w, h, d, S(color, { roughness: 0.75 }), x, yy + h / 2, zz, 0.07));
      for (const s of [1, -1]) g.add(rbox(0.06, h + 0.02, d + 0.02, M('#2b1d14'), x + s * w * 0.28, yy + h / 2, zz, 0.02));
    };
    bag(0.92, 0.38, 0.62, '#8b5a2b', -0.2, y, z + 0.1);
    bag(0.7, 0.3, 0.5, '#d9772b', -0.18, y + 0.38, z + 0.08);
    const pot = S('#c8ccd4', { metalness: 0.7, roughness: 0.3 });
    g.add(mesh(new THREE.CylinderGeometry(0.26, 0.24, 0.32, 14), pot, 0.5, y + 0.16, z - 0.45));
    g.add(mesh(new THREE.CylinderGeometry(0.28, 0.28, 0.05, 14), pot, 0.5, y + 0.34, z - 0.45));
  } else if (kind === 'repuesto') {
    if (spot.rack) y = rack(g, z, y, Math.min(len, 1.6), Math.min(half - 0.05, 0.8));
    const spare = makeWheel({ r: 0.52, w: 0.4, style: 'acero', rim: '#c9ced8', cap: '#c9ced8', tread: 'barro' });
    spare.rotation.z = Math.PI / 2;
    spare.position.set(0, y + 0.22, z);
    g.add(spare);
    for (const s of [1, -1]) g.add(rbox(0.05, 0.06, 1.1, M('#2e1d12'), s * 0.18, y + 0.44, z, 0.015));
  } else if (kind === 'cornetas') {
    const spk = S('#1b1820', { roughness: 0.45 }), cone = S('#4a4652', { roughness: 0.5 });
    g.add(rbox(1.5, 0.62, 0.62, spk, 0, y + 0.32, z, 0.09));
    for (const s of [1, -1]) {
      const c = mesh(new THREE.CylinderGeometry(0.24, 0.17, 0.06, 18), cone, s * 0.4, y + 0.32, z + 0.31);
      c.rotation.x = Math.PI / 2;
      g.add(c);
      const r = mesh(new THREE.TorusGeometry(0.25, 0.025, 5, 18), M('#ff8a1f'), s * 0.4, y + 0.32, z + 0.33);
      g.add(r);
    }
    for (let k = 0; k < 7; k++) g.add(box(0.035, 0.05 + 0.12 * Math.abs(Math.sin(k * 1.7)), 0.02,
      M('#b48cff', { emissive: '#8f5cff', emissiveIntensity: 0.9 }), -0.1 + k * 0.034, y + 0.5, z + 0.315));
  } else return;
  detachable(car, g);
}

const rayoMats = new Map();
function rayo(color = '#ffd23f') {
  if (!rayoMats.has(color)) rayoMats.set(color, canvasMat(512, 128, (g) => {
    g.fillStyle = color; g.strokeStyle = '#16161a'; g.lineWidth = 8; g.lineJoin = 'round';
    g.beginPath();
    g.moveTo(8, 72); g.lineTo(250, 50); g.lineTo(230, 80); g.lineTo(504, 36); g.lineTo(504, 58);
    g.lineTo(272, 100); g.lineTo(292, 70); g.lineTo(8, 92); g.closePath();
    g.stroke(); g.fill();
  }));
  return new THREE.Mesh(new THREE.PlaneGeometry(2.6, 0.65), rayoMats.get(color));
}

export function decal(car, kind, num, accent = '#ffd23f') {
  const fit = car.fit, c = car.chassis;
  // the door, between the arches
  const z = (Math.max(...fit.axles) + Math.min(...fit.axles)) / 2, y = (fit.sill + (fit.belt ?? fit.topOf(z))) / 2 + 0.06;
  if (kind === 'numero') bothSides(c, () => roundel(num, 0.36), fit.halfW(z) + 0.015, y, z);
  else if (kind === 'flor') bothSides(c, () => flower(0.42), fit.halfW(z) + 0.015, y, z);
  else if (kind === 'rayo') {
    for (const s of [1, -1]) {
      const d = rayo(accent);
      d.position.set(s * (fit.halfW(0) + 0.016), y - 0.05, 0);
      d.rotation.y = s * Math.PI / 2;
      d.scale.x = Math.min(1, (fit.zF - fit.zR - 0.6) / 2.6);
      c.add(d);
    }
  }
}

// Two racing stripes over the hood, roof and deck, or a rocker stripe.
export function stripes(car, kind, color = '#f3e9d7', { lanes = [-0.2, 0.2], half = 0.1 } = {}) {
  const fit = car.fit, mat = S(color, { roughness: 0.4, side: THREE.DoubleSide, ...DECAL });
  if (kind === 'costado') {
    const [front, rear] = [Math.max(...fit.axles), Math.min(...fit.axles)], gap = (fit.arch ?? 0.85) + 0.05;
    const len = front - rear - 2 * gap;
    if (len > 0.3) bothSides(car.chassis, () => new THREE.Mesh(new THREE.PlaneGeometry(len, 0.14), mat), fit.halfW(0) + 0.014, fit.sill + 0.24, (front + rear) / 2);
    return;
  }
  if (kind !== 'carrera') return;
  const roof = fit.roof, cab = fit.cabin;
  const topAt = (z) => {
    if (cab && z < cab.zF && z > cab.zR) {
      if (cab.open || !roof || z > roof.zF - 0.08 || z < roof.zR + 0.08) return null;
      return roof.y(z) + 0.012;
    }
    if (fit.bed && z < fit.bed.zF && z > fit.bed.zR) return null;
    return fit.topOf(z) + 0.012;
  };
  const pos = [];
  for (const off of lanes) {
    let run = [];
    const flush = () => {
      for (let i = 0; i < run.length - 1; i++) {
        const [a, b] = [run[i], run[i + 1]];
        pos.push(a[0] - half, a[1], a[2], a[0] + half, a[1], a[2], b[0] + half, b[1], b[2],
          a[0] - half, a[1], a[2], b[0] + half, b[1], b[2], b[0] - half, b[1], b[2]);
      }
      run = [];
    };
    for (let z = fit.zF - 0.08; z > fit.zR + 0.06; z -= 0.08) {
      const y = topAt(z);
      if (y == null) { flush(); continue; }
      run.push([off * fit.taper(z), y, z]);
    }
    flush();
  }
  if (!pos.length) return;
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.computeVertexNormals();
  const m = mesh(g, mat);
  m.castShadow = false;
  car.chassis.add(m);
}

function hoodScoop(car) {
  const fit = car.fit, cab = fit.cabin;
  const hood = cab ? fit.zF - cab.zF : 0;
  const z = hood > 0.7 ? cab.zF + hood * 0.42 : fit.zR + 0.55, y = fit.topOf(z);
  const s = new THREE.Shape();
  s.moveTo(0.34, 0); s.lineTo(0.31, 0.17); s.lineTo(0.22, 0.2); s.quadraticCurveTo(-0.2, 0.13, -0.42, 0); s.closePath();
  car.chassis.add(mesh(extrudeX(s, -0.38, 0.38, { bevel: 0.03 }), car.paint, 0, y - 0.03, z));
  car.chassis.add(rbox(0.64, 0.11, 0.04, DARK(), 0, y + 0.07, z + 0.34, 0.015));
}

// ---------- front bars, the roll cage and the engine ----------
export function frente(car, kind) {
  const fit = car.fit, g = new THREE.Group(), bar = S('#1d1d23', { roughness: 0.45, metalness: 0.3 });
  const y0 = fit.sill + 0.12, z = fit.noseZ(y0 + 0.1) + 0.18;
  if (kind === 'defensa') {
    const y1 = Math.min(fit.topOf(fit.zF - 0.3), y0 + 0.75);
    for (const s of [1, -1]) {
      g.add(tube([s * 0.55, y0, z], [s * 0.55, y1 - 0.08, z + 0.04], 0.065, bar));
      g.add(tube([s * 0.55, y0 + 0.25, z], [s * 0.95, y0 + 0.1, z - 0.18], 0.055, bar));
    }
    g.add(tube([-0.55, y1, z + 0.02], [0.55, y1, z + 0.02], 0.065, bar));
    g.add(tube([-0.55, y0 + 0.36, z + 0.03], [0.55, y0 + 0.36, z + 0.03], 0.05, bar));
  } else if (kind === 'faros') {
    const y = Math.min(fit.topOf(fit.zF - 0.2) + 0.25, y0 + 0.9), w = Math.min(1.7, 2 * fit.halfW(z));
    g.add(rbox(w, 0.07, 0.08, bar, 0, y - 0.22, z - 0.05, 0.03));
    for (const k of [-0.375, -0.125, 0.125, 0.375]) {
      const x = k * w * 1.6;
      g.add(rbox(0.05, 0.16, 0.05, bar, x, y - 0.14, z - 0.05, 0.015));
      const lamp = domeLamp(0.15, AMBER(), bar, 0.14);
      lamp.position.set(x, y, z);
      g.add(lamp);
    }
  } else if (kind === 'winche') {
    const w = 2 * fit.halfW(z) + 0.1;
    g.add(rbox(w, 0.34, 0.36, bar, 0, y0 + 0.08, z - 0.04, 0.06));
    const drum = mesh(new THREE.CylinderGeometry(0.15, 0.15, 0.72, 14), S('#b9b3a6', { roughness: 0.85 }), 0, y0 + 0.1, z + 0.2);
    drum.rotation.z = Math.PI / 2;
    g.add(drum);
    for (const s of [1, -1]) {
      g.add(rbox(0.07, 0.34, 0.34, bar, s * 0.4, y0 + 0.1, z + 0.18, 0.02));
      const shackle = mesh(new THREE.TorusGeometry(0.09, 0.03, 6, 12), S('#ff8a1f'), s * (w / 2 - 0.2), y0 - 0.02, z + 0.16);
      shackle.rotation.y = Math.PI / 2;
      g.add(shackle);
    }
    const hook = mesh(new THREE.TorusGeometry(0.1, 0.03, 6, 12, Math.PI * 1.5), S('#ff8a1f'), 0, y0 - 0.14, z + 0.32);
    hook.rotation.y = Math.PI / 2;
    g.add(hook);
  } else return;
  detachable(car, g);
}

// A roll cage inside the cabin: hoops at the windshield, the B pillar and
// over the back, in the accent colour.
export function jaula(car, color = '#1d1d23') {
  const fit = car.fit, cab = fit.cabin;
  if (!cab) return;
  const mat = S(color, { roughness: 0.4, metalness: 0.35 }), half = cab.width / 2 - 0.12;
  const top = fit.roof ? fit.roof.top - 0.2 : fit.belt + 1.05, low = fit.belt - 0.35;
  const zA = cab.zF - 0.25, zB = (cab.zF + cab.zR) / 2 - 0.1, zC = cab.zR + 0.2;
  const g = new THREE.Group();
  for (const s of [1, -1]) {
    g.add(tube([s * half, fit.belt, zA], [s * half, top, zB + 0.2], 0.05, mat));
    g.add(tube([s * half, low, zB], [s * half, top, zB], 0.05, mat));
    g.add(tube([s * half, top, zB], [s * half, fit.belt + 0.2, zC], 0.05, mat));
  }
  g.add(tube([-half, top, zB], [half, top, zB], 0.05, mat));
  g.add(tube([-half, top, zB], [half, low + 0.3, zB], 0.04, mat));
  car.chassis.add(g);
}

// Engine dress-up: chrome tailpipes for every upgrade, a scoop for turbo, a
// chrome blower with stacks for carreras.
export function motor(car, kind) {
  const fit = car.fit, c = car.chassis;
  const r = kind === 'carreras' ? 0.11 : 0.085, y = fit.sill + 0.05, z = fit.tailZ(y + 0.1);
  for (const x of [0.5, -0.5]) {
    const pipe = mesh(new THREE.CylinderGeometry(r, r * 1.1, 0.42, 12), CHROME(), x, y, z - 0.08);
    pipe.rotation.x = Math.PI / 2;
    c.add(pipe);
    const soot = mesh(new THREE.CircleGeometry(r * 0.75, 10), DARK(), x, y, z - 0.295);
    soot.rotation.y = Math.PI;
    c.add(soot);
  }
  const cab = fit.cabin, hood = cab ? fit.zF - cab.zF : 0;
  const hz = hood > 0.7 ? cab.zF + hood * 0.45 : fit.zR + 0.55, hy = fit.topOf(hz);
  if (kind === 'turbo') hoodScoop(car);
  else if (kind === 'carreras') {
    c.add(rbox(0.66, 0.3, 0.6, CHROME(), 0, hy + 0.14, hz, 0.06));
    c.add(rbox(0.74, 0.07, 0.66, DARK(), 0, hy + 0.01, hz, 0.025));
    for (let k = 0; k < 3; k++) for (const s of [1, -1]) {
      c.add(mesh(new THREE.CylinderGeometry(0.06, 0.075, 0.24, 10), CHROME(), s * 0.15, hy + 0.4, hz - 0.18 + k * 0.18));
    }
    c.add(rbox(0.36, 0.22, 0.07, DARK(), 0, hy + 0.12, hz + 0.33, 0.02));
  }
}

// ---------- the paint finish ----------
let camoTexture = null;
function camo() {
  if (camoTexture) return camoTexture;
  const c = document.createElement('canvas');
  c.width = c.height = 256;
  const g = c.getContext('2d');
  g.fillStyle = '#ffffff'; g.fillRect(0, 0, 256, 256);
  let seed = 7;
  const rand = () => ((seed = seed * 16807 % 2147483647) - 1) / 2147483646;
  for (const [shade, n, size] of [['#9a9a9a', 22, 30], ['#5e5e5e', 16, 24], ['#c8c8c8', 12, 18]]) {
    g.fillStyle = shade;
    for (let k = 0; k < n; k++) {
      const x = rand() * 256, y = rand() * 256;
      g.beginPath();
      for (let j = 0; j < 10; j++) {
        const a = j / 10 * Math.PI * 2, r = size * (0.6 + rand() * 0.65);
        g.lineTo(x + Math.cos(a) * r, y + Math.sin(a) * r * 0.7);
      }
      g.fill();
    }
  }
  camoTexture = new THREE.CanvasTexture(c);
  camoTexture.colorSpace = THREE.SRGBColorSpace;
  camoTexture.wrapS = camoTexture.wrapT = THREE.RepeatWrapping;
  camoTexture.repeat.set(0.45, 0.45);
  return camoTexture;
}
export const FINISHES = {
  brillante: null,
  satinado: { roughness: 0.58, metalness: 0.08 },
  mate: { roughness: 0.86, metalness: 0 },
  metalico: { roughness: 0.3, metalness: 0.35 },
  camuflaje: { roughness: 0.82, metalness: 0 },
};
const finishCache = new Map();
// Swap every body panel in the car's paint colour for the finished version.
export function finish(car, kind) {
  const params = FINISHES[kind];
  if (!params || !car.paint) return car;
  const hex = car.paint.color.getHex(), skip = new Set();
  car.driver?.group.traverse(o => skip.add(o));
  car.root.traverse(o => {
    if (!o.isMesh || skip.has(o) || !o.material?.isMeshStandardMaterial || o.material.color.getHex() !== hex || o.material.map) return;
    const key = o.material.uuid + kind;
    if (!finishCache.has(key)) {
      const m = o.material.clone();
      Object.assign(m, params);
      if (kind === 'camuflaje') m.map = camo();
      m.needsUpdate = true;
      finishCache.set(key, m);
    }
    o.material = finishCache.get(key);
  });
  return car;
}

// Apply a garage config to a freshly built car.
// cfg.acento is the accent colour (stripes, rayo, cage, wings).
export function dress(car, cfg = {}, { num = 1 } = {}) {
  if (!car.fit?.topOf) return car;   // older bodies have no fit
  const accent = cfg.acento ?? '#f3e9d7';
  if (!stock(cfg, 'motor')) motor(car, cfg.motor);
  if (!stock(cfg, 'aleron')) spoiler(car, cfg.aleron, cfg.acento ? S(cfg.acento, { roughness: 0.35 }) : car.paint);
  if (!stock(cfg, 'techo')) roofCargo(car, cfg.techo);
  if (!stock(cfg, 'frente')) frente(car, cfg.frente);
  if (cfg.jaula === 'con') jaula(car, cfg.acento ?? '#1d1d23');
  if (!stock(cfg, 'calcomania')) decal(car, cfg.calcomania, num, cfg.acento ?? '#ffd23f');
  if (!stock(cfg, 'franjas')) stripes(car, cfg.franjas, accent);
  if (!stock(cfg, 'acabado')) finish(car, cfg.acabado);
  return car;
}
