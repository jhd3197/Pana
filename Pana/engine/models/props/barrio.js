// Barrio street props: a parked street moto, the utility pole with its
// spaghetti of cables, stacked produce crates, a market hand truck and the
// plastic plaza chair. Ground origin at y = 0, fronts toward +Z unless a
// comment says otherwise. Each factory owns its materials (no shared cache),
// so userData.dispose frees everything it built. Registered in Pana Studio
// (props/catalog/barrio.js); Trifulca dresses its arenas with them.
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { rng } from '../../random.js';

function kit(name) {
  const group = new THREE.Group(); group.name = name;
  const cache = new Map();
  const mat = (color, extra = {}) => {
    const key = color + JSON.stringify(extra);
    if (!cache.has(key)) cache.set(key, new THREE.MeshStandardMaterial({ color, roughness: .6, ...extra }));
    return cache.get(key);
  };
  const part = (parent, geometry, material, x = 0, y = 0, z = 0) => {
    const mesh = new THREE.Mesh(geometry, material); mesh.position.set(x, y, z);
    mesh.castShadow = mesh.receiveShadow = true; parent.add(mesh); return mesh;
  };
  const tube = (parent, a, b, r, material, sides = 8) => {
    const va = new THREE.Vector3(...a), vb = new THREE.Vector3(...b);
    const mesh = part(parent, new THREE.CylinderGeometry(r, r, va.distanceTo(vb), sides), material);
    mesh.position.copy(va).add(vb).multiplyScalar(.5);
    mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), vb.sub(va).normalize());
    return mesh;
  };
  const done = () => {
    group.userData.dispose = () => {
      const geometries = new Set(); group.traverse(o => o.geometry && geometries.add(o.geometry));
      geometries.forEach(g => g.dispose()); cache.forEach(m => m.dispose()); group.removeFromParent();
    };
    return group;
  };
  return { group, mat, part, tube, done };
}

// ---------- Moto estacionada ----------
// A cheap street moto on its side stand, about 2 × 0.7 × 1.1 m, nose toward +X.
// The body sits in a child `tipper` pivoting on its left side (−Z) at the
// ground, so `tipper.rotation.x` lays it down like a domino.
export const MOTO_COLORS = ['#e8443a', '#2b6fd6', '#1f1f24', '#f2b631', '#2aa876', '#e6e1d6'];
export function parkedMoto({ color = '#e8443a', seed = 1, detail = 'full' } = {}) {
  const { group, mat, part, tube, done } = kit('Moto estacionada');
  const random = rng(seed), seg = detail === 'light' ? 10 : 20;
  const paint = mat(color, { roughness: .35, metalness: .15 }), black = mat('#222226', { roughness: .8 });
  const chrome = mat('#cfd3d8', { metalness: .85, roughness: .25 }), seat = mat('#2c2724', { roughness: .7 });
  const tipper = new THREE.Group(); tipper.name = 'tipper'; tipper.position.z = -.32; group.add(tipper);
  const body = new THREE.Group(); body.position.z = .32; body.rotation.x = -.08; tipper.add(body);
  for (const x of [-.68, .7]) {
    const tyre = part(body, new THREE.TorusGeometry(.27, .085, 8, seg), black, x, .32, 0);
    const hub = part(body, new THREE.CylinderGeometry(.14, .14, .1, seg), chrome, x, .32, 0); hub.rotation.x = Math.PI / 2;
    void tyre;
  }
  // Frame, tank, seat, rear rack, engine block and exhaust.
  tube(body, [-.68, .32, 0], [-.05, .55, 0], .04, black);
  tube(body, [.7, .32, 0], [.5, .95, 0], .035, chrome);
  part(body, new RoundedBoxGeometry(.5, .28, .3, 3, .1), paint, .22, .82, 0).rotation.z = -.18;
  part(body, new RoundedBoxGeometry(.72, .12, .28, 3, .05), seat, -.3, .86, 0);
  part(body, new RoundedBoxGeometry(.5, .2, .3, 2, .08), paint, -.36, .72, 0);
  part(body, new THREE.BoxGeometry(.32, .06, .3), black, -.72, .9, 0);
  part(body, new RoundedBoxGeometry(.34, .3, .22, 2, .06), mat('#55585e', { metalness: .4, roughness: .5 }), 0, .45, 0);
  tube(body, [.05, .32, .14], [-.75, .4, .16], .045, chrome);
  // Front: fork, handlebar with grips, round headlight and the fender.
  tube(body, [.5, .95, -.3], [.5, .95, .3], .022, chrome);
  for (const z of [-.3, .3]) part(body, new THREE.CylinderGeometry(.03, .03, .1, 8), black, .5, .95, z).rotation.x = Math.PI / 2;
  const lamp = part(body, new THREE.SphereGeometry(.09, seg, 8), mat('#fff3c4', { emissive: '#ffe08a', emissiveIntensity: .25 }), .62, .86, 0);
  lamp.scale.set(.7, 1, 1);
  part(body, new RoundedBoxGeometry(.4, .05, .14, 2, .02), paint, .72, .62, 0).rotation.z = -.4;
  part(body, new RoundedBoxGeometry(.36, .05, .14, 2, .02), paint, -.72, .64, 0).rotation.z = .35;
  // The side stand on the left, in the ground.
  tube(body, [-.08, .3, -.12], [-.2, .02, -.32], .018, chrome);
  if (random() < .5) part(body, new RoundedBoxGeometry(.3, .26, .3, 2, .06), mat(['#f2b631', '#e8443a', '#2aa876'][Math.floor(random() * 3)]), -.72, 1.06, 0);
  group.userData.tipper = tipper;
  group.userData.previewBounds = [[-1.05, 0, -.5], [1.05, 1.2, .5]];
  return done();
}

// ---------- Esquina de los cables ----------
// A barrio concrete pole, height m tall, with a crossarm, a transformer drum
// and a tangle of drooping cables. `cableSpan` strings cables between poles.
export function cablePole({ height = 8, seed = 3, detail = 'full' } = {}) {
  const { group, mat, part, tube, done } = kit('Esquina de los cables');
  const random = rng(seed), concrete = mat('#b9b2a5', { roughness: .95 }), cable = mat('#1d1d20', { roughness: .8 });
  part(group, new THREE.CylinderGeometry(.11, .17, height, detail === 'light' ? 6 : 10), concrete, 0, height / 2, 0);
  part(group, new THREE.BoxGeometry(1.8, .12, .12), mat('#7a6a55', { roughness: .9 }), 0, height - .5, 0);
  for (const x of [-.75, -.25, .25, .75]) part(group, new THREE.CylinderGeometry(.035, .045, .14, 6), mat('#e9eef0'), x, height - .38, 0);
  const drum = part(group, new THREE.CylinderGeometry(.3, .3, .8, 14), mat('#8a9497', { metalness: .3, roughness: .6 }), .38, height - 1.6, 0);
  drum.add(part(new THREE.Group(), new THREE.CylinderGeometry(.32, .32, .06, 14), mat('#5d666a'), 0, .4, 0));
  tube(group, [.38, height - 1.2, 0], [.25, height - .45, 0], .02, cable);
  // The spaghetti: loops hanging off the crossarm and coiled around the pole.
  const loops = detail === 'light' ? 3 : 7;
  for (let i = 0; i < loops; i++) {
    const x0 = (random() - .5) * 1.6, x1 = (random() - .5) * 1.6, sag = .5 + random() * 1.4, z = (random() - .5) * .4;
    const curve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(x0, height - .45, z), new THREE.Vector3((x0 + x1) / 2 + (random() - .5) * .4, height - .45 - sag, z + (random() - .5) * .5),
      new THREE.Vector3(x1, height - .45, z * .5)]);
    part(group, new THREE.TubeGeometry(curve, 12, .016, 4), cable);
  }
  const coil = new THREE.CatmullRomCurve3(Array.from({ length: 14 }, (_, i) => new THREE.Vector3(Math.cos(i * 1.3) * .19, height - 2.2 - i * .12, Math.sin(i * 1.3) * .19)));
  part(group, new THREE.TubeGeometry(coil, 40, .02, 4), cable);
  group.userData.top = height - .45;
  group.userData.previewBounds = [[-1, 0, -.5], [1, height + .2, .5]];
  return done();
}

// Drooping cables from one point to another (world coordinates in the
// parent's space): a few strands with different sags.
export function cableSpan(from, to, { strands = 4, seed = 5 } = {}) {
  const { group, mat, part, done } = kit('Cables entre postes');
  const random = rng(seed), cable = mat('#1d1d20', { roughness: .8 });
  const a = new THREE.Vector3(...from), b = new THREE.Vector3(...to);
  for (let i = 0; i < strands; i++) {
    const sag = .5 + random() * 1.1, off = new THREE.Vector3((random() - .5) * .8, (random() - .5) * .2, (random() - .5) * .8);
    const points = Array.from({ length: 9 }, (_, k) => {
      const t = k / 8, p = a.clone().lerp(b, t).add(off.clone().multiplyScalar(Math.sin(t * Math.PI)));
      p.y -= Math.sin(t * Math.PI) * sag; return p;
    });
    part(group, new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points), 20, .018, 4), cable).castShadow = false;
  }
  return done();
}

// ---------- Pila de cajas de verdura ----------
// Cardboard and plastic crates of cabbages, tomatoes and plantains stacked a
// little messily, filling a w × d × h box exactly (origin at its floor centre).
export function produceCrates({ w = 1.6, d = 1, h = 1.2, seed = 2, detail = 'full' } = {}) {
  const { group, mat, part, done } = kit('Pila de cajas de verdura');
  const random = rng(seed), seg = detail === 'light' ? 5 : 8;
  const crates = [mat('#2f7fd0', { roughness: .5 }), mat('#e2a33b', { roughness: .5 }), mat('#d9b98a', { roughness: .95 }), mat('#3aa36b', { roughness: .5 })];
  const produce = [
    { m: mat('#7cc254', { roughness: .8 }), r: .11, n: 4 },     // repollos
    { m: mat('#e5402e', { roughness: .4 }), r: .055, n: 9 },    // tomates
    { m: mat('#f4cf3a', { roughness: .6 }), r: .05, n: 7, long: true },   // plátanos
    { m: mat('#f08a25', { roughness: .5 }), r: .065, n: 7 },    // naranjas
  ];
  const cols = Math.max(1, Math.round(w / .55)), rows = Math.max(1, Math.round(d / .42)), levels = Math.max(1, Math.round(h / .32));
  const cw = w / cols, cd = d / rows, ch = h / levels;
  const geo = new RoundedBoxGeometry(cw * .96, ch * .74, cd * .96, 2, .02);
  for (let l = 0; l < levels; l++) for (let c = 0; c < cols; c++) for (let r = 0; r < rows; r++) {
    if (l === levels - 1 && random() < .25 && levels > 1) continue;
    const jitter = l ? (random() - .5) * .05 : 0, x = -w / 2 + cw * (c + .5) + jitter, z = -d / 2 + cd * (r + .5) + jitter;
    const crate = part(group, geo, crates[Math.floor(random() * crates.length)], x, l * ch + ch * .37, z);
    crate.rotation.y = l ? (random() - .5) * .08 : 0;
    // Fruit heaped on top of the crates that show their tops.
    const above = l === levels - 1 || random() < .15;
    if (!above) continue;
    const kind = produce[Math.floor(random() * produce.length)];
    for (let k = 0; k < kind.n; k++) {
      const fruit = part(group, new THREE.SphereGeometry(kind.r, seg, seg - 2), kind.m,
        x + (random() - .5) * (cw * .7), l * ch + ch * .74 + kind.r * .7, z + (random() - .5) * (cd * .7));
      if (kind.long) { fruit.scale.set(2.6, .8, .8); fruit.rotation.y = random() * Math.PI; fruit.rotation.z = .3; }
    }
  }
  group.userData.previewBounds = [[-w / 2, 0, -d / 2], [w / 2, h + .2, d / 2]];
  return done();
}

// ---------- Carretilla de mercado ----------
// A red two-wheel hand truck, 0.6 × 0.5 × 1.3 m, standing upright with its
// nose plate toward +Z; `load` straps a stack of produce boxes on.
export function marketHandTruck({ seed = 4, load = true } = {}) {
  const { group, mat, part, tube, done } = kit('Carretilla de mercado');
  const red = mat('#d8322b', { roughness: .4, metalness: .2 }), black = mat('#222', { roughness: .8 }), steel = mat('#c4c9cc', { metalness: .7, roughness: .3 });
  for (const x of [-.25, .25]) {
    tube(group, [x, .12, -.12], [x, 1.3, -.2], .022, red);
    const wheel = part(group, new THREE.CylinderGeometry(.13, .13, .07, 14), black, x * 1.2, .13, -.2); wheel.rotation.z = Math.PI / 2;
    part(group, new THREE.CylinderGeometry(.06, .06, .08, 10), steel, x * 1.22, .13, -.2).rotation.z = Math.PI / 2;
  }
  for (const y of [.5, .9, 1.25]) tube(group, [-.25, y, -.15 - y * .045], [.25, y, -.15 - y * .045], .016, red);
  part(group, new THREE.BoxGeometry(.55, .025, .26), steel, 0, .03, 0);
  tube(group, [-.32, 1.3, -.2], [.32, 1.3, -.2], .024, black);
  if (load) {
    const random = rng(seed), colors = [mat('#d9b98a', { roughness: .95 }), mat('#2f7fd0'), mat('#e2a33b')];
    let y = .045;
    for (let i = 0; i < 3; i++) {
      const hgt = .26 + random() * .08;
      part(group, new RoundedBoxGeometry(.5, hgt, .38, 2, .02), colors[Math.floor(random() * 3)], (random() - .5) * .04, y + hgt / 2, .06).rotation.y = (random() - .5) * .1;
      y += hgt;
    }
    part(group, new THREE.BoxGeometry(.52, .03, .4), mat('#3b3b3b'), 0, y * .6, .07);
  }
  group.userData.previewBounds = [[-.4, 0, -.35], [.4, 1.4, .3]];
  return done();
}

// ---------- Silla plástica ----------
// The classic plastic plaza chair, bright and a bit toy-like. Seat top at
// 0,74 m, the back on −Z, sitter faces +Z.
export function plasticChair({ color = '#ff4b4b' } = {}) {
  const { group, mat, part, done } = kit('Silla plástica');
  const plastic = mat(color, { roughness: .35 });
  part(group, new RoundedBoxGeometry(1.25, .1, 1.15, 3, .05), plastic, 0, .69, .02);
  for (const x of [-.52, .52]) for (const z of [-.45, .5]) {
    const leg = part(group, new THREE.CylinderGeometry(.05, .065, .7, 10), plastic, x * 1.04, .34, z * 1.04);
    leg.rotation.set(z > 0 ? .06 : -.06, 0, x > 0 ? -.06 : .06);
  }
  const back = new THREE.Group(); back.position.set(0, .74, -.55); back.rotation.x = -.18; group.add(back);
  for (const x of [-.56, .56]) part(back, new RoundedBoxGeometry(.1, 1.05, .1, 2, .04), plastic, x, .52, 0);
  for (const y of [.42, .72, 1.0]) part(back, new RoundedBoxGeometry(1.2, .16, .08, 2, .035), plastic, 0, y, 0);
  part(group, new RoundedBoxGeometry(1.1, .05, .08, 2, .02), plastic, 0, .25, .5);
  group.userData.seat = .74;
  return done();
}
