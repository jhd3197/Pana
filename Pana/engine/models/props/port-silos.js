// Ported from Juan's Casa Guipuzcoana 3D (1).html; original construction,
// dimensions, textures, openings, gallery, stairs and ornaments retained.
import * as THREE from 'three';
import { rng } from '../core/primitives.js';
import { finishPrototype } from './puerto-prototype-kit.js';

export function portSilos({driveThrough=false}={}){
const random=rng(752),scene=new THREE.Group();
const pick=a=>a[Math.floor(random()*a.length)];
const std=(color,extra={})=>new THREE.MeshStandardMaterial({color,roughness:.9,metalness:0,...extra});
const M={iron:std(0x1d1d1f,{roughness:.6})};
function canvasTex(w, h, draw, rep) {
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c); t.colorSpace=THREE.SRGBColorSpace;
  if (rep) { t.wrapS = t.wrapT = THREE.RepeatWrapping; }
  t.anisotropy = 4;
  return t;
}
function mesh(geo, mat, x = 0, y = 0, z = 0, parent = scene) {
  const m = new THREE.Mesh(geo, mat);
  m.position.set(x, y, z); m.castShadow = m.receiveShadow = true;
  parent.add(m); return m;
}
const box = (w, h, d, mat, x, y, z, p) => mesh(new THREE.BoxGeometry(w, h, d), mat, x, y, z, p);
const brickWallTex = canvasTex(128, 64, (g, w, h) => {
  g.fillStyle = '#7a3b26'; g.fillRect(0, 0, w, h);
  for (let r = 0; r < 8; r++) for (let k = -1; k < 5; k++) {
    g.fillStyle = pick(['#b65334', '#c05f3b', '#a94a2d', '#bb5a37']);
    g.fillRect(k * 32 + (r % 2) * 16 + 1, r * 8 + 1, 30, 6);
  }
}, true);
const formworkTex = canvasTex(64, 128, (g, w, h) => {
  g.fillStyle = '#c4beb2'; g.fillRect(0, 0, w, h);
  for (let y = 0; y < h; y += 16) {
    g.fillStyle = pick(['#bab3a6', '#cbc5b9', '#b3ac9f']); g.fillRect(0, y, w, 15);
    g.fillStyle = '#9d968a'; g.fillRect(0, y + 15, w, 1);
  }
  for (let i = 0; i < 40; i++) { g.fillStyle = 'rgba(80,70,60,0.12)'; g.fillRect(random() * w, random() * h, 3, 10 + random() * 30); }
}, true);
const stripeTex = canvasTex(256, 16, (g, w) => {
  for (let x = 0; x < w; x += 16) {
    g.fillStyle = '#eef1f2'; g.fillRect(x, 0, 9, 16);
    g.fillStyle = '#c9d0d6'; g.fillRect(x + 9, 0, 2, 16);
    g.fillStyle = '#3d6fd6'; g.fillRect(x + 11, 0, 5, 16);
  }
}, true);

const SM = {
  concrete: std(0xd8d4cb), frame: std(0xe4e0d6), roof: std(0xcfcac0),
  fin: std(0xf3f5f6, { roughness: 0.55 }), win: std(0x22303a, { roughness: 0.3 }),
  winFrame: std(0xf4f2ec), red: std(0xc23a2a, { roughness: 0.6 }),
};
function texMat(tex, rx, ry) { const t = tex.clone(); t.needsUpdate = true; t.repeat.set(rx, ry); return std(0xffffff, { map: t }); }

// A block with brick infill and an exposed concrete frame on all four faces
function framed(parent, w, h, d, x, y, z, bay = 2.6, floor = 3.2, opts = {}) {
  box(w, h, d, texMat(brickWallTex, Math.max(w, d) / 2.4, h / 1.2), x, y + h / 2, z, parent);
  const t = 0.3, p = 0.1;
  const faces = [
    { len: w, nx: 0, nz: 1, off: d / 2 }, { len: w, nx: 0, nz: -1, off: d / 2 },
    { len: d, nx: 1, nz: 0, off: w / 2 }, { len: d, nx: -1, nz: 0, off: w / 2 },
  ];
  for (const f of faces) {
    const n = Math.max(1, Math.round(f.len / bay));
    const along = (u) => f.nz ? [x + u, z + f.nz * (f.off + p / 2)] : [x + f.nx * (f.off + p / 2), z + u];
    for (let i = 0; i <= n; i++) {
      const u = -f.len / 2 + (f.len * i) / n;
      const [cx, cz] = along(u);
      box(f.nz ? t : p, h, f.nz ? p : t, SM.frame, cx, y + h / 2, cz, parent);
      if (opts.windows && i < n) {
        const [wx, wz] = along(u + f.len / n / 2);
        for (let fy = y + floor - 1.4; fy < y + h - 0.6; fy += floor) {
          if (opts.windows === 'top' && fy < y + h - floor) continue;
          box(f.nz ? 0.9 : 0.12, 1.0, f.nz ? 0.12 : 0.9, SM.winFrame, wx, fy, wz, parent);
          box(f.nz ? 0.7 : 0.14, 0.8, f.nz ? 0.14 : 0.7, SM.win, wx, fy, wz, parent);
        }
      }
    }
    for (let fy = y; fy <= y + h + 0.01; fy += floor) {
      const yy = Math.min(fy, y + h - t / 2);
      const [cx, cz] = along(0);
      box(f.nz ? f.len + t : p, t, f.nz ? p : f.len + t, SM.frame, cx, yy, cz, parent);
    }
  }
}

function silos(ox, oz) {
  const g = new THREE.Group(); g.position.set(ox, 0, oz); scene.add(g);
  const R = 2.6, H = 24, NX = 4, NZ = 3, LEG = 2.4;
  const W = NX * 2 * R, Dp = NZ * 2 * R;
  box(W + 13, 0.4, Dp + 3, SM.concrete, -4, 0.2, 0, g);

  // bins: hopper bottoms on short legs, striped shell, radial fins
  const shellMat = std(0xffffff, { map: stripeTex });
  stripeTex.repeat.set(3, 1);
  const shell = new THREE.CylinderGeometry(R, R, H, 48, 1, true);
  const hopper = new THREE.CylinderGeometry(R, 0.7, 1.4, 24);
  const leg = new THREE.BoxGeometry(0.35, LEG, 0.35);
  const finGeo = new THREE.BoxGeometry(0.06, H - 0.2, 0.42);
  const dummy = new THREE.Object3D(), finMats = [];
  const FINS = 44;
  for (let i = 0; i < NX; i++) for (let j = 0; j < NZ; j++) {
    const x = (i - (NX - 1) / 2) * 2 * R, z = (j - (NZ - 1) / 2) * 2 * R;
    const outer = i === 0 || i === NX - 1 || j === 0 || j === NZ - 1;
    mesh(shell, shellMat, x, LEG + 1.4 + H / 2, z, g);
    mesh(hopper, SM.concrete, x, LEG + 0.7, z, g);
    for (const [lx, lz] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) mesh(leg, SM.fin, x + lx * 1.0, LEG / 2 + 0.4, z + lz * 1.0, g);
    if (!outer) continue;
    for (let k = 0; k < FINS; k++) {
      const a = (k / FINS) * Math.PI * 2;
      dummy.position.set(x + Math.cos(a) * (R + 0.2), LEG + 1.4 + H / 2, z + Math.sin(a) * (R + 0.2));
      dummy.rotation.set(0, -a, 0);
      dummy.updateMatrix(); finMats.push(dummy.matrix.clone());
    }
  }
  const fins = new THREE.InstancedMesh(finGeo, SM.fin, finMats.length);
  finMats.forEach((m, i) => fins.setMatrixAt(i, m));
  fins.castShadow = fins.receiveShadow = true; g.add(fins);
  box(W - 0.6, 0.6, Dp - 0.6, SM.concrete, 0, LEG + 1.4 + H, 0, g);      // ring beam under headhouse

  // headhouse: concrete frame, brick panels, clerestory windows, overhanging flat roof
  const hy = LEG + 1.4 + H + 0.3;
  framed(g, W + 0.6, 4.2, Dp + 0.6, 0, hy, 0, 2.6, 4.2, {});
  for (const s of [-1, 1]) {
    for (let x = -W / 2 + 1.3; x < W / 2; x += 2.6) {
      box(1.8, 0.7, 0.12, SM.winFrame, x, hy + 3.6, s * (Dp / 2 + 0.42), g);
      box(1.6, 0.5, 0.14, SM.win, x, hy + 3.6, s * (Dp / 2 + 0.42), g);
    }
    for (let z = -Dp / 2 + 1.3; z < Dp / 2; z += 2.6) {
      box(0.12, 0.7, 1.8, SM.winFrame, s * (W / 2 + 0.42), hy + 3.6, z, g);
      box(0.14, 0.5, 1.6, SM.win, s * (W / 2 + 0.42), hy + 3.6, z, g);
    }
  }
  box(W + 2.2, 0.45, Dp + 2.2, SM.roof, 0, hy + 4.45, 0, g);
  box(W + 2.3, 0.6, 0.15, SM.frame, 0, hy + 4.4, Dp / 2 + 1.1, g);
  box(W + 2.3, 0.6, 0.15, SM.frame, 0, hy + 4.4, -Dp / 2 - 1.1, g);

  // elevator tower at the west end
  const TW = 7, TD = 8.5, tx = -W / 2 - TW / 2 - 0.2, TH = hy + 4.6;
  framed(g, TW, TH, TD, tx, 0, -1.2, 2.4, 3.2, { windows: 'top' });
  // plain concrete strip on the front and back faces, beside the bins
  for (const s of [-1, 1]) box(2.6, TH - 1, 0.3, texMat(formworkTex, 1, TH / 8), tx + TW / 2 - 1.5, (TH - 1) / 2, -1.2 + s * (TD / 2 + 0.2), g);
  box(0.3, TH - 1, 3.2, texMat(formworkTex, 1, TH / 8), tx - TW / 2 - 0.2, (TH - 1) / 2, 1.2, g);
  // stepped upper floors
  framed(g, TW - 0.6, 6.4, TD - 1.6, tx - 0.3, TH, -1.6, 2.2, 3.2, { windows: true });
  box(TW + 0.2, 0.3, TD - 0.8, SM.roof, tx - 0.3, TH + 6.5, -1.6, g);
  framed(g, 4.4, 3.2, 4.6, tx - 0.9, TH + 6.6, -2.2, 2.2, 3.2, { windows: true });
  box(5, 0.3, 5.2, SM.roof, tx - 0.9, TH + 9.9, -2.2, g);
  // red lattice frame on the roof
  const top = TH + 6.65, fx = tx + 1.6, fz = -1.6;
  for (const dx of [-1.6, 1.6]) box(0.12, 2.6, 0.12, SM.red, fx + dx, top + 1.3, fz, g);
  for (const yy of [top + 1.4, top + 2.6]) box(3.4, 0.12, 0.12, SM.red, fx, yy, fz, g);
  for (let i = 0; i < 4; i++) {
    const d = box(0.1, 1.6, 0.1, SM.red, fx - 1.2 + i * 0.8, top + 2.0, fz, g);
    d.rotation.z = i % 2 ? 0.6 : -0.6;
  }
  // antennas and a small dish
  mesh(new THREE.CylinderGeometry(0.06, 0.08, 6, 6), M.iron, tx - 1.6, TH + 13, -3.2, g);
  mesh(new THREE.CylinderGeometry(0.05, 0.06, 4, 6), M.iron, tx - 0.2, TH + 12, -1.0, g);
  const dish = mesh(new THREE.SphereGeometry(0.6, 12, 6, 0, Math.PI * 2, 0, Math.PI / 3), SM.fin, tx - 2.4, TH + 10.6, -0.6, g);
  dish.rotation.x = -1.1; dish.material.side = THREE.DoubleSide;

  // conveyor gantry reaching toward the quay
  const arm = box(0.9, 0.9, 10, std(0x9a8f80), W / 2 - 2.6, hy - 8, Dp / 2 + 4.6, g);
  arm.rotation.x = 0.55;
  return g;
}

const bank=silos(0,0);
if(driveThrough){
  // Keep the authored silo bank intact on a loading basement, with a race
  // passage below it. The original hopper legs remain above the basement roof.
  bank.position.y=8;
  const basement=texMat(formworkTex,6,2);
  box(9,8,18.6,basement,-16,4,0);
  box(3.8,8,18.6,basement,11,4,0);
  box(33.8,.8,18.6,basement,-4,7.6,0);
  for(const x of [-11.3,8.9])for(const z of [-7,0,7])box(.12,.28,1.4,std(0xffe3aa,{emissive:0xffcc88,emissiveIntensity:.45}),x,6.3,z);
}
const out=finishPrototype(scene,'port-silos');out.userData.foundationDepth=0.15;out.userData.source='Casa Guipuzcoana 3D (1).html';out.userData.bins=12;out.userData.fins=440;out.userData.driveThrough=driveThrough;return out;
}
