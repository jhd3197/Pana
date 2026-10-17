import * as THREE from 'three';
import { M, mesh, tube, canvasMat } from '/engine/models/core/primitives.js';

function venezuelaFlag() {
  const material = canvasMat(192, 128, (g) => {
    g.fillStyle = '#ffcc00';
    g.fillRect(0, 0, 192, 43);
    g.fillStyle = '#00247d';
    g.fillRect(0, 43, 192, 42);
    g.fillStyle = '#cf142b';
    g.fillRect(0, 85, 192, 43);
    g.fillStyle = '#ffffff';
    for (let i = 0; i < 8; i++) {
      const a = Math.PI * (0.18 + 0.64 * i / 7);
      g.beginPath();
      g.arc(96 - Math.cos(a) * 34, 78 - Math.sin(a) * 26, 3.4, 0, Math.PI * 2);
      g.fill();
    }
  });
  material.userData.ownedMap = true;
  return material;
}

function panaFlag() {
  const material = canvasMat(192, 128, (g) => {
    g.fillStyle = '#1a1336'; g.fillRect(0, 0, 192, 128);
    g.fillStyle = '#ffc629'; g.fillRect(0, 98, 192, 14);
    g.fillStyle = '#2ad1b2'; g.fillRect(0, 112, 192, 16);
    g.fillStyle = '#cf7d22';
    g.beginPath(); g.ellipse(46, 50, 28, 32, 0, 0, Math.PI * 2); g.fill();
    for (const x of [26, 66]) { g.beginPath(); g.ellipse(x, 22, 7, 8, 0, 0, Math.PI * 2); g.fill(); }
    g.fillStyle = '#8b5e3c'; g.beginPath(); g.ellipse(46, 66, 18, 13, 0, 0, Math.PI * 2); g.fill();
    g.fillStyle = '#16161a';
    for (const x of [35, 57]) { g.beginPath(); g.arc(x, 46, 3.6, 0, Math.PI * 2); g.fill(); }
    g.fillStyle = '#ffc629'; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.font = '44px "Luckiest Guy", system-ui, sans-serif'; g.fillText('PANA', 132, 54, 104);
  });
  material.userData.ownedMap = true;
  return material;
}

function flagPole({ h = 9, flag: design = 'venezuela' } = {}) {
  const g = new THREE.Group();
  g.add(mesh(new THREE.CylinderGeometry(0.12, 0.16, h, 8), M(0x8a8a92, { metalness: 0.4, roughness: 0.5 }), 0, h / 2, 0));
  const flag = new THREE.Group();
  flag.position.set(0, h - 0.8, 0);
  const fabric = design === 'pana' ? panaFlag() : venezuelaFlag();
  fabric.side = THREE.DoubleSide;
  const f = new THREE.Mesh(new THREE.PlaneGeometry(2.6, 1.7, 20, 10), fabric);
  const rest = f.geometry.attributes.position.array.slice();
  f.position.x = 1.35;
  flag.add(f);
  g.add(flag);
  const cord = M(0xd4c9ab, { roughness: 1 });
  g.add(tube([0.18, 1.1, 0], [0.18, h - 0.03, 0], 0.012, cord));
  g.add(tube([0.18, 1.1, 0], [0.23, 1.35, 0], 0.022, cord));
  g.add(mesh(new THREE.SphereGeometry(0.18, 12, 8), M(0xc4ad75, { metalness: 0.55, roughness: 0.4 }), 0, h, 0));
  g.userData.tick = (t) => {
    const pos = f.geometry.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      const x = rest[i * 3], y = rest[i * 3 + 1], u = (x + 1.3) / 2.6;
      pos.setXYZ(i, x - 0.07 * u * u, y - 0.13 * u * u + Math.sin(t * 2.4 + x * 2 + y) * 0.025 * u,
        (Math.sin(t * 3.2 - u * 6.3 + y * 0.65) * 0.17 + Math.sin(t * 5 - u * 11) * 0.045) * u);
    }
    pos.needsUpdate = true;
    f.geometry.computeVertexNormals();
  };
  g.userData.tick(0);
  let disposed=false;
  g.userData.dispose=()=>{if(disposed)return;disposed=true;fabric.map.dispose();fabric.dispose();};
  return g;
}

export { venezuelaFlag, panaFlag, flagPole };
