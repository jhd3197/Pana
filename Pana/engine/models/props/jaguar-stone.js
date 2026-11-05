// Temple carvings of the jaguar: a crouching statue on a stepped plinth and a
// low-relief lintel panel. Small and weathered on purpose; a temple gets one
// quiet carving among its ruins, never a giant glowing-eyed gate. Metres, +Y
// up, origin on the ground (statue) or at the slab's bottom centre (relief).
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { rng } from '/engine/models/core/primitives.js';

const at = (x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0, sx = 1, sy = sx, sz = sx) => new THREE.Matrix4().compose(
  new THREE.Vector3(x, y, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(rx, ry, rz)), new THREE.Vector3(sx, sy, sz));
function painted(geometry, matrix, colour) {
  const p = geometry.attributes.position, n = geometry.attributes.normal, colors = new Float32Array(p.count * 3), c = new THREE.Color();
  for (let i = 0; i < p.count; i++) { colour(c, n.getX(i), n.getY(i), n.getZ(i), p.getY(i)); colors.set([c.r, c.g, c.b], i * 3); }
  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  return geometry.applyMatrix4(matrix);
}

// Weathered stone: darker in the hollows, a little moss on what faces the sky.
function stonePainter(stone, moss, random) {
  const base = new THREE.Color(stone), deep = base.clone().multiplyScalar(.72), green = new THREE.Color(0x5d7a3e);
  return (c, nx, ny, nz, y) => {
    c.copy(base).lerp(deep, Math.max(0, -ny) * .6 + random() * .12);
    if (moss && ny > .45) c.lerp(green, (ny - .45) * random() * 1.3);
  };
}

// Weathered stone, face by face: darker low down and in the hollows, moss on what
// faces the sky. One colour per facet, so the low-poly cuts read as chisel work.
const STONE = { low: 0x3f3528, carve: 0x241e17, moss: 0x3f5a2a, jade: 0x46b08a, tooth: 0xc2b48e, mouth: 0x120d0a };
function weather(stone, moss, top, random) {
  const base = new THREE.Color(stone), low = new THREE.Color(STONE.low), green = new THREE.Color(STONE.moss);
  return (c, x, y, z, nx, ny) => {
    const grain = Math.sin(x * 23 + z * 17) * Math.sin(y * 31 + x * 11);
    c.copy(base).multiplyScalar(.86 + random() * .24);
    c.lerp(low, Math.min(.85, Math.max(0, 1 - y / (top * .62)) * .9 + Math.max(0, -ny) * .35));
    if (moss && ny > .6 && grain + random() * .7 > .75) c.lerp(green, .3 + (ny - .6) * .9);
  };
}
function gilded(stone, random) {
  const base = new THREE.Color(stone), deep = base.clone().multiplyScalar(.62);
  return (c, x, y, z, nx, ny) => { c.copy(base).lerp(deep, Math.max(0, -ny) * .7 + random() * .16); };
}
// Solid colours for the carved details, whatever the stone.
const fixed = hex => { const col = new THREE.Color(hex); return c => { c.copy(col); }; };

// One triangle list: every piece goes in flat, painted facet by facet after it is placed.
function sculptKit() {
  const pieces = [], v = new THREE.Vector3(), a = new THREE.Vector3(), b = new THREE.Vector3(), n = new THREE.Vector3(), c = new THREE.Color();
  return {
    add(geometry, matrix, paint) { pieces.push([geometry.index ? geometry.toNonIndexed() : geometry, matrix, paint]); if (geometry.index) geometry.dispose(); },
    build(defaultPaint) {
      const parts = pieces.map(([g, matrix, paint]) => {
        if (matrix) g.applyMatrix4(matrix);
        for (const key of Object.keys(g.attributes)) if (key !== 'position') g.deleteAttribute(key);
        const p = g.attributes.position, colors = new Float32Array(p.count * 3);
        for (let i = 0; i < p.count; i += 3) {
          v.fromBufferAttribute(p, i); a.fromBufferAttribute(p, i + 1).sub(v); b.fromBufferAttribute(p, i + 2).sub(v); n.crossVectors(a, b).normalize();
          const cx = (p.getX(i) + p.getX(i + 1) + p.getX(i + 2)) / 3, cy = (p.getY(i) + p.getY(i + 1) + p.getY(i + 2)) / 3, cz = (p.getZ(i) + p.getZ(i + 1) + p.getZ(i + 2)) / 3;
          (paint || defaultPaint)(c, cx, cy, cz, n.x, n.y, n.z);
          for (let k = 0; k < 3; k++) colors.set([c.r, c.g, c.b], (i + k) * 3);
        }
        g.setAttribute('color', new THREE.BufferAttribute(colors, 3));
        g.computeVertexNormals();
        return g;
      });
      const merged = mergeGeometries(parts); parts.forEach(g => g.dispose());
      return merged;
    },
  };
}
// A skin through rings of points, capped at both ends.
function loft(rings) {
  const out = [], tri = (p, q, r) => out.push(p.x, p.y, p.z, q.x, q.y, q.z, r.x, r.y, r.z), n = rings[0].length;
  for (let k = 0; k + 1 < rings.length; k++) for (let i = 0; i < n; i++) {
    const j = (i + 1) % n, p = rings[k][i], q = rings[k][j], r = rings[k + 1][j], s = rings[k + 1][i];
    tri(p, r, q); tri(p, s, r);
  }
  const centre = ring => ring.reduce((m, p) => m.add(p), new THREE.Vector3()).multiplyScalar(1 / ring.length);
  const first = rings[0], last = rings[rings.length - 1], c0 = centre(first), c1 = centre(last);
  for (let i = 0; i < n; i++) { const j = (i + 1) % n; tri(c0, first[i], first[j]); tri(c1, last[j], last[i]); }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(out, 3));
  return g;
}
// A ring across the body: centre (y, z), half width and height; the belly flatter than the back.
const hoop = (z, y, w, h, n = 7, x = 0) => Array.from({ length: n }, (_, i) => { const t = (i + .5) / n * Math.PI * 2, s = Math.sin(t); return new THREE.Vector3(x + Math.cos(t) * w, y + s * h * (s < 0 ? .78 : 1), z); });
// A tapered limb along a path of [x, y, z, radius].
function limb(path, n = 5) {
  const tangent = new THREE.Vector3(), side = new THREE.Vector3(), up = new THREE.Vector3(), ref = new THREE.Vector3();
  const rings = path.map((p, i) => {
    const q = path[Math.min(path.length - 1, i + 1)], o = path[Math.max(0, i - 1)];
    tangent.set(q[0] - o[0], q[1] - o[1], q[2] - o[2]).normalize();
    ref.set(0, 1, 0); if (Math.abs(tangent.y) > .9) ref.set(1, 0, 0);
    side.crossVectors(ref, tangent).normalize(); up.crossVectors(tangent, side);
    return Array.from({ length: n }, (_, k) => { const t = (k + .5) / n * Math.PI * 2; return new THREE.Vector3(p[0], p[1], p[2]).addScaledVector(side, Math.cos(t) * p[3]).addScaledVector(up, Math.sin(t) * p[3]); });
  });
  return loft(rings);
}
// A plain box with some corners knocked in, the chips shared across its faces.
function chippedBox(w, h, d, random, chip = .05) {
  const g = new THREE.BoxGeometry(w, h, d), p = g.attributes.position, moved = new Map();
  for (let i = 0; i < p.count; i++) {
    const key = `${Math.sign(p.getX(i))},${Math.sign(p.getY(i))},${Math.sign(p.getZ(i))}`;
    if (!moved.has(key)) moved.set(key, random() < .55 ? [random() * chip, random() * chip * .6, random() * chip] : [0, 0, 0]);
    const [x, y, z] = moved.get(key);
    p.setXYZ(i, p.getX(i) - Math.sign(p.getX(i)) * x, p.getY(i) - Math.sign(p.getY(i)) * y, p.getZ(i) - Math.sign(p.getZ(i)) * z);
  }
  return g;
}

// A jaguar carved crouching on a stepped plinth, about 1.4 m tall in all: muscular
// shoulders and haunches, a long tail wrapped round its feet, the head lowered and
// snarling. Facets, carved rosettes and chisel bands, darker and mossier low down.
// Jade inlay eyes, no glow. Static and one mesh: it bakes to a single draw. `gold`
// casts it in polished gold instead (Reliquia's treasure statue): no moss, a sheen.
export function jaguarStatue({ seed = 11, stone = 0x6e5c42, moss = true, scale = .8, plinth = true, gold = false } = {}) {
  const random = rng(seed), base = plinth ? .62 : 0, k = scale * 1.1, top = base + .95 * k;
  const paint = gold ? gilded(0xffc23d, random) : weather(stone, moss, top, random);
  // A plinth's top is one big facet: moss comes as clumps there, never as a whole green face.
  const dressed = gold ? paint : weather(stone, false, top, random), carve = fixed(gold ? 0x8a5a14 : STONE.carve), kit = sculptKit();
  // The cat in its own units (nose at +z, belly on y = 0), carried onto the plinth.
  const cat = at(0, base, plinth ? -.2 : 0, 0, 0, 0, k);
  const part = (geometry, matrix = null, tint = null) => kit.add(geometry, matrix ? cat.clone().multiply(matrix) : cat.clone(), tint);
  const blob = (x, y, z, sx, sy, sz, rx = 0, ry = 0, rz = 0, detail = 1) => part(new THREE.IcosahedronGeometry(1, detail), at(x, y, z, rx, ry, rz, sx, sy, sz));
  // The body, rump to neck.
  const SPINE = [[-.64, .4, .1, .12], [-.54, .45, .2, .24], [-.34, .47, .24, .29], [-.1, .41, .2, .24], [.12, .44, .21, .26], [.28, .52, .25, .29], [.42, .58, .2, .23], [.54, .63, .13, .15]];
  part(loft(SPINE.map(([z, y, w, h]) => hoop(z, y, w, h))));
  // Shoulder blades standing up as it stalks, and a heavy neck ruff.
  for (const s of [-1, 1]) {
    blob(s * .17, .68, .24, .11, .13, .18, .3, 0, s * .3, 0);
    // Haunch, hock and long hind foot.
    blob(s * .2, .4, -.34, .125, .3, .31, .35, s * .12, s * .08);
    part(limb([[s * .25, .26, -.3, .12], [s * .29, .15, -.42, .085], [s * .29, .08, -.26, .066], [s * .27, .06, -.08, .062]]));
    // Upper arm to elbow, the forearm lying forward, the paw flat on the stone.
    const reach = s > 0 ? .08 : 0;
    part(limb([[s * .2, .54, .3, .15], [s * .24, .32, .22, .125], [s * .25, .13, .2, .095]]));
    part(limb([[s * .25, .13, .2, .095], [s * .225, .1, .42 + reach * .5, .08], [s * .2, .075, .62 + reach, .066]]));
    // A chisel band round the forearm and one on the hind foot.
    part(limb([[s * .23, .105, .385, .086], [s * .226, .101, .41, .086]], 5), null, carve);
    part(limb([[s * .285, .075, -.24, .07], [s * .28, .07, -.21, .07]], 5), null, carve);
    for (const [px, pz] of [[s * .2, .7 + reach], [s * .27, -.02]]) {
      blob(px, .05, pz, .085, .05, .11, 0, 0, 0, 0);
      for (let t = -1; t <= 1; t++) {
        part(new THREE.OctahedronGeometry(.032, 0), at(px + t * .05, .035, pz + .09 - Math.abs(t) * .012));
        part(new THREE.ConeGeometry(.012, .035, 3), at(px + t * .05, .022, pz + .125, Math.PI / 2), carve);
      }
    }
  }
  // A collar of chisel cuts where the neck meets the shoulders.
  part(loft([hoop(.47, .603, .178, .205), hoop(.49, .612, .172, .198)]), null, carve);
  // The head, lowered: skull, cheeks, then the muzzle pushed out.
  const HEAD = [[.5, .62, .12, .13], [.6, .66, .17, .16], [.7, .66, .18, .15], [.78, .635, .135, .115], [.86, .6, .1, .085], [.93, .585, .08, .06]];
  part(loft(HEAD.map(([z, y, w, h]) => hoop(z, y, w, h))));
  // Whisker pads, brow ridges pulled down over the sockets, the eyes deep in them.
  for (const s of [-1, 1]) {
    blob(s * .052, .575, .9, .055, .045, .055, 0, 0, 0, 0);
    part(new THREE.BoxGeometry(.13, .035, .09), at(s * .095, .735, .75, -.25, s * -.25, s * -.42));
    part(new THREE.BoxGeometry(.085, .055, .03), at(s * .09, .69, .788, 0, s * .32, 0), carve);
    part(new THREE.OctahedronGeometry(.018, 0), at(s * .085, .69, .802), fixed(gold ? 0xfff0b0 : STONE.jade));
    // Ears: round, low, turned forward.
    part(new THREE.ConeGeometry(.062, .1, 5), at(s * .135, .815, .59, -.2, 0, s * -.36));
    part(new THREE.ConeGeometry(.034, .055, 4), at(s * .135, .812, .618, -.2, 0, s * -.36), carve);
    // Fangs, top and bottom.
    part(new THREE.ConeGeometry(.018, .07, 3), at(s * .062, .505, .9, Math.PI), fixed(gold ? 0xffe6a0 : STONE.tooth));
    part(new THREE.ConeGeometry(.013, .045, 3), at(s * .05, .47, .86), fixed(gold ? 0xffe6a0 : STONE.tooth));
  }
  // The nose and the snarl: a dark mouth under the muzzle, small teeth, the jaw hanging open.
  part(new THREE.BoxGeometry(.075, .03, .03), at(0, .612, .94, -.3), carve);
  part(new THREE.BoxGeometry(.13, .08, .15), at(0, .5, .81), fixed(gold ? 0x4a2c00 : STONE.mouth));
  for (let t = -1; t <= 1; t++) part(new THREE.ConeGeometry(.012, .03, 3), at(t * .022, .515, .925, Math.PI), fixed(gold ? 0xffe6a0 : STONE.tooth));
  const JAW = [[.64, .52, .11, .05], [.76, .46, .1, .04], [.88, .45, .075, .028], [.93, .455, .05, .018]];
  part(loft(JAW.map(([z, y, w, h]) => hoop(z, y, w, h, 6))));
  // The long tail, round the back and along its right side, the tip curling up.
  const TAIL = [[0, .42, -.62, .06], [.13, .28, -.7, .056], [.3, .12, -.7, .052], [.42, .065, -.52, .048], [.46, .056, -.26, .044], [.45, .054, 0, .04], [.42, .056, .22, .034], [.38, .09, .38, .027], [.35, .15, .44, .018]];
  part(limb(TAIL));
  for (const i of [3, 4, 5, 6]) { const [x, y, z, r] = TAIL[i]; part(limb([[x, y, z - .012, r * 1.14], [x, y, z + .012, r * 1.14]], 5), null, carve); }
  // Rosettes cut shallow into the flanks and haunches: dark broken rings with a pale eye.
  const rosette = (x, y, z, nx, ny, nz, r) => {
    const m = new THREE.Matrix4().compose(new THREE.Vector3(x + nx * .006, y + ny * .006, z + nz * .006), new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, 1), new THREE.Vector3(nx, ny, nz).normalize()), new THREE.Vector3(1, 1, 1));
    part(new THREE.RingGeometry(r * .5, r, 6, 1, random() * 3), m, carve);
  };
  for (const s of [-1, 1]) {
    // Along the flank: over the loft's own surface at that angle.
    for (const [z, t, r] of [[-.2, .3, .04], [-.08, -.05, .035], [.02, .42, .038], [.14, .08, .04], [.24, .55, .036], [-.32, .62, .036], [.32, .18, .04]]) {
      const seg = SPINE.findIndex(q => q[0] >= z), A = SPINE[seg - 1], B = SPINE[seg], u = (z - A[0]) / (B[0] - A[0]), y = A[1] + (B[1] - A[1]) * u, w = A[2] + (B[2] - A[2]) * u, h = A[3] + (B[3] - A[3]) * u;
      rosette(s * Math.cos(t) * w, y + Math.sin(t) * h, z, s * Math.cos(t) / w, Math.sin(t) / h, 0, r);
    }
    // On the haunch: the ellipsoid's own surface.
    for (const [a, e, r] of [[.5, .1, .042], [1.2, .5, .04], [-.1, .55, .038], [.9, -.2, .038]]) {
      const nx = Math.cos(e) * Math.cos(a), ny = Math.sin(e), nz = Math.cos(e) * Math.sin(a) * (a > 0 ? -1 : 1);
      rosette(s * (.2 + .125 * nx), .4 + .3 * ny, -.34 + .31 * nz, s * nx / .125, ny / .3, nz / .31, r);
    }
  }
  // Moss clumps and a crack down the flank: what the years did to it.
  if (!gold && moss) for (const [x, y, z, r] of [[.1, .73, -.36, .06], [-.13, .74, -.3, .05], [-.05, .77, .26, .045]]) part(new THREE.OctahedronGeometry(r, 0), at(x, y, z, random(), random(), random(), 1, .4, 1.3), fixed(STONE.moss));
  if (!gold) for (const s of [-1, 1]) for (const [ax, ay, az, bx, by, bz] of [[.21, .62, -.3, .305, .42, -.24], [.305, .42, -.24, .29, .28, -.34]]) { const p = new THREE.Vector3(s * ax, ay, az), q = new THREE.Vector3(s * bx, by, bz), len = p.distanceTo(q); part(new THREE.BoxGeometry(.006, .012, len), new THREE.Matrix4().lookAt(p, q, new THREE.Vector3(1, 0, 0)).setPosition((p.x + q.x) / 2, (p.y + q.y) / 2, (p.z + q.z) / 2), carve); }
  if (plinth) {
    const Z = -.2, slab = (w, y0, y1, d, chip) => kit.add(chippedBox(w, y1 - y0, d, random, chip), at(0, (y0 + y1) / 2, Z), dressed);
    // Footing, step, die, then a moulded cornice in two courses.
    slab(1.25, 0, .14, 1.5, .07); slab(1.13, .14, .27, 1.38, .05); slab(.98, .27, .47, 1.22, .025); slab(1.06, .47, .52, 1.3, .02); slab(1.14, .52, .62, 1.38, .05);
    // The glyph band round the die: a recessed strip, carved jaguar faces and step frets on it.
    const glyphs = (length, place) => {
      const cells = Math.round(length / .19), pitch = length / cells, flat = (w, h, u, v, tint) => { const g = new THREE.PlaneGeometry(w, h); kit.add(g, place(u, v), tint); };
      flat(length - .02, .13, 0, .37, carve);
      const raised = paintRaised;
      for (let i = 0; i < cells; i++) {
        const u = -length / 2 + (i + .5) * pitch;
        if (i % 2) {
          // A step fret.
          flat(pitch * .62, .022, u, .335, raised); flat(pitch * .34, .022, u - pitch * .14, .37, raised); flat(pitch * .16, .022, u - pitch * .23, .405, raised);
        } else {
          // A jaguar's face: a square brow, two ears, eyes and a chin.
          flat(pitch * .56, .018, u, .405, raised); flat(pitch * .56, .018, u, .335, raised); flat(.016, .075, u - pitch * .28, .37, raised); flat(.016, .075, u + pitch * .28, .37, raised);
          flat(.02, .018, u - pitch * .2, .427, raised); flat(.02, .018, u + pitch * .2, .427, raised); flat(.018, .018, u - pitch * .11, .372, raised); flat(.018, .018, u + pitch * .11, .372, raised);
        }
      }
    };
    const paintRaised = (c, x, y, z, nx, ny) => { dressed(c, x, Math.max(y, .46), z, nx, ny); c.multiplyScalar(1.28); };
    const front = Z + .61 + .002, back = Z - .61 - .002, side = .49 + .002;
    glyphs(.96, (u, v) => at(u, v, front));
    glyphs(.96, (u, v) => at(-u, v, back, 0, Math.PI, 0));
    glyphs(1.2, (u, v) => at(side, v, Z - u, 0, Math.PI / 2, 0));
    glyphs(1.2, (u, v) => at(-side, v, Z + u, 0, -Math.PI / 2, 0));
    // Cracks in the step and the footing, a fallen chip, moss where water sits.
    const crack = (x, y, z, w, h, r = 0) => kit.add(new THREE.PlaneGeometry(w, h), at(x, y, z, 0, 0, r), carve);
    crack(-.32, .08, Z + .752, .012, .12, .3); crack(-.28, .155, Z + .692, .01, .09, -.4); crack(.38, .09, Z + .752, .012, .1, -.2); crack(.1, .22, Z + .692, .01, .08, .5);
    if (!gold) for (const [x, y, z, r] of [[-.52, .15, Z + .63, .07], [.5, .15, Z - .6, .06], [.53, .28, Z + .6, .045], [-.5, .63, Z - .62, .05]]) kit.add(new THREE.OctahedronGeometry(r, 0), at(x, y, z, random(), random(), random(), 1.1, .45, 1), moss ? fixed(STONE.moss) : null);
    kit.add(new THREE.DodecahedronGeometry(.055, 0), at(.66, .05, Z + .6, random(), random(), random(), 1, .7, 1.1), dressed);
  }
  const merged = kit.build(paint);
  const rock = new THREE.MeshStandardMaterial(gold ? { vertexColors: true, roughness: .3, metalness: .55, emissive: 0x4a2c00, emissiveIntensity: .4, flatShading: true } : { vertexColors: true, roughness: 1, flatShading: true });
  const group = new THREE.Group(); group.name = gold ? 'Jaguar de oro' : 'Jaguar de piedra';
  const m = new THREE.Mesh(merged, rock); m.castShadow = m.receiveShadow = true; group.add(m);
  group.userData = { assetId: 'jaguar-statue', footprintRadius: .9, previewBounds: [[-.7, 0, -1.1], [.7, top + .1, .8]] };
  let disposed = false;
  group.userData.dispose = () => { if (disposed) return; disposed = true; merged.dispose(); rock.dispose(); };
  return group;
}

// Side view of a walking jaguar, nose at +x, paws on y = 0, about 1 × .47:
// heavy shoulders, big head, short legs and a tail curling up at the tip.
const PROFILE = [
  [-.5, .42], [-.47, .45], [-.44, .42], [-.42, .33], [-.38, .3], [-.3, .33], [-.12, .35], [.1, .37], [.2, .36],
  [.24, .41], [.26, .45], [.285, .47], [.3, .44], [.36, .43], [.42, .4], [.47, .36], [.48, .33], [.46, .3],
  [.42, .29], [.4, .26], [.33, .25], [.27, .24], [.22, .2], [.24, .08], [.27, .04], [.31, .02], [.31, 0],
  [.19, 0], [.16, .06], [.14, .15], [0, .16], [-.15, .16], [-.2, .17], [-.16, .08], [-.14, .04], [-.11, .02],
  [-.11, 0], [-.24, 0], [-.27, .07], [-.33, .18], [-.36, .26], [-.4, .27], [-.45, .36], [-.49, .39],
];
const ROSETTES = [[-.27, .27], [-.17, .28], [-.06, .29], [.05, .3], [.14, .3], [-.22, .21], [-.11, .21], [0, .22], [.1, .23]];

// A carved stone panel: a jaguar in low relief inside a raised frame,
// rosettes as shallow drilled rings, a step-fret band below. Origin at the
// bottom centre of the slab, carving facing +Z. Set it in a wall or across
// two pillars as a lintel.
export function jaguarRelief({ width = 2.4, height = 1.1, depth = .4, seed = 13, stone = 0x9a907a, moss = true } = {}) {
  const random = rng(seed), carved = stonePainter(stone, moss, random);
  // The recessed field reads darker than the carving standing out of it.
  const field = stonePainter(new THREE.Color(stone).multiplyScalar(.8).getHex(), false, random);
  const rock = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1, flatShading: true });
  const parts = [];
  const add = (geometry, matrix, paint = carved) => parts.push([geometry.index ? geometry.toNonIndexed() : geometry, matrix, paint]);
  const face = depth / 2, rim = .08, band = height * .2, raised = .05;
  add(new THREE.BoxGeometry(width, height, depth), at(0, height / 2, 0), field);
  // Raised frame round the carving.
  add(new THREE.BoxGeometry(width, rim, raised), at(0, height - rim / 2, face + raised / 2));
  add(new THREE.BoxGeometry(width, rim, raised), at(0, band + rim / 2, face + raised / 2));
  for (const s of [-1, 1]) add(new THREE.BoxGeometry(rim, height - band - rim * 2, raised), at(s * (width - rim) / 2, (height + band) / 2, face + raised / 2));
  // Step-fret band under the frame.
  const frets = Math.max(4, Math.round(width / .3)), pitch = width / frets;
  for (let i = 0; i < frets; i++) {
    const x = -width / 2 + (i + .5) * pitch;
    add(new THREE.BoxGeometry(pitch * .62, band * .32, .04), at(x, band * .3, face + .02));
    add(new THREE.BoxGeometry(pitch * .24, band * .3, .04), at(x + pitch * .19, band * .62, face + .02));
  }
  // The jaguar, fitted into the field.
  const fieldW = width - rim * 2 - .12, fieldH = height - band - rim * 2 - .06;
  const k = Math.min(fieldW, fieldH / .47), base = band + rim + (fieldH - .47 * k) / 2 + .03;
  const shape = new THREE.Shape(PROFILE.map(([x, y]) => new THREE.Vector2(x * k, y * k)));
  add(new THREE.ExtrudeGeometry(shape, { depth: .05, bevelEnabled: true, bevelThickness: .02, bevelSize: .012, bevelSegments: 1 }), at(0, base, face));
  for (const [x, y] of ROSETTES) add(new THREE.TorusGeometry(.024 * k, .006 * k, 4, 10), at((x + (random() - .5) * .02) * k, base + y * k, face + .072));
  add(new THREE.SphereGeometry(.014 * k, 6, 4), at(.39 * k, base + .385 * k, face + .07));
  const merged = mergeGeometries(parts.map(([g, m, paint]) => painted(g, m, paint)));
  parts.forEach(([g]) => g.dispose());
  const group = new THREE.Group(); group.name = 'Relieve del jaguar';
  const m = new THREE.Mesh(merged, rock); m.castShadow = m.receiveShadow = true; group.add(m);
  group.userData = { assetId: 'jaguar-relief', previewBounds: [[-width / 2, 0, -depth / 2], [width / 2, height, depth / 2 + .15]] };
  let disposed = false;
  group.userData.dispose = () => { if (disposed) return; disposed = true; merged.dispose(); rock.dispose(); };
  return group;
}
