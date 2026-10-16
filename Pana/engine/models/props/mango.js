import * as THREE from 'three';
import { M, mesh } from '/engine/models/core/primitives.js';
import { leafBlade, taperedStem } from '/engine/models/core/botanical-shapes.js';

const mangoBodies = new Map();
function mangoBody(gold) {
  if (!mangoBodies.has(gold)) {
    const geo = new THREE.SphereGeometry(1, 28, 20), pos = geo.attributes.position, colors = [];
    const yellow = new THREE.Color(gold ? 0xffcc47 : 0xffbd32);
    const blush = new THREE.Color(gold ? 0xe69a19 : 0xe94e28);
    const green = new THREE.Color(gold ? 0xffdf75 : 0xc9b640);
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i);
      const fullness = 1 + y * 0.14 - y * y * 0.08;
      // One continuous, asymmetric fruit with a full shoulder and curved lower tip.
      pos.setXYZ(i, x * 0.46 * fullness + 0.13 * (1 - y * y) - y * 0.09,
        y * 0.55 - x * 0.025, z * 0.42 * (1 + y * 0.07));
      const red = THREE.MathUtils.smoothstep(x * 0.55 + z * 0.72 + y * 0.28, -0.1, 0.85);
      const color = yellow.clone().lerp(blush, red * (gold ? 0.35 : 0.88));
      color.lerp(green, THREE.MathUtils.smoothstep(y, 0.65, 1) * 0.55);
      colors.push(color.r, color.g, color.b);
    }
    geo.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3)); geo.computeVertexNormals();
    mangoBodies.set(gold, geo);
  }
  // Callers dispose their own geometry; templates are never mounted in a scene.
  return mangoBodies.get(gold).clone();
}

function makeMango({ gold = false } = {}) {
  const g = new THREE.Group();
  const skin = M(0xffffff, { vertexColors: true, flatShading: false,
    roughness: gold ? 0.32 : 0.46, metalness: gold ? 0.72 : 0,
    emissive: gold ? 0xb66c09 : 0, emissiveIntensity: gold ? 0.08 : 0 });
  const wood = M(gold ? 0x98702c : 0x6b472a, { flatShading: false, roughness: 0.85 });
  const green = M(0xffffff, { vertexColors: true, side: THREE.DoubleSide, flatShading: false, roughness: 0.72 });
  const body = mesh(mangoBody(gold), skin); body.name = 'mango-body';
  g.add(body, mesh(taperedStem([[-0.09, 0.53, 0], [-0.12, 0.65, -0.02], [-0.06, 0.74, -0.035]], 0.038, 0.027, 6, 7), wood));
  const leaf = mesh(leafBlade(0.64, 0.16, 0.13, gold ? 0x859d39 : 0x559936), green, -0.1, 0.65, -0.015);
  leaf.rotation.set(0.2, -0.3, 0.15); g.add(leaf);
  const vein = mesh(taperedStem([[0, 0.006, 0], [0.3, 0.115, 0], [0.62, -0.067, 0]], 0.009, 0.002, 6, 4), M(0xb0bd59, { flatShading: false }));
  leaf.add(vein);
  // Keep the historic centered origin and root scale used by held/thrown fruit.
  g.scale.setScalar(1.5);
  return g;
}


export { makeMango };
