// The Pana cars: one smooth, data-driven builder for all sixteen, shared by
// Carreritas's garage and Bululú's ¡Choque de carritos!. Each car is a spec:
// a lofted lower body (car-shell.js lowerBody) with real wheel arches, an
// optional greenhouse shell with glass, then lamps, grille, bumpers and trim
// placed on the actual surface by raycasting (car-build.js), plus a few
// hand-made extras that give each car its character. Shared parts live in
// car-kit.js; the driver is the player's pana.
// Every car faces +Z, its left is +X, wheels touch y = 0.

import * as THREE from 'three';
import {
  M, S, DECAL, CHROME, DARK, PAINT, LENS, AMBER, TAIL, mesh, rbox, tube, plate, roundel, flower, spot,
  rig, detachable, spareWheel, domeLamp, rectLamp, archFlare, venezuelaFlag, batchStatic, makeWheel,
} from '/engine/models/vehicles/car-kit.js';
import { lowerBody, greenhouse } from '/engine/models/vehicles/car-shell.js';
import { surface, stick, orient, ribbon, sweep, roundRect, wrapPath, openWindshield, seatDriver, hollowCabin, GLASS2, sweptFender } from '/engine/models/vehicles/car-build.js';
import { dress, stock, RIMS, spoiler, roofCargo, decal, stripes, frente } from '/engine/models/vehicles/car-parts.js';

const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
const lerp = (a, b, t) => a + (b - a) * t;
const TRIM = () => S('#1c1b21', { roughness: 0.55 });
const UNDER = () => S('#141418', { roughness: 0.95 });
const WHITE = () => S('#f6f1e4', { roughness: 0.4, ...DECAL });

// ---------- shared dressing ----------

function lamp(kind, opts, lens) {
  const { r = 0.16, w = 0.3, h = 0.2, bezel = CHROME(), depth = 0.12 } = opts;
  if (kind === 'rect') return rectLamp(w, h, lens, bezel);
  if (kind === 'roundSq') {
    const g = new THREE.Group();
    g.add(rbox(w, h, 0.1, bezel, 0, 0, 0, 0.05));
    const d = domeLamp(r, lens, CHROME(), 0.08);
    d.position.z = 0.05;
    g.add(d);
    return g;
  }
  return domeLamp(r, lens, bezel, depth);
}

// lamps / grille / bumpers / plates / mirrors / handles / seams from the spec
function dressBody(ctx) {
  const { car, c, D, surf, fit, paint, trim } = ctx;
  const F = D.front ?? {}, Rr = D.rear ?? {};
  for (const s of [1, -1]) {
    for (const L of [].concat(F.lamps ?? [])) {
      const xs = L.pair ? [L.x, L.x - L.pair] : [L.x];
      for (const x of xs) {
        const h = surf.front(s * x, L.y);
        if (h) c.add(stick(lamp(L.type, { ...L, bezel: L.bezel === 'paint' ? paint : L.bezel === 'trim' ? trim : L.bezel ?? CHROME() }, L.lens?.() ?? LENS()), h, L.inset ?? 0.0));
      }
    }
    for (const L of [].concat(F.ind ?? [])) {
      const h = surf.front(s * L.x, L.y);
      if (h) c.add(stick(rbox(L.w ?? 0.2, L.h ?? 0.08, 0.06, AMBER(), 0, 0, 0, 0.025), h, 0.0));
    }
    for (const L of [].concat(Rr.lamps ?? [])) {
      const h = surf.rear(s * L.x, L.y);
      if (h) c.add(stick(lamp(L.type, { ...L, bezel: L.bezel === 'trim' ? trim : L.bezel === 'paint' ? paint : L.bezel ?? CHROME() }, TAIL()), h, 0.0));
    }
  }
  // grille
  const G = F.grille;
  if (G) {
    const h = surf.front(0, G.y);
    if (h) {
      const g = new THREE.Group(), w = G.w, hh = G.h;
      if (G.type === 'cromo') {
        g.add(rbox(w + 0.1, hh + 0.1, 0.06, CHROME(), 0, 0, 0, 0.04));
        g.add(rbox(w, hh, 0.06, trim, 0, 0, 0.012, 0.025));
        const n = G.bars ?? 3;
        for (let k = 0; k < n; k++) g.add(rbox(w - 0.06, 0.035, 0.05, CHROME(), 0, -hh / 2 + (k + 1) * hh / (n + 1), 0.03, 0.015));
      } else if (G.type === 'bars') {
        g.add(rbox(w, hh, 0.07, trim, 0, 0, 0, 0.04));
        const n = G.bars ?? 3;
        for (let k = 0; k < n; k++) g.add(rbox(w - 0.08, 0.04, 0.05, CHROME(), 0, -hh / 2 + (k + 1) * hh / (n + 1), 0.035, 0.018));
      } else if (G.type === 'malla') {
        g.add(rbox(w, hh, 0.06, S('#0e0d11', { roughness: 0.8 }), 0, 0, 0, 0.04));
        for (let k = 0; k < 5; k++) g.add(rbox(w - 0.08, 0.026, 0.04, S('#3a3842'), 0, -hh / 2 + 0.05 + k * (hh - 0.1) / 4, 0.025, 0.01));
        g.add(rbox(w + 0.05, 0.045, 0.045, CHROME(), 0, hh / 2, 0.01, 0.02));
      } else if (G.type === 'jeep') {
        const n = G.slots ?? 7;
        for (let k = 0; k < n; k++) g.add(rbox(0.085, hh, 0.07, trim, (k - (n - 1) / 2) * (G.gap ?? 0.14), 0, 0, 0.035));
      }
      c.add(stick(g, h, -0.005));
    }
  }
  // bumpers
  for (const [end, B] of [[1, D.bumpers?.front], [-1, D.bumpers?.rear]]) {
    if (!B || (end > 0 && B.stock && !stock(ctx.cfg, B.stock))) continue;
    const g = new THREE.Group();
    const chrome = B.type === 'cromo', mat = chrome ? CHROME() : B.type === 'paint' ? paint : trim;
    const bh = B.h ?? (chrome ? 0.17 : 0.26), bd = B.d ?? (chrome ? 0.16 : 0.24);
    const frames = wrapPath(surf, fit, B.y, end, { spread: B.spread ?? 1.2, gap: bd / 2 - (B.sink ?? 0.03), inset: B.inset ?? 0.35 });
    if (frames.length > 3) g.add(sweep(frames, roundRect(bd, bh, Math.min(bd, bh) * 0.42, 4), mat));
    if (B.guards) for (const s of [1, -1]) {
      const h = surf.front ? (end > 0 ? surf.front(s * B.guards, B.y) : surf.rear(s * B.guards, B.y)) : null;
      if (h) g.add(stick(rbox(0.16, bh * 2.4, 0.2, B.guardMat?.() ?? CHROME(), 0, 0, 0, 0.06), h, bd * 0.6));
    }
    const P = end > 0 ? D.plateF : D.plateR;
    if (P !== false && D.plate) {
      const py = P?.y ?? B.y, onBumper = !P || P.onBumper;
      const h = onBumper ? (frames[Math.floor(frames.length / 2)] && { p: frames[Math.floor(frames.length / 2)].p.clone().addScaledVector(frames[Math.floor(frames.length / 2)].u, bd / 2 + 0.006), n: frames[Math.floor(frames.length / 2)].u })
        : (end > 0 ? surf.front(0, py) : surf.rear(0, py));
      if (h) { const pl = plate(D.plate); stick(pl, h, onBumper ? 0 : 0.008); (onBumper ? g : c).add(pl); }
    }
    if (B.detach === false) c.add(g); else detachable(car, g);
  }
  // sides: seams, handles, trim, mirrors
  const belt = fit.belt ?? fit.topOf(0);
  for (const s of [1, -1]) {
    for (const z of D.doors ?? []) {
      const hits = [];
      for (let k = 0; k <= 10; k++) hits.push(surf.side(s, z, lerp(fit.sill + 0.16, belt - 0.05, k / 10)));
      const r = ribbon(hits, 0.018, trim, 0.003);
      if (r) c.add(r);
    }
    for (const H of [].concat(D.handles ?? [])) {
      const h = surf.side(s, H.z, H.y ?? belt - 0.16);
      if (h) c.add(stick(rbox(0.22, 0.05, 0.05, CHROME(), 0, 0, 0, 0.022), h, 0.01));
    }
    for (const T of D.trim ?? []) {
      const hits = [];
      // keep to the flank: stop where the line would roll onto the hood or deck
      for (let k = 0; k <= 30; k++) { const h = surf.side(s, lerp(T.z0, T.z1, k / 30), T.y); hits.push(h && Math.abs(h.n.y) < 0.45 && Math.abs(h.n.x) > 0.6 ? h : null); }
      let run = [];
      for (const h of [...hits, null]) {
        if (h) { run.push(h); continue; }
        if (run.length > 3) { const r = ribbon(run, T.w ?? 0.04, T.mat?.() ?? CHROME(), T.off ?? 0.006); if (r) c.add(r); }
        run = [];
      }
    }
    if (D.mirror !== false) {
      const Mi = D.mirror ?? {}, z = Mi.z ?? (fit.cabin ? fit.cabin.zF - 0.16 : 0.5), y = Mi.y ?? belt - 0.04;
      // A mirror set high on the door frame misses the lower body: try the
      // cabin, then the body's side at that height, rather than lose it.
      const h = surf.side(s, z, y) ?? ctx.cabinSurf?.side(s, z, y) ?? { p: V(s * fit.halfW(z), y, z), n: V(s, 0, 0) };
      if (h) {
        const m = new THREE.Group(), out = V(s, 0, 0);
        const a = h.p.clone(), b = a.clone().add(V(s * 0.2, 0.14, -0.02));
        m.add(tube(a.toArray(), b.toArray(), 0.03, Mi.stem?.() ?? TRIM()));
        if (Mi.type === 'ball') m.add(mesh(new THREE.SphereGeometry(0.15, 24, 16), Mi.mat?.() ?? S('#1d1d23', { roughness: 0.35 }), b.x + s * 0.04, b.y + 0.04, b.z));
        else m.add(orient(rbox(0.28, 0.2, 0.1, Mi.mat?.() ?? (Mi.paint ? paint : TRIM()), b.x + s * 0.05, b.y + 0.06, b.z, 0.05), out.clone().set(0, 0, 1)));
        detachable(car, m);
      }
    }
  }
}

// flared black arches (jeep, pickup, rústico)
function flares(ctx, { w = 0.5, lip = 0.15, drop = 0.1 } = {}) {
  const { c, fit, trim } = ctx;
  for (const z of fit.axles) for (const s of [1, -1]) {
    const f = archFlare(fit.arch + 0.01, w, trim, lip, drop);
    f.position.set(s * (fit.halfW(z) - w / 2 + 0.1), fit.hub, z);
    c.add(f);
  }
}

// Stripe running over the top surface at x offsets, skipping the greenhouse.
function topStripe(ctx, { x = 0, w = 0.5, z0, z1, mat, step = 0.06 }) {
  const { surf, fit } = ctx, hits = [], runs = [];
  const cab = fit.cabin;
  for (let z = z1; z >= z0; z -= step) {
    const inCab = cab && z < cab.zF + 0.05 && z > cab.zR - 0.05;
    const h = inCab ? null : surf.top(x, z);
    if (!h) { if (hits.length > 1) runs.push(hits.splice(0)); else hits.length = 0; continue; }
    hits.push(h);
  }
  if (hits.length > 1) runs.push(hits);
  for (const r of runs) { const m = ribbon(r, w, mat, 0.006); if (m) ctx.c.add(m); }
}

function sideDecal(ctx, make, z, y, off = 0.008) {
  for (const s of [1, -1]) {
    const h = ctx.surf.side(s, z, y);
    if (h) ctx.c.add(stick(make(), h, off));
  }
}

// ---------- the generic car ----------
function buildCar(id, D) {
  return (avatar, wheel, cfg = {}) => {
    const own = D.wheel, X = D.track;
    const car = rig({
      wheel: wheel ?? own, base: own, rim: RIMS[cfg.rin],
      wheelPos: [[X, D.axles[0], true], [-X, D.axles[0], true], [X, D.axles[1], false], [-X, D.axles[1], false]],
    });
    const c = car.chassis;
    const paint = PAINT(D.paint), accent = PAINT(D.accent ?? '#f2efe6'), trim = TRIM(), under = UNDER();
    car.paint = paint;
    const H0 = D.cabin.hollow ? { z0: D.cabin.zWR + 0.12, z1: D.cabin.zWF - 0.1, hw: D.cabin.hwB - 0.07 } : null;
    const body = lowerBody({ ...D.body, axles: D.body.arches === false ? [] : D.axles, hub: own.r, opening: H0 });
    const geos = [body.geo.paint];
    c.add(mesh(body.geo.paint, D.bodyMat === 'accent' ? accent : paint));
    if (body.geo.under) c.add(mesh(body.geo.under, under));
    car.fit = { ...car.fit, ...body.fit };
    for (const f of D.pontoons ?? []) {
      const p = lowerBody({ stations: 56, ...f, hub: own.r });
      p.geo.paint.translate(f.x, 0, 0);   // paint and under share one position buffer
      if (p.geo.under) p.geo.under.computeBoundingSphere();
      c.add(mesh(p.geo.paint, f.mat === 'trim' ? trim : paint));
      if (p.geo.under) c.add(mesh(p.geo.under, under));
      geos.push(p.geo.paint);
    }
    for (const f of D.fenders ?? []) for (const s of [1, -1]) {
      const m = sweptFender({ ...f, x: s * f.x, hub: own.r, mat: f.tone === 'accent' ? accent : f.tone === 'trim' ? trim : paint });
      c.add(m);
      geos.push(m.geometry);
    }
    const surf = surface(geos);
    const fit = car.fit;
    const ctx = { car, c, D, cfg, surf, fit, paint, accent, trim, under, id };

    // greenhouse
    const K = D.cabin;
    let belt = K.belt;
    if (belt == null) {
      belt = Infinity;
      for (let k = 0; k <= 8; k++) {
        const z = lerp(K.zWR, K.zWF, k / 8);
        for (const x of [0, K.hwB * 0.97]) { const h = surf.top(x, z); if (h) belt = Math.min(belt, h.p.y); }
      }
      belt -= 0.025;
    }
    fit.belt = belt;
    const roofMat = K.tone === 'accent' ? accent : paint;
    let roofInner = null, windshieldTop;
    if (!K.open) {
      const g = greenhouse({ ...K, belt, openSide: K.openSide ?? 1 });
      c.add(mesh(g.shell, roofMat));
      c.add(mesh(g.lining, S(D.headliner ?? '#d8d0bd', { roughness: 0.95 })));
      const gl = mesh(g.glass, GLASS2);
      gl.castShadow = false;
      gl.renderOrder = 2;
      c.add(gl);
      fit.roof = g.roof;
      fit.cabin = { zF: K.zWF, zR: K.zWR, width: 2 * K.hwB, open: false };
      roofInner = g.innerRoof;
      windshieldTop = [g.innerRoof(K.zRF - 0.15) - 0.14, K.zRF - 0.18];
      ctx.greenhouse = g;
      ctx.cabinSurf = surface([g.shell]);
    } else {
      const y1 = K.top, z1 = K.zTop;
      if (!K.noWindshield) openWindshield(c, { y0: belt + 0.02, y1, z0: K.zWF, z1, half: K.hwB, mat: K.frame === 'chrome' ? CHROME() : trim });
      if (K.hollow) roofInner = K.roofless ? null : () => y1 - 0.06;
      fit.cabin = { zF: K.zWF, zR: K.zWR, width: 2 * K.hwB, open: true };
      windshieldTop = [y1 - 0.18, z1 - 0.12];
    }
    if (K.hollow) hollowCabin(car, {
      belt, zDash: K.zWF, zBack: K.zWR, opening: H0, axles: D.body.arches === false ? [] : D.axles, archR: D.body.archR ?? 0.8, hub: own.r, track: D.track, tireW: own.w,
      visorHalf: (K.hwR ?? K.hwB) - (K.rs ?? 0.18) * 0.6,
      driverZ: K.driverZ, roofInner, glassZ: K.open ? (K.noWindshield ? (() => K.zWF + 0.4) : (y => lerp(K.zWF, K.zTop, (y - belt) / (K.top - belt)))) : (y => lerp(K.zWF, K.zRF, (y - belt) / (K.roof - belt))), pillarR: K.open ? 0 : (K.rnF ?? 0.1),
      interior: D.interior, seat: D.seat, accent: D.trimColor ?? D.paint, avatar, mirror: windshieldTop, hanging: D.hanging, cargo: K.cargo,
      dashPaint: K.dashPaint === 'paint' ? D.paint : K.dashPaint, wheel: K.wheel, wheelColor: K.wheelColor, gauges: K.gauges, harness: K.harness,
      cargoItem: K.cargoItem, rows: K.rows, open: !!K.open, minFloor: K.minFloor ?? (D.body.sill + 0.08), decor: K.decor ? (api => K.decor(api, ctx)) : null,
    });
    else seatDriver(car, {
      belt, zDash: K.zWF, zBack: K.zWR, width: 2 * K.hwB - 0.12, driverZ: K.driverZ, seatY: belt - 0.66,
      glassZ: K.open ? (y => lerp(K.zWF, K.zTop, (y - belt) / (K.top - belt))) : (y => lerp(K.zWF, K.zRF, (y - belt) / (K.roof - belt))),
      pillarR: K.open ? 0 : (K.rnF ?? 0.1),
      visorHalf: (K.hwR ?? K.hwB) - (K.rs ?? 0.18) * 0.6,
      roofInner, interior: D.interior ?? '#2b2732', seat: D.seat ?? '#2b2732', accent: D.trimColor ?? D.paint, avatar, sill: belt, surf, open: !!K.open,
      mirror: windshieldTop, hanging: D.hanging,
    });

    dressBody(ctx);
    D.extras?.(ctx);
    car.surf = surf;
    // stock garage parts unless the garage asks for something else
    const own2 = D.stock ?? {};
    if (own2.aleron && stock(cfg, 'aleron')) spoiler(car, own2.aleron, D.spoilerMat === 'paint' ? paint : accent);
    if (own2.techo && stock(cfg, 'techo')) roofCargo(car, own2.techo);
    if (own2.frente && stock(cfg, 'frente')) frente(car, own2.frente);
    if (own2.calcomania && stock(cfg, 'calcomania')) decal(car, own2.calcomania, D.num, D.accent);
    if (own2.franjas && stock(cfg, 'franjas')) stripes(car, own2.franjas, D.accent);
    return car;
  };
}

// ---------- the sixteen ----------
// Dimensions are toy units (about 4.5 long, 2.3 wide). body: see lowerBody;
// cabin: see greenhouse (zWF/zRF windshield base/top z, zWR/zRR rear glass).

const SPECS = {
  // El Chamo: a red Mini-style hatch, bull bar, antenna flag, white stripes
  chamo: {
    num: 1, paint: '#e0262f', accent: '#fbf8f0',
    wheel: { r: 0.69, w: 0.68, style: 'spokes', rim: '#6b707e', cap: '#e0262f' }, track: 1.14, axles: [1.32, -1.32],
    body: {
      width: 2.3, zF: 2.32, zR: -2.32, sill: 0.44, archR: 0.82, archFillet: 0.06,
      top: [[-2.32, 1.5], [-2.0, 1.58], [-0.4, 1.6], [0.9, 1.58], [1.6, 1.5], [2.32, 1.3]],
      rs: 0.16, sq: 3.6, rb: 0.1, crown: 0.03, tumble: 0.05, bulge: 0.02, taper: { f: 0.05, r: 0.03 },
      nose: { r: 0.3, kTop: 0.9, kBot: 0.28, rake: [[0, 0.06], [0.45, 0], [1, 0.1]] },
      tail: { r: 0.26, kTop: 0.8, kBot: 0.28, rake: [[0, 0.04], [0.5, 0], [1, 0.03]] },
    },
    cabin: { zWF: 0.95, zRF: 0.3, zWR: -1.96, zRR: -1.72, roof: 2.9, hwB: 1.04, hwR: 0.95, rs: 0.14, sq: 3.4, crown: 0.04, pillars: [{ z: -0.62, w: 0.16 }], cMargin: 0.22, driverZ: 0.02, hollow: true },
    interior: '#2b2b33', seat: '#18181d',
    front: {
      lamps: [{ type: 'round', x: 0.66, y: 1.0, r: 0.21 }, { type: 'round', x: 0.3, y: 0.66, r: 0.085, depth: 0.08 }],
      ind: { x: 0.68, y: 0.7, w: 0.14, h: 0.08 },
      grille: { type: 'bars', w: 0.78, h: 0.3, y: 0.95, bars: 3 },
    },
    rear: { lamps: { type: 'round', x: 0.78, y: 1.1, r: 0.14 } },
    bumpers: { front: { type: 'negro', y: 0.56, h: 0.2, d: 0.2, spread: 1.0 }, rear: { type: 'negro', y: 0.6, h: 0.26, d: 0.26 } },
    plate: 'PANA·01', plateR: { y: 0.98 }, plateF: false,
    doors: [0.92, -0.6], handles: { z: -0.38, y: 1.32 }, mirror: { type: 'ball', z: 0.8 },
    hanging(p) { p.add(mesh(new THREE.ConeGeometry(0.09, 0.2, 12), M('#2fbf71'), 0, -0.32, 0)); },
    extras(ctx) {
      const { c, car, surf, fit, paint, cfg } = ctx, deep = PAINT('#a8141c');
      if (stock(cfg, 'franjas')) for (const x of [0.2, -0.2]) topStripe(ctx, { x, w: 0.15, z0: 1.12, z1: 2.25, mat: WHITE() });
      for (const s of [1, -1]) {
        const h = surf.top(s * 0.6, 1.45);
        if (h) c.add(stick(rbox(0.34, 0.18, 0.05, DARK(), 0, 0, 0, 0.02), h, 0.005));
        c.add(rbox(0.42, 0.34, 0.04, DARK(), s * (ctx.D.track), 0.36, -2.08, 0.02));   // mud flaps
        c.add(rbox(0.16, 0.12, 1.1, deep, s * (fit.halfW(0) - 0.02), fit.sill + 0.12, 0.0, 0.05));
      }
      if (stock(cfg, 'calcomania')) {
        sideDecal(ctx, () => roundel(1, 0.34), 0.15, 1.02);
        const top = roundel(1, 0.44), h = surf.top ? ctx.cabinSurf.top(0, -0.62) : null;
        if (h) c.add(stick(top, h, 0.006));
      }
      const pipe = mesh(new THREE.CylinderGeometry(0.075, 0.085, 0.4, 20), CHROME(), -0.6, 0.46, fit.tailZ(0.46) - 0.06);
      pipe.rotation.x = Math.PI / 2;
      c.add(pipe);
      // bull bar with the front plate
      if (stock(cfg, 'frente')) {
        const bar = new THREE.Group(), steel = S('#202026', { roughness: 0.4, metalness: 0.35 }), z = fit.noseZ(0.7) + 0.2;
        for (const s of [1, -1]) {
          bar.add(tube([s * 0.55, 0.42, z], [s * 0.55, 1.3, z - 0.04], 0.075, steel));
          bar.add(tube([s * 0.55, 0.9, z - 0.02], [s * 0.55, 0.9, z - 0.3], 0.055, steel));
          bar.add(mesh(new THREE.SphereGeometry(0.075, 16, 12), steel, s * 0.55, 1.3, z - 0.04));
        }
        bar.add(tube([0.55, 1.3, z - 0.04], [-0.55, 1.3, z - 0.04], 0.075, steel));
        bar.add(rbox(1.6, 0.28, 0.24, steel, 0, 0.6, z, 0.08));
        const pl = plate('PANA·01');
        pl.position.set(0, 0.6, z + 0.125);
        bar.add(pl);
        detachable(car, bar);
      }
      // antenna with its pennant
      const antenna = new THREE.Group(), ah = ctx.cabinSurf.top(0.72, -1.2);
      const ay = ah ? ah.p.y : 2.85;
      antenna.add(mesh(new THREE.CylinderGeometry(0.02, 0.035, 1.15, 10), DARK(), 0.72, ay + 0.57, -1.2));
      antenna.add(mesh(new THREE.SphereGeometry(0.06, 14, 10), DARK(), 0.72, ay + 1.16, -1.2));
      const flagShape = new THREE.Shape([new THREE.Vector2(0, 0), new THREE.Vector2(-0.62, -0.17), new THREE.Vector2(0, -0.36)]);
      const flag = mesh(new THREE.ShapeGeometry(flagShape), M('#ffd23f', { side: THREE.DoubleSide }), 0.72, ay + 1.06, -1.2);
      flag.rotation.y = -Math.PI / 2;
      antenna.add(flag);
      detachable(car, antenna);
      car.flag = flag;
      if (stock(cfg, 'aleron')) {
        const r = fit.roof, s = new THREE.Shape();
        s.moveTo(0.1, 0); s.lineTo(-0.3, 0.02); s.quadraticCurveTo(-0.38, 0.02, -0.4, -0.05); s.lineTo(0.06, -0.06); s.closePath();
        const lip = mesh(new THREE.ExtrudeGeometry(s, { depth: 1.9, bevelEnabled: true, bevelSize: 0.03, bevelThickness: 0.03, bevelSegments: 3, curveSegments: 8 }), deep);
        lip.geometry.rotateY(-Math.PI / 2); lip.geometry.translate(0.95, 0, 0);
        lip.position.set(0, r.y(r.zR + 0.05) - 0.01, r.zR + 0.05);
        c.add(lip);
      }
    },
  },

  // La Lancha: a long two-tone 50s sedan, chrome everywhere, a bit of rust
  lancha: {
    num: 2, paint: '#1f9e8e', accent: '#f3e2bf',
    wheel: { r: 0.64, w: 0.62, style: 'hubcap' }, track: 1.1, axles: [1.38, -1.38],
    body: {
      width: 2.26, zF: 2.4, zR: -2.4, sill: 0.4, archR: 0.76, archFillet: 0.06,
      top: [[-2.4, 1.2], [-2.05, 1.33], [-1.4, 1.37], [0.9, 1.36], [1.7, 1.32], [2.4, 1.17]],
      rs: 0.15, sq: 3.4, rb: 0.1, crown: 0.03, tumble: 0.04, bulge: 0.03, taper: { f: 0.04, r: 0.04 },
      nose: { r: 0.26, kTop: 0.8, kBot: 0.3, rake: [[0, 0.04], [0.5, 0], [1, 0.06]] },
      tail: { r: 0.24, kTop: 0.7, kBot: 0.3, rake: [[0, 0.03], [0.5, 0], [1, 0.03]] },
    },
    cabin: { zWF: 0.78, zRF: 0.14, zWR: -1.5, zRR: -1.0, roof: 2.94, hwB: 1.02, hwR: 0.92, rs: 0.17, sq: 3, crown: 0.05, pillars: [{ z: -0.36, w: 0.14 }], cMargin: 0.16, tone: 'accent', driverZ: 0.02, hollow: true, cargo: false },
    interior: '#3b2a22', seat: '#7a4a2b',
    front: {
      lamps: { type: 'rect', x: 0.84, y: 0.94, w: 0.3, h: 0.3, bezel: CHROME() },
      ind: { x: 1.0, y: 0.66, w: 0.16, h: 0.1 },
      grille: { type: 'cromo', w: 1.08, h: 0.32, y: 0.86, bars: 4 },
    },
    rear: { lamps: { type: 'rect', x: 0.78, y: 0.98, w: 0.36, h: 0.14, bezel: CHROME() } },
    bumpers: { front: { type: 'negro', y: 0.55, h: 0.28, d: 0.28, guards: 0.55 }, rear: { type: 'negro', y: 0.55, h: 0.28, d: 0.28, guards: 0.55 } },
    plate: 'LAN·CHA', plateR: { y: 0.8 },
    doors: [0.72, -0.36], handles: [{ z: 0.5, y: 1.18 }, { z: -0.62, y: 1.18 }],
    trim: [{ y: 1.28, z0: -2.1, z1: 2.1 }], mirror: { mat: CHROME, stem: CHROME, z: 0.62 },
    hanging(p) {
      for (const s of [1, -1]) {
        const die = rbox(0.13, 0.13, 0.13, M('#fbf8f0'), s * 0.07, -0.3 - (s > 0 ? 0 : 0.05), 0, 0.03);
        die.rotation.set(0.4 * s, 0.5, 0.2);
        p.add(die);
      }
    },
    extras(ctx) {
      const { c, surf, cfg } = ctx;
      const h = surf.top(0, 2.1);
      if (h) c.add(stick(mesh(new THREE.ConeGeometry(0.05, 0.18, 16).rotateX(Math.PI / 2), CHROME()), h, 0.05));
      if (stock(cfg, 'calcomania')) sideDecal(ctx, () => roundel(2, 0.32), 0.18, 0.9);
      sideDecal(ctx, () => new THREE.Mesh(new THREE.PlaneGeometry(0.46, 0.1), M('#c9ccd4', DECAL)), -0.85, 1.12);
      const rust = '#b4562a';
      for (const [y, z, size] of [[0.66, -0.7, 0.17], [0.76, -1.0, 0.13], [0.62, 0.55, 0.11], [1.15, 1.73, 0.13], [1.0, 0.5, 0.1]]) sideDecal(ctx, () => spot(size, rust), z, y, 0.006);
      for (const [x, z, size] of [[0.55, 1.75, 0.11], [-0.3, 1.45, 0.08], [-0.45, -1.8, 0.1]]) { const t = surf.top(x, z); if (t) c.add(stick(spot(size, rust), t, 0.006)); }
      const lock = surf.rear(0, 1.02);
      if (lock) c.add(stick(rbox(0.12, 0.08, 0.04, CHROME(), 0, 0, 0, 0.015), lock, 0.01));
    },
  },

  // El Machito: the short hardtop 4x4, flat bonnet, rack of lamps, spare out back
  machito: {
    num: 3, paint: '#ffc629', accent: '#ede4cf',
    wheel: { r: 0.72, w: 0.66, style: 'steel', rim: '#c1c2cd' }, track: 1.1, axles: [1.25, -1.25],
    body: {
      width: 2.2, zF: 2.26, zR: -2.24, sill: 0.52, archR: 0.85, archFillet: 0.05,
      top: [[-2.24, 1.6], [1.7, 1.62], [2.26, 1.56]],
      rs: 0.07, sq: 6, rb: 0.06, crown: 0.02, tumble: 0.02, bulge: 0, taper: { f: 0.02, r: 0.0 },
      nose: { r: 0.12, kTop: 1, kBot: 0.3 }, tail: { r: 0.1, kTop: 1, kBot: 0.3 },
    },
    cabin: { zWF: 0.62, zRF: 0.48, zWR: -2.1, zRR: -2.08, roof: 2.92, hwB: 1.06, hwR: 1.02, rs: 0.07, sq: 6, crown: 0.02, rnF: 0.07, rnR: 0.07, pillars: [{ z: -0.62, w: 0.15 }, { z: -1.5, w: 0.12 }], cMargin: 0.1, tone: 'accent', driverZ: -0.15, hollow: true },
    interior: '#3b3c39', seat: '#494b44',
    front: {
      lamps: { type: 'roundSq', x: 0.82, y: 1.2, r: 0.15, w: 0.46, h: 0.44, bezel: S('#ede4cf', { roughness: 0.5 }) },
      ind: { x: 0.82, y: 0.88, w: 0.3, h: 0.08 },
      grille: { type: 'bars', w: 1.0, h: 0.44, y: 1.18, bars: 4 },
    },
    rear: { lamps: { type: 'rect', x: 0.84, y: 1.02, w: 0.2, h: 0.28, bezel: 'trim' } },
    bumpers: { rear: { type: 'negro', y: 0.62, h: 0.22, d: 0.24, spread: 1.0 } },
    plate: 'MA·CHITO', plateR: { y: 1.0 }, plateF: false,
    doors: [0.6, -0.62], handles: { z: -0.43, y: 1.45 }, mirror: { z: 0.5, y: 1.85 },
    extras(ctx) {
      const { c, car, surf, fit, cfg, trim, accent } = ctx, rubber = trim;
      for (const s of [1, -1]) {
        c.add(rbox(0.3, 0.1, 1.4, rubber, s * (fit.halfW(-0.08) + 0.02), fit.sill + 0.02, -0.08, 0.04));   // steps
        sideDecal(ctx, () => new THREE.Mesh(new THREE.PlaneGeometry(1.9, 0.07), M('#ede4cf', DECAL)), -0.94, 0.93, 0.006);
      }
      const vent = surf.top(0, 1.45);
      if (vent) c.add(stick(rbox(0.66, 0.26, 0.06, rubber, 0, 0, 0, 0.03), vent, 0.01));
      if (stock(cfg, 'frente')) {
        const b = new THREE.Group(), z = fit.noseZ(0.66) + 0.12;
        b.add(rbox(2.36, 0.28, 0.3, rubber, 0, 0.66, z, 0.08));
        b.add(rbox(0.66, 0.24, 0.3, S('#697273', { roughness: 0.5, metalness: 0.3 }), 0, 0.88, z + 0.06, 0.06));
        for (const s of [1, -1]) {
          b.add(rbox(0.2, 0.24, 0.14, S('#3b3e46'), s * 0.82, 0.58, z + 0.16, 0.04));
          const loop = mesh(new THREE.TorusGeometry(0.1, 0.035, 12, 24), CHROME(), s * 0.82, 0.46, z + 0.22);
          b.add(loop);
        }
        detachable(car, b);
      }
      const sp = spareWheel(0.58, 0.38);
      sp.position.set(0.3, 1.3, fit.tailZ(1.3) - 0.2);
      detachable(car, sp);
      const snorkel = new THREE.Group(), sz = 0.98, sx = -(fit.halfW(sz) + 0.06);
      snorkel.add(tube([sx, 1.36, sz], [sx, 2.0, sz - 0.1], 0.08, rubber));
      snorkel.add(tube([sx, 2.0, sz - 0.1], [sx + 0.02, 2.5, sz - 0.42], 0.08, rubber));
      snorkel.add(rbox(0.24, 0.22, 0.3, rubber, sx + 0.02, 2.58, sz - 0.46, 0.08));
      detachable(car, snorkel);
      if (stock(cfg, 'techo')) {
        const r = fit.roof, rack = new THREE.Group(), y = r.top;
        for (const s of [1, -1]) rack.add(rbox(0.09, 0.12, 2.1, rubber, s * 0.8, y + 0.12, -0.75, 0.04));
        for (const z of [-1.6, 0.12]) rack.add(rbox(1.7, 0.08, 0.1, rubber, 0, y + 0.14, z, 0.03));
        rack.add(rbox(1.9, 0.09, 0.12, rubber, 0, y + 0.2, 0.2, 0.04));
        for (let i = 0; i < 4; i++) {
          const l = domeLamp(0.17, S('#ffe7a1', { emissive: '#ffbf43', emissiveIntensity: 0.65 }), rubber, 0.2);
          l.position.set((i - 1.5) * 0.46, y + 0.42, 0.26);
          rack.add(l);
        }
        detachable(car, rack);
      }
      void accent;
    },
  },

  // La Bala: the blue rally hatch, white centre stripe, wing and light pods
  bala: {
    num: 4, paint: '#3d7bf2', accent: '#f3e9d7',
    wheel: { r: 0.65, w: 0.66, style: 'spokes', rim: '#d8ddea', cap: '#ff4b4b' }, track: 1.14, axles: [1.3, -1.3],
    body: {
      width: 2.26, zF: 2.3, zR: -2.26, sill: 0.4, archR: 0.79, archFillet: 0.06,
      top: [[-2.26, 1.24], [-1.9, 1.36], [0.9, 1.4], [1.7, 1.3], [2.3, 1.02]],
      rs: 0.15, sq: 3.2, rb: 0.1, crown: 0.03, tumble: 0.05, bulge: 0.02, taper: { f: 0.05, r: 0.03 },
      nose: { r: 0.3, kTop: 1, kBot: 0.28, rake: [[0, 0.06], [0.4, 0], [1, 0.16]] },
      tail: { r: 0.25, kTop: 0.8, kBot: 0.28, rake: [[0, 0.03], [0.5, 0], [1, 0.06]] },
    },
    cabin: { zWF: 0.9, zRF: 0.3, zWR: -1.82, zRR: -1.56, roof: 2.68, hwB: 1.03, hwR: 0.93, rs: 0.15, sq: 3.2, crown: 0.04, pillars: [{ z: -0.55, w: 0.15 }], cMargin: 0.2, driverZ: 0.0, hollow: true },
    interior: '#22222a', seat: '#18181d',
    front: {
      lamps: { type: 'rect', x: 0.78, y: 1.02, w: 0.3, h: 0.22, bezel: 'trim' },
      grille: { type: 'malla', w: 1.0, h: 0.22, y: 0.92 },
    },
    rear: { lamps: { type: 'rect', x: 0.8, y: 1.04, w: 0.26, h: 0.14, bezel: 'trim' } },
    bumpers: { front: { type: 'paint', y: 0.55, h: 0.22, d: 0.3, spread: 1.15 }, rear: { type: 'negro', y: 0.56, h: 0.22, d: 0.24 } },
    plate: 'BALA·4', plateR: { y: 0.9 }, plateF: false,
    doors: [0.73], handles: { z: -0.32, y: 1.25 }, mirror: { paint: true, z: 0.76 },
    extras(ctx) {
      const { c, car, surf, fit, cfg, paint } = ctx;
      if (stock(cfg, 'franjas')) {
        const white = WHITE();
        topStripe(ctx, { x: 0, w: 0.5, z0: -2.1, z1: 2.22, mat: white });
        const roof = ctx.cabinSurf, hits = [];
        for (let z = fit.roof.zF + 0.05; z > fit.roof.zR - 0.08; z -= 0.06) hits.push(roof.top(0, z));
        const r = ribbon(hits, 0.5, white, 0.006);
        if (r) c.add(r);
        const nose = [];
        for (let y = 0.7; y < 1.0; y += 0.04) nose.push(surf.front(0, y));
        const n = ribbon(nose, 0.5, white, 0.006);
        if (n) c.add(n);
      }
      for (const s of [1, -1]) {
        c.add(rbox(0.16, 0.16, 1.3, PAINT('#1c3770'), s * (fit.halfW(0) - 0.02), fit.sill + 0.08, 0, 0.06));
        c.add(rbox(0.44, 0.3, 0.05, S('#172947'), s * ctx.D.track, 0.34, -2.05, 0.02));
      }
      if (stock(cfg, 'calcomania')) sideDecal(ctx, () => roundel(4, 0.27), 0.02, 0.95);
      if (stock(cfg, 'frente')) {
        const g = new THREE.Group(), z = fit.noseZ(0.6) + 0.2;
        g.add(rbox(1.6, 0.09, 0.13, DARK(), 0, 0.62, z, 0.04));
        for (const x of [-0.47, 0, 0.47]) { const l = domeLamp(0.18, S('#ffe7a1', { emissive: '#ffbf43', emissiveIntensity: 0.65 }), DARK(), 0.2); l.position.set(x, 0.84, z + 0.04); g.add(l); }
        detachable(car, g);
      }
      if (stock(cfg, 'aleron')) {
        const r = fit.roof, z = r.zR - 0.05, y = r.y(r.zR + 0.1);
        const wing = new THREE.Group();
        for (const s of [1, -1]) wing.add(rbox(0.08, 0.3, 0.14, DARK(), s * 0.6, y + 0.12, z, 0.03));
        const s2 = new THREE.Shape();
        s2.moveTo(0.24, 0); s2.bezierCurveTo(0.1, 0.06, -0.15, 0.07, -0.26, 0.01); s2.bezierCurveTo(-0.12, -0.03, 0.1, -0.03, 0.24, 0);
        const foil = mesh(new THREE.ExtrudeGeometry(s2, { depth: 1.9, bevelEnabled: true, bevelSize: 0.02, bevelThickness: 0.02, bevelSegments: 3, curveSegments: 10 }), paint);
        foil.geometry.rotateY(-Math.PI / 2); foil.geometry.translate(0.95, 0, 0);
        foil.position.set(0, y + 0.3, z - 0.05);
        wing.add(foil);
        for (const s of [1, -1]) wing.add(rbox(0.05, 0.24, 0.5, DARK(), s * 1.0, y + 0.3, z - 0.05, 0.02));
        detachable(car, wing);
      }
    },
  },

  // El Toro: the red pickup, chrome face, wooden rails and a cooler in the bed
  toro: {
    num: 5, paint: '#e0262f', accent: '#f3e9d7',
    wheel: { r: 0.73, w: 0.72, style: 'steel', rim: '#aeb7c7' }, track: 1.18, axles: [1.45, -1.4],
    body: {
      width: 2.32, zF: 2.48, zR: -2.44, sill: 0.5, archR: 0.87, archFillet: 0.05,
      top: [[-2.44, 1.06], [-0.84, 1.06], [-0.6, 1.5], [1.05, 1.5], [1.9, 1.46], [2.48, 1.34]],
      rs: 0.1, sq: 5, rb: 0.08, crown: 0.02, tumble: 0.03, bulge: 0.01, taper: { f: 0.03, r: 0 },
      nose: { r: 0.15, kTop: 1, kBot: 0.3, rake: [[0, 0.03], [0.5, 0], [1, 0.04]] }, tail: { r: 0.1, kTop: 0.6, kBot: 0.3 },
    },
    cabin: { zWF: 0.85, zRF: 0.4, zWR: -0.62, zRR: -0.58, roof: 2.74, hwB: 1.06, hwR: 0.99, rs: 0.1, sq: 4.5, crown: 0.03, rnR: 0.08, pillars: [], cMargin: 0.26, driverZ: 0.12, hollow: true, cargo: false },
    interior: '#2b2b33', seat: '#7a4a2b',
    front: {
      lamps: { type: 'rect', x: 0.9, y: 1.04, w: 0.32, h: 0.32, bezel: CHROME() },
      grille: { type: 'cromo', w: 1.2, h: 0.38, y: 0.98, bars: 3 },
    },
    rear: { lamps: { type: 'rect', x: 0.92, y: 1.3, w: 0.2, h: 0.34, bezel: 'trim' } },
    bumpers: { rear: { type: 'cromo', y: 0.62, h: 0.2, d: 0.18, spread: 1.0 } },
    plate: 'TORO·5', plateR: { onBumper: true }, plateF: false,
    doors: [0.8, -0.56], handles: { z: -0.3, y: 1.36 }, mirror: { mat: CHROME, stem: CHROME, z: 0.74 },
    extras(ctx) {
      const { c, car, fit, cfg, paint, trim } = ctx;
      const z0 = -0.7, z1 = fit.tailZ(0.9) + 0.02, W2 = fit.halfW(-1.5);
      // the bed: walls, tailgate and a wooden floor
      fit.bed = { zF: z0, zR: z1 };
      fit.cargo = { z: (z0 + z1) / 2, y: 1.12, half: 0.7, len: z0 - z1 - 0.3 };
      for (const s of [1, -1]) c.add(rbox(0.14, 0.66, z0 - z1, paint, s * (W2 - 0.07), 1.18, (z0 + z1) / 2, 0.06));
      c.add(rbox(2 * W2 - 0.06, 0.66, 0.14, paint, 0, 1.18, z1 + 0.07, 0.06));
      c.add(rbox(2 * W2 - 0.2, 0.62, 0.12, paint, 0, 1.18, z0 + 0.04, 0.05));
      c.add(rbox(2 * W2 - 0.3, 0.05, z0 - z1 - 0.2, S('#6b3b22', { roughness: 0.85 }), 0, 1.08, (z0 + z1) / 2, 0.02));
      for (const x of [-0.7, -0.35, 0, 0.35, 0.7]) c.add(rbox(0.05, 0.04, z0 - z1 - 0.26, S('#a7653b', { roughness: 0.8 }), x, 1.12, (z0 + z1) / 2, 0.015));
      c.add(rbox(0.4, 0.07, 0.04, CHROME(), 0, 1.38, z1, 0.015));
      if (stock(cfg, 'franjas')) {
        for (const s of [1, -1]) {
          const hits = [];
          for (let k = 0; k <= 40; k++) hits.push(ctx.surf.side(s, lerp(-2.25, 2.25, k / 40), 0.86));
          const r = ribbon(hits, 0.26, WHITE(), 0.006);
          if (r) c.add(r);
        }
      }
      for (const s of [1, -1]) c.add(rbox(0.3, 0.1, 1.2, trim, s * (fit.halfW(0.1) + 0.04), fit.sill + 0.0, 0.1, 0.04));
      if (stock(cfg, 'techo')) {
        const r = fit.roof, g = new THREE.Group();
        g.add(rbox(1.6, 0.1, 0.14, DARK(), 0, r.top + 0.06, 0.15, 0.04));
        for (const x of [-0.49, 0, 0.49]) { const l = domeLamp(0.17, S('#ffe7a1', { emissive: '#ffbf43', emissiveIntensity: 0.65 }), DARK(), 0.2); l.position.set(x, r.top + 0.28, 0.18); g.add(l); }
        detachable(car, g);
        const cooler = new THREE.Group();
        cooler.add(rbox(0.88, 0.56, 0.64, S('#eb454d', { roughness: 0.45 }), 0.35, 1.4, -1.3, 0.08));
        cooler.add(rbox(0.93, 0.12, 0.7, S('#f3e9d7', { roughness: 0.45 }), 0.35, 1.72, -1.3, 0.05));
        cooler.add(rbox(0.3, 0.07, 0.08, S('#f3e9d7'), 0.35, 1.81, -1.3, 0.03));
        detachable(car, cooler);
      }
      const rails = new THREE.Group(), wood = S('#9a6a3a', { roughness: 0.85 });
      for (const s of [1, -1]) {
        for (const z of [z0 - 0.06, (z0 + z1) / 2, z1 + 0.1]) rails.add(rbox(0.08, 0.46, 0.08, wood, s * (W2 - 0.07), 1.72, z, 0.02));
        for (const y of [1.72, 1.92]) rails.add(rbox(0.06, 0.08, z0 - z1 - 0.02, wood, s * (W2 - 0.07), y, (z0 + z1) / 2, 0.02));
      }
      detachable(car, rails);
      if (stock(cfg, 'frente')) {
        const b = new THREE.Group(), z = fit.noseZ(0.62) + 0.12;
        b.add(sweep(wrapPath(ctx.surf, fit, 0.62, 1, { spread: 1.1, gap: 0.08 }), roundRect(0.2, 0.24, 0.09), CHROME()));
        for (const s of [1, -1]) b.add(rbox(0.16, 0.76, 0.2, DARK(), s * 0.58, 0.98, z + 0.16, 0.06));
        b.add(rbox(1.3, 0.13, 0.2, DARK(), 0, 1.36, z + 0.16, 0.05));
        const pl = plate('TORO·5'); pl.position.set(0, 0.62, z + 0.12); b.add(pl);
        detachable(car, b);
      }
    },
  },

  // La Familiar: the green family sedan with its roof rack loaded
  familiar: {
    num: 6, paint: '#3f9d4a', accent: '#e3dfc2',
    wheel: { r: 0.63, w: 0.59, style: 'hubcap' }, track: 1.1, axles: [1.38, -1.38],
    body: {
      width: 2.26, zF: 2.38, zR: -2.38, sill: 0.4, archR: 0.75, archFillet: 0.06,
      top: [[-2.38, 1.2], [-2.0, 1.32], [0, 1.36], [1.1, 1.34], [1.8, 1.28], [2.38, 1.13]],
      rs: 0.15, sq: 3.4, rb: 0.1, crown: 0.03, tumble: 0.04, bulge: 0.03, taper: { f: 0.04, r: 0.04 },
      nose: { r: 0.26, kTop: 0.8, kBot: 0.3, rake: [[0, 0.04], [0.5, 0], [1, 0.07]] },
      tail: { r: 0.24, kTop: 0.7, kBot: 0.3, rake: [[0, 0.03], [0.5, 0], [1, 0.05]] },
    },
    cabin: { zWF: 0.8, zRF: 0.2, zWR: -1.52, zRR: -1.16, roof: 2.8, hwB: 1.02, hwR: 0.92, rs: 0.16, sq: 3, crown: 0.05, pillars: [{ z: -0.4, w: 0.14 }], cMargin: 0.18, driverZ: 0.05, hollow: true, cargo: false },
    interior: '#3b2a22', seat: '#c9b38a',
    front: {
      lamps: { type: 'rect', x: 0.84, y: 0.94, w: 0.3, h: 0.3, bezel: CHROME() },
      grille: { type: 'cromo', w: 1.1, h: 0.3, y: 0.86, bars: 3 },
    },
    rear: { lamps: { type: 'rect', x: 0.84, y: 1.0, w: 0.3, h: 0.18, bezel: CHROME() } },
    bumpers: { front: { type: 'cromo', y: 0.55, h: 0.2, d: 0.18 }, rear: { type: 'cromo', y: 0.55, h: 0.2, d: 0.18 } },
    plate: 'FAM·6', plateR: { y: 0.8 },
    doors: [0.78, -0.4], handles: [{ z: 0.55, y: 1.12 }, { z: -0.66, y: 1.12 }],
    trim: [{ y: 1.22, z0: -2.1, z1: 2.1 }, { y: 0.56, z0: -0.5, z1: 0.55, w: 0.08, mat: () => S('#e3dfc2', { roughness: 0.4 }) }],
    mirror: { mat: CHROME, stem: CHROME, z: 0.66 },
    hanging(p) {
      const bead = M('#7a4a2b');
      for (let i = 0; i < 10; i++) { const a = i / 10 * Math.PI * 2; p.add(mesh(new THREE.SphereGeometry(0.025, 10, 8), bead, Math.sin(a) * 0.07, -0.3 + Math.cos(a) * 0.07, 0)); }
      p.add(rbox(0.025, 0.12, 0.02, M('#d9a441'), 0, -0.44, 0, 0.006));
      p.add(rbox(0.07, 0.025, 0.02, M('#d9a441'), 0, -0.42, 0, 0.006));
    },
    extras(ctx) {
      const { c, car, fit, cfg } = ctx, r = fit.roof, y = r.top;
      const rack = DARK();
      for (const s of [1, -1]) c.add(rbox(0.06, 0.06, 1.5, rack, s * 0.75, y + 0.06, -0.46, 0.02));
      for (const z of [0.2, -0.46, -1.12]) c.add(rbox(1.56, 0.05, 0.06, rack, 0, y + 0.07, z, 0.02));
      for (const s of [1, -1]) {
        c.add(tube([s * 0.81, y + 0.06, 0.26], [s * 0.81, y + 0.3, 0.26], 0.035, CHROME()));
        c.add(tube([s * 0.81, y + 0.06, -1.18], [s * 0.81, y + 0.3, -1.18], 0.035, CHROME()));
        c.add(tube([s * 0.81, y + 0.3, 0.26], [s * 0.81, y + 0.3, -1.18], 0.035, CHROME()));
      }
      if (stock(cfg, 'techo')) {
        const suitcase = (w, h, d, color, x, yy, z) => {
          const g = new THREE.Group();
          g.add(rbox(w, h, d, S(color, { roughness: 0.7 }), x, yy, z, 0.07));
          for (const side of [-1, 1]) {
            g.add(rbox(0.06, h + 0.02, d + 0.02, M('#2b1d14'), x + side * w * 0.3, yy, z, 0.02));
            g.add(rbox(0.085, 0.07, 0.025, CHROME(), x + side * w * 0.3, yy + 0.03, z + d / 2 + 0.02, 0.01));
          }
          g.add(rbox(0.2, 0.05, 0.08, M('#2b1d14'), x, yy + h / 2 + 0.02, z, 0.02));
          return g;
        };
        detachable(car, suitcase(0.92, 0.38, 0.67, '#8b5a2b', -0.28, y + 0.29, -0.25));
        detachable(car, suitcase(0.72, 0.32, 0.55, '#d9772b', -0.28, y + 0.64, -0.3));
        const pot = new THREE.Group(), steel = S('#c9ccd4', { metalness: 0.6, roughness: 0.3 });
        pot.add(mesh(new THREE.CylinderGeometry(0.24, 0.22, 0.3, 28), steel, 0.48, y + 0.25, -0.8));
        pot.add(mesh(new THREE.CylinderGeometry(0.26, 0.26, 0.04, 28), steel, 0.48, y + 0.42, -0.8));
        pot.add(mesh(new THREE.SphereGeometry(0.05, 14, 10), DARK(), 0.48, y + 0.47, -0.8));
        detachable(car, pot);
      }
    },
  },

  // La Rumbera: the pink beetle with a sound system and the flag
  // La Rumbera: a pink 50s convertible cruiser. Long and low with tailfins,
  // a big chrome grille, wraparound bumpers, whitewalls,
  // the top down so the party cabin shows, and the sound system on the trunk.
  rumbera: {
    num: 7, paint: '#ff4fa3', accent: '#fbf3ea', trimColor: '#ffffff',
    wheel: { r: 0.62, w: 0.6, style: 'disco', rim: '#f1f0ec', cap: '#ff4fa3' }, track: 1.06, axles: [1.5, -1.5],
    body: {
      width: 2.32, zF: 2.62, zR: -2.66, sill: 0.4, archR: 0.74, archFillet: 0.05,
      top: [[-2.66, 1.2], [-2.3, 1.3], [-1.2, 1.32], [0.9, 1.3], [2.0, 1.24], [2.62, 1.08]],
      rs: 0.12, sq: 3.8, rb: 0.1, crown: 0.025, tumble: 0.05, bulge: 0.04, taper: { f: 0.05, r: 0.03 },
      nose: { r: 0.22, kTop: 0.8, kBot: 0.3, rake: [[0, 0.06], [0.5, 0], [1, 0.08]] },
      tail: { r: 0.2, kTop: 0.7, kBot: 0.3, rake: [[0, 0.04], [0.5, 0], [1, 0.02]] },
    },
    cabin: {
      open: true, hollow: true, roofless: true, frame: 'chrome', zWF: 0.72, zWR: -1.42, top: 2.12, zTop: 0.42, hwB: 1.02, driverZ: 0.04,
      wheel: 'fuzzy', wheelColor: '#ff79c6', gauges: 'pair', cargo: false,
      decor({ add, floor, dashTop, faceZ, frontZ, humpX, z0, z1, H }) {
        const neonP = M('#ff4fd0', { emissive: '#ff2fc0', emissiveIntensity: 1.2 }), neonC = M('#5ff6ff', { emissive: '#21d8ff', emissiveIntensity: 1.2 });
        for (const sx of [1, -1]) add(rbox(0.025, 0.02, z1 - z0 - 0.3, neonP, sx * (humpX - 0.03), floor + 0.015, (z0 + z1) / 2, 0.008));
        add(rbox(1.3, 0.02, 0.025, neonC, 0, floor + H * 0.35, faceZ - 0.01, 0.008));
        // a mini Venezuelan flag on the dash
        const fx = 0.12, fz = frontZ - 0.2, fy = dashTop + 0.04;
        add(mesh(new THREE.CylinderGeometry(0.03, 0.035, 0.03, 14), S('#1a1a1e'), fx, fy, fz));
        add(tube([fx, fy, fz], [fx, fy + 0.26, fz], 0.006, S('#d8d8de', { metalness: 0.6 })));
        [['#ffd23f', 0.24], ['#1d4e89', 0.2], ['#e0262f', 0.16]].forEach(([col, y]) => {
          const pl = mesh(new THREE.PlaneGeometry(0.15, 0.04), M(col, { side: THREE.DoubleSide }), fx + 0.077, fy + y, fz);
          pl.rotation.y = Math.PI / 2 - 0.3; add(pl);
        });
        // maracas on the passenger dash
        for (const [k, col] of [[0, '#ffd23f'], [1, '#3fbf6f']]) {
          add(mesh(new THREE.SphereGeometry(0.04, 14, 10), S(col, { roughness: 0.5 }), -0.5 + k * 0.1, dashTop + 0.07, frontZ - 0.2 - k * 0.05));
          add(tube([-0.5 + k * 0.1, dashTop + 0.03, frontZ - 0.2 - k * 0.05], [-0.42 + k * 0.1, dashTop + 0.01, frontZ - 0.32 - k * 0.05], 0.012, S('#8a5f30')));
        }
      },
    },
    interior: '#3a2a33', seat: '#ff8ac6',
    front: {
      lamps: { type: 'round', x: 0.82, y: 0.98, r: 0.16 },
      grille: { type: 'cromo', w: 1.16, h: 0.3, y: 0.82, bars: 5 },
    },
    rear: { lamps: { type: 'round', x: 0.86, y: 1.02, r: 0.08, bezel: CHROME() } },
    bumpers: { front: { type: 'cromo', y: 0.56, h: 0.2, d: 0.2, spread: 1.25 }, rear: { type: 'cromo', y: 0.58, h: 0.2, d: 0.2, spread: 1.25 } },
    plate: 'RUM·BA', plateR: { y: 0.82 }, plateF: { onBumper: true },
    doors: [0.66, -0.75], handles: { z: -0.5, y: 1.18 },
    trim: [{ y: 0.98, z0: -2.2, z1: 1.9, w: 0.05 }],
    mirror: { mat: CHROME, stem: CHROME, z: 0.58 },
    stock: { calcomania: 'flor' },
    extras(ctx) {
      const { c, car, fit, cfg, surf, paint, accent } = ctx;
      const chrome = CHROME();
      // tailfins: a thin rising blade over each rear quarter with a bullet lamp
      for (const s of [1, -1]) {
        const sh = new THREE.Shape();
        sh.moveTo(-1.2, 0); sh.quadraticCurveTo(-1.9, 0.02, -2.45, 0.46); sh.lineTo(-2.62, 0.48); sh.quadraticCurveTo(-2.6, 0.2, -2.5, 0); sh.closePath();
        const g = new THREE.ExtrudeGeometry(sh, { depth: 0.1, bevelEnabled: true, bevelSize: 0.04, bevelThickness: 0.04, bevelSegments: 4, curveSegments: 16 });
        g.rotateY(-Math.PI / 2);
        g.translate(0.05, 0, 0);
        const fin = mesh(g, paint, s * (fit.halfW(-2.0) - 0.12), fit.topOf(-2.0) - 0.06, 0);
        c.add(fin);
        const bullet = mesh(new THREE.SphereGeometry(0.07, 20, 14), TAIL(), s * (fit.halfW(-2.0) - 0.12), fit.topOf(-2.0) + 0.3, -2.62);
        bullet.scale.set(1, 1, 1.6);
        c.add(bullet);
        c.add(mesh(new THREE.TorusGeometry(0.075, 0.015, 10, 24), chrome, s * (fit.halfW(-2.0) - 0.12), fit.topOf(-2.0) + 0.3, -2.58));
        // white side panel inside the chrome spear
        const hits = [];
        for (let k = 0; k <= 24; k++) { const h = surf.side(s, lerp(-0.9, 1.0, k / 24), 0.86); hits.push(h && Math.abs(h.n.x) > 0.6 ? h : null); }
        const r = ribbon(hits.filter(Boolean), 0.16, S('#fbf3ea', { roughness: 0.35, ...DECAL }), 0.005);
        if (r) c.add(r);
      }
      // bumper bullets on the grille
      for (const s of [1, -1]) {
        const h = surf.front(s * 0.38, 0.66);
        if (h) { const b = mesh(new THREE.ConeGeometry(0.07, 0.2, 20).rotateX(Math.PI / 2), chrome); c.add(stick(b, h, 0.12)); }
      }
      // hood ornament
      const ho = surf.top(0, 2.3);
      if (ho) { const orn = mesh(new THREE.ConeGeometry(0.04, 0.22, 16).rotateX(-Math.PI / 2 + 0.4), chrome); c.add(stick(orn, ho, 0.04)); }
      // the sound system on the trunk deck, and the flag
      const tz = -2.0, ty = fit.topOf(tz);
      fit.cargo = { z: tz, y: ty, half: 0.8, len: 0.8 };
      if (stock(cfg, 'techo')) {
        const sp = new THREE.Group();
        sp.add(rbox(1.6, 0.5, 0.56, S('#1d1d23', { roughness: 0.5 }), 0, ty + 0.27, tz, 0.08));
        for (const [x, rr] of [[-0.5, 0.2], [0.5, 0.2], [0, 0.13]]) {
          const cone = mesh(new THREE.CylinderGeometry(rr, rr * 0.7, 0.06, 28), M('#4a4a52'), x, ty + 0.27, tz + 0.27);
          cone.rotation.x = Math.PI / 2; sp.add(cone);
          sp.add(mesh(new THREE.TorusGeometry(rr + 0.025, 0.025, 10, 28), M('#ff8a1f'), x, ty + 0.27, tz + 0.3));
          const dust = mesh(new THREE.SphereGeometry(rr * 0.4, 18, 10), DARK(), x, ty + 0.27, tz + 0.29); dust.scale.z = 0.4; sp.add(dust);
        }
        sp.add(rbox(1.62, 0.05, 0.58, M('#ff4fd0', { emissive: '#ff2fc0', emissiveIntensity: 1.1 }), 0, ty + 0.03, tz, 0.02));
        detachable(car, sp);
      }
      const fg = new THREE.Group();
      fg.add(mesh(new THREE.CylinderGeometry(0.02, 0.025, 1.4, 10), DARK(), 0.86, ty + 0.7, -2.45));
      const flag = mesh(new THREE.PlaneGeometry(0.78, 0.52), venezuelaFlag(), 0.86, ty + 1.12, -2.86);
      flag.material.side = THREE.DoubleSide; flag.rotation.y = Math.PI / 2;
      fg.add(flag);
      detachable(car, fg);
      car.flag = flag;
      void accent;
    },
  },

  // El Montañero: a mountain side-by-side (UTV). A rounded body between
  // outboard wheels, swept fenders, a full roll cage with a roof panel, half
  // doors, racing buckets with harnesses, a digital dash, and a cargo bed
  // with the spare, jerry can and shovel. Camo stays.
  montanero: {
    num: 8, paint: '#6b7a3a', accent: '#3d4628', trimColor: '#b8d000',
    wheel: { r: 0.76, w: 0.74, style: 'steel', rim: '#2e3236', cap: '#b8d000', tread: 'barro' }, track: 1.27, axles: [1.4, -1.35],
    body: {
      arches: false, width: 1.76, zF: 2.32, zR: -2.12, sill: 0.62,
      top: [[-2.12, 1.38], [-1.2, 1.42], [0.9, 1.42], [1.55, 1.34], [2.32, 1.08]],
      rs: 0.14, sq: 3.4, rb: 0.12, crown: 0.03, tumble: 0.06, bulge: 0.03, taper: { f: 0.14, zf: 0.6, r: 0.04, zr: -1.4 },
      nose: { r: 0.3, kTop: 1, kBot: 0.5, rake: [[0, 0.16], [0.5, 0], [1, 0.12]], bulge: 0.04 },
      tail: { r: 0.18, kTop: 0.9, kBot: 0.5, rake: [[0, 0.06], [0.5, 0], [1, 0.03]] },
    },
    fenders: [
      { x: 1.27, axle: 1.4, r: 0.86, w: 0.8, thick: 0.14, a0: -0.25, a1: Math.PI - 0.15, tone: 'accent' },
      { x: 1.27, axle: -1.35, r: 0.86, w: 0.8, thick: 0.14, a0: 0.15, a1: Math.PI + 0.25, tone: 'accent' },
    ],
    cabin: {
      open: true, hollow: true, noWindshield: true, zWF: 0.86, zWR: -1.08, top: 2.62, zTop: 0.5, hwB: 0.84, driverZ: -0.12,
      harness: true, gauges: 'digital', wheel: 'sport', cargo: false,
      decor({ add, dashTop, faceZ, frontZ, dx, floor, seatZ, seatD, metal, rubber, Ys }) {
        // passenger grab bar, a phone/GPS on the dash, fire extinguisher by the seats
        add(tube([-dx - 0.24, dashTop - 0.1, faceZ - 0.02], [-dx - 0.24, dashTop + 0.08, faceZ - 0.12], 0.028, rubber));
        add(tube([-dx - 0.24, dashTop + 0.08, faceZ - 0.12], [-dx + 0.24, dashTop + 0.08, faceZ - 0.12], 0.028, rubber));
        add(tube([-dx + 0.24, dashTop + 0.08, faceZ - 0.12], [-dx + 0.24, dashTop - 0.1, faceZ - 0.02], 0.028, rubber));
        add(rbox(0.16, 0.1, 0.02, S('#16161a'), 0, dashTop + 0.08, frontZ - 0.26, 0.01));
        const gps = mesh(new THREE.PlaneGeometry(0.13, 0.08), M('#8fe3a2', { emissive: '#2f9f5a', emissiveIntensity: 1 }), 0, dashTop + 0.08, frontZ - 0.272);
        gps.rotation.y = Math.PI; add(gps);
        add(tube([0, dashTop + 0.02, frontZ - 0.25], [0, dashTop + 0.06, frontZ - 0.26], 0.01, metal));
        const ex = mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.34, 20), S('#d8262f', { roughness: 0.4 }), 0, floor + 0.32, seatZ - seatD / 2 - 0.05);
        add(ex);
        add(mesh(new THREE.SphereGeometry(0.06, 16, 10, 0, Math.PI * 2, 0, Math.PI / 2), S('#d8262f', { roughness: 0.4 }), 0, floor + 0.49, seatZ - seatD / 2 - 0.05));
        add(rbox(0.05, 0.06, 0.08, S('#1a1a1e'), 0, floor + 0.55, seatZ - seatD / 2 - 0.03, 0.015));
        for (const y of [floor + 0.22, floor + 0.42]) add(rbox(0.14, 0.03, 0.03, metal, 0, y, seatZ - seatD / 2 - 0.12, 0.01));
        void Ys;
      },
    },
    interior: '#2b2b30', seat: '#3a3d34',
    front: {
      lamps: { type: 'rect', x: 0.5, y: 1.05, w: 0.34, h: 0.08, bezel: 'trim' },
      ind: { x: 0.34, y: 0.9, w: 0.12, h: 0.05 },
      grille: { type: 'jeep', w: 0.6, h: 0.18, y: 0.86, slots: 6, gap: 0.09 },
    },
    rear: { lamps: { type: 'rect', x: 0.6, y: 1.1, w: 0.16, h: 0.08, bezel: 'trim' } },
    bumpers: { rear: { type: 'negro', y: 0.8, h: 0.12, d: 0.14, spread: 0.9 } },
    mirror: false, plate: false,
    extras(ctx) {
      const { c, car, fit, cfg, surf, D, accent, trim, paint } = ctx;
      const cage = S('#1d1d23', { roughness: 0.4, metalness: 0.25 }), b = fit.belt, top = D.cabin.top;
      const bent = (pts, r = 0.06, mat = cage) => {
        const curve = new THREE.CatmullRomCurve3(pts.map(p => V(...p)), false, 'catmullrom', 0.06);
        c.add(mesh(new THREE.TubeGeometry(curve, Math.max(24, pts.length * 12), r, 14, false), mat));
      };
      // fender stays
      for (const z of D.axles) for (const s of [1, -1]) bent([[s * (fit.halfW(z) - 0.05), 1.15, z + (z > 0 ? -0.5 : 0.5)], [s * (D.track - 0.16), 1.5, z + (z > 0 ? -0.45 : 0.45)]], 0.035, trim);
      // the cage: A pillars from the cowl, roof rails, the main hoop behind the seats
      const hx = 0.8, zA = 0.8, zR = 0.42, zB = -1.06;
      for (const s of [1, -1]) {
        bent([[s * hx, b, zA], [s * hx, (b + top) / 2, (zA + zR) / 2 + 0.06], [s * (hx - 0.02), top - 0.04, zR], [s * (hx - 0.02), top, zR - 0.15]]);
        bent([[s * (hx - 0.02), top, zR - 0.1], [s * (hx - 0.02), top, zB + 0.1]]);
        bent([[s * hx, b, zB], [s * hx, top - 0.2, zB], [s * (hx - 0.03), top - 0.03, zB + 0.04], [s * (hx - 0.02), top, zB + 0.14]]);
        bent([[s * hx, top - 0.25, zB], [s * 0.74, b + 0.05, -1.75]], 0.05);                         // back stays to the bed
        for (const p of [[s * (hx - 0.02), top, zR - 0.1], [s * (hx - 0.02), top, zB + 0.1]]) c.add(mesh(new THREE.SphereGeometry(0.065, 16, 12), cage, ...p));
      }
      for (const z of [zR - 0.12, zB + 0.12]) bent([[hx - 0.02, top, z], [-(hx - 0.02), top, z]]);
      bent([[hx, b + 0.75, zB], [-hx, b + 0.75, zB]], 0.05);                                        // harness bar
      bent([[hx - 0.05, top - 0.12, zB], [-(hx - 0.05), b + 0.2, zB]], 0.045);                      // diagonal
      // roof panel and half doors
      c.add(rbox(1.72, 0.06, zR - zB + 0.1, accent, 0, top + 0.08, (zR + zB) / 2 - 0.02, 0.03));
      for (const s of [1, -1]) {
        const door = rbox(0.1, 0.4, 1.05, paint, s * 0.87, b + 0.17, -0.18, 0.05);
        c.add(door);
        c.add(rbox(0.06, 0.05, 0.16, S('#1a1a1e'), s * 0.93, b + 0.25, 0.2, 0.02));
        c.add(rbox(0.04, 0.32, 0.04, cage, s * 0.92, b + 0.15, -0.72, 0.015));
      }
      fit.roof = { zF: zR - 0.05, zR: zB + 0.05, top: top + 0.11, half: 0.78, y: () => top + 0.11 };
      // the cargo bed: floor, low walls, and gear strapped in
      const bz0 = zB - 0.12, bz1 = fit.tailZ(1.2) + 0.06, by = fit.topOf(-1.6);
      fit.bed = { zF: bz0, zR: bz1 };
      fit.cargo = { z: (bz0 + bz1) / 2, y: by + 0.04, half: 0.62, len: bz0 - bz1 - 0.2 };
      c.add(rbox(1.5, 0.04, bz0 - bz1, S('#2a2c26', { roughness: 0.9 }), 0, by + 0.02, (bz0 + bz1) / 2, 0.015));
      for (const s of [1, -1]) c.add(rbox(0.08, 0.2, bz0 - bz1, accent, s * 0.75, by + 0.12, (bz0 + bz1) / 2, 0.03));
      c.add(rbox(1.58, 0.2, 0.08, accent, 0, by + 0.12, bz1 + 0.04, 0.03));
      const sp = spareWheel(0.46, 0.34);
      sp.rotation.x = -Math.PI / 2;
      sp.position.set(0.22, by + 0.2, (bz0 + bz1) / 2);
      detachable(car, sp);
      const can = new THREE.Group();
      can.add(rbox(0.2, 0.42, 0.34, S('#e0262f', { roughness: 0.5 }), -0.48, by + 0.25, (bz0 + bz1) / 2 + 0.1, 0.05));
      can.add(rbox(0.06, 0.06, 0.14, DARK(), -0.48, by + 0.49, (bz0 + bz1) / 2 + 0.17, 0.02));
      detachable(car, can);
      const shovel = new THREE.Group();
      shovel.add(tube([-0.68, by + 0.25, bz0 - 0.05], [-0.68, by + 0.25, bz1 + 0.35], 0.03, S('#95612f', { roughness: 0.8 })));
      shovel.add(rbox(0.05, 0.28, 0.26, S('#777b7d', { metalness: 0.4 }), -0.68, by + 0.25, bz1 + 0.24, 0.03));
      detachable(car, shovel);
      // camo
      const camo = ['#a76e37', '#34401c', '#825c30', '#8f9a4c'];
      if (stock(cfg, 'acabado')) {
        [[1.0, 0.3, 0.16], [0.88, -0.25, 0.13], [1.12, -0.6, 0.1], [0.9, 0.62, 0.09]].forEach(([y, z, sz], i) => sideDecal(ctx, () => spot(sz * 1.5, camo[i % 4]), z, y, 0.006));
        [[0.32, 1.45, 0.2], [-0.3, 1.9, 0.17], [0.05, 1.2, 0.12], [0.3, -1.95, 0.1]].forEach(([x, z, sz], i) => { const h = surf.top(x, z); if (h) c.add(stick(spot(sz, camo[(i + 1) % 4]), h, 0.006)); });
      }
      // roof light bar and the front winch bar
      if (stock(cfg, 'techo')) {
        const g = new THREE.Group();
        g.add(rbox(1.5, 0.1, 0.14, DARK(), 0, top + 0.17, zR - 0.02, 0.04));
        for (const x of [-0.54, -0.18, 0.18, 0.54]) { const l = domeLamp(0.13, S('#ffe7a1', { emissive: '#ffbf43', emissiveIntensity: 0.65 }), DARK(), 0.16); l.position.set(x, top + 0.17, zR + 0.06); g.add(l); }
        detachable(car, g);
      }
      if (stock(cfg, 'frente')) {
        const w = new THREE.Group(), z = fit.noseZ(0.78) + 0.12;
        bent([[0.6, 0.62, z - 0.1], [0.62, 0.95, z], [0.4, 1.06, z + 0.04], [-0.4, 1.06, z + 0.04], [-0.62, 0.95, z], [-0.6, 0.62, z - 0.1]], 0.05);
        w.add(rbox(0.8, 0.22, 0.26, DARK(), 0, 0.72, z, 0.06));
        const drum = mesh(new THREE.CylinderGeometry(0.1, 0.1, 0.42, 24), S('#c9ccd4', { metalness: 0.5, roughness: 0.4 }), 0, 0.72, z + 0.15);
        drum.rotation.z = Math.PI / 2; w.add(drum);
        for (let i = -3; i <= 3; i++) { const coil = mesh(new THREE.TorusGeometry(0.105, 0.018, 8, 20), M('#ce692c'), i * 0.055, 0.72, z + 0.15); coil.rotation.y = Math.PI / 2; w.add(coil); }
        w.add(mesh(new THREE.TorusGeometry(0.06, 0.022, 8, 16, Math.PI * 1.4), M('#ff4b4b'), 0, 0.58, z + 0.24));
        detachable(car, w);
      }
      // skid plate under the nose
      c.add(rbox(1.1, 0.04, 0.6, S('#55595f', { metalness: 0.4, roughness: 0.5 }), 0, fit.sill + 0.02, fit.noseZ(0.8) - 0.3, 0.02));
    },
  },

  // ---------- the Taller bodies ----------
  // La Pulga: a proper little beetle with pontoon fenders and bug eyes
  escarabajo: beetle({
    num: 9, paint: '#f5b82e', wheel: { r: 0.6, w: 0.6, style: 'disco', rim: '#f1f0ec', cap: '#c9ccd4' }, plate: 'PUL·GA',
    interior: '#3b322c', seat: '#c99662', trimColor: '#f6ecd4', stock: { calcomania: 'flor' }, boards: '#2a292f',
    // a classic beetle inside: painted metal dash, one big speedo, thin ivory
    // wheel, the famous bud vase with a daisy, a picnic basket behind the bench
    cabinStyle: {
      dashPaint: 'paint', wheel: 'classic', gauges: 'single', cargoItem: 'basket',
      decor({ add, dashTop, frontZ, faceZ, dx, metal, H, floor }) {
        const chrome = S('#e4e6ea', { metalness: 0.7, roughness: 0.25 });
        add(rbox(1.2, 0.025, 0.025, chrome, 0, dashTop - 0.03, faceZ + 0.01, 0.01));                 // chrome strip along the dash
        add(tube([-dx - 0.2, dashTop - 0.12, faceZ - 0.02], [-dx + 0.2, dashTop - 0.12, faceZ - 0.02], 0.018, chrome));   // passenger grab handle
        for (const x of [-dx - 0.2, -dx + 0.2]) add(tube([x, dashTop - 0.12, faceZ - 0.02], [x, dashTop - 0.12, faceZ + 0.04], 0.018, chrome));
        add(rbox(0.12, 0.05, 0.04, chrome, 0.05, floor + H * 0.3, faceZ - 0.005, 0.015));               // ashtray
        // the bud vase
        const vx = -0.08, vz = frontZ - 0.18, vy = dashTop + 0.03;
        add(mesh(new THREE.CylinderGeometry(0.022, 0.03, 0.14, 18), S('#bfe3ea', { roughness: 0.1, metalness: 0.2 }), vx, vy + 0.07, vz));
        add(mesh(new THREE.CylinderGeometry(0.034, 0.034, 0.02, 18), chrome, vx, vy + 0.01, vz));
        add(tube([vx, vy + 0.12, vz], [vx + 0.02, vy + 0.3, vz - 0.02], 0.006, S('#3e8f3a')));
        const leaf = mesh(new THREE.SphereGeometry(0.03, 10, 8), S('#4aa043'), vx + 0.03, vy + 0.2, vz);
        leaf.scale.set(1.4, 0.4, 0.6); add(leaf);
        for (let k = 0; k < 6; k++) {
          const a = k / 6 * Math.PI * 2, p = mesh(new THREE.SphereGeometry(0.026, 12, 8), S('#ffffff', { roughness: 0.6 }), vx + 0.02 + Math.cos(a) * 0.035, vy + 0.31 + Math.sin(a) * 0.035, vz - 0.03);
          p.scale.set(1, 1, 0.45); add(p);
        }
        add(mesh(new THREE.SphereGeometry(0.022, 12, 8), S('#ffc629'), vx + 0.02, vy + 0.31, vz - 0.04));
        void metal;
      },
    },
  }),

  // El Caprichoso: the 70s three-box sedan, quad lamps and a cream side stripe
  sedan: {
    num: 10, paint: '#e8323c', accent: '#f2efe6',
    wheel: { r: 0.6, w: 0.62, style: 'disco', rim: '#dfe2e8', cap: '#c9ccd4' }, track: 1.03, axles: [1.5, -1.5],
    body: {
      width: 2.3, zF: 2.6, zR: -2.58, sill: 0.4, archR: 0.72, archFillet: 0.05,
      top: [[-2.58, 1.34], [-2.3, 1.42], [-1.0, 1.45], [0.9, 1.43], [2.2, 1.36], [2.6, 1.3]],
      rs: 0.1, sq: 4, rb: 0.08, crown: 0.025, tumble: 0.04, bulge: 0.02, taper: { f: 0.03, r: 0.03 },
      nose: { r: 0.16, kTop: 0.9, kBot: 0.3, rake: [[0, 0.03], [0.5, 0], [1, 0.03]] }, tail: { r: 0.15, kTop: 0.9, kBot: 0.3, rake: [[0, 0.02], [0.5, 0], [1, 0.02]] },
    },
    cabin: { zWF: 0.98, zRF: 0.18, zWR: -1.58, zRR: -1.03, roof: 2.6, hwB: 1.04, hwR: 0.94, rs: 0.12, sq: 3.6, crown: 0.04, pillars: [{ z: -0.43, w: 0.14 }], cMargin: 0.14, driverZ: -0.05, hollow: true, cargo: false },
    seat: '#2b2732',
    front: {
      lamps: { type: 'round', x: 0.8, y: 1.12, r: 0.13, pair: 0.3, depth: 0.1 },
      ind: { x: 0.96, y: 0.84, w: 0.16, h: 0.07 },
      grille: { type: 'cromo', w: 0.86, h: 0.3, y: 1.1, bars: 4 },
    },
    rear: { lamps: { type: 'rect', x: 0.72, y: 1.12, w: 0.44, h: 0.2, bezel: 'trim' } },
    bumpers: { front: { type: 'cromo', y: 0.66, h: 0.18, d: 0.18 }, rear: { type: 'cromo', y: 0.66, h: 0.18, d: 0.18 } },
    plate: 'CAPRI·70', plateR: { y: 0.92 },
    doors: [0.92, -0.45], handles: { z: 0.2, y: 1.26 }, trim: [{ y: 1.22, z0: -2.3, z1: 2.3, w: 0.03 }],
    mirror: { mat: CHROME, stem: CHROME, z: 0.86 },
    stock: { franjas: 'costado' },
  },

  // El Por Puesto: the two-tone buseta, many windows and a spare on the roof
  buseta: {
    num: 11, paint: '#2bb3a3', accent: '#f2efe6',
    wheel: { r: 0.6, w: 0.6, style: 'disco', rim: '#f1e6c8', cap: '#c9ccd4' }, track: 1.04, axles: [1.5, -1.45],
    body: {
      width: 2.32, zF: 2.42, zR: -2.36, sill: 0.46, archR: 0.73, archFillet: 0.05,
      top: [[-2.36, 1.58], [2.0, 1.6], [2.42, 1.5]],
      rs: 0.1, sq: 4, rb: 0.08, crown: 0.02, tumble: 0.02, bulge: 0.02, taper: { f: 0.04, r: 0.02 },
      nose: { r: 0.22, kTop: 0.9, kBot: 0.3, rake: [[0, 0.04], [0.5, 0], [1, 0.1]] }, tail: { r: 0.14, kTop: 1, kBot: 0.3 },
    },
    cabin: { zWF: 2.12, zRF: 1.72, zWR: -2.24, zRR: -2.18, roof: 3.0, hwB: 1.1, hwR: 1.0, rs: 0.14, sq: 4, crown: 0.04, rnF: 0.14, rnR: 0.1, pillars: [{ z: 0.92, w: 0.16 }, { z: -0.2, w: 0.14 }, { z: -1.2, w: 0.14 }], cMargin: 0.14, tone: 'accent', driverZ: 1.05, hollow: true, cargo: false, rows: 'fill' },
    seat: '#c99662',
    front: {
      lamps: { type: 'round', x: 0.78, y: 0.92, r: 0.19 },
      ind: { x: 0.8, y: 0.66, w: 0.16, h: 0.08 },
    },
    rear: { lamps: { type: 'rect', x: 0.86, y: 1.0, w: 0.18, h: 0.34, bezel: 'trim' } },
    bumpers: { front: { type: 'cromo', y: 0.56, h: 0.18, d: 0.18 }, rear: { type: 'cromo', y: 0.56, h: 0.18, d: 0.18 } },
    plate: 'POR·PUESTO', plateR: { y: 0.82 }, plateF: { onBumper: true },
    doors: [2.05, 0.9], handles: { z: 1.7, y: 1.3 }, trim: [{ y: 1.1, z0: -2.1, z1: 2.15, w: 0.2, mat: () => S('#f2efe6', { roughness: 0.35, ...DECAL }) }],
    mirror: { z: 1.96, y: 1.6 },
    stock: { techo: 'repuesto' },
  },

  // El Burro: the orange work pickup, flares, stake rails and a cooler
  pickup: {
    num: 12, paint: '#ff7a1a', accent: '#1f1e24',
    wheel: { r: 0.68, w: 0.68, style: 'acero', rim: '#c9ced8', cap: '#c9ced8', tread: 'todoterreno' }, track: 1.16, axles: [1.62, -1.5],
    body: {
      width: 2.34, zF: 2.62, zR: -2.56, sill: 0.62, archR: 0.84, archFillet: 0.05,
      top: [[-2.56, 1.3], [-0.84, 1.3], [-0.6, 1.78], [1.0, 1.8], [2.1, 1.76], [2.62, 1.68]],
      rs: 0.1, sq: 5, rb: 0.08, crown: 0.02, tumble: 0.03, bulge: 0.01, taper: { f: 0.03, r: 0 },
      nose: { r: 0.16, kTop: 1, kBot: 0.3, rake: [[0, 0.02], [0.5, 0], [1, 0.05]] }, tail: { r: 0.1, kTop: 0.6, kBot: 0.3 },
    },
    cabin: { zWF: 1.04, zRF: 0.6, zWR: -0.58, zRR: -0.52, roof: 2.98, hwB: 1.07, hwR: 1.0, rs: 0.1, sq: 4.5, crown: 0.03, rnR: 0.08, pillars: [], cMargin: 0.3, driverZ: 0.0, hollow: true, cargo: false },
    seat: '#2b2732',
    front: {
      lamps: { type: 'rect', x: 0.84, y: 1.38, w: 0.4, h: 0.28, bezel: 'trim' },
      ind: { x: 0.92, y: 1.1, w: 0.2, h: 0.08 },
      grille: { type: 'cromo', w: 1.08, h: 0.42, y: 1.36, bars: 3 },
    },
    rear: { lamps: { type: 'rect', x: 0.96, y: 1.5, w: 0.2, h: 0.36, bezel: 'trim' } },
    bumpers: { front: { type: 'cromo', y: 0.82, h: 0.2, d: 0.2 }, rear: { type: 'cromo', y: 0.82, h: 0.2, d: 0.2 } },
    plate: 'BUR·RO', plateF: { onBumper: true }, plateR: { onBumper: true },
    doors: [0.98, -0.5], handles: { z: -0.3, y: 1.62 }, mirror: { z: 0.92, y: 1.9 },
    stock: { techo: 'cava' },
    extras(ctx) {
      const { c, car, fit, paint, trim } = ctx;
      flares(ctx, { w: 0.42, lip: 0.15, drop: 0.12 });
      const z0 = -0.68, z1 = fit.tailZ(1.1) + 0.02, W2 = fit.halfW(-1.5);
      fit.bed = { zF: z0, zR: z1 };
      fit.cargo = { z: (z0 + z1) / 2, y: 1.36, half: 0.72, len: z0 - z1 - 0.3 };
      for (const s of [1, -1]) c.add(rbox(0.14, 0.62, z0 - z1, paint, s * (W2 - 0.07), 1.48, (z0 + z1) / 2, 0.06));
      c.add(rbox(2 * W2 - 0.06, 0.62, 0.14, paint, 0, 1.48, z1 + 0.07, 0.06));
      c.add(rbox(2 * W2 - 0.2, 0.58, 0.12, paint, 0, 1.48, z0 + 0.04, 0.05));
      c.add(rbox(2 * W2 - 0.3, 0.05, z0 - z1 - 0.2, S('#5a3a22', { roughness: 0.85 }), 0, 1.33, (z0 + z1) / 2, 0.02));
      for (let k = -2; k <= 2; k++) c.add(rbox(0.05, 0.04, z0 - z1 - 0.26, S('#9a6338', { roughness: 0.8 }), k * 0.3, 1.37, (z0 + z1) / 2, 0.015));
      const rails = new THREE.Group(), wood = S('#9a6338', { roughness: 0.85 }), top = 1.79;
      for (const s of [1, -1]) {
        for (let k = 0; k < 4; k++) rails.add(rbox(0.09, 0.56, 0.09, wood, s * (W2 - 0.07), top + 0.28, z0 - 0.12 - k * (z0 - z1 - 0.24) / 3, 0.02));
        for (const y of [top + 0.24, top + 0.5]) rails.add(rbox(0.07, 0.09, z0 - z1 - 0.1, wood, s * (W2 - 0.07), y, (z0 + z1) / 2, 0.02));
      }
      detachable(car, rails);
      void trim;
    },
  },

  // El Chigüire: the open jeep, seven-slot grille, flares and a roll bar
  jeep: {
    num: 13, paint: '#3fa856', accent: '#1f1e24',
    wheel: { r: 0.68, w: 0.7, style: 'acero', rim: '#2a292f', cap: '#ff8a1f', tread: 'barro' }, track: 1.1, axles: [1.26, -1.2],
    body: {
      width: 2.2, zF: 2.22, zR: -2.12, sill: 0.64, archR: 0.81, archFillet: 0.05,
      top: [[-2.12, 1.78], [1.8, 1.82], [2.22, 1.76]],
      rs: 0.08, sq: 5.5, rb: 0.07, crown: 0.02, tumble: 0.02, bulge: 0, taper: { f: 0.02, r: 0 },
      nose: { r: 0.12, kTop: 1, kBot: 0.3 }, tail: { r: 0.1, kTop: 1, kBot: 0.3 },
    },
    cabin: { open: true, hollow: true, roofless: true, zWF: 0.66, zWR: -1.4, top: 3.0, zTop: 0.5, hwB: 1.02, driverZ: -0.1, gauges: 'pair', harness: false },
    seat: '#2b2732',
    front: {
      lamps: { type: 'round', x: 0.7, y: 1.42, r: 0.2 },
      ind: { x: 0.74, y: 1.12, w: 0.18, h: 0.08 },
      grille: { type: 'jeep', w: 1.0, h: 0.56, y: 1.34, slots: 7, gap: 0.12 },
    },
    rear: { lamps: { type: 'rect', x: 0.86, y: 1.36, w: 0.2, h: 0.24, bezel: 'trim' } },
    bumpers: { front: { type: 'negro', y: 0.82, h: 0.24, d: 0.26, spread: 1.0 }, rear: { type: 'negro', y: 0.82, h: 0.24, d: 0.26, spread: 1.0 } },
    plate: 'CHI·GÜI', plateF: { onBumper: true }, plateR: { y: 1.12 },
    mirror: { z: 0.52, y: 1.86 },
    stock: { frente: 'defensa' },
    extras(ctx) {
      const { c, fit, trim, car } = ctx;
      flares(ctx, { w: 0.42, lip: 0.15, drop: 0.12 });
      const zb = -0.75, yb = 2.9, hx = 0.86, belt = fit.belt;
      for (const s of [1, -1]) {
        c.add(tube([s * hx, belt - 0.05, zb], [s * hx, yb - 0.2, zb], 0.07, trim));
        c.add(tube([s * hx, yb - 0.2, zb], [s * (hx - 0.2), yb, zb], 0.07, trim));
        c.add(tube([s * hx, yb - 0.24, zb], [s * hx, belt, zb - 0.9], 0.055, trim));
        c.add(mesh(new THREE.SphereGeometry(0.07, 16, 12), trim, s * hx, yb - 0.2, zb));
      }
      c.add(tube([-(hx - 0.2), yb, zb], [hx - 0.2, yb, zb], 0.07, trim));
      fit.roof = { zF: zb + 0.15, zR: zb - 0.15, top: yb + 0.07, half: hx - 0.1, y: () => yb + 0.07 };
      fit.cargo = { z: -1.55, y: fit.topOf(-1.55) - 0.02, half: 0.7, len: 0.8 };
      void car;
    },
  },

  // La Chispa: the purple hot hatch, number on the doors, stripes and a lip
  hatch: {
    num: 14, paint: '#7b4dff', accent: '#ffd23a',
    wheel: { r: 0.6, w: 0.64, style: 'cinco', rim: '#f1f0ec', cap: '#ffd23a' }, track: 1.08, axles: [1.36, -1.32],
    body: {
      width: 2.26, zF: 2.32, zR: -2.24, sill: 0.42, archR: 0.74, archFillet: 0.06,
      top: [[-2.24, 1.36], [-1.9, 1.46], [0.85, 1.48], [1.6, 1.4], [2.32, 1.12]],
      rs: 0.14, sq: 3.4, rb: 0.1, crown: 0.03, tumble: 0.05, bulge: 0.03, taper: { f: 0.06, r: 0.04 },
      nose: { r: 0.3, kTop: 1, kBot: 0.28, rake: [[0, 0.05], [0.4, 0], [1, 0.16]] }, tail: { r: 0.2, kTop: 0.8, kBot: 0.28, rake: [[0, 0.02], [0.5, 0], [1, 0.04]] },
    },
    cabin: { zWF: 0.94, zRF: 0.02, zWR: -1.8, zRR: -1.3, roof: 2.68, hwB: 1.04, hwR: 0.92, rs: 0.14, sq: 3.2, crown: 0.04, pillars: [{ z: -0.47, w: 0.15 }], cMargin: 0.24, driverZ: -0.05, hollow: true, wheel: 'sport' },
    seat: '#2b2732',
    front: {
      lamps: { type: 'rect', x: 0.72, y: 1.0, w: 0.38, h: 0.18, bezel: 'trim' },
      ind: { x: 0.96, y: 0.82, w: 0.14, h: 0.07 },
      grille: { type: 'malla', w: 0.9, h: 0.26, y: 0.66 },
    },
    rear: { lamps: { type: 'rect', x: 0.74, y: 1.12, w: 0.36, h: 0.16, bezel: 'trim' } },
    bumpers: { front: { type: 'negro', y: 0.5, h: 0.2, d: 0.24 }, rear: { type: 'negro', y: 0.52, h: 0.24, d: 0.26 } },
    plate: 'CHIS·PA', plateR: { y: 0.86 }, plateF: { onBumper: true },
    doors: [0.92, -0.48], handles: { z: -0.3, y: 1.32 }, mirror: { paint: true, z: 0.82 },
    stock: { aleron: 'techo', franjas: 'carrera', calcomania: 'numero' }, spoilerMat: 'paint',
  },

  // El Tepuy: the white rústico with a blue roof, boxy and tall
  rustico: {
    num: 15, paint: '#f2efe6', accent: '#2f6bff',
    wheel: { r: 0.68, w: 0.68, style: 'acero', rim: '#c9ced8', cap: '#c9ced8', tread: 'todoterreno' }, track: 1.14, axles: [1.34, -1.29],
    body: {
      width: 2.32, zF: 2.34, zR: -2.28, sill: 0.62, archR: 0.82, archFillet: 0.05,
      top: [[-2.28, 1.74], [1.9, 1.76], [2.34, 1.7]],
      rs: 0.08, sq: 5.5, rb: 0.07, crown: 0.02, tumble: 0.02, bulge: 0.01, taper: { f: 0.02, r: 0 },
      nose: { r: 0.13, kTop: 1, kBot: 0.3 }, tail: { r: 0.1, kTop: 1, kBot: 0.3 },
    },
    cabin: { zWF: 0.86, zRF: 0.56, zWR: -2.14, zRR: -2.08, roof: 3.12, hwB: 1.08, hwR: 1.03, rs: 0.08, sq: 5.5, crown: 0.02, rnF: 0.07, rnR: 0.07, pillars: [{ z: -0.5, w: 0.15 }, { z: -1.45, w: 0.14 }], cMargin: 0.1, tone: 'accent', driverZ: -0.1, hollow: true },
    seat: '#c99662',
    front: {
      lamps: { type: 'round', x: 0.72, y: 1.32, r: 0.19 },
      ind: { x: 0.92, y: 1.08, w: 0.16, h: 0.08 },
      grille: { type: 'jeep', w: 0.8, h: 0.5, y: 1.3, slots: 6, gap: 0.12 },
    },
    rear: { lamps: { type: 'rect', x: 0.9, y: 1.4, w: 0.2, h: 0.3, bezel: 'trim' } },
    bumpers: { front: { type: 'negro', y: 0.8, h: 0.26, d: 0.28, spread: 1.0 }, rear: { type: 'negro', y: 0.8, h: 0.26, d: 0.28, spread: 1.0 } },
    plate: 'TE·PUY', plateF: { onBumper: true }, plateR: { y: 1.12 },
    doors: [0.8, -0.5], handles: { z: -0.3, y: 1.58 }, mirror: { z: 0.72, y: 1.9 },
    stock: { techo: 'barra' },
    extras(ctx) {
      flares(ctx, { w: 0.42, lip: 0.15, drop: 0.12 });
      const sp = spareWheel(0.56, 0.38);
      sp.position.set(0, 1.5, ctx.fit.tailZ(1.5) - 0.2);
      detachable(ctx.car, sp);
    },
  },

  // La Reina: the long blue V8 coupe, white stripes, duck tail
  malibu: {
    num: 16, paint: '#2f6bff', accent: '#f2efe6',
    wheel: { r: 0.6, w: 0.64, style: 'turbo', rim: '#dfe2e8', cap: '#e8323c' }, track: 1.06, axles: [1.66, -1.58],
    body: {
      width: 2.36, zF: 2.8, zR: -2.72, sill: 0.4, archR: 0.73, archFillet: 0.05,
      top: [[-2.72, 1.38], [-2.4, 1.44], [-1.4, 1.48], [1.2, 1.46], [2.4, 1.38], [2.8, 1.3]],
      rs: 0.12, sq: 3.6, rb: 0.09, crown: 0.025, tumble: 0.05, bulge: 0.03, taper: { f: 0.04, r: 0.04 },
      nose: { r: 0.18, kTop: 0.9, kBot: 0.3, rake: [[0, 0.03], [0.5, 0], [1, 0.03]] }, tail: { r: 0.16, kTop: 0.8, kBot: 0.3, rake: [[0, 0.02], [0.5, 0], [1, 0.02]] },
    },
    cabin: { zWF: 0.66, zRF: -0.14, zWR: -1.88, zRR: -1.16, roof: 2.48, hwB: 1.04, hwR: 0.93, rs: 0.12, sq: 3.4, crown: 0.04, pillars: [], cMargin: 0.34, driverZ: -0.2, hollow: true, cargo: false },
    seat: '#c99662', interior: '#2b2732',
    front: {
      lamps: { type: 'round', x: 0.82, y: 0.98, r: 0.12, pair: 0.3, depth: 0.1 },
      grille: { type: 'cromo', w: 1.06, h: 0.32, y: 0.98, bars: 4 },
    },
    rear: { lamps: { type: 'rect', x: 0.74, y: 1.04, w: 0.5, h: 0.16, bezel: 'trim' } },
    bumpers: { front: { type: 'cromo', y: 0.62, h: 0.18, d: 0.18 }, rear: { type: 'cromo', y: 0.62, h: 0.18, d: 0.18 } },
    plate: 'REI·NA', plateR: { y: 0.84 },
    doors: [0.6, -1.0], handles: { z: -0.8, y: 1.26 }, trim: [{ y: 1.18, z0: -2.5, z1: 2.5, w: 0.03 }],
    mirror: { mat: CHROME, stem: CHROME, z: 0.54 },
    stock: { franjas: 'carrera', aleron: 'pato' }, spoilerMat: 'paint',
  },
};

// The two beetles share one design: a rounded tub, pontoon fenders over each
// wheel, running boards, bug-eye lamps on the front fenders and a domed roof.
function beetle(o) {
  const R = o.wheel.r, X = 1.0, aF = 1.34, aR = -1.34;
  return {
    num: o.num, paint: o.paint, accent: o.accent ?? '#f2efe6', plate: o.plate, interior: o.interior, seat: o.seat, stock: o.stock,
    wheel: o.wheel, track: X, axles: [aF, aR],
    body: {
      width: 1.92, zF: 2.46, zR: -2.46, sill: 0.5, archR: R + 0.12, archFillet: 0.05,
      top: [[-2.46, 0.98], [-1.9, 1.34], [-1.3, 1.52], [0.8, 1.52], [1.4, 1.42], [1.95, 1.2], [2.46, 0.9]],
      rs: 0.3, sq: 2.6, rb: 0.1, crown: 0.04, tumble: 0.08, bulge: 0.03, taper: { f: 0.2, zf: 0.6, r: 0.16, zr: -0.8 },
      nose: { r: 0.4, kTop: 1, kBot: 0.3, rake: [[0, 0.12], [0.4, 0], [1, 0.26]], bulge: 0.04 },
      tail: { r: 0.4, kTop: 1, kBot: 0.3, rake: [[0, 0.1], [0.4, 0], [1, 0.3]], bulge: 0.04 },
    },
    fenders: [{ x: X, axle: aF, r: R + 0.1, w: 0.9, thick: 0.34, a0: -0.16, a1: Math.PI - 0.2, tailBack: 0.42, boardY: 0.5 }, { x: X, axle: aR, r: R + 0.1, w: 0.9, thick: 0.34, a0: 0.2, a1: Math.PI + 0.14, tailFront: 0.42, boardY: 0.5 }],
    cabin: { zWF: 0.98, zRF: 0.22, zWR: -1.86, zRR: -1.02, roof: 2.68, hwB: 0.92, hwR: 0.8, rs: 0.34, sq: 2.4, crown: 0.07, rnF: 0.16, rnR: 0.3, pillars: [{ z: -0.46, w: 0.14 }], cMargin: 0.28, driverZ: -0.1, hollow: true, ...o.cabinStyle },
    hanging: o.hanging, trimColor: o.trimColor,
    front: {},
    rear: {},
    bumpers: {
      front: { type: 'cromo', y: 0.5, h: 0.14, d: 0.14, spread: 0.9, guards: 0.5, guardMat: () => CHROME() },
      rear: { type: 'cromo', y: 0.5, h: 0.14, d: 0.14, spread: 0.9, guards: 0.5, guardMat: () => CHROME() },
    },
    plateF: { onBumper: true }, plateR: { y: 0.78 },
    doors: [0.62, -0.6], handles: { z: -0.4, y: 1.3 }, mirror: { mat: CHROME, stem: CHROME, z: 0.62, y: 1.4 },
    extras(ctx) {
      const { c, surf, fit } = ctx;
      // bug eyes on the front fenders, round tail lamps on the rear ones
      for (const s of [1, -1]) {
        const ea = 0.62, eu = V(0, Math.sin(ea), Math.cos(ea));
        const eye = domeLamp(0.17, LENS(), CHROME(), 0.16);
        eye.position.copy(V(s * X, R, aF).addScaledVector(eu, R + 0.1 + 0.27));
        c.add(orient(eye, V(0, 0.25, 1)));
        const ta = Math.PI - 0.55, tu = V(0, Math.sin(ta), Math.cos(ta));
        const tl = domeLamp(0.11, TAIL(), CHROME(), 0.1);
        tl.position.copy(V(s * X, R, aR).addScaledVector(tu, R + 0.1 + 0.26));
        c.add(orient(tl, V(0, 0.2, -1)));
        const ind = surf.hit([s * X * 0.86, R + 0.26, 5], [0, 0, -1]);
        if (ind) c.add(stick(rbox(0.12, 0.07, 0.05, AMBER(), 0, 0, 0, 0.025), ind, 0.0));
        // running boards between the fenders
        const zb0 = aF - R - 0.2, zb1 = aR + R + 0.2;
        c.add(rbox(0.4, 0.08, zb0 - zb1 + 0.3, S(o.boards ?? '#2a292f', { roughness: 0.7 }), s * (X - 0.02), 0.44, (zb0 + zb1) / 2, 0.035));
      }
      // hood handle and the engine lid vents
      const hh = surf.top(0, 1.7);
      if (hh) c.add(stick(rbox(0.16, 0.05, 0.04, CHROME(), 0, 0, 0, 0.015), hh, 0.01));
      for (let k = 0; k < 4; k++) { const v = surf.top(0, -1.75 - k * 0.09); if (v) c.add(stick(rbox(0.5, 0.03, 0.03, DARK(), 0, 0, 0, 0.012), v, 0.008)); }
      void fit;
      o.extras?.(ctx);
    },
  };
}

const NUMBERS = Object.fromEntries(Object.entries(SPECS).map(([id, D]) => [id, D.num]));
// build(avatar, wheel?, cfg?) → { root, driver, … }. Names and stats live with
// the game (Carreritas's car-definitions.js), keyed by the same ids. cfg is the
// garage's render config (car-parts.js); without it every car keeps its own
// stock parts. A slot that asks for another part replaces the stock one.
export const CAR_BUILDERS = Object.fromEntries(Object.entries(SPECS).map(([id, D]) => {
  const build = buildCar(id, D);
  return [id, (avatar, wheel, cfg) => {
    const car = dress(build(avatar, wheel, cfg ?? {}), cfg ?? {}, { num: NUMBERS[id] });
    batchStatic(car.chassis, new Set([...car.detachables, ...car.danglers, car.driver.group, car.flag].filter(Boolean)));
    return car;
  }];
}));
export const CAR_SPECS = SPECS;
