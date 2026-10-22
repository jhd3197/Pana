// The eight Taller bodies: escarabajo, Sedán 70, buseta, pickup, jeep, hatch
// rally, rústico and Malibu, built on the filleted kit (car-kit.js
// shellBody). Each body is data: a side profile [z, y, fillet], an optional
// tub (a pickup's bed, a jeep's cockpit), arches, plan-view taper, a
// greenhouse and its lamps, grille and bumpers. One builder turns that data
// into a toy car with the player's pana at the wheel, then fits the stock
// parts the body comes with (car-parts.js) unless the garage asks for others.
// Profiles are authored at the original 1:1 scale and stretched here into
// Carreritas's chunky toy proportions: taller bodies, big wheels, a tall cabin.

import * as THREE from 'three';
import {
  M, S, DECAL, CHROME, DARK, PAINT, LENS, AMBER, TAIL, mesh, rbox, tube, plate, rig, detachable, cabin,
  shellBody, archFlare, domeLamp, rectLamp,
} from './car-kit.js';
import { stock, RIMS, spoiler, roofCargo, decal, stripes, frente } from './car-parts.js';

const KZ = 1.12, KY = 1.3, KC = 1.9, KW = 1.18;   // length, body height, cabin height, width

// Prototype-scale data. side/tub: [z, y, fillet]; cabin: windshield base,
// windshield top, ..., rear glass top, rear glass base.
const BODIES = {
  escarabajo: {
    W: 1.82, axles: [1.2, -1.2], R: 0.44, archR: 0.57, sill: 0.36, slab: 0.32,
    side: [[1.92, 0.36, 0.1], [2.02, 0.64, 0.3], [1.74, 1.08, 0.5], [1.0, 1.2, 0.3], [0.72, 1.2, 0.05], [-1.2, 1.2, 0.05], [-1.62, 1.14, 0.42], [-2.02, 0.76, 0.36], [-1.97, 0.36, 0.1]],
    cabin: [[0.74, 1.2], [0.3, 1.6], [-0.25, 1.82], [-0.9, 1.81], [-1.35, 1.58], [-1.56, 1.2]], smooth: true, pillar: -0.48,
    taper: { f: 0.24, zf: 0.85, r: 0.2, zr: -0.95 }, seatZ: -0.3,
    front: { type: 'bug', y: 0.98, r: 0.15 }, rear: { type: 'round', y: 0.98, inset: 0.26, r: 0.1 }, grille: 'ninguna', bumper: 'cromo', bumperY: 0.46, plateY: 0.7,
    fenders: true, wheel: { w: 0.62, style: 'disco', rim: '#f1f0ec', cap: '#c9ccd4' },
    paint: '#f5b82e', accent: '#1f1e24', stock: { calcomania: 'flor' }, plate: 'PUL·GA',
  },
  sedan: {
    W: 1.94, axles: [1.38, -1.38], R: 0.42, archR: 0.55, sill: 0.32,
    side: [[2.2, 0.32, 0.06], [2.25, 0.68, 0.08], [2.18, 1.04, 0.14], [0.9, 1.1, 0.08], [-1.0, 1.11, 0.08], [-2.15, 1.07, 0.14], [-2.23, 0.68, 0.08], [-2.2, 0.32, 0.06]],
    cabin: [[0.88, 1.1], [0.16, 1.66], [-0.92, 1.68], [-1.4, 1.11]], pillar: -0.38,
    taper: { f: 0.05, zf: 1.7, r: 0.05, zr: -1.7 }, seatZ: -0.15,
    front: { type: 'quad', y: 0.86, inset: 0.3, r: 0.11 }, rear: { type: 'rect', y: 0.9, inset: 0.28, w: 0.36, h: 0.16 }, grille: { type: 'cromo', w: 1.0, h: 0.26, y: 0.84 }, bumper: 'cromo', bumperY: 0.52, plateY: 0.7,
    wheel: { w: 0.62, style: 'disco', rim: '#dfe2e8', cap: '#c9ccd4' },
    paint: '#e8323c', accent: '#f2efe6', stock: { franjas: 'costado' }, plate: 'CAPRI·70',
  },
  buseta: {
    W: 1.96, axles: [1.36, -1.3], R: 0.44, archR: 0.57, sill: 0.36,
    side: [[2.0, 0.36, 0.1], [2.07, 1.1, 0.22], [1.97, 1.23, 0.1], [-1.95, 1.25, 0.1], [-2.03, 1.1, 0.16], [-2.0, 0.36, 0.1]],
    cabin: [[1.98, 1.23], [1.72, 2.2], [-1.8, 2.24], [-1.98, 1.25]], pillar: 0.95, extraPillars: [-0.15, -1.05], twoTone: true, kc: 1.3,
    taper: { f: 0.05, zf: 1.5, r: 0.04, zr: -1.6 }, seatZ: 1.0,
    front: { type: 'round', y: 0.86, inset: 0.38, r: 0.15 }, rear: { type: 'rect', y: 0.96, inset: 0.22, w: 0.18, h: 0.3 }, grille: 'ninguna', bumper: 'cromo', bumperY: 0.5, plateY: 0.7,
    wheel: { w: 0.6, style: 'disco', rim: '#f1e6c8', cap: '#c9ccd4' },
    paint: '#2bb3a3', accent: '#f2efe6', stock: { techo: 'repuesto' }, plate: 'POR·PUESTO',
  },
  pickup: {
    W: 1.98, axles: [1.45, -1.35], R: 0.5, archR: 0.72, sill: 0.5, slab: 0.26,
    side: [[2.25, 0.5, 0.06], [2.29, 1.18, 0.1], [2.15, 1.34, 0.12], [0.95, 1.38, 0.06], [-2.2, 1.38, 0.05], [-2.26, 1.3, 0.05], [-2.25, 0.5, 0.06]],
    tub: [[2.25, 0.46, 0.06], [2.29, 1.18, 0.1], [2.15, 1.34, 0.12], [0.98, 1.38, 0.03], [0.8, 1.38, 0.03], [-0.5, 1.38, 0.02], [-0.62, 1.38, 0.02], [-0.64, 0.98, 0.02], [-2.08, 0.98, 0.02], [-2.1, 1.38, 0.02], [-2.26, 1.3, 0.05], [-2.25, 0.46, 0.06]],
    cabin: [[0.92, 1.38], [0.56, 2.0], [-0.4, 2.02], [-0.5, 1.38]], pillar: null,
    taper: { f: 0.03, zf: 1.8, r: 0.0, zr: -2.0 }, seatZ: -0.02, bed: { z0: -0.62, z1: -2.08, y: 0.98 }, flares: true,
    front: { type: 'rect', y: 1.08, inset: 0.32, w: 0.36, h: 0.22 }, rear: { type: 'rect', y: 1.16, inset: 0.18, w: 0.18, h: 0.3 }, grille: { type: 'cromo', w: 1.1, h: 0.34, y: 1.06 }, bumper: 'cromo', bumperY: 0.62, plateY: 0.86,
    wheel: { w: 0.68, style: 'acero', rim: '#c9ced8', cap: '#c9ced8', tread: 'todoterreno' },
    paint: '#ff7a1a', accent: '#1f1e24', stock: { techo: 'cava' }, rails: true, plate: 'BUR·RO',
  },
  jeep: {
    W: 1.86, axles: [1.12, -1.06], R: 0.5, archR: 0.7, sill: 0.52, open: true,
    side: [[1.78, 0.52, 0.06], [1.82, 1.24, 0.08], [1.74, 1.38, 0.06], [0.52, 1.4, 0.05], [-1.66, 1.36, 0.06], [-1.73, 1.26, 0.06], [-1.73, 0.52, 0.06]],
    cabin: [[0.58, 1.4], [0.44, 2.02]], rollbarZ: -0.62, rollbarY: 2.05,
    taper: { f: 0.03, zf: 1.4, r: 0.0, zr: -1.5 }, seatZ: -0.12, flares: true, cargoZ: -1.2,
    front: { type: 'round', y: 1.1, inset: 0.4, r: 0.16 }, rear: { type: 'rect', y: 1.12, inset: 0.2, w: 0.18, h: 0.2 }, grille: { type: 'jeep', h: 0.52, y: 1.04 }, bumper: 'negro', bumperY: 0.64, plateY: 0.88,
    wheel: { w: 0.7, style: 'acero', rim: '#2a292f', cap: '#ff8a1f', tread: 'barro' },
    paint: '#3fa856', accent: '#1f1e24', stock: { frente: 'defensa' }, plate: 'CHI·GÜI',
  },
  hatch: {
    W: 1.9, axles: [1.22, -1.18], R: 0.44, archR: 0.57, sill: 0.34,
    side: [[1.95, 0.34, 0.1], [2.0, 0.76, 0.18], [1.68, 1.06, 0.34], [0.85, 1.13, 0.12], [-1.5, 1.15, 0.12], [-1.9, 1.05, 0.16], [-1.93, 0.34, 0.1]],
    cabin: [[0.84, 1.13], [0.02, 1.72], [-1.12, 1.75], [-1.6, 1.15]], pillar: -0.42,
    taper: { f: 0.1, zf: 1.25, r: 0.06, zr: -1.35 }, seatZ: -0.2,
    front: { type: 'rect', y: 0.88, inset: 0.4, w: 0.34, h: 0.15 }, rear: { type: 'rect', y: 0.94, inset: 0.3, w: 0.32, h: 0.14 }, grille: { type: 'malla', w: 0.86, h: 0.22, y: 0.6 }, bumper: 'negro', bumperY: 0.44, plateY: 0.66,
    wheel: { w: 0.64, style: 'cinco', rim: '#f1f0ec', cap: '#ffd23a' },
    paint: '#7b4dff', accent: '#ffd23a', stock: { aleron: 'techo', franjas: 'carrera', calcomania: 'numero' }, plate: 'CHIS·PA',
  },
  rustico: {
    W: 1.96, axles: [1.2, -1.15], R: 0.5, archR: 0.72, sill: 0.5,
    side: [[1.95, 0.5, 0.06], [1.99, 1.24, 0.08], [1.9, 1.34, 0.06], [0.75, 1.36, 0.06], [-1.8, 1.36, 0.06], [-1.87, 1.26, 0.06], [-1.87, 0.5, 0.06]],
    cabin: [[0.72, 1.36], [0.46, 2.04], [-1.55, 2.06], [-1.72, 1.36]], pillar: -0.48,
    taper: { f: 0.02, zf: 1.5, r: 0.0, zr: -1.6 }, seatZ: -0.18, flares: true,
    front: { type: 'round', y: 1.02, inset: 0.4, r: 0.16 }, rear: { type: 'rect', y: 1.12, inset: 0.24, w: 0.2, h: 0.24 }, grille: { type: 'jeep', h: 0.5, y: 0.98 }, bumper: 'negro', bumperY: 0.6, plateY: 0.86,
    wheel: { w: 0.68, style: 'acero', rim: '#c9ced8', cap: '#c9ced8', tread: 'todoterreno' },
    paint: '#f2efe6', accent: '#2f6bff', twoTone: true, stock: { techo: 'barra' }, plate: 'TE·PUY',
  },
  malibu: {
    W: 2.0, axles: [1.5, -1.42], R: 0.44, archR: 0.57, sill: 0.32,
    side: [[2.42, 0.32, 0.06], [2.47, 0.7, 0.08], [2.4, 1.07, 0.12], [1.2, 1.13, 0.1], [0.6, 1.14, 0.06], [-1.3, 1.15, 0.06], [-2.26, 1.1, 0.14], [-2.4, 0.72, 0.08], [-2.38, 0.32, 0.06]],
    cabin: [[0.58, 1.14], [-0.12, 1.62], [-1.02, 1.64], [-1.66, 1.15]], pillar: null,
    taper: { f: 0.04, zf: 1.9, r: 0.04, zr: -1.9 }, seatZ: -0.3,
    front: { type: 'quad', y: 0.88, inset: 0.3, r: 0.105 }, rear: { type: 'rect', y: 0.92, inset: 0.32, w: 0.42, h: 0.14 }, grille: { type: 'cromo', w: 1.16, h: 0.3, y: 0.86 }, bumper: 'cromo', bumperY: 0.52, plateY: 0.72,
    wheel: { w: 0.64, style: 'turbo', rim: '#dfe2e8', cap: '#e8323c' },
    paint: '#2f6bff', accent: '#f2efe6', twoTone: true, stock: { franjas: 'carrera', aleron: 'pato' }, plate: 'REI·NA',
  },
};

export const TALLER_NUMBERS = { escarabajo: 9, sedan: 10, buseta: 11, pickup: 12, jeep: 13, hatch: 14, rustico: 15, malibu: 16 };

// Prototype space -> toy space.
const Z = z => z * KZ;
function build(id, B) {
  const R = Math.max(0.6, B.R * 1.36), sill = B.sill * KY, archR = Math.max(R + 0.12, B.archR * KY);
  const Y = y => y * KY;
  const belt = Y(B.open ? B.cabin[0][1] : Math.max(B.cabin[0][1], B.cabin.at(-1)[1]));
  const CY = y => belt + (y - B.cabin[0][1]) * (B.kc ?? KC);
  const pts = list => list.map(([z, y, r]) => [Z(z), Y(y), r * 1.2]);
  const width = B.W * KW, W2 = width / 2;
  const wx = W2 - 0.12 + (B.flares ? 0.12 : 0);
  return (avatar, wheel, cfg = {}) => {
    const own = { r: R, ...B.wheel };
    const car = rig({ wheel: wheel ?? own, base: own, rim: RIMS[cfg.rin], wheelPos: [[wx, Z(B.axles[0]), true], [-wx, Z(B.axles[0]), true], [wx, Z(B.axles[1]), false], [-wx, Z(B.axles[1]), false]] });
    const c = car.chassis, paint = PAINT(B.paint), accent = PAINT(B.accent), trim = S('#1c1b21', { roughness: 0.55 });
    const fit = shellBody(car, {
      side: pts(B.side), tub: B.tub ? pts(B.tub) : undefined, width, axles: B.axles.map(Z), hub: R, archR, sill,
      slab: B.slab ?? 0.34, taper: { f: B.taper.f, zf: Z(B.taper.zf), r: B.taper.r, zr: Z(B.taper.zr) }, paint, bevel: 0.06,
    });
    if (B.flares) for (const z of B.axles.map(Z)) for (const s of [1, -1]) {
      const f = archFlare(archR - 0.02, 0.62, trim, 0.15, 0.12);
      f.position.set(s * (wx + 0.04), R, z);
      c.add(f);
    }
    if (B.fenders) for (const z of B.axles.map(Z)) for (const s of [1, -1]) {
      const f = archFlare(archR - 0.02, 0.66, paint, 0.16, 0.08);
      f.position.set(s * wx, R, z);
      c.add(f);
    }

    // the greenhouse, with the pana at the wheel
    const G = B.cabin.map(([z, y]) => [Z(z), CY(y)]);
    const top = B.open ? null : G.slice(1, -1);
    const roofMat = B.twoTone ? accent : paint;
    let glass, roof;
    if (B.open) {
      const zb = Z(B.rollbarZ);
      glass = [[zb - 0.3, belt], G[0], G[1], [zb - 0.3, G[1][1]]];
    } else {
      glass = [G.at(-1), G[0], G[1], G.at(-2)];
      const r = B.smooth ? 0.34 : 0.12;
      roof = [[G[1][0] + 0.06, G[1][1] - 0.06, 0.03], ...top.map(([z, y]) => [z, y + 0.16, r]), [G.at(-2)[0] - 0.06, G.at(-2)[1] - 0.06, 0.03]];
    }
    const zCab = (G[0][0] + G.at(-1)[0]) / 2;
    cabin(car, {
      open: B.open, glass, roof, width: width - 0.26,
      bPillar: B.pillar != null ? Z(B.pillar) : (G[0][0] + G.at(-1)[0]) / 2 - 0.1,
      pillar: B.open ? trim : roofMat, roofMat,
      interior: '#2b2732', seat: B.twoTone ? '#c99662' : '#2b2732',
      avatar, head: 0.5, seatY: belt - 0.66, driverZ: Z(B.seatZ), sill: belt,
    });
    for (const pz of B.extraPillars ?? []) for (const s of [1, -1]) c.add(rbox(0.1, CY(2.2) - belt - 0.05, 0.12, roofMat, s * (W2 - 0.16), (belt + CY(2.2)) / 2, Z(pz), 0.03));
    if (B.open) {
      // the roll bar behind the seats, braced to the tub
      const zb = Z(B.rollbarZ), yb = belt + (B.rollbarY - B.cabin[0][1]) * KC * 0.8, hx = W2 - 0.24;
      for (const s of [1, -1]) {
        c.add(tube([s * hx, belt - 0.05, zb], [s * hx, yb - 0.2, zb], 0.07, trim));
        c.add(tube([s * hx, yb - 0.2, zb], [s * (hx - 0.2), yb, zb], 0.07, trim));
        c.add(tube([s * hx, yb - 0.24, zb], [s * hx, belt, zb - 0.9], 0.055, trim));
      }
      c.add(tube([-(hx - 0.2), yb, zb], [hx - 0.2, yb, zb], 0.07, trim));
      car.fit.roof = { zF: zb + 0.15, zR: zb - 0.15, top: yb + 0.07, half: hx - 0.1, y: () => yb + 0.07 };
      car.fit.cargo = { z: Z(B.cargoZ), y: fit.topOf(Z(B.cargoZ)) - 0.02, half: 0.7, len: 0.8 };
    }
    if (B.bed) {
      const z0 = Z(B.bed.z0), z1 = Z(B.bed.z1), by = Y(B.bed.y);
      car.fit.bed = { zF: z0 + 0.04, zR: z1 - 0.04 };
      car.fit.cargo = { z: (z0 + z1) / 2, y: by + 0.02, half: 0.75, len: z0 - z1 - 0.2 };
      c.add(rbox(width - 0.62, 0.05, z0 - z1 - 0.06, M('#5a3a22'), 0, by + 0.03, (z0 + z1) / 2, 0.02));
      for (let k = -2; k <= 2; k++) c.add(rbox(0.05, 0.04, z0 - z1 - 0.1, M('#9a6338'), k * 0.3, by + 0.06, (z0 + z1) / 2, 0.015));
    }

    // lamps, grille and bumpers sit on the body wherever its faces are
    const F = B.front, fy = Y(F.y), fz = fit.noseZ(fy);
    for (const s of [1, -1]) {
      if (F.type === 'bug') {
        const eye = domeLamp(0.24, LENS(), paint, 0.26);
        eye.position.set(s * W2 * 0.7, fy + 0.2, fit.noseZ(fy + 0.2) - 0.12);
        eye.rotation.x = -0.3;
        c.add(eye);
        continue;
      }
      const x = s * (fit.halfW(fz) - F.inset * KW);
      if (F.type === 'rect') {
        const l = rectLamp(F.w * KW, F.h * KY, LENS(), trim);
        l.position.set(x, fy, fz - 0.02);
        c.add(l);
      } else if (F.type === 'quad') {
        for (const dx of [0, -0.3]) {
          const l = domeLamp(F.r * 1.3, LENS(), CHROME(), 0.12);
          l.position.set(x + s * dx, fy, fit.noseZ(fy) - 0.01);
          c.add(l);
        }
      } else {
        const l = domeLamp(F.r * 1.4, LENS(), CHROME(), 0.14);
        l.position.set(x, fy, fz - 0.01);
        c.add(l);
      }
      c.add(rbox(0.2, 0.08, 0.05, AMBER(), s * (fit.halfW(fz) - 0.2), fy - 0.22, fit.noseZ(fy - 0.22), 0.02));
    }
    const Rr = B.rear, ry = Y(Rr.y), rz = fit.tailZ(ry);
    for (const s of [1, -1]) {
      const x = s * (fit.halfW(rz) - Rr.inset * KW);
      const l = Rr.type === 'round' ? domeLamp(Rr.r * 1.5, TAIL(), CHROME(), 0.1) : rectLamp(Rr.w * KW, Rr.h * KY, TAIL(), trim);
      l.position.set(x, ry, rz + 0.01);
      l.rotation.y = Math.PI;
      c.add(l);
    }
    const gr = B.grille;
    if (gr !== 'ninguna') {
      const gy = Y(gr.y), gz = fit.noseZ(gy);
      if (gr.type === 'malla') {
        c.add(rbox(gr.w * KW, gr.h * KY, 0.06, M('#0e0d11'), 0, gy, gz, 0.03));
        for (let k = 0; k < 5; k++) c.add(rbox(gr.w * KW - 0.06, 0.025, 0.04, M('#34323b'), 0, gy - gr.h * KY / 2 + 0.05 + k * 0.06, gz + 0.03, 0.01));
        c.add(rbox(gr.w * KW + 0.06, 0.04, 0.04, CHROME(), 0, gy + gr.h * KY / 2, gz + 0.01, 0.015));
      } else if (gr.type === 'jeep') {
        for (let k = 0; k < 7; k++) c.add(rbox(0.08, gr.h * KY, 0.06, trim, (k - 3) * 0.14, gy, gz + 0.01, 0.03));
      } else {
        const gw = gr.w * KW, gh = gr.h * KY;
        c.add(rbox(gw + 0.08, gh + 0.08, 0.04, CHROME(), 0, gy, gz - 0.01, 0.03));
        c.add(rbox(gw, gh, 0.05, trim, 0, gy, gz + 0.01, 0.02));
        for (let k = 0; k < 4; k++) c.add(rbox(gw - 0.05, 0.04, 0.05, CHROME(), 0, gy - gh / 2 + 0.06 + k * (gh - 0.12) / 3, gz + 0.04, 0.015));
      }
    }
    const chrome = B.bumper === 'cromo', bmat = chrome ? CHROME() : trim, bh = chrome ? 0.17 : 0.28, by0 = Y(B.bumperY);
    for (const dir of [1, -1]) {
      const g = new THREE.Group(), z = (dir > 0 ? fit.noseZ(by0) : fit.tailZ(by0)) + dir * 0.06, w = 2 * fit.halfW(z) + 0.06;
      g.add(rbox(w, bh, 0.24, bmat, 0, by0, z, 0.07));
      if (chrome) for (const s of [1, -1]) g.add(rbox(0.18, bh, 0.4, bmat, s * (w / 2 - 0.06), by0, z - dir * 0.09, 0.07));
      const p = plate(B.plate);
      p.position.set(0, dir > 0 ? Y(B.plateY) - 0.24 : Y(B.plateY), (dir > 0 ? fit.noseZ(Y(B.plateY) - 0.24) : fit.tailZ(Y(B.plateY))) + dir * 0.13);
      if (dir < 0) p.rotation.y = Math.PI;
      g.add(p);
      detachable(car, g);
    }
    // doors, handles and mirrors
    for (const s of [1, -1]) {
      if (!B.open) for (const z of [G[0][0] - 0.06, B.pillar != null ? Z(B.pillar) - 0.03 : G.at(-1)[0] + 0.08]) {
        c.add(rbox(0.012, belt - sill - 0.24, 0.02, trim, s * (fit.halfW(z) + 0.004), (belt + sill) / 2 + 0.04, z, 0.005));
      }
      c.add(rbox(0.04, 0.05, 0.2, CHROME(), s * (fit.halfW(zCab) + 0.02), belt - 0.16, zCab, 0.02));
      const m = new THREE.Group();
      const mz = G[0][0] - 0.12;
      m.add(rbox(0.16, 0.06, 0.07, trim, s * (fit.halfW(mz) - 0.02), belt + 0.08, mz, 0.02));
      m.add(rbox(0.1, 0.2, 0.26, B.open ? trim : paint, s * (fit.halfW(mz) + 0.1), belt + 0.16, mz - 0.02, 0.05));
      detachable(car, m);
    }
    if (B.rails) {
      // wooden stake rails round the bed
      const rails = new THREE.Group(), wood = M('#9a6338', { roughness: 0.85 }), z0 = Z(B.bed.z0), z1 = Z(B.bed.z1);
      const top = Y(Math.max(...B.side.map(p => p[1]))) + 0.06;   // the bed walls, not its floor
      for (const s of [1, -1]) {
        for (let k = 0; k < 4; k++) rails.add(rbox(0.09, 0.56, 0.09, wood, s * (W2 - 0.16), top + 0.28, z0 - 0.2 - k * (z0 - z1 - 0.3) / 3, 0.02));
        for (const y of [top + 0.24, top + 0.5]) rails.add(rbox(0.07, 0.09, z0 - z1 - 0.1, wood, s * (W2 - 0.16), y, (z0 + z1) / 2, 0.02));
      }
      detachable(car, rails);
    }

    // stock parts unless the garage asks for something else
    const own2 = B.stock ?? {};
    if (own2.aleron && stock(cfg, 'aleron')) spoiler(car, own2.aleron, accent);
    if (own2.techo && stock(cfg, 'techo')) roofCargo(car, own2.techo);
    if (own2.frente && stock(cfg, 'frente')) frente(car, own2.frente);
    if (own2.calcomania && stock(cfg, 'calcomania')) decal(car, own2.calcomania, TALLER_NUMBERS[id], B.accent);
    if (own2.franjas && stock(cfg, 'franjas')) stripes(car, own2.franjas, B.accent);
    return car;
  };
}

export const TALLER_BUILDERS = Object.fromEntries(Object.entries(BODIES).map(([id, B]) => [id, build(id, B)]));
