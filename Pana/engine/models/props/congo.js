// The Congo: a long-necked river monster, the dugout you ride, and the jungle that walls
// the channels. Metres, +Y up, front at +Z, origin on the floor. Everything is a handful of
// draws: the monster's neck is one instanced mesh, a whole floor's vines three, and the
// forest two. No lights of their own; the headlamp and the fog do the work.
import * as THREE from 'three';
import { rng } from '../core/primitives.js';
import { parts, box, cyl, ball } from './reliquia-boss.js';

const HIDE = 0x38402e, HIDE_D = 0x252b1f, BELLY = 0x6b6c4e, MOSS = 0x4a5a2a, GUM = 0x7a1f24, THROAT = 0x1c0608, TOOTH = 0xf2e6c4, TOOTH_D = 0xb8a878;
const NECK = 16;
const ease = k => k * k * (3 - 2 * k);
const lerp = (a, b, k) => a + (b - a) * k;
const bezier = (a, b, c, d, u) => { const v = 1 - u; return v * v * v * a + 3 * v * v * u * b + 3 * v * u * u * c + u * u * u * d; };

// A row of cones along a jaw, tips pointing `dir` (1 up, -1 down). The front ones are the worst.
function toothRow(p, y, dir, length, width) {
  for (const s of [-1, 1]) for (let i = 0; i < 8; i++) {
    const u = i / 7, z = lerp(1.42, .05, u), x = s * width * Math.sqrt(Math.max(.04, 1 - (z / 1.6) ** 2)), big = i === 1 ? 1.75 : i === 0 ? 1.2 : 1 - u * .25, h = length * big, r = .1 * Math.sqrt(big);
    p.add(new THREE.ConeGeometry(r, h, 6), i % 3 ? TOOTH : TOOTH_D, x, y + dir * h / 2, z, dir > 0 ? 0 : Math.PI);
  }
}

// The monster. userData.animate(t, pose) with pose { walk, teeth, jaw, reach, windup, stun,
// fall, grow, shade }, all but `reach` (metres to the head's stop) and `grow` (head scale) in 0…1.
export function mokele({ seed = 1 } = {}) {
  const root = new THREE.Group(); root.name = 'El Mokele'; // i18n-ignore: scene graph name
  const material = new THREE.MeshLambertMaterial({ vertexColors: true });
  const neckMaterial = new THREE.MeshLambertMaterial({ color: HIDE });
  const teethMaterial = new THREE.MeshBasicMaterial({ vertexColors: true });
  const eyeMaterial = new THREE.MeshBasicMaterial({ color: 0xffb030 });
  const geometries = [];
  const mesh = (build, mat = material) => { const p = parts(); build(p); const g = p.build(); geometries.push(g); return new THREE.Mesh(g, mat); };

  const body = mesh(p => {
    p.add(ball(1, 16, 12), HIDE, 0, 3, 0, 0, 0, 0, 2.5, 2.1, 3.7);
    p.add(ball(1, 12, 8), BELLY, 0, 2.1, .3, 0, 0, 0, 2.05, 1.25, 3.1);
    // A ridge down the back and moss in patches, so the hump reads against the fog.
    for (let i = 0; i < 9; i++) p.add(ball(.42 - i * .018, 7, 5), HIDE_D, 0, 5.05 - Math.abs(i - 3) * .12, 2.9 - i * .85, 0, 0, 0, .7, 1, 1.2);
    for (const [x, y, z, s] of [[1.2, 4.5, .4, .9], [-1.4, 4.2, -1, 1.1], [.6, 4.7, -1.8, .8], [-.7, 4.6, 1.4, .7]]) p.add(ball(s, 7, 5), MOSS, x, y, z, 0, 0, 0, 1, .4, 1.1);
    for (const s of [-1, 1]) p.add(ball(1, 10, 7), HIDE_D, s * 2, 3, 2, 0, 0, 0, .7, 1.2, 1.2);
  });
  root.add(body);
  const legs = [[-1.75, 2.1], [1.75, 2.1], [-1.75, -2.2], [1.75, -2.2]].map(([x, z]) => {
    const g = new THREE.Group(); g.position.set(x, 2.5, z); root.add(g);
    g.add(mesh(p => { p.add(cyl(.72, .86, 2.6, 10), HIDE_D, 0, -1.25); p.add(ball(.95, 9, 6), HIDE_D, 0, -2.45, .1, 0, 0, 0, 1, .4, 1.15); }));
    return g;
  });
  const tail = new THREE.Group(); tail.position.set(0, 2.9, -3.2); root.add(tail);
  tail.add(mesh(p => { for (let i = 0; i < 7; i++) p.add(ball(1.1 - i * .135, 9, 7), i % 2 ? HIDE : HIDE_D, 0, -i * .28, -i * .95); }));

  // The neck: one instanced mesh of fat beads along a curve, moved every frame.
  const beadGeometry = new THREE.SphereGeometry(1, 12, 9); geometries.push(beadGeometry);
  const neck = new THREE.InstancedMesh(beadGeometry, neckMaterial, NECK); neck.frustumCulled = false; root.add(neck);
  const bead = new THREE.Object3D();

  const head = new THREE.Group(); root.add(head);
  const skull = mesh(p => {
    p.add(ball(1, 14, 10), HIDE, 0, .32, .1, 0, 0, 0, .78, .52, 1.1);
    p.add(ball(1, 12, 8), HIDE, 0, .24, 1, 0, 0, 0, .66, .36, .78);
    for (const s of [-1, 1]) { p.add(ball(.24, 8, 6), HIDE_D, s * .46, .66, .34, 0, 0, 0, 1.15, .75, 1.3); p.add(ball(.09, 6, 5), HIDE_D, s * .22, .46, 1.58); }
    // The roof of the mouth: dark, so the teeth stand out against it.
    p.add(box(1.04, .06, 1.72), GUM, 0, -.02, .72);
  });
  head.add(skull);
  head.add(mesh(p => toothRow(p, -.03, -1, .36, .55), teethMaterial));
  for (const s of [-1, 1]) { const eye = new THREE.Mesh(new THREE.SphereGeometry(.1, 8, 6), eyeMaterial); eye.position.set(s * .54, .56, .55); head.add(eye); geometries.push(eye.geometry); }
  const jaw = new THREE.Group(); jaw.position.set(0, -.04, -.2); head.add(jaw);
  jaw.add(mesh(p => {
    p.add(ball(1, 12, 8), HIDE_D, 0, -.26, .85, 0, 0, 0, .64, .24, 1.05);
    p.add(box(1, .05, 1.72), GUM, 0, -.06, .86);
    p.add(ball(.42, 8, 6), THROAT, 0, -.02, .1, 0, 0, 0, 1, .55, 1.2);
    p.add(ball(.3, 8, 6), GUM, 0, -.04, .84, 0, 0, 0, .8, .22, 1.5);
  }));
  jaw.add(mesh(p => toothRow(p, -.03, 1, .32, .53), teethMaterial));
  // Behind the teeth, nothing: the throat closes off the view into the skull.
  head.add(mesh(p => p.add(ball(.6, 9, 7), THROAT, 0, -.02, -.28, 0, 0, 0, 1, .7, .55), new THREE.MeshBasicMaterial({ vertexColors: true })));

  root.userData = {
    assetId: 'el-mokele', previewBounds: [[-3.2, 0, -9], [3.2, 12.2, 7]],
    animate(t, { walk = 0, teeth = 0, jaw: open = 0, reach = 6, windup = 0, stun = 0, fall = 0, grow = 1, shade = 0 } = {}) {
      const k = ease(Math.min(1, teeth)), stride = t * 2.1 + seed, sway = Math.sin(t * .55 + seed) * .7 + Math.sin(stride) * .25 * walk;
      for (const [i, leg] of legs.entries()) leg.rotation.x = Math.sin(stride + (i === 0 || i === 3 ? 0 : Math.PI)) * .3 * walk;
      body.position.y = Math.abs(Math.sin(stride)) * .1 * walk; body.rotation.z = Math.sin(stride) * .02 * walk;
      tail.rotation.y = Math.sin(t * .9 + seed) * .25;
      const lunge = reach + windup * -1.2;
      // Up in the fog, or brought down to your eyes.
      const px = [0, lerp(sway * .35, 0, k), lerp(sway, 0, k), lerp(sway * 1.3, 0, k)];
      const py = [3.5, lerp(7.2, 5.4, k), lerp(10.4, 3.2, k), lerp(11.2, 1.25, k)];
      const pz = [2.7, lerp(3.4, 4, k), lerp(4, lunge * .62 + 1, k), lerp(5.6, lunge, k)];
      if (fall) { py[1] += fall; py[2] += fall * 1.6; py[3] += fall * 1.8; px[3] += Math.sin(t * 7) * fall * 1.5; }
      for (let i = 0; i < NECK; i++) {
        const u = i / (NECK - 1), r = lerp(1.12, .54, Math.sqrt(u));
        bead.position.set(bezier(...px, u), bezier(...py, u), bezier(...pz, u)); bead.scale.setScalar(r); bead.updateMatrix(); neck.setMatrixAt(i, bead.matrix);
      }
      neck.instanceMatrix.needsUpdate = true;
      head.position.set(px[3], py[3], pz[3]);
      head.rotation.set(lerp(.42, -.06, k) + stun * .3 + Math.sin(t * 1.1 + seed) * .05 * (1 - k) - fall * .9, lerp(sway * .12, 0, k), 0);
      head.scale.setScalar(lerp(1, grow, k));
      jaw.rotation.x = .08 + Math.min(1, open) * .92 + Math.sin(t * 13) * .02 * open;
      // As a shape in the mist it is nearly black; the colours come up as it nears.
      const c = 1 - shade * .78; material.color.setScalar(c); neckMaterial.color.setHex(HIDE).multiplyScalar(c);
    },
    dispose() { geometries.forEach(g => g.dispose()); neck.dispose(); root.traverse(o => { if (o.material?.dispose) o.material.dispose(); }); },
  };
  root.userData.animate(0);
  return root;
}

// A fat dugout, 3.2 m long. Hull only: the paddle moves with `paddle(t)`. The waterline is y = 0.
export function piragua({ seed = 1, wood = 0x6a452a } = {}) {
  const root = new THREE.Group(); root.name = 'Piragua'; // i18n-ignore: scene graph name
  const dark = new THREE.Color(wood).multiplyScalar(.55).getHex(), pale = new THREE.Color(wood).lerp(new THREE.Color(0xc0a070), .45).getHex();
  const material = new THREE.MeshLambertMaterial({ vertexColors: true, emissive: 0x140c06, side: THREE.DoubleSide });
  const hull = parts();
  const shell = (w, h) => new THREE.SphereGeometry(1, w, h, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2);
  hull.add(shell(16, 6), wood, 0, .28, 0, 0, 0, 0, .66, .4, 1.62);
  // The inside, so you look down into it, and a plank to sit on.
  hull.add(shell(14, 5), dark, 0, .27, 0, 0, 0, 0, .58, .32, 1.5);
  for (const s of [-1, 1]) for (let i = 0; i < 7; i++) { const z = -1.26 + i * .42, x = s * .6 * Math.sqrt(1 - (z / 1.6) ** 2); hull.add(box(.09, .07, .46), pale, x, .28, z, 0, -s * z * .32); }
  hull.add(box(.86, .05, .24), pale, 0, .2, -.28);
  for (const s of [-1, 1]) hull.add(ball(.13, 7, 5), wood, 0, .28, s * 1.56, 0, 0, 0, 1.1, .8, 1.5);
  const mesh = new THREE.Mesh(hull.build(), material); root.add(mesh);
  const oar = parts(); oar.add(cyl(.024, .024, 1.3, 5), pale, 0, 0, 0); oar.add(ball(.15, 6, 4), wood, 0, -.68, 0, 0, 0, 0, .75, 1.1, .2);
  const paddle = new THREE.Mesh(oar.build(), material); paddle.position.set(.56, .36, .35); root.add(paddle);
  root.userData = {
    assetId: 'piragua', previewBounds: [[-.8, -.4, -1.7], [.8, 1, 1.7]],
    paddle(t, on = 0) { paddle.rotation.x = on * Math.sin(t * 5 + seed) * .55; paddle.rotation.z = -.5; },
    dispose() { mesh.geometry.dispose(); paddle.geometry.dispose(); material.dispose(); },
  };
  root.userData.paddle(0);
  return root;
}

// Lashed logs under a carrito, so it floats.
export function balsa({ width = 1.5, length = 2.1 } = {}) {
  const root = new THREE.Group(); root.name = 'Balsa'; // i18n-ignore: scene graph name
  const p = parts(), n = 5;
  for (let i = 0; i < n; i++) p.add(cyl(.17, .17, length, 7), i % 2 ? 0x5a3e26 : 0x6e4e30, -width / 2 + (i + .5) * width / n, 0, 0, Math.PI / 2);
  for (const s of [-1, 1]) p.add(box(width + .1, .06, .1), 0x8a7650, 0, .15, s * length * .36);
  const material = new THREE.MeshLambertMaterial({ vertexColors: true }), mesh = new THREE.Mesh(p.build(), material); root.add(mesh);
  root.userData = { assetId: 'balsa', previewBounds: [[-width / 2, -.2, -length / 2], [width / 2, .25, length / 2]], dispose() { mesh.geometry.dispose(); material.dispose(); } };
  return root;
}

// Hanging strands and leaves painted on a transparent sheet: a wall of them costs two
// triangles a piece of curtain. Fades out at the foot, where it trails in the water.
function vineSheet(seed) {
  const canvas = document.createElement('canvas'); canvas.width = canvas.height = 512;
  const ctx = canvas.getContext('2d'), R = rng(seed);
  for (let n = 0; n < 34; n++) {
    let x = R() * 512; const shade = 95 + R() * 85, thick = 2 + R() * 5, bottom = 330 + R() * 182;
    ctx.strokeStyle = `rgb(${shade * .66},${shade},${shade * .42})`; ctx.lineWidth = thick; ctx.beginPath(); ctx.moveTo(x, 0);
    const wobble = R() * 8 + 3, phase = R() * 6;
    for (let y = 16; y < bottom; y += 16) { ctx.lineTo(x + Math.sin(y * .02 + phase) * wobble, y); }
    ctx.stroke();
    for (let y = 14 + R() * 30; y < bottom; y += 18 + R() * 26) {
      const px = x + Math.sin(y * .02 + phase) * wobble, side = R() < .5 ? -1 : 1, size = 11 + R() * 15, tone = 95 + R() * 120;
      ctx.fillStyle = `rgb(${tone * .62},${tone * .96},${tone * .42})`;
      ctx.beginPath(); ctx.ellipse(px + side * size * .7, y, size, size * .42, side * (.5 + R() * .5), 0, Math.PI * 2); ctx.fill();
    }
  }
  const texture = new THREE.CanvasTexture(canvas); texture.colorSpace = THREE.SRGBColorSpace; texture.wrapS = THREE.RepeatWrapping;
  return texture;
}
const scratch = new THREE.Object3D(), tint = new THREE.Color();
// `solids` are rects that block (a dark mass, curtains on all four faces, leaf heads on top);
// `curtains` are thin rects that only hang, to dress a wall. userData.counts for the budget.
export function vineWalls({ solids = [[-4, -.4, 4, .4]], curtains = [], height = 3.9, wall = 4.8, seed = 7 } = {}) {
  const root = new THREE.Group(); root.name = 'Lianas'; // i18n-ignore: scene graph name
  const R = rng(seed), texture = vineSheet(seed + 1), SHEET = 1.7, faces = [], heads = [];
  const face = (x, z, h, w, tall) => faces.push({ x, z, h, w, tall });
  const along = (x0, z0, x1, z1, out, top = height) => {
    const span = Math.hypot(x1 - x0, z1 - z0), n = Math.max(1, Math.round(span / SHEET)), h = x1 > x0 ? (out > 0 ? 0 : Math.PI) : (out > 0 ? Math.PI / 2 : -Math.PI / 2);
    for (let i = 0; i < n; i++) {
      const u = (i + .5) / n, x = lerp(x0, x1, u), z = lerp(z0, z1, u), off = .05 + R() * .08, tall = top + (R() - .3) * .9;
      face(x1 > x0 ? x : x + out * off, x1 > x0 ? z + out * off : z, h, span / n * 1.25, tall);
    }
  };
  for (const [x0, z0, x1, z1] of solids) {
    along(x0, z1, x1, z1, 1); along(x0, z0, x1, z0, -1); along(x1, z0, x1, z1, 1); along(x0, z0, x0, z1, -1);
    const longest = Math.max(x1 - x0, z1 - z0), n = Math.max(1, Math.round(longest / 1.5));
    for (let i = 0; i < n; i++) { const u = (i + .5) / n; heads.push([lerp(x0, x1, u) + (R() - .5) * .3, lerp(z0, z1, u) + (R() - .5) * .3, .7 + R() * .6]); }
  }
  for (const [x0, z0, x1, z1] of curtains) {
    if (x1 - x0 > z1 - z0) along(x0, z1, x1, z1, 1, wall); else along(x1, z0, x1, z1, 1, wall);
    const longest = Math.max(x1 - x0, z1 - z0), n = Math.max(1, Math.round(longest / 1.8));
    for (let i = 0; i < n; i++) { const u = (i + .5) / n; heads.push([lerp(x0, x1, u) + (R() - .5) * .3, lerp(z0, z1, u) + (R() - .5) * .3, .9 + R() * .7, wall]); }
  }
  const coreMaterial = new THREE.MeshLambertMaterial({ color: 0x1a2a18 }), coreGeometry = new THREE.BoxGeometry(1, 1, 1);
  const core = new THREE.InstancedMesh(coreGeometry, coreMaterial, Math.max(1, solids.length)); core.count = solids.length; core.frustumCulled = false;
  solids.forEach(([x0, z0, x1, z1], i) => { scratch.position.set((x0 + x1) / 2, height / 2 - .2, (z0 + z1) / 2); scratch.rotation.set(0, 0, 0); scratch.scale.set(x1 - x0 - .06, height + .4, z1 - z0 - .06); scratch.updateMatrix(); core.setMatrixAt(i, scratch.matrix); });
  const sheetMaterial = new THREE.MeshLambertMaterial({ map: texture, alphaTest: .42, side: THREE.DoubleSide }), sheetGeometry = new THREE.PlaneGeometry(1, 1);
  const sheets = new THREE.InstancedMesh(sheetGeometry, sheetMaterial, Math.max(1, faces.length)); sheets.count = faces.length; sheets.frustumCulled = false;
  faces.forEach((f, i) => { scratch.position.set(f.x, f.tall / 2, f.z); scratch.rotation.set(0, f.h, 0); scratch.scale.set(f.w * (R() < .5 ? -1 : 1), f.tall, 1); scratch.updateMatrix(); sheets.setMatrixAt(i, scratch.matrix); sheets.setColorAt(i, tint.setHSL(.27 + R() * .06, .3, .62 + R() * .3)); });
  if (sheets.instanceColor) sheets.instanceColor.needsUpdate = true;
  const headMaterial = new THREE.MeshLambertMaterial({ color: 0x1f3418, flatShading: true }), headGeometry = new THREE.IcosahedronGeometry(1, 1);
  const tops = new THREE.InstancedMesh(headGeometry, headMaterial, Math.max(1, heads.length)); tops.count = heads.length; tops.frustumCulled = false;
  heads.forEach(([x, z, s, top = height], i) => { scratch.position.set(x, top + (R() - .5) * .4, z); scratch.rotation.set(R() * 3, R() * 3, 0); scratch.scale.set(s * 1.1, s * .7, s * 1.1); scratch.updateMatrix(); tops.setMatrixAt(i, scratch.matrix); tops.setColorAt(i, tint.setHSL(.28, .4, .22 + R() * .3)); });
  if (tops.instanceColor) tops.instanceColor.needsUpdate = true;
  root.add(core, sheets, tops);
  root.userData = {
    assetId: 'vine-walls', counts: { solids: solids.length, sheets: faces.length, heads: heads.length },
    dispose() { coreGeometry.dispose(); sheetGeometry.dispose(); headGeometry.dispose(); coreMaterial.dispose(); sheetMaterial.dispose(); headMaterial.dispose(); texture.dispose(); core.dispose(); sheets.dispose(); tops.dispose(); },
  };
  return root;
}

// Trees past the walls, one draw for the trunks and one for the crowns: shapes in the fog.
export function jungleBackdrop({ spots = [[0, 0]], tall = 22, seed = 9 } = {}) {
  const root = new THREE.Group(); root.name = 'Selva'; // i18n-ignore: scene graph name
  const R = rng(seed), trunkGeometry = new THREE.CylinderGeometry(.5, 1, 1, 7).translate(0, .5, 0), crownGeometry = new THREE.IcosahedronGeometry(1, 1);
  const trunkMaterial = new THREE.MeshLambertMaterial({ color: 0x1c1a14 }), crownMaterial = new THREE.MeshLambertMaterial({ color: 0x2e4232 });
  const trunks = new THREE.InstancedMesh(trunkGeometry, trunkMaterial, Math.max(1, spots.length)), crowns = new THREE.InstancedMesh(crownGeometry, crownMaterial, Math.max(1, spots.length * 3));
  trunks.count = spots.length; crowns.count = spots.length * 3; trunks.frustumCulled = crowns.frustumCulled = false;
  spots.forEach(([x, z], i) => {
    const h = tall * (.75 + R() * .5), r = 1 + R() * .9;
    scratch.position.set(x, 0, z); scratch.rotation.set(0, 0, 0); scratch.scale.set(r, h, r); scratch.updateMatrix(); trunks.setMatrixAt(i, scratch.matrix);
    for (let k = 0; k < 3; k++) { const s = 4 + R() * 4; scratch.position.set(x + (R() - .5) * 6, h * (.72 + k * .12), z + (R() - .5) * 6); scratch.rotation.set(R() * 3, R() * 3, 0); scratch.scale.set(s * 1.25, s * .62, s * 1.25); scratch.updateMatrix(); crowns.setMatrixAt(i * 3 + k, scratch.matrix); }
  });
  root.add(trunks, crowns);
  root.userData = { assetId: 'jungle-backdrop', dispose() { trunkGeometry.dispose(); crownGeometry.dispose(); trunkMaterial.dispose(); crownMaterial.dispose(); trunks.dispose(); crowns.dispose(); } };
  return root;
}

// Lily pads on a floor's channels, one draw. `spots` are [x, z] on open water.
export function lilyPads({ spots = [[0, 0], [1.2, .6], [-.8, 1]], y = .16, seed = 3 } = {}) {
  const R = rng(seed), geometry = new THREE.CircleGeometry(1, 9, .4, Math.PI * 2 - .55).rotateX(-Math.PI / 2), material = new THREE.MeshLambertMaterial({ color: 0x4a7036, side: THREE.DoubleSide });
  const pads = new THREE.InstancedMesh(geometry, material, Math.max(1, spots.length)); pads.count = spots.length; pads.frustumCulled = false; pads.name = 'Nenúfares'; // i18n-ignore: scene graph name
  spots.forEach(([x, z], i) => { const s = .22 + R() * .3; scratch.position.set(x, y, z); scratch.rotation.set(0, R() * 6.28, 0); scratch.scale.set(s, 1, s); scratch.updateMatrix(); pads.setMatrixAt(i, scratch.matrix); pads.setColorAt(i, tint.setHSL(.28 + R() * .05, .4, .24 + R() * .14)); });
  if (pads.instanceColor) pads.instanceColor.needsUpdate = true;
  pads.userData = { assetId: 'lily-pads', dispose() { geometry.dispose(); material.dispose(); pads.dispose(); } };
  return pads;
}

// A whirlpool as wide as `rect`: a painted spiral turning on the water, one draw. Unlit and
// pale at its arms so it reads as danger from the rim through the fog.
export function whirlpool({ rect = [-5, -5, 5, 5], y = 0, seed = 5 } = {}) {
  const canvas = document.createElement('canvas'); canvas.width = canvas.height = 512;
  const ctx = canvas.getContext('2d'), R = rng(seed);
  ctx.fillStyle = '#0a0d08'; ctx.fillRect(0, 0, 512, 512);
  for (let arm = 0; arm < 7; arm++) {
    const start = arm / 7 * Math.PI * 2, tone = 90 + R() * 70;
    ctx.strokeStyle = `rgba(${tone},${tone * 1.05},${tone * .78},${.5 + R() * .35})`; ctx.lineWidth = 7 + R() * 9; ctx.lineCap = 'round'; ctx.beginPath();
    for (let u = 0; u <= 1; u += .02) { const r = 18 + u * 300, a = start + u * 4.4; if (u === 0) ctx.moveTo(256 + Math.cos(a) * r, 256 + Math.sin(a) * r); else ctx.lineTo(256 + Math.cos(a) * r, 256 + Math.sin(a) * r); }
    ctx.stroke();
  }
  const map = new THREE.CanvasTexture(canvas); map.colorSpace = THREE.SRGBColorSpace; map.center.set(.5, .5);
  const [a, b, c, d] = rect, geometry = new THREE.PlaneGeometry(c - a, d - b).rotateX(-Math.PI / 2), material = new THREE.MeshBasicMaterial({ map, color: 0xbfc6a8 });
  const mesh = new THREE.Mesh(geometry, material); mesh.position.set((a + c) / 2, y, (b + d) / 2); mesh.name = 'Remolino'; // i18n-ignore: scene graph name
  mesh.userData = { assetId: 'whirlpool', tick: t => { map.rotation = -t * .5; }, dispose() { geometry.dispose(); material.dispose(); map.dispose(); } };
  return mesh;
}
