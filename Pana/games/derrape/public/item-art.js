// Models and HUD icons for Derrape's bigger items: the cohete that chases the
// car ahead, the chancleta that hunts the leader, the totuma shield, the
// trap crate, the aguacero rain cloud. Flat-shaded like the rest of the race.

import * as THREE from 'three';

const mat = (color, extra = {}) => new THREE.MeshStandardMaterial({ color, flatShading: true, roughness: 0.7, ...extra });
const shadows = (g) => { g.traverse(m => { m.castShadow = true; }); return g; };

// A cohete de pirotecnia: striped tube, yellow nose, guide stick. Points +z.
export function makeRocket() {
  const g = new THREE.Group();
  const body = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.32, 1.5, 8), mat(0xe8452c));
  body.rotation.x = Math.PI / 2;
  const band = new THREE.Mesh(new THREE.CylinderGeometry(0.335, 0.335, 0.3, 8), mat(0xfff3d6));
  band.rotation.x = Math.PI / 2;
  const nose = new THREE.Mesh(new THREE.ConeGeometry(0.34, 0.7, 8), mat(0xffc629));
  nose.rotation.x = Math.PI / 2; nose.position.z = 1.1;
  const stick = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.08, 1.6), mat(0xb5814a));
  stick.position.set(0, -0.3, -1.1);
  const flame = new THREE.Mesh(new THREE.ConeGeometry(0.26, 0.8, 7), mat(0xffae2b, { emissive: 0xff7b1c, emissiveIntensity: 0.9 }));
  flame.rotation.x = -Math.PI / 2; flame.position.z = -1.1; flame.name = 'flame';
  g.add(body, band, nose, stick, flame);
  g.scale.setScalar(1.25);
  return shadows(g);
}

// La chancleta: a flip-flop sole with a Y strap, thrown by every Venezuelan mom.
export function makeChancleta() {
  const g = new THREE.Group();
  const sole = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.42, 0.16, 12), mat(0x2f7fe0));
  sole.scale.set(1, 1, 2.2);
  const top = new THREE.Mesh(new THREE.CylinderGeometry(0.47, 0.4, 0.05, 12), mat(0xf6f1e3));
  top.scale.set(1, 1, 2.2); top.position.y = 0.1;
  const strap = mat(0xffc629);
  for (const side of [-1, 1]) {
    const s = new THREE.Mesh(new THREE.TorusGeometry(0.42, 0.07, 6, 10, Math.PI * 0.75), strap);
    s.rotation.set(0, side * 0.9, Math.PI / 2);
    s.position.set(side * 0.18, 0.12, 0.05);
    g.add(s);
  }
  g.add(sole, top);
  g.scale.setScalar(2.2);
  return shadows(g);
}

// The totuma protectora: a glossy gourd-coloured bubble around the car.
const bubbleGeo = new THREE.SphereGeometry(2.7, 18, 12);
const bubbleMat = new THREE.MeshStandardMaterial({ color: 0xffd36b, emissive: 0xb3741c, emissiveIntensity: 0.35, transparent: true, opacity: 0.28, roughness: 0.2, depthWrite: false });
export function makeShield() {
  const m = new THREE.Mesh(bubbleGeo, bubbleMat);
  m.name = 'totuma-shield';
  m.renderOrder = 2;
  return m;
}

// A trap crate is a supply crate with a red warning band and a fuse on top.
export function makeTrap(crateVisual) {
  const g = new THREE.Group();
  g.add(crateVisual.clone());
  const red = mat(0xd62c2c, { emissive: 0x5a0000, emissiveIntensity: 0.5 });
  const band = new THREE.Mesh(new THREE.BoxGeometry(1.74, 0.3, 1.74), red);
  band.position.y = 0.1;
  const fuse = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.6, 5), mat(0x3a3a40));
  fuse.position.y = 1.05; fuse.rotation.z = 0.4;
  const spark = new THREE.Mesh(new THREE.IcosahedronGeometry(0.16, 0), mat(0xffe14d, { emissive: 0xffae2b, emissiveIntensity: 1 }));
  spark.position.set(-0.13, 1.33, 0); spark.name = 'spark';
  g.add(band, fuse, spark);
  return shadows(g);
}

// HUD icons (SVG, never emoji), drawn like engine/icons.js.
const svg = (body) => `<svg viewBox="0 0 40 40" width="1em" height="1em">${body}</svg>`;
const ink = 'stroke="#16161a" stroke-width="2.5" stroke-linejoin="round"';
export const ITEM_ICONS = {
  cohete: svg(`<path d="M12 30l14-14 4-9-9 4-14 14z" fill="#e8452c" ${ink}/><path d="M26 16l4-9-9 4z" fill="#ffc629" ${ink}/><path d="M12 30l-5 3 3-5" fill="#ffae2b" ${ink}/><path d="M14 22l4 4" stroke="#fff3d6" stroke-width="3"/>`),
  chancleta: svg(`<ellipse cx="20" cy="21" rx="9" ry="15" fill="#2f7fe0" ${ink} transform="rotate(-25 20 21)"/><path d="M14 15q6 2 6 8M26 12q-6 3-6 11" fill="none" stroke="#ffc629" stroke-width="3.2" stroke-linecap="round"/>`),
  totuma: svg(`<circle cx="20" cy="21" r="14" fill="#ffd36b" fill-opacity=".55" ${ink}/><path d="M11 17a10 10 0 0 1 9-6" fill="none" stroke="#fff" stroke-width="3" stroke-linecap="round"/>`),
  trampa: svg(`<rect x="7" y="12" width="26" height="22" rx="2" fill="#bf8348" ${ink}/><rect x="7" y="19" width="26" height="7" fill="#d62c2c" ${ink}/><path d="M20 12l3-6" stroke="#3a3a40" stroke-width="2.5"/><circle cx="24" cy="5" r="2.6" fill="#ffe14d" stroke="#16161a" stroke-width="1.5"/>`),
  aguacero: svg(`<path d="M10 22a6 6 0 0 1 2-11 8 8 0 0 1 15 1 5 5 0 0 1 3 10z" fill="#9aa3b2" ${ink}/><path d="M13 27l-2 5M20 27l-2 5M27 27l-2 5" stroke="#4fb6ff" stroke-width="3" stroke-linecap="round"/>`),
  drift: svg(`<path d="M8 28c6-2 10-8 12-16" fill="none" stroke="#16161a" stroke-width="7" stroke-linecap="round"/><path d="M8 28c6-2 10-8 12-16" fill="none" stroke="#ff4b4b" stroke-width="4" stroke-linecap="round"/><circle cx="27" cy="27" r="3" fill="#4fb6ff"/><circle cx="31" cy="21" r="2.4" fill="#ff9a1f"/><circle cx="33" cy="14" r="2" fill="#c45bff"/>`),
  warning: svg(`<path d="M20 5l16 29H4z" fill="#ffc629" ${ink}/><path d="M20 15v9" stroke="#16161a" stroke-width="3.4" stroke-linecap="round"/><circle cx="20" cy="29" r="2" fill="#16161a"/>`),
  trophy: svg(`<path d="M12 6h16v8a8 8 0 0 1-16 0z" fill="#ffc629" ${ink}/><path d="M12 9H7a5 5 0 0 0 6 7M28 9h5a5 5 0 0 1-6 7" fill="none" ${ink}/><path d="M17 22h6v6h-6zM12 28h16v6H12z" fill="#e3ae39" ${ink}/>`),
};
