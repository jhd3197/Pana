// Smooth car shells: every body and greenhouse is ONE structured quad grid
// (a loft of cross-section rings with Coons-patch end caps), so the surface
// shades smoothly, has no slivers from polygon triangulation and shares every
// vertex. Wheel arches are part of the grid: the bottom edge of the loft runs
// over each wheel, so the floor rises into a dark wheel tunnel on its own.
// Every car faces +Z, its left is +X, wheels touch y = 0.

import * as THREE from 'three';

const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
const lerp = (a, b, t) => a + (b - a) * t;
const sstep = t => { t = clamp(t, 0, 1); return t * t * (3 - 2 * t); };

// Monotone cubic through [[x, y], ...] (sorted by x): no overshoot, so a top
// line never bulges past its control points.
export function spline(pts) {
  const n = pts.length, xs = pts.map(p => p[0]), ys = pts.map(p => p[1]);
  if (n === 1) return () => ys[0];
  const d = [], m = new Array(n);
  for (let i = 0; i < n - 1; i++) d.push((ys[i + 1] - ys[i]) / (xs[i + 1] - xs[i]));
  m[0] = d[0]; m[n - 1] = d[n - 2];
  for (let i = 1; i < n - 1; i++) m[i] = d[i - 1] * d[i] <= 0 ? 0 : (d[i - 1] + d[i]) / 2;
  for (let i = 0; i < n - 1; i++) {
    if (d[i] === 0) { m[i] = m[i + 1] = 0; continue; }
    const a = m[i] / d[i], b = m[i + 1] / d[i], s = a * a + b * b;
    if (s > 9) { const t = 3 / Math.sqrt(s); m[i] = t * a * d[i]; m[i + 1] = t * b * d[i]; }
  }
  return x => {
    if (x <= xs[0]) return ys[0];
    if (x >= xs[n - 1]) return ys[n - 1];
    let i = 0;
    while (x > xs[i + 1]) i++;
    const h = xs[i + 1] - xs[i], t = (x - xs[i]) / h, t2 = t * t, t3 = t2 * t;
    return (2 * t3 - 3 * t2 + 1) * ys[i] + (t3 - 2 * t2 + t) * h * m[i] + (-2 * t3 + 3 * t2) * ys[i + 1] + (t3 - t2) * h * m[i + 1];
  };
}

// ---------- the bottom edge: sill line with filleted arches ----------
function archPath({ zR, zF, sill, hub, axles, archR, fillet = 0.08 }) {
  const pts = [[zR, sill]];
  for (const axle of [...axles].sort((a, b) => a - b)) {
    const rf = fillet, dy = sill + rf - hub, D = archR + rf;
    if (Math.abs(dy) >= D) continue;
    const dz = Math.sqrt(D * D - dy * dy);
    const Fr = [axle - dz, sill + rf], Ff = [axle + dz, sill + rf];
    const toA = F => Math.atan2(hub - F[1], axle - F[0]);
    // rear fillet: from straight below its centre round to the arch
    const a0 = -Math.PI / 2, a1 = toA(Fr);
    for (let k = 0; k <= 6; k++) { const a = lerp(a0, a1, k / 6); pts.push([Fr[0] + rf * Math.cos(a), Fr[1] + rf * Math.sin(a)]); }
    let ar = Math.atan2(Fr[1] - hub, Fr[0] - axle); if (ar < 0) ar += Math.PI * 2;
    const af = Math.atan2(Ff[1] - hub, Ff[0] - axle);
    for (let k = 1; k < 40; k++) { const a = lerp(ar, af, k / 40); pts.push([axle + archR * Math.cos(a), hub + archR * Math.sin(a)]); }
    let b0 = toA(Ff); if (b0 < 0) b0 += Math.PI * 2;
    for (let k = 0; k <= 6; k++) { const a = lerp(b0, Math.PI * 1.5, k / 6); pts.push([Ff[0] + rf * Math.cos(a), Ff[1] + rf * Math.sin(a)]); }
  }
  pts.push([zF, sill]);
  // clip to [zR, zF] (an axle near an end leaves the face standing on the arch)
  const out = [];
  for (let i = 0; i < pts.length; i++) {
    const p = pts[i];
    if (p[0] >= zR - 1e-9 && p[0] <= zF + 1e-9) { out.push(p); continue; }
    const q = pts[i - 1] ?? pts[i + 1];
    const lim = p[0] < zR ? zR : zF;
    if (q && (q[0] - lim) * (p[0] - lim) < 0) out.push([lim, p[1] + (q[1] - p[1]) * (lim - p[0]) / (q[0] - p[0])]);
  }
  // keep z monotone at the ends after clipping
  if (out[0][0] > zR + 1e-6) out.unshift([zR, out[0][1]]);
  if (out.at(-1)[0] < zF - 1e-6) out.push([zF, out.at(-1)[1]]);
  return out;
}

function resample(poly, n) {
  const L = [0];
  for (let i = 1; i < poly.length; i++) L.push(L[i - 1] + Math.hypot(poly[i][0] - poly[i - 1][0], poly[i][1] - poly[i - 1][1]));
  const out = [], total = L.at(-1);
  let s = 0;
  for (let k = 0; k <= n; k++) {
    const target = total * k / n;
    while (s < poly.length - 2 && L[s + 1] < target) s++;
    const t = (target - L[s]) / ((L[s + 1] - L[s]) || 1);
    out.push([lerp(poly[s][0], poly[s + 1][0], t), lerp(poly[s][1], poly[s + 1][1], t)]);
  }
  return out;
}

function smoothArray(a, sigma, passes = 1) {
  let cur = a.slice();
  const r = Math.ceil(sigma * 2.5);
  for (let p = 0; p < passes; p++) {
    const next = cur.slice();
    for (let i = 1; i < cur.length - 1; i++) {
      let s = 0, w = 0;
      for (let k = -r; k <= r; k++) {
        const j = clamp(i + k, 0, cur.length - 1), g = Math.exp(-(k * k) / (2 * sigma * sigma));
        s += cur[j] * g; w += g;
      }
      next[i] = s / w;
    }
    cur = next;
  }
  return cur;
}

// ---------- cross-section ring ----------
// A rounded rectangle from the bottom centre, up the +x side, over the top
// and down the -x side. Absolute radii, so the shoulder keeps its roll even
// where the section gets short over a wheel.
const RING = { nB: 10, nC: 6, nV: 8, nT: 10 };
function ringAt({ hw, yb, yt, crown = 0, rs = 0.2, rb = 0.08, tumble = 0, bulge = 0, sq = 3.2, rsy = null }, cnt = RING) {
  // yt is the top at the centre line; rs is how far the roof/hood falls
  // from the centre to the side wall (a superellipse quadrant with exponent
  // sq: 2 is an ellipse, 6 is nearly square), so the top is convex everywhere.
  const { nB, nC, nV, nT } = cnt;
  const top = yt + crown, H = top - yb;
  const drop = Math.max(0.02, Math.min((rsy ?? rs) + crown, H * 0.8));
  const rbE = Math.max(0.006, Math.min(rb, H - drop - 0.02, hw * 0.4));
  const half = [];
  const push = (x, y, kind, t = 0) => half.push({ x, y, kind, t });
  const xb = hw - rbE;
  for (let i = 0; i < nB / 2; i++) push(xb * i / (nB / 2), yb, 'B');
  for (let i = 0; i < nC; i++) { const a = -Math.PI / 2 + Math.PI / 2 * i / nC; push(xb + rbE * Math.cos(a), yb + rbE + rbE * Math.sin(a), i < nC / 2 ? 'Bi' : 'Bo'); }
  const x0 = hw, x1 = hw - tumble, y0 = yb + rbE, y1 = top - drop;
  for (let i = 0; i < nV; i++) { const t = i / nV; push(lerp(x0, x1, t * t) + bulge * Math.sin(Math.PI * t), lerp(y0, y1, t), 'S', t); }
  // superellipse quadrant from (x1, y1) to (0, top); spacing evened by arc length
  const e = 2 / sq, quad = [];
  for (let i = 0; i <= 200; i++) {
    const th = Math.PI / 2 * i / 200, c = Math.cos(th), s = Math.sin(th);
    quad.push([x1 * Math.sign(c) * Math.abs(c) ** e, y1 + drop * Math.abs(s) ** e]);
  }
  const nQ = nC + nT / 2, pts = resample(quad, nQ);
  for (let i = 0; i < nQ; i++) push(pts[i][0], pts[i][1], i < nC ? 'C' : 'T');
  push(0, top, 'T');
  const ring = half.map(p => ({ ...p, side: p.x > 1e-6 ? 1 : 0 }));
  for (let i = half.length - 2; i >= 1; i--) ring.push({ ...half[i], x: -half[i].x, side: -1 });
  for (const p of ring) p.yf = (p.y - yb) / (H || 1);
  return ring;
}
const ringSize = (c = RING) => c.nB + c.nT + 4 * c.nC + 2 * c.nV;

function ringNormals(ring) {
  const M = ring.length;
  return ring.map((p, k) => {
    const a = ring[(k + M - 1) % M], b = ring[(k + 1) % M];
    const tx = b.x - a.x, ty = b.y - a.y, L = Math.hypot(tx, ty) || 1;
    return [ty / L, -tx / L];
  });
}

// Coons patch over a ring: grid (A+1) x (Bc+1); returns rows[j][i] of
// {ring index} on the boundary or {x, y, yf} inside.
function coons(ring, cnt = RING) {
  const { nB, nC, nV } = cnt, M = ring.length;
  const A = nB + nC, Bc = nV + nC, h = nB / 2 + nC / 2;
  const idx = (i, j) => {
    if (j === 0) return ((-h + i) % M + M) % M;
    if (i === A) return h + j;
    if (j === Bc) return h + Bc + (A - i);
    if (i === 0) return (h + Bc + A + (Bc - j)) % M;
    return -1;
  };
  const P = (i, j) => ring[idx(i, j)];
  const rows = [];
  for (let j = 0; j <= Bc; j++) {
    const row = [];
    for (let i = 0; i <= A; i++) {
      const k = idx(i, j);
      if (k >= 0) { row.push({ k }); continue; }
      const u = i / A, v = j / Bc;
      const f = key => (1 - v) * P(i, 0)[key] + v * P(i, Bc)[key] + (1 - u) * P(0, j)[key] + u * P(A, j)[key]
        - ((1 - u) * (1 - v) * P(0, 0)[key] + u * (1 - v) * P(A, 0)[key] + (1 - u) * v * P(0, Bc)[key] + u * v * P(A, Bc)[key]);
      row.push({ x: f('x'), y: f('y'), yf: f('yf'), i, j });
    }
    rows.push(row);
  }
  return { rows, A, Bc };
}

// ---------- grid assembly ----------
// rings: stations rear -> front, each an array of {x, y, z, ...}. Caps are
// built over the first and last ring. faceZ(end, x, y, yf) gives cap depth.
function assemble(rings, { capRear, capFront, faceZ, cnt = RING, skipQuad }) {
  const pos = [], quads = [];
  const M = rings[0].length;
  const vid = rings.map(r => r.map(p => { pos.push(p.x, p.y, p.z); return pos.length / 3 - 1; }));
  for (let j = 0; j < rings.length - 1; j++) for (let k = 0; k < M; k++) {
    const k1 = (k + 1) % M;
    const q = { v: [vid[j][k], vid[j][k1], vid[j + 1][k1], vid[j + 1][k]], where: 'loft', j, k, a: rings[j][k], b: rings[j][k1] };
    if (!skipQuad?.(q)) quads.push(q);
  }
  const caps = {};
  const cap = (end) => {
    const ringIdx = end > 0 ? rings.length - 1 : 0, ring = rings[ringIdx];
    const { rows, A, Bc } = coons(ring, cnt);
    const ids = rows.map(row => row.map(c => {
      if (c.k != null) return vid[ringIdx][c.k];
      pos.push(c.x, c.y, faceZ(end, c.x, c.y, c.yf));
      return pos.length / 3 - 1;
    }));
    for (let j = 0; j < Bc; j++) for (let i = 0; i < A; i++) {
      quads.push({ v: [ids[j][i], ids[j][i + 1], ids[j + 1][i + 1], ids[j + 1][i]], where: end > 0 ? 'capF' : 'capR', i, j, A, Bc, end });
    }
    caps[end] = { ids, A, Bc };
  };
  if (capFront) cap(1);
  if (capRear) cap(-1);
  // orient: loft quads are outward by construction; caps face +-z
  const P = i => new THREE.Vector3(pos[3 * i], pos[3 * i + 1], pos[3 * i + 2]);
  for (const q of quads) {
    if (q.where === 'loft') continue;
    const [a, b, c] = q.v.map(P), n = b.clone().sub(a).cross(c.clone().sub(a));
    if (n.z * q.end < 0) q.v.reverse();
  }
  return { pos, quads, vid, caps };
}

function normalsOf(pos, quads) {
  const n = new Float32Array(pos.length);
  const v = i => [pos[3 * i], pos[3 * i + 1], pos[3 * i + 2]];
  const addTri = (a, b, c) => {
    const A = v(a), B = v(b), C = v(c);
    const ux = B[0] - A[0], uy = B[1] - A[1], uz = B[2] - A[2], wx = C[0] - A[0], wy = C[1] - A[1], wz = C[2] - A[2];
    const nx = uy * wz - uz * wy, ny = uz * wx - ux * wz, nz = ux * wy - uy * wx;
    for (const i of [a, b, c]) { n[3 * i] += nx; n[3 * i + 1] += ny; n[3 * i + 2] += nz; }
  };
  for (const { v: q } of quads) { addTri(q[0], q[1], q[2]); addTri(q[0], q[2], q[3]); }
  for (let i = 0; i < n.length; i += 3) {
    const L = Math.hypot(n[i], n[i + 1], n[i + 2]) || 1;
    n[i] /= L; n[i + 1] /= L; n[i + 2] /= L;
  }
  return n;
}

// Split the quads into indexed geometries that share one position/normal set.
function geometries(pos, normals, quads, classify) {
  const P = new THREE.Float32BufferAttribute(pos, 3), N = new THREE.BufferAttribute(normals, 3);
  const groups = new Map();
  for (const q of quads) {
    const key = classify(q);
    if (!key) continue;
    if (!groups.has(key)) groups.set(key, []);
    const [a, b, c, d] = q.v;
    // split along the shorter diagonal: better triangles on sheared quads
    const d1 = dist2(pos, a, c), d2 = dist2(pos, b, d);
    groups.get(key).push(...(d1 <= d2 ? [a, b, c, a, c, d] : [a, b, d, b, c, d]));
  }
  const out = {};
  for (const [key, idx] of groups) {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', P);
    g.setAttribute('normal', N);
    g.setIndex(idx);
    g.computeBoundingSphere();
    out[key] = g;
  }
  return out;
}
const dist2 = (p, a, b) => (p[3 * a] - p[3 * b]) ** 2 + (p[3 * a + 1] - p[3 * b + 1]) ** 2 + (p[3 * a + 2] - p[3 * b + 2]) ** 2;

// Profiles of a shell along its centre line, for the fit functions.
function crossing(poly, along, v, pick) {
  const hit = [];
  for (let i = 0; i < poly.length - 1; i++) {
    const a = poly[i], b = poly[i + 1], av = along ? a[1] : a[0], bv = along ? b[1] : b[0];
    if ((av - v) * (bv - v) <= 0 && av !== bv) { const t = (v - av) / (bv - av); hit.push(along ? lerp(a[0], b[0], t) : lerp(a[1], b[1], t)); }
  }
  return hit.length ? pick(...hit) : null;
}

// ---------- the lower body ----------
// o: { width, zF, zR, sill, top: [[z, yTopCentre], ...], axles, hub, archR,
//   archFillet, taper: { f, zf, r, zr }, rs, rb, crown, tumble, bulge,
//   nose: { r, rake: [[yf, dz]], bulge, kTop, kBot }, tail: {...}, stations }
// Returns { paint, under } geometries and the fit (noseZ, tailZ, topOf, halfW).
export function lowerBody(o) {
  const W2 = o.width / 2, nose = { r: 0.22, kTop: 1, kBot: 0.6, bulge: 0, ...o.nose }, tail = { r: 0.2, kTop: 1, kBot: 0.6, bulge: 0, ...o.tail };
  const zF = o.zF, zR = o.zR, top = spline(o.top);
  const { f = 0.06, zf = zF - 1.1, r = 0.04, zr = zR + 0.9 } = o.taper ?? {};
  const pinch = z => 1 - f * clamp((z - zf) / (zF - zf), 0, 1) ** 2 - r * clamp((zr - z) / (zr - zR), 0, 1) ** 2;
  const rake = e => typeof e.rake === 'number' ? (yf => e.rake * yf) : e.rake ? spline(e.rake) : () => 0;
  const rakeF = rake(nose), rakeR = rake(tail);
  const faceF = yf => zF - rakeF(yf), faceR = yf => zR + rakeR(yf);
  const crown = o.crown ?? 0.05;
  // a fillet can't roll in further than the end section allows
  for (const [e, end] of [[nose, 1], [tail, -1]]) for (let it = 0; it < 3; it++) {
    const zE = (end > 0 ? zF : zR) - end * e.r, H = top(zE) - o.sill;
    e.r = Math.min(e.r, 0.62 * W2 * pinch(zE), 0.8 * H / (e.kTop + e.kBot));
  }
  // per-vertex fillet depth: the face's edge rolls by r at the sides, r*kTop
  // into the hood and r*kBot under the bumper (keeps short overhangs clear of the arches)
  // blended by height so the depth never jumps across a small corner
  const fk = (e, ny, yf) => yf < 0.5 ? lerp(e.kBot, 1, sstep(yf / 0.42)) : lerp(1, e.kTop, sstep((yf - 0.55) / 0.4));
  // stations along the bottom edge (arches included)
  const path = archPath({ zR: faceR(0) + tail.r * tail.kBot, zF: faceF(0) - nose.r * nose.kBot, sill: o.sill, hub: o.hub, axles: o.axles, archR: o.archR, fillet: o.archFillet ?? 0.08 });
  const nS = o.stations ?? 72;
  const bottom = resample(path, nS);
  // the arch curls back under its centre; keep z monotone so columns never cross
  for (let j = 1; j < bottom.length; j++) bottom[j][0] = Math.max(bottom[j][0], bottom[j - 1][0] + 1e-4);
  let zt = smoothArray(bottom.map(p => p[0]), 2.2, 3);
  const zt0 = faceR(1) + tail.r * tail.kTop, zt1 = faceF(1) - nose.r * nose.kTop, a0 = zt[0], a1 = zt.at(-1);
  zt = zt.map(z => lerp(zt0, zt1, (z - a0) / (a1 - a0)));
  // the side walls lean in toward a shoulder; the plan pinches at the ends
  const ringOpts = (hw, yb, zTop) => ({ hw, yb, yt: top(zTop) - crown, crown, rs: o.rs ?? 0.24, rsy: o.rsy, sq: o.sq ?? 3.2, rb: o.rb ?? 0.09, tumble: o.tumble ?? 0.05, bulge: o.bulge ?? 0.02 });
  const rings = [];
  const nStations = bottom.length, blend = Math.min(10, Math.floor(nStations / 4));
  for (let j = 0; j < nStations; j++) {
    const [zb, yb] = bottom[j], ztop = zt[j];
    const zMid = lerp(zb, ztop, 0.5), hw = W2 * pinch(zMid);
    const base = ringAt(ringOpts(hw, yb, ztop)), nrm = ringNormals(base);
    const wF = sstep((j - (nStations - 1 - blend)) / blend), wR = sstep((blend - j) / blend);
    rings.push(base.map((p, i) => {
      const s = sstep(p.yf), ny = p.yf;
      let z = lerp(zb, ztop, s);
      z += wF * ((faceF(p.yf) - nose.r * fk(nose, ny, p.yf)) - lerp(faceF(0) - nose.r * nose.kBot, faceF(1) - nose.r * nose.kTop, s));
      z += wR * ((faceR(p.yf) + tail.r * fk(tail, ny, p.yf)) - lerp(faceR(0) + tail.r * tail.kBot, faceR(1) + tail.r * tail.kTop, s));
      const k = pinch(z) / pinch(zMid);
      return { ...p, x: p.x * k, z, station: j };
    }));
  }
  // filleted ends: rings roll round the face's edge, then a Coons cap
  const nE = 7;
  const endRings = (end) => {
    const e = end > 0 ? nose : tail, base = end > 0 ? rings.at(-1) : rings[0], nrm = ringNormals(base);
    const face = end > 0 ? faceF : faceR, hwE = Math.max(...base.map(p => Math.abs(p.x)));
    const list = [];
    for (let k = 1; k <= nE; k++) {
      const phi = k / nE * Math.PI / 2;
      list.push(base.map((p, i) => {
        const [nx, ny] = nrm[i], rv = e.r * fk(e, ny, p.yf), d = rv * (1 - Math.cos(phi));
        const x = p.x - nx * d, y = p.y - ny * d;
        const bul = e.bulge * Math.sin(phi) * (1 - clamp(x / hwE, -1, 1) ** 2) * (1 - (2 * p.yf - 1) ** 2);
        return { ...p, x, y, z: face(p.yf) - end * rv * (1 - Math.sin(phi)) + end * bul, station: end > 0 ? 1e3 + k : -1e3 - k };
      }));
    }
    return list;
  };
  const front = endRings(1), rear = endRings(-1).reverse();
  const all = [...rear, ...rings, ...front];
  const hwF = Math.max(...rings.at(-1).map(p => Math.abs(p.x))), hwR = Math.max(...rings[0].map(p => Math.abs(p.x)));
  const faceZ = (end, x, y, yf) => {
    const e = end > 0 ? nose : tail, hwE = end > 0 ? hwF : hwR;
    const bul = e.bulge * (1 - clamp(x / hwE, -1, 1) ** 2) * (1 - (2 * yf - 1) ** 2);
    return (end > 0 ? faceF(yf) : faceR(yf)) + end * bul;
  };
  const { pos, quads, vid, caps } = assemble(all, { capFront: true, capRear: true, faceZ });
  const normals = normalsOf(pos, quads);
  const dark = new Set(['B', 'Bi']);
  const interior = q => q.where === 'loft' && all[q.j].length && Math.abs(all[q.j][0].station) < 1e3 && Math.abs(all[q.j + 1][0].station) < 1e3;
  // an optional opening in the top for a hollow cabin (the tub is built separately)
  const op = o.opening;
  const inOpening = q => {
    if (!op || q.where !== 'loft') return false;
    let cx = 0, cz = 0, ny = 0;
    for (const v of q.v) { cx += pos[3 * v]; cz += pos[3 * v + 2]; ny += normals[3 * v + 1]; }
    cx /= 4; cz /= 4; ny /= 4;
    return ny > 0.3 && Math.abs(cx) < op.hw && cz > op.z0 && cz < op.z1;
  };
  const geo = geometries(pos, normals, quads, q => inOpening(q) ? null : interior(q) && dark.has(q.a.kind) && dark.has(q.b.kind) ? 'under' : 'paint');

  // centre-line profile loop: bottom rear->front, front cap up, top front->rear, rear cap down
  const M = all[0].length, P = i => [pos[3 * i + 2], pos[3 * i + 1]];
  const loop = [];
  for (let j = 0; j < all.length; j++) loop.push(P(vid[j][0]));
  const cf = caps[1], cr = caps[-1];
  for (let j = 0; j <= cf.Bc; j++) loop.push(P(cf.ids[j][cf.A / 2]));
  for (let j = all.length - 1; j >= 0; j--) loop.push(P(vid[j][M / 2]));
  for (let j = cr.Bc; j >= 0; j--) loop.push(P(cr.ids[j][cr.A / 2]));
  // plan width per station (widest point of each ring)
  const widths = all.map(r => { let best = r[0]; for (const p of r) if (Math.abs(p.x) > Math.abs(best.x)) best = p; return [best.z, Math.abs(best.x)]; }).sort((a, b) => a[0] - b[0]);
  const halfW = z => {
    if (z <= widths[0][0]) return widths[0][1];
    for (let i = 0; i < widths.length - 1; i++) if (z <= widths[i + 1][0]) {
      const t = (z - widths[i][0]) / ((widths[i + 1][0] - widths[i][0]) || 1);
      return lerp(widths[i][1], widths[i + 1][1], t);
    }
    return widths.at(-1)[1];
  };
  const zMax = Math.max(...loop.map(p => p[0])), zMin = Math.min(...loop.map(p => p[0]));
  const fit = {
    width: o.width, zF: zMax, zR: zMin, sill: o.sill, hub: o.hub, axles: o.axles, arch: o.archR,
    taper: z => halfW(z) / W2,
    noseZ: y => crossing(loop, true, y, Math.max) ?? zMax,
    tailZ: y => crossing(loop, true, y, Math.min) ?? zMin,
    topOf: z => crossing(loop, false, z, Math.max) ?? o.sill,
    halfW,
  };
  return { geo, fit, loop };
}

// ---------- the greenhouse ----------
// A hollow shell: roof, pillars and window frames are painted (with real
// thickness and rims round every opening), the windows are glass panes set
// into the frames, and the driver's window is open.
// o: { belt, zWF, zRF (windshield base and top z), zWR, zRR (rear glass base
//   and top z), roof (outer roof height at the centre), hwB, hwR (half width
//   at belt and roof), rs (roof edge radius), crown, aPillar, rnF, rnR,
//   pillars: [{ z, w }] (B, C... pillar centres and widths), cMargin
//   (painted panel behind the last side window), openSide (x sign of the
//   driver's open window, 0 for none), thick }
export function greenhouse(o) {
  const cnt = { nB: 10, nC: 6, nV: 6, nT: 10 };
  const rnF = o.rnF ?? 0.1, rnR = o.rnR ?? 0.1, t = o.thick ?? 0.05;
  const faceF = yf => lerp(o.zWF, o.zRF, yf), faceR = yf => lerp(o.zWR, o.zRR, yf);
  const endF = yf => faceF(yf) - rnF, endR = yf => faceR(yf) + rnR;
  // stations: uniform in u, z(u, yf) = lerp(endR, endF, u); breaks at pillars
  const mid = u => lerp(endR(0.5), endF(0.5), u);
  const uOf = z => (z - endR(0.5)) / (endF(0.5) - endR(0.5));
  const breaks = [0, 1];
  const cm = o.cMargin ?? 0.1;
  if (cm > 0) breaks.push(uOf(endR(0.5) + cm));
  for (const p of o.pillars ?? []) breaks.push(uOf(p.z - p.w / 2), uOf(p.z + p.w / 2));
  const us = [...new Set(breaks.map(u => +clamp(u, 0, 1).toFixed(5)))].sort((a, b) => a - b);
  const stations = [];
  const step = 0.11 / Math.abs(endF(0.5) - endR(0.5));
  for (let i = 0; i < us.length - 1; i++) {
    const n = Math.max(1, Math.round((us[i + 1] - us[i]) / step));
    for (let k = 0; k < n; k++) stations.push(lerp(us[i], us[i + 1], k / n));
  }
  stations.push(1);
  const isWindowU = u => {
    if (u < uOf(endR(0.5) + cm) - 1e-6) return false;
    for (const p of o.pillars ?? []) if (u > uOf(p.z - p.w / 2) - 1e-6 && u < uOf(p.z + p.w / 2) + 1e-6) return false;
    return true;
  };
  const frontPillarU = Math.max(uOf(endR(0.5) + cm), ...(o.pillars ?? []).map(p => uOf(p.z + p.w / 2)));
  const rs = o.rs ?? 0.18, crown = o.crown ?? 0.04;
  const rings = stations.map((u, j) => {
    // ring shape: tumblehome from hwB at the belt to hwR at the roof
    const base = ringAt({ hw: o.hwB, yb: o.belt, yt: o.roof - crown, crown, rs, rsy: o.rsy, sq: o.sq ?? 3, rb: 0.035, tumble: o.hwB - o.hwR, bulge: 0 }, cnt);
    return base.map(p => ({ ...p, z: lerp(endR(p.yf), endF(p.yf), u), u, station: j }));
  });
  const nE = 6;
  const endRings = (end) => {
    const base = end > 0 ? rings.at(-1) : rings[0], nrm = ringNormals(base), rn = end > 0 ? rnF : rnR;
    const list = [];
    for (let k = 1; k <= nE; k++) {
      const phi = k / nE * Math.PI / 2, d = rn * (1 - Math.cos(phi));
      list.push(base.map((p, i) => {
        const [nx, ny] = nrm[i];
        const fk = Math.min(1, Math.max(0, (ny + 0.95) / 0.75)) ** 2;   // the belt edge stays on the body, blending up
        return { ...p, x: p.x - nx * d * fk, y: p.y - ny * d * fk, z: (end > 0 ? faceF(p.yf) : faceR(p.yf)) - end * rn * (1 - Math.sin(phi)), u: end > 0 ? 1 + k * 1e-3 : -k * 1e-3, station: end * (1e3 + k) };
      }));
    }
    return list;
  };
  const all = [...endRings(-1).reverse(), ...rings, ...endRings(1)];
  const faceZ = (end, x, y, yf) => (end > 0 ? faceF(yf) : faceR(yf)) + end * 0.012 * (1 - (x / o.hwB) ** 2);
  const M = all[0].length;
  const { pos, quads, vid, caps } = assemble(all, {
    capFront: true, capRear: true, faceZ,
    // the belt edge is open: the shell stands on the body
    skipQuad: q => q.a.kind === 'B' && q.b.kind === 'B',
  });
  const normals = normalsOf(pos, quads);
  // classify faces
  const mA = o.aPillar ?? 1, mTop = o.header ?? 1;
  const classify = q => {
    if (q.where !== 'loft') {
      const glass = q.i >= mA && q.i < q.A - mA && q.j >= 1 && q.j < q.Bc - mTop;
      return glass ? 'glass' : 'paint';
    }
    const a = q.a, b = q.b;
    if (!(a.kind === 'S' && (b.kind === 'S' || b.kind === 'C'))) return 'paint';
    if (a.kind === 'S' && a.t === 0) return 'paint';   // sill strip under the glass
    const r0 = all[q.j][0], r1 = all[q.j + 1][0];
    if (r0.u < 0 || r1.u > 1 || r0.u >= 1) return 'paint';
    const uc = (r0.u + r1.u) / 2;
    if (!isWindowU(uc)) return 'paint';
    if (o.openSide && Math.sign(a.x + b.x) === o.openSide && uc > frontPillarU) return null;
    return 'glass';
  };
  const kinds = quads.map(classify);
  // thick painted shell: outer, inner (offset along the normal) and rims
  const sp = [], sn = [], si = [], ii = [];
  const nv = pos.length / 3;
  for (let i = 0; i < nv; i++) {
    sp.push(pos[3 * i], pos[3 * i + 1], pos[3 * i + 2]); sn.push(normals[3 * i], normals[3 * i + 1], normals[3 * i + 2]);
  }
  for (let i = 0; i < nv; i++) {
    sp.push(pos[3 * i] - normals[3 * i] * t, pos[3 * i + 1] - normals[3 * i + 1] * t, pos[3 * i + 2] - normals[3 * i + 2] * t);
    sn.push(-normals[3 * i], -normals[3 * i + 1], -normals[3 * i + 2]);
  }
  const edgeOwner = new Map();
  quads.forEach((q, n) => { for (let e = 0; e < 4; e++) { const a = q.v[e], b = q.v[(e + 1) % 4]; const key = a < b ? a + ',' + b : b + ',' + a; if (!edgeOwner.has(key)) edgeOwner.set(key, []); edgeOwner.get(key).push(n); } });
  const tri = (a, b, c) => si.push(a, b, c);
  quads.forEach((q, n) => {
    if (kinds[n] !== 'paint') return;
    const [a, b, c, d] = q.v;
    tri(a, b, c); tri(a, c, d);
    ii.push(nv + a, nv + c, nv + b, nv + a, nv + d, nv + c);
    for (let e = 0; e < 4; e++) {
      const p = q.v[e], r = q.v[(e + 1) % 4], key = p < r ? p + ',' + r : r + ',' + p;
      const owners = edgeOwner.get(key);
      if (owners.some(m => m !== n && kinds[m] === 'paint')) continue;
      // a rim quad facing into the opening, with its own flat normal
      const P0 = [pos[3 * p], pos[3 * p + 1], pos[3 * p + 2]], R0 = [pos[3 * r], pos[3 * r + 1], pos[3 * r + 2]];
      const np = [normals[3 * p], normals[3 * p + 1], normals[3 * p + 2]], nr = [normals[3 * r], normals[3 * r + 1], normals[3 * r + 2]];
      const P1 = P0.map((v, k) => v - np[k] * t), R1 = R0.map((v, k) => v - nr[k] * t);
      const ex = [R0[0] - P0[0], R0[1] - P0[1], R0[2] - P0[2]], nn = [np[0] + nr[0], np[1] + nr[1], np[2] + nr[2]];
      const fn = [ex[1] * nn[2] - ex[2] * nn[1], ex[2] * nn[0] - ex[0] * nn[2], ex[0] * nn[1] - ex[1] * nn[0]];
      const L = Math.hypot(...fn) || 1;
      const base = sp.length / 3;
      for (const V of [P0, R0, R1, P1]) { sp.push(...V); sn.push(fn[0] / L, fn[1] / L, fn[2] / L); }
      tri(base + 1, base, base + 3); tri(base + 1, base + 3, base + 2);
    }
  });
  const shell = new THREE.BufferGeometry();
  shell.setAttribute('position', new THREE.Float32BufferAttribute(sp, 3));
  shell.setAttribute('normal', new THREE.Float32BufferAttribute(sn, 3));
  shell.setIndex(si);
  shell.computeBoundingSphere();
  const lining = new THREE.BufferGeometry();
  lining.setAttribute('position', shell.attributes.position);
  lining.setAttribute('normal', shell.attributes.normal);
  lining.setIndex(ii);
  lining.computeBoundingSphere();
  // glass panes, set halfway into the frame
  const gp = [], gi = [];
  const gmap = new Map();
  const gv = i => {
    if (!gmap.has(i)) { gmap.set(i, gp.length / 3); gp.push(pos[3 * i] - normals[3 * i] * t * 0.55, pos[3 * i + 1] - normals[3 * i + 1] * t * 0.55, pos[3 * i + 2] - normals[3 * i + 2] * t * 0.55); }
    return gmap.get(i);
  };
  quads.forEach((q, n) => {
    if (kinds[n] !== 'glass') return;
    const [a, b, c, d] = q.v.map(gv);
    gi.push(a, b, c, a, c, d);
  });
  const glass = new THREE.BufferGeometry();
  glass.setAttribute('position', new THREE.Float32BufferAttribute(gp, 3));
  glass.setIndex(gi);
  glass.computeVertexNormals();
  // roof profile along the centre line
  const roofLine = [];
  for (let j = 0; j < all.length; j++) roofLine.push([pos[3 * vid[j][M / 2] + 2], pos[3 * vid[j][M / 2] + 1]]);
  const roofTop = Math.max(...roofLine.map(p => p[1]));
  const roofY = z => {
    let best = null;
    for (let i = 0; i < roofLine.length - 1; i++) {
      const a = roofLine[i], b = roofLine[i + 1];
      if ((a[0] - z) * (b[0] - z) <= 0 && a[0] !== b[0]) { const y = lerp(a[1], b[1], (z - a[0]) / (b[0] - a[0])); best = best == null ? y : Math.max(best, y); }
    }
    return best ?? o.belt;
  };
  // roof extent: where the roof is within a few cm of its top
  const flat = roofLine.filter(p => p[1] > roofTop - 0.12);
  void caps;
  return {
    shell, lining, glass,
    roof: { zF: Math.max(...flat.map(p => p[0])), zR: Math.min(...flat.map(p => p[0])), top: roofTop, half: o.hwR - rs * 0.4, y: roofY },
    innerRoof: z => roofY(z) - t,
  };
}

// A small lofted pontoon over a wheel (a beetle's fenders, flared arches):
// a lower body with one axle, used as a separate panel.
export function pontoon(o) {
  return lowerBody({ stations: 48, ...o });
}
