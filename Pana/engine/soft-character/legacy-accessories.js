import * as THREE from 'three';


function M(color, extra = {}) {
  return new THREE.MeshStandardMaterial({ color, roughness: 0.9, ...extra });
}

function part(geo, mat, x = 0, y = 0, z = 0) {
  const m = new THREE.Mesh(geo, mat);
  m.position.set(x, y, z);
  m.castShadow = true;
  m.receiveShadow = true;
  return m;
}

const blob = (r, detail = 1) => new THREE.IcosahedronGeometry(r, detail);
const shade = (hex, k) => '#' + new THREE.Color(hex).multiplyScalar(k).getHexString();
const GOLD = () => M('#ffc629', { metalness: 0.5, roughness: 0.35, emissive: '#3a2a00' });

// Octagonal rings make broad readable facets instead of triangulated balls.
// Each profile is [height, half-width, half-depth, corner cut].
function profileGeometry(profile) {
  const vertices = [], rings = profile.map(([y, x, z, c]) => [
    [-x + c, y, -z], [x - c, y, -z], [x, y, -z + c], [x, y, z - c],
    [x - c, y, z], [-x + c, y, z], [-x, y, z - c], [-x, y, -z + c],
  ]);
  const triangle = (a, b, c) => vertices.push(...a, ...b, ...c);
  for (let j = 0; j < rings.length - 1; j++) for (let i = 0; i < 8; i++) {
    const n = (i + 1) % 8;
    triangle(rings[j][i], rings[j + 1][i], rings[j + 1][n]);
    triangle(rings[j][i], rings[j + 1][n], rings[j][n]);
  }
  for (let i = 1; i < 7; i++) {
    triangle(rings[0][0], rings[0][i], rings[0][i + 1]);
    triangle(rings.at(-1)[0], rings.at(-1)[i + 1], rings.at(-1)[i]);
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
  geometry.computeVertexNormals(); return geometry;
}
function chunk(w, h, d, bevel = 0.08) {
  const b = Math.min(bevel, w / 4, h / 3, d / 4), x = w / 2, z = d / 2;
  return profileGeometry([
    [-h / 2, x - b * 0.6, z - b * 0.6, b * 0.4],
    [-h / 2 + b, x, z, b], [h / 2 - b, x, z, b],
    [h / 2, x - b * 0.6, z - b * 0.6, b * 0.4],
  ]);
}
// ---------- hats ----------
export function addLegacyHat(head, r, style, color) {
  const m = M(color);
  const dark = M(shade(color, 0.72));
  switch (style) {
    case 'gorra':
    case 'gorra-atras': {
      const dir = style === 'gorra-atras' ? -1 : 1;
      const crown = part(new THREE.SphereGeometry(r, 10, 4, 0, Math.PI * 2, 0, Math.PI / 2), m, 0, r * 0.55, -r * 0.04);
      crown.scale.set(1.14, 0.65, 1.03);
      head.add(crown);
      const brim = part(chunk(r * 1.78, r * 0.1, r * 1.13, r * 0.15), m, 0, r * 0.58, dir * r * 1.01);
      brim.rotation.x = dir * -0.07;
      head.add(brim);
      head.add(part(chunk(r * 1.55, r * 0.035, r * 0.98, r * 0.12), dark, 0, r * 0.51, dir * r * 1.02));
      head.add(part(blob(r * 0.09, 0), m, 0, r * 1.2, -r * 0.04));
      break;
    }
    case 'pesca':
      head.add(part(new THREE.CylinderGeometry(r * 0.88, r * 1.13, r * 0.6, 10), m, 0, r * 0.82, 0));
      head.add(part(new THREE.CylinderGeometry(r * 1.38, r * 1.45, r * 0.08, 12), dark, 0, r * 0.52, 0));
      break;
    case 'lana': {
      const crown = part(new THREE.SphereGeometry(r, 10, 5, 0, Math.PI * 2, 0, Math.PI / 2), m, 0, r * 0.32, 0);
      crown.scale.set(1.21, 0.95, 1.14); crown.position.y = r * 0.41;
      head.add(crown);
      const cuff = part(new THREE.CylinderGeometry(r * 1.14, r * 1.16, r * 0.2, 12), dark, 0, r * 0.36, 0);
      cuff.scale.z = 0.94;
      head.add(cuff);
      head.add(part(blob(r * 0.24, 0), M(shade(color, 1.15)), 0, r * 1.3, 0));   // pompom
      break;
    }
    case 'corona': {
      const gold = GOLD();
      head.add(part(new THREE.CylinderGeometry(r * 0.6, r * 0.64, r * 0.28, 10, 1, true), gold, 0, r * 1.0, 0));
      for (let i = 0; i < 5; i++) {
        const ang = (i / 5) * Math.PI * 2;
        head.add(part(new THREE.ConeGeometry(r * 0.14, r * 0.34, 4), gold, Math.sin(ang) * r * 0.58, r * 1.3, Math.cos(ang) * r * 0.58));
      }
      break;
    }
    case 'llanero':
      head.add(part(new THREE.CylinderGeometry(r * 0.7, r * 1.0, r * 0.62, 10), m, 0, r * 0.98, 0));
      head.add(part(new THREE.CylinderGeometry(r * 0.96, r * 1.01, r * 0.13, 10), M('#2b2d42'), 0, r * 0.72, 0));
      head.add(part(new THREE.CylinderGeometry(r * 1.7, r * 1.7, r * 0.08, 14), m, 0, r * 0.64, 0));
      break;
    default:
  }
}

