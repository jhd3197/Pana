import * as THREE from 'three';
import { surface, mesh, ellipsoid, curve } from './geometry.js';

const EXPRESSIONS = ['natural', 'smile', 'talk', 'laugh'];
const PREVIEWS = { natural: 0, smile: 1, talk: 0.45, laugh: 0.85 };
const smooth = THREE.MathUtils.smoothstep;

// All poses are built once. Interpolating nearby surface samples keeps the
// lining on the curved face at intermediate openings, including profile views.
export function createMouth({ head, skull, headFront, mouthInset, material }) {
  const liningMat = material('Smile lining', '#470d06', { roughness: 1, sheen: 0, side: THREE.DoubleSide });
  const tongueMat = material('Tongue', '#db4b40', { roughness: 0.6, sheen: 0 });
  const toothMat = material('Ivory incisors', '#fff3d8', { roughness: 0.35, sheen: 0 });
  const depth = (x, y, opening, offset) => headFront(x, y) - mouthInset(x, y) * opening + offset;
  const closedY = x => -0.495 + 0.22 * (x / 0.375) ** 2;
  const project = (x, y, opening, offset) => {
    const closed = closedY(x) + (y + 0.48) * 0.025;
    const yy = THREE.MathUtils.lerp(closed, y, opening);
    return [x, yy, depth(x, yy, opening, offset)];
  };
  function morphedPatch(name, sample, mat, offset, columns, rows) {
    const geometry = surface((u, v) => {
      const [x, y] = sample(u, v); return project(x, y, 1, offset);
    }, columns, rows);
    geometry.morphAttributes.position = []; geometry.morphAttributes.normal = [];
    for (let step = 0; step <= 8; step++) {
      const opening = step / 8, positions = [], normals = [], epsilon = 0.0005;
      for (let j = 0; j <= rows; j++) for (let i = 0; i <= columns; i++) {
        const [x, y] = sample(i / columns, j / rows), p = project(x, y, opening, offset);
        positions.push(...p);
        const dx = (depth(x + epsilon, p[1], opening, offset) - depth(x - epsilon, p[1], opening, offset)) / (2 * epsilon);
        const dy = (depth(x, p[1] + epsilon, opening, offset) - depth(x, p[1] - epsilon, opening, offset)) / (2 * epsilon);
        normals.push(...new THREE.Vector3(-dx, -dy, 1).normalize().toArray());
      }
      geometry.morphAttributes.position.push(new THREE.Float32BufferAttribute(positions, 3));
      geometry.morphAttributes.normal.push(new THREE.Float32BufferAttribute(normals, 3));
    }
    const item = mesh(head, name, geometry, mat);
    // The sculpt supplies contact shading; thin lining should not cast a second
    // outline onto the face when the mouth closes.
    item.castShadow = false;
    return item;
  }
  const lining = morphedPatch('Animated smile', (u, v) => {
    const q = u * 2 - 1, x = q * 0.375;
    const top = -0.25 - 0.025 * q * q, bottom = -0.275 - 0.43 * Math.sqrt(Math.max(0, 1 - q * q));
    return [x, THREE.MathUtils.lerp(top, bottom, v)];
  }, liningMat, 0.017, 64, 20);
  const tongue = morphedPatch('Tongue', (u, v) => {
    const a = u * Math.PI * 2;
    return [Math.cos(a) * 0.165 * v, -0.615 + Math.sin(a) * 0.082 * v];
  }, tongueMat, 0.032, 40, 12);
  const teeth = new THREE.Group(); teeth.name = 'Retracting incisors'; head.add(teeth);
  ellipsoid(teeth, 'Two joined incisors', toothMat, [0, 0, 0], [0.17, 0.098, 0.055], 0.78, 40);
  curve(teeth, 'Tooth divide', [[0, -0.01, 0.055], [0, -0.07, 0.044]], 0.002, material('Tooth seam', '#deceb0'), false, 6);

  // Fill the existing recess as the lips meet; otherwise a closed smile leaves
  // an empty dent underneath it. The rest of the head is unchanged.
  const closedSkull = skull.geometry.clone(), p = closedSkull.attributes.position;
  for (let i = 0; i < p.count; i++) if (p.getZ(i) > 0) p.setZ(i, p.getZ(i) + mouthInset(p.getX(i), p.getY(i)));
  closedSkull.computeVertexNormals();
  skull.geometry.morphAttributes.position = [p.clone()];
  skull.geometry.morphAttributes.normal = [closedSkull.attributes.normal.clone()];
  closedSkull.dispose(); skull.updateMorphTargets();

  let expression = 'natural', time = 0, opening = 0;
  function apply(value) {
    opening = THREE.MathUtils.clamp(value, 0, 1);
    const frame = opening * 8, low = Math.min(7, Math.floor(frame)), mix = frame - low;
    for (const item of [lining, tongue]) {
      item.morphTargetInfluences.fill(0);
      item.morphTargetInfluences[low] = 1 - mix;
      item.morphTargetInfluences[low + 1] = mix;
    }
    skull.morphTargetInfluences[0] = 1 - opening;
    // Retract under the muzzle instead of leaving teeth over a closed mouth.
    teeth.position.set(0, -0.31 - 0.12 * opening, 0.91);
    teeth.scale.y = Math.max(0.02, opening);
    teeth.visible = opening > 0.12;
    tongue.visible = opening > 0.16;
  }
  apply(0);
  return {
    lining, tongue, teeth,
    get expression() { return expression; },
    get openness() { return opening; },
    get eyeScale() { return expression === 'laugh' ? 1 - opening * 0.3 : 1; },
    get nod() { return expression === 'laugh' ? Math.sin(time * 9) * opening * 0.025 : 0; },
    setExpression(value, { immediate = false } = {}) {
      if (!EXPRESSIONS.includes(value)) return;
      expression = value; time = 0;
      if (immediate) apply(PREVIEWS[value]);
    },
    update(dt, pose, open) {
      time += dt;
      let target = 0;
      if (expression === 'smile') target = 1;
      if (expression === 'natural') {
        const t = time % 10;
        // Mostly a closed, relaxed smile, with a brief friendly expression.
        target = 0.48 * smooth(t, 5.6, 6.3) * (1 - smooth(t, 7.1, 8));
        if (pose === 'wave') {
          const wave = time % 5.6;
          target = Math.max(target, 0.68 * smooth(wave, 0, 0.35) * (1 - smooth(wave, 2.4, 3.2)));
        }
      }
      if (expression === 'talk') {
        const t = time % 4.8, phrase = smooth(t, 0, 0.18) * (1 - smooth(t, 2.9, 3.4));
        target = phrase * (0.22 + 0.65 * Math.max(0, Math.sin(time * 14 + Math.sin(time * 3))) ** 1.4);
      }
      if (expression === 'laugh') {
        const t = time % 4.2, phrase = smooth(t, 0, 0.3) * (1 - smooth(t, 2.5, 3.1));
        target = phrase * (0.32 + 0.68 * Math.sin(time * 9) ** 2);
      }
      if (open) target = 1;
      const next = THREE.MathUtils.lerp(opening, target, 1 - Math.exp(-dt * 20));
      apply(Math.abs(next - target) < 0.0001 ? target : next);
    },
  };
}
